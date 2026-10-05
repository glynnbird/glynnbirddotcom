---
title: Partitioned Databases and Node.js
pubDate: 2019-05-24T06:00:00.000Z
description: Using Partitioned Databases with the Node.js library.
heroImage: ../../assets/amelie-ohlrogge-1503757-unsplash.jpg
relCanonical: https://blog.cloudant.com/2019/05/24/Partitioned-Databases-with-Cloudant-Libraries.html
---


The Cloudant database has four supported client libraries: [Node.js](https://github.com/IBM/cloudant-node-sdk), [Java](https://github.com/IBM/cloudant-java-sdk), [Go](https://github.com/IBM/cloudant-go-sdk)and  [Python](https://github.com/IBM/cloudant-python-sdk). In this post, we'll see examples on how the Node.js library can be used with the new Partition Databases feature.


Here's a table of all the functions we'll be using:

| Operation                         | Raw API Call                                                | Node.js function call |
|-----------------------------------|-------------------------------------------------------------|-----------------------|
| Create database                   | `PUT /db?partitioned=true`                                    | `client.putDatabase`             |
| Add document          | `POST /db`  | `client.postDocument` |
| Get document          | `GET /db/<id>` | `client.getDocument` |
| Get info                          | `GET /db/<partition_key>`                                    | `client.getPartitionInformation`      |
| Get all docs                      | `POST /db/<partition_key>/_all_docs`                          | `client.postPartitionAllDocs`    |
| Create Cloudant Query (CQ) Index  | `POST /db/_index`                                              | `client.postIndex`              |
| Query CQ Index                    | `POST /db/<partition_key>/_find`                               | `client.postPartitionFind`    |
| Create Cloudant Search (CS) Index | `PUT /db/<design_doc_name>`                                   | `client.putDesignDocument`             |
| Query CS Index                    | `POST /db/<partition_key>/_design/<ddoc>/_search/<search_name>` | `client.postPartitionSearch`  |
| Create MapReduce (MR) Index       | `PUT /db/<design_doc_name>`                                   | `client.putDesignDocument`            |
| Query MR Index                    | `POST /db/<partition_key>/_design/<ddoc>/_view/<view_name>`   | `client.postPartitionView`    |

Let's set up our Cloudant credentials in environment variables:

```sh
# the URL of the Cloudant service
export CLOUDANT_URL='https://mycloudantservice.cloudant.com'
# the IAM API key
export CLOUDANT_APIKEY='myapikey'
```

All of the following code snippets sit in the `main` function in the code below: 

```js
const { CloudantV1 } = require('@ibm-cloud/cloudant')
const client = CloudantV1.newInstance()

const main = async () => {
  // code snippet goes here
}

main()
```

Remember to replace the Cloudant credentials with your own.

## Create database

To create a partitioned database, simply add the `{ partitioned: true }` object as the second parameter to `create`:

```js
await client.putDatabase({
  db: 'mypartitioneddb',
  partitioned: true
})
// { ok: true }
```

## Insert data into a partition

No special functions are required to add data, just remember to supply a two part `_id` field - `<partition_key>:<document_key>`:

```js
// document to add - notice the two-part _id
const doc = { _id: 'canidae:dog', name: 'Dog', latin: 'Canis lupus familiaris' }

// insert the document
await client.putDocument({
  db: 'mypartitioneddb',
  document: doc
})
// { "ok": true, "id": "canidae:dog", "rev": "1-3a4c4c5d65709bcb3ec675ec895d4051" }
```

## Fetch document by _id from a partition

Again, no special functions required here. Just use `getDocument` to pull back a single document by its `_id`:

```js
// fetch a document by its id
await client.getDocument({
  db: 'mypartitioneddb',
  docId: 'canidae:dog'
})
// { _id: 'canidae:dog', _rev: '1-3a4c4c5d65709bcb3ec675ec895d4051', name: 'Dog', latin: 'Canis lupus familiaris' }
```


## Get Partition Info

To fetch the information about a single partition, use the `partitionInfo` function and pass a partition key:

```js
// get partition information from the 'canidae' partition
await client.getPartitionInformation({
  db: 'mypartitioneddb',
  partitionKey: 'canidae'
})
// {"db_name":"myhost-bluemix/mypartitioneddb","sizes":{"active":392,"external":332},"partition":"canidae","doc_count":4,"doc_del_count":0}
```

## Get all documents from a partition

To fetch all of the documents from a partition, use the `partitionedList` function:

```js
// fetch all documents in the 'canidae' partition, returning document bodies too.
await client.postPartitionAllDocs({
  db: 'mypartitioneddb',
  partitionKey: 'canidae', 
  includeDocs: true
})
// { "total_rows": 4, "offset": 0, "rows": [ ... ] }
```

## Partitioned Cloudant Query

### Create a partitioned index

To [create an index](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query#creating-an-index) that is partitioned, ensure that the `partitioned: true` field is set when calling the `postIndex` function, to instruct Cloudant to create a partitioned query, instead of a global one:

```js
// index definition
const indexDef = {
  fields: ['name']
}
// instruct Cloudant to create the index
await client.postIndex({
  db: 'mypartitioneddb',
  ddoc: 'mydesigndoc',
  name: 'byName',
  type: 'json',
  index: indexDef,
  partitioned: true
})
// { result: 'created', id: '_design/mydesigndoc', name: 'byName' }
```

### Find within a partition

To perform a [Cloudant Query](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query) in a single partition, use the `partitionedFind` (or `partitionedFindAsStream`) function:

```js
// find document whose name is 'wolf' in the 'canidae' partition
await client.postPartitionFind({
  db: 'mypartitioneddb',
  partitionKey: 'canidae',
  selector: { 'name': 'Wolf' }
})
// { "docs": [ ... ], "bookmark": "..." }  
```

## Partitioned Search

### Create a partitioned search index

To create [Cloudant Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search) index that is partitioned, write a [Design Document](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-design-documents) to the database containing the index definition. Use `options.partitioned = true` to specify that this is a partitioned index:

```js
// the search definition
const func = function(doc) {
  index('name', doc.name)
  index('latin', doc.latin)
}

// the design document containing the search definition function
const ddoc = {
  indexes: {
    searchindex: {
      index: func.toString()
    }
  },
  options: {
    partitioned: true
  }
}
await client.putDesignDocument({
  db: 'mypartitioneddb',
  designDocument: ddoc,
  ddoc: 'searchddoc'
})
// { ok: true, id: '_design/searchddoc', rev: '1-e7257e575d666ca062b4fe0bdeb6fba1' }
```

### Search within a partition

To perform a [Cloudant Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search) against a pre-existing Cloudant search index, use the `partitionedSearch` function:

```js

await client.postPartitionSearch({
  db: 'mypartitioneddb',
  partitionKey: 'canidae',
  ddoc: 'searchddoc',
  index: 'searchindex',
  query: 'name:\'Wolf\''
})
// { total_rows: ... , bookmark: ..., rows: [ ...] }
```

## MapReduce Views

## Creating a partitioned MapReduce view

To create a MapReduce view, ensure the `options.partitioned` flag is set to `true` to indicate to Cloudant that this is a partitioned rather than a global view:

```js
const func = function(doc) {
  emit(doc.family, doc.weight)
}

// Design Document
const ddoc = {
  views: {
    familyweight: {
      map: func.toString(),
      reduce: '_sum'
    }
  },
  options: {
    partitioned: true
  }
}

// create design document
await client.putDesignDocument({
  db: 'mypartitioneddb',
  designDocument: ddoc,
  ddoc: 'viewddoc'
})
// { ok: true, id: '_design/viewddoc', rev: '1-a062b4fe0bdeb6fbe7257e575d666ca1' }
```

## Querying a partitioned MapReduce view

To direct a query to a pre-existing partitioned MapReduce view, use the `partitionedView` (or `partitionedViewAsStream`) function:

```js
const params = {}
await client.postPartitionView({
  db: 'mypartitioneddb',
  ddoc: 'viewddoc',
  includeDocs: true,
  limit: 10,
  partitionKey: 'canidae',
  view: 'familyweight'
})
// { rows: [ { key: ... , value: [Object] } ] }
```

## Global indexes

A partitioned database may still have *global* Cloudant Query, Cloudant Search and MapReduce indexes. Create the indexes as normal but be sure to supply `false` as the `partitioned` flag, to indicate you need a global index. Then query your index as normal using `client.postFind`, `client.postSearch` or `client.postView`.
