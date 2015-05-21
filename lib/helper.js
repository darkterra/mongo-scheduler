var _ = require('lodash'),
    parser = require('cron-parser')

function SchedulerError(message) {
  this.name = "SchedulerError"
  this.message = message || "Unexpected Scheduler Error"
}
SchedulerError.prototype = new Error()
SchedulerError.prototype.constructor = SchedulerError;

module.exports = {
  buildSchedule: function(details) {
    var storage = _.extend({}, _.pick(details, 'collection', 'id'))
    var conditions = _.extend({}, _.pick(details, 'query', 'after'))

    var doc = {
      status: 'ready',
      event: details.name,
      storage: storage,
      conditions: conditions,
      data: details.data,
    }

    var query = {
      event: details.name,
      storage: storage
    }

    if (!!details.cron) {
      doc.cron = details.cron
      doc.conditions.after = parser.parseExpression(details.cron).next()
    }

    return { doc: doc, query: query }
  },

  buildEvent: function(doc) {
    if (!doc) return;

    doc.conditions.query = doc.conditions.query || {}
    if (typeof doc.conditions.query === 'string')
      doc.conditions.query = JSON.parse(doc.conditions.query)
    if(doc.storage && doc.storage.id)
      _.extend(doc.conditions.query, {_id: doc.storage.id})
    return doc
  },

  shouldExit: function(err, result) {
    return !!err || !!(result.lastErrorObject && result.lastErrorObject.err)
  },

  buildError: function(err, result) {
    return err || new SchedulerError(result.lastErrorObject.err)
  }
}
