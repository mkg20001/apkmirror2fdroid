'use strict'

module.exports = function (bundler) {
  bundler.addAssetType('pug', require.resolve('./PugAsset.js'))
}
