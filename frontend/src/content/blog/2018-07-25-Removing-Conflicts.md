---
title: Conflicts
pubDate: 2018-07-25T06:00:00.000Z
description: How to deal with conflicts in Cloudant documents
heroImage: ../../assets/paul-bergmeir-97704-unsplash.jpg
relCanonical: https://blog.cloudant.com/2018/07/25/Removing-Conflicts.html
---


Conflicts occur in Cloudant and Apache CouchDB databases when the same document is written to in different ways in separate copies of the database. This can occur when there is:

- a mobile app and a server-side replica and the data is replicated between them.
- two databases that are replicated together.
- a single, multi-node database that receives mulitple writes to the same document at the same time. Although the database will try to prevent conflicts happening in this circumstance by returning an `HTTP 409` response, conflicts may still arise in some circumstancces.

Conflicts are not an error condition - they are symptom of the database ensuring that you don't lose data when the same document is modified in different ways by different actors. Sometimes conflicts occur by accident - perhaps some automated process updating the database more frequently than normal. Ideally your code should adopt a design pattern that reduces or eliminates the chance of conflicts occurring, but if conflicts arise your code will need to have an algorithm to fix them.

Conflicted documents can be a headache for the performance of the database, even if you make the effort to resolve conflicts as you find them. In some cases, documents can have hundreds or thousands of conflicted revisions. As the database has to keep the bodies of the conflicted documents and revision histories for conflicted branches, conflicted documents eat up storage and make the revision tree costly to navigate when updating or deleting revisions.

## Detecting conflicts

You can see if a document is conflicted by fetching the document with `?conflicts=true` appended to the URL:

```sh
curl http://localhost:5984/mydb/mydoc?conflicts=true
{"_id":"mydoc","_rev":"1-99","a":98,"_conflicts":["1-98","1-97","1-96","1-95"]}
```

Another API option is to use `?meta=true` which returns further metadata about your document:

```js
{
  "_id": "c956ef1ed08dd48b48ea4b9809665b4f",
  "_rev": "2-8a759d1f5a1537bcf775ab7bc947b377",
  "a": 1,
  "b": 3,
  "_revs_info": [
    {
      "rev": "2-8a759d1f5a1537bcf775ab7bc947b377",
      "status": "available"
    },
    {
      "rev": "1-25f9b97d75a648d1fcd23f0a73d2776e",
      "status": "available"
    }
  ],
  "_deleted_conflicts": [
    "3-f76e0de0cabef8da918d5b747493631a"
  ]
}
```

## Resolving conflicts by hand

In the first example, the document has a winning revision `1-99` and four other revisions that are non-winning. If I delete the conflicting revisions the document returns to its normal state.

```sh
curl -X DELETE http://localhost:5984/mydb/mydoc?rev=1-98
curl -X DELETE http://localhost:5984/mydb/mydoc?rev=1-97
curl -X DELETE http://localhost:5984/mydb/mydoc?rev=1-96
curl -X DELETE http://localhost:5984/mydb/mydoc?rev=1-95
```

I don't *have to* delete the conflicted revisions - I could instead have chosen to retain revision `1-96`. Simply deleting the winning revision and the other conflicts would promote `1-96` to be the winner. I can even delete ALL of the revisions and propose a new winner (perhaps a merge of all the conflicted documents). The resolution of a conflict is simply deleting the revisions you don't want and optional creation of a new winner. The [_bulk_docs](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-bulk-operations#updating-documents-in-bulk) endpoint can be used to make several modifications to a single document in a single API call.

This is simple enough when there are only a handful of conflicts but if there are hundreds or thousands, some tooling would help.

## Resolving conflicts with couchdeconflict

I wrote a [simple command-line utility to help clean up CouchDB/Cloudant documents that have become conflicted](https://www.npmjs.com/package/couchdeconflict). It is installed with

```sh
npm install -g couchdeconflict
```

and run by specifying the URL of the document to work on:

```sh
> couchdeconflict -u http://localhost:5984/mydb/mydoc
options: {"url":"http://localhost:5984/mydb/mydoc","keep":null,"batch":100}
Fetching document
217 conflicts
  [==================================================] 100% 217/217           
217 conflicts deleted
```

By default, the pre-existing winning revision is retained and the conflicted revisions are deleted. You can nominate a new winning revision with the `--keep` parameter:

```sh
> couchdeconflict --url http://localhost:5984/mydb/mydoc  --keep 1-111
couchdeconflict
---------------
options: {"url":"http://###:###@localhost:5984/mydb/mydoc","keep":"1-111","batch":100}
Fetching document
217 conflicts
Keeping revision 1-111
  [==================================================] 100% 217/217           
217 conflicts deleted
```

If you're worried about what this utility is going to do to your database, you can do a dummy run with the `--dryrun` parameter:

```sh
> couchdeconflict --url http://localhost:5984/mydb/mydoc  --keep 1-111 --dryrun
```

## Detecting conflicts with a view

We can keep an eye on a database's conflicts by creating a MapReduce view:

```js
function(doc) {
  var numConflicts = doc._conflicts ? doc._conflicts.length : 0
  var numDeletedConflicts = doc._deleted_conflicts ? doc._deleted_conflicts.length : 0
  if (numConflicts || numDeletedConflicts) {
    emit(null, [numConflicts, numDeletedConflicts])
  }
}
```

The above map function emits an array containing the number of conflicts and the number of deleted conflicts which can be totalised by the  the `_sum` reducer to show totals of unresolved conflicts and deleted conflicts for the whole database:

```js
GET /db/_design/conflict/_view/sum?reduce=true
{
  "rows": [
    {
      "key": null,
      "value": [
        1,
        1
      ]
    }
  ]
}
```

We can then switch off the reducer to identify which document ids are affected:

```js
GET /db/_design/conflict/_view/sum?reduce=false
{
  "total_rows": 2,
  "offset": 0,
  "rows": [
    {
      "id": "8b48ea4b9809665b4fc956ef1ed08dd4",
      "key": null,
      "value": [
        1,
        0
      ]
    },
    {
      "id": "c956ef1ed08dd48b48ea4b9809665b4f",
      "key": null,
      "value": [
        0,
        1
      ]
    }
  ]
}
```

If a document is regularly picking up conflicts or a document has too many deleted conflicts (say over five hundred) then some remedial action is required to cut off the source of conflicts to avoid future performance problems.

## Further reading

If you want to explore this subject further, here's some links:

- [CouchDB docs](https://docs.couchdb.org/en/latest/replication/conflicts.html)
- [The tree behind Cloudant's documents](https://dx13.co.uk/articles/2017/01/01/the-tree-behind-cloudants-documents-and-how-to-use-it/)
