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
    versions: Array
  }),
  Version: {
    appId: String

  }
}
