'use strict';

const parser          = require('cron-parser');
const { MongoClient } = require('mongodb');

function SchedulerError(message) {
  this.name    = 'SchedulerError';
  this.message = message || 'Unexpected Scheduler Error';
}

SchedulerError.prototype = new Error();
SchedulerError.prototype.constructor = SchedulerError;

async function connectToDB({ connection = null, driverOptions = {}, options = {} }) {
  let connectionArray;
  
  let ready    = false;
  let db       = null;
  let database = null;
  
  if (connection && typeof connection === 'string') {
    connectionArray = connection.split('/');

    if (connectionArray[2] && connectionArray[2].includes('@')) {
      driverOptions.auth = {};
      [ driverOptions.auth.user, driverOptions.auth.password ] = connectionArray[2].split('@')[0].split(':');
    }

    // Format the connection
    if (options.dbname) {
      database = options.dbname;
    }
    else if (connectionArray.length < 4) {
      const msg = 'Mongo-Scheduler-More: Bad Connection String Format';
      
      // console.error(msg);
      throw msg;
    }
    else {
      if (connectionArray.length > 3 && connectionArray[3].includes('?')) {
        const [tempDB, tempOptions] = connectionArray[3].split('?');

        database = tempDB;

        const tempOptionsArray = tempOptions.split('&');
        for (let i = 0; i < tempOptionsArray.length; i++) {
          const [name, value] = tempOptionsArray[i].split('=');
          driverOptions[name] = decodeURI(value);
        }
      }
      else {
        database = connectionArray[3] || null;
      }
    }

    try {
      const client = await getClientDB({ connection, driverOptions, database });
  
      db = client.db;
      ready = client.ready;
    }
    catch (e) {
      // console.error(e);
      throw e;
    }
  }
  else if (connection instanceof Object) {
    db = connection.db;
    ready = true;
  }
  else {
    const msg = 'Mongo-Scheduler-More: No Valid Connection parameter';
    
    // console.error(msg);
    throw msg;
  }

  return { db, ready };
}

function buildSchedule({ name, after, id, data, cron, endDate, collection, query, options = { emitPerDoc: false }, status = 'ready' } = {}) {
  // Check if the needed params is set
  if (!name && typeof name !== 'string') {
    const err = '/!\\ Missing property "name"';
    // console.error(err);
    return { err };
  }
  
  // Build the scheduled event
  const doc = {
    status,
    name,
    storage: { collection, query, id },
    conditions: { after, endDate },
    cron,
    data,
    options
  };
  
  if (cron) {
    doc.conditions.after = (parser.parseExpression(cron).next()).toDate();
  }
  
  const eventQuery = buildEventQuery(name, doc.conditions, id, collection, query);
  
  return { doc, query: eventQuery };
}

function buildEvent(doc) {
  let result = null;

  if (doc) {
    if(doc.storage && doc.storage.id) {
      doc.storage.query = { ...doc.storage.query, _id: doc.storage.id };
    }
    
    result = doc;
  }

  return result;
}

function buildOptions({ bySchedule, asc } = {}) {
  let options = {}; 
  
  if (bySchedule) {
    options.sort = {
      'conditions.after': asc
    };
  }
  
  return options;
}

module.exports = {
  buildSchedule,
  buildEvent,
  buildOptions,
  shouldExit: (err, result) => !!err || !!(result.lastErrorObject && result.lastErrorObject.err),
  buildError: (err, result) => err || new SchedulerError(result.lastErrorObject.err),
  connectToDB
};

// ------------------------------------------------------------------------ //
//                            Private functions                             //
// ------------------------------------------------------------------------ //
async function getClientDB({ connection, driverOptions = {}, database }) {
  return new Promise((resolve, reject) => {
    const client = new MongoClient(connection, driverOptions);
      
    client.connect(err => {
      if (err) {
        reject(err);
      }
      else {
        resolve({ db: client.db(database), ready: true });
      }
    });
  });
}

function buildEventQuery(name, { after }, id, collection, query) {
  // Build the query to update or create scheduled event
  const eventQuery = { name };
  
  if (after) {
    eventQuery['conditions.after'] = after;
  }
  
  if (id) {
    eventQuery['storage.id'] = id;
  }
  
  if (collection) {
    eventQuery['storage.collection'] = collection;
  }
  
  if (query) {
    eventQuery['storage.query'] = query;
  }
  
  return eventQuery;
}