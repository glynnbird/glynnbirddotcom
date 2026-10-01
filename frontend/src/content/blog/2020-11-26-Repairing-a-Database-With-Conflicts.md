---
title: Repairing a database with conflicts
pubDate: 2020-11-26T06:00:00.000Z
description: Three ways to eliminate conflicts from a Cloudant database
heroImage: ../../assets/jeshoots-com-VdOO4_HFTWM-unsplash.jpg
---


[Cloudant conflicts](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-conflicts) occur when disconnected replicas of a database are updated in different ways at the same time. The replicas could be:

- Copies of a database hosted in different regions that are replicating continuously to each other, while both accepting writes.
- A mobile application going offline and replicating its updates to the cloud later, only to find that some of its changes clash with the cloud-based copy.
- Copies of the same database shard in a single-region cluster. If the same document is updated over and over in a short time window, conflicts can be unwittingly introduced.

> Note that Cloudant on Transaction Engine does not generate conflicts for in-region write, eliminating the third of the above bullet points.

Cloudant conflicts can be [resolved](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-conflicts#how-to-resolve-conflicts) by deleting unwanted conflicted revisions and optionally writing a new revision (the choice of conflict resolution algorithm will vary between applications: merging the bodies of conflcting documents, being one example) but there are consequences for having a database that has conflicted documents because Cloudant retains information for each branch in the revision tree - the wider the revision tree, the more work is required to navigate it for update, retrieval and indexing operations.

In short, highly conflicted documents are a performance drag **even if your application has dilligently resolved conflicts as they arise**.

This post describes three ways in which a database that contains problematic documents can be "repaired", so as to not impact performance. They all involve creating a new copy of the data in a new, freshly-created database.

## Repairing via replication - winning_revs_only

From October 2022 onwards, we can replicate data from the conflicted source database to a new, empty database and only copy the winning revisions, leaving the conflicts behind. The trick is to use the `winning_revs_only: true` flag in the replication document:

```js
{
  "source": "https://a.cloudant.com/source",
  "target": "https://a.cloudant.com/target",
  "winning_revs_only": true
}
```

This is the recommended technique for ridding a database from unwanted conflicts. Other methods are outlined in the rest of this post but this method is the best.

> Note: The `winning_revs_only` flag should only be used for the purposes of repairing conflicted databases and should be not used for other replication jobs.

## Repairing via replication - with a selector

> Note: this technique has been superceded by the `winning_revs_only` approach.

We can replicate data from the source database to a new empty database, with a replication filter that omits conflicted documents. A `selector` object is added to the replication document to set up the filter:

```js
"selector": {
  "_conflicts": {
    "$exists": false
  }
}
```

The above selector reads as "allow documents that _don't_ have a `_conflicts` attribute to be replicated". 

The replication document in the `_replicator` database would look something like this:

```js
{
  "source": "https://a.cloudant.com/source",
  "target": "https://a.cloudant.com/target",
  "selector": {
    "_conflicts": {
      "$exists": false
    }
  }
}
```

Replication makes light work of copying over documents _without_ conflicts, but if you also need the winning revisions of the source database's _conflicted documents_, a separate script would have to be written. It would fetch the winning revision of each conflicted document and write them to the target database using [the bulk_docs API](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-documents#bulk-operations) with `new_edits=false` to retain the original document's revision token.

To help identify conflicted documents a [view can be created](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-conflicts#finding-conflicts) in the source database.

## Repairing conflicts via replication & VDU

> Note: this technique has been superceded by the `winning_revs_only` approach.

This technique can be used to repair conflicted documents by replicating everything to a new database but ensuring that the _conflicted documents_ only keep the branch of changes that contains the winning revision - all of the conflicts will not make it to the target database. Here's how it works:

1. [Delete all of the conflicting revisions](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-conflicts#how-to-resolve-conflicts) in the source database.
2. Create a new target database
3. Create a new design document in the target database containing:

```js
{ "_id": "_design/validator", "validate_doc_update": "function(newDoc, oldDoc, userCtx) { // any update to an existing doc is OK\n if(oldDoc) {\n return;\n }\n \n // reject tombstones for docs we don';t know about\n if(newDoc[\"_deleted\"]) {\n throw({forbidden : \"We';re rejecting tombstones for unknown docs\"});\n }\n}\n" }
```

> This is a "VDU" function - a special JavaScript function which is the gatekeeper for which writes are accepted by the database. It contains logic which will reject branches of a revision tree which end in a deleted document - the upshot of which leaves conflicted documents with only the winning branch retained.

4. Replicate data from the source database to the new target database. Use `continuous=true` if you would like the replication to run until it is no longer needed.
5. Once complete and indexes are built, any applications using the source database can be pointed towards the target.

## Repairing by backup

> Note: this technique has been superceded by the `winning_revs_only` approach.

Another method is to backup the affected database to a file and to restore it to a new, freshly created database. The [couchbackup tool has a "shallow" mode](https://github.com/cloudant/couchbackup#what-is-shallow-mode) which only copies over the winning revisions of each document it finds. Restoring only the winning revisions to the target has the effect of eliminating the conflict history.

The procedure is as follows:

```sh
# backup the source database using shallow mode
couchbackup --db source --mode shallow > backup.txt

# restore to a new empty database
curl -X PUT "$COUCH_URL/target"
cat backup.txt | couchrestore --db target
```

> Note: couchbackup does not backup attachments, so this method may not be suitable for such databases.
