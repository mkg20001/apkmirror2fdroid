'use strict'

const Hapi = require('hapi')
const Joi = require('joi')
const {App, Version} = require('./db')
const prom = (fnc) => new Promise((resolve, reject) => fnc((err, res) => err ? reject(err) : resolve(res)))
const apk = require('apkmirror-client')
const request = require('request')

const mongoose = require('mongoose')
mongoose.connect('mongodb://localhost/apk2fdroid')

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
        addUrl: '/add/' + Buffer.from(r.app.url).toString('base64')
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

server.route({
  method: 'GET',
  path: '/getAppInfo/{id}',
  handler: async (req, h) => {
    return prom(cb => {
      apk.getAppPage({
        app: {url: String(Buffer.from(req.params.id, 'base64'))}
      }, cb)
    })
  }
})

server.route({
  method: 'GET',
  path: '/apps',
  handler: (request, h) => {
    return App.find({})
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
