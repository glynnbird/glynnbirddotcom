---
title: "Throttling Replication"
description: Controlling the speed of Cloudant replication jobs
pubDate: 2024-02-01T00:00:00Z
heroImage: ../../assets/igal-ness-wQfV9njQxW4-unsplash.jpg
relCanonical: https://blog.cloudant.com/2024/02/01/Throttling-Replication.html
---

# Throttling replicaion

Cloudant's replication protocol allows a database's data to be copied to another database in the same Cloudant instance, or to a database in a different Cloudant instance, perhaps in another IBM Cloud region. It is commonly used to keep two copies of the same data in different regions in sync, for applications that need high availability than provided by a single cloud region.

A Cloudant replication job is a one-way operation copying documents from the _source_ to the _target_ and consumes:

- 1 `read` unit from the _source_ Cloudant instance 
- 1 `write` unit from the _target_ Cloudant instance

for every document that needs to be copied from source to target. Other API calls (such as `_changes` and `_revs_diff`) are used to work out _whether_ a document revision needs to be copied, but these are not charged.

As such a replication's speed can be limited by the plan capacity of the source Cloudant instance (for reads) and the capacity of the target Cloudant instance (for writes). 

In most applications it is not desirable for replication traffic to exhaust the read or write capacity at each end of a replication job, so this blog post shows how replication jobs can be tuned to proceed at a slower rate - to leave some Cloudant capacity free for operational API calls.

## How to set up replication

A replication job is created by adding a document into a Cloudant instance's `_replicator` database.

```js
{
  "_id": "uswest_to_useast_products",
  "source": {
    "url": "https://mysourceinstance.cloudant.com/mysourcedatabase",
    "auth": {
      "iam": {
        "api_key": "MY_IAM_API_KEY"
      }
    }
  },
  "target": {
    "url": "https://mytargetinstance.cloudant.com/mytargetedatabase",
    "auth": {
      "iam": {
        "api_key": "MY_IAM_API_KEY"
      }
    }
  },
  "continuous": true
}
```

Note:

- The replication job is given a meaningful `_id` attribute which will help us identify this replication job in the future.
- The `source` object contains a `url` attribute which contains the hostname of the source instance and the source database's name.
- The `target` object contains a `url` attribute which contains the hostname of the target instance and the target database's name.
- Both source and target objects contain an IAM api key that will be used to authenticate with each Cloudant instance.
- The `continuous` flag keeps the replication running, even after the last source change is processed. We'll be adding other parameters at this level to tweak the replication's speed.

## Monitoring a replication job

To see how our replication job is proceeding we can use the [retrieve a replication scheduler document API](https://cloud.ibm.com/apidocs/cloudant#getschedulerdocument):

```js
GET  /_scheduler/docs/_replicator/uswest_to_useast_products
{
  "database": "_replicator",
  "doc_id": "uswest_to_useast_products",
  "id": "63fa8857a6bc494f9474525d2293faf1+continuous",
  "source": "https://mysourceinstance.cloudant.com/mysourcedatabase/",
  "target": "https://mytargetinstance.cloudant.com/mytargetedatabase/",
  "state": "running",
  "info": {
    "revisions_checked": 1854,
    "missing_revisions_found": 1854,
    "docs_read": 453,
    "docs_written": 33,
    "changes_pending": 9649,
    "doc_write_failures": 0,
    "bulk_get_docs": 0,
    "bulk_get_attempts": 0,
    "checkpointed_source_seq": "4-g1AAAATk",
    "source_seq": "354-g1AAAAfjeJy",
    "through_seq": "4-g1AAAATkeJzLYW"
  },
  "error_count": 0,
  "last_updated": "2024-01-29T11:32:21Z",
  "start_time": "2024-01-29T11:32:21Z",
  "source_proxy": null,
  "target_proxy": null
}
```

There's a lot to unpack here. But here are the main points:

- We fetch the replication scheduler document using the `_id` of the document we created earlier.
- `info.docs_read` & `info.docs_written` show how many documents have been read from the source and written to the target respectively.
- `info.error` _would_ contain an error message if something went wrong.
- `state` shows the status of the replication. A _continuous_ replication would be expected to be "running" forever, unless a fatal error occurred.
- Full API reference is [here](https://cloud.ibm.com/apidocs/cloudant#getschedulerdocument), including all the possible values of `state`.


## Controlling the speed of a replication job

The default configuration for a replication job is to use 20 parallel HTTP connections and 4 worker processes. For small document sizes, this can result in 3000 documents being fetched from the source and being written to the target, per second. 

To make a replication job proceed more slowly than that, we can set the `http_connections` and `worker_processes` parameters in the `_replicator` document:

```js
{
  "_id": "uswest_to_useast_products",
  "source": {
    "url": "https://mysourceinstance.cloudant.com/mysourcedatabase",
    "auth": {
      "iam": {
        "api_key": "MY_IAM_API_KEY"
      }
    }
  },
  "target": {
    "url": "https://mytargetinstance.cloudant.com/mytargetedatabase",
    "auth": {
      "iam": {
        "api_key": "MY_IAM_API_KEY"
      }
    }
  },
  "continuous": true,
  "http_connections": 1,
  "worker_processes": 1
}
```

This table shows how combinations of `http_connections` and `worker_processes` translate into numbers of documents transferred per second between a source database of small documents and new empty target database.

| http_connections | worker_processes | Approximate reads per second on source database |
|------------------|------------------|-------------------------------------------------|
| 2                | 1                | 200                                             |
| 6                | 2                | 1000                                            |
| 12               | 3                | 2000                                            |
| 20               | 4                | 3000 (This value is the default.)               |

> Note: there are other flags and attributes that can be added to the `_replicator` document.

In practice, it's best to try a replication configuration and measure how fast it is progressing and how much of your Cloudant capacity is being consumed using the [provisioned throughput capacity consumption API](https://cloud.ibm.com/apidocs/cloudant#getcurrentthroughputinformation). The actual consumption rate will depend on factors including:

- How different the source and target databases are and therefore how many document revisions need to be copied over.
- How big the documents are.
- How many document conflicts are present.
- How many document attachments need to be copied.
- If a replication filter is provided, how many source documents are discarded by the filter.
- If the replication bumps into the provisioned read capacity of the source Cloudant or write capacity of the target Cloudant instance.

## Futher reading

- API reference for replication documents: https://cloud.ibm.com/apidocs/cloudant#putreplicationdocument
- API reference for reading a replication scheduler document: https://cloud.ibm.com/apidocs/cloudant#getschedulerdocument 
