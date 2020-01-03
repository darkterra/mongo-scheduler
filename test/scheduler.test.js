'use strict';

require('mocha');
require('should');

const sinon            = require('sinon');
const { expect }       = require('chai');
const mongo            = require('mongodb');
const moment           = require('moment');
const { readFileSync } = require('fs');
const { join }         = require('path');

const Scheduler  = require('../index.js');
const connection = 'mongodb://localhost:27017/mongo-scheduler-more';

const scheduler       = new Scheduler(connection, { pollInterval: 250 });
const MongoClient     = mongo.MongoClient;
const connectionArray = connection.split('/');
const database        = connectionArray[3] || null;
const options         = { useNewUrlParser: true };

const genericError = 'Mongo-Scheduler-More: Bad parameters';

let db;
let events;
let records;

before(done => {
  MongoClient.connect(connection, options, (err, client) => {
    if (err) {
      console.error(err);
    }
    db = client.db(database);
    db.collection('scheduled_events', (err, results) => {
      if (err) {
        console.error(err);
      }
      events = results;
      db.createCollection('records', (err, results) => {
        if (err) {
          console.error(err);
        }
        records = results;
        done();
      });
    });
  });
});

afterEach(done => {
  scheduler.removeAllListeners();

  const cleanRecords = () => {
    records.deleteMany({}, done);
  };

  events.deleteMany({}, () => {
    setTimeout(cleanRecords, 100);
  });
});

after((done) => {
  events.deleteMany({}, () => {
    records.deleteMany({}, () => {
      // db.close();
      done();
    });
  });
});

describe('schedule', () => {
  const scheduleDetails = {
    name: 'new-event',
    collection: 'records'
  };
  
  it('should create an event', done => {
    const expectation = (olderr, oldResult) => {
      if (olderr) {
        console.error('olderr: ', olderr);
      }
      events.find().toArray((err, docs) => {
        if (err) {
          console.error(err);
        }
        
        expect(docs.length).to.be.equal(1);
        expect(docs[0].name).to.be.equal('new-event');
        done();
      });
    };
    
    scheduler.schedule(scheduleDetails, expectation);
  });
  
  it('should overwrite an event', (done) => {
    const expectation = (newerr, newresult) =>  {
      if (newerr) {
        console.error('newerr: ', newerr);
      }
      events.find({name: 'new-event'}).toArray((err, docs) => {
        if (err) {
          console.error(err);
        }
        
        expect(docs.length).to.be.equal(1);
        expect(docs[0].name).to.be.equal('new-event');
        expect(docs[0].data).to.be.equal(100);
        done();
      });
    };
    
    scheduler.schedule(scheduleDetails, (olderr, result) =>  {
      if (olderr) {
        console.error('olderr: ', olderr);
      }
      scheduleDetails.data = 100;
      scheduler.schedule(scheduleDetails, expectation);
    });
  });
});

describe('emitter', () => {
  const details = {
    name: 'awesome',
    collection: 'records'
  };
  
  it.skip('should emit an error', (done) => {
    let running = true;
   
    sinon.stub(records, 'find').yields(new Error('Cannot find'));
    
    scheduler.on('error', (err, event) => {
      expect(err.message).to.be.equal('Cannot find');
      expect(event).to.be.equal({ name: 'awesome', storage: { collection: 'records' }});
      
      if(running) {
        // records.find.restore();
        done();
      }
      
      running = false;
    });
    
    records.insertOne({ message: 'This is a record' }, () => {
      scheduler.schedule(details);
    });
  });
  
  it('should emit an event with matching records', done => {
    let running = true;
    
    scheduler.on('awesome', (event, docs) => {
      expect(docs[0].message).to.be.equal('This is a record');
      
      if(running) {
        done();
      }
      
      running = false;
    });
    
    records.insertOne({ message: 'This is a record' }, () => {
      scheduler.schedule(details);
    });
  });
  
  it('emits an event with multiple records', done => {
    let running = true;
    
    scheduler.on('awesome', (event, docs) => {
      docs.length.should.eql(2);
      
      if(running) {
        done();
      }
      
      running = false;
    });
    
    records.insertMany([
      { message: 'This is a record' },
      { message: 'Another Record' }
    ], () => {
      scheduler.schedule(details);
    });
    
    done();
  });

  it('emits the original event', done => {
    const additionalDetails = { data: 'MyData', ...details };
    
    let running = true;
    
    scheduler.on('awesome', (event, doc) => {
      event.name.should.eql('awesome');
      event.storage.should.eql({ collection: 'records', query: null, id: null });
      event.data.should.eql('MyData');
      
      if(running) {
        done();
      }
      
      running = false;
    });
    
    records.insertOne({message: 'This is a record'}, () => {
      scheduler.schedule(additionalDetails);
    });
  });

  it('deletes executed events', done => {
    const expectation = () => {
      events.find({ name: 'awesome' }).toArray((err, docs) => {
        if (err) {
          console.error(err);
        }
        expect(docs.length).to.be.equal(0);
        done();
      });
    };

    scheduler.on('awesome', () => {
      setTimeout(expectation, 1050);
    });

    records.insertOne({message: 'This is a record'}, () => {
      scheduler.schedule(details);
    });
  });

  it('emits an empty event', done => {
    scheduler.on('empty', (event, doc) => {
      expect(doc).to.be.a('null', 'Doc should be null');
      expect(event.data).to.be.a('null', 'data should be null');
      expect(event.name).to.be.equal('empty');
      done();
    });

    scheduler.schedule({name: 'empty'});
  });

  describe('with emitPerDoc', () => {
    const additionalDetails = { options: { emitPerDoc: true }, ...details };
    
    
    it('should emit an event per doc', done => {
      let running = true;
      
      scheduler.on('awesome', (event, doc) => {
        doc.message.should.eql('This is a record');
        
        if(running) {
          done();
        }
        
        running = false;
      });
      
      records.insertMany([
        { message: 'This is a record' },
        { message: 'This is a record' }
      ], () => {
        scheduler.schedule(additionalDetails);
      });
    });
  });

  describe('with a query', () => {
    const additionalDetails = { query: {}, ...details };

    it('should emit an event with matching records', done => {
      let running = true;
      
      scheduler.on('awesome', (event, docs) => {
        docs[0].message.should.eql('This is a record');
        if(running) {
          done();
        }
        
        running = false;
      });
      
      records.insertOne({ message: 'This is a record' }, () => {
        scheduler.schedule(additionalDetails);
      });
    });
    
    it('emits an event with multiple records', done => {
      let running = true;
      scheduler.on('awesome', (event, docs) => {
        docs.length.should.eql(2);
        if(running) {
          done();
        }
        running = false;
      });

      records.insertMany([
        { message: 'This is a record' },
        { message: 'Another Record' }
      ], () => {
        scheduler.schedule(additionalDetails);
      });
    });
  });

  describe('with cron string', () => {
    it('updates the after condition', (done) => {
      let expectedDate = moment().hours(23).startOf('hour').toDate();
      
      if (moment(expectedDate).isBefore(moment().toDate())) {
        expectedDate = moment().add(1, 'd').hours(23).startOf('hour').toDate();
      }
      
      const expectation = (doc) => {
        const saniDate = moment(doc.conditions.after).startOf('hour');
        
        doc.status.should.eql('ready');
        saniDate.toDate().should.eql(expectedDate);
        done();
      };
      
      scheduler.schedule({
        name: 'empty',
        // storage: {},
        conditions: { after: new Date() },
        cron: '0 0 23 * * *'
      });
      
      
      setTimeout(() => {
        scheduler.findByName({ name: 'empty' }, (err, [event]) => {
          if (err) {
            console.error(err);
          }
          
          expectation(event);
        });
      },
      50);
    });
  });

  describe('with cron string and endDate option', () => {
    it.skip('updates the after condition', (done) => {
      let count = 0;
      let expectedDate = moment().add(3, 's').toDate();
      
      const expectation = (doc) => {
        count++;
        
        if (count >= 2) {
          const saniDate = moment().toDate();
          
          doc.status.should.eql('ready');
          moment.duration(moment(saniDate).diff(expectedDate)).seconds().should.eql(0);
          done();
        }
      };
      
      scheduler.on('endDate setup', event => expectation(event));
      
      scheduler.schedule({
        name: 'endDate setup',
        after: moment().add(15, 'm').toDate(),
        cron: '*/1 * * * * *',
        endDate: expectedDate
      }, () => console.log('JYO: Event Inserted !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
      
      
    }).timeout(10000);
  });
});


describe('bulk', () => {
  const bulkSchedule = [
    {
      name: 'event-to-bulk',
      after: moment().add(15, 'm').toDate()
    },
    {
      name: 'event-to-bulk',
      after: moment().add(25, 'm').toDate()
    },
    {
      name: 'event-to-bulk',
      after: moment().add(8, 'm').toDate()
    },
    {
      name: 'event-to-bulk',
      after: moment().add(66, 'm').toDate()
    },
    {
      name: 'event-to-bulk',
      after: moment().add(5000, 'm').toDate()
    },
    {
      name: 'event-to-bulk',
      data: 'this is hacked scheduler !!!',
      after: moment().add(5000, 'm').toDate()
    }
  ];
  
  it('should callback an error', done => {
    const expectation = (olderr, oldResult) => {
      expect(olderr).to.be.equal(genericError);
      
      done();
    };
    
    scheduler.remove({}, expectation);
  });
  
  it('should callback an error', done => {
    const expectation = (olderr, oldResult) => {
      expect(olderr).to.be.equal(genericError);
      
      done();
    };
    
    scheduler.scheduleBulk(null, expectation);
  });
  
  it('should schedule all events at once request to mongo', done => {
    const expectation = (olderr, oldResult) => {
      if (olderr) {
        console.error('olderr: ', olderr);
      }
      
      events.find().toArray((err, docs) => {
        if (err) {
          console.error(err);
        }
        
        expect(docs.length).to.be.equal(5);
        expect(oldResult.result.nUpserted).to.be.equal(5);
        expect(oldResult.result.nMatched).to.be.equal(1);
        expect(oldResult.result.nModified).to.be.equal(1);
        done();
      });
    };
    
    scheduler.scheduleBulk(bulkSchedule, expectation);
  });
});

describe('purge', () => {
  const scheduleForPurge = [
    {
      name: 'event-to-purge',
      after: moment().add(15, 'm').toDate()
    },
    {
      name: 'event-to-purge',
      after: moment().add(25, 'm').toDate()
    },
    {
      name: 'event-to-purge',
      after: moment().add(8, 'm').toDate()
    },
    {
      name: 'event-to-purge',
      after: moment().add(66, 'm').toDate()
    },
    {
      name: 'event-to-purge',
      after: moment().add(5000, 'm').toDate()
    }
  ];
  
  it('should callback an error', done => {
    const expectation = (olderr, oldResult) => {
      expect(olderr).to.be.equal(genericError);
      
      done();
    };
    
    scheduler.purge({}, expectation);
  });
  
  it('should purge all events', done => {
    const expectation = (olderr, oldResult) => {
      if (olderr) {
        console.error('olderr: ', olderr);
      }
      
      scheduler.purge({ force: true }, (err, result) => {
        if (err) {
          console.error('err: ', err);
        }
        
        events.find().toArray((err, docs) => {
          if (err) {
            console.error(err);
          }
          
          expect(docs.length).to.be.equal(0);
          expect(result.deletedCount).to.be.equal(5);
          done();
        });
      });
      
    };
    
    scheduler.scheduleBulk(scheduleForPurge, expectation);
  });
});

describe('list', () => {
  const scheduleForList = [
    {
      name: 'event-to-list',
      data: 2,
      after: moment().add(15, 'm').toDate()
    },
    {
      name: 'event-to-list',
      data: 3,
      after: moment().add(25, 'm').toDate()
    },
    {
      name: 'event-to-list',
      data: 1,
      after: moment().add(8, 'm').toDate()
    },
    {
      name: 'event-to-list',
      data: 4,
      after: moment().add(66, 'm').toDate()
    },
    {
      name: 'event-to-list',
      data: 5,
      after: moment().add(5000, 'm').toDate()
    }
  ];
  
  beforeEach(done => {
    scheduler.scheduleBulk([...scheduleForList], () => {
      done();
    });
  });
  
  it('should list by saved order', done => {
    scheduler.list({}, (err, result) => {
      if (err) {
        console.error('err: ', err);
      }
      
      for (let i = 0; i < scheduleForList.length; i++) {
        expect(result[i].data).to.be.equal(scheduleForList[i].data);
      }
      
      done();
    });
  });
  
  it('should list by time to schedule (asc)', done => {
    scheduler.list({ bySchedule: true }, (err, result) => {
      if (err) {
        console.error('err: ', err);
      }
      
      for (let i = 0; i < scheduleForList.length; i++) {
        expect(result[i].data).to.be.equal(i + 1);
      }
      
      done();
    });
  });
  
  it('should list by time to schedule (asc)', done => {
    let j = 5;
    scheduler.list({ bySchedule: true, asc: -1 }, (err, result) => {
      if (err) {
        console.error('err: ', err);
      }
      
      for (let i = 0; i < scheduleForList.length; i++) {
        expect(result[i].data).to.be.equal(j--);
      }
      
      done();
    });
  });
});

describe('findBy', () => {
  const scheduleForFindBy = [
    {
      name: 'event-to-find',
      data: 2,
      id: '5c96c3a3a28fe9d02433b24e',
      after: moment().add(15, 'm').toDate()
    },
    {
      name: 'event-to-find',
      data: 1,
      id: '5c96c3a3a28fe9d02433b250',
      after: moment().add(8, 'm').toDate()
    },
    {
      name: 'event-to-find',
      data: 4,
      after: moment().add(66, 'm').toDate()
    },
    {
      name: 'event-to-find-new',
      data: 5,
      id: '5c96c3a3a28fe9d02433b250',
      after: moment().add(5000, 'm').toDate()
    }
  ];
  
  beforeEach(done => {
    scheduler.scheduleBulk([...scheduleForFindBy], () => {
      done();
    });
  });
  
  it('name should callback error', done => {
    scheduler.findByName({}, err => {
      expect(err).to.be.equal(genericError);
      done();
    });
  });
  
  it('name', done => {
    scheduler.findByName({ name: 'event-to-find' }, (err, event) => {
      if (err) {
        console.error(err);
      }
      
      event.length.should.eql(3);
      done();
    });
  });
  
  it('storageId should callback error', done => {
    scheduler.findByStorageId({}, err => {
      expect(err).to.be.equal(genericError);
      done();
    });
  });
  
  it('storageId', done => {
    scheduler.findByStorageId({ id: '5c96c3a3a28fe9d02433b250' }, (err, event) => {
      if (err) {
        console.error(err);
      }
      
      event.length.should.eql(2);
      event[0].storage.id.should.eql('5c96c3a3a28fe9d02433b250');
      event[1].storage.id.should.eql('5c96c3a3a28fe9d02433b250');
      done();
    });
  });
  
  it('storageId and name', done => {
    scheduler.findByStorageId({ name: 'event-to-find', id: '5c96c3a3a28fe9d02433b250' }, (err, event) => {
      if (err) {
        console.error(err);
      }
      
      event.length.should.eql(1);
      event[0].storage.id.should.eql('5c96c3a3a28fe9d02433b250');
      done();
    });
  });
});

describe('remove', () => {
  const after = moment().add(25, 'm').toDate();
  const scheduleForRemove = [
    {
      name: 'event-to-remove',
      data: 2,
      after: moment().add(15, 'm').toDate()
    },
    {
      name: 'event-to-remove',
      data: 3,
      after
    },
    {
      name: 'event-to-remove',
      data: 1,
      id: '123456789',
      after: moment().add(8, 'm').toDate()
    },
    {
      name: 'event-to-remove',
      data: 4,
      after: moment().add(66, 'm').toDate()
    },
    {
      name: 'event-to-remove-new',
      data: 5,
      after: moment().add(5000, 'm').toDate()
    }
  ];
  
  beforeEach(done => {
    scheduler.scheduleBulk([...scheduleForRemove], () => {
      done();
    });
  });
  
  it('should callback an error', done => {
    const expectation = (olderr, oldResult) => {
      expect(olderr).to.be.equal(genericError);
      
      done();
    };
    
    scheduler.remove({}, expectation);
  });
  
  it('should remove by after', done => {
    scheduler.remove({ name: 'event-to-remove', after }, (err, result) => {
      if (err) {
        console.error('err: ', err);
      }
      
      expect(result.result.ok).to.be.equal(1);
      expect(result.result.n).to.be.equal(1);
      expect(result.deletedCount).to.be.equal(1);
      
      done();
    });
  });
  
  it('should remove by name', done => {
    scheduler.remove({ name: 'event-to-remove' }, (err, result) => {
      if (err) {
        console.error('err: ', err);
      }
      
      expect(result.result.ok).to.be.equal(1);
      expect(result.result.n).to.be.equal(4);
      expect(result.deletedCount).to.be.equal(4);
      
      done();
    });
  });
  
  it('should remove by eventId (ObjectID)', done => {
    scheduler.list({ query: { name: 'event-to-remove-new' }}, (err, [eventToRemove]) => {
      if (err) {
        console.log('err: ', err);
      }
      
      scheduler.remove({ name: 'event-to-remove-new', eventId: eventToRemove._id }, (err, result) => {
        if (err) {
          console.error('err: ', err);
        }
        
        expect(result.result.ok).to.be.equal(1);
        expect(result.result.n).to.be.equal(1);
        expect(result.deletedCount).to.be.equal(1);
        
        done();
      });
    });
  });
  
  it('should remove by id (String)', done => {
    scheduler.remove({ name: 'event-to-remove-new', id: '123456789' }, (err, result) => {
      if (err) {
        console.error('err: ', err);
      }
      
      expect(result.result.ok).to.be.equal(1);
      expect(result.result.n).to.be.equal(1);
      expect(result.deletedCount).to.be.equal(1);
      
      done();
      });
  });
});


describe('version', () => {
  const currentVersion = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'))).version;
  
  it(`should show the last version: ${currentVersion}`, () => {
    expect(currentVersion).to.be.equal(scheduler.version());
  });
});
