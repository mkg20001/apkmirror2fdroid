'use strict'

/* eslint-env module */

const page = require('page')
const $ = require('jquery')
const fetch = window.fetch || require('whatwg-fetch')

const APIURL = module.hot ? 'http://localhost:5334/' : '/' // use localhost:5334 for dev, otherwise current origin

const api = (u, ...a) => fetch(APIURL + u, ...a)
const middle = (url) => (ctx, next) => { // fetch URLs as middleware
  api(url.replace(/\$([a-z0-9]+)/gmi, (_, param) => ctx.params[param])).then(res => res.json()).then(res => {
    ctx.api = res
    return next()
  })
}

/* Index */

const tmplIndex = require('./templates/index.pug')
page('/', middle('apps'), (ctx) => {
  $('.page').html(tmplIndex({apps: ctx.api}))
})

/* Search */

const tmplSearch = require('./templates/search.pug')

function appSearch () {
  $('#search').on('submit', e => {
    e.preventDefault()
    page('/search/' + $('#search-val').val())
  })
}

page('/search', (ctx) => {
  $('.page').html(tmplSearch({results: [], query: ''}))
  appSearch()
})

page('/search/:query', middle('search?query=$query'), (ctx) => {
  $('.page').html(tmplSearch({results: ctx.api, query: ctx.params.query}))
  appSearch()
})

/* Add app */

const tmplAdd = require('./templates/add.pug')

function appPage (app) {
  $('#settingsSave').on('click', e => {
    e.preventDefault()
    let variants = $('input[type=checkbox]').toArray().filter(e => $(e).is(':checked')).map(e => e.id)
    api('app/' + app, {
      method: 'POST',
      body: JSON.stringify({
        variants
      })
    }).then(res => res.json()).then(res => {
      page('/app/' + res.id + '/?success=' + (res.success || 'false'))
    })
  })
}

page('/add/:id', middle('app/$id'), (ctx) => {
  if (ctx.api.alreadyInDB) {
    return page.redirect('/app/' + ctx.api.alreadyInDB)
  }
  ctx.api.notes = ctx.api.notes.split('\n')
  $('.page').html(tmplAdd(ctx.api))
  appPage(ctx.params.id)
})

/* App settings */

const tmplSettings = require('./templates/settings.pug')

page('/app/:id', middle('app/$id'), (ctx, next) => {
  if (ctx.notFound) {
    return next()
  }
  ctx.api.notes = ctx.api.notes.split('\n')
  $('.page').html(tmplSettings(ctx.api))
  appPage(ctx.params.id)
})

const tmpl404 = require('./templates/404.pug')
page('*', (ctx) => {
  $('.page').html(tmpl404(ctx))
})

page({})

if (module.hot) {
  module.hot.dispose(() => window.location.reload())

  /* module.hot.dispose(function () {
    page.stop()
    $('.page').html('...')
  })

  module.hot.accept(function () {
    page({})
  }) */
}
