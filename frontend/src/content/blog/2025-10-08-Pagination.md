---
title: "Pagination"
description: Cloudant SDKS now feature pagination for multi-document APIs.
pubDate: 2025-10-03T00:00:00+00:00
heroImage: ../../assets/patrick-tomasso-Oaqk7qqNh_c-unsplash.jpg
---

Cloudant has several multi-document APIs including:

- [POST /{db}/_all_docs](https://cloud.ibm.com/apidocs/cloudant#postalldocs) - extract data from the primary index.
- [POST /{db}/_find](https://cloud.ibm.com/apidocs/cloudant#postfind) - query data within documents, backed by secondary indexes.
- [POST /{db}/_design/{ddoc}/_search/{index}](https://cloud.ibm.com/apidocs/cloudant#postsearch) - search for data indexed with an Apache Lucene index.
- [POST /{db}/_design/{ddoc}/_view/{view}](https://cloud.ibm.com/apidocs/cloudant#postview) - query a MapReduce view.
- Plus all of the above operating on a single partition in a partitioned Cloudant database.

Each of these APIs supports pagination, but different techniques are required depending on the API. Sometimes its `skip`/`limit`, sometimes `startkey`/`endkey`, sometimes a `bookmark` is required.

Now the Cloudant SDKs now include a (Beta) pagination feature which presents a unified API for paging through result sets, iterating by page or by row.

- One API for paging through any of the multi-document endpoints.
- Automatic handling of bookmarks and key range calculations.
- Consume documents piecemeal or in batches.
- Uniformity with other IBM Cloud SDKs.

In this blog post we'll present some sample code for using the pagination API with each of the multi-document API calls.

> ⚠️ **Note**: the pagination API can chain multiple queries together in quick succession - enough successive API calls to exhaust small Cloudant plans of their query quota so that some calls could produce a HTTP 429 response. Please ensure that your Cloudant plan is large enough to be able to cope with the query rate. Alternatively a [delay between iterations](https://nodejs.org/api/timers.html#timerspromisessettimeoutdelay-value-options) may be necessary.

## All docs

The paginator can page through the entire primary index:

```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // instantiate the Cloudant client, using credentials
  // stored in environment variables
  const client = CloudantV1.newInstance()

  // create a pagination to page through all documents
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_ALL_DOCS,
    {
      db: 'pagetest'
    }
  )

  // iterate through the pages
  for await (const page of pagination.pages()) {
    console.log('page', page.length, 'first doc id', page[0].id)
  }
}

main()
```

or a range of documents defined by a start and end key:

```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // instantiate the Cloudant client, using credentials
  // stored in environment variables
  const client = CloudantV1.newInstance()

  // create a pagination to page through all documents
  // in pages of 200, starting from a known document
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_ALL_DOCS,
    {
      db: 'pagetest',
      startKey: '000xuZn',
      endKey: '0017UoL'
    }
  )

  // iterate through the pages
  for await (const page of pagination.pages()) {
    console.log('page', page.length, 'first doc id', page[0].id)
  }
}

main()
```

The third parameter of `Pagination.newPagination` defines the options made during the Cloudant request:

- Add `includeDocs: true` to bring back the associated document body.
- Omit `startkey`/`endKey` to iterate through the entire primary index.

An alternative syntax is to use the "pager" which is similar to other IBM Cloud SDKs:

```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // Instantiate Cloudant client using environment credentials
  const client = CloudantV1.newInstance()

  // create a pagination to page through all documents
  // in pages of 200, starting from a known document
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_ALL_DOCS,
    {
      db: 'pagetest',
      startKey: '000xuZn',
      endKey: '0017UoL'
    }
  )

  // use the pager syntax
  const pager = pagination.pager()

  do {
    const page = await pager.getNext()
    console.log(page.length, 'first doc id', page[0].id)
  } while(pager.hasNext())
}

main()
```

## Cloudant Query

The same syntax can be used to perform [Cloudant Query API calls](https://cloud.ibm.com/apidocs/cloudant#postfind) where a `selector` defines the slice of data being queried:

```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // instantiate the Cloudant client, using credentials
  // stored in environment variables
  const client = CloudantV1.newInstance()

  // create a pagination to page through all documents
  // in pages of 200, starting from a known document
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_FIND,
    {
      db: 'pagetest',
      limit: 200,
      selector: {
        team: 'white'
      },
      fields: ['_id', 'name']
    }
  )

  // iterate through the pages
  for await (const page of pagination.pages()) {
    console.log('page', page.length, 'first doc id', page[0]._id)
  }
}

main()
```

> Note: it is important that a secondary index is available to support the query otherwise the pagination queries will become progressively less efficient and slower with each invocation. In this case we need an index on `team` to support a query for documents matching the selector `{ team: 'white' }`. See https://blog.cloudant.com/2020/05/20/Optimising-Cloudant-Queries.html.

As well as returning pages of data (which map to underlying API queries) we may also paginate through each returned document instead:

```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // Instantiate Cloudant client using environment credentials
  const client = CloudantV1.newInstance()

  // create a pagination to page through all documents
  // in pages of 200, starting from a known document
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_FIND,
    {
      db: 'pagetest',
      selector: {
        team: 'white'
      },
      fields: ['_id', 'name']
    }
  )

  // iterate through the returned rows (documents)
  for await (const row of pagination.rows()) {
    console.log('row', row)
  }
}

main()
```

## Cloudant Search

With a suitable Cloudant Search index, search results sets can be paginated. In this case we need to supply the design document name (`ddoc`), the index defined in that design document (`index`) and the Lucene query to execute (`query`):

```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // Instantiate Cloudant client using environment credentials
  const client = CloudantV1.newInstance()

  // create a pagination to page through a search result set
  // for documents whose team is white and who were born
  // in the 1980s or 19990s
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_SEARCH,
    {
      db: 'pagetest',
      query: 'team:white AND dob:[1980-01-01 TO 2000-01-01]',
      includeDocs: true,
      ddoc: 'searchddoc',
      index: 'searchByTeamDob'
    }
  )

  // iterate through the pages
  for await (const page of pagination.pages()) {
    console.log('page', page.length, 'first doc id', page[0].doc._id)
  }
}

main()
```

## Cloudant Views (MapReduce)

MapReduce view results can be paginated too. We need to pass in the design document name (`ddoc`) and the view name defined in the design document (`view`):

```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // Instantiate Cloudant client using environment credentials
  const client = CloudantV1.newInstance()

  // create a pagination to page through a view keyed on
  // the documents' team/dob pair. In this case we only
  // want documents in team='white'
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_VIEW,
    {
      db: 'pagetest',
      includeDocs: true,
      startKey: ["white"],
      endKey: ["white",{}],
      ddoc: 'viewddoc',
      view: 'byTeamAndDob',
      reduce: false
    }
  )

  // iterate through the pages
  for await (const page of pagination.pages()) {
    console.log('page', page.length, 'first doc id', page[0]._id)
  }
}

main()
```

As an alternative to paginating by batches or rows, we can create a stream of results, suitable to piping to the console or to a file:

```js
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises'
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // Instantiate Cloudant client using environment credentials
  const client = CloudantV1.newInstance()

  // create a pagination to page through a view keyed on
  // the documents' team/dob pair. In this case we only
  // want documents in team='white'
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_VIEW,
    {
      db: 'pagetest',
      includeDocs: true,
      startKey: ["white"],
      endKey: ["white",{}],
      ddoc: 'viewddoc',
      view: 'byTeamAndDob',
      reduce: false
    }
  )

  // create a stream transformer
  const myTransform = new Transform({
    objectMode: true,
    transform(obj, encoding, callback) {
      // transform the object into a CSV
      const str = `${obj.doc.name},${obj.doc.email}\n`
      this.push(str)
      callback()
    },
  });

  // use the streaming syntax
  const rowStream = pagination.rowStream()

  // create a pipeline: rowStream --> myTransform ---> stdout
  await pipeline(rowStream, myTransform, process.stdout)
}

main()
```

## Partitioned operations

In addition to the global "all_docs", Cloudant Query, Cloudant Search and View support, all of the partitioned variations of these APIs also support pagination. We need to supply a pager type of:

- `PagerType.POST_PARTITION_FIND` for partitioned Cloudant Query calls.
- `PagerType.POST_PARTITION_ALL_DOCS` for partitioned all_docs calls.
- `PagerType.POST_PARTITION_SEARCH` for partitioned Cloudant Search calls.
- `PagerType.POST_PARTITION_VIEW` for partitioned MapReduce calls.

and all operations require a partition key as a `partitionKey` parameter:


```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // instantiate the Cloudant client, using credentials
  // stored in environment variables
  const client = CloudantV1.newInstance()

  // create a pagination to page a single partition's
  // documents finding documents where the total > 10.
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_PARTITION_FIND,
    {
      db: 'pagetest2',
      partitionKey: '50',
      limit: 20,
      selector: { total: { "$gt": 10 }}
    }
  )

  // iterate through the pages
  for await (const page of pagination.pages()) {
    console.log('page', page.length, 'first doc id', page[0]._id)
  }
}

main()
```

or using the "pager" syntax:

```js
import { CloudantV1, PagerType, Pagination } from '@ibm-cloud/cloudant'

async function main() {
  // Instantiate Cloudant client using environment credentials
  const client = CloudantV1.newInstance()

  // create a pagination to page a single partition's
  // documents finding documents where the total > 10.
  const pagination = Pagination.newPagination(
    client,
    PagerType.POST_PARTITION_FIND,
    {
      db: 'pagetest2',
      partitionKey: '50',
      selector: { total: { "$gt": 10 }}
    }
  )

  // use the pager syntax
  const pager = pagination.pager()

  do {
    const page = await pager.getNext()
    console.log(page.length, 'first doc id', page[0]._id)
  } while(pager.hasNext())
}

main()
```

## Other languages

In addition to [Node.js](https://github.com/IBM/cloudant-java-sdk/blob/main/docs/Pagination.md), pagination APIs are available for [Java](https://github.com/IBM/cloudant-java-sdk/blob/main/docs/Pagination.md), [Python](https://github.com/IBM/cloudant-python-sdk/blob/main/docs/Pagination.md) and [Go](https://github.com/IBM/cloudant-go-sdk/blob/main/docs/Pagination.md).


## Limitations

Note the [limitations](https://github.com/IBM/cloudant-node-sdk/blob/v0.12.9/docs/Pagination.md#limitations) outlined in the documentation.
