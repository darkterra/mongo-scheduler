var mocha = require('mocha')
  , should = require('should')
  , mongo = require('mongodb')
  , Scheduler = require('../index.js')
  , connection = "mongodb://localhost:27017/mongo-scheduler"
  , MongoClient = mongo.MongoClient

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
  this.events.remove({}, function(err) {
    setTimeout(function() {
      this.records.remove({}, done)
    }.bind(this), 100)
  }.bind(this))
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
  it('should create an event', function() {
    this.scheduler.schedule('new-event', {collection: 'hi'}, null, function() {
      setTimeout(function() {
        this.events.find().toArray(function(err, docs) {
          docs.length.should.eql(1)
          docs[0].event.should.eql('new-event')
        }.bind(this))
      }.bind(this), 200)
    })
  })

  it('should overwrite an event', function() {
    this.scheduler.schedule('new-event', {collection: 'releases'}, null, function() {
      this.scheduler.schedule('new-event', {collection: 'releases'}, {after: 100}, function() {
        this.events.find({event: 'new-event'}).toArray(function(err, docs) {
          docs.length.should.eql(1)
          docs[0].event.should.eql('new-event')
          docs[0].conditions.should.eql({after: 100})
        })
      }.bind(this))
    }.bind(this))
  })
})

describe('emitter', function() {
  it('should emit an event with matching records', function(done) {
    var running = true
    this.scheduler.on('awesome', function(doc) {
      doc.message.should.eql('This is a record')
      if(running) done()
      running = false
    })

    this.records.insert({message: 'This is a record'}, function() {
      this.scheduler.schedule('awesome', {collection: 'records'})
    }.bind(this))
  })

  it('should delete executed events', function(done) {
    this.scheduler.on('awesome', function(doc) {
      setTimeout(function() {
        this.events.find({event: 'awesome'}).toArray(function(err, docs) {
          docs.length.should.eql(0)
          done()
        })
      }.bind(this), 50)
    }.bind(this))

    this.records.insert({message: 'This is a record'}, function() {
      this.scheduler.schedule('awesome', {collection: 'records'})
    }.bind(this))
  })
})
