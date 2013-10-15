var mongo = require('mongodb')
var events = require("events")
var _ = require('underscore')

function Scheduler(connection) {
  var self = this
    , MongoClient = mongo.MongoClient
    , ready = false
    , db

  events.EventEmitter.call(this)

  MongoClient.connect(connection, function(err, database) {
    db = database
    ready = true
  })

  function poll() {
    var pollTime = new Date()

    MongoClient.connect(connection, function(err, db) {
      db.createCollection('scheduled_events', function(err, eventColl) {
        eventColl.find({}, function(err, cursor) {

          cursor.each(function(err, doc) {
            var eventDoc = doc
            if(!eventDoc) return;
            if(eventDoc.conditions.after && eventDoc.conditions.after > pollTime) return;

            eventDoc.conditions.query = JSON.parse(eventDoc.conditions.query)
            if(eventDoc.storage.id)
              eventDoc.conditions.query = _.extend(eventDoc.conditions.query || {},
                       {_id: eventDoc.storage.id })


            db.collection(eventDoc.storage.collection, function(err, coll) {
              coll.find(eventDoc.conditions.query, function(err, cursor) {
                cursor.count(function(err, count) {
                  if (count === 0) {
                    if(eventDoc.conditions.after && eventDoc.conditions.after < pollTime)
                      eventColl.remove({_id: eventDoc._id}, function() {})

                    return;
                  }

                  cursor.each(function(err, doc) {
                    if (!doc) {
                      eventColl.remove({_id: eventDoc._id}, function() {})
                      return;
                    }

                    self.emit(eventDoc.event, doc)
                  })
                })
              })
            })
          })
        })
      })
    })
  }

  function initialize() {
    var id = setInterval(function() {
      if (!ready) return;
      poll()
      clearInterval(id)
    },10)

    setInterval(poll, 5000)
  }

  this.schedule = function(event, storage, conditions) {
    var doc = {
      storage: storage,
      conditions: conditions,
      event: event
    }

    var query = {
      storage: storage,
      event: event
    }

    doc.conditions.query = JSON.stringify(doc.conditions.query)
    MongoClient.connect(connection, function(err, db) {
      db.createCollection('scheduled_events', function(err, coll) {
        coll.update(query, doc, {safe: true, upsert: true}, function(err) {
          db.close()
        })
      })
    })
  }

  initialize()
}

Scheduler.prototype.__proto__ = events.EventEmitter.prototype
module.exports = Scheduler
