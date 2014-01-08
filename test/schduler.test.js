var mocha = require('mocha')
  , should = require('should')
  , mongo = require('mongodb')
  , Scheduler = require('../index.js')
  , connection = "mongodb://localhost:27017/mongo-scheduler"

before(function(done) {
  var self = this
  mongo.MongoClient.connect(connection, function(err, db) {
    self.db = db
    db.collection('scheduled_events', function(err, coll) {
      self.collection = coll
      db.createCollection('records', function(err, coll) {
        self.recColl = coll
        done()
      })
    })
  })
})

afterEach(function(done) {
  var self = this
  this.collection.remove({}, function(err) {
    setTimeout(function() {
      self.recColl.remove({}, done)
    }, 100)
  })
})

after(function() {
  var self = this
  this.collection.remove({}, function(err) {
    self.recColl.remove({}, function(err) {
      db.close()
      done()
    })
  })
})

describe('schedule', function() {
  it('should create an event', function() {
    var self = this
    var scheduler = new Scheduler(connection)
    scheduler.schedule('new-event', {collection: 'hi'}, null, function() {
      setTimeout(function() {
        self.collection.find().toArray(function(err, docs) {
          docs.length.should.eql(1)
          docs[0].event.should.eql('new-event')
        })
      }, 200)
    })
  })

  it('should overwrite an event', function() {
    var self = this
    var scheduler = new Scheduler(connection)
    scheduler.schedule('new-event', {collection: 'releases'}, null, function() {
      scheduler.schedule('new-event', {collection: 'releases'}, {after: 100}, function() {
        self.collection.find({event: 'new-event'}).toArray(function(err, docs) {
          docs.length.should.eql(1)
          docs[0].event.should.eql('new-event')
          docs[0].conditions.should.eql({after: 100})
        })
      })
    })
  })
})

describe('emitter', function() {
  it('should emit an event with matching records', function(done) {
    var scheduler = new Scheduler(connection, 250)
    var running = true

    scheduler.on('awesome', function(doc) {
      doc.message.should.eql('This is a record')
      if(running) done()
      running = false
    })

    this.recColl.insert({message: 'This is a record'}, function() {
      scheduler.schedule('awesome', {collection: 'records'})
    })
  })

  it('should delete executed events', function(done) {
    var self = this
    var scheduler = new Scheduler(connection, 250)

    scheduler.on('awesome', function(doc) {
      setTimeout(function() {
        self.collection.find({event: 'awesome'}).toArray(function(err, docs) {
          docs.length.should.eql(0)
          done()
        })
      }, 50)
    })

    this.recColl.insert({message: 'This is a record'}, function() {
      scheduler.schedule('awesome', {collection: 'records'})
    })
  })
})
