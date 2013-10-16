var _ = require('underscore')

module.exports = {
  buildSchedule: function(event, storage, conditions) {
    var doc = {
      event: event,
      storage: storage,
      conditions: conditions || {}
    }

    var query = {
      event: event,
      storage: storage
    }

    if(doc.conditions.query)
      doc.conditions.query = JSON.stringify(conditions.query)

    return { doc: doc, query: query }
  },
  shouldExit: function(eventDoc, timestamp) {
    return !eventDoc || !!(eventDoc.conditions.after && eventDoc.conditions.after > timestamp)
  },

  buildEvent: function(doc) {
    if (!doc) return;

    doc.conditions.query = JSON.parse(doc.conditions.query || "{}")
    if(doc.storage && doc.storage.id) _.extend(doc.conditions.query, {_id: doc.storage.id})
    return doc
  }
}
