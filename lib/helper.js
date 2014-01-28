var _ = require('underscore')

module.exports = {
  buildSchedule: function(details) {
    var storage = _.extend({}, _.pick(details, 'collection', 'id'))
    var conditions = _.extend({}, _.pick(details, 'query', 'after'))

    var doc = {
      event: details.event,
      storage: storage,
      conditions: conditions,
      data: details.data
    }

    var query = {
      event: details.event,
      storage: storage
    }

    return { doc: doc, query: query }
  },

  buildEvent: function(doc) {
    if (!doc) return;

    doc.conditions.query = doc.conditions.query || {}
    if (typeof doc.conditions.query === 'string') doc.conditions.query = JSON.parse(doc.conditions.query)
    if(doc.storage && doc.storage.id) _.extend(doc.conditions.query, {_id: doc.storage.id})
    return doc
  },

  shouldExit: function(err, result) {
    return !!err || !!(result.lastErrorObject && result.lastErrorObject.err)
  },

  buildError: function(err, result) {
    return err || new Error(result.lastErrorObject.err)
  }
}
