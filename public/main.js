'use strict'

/* eslint-env module */

const tmplIndex = require('./templates/index.pug')
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

page('/', middle('apps'), (ctx) => {
  try {
    $('.page').html(tmplIndex({apps: ctx.api}))
  } catch (e) {
    console.log(e)
  }
})

page('*', console.log)

page({})
