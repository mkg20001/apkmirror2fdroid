'use strict'

/* eslint-env module */

const page = require('page')
const $ = require('jquery')
const fetch = window.fetch || require('whatwg-fetch')

const api = (u) => fetch('http://localhost:5334/' + u)
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
page('/search', (ctx) => {
  $('.page').html(tmplSearch({results: [], query: ''}))
  $('#search').on('submit', e => {
    e.preventDefault()
    page('/search/' + $('#search-val').val())
  })
})

page('/search/:query', middle('search?query=$query'), (ctx) => {
  $('.page').html(tmplSearch({results: ctx.api, query: ctx.params.query}))
  $('#search').on('submit', e => {
    e.preventDefault()
    page('/search/' + $('#search-val').val())
  })
})

/* Add app */

const tmplAdd = require('./templates/add.pug')
page('/add/:id', middle('getAppInfo/$id'), (ctx) => {
  ctx.api.notes = ctx.api.notes.split('\n')
  $('.page').html(tmplAdd(ctx.api))
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
