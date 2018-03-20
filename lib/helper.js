'use strict';

const _      = require('lodash');
const parser = require('cron-parser');

function SchedulerError(message) {
  this.name    = "SchedulerError";
  this.message = message || "Unexpected Scheduler Error";
}

SchedulerError.prototype = new Error();
SchedulerError.prototype.constructor = SchedulerError;

function translateQueryfields(queryfields) {
  return _.map(queryfields.split(' '), (field) => {
    if (field === 'collection' || field === 'id') {
      return 'storage.' + field;
    }
    else if (field === 'query' || field === 'after') {
      return 'conditions.' + field;
    }
    else if (field === 'name') {
      return 'event';
    }
    else {
      return field;
    }
  });
}

module.exports = {
  buildSchedule: (details) => {
    const storage    = _.extend({}, _.pick(details, 'collection', 'id'));
    const conditions = _.extend({}, _.pick(details, 'query', 'after'));
    const options    = _.defaults(details.options || {}, {
      emitPerDoc: false,
      queryFields: 'name collection id after'
    });

    const doc = {
      status: details.status || 'ready',
      event: details.name,
      storage,
      conditions,
      data: details.data,
      options
    };

    const queryFields = translateQueryfields(options.queryFields);
    const query = _.transform(queryFields, (memo, f) => {
      memo[f] = _.get(doc, f);
    }, {});

    if (details.cron) {
      doc.cron = details.cron;
      doc.conditions.after = (parser.parseExpression(details.cron).next()).toDate();
    }
    
    return { doc, query };
  },

  buildEvent: (doc) => {
    if (!doc) {
      return;
    }

    doc.conditions.query = doc.conditions.query || {};
    
    if (typeof doc.conditions.query === 'string') {
      doc.conditions.query = JSON.parse(doc.conditions.query);
    }
    if(doc.storage && doc.storage.id) {
      _.extend(doc.conditions.query, {_id: doc.storage.id});
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
