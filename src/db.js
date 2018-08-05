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
    }
  }),
  Variant: mongoose.model('Variant', {
    appId: String,
    name: String,
    url: String,
    version: String,
    versionUrl: String,
    curVersionUrl: String
  })
}
