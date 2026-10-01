---
title: Local documents
pubDate: 2018-02-13T09:00:00.000Z
description: When you need to leave a bit of config behind
heroImage: ../../assets/jerry-kiesewetter-flamingo.jpg
---

The Apache CouchDB&trade; family has a JSON document database for every application:

- [Apache CouchDB](http://couchdb.apache.org/) can be installed on your own desktop or servers in single node or clustered installations
- [IBM Cloudant](https://www.ibm.com/cloud/cloudant) is a hosted version of CouchDB running on IBM's cloud
- [PouchDB](https://pouchdb.com/) can be installed in [many flavours](https://medium.com/ibm-watson-data-lab/pouchdb-the-swiss-army-knife-of-databases-c5429f3db21f) but is commonly used as an in-browser database, to store client-side data with or without network connectivity

All three members of the family can sync data between each other to create hybrid, multi-homed applications where data lives on a mobile device, or in the cloud, or both.

The act of replicating a database moves JSON documents from the source database to the target, but some documents are left behind. These are *local documents*.

## What are CouchDB local documents?

CouchDB local documents are JSON documents whose `_id` value starts with `_local/`:

```js
{
  "_id": "_local/config",
  "code": "red",
  "defcon": 2,
  "timestamp": "2018-02-10"
}
```

## What are local CouchDB documents used for?

If you are replicating data between two members of the CouchDB family (e.g., between your PouchDB-powered web app and hosted Cloudant), you may need to store some configuration on the client side that is:

- never to be replicated
- not counted in queries, views or aggregations

I use local documents for storing configuration or other application state that is to remain on the machine it was created on. It saves you from the work of creating a separate client-side database just to store a tiny amount of configuration data.

The CouchDB replicator uses local documents to keep track of where it got to by writing state in local documents to the source and target database.

## CRUD operations for CouchDB local documents

Local documents are created in a similar way to normal JSON documents by using an HTTP POST:

```sh
URL="https://username:password@host.cloudant.com/mydatabase"
HEAD="Content-type: application/json"
DOC='{"_id":"_local/config","code":"red"}'
curl -X POST -H "$HEAD" -d "$DOC" "$URL"
# {"ok":true,"id":"_local/config","rev":"0-1"}
```

Or HTTP PUT:

```sh
# note that the document _id is now in the URL
URL="https://username:password@host.cloudant.com/mydatabase/_local/config"
HEAD="Content-type: application/json"
DOC='{"code":"red"}'
curl -X PUT -H "$HEAD" -d "$DOC" "$URL"
# {"ok":true,"id":"_local/config","rev":"0-1"}
```

Or in JavaScript using PouchDB:

```js
var doc = {"_id":"_local/config","code":"red"};
db.insert(doc).then(...);
```

One important difference between local documents and regular documents is that you don't need to supply a `_rev` token when updating or deleting a local document. As local documents are never going to be replicated, the `_rev` token is not used and is fixed at a value "0-1" and can effectively be ignored.

Updating a local document is a case of simply repeating the POST or PUT with a new document (note the lack of `_rev` token):

```sh
DOC='{"code":"orange"}'
curl -X PUT -H "$HEAD" -d "$DOC" "$URL"
```

Deleting a document requires a HTTP DELETE (note the lack of `_rev` token):

```sh
curl -X DELETE "https://username:password@host.cloudant.com/mydatabase/_local/config"
# {"ok":true,"id":"_local/config2","rev":"0-0"}
```

That's all for this quick tip on `_local/` documents in the CouchDB ecosystem. Hopefully it comes in handy for your next replication job!

<hr>

_Apache®, [Apache CouchDB™, CouchDB™](http://couchdb.apache.org/), and the red couch logo are either registered trademarks or trademarks of the [Apache Software Foundation](http://www.apache.org/) in the United States and/or other countries._

