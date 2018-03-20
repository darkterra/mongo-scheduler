'use strict';

require('mocha');
require('should');

const _          = require('lodash');
const sinon      = require("sinon");
const { expect } = require('chai');
const mongo      = require('mongodb');
const moment     = require('moment');
const Scheduler  = require('../index.js');
const connection = "mongodb://localhost:27017/mongo-scheduler-more";
const collectionName = 'scheduled_events';

const scheduler       = new Scheduler(connection, {pollInterval: 250});
const MongoClient     = mongo.MongoClient;
const connectionArray = connection.split('/');
const database        = connectionArray[3] || null;

let db;
let events;
// let records;

before(done => {
  MongoClient.connect(connection, (err, client) => {
    if (err) {
      console.error(err);
    }
    db = client.db(database);
    db.collection('scheduled_events', (err, results) => {
      if (err) {
        console.error(err);
      }
      events = results;
        done();
      // db.createCollection(collectionName, (err, results) => {
      //   if (err) {
      //     console.error(err);
      //   }
      //   records = results;
      // });
    });
  });
});

// afterEach(done => {
//   // scheduler.removeAllListeners();

//   // var cleanRecords = () =>  {
//   //   records.remove({}, done);
//   // };

//   events.remove({}, () => {
//     // setTimeout(cleanRecords, 100);
//   });
// });

after((done) => {
  events.remove({}, () => {
    // records.remove({}, () => {
      // db.close();
      done();
    // });
  });
});

describe('schedule', () => {
  it('should create an event', done => {
    const expectation = (olderr, result) => {
      if (olderr) {
        console.error(olderr);
      }
      if (result) {
        console.log(result)
      }
      events.find().toArray((err, docs) => {
        if (err) {
          console.error(err);
        }
        expect(docs.length).to.be.equal(1);
        expect(docs[0].event).to.be.equal('new-event');
        done();
      });
    };
    
    scheduler.schedule({
      name: 'new-event',
      collection: collectionName,
    }, expectation);
  });
  
  it('should overwrite an event', (done) => {
    const expectation = () =>  {
      events.find({event: 'new-event'}).toArray((err, docs) => {
        if (err) {
          console.error(err);
        }
        
        expect(docs.length).to.be.equal(1);
        expect(docs[0].event).to.be.equal('new-event');
        expect(docs[0].conditions).to.be.equal({after: 100});
        done();
      });
    };
    
    var scheduleDetails = {
      name: 'new-event',
      collection: collectionName
    };
    
    scheduler.schedule(scheduleDetails, () => {
      scheduleDetails.after = 100;
      scheduler.schedule(scheduleDetails, expectation);
    });
  });
});

describe('emitter', () => {
  var details = {
    name: 'awesome',
    collection: collectionName
  };

  it('should emit an error', (done) => {
   let running = true;
   
    sinon.stub(records, 'find').yields(new Error("Cannot find"));
    
    scheduler.on('error', (err, event) => {
      err.message.should.eql('Cannot find');
      event.should.eql({event: 'awesome', storage: {collection: collectionName}});
      
      if(running) {
        records.find.restore();
        done();
        
      }
      running = false;
    });
    
    records.insert({message: 'This is a record'}, () => {
      scheduler.schedule(details);
    });
  });

  it('should emit an event with matching records', done => {
    let running = true;
    scheduler.on('awesome', (doc) => {
      doc[0].message.should.eql('This is a record');
      
      if(running) {
        done();
      }
      
      running = false;
    });

    records.insert({message: 'This is a record'}, () => {
      scheduler.schedule(details);
    });
  });

  it("emits an event with multiple records", done => {
    var running = true;
    scheduler.on('awesome', docs => {
      docs.length.should.eql(2);
      if(running) done();
      running = false;
    });

    records.insert([
      {message: 'This is a record'},
      {message: 'Another Record'}
    ], () => {
      scheduler.schedule(details);
    });

    done();
  });

  it('emits the original event', done => {
    var additionalDetails = _.extend({data: 'MyData'}, details);

    var running = true;
    scheduler.on('awesome', (doc, event) => {
      event.event.should.eql('awesome');
      event.storage.should.eql({collection: collectionName});
      event.data.should.eql('MyData');

      if(running) done();
      running = false;
    });


    records.insert({message: 'This is a record'}, () => {
      scheduler.schedule(additionalDetails);
    });
  });

  it('deletes executed events', done => {
    var expectation = () => {
      events.find({event: 'awesome'}).toArray((err, docs) => {
        if (err) {
          console.error(err);
        }
        docs.length.should.eql(0);
        done();
      });
    };

    scheduler.on('awesome', () => {
      setTimeout(expectation, 1050);
    });

    records.insert({message: 'This is a record'}, () => {
      scheduler.schedule(details);
    });
  });

  it('emits an empty event', done => {
    scheduler.on('empty', (doc, event) => {
      assert(!doc, "Doc should be null");
      assert(!event.data, "data should be null");
      event.event.should.eql('empty');
      done();
    });

    scheduler.schedule({name: 'empty'});
  });

  describe("with emitPerDoc", () => {
    var additionalDetails = _.extend({
      options: {emitPerDoc: true}
    }, details);

    it('should emit an event per doc', done => {
      var running = true;
      scheduler.on('awesome', doc => {
        doc.message.should.eql('This is a record');
        if(running) done();
        running = false;
      });
      records.insert([
        {message: 'This is a record'},
        {message: 'This is a record'}
      ], () => {
        scheduler.schedule(additionalDetails);
      });
    });
  });

  describe("with a query", () => {
    var additionalDetails = _.extend({query: {}}, details);

    it('should emit an event with matching records', done => {
      var running = true;
      scheduler.on('awesome', docs => {
        docs[0].message.should.eql('This is a record');
        if(running) done();
        running = false;
      });

      records.insert({message: 'This is a record'}, () => {
        scheduler.schedule(additionalDetails);
      });
    });

    it("emits an event with multiple records", done => {
      var running = true;
      scheduler.on('awesome', docs => {
        docs.length.should.eql(2);
        if(running) done();
        running = false;
      });

      records.insert([
        {message: 'This is a record'},
        {message: 'Another Record'}
      ], () => {
        scheduler.schedule(additionalDetails);
      });
    });
  });

  describe('with cron string', () => {
    it('updates the after condition', (done) => {
      var expectedDate = moment().hours(23).startOf('hour').toDate();
      var expectation = () => {
        events.find({event: 'empty'}).toArray((err, docs) => {
          if (err) {
            console.error(err);
          }
          docs.length.should.eql(1);
          var saniDate = moment(docs[0].conditions.after).startOf('second');

          docs[0].status.should.eql('ready');
          saniDate.toDate.should.eql(expectedDate);
          done();
        });
      };

      scheduler.on('empty', () => {
        setTimeout(expectation, 50);
      });

      events.insert({
        name: 'empty',
        storage: {},
        conditions: { after: new Date() },
        cron: '0 23 * * *'
      });
    });
  });
})