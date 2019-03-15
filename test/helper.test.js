const _          = require('lodash');
const moment     = require('moment');
const { expect } = require('chai');
const helper     = require('../lib/helper');

const defaultEvent = {
  name: 'name',
  collection: 'collection',
  id: 'recordId',
  after: 'date',
  query: 'query',
  data: { my: 'data' }
};

describe('schedule builder', () => {
  it('should return doc to insert', () => {
    const { doc } = helper.buildSchedule(defaultEvent);
    
    doc.should.have.properties({
      name: 'name',
      status: 'ready',
      conditions: { after: 'date' },
      storage: { query: 'query', collection: 'collection', id: 'recordId' },
      data: { my: 'data' },
      options: { emitPerDoc: false }
    });
  });

  it('should return query for updates', () => {
    const { query } = helper.buildSchedule(defaultEvent);
    
    query.should.have.properties({
      name: 'name',
      'storage.collection' : 'collection',
      'storage.id': 'recordId'
    });
  });

  it('should return an error', () => {
    const expectation = (newerr, newresult) =>  {
      if (newerr) {
        console.error('newerr: ', newerr);
      }
      expect(newerr).to.be.equal('/!\\ Missing property "name"');
    };
    
    helper.buildSchedule({}, expectation);
  });

  it('should default to empty conditions', () => {
    const { doc } = helper.buildSchedule({ name: 'new-event'});
    
    doc.should.have.properties({
      name: 'new-event',
      status: 'ready',
      conditions: { after: undefined },
      storage: { query: undefined, collection: undefined, id: undefined },
      data: undefined,
      options: { emitPerDoc: false }
    });
  });

// Remove this test ?
  describe.skip('with queryfields', () => {
    it('should translate the fields', () => {
      const eventWithOptions = { ...defaultEvent, options: { queryFields: 'name collection id query after data' }};
      const { query } = helper.buildSchedule(eventWithOptions);
      
      _.keys(query).should.eql(['event', 'storage.collection',
        'storage.id', 'storage.query', 'conditions.after', 'data']);
    });

    it('should pick the query fields from the doc', () => {
      const eventWithOptions = { ...defaultEvent, options: { queryFields: 'name collection id query after data' }};
      const { query } = helper.buildSchedule(eventWithOptions);
      
      query.should.eql({
        name: 'name',
        'storage.collection' : 'collection',
        'storage.query': 'query',
        'data': {my: 'data'}
      });
    });
  });

  describe('with cron property', () => {
    const cronDetails = { ...defaultEvent, cron: '0 0 23 * * *' };

    it('should include cron string in doc', () => {
      const { doc } = helper.buildSchedule(cronDetails);
      
      doc.cron.should.eql('0 0 23 * * *');
    });

    it('should calculate next tick', () => {
      const { doc }       = helper.buildSchedule(cronDetails);
      const nextTick      = moment().hours(23).startOf('hour').toDate();
      const sanitizedDate = moment(doc.conditions.after).startOf('second');
      
      sanitizedDate.toDate().should.eql(nextTick);
    });
  });
});

describe('event builder', () => {
  const defaultEvent = { conditions: {}, storage: {} };

  it('extends query with id from storage', () => {
    const doc = { ...defaultEvent, storage: { id: 'HI!!!' }};
    console.log('doc ', doc);
    
    const event = helper.buildEvent(doc);
    event.conditions.query._id.should.eql('HI!!!');
  });

  it('returns additional data', () => {
    const doc = { ...defaultEvent, data: 'OMG!' };
    console.log('doc ', doc);

    const event = helper.buildEvent(doc);
    event.data.should.eql('OMG!');
  });
});

describe('should exit', () => {
  it('should return true if an error is passed', () => {
    helper.shouldExit(new Error()).should.eql(true);
  });

  it('should return true if last error object has an err string', () => {
    helper.shouldExit(null, { lastErrorObject: { err: 'hai' }}).should.eql(true);
  });

  it('should return false if last error object has no err string', () => {
    helper.shouldExit(null, { lastErrorObject: {}}).should.eql(false);
  });

  it('should return false if there is no lastErrorObject', () => {
    helper.shouldExit(null, {}).should.eql(false);
  });
});

describe('error builder', () => {
  it('should return error', () => {
    const err = new Error();
    helper.buildError(err).should.equal(err);
  });

  it('should wrap err string in error', () => {
    const result = {lastErrorObject: { err: 'sad times' }};
    helper.buildError(null, result).message.should.equal('sad times');
  });
});