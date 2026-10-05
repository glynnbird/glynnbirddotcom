---
title: Command-line tools
pubDate: 2015-10-19T09:00:00.000Z
description: Backup, shell, migration and more
heroImage: ../../assets/cli.png
relCanonical: https://blog.cloudant.com/2015/10/19/Command-line-tools-for-Cloudant.html
---


Some developers spend their days dragging and dropping in a graphical user interface, others are more comfortable typing green letters into a black background on a command-line terminal. If you are the latter type of developer, then this blog post is for you. We introduce a range of command-line tools that you can use to interface with [IBM Cloudant](https://www.ibm.com/products/cloudant) (or plain [Apache CouchDB](https://couchdb.apache.org/)).

Cloudant and CouchDB share an RESTful HTTP API allowing access from any programming language or from the command-line using the [curl](https://curl.haxx.se/) utility. The packages featured in this blog post are all free to download and open-source, allowing you to fork and modify them for your own purposes.

## ccurl

Most Cloudant & CouchDB developers use [curl](https://curl.haxx.se/) to access the RESTful HTTP API. The trouble with curl is that the commands can get overly long, with lots of repetition between commands, for example:

```sh
curl -X POST -H 'Content-type: application/json' \
  -g 'https://myusername:mypassword@myhost.cloudant.com/mydb' \
  -d '{"val": "json"}'
```

The utility [ccurl](https://www.npmjs.com/package/ccurl) is a wrapper around [curl](https://curl.haxx.se/) that removes some of the repetition. It adds the following features:

* The protocol, username, password and hostname are not required; instead they are taken from an environment variable.
* The content-type header 
* The ["-g" fix](https://glynnbird.tumblr.com/post/61760654532/making-curl-play-nice-with-couchdb) 


Configuring *ccurl* is a one-off task: simply set your Cloudant or CouchDB URL as the `COUCH_URL` environment variable:

```sh
export COUCH_URL="https://myusername:mypassword@myhost.cloudant.com"
```

or

```sh
export COUCH_URL="http://localhost:5984"
```

*ccurl* makes command-line API requests much less verbose, as these examples show: 

```sh 
# fetch stats about database ‘mydb’
ccurl /mydb

# fetch single document
ccurl /mydb/12345

# add a document
ccurl -X POST -d'{"a":1,"b":2}' /mydb
```

| Name        | Description               | URL                                    | Installation                   |
| ----------- | ------------------------- | -------------------------------------- | ------------------------------ |
| ccurl       | A curl helper for CouchDB | [ccurl](https://www.npmjs.com/package/ccurl)    | `npm install -g ccurl`         |

## jq

Simplify dealing with JSON on the command line by installing the [jq](https://stedolan.github.io/jq/) utility, which parses and filters JSON strings. In this example, *jq* takes the stream of data coming from *ccurl*, and turns it into nicely formatted, coloured terminal output:

```sh
ccurl /mydb/12345 | jq .
```

You can supply arguments to the *jq* command. For example:

```sh
ccurl /mydb/12345 | jq .geometry.coordinates
```

fetches the coordinates from the geometry object included within the JSON object returned by the *ccurl* command. *jq* has its own syntax that allows JSON objects to be filtered, manipulated and queried. See the [jq website](https://stedolan.github.io/jq/) for further details.

| Name        | Description                                | URL                                    | Installation                   |
| ----------- | ------------------------------------------ | -------------------------------------- | ------------------------------ |
| ccurl       | A lightweight command-line JSON processor  | [jq](https://stedolan.github.io/jq/)         | manual                         |

## couchimport

If you have CSV files containing data which you need to upload to Cloudant or CouchDB, then [couchimport](https://www.npmjs.com/package/couchimport) can import the files. The following sequence of shell commands download a dataset containing US crime data, unzip it, creates a new CouchDB database, and finally imports the CSV data by piping the file to the *couchimport*:

> Note: The crime data for the `curl` command below has been removed

```sh
curl 'https://data.octo.dc.gov/feeds/crime_incidents/archive/crime_incidents_2013_CSV.zip' > crime.zip
unzip crime.zip
ccurl -X PUT /crime
cat crime_incidents_2013_CSV.csv | csvtojsonlines --delimiter ',' | couchimport --db crime 
```

Once again, *couchimport* uses the same `COUCH_URL` environment variable to determine the database to write to. *couchimport* can also be used programmatically to allow your Node.js applications to import CSV files or streams into CouchDB or Cloudant.

| Name        | Description               | URL                                       | Installation                   |
| ----------- | ------------------------- | ----------------------------------------- | ------------------------------ |
| couchimport | A CSV import utility      | [couchimport](https://www.npmjs.com/package/couchimport) | `npm install -g couchimport`   |

# couchmigrate

When changing a database’s design documents, you need to take care that users of the database don’t suffer performance issues as the new index rebuilds. The [couchmigrate](https://www.npmjs.com/package/couchmigrate) utility creates a new design document, waits for the index to build, and finally makes the index live.

For example, if our new design document is in a file `dd.json`, we could run the following command:

```sh
couchmigrate --dd dd.json --db movies
```

This command blocks use until the views defined in dd.json are ready to use.

| Name         | Description                         | URL                                        | Installation                    |
| ------------ | ----------------------------------- | ------------------------------------------ | ------------------------------- |
| couchmigrate | A design document migration utility | [couchmigrate](https://www.npmjs.com/package/couchmigrate) | `npm install -g couchmigrate`   |



