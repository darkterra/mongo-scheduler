'use strict';

const moment       = require('moment');
const mongo        = require('mongodb');
const objectId     = mongo.ObjectId;
const events       = require('events');
const parser       = require('cron-parser');
const { readFile } = require('fs');
const { join }     = require('path');

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

  function emit(event, docs, cb) {
    const collection = db.collection(collectionName);
    const lookup = {
      _id: event._id,
    };
    
    const manageResult = (err, result) => {
      if (err) {
        return self.emit('error', helper.buildError(err, result));
      }
    };
    
    self.emit(event.name, event, docs);
    
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
        { 'conditions.after': { '$exists': 0 }},
        { 'conditions.after': { '$eq': undefined }},
        { 'conditions.after': { '$lte': moment().toDate() }}
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
    
    collection.findOneAndReplace(query, doc, { upsert: true }, callback);
  }
  
  async function scheduleBulk(newEvents, cb) {
    if (newEvents.constructor === Array) {
      const callback   = cb || function() {};
      const collection = db.collection(collectionName);
      const bulk       = collection.initializeUnorderedBulkOp();
      
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
      throw 'Mongo-Scheduler-More: Bad parameters';
    }
  }
  
  
  function list({ bySchedule = false, asc = 1 } = {}, cb) {
    const collection = db.collection(collectionName);
    
    let options = {};
    
    if (bySchedule) {
      options.sort = {
        'conditions.after': asc
      };
    }
    
    collection.find({}, options).toArray(cb);
  }
  
  function findByName({ name } = {}, cb) {
    const collection = db.collection(collectionName);
    const lookup     = { name };
    
    collection.findOne(lookup, cb);
  }
  
  function findByStorageId({ id, name } = {}, cb) {
    const collection = db.collection(collectionName);
    const lookup     = { 'storage.id': id.toString(), name };
    
    collection.findOne(lookup, cb);
  }
  
  function remove({ name, id, after } = {}, cb) {
    if (name || id || after) {
      const collection = db.collection(collectionName);
      const query      = {};
      
      if (typeof name === 'string') {
        query.name = name;
      }
      
      if (objectId.isValid(id)) {
        query._id = objectId(id);
      }
      
      if (after) {
        after = moment(after.toString());
        
        if (after.isValid()) {
          query.after = after;
        }
      }
      
      collection.deleteMany(query, cb);
    }
    else {
      throw 'Mongo-Scheduler-More: Bad parameters';
    }
  }
  
  function purge({ force }, cb) {
    if (force === true) {
      const collection = db.collection(collectionName);
      
      collection.deleteMany({}, cb);
    }
    else {
      throw 'Mongo-Scheduler-More: Bad parameters';
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
    readFile(join(__dirname, '..', 'package.json'), (err, data) => {
      if (err) {
        throw err;
      }
      if (data) {
        console.log(`${JSON.parse(data).version}`);
        process.exit(0);
      }
    });
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
