mongo-scheduler [![Build Status](https://travis-ci.org/jamplify/mongo-scheduler.png)](https://travis-ci.org/jamplify/mongo-scheduler)
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
var Scheduler = require('mongo-scheduler')
var scheduler = new Scheduler(connection, options)
```

__Arguments__
* connectionString <String or Object> - mongodb connections string (i.e.: "mongodb://localhost:27017/scheduler-db") or a mongoose connection object
* options <Object> - Options object

__Valid Options__
* pollInterval <Number> - Frequency in ms that the scheduler should poll the db. Default: 60000 (1 minute)
* doNotFire <bool> - If set to true, this instance will only schedule events, not fire them. Default: false

---------------------------------------

### schedule()

Schedules an event.

```javascript
var event = {name: 'breakfast' collection: 'meals', after: new Date(), data: 'Fry'}
scheduler.schedule(event)
```

__Arguments__
* event <Object> - Event details
* [callback] <Function>

__Event Fields__
* name <String> - Name of event that should be fired
* [cron] <String> - A cron string representing a frequency this should fire on
* [collection] <Object> - Info about the documents this event corresponds to
* [id] <ObjectId> - Value of the _id field of the document this event corresponds to
* [after] <Date> - Time that the event should be triggered at, if left blank it will trigger the next time the scheduler polls
* [query] <Object> - a MongoDB query expression to select records that this event should be triggered for
* [data] <Object|Primitive> - Extra data to attach to the event



---------------------------------------

### on

Event handler.

```javascript
scheduler.on('breakfast', function(meal, event) {
  console.log(event.data + " the " + meal.ingredients)
  // Assuming the document {ingredients: "Bacon and Eggs"} is in the meals collection
  // prints "Fry the Bacon and Eggs"
})
```
__Arguments__
* eventName <String> - Name of event
* handler <Function> - handler


#### Error handling
If the scheduler encounters an error it will emit an 'error' event. In this case the handler, will receive two arguments: the Error object, and the event doc (if applicable).

License
-------

MIT License
