---
title: "Replication Scheduler"
description: Monitoring Cloudant replications using the scheduler
pubDate: 2024-08-15T00:00:00+01:00
heroImage: ../../assets/jeshoots-com-9qQTUYm4ss4-unsplash.jpg
relCanonical: https://blog.cloudant.com/2024/08/15/Replication-Scheduler.html
---

In this blog post we'll examine how to monitor Cloudant replications using the Replication Scheduler. Replication is used to copy data from a source database to a target database, where the two databases can reside on the same Cloudant instance or different instances. Replication is used for:

- backing up data in different database.
- keeping copies of a database in different regions in sync.
- copying data from mobile devices to Cloudant using Apache CouchDB or PouchDB database sources.
- creating filtered slices of a database in a new database.

Most of the time, Cloudant will retry and allow replications to keep working, only stopping replications if a fatal error occurs. If the flow of replicated data is important to your application, you may wish to proactively _monitor_ your replication jobs to ensure that they're running at all times.

> Note: once created, a replication may fail at some point in the future so it is the application developer's responsibility to monitor each replication job and take remedial action.

## Creating replications

Before we can monitor replications, we need to be able to set them up in the first place. To do this we need to do add a document to the Cloudant `_replicator` database.

> Note: if the `_replicator` database is not present on your Cloudant service then simply create it using the [PUT /_replicator](https://cloud.ibm.com/apidocs/cloudant#putdatabase) API call or using the Cloudant Dashboard to create a new database called "_replicator".

The document we add to the `_replicator` database defines where data is copied from and to, together with some replication options. It is formatted like so:

```js
{
  "_id": "my_replicator_document",
  "source": {
    "url": "https://mysourceinstance.cloudant.com/mysourcedatabase",
    "auth": {
      "iam": {
        "api_key": "MY_IAM_API_KEY"
      }
    }
  },
  "target": {
    "url": "https://mytargetinstance.cloudant.com/mytargetdatabase",
    "auth": {
      "iam": {
        "api_key": "MY_IAM_API_KEY"
      }
    }
  },
  "create_target": true,
  "continuous": true
}
```

In this case we are using IBM IAM authentication, so we tell the Cloudant replicator which IAM API key we wish to use to access the `source` and `target` databases (remember these could be the same Cloudant instances, or different) - it may be possible to use the same IAM API key for both source and target if it has suitable permissions.

It is also possible to use legacy (basic) authenticaton by specifying the source username and password in the Cloudant URLs, although IAM is preferred:

```js
{
  "_id": "my_replicator_document",
  "source": "https://MYUSERNAME:MYPASSWORD@mysourceinstance.cloudant.com/mysourcedatabase",
  "target": "https://MYUSERNAME:MYPASSWORD@mytargetinstance.cloudant.com/mytargetdatabase",
  "create_target": true,
  "continuous": true
}
```

or without putting usernames and passwords in the URL:

```js
{
  "_id": "my_replicator_document",
  "source": {
    "url": "https://mysourceinstance.cloudant.com/mysourcedatabase",
    "auth": {
      "basic": {
        "username": "MYUSERNAME",
        "password": "MYPASSWORD"
      }
    }
  },
  "target": {
    "url": "https://mytargetinstance.cloudant.com/mytargetdatabase",
    "auth": {
      "basic": {
        "username": "MYUSERNAME",
        "password": "MYPASSWORD"
      }
    }
  },
  "create_target": true,
  "continuous": true
}
```

There are number of extra parameters that are allowed in the replicator document listed in the [API docs](https://cloud.ibm.com/apidocs/cloudant#putreplicationdocument). In this case we have `create_target: true` so that Cloudant creates the target database for us if it doesn't already exist, and `continuous: true` to keep the replication running - potentially forever.

We can create our replication by POSTing it e.g. [POST /_replicator](https://cloud.ibm.com/apidocs/cloudant#postdocument) or PUTing it e.g. [PUT /_replicator/my_replicator_document](https://cloud.ibm.com/apidocs/cloudant#putdocument).

It's helpful to use a meaningful `_id` field so that replication documents can be easily distinguished e.g. `transactions_daily_backup_2024-08-12` or `users_dallas_to_london_sync`.

Now that we have a replication running we can consult the Replication Scheduler to see if Cloudant has started copying data.

## Replication Scheduler Docs

To see a list of the replication documents that Replication Scheduler knows about we can call the [GET /_scheduler/docs](https://cloud.ibm.com/apidocs/cloudant#getschedulerdocs) API call which returns an array of "docs", one for each replicator document. Each of these docs contains useful information (without leaking any credentials!) about the replication's progress:

```js
{
  "total_rows": 1,
  "offset": 0,
  "docs": [
    {
      "database": "someinstance.cloudant.com/_replicator",
      "doc_id": "my_replicator_document",
      "id": "cccb560756a5387412a31df1667ebc17+continuous+create_target",
      "node": "dbcore@db17.bm-cc-us-south-05.cloudant.net",
      "source": "https://mysourceinstance.cloudant.com/mysourcedatabase",
      "target": "https://mytargetinstance.cloudant.com/mytargetdatabase",
      "state": "running",
      "info": {
        "revisions_checked": 23541,
        "missing_revisions_found": 5,
        "docs_read": 5,
        "docs_written": 5,
        "changes_pending": 0,
        "doc_write_failures": 0,
        "bulk_get_docs": 0,
        "bulk_get_attempts": 0,
        "checkpointed_source_seq": "23564-g1AAAAgTe",
        "source_seq": "23564-g1AAAAgTe",
        "through_seq": "23564-g1AAAAgTe"
      },
      "error_count": 0,
      "last_updated": "2024-08-12T10:03:49Z",
      "start_time": "2024-08-12T10:03:49Z",
      "source_proxy": null,
      "target_proxy": null
    }
  ]
}
```

We can see the _state_ of the replication which is one of seven values listed [here](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-advanced-replication). A _continuous_ replication should stay in the "success" state forever, but a non-continuous replication will stop in a "completed" state when it has copied all of the changes from source to target.

It also lists the number of documents read from the source, the number written to the target and counts of any document write failures.

If we know the id of replication document, we can return a single scheduler document with [GET /_scheduler/docs/_replicator/<docid>](https://cloud.ibm.com/apidocs/cloudant#getschedulerdocument) e.g. `GET /_scheduler/docs/_replicator/my_replicator_document`.

To see the _history_ of the replication itself and examine the Cloudant _job_ that has been assigned to look after this replication, we need to look at the Scheduler Jobs API.

## Replication Scheduler Jobs

In the Scheduler Docs response, the `id` field contains the id of the Scheduler Job that is looking after this replication (`cccb560756a5387412a31df1667ebc17+continuous+create_target` in the above example). A job may change over time, so this `id` will not last forever - it represents the current process that is managing this particular replication job.

Note: if the `id` is null, then the job is not being serviced at the moment. This could be because the replication has already completed, or it has failed, perhaps because the credentials or URLs were incorrect.

It is this `id` we will use with the 
[GET /_scheduler/jobs/<job_id>](https://cloud.ibm.com/apidocs/cloudant#getschedulerjob) API, which returns a history of the replication job itself:

```js
GET /_scheduler/jobs/cccb560756a5387412a31df1667ebc17+continuous+create_target
{
  "database": "_replicator",
  "id": "cccb560756a5387412a31df1667ebc17+continuous+create_target",
  "pid": "<0.17912.4439>",
  "source": "https://mysourceinstance.cloudant.com/mysourcedatabase",
  "target": "https://mytargetinstance.cloudant.com/mytargetdatabase",
  "user": null,
  "doc_id": "myreplication",
  "info": {
    "revisions_checked": 23541,
    "missing_revisions_found": 5,
    "docs_read": 5,
    "docs_written": 5,
    "changes_pending": 0,
    "doc_write_failures": 0,
    "bulk_get_docs": 0,
    "bulk_get_attempts": 0,
    "checkpointed_source_seq": "23564-g1AAAAgTe",
    "source_seq": "23564-g1AAAAgTe",
    "through_seq": "23564-g1AAAAgTe"
  },
  "history": [
    {
      "timestamp": "2024-08-12T10:03:49Z",
      "type": "started"
    },
    {
      "timestamp": "2024-08-12T10:03:49Z",
      "type": "added"
    }
  ],
  "node": "dbcore@db17.bm-cc-us-south-05.cloudant.net",
  "start_time": "2024-08-12T10:03:49Z"
}
```

Much of the data in the scheduler _job_ is the same as we have seen already in the scheduler _doc_, but it also contains a `history` array which can be useful to see recent events in the life of this replication job. 

It may be that the Scheduler _job_ is too much information for automated replication monitoring and that the data in the Scheduler _doc_ is sufficient, but the _job_ informaton is useful when something goes wrong and where it is useful to see a timeline of events.

## Monitoring replications

For most purposes, monitoring of a replication is as simple as:

1. [Create the replication document](https://cloud.ibm.com/apidocs/cloudant#putreplicationdocument)
2. Pause
3. [Fetch the Scheduler document](https://cloud.ibm.com/apidocs/cloudant#getschedulerdocument) to ensure the replicaton is running (there is a job `id` assigned and that the `status` is `running`) and there are no errors.
4. Go to 2.

If something goes wrong there are two courses of action:

1. Create an alert and a human can interrogate the [Scheduler Job](https://cloud.ibm.com/apidocs/cloudant#getschedulerjob) to see the recent history.
2. or, delete the old `_replicator` document and recreate it.

The most common way in which a replication fatally fails is incorrect credentials. This can happen if IAM API keys are rotated while forgetting to update the `_replicator` document, or the permissions of a valid API key are modified such that the replication job can no longer proceed.

Another error would be caused if the source or target database was missing, or if the Cloudant service(s) that hosted the databases was decommissioned, but this would not be "fatal" - Cloudant would continue to retry until the source & target could be found.

Cloudant replications will usually automatically retry non-fatal errors and will only fatally "error" in exceptional circumstances.

## Sample code

This repository contains some sample code on how a basic replication monitor might function. Follow the instructions in the [README](https://github.com/glynnbird/replication_monitor) on how to install, configure and run the replication monitor.

It is designed as a jumping-off point for you to create you own replication solution.
