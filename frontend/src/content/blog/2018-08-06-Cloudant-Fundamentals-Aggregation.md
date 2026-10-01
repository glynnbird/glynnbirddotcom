---
title: Cloudant Fundamentals 10/10
pubDate: 2018-08-06T06:00:00.000Z
description: Aggregation
heroImage: ../../assets/sven-scheuermeier-61236-unsplash.jpg
---

It's been an emotional journey through Cloudant's fundamentals but we're nearly at the end. In this final post, we'll discuss data aggregation: counting, summing and statistics.

[Cloudant Query](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-query) which we used for part 8 and part 9 of this series does not have the ability to perform aggregations, only selection. i.e. you can do `SELECT * FROM mydb WHERE actor='Al Pacino'` but not `SELECT COUNT(*) FROM mydb WHERE actor='Al Pacino'`.

## MapReduce

One option is to write your own [MapReduce](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-creating-views-mapreduce) view. A view is defined as a JavaScript function. Cloudant takes each document in the database, passing it to this function in turn and then storing the emitted  key/value pairs in an index on disk.

To calculate counts of documents by actor we would create a map function like this:

```js
function(doc) {
  emit(doc.actor, null)
}
```

This function paired with the `_count` reducer produces counts of each value of actor. The other built-in reducers `_stats` and `sum` can be used calculate statistics on the second field emitted by your map function:

 
```js
function(doc) {
  emit([doc.year, doc.month], doc.orderValue)
}
```

The above example allows a hierarchical key of `year` and `month` to be used to group the aggregation of the `orderValue` field - ideal for reports and dashboards.

## Facet counts

Another way of calculating simple count aggregations is using the [faceting feature](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search#faceting) of Cloudant Search. Like MapReduce, Cloudant Search indexes are configured in JavaScript, this time with an `index` function instead of `emit`:

```js
function(doc) {
  index("category", doc.category, {"facet": true});
  index("price", doc.price, {"facet": true});
}
```

The above example indexes two fields (`category` and `price`) from our document and instructs both to be "faceted". This means that values can be counted at query time by supplying a `counts` parameter:

```
...?q=*:*&counts=["category"]
{
    "total_rows":100000,
    "bookmark":"g...",
    "rows":[...],
    "counts":{
       "category":{
         "action": 55,
         "comedy": 98,
         "documentary": 3
       }
    }
}
```

See the [documentation](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search#faceting) for further examples of facet counts and range faceting.

## Aggregation with cloudant-quickstart

The simplest way to do aggregation is using the [cloudant-quickstart](https://www.npmjs.com/package/cloudant-quickstart) library.

Counts are performed without defining the index yourself:

```js
 // count documents by year and month
 db.count(['year','month]),then(console.log)
```

Simply specify the field or array of fields you want to group by and the library will create the appropriate MapReduce view for you.

The same applies to `stats` and `sum` aggregations

```js
// get sum of sales grouped by year/month/day
db.sum('sales', ['year', 'month', 'day'])

// get stats on weather by state/city
db.stats(['temperature', 'airPressure', 'windSpeed'], 'state')
```

## Conclusion

In this Cloudant Fundamentals series we've touched on schema design, unique ids, revision tokens, CRUD operations, querying and aggregation. But there's a lot more.


There’s a project called [PouchDB](https://pouchdb.com/) that might strike your fancy. You also can [search our Medium publication](https://medium.com/ibm-watson-data-lab/search?q=cloudant) for more articles on Cloudant and CouchDB. And of course, you can reach the wider open source community on the [Apache CouchDB chat channels](http://couchdb.apache.org/#chat) or get involved via the [CouchDB mailing lists](http://couchdb.apache.org/#mailing-lists). I’ll see you on there!


