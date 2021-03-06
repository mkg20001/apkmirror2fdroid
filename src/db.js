'use strict'

const mongoose = require('mongoose')

module.exports = {
  App: mongoose.model('App', {
    // details from app page
    play: {
      url: String,
      id: String,
      category: String,
      categoryUrl: String
    },
    app: {
      icon: String, // can only be retrieved from .searchForApps
      name: String,
      url: String
    },
    dev: {
      display: String,
      name: String,
      url: String
    },
    notes: String,
    variants: Array,
    lastCheck: Date,
    automanaged: Boolean // TODO: add this feature
  }),
  Variant: mongoose.model('Variant', {
    appId: String,
    name: String,
    url: String,
    version: String,
    versionUrl: String,
    curVersionUrl: String,
    arch: String,
    androidVer: String,
    dpi: String,
    isDirectRelease: Boolean
  })
}
