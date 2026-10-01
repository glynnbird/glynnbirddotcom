---
title: "Auto Tombstone Removal"
description: Cloudant now automatically removes deleted documents
pubDate: 2026-09-03T00:00:00+00:00
heroImage: ../../assets/waldemar-brandt-jeTlob-Wv0M-unsplash.jpg
---

Cloudant now automatically completely removes deleted documents from databases approximately 90 days after they were deleted. This reduces disk usage, makes the changes feed more efficient and speeds up index building times.

In this blog post we'll explain how this feature works, how it can benefit your application and any gotchas you need to be aware of.

## What is a tombstone?

A Cloudant document at its simplest is a JSON object with a unique `_id` that lives in a _database_. A document may be modified over time via Cloudant's HTTP API so that a document can have many _revisions_. When the document is no longer required, it can be deleted with the [DELETE /{db}/{doc_id}](https://cloud.ibm.com/apidocs/cloudant#deletedocument) API call which leaves the document's final revision looking like this:

```js
{
  "_id": "mydoc",
  "_rev": "14-abc123",
  "_deleted": true
}
```

The document's body is removed leaving only its `_id`/`_rev` pair and special flag `_deleted`  set to `true`. As this document marks the last resting place of a previously existing document, it is sometimes referred to as a **tombstone**.

Tombstones have their uses: they appear in the Cloudant changes feed so that processes following a database's changes are notified of a document's deletion. Similarly, replications using this database as a source will ensure that the target database's copy of the document is also deleted.

## Why are tombstones problematic?

In relatively small numbers, tombstones are not a problem but prior to auto-tombstone removal they would live forever. Applications that have a tendency to delete lots of documents accumulate large numbers of tombstones. As well as bloating the database's size, this can cause performance issues - particularly in applications that are fed from the changes feed. That is:

- Changes feed followers.
- Replications.
- Index building.

An example of an application that accumulates huge numbers of tombstones is a parcel tracking service that has one document per consignment. When the parcel no longer needs to be tracked, its document is deleted. At the scale of a decent sized delivery company, it doesn't take long to accumulate tombstones in the hundreds of millions and beyond.

## Auto-tombstone removal

To address this problem, Cloudant has introduced **auto-tombstone-removal**. This feature is enabled by default across the Cloudant estate and removes tombstones approximately **90 days after the document was deleted**. Tombstones are removed in a background process so as not to affect operational performance.

The exact timing of a tombstone's removal is not guaranteed but will generally happen in the week following 90 days from the document's deletion.

## How does it work?

Earlier this year, Cloudant introduced a change which stores the approximate timestamp when each database change occurred. Using this data structure we can now easily find documents that were deleted more than 90 days ago - these are the tombstones that are ready to be removed.

**No user action is required to enable this feature.**

The 90-day window is in place to allow replications, changes followers and secondary indexes time to pick up the deletion event. After this time, the tombstone has served its purpose as a marker for a deleted document can be safely purged from the database.

> Warning: If you have a changes follower that only occasionally polls the Cloudant changes feed for changes (less frequently than once every 90 days) then your changes follower may miss document deletion events. Consider polling at a shorter interval.

## What happens to my tombstones?

The document's history is completely purged from the database, leaving no trace that it ever existed. If a new document is later created that re-uses a previous tombstone's `_id`, it will start with a revision number starting at '1'.

> Warning: A tiny minority of Cloudant customers use a different API call to delete documents and store additional JSON data in the tombstone document. This data will also be removed after 90 days. If you need to retain data after a document is deleted, consider writing data to a different database or marking the document as deleted using a _soft delete_ flag e.g. `{"deleted": true}`.

## How can I tell if this feature is working?

Use the [GET /{db}](https://cloud.ibm.com/apidocs/cloudant#getdatabaseinformation) API call to retrieve information about the database:

```js
curl "$URL/mydb"

{
  "cluster": {
    "n": 3,
    "q": 16,
    "r": 2,
    "w": 2
  },
  "compact_running": false,
  "db_name": "products",
  "disk_format_version": 8,
  "doc_count": 50000000,
  "doc_del_count": 100000,
  "instance_start_time": "1681831801",
  "partitioned_indexes": {
    "count": 4,
    "indexes": {
      "search": 2,
      "view": 2
    },
    "limit": 10
  },
  "props": {
    "partitioned": true
  },
  "purge_seq": "0",
  "sizes": {
    "active": 99988887,
    "external": 99241872,
    "file": 99685680
  },
  "update_seq": "86242107-g1AAAAI"
}
```

There are two attributes of interest:

- `doc_count`: the number of live documents in the database.
- `doc_del_count`: the number of deleted documents (tombstones) in the database.

Every time a tombstone is purged, the `doc_del_count` is decremented by one. If all deleted documents are older than 90 days, then `doc_del_count` will eventually reach zero.

More typically, an application that routinely deletes documents would expect to see a non-zero value for `doc_del_count` - its value will reflect the number of deleted documents accumulated in 90 days of activity.

Tombstones older than 90 days are continuously removed from the database, so the `doc_del_count` should not grow indefinitely (assuming a constant document deletion rate).

## A word on conflicts

A Cloudant document's revisions are stored in a tree structure. Most documents have a linear tree trunk, with each revision superseding the previous one. Some applications (those which perform fast document updates, or where writes are collected on geographically separate Cloudant/CouchDB/PouchDB services) intentionally or otherwise produce _conflicted_ documents, where the revision tree has two or more branches.

Strictly speaking, a tombstone is a document where all branches of the revision tree end in a revision with a `_deleted: true` attribute. Auto-tombstone removal will only remove documents where all branches are deleted.
