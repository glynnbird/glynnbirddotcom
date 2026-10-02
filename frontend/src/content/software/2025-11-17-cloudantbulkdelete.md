---
title: cloudantbulkdelete
pubDate: 2025-11-17T00:00:00.000Z
description: Bulk deletion CLI tool for Cloudant, written in Go
heroImage: ../../assets/gary-chan-YzSZN3qvHeo-unsplash.jpg
---

> The source code for this utility is here https://github.com/glynnbird/cloudantbulkdelete

A command-line utility that assists in the deletion of many documents from a Cloudant database. The tool expects a Cloudant Query "selector" that defines the slice of data that is to be deleted. The tool can be paired with [cloudantimport](https://github.com/glynnbird/cloudantimport) which will batch the changes into bulk writes to the database.

## Installation

You will need to [download and install the Go compiler](https://go.dev/doc/install). Clone this repo then:

```sh
go build ./cmd/cloudantbulkdelete
```

The copy the resultant binary `cloudantbulkdelete` (or `cloudantbulkdelete.exe` in Windows systems) into your path.

## Configuration

`cloudantbulkdelete` authenticates with your chosen Cloudant service using environment variables as documented [here](https://github.com/IBM/cloudant-go-sdk/blob/v0.10.8/docs/Authentication.md#authentication-with-environment-variables) e.g.

```sh
CLOUDANT_URL=https://xxxyyy.cloudantnosqldb.appdomain.cloud
CLOUDANT_APIKEY="my_api_key"
```

## Usage


```sh
# delete documents where team="red" OR date >= '2020-02-01'
$ cloudantbulkdelete --db users --selector '{"$or":[{"team":{"$eq":"red"}},{"date": {"$gte": "2020-02-01"}}]}'
{"_id":"e15a6a03f75d844a0ac117a3a742f589","_rev":"1-c4f1369224db88c99fa8020c2f177477","_deleted":true}
{"_id":"e15a6a03f75d844a0ac117a3a748a0d0","_rev":"1-c9b0eb03324c3e744b0068e04f36fb52","_deleted":true}
...

```

The tool outputs the deletion JSON to stdout so that it can be inspected for accuracy. To actually delete the data, install [cloudantimport](https://github.com/glynnbird/cloudantimport) and use the two tools together:

```sh
cloudantbulkdelete --db users --selector '{"team":"red"}' | cloudantimport --db users
```

It is also possible to find the documents to delete from one database and attempt to delete them from another!

```sh
cloudantbulkdelete --selector '{"team":"pink"}' --db mydb1 | cloudantimport --db mydb2
```

## How does this work?

A filtered changes feed is set up, using the supplied _selector_ as the filter. Any documents meeting the selector's criteria are turned into JSON objects which when written to Cloudant would delete the documents. The cloudantimport utility already batches and writes data in bulk to Cloudant, so there's no need to copy that code to this tool.
