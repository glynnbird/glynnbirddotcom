---
title: "MapReduce Compound Keys"
description: Using arrays as keys for complex grouped aggregation.
pubDate: 2023-08-21T00:00:00Z
heroImage: ../../assets/american-public-power-association-dCx2xFuPWks-unsplash.jpg
relCanonical: https://blog.cloudant.com/2023/08/21/MapReduce-Compound-Keys.html
---

Cloudant's MapReduce mechansim is the original, and some say the best way of extracting data from a Cloudant database. In this blog post we'll look at how compound keys can be used with MapReduce to provide flexible indexes for selection, range queries and grouped aggregation.

## How does MapReduce work?

Let's say we have documents like this:

```js
{
  "_id": "myid",
  "date": "2023-08-18T10:24:59.000Z",
  "name": "Laura Jones",
  "email": "ljones@gmail.com",
  "active": true,
  "score": 14.2
}
```

If we want to find `active` documents that match a given `email` we can create a MapReduce index with a JavaScript function like so:

```js
functon(doc) {
  if (doc.active) {
    emit(doc.email.toLowerCase(), null)
  }
}
```

This function is executed once for every document in the database and an index is created for every key/value pair emitted from a call to the `emit` function. 

Note:

- The `if` ensures that only `active` documents make it into the index. This makes the index smaller as inactive documents don't make it to the index.
- The `emit` function takes two parameters: the first is the key which defines the order of the index and a value (`null` in this case), which is returned with every row in the index at query-time.
- We are using `.toLowerCase()` to ensure that the lower-cased version of our documents' email addresses are added to the index. It is sometimes useful to have JavaScript available to pre-process the data prior to indexing.

This leads to an index with keys and values like so:

| key                | value |
|--------------------|-------|
| "ljones@gmail.com" | null  |
| "bob@aol.com"      | null  |

We can then query the resultant index for a known `key`:

```
// find the first 50 documents whose email address equals "ljones@gmail.com"
GET /mydb/_design/mydesigndoc/_view/myview?key="ljones@gmail.com"&limit=50
```

Cloudant will return the matching rows in the index including the document's `_id`, the index `key` and indexed `value`.

## Using compound keys

Instead of just indexing a single value (a string, number or boolean) we can instead index an array of values. Let's say we want to index the year, month and day from our `date` field with this JavaScript map function:

```js
function(doc) {
  if (doc.active) {
    const d = new Date(doc.date)
    const k = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    const v = { name: doc.name, email: doc.email }
    emit(k, v)
  }
}
```

Notice how we're parsing the string `doc.date` as a JavaScript Date object and extracting the numeric year, month and day and indexing those as an array - with the most significant value to the left of the array. We're also supplying a subset of the original document (its `name` and `email`) as the index's "value".

This leads to an index with keys and values like so:

| key          | value                                                 |
|--------------|-------------------------------------------------------|
| [2023,8, 18] | { "name": "Laura Jones", "email":"ljones@gmail.com" } |
| [2023,8, 19] | { "name": "Bob Smith", "email":"bob@aol.com" }        |

Like before we can query the index for a known value:

```js
// find documents whose date is 18th August 2023
GET /mydb/_design/mydesigndoc/_view/myview?key=[2023,8,18]&limit=5
{"total_rows":19144,"offset":19100,"rows":[
{"id":"0U3DQT2Q43UPA6J2","key":[2023,8,18],"value":{"name":"Noelia Greenberg","email":"noelia_greenberg@gmail.com"}},
{"id":"1L4JIQCMX1JK0M77","key":[2023,8,18],"value":{"name":"Lennie Currie-Story","email":"lennie.currie-story80@kelkoo.com"}},
{"id":"27GTZEO3VRAFQ00M","key":[2023,8,18],"value":{"name":"Stanton Fuqua","email":"stanton-fuqua48@develop.com"}},
{"id":"2O3BSLSLQG3V26BA","key":[2023,8,18],"value":{"name":"Micki Tolley","email":"micki.tolley4363@vat.com"}},
{"id":"2X37Y9ADBN69Q0NE","key":[2023,8,18],"value":{"name":"Columbus Brockman","email":"columbus30368@gmail.com"}}
]}

```

As we have put some useful data into the value of the index, it is returned to us at query-time.

We can also supply `startkey`/`endkey` ranges on some or all of the key space:

```js
// find documents whose date is in August 2023 (betweeen 1st Aug & 1st Sept)
GET /mydb/_design/mydesigndoc/_view/myview?startkey=[2023,8,1]&endkey=[2023,9,1]
```

We can omit some of the less-sigificant values:

```js
// find documents whose date is between 2020 and 2024.
GET /mydb/_design/mydesigndoc/_view/myview?startkey=[2020]&endkey=[2024]
```

## Compound keys and reducers

The second component of MapReduce is "reduce". At the time of creating the index we can specify one of the built-in reducer functions, which can be activated (or not) at query-time. The reducers are:

- `_count` - for counting the number of indexed rows.
- `_sum` - for totalising the _values_ emitted.
- `_stats` - for providing totals of the _values_ emitted - useful for calculation of mean, variance and standard deviations.

The reduction phase is useful for aggregating and grouping data, as we can specify that we would like the count/sum/stats operation to be calculated on the one or more key values. Let's look at an example. Using the Map function from the previous section, but with the `_count` reducer, our range query will now return the number of items on each day:

```js
// return the number of items for each day in august.
GET /mydb/_design/mydesigndoc/_view/myview?startkey=[2023,8,1]&endkey=[2023,9,1]&group=true
{"rows":[
{"key":[2023,8,1],"value":14},
{"key":[2023,8,2],"value":8},
{"key":[2023,8,3],"value":9},
{"key":[2023,8,4],"value":16},
{"key":[2023,8,5],"value":7},
{"key":[2023,8,6],"value":6},
{"key":[2023,8,7],"value":12},
{"key":[2023,8,8],"value":11},
{"key":[2023,8,9],"value":15},
{"key":[2023,8,10],"value":16},
{"key":[2023,8,11],"value":11},
{"key":[2023,8,12],"value":10},
{"key":[2023,8,13],"value":17},
{"key":[2023,8,14],"value":13},
{"key":[2023,8,15],"value":14},
{"key":[2023,8,16],"value":15},
{"key":[2023,8,17],"value":21},
{"key":[2023,8,18],"value":16},
{"key":[2023,8,19],"value":13},
{"key":[2023,8,20],"value":11},
{"key":[2023,8,21],"value":4}
]}
```

By supplying the `group_level` we pick the granularity of keys that are used for grouping:

```js
// return the number of items, grouped by year (first level of our [year, month, day] array)
GET /mydb/_design/mydesigndoc/_view/myview?startkey=[2020,1,1]&endkey=[2024,1,1]&group=true&group_level=1
{"rows":[
{"key":[2020],"value":5335},
{"key":[2021],"value":5148},
{"key":[2022],"value":5256},
{"key":[2023],"value":3405}
]}


// return the number of items, grouped by month (second level of our [year, month, day] array)
GET /mydb/_design/mydesigndoc/_view/myview?startkey=[2022,1,1]&endkey=[2023,1,1]&group=true&group_level=2
{"rows":[
{"key":[2022,1],"value":455},
{"key":[2022,2],"value":409},
{"key":[2022,3],"value":427},
{"key":[2022,4],"value":429},
{"key":[2022,5],"value":451},
{"key":[2022,6],"value":407},
{"key":[2022,7],"value":470},
{"key":[2022,8],"value":452},
{"key":[2022,9],"value":431},
{"key":[2022,10],"value":425},
{"key":[2022,11],"value":432},
{"key":[2022,12],"value":468},
{"key":[2023,1],"value":28}
]}


// return the number of items, grouped by day (third level of our [year, month, day] array)
GET /mydb/_design/mydesigndoc/_view/myview?startkey=[2023,1,1]&endkey=[2023,1,15]&group=true&group_level=3
{"rows":[
{"key":[2023,1,1],"value":28},
{"key":[2023,1,2],"value":19},
{"key":[2023,1,3],"value":12},
{"key":[2023,1,4],"value":9},
{"key":[2023,1,5],"value":13},
{"key":[2023,1,6],"value":13},
{"key":[2023,1,7],"value":17},
{"key":[2023,1,8],"value":15},
{"key":[2023,1,9],"value":15},
{"key":[2023,1,10],"value":17},
{"key":[2023,1,11],"value":19},
{"key":[2023,1,12],"value":11},
{"key":[2023,1,13],"value":8},
{"key":[2023,1,14],"value":16},
{"key":[2023,1,15],"value":11}
]}
```

We can also choose to switch the reducer _off_ at query time to return matching rows, rather than totals:

```js
// return individual rows between 2020 & the end of 2023.
GET /mydb/_design/mydesigndoc/_view/myview?startkey=[2020,1,1]&endkey=[2024,1,1]&reduce=false&limit=5
{"total_rows":19144,"offset":0,"rows":[
{"id":"0H1QUDL5IN3YVKYD","key":[2020,1,1],"value":{"name":"Isis Osgood","email":"isis4008@utc.com"}},
{"id":"2JUYUB4YS41DPV5E","key":[2020,1,1],"value":{"name":"Charita Timmerman","email":"charita-timmerman@gmail.com"}},
{"id":"4EXSQ77YXSEEUZDD","key":[2020,1,1],"value":{"name":"Dayna Hogan","email":"dayna_hogan351@yahoo.com"}},
{"id":"55IHT4U0N51FQRBQ","key":[2020,1,1],"value":{"name":"Rima Savage","email":"rima78264@hotmail.com"}},
{"id":"7EOEIHH911CQSPRV","key":[2020,1,1],"value":{"name":"Daria Reinhardt","email":"daria_reinhardt848@gmail.com"}}
]}
```

## Conclusion

Using compound keys as MapReduce keys in Cloudant produces secondary indexes that are good for:

- Selection of matching known keys.
- Selection between key ranges.
- Aggregation with hierarchical grouping across the key space.

