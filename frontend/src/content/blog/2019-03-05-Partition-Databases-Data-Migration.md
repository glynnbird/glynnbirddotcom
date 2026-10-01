---
title: Partitioned Databases - Data Migration
pubDate: 2019-03-05T08:00:00.000Z
description: Copying data from a standard database to a partitioned database.
heroImage: ../../assets/timothy-muza-66846-unsplash.jpg
---

Cloudant's new *Partitioned Databases* feature allows a Cloudant database to be organised into partitions (blocks of data guaranteed to reside on the same database shard) by specifying a two part `_id` field consisting of the parition and document id e.g.

```js
{
  "_id": "US:52412",
  "name": "Boston",
  "state": "Massachusetts",
  "country": "US"
  ...
}
```

- "US" identifies the partition - all documents starting with "US" will be stored in the same physical database shard
- "52412" is a unique identifier for the document. It must be unique within the partition.
- the partition and document identifiers are separated by a ":" character.

A partitioned database allows queries limited to a single parition - such queries can be performed much more efficiently than whole-database (global) queries. 

## Migrating to a partitioned database

Migrating existing data over to a partitioned database will require creating a new database with the `partitioned=true` flag:

```sh
curl -X PUT "$URL/cities2?partitioned=true"
```

The new database will need to be populated with a copy of the original data, but with the new `partitionid:documentid` format.

i.e we need to transform documents of this form:

```js
{"_id":"52412","country":"US",name:"Boston"}
```

into this form:

```js
{"_id":"US:52412","country":"US",name:"Boston"}
```

to ensure that each city is placed in a per-country partition.

Cloudant's [Replication API](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-replication-guide) allows data to be copied or synced from a source database to a target database. [Filters](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-advanced-replication#filtered-replication-adv-repl) can be used to decide whether a document should be replicated or not but replication **doesn't** allow you to *transform* the data as it is replicated.

There is a neat trick that allows data to be moved from one database to another, while modifying the `_id` field (or any other field for that matter) in the process. To do this we are going to use two command-line tools:

1. [couchbackup](https://www.npmjs.com/package/@cloudant/couchbackup) - allows CouchDB/Cloudant data be backed-up and stored as text files on your machine. It also comes with a tool to restore that data back to the database, or to a new empty database.
2. [jq](https://stedolan.github.io/jq/) is a JSON processor used to format and modify JSON data structures.

Our process is this:

- export the source data using *couchbackup*.
- transform the backed-up data using *jq*.
- restore the transformed data to a new database using *couchrestore*.

The three actions can be achieved in a single command:

```sh
couchbackup --db cities | jq -c '. | map(._id = .country + ":" + ._id)' | couchrestore --db cities2
```

Let's break that down:

`couchbackup --db cities` simply initiates a backup of the "cities" database. The data is output in batches of several hundred documents with one batch per line e.g.

```js
[{"_id":"52412","country":"US",name:"Boston"},{"_id":"781","country":"UK",name:"Oxford"}]
[{"_id":"152","country":"IN",name:"Malaut"},{"_id":"782","country":"PK",name:"Nārang"}]
```

The jq line `jq -c '. | map(._id = .country + ":" + ._id)'` means:

- `-c` - compact output (one array per line).
- `.` - process the top level JSON object, in this case our array of cities.
- ` | map()` - iterate over every item in the array
- `._id = .country + ":" + ._id` - sets the `_id` field to be the document's `country` attribute followed by a colon followed by the existing `_id`.

The result is a transformed array of countries:

```
[{"_id":"US:52412","country":"US",name:"Boston"},{"_id":"UK:781","country":"UK",name:"Oxford"}]
[{"_id":"IN:152","country":"IN",name:"Malaut"},{"_id":"PK:782","country":"PK",name:"Nārang"}]
```

Piping this data to `couchrestore` populates the new database.

## Other considerations

- the choice of a partition key is very important. Consult [the documentation](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-database-partitioning#what-makes-a-good-partition-key) to pick a partition key that has many values, no hot spots and repeats throughout the data set.
- Design documents that contain index definitions will need careful thought through. An index definition in a partitioned database is itself partitioned by default. Audit your indexes and try to make your most common access patterns are serviced by partitioned queries with an index, as these are the cheapest and most performant.
- Global queries can still be used on a partitioned database but ensure they are backed by a matching `partitioned: false` index. 

