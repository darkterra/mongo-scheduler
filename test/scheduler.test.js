'use strict';

require('mocha');
require('should');

const sinon      = require('sinon');
const { expect } = require('chai');
const mongo      = require('mongodb');
const moment     = require('moment');
const Scheduler  = require('../index.js');
const connection = 'mongodb://localhost:27017/mongo-scheduler-more';

const scheduler       = new Scheduler(connection, { pollInterval: 250 });
const MongoClient     = mongo.MongoClient;
const connectionArray = connection.split('/');
const database        = connectionArray[3] || null;
const options         = { useNewUrlParser: true };

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
    const expectation = (olderr, oldresult) => {
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
      events.find({name: 'awesome'}).toArray((err, docs) => {
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
      
      records.insertOne({message: 'This is a record'}, () => {
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
        storage: {},
        conditions: { after: new Date() },
        cron: '0 0 23 * * *'
      });
      
      
      setTimeout(() => {
        scheduler.findByName('empty', (err, doc) => {
          if (err) {
            console.error(err);
          }
          
          expectation(doc);
        });
      },
      50);
    });
  });
});