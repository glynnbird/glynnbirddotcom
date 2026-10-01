---
title: "Bulk Delete"
description: How to bulk delete data in Cloudant
pubDate: 2025-05-20T09:00:00Z
heroImage: ../../assets/pawel-czerwinski-RkIsyD_AVvc-unsplash.jpg
---

# Bulk Delete

A common request from Cloudant users is "how do I bulk delete data?". In a SQL database we might do:

```sql
-- delete rows where the team is red or blue and the date is older than 2025
DELETE FROM mytable WHERE (team='red' OR team='blue')  AND date < '2025-01-01';
```

but no such API exists in Cloudant. In this blog post we'll explore different ways of deleting data in bulk.

## Deleting whole databases

The easiest and quickest way to remove data in Cloudant is to delete whole databases using the [DELETE /{db}](https://cloud.ibm.com/apidocs/cloudant#deletedatabase) endpoint which removes all of the primary documents and any secondary indexes instantly, regardless of the database's size.

This method works nicely for applications whose data is organised in time boxes e.g. one database per month. Removing an entire month's data is as simple as deleting the corresponding database.

This method leaves behind no tombstones - the entire database is deleted quickly and easily.

## Deleting known documents

If the id & revs of the documents that are to be deleted are known, then there are two API calls of interest:

1. Delete individual documents with [DELETE /{db}/{doc_id}](https://cloud.ibm.com/apidocs/cloudant#deletedocument).
2. Delete batches of documents with [POST /{db}/_bulk_docs](https://cloud.ibm.com/apidocs/cloudant#postbulkdocs).

It is, however, unlikely that a list of document `_id` and `_rev` values are known. Much more likely is that a subset of the data is to be deleted, and that subset is defined by a _query_. The rest of the blog post will show how this use-case can be solved.

## Page through `_find` results

One way to delete documents fed from the result of a query is to repeatedly perform a [POST /{db}/_find](https://cloud.ibm.com/apidocs/cloudant#postfind) query using a _selector_ that defines the slice of data needed to be deleted, and then deleting the resultant documents. Here's some sample code that uses the Cloudant Node SDK to do just that:

```js
import { ChangesFollower, CloudantV1 } from '@ibm-cloud/cloudant'

async function main() {

  // create Cloudant client
  const cloudant = CloudantV1.newInstance()

  // variables
  let batchSize = 0
  let total = 0

  // loop until we get no more results
  do {
    // perform a query to find 200 id/rev pairs that have a
    // "team" attribute that is a single colour
    const response = await cloudant.postFind({
      db: 'mydb',
      selector: {
        team: 'yellow'
      },
      fields: ['_id', '_rev'],
      limit: 200
    })
    console.log('Find - HTTP Response', response.status, response.statusText)

    // loop through the resultant docs to turn them
    // into the input of a bulk_docs call
    const docs = response.result.docs.map((d) => {
      // add a deleted flag
      d._deleted = true
      return d
    })
    batchSize = docs.length

    // delete the documents we have found, if we have a 
    // non-zero batch size
    if (batchSize) {
      console.log('Deleting', batchSize)
      await cloudant.postBulkDocs({
        db: 'mydb',
        bulkDocs: {
          docs
        }
      })
    }

    // update total
    total += batchSize
    console.log('total', total)

  } while (batchSize > 0) // stop when we get an empty result

}

main()
```

The above code repeatedly uses Cloudant Query to find 200 documents matching the slice of data we want to retrieve (defined with the Cloudant Query `selector`) and then deletes them using the bulk API.

> Note: The code does not use a `bookmark` to iterate through a result set. Using a bookmark while altering the data set that is being traversed is not recommended, as it may miss some matching documents.

This approach _works_ but is inefficient. Imagine a database with a billion documents and where the documents to be deleted are scarce. Each query may have to scan many, many documents to find 200 matching id/rev pairs to delete. Each subsequent query will be even more inefficient than the last as the matching data becomes scarcer still.

## Page through `_find` results - with an index

To speed up the Cloudant Query performance we need an index that matches the query we are going to perform. In our case, the answer is obvious: as we are using a selector of `{"team":"yellow"}` we need an index on the `team` field.

The procedure would be:

1. Create an index that matches the selector that will be used to find the data to delete using the [POST /{db}/_index](https://cloud.ibm.com/apidocs/cloudant#postindex) endpoint. Wait for the index to build
2. Run the above script until all of the data is deleted.
3. Delete the index from step 1.

This will be much more efficient than our first attempt, but it does involve defining an index, waiting for it to build and then removing it. Every batch of deletions causes Cloudant to deindex the deleted documents from the index, adding to the workload.

There is also the problem that some Cloudant Query selectors cannot be helped by an index at all e.g. queries using `$or`/`$in`/`$not`/`$regex`/`$elemMatch`. That is if our target selector was:

```js
// find documents that are either in team "red" or team "blue" and whose
// date is less that the start of 2025
{
  "$and": [
    {
      "$or": [
       { "team" : "red" },
       { "team": "blue" }
      ]
    },
    {
      "date": {
        "$lt": "2025-01-01"
      }
    }
  ]
}
```

we wouldn't be able to devise an index to fully optimise the query.

## Deleting from a filtered changes feed

Another approach is to iterate through a Cloudant database's changes feed, deleting the documents it finds. This is similar to our query-based approach, but no index is required as the changes feed has a mechanism to filter on a `selector` so the code turns out to be pretty similar:

```js
import { CloudantV1 } from '@ibm-cloud/cloudant'

async function main() {

  // create Cloudant client
  const cloudant = CloudantV1.newInstance()

  // variables
  let batchSize = 0
  let total = 0
  let since = '0'

  // loop until we get no more results
  do {
    // perform a query to find 200 id/rev pairs that have a
    // "team" attribute that is a single colour
    const response = await cloudant.postChanges({
      db: 'mydb',
      since,
      selector: {
        team: 'yellow'
      },
      filter: '_selector',
      limit: 200
    })
    console.log('Changes - HTTP Response', response.status, response.statusText)

    // loop through the resultant docs to turn them
    // into the input of a bulk_docs call
    const docs = response.result.results.map((d) => {
      const doc = {
        _id: d.id,
        _rev: d.changes[0].rev,
        _deleted: true
      }
      return doc
    })
    batchSize = docs.length
    since = response.result.lastSeq

    // delete the documents we have found, if we have a 
    // non-zero batch size
    if (batchSize) {
      console.log('Deleting', batchSize)
      await cloudant.postBulkDocs({
        db: 'mydb',
        bulkDocs: {
          docs
        }
      })
    }

    // update total
    total += batchSize
    console.log('total', total)

  } while (batchSize > 0) // stop when we get an empty result

}

main()
```

> Note: the changes feed only guarantees to return a change _at least once_, not _only once_, so it is possible to see the same document more than once, which may inflate the final totals seen in the script's output.


## couchbulkdelete

The [couchbulkdelete](https://www.npmjs.com/package/couchbulkdelete) command-line tool when combined with [couchimport](https://www.npmjs.com/package/couchimport) cleanly deletes a slice of data from a database given any selector without the need to write any code. It works using the changes feed method, streaming the changes, organising them into batches and bulk deleting them.

Assuming both packages are installed and the Cloudant URL and credentials are safely stored in environment variables, it is used as follows:

```sh
# find documents with a selector and turn them into objects
# suitable for POSTing to bulk_docs
couchbulkdelete --db mydb --selector '{"team":"yellow"}'
{"_id":"2b9c2719e5877fb1dd8a7ab1b5ab68b1","_rev":"1-0142e228a947bbf490b2065342e0f175","_deleted":true}
{"_id":"2b9c2719e5877fb1dd8a7ab1b5ab75b2","_rev":"1-0142e228a947bbf490b2065342e0f175","_deleted":true}
{"_id":"2b9c2719e5877fb1dd8a7ab1b5aba052","_rev":"1-0142e228a947bbf490b2065342e0f175","_deleted":true}
{"_id":"2b9c2719e5877fb1dd8a7ab1b5abdab0","_rev":"1-0142e228a947bbf490b2065342e0f175","_deleted":true}
{"_id":"2b9c2719e5877fb1dd8a7ab1b5a5dfba","_rev":"1-0142e228a947bbf490b2065342e0f175","_deleted":true}
...
```

We haven't actually deleted anything yet - we have just located a list of documents that match our _selector_ and turned them into objects ready to be bulk uploaded to Cloudant. Piping this list to `couchimport` will cause these documents to be deleted in batches:

```sh
couchbulkdelete --db mydb --selector '{"team":"yellow"}' | couchimport --db mydb
Reading data from stdin
written {"batch":1,"batchSize":500,"docSuccessCount":500,"docFailCount":0,"statusCodes":{"201":1},"errors":{}}
written {"batch":2,"batchSize":500,"docSuccessCount":1000,"docFailCount":0,"statusCodes":{"201":2},"errors":{}}
written {"batch":3,"batchSize":500,"docSuccessCount":1500,"docFailCount":0,"statusCodes":{"201":3},"errors":{}}
written {"batch":4,"batchSize":168,"docSuccessCount":1668,"docFailCount":0,"statusCodes":{"201":4},"errors":{}}
Import complete
```

The database name can be stored in an environment variable to shorten the command sequence:

```sh
export COUCH_DATABASE="mydb"
couchbulkdelete --selector '{"team":"yellow"}' | couchimport
```

The changes-feed method can easily handle complex selectors. Any Cloudant Query operators can be used, including `$regex`:

```sh
couchbulkdelete --selector '{"$and":[{"$or":[{"team":"red"},{"team":"blue"}]},{"date":{"$lt":"2025-01-01"}}]}' | couchimport
```

If SQL is easier to understand, then simple SQL "where" clauses can be used instead of a JSON selector:

```sh
couchbulkdelete --where "(team='red' OR team='blue') AND date<'2025-01-01'" | couchimport
```

This method has some advantages:

- The changes feed is only traversed once.
- No secondary index is required as no Cloudant Query calls are made.
- Any selector can be used, even one which would be impossible to optimise with an index, such as regular expressions.
- The query can be expressed as a SQL "where" clause.

> Note: `couchbulkdelete` is a third-party open-source package and not supported by the IBM Cloudant team. 
