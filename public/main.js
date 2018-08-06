'use strict'

/* eslint-env module */

const page = require('page')
const $ = require('jquery')
const fetch = window.fetch || require('whatwg-fetch')
const version = require('../package.json').version
$('.version').text('v' + version)

const APIURL = module.hot ? 'http://localhost:5334/' : '/' // use localhost:5334 for dev, otherwise current origin

const api = (u, ...a) => fetch(APIURL + u, ...a)
const middle = (url) => (ctx, next) => { // fetch URLs as middleware
  api(url.replace(/\$([a-z0-9]+)/gmi, (_, param) => ctx.params[param])).then(res => res.json()).then(res => {
    ctx.api = res
    return next()
  })
}

$('#searchform').on('submit', e => {
  e.preventDefault()
  page('/search/' + encodeURIComponent($('#searchval').val()) + '/1')
})

const tmplAlert = require('./templates/alert.pug')
const alert = (type, important, message) => $('.alerts').append(tmplAlert({type, important, message}))

const tmplLoader = require('./templates/loader.pug')
page((ctx, next) => {
  $('.page').html(tmplLoader({}))
  $('.active').removeClass('active')
  $('a[href=' + JSON.stringify(ctx.path) + ']').addClass('active')
  next()
})

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
    page('/search/' + encodeURIComponent($('#search-val').val()) + '/1')
  })
}

page('/search', (ctx) => {
  $('.page').html(tmplSearch({results: [], query: ''}))
  appSearch()
})

page('/search/:query/:page', middle('search?query=$query&page=$page'), (ctx) => {
  $('.page').html(tmplSearch(ctx.api))
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
      if (res.success) {
        alert('success', 'Saved', 'Update check was scheudled')
        page('/app/' + res.id + '/')
      } else {
        alert('error', 'Error occured while saving', 'Please check the settings below and try again')
      }
    })
  })
}

page('/add/:id', middle('app/$id'), (ctx) => {
  if (ctx.api.alreadyInDB) {
    alert('info', 'Already in Database', 'This app has already been added. Redirecting to settings...')
    return page.redirect('/app/' + ctx.api.alreadyInDB)
  }
  ctx.api.notes = ctx.api.notes.split('\n')
  $('.page').html(tmplAdd(ctx.api))
  appPage(ctx.params.id)
})

/* App settings */

const tmplSettings = require('./templates/settings.pug')

page('/app/:id', middle('app/$id'), (ctx, next) => {
  if (ctx.api.notFound) {
    alert('danger', 'App not found', 'Perhaps it was deleted or wasn\'t added')
    return page.redirect('/')
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
