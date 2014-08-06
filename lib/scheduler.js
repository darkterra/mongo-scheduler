var helper = require('./helper')
var mongo = require('mongodb')
var events = require("events")

function Scheduler(connection, options) {
  var self = this
  , MongoClient = mongo.MongoClient
    , ready = false
    , options = options || {}
    , db

  events.EventEmitter.call(this)

  if (connection instanceof Object) {
    db = connection.db
    ready = true
  }
  else {

    MongoClient.connect(connection, function(err, database) {
      if (err) throw err
      db = database
      ready = true
    })
  }

  function poll() {
    var lookup = {$or: [
      {'conditions.after': {'$exists': 0}},
      {'conditions.after': {'$lte': new Date()}}
    ]}

    db.command({
      findAndModify: 'scheduled_events',
      query: lookup,
      remove: true
    }, function(err, result) {
      if(helper.shouldExit(err, result))
        return self.emit('error', helper.buildError(err, result))

      var event = helper.buildEvent(result.value)
      if (!event) return;

      db.collection(event.storage.collection, function(err, coll) {
        if(err) return self.emit('error', err, event)
        coll.find(event.conditions.query, function(err, cursor) {
          if (err) return self.emit('error', err, event)
          cursor.each(function(err, doc) {
            if (err) return self.emit('error', err, event)
            if (!doc) return poll();

            self.emit(event.event, doc, event)
          })
        })
      })
    })
  }

  function initialize() {
    var id = setInterval(function() {
      if (!ready) return;
      poll()
      setInterval(poll, options.pollInterval || 3600000)
      clearInterval(id)
    },10)
  }

  this.schedule = function(details, cb) {
    if (arguments.length > 2) {
      console.error('This interface is deprecated. Please read the README for the new interface')
      var newDetails = {}
      newDetails.name = arguments[0]
      if (arguments[1] && arguments[1].collection) newDetails.collection = arguments[1].collection
      if (arguments[1] && arguments[1].id) newDetails.id = arguments[1].id
      if (arguments[2] && arguments[2].after) newDetails.after = arguments[2].after
      if (arguments[2] && arguments[2].query) newDetails.query = arguments[2].query
      details = newDetails
      cb = arguments[3]
    }

    var info = helper.buildSchedule(details)
    db.createCollection('scheduled_events', function(err, coll) {
      coll.findAndModify(info.query, ['event', 'asc'], info.doc, {new: true, upsert: true}, function(err, doc) {
        if (cb) cb(err, doc);
      })
    })
  }

  if(options.doNotFire) return;
  initialize()
}

Scheduler.prototype.__proto__ = events.EventEmitter.prototype
module.exports = Scheduler
