---
title: Design Docs For Life
pubDate: 2019-08-16T06:00:00.000Z
description: All about Cloudant Design Documents.
heroImage: ../../assets/kelly-sikkema-o2TRWThve_I-unsplash.jpg
relCanonical: https://blog.cloudant.com/2019/08/16/Design-Docs-For-Life.html
---

A Design Document is a special Cloudant document whose `_id` field begins with `_design/` e.g. `_design/search`. It stores meta data about a secondary index or indexes: the name of the index, which fields are to be indexed etc. Design documents are created in one of two ways:

1. You create and update them manually as you would for any normal Cloudant document. This method is required for [MapReduce](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-creating-views-mapreduce) views and [Cloudant Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search) indexes.
2. They are created for you when you instruct the database to create a [Cloudant Query](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query) index using the `POST /db/_index` endpoint. Such design documents are not intended for you to maintain - they merely record state for the Cloudant Query service.

## View building

When a Design Document is created, whether by hand or via Cloudant Query, Cloudant asynchronously begins to build the index. Indexing requires Cloudant to trawl through each document in the database in turn to build the index - in fact, as a Cloudant database is split into many (sixteen by default) pieces called _shards_ the index builds independently on each shard copy. If the database document count is significant, it may take some time to finish the indexing process. 

You can query a view before the index has finished building, but you will not get a response until indexing is complete. You can check on the progress of an indexing job by querying the [\_active\_tasks](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-active-tasks) endpoint.

## Design Document Tips

### Cloudant Query indexes can be more efficient than MapReduce

The MapReduce engine requires Cloudant to execute your JavaScript map function using a JavaScript engine where as Cloudant Query work stays within the Erlang space of Cloudant's core. As a result, Cloudant Queries are more efficient to build than their MapReduce equivalents.

### Store data in a index-friendly way

Cloudant Query doesn't give you the opportunity to modify the data prior to indexing (as can be achieved in a JavaScript map function) so it is important to store data in the form that is suitable for querying. With only a handful of indexed fields, many of your application access patterns can be queried optimally.

### Partial Indexes are smaller

If you only need to index a sub-set of a database with Cloudant Query then a [partial index](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query#creating-a-partial-index) can make the index smaller and more efficient by applying a filter _selector_ at indexing time. A similar effect is achieved with an `if` statement in a MapReduce or Search index:

```js
function(doc) {
  // we only want totals of paid orders
  if (doc.type === 'order' && doc.status === 'paid') {
  
    // build in index of order value by date, but only for paid-for orders
    emit(doc.date, doc.total)
  }
}
```

A small index requires fewer computing resources to manage so should be faster to query.

### Use meaningful names

After using Cloudant for a while, you might find yourself staring at an index definition and wondering what it is for, who created it and whether it is still needed. Having a good naming convention is important in most software projects, and this applies to design document management too. Here are some ideas:

- Keep global indexes and partitioned indexes separate e.g. `global/orderValueByDate`, `partitioned/userOrdersByTime`.
- Ensure that the name of the index reflects the access pattern it is built to service e.g. `eventsByType`, `salesByYearMonthDay`, `booksByAuthor`.
- Add comments into JavaScript view and search index definitions to explain non-obvious code and which part of your application uses the index.
- You may wish to _version_ your view names to allow a smooth migration from one version of your code to another `e.g. salesReport/productCountByDatev5`.

### Partitioned indexes are faster

If your data can be moulded into a Partitioned Database model, then queries that are directed to a single partition will execute faster and be charged less per query than their global equivalents. 

### Specify use_index

When querying using Cloudant Query, supply [use_index](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query#finding-documents-by-using-an-index) when you know which index you intend Cloudant to use to answer your query.

### Use the "explain" API

Learn how to use the [explain API](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query#explain-plans) which describes which index would be used to answer an individual query. 

## Automated testing for JavaScript

JavaScript map functions are *just code* and are as susceptible to bugs and typos as any other source code. It's worth running your map functions through an automated test suite, to ensure that your code is emitting the correct keys and values in all circumstances. Here's an example test suite for a map function:

```js
const map = require('./designdocs/global.js').views.byDeviceId

let emittedValues = []

const emit = function(key, value) {
  emittedValues.push({key: key, value: value})
}

const index = function(key, value) {
  emittedValues.push({key: key, value: value})
}

const reset = function() {
  emittedValues = []
}

test('Ensure nothing is emitted for person documents', function() {
  const doc = {
    _id: '123',
    _rev: '1-2324',
    type: 'person',
    x: 1
  }
  reset()
  map(doc)
  expect(emittedValues.length).toEqual(0)
}

test('Ensure order date and value is emitted for paid order documents', function() {
  const doc = {
    _id: '123',
    _rev: '1-2324',
    type: 'order',
    date: '2018-02-42',
    total: 56.22,
    status: 'paid'
  }
  reset()
  map(doc)
  expect(emittedValues).toEqual(['2018-02-42', 56.22])
}
```

The above code uses the [Node.js Test Runner](https://nodejs.org/api/test.html) and exercises our map function to ensure that it behaves correctly with the right stimulus. Dummy "emit"/"index" functions collect the emitted keys and values where they can be checked by your test code.

Note: Automated testing can help catch syntax errors and logical edge cases, but exactly reproduce how Cloudant's JavaScript engine will execute your map functions, your test suite would have to use the same version of SpiderMonkey JavaScript engine.

## Lifecycle management for Design Documents

Understanding the lifecycle of indexes is important when it comes to your application's configuration management.

1. CREATE - When a Design Document that contains index definitions is first saved, the process of building the index begins. Each copy of each shard of the database builds the index independently and in parallel. The index is not usable until all the processes are complete.
2. UPDATE - When a Design Document that alters one or more MapReduce indexes is updated, **all of the MapReduce indexes in the same document are invalidated** and become unusable until they are rebuilt, The same rule *does not* apply to Cloudant Search indexes - only changed indexes are invalidated.
3. DELETE - When a Design Document is deleted, the indexes are invalidated and the disk space occupied by its indexes will be recovered in due course.

There are some subtleties too:

- Two indexes that have an identical definition but are defined in different design documents will be shared. Two indexes are deemed to be identical if the hash of their definitions are the same, including whitespace in JavaScript functions. A shared index is only actually deleted when all of its defining design documents are removed.
- If a Design Document is modified to remove a single index definition, any other MapReduce definitions (that aren't defined elsewhere) will be invalidated. Be careful that in tidying up unwanted indexes you don't temporarily invalidate other indexes.
- As Cloudant Search indexes are updated independently, it makes sense to have all of your Cloudant Search definitions in a single design document.
- Design Documents have the same create/update/delete semantics as normal Cloudant documents: they are updated and deleted with a known revision token and may become conflicted if modified differently on disconnected copies.
- When replicating databases to another Cloudant cluster, the design documents will be replicated too and will begin building on the target side. If design documents are not required at the target side, they can be filtered out with a [Cloudant Query selector](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-design-documents#the-_selector-filter).

The above semantics can used to ensure an orderly transition from one version of an index to another.

## Design Document change control

With a large data set and significant index build times, care must be taken when deploying new versions of design documents if the the views are to be available at all times. Taking advantage of the subtle behaviour of design documents and their indexes, the following algorithm can be implemented to avoid downtime for the indexes defined by design document "ddoc":

1. Copy old design document to `ddoc_OLD`.
2. Save new design document to `ddoc_NEW`.
3. Trigger the view/search to make sure it builds.
4. Poll the view to see if it has finished building.
5. Copy `ddoc_NEW` to the `ddoc`.
6. Delete `ddoc_NEW`
7. Delete `ddoc_OLD`

This relatively convoluted series of steps has been implemented into a command-line tool [couchmigrate](https://www.npmjs.com/package/couchmigrate) which performs the design document dance on your behalf.

> Note `couchmigrate` is not an IBM tool and is not supported.
