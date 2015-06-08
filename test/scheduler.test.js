require('mocha')
require('should')

var sinon = require("sinon"),
    assert = require('assert'),
    mongo = require('mongodb'),
    moment = require('moment'),
    Scheduler = require('../index.js'),
    connection = "mongodb://localhost:27017/mongo-scheduler",
    _ = require('lodash')

before(function(done) {
  this.scheduler = new Scheduler(connection, {pollInterval: 250})
  mongo.MongoClient.connect(connection, function(err, db) {
    this.db = db
    db.collection('scheduled_events', function(err, coll) {
      this.events = coll
      db.createCollection('records', function(err, coll) {
        this.records = coll
        done()
      }.bind(this))
    }.bind(this))
  }.bind(this))
})

afterEach(function(done) {
  this.scheduler.removeAllListeners()

  var cleanRecords = function () {
    this.records.remove({}, done)
  }.bind(this)

  this.events.remove({}, function() {
    setTimeout(cleanRecords, 100)
  })
})

after(function() {
  this.events.remove({}, function() {
    this.records.remove({}, function() {
      db.close()
      done()
    })
  }.bind(this))
})

describe('schedule', function() {
  it('should create an event', function(done) {
    var expectation = function() {
      this.events.find().toArray(function(err, docs) {
        docs.length.should.eql(1)
        docs[0].event.should.eql('new-event')
        done()
      })
    }.bind(this)

    this.scheduler.schedule({
      name: 'new-event',
      collection: 'records',
    }, expectation)
  })

  it('should overwrite an event', function(done) {
    var expectation = function () {
      this.events.find({event: 'new-event'}).toArray(function(err, docs) {
        docs.length.should.eql(1)
        docs[0].event.should.eql('new-event')
        docs[0].conditions.should.eql({after: 100})
        done()
      })
    }.bind(this)

    var scheduleDetails = {
      name: 'new-event',
      collection: 'records'
    }

    this.scheduler.schedule(scheduleDetails, function() {
      scheduleDetails.after = 100
      this.scheduler.schedule(scheduleDetails, expectation)
    }.bind(this))
  })
})

describe('emitter', function() {
  var details = {
    name: 'awesome',
    collection: 'records'
  }

  it('should emit an error', function() {
       var running = true

    sinon.stub(this.records, 'find').yields(new Error("Cannot find"))

    this.scheduler.on('error', function(err, event) {
      err.message.should.eql('Cannot find')
      event.should.eql({event: 'awesome', storage: {collection: 'records'}})

      if(running) { this.records.find.restore(); done() }
      running = false
    }.bind(this))

    this.records.insert({message: 'This is a record'}, function() {
      this.scheduler.schedule(details)
    }.bind(this))
  })

  it('should emit an event with matching records', function(done) {
    var running = true
    this.scheduler.on('awesome', function(doc) {
      doc.message.should.eql('This is a record')
      if(running) done()
      running = false
    })

    this.records.insert({message: 'This is a record'}, function() {
      this.scheduler.schedule(details)
    }.bind(this))
  })

  it('emits the original event', function(done) {
    var additionalDetails = _.extend({data: 'MyData'}, details)

    var running = true
    this.scheduler.on('awesome', function(doc, event) {
      event.event.should.eql('awesome')
      event.storage.should.eql({collection: 'records'})
      event.data.should.eql('MyData')

      if(running) done()
      running = false
    })


    this.records.insert({message: 'This is a record'}, function() {
      this.scheduler.schedule(additionalDetails)
    }.bind(this))

  })

  it('deletes executed events', function(done) {
    var expectation = function() {
      this.events.find({event: 'awesome'}).toArray(function(err, docs) {
        docs.length.should.eql(0)
        done()
      })
    }.bind(this)

    this.scheduler.on('awesome', function() {
      setTimeout(expectation, 1050)
    }.bind(this))

    this.records.insert({message: 'This is a record'}, function() {
      this.scheduler.schedule(details)
    }.bind(this))
  })

  it('emits an empty event', function(done) {
    this.scheduler.on('empty', function(doc, event) {
      assert(!doc, "Doc should be null")
      assert(!event.data, "data should be null")
      event.event.should.eql('empty')
      done()
    })

    this.scheduler.schedule({name: 'empty'})
  })

  describe('with cron string', function() {
    it('updates the after condition', function() {
      var expectedDate = moment().hours(23).startOf('hour').toDate()
      var expectation = function() {
        this.events.find({event: 'empty'}).toArray(function(err, docs) {
          docs.length.should.eql(1)
          var saniDate = moment(docs[0].conditions.after).startOf('second')

          docs[0].status.should.eql('ready')
          saniDate.toDate.should.eql(expectedDate)
          done()
        })
      }.bind(this)

      this.scheduler.on('empty', function() {
        setTimeout(expectation, 50)
      }.bind(this))

      this.events.insert({
        name: 'empty',
        storage: {},
        conditions: { after: new Date() },
        cron: '0 23 * * *'
      })
    })
  });
})
