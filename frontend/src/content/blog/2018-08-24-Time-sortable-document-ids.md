---
title: Time-sortable _ids
pubDate: 2018-08-24T06:00:00.000Z
description: Making _ids unique and time-sortable
heroImage: ../../assets/jeff-frenette-635397-unsplash.jpg
relCanonical: https://blog.cloudant.com/2018/08/24/Time-sortable-document-ids.html
---

A Cloudant database document's `_id` field has to be unique. When you create a document and leave the `_id` field blank, the database will create one for you:

```sh
curl -X POST \ 
     -d'{"x":1}' \
     -H 'Content-type: application/json' 
     "https://USERNAME:PASSWORD@HOST.cloudant.com/mydb"
{"ok":true,"id":"97728a06c27d1e11378cd43635c98c1e","rev":"1-0785e9eb543380151003dc452c3a001a"}
```

Cloudant's generated `_id` fields are 32 characters long and made entirely of numerals and lowercase letters. They are unique, or at least have a negligible probability of clashing, by virtue of being a long pseudo-random string of characters. 

Alternatively, you may supply your own `_id` field which is useful when your app knows something unique about your domain's data:

```sh
curl -X POST \
     -d'{"_id":"user:glynn","x":1}' \
     -H 'Content-type: application/json' \
     "https://USERNAME:PASSWORD@HOST.cloudant.com/mydb"
{"ok":true,"id":"user:glynn","rev":"1-0785e9eb543380151003dc452c3a001a"}
```

In this case I'm using the `_id` to store both the *type* of the document ("user") and something unique about each user I'm storing ("glynn") in the same portmanteau `_id`.

## Making a sortable _id field

In some applications it would be useful for the `_id` field to sort into date/time order. The `_id` is used to create the database's *primary index* which is used to fetch documents by their id (`GET /db/id`) and when selecting ranges of documents (`GET /db/_all_docs`). If a database's `_id` fields sorted into time order, I could extract data by time without having to create a secondary index e.g. I could fetch the 100 most recently added documents to a database by simply querying the primary index:

```sh
curl "https://USERNAME:PASSWORD@HOST.cloudant.com/mydb/_all_docs?descending=true&limit=100"
```

All I need is an `_id` scheme that can generate ids that are both unique in the database and yet sort into date/time order. 

One solution is published in the [kuuid](https://www.npmjs.com/package/kuuid) Node.js library I wrote for just this purpose. Simply use `kuuid.id()` to generate your `_id` values:

```js
// import the library
const kuuid = require('kuuid')

// build up a new document using kuuid as the document's _id
let doc = {
  _id: kuuid.id(),
  name: 'Glynn',
  location: 'UK',
  verified: true
}

// insert into the database
db.insert(doc)
```

which creates a document that looks like this:

```js
{
   _id: '0001AKY50w6w4833bGxL26pDWU4UFhTX',
  name: 'Glynn',
  location: 'UK',
  verified: true 
}
```

## How do sortable ids work?

A `kuuid`-generated id consists of 32 characters made up of numbers and upper case & lower case letters. It is split into two sections:

![kuuid](../../assets/kuuid.png)

1. the first eight characters contain the date/time, stored as the number of seconds since the 1st of January 1970.
2. the remaining twenty four characters are 128 bits of random data.

Both pieces of information are encoded in "base 62", allowing more information to be packed into the same number of characters by using a case-sensitive character set.

Two ids generated in the same second will have the same first eight characters, but the chances of the remaining 24 characters clashing are vanishingly remote. 

The documents will be sorted in the database's primary index in *rough* date order, that is with a precision of one second.

By judicious use of the [GET /db/_all_docs](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-get-documents) and use of the `startkey`/`endkey`/`descending` parameters, the database's primary index can be queried to provide ranges of documents by type in approximate time order. The `kuuid` library provides a `prefix` function that calculates the 8-digit for string that correseponds to a user-supplied date or timestamp:

```js
// get data between 1st & 15th Feb 2018
const kuuid = require('kuuid')
const startDate = '2018-02-01T00:00:00.000Z' // 1st Feb 2018
const endDate = '2018-02-15T00:00:00.000Z' // 15th Feb 2018
const k1 = kuuid.prefix(startDate)
const k2 = kuuid.prefix(endDate)
db.list({ startkey: k1, endkey: k2 }).then(console.log)

// get data from 12:30 on 30th Nov 2017 to now, newest first
const date = '2017-11-30T12:30:00.000Z' 
const k3 = kuuid.prefix(date)
db.list({ endkey: k3, descending: true }).then(console.log)
```

This form of querying is a little convoluted, but if your ids are going to be 32-character random strings, it seems useful to make them loosely time-ordered just to be able to quickly establish the documents that were added recently, if nothing else.

## Combining a kuuid and a document type

Optionally, we could still keep the convention of storing the document *type* in the `_id` field too:

```js
let doc = {
  _id: 'user:' + kuuid.id(),
  name: 'Glynn',
  location: 'UK',
  verified: true
}
```

Our `_id` field is now sorted by document type AND time! 

------------------------------------

The [source code](https://github.com/glynnbird/kuuid#readme) for this id generator is not complicated and can be easily reproduced in other programming languages. The Node.js implementation is [published on npm](https://www.npmjs.com/package/kuuid).
 
Further reading:

- [A Brief History of the UUID](https://segment.com/blog/a-brief-history-of-the-uuid/). 
- [ksuid](https://github.com/segmentio/ksuid)

