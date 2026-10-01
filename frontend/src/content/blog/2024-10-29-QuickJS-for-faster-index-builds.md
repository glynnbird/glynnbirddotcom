---
title: "QuickJS for Faster Index Builds"
description: A new JavaScript engine that's smaller and faster.
pubDate: 2024-10-29T00:00:00Z
heroImage: ../../assets/robin-pierre-dPgPoiUIiXk-unsplash.jpg
---

Cloudant's MapReduce and Search indexes are created by defining JavaScript functions which are executed on every live document: the data emitted from those functions is then saved to the index e.g.

```js
// a typical map function
function(doc) {
  if (doc.type === 'order' && doc.status !== 'cancelled') {
    const date = new Date(doc.date)
    emit([doc.customerId.toLowerCase(), date.getFullYear(), date.getMonth() + 1], Math.floor(doc.orderValue * 100))
  }
}
```

- JavaScript's logic ensures that only `order` document types that are not `cancelled` make it to the index.
- `customerId` is lower-cased prior to indexing
- the document's `date` field is broken into year/month values for the index using JavaScript's Date class.
- the order's value in whole _cents_ is used in the index, even though it is stored in _dollars_ in the document.

JavaScript is adding value by allowing data to be selected and massaged prior to indexing, but this comes at a cost. Cloudant has to run a JavaScript engine to process each document body in turn during indexing. Cloudant is written in Erlang so a separate JavaScript process is spun up and fed data outside the Erlang environment.

Cloudant and its open-source sibling Apache CouchDB have until recently used the [SpiderMonkey](https://spidermonkey.dev/) JavaScript engine to perform this task - SpiderMonkey was written to provide JavaScript facilities to the Firefox web browser. 

As of Apache CouchDB's 3.4 release and in Cloudant from October 2024 onwards, a new JavaScript engine is introduced which will eventually replace SpiderMonkey in CouchDB/Cloudant.

## Introducing QuickJS
 
[QuickJS][1] is a small lightweight JavaScript engine with a tiny codebase which is designed to be embedded into other systems that need JavaScript support - ideal for CouchDB/Cloudant's usage!

> In future releases of Cloudant, QuickJS will replace SpiderMonkey as the default JavaScript engine. No user action will be required - the switchover will be seamless. 

We're not at that stage yet, but QuickJS is available as an option _today_ in Cloudant.

It is unlocked by adding an `language` attribute to new indexes you create:

```json
{
  "_id": "/design/myddoc",
  "views": {
    "ordersByCustomer": {
      "map": "function(doc) {\n  if (doc.type === 'order' && doc.status !== 'cancelled') {\n    const date = new Date(doc.date)\n    emit([doc.customerId.toLowerCase(), doc.getFullYear(), doc.getMonth() + 1], Math.floor(doc.orderValue * 100))\n  }\n}",
      "reduce": "_count"
    }
  },
  "language": "javascript_quickjs"
}
```

The `language` attribute instructs Cloudant to build the index with QuickJS instead of the current default, SpiderMonkey engine. The feature is enabled as an option today so that application developers can experiment with QuickJS-built views before it goes mainstream.

> Do not add `"language": "javascript_quickjs"` to your existing design documents as the change in the design document will force Cloudant to rebuild all of its indexes from scratch, so the resultant views will be unavailable until that process completes. The more data in the host database, the longer the index build time. Only use `language` to explore the advantages of QuickJS - when QuickJS becomes the default, no `language` attribute will be required to enable it.

## Benefits of QuickJS

QuickJS is smaller and lighter than SpiderMonkey meaning that it is quicker to invoke during indexing and uses less memory in doing so. It's advantages are clear:

- It is 4x to 5x faster at building indexes than SpiderMonkey.
- It only uses from 10% to 16% of the memory that SpiderMonkey does, freeing up memory for other uses in a Cloudant cluster.
- It is easier to configure in embedded environments such that running one customer's JavaScript code is completely isolated from another's.
- A JavaScript process is locked down so that it cannot access restricted resources such as local disk and network devices.

In short, with QuickJS your MapReduce views and Cloudant Search indexes could build significantly faster than with SpiderMonkey. For databases with very large document counts this can shave days and weeks from index build times!

> Note: Cloudant Query indexes which are defined in design documents but do not use JavaScript functions are not affected by this change - they're already quick to build as the index build is performed in Erlang in the database's core code.

## Differences in JavaScript versions

The JavaScript language is a movable feast and there can be subtle differences between JavaScript engines and even between different versions of the same engine.

In Cloudant's analysis of the JavaScript our customers have provided as index-building functions, we've found the vast majority of JavaScript functions execute identically on SpiderMonkey & QuickJS, but the odd differences are listed below:

1. Avoid using `for each(var i in array) { }` - this was supported in SpiderMonkey 1.8.5 but not later versions and not in QuickJS. Instead, use `for (var i in array) { }`.
2. Do not use [E4X](https://en.wikipedia.org/wiki/ECMAScript_for_XML), the XML extension for JavaScript. e.g. `var xml = <body><p></p></body>`. This is not supported QuickJS or later versions of SpiderMonkey.
3. Avoid string locale conversion. Store dates as numeric timestamps or ISO-8601 strings in the UTC timezone and emit these values in indexes - perform local conversion further up the application stack.
4. Provide only a single `function(doc) { ... }` string as a view's `map` key. Other information outside to the function scope is ignored.
5. Don't rely on the order of keys in Objects.
6. `String.match(undefined)` returns `null` on older SpiderMonkey engines and `[""]` in newer engines.
7. `Date.toISOString()` would return "Invalid Date" for an invalid date object on older Spider Monkey engines but now throws an exception.

The general advice is:

- Keep JavaScript functions simple: basic `if/else` logic, some defensive coding and some string and date manipulation is all that is usually needed.
- Remember that if a JavaScript invocation crashes (e.g. if you try to access a document attribute that isn't there) then **no keys will make it to the index for that document id**.
- Test your JavaScript functions before sending them to Cloudant - Cloudant's JavaScript is executed asynchronously on our servers, and we don't provide debugging logs for each invocation. Make sure your functions execute as expected for the range of `doc` objects they can expect to receive by exercising your code in your own automated testing environment.

## Running QuickJS locally

[QuickJS][1] can be downloaded and executed locally, so it is very simple to build a harness to test your JavaScript with a variety of inputs. This can be scripted into your Continuous Integration flow so that you can be sure that the JavaScript you are sending to Cloudant will behave as expected.

Below is a simple test harness that feeds a single document to a map function under test:

```js
// this is the map function to be tested
// - for non-user types it does nothing
// - for users it emits one ['user', name] key and many ['team', team] keys
const map = function (doc) {
  if (doc.type !== 'user') {
    return
  }
  // create one key per user
  emit(['user', doc.name], doc.email)

  // and many keys per user's team
  for (let i = 0; i < doc.teams.length; i++) {
    emit(['team', doc.teams[i]], doc.name)
  }
}

// this is the document we are using to test the map function with
const doc = {
  _id: 'abc123',
  _rev: '1-xyz',
  type: 'user',
  name: 'Bob Smith',
  email: 'bob@aol.com',
  teams: ['admin', 'user', 'manager'],
  date: new Date().toISOString()
}

// a dummy "emit" function that captures and logs the key/value pairs
// produced by the map function
const emit = function (key, value) {
  console.log(JSON.stringify({ key, value }))
}

// call our function with the sample doc. Output to stdout
map(doc)
```

With QuickJS installed, we can run the above script with:

```sh
> qjs test.js
{"key":["user","Bob Smith"],"value":"bob@aol.com"}
{"key":["team","admin"],"value":"Bob Smith"}
{"key":["team","user"],"value":"Bob Smith"}
{"key":["team","manager"],"value":"Bob Smith"}
```

where the output is one object per emitted key/value from our map function.

[1]: https://bellard.org/quickjs/
