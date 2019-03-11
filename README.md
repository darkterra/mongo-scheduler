mongo-scheduler-more
==================

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/mongo-scheduler-more" title="View this project on NPM"><img src="https://img.shields.io/npm/v/mongo-scheduler-more.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/mongo-scheduler-more" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/mongo-scheduler-more.svg" alt="NPM downloads" /></a></span>
<br class="badge-separator" />
<span class="badge-badge"><a href="https://circleci.com/gh/darkterra/mongo-scheduler" title="CircleCI Badge"><img src="https://circleci.com/gh/darkterra/mongo-scheduler.svg?style=svg" alt="CircleCI Badge" /></a></span>
<span class="badge-badge"><a href="https://app.codacy.com/app/darkterra/mongo-scheduler?utm_source=github.com&utm_medium=referral&utm_content=darkterra/mongo-scheduler&utm_campaign=Badge_Grade_Settings" title="Codacy Badge"><img src="https://api.codacy.com/project/badge/Grade/51fe243879a94a11807318338aac7d8e" alt="Codacy Badge" /></a></span>
<span class="badge-badge"><a href="https://www.codacy.com/app/darkterra/mongo-scheduler?utm_source=github.com&utm_medium=referral&utm_content=darkterra/mongo-scheduler&utm_campaign=Badge_Coverage" title="Codacy Badge"><img src="https://api.codacy.com/project/badge/Coverage/22f5c7a46aba46ee822ef36b910c2d06" alt="Codacy Badge" /></a></span>
<br class="badge-separator" />
<span class="badge-nodeico"><a href="https://www.npmjs.com/package/mongo-scheduler-more" title="Nodei.co badge"><img src="https://nodei.co/npm/mongo-scheduler-more.png" alt="Nodei.co badge" /></a></span>

<!-- /BADGES -->


Persistent event scheduler using mongodb as storage.

Provide the scheduler with some storage and timing info and it will emit events with the corresponding document at the right time

This module, extend the original `mongo-sheduler` and work with up to date dependencies plus possibilities to remove an event recorded in database.
You can also use the same event name multiple times, as long as the "id" and / or "after" is different, otherwise it will update the document.

With this module, increase the performance of your Node.JS application !
You can completely replace your data scanning system in Data Base and more.
Node.JS is EventDriven, exploit this power within your application!

You can visit my blog [https://darkterra.fr/](https://darkterra.fr/) for [use case](https://darkterra.fr/que-faire-si-node-js-consomme-trop-en-ressources-ram-cpu/) :)

Installation
------------

`npm install mongo-scheduler-more`

Usage
-----

### Initialization

```javascript
const Scheduler = require('mongo-scheduler-more');
const scheduler = new Scheduler(connection, options);
```

**Arguments**
*   **connection** \<String or Object> - mongodb connections string (i.e.: "mongodb://localhost:27017/scheduler-db") or a mongoose connection object.
*   **options** \<Object> - Options object.

**Valid Options Object**
*   **dbname** \<String> - You can set (and overright) the name of DataBase to use _(optional if you precise the dbname in connection string)_.
*   **pollInterval** \<Number> - Frequency in ms that the scheduler should poll the db. `Default: 60000 (1 minute)`
*   **doNotFire** \<Bool> - If set to true, this instance will only schedule events, not fire them. `Default: false`
*   useNewUrlParser \<Bool> - `Driver Option` - If set to false, the mongo driver use the old parser. `Default: true`
*   loggerLevel \<String> - `Driver Option` - The logging level (error/warn/info/debug). _(optional)_
*   logger \<Object> - `Driver Option` - Custom logger object. _(optional)_
*   validateOptions \<Bool> - `Driver Option` - Validate MongoClient passed in options for correctness. `Default: false` _(only if you use the connection **string**)_
*   auth \<Object> - `Driver Option` - { user: 'your_ddb_user', password: 'your_ddb_password'}. _(optional)_
*   authMechanism \<String> - `Driver Option` - Mechanism for authentication: MDEFAULT, GSSAPI, PLAIN, MONGODB-X509, or SCRAM-SHA-1. _(optional)_

---------------------------------------

### schedule()

Schedules an event.

```javascript
const event = { name: 'breakfast', collection: 'meals', after: new Date(), data: 'Fry' }
scheduler.schedule(event)
```

**Arguments**
*   event \<Object> - Event details
*   callback \<Function> - callabck

**Event Fields**
*   name \<String> - Name of event that should be fired.
*   cron \<String> - A cron string representing a frequency this should fire on. _(optional)_
*   collection \<Object> - Info about the documents this event corresponds to. _(optional)_
*   id \<ObjectId> - Value of the _id field of the document this event corresponds to. _(optional)_
*   after \<Date> - Time that the event should be triggered at, if left blank it will trigger the next time the scheduler polls. _(optional)_
*   query \<Object> - a MongoDB query expression to select records that this event should be triggered for. _(optional)_
*   data \<Object|Primitive\> - Extra data to attach to the event. _(optional)_

---------------------------------------

### scheduler.on

Event handler.

```javascript
scheduler.on('breakfast', (meal, event) => {
  console.log(`${event.data} the ${meal.ingredients}`);
  // Assuming the document {ingredients: "Bacon and Eggs"} is in the meals collection
  // prints "Fry the Bacon and Eggs"
});
```
**Arguments**
*   eventName \<String> - Name of event.
*   handler \<Function> - handler.

---------------------------------------

### scheduler.list

List all events.

```javascript
scheduler.list((err, events) => {
  // Do something with events
});
```

**Arguments**
*   handler \<Function> - handler.

---------------------------------------

### scheduler.findByName

Find an event by name.

```javascript
scheduler.findByName('breakfast', (err, event) => {
  // Do something with event
});
```

**Arguments**
*   eventName \<String> - Name of event.
*   handler \<Function> - handler.

---------------------------------------

### scheduler.findByStorageId

Find an event by id in storage object and by name.

```javascript
const event = { name: 'breakfast' id: '5a5dfd6c4879489ce958df0c', after: new Date() };
scheduler.schedule(event);

scheduler.findByStorageId('5a5dfd6c4879489ce958df0c', 'breakfast', (err, event) => {
  // Do something with event
});
```

**Arguments**
* storageID \<ObjectId> - Value of the _id field in storage object.
* eventName \<String> - Name of event.
* handler \<Function> - handler.

---------------------------------------

### scheduler.remove

Remove an event.

```javascript
scheduler.remove('breakfast', null, null, (err, event) => {
  // Event has been removed
});
```

**Arguments**
*   eventName \<String> - Name of event.
*   id \<String> - Id of event. _(optional)_
*   after \<String> - After of event (date). _(optional)_
*   handler \<Function> - handler.

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
