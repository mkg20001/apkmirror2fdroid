'use strict'

const hat = require('hat')
const pino = require('pino')

module.exports = async (server, secret, pw) => {
  const cache = server.cache({segment: 'sessions', expiresIn: 30 * 24 * 3600 * 1000})
  const Attempts = server.cache({segment: 'attempts', expiresIn: 24 * 3600 * 1000})
  const log = pino({name: 'auth'})

  await server.register({
    plugin: require('hapi-auth-cookie')
  })

  server.auth.strategy('session', 'cookie', {
    password: secret,
    cookie: 'apkmirror-sid',
    redirectTo: '/login',
    isSecure: false,
    validateFunc: async (request, session) => {
      const valid = Boolean(await cache.get(session.sid))
      return {
        valid,
        credentials: valid
      }
    }
  })
  server.auth.default('session')

  server.route({
    method: 'POST',
    path: '/login',
    options: {
      handler: async (request, h) => {
        if (request.auth.isAuthenticated) {
          return h.redirect('/')
        }

        let ip = request.headers['x-forwarded-for'] || request.info.remoteAddress
        let attempts = await Attempts.get(ip) || 0

        let failed = true

        if (attempts < 10 && request.payload === pw) {
          failed = false
          let sid = hat()
          await cache.set(sid, true, 0)
          request.cookieAuth.set({ sid })
        }

        if (failed) {
          attempts++
          await Attempts.set(ip, attempts)
          if (attempts > 10) {
            log.error({ip}, 'bruteforce blocked from from %s', ip)
          } else {
            log.warn({ip}, 'failed auth attempt from %s', ip)
          }
        }

        return {failed}
      },
      auth: {mode: 'try'},
      plugins: {
        'hapi-auth-cookie': {
          redirectTo: false
        }
      }
    }
  })
}
