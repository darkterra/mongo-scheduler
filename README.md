mongo-scheduler-more [![CircleCI](https://circleci.com/gh/darkterra/mongo-scheduler.svg?style=svg)](https://circleci.com/gh/darkterra/mongo-scheduler)
==================
<!-- BADGES/ -->

<span class="badge-badge"><a href="https://circleci.com/gh/darkterra/mongo-scheduler" title="CircleCI Badge"><img src="https://circleci.com/gh/darkterra/mongo-scheduler.svg?style=svg" alt="CircleCI Badge" /></a></span>
<br class="badge-separator" />
<span class="badge-npmversion"><a href="https://npmjs.org/package/mongo-scheduler-more" title="View this project on NPM"><img src="https://img.shields.io/npm/v/mongo-scheduler-more.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/mongo-scheduler-more" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/mongo-scheduler-more.svg" alt="NPM downloads" /></a></span>
<br class="badge-separator" />
<span class="badge-nodeico"><a href="https://www.npmjs.com/package/mongo-scheduler-more" title="Nodei.co badge"><img src="https://nodei.co/npm/mongo-scheduler-more.png" alt="Nodei.co badge" /></a></span>

<!-- /BADGES -->


Persistent event scheduler using mongodb as storage

Provide the scheduler with some storage and timing info and it will emit events with the corresponding document at the right time

This module, extend the original `mongo-sheduler` and work with up to date dependencies plus possibilities to remove an event recorded in database. You can also use the same event name multiple times, as long as the id and / or after is different, otherwise it will update the document

Installation
------------

`npm install mongo-scheduler-more`

Usage
-----

### Initialization

```javascript
const Scheduler = require('mongo-scheduler-more')
const scheduler = new Scheduler(connection, options)
```

__Arguments__
* connectionString \<String or Object> - mongodb connections string (i.e.: "mongodb://localhost:27017/scheduler-db") or a mongoose connection object
* options \<Object> - Options object

__Valid Options__
* dbname \<String> - You can set (and overright) the name of DataBase to use
* pollInterval \<Number> - Frequency in ms that the scheduler should poll the db. Default: 60000 (1 minute)
* doNotFire \<bool> - If set to true, this instance will only schedule events, not fire them. Default: false

---------------------------------------

### schedule()

Schedules an event.

```javascript
const event = {name: 'breakfast' collection: 'meals', after: new Date(), data: 'Fry'}
scheduler.schedule(event)
```

__Arguments__
* event\<Object> - Event details
* [callback] \Function> - callabck

__Event Fields__
* name \<String> - Name of event that should be fired
* [cron] \<String> - A cron string representing a frequency this should fire on
* [collection] \<Object> - Info about the documents this event corresponds to
* [id] \<ObjectId> - Value of the _id field of the document this event corresponds to
* [after] \<Date> - Time that the event should be triggered at, if left blank it will trigger the next time the scheduler polls
* [query] \<Object> - a MongoDB query expression to select records that this event should be triggered for
* [data] \<Object|Primitive\> - Extra data to attach to the event


---------------------------------------

### scheduler.on

Event handler.

```javascript
scheduler.on('breakfast', (meal, event) => {
  console.log(event.data + " the " + meal.ingredients)
  // Assuming the document {ingredients: "Bacon and Eggs"} is in the meals collection
  // prints "Fry the Bacon and Eggs"
})
```
__Arguments__
* eventName \<String> - Name of event
* handler \<Function> - handler

---------------------------------------

### scheduler.list

List all events.

```javascript
scheduler.list((err, events) => {
  // Do something with events
})
```

__Arguments__
* handler \<Function> - handler

---------------------------------------

### scheduler.find

Find an event.

```javascript
scheduler.find('breakfast', (err, event) => {
  // Do something with event
})
```

__Arguments__
* eventName \<String> - Name of event
* handler \<Function> - handler

---------------------------------------

### scheduler.remove

Remove an event.

```javascript
scheduler.remove('breakfast', null, null, (err, event) => {
  // Event has been removed
})
```

__Arguments__
* eventName \<String> - Name of event
* [id] \<String> - Id of event
* [after] \<String> - After of event (date)
* handler \<Function> - handler

---------------------------------------

### scheduler.enable

Enable scheduler.

---------------------------------------

### scheduler.disable

Disable scheduler.

---------------------------------------

#### Error handling
If the scheduler encounters an error it will emit an 'error' event. In this case the handler, will receive two arguments: the Error object, and the event doc (if applicable).

License
-------

MIT License
