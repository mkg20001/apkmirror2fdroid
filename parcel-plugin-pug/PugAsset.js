'use strict'

const path = require('path')
const Asset = require('parcel-bundler/src/Asset')
const localRequire = require('parcel-bundler/src/utils/localRequire')

class PugAsset extends Asset {
  constructor (name, options) {
    super(name, options)
    this.type = 'js'
  }

  async generate () {
    const pug = await localRequire('pug', this.name)
    const config =
      (await this.getConfig(['.pugrc', '.pugrc.js', 'pug.config.js'])) || {}

    const compiled = pug.compileClient(this.contents, {
      compileDebug: false,
      filename: this.name,
      basedir: path.dirname(this.name),
      pretty: !this.options.minify,
      templateName: path.basename(this.basename, path.extname(this.basename)),
      filters: config.filters,
      filterOptions: config.filterOptions,
      filterAliases: config.filterAliases
    })

    if (compiled.dependencies) {
      for (let item of compiled.dependencies) {
        this.addDependency(item, {
          includedInParent: true
        })
      }
    }

    return compiled + ';module.exports=template;'
  }
}

module.exports = PugAsset
