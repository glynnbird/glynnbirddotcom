---
title: Cloudant Fundamentals 9/10
pubDate: 2018-07-12T06:00:00.000Z
description: Indexing
heroImage: ../../assets/neonbrand-307861-unsplash.jpg
relCanonical: https://blog.cloudant.com/2018/07/12/CloudantFundamentals-Indexing.html
---

In part 7 of this series, we saw a warning in the search results:

> "no matching index found, create an index to optimize query time"

This is Cloudant's polite way of saying that your query is expensive and the database is having to walk through the whole data set to calculate the answer. In small databases this is not a problem but in a production system, with the data growing all the time, an index is essential.

## What is an index?

An database index is just like an index in a book or a biblical concordance. It is a sorted data structure that allows quick access to a portion of the data. 

Our data looks like this:

```js
{
  "_id": "0d960fedfb62499abe35557f2d2c7c5e",
  "name": "Ferris Bueller", 
  "actor": "Matthew Broderick", 
  "dob": "1962-03-21"
}
```

Cloudant automatically creates an index on the `_id` field so that it can retrieve data by `_id`. If we are going to be making lots of queries on the `dob` field, then it might make sense to instruct Cloudant to create a secondary index on that field.

This is acheived by writing to the [POST /db/_index](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-query#creating-an-index) endpoint:

```sh
curl -X POST \
     -H 'Content-type:application/json' \
     -d'{"index":{"fields":["dob"]}}' \
     "$URL/newdb/_index"
```

In the body of the JSON supplied to the `_index` endpoint, we specify the array of fields that are to be indexed. Cloudant then creates the index on disk (ordered by `dob` in this case), so that it can be used by future queries. 

If we repeat our query, we should see the same results, but without the warning:

```sh
$ curl -X POST \
    -H'Content-type:application/json' \
    -d@query.json \
    "$URL/newdb/_find"
# { "docs":[ ], "bookmark": "" }
```  

Our query is now using the index and you should see a performance improvement, especially with larger data sets.

## Index types - json & text

Cloudant Query has two types of index - `json` and `text`.

- Indexes of `type='json'` are built using Cloudant's [MapReduce](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-creating-views-mapreduce) technology. This creates single-use indexes in the order of the keys you supply i.e. if you index `actor` and `dob` then the index will be in `actor`/`dob` order and useful for queries that involve selectors on those fields in that order.
- Indexes of `type='text' are powerered by the Cloudant's [Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search) technology. This builds separate "concordances" for the fields you supply, making it more universal for the database at query time. (see the [$text operator](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-selector-syntax) for matching arbitrary strings against blocks of text in your documents).

Both index types have their subtleties, so make sure you've read [the documentation](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-query) and understand how it works before going into production!

## Indexing strategies

The job of an index is to help the database to reduce the volume of data it's working with to a managable size. Imagine you have a query like this for a database of movies:

```js
"selector": {
    "$and": [
        {
            "actor": {
                "$eq": "Al Pacino"
            }
        },
        {
            "year": {
                "$eq": 2010
            }
        }
    ]
}
```

Which field or fields should you create the index on to best serve this query? It depends on whether which is the smaller:

- the number of movies in that database for a given year
- the number of movies that star an actor

In this case, I'd be inclined to create an index on `actor` because there may be thousands of movies in a year, but an actor might be credited with only a few dozen movies in their entire career. So an index on `actor` winows the database to a smaller dataset than an index on `year`.

Our index on actor reduces a database of tens of thousands of records down to a few dozen. It is then very simple for the database to apply the second clause of the `$and` to this smaller data set.

Other tips:

- Use the [POST /db/_explain](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-creating-selector-expressions#explain-plans) to see how Cloudant picks an index for a specified query.
- Cloudant allows you to specify the index you want the database to use at query time. This is good practice as you remove any ambiguity in index selection.
- consider creating [partial Cloudant indicies](https://medium.com/ibm-watson-data-lab/creating-partial-cloudant-indexes-1ebf169c8e15) if you are only ever interested in querying a subset of your database (i.e. you could eliminate *preliminary* blog posts from your index and only include *published* posts in a partial index).
- There's always Cloudant's [MapReduce](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-creating-views-mapreduce), [Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search) and [Geospatial](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-nosql-db-geospatial) indexes for a lower-level querying experience.
- Not all queries are "Cloudant-shaped". If you are building leader boards or  counting distinct values, you might want to consider [rolling your own custom index](https://medium.com/ibm-watson-data-lab/custom-indexers-for-cloudant-6b7e65186db1) outside of Cloudant.

## Next time

In the final part of this series, we'll look at performing aggregations using Cloudant.
