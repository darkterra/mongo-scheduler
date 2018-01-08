'use strict';

const helper   = require('./helper');
const mongo    = require('mongodb');
const ObjectId = mongo.ObjectId;
const events   = require("events");
const parser   = require("cron-parser");

const connectionName = 'scheduled_events';

function Scheduler(connection, opts) {
  const MongoClient     = mongo.MongoClient;
  const options         = opts || {};
  const connectionArray = connection.split('/');
  let self              = this;
  let ready             = false;
  let db;
  let database;

  if (options.dbname) {
    database = options.dbname;
  }
  else if (connectionArray.length < 4) {
    throw 'Mongo-Scheduler-More: Bad Connection String Format';
  }
  else {
    database = connectionArray[3] || null;
  }
  

  events.EventEmitter.call(this);

  if (connection instanceof Object) {
    db = connection.db;
    ready = true;
  }
  else {
    MongoClient.connect(connection, (err, client) => {
      if (err) throw err;
      db = client.db(database);
      ready = true;
    });
  }

  function emit(event, doc, cb) {
    let command = {
      findAndModify: connectionName,
      query: {_id: event._id},
    };

    self.emit(event.event, doc, event);
    if(!!cb) cb();

    setTimeout(() => {
      if (!!event.cron) {
        command.update = {
          $set: {
            status: 'ready',
            'conditions.after': parser.parseExpression(event.cron).next()
          }
        };
      } else command.remove = true;

      db.command(command, (err, result) => {
        if (err)
          return self.emit('error', helper.buildError(err, result));
      });
    }, 1000);
  }

  function poll() {
    const lookup = {
      status: 'ready',
      $or: [
        {'conditions.after': {'$exists': 0}},
        {'conditions.after': {'$lte': new Date()}}
      ]
    };

    db.command({
      findAndModify: connectionName,
      query: lookup,
      update: {$set: {status: 'running'}}
    }, (err, result) => {
      if(helper.shouldExit(err, result))
        return self.emit('error', helper.buildError(err, result));

      const event = helper.buildEvent(result.value);
      if (!event) return;
      if (!event.storage.collection) return emit(event, null, poll);

      db.collection(event.storage.collection, (err, coll) => {
        if(err) return self.emit('error', err, event);
        coll.find(event.conditions.query, (err, cursor) => {
          if (err) return self.emit('error', err, event);
          if(event.options.emitPerDoc || !!event.storage.id)
            cursor.each((err, doc) => {
              if (err) return self.emit('error', err, event);
              if (!doc) return poll();

              emit(event, doc);
            });
          else
            cursor.toArray((err, results) => {
              if (err) return self.emit('error', err, event);
              if (results.length !== 0) emit(event, results);
              poll();
            });
        });
      });
    });
  }

  function whenReady(op) {
    return function() {
      if(ready) return op.apply(self, arguments);

      const args = arguments;
      const id = setInterval(() => {
        if (!ready) return;
        clearInterval(id);
        op.apply(self, args);
      }, 10);
    };
  }

  function initialize() {
    poll();
    setInterval(poll, options.pollInterval || 60000);
  }

  function schedule(details, cb) {
    const info = helper.buildSchedule(details), callback = cb || function() {};
    
    const collection = db.collection(connectionName);
    collection.findAndModify(info.query, ['event', 'asc'], info.doc, {new: true, upsert: true}, callback);
  }

  function list(cb) {
    const collection = db.collection(connectionName);
    collection.find({}).toArray(cb);
  }

  function find(name, cb) {
    const collection = db.collection(connectionName);
    collection.findOne({event: name}, cb);
  }

  function remove(name, id, after, cb) {
    if (name || id || after) {
      const event = {};
      
      if (typeof name === 'string') {
        event.event = name;
      }
      
      if (typeof id === 'string') {
        event.id = id;
      }
      
      if (typeof after === 'string') {
        event.after = after;
      }
      
      const collection = db.collection(connectionName);
      collection.remove(event, cb);
    }
    else {
      throw 'Mongo-Scheduler-More: Bad parameters';
    }
  }

  function updateStatus(status) {
    return (event, cb) => {
      const collection = db.collection(connectionName);
      const update = { 
        $set: { 
          status : status,
          'conditions.after': parser.parseExpression(event.cron).next()
        }
      };
      collection.findAndModify({_id : ObjectId(event._id)}, ['event', 'asc'], update, {new: true}, (err, result) => {
        cb(err, result.value);
      });
    };
  }

  this.schedule = whenReady(schedule);
  this.list = whenReady(list);
  this.find = whenReady(find);
  this.remove = whenReady(remove);
  this.enable = whenReady(updateStatus('ready'));
  this.disable = whenReady(updateStatus('disabled'));

  if(!opts.doNotFire) whenReady(initialize)();
}

Scheduler.prototype = new events.EventEmitter();
module.exports = Scheduler;