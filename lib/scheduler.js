var helper = require('./helper')
var mongo = require('mongodb')
var events = require("events")
var parser = require("cron-parser")

function Scheduler(connection, opts) {
  var self = this,
      MongoClient = mongo.MongoClient,
      ready = false,
      options = opts || {},
      db

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

  function emit(event, doc) {
    var command = {
      findAndModify: 'scheduled_events',
      query: {_id: event._id},
    }

    if (!!event.cron) {
      command.update = {
        $set: {
          status: 'ready',
          'conditions.after': parser.parseExpression(event.cron).next()
        }
      }
    } else command.remove = true

    db.command(command, function(err, result) {
      if (err)
        return self.emit('error', helper.buildError(err, result))

      self.emit(event.event, doc, event)
    })
  }

  function poll() {
    var lookup = {
      status: 'ready',
      $or: [
        {'conditions.after': {'$exists': 0}},
        {'conditions.after': {'$lte': new Date()}}
      ],
    }

    db.command({
      findAndModify: 'scheduled_events',
      query: lookup,
      update: {$set: {status: 'running'}}
    }, function(err, result) {
      if(helper.shouldExit(err, result))
        return self.emit('error', helper.buildError(err, result))

      var event = helper.buildEvent(result.value)
      if (!event) return;

      if (!event.storage.collection) {
        emit(event)
        return poll()
      }

      db.collection(event.storage.collection, function(err, coll) {
        if(err) return self.emit('error', err, event)
        coll.find(event.conditions.query, function(err, cursor) {
          if (err) return self.emit('error', err, event)
          cursor.each(function(err, doc) {
            if (err) return self.emit('error', err, event)
            if (!doc) return poll();

            emit(event, doc)
          })
        })
      })
    })
  }

  function initialize() {
    var id = setInterval(function() {
      if (!ready) return;
      poll()
      setInterval(poll, options.pollInterval || 60000)
      clearInterval(id)
    },10)
  }

  this.schedule = function(details, cb) {
    var info = helper.buildSchedule(details),
        callback = cb || function() {}

    db.createCollection('scheduled_events', function(err, coll) {
      coll.findAndModify(info.query,
        ['event', 'asc'],
        info.doc,
        {new: true, upsert: true},
        callback)
    })
  }

  initialize()
}

Scheduler.prototype = new events.EventEmitter()
module.exports = Scheduler
