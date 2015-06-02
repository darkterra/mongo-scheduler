var helper = require('./helper')
var mongo = require('mongodb')
var ObjectId = mongo.ObjectId
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
    self.emit('mongo-scheduler-ready')
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

  function schedule(details, cb) {
    var id = setInterval(function() {
      if (!ready) return;
      clearInterval(id)

      var info = helper.buildSchedule(details),
          callback = cb || function() {}

      db.createCollection('scheduled_events', function(err, coll) {
        coll.findAndModify(info.query,
          ['event', 'asc'],
          info.doc,
          {new: true, upsert: true},
          callback)
      })
    }, 10)
  }

  function list(cb) {
    var collection = db.collection('scheduled_events')
    collection.find({}).toArray(cb)
  }

  function find(name, cb) {
    var collection = db.collection('scheduled_events')
    collection.findOne({event: name}, cb)
  }

  function updateStatus(event, status, cb) {
    var collection = db.collection('scheduled_events');
    collection.findAndModify({_id : ObjectId(event._id)}, ['event', 'asc'],
        { $set: { status : status} }, {new: true}, function(err, result) {
      cb(err, result.value)
    })
  }

  this.schedule = schedule
  this.list = list
  this.find = find
  this.enable = function(event, cb) { updateStatus(event, 'ready', cb) }
  this.disable = function(event, cb) { updateStatus(event, 'disabled', cb) }

  initialize()
}

Scheduler.prototype = new events.EventEmitter()
module.exports = Scheduler
