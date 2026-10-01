---
title: "Changes Follower"
description: Following a changes feed with Cloudant SDKs
pubDate: 2023-09-20T00:00:00Z
heroImage: ../../assets/ben-pattinson-_Wo1Oq38tVU-unsplash.jpg
---

Cloudant's changes feed is an API that allows a client to consume a list of changes from a single Cloudant database for the purposes of:

- Copying data to other systems such as:
  - A backup.
  - Copying data to another data store.
- Triggering events, such as running scripts, sending emails etc.

The official, suported Cloudant SDKs for [Node.js](https://github.com/IBM/cloudant-node-sdk), [Java](https://github.com/IBM/cloudant-java-sdk), [Go](https://github.com/IBM/cloudant-go-sdk) and [Python](https://github.com/IBM/cloudant-python-sdk) have always had support for the raw changes API, but have now added "Beta" support for a new _Changes Follower_ - a simpler means of consuming changes.

In this blog post will look at why it's best to use the new Changes Follower feature instead of the lower-level operations and show some sample Node.js code for streaming Cloudant's changes. 

## Why use the Changes Follower?

The Cloudant changes feed is complicated, with many options that are difficult to understand and fiddly to use. The Changes Follower provides a simple mechanism for subscribing to a databases changes feed, calling your code when a change arrives. It demystifies the raw Changes Feed API, chaining multiple API calls in sequence if necessary, handling retries and passing changes to your code when a change is received. It is still configurable for the popular options e.g `includeDocs=true` but omits some of the lesser-known features in the spirit of simplicity.

It follows the idioms of the host programming language e.g. stream pipelines for Node.js, Java Streams, Go channels and Python iterators.

## The Cloudant change feed - caveat emptor.

The Changes Feed is designed for use in Cloudant's replication process and it is often misunderstood. In short:

- It delivers changes at least once: not _only once_. This means that the consumer must treat each change _idempotently_.
- Although changes to the database are often delivered to the changes feed quickly, there is no real-time guarantee.
- Not all individual document changes may appear in the changes feed - i.e. intermediate changes to a document may be omitted if superceded, between calls to the changes API.
- The changes feed is not time-ordered.

If your applicaton can cope with these limitations, and not all can, then continue to read to see how the Changes Follower models continuous and on-off changes feeds.

## Using the Changes Follower

> Note the following code examples require a Node.js project with the latest [@ibm-cloud/cloudant](https://www.npmjs.com/package/@ibm-cloud/cloudant) installed with the `"type":"module"` flag set in `package.json`. The second example additionally requires the [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) module to be installed. 

At its simplest, the Changes Follower can be set up like so:

```js
import { ChangesFollower, CloudantV1 } from '@ibm-cloud/cloudant'
import { Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const main = async () => {

  // create a cloudant-node-sdk client - configuration via env variables
  const client = CloudantV1.newInstance({})

  // create a ChangesFollower, starting from the beginning of the
  // database's changes feed with the document body included.
  const changesParams = {
    db: process.env.CLOUDANT_DATABASE, // the database to monitor
    since: '0', // the sequence token defining where in the changes feed to begin
    includeDocs: true // return full document bodies with the change
  }
  const changesFollower = new ChangesFollower(client, changesParams)

  // start the changes feed - which generates a stream of changes
  // the `start` function runs "forever", whereas `startOneOff` runs
  // until no more changes are found.
  const changesItemsStream = changesFollower.start()

  // Create a writable stream to handle the stream of changes.
  // The 'write' function is called once for each change. Its
  // 'callback' function is called when processing is complete,
  // a mechansim used for flow control in the pipeline.
  const destinationStream = new Writable({
    objectMode: true,
    write(changesItem, _, callback) {
      // do something with change item, in this case log the change
      console.log(changesItem)

      // call back to say we're done processing this change
      callback()
    }
  })
  
  // create a simple pipeline, connecting the changes feed stream
  // to our writable stream. The pipeline returns a promise which
  // resolves when all the changes are consumed, or rejects on an
  // error condition. As we started the Changes Follower with a
  // call to `start()`, then this promise will never resolve.
  pipeline(changesItemsStream, destinationStream)
    .then(() => {
      console.log('Stopped')
    })
    .catch((err) => {
      console.log(err)
    })
}

main()
```

Our custom change handler is in the `Writable.write` function. The Writable stream is plumbed into a pipeline, connecting it to the Changes Follower's stream of changes, with the `write` function being called once per change in the changes feed. The `write` function calls _its_ `callback` when it has finished processing the change - allowing the pipeline to manage "back pressure" in the pipeline.

As the code uses the `start` function (as opposed to `startOneOff`), the script will run "forever" (or at least until programmatically [stopped](https://github.com/IBM/cloudant-node-sdk#stopping-the-changes-follower)) - that is the pipeline's Promise will never resolve.

## Using SQLite to store the changes

The first example simply writes the change to stdout, but we could be more ambitious. The following example writes each change to a SQLite database:

```js
import { ChangesFollower, CloudantV1 } from '@ibm-cloud/cloudant'
import { Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import Database from 'better-sqlite3'

// create a SQLite database
const db = new Database('changes.sqlite3')
db.pragma('journal_mode = WAL')

// create a SQLite table
const createTable = () => {
  const sql = 'CREATE TABLE IF NOT EXISTS changes (id TEXT UNIQUE, change TEXT, handled INTEGER)'
  const stmt = db.prepare(sql)
  stmt.run()
}

// insert a change into SQLite
const insertChange = (id, change) => {
  console.log('writing change', id)
  const sql = 'INSERT INTO changes (id,change,handled) VALUES (?,?,?)'
  const stmt = db.prepare(sql)
  stmt.run(id, change, 0)
}

const main = async () => {

  // create SQLite table
  await createTable()

  // create a cloudant-node-sdk client - configuration via env variables
  const client = CloudantV1.newInstance({})

  // create a ChangesFollower, starting from the beginning of the
  // database's changes feed with the document body included.
  const changesParams = {
    db: process.env.CLOUDANT_DATABASE,
    since: '0',
    includeDocs: true
  }
  const changesFollower = new ChangesFollower(client, changesParams)

  // start the changes feed - which generates a stream of changes
  const changesItemsStream = changesFollower.startOneOff()

  // create a writable stream to handle stream of changes
  const destinationStream = new Writable({
    objectMode: true,
    write(changesItem, _, callback) {
      // make a key field from the doc's id and rev
      const id = `${changesItem.doc._id}:${changesItem.doc._rev}`
      const doc = JSON.stringify(changesItem.doc)
      try {
        // write a row to SQLite
        insertChange(id, doc)
      } catch {
        // the SQLite query failed - perhaps because the same change is attempting to be
        // written again. This is not an error we need worry about.
      }
      callback()
    }
  })
  
  // create a pipeline 
  pipeline(changesItemsStream, destinationStream)
    .then(() => {
      console.log('Stopped')
    })
    .catch((err) => {
      console.log(err)
    })
}

main()
```

> Note: this example uses the `startOneOff` function instead of the first example's `start` function, which will terminate the pipeline, by resolving the Promise, when there are no more changes to consume.

Each change is written to a SQLite table called `changes`. We can query the table with the `sqlite3` command-line tool:

```sh
sqlite3 changes.sqlite3
sqlite> SELECT * from changes LIMIT 2;
982899:1-0c73e9359a600f6b0a6874d852e9f57b|{"_id":"982899","_rev":"1-0c73e9359a600f6b0a6874d852e9f57b","name":"Lichtenburg","latitude":-26.152,"longitude":26.15968,"country":"ZA","population":65863,"timezone":"Africa/Johannesburg"}|0
757718:1-7d4428c4542495c5c8029e71f8121fd8|{"_id":"757718","_rev":"1-7d4428c4542495c5c8029e71f8121fd8","name":"Suwałki","latitude":54.11175,"longitude":22.93087,"country":"PL","population":69222,"timezone":"Europe/Warsaw"}|0
```

Our unique `id` field contains the document's `_id` and `_rev` pairs, so that if the same change arrives more than once it won't create a duplicate row in SQLite. Each row also contains the document's body and a flag indicating whether we've dealt with the change yet.

This is one way of dealing with changes _idempotently_ - storing additional state to record whether a change has been handled or not.

## Batch operations

If we need to deal with changes in batches, using a batch size of our choosing, then we need to group individual change events into batches in our code. We can make a more complex Node.js streams pipeline to achieve this:

```goat
  .---------------.    .---------.    .---------.     .--------. 
  | ChangesStream +--->| Batcher +--->| Handler +---->| stdout |
  '---------------'    '---------'    '---------'     '--------'
```

- `Batcher` takes individual changes from the Changes Follower and groups them into batches of 500 which are sent to the `Handler` in bulk. The last batch may be smaller than the rest, if the number of changes isn't divisible by 500!
- `Handler` expects arrays of changes. This is where your custom batch processing code would go. `Handler` outputs any text that needs to arrive at stdout.

```js
import { ChangesFollower, CloudantV1 } from '@ibm-cloud/cloudant'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const main = async () => {

  // create a cloudant-node-sdk client - configuration via env variables
  const client = CloudantV1.newInstance({})

  // create a ChangesFollower, starting from the beginning of the
  // database's changes feed with the document body included.
  const changesParams = {
    db: process.env.CLOUDANT_DATABASE,
    since: '0',
    includeDocs: true
  }
  const changesFollower = new ChangesFollower(client, changesParams)

  // start the changes feed - which generates a stream of changes
  const changesItemsStream = changesFollower.startOneOff()

  // state for the batcher
  const batch = []
  const BATCH_SIZE = 500

  // a Node.js stream transformer that takes a stream of individual
  // changes and groups them into batches of BATCH_SIZE except the
  // last batch which may be smaller.
  const batcher = new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform(obj, _, callback) {
      // push the change into our batch array
      batch.push(obj)
      // if we have at least a full batch
      if (batch.length >= BATCH_SIZE) {
        // send a full batch to the next thing in the pipeline
        this.push(batch.splice(0, BATCH_SIZE))
      }
      callback()
    },
    flush(callback) {
      // handle the any remaining buffered data
      if (batch.length > 0) {
        // send anything left as a final batch
        this.push(batch)
      }
      callback()
    }
  })

  // another stream transformer that expects batches of data.
  // It processes the batch of data and calls 'callback' when 
  // its done. Any data it pushes to the next thing in pipeline
  // must be text because the next thing is process.stdout!
  const handler = new Transform({
    writableObjectMode: true,
    transform(batch, _, callback) {
      // your custom code goes here
      // do something with batch - an array of changes
      this.push(`process batch size ${batch.length}\n`)
      callback()
    }
  })

  // create a simple pipeling
  // changes->batcher->handler->stdout
  pipeline(
    changesItemsStream,
    batcher,
    handler,
    process.stdout)
    .then(() => {
      console.log('Stopped')
    })
    .catch((err) => {
      console.log(err)
    })
}

main()
```

## Filtered changes

If we wish to only see changes matching a supplied Cloudant Query "selector", we can do so by setting additional attributes in the `changesParams` object:

```js
const changesParams = {
  db: process.env.CLOUDANT_DATABASE,
  since: '0',
  includeDocs: true,
  filter: '_selector', // use a selector
  selector: {          // the Cloudant Query selector used to filter the feed
    '$or': [
      { country: { '$eq': 'ZA'} },
      { population: { '$gte': 100000} }
    ]
  }
}
```

- `filter: _selector` indicates that we want Cloudant to apply a Cloudant Query selector filter to the changes feed.
- `selector` is our Cloudant Query selector. If a change matches this selctor it will be included in the changes feed. See [Cloudant Query selector syntax](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-selector-syntax).

> Note: the filter is executed on the Cloudant-side, so less information is transferred over the wire to the application. 

## The sequence token

The Changes Follower will automatically handle the periodic polling of the changes feed, but it is the application's responsibility to store the changes feed `seq` value and pass it into the Change Follower if it is to restarted, and resume from where it left off. The latest sequence token can be found in every change object (unless a `seq_interval` parameter was set):

```js
let  lastSeq = '0'

// create a writable stream to handle stream of changes
const destinationStream = new Writable({
  objectMode: true,
  write(changesItem, _, callback) {

    // extract the latest sequence token
    lastSeq = changesItem.seq
    // store lastSeq if needed here

    // call back to say we're done processing this change
    callback()
  }
})
```

To start the Changes Follower from a known sequence token:

```js
// load the last sequence token that was stored
const since = // YOUR CODE GOES HERE to retrieve a known seq value

// create a ChangesFollower, starting from the beginning of the
// database's changes feed with the document body included.
const changesParams = {
  db: process.env.CLOUDANT_DATABASE,
  since
}
const changesFollower = new ChangesFollower(client, changesParams)
```

## Other programming languages

Code samples and additional configuration options are available in each SDKs' READMEs:

- [Node.js](https://github.com/IBM/cloudant-node-sdk#changes-feed-follower-beta)
- [Java](https://github.com/IBM/cloudant-java-sdk#changes-feed-follower-beta)
- [Go](https://github.com/IBM/cloudant-go-sdk#changes-feed-follower-beta)
- [Python](https://github.com/IBM/cloudant-python-sdk#changes-feed-follower-beta)

## Beta

> Note the Changes Follower is marked "beta" software. It may be subject to change and should be used with care in production environments. If you have an issue with any of the SDKs, please raise an issue on the respective project's GitHub page.
