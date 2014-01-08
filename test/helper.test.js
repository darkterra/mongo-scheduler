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

  it('should default to empty conditions', function() {
    var doc = helper.buildSchedule(null,null, null).doc
    doc.conditions.should.eql({})
  })
})

describe('event builder', function() {
  beforeEach(function() {
    this.doc = { conditions: {}, storage: {} }
  })

  it('extends query with id from storage', function() {
    this.doc.storage.id = "HI!!!"
    var event = helper.buildEvent(this.doc)
    event.conditions.query._id.should.eql("HI!!!")
  })
})

describe('should exit', function() {
  it('should return true if an error is passed', function() {
    helper.shouldExit(new Error()).should.eql(true)
  })

  it('should return true if last error object has an err string', function() {
    helper.shouldExit(null, {lastErrorObject: {err: 'hai'}}).should.eql(true)
  })

  it('should return false if last error object has no err string', function() {
    helper.shouldExit(null, {lastErrorObject: {}}).should.eql(false)
  })

  it('should return false if there is no lastErrorObject', function() {
    helper.shouldExit(null, {}).should.eql(false)
  })
})

describe('error builder', function() {
  it('should return error', function() {
    var err = new Error()
    helper.buildError(err).should.equal(err)
  })

  it('should wrap err string in error', function() {
    var result = {lastErrorObject: { err: 'sad times' }}
    helper.buildError(null, result).message.should.equal('sad times')
  })
})
