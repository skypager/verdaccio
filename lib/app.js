var express       = require('express')
var Error         = require('http-errors')
var compression   = require('compression')
var Auth          = require('./auth')
var Logger        = require('./logger')
var Config        = require('./config')
var Middleware    = require('./middleware')
var Cats          = require('./status-cats')
var Storage       = require('./storage')

module.exports = function(config_hash) {
  Logger.setup(config_hash.logs)

  var config  = Config(config_hash)
  var storage = Storage(config)
  var auth    = Auth(config)
  var app     = express()

  // run in production mode by default, just in case
  // it shouldn't make any difference anyway
  app.set('env', process.env.NODE_ENV || 'production')

  function error_reporting_middleware(req, res, next) {
    res.report_error = res.report_error || function(err) {
      if (err.status && err.status >= 400 && err.status < 600) {
        if (!res.headersSent) {
          res.status(err.status)
          next({ error: err.message || 'unknown error' })
        }
      } else {
        Logger.logger.error( { err: err }
                           , 'unexpected error: @{!err.message}\n@{err.stack}')
        if (!res.status || !res.send) {
          Logger.logger.error('this is an error in express.js, please report this')
          res.destroy()
        } else if (!res.headersSent) {
          res.status(500)
          next({ error: 'internal server error' })
        } else {
          // socket should be already closed
        }
      }
    }
    next()
  }

  app.use(Middleware.log)
  app.use(error_reporting_middleware)

  app.use(function(req, res, next) {
    res.setHeader('X-Powered-By', config.user_agent)
    next()
  })

  app.use(Cats.middleware)
  app.use(compression())

  app.use(require('./index-api')(config, auth, storage))

  return app
}

