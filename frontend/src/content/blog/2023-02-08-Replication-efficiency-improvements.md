---
title: Replication Efficiency Improvements
pubDate: 2023-02-08T00:00:00.000Z
description: How to make replication go faster
heroImage: ../../assets/vince-fleming-Vmr8bGURExo-unsplash.jpg
relCanonical: https://blog.cloudant.com/2023/02/08/Replication-efficiency-improvements.html
---

Cloudant's replication is a rock-solid protocol that allows a database's changes to be easily synced to a different database. This feature is used widely to create multi-region Cloudant topologies, allowing dependent applications to survive a regional Cloud outage.

Cloudant has recently published a number of improvements that make replication even better than before - in our internal benchmarks we have seen replications speeds of 3x the previous version. Some of these features have been switched _off_ by default, but may become the default behaviour in future releases.

In this blog post we'll explore what has changed and how the new optional features can be switched on in your replications.

Before we get to that, it is instructive to understand how Cloudant's replication works.

## How does Replication work?

Replication consists of three actors:

- The _source_. The Cloudant database containing the data that is to be written to the target.
- The _target_. The Cloudant database where data from the source is to be written.
- The _mediator_. The Cloudant instance that performs the administration of the replication process. This can be either the _source_ or _target_ instance, or in some cases, an entirely different Cloudant instance.

Replication data logically flows in one direction only: from the _source_ to the _target_ - changes that occur on the _source_ are carefully grafted on to data that exists in the _target_ database. (If two way "sync" is required, then two replications are needed - one for data flowing from A->B, the other for B->A).

Replications are started by writing a document to the `_replicator` database on the _mediator_ (remember that the _mediator_ may also be either the _source_ or _target_ Cloudant service). In this case we're replicating a database `a` on one Cloudant instance to database `b` on another:

```js
{
  "_id": "a_to_b",
  "source": "https://myfirstaccount.cloudant.com/a",
  "target": "https://mysecondaccount.cloudant.com/b"
}
```

> Note that this simplified `_replicator` document omits any authentication credentials which would be necessary for the replication to proceed. The replication document has a number of [optional configuration parameters](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-advanced-replication) but `source` and `target` are the key mandatory options.

Once the document is written to the Cloudant _mediator_ instance's `_replicator` database, that Cloudant service will begin a series of repeating steps:

1. A batch of changes is read from the _source_ instance. This uses the Cloudant [Changes Feed](https://cloud.ibm.com/apidocs/cloudant#postchanges-changes) API call which provides a list of document revisions that have occurred since the last _checkpoint_ (see step 5).
2. The _target_ database is then queried to see if it already has the changes from step 1. This uses batched calls to the Cloudant [_revs_diff](https://cloud.ibm.com/apidocs/cloudant#postrevsdiff) API call, which given a list of document revisions will reply with a list of revisions the target _doesn't have_. This is an optimisation to avoid having to send data to the _target_ that it already has.
3. The revisions required to be sent to the _target_ from Step 2, are fetched from the _source_ using the Cloudant [Document Fetch](https://cloud.ibm.com/apidocs/cloudant#getdocument) API call - one invocation for each document revision required.
4. Batches of document revisions from Step 3 are written to the _target_ database using the Cloudant [Bulk Write](https://cloud.ibm.com/apidocs/cloudant#postbulkdocs) API. The document revisions written could be freshly inserted documents, updates to existing documents, conflicted documents or document deletions.
5. The state of the progress of the replication job is written to the _source_ and _target_ databases as local "checkpoint" documents which allow a stopped replication to resume from where it left off.

Steps 1 through 5 are repeated until there are no more changes for "one-shot" replications, or forever for "continuous" replications.

Read more about Cloudant Replication in our [documentation](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-replication-guide).

## Optimisation 1: Skipping `_revs_diff`

As discussed in the previous section, the `_revs_diff` step is there to prevent data that already exists on the _target_ being re-sent from _source_. But what if the _target_ is empty, as it would be at the start of fresh replication to a new database? The `_revs_diff` step would be a waste of time, eating up valuable database read operations from the _target_.

Cloudant now intelligentlly decides whether to perform the `_revs_diff` step, learning from the responses to previous `_revs_diff` requests. If it detects that the target seems to need most of the revisions being sent, then it will send them without bothering with the `_revs_diff` step in most cases.

No user action is required to unlock this optimisation - Cloudant will automatically use fewer `_revs_diff` requests when the _target_ appears to have few of the changes that the _source_ is sending. As a result, replications to empty of sparse _targets_ will proceed more quickly.

## Optimisation 2: Make `_revs_diff` faster

Even though some replications may use fewer `_revs_diff` API calls, the API call itself has been tweaked so that, if called, it runs much faster than before.

No user action is required to unlock this optimisation - it just goes faster!

## Optimisation 3: Using `_bulk_get`

Instead of using `GET /<sourcedb>/<docid>` to fetch each document revision for Step 3, the Cloudant Replicator can be configured to use the [POST /\<sourcedb\>/_bulk_get](https://cloud.ibm.com/apidocs/cloudant#postbulkget) endpoint instead, to fetch batches of documents in bulk.

Using fewer bulk requests in place of many more individual document fetches means that the _source_ Cloudant instance is doing less work, so replications can proceed more quickly.

This feature can be enabled by adding `"use_bulk_get": true` to your replication document e.g.

```js
{
  "_id": "a_to_b",
  "source": "https://myfirstaccount.cloudant.com/a",
  "target": "https://mysecondaccount.cloudant.com/b",
  "use_bulk_get": true
}
```

> A word of warning on this feature: although it uses the same number of Cloudant "reads" as fetching the documents individually, the bulk API consumes those reads in a single _second_ - so read consumption may be more "peaky". Take care that your _source_ Cloudant service has enough [capacity](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-ibm-cloud-public#provisioned-throughput-capacity) to avoid exhausting the read allocation required by other API clients.

## Optimisation 4: Make `_bulk_get` faster

The `_bulk_get` API call has been made more efficient so that bulk fetches of documents put less strain on the Cloudant service.

No user action is required to unlock this optimisation - it just goes faster!

## Optimisation 5: Winning revisions only

Sometimes replication is used to repair a _source_ database that contains conflicted documents. The _source_ database can be replicated to a new _target_ but only the winning revisions are retained (leaving behind any conflicts).

This is achieved with the `"winning_revs_only": true` flag:

```js
{
  "_id": "a_to_b",
  "source": "https://myfirstaccount.cloudant.com/a",
  "target": "https://mysecondaccount.cloudant.com/b",
  "use_bulk_get": true,
  "winning_revs_only": true
}
```

> Note the `winning_revs_only` flag should only be used for one-off replications for the purposes of conflict repair. It is not suitable for general-purpose replication tasks.

---

> Note that Cloudant is built on [Apache CouchDB](https://couchdb.apache.org/) and the features described in this blog post were published in Apache CouchDB 3.3.
