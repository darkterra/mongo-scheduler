mongo-scheduler
==================

Persistent event scheduler using mongodb as storage

Provide the scheduler with some storage and timing info and it will emit events with the corresponding document at the right time

Installation
------------

`npm install mongo-scheduler`

Usage
-----

### Initialization

```javascript
var Scheduler = require('mongo-scheduer')
var scheduler = new Scheduler(connectionString, options)
```

__Arguments__
* connectionString <String> - mongodb connections string (i.e.: "mongodb://localhost:27017/scheduler-db")
* options <Object> - Options object

__Valid Options__
* pollInterval <Number> - Frequency in ms that the scheduler should poll the db. Default: 3600000 (1 hour)
* doNotFire <bool> - If set to true, this instance will only schedule events, not fire them. Default: false

---------------------------------------

### schedule()

Schedules an event.

```javascript
scheduler.schedule('breakfast', {collection: 'meals'}, {after: new Date() })
```

__Arguments__
* event <String> - Name of event that should be fired
* storage <Object> - Info about the documents this event corresponds to
* [conditions] <Object> - Timing and filtering info
* [callback] <Function>

__Storage Fields__
* collection <String> - Name of collection to query when event is triggered
* [id] <ObjectId> - Value of the _id field of the document this event corresponds to

__Conditions Fields__
* [after] <Date> - Time that the event should be triggered at, if left blank it will trigger the next time the scheduler polls
* [query] <Object> - a MongoDB query expression to select records that this event should be triggered for

---------------------------------------

### on

Event handler.

```javascript
scheduler.on('breakfast', function(meal) {
  console.log(meal.ingredients)
})
```
__Arguments__
* eventName <String> - Name of event
* handler <Function> - handler


License
-------

MIT License
