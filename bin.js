#!/usr/bin/env node

'use strict'

const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const Server = require('.')

/* eslint-disable no-console */

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})

require('yargs') // eslint-disable-line
  .command({
    command: 'genconf',
    description: 'Generate a config file',
    builder: yargs => yargs,
    handler (argv) {
      const config = {
        redis: 'redis://127.0.0.1:6379',
        mongodb: 'mongodb://localhost/apk2fdroid',
        adminPW: crypto.randomBytes(8).toString('hex'),
        secret: crypto.randomBytes(32).toString('hex'),
        fdroidRepoPath: path.join(process.cwd(), 'repo', 'repo'),
        port: 5334,
        updateCheckInterval: 6 * 3600 * 1000
      }
      console.log(JSON.stringify(config, 0, 2))
    }
  })
  .command({
    command: 'launch <config>',
    description: 'Launch the service',
    builder: {
      config: {
        type: 'string',
        required: true,
        desc: 'Path to config file'
      }
    },
    handler (argv) {
      const conf = JSON.parse(fs.readFileSync(argv.config))
      const server = Server(conf)
      server.start().then((url) => {
        console.log('Running on %s!', url)
      })
    }
  })
  .demandCommand(1)
  .help()
  .argv
