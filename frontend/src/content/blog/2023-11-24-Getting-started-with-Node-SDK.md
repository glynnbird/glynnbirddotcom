---
title: "The Node SDK"
description: Getting started with Node.js and Cloudant
pubDate: 2023-11-24T15:15:30Z
heroImage: ../../assets/codesdk.png
relCanonical: https://blog.cloudant.com/2023/11/24/Getting-Started-With-Node-SDK.html
---

The benefits of using the [Cloudant Node SDK](https://github.com/IBM/cloudant-node-sdk) instead of writing your own code from scratch are obvious:

- The SDK will handle IAM, basic or cookie authentication for you. No need to worry about cookies of bearer tokens or expiry times.
- The SDKs come with detailed [API documentation](https://cloud.ibm.com/apidocs/cloudant?code=node#introduction) for each function call, with code snippets and guides to the accepted/required paramters and response schemas. There is a clear parallel between a function call e.g. [postFind](https://cloud.ibm.com/apidocs/cloudant?code=node#postfind) and its curl equivalent e.g. [POST /{db}/_find](https://cloud.ibm.com/apidocs/cloudant#postfind) - so as you're learning the programmatic syntax, you're learning the API too!
- The SDKs are supported so that if you have  problem with them, the IBM Support team will be there to help.
- The SDKs contain a [Changes Follower](https://blog.cloudant.com/2023/09/20/Changes-Follower.html) which allows your code to react to changes occurring in a Cloudant database.

The SDKs are also available for [Java](https://github.com/IBM/cloudant-java-sdk), [Python](https://github.com/IBM/cloudant-python-sdk) and [Go](https://github.com/IBM/cloudant-go-sdk), but in this blog post we'll see how to get started with the [Node SDK](https://github.com/IBM/cloudant-node-sdk).

To follow this blog post you will need:

- [Node.js](https://nodejs.org/en/) installed.
- A [Cloudant service and a service credential](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-getting-started-with-cloudant).
- Access to a command-line prompt, such as a Mac Terminal or the [IBM Cloud Shell](https://www.ibm.com/products/cloud-shell).
- A text editor e.g vi, Emacs or Visual Studio Code.

## Installing

For a Node.js project you should already have a `package.json` file that define's your project's meta data. If not you can create one with:

```sh
npm init
```

After following the prompts, it should look something like this:

```js
{
  "name": "nodesdkgettingstarted",
  "version": "1.0.0",
  "description": "Getting started with Cloudant Node SDK",
  "main": "index.mjs",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "Glynn Bird",
  "license": "Apache-2.0"
}
```

> Note: I'm using the file `index.mjs` as the main file because I want to use the more modern `import` (ESM) syntax rather than the `require` syntax for loading dependencies.

We can then install the Cloudant Node SDK using `npm`:

```sh
npm install --save @ibm-cloud/cloudant
```

This will create a "dependencies" entry into the package.json file and create an additional `package-lock.json` file listing the dependent packages needed to run this project.

## Initialising the client

Using your Cloudant service's credentials object, make a note of two items: 

1. The `host` - the domain name of your Cloudant service e.g. `something.cloudant.com`
2. The `apikey` - the IAM API key that wil allow you to authenticate and use the Cloudant service.

We don't want to store these items in our source code, so we can create two environment variables to keep these items safe in our command-line terminal:

```sh
export CLOUDANT_URL="https://something.cloudant.com"
export CLOUDANT_APIKEY="my_secret_apikey"
```

> Note: the Cloudant URL is the string `https://` plus the `host` from your Cloudant credentials. 

In our `index.mjs` source code we can now instantiate the Cloudant SDK client:

```js
import { CloudantV1 } from "@ibm-cloud/cloudant"

// create the Cloudant SDK client
const client = CloudantV1.newInstance({})

const main = async () => {

  // get a list of Cloudant databases
  const info = await client.getAllDbs()
  console.log(info.result)
}

main()
```

> Note: that the Cloudant SDK is automatically picking up our `CLOUDANT_URL` & `CLOUDANT_APIKEY` environment variables because its default service name is "CLOUDANT" and it uses IAM authentication unless instructed otherwise. Other [authentication methods](https://github.com/IBM/cloudant-node-sdk#authentication) are supported, but IAM is usually the best choice.

We can run this script using:

```sh
node index.mjs
[]
```

and the empty array indicates that the Cloudant service has no databases. So let's rectify that.

## Create some data

Let's create a new script called `populate.mjs` which creates a database and writes some documents to the database:

```js
import { CloudantV1 } from "@ibm-cloud/cloudant"

// create the Cloudant SDK client
const client = CloudantV1.newInstance({})
const dbName = 'readings'

const main = async () => {

  // create a database called 'readings'
  await client.putDatabase({ db: dbName })

  // add some documents to our database in batches of 100
  let ts = 1
  const teams = ['red','orange','yellow','green','blue','indigo','violet']
  for(let batch = 0; batch < 20; batch++) {
    const docs = []
    for(let i = 0; i < 100; i++) {
      // create a random document
      const doc = {
        ts: ts++,
        reading: Math.random() * 100,
        team: teams[Math.floor(Math.random()*teams.length)]
      }
      
      // add it to our docs array
      docs.push(doc)
    }
 
    // write the documents to the database
    const response = await client.postBulkDocs({
      db: dbName,
      bulkDocs: { docs }
    })
    console.log(response.result)
  }

  // get information about our database
  const info = await client.getDatabaseInformation({ db: dbName })
  console.log(info.result)
}

main()
```

This script:

- Creates a database called `readings` using the  [putDatabase](https://cloud.ibm.com/apidocs/cloudant?code=node#putdatabase) function.
- Erites batches of 100 documents to the database using [postBulkDocs](https://cloud.ibm.com/apidocs/cloudant?code=node#postbulkdocs) in a for loop.
- Gets and prints the information about our database using [getDatabaseInformation](https://cloud.ibm.com/apidocs/cloudant?code=node#getdatabaseinformation).

After running the script with:

```sh
node populate.mjs
```

the end of the output should contain the `readings` database's meta data e.g.

```js
{
  update_seq: '2000-abc',
  instance_start_time: '1700825690',
  db_name: 'readings',
  purge_seq: 0,
  sizes: { file: 1445424, external: 79173, active: 419724 },
  props: {},
  doc_del_count: 0,
  doc_count: 2000,
  disk_format_version: 8,
  compact_running: false,
  cluster: { q: 16, n: 3, w: 2, r: 2 }
}
```

Notice the `doc_count` now reads 2000 as we inserted 20 batches of 100 documents.

Next we can read back the documents we have just written.

## Reading the documents

Let's create a new script called `read.mjs` which loads the first 5 documents from our database:

```js
import { CloudantV1 } from "@ibm-cloud/cloudant"

// create the Cloudant SDK client
const client = CloudantV1.newInstance({})
const dbName = 'readings'

const main = async () => {

  // get a list of documents, including the document bodies for 5 documents
  const response = await client.postAllDocs({ 
    db: dbName,
    includeDocs: true,
    limit: 5
  })
  console.log(response.result.rows.map((r) => { return r.doc }))
}

main()
```

This script uses the [postAllDocs](https://cloud.ibm.com/apidocs/cloudant?code=node#postalldocs) function to fetch the first five documents, including the document bodies, from the database. It uses a "map" operation to extract only the document bodies from the response and outputs them.

We can see our programmatically-generated data for the first time!

```js
[
  {
    _id: '046e9929131a2f6e6131af90f9bed3b9',
    _rev: '1-c1af2c94d31e9f50448323f9a64b58f8',
    ts: 1,
    reading: 49.68332523867198,
    team: 'indigo'
  },
  {
    _id: '046e9929131a2f6e6131af90f9bed7de',
    _rev: '1-ae2869dccbcb7fb2b93ecce6479afb49',
    ts: 2,
    reading: 93.10890845706052,
    team: 'violet'
  },
  {
    _id: '046e9929131a2f6e6131af90f9bee137',
    _rev: '1-d150b67ae4d5fc7a518ac151efc28a99',
    ts: 3,
    reading: 18.16042938529261,
    team: 'green'
  },
  {
    _id: '046e9929131a2f6e6131af90f9bee8ef',
    _rev: '1-1023d2e63a5912a464a7bb2a91e0266b',
    ts: 4,
    reading: 40.39009981141286,
    team: 'blue'
  },
  {
    _id: '046e9929131a2f6e6131af90f9bef82f',
    _rev: '1-1f4dfe2d04b98edce0e0379c3b0bc3a4',
    ts: 5,
    reading: 61.503188212279134,
    team: 'blue'
  }
]
```

Notice:

- Each document has a Cloudant-generated `_id`. As we didn't supply a document id, Cloudant generated one for us.
- Each document has a revision token.
- Our documents data includes a `ts` (timestamp), a `reading` between 0 and 100 and a rainbow-themed `team`.

If we wanted only a single team's data we would have to supply a query to Cloudant, but before we do that, we can create an index to allow us to efficiently query our data.

## Creating an index

An index is a secondary data structure that sits along side the primary data, rather like a book's index sits beside the publication's main pages. Rather like a book's index, it allows information to be found quickly, without having to examine all of the content in turn.

Let's create a new script `createindex.mjs`:

```js
import { CloudantV1 } from "@ibm-cloud/cloudant"

// create the Cloudant SDK client
const client = CloudantV1.newInstance({})
const dbName = 'readings'

const main = async () => {

  // create an index on team & ts, to allow us to fetch a single team's
  // data in time order
  const response = await client.postIndex({
    db: dbName,
    ddoc: 'my-index',
    name: 'byTeam',
    index: {
      fields: ['team', 'ts']
    },
    type: 'json'
  })
  console.log(response.result)
}

main()
```

This script creates a new index on two fields: `team` and `ts`. This will allow us to fetch documents with a known value `team` and the results will be presented in ts-order (i.e. ordered by time).

If we run the script with:

```sh
node createindex.mjs
```

The output will confirm that an index has been created:

```js
{ result: 'created', id: '_design/my-index', name: 'byTeam' }
```

Now we can query a single team's documents from the database and the results will be powered by the index.

## Querying a single team's data

Let's create another script `query.mjs`

```js
import { CloudantV1 } from "@ibm-cloud/cloudant"

// create the Cloudant SDK client
const client = CloudantV1.newInstance({})
const dbName = 'readings'

const main = async () => {

  // find the first 5 documents whose team is 'green' in timestamp order
  const response = await client.postFind({
    db: dbName,
    selector: {
      team: {
        $eq: 'green'
      }
    },
    sort: ['ts'],
    limit: 5
  })
  console.log(response.result)
}

main()
```

Note:

- The `selector` key defines the slice of data required, in this case documents belonging to the green team. This is like the 'WHERE' clause of a SQL query.
- The `sort` key defines the order in which data is returned - in timestamp order (ascending) in this case.
- The `limit` field defines how many documents are returned.
- When presented with a Cloudant query, the database will look for the best secondary index available to answer the query. If it cannot find one, then a very slow sequential scan will take place and performance will suffer. 

Running this script with

```sh
node query.mjs
```

shows the first five documents that are in the 'green' team, in timestamp order:

```js
{
  docs: [
    {
      _id: '046e9929131a2f6e6131af90f9bee137',
      _rev: '1-d150b67ae4d5fc7a518ac151efc28a99',
      ts: 3,
      reading: 18.16042938529261,
      team: 'green'
    },
    {
      _id: '046e9929131a2f6e6131af90f9bf041c',
      _rev: '1-cc879c081406c9872933a9b331b36e4c',
      ts: 6,
      reading: 18.859494900575456,
      team: 'green'
    },
    {
      _id: '046e9929131a2f6e6131af90f9bf066b',
      _rev: '1-51d66e25bfc813f73eb3d2836a9c9e0d',
      ts: 7,
      reading: 9.761159072801062,
      team: 'green'
    },
    {
      _id: '046e9929131a2f6e6131af90f9bf0fec',
      _rev: '1-f705e7984b0cdfb897251868a4ca1fb6',
      ts: 9,
      reading: 55.95670210577859,
      team: 'green'
    },
    {
      _id: '046e9929131a2f6e6131af90f9bf5bb3',
      _rev: '1-cdffe1148a607f1b422cdea28d95f749',
      ts: 17,
      reading: 40.01597659297287,
      team: 'green'
    }
  ],
  bookmark: 'g1AAAABd'
}
```

## Further reading

Now we've started to use the Cloudant Node SDK to connect to Cloudant, create a database, add some documents, create an index and perform a query, there's still more to learn:

- [Cloudant Documentation](https://cloud.ibm.com/docs/Cloudant/getting-started.html)
- [Cloudant API Reference](https://cloud.ibm.com/apidocs/cloudant#introduction)
- [Cloudant Blog](https://blog.cloudant.com)
