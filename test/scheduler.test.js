var mocha = require('mocha')
  , should = require('should')
  , sinon = require("sinon")
  , mongo = require('mongodb')
  , Scheduler = require('../index.js')
  , connection = "mongodb://localhost:27017/mongo-scheduler"
  , MongoClient = mongo.MongoClient
  , _ = require('underscore')

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

  this.events.remove({}, function(err) {
    setTimeout(cleanRecords, 100)
  })
})

after(function() {
  this.events.remove({}, function(err) {
    this.records.remove({}, function(err) {
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

    this.scheduler.schedule('new-event', { collection: 'records' }, null,  expectation)
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

  it('should delete executed events', function(done) {
    var expectation = function() {
      this.events.find({event: 'awesome'}).toArray(function(err, docs) {
        docs.length.should.eql(0)
        done()
      })
    }.bind(this)

    this.scheduler.on('awesome', function(doc) {
      setTimeout(expectation, 50)
    }.bind(this))

    this.records.insert({message: 'This is a record'}, function() {
      this.scheduler.schedule(details)
    }.bind(this))
  })
})
