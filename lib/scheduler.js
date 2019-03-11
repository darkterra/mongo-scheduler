'use strict';

const helper   = require('./helper');
const mongo    = require('mongodb');
const ObjectId = mongo.ObjectId;
const events   = require('events');
const parser   = require('cron-parser');

const collectionName = 'scheduled_events';

function Scheduler(connection, options = {}) {
  const self            = this;
  const { MongoClient } = mongo;
  
  // Setup the options for MongoClient
  const driverOptions = {
    useNewUrlParser: options.useNewUrlParser || true,
    loggerLevel    : options.loggerLevel,
    logger         : options.logger,
    validateOptions: options.validateOptions,
    auth           : options.auth,
    authMechanism  : options.authMechanism
  };
  
  let connectionArray;
  
  let ready           = false;
  let db              = null;
  let database        = null;
  
  if (connection && typeof connection === 'string') {
    connectionArray = connection.split('/');
    
    // Format the connection
    if (options.dbname) {
      database = options.dbname;
    }
    else if (connectionArray.length < 4) {
      const msg = 'Mongo-Scheduler-More: Bad Connection String Format';
      
      console.error(msg);
      throw msg;
    }
    else {
      if (connectionArray.length > 3 && connectionArray[3].includes('?')) {
        const temp = connectionArray[3].split('?') || null;
        database = temp[0];
        if (temp[1].includes('replicaSet')) {
          driverOptions.replicaSet = temp[1].split('=')[1];
        }
      }
      else {
        database = connectionArray[3] || null;
      }
    }
    
    MongoClient.connect(connection, driverOptions, (err, client) => {
      if (err) {
        throw err;
      }
      db = client.db(database);
      ready = true;
    });
  }
  else if (connection instanceof Object) {
    db = connection.db;
    ready = true;
  }
  else {
    const msg = 'Mongo-Scheduler-More: No Valid Connection parameter';
    
    console.error(msg);
    throw msg;
  }
  
  events.EventEmitter.call(this);

  function emit(event, doc, cb) {
    const collection = db.collection(collectionName);
    const lookup = {
      _id: event._id,
    };
    
    const manageResult = (err, result) => {
      if (err) {
        return self.emit('error', helper.buildError(err, result));
      }
    };
    
    self.emit(event.event, doc, event);
    if(cb) {
      cb();
    }

    setTimeout(() => {
      if (event.cron) {
        collection.findOneAndUpdate(lookup, { $set: { status: 'ready', 'conditions.after': parser.parseExpression(event.cron).next() }}, { upsert: true }, manageResult);
      }
      else {
        collection.findOneAndDelete(lookup, null, manageResult);
      }
    }, 1000);
  }

  function poll() {
    const collection = db.collection(collectionName);
    const lookup = {
      status: 'ready',
      $or: [
        {'conditions.after': {'$exists': 0}},
        {'conditions.after': {'$lte': new Date()}}
      ]
    };
    
    collection.findOneAndUpdate(lookup, { $set: { status: 'running' }}, (err, result) => {
      if(helper.shouldExit(err, result)) {
        return self.emit('error', helper.buildError(err, result));
      }

      const event = helper.buildEvent(result.value);
      if (!event) {
        return;
      }
      if (!event.storage.collection) {
        return emit(event, null, poll);
      }

      db.collection(event.storage.collection, (err, childColl) => {
        if(err) {
          return self.emit('error', err, event);
        }
        childColl.find(event.conditions.query, (err, cursor) => {
          if (err) {
            return self.emit('error', err, event);
          }
          if(event.options.emitPerDoc || !!event.storage.id) {
            cursor.each((err, doc) => {
              if (err) {
                return self.emit('error', err, event);
              }
              if (!doc) {
                return poll();
              }

              emit(event, doc);
            });
          }
          else {
            cursor.toArray((err, results) => {
              if (err) {
                return self.emit('error', err, event);
              }
              if (results.length !== 0) {
                emit(event, results);
              }
              
              poll();
            });
          }
        });
      });
    });
  }

  function whenReady(op) {
    return function() {
      if(ready) {
        return op.apply(self, arguments);
      }

      const args = arguments;
      const id = setInterval(() => {
        if (!ready) {
          return;
        }
        
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
    const collection = db.collection(collectionName);
    
    collection.findOneAndReplace(info.query, info.doc, { upsert: true }, callback);
  }

  function list(cb) {
    const collection = db.collection(collectionName);
    
    collection.find({}).toArray(cb);
  }

  function findByName(name, cb) {
    const collection = db.collection(collectionName);
    const filter = { event: name };
    
    collection.findOne(filter, cb);
  }

  function findByStorageId(id, name, cb) {
    const collection = db.collection(collectionName);
    const filter = { 'storage.id': id.toString(), event: name };
    
    collection.findOne(filter, cb);
  }

  function remove(name, id, after, cb) {
    if (name || id || after) {
      const event = {};
      
      if (typeof name === 'string') {
        event.event = name;
      }
      
      if (ObjectId.isValid(id)) {
        event._id = id;
      }
      
      if (typeof after === 'string') {
        event.after = after;
      }
      
      const collection = db.collection(collectionName);
      
      collection.remove(event, cb);
    }
    else {
      throw 'Mongo-Scheduler-More: Bad parameters';
    }
  }

  function updateStatus(status) {
    return (event, cb) => {
      const collection = db.collection(collectionName);
      const lookup = {
        _id : ObjectId(event._id)
        
      };
      collection.findOneAndUpdate(lookup, { $set: { status : status, 'conditions.after': parser.parseExpression(event.cron).next() }}, { upsert: true }, (err, result) => {
        cb(err, result.value);
      });
    };
  }

  this.schedule        = whenReady(schedule);
  this.list            = whenReady(list);
  this.findByName      = whenReady(findByName);
  this.findByStorageId = whenReady(findByStorageId);
  this.remove          = whenReady(remove);
  this.enable          = whenReady(updateStatus('ready'));
  this.disable         = whenReady(updateStatus('disabled'));

  if(!options.doNotFire) {
    whenReady(initialize)();
  }
}

Scheduler.prototype = new events.EventEmitter();
module.exports = Scheduler;