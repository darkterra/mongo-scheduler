mongo-scheduler-more
==================

<!-- BADGES/ -->

<span class="badge-npmversion"><a href="https://npmjs.org/package/mongo-scheduler-more" title="View this project on NPM"><img src="https://img.shields.io/npm/v/mongo-scheduler-more.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/mongo-scheduler-more" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/mongo-scheduler-more.svg" alt="NPM downloads" /></a></span>
<br class="badge-separator" />
<span class="badge-badge"><a href="https://circleci.com/gh/darkterra/mongo-scheduler" title="CircleCI Badge"><img src="https://circleci.com/gh/darkterra/mongo-scheduler.svg?style=svg" alt="CircleCI Badge" /></a></span>
<span class="badge-badge"><a href="https://app.codacy.com/app/darkterra/mongo-scheduler?utm_source=github.com&utm_medium=referral&utm_content=darkterra/mongo-scheduler&utm_campaign=Badge_Grade_Settings" title="Codacy Grade Badge"><img src="https://api.codacy.com/project/badge/Grade/51fe243879a94a11807318338aac7d8e" alt="Codacy Grade Badge" /></a></span>
<span class="badge-badge"><a href="https://www.codacy.com/app/darkterra/mongo-scheduler?utm_source=github.com&utm_medium=referral&utm_content=darkterra/mongo-scheduler&utm_campaign=Badge_Coverage" title="Codacy Coverage Badge"><img src="https://api.codacy.com/project/badge/Coverage/22f5c7a46aba46ee822ef36b910c2d06" alt="Codacy Coverage Badge" /></a></span>
<br class="badge-separator" />
<span class="badge-badge"><a href="https://david-dm.org/darkterra/mongo-scheduler" title="David Dependencies Badge"><img src="https://david-dm.org/darkterra/mongo-scheduler/status.svg" alt="David Dependencies Badge" /></a></span>
<span class="badge-badge"><a href="https://david-dm.org/darkterra/mongo-scheduler?type=dev" title="David Dev Dependencies Badge"><img src="https://david-dm.org/darkterra/mongo-scheduler/dev-status.svg" alt="David Dev Dependencies Badge" /></a></span>
<br class="badge-separator" />
<span class="badge-nodeico"><a href="https://www.npmjs.com/package/mongo-scheduler-more" title="Nodei.co badge"><img src="https://nodei.co/npm/mongo-scheduler-more.png" alt="Nodei.co badge" /></a></span>

<!-- /BADGES -->


**/!\\ The version 2.0.0 has undergone a big upgrade /!\\**

*   **Several methods have changed signatures! Be careful when updating to properly adapt all the methods you use.**
*   New methods.
*   Updated deprecated methods of the mongodb driver.
*   Faster
*   More robust
*   A brand new documentation _(below)_

If you encounter problems, do not hesitate to create an issue _(and / or pull requests)_ on the project github.
If you like mongo-scheduler-more, do not hesitate to leave a star on the project github :)

---------------------------------------

# Description

Persistent event scheduler using mongodb as storage.

Provide the scheduler with some storage and timing info and it will emit events with the corresponding document at the right time

This module, extend the original `mongo-sheduler` and work with up to date dependencies .
You can also use the same event name multiple times, as long as the "id" and / or "after" is different, otherwise it will update the document.

With this module, increase the performance of your Node.JS application !

You can completely replace your data scanning system in Data Base and more.
Node.JS is EventDriven, exploit this power within your application!

You can visit my blog [https://darkterra.fr/](https://darkterra.fr/) for [use case](https://darkterra.fr/que-faire-si-node-js-consomme-trop-en-ressources-ram-cpu/) :)

# Installation

`npm install mongo-scheduler-more`

# Usage

## Initialization

```javascript
const msm = require('mongo-scheduler-more');
const scheduler = new msm('mongodb://localhost:27017/scheduler-db', options);
```

### Arguments

*   **connection \<String> or \<Object>**

|Type             |Description                                                                                                              |Optional   |
|:-               |:-                                                                                                                       |:-:        |
|String or Object |Use for initiate the connexion with MongoDB, you can use an classical connexion string or a mongoose connection object.  |**false**  |

*   **options \<Object>**

|Name             |Type   |Description                                                                                                            |Driver Option  |Optional |
|:-               |:-     |:-                                                                                                                     |:-:            |:-:      |
|dbname           |String |You can set (and overright) the name of DataBase to use. _(only if you use the connexion string)_                      |**false**      |true     |
|pollInterval     |Number |Frequency in ms that the scheduler should poll the db. `Default: 60000 (1 minute)`.                                    |**false**      |true     |
|doNotFire        |Bool   |If set to true, this instance will only schedule events, not fire them. `Default: false`.                              |**false**      |true     |
|useNewUrlParser  |Bool   |If set to false, the mongo driver use the old parser. `Default: true`.                                                 |true           |true     |
|loggerLevel      |String |The logging level (error / warn / info / debug).                                                                       |true           |true     |
|logger           |Object |Custom logger object.                                                                                                  |true           |true     |
|validateOptions  |Bool   |Validate MongoClient passed in options for correctness. `Default: false` _(only if you use the connection **string**)_ |true           |true     |
|auth             |Object |{ user: 'your\_ddb\_user', password: 'your\_ddb\_password'}.                                                           |true           |true     |
|authMechanism    |String |Mechanism for authentication: MDEFAULT, GSSAPI, PLAIN, MONGODB-X509, or SCRAM-SHA-1                                    |true           |true     |

---------------------------------------

## schedule()

_`schedule` method allows to create event (stored in MongoDB) that will trigger according to the conditions described below :_

###### Schedules the most basic event:

```javascript
const moment = require('moment');
const event  = { name: 'basicUsage', after: moment().add(1, 'hours').toDate()};
scheduler.schedule(event, (err, result) => {
  if (err) {
    console.error(err);
  }
});
// This event should trigger the "scheduler.on('basicUsage', callback);" in one hour
```

If is your first scheduling event, it's create the `scheduled_events` collection with your first event stored.

You can also use the same event name multiple times, as long as the `id` and / or `after` is different, otherwise it will update the document stored in mongodb.

### Arguments

*   **Event \<Object>**

|Name       |Type                 |Description                                                                                                                                                                                                                                                        |Optional |
|:-         |:-                   |:-                                                                                                                                                                                                                                                                 |:-:      |
|name       |String               |Name of event that should be fired.                                                                                                                                                                                                                                |**false**|
|after      |Date                 |Time that the event should be triggered at, if left blank it will trigger the next time the scheduler polls.                                                                                                                                                       |true     |
|id         |ObjectId or String   |\_id field of the document this event corresponds to.                                                                                                                                                                                                              |true     |
|cron       |String               |**(Override 'after')**. A cron string representing a frequency this should fire on. Ex: `cron: '0 0 23 * * *'`, see: [cron-parser](https://www.npmjs.com/package/cron-parser).                                                                                     |true     |
|endDate    |Date                 |**(Only if the cron option is use)**.  Set a deadline to stop the infinite triggering of the cron option.                                                                                                                                                          |true     |
|collection |Object               |Name of the collection to use for the **query** parameter _(just below)_.                                                                                                                                                                                          |true     |
|query      |Object               |A MongoDB query expression to select document that this event should be triggered _(only if the `collection` property is set)_ for. Ex: `{ payement: true }`, see: [document-query-filter](https://docs.mongodb.com/manual/core/document/#document-query-filter).  |true     |
|data       |Object or Primitive  |Extra data to attach to the event.                                                                                                                                                                                                                                 |true     |

*   **callback \<Function>**

|Name   |Type             |Description                                                                        |Optional |
|:-     |:-               |:-                                                                                 |:-:      |
|err    |String or Object |Tell you what wrong when the module try to create or update a schedule event       |true     |
|result |Object           |The collection result callback. Contain 2 properties : `lastErrorObject`, `value`  |true     |

---------------------------------------

###### Schedules an event with data _(stored directly inside the event object)_:

```javascript
const moment = require('moment');
const event  = { 
  name: 'timeToCheckLicenceKey',
  after: moment().add(1, 'years').toDate(),
  data: 'First year offert ;)'
};

scheduler.schedule(event);
//
// This event (timeToCheckLicenceKey) should trigger in one year with extra data value
```

###### Schedules an event with id _(stored in the storage event object)_:

```javascript
const moment = require('moment');
const event  = {
  name: 'abandonedShoppingCart',
  id: '5a5dfd6c4879489ce958df0c',
  after: moment().add(15, 'minutes').toDate()
};
scheduler.schedule(event);
//
// This event trigger in 15 mins and allow my server to "remember" the shoppingCart _id: ('5a5dfd6c4879489ce958df0c')
// and let my server handle with to check if we need to remove this shopping cart
```

###### Schedules an event with collection, query and cron :

```javascript
const moment = require('moment');
const event  = {
  name: 'creditCardCheck',
  collection: 'users',
  query: {},
  cron: '0 0 23 * * *'
};
scheduler.schedule(event);
//
// This event is triggered daily at 23h00:00 and allows you to retrieve the list
// of credit cards that expires in a month. The server only has to send emails to users
```

###### Schedules an event with collection, query and cron with an end date :

```javascript
const moment = require('moment');
const event  = {
  name: 'creditCardCheck',
  collection: 'users',
  query: {},
  cron: '0 0 10 * * *',
  endDate: moment().add(5, 'years').toDate()
};
scheduler.schedule(event);
//
// This event is triggered daily at 10h00:00 and allows you to retrieve the list
// of credit cards that expires in a month. The server only has to send emails to users
```

---------------------------------------

## scheduleBulk()

_`scheduleBulk` method allows to create multiple events at one time (stored in MongoDB) that will trigger according to the conditions described below :_

###### Schedules the most basic event:

```javascript
const events = [{ 
  name: 'event-to-bulk', 
  after: moment().add(15, 'm').toDate()
}, {
  name: 'event-to-bulk',
  after: moment().add(25, 'm').toDate()
}, {
  name: 'event-to-bulk',
  after: moment().add(8, 'm').toDate()
}, {
  name: 'event-to-bulk',
  after: moment().add(66, 'm').toDate()
}, {
  name: 'event-to-bulk',
  after: moment().add(5000, 'm').toDate()
}, {
  name: 'event-to-bulk',
  data: 'this is hacked scheduler !!!',
  after: moment().add(5000, 'm').toDate()  // This event has the same name and after value, so it will update the event just above
}];

scheduler.scheduleBulk(events, (err, result) => {
  if (err) {
    console.error(err);
  }
});
// This event should trigger the "scheduler.on('event-to-bulk', callback);" 8 min, and in 15 min, and in 15 min, and in 66 min, and in 5000 min
```

If is your first scheduling event, it's create the `scheduled_events` collection with your first event stored.

You can also use the same event name multiple times, as long as the `id` and / or `after` is different, otherwise it will update the document stored in mongodb.

### Arguments

*   **Events [\<Object>]**

|Name       |Type                 |Description                                                                                                                                                                                                                                                        |Optional |
|:-         |:-                   |:-                                                                                                                                                                                                                                                                 |:-:      |
|name       |String               |Name of event that should be fired.                                                                                                                                                                                                                                |**false**|
|after      |Date                 |Time that the event should be triggered at, if left blank it will trigger the next time the scheduler polls.                                                                                                                                                       |true     |
|id         |ObjectId or String   |\_id field of the document this event corresponds to.                                                                                                                                                                                                              |true     |
|cron       |String               |**(Override 'after')**. A cron string representing a frequency this should fire on. Ex: `cron: '0 0 23 * * *'`, see: [cron-parser](https://www.npmjs.com/package/cron-parser).                                                                                     |true     |
|endDate    |Date                 |**(Only if the cron option is use)**.  Set a deadline to stop the infinite triggering of the cron option.                                                                                                                                                          |true     |
|collection |Object               |Name of the collection to use for the **query** parameter _(just below)_.                                                                                                                                                                                          |true     |
|query      |Object               |A MongoDB query expression to select document that this event should be triggered _(only if the `collection` property is set)_ for. Ex: `{ payement: true }`, see: [document-query-filter](https://docs.mongodb.com/manual/core/document/#document-query-filter).  |true     |
|data       |Object or Primitive  |Extra data to attach to the event.                                                                                                                                                                                                                                 |true     |

*   **callback \<Function>**

|Name   |Type             |Description                                                                  |Optional |
|:-     |:-               |:-                                                                           |:-:      |
|err    |String or Object |Tell you what wrong when the module try to create or update a schedule event |true     |
|result |Object           |The collection result callback.                                              |true     |

---------------------------------------

## scheduler.on

_`on` method allows to listen trigger events (stored in MongoDB) described below :_

###### Most basic event handler:

```javascript
function callback (event) {
  console.log(`This is my basicUsage event content: ${event}`);
}

scheduler.on('basicUsage', callback);
```

### Arguments

*   **name \<String>**

|Type   |Description            |Optional   |
|:-     |:-                     |:-:        |
|String |Name of listened event |**false**  |

*   **callback \<Function>**

|Name   |Type             |Description                                                                                      |Optional |
|:-     |:-               |:-                                                                                               |:-:      |
|event  |Object           |This is the original event stored into MongoDB when you use the `scheduler.schedule()` function  |true     |
|result |Object or Array  |If you use the properties `collection` and `query`, you get the result here                      |true     |

###### Event handler and data property:

```javascript
function callback (event) {
  console.log(`This is my timeToCheckLicenceKey event content: ${event}`);
  
  // Do what you whant with this datas
}

scheduler.on('timeToCheckLicenceKey', callback);
// This handler will be fired in one year and the event object contain the "data" property
```

###### Event handler with the id property:

```javascript
function callback (event) {
  console.log(`This is my abandonedShoppingCart event content: ${event}`);
  
  // Do what you whant with this datas
}

scheduler.on('abandonedShoppingCart', callback);
// This handler will be fired in 15 min and the event object contain the "id" property
```

###### Event handler with result:

```javascript
function callback (event, result) {
  console.log(`This is my creditCardCheck event content: ${event}`);
  console.log(`And this is the result of the query saved when the event is declared: ${result}`);
  
  // Do what you whant with this datas
}

scheduler.on('creditCardCheck', callback);
// Every days at 23h00:00, this event is trigger with the result query !
```

---------------------------------------

## scheduler.list

_`list` method allows to list all events (stored in MongoDB) :_

```javascript
const options = {};
scheduler.list(options, (err, events) => {
  // Do something with events, by default return by the date and time they were added to the db
});
```

### Arguments

*   **options \<Object>**

|Name       |Type  |Description                                                                                                                                                                   |Optional |
|:-         |:-    |:-                                                                                                                                                                            |:-:      |
|bySchedule |Bool  |Return list of events by schedule time _(after property)_                                                                                                                     |true     |
|asc        |Int   |**1** return ascendant schedule time. **-1** return descendant schedule time `Default: 1`                                                                                     |true     |
|query      |Object|Filter the results like with valid mongodb query. For more infos take a look [here](https://docs.mongodb.com/manual/reference/method/db.collection.find/#query-for-equality)  |true     |

*   **callback \<Function>**

|Name   |Type             |Description                                              |Optional |
|:-     |:-               |:-                                                       |:-:      |
|err    |String or Object |Tell you what wrong when the module try list all events  |true     |
|result |[Object]         |List of object                                           |true     |

---------------------------------------

## scheduler.findByName

_`findByName` method allows to get the first event by name (stored in MongoDB) :_

```javascript
scheduler.findByName({ name: 'abandonedShoppingCart' }, (err, event) => {
  // Do something with event
});
```
### Arguments

*   **name \<String>**

|Name |Type   |Description            |Optional   |
|:-   |:-     |:-                     |:-:        |
|name |String |Name of listened event |**false**  |

*   **callback \<Function>**

|Name   |Type             |Description                                                                                      |Optional |
|:-     |:-               |:-                                                                                               |:-:      |
|err    |String or Object |Tell you what wrong when the module try trigger the event                                        |true     |
|event  |Object           |This is the original event stored into MongoDB when you use the `scheduler.schedule()` function  |true     |

---------------------------------------

## scheduler.findByStorageId

_`findByStorageId` method allows to get the first event by id_

_ **/!\\** Be careful, this is not the id of the event itself, but the id stored in the id property (stored in MongoDB) :_

```javascript
const params = { id: '5a5dfd6c4879489ce958df0c', name: 'abandonedShoppingCart' };
scheduler.findByStorageId(params, (err, event) => {
  // Do something with event
});
```

### Arguments

*   **params \<Object>**

|Name |Type               |Description                                                        |Optional   |
|:-   |:-                 |:-                                                                 |:-:        |
|id   |ObjectId or String |The id searched _(remember, this id is not the event itself id)_   |**false**  |
|name |String             |Name of listened event                                             |true       |

*   **callback \<Function>**

|Name   |Type             |Description                                                                                      |Optional |
|:-     |:-               |:-                                                                                               |:-:      |
|event  |Object           |This is the original event stored into MongoDB when you use the `scheduler.schedule()` function  |true     |
|result |Object or Array  |If you use the properties `collection` and `query`, you get the result here.                     |true     |

---------------------------------------

## scheduler.remove

_`remove` method allows to remove events :_

```javascript
const params = { name: 'abandonedShoppingCart' };
scheduler.remove(params, (err, event) => {
  // Event has been removed
});
// Remove every events find with the name = 'abandonedShoppingCart'
```

### Arguments

*   **params \<Object>**

|Name     |Type               |Description                                                                        |Optional   |
|:-       |:-                 |:-                                                                                 |:-:        |
|name     |String             |Name of listened event                                                             |**false**  |
|id       |ObjectId or String |The id searched _(remember, this id is not the event itself id)_                   |true       |
|eventId  |ObjectId or String |This is the event id itself  _(you can use the 'list' method to get the event id)_ |true       |
|after    |Date               |Remove only the events who have the exacte same date                               |true       |

*   **callback \<Function>**

|Name   |Type             |Description                                                                                      |Optional |
|:-     |:-               |:-                                                                                               |:-:      |
|event  |Object           |This is the original event stored into MongoDB when you use the `scheduler.schedule()` function  |true     |
|result |Object or Array  |If you use the properties `collection` and `query`, you get the result here                      |true     |

---------------------------------------

## scheduler.purge

_`purge` method allows to remove ALL events :_

```javascript
const params = { force: true };
scheduler.purge(params, (err, event) => {
  // Event has been removed
});
// Remove every events
```

### Arguments

*   **params \<Object>**

|Name   |Type |Description                                                                        |Optional   |
|:-     |:-   |:-                                                                                 |:-:        |
|force  |Bool |It's a simple crazy guard, just not to delete all the events stored inadvertently  |**false**  |

*   **callback \<Function>**

|Name   |Type             |Description                                                                                      |Optional |
|:-     |:-               |:-                                                                                               |:-:      |
|event  |Object           |This is the original event stored into MongoDB when you use the `scheduler.schedule()` function  |true     |
|result |Object or Array  |If you use the properties `collection` and `query`, you get the result here                      |true     |

---------------------------------------

## scheduler.enable

_`enable` method allows to enable scheduler :_

```javascript
scheduler.enable();
```

---------------------------------------

## scheduler.disable

_`disable` method allows to disable scheduler :_

```javascript
scheduler.disable();
```

---------------------------------------

## scheduler.version

_`version` this method show the actual version of mongo-scheduler-more :_

```javascript
scheduler.version();
// Show in the console the actual version of mongo-scheduler-more
```

---------------------------------------

## Error handling
If the scheduler encounters an error it will emit an 'error' event. In this case the handler, will receive two arguments: the Error object, and the event doc (if applicable).

License
-------

MIT License
