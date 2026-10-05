---
title: Cloudant Fundamentals 7/10
pubDate: 2018-06-18T06:00:00.000Z
description: Querying
heroImage: ../../assets/blake-cheek-627418-unsplash.jpg
relCanonical: https://blog.cloudant.com/2018/06/18/Cloudant-Fundamentals-Querying.html
---


In previous posts we've looked add adding and retrieving documents from a Cloudant database by their key fields - the `_id` field. There's a good chance that you want your database to be able to do more than that which is where querying comes in.

## Making a query

A [Cloudant Query](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-query) allows questions to be asked of your Cloudant data, questions such as:

- get me all the documents where the `dob` field is less than `1970-01-01` 
- get me all the documents where the `dob` field is less than `1970-01-01` and the `actor` field is `Marlon Brando`
- get the first fifty films staring Matthew Broderick in date order
- get the next 50 films matching the previous query

Queries are expressed as JSON documents such as:

```js
{
  "selector": {
    "dob": {
      "$lt": "1970-01-01"
    }
  }
}
```

The `selector` object is the equivalent of the "WHERE" part of relational database query. It defines the values or ranges of fields that you are looking for - in this case, the `$lt` ("less than") operator is used to perform our first query ([other operators are available](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-operators))

To perform the query we simply POST the JSON to the `/db/_find` endpoint:

```sh
$ curl -X POST \
    -H'Content-type:application/json' \
    -d@query.json \
    "$URL/newdb/_find"
```

The returned data will have the following form:

```js
{
  "docs":[ ],
  "bookmark": "",
  "warning": "no matching index found, create an index to optimize query time"
}
```

- `docs` is an array of matching documents
- `bookmark` unlocks access to the [next page of matches](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-pagination-and-bookmarks)
- `warning` is cautioning us that we are performing a query which foreces Cloudant to scan the whole database to answer. We can improve performance with an [index](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-query#creating-an-index), a feature we'll meet later.

## More complex clauses

Our second query needs to use the `$and` operator which is fed an array of clauses. The first clause is the same as our first query and we add on a second clause to match by actor name.

```js
{
  "selector": {
    "$and": [
      {
        "dob": {
          "$lt": "1970-01-01"
        }
      },
      {
        "actor": "Marlon Brando"
      }
    ]
  }
}
```

Only documents matching all of the `$and` clauses will make it to the result set. 

## Sorting

The third query adds a `sort` attribute to the query object:


```js
{
  "selector": {
    "actor": "Matthew Broderick"
  }
  "sort": {
    "date": "asc"
  }
}
```

We can [sort](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-creating-selector-expressions#sort-syntax) by one or more fields in ascending (asc) or descending (desc) order.

## Next time

In the next post we'll do all this again, but programmatically in Node.js and  introduce the prospect of expressing our queries in SQL.

