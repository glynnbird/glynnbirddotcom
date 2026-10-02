---
title: couchgenerator
pubDate: 2022-05-22T00:00:00.000Z
description: Traffic generator utility for the Cloudant/CouchDB API
heroImage: ../../assets/dima-solomin-8gXzLPWPu7E-unsplash.jpg
---

> The source code for this utility is here https://github.com/glynnbird/couchgenerator

A simple CouchDB data generation tool. Generates a stream of user document inserts, updates and deletes to a nominated database. A random batch size is chosen. Approximately 5% of the batch will be updates, 5% deletes and 90% inserts. 

Handy if you're testing a CouchDB changes feed. In addition, some single document fetches and `_all_docs` queries will be issued to simulate query load.

## Installation

You'll need Node.js & npm. Then run:

```sh
npm install -g couchgenerator
```

## Usage

`couchgenerator` needs to know your CouchDB URL (including access credentials) and the database name you want to write to. They can be supplied either by environment variables of command-line parameters or a mix of both.


### Command-line parameters

- `--url`/`-u` - the URL of the CouchDB instance e.g. `http://admin:mypassword@localhost:5984`
- `--database`/`--db`/`-d` - the name of the database to write to e.g. `users`
- `--template`/`-t` - the path of template file e.g. ./mytemplate/products.json

```sh
couchgenerator --url 'http://admin:mypassword@localhost:5984' --db users
2022-05-27T12:53:08.896Z { inserts: 295, updates: 0, deletes: 0, ops: 295 }
2022-05-27T12:53:10.001Z { inserts: 247, updates: 10, deletes: 16, ops: 568 }
2022-05-27T12:53:11.134Z { inserts: 331, updates: 21, deletes: 14, ops: 934 }
``` 

### Environment variables

- `COUCH_URL`
- `COUCH_DATABASE`
- `IAM_API_KEY` - for IBM IAM authentication

```sh
export COUCH_URL='http://admin:mypassword@localhost:5984'
couchgenerator --db users
2024-12-10T14:07:42.527Z { inserts: 11, updates: 0, deletes: 0, reads: 26, queries: 8 }
2024-12-10T14:07:43.813Z { inserts: 10, updates: 3, deletes: 0, reads: 2, queries: 7 }
2024-12-10T14:07:45.194Z { inserts: 13, updates: 0, deletes: 1, reads: 7, queries: 8 }
```

## Programmatic usage

```js
import couchgenerator from 'couchgenerator'
await couchgenerator({ url: MYURL, db: MYDB, template: './mytemplate.txt' })
```

## Using a custom document template

By default, `couchgenerator` creates documents that look like users. If you want to fill a database with other data types, then simply create a template file `template.txt`:

```js
{
  "_id": "{{uuid}}",
  "name": "{{name}}",
  "email": "{{email}}"
}
```

and pass the path to the file as the `--template` parameter:

```
couchgenerate --db products --template './path/to/template.txt'
```

The tags you can use to generate data values are listed in the [datamaker README](https://www.npmjs.com/package/datamaker).
