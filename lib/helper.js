'use strict';

const moment = require('moment');
const parser = require('cron-parser');

function SchedulerError(message) {
  this.name    = 'SchedulerError';
  this.message = message || 'Unexpected Scheduler Error';
}

SchedulerError.prototype = new Error();
SchedulerError.prototype.constructor = SchedulerError;

module.exports = {
  buildSchedule: ({ name, after, id, data, cron, endDate, collection, query, options = { emitPerDoc: false }, status = 'ready' } = {}) => {
    // Check if the needed params is set
    if (!name && typeof name !== 'string') {
      const err = '/!\\ Missing property "name"';
      console.error(err);
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
      console.log('JYO: doc: ', doc);
    }
    
    const eventQuery = buildEventQuery(name, doc.conditions, id, collection, query);
    
    return { doc, query: eventQuery };
  },
  
  buildEvent: (doc) => {
    if (!doc) {
      return;
    }
    
    if(doc.storage && doc.storage.id) {
      doc.storage.query = { ...doc.storage.query, _id: doc.storage.id };
    }
    
    return doc;
  },
  
  buildOptions: ({ bySchedule, asc } = {}) => {
    let options = {}; 
    
    if (bySchedule) {
      options.sort = {
        'conditions.after': asc
      };
    }
    
    return options;
  },
  
  shouldExit: (err, result) => {
    return !!err || !!(result.lastErrorObject && result.lastErrorObject.err);
  },
  
  buildError: (err, result) => {
    return err || new SchedulerError(result.lastErrorObject.err);
  }
};

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