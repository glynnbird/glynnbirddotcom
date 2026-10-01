---
title: Cloudant Fundamentals 6/10
pubDate: 2018-06-12T08:00:00.000Z
description: Programmatic CRUD
heroImage: ../../assets/max-nelson-492729-unsplash.jpg
---


In the previous two posts we saw how how the command-line tool `curl` is all that is required to do basic read and write operations with Cloudant, and how two API calls can be used for bulk commands.

In this post we'll look at equivalent tasks using programmatic means.

You don't _need_ a special library to work with Cloudant -  just something capbable of making HTTP requests. The libraries do help, however, with authentication and parameter encoding. There are four officially supported libraries for four programming languages:

- [Node.js](https://github.com/IBM/cloudant-node-sdk)
- [Python](https://github.com/IBM/cloudant-python-sdk)
- [Java](https://github.com/IBM/cloudant-java-sdk)
- [Go](https://github.com/IBM/cloudant-go-sdk)

For these examples I'm going to use the [Node.js](https://github.com/IBM/cloudant-node-sdk) library.

## Connect to the database

Let's set up our Cloudant credentials in environment variables:

```sh
# the URL of the Cloudant service
export CLOUDANT_URL='https://mycloudantservice.cloudant.com'
# the IAM API key
export CLOUDANT_APIKEY='myapikey'
```

Then we can include the library and get it set up:

```js
const { CloudantV1 } = require('@ibm-cloud/cloudant')
const client = CloudantV1.newInstance()
```

## Create a the database

Creating a database is as simple as calling the `putDatabase` function:

```js
await client.putDatabase({
  db: 'mydatabasename',
  partitioned: false
})
// { ok: true }
```

## Creating documents

Let's say we want to add an array of documents to our database:

```js
const docs = [
    {"name": "Ferris Bueller", "actor": "Matthew Broderick", "dob": "1962-03-21"},
    {"name": "Sloane Peterson", "actor": "Mia Sara", "dob": "1967-06-19"},
    {"name": "Cameron Frye", "actor": "Alan Ruck", "dob": "1956-07-01"}
 ] 
```

The `insert` document can be used to write them to the database:

```js
await client.postBulkDocs({
  db: 'mydatabasename',
  bulkDocs: { docs: docs }
})
// [ { id: 'a', ok: true, rev: '1-123'}, { id: 'b', ok: true, rev: '1-456'}]
```

The same goes for single documents:

```js
const newdoc = { name: "Ed Rooney", actor: "Jeffrey Jones", dob: "1946-09-28"}
await client.postDocument({
  db: 'mydatabasename',
  document: newdoc
})
// { ok: true, id: '95b51f94118ae', rev: '1-678' }
```

## Reading documents

Documents can be read back singly by specifying the id of the document you want:

```js
await client.getDocument({
  db: 'mydatabasename',
  docId: '95b51f94118ae2d852393c63edacf462'
})
// { _id: '95b51f94118ae2d852393c63edacf462',
//  name: 'Ed Rooney',
//  actor: 'Jeffrey Jones',
//  dob: '1946-09-28' }
```

You may also fetch a list of ids:

```js
const ids = ['95b51f94118ae2d852393c63edacf462', 'c30959f23a9feb3abbfd40e7e848fde4']
await client.postAllDocs({
  db: 'mydatabasename',
  includeDocs: true,
  keys: ids
})
// [ {...}, {...} ]
```

or ask for all the documents:

```js
await client.postAllDocs({
  db: 'mydatabasename',
  includeDocs: true
})
```

## Updating documents

The Node.js library allows documents to be updated by passing a document with its last revision (`_rev`) in place:

```js
const modifiedDoc = { 
  _id: "95b51f94118ae2d852393c63edacf462",
  _rev: '1-678'
  name: "Edward Rooney", 
  actor: "Jeffrey Duncan Jones",
  residence: "Los Angeles, CA",
  dob: "1946-09-28"
}
await client.postDocument({
  db: 'mydatabasename',
  document: modifiedDoc
})
// { ok: true, rev: '2-456' }
```

## Deleting a document

A documents can be removed from the database by passing an id `delete` function:

```js
await client.deleteDocument({
  db: 'mydatabasename',
  docId: '95b51f94118ae2d852393c63edacf462',
  rev: '2-456'
})
// { ok: true, rev: '3-789' }
```

## Next time

In the next post we'll look at querying data.
