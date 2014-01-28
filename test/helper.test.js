var helper = require('../lib/helper')

describe('schedule builder', function() {
  var details = {
    name: 'name',
    collection: 'collection',
    id: 'recordId',
    after: 'date',
    query: 'query',
    data: { my: 'data' }
  }

  it('should return doc to insert', function() {
    var doc = helper.buildSchedule(details).doc
    doc.should.eql({
      event: 'name',
      conditions: { query: 'query', after: 'date' },
      storage: { collection: 'collection', id: 'recordId' },
      data: { my: 'data' }
    })
  })

  it('should return query for updates', function() {
    var query = helper.buildSchedule(details).query
    query.should.eql({event: 'name', storage: {collection: 'collection', id: 'recordId'}})
  })

  it('should default to empty conditions', function() {
    var doc = helper.buildSchedule({}).doc
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

  it('returns additional data', function() {
    this.doc.data = "OMG!"
    var event = helper.buildEvent(this.doc)
    event.data.should.eql("OMG!")
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
