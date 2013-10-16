var helper = require('./helper')
var mongo = require('mongodb')
var events = require("events")

function Scheduler(connection, pollInterval) {
  var self = this
    , MongoClient = mongo.MongoClient
    , ready = false
    , db

  events.EventEmitter.call(this)

  MongoClient.connect(connection, function(err, database) {
    if (err) throw err
    db = database
    ready = true
  })

  function poll() {
    db.createCollection('scheduled_events', function(err, eventColl) {
      if (err) throw err

      var lookup = { $or: [
        {'conditions.after': {$exists: 0}},
        {'conditions.after': {$lte: new Date()}}
      ]}

      eventColl.find(lookup, function(err, cursor) {
        if(err) throw err

        cursor.each(function(err, doc) {
          if(err) throw err
          var event = helper.buildEvent(doc)
          if (helper.shouldExit(event)) return;

          db.collection(event.storage.collection, function(err, coll) {
            if(err) throw err
            coll.find(event.conditions.query, function(err, cursor) {
              if (err) throw err
              cursor.each(function(err, doc) {
                if (err) throw err
                if (!doc) {
                  eventColl.remove({_id: event._id}, function() {})
                  return;
                }

                self.emit(event.event, doc)
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
      clearInterval(id)
      poll()
    },10)

    setInterval(poll, pollInterval || 3600000)
  }

  this.schedule = function(event, storage, conditions, cb) {
    var info = helper.buildSchedule(event, storage, conditions)
    var close = function(db, err) {
      db.close()
      if(cb) cb(err)
    }

    MongoClient.connect(connection, function(err, db) {
      if (err) close(db, err)
      db.createCollection('scheduled_events', function(err, coll) {
        if (err) close(db, err)
        coll.update(info.query, info.doc, {safe: true, upsert: true}, function(err) {
          close(db, err)
        })
      })
    })
  }

  initialize()
}

Scheduler.prototype.__proto__ = events.EventEmitter.prototype
module.exports = Scheduler
