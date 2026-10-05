---
title: Projection
pubDate: 2021-11-12T00:00:00.000Z
description: Storing data in an index for faster retrieval.
heroImage: ../../assets/jeremy-yap-J39X2xX_8CQ-unsplash.jpg
relCanonical: https://blog.cloudant.com/2021/11/12/Projection.html
---

Cloudant's MapReduce indexes give you complete control over what data from your primary JSON objects are stored in your secondary indexes. JavaScript functions are used to programmatically decide which document attributes are selected for inclusion as either the _key_ or the _value_ of the views - the JavaScript functions can even be used to process the data before it's saved in the index.

In this blog post we'll look at a technique called _projection_ which produces the fastest, most efficient data selection indexes.

## MapReduce basics

A [MapReduce](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-creating-views-mapreduce) index is defined in two parts

1. The Map function - a JavaScript function which is called for each document in the database and chooses what is stored in the index.
2. The Reducer - in this blog post we're not concerned with aggregation of data, so we'll leave the reduce component undefined.

The Map & Reduce definitions are stored in [design documents](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-design-documents) which define the specifcation of one or more secondary indexes. Here's an example map function:

```js
function(doc) {
  if (doc.status === 'complete') {
    emit(doc.timestamp, null)
  }
}
```

Note that:

- The function is called with a single parameter 'doc' which contains the document being indexed.
- The function uses an `if` statement to decided whether to index something or nothing. This is called a _partial_ or _sparse_ index as it only contains data for some of the documents. This keeps the index as compact and performant as possible.
- The data emitted has two parts: the `key` and the `value` forming the first and second parameters to the `emit` function. The `key` determines the order of the index and consequently marries with the _access pattern_ your index is serving i.e. by emitting a key of `doc.timestamp` we are creating a secondary index in date/time order allowing us to query data by a single timestamp or a range of time values. The `value` is null - the value is usually used to store data which is aggregated by the _reducer_, but for the moment we can elect to store nothing here.

## Using the view

Once the above view has built, we can invoke the API endpoint associated with our view suppling parameters to define the slice of data we need:

- `?key="2021-04-01T10:44:00.000Z"` - find documents matching a single timestamp.
- `?startkey="2021-04-01"&endkey="2021-05-01"` - find documents from April 20201.

> Note: because of the `if` statement in the map function, we will only see documents where the `status` attribute is `completed`. We have baked only that subset of the documents into the secondary index.

The data returned from these API calls will include:

- the "key" from the index
- the matching document id
- the "value" from the index - in this case `null`

Here is a sample response:

```js
{"total_rows":21953,"offset":0,"rows":[
{"id":"K7N2T4IR5JMJGJ8F","key":"2020-04-01T00:12:37.887Z","value":null},
{"id":"ZYAMEN3Y56M6PLGG","key":"2020-04-01T00:25:45.818Z","value":null},
{"id":"TUVG1CHYQ5EF5T6D","key":"2020-04-01T00:56:50.297Z","value":null},
{"id":"GFY67VNMC0J8AQBX","key":"2020-04-01T01:32:31.487Z","value":null},
{"id":"S7VZS7A31GV1QS96","key":"2020-04-01T01:55:19.592Z","value":null}
]}
```

If we want to see the document body itself for each returned row, we can add `include_docs=true` to our query and the results will also include the full document.

Example response:

```js
{"total_rows":23169,"offset":0,"rows":[
{"id":"K7N2T4IR5JMJGJ8F","key":"2020-04-01T00:12:37.887Z","value":null,"doc":{"_id":"K7N2T4IR5JMJGJ8F","_rev":"1-c2ea27ee82feb91ba80708c5e8f83d29","status":"complete","timestamp":"2020-04-01T00:12:37.887Z","price":72.23,"buyer":"Dorathy Xiong","email":"dorathy.xiong51243@hotmail.com","address":"4574 Aston Street , Glossop, Shropshire, PL7 6VI","delivery":"failed"}},
{"id":"ZYAMEN3Y56M6PLGG","key":"2020-04-01T00:25:45.818Z","value":null,"doc":{"_id":"ZYAMEN3Y56M6PLGG","_rev":"1-b215e5e7335d7ad8cac4e33073598c02","status":"complete","timestamp":"2020-04-01T00:25:45.818Z","price":75.3,"buyer":"Yajaira Gary","email":"yajaira_gary@yahoo.com","address":"2784 Meal Lane , New Alresford, Montgomeryshire, GL9 0DR","delivery":"failed"}},
{"id":"TUVG1CHYQ5EF5T6D","key":"2020-04-01T00:56:50.297Z","value":null,"doc":{"_id":"TUVG1CHYQ5EF5T6D","_rev":"1-00f9d105a31b3c86657f797f9eeb5b1b","status":"complete","timestamp":"2020-04-01T00:56:50.297Z","price":36.51,"buyer":"Kandi Bolduc","email":"kandi9@meetup.com","address":"4712 Burstead Road , Knottingley, Durham, SO35 6MK","delivery":"failed"}},
{"id":"GFY67VNMC0J8AQBX","key":"2020-04-01T01:32:31.487Z","value":null,"doc":{"_id":"GFY67VNMC0J8AQBX","_rev":"1-989788f7d9e2cb881c92c44cdc765eed","status":"complete","timestamp":"2020-04-01T01:32:31.487Z","price":28.08,"buyer":"Santina Leal","email":"santina_leal3384@gmail.com","address":"6443 Ashlands Street , Eccles, Essex, KY8 9JC","delivery":"delivered"}},
{"id":"S7VZS7A31GV1QS96","key":"2020-04-01T01:55:19.592Z","value":null,"doc":{"_id":"S7VZS7A31GV1QS96","_rev":"1-ea8cf28f1e5c9af038d4120753c513ee","status":"complete","timestamp":"2020-04-01T01:55:19.592Z","price":8.99,"buyer":"Thomas Abreu","email":"thomas.abreu@duo.com","address":"3250 Turfland Road , Kidsgrove, Radnorshire, EC8 5MQ","delivery":"delivered"}}
]}
```

The trouble with `include_docs=true` is it adds extra complexity to the query: Cloudant has to first find the matching view rows from the secondary index and then in a second operation, fetch the matching document bodies. Extra complexity means extra database load and poorer performance.

How can we avoid doing `include_docs=true`? Using projection!

## Projection

_Projection_ is the process of storing data in the _value_ portion of the MapReduce index so that it is retrieved at query-time _without_ having to do `include_docs=true`.

An index with data projected into the index's value makes for a larger index but as the index's value is stored next to the index's keys, retrieval of the data is much faster than fetching the entire document bodies in a separate operation.

Projected indexes are the fastest way of retrieving selections of data from a Cloudant database and should be used by users who want the fastest performance and the lowest server load for operational queries.

### Projecting the entire document

In this example we're adding the entire document into the index:

```js
function(doc) {
  if (doc.status === 'complete') {
    emit(doc.timestamp, doc)
  }
}
```

This technique is suitable for small documents (< a few KB). To be more optimal, we needn't put the document `_id`/`_rev` pair into the index as they are already part of the response so this code is better:

```js
function(doc) {
  if (doc.status === 'complete') {
    delete doc._id
    emit(doc.timestamp, doc)
  }
}
```

Example response:

```js
{"total_rows":23169,"offset":0,"rows":[
{"id":"K7N2T4IR5JMJGJ8F","key":"2020-04-01T00:12:37.887Z","value":{"_id":"K7N2T4IR5JMJGJ8F","_rev":"1-c2ea27ee82feb91ba80708c5e8f83d29","status":"complete","timestamp":"2020-04-01T00:12:37.887Z","price":72.23,"buyer":"Dorathy Xiong","email":"dorathy.xiong51243@hotmail.com","address":"4574 Aston Street , Glossop, Shropshire, PL7 6VI","delivery":"failed"}},
{"id":"ZYAMEN3Y56M6PLGG","key":"2020-04-01T00:25:45.818Z","value":{"_id":"ZYAMEN3Y56M6PLGG","_rev":"1-b215e5e7335d7ad8cac4e33073598c02","status":"complete","timestamp":"2020-04-01T00:25:45.818Z","price":75.3,"buyer":"Yajaira Gary","email":"yajaira_gary@yahoo.com","address":"2784 Meal Lane , New Alresford, Montgomeryshire, GL9 0DR","delivery":"failed"}},
{"id":"TUVG1CHYQ5EF5T6D","key":"2020-04-01T00:56:50.297Z","value":{"_id":"TUVG1CHYQ5EF5T6D","_rev":"1-00f9d105a31b3c86657f797f9eeb5b1b","status":"complete","timestamp":"2020-04-01T00:56:50.297Z","price":36.51,"buyer":"Kandi Bolduc","email":"kandi9@meetup.com","address":"4712 Burstead Road , Knottingley, Durham, SO35 6MK","delivery":"failed"}},
{"id":"GFY67VNMC0J8AQBX","key":"2020-04-01T01:32:31.487Z","value":{"_id":"GFY67VNMC0J8AQBX","_rev":"1-989788f7d9e2cb881c92c44cdc765eed","status":"complete","timestamp":"2020-04-01T01:32:31.487Z","price":28.08,"buyer":"Santina Leal","email":"santina_leal3384@gmail.com","address":"6443 Ashlands Street , Eccles, Essex, KY8 9JC","delivery":"delivered"}},
{"id":"S7VZS7A31GV1QS96","key":"2020-04-01T01:55:19.592Z","value":{"_id":"S7VZS7A31GV1QS96","_rev":"1-ea8cf28f1e5c9af038d4120753c513ee","status":"complete","timestamp":"2020-04-01T01:55:19.592Z","price":8.99,"buyer":"Thomas Abreu","email":"thomas.abreu@duo.com","address":"3250 Turfland Road , Kidsgrove, Radnorshire, EC8 5MQ","delivery":"delivered"}}
]}
```

### Projecting only the data that is needed

Even better than lazily emitting the entire document into the index's value is to only emit the key/value pairs that your application _needs_. e.g.

```js
function(doc) {
  if (doc.status === 'complete') {
    var obj = {
      p: doc.price,
      b: doc.buyer,
      e: doc.email,
      d: doc.delivery
    }
    emit(doc.timestamp, obj)
  }
}
```

- Note we create a new `obj` object which only contains the items we need for our use-case.
- We don't need to emit `_id` as it is already stored in the index.
- We don't need `doc.status` because the index will only contain documents with a `completed` status.
- We don't need `doc.timestamp` because this is already stored in the index's key.
- We use single character keys in the object to keep the size small.

Example response:

```js
{"total_rows":23169,"offset":0,"rows":[
{"id":"K7N2T4IR5JMJGJ8F","key":"2020-04-01T00:12:37.887Z","value":{"p":72.23,"b":"Dorathy Xiong","e":"dorathy.xiong51243@hotmail.com","d":"failed"}},
{"id":"ZYAMEN3Y56M6PLGG","key":"2020-04-01T00:25:45.818Z","value":{"p":75.3,"b":"Yajaira Gary","e":"yajaira_gary@yahoo.com","d":"failed"}},
{"id":"TUVG1CHYQ5EF5T6D","key":"2020-04-01T00:56:50.297Z","value":{"p":36.51,"b":"Kandi Bolduc","e":"kandi9@meetup.com","d":"failed"}},
{"id":"GFY67VNMC0J8AQBX","key":"2020-04-01T01:32:31.487Z","value":{"p":28.08,"b":"Santina Leal","e":"santina_leal3384@gmail.com","d":"delivered"}},
{"id":"S7VZS7A31GV1QS96","key":"2020-04-01T01:55:19.592Z","value":{"p":8.99,"b":"Thomas Abreu","e":"thomas.abreu@duo.com","d":"delivered"}}
]}
```
---------

## Conclusion

Projection of small objects into a MapReduce index's value is the recipe for the fastest performance for boilerplate queries. It is faster and cheaper to execute than a view with `?include_docs=true` at the expense of a slightly larger index size.
