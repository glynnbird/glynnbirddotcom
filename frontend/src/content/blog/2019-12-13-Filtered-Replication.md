---
title: Filtered Replication
pubDate: 2019-12-13T06:00:00.000Z
description: Replicating while leaving behind deletions, design docs or anything you like.
heroImage: ../../assets/karl-fredrickson-TYIzeCiZ_60-unsplash.jpg
---


Cloudant's replication protocol allows data to flow from one Cloudant database to another, on the same Cloudant service or to an entirely separate service on the other side of the world. The replication protocol is also understood by [Apache CouchDB](https://couchdb.apache.org/) and [PouchDB](https://pouchdb.com/) allowing hybrid and mobile apps to be created with Cloudant acting as the cloud-based source of truth. The changes feed itself is also used to stream data to external services such as [couchwarehouse](https://github.com/glynnbird/couchwarehouse).


In the cases where not all the data in a Cloudant database is required to be replicated, a JavaScript _filter_ or Cloudant Query _selector_ can be defined to act as a gatekeeper to decide which documents are replicated. In this post we'll see how such selectors are setup and some common use-cases.

## Setting up replication

Initiating a replication is a simple as sending a JSON document to your Cloudant's `_replicator` database. The document defines the `source` database and the `target` database together with any authentication credentials required.

```js
{
  "_id": "myfirstreplication",
  "source" : "http://<username1>:<password1>@<account1>.cloudant.com/<sourcedb>",
  "target" : "http://<username2:<password2>@<account2>.cloudant.com/<targetdb>"
}
```

- The username/password for the source database needs a minimum of `_reader` & `_replicator` roles.
- The username/password for the target database needs  a minimum of `_reader`/`_writer` roles. If you intend design documents to be replicated too, then the target user needs the `_admin` role too. 
- It's good practice to specify the `_id` value so that you can see at-a-glance which replication job is which.

Instead of running replications as your Cloudant account's admin user, it's better to create [API Keys](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-work-with-your-account#api-keys) which can be used as the username/password for your replication process. It's always best to run with the minimum permissions needed to do the job.

The replication will start in due course and you can watch the progress by pulling the document (`GET /_replicator/myfirstreplication`) and examining the [extra attributes](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-replication-guide#monitoring-replication-status). The replication can be stopped by deleting the replication document (`DELETE /_replicator/myfirstreplication?rev=<rev>`).

## Adding a replication selector

To only allow a subset of documents to be replicated, a `selector` object can be added to your replication document when creating the replication document:

```js
{
  "_id": "myfirstreplication",
  "source" : "http://<username1>:<password1>@<account1>.cloudant.com/<sourcedb>",
  "target" : "http://<username2:<password2>@<account2>.cloudant.com/<targetdb>",
  "selector": {
    "$or": {
      "author": "Virginia Woolf",
      "year": {
         "$lt": 1900
      }
    }
  }
}
```

In this case only document which have an 'author' attribute of `Virginia Woolf` or a `year` attribute _less than_ 1900 will be replicated. The selector can contain any valid [Cloudant Query syntax](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query#selector-syntax), and as it operates on every document in the the changes feed, it doesn't have to be backed by a suitable index. 

> Note: A _selector_-based replication filter is more efficient than the [JavaScript-based filter functions](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-advanced-replication#filtered-replication-adv-repl) as Cloudant can evaluate whether a document passes a selector without having to spin up a JavaScript process.

## Ignoring deletions

Cloudant stores deletions as an additional revision to an existing document. This means that a [tombstone document](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-documents#tombstone-documents) remains after document deletion. To clean up tombstones, a database can be replicated to a new empty database, but _ignoring deleted documents_. This leaves the target database free of tombstones, using less disk space and with a de-cluttered primary index.

A _selector_ to filter out tombstones is:

```js
"selector": {
  "_deleted": {
    "$exists": false
  }
}
```

which translates as "only replicate documents where the attribute `_deleted` is not present".

## Ignoring design documents

Sometimes the purpose of replication is to take a backup of the _data_ in the database, but the design documents need to be filtered out so that they don't trigger the building of indexes on the target service.

You _could_ use a  selector to filter out Design Documents:

```js
"selector": {
  "$not": {
    "_id": {
      "$regex": "^_design"
    }
  }
}
```

which translates as "only replicate documents whose _id fields does NOT begin with _design", but a more common approach is to rely on the fact that to be able to write design documents at the target end a user/api-key with an `_admin` role is required. So one way of ensuring that design documents ARE NOT written is to run the replication as a non-admin user by creating an [API Key](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-work-with-your-account#api-keys) with only `_reader`/`_writer` roles.

## Custom selectors

If you only need to replicate a sub-set of data to the target, then you can devise any Cloudant Query selector you need e.g.

```js
"selector": {
  "type": "order",
  "status": "complete",
  "date": { "gte": "2019-01-01" }
}
```

You can combine your custom selector with an off-the-shelf selector to filter out deletions:

```js
"selector": {
  "$and": [
     "_deleted": {
      "$exists": false
     },
    "type": "order",
    "status": "complete",
    "date": { "gte": "2019-01-01" }
  ]
}
```

This can be run as a non-admin user to filter out design documents too.

## Measure twice, cut once

Before running a filtered replication on your production data, it's worth making sure your logic works on a smaller data set:

- Create a new database `a` containing a suitable document that you would expect to be replicated, a document that you would not expect to be replicated, a design document and a deleted document.
- Kick off a replication to a new empty database `b` with your custom selector.
- Ensure that your target database has the right documents in it. 

If all is well, you can move on to your live replication.
