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

const tmplIndex = require('./templates/index.pug')
page('/', middle('apps'), (ctx) => {
  $('.page').html(tmplIndex({apps: ctx.api}))
})

const tmplSearch = require('./templates/search.pug')
page('/search/:query', middle('search?query=$query'), (ctx) => {
  $('.page').html(tmplSearch({results: ctx.api}))
  $('#search').on('submit', e => {
    e.preventDefault()
    page('/search/' + $('#search-val').val())
  })
})

page('*', console.log)

page({})

if (module.hot) {
  module.hot.dispose(function () {
    page.stop()
    $('.page').html('...')
  })

  module.hot.accept(function () {
    page({})
  })
}
