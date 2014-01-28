var _ = require('underscore')

module.exports = {
  buildSchedule: function(event, storage, conditions, data) {
    var doc = {
      event: event,
      storage: storage,
      conditions: conditions || {},
      data: data
    }

    var query = {
      event: event,
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
