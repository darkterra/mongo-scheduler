var helper = require('../lib/helper')

describe('schedule builder', function() {
  it('should return doc to insert', function() {
    var doc = helper.buildSchedule('event', 'storage', 'conditions').doc
    doc.should.eql({event: 'event', conditions: 'conditions', storage: 'storage'})
  })

  it('should return query for updates', function() {
    var query = helper.buildSchedule('event', 'storage', 'conditions').query
    query.should.eql({event: 'event', storage: 'storage'})
  })

  it('should stringify the query condition', function() {
    var doc = helper.buildSchedule(null,null, {
      query: { I: { am: 'an' }, object: 'see' }
    }).doc

    doc.conditions.query.should.eql('{"I":{"am":"an"},"object":"see"}')
  })

  it('should default to empty conditions', function() {
    var doc = helper.buildSchedule(null,null, null).doc
    doc.conditions.should.eql({})
  })
})

describe('should exit', function() {
  it('returns true if eventDoc is null', function() {
    helper.shouldExit().should.equal(true)
  })

  it('returns true if conditions.after exists and is in the future', function() {
    var now = new Date()
    var past = new Date(now).setMinutes(now.getMinutes() - 5)
    var shouldExit = helper.shouldExit({conditions: { after: now }}, past)
    shouldExit.should.equal(true)
  })

  it('returns false otherwise if conditions.after is in the past', function() {
    var now = new Date()
    var past = new Date(now).setMinutes(now.getMinutes() - 5)
    var shouldExit = helper.shouldExit({conditions: { after: past }}, now)
    shouldExit.should.equal(false)
  })

  it('returns false if conditions.after does not exist', function() {
    var now = new Date()
    var shouldExit = helper.shouldExit({conditions: {before: now}})
    shouldExit.should.equal(false)
  })
})

describe('event builder', function() {
  beforeEach(function() {
    this.doc = { conditions: {}, storage: {} }
  })

  it('should convert conditions.query to an object', function() {
    this.doc.conditions.query = '{"I":{"am":"an"},"object":"see"}'
    var event = helper.buildEvent(this.doc)
    event.conditions.query.should.eql({I: {am: "an"}, object: "see"})
  })

  it('extends query with id from storage', function() {
    this.doc.storage.id = "HI!!!"
    var event = helper.buildEvent(this.doc)
    event.conditions.query._id.should.eql("HI!!!")
  })
})
