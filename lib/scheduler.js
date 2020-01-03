'use strict';

const moment           = require('moment');
const mongo            = require('mongodb');
const objectId         = mongo.ObjectId;
const events           = require('events');
const parser           = require('cron-parser');
const check            = require('check-types');
const { readFileSync } = require('fs');
const { join }         = require('path');

const helper       = require('./helper');

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
  
  let ready    = false;
  let db       = null;
  let database = null;
  
  if (connection && typeof connection === 'string') {
    connectionArray = connection.split('/');
    if (connectionArray[2].includes('@')) {
      driverOptions.auth = {};
      [ driverOptions.auth.user, driverOptions.auth.password ] = connectionArray[2].split('@')[0].split(':');
    }
    
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
    
    // This should fix the issue 10: https://github.com/darkterra/mongo-scheduler/issues/10
    const client = new MongoClient(connection, driverOptions);
    
    client.connect(err => {
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
  
  function emit(event, docs, cb) {
    const collection = db.collection(collectionName);
    const lookup = {
      _id: event._id,
    };
    
    const manageResult = (err, result) => {
      if (err) {
        console.error(err);
        return self.emit('error', helper.buildError(err, result));
      }
    };
    
    setTimeout(() => {
      if (event.cron) {
        const after = (parser.parseExpression(event.cron).next()).toDate();
        
        if (event.conditions && event.conditions.endDate && moment(after).isAfter(event.conditions.endDate)) {
          collection.findOneAndDelete(lookup, null, manageResult);
        }
        else {
          const updateDoc = { $set: { status: 'ready', 'conditions.after': after }};
          
          collection.findOneAndUpdate(lookup, updateDoc, { upsert: true }, manageResult);
        }
      }
      else {
        collection.findOneAndDelete(lookup, null, manageResult);
      }
      
    }, 100);
    
    self.emit(event.name, event, docs);
    
    if(cb) {
      cb();
    }
  }

  function poll() {
    const maxTimeBeforeRemove = Math.round((options.pollInterval || 60000) / 1000 / 2);
    const collection = db.collection(collectionName);
    const lookupStaleEvent = {
      status: 'running',
      'conditions.after': { $lte: moment().subtract(maxTimeBeforeRemove, 'minutes').toDate() }
    };
    const lookup = {
      status: 'ready',
      $or: [
        { 'conditions.after': undefined },
        { 'conditions.after': { $type: 10 }},
        { 'conditions.after': { $exists: false }},
        { 'conditions.after': { $lte: moment().toDate() }}
      ]
    };

    collection.deleteMany(lookupStaleEvent, null, (err, result) => {
      if (err) {
        console.error(err);
        return self.emit('error', helper.buildError(err, result));
      }
    });
    
    collection.findOneAndUpdate(lookup, { $set: { status: 'running' }}, (err, result) => {
      if(helper.shouldExit(err, result)) {
        return self.emit('error', helper.buildError(err, result));
      }
      
      const event = helper.buildEvent(result.value);
      if (!event) {
        return;
      }
      
      if (!event.storage) {
        console.log('JYO: event: ', event);
        // process.exit(0)
      }
      
      if (!event.storage.collection) {
        return emit(event, null, poll);
      }
      
      db.collection(event.storage.collection, (err, childColl) => {
        if(err) {
          return self.emit('error', err, event);
        }
        
        const cursor = childColl.find(event.storage.query); //, (err, cursor) => {
          // if (err) {
          //   return self.emit('error', err, event);
          // }
          
        if (event.options.emitPerDoc) {
          cursor.forEach(doc => {
            if (!doc) {
              return poll();
            }
            
            emit(event, doc);
          }, err => {
            if (err) {
              return self.emit('error', err, event);
            }
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
  
  // ------------------------------------------------------------------------ //
  
  function schedule(newEvent, cb) {
    const { err, query, doc } = helper.buildSchedule(newEvent);
    const callback   = cb || function() {};
    const collection = db.collection(collectionName);
    
    if (err) {
      return callback(err);
    }
    
    if (doc.cron) {
      console.log('JYO: just before insert into DB: query: ', query);
      console.log('JYO: just before insert into DB: doc: ', doc);
    }
    collection.findOneAndReplace(query, doc, { upsert: true }, callback);
  }
  
  async function scheduleBulk(newEvents, cb) {
    const callback = cb || function() {};
    
    if (newEvents && newEvents.constructor === Array) {
      const collection = db.collection(collectionName);
      const bulk       = collection.initializeOrderedBulkOp();
      
      const newEventsLength = newEvents.length;
      
      for (let i = 0; i < newEventsLength; i++) {
        const { err, query, doc } = helper.buildSchedule(newEvents.shift());
        
        if (err) {
          return callback(err);
        }
        
        bulk.find(query).upsert().replaceOne(doc);
      }
      
      try {
        await bulk.execute(callback);
      }
      catch (err) {
        return callback(err);
      }
    }
    else {
      callback('Mongo-Scheduler-More: Bad parameters');
    }
  }
  
  
  function list({ bySchedule = false, asc = 1, query = {} }, cb) {
    const collection = db.collection(collectionName);
    const options = helper.buildOptions({ bySchedule, asc });
    
    collection.find(query, options).toArray(cb);
  }
  
  function findByName({ name, bySchedule = false, asc = 1 }, cb) {
    if (name) {
      const collection = db.collection(collectionName);
      const options = helper.buildOptions({ bySchedule, asc });
      
      collection.find({ name }, options).toArray(cb);
    }
    else {
      cb('Mongo-Scheduler-More: Bad parameters');
    }
  }
  
  function findByStorageId({ name, id, bySchedule = false, asc = 1 }, cb) {
    if (id) {
      const collection = db.collection(collectionName);
      const lookup     = { 'storage.id': id.toString() };
      const options    = helper.buildOptions({ bySchedule, asc });
      
      if (name) {
        lookup.name = name;
      }
      
      collection.find(lookup, options).toArray(cb);
    }
    else {
      cb('Mongo-Scheduler-More: Bad parameters');
    }
  }
  
  function remove({ name = undefined, id, eventId, after }, cb) {
    if (name) {
      const collection = db.collection(collectionName);
      const query      = {};
      
      if (typeof name === 'string') {
        query.name = name;
      }
      
      if (eventId && objectId.isValid(eventId)) {
        query._id = objectId(eventId);
      }
      
      if (id && objectId.isValid(id)) {
        query['storage.id'] = objectId(id);
      }
      
      if (after && check.date(after)) {
        query['conditions.after'] = after;
      }
      
      collection.deleteMany(query, cb);
    }
    else {
      cb('Mongo-Scheduler-More: Bad parameters');
    }
  }
  
  function purge({ force = false }, cb) {
    if (force === true) {
      const collection = db.collection(collectionName);
      
      collection.deleteMany({}, cb);
    }
    else {
      cb('Mongo-Scheduler-More: Bad parameters');
    }
  }
  
  function updateStatus(status) {
    return (event, cb) => {
      const collection = db.collection(collectionName);
      const lookup = {
        _id : objectId(event._id)
        
      };
      collection.findOneAndUpdate(lookup, { $set: { status, 'conditions.after': parser.parseExpression(event.cron).next() }}, { upsert: true }, (err, result) => {
        cb(err, result.value);
      });
    };
  }
  
  function version() {
    const version = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'))).version;
    
    console.log(version);
    
    return version;
  }
  
  this.schedule        = whenReady(schedule);
  this.scheduleBulk    = whenReady(scheduleBulk);
  this.list            = whenReady(list);
  this.findByName      = whenReady(findByName);
  this.findByStorageId = whenReady(findByStorageId);
  this.remove          = whenReady(remove);
  this.purge           = whenReady(purge);
  this.enable          = whenReady(updateStatus('ready'));
  this.disable         = whenReady(updateStatus('disabled'));
  this.version         = version;
  
  if(!options.doNotFire) {
    whenReady(initialize)();
  }
}

Scheduler.prototype = new events.EventEmitter();
module.exports = Scheduler;
