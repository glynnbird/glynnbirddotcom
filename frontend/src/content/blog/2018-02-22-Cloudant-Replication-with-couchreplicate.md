---
title: couchreplicate
pubDate: 2018-02-22T09:00:00.000Z
description: Managing replication from the command-line
heroImage: ../../assets/replication-screenshot.png
---


One of Apache CouchDB&trade;'s killer features is replication. JSON data is easily replicated between data centers, from a mobile device to the cloud, or vice versa. The CouchDB replication protocol is shared by [Apache CouchDB](http://couchdb.apache.org/) itself, the [IBM Cloudant](https://www.ibm.com/cloud/cloudant) database-as-a-service, Cloudant Sync libraries for [iOS](https://github.com/cloudant/CDTDatastore) and [Android](https://github.com/cloudant/sync-android) and the [PouchDB](https://pouchdb.com/) in-browser database. 

Setting up a single replication is as easy as filling in a form in the Replication tab of your Cloudant or CouchDB dashboard:

But what if you have hundreds of databases to replicate? What if you want to move lots of small databases, but only want to replicate 5 at any one time? This is where *couchreplicate* is here to help.

*couchreplicate* is a command-line tool that allows you to kick off and monitor replications with minimal effort.

## Installing couchreplicate

Assuming you already have [Node.js and npm](https://nodejs.org/en/) installed on your machine, *couchreplicate* is installed with a single line:

```sh
$ npm install -g couchreplicate
```
You should now have the `couchreplicate` tool installed on your machine. Check with:

```sh
$ couchreplicate --help
```    
    
## Replicating a single database

Migrating one database is as easy as running *couchreplicate*, supplying your source URL and target URL.

```sh
$ couchreplicate -s http://u:p@localhost:5984/mysource -t https://U:P@HOST.cloudant.com/mytarget
cities [▇▇▇▇▇▇▇▇———————————————————————————] 32% 21.1s triggered
```

Your replication will start and you should see a progress bar start to fill up. You can also supply the database name as a separate `-d` parameter:

```sh
$ couchreplicate -d food -s http://u:p@localhost:5984-t https://U:P@HOST.cloudant.com
```
    
And that database name will be used at both the source and target ends.

## Replicating multiple databases

The tool really comes into its own when replicating more than one database. Simply supply a comma-separated list of database names in your `-d` parameter:

```sh
$ couchreplicate -d food,drink,hardware,software -s http://u:p@localhost:5984-t https://U:P@HOST.cloudant.com
food  [▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇]100% 42.5s completed
drink [▇▇▇▇▇▇▇▇———————————————————————————] 32% 21.1s triggered
```

As one replication completes, another will be scheduled, until the entire list is exhausted.

You can control the number of simultaneous replications with the `-c` parameter:

```sh
$ couchreplicate -c 3 -d food,drink,hardware,software -s http://u:p@localhost:5984-t https://U:P@HOST.cloudant.com
food     [▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇—————] 82% 34.5s triggered
drink    [▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇———————————————] 63% 34.1s triggered
hardware [▇▇—————————————————————————————————————] 10% 34.1s triggered
```

## Replicating all of your databases

Instead of supplying a list of database names, the `-a` option can be used to indicate that *all* of the databases in the source cluster are to be migrated. This is handy if you are moving from local CouchDB to Cloudant, or from one Cloudant service to another.

```sh
$ couchreplicate -c 3 -a -s http://u:p@localhost:5984-t https://U:P@HOST.cloudant.com
```

## It's all about the open source

The *couchreplicate* tool is free to use and is open-sourced under the Apache 2.0 license, so you can fork the code yourself and modify as you see fit. If you find a bug or have a contribution, we'd love to hear from you on the project's [Github page](https://github.com/ibm-watson-data-lab/couchreplicate).

## Further reading

If you like using command-line tools, then there more CouchDB- and Cloudant-compatible tools from the same stable:

- [couchimport](https://www.npmjs.com/package/couchimport) - import your CSV data into CouchDB/Cloudant and export your JSON documents to CSV files
- [couchmigrate](https://www.npmjs.com/package/couchmigrate) - migrate design documents into production without loss of service
- [couchdiff](https://www.npmjs.com/package/couchdiff) - find the difference between two databases

Developers can use Node.js and Cloudant using the following libraries:

- [cloudant-node-sdk](https://github.com/IBM/cloudant-node-sdk) - the official Cloudant Node.js library

<hr>

_Apache®, [Apache CouchDB™, CouchDB™](http://couchdb.apache.org/), and the red couch logo are either registered trademarks or trademarks of the [Apache Software Foundation](http://www.apache.org/) in the United States and/or other countries._
