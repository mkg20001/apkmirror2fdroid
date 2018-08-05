'use strict'

const Hapi = require('hapi')
const Joi = require('joi')

const mongoose = require('mongoose')
mongoose.connect('mongodb://localhost/apk2fdroid')
const {App, Variant} = require('./db')

const apk = require('apkmirror-client')
const prom = (fnc) => new Promise((resolve, reject) => fnc((err, res) => err ? reject(err) : resolve(res)))
const request = require('request')

const fs = require('fs')
const path = require('path')

const crypto = require('crypto')
const shortHash = (str) => {
  let hash = crypto.createHash('sha512').update(str).digest('hex')
  return hash.substr(parseInt(hash.substr(0, 1), 16), 16)
}

/* Server */

const server = Hapi.server({
  port: 5334,
  host: 'localhost',
  routes: {
    cors: {
      origin: ['*']
    }
  }
})

server.route({
  method: 'GET',
  path: '/search',
  config: {
    validate: {
      query: {
        query: Joi.string().required()
      }
    }
  },
  handler: async (request, h) => {
    const res = await prom(cb => apk.searchForApps(request.query.query, cb))
    return res.map(r => {
      let origin = `${request.headers['x-forwarded-proto'] || request.server.info.protocol}://${request.info.host}`
      return {
        icon: origin + '/imgproxy?proxy=' + encodeURIComponent(r.app.icon.replace('w=32&h=32', 'w=64&h=64')),
        name: r.app.name,
        by: r.dev.name,
        url: r.app.url,
        devUrl: r.dev.url,
        info: r.info,
        addUrl: '/add/_' + Buffer.from(r.app.url).toString('base64')
      }
    })
  }
})

server.route({
  method: 'GET',
  path: '/imgproxy',
  config: {
    validate: {
      query: {
        proxy: Joi.string().regex(/^https:\/\/www\.apkmirror\.com\//)
      }
    }
  },
  handler: async (req, h) => {
    const res = await prom(cb => request({url: req.query.proxy, encoding: null}, (err, _, res) => cb(err, res)))
    return h.response(res).header('Content-Type', 'image/png')
  }
})

const variantsUpdate = async (app) => {
  let variants = app.id ? await prom(cb => Variant.find({appId: app.id}, cb)) : []

  app.variants.forEach(variant => {
    variant._db = variants.filter(v => v.name === variant.name)[0]
    variant.enabled = Boolean(variant._db)
    variant.id = shortHash(variant.url)
  })

  return app
}

const appGet = async (req, h) => {
  let id = req.params.id
  let app

  if (id.startsWith('_')) {
    let url = String(Buffer.from(req.params.id.substr(1), 'base64'))
    app = await prom(cb => App.findOne({app: {url}}, cb))
    if (app) {
      return {alreadyInDB: app.id}
    }

    app = await prom(cb => {
      apk.getAppPage({
        app: {url}
      }, cb)
    })
  } else {
    app = await prom(cb => App.findOne({_id: id}, cb))
    if (!app) {
      return {notFound: true}
    }
  }

  return variantsUpdate(app)
}

server.route({
  method: 'GET',
  path: '/app/{id}',
  handler: appGet
})

server.route({
  method: 'POST',
  path: '/app/{id}',
  config: {
    validate: {
      payload: {
        variants: Joi.array().required()
      }
    }
  },
  handler: async (req, h) => {
    const res = await appGet(req, h)
    if (res.notFound || res.alreadyInDB) return res
    let app
    if (!res.id) {
      app = new App(res)
      await prom(cb => app.save(cb)) // so we get an id
    } else app = res

    let newVariants = app.variants.filter(v => req.payload.variants.indexOf(v.id) !== -1)
    let newIds = req.payload.variants
    let currentVariants = app.variants.filter(v => v.enabled)

    await Promise.all( // drop old
      currentVariants
        .filter(v => newIds.indexOf(v.id) === -1)
        .map(v => prom(cb => v._db.remove(cb))))

    await Promise.all( // add new
      newVariants
        .filter(v => !v.enabled)
        .map(v => prom(cb => new Variant(Object.assign(v, {appId: app.id})).save(cb)))
    )

    await variantsUpdate(app)
    app.markModified('variants')
    await prom(cb => app.save(cb))

    checkQueue.add({app: app.id})

    return {success: true, id: app.id}
  }
})

server.route({
  method: 'GET',
  path: '/apps',
  handler: (request, h) => {
    return App.find({})
  }
})

/* Queues */

const Queue = require('bull')

const downloadQueue = new Queue('downloading')
const checkQueue = new Queue('update checks')

const SHARED_APP = ['play', 'app', 'dev', 'notes', 'variants']
const SHARED_VARIANT = ['name', 'url', 'version', 'versionUrl', 'arch', 'androidVer', 'dpi']

checkQueue.process(async (job, done) => {
  const app = await prom(cb => App.findOne({_id: job.data.app}, cb))
  if (!app) { // vanished
    console.error('App %s vanished...', job.data.app)
    return done()
  }
  console.log('Update check for %s...', app.app.name)

  const page = await prom(cb => apk.getAppPage(app, cb))
  SHARED_APP.forEach(key => (app[key] = page[key]))
  await variantsUpdate(app)
  app.lastCheck = Date.now()

  await Promise.all(app.variants.filter(v => v.enabled).map(async (v) => {
    SHARED_VARIANT.forEach(key => (v._db[key] = v[key]))
    await prom(cb => v._db.save(cb))
    if (v._db.curVersionUrl !== v.versionUrl) {
      downloadQueue.add({variant: v._db.id}, {attempts: 10, backoff: 'jitter'})
    }
  }))

  await prom(cb => app.save(cb))

  return done()
})

downloadQueue.process(async (job, done) => {
  const variant = await prom(cb => Variant.findOne({_id: job.data.variant}, cb))
  if (!variant) { // vanished
    console.error('Variant %s vanished...', job.data.variant)
    return done()
  }
  const app = await prom(cb => App.findOne({_id: variant.appId}, cb))
  if (!app) { // vanished
    console.error('App %s vanished...', variant.appId)
    return done()
  }
  if (variant.curVersionUrl !== variant.versionUrl) {
    console.log('Download %s %s %s...', app.app.name, variant.versionUrl, variant.name)
    const page = await prom(cb => apk.getReleasePage(variant.versionUrl, cb))
    const v = page.variants.filter(v => v.arch === variant.arch && v.androidVer === variant.androidVer && v.dpi === variant.dpi)[0]
    const variantPage = await prom(cb => v.loadVariant(cb))
    let size = parseInt(variantPage.size.match(/([\d,]+) bytes/)[1].replace(/,/g, ''), 10)
    const stream = await prom(cb => variantPage.downloadAPK(cb))
    let dlSize = 0
    let outname = [app.play.id, variant.arch, variant.androidVer, variant.dpi, v.id].join('_').replace(/[^a-z0-9]/gmi, '_') + '.apk'
    stream.on('data', data => {
      dlSize += data.length
      job.progress(dlSize / size)
    })
    stream.pipe(fs.createWriteStream(path.join(process.cwd(), 'out', outname)))
    await prom(cb => stream.once('end', cb))
    console.log('Done')
    variant.curVersionUrl = variant.versionUrl
    await prom(cb => variant.save(cb))
    done()
  }
})

const init = async () => {
  await server.start()
  console.log(`Server running at: ${server.info.uri}`)
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

init()
