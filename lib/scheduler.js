'use strict';

const { readFileSync } = require('fs');
const { join }         = require('path');
const { EventEmitter } = require('events');

const moment       = require('moment');
const { ObjectID } = require('mongodb');
const parser       = require('cron-parser');
const check        = require('check-types');

const { connectToDB, buildEvent, buildSchedule, buildOptions, shouldExit, buildError } = require('./helper');

class Scheduler extends EventEmitter {
  constructor (connection, options = {}) {
    super();

    if (options.customEventEmitter) {
      this._events = options.customEventEmitter._events;
    }

    this.connection = connection;

    // Setup the options for MongoClient
    this.driverOptions = {
      useNewUrlParser   : options.useNewUrlParser || true,
      loggerLevel       : options.loggerLevel,
      logger            : options.logger,
      validateOptions   : options.validateOptions,
      auth              : options.auth,
      authMechanism     : options.authMechanism,
      useUnifiedTopology: true
    };

    this.options = options;
    this.collectionName = options.schedulerCollectionName || 'scheduled_events';
    this.ready = false;

    this.initialize();
  }

  static version() {
    return version();
  }

  isReady(funcToCall, args) {
    if (this.ready) {
      if (args && typeof args.cb === 'function') {
        funcToCall(args);
      }
      else {
        return new Promise((resolve, reject) => {
          args.cb = (err, result) => err ? reject(err) : resolve(result);
          funcToCall(args);
        });
      }
    }
    else {
      const id = setInterval(() => {
        if (this.ready) {
          clearInterval(id);
          this.isReady(funcToCall, { ...args, db: this.db });
        }
      }, 250);
    }
  }

  // ------------------

  _emit(event, docs, cb) {
    const collection = this.db.collection(this.collectionName);
    const lookup = { _id: event._id };
    
    const manageResult = (err, result) => {
      if (err) {
        console.error(err);
        return this.emit('error', buildError(err, result));
      }
    };
    
    setTimeout(() => {
      manageEvent({ event, lookup, collection, manageResult });
    }, 100);
    
    this.emit(event.name, event, docs);

    cb && cb();
  }

  initialize() {
    const p = connectToDB({ connection: this.connection, driverOptions: this.driverOptions });
    p.then(result => {
      this.db = result.db;
      this.ready = result.ready || false;

      if(!this.options.doNotFire && this.ready) {
        startPoll({ that: this, options: this.options, collectionName: this.collectionName, db: this.db });
      }
      else {
        whaitUntilReady({ that: this, ready: this.ready, options: this.options, collectionName: this.collectionName, db: this.db });
      }
    }).catch(e => console.error(e));
  }

  schedule(newEvent, cb) {
    return this.isReady(schedule, { newEvent, cb, collectionName: this.collectionName, db: this.db });
  }

  scheduleBulk(newEvents, cb) {
    return this.isReady(scheduleBulk, { newEvents, collectionName: this.collectionName, db: this.db, cb });
  }

  list({ bySchedule, asc, query }, cb) {
    return this.isReady(list, { bySchedule, asc, query, collectionName: this.collectionName, db: this.db, cb });
  }

  findByName({ name, bySchedule, asc }, cb) {
    return this.isReady(findByName, { name, bySchedule, asc, collectionName: this.collectionName, db: this.db, cb });
  }

  findByStorageId({ name, id, bySchedule, asc }, cb) {
    return this.isReady(findByStorageId, { name, id, bySchedule, asc, collectionName: this.collectionName, db: this.db, cb });
  }

  remove({ name, id, eventId, after } = {}, cb) {
    return this.isReady(remove, { name, id, eventId, after, collectionName: this.collectionName, db: this.db, cb });
  }

  purge({ force }, cb) {
    return this.isReady(purge, { force, collectionName: this.collectionName, db: this.db, cb });
  }

  enable(cb) {
    return this.isReady(updateStatus, { status: 'ready', collectionName: this.collectionName, db: this.db, cb });
  }

  disable(cb) {
    return this.isReady(updateStatus, { status: 'disabled', collectionName: this.collectionName, db: this.db, cb });
  }
}


// * ------------------------------------ Privates functions
function startPoll({ that, options, collectionName, db }) {
  poll({ that, options, collectionName, db });
  setInterval(() => poll({ that, options, collectionName, db }), options.pollInterval || 60000);
}

function whaitUntilReady({ that, ready, options, collectionName, db }) {
  const id = setInterval(() => {
    console.log('JYO: ready: ', ready);

    if (ready) {
      clearInterval(id);
      startPoll({ that, options, collectionName, db });
    }
  }, 10);
}

function manageEvent ({ event, lookup, collection, manageResult }) {
  if (event.cron) {
    const after = (parser.parseExpression(event.cron).next()).toDate();
    
    if (event.conditions && event.conditions.endDate && moment(after).isAfter(event.conditions.endDate)) {
      collection.findOneAndDelete(lookup, null, manageResult);
    }
    else {
      const updateDoc = { $set: { status: 'ready', 'conditions.after': after }};
      
      collection.findOneAndUpdate(lookup, updateDoc, manageResult);
    }
  }
  else {
    collection.findOneAndDelete(lookup, null, manageResult);
  }
}

function poll({ that, options, collectionName, db }) {
  const maxTimeBeforeRemove = Math.round((options.pollInterval || 60000) % 3) + 2;
  const collection = db.collection(collectionName);
  const lookupStaleEvent = {
    status: 'running',
    'conditions.after': { $lt: moment().subtract(maxTimeBeforeRemove, 'minutes').toDate() }
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
      return that._emit('error', buildError(err, result));
    }
  });
  
  collection.findOneAndUpdate(lookup, { $set: { status: 'running' }}, (err, result) => {
    if(shouldExit(err, result)) {
      return that._emit('error', buildError(err, result));
    }
    
    const event = buildEvent(result.value);
    if (event) {
      if (!event.storage) {
        // console.log('JYO: event: ', event);
        // process.exit(0)
      }
      
      if (!event.storage.collection) {
        return that._emit(event, null, () => poll({ that, options, collectionName, db }));
      }
      
      db.collection(event.storage.collection, (err, childColl) => {
        if(err) {
          return that._emit('error', err, event);
        }

        const cursor = childColl.find(event.storage.query);
        
        if (event.options.emitPerDoc) {
          cursor.forEach(doc => {
            if (!doc) {
              return poll({ that, options, collectionName, db });
            }
            
            that._emit(event, doc);
          }, err => {
            if (err) {
              return that._emit('error', err, event);
            }
          });
        }
        else {
          cursor.toArray((err, results) => {
            if (err) {
              return that._emit('error', err, event);
            }

            that._emit(event, results);
            
            poll({ that, options, collectionName, db });
          });
        }
      });
    }
  });
}


// ------------------------------------------------------------------------ //

function schedule({ newEvent, cb, collectionName, db }) {
  const { err, query, doc } = buildSchedule(newEvent);
  const collection = db.collection(collectionName);
  
  if (err) {
    return cb(err);
  }
  
  if (doc.cron) {
    // console.log('JYO: just before insert into DB: query: ', query);
    // console.log('JYO: just before insert into DB: doc: ', doc);
  }

  collection.findOneAndReplace(query, doc, { upsert: true }, cb);
}

async function scheduleBulk({ newEvents, collectionName, db, cb }) {
  if (newEvents && newEvents.constructor === Array) {
    const collection = db.collection(collectionName);
    const bulk       = collection.initializeOrderedBulkOp();
    
    const newEventsLength = newEvents.length;
    
    for (let i = 0; i < newEventsLength; i++) {
      const { err, query, doc } = buildSchedule(newEvents.shift());
      
      if (err) {
        return cb(err);
      }
      
      bulk.find(query).upsert().replaceOne(doc);
    }
    
    try {
      await bulk.execute(cb);
    }
    catch (err) {
      return cb(err);
    }
  }
  else {
    cb('Mongo-Scheduler-More: Bad parameters');
  }
}


function list({ bySchedule = false, asc = 1, query = {}, collectionName, db, cb }) {
  const collection = db.collection(collectionName);
  const options = buildOptions({ bySchedule, asc });
  
  collection.find(query, options).toArray(cb);
}

function findByName({ name, bySchedule = false, asc = 1, collectionName, db, cb }) {
  if (name) {
    const collection = db.collection(collectionName);
    const options = buildOptions({ bySchedule, asc });
    
    collection.find({ name }, options).toArray(cb);
  }
  else {
    cb('Mongo-Scheduler-More: Bad parameters');
  }
}

function findByStorageId({ name, id, bySchedule = false, asc = 1, collectionName, db, cb }) {
  if (id) {
    const collection = db.collection(collectionName);
    const lookup     = { 'storage.id': id.toString() };
    const options    = buildOptions({ bySchedule, asc });
    
    if (name) {
      lookup.name = name;
    }
    
    collection.find(lookup, options).toArray(cb);
  }
  else {
    cb('Mongo-Scheduler-More: Bad parameters');
  }
}


function generateRemoveQuery({ name = undefined, id, eventId, after }) {
  const query      = {};
      
  if (typeof name === 'string') {
    query.name = name;
  }
  
  if (eventId && ObjectID.isValid(eventId)) {
    query._id = ObjectID(eventId);
  }
  
  if (id && ObjectID.isValid(id)) {
    query['storage.id'] = ObjectID(id);
  }

  if (after && check.date(after)) {
    query['conditions.after'] = after;
  }

  return query;
}

function remove({ name = undefined, id, eventId, after, collectionName, db, cb }) {
  if (name) {
    const collection = db.collection(collectionName);
    const query = generateRemoveQuery({ name, id, eventId, after });
    
    collection.deleteMany(query, cb);
  }
  else {
    cb('Mongo-Scheduler-More: Bad parameters');
  }
}

function purge({ force = false, collectionName, db, cb }) {
  if (force === true) {
    const collection = db.collection(collectionName);
    
    collection.deleteMany({}, cb);
  }
  else {
    cb('Mongo-Scheduler-More: Bad parameters');
  }
}

function updateStatus({ status, collectionName, db, cb }) {
  const collection = db.collection(collectionName);
  const lookup = {};
  const update = { $set: { status }};

  collection.updateMany(lookup, update, { upsert: false }, cb);
}

function version() {
  const version = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'))).version;
  
  return version;
}

module.exports = Scheduler;