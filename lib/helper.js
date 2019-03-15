'use strict';

const _      = require('lodash');
const moment = require('moment');
const parser = require('cron-parser');

function SchedulerError(message) {
  this.name    = 'SchedulerError';
  this.message = message || 'Unexpected Scheduler Error';
}

SchedulerError.prototype = new Error();
SchedulerError.prototype.constructor = SchedulerError;

module.exports = {
  buildSchedule: ({ name, after, id, data, cron, collection, query, options = { emitPerDoc: false }, status = 'ready' } = {}) => {
    // Check if the needed params is set
    if (!name && typeof name !== 'string') {
      const err = `/!\\ Missing property 'name'`;
      console.error(err);
      return { err };
    }
    
    const doc = {
      status,
      name,
      storage: { collection, query, id },
      conditions: { after },
      data,
      options
    };
    
    const eventQuery = {
      name,
      // 'storage.id': doc.storage.id,
      // 'conditions.after': doc.conditions.after,
      'storage.collection': doc.storage.collection
    };
    
    if (after) {
      console.log('helper: after: ', after)
      eventQuery.conditions = { after };
    }
    
    if (cron) {
      doc.cron = cron;
      doc.conditions.after = (parser.parseExpression(cron).next()).toDate();
    }
    
    return { doc, query: eventQuery };
  },
  
  buildEvent: (doc) => {
    if (!doc) {
      return;
    }
    
    doc.conditions = doc.conditions || {};
    doc.conditions.query = doc.conditions.query || {};
    
    if (typeof doc.conditions.query === 'string') {
      doc.conditions.query = JSON.parse(doc.conditions.query);
    }
    
    if(doc.storage && doc.storage.id) {
      _.extend(doc.conditions.query, { _id: doc.storage.id });
    }
    
    return doc;
  },
  
  shouldExit: (err, result) => {
    return !!err || !!(result.lastErrorObject && result.lastErrorObject.err);
  },
  
  buildError: (err, result) => {
    return err || new SchedulerError(result.lastErrorObject.err);
  }
};
