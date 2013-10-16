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
    var lookup = {$or: [
      {'conditions.after': {$exists: 0}},
      {'conditions.after': {$lte: new Date()}}
    ]}

    db.executeDbCommand({
      findAndModify: 'scheduled_events',
      query: lookup,
      remove: true
    }, function(err, result) {
      if(helper.shouldExit(err, result)) throw helper.buildError(err, result)

      var event = helper.buildEvent(result.documents[0].value)
      if (!event) return;

      db.collection(event.storage.collection, function(err, coll) {
        if(err) throw err
        coll.find(event.conditions.query, function(err, cursor) {
          if (err) throw err
          cursor.each(function(err, doc) {
            if (err) throw err
            if (!doc) return poll();

            self.emit(event.event, doc)
          })
        })
      })
    })
  }

  function initialize() {
    var id = setInterval(function() {
      if (!ready) return;
      poll()
      setInterval(poll, pollInterval || 3600000)
      clearInterval(id)
    },10)
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
