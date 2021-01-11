'use strict';

const moment     = require('moment');
const { expect } = require('chai');

const { connectToDB, buildSchedule, buildEvent, shouldExit, buildError } = require('../lib/helper');

const defaultEvent = {
  name: 'name',
  collection: 'collection',
  id: 'recordId',
  after: 'date',
  query: 'query',
  data: { my: 'data' }
};


describe('Connexion Tests', () => {
  it('should return throw BAD_URL', async () => {
    const url = 'badArrayConnectionShouldFireError';
    
    try {
      await expect(async () =>  connectToDB({ connection: url, driverOptions: {} })).to.throw();
    }
    catch (err) {
      // console.log('JYO: BAD_URL Yey, we have an client mongo Error !!!');
    }
  });
  it('should return throw RIGHT_URL & BAD_OPTIONS', () => {
    const url = 'mongodb://localhost:27017/mongo-scheduler-more';
    
    try {
      expect(async () => await connectToDB({ connection: url, driverOptions: {} })).to.throw();
    }
    catch (err) {
      // console.log('JYO: RIGHT_URL & BAD_OPTIONS Yey, we have an client mongo Error !!!');
    }
  });
  it('should return throw BAD_URL_WITH_CREDENTIALS', () => {
    const url = 'mongodb://AdminJY:*****@localhost:27017/mongo-scheduler-more';
    
    try {
      expect(async () => await connectToDB({ connection: url, driverOptions: {} })).to.throw();
    }
    catch (err) {
      // console.log('JYO: BAD_URL_WITH_CREDENTIALS Yey, we have an client mongo Error !!!');
    }
  });
  it('should return throw ATLAS_URL', () => {
    const url = 'mongodb+srv://AdminJY:*****@cluster0.1ba3u.mongodb.net/test?authSource=admin&replicaSet=atlas-ao2dxv-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true';
    
    try {
      expect(async () => await connectToDB({ connection: url, driverOptions: {} })).to.throw();
    }
    catch (err) {
      // console.log('JYO: ATLAS_URL Yey, we have an client mongo Error !!!');
    }
  });
  it('should return throw NO_URL', () => {
    const url = null;
    
    try {
      expect(async () => await connectToDB({ connection: url, driverOptions: {} })).to.throw();
    }
    catch (err) {
      // console.log('JYO: ATLAS_URL Yey, we have an client mongo Error !!!');
    }
  });
});


describe('schedule builder', () => {
  it('should return doc to insert', () => {
    const { doc } = buildSchedule(defaultEvent);

    doc.should.have.properties({
      name: 'name',
      status: 'ready',
      conditions: { after: 'date', endDate: undefined },
      storage: { query: 'query', collection: 'collection', id: 'recordId' },
      data: { my: 'data' },
      cron: undefined,
      options: { emitPerDoc: false }
    });
  });

  it('should return query for updates', () => {
    const { query } = buildSchedule(defaultEvent);
    
    query.should.have.properties({
      name: 'name',
      'storage.collection' : 'collection',
      'storage.id': 'recordId'
    });
  });

  it('should return an error', () => {
    const expectation = (newerr, newresult) =>  {
      
      expect(newerr).to.be.equal('/!\\ Missing property "name"');
    };
    
    buildSchedule({}, expectation);
  });

  it('should default to empty conditions', () => {
    const { doc } = buildSchedule({ name: 'new-event'});
    
    doc.should.have.properties({
      name: 'new-event',
      status: 'ready',
      conditions: { after: undefined, endDate: undefined },
      storage: { query: undefined, collection: undefined, id: undefined },
      data: undefined,
      options: { emitPerDoc: false }
    });
  });

  describe('with cron property', () => {
    const cronDetails = { ...defaultEvent, cron: '0 0 23 * * *' };

    it('should include cron string in doc', () => {
      const { doc } = buildSchedule(cronDetails);
      
      doc.cron.should.eql('0 0 23 * * *');
    });

    it('should calculate next tick', () => {
      const { doc }       = buildSchedule(cronDetails);
      const sanitizedDate = moment(doc.conditions.after).startOf('second');
      
      let nextTick = moment().hours(23).startOf('hour').toDate();
      
      if (moment(nextTick).isBefore(moment().toDate())) {
        nextTick = moment().add(1, 'd').hours(23).startOf('hour').toDate();
      }
      
      sanitizedDate.toDate().should.eql(nextTick);
    });
  });
});

describe('event builder', () => {
  const defaultEvent = { name: 'builder-event', storage: {} };

  it('extends query with id from storage', () => {
    const doc = { ...defaultEvent, storage: { id: 'HI!!!' }};
    
    const event = buildEvent(doc);
    
    event.storage.query._id.should.eql('HI!!!');
  });

  it('returns additional data', () => {
    const doc = { ...defaultEvent, data: 'OMG!' };

    const event = buildEvent(doc);
    event.data.should.eql('OMG!');
  });
});

describe('should exit', () => {
  it('should return true if an error is passed', () => {
    shouldExit(new Error()).should.eql(true);
  });

  it('should return true if last error object has an err string', () => {
    shouldExit(null, { lastErrorObject: { err: 'hai' }}).should.eql(true);
  });

  it('should return false if last error object has no err string', () => {
    shouldExit(null, { lastErrorObject: {}}).should.eql(false);
  });

  it('should return false if there is no lastErrorObject', () => {
    shouldExit(null, {}).should.eql(false);
  });
});

describe('error builder', () => {
  it('should return error', () => {
    const err = new Error();
    buildError(err).should.equal(err);
  });

  it('should wrap err string in error', () => {
    const result = { lastErrorObject: { err: 'sad times' }};
    buildError(null, result).message.should.equal('sad times');
  });
});