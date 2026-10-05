---
title: Paginating _all_docs
pubDate: 2019-10-25T06:00:00.000Z
description: Paging through all_docs and views
heroImage: ../../assets/anastasia-zhenina-XOW1WqrWNKg-unsplash.jpg
relCanonical: https://blog.cloudant.com/2019/10/25/Paginating-all_docs-and-views.html
---


If you are using the `GET /<db>/_all_docs` endpoint to fetch documents in bulk, then you may have come across the `limit` and `skip` parameters which allow you to define how many documents you would like, and the offset into the range you want to start from. Using this `skip`/`limit` pattern to iterate through a result set works, but it gets progressively slower the larger the value of `skip`. 

There's a better way, and this blog post shows how it's done.

## What is the \_all\_docs endpoint?

The `GET /<db>/_all_docs` is used to fetch data from a Cloudant database's _primary index_, that is the index that keeps each document's `_id` in order. The `_all_docs` endpoint takes a number of optional parameters which configure the range of data requested and whether to return each document's body or not, With no parameters provided, `_all_docs` streams all of a database's documents, returning only the document `_id` and its current `_rev` token.

```js
curl "$URL/mydb/_all_docs"
{
  "total_rows": 23515,
  "rows": [
    {
      "id": "aardvark",
      "key": "aardvark",
      "value": {
        "rev": "3-be42a3233372a6a2dff84a65fdd9cbab"
      }
    },
    {
      "id": "alligator",
      "key": "alligator",
      "value": {
        "rev": "1-3256046064953e2f0fdb376211fe78ab"
      }
    }
...
```

If `include_docs=true` is supplied, then an additional `doc` attribute is added to each "row" in the result set containing the document body.

## Limit, startkey, endkey

To access data from `_all_docs` in reasonably sized pages, we need to supply the `limit` parameter to tell Cloudant how many documents to return:

```
# get me 10 documents
GET /mydb/_all_docs?limit=10
```

We can also limit the range of document `_id`s we want by supplying, one or more of `startkey` or `endkey`.

```sh
# get me 100 documents from _id bear onwards
GET /mydb/_all_docs?limit=100&startkey="bear"

# get me 5 documents between _id bear --> frog
GET /mydb/_all_docs?limit=100&startkey="bear"&endkey="frog"

# get me 5 documents up to _id moose
GET /mydb/_all_docs?limit=100&endkey="moose"
```

This gives us the ability to define the size of the data set to return and the range of the `_id` field to return, but that isn't quite the same as pagination.

> Note that the `startkey`/`endkey` values are in double quotes. This is because they are expected to be JSON-encoded and `JSON.stringify('moose') === "moose"`.

## Pagination

In order to iterate through a range of documents in an orderly and performant manner, we need to devise an algorithm to page through the range. Let's say we need to page through _all_docs in blocks of 10. 

We have two options:

### Option 1 - Fetch one document too many

Instead of fetching ten documents (`limit=10`), fetch eleven instead (`limit=11`) but hide the eleventh document from your users. The `_id` of the eleventh document becomes the `startkey` of your request for the next page of results.

```
# first request
GET /mydb/_all_docs?limit=11
{
  "total_rows": 10000,
  "rows": [
    { "id": "aardvark" ....},
    { "id": "alligator" ....},
    { "id": "antelope" ....},
    { "id": "badger" ....},
    { "id": "bear" ....},
    { "id": "cat" ....},
    { "id": "doormouse" ....},
    { "id": "donkey" ....},
    { "id": "elephant" ....},
    { "id": "frog" ....},
    { "id": "gazelle" ...}   // <-- this is the 11th result we use as the startkey of the next request
   ]
}    
```

```
# second request
GET /mydb/_all_docs?limit=11&startkey="gazelle"
{
  "total_rows": 10000,
  "rows": [
    { "id": "gazelle" ....},
    { "id": "ibis" ....},
    ...
   ]
} 
```

This works but we end up fetching n+1 documents when only n are required.

### Option 2 - the \u0000 trick

If we are determined to only fetch `n` documents each time, then we need to calculate a value of `startkey` which means "the next id after the last _id in the result set" e.g. if the last document in our first page of results is "frog", what should the `startkey` of the next call to _all_docs be? It can't be "frog", otherwise we'd get the same document id again. It turns out that you can append `\u0000` to the end of a key string to indicate the "next key" (\u0000 is a Unicode null character which becomes `%00` when encoded into a URL). 

```
# first request
GET /mydb/_all_docs?limit=10
{
  "total_rows": 10000,
  "rows": [
    { "id": "aardvark" ....},
    { "id": "alligator" ....},
    { "id": "antelope" ....},
    { "id": "badger" ....},
    { "id": "bear" ....},
    { "id": "cat" ....},
    { "id": "doormouse" ....},
    { "id": "donkey" ....},
    { "id": "elephant" ....},
    { "id": "frog" ....} // <-- append \u0000 to this to get the startkey of the next request
  ]
}  
```

```
# second request
GET /mydb/_all_docs?limit=10&startkey="frog%00"
{
  "total_rows": 10000,
  "rows": [
    { "id": "gazelle" ....},
    { "id": "ibis" ....},
    ...
   ]
} 
```

## Pagination of views

MapReduce views, secondary indexes which are defined by key/value pairs emitted from user-supplied JavaScript functions, can be queried in a similar way to the `_all_docs` endpoint but with the `GET /<db>/_design/<ddoc>/_view/<view>` endpoint instead. You can:

- spool all the data from a view with no parameters.
- includes document bodies by supplying `include_docs=true`.
- choose the range of keys required using `startkey`/`endkey`, but in this case the data type of the keys may not be a string.

Another complication is that unlike the primary index, where every `_id` is unique, there may be many entries in a secondary index with the same key e.g. lots of entries where the key is `"mammal"`. This makes pagination using only `startkey`/`endkey` tricky, so there are other parameters to help: `startkey_docid`/`endkey_docid`. 

```
# get first page of cities by country
GET /cities/_design/mydesigndoc/_view/bytype?limit=10&reduce=false&startkey="mammal"&endkey="mammal"&include_docs=true

# get next page of cities by country
GET /cities/_design/mydesigndoc/_view/bytype?limit=10&reduce=false&startkey="mammal"&endkey="mammal"&include_docs=true&startkey_docid=horse%00
```

In other words the second request has a value of `startkey_docid` that is the last document id from the previous page of results (horse) plus the magic `\u0000` character (which becomes `horse%00` in the URL).

> Note: `startkey_docid` only works if a `startkey` is supplied and where all index entries share the same key. If they don't share the same key, then pagination can be achieved with manipulation of `startkey`/`endkey` parameters only. Also note that the `startkey_docid` parameter is NOT JSON encoded.

## Pagination with bookmarks

[Cloudant Query](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query) and [Cloudant Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search) both use _bookmarks_ as the key to unlock the next page of results from a result set. This is easier to manage as there is no key manipulation to formulate the request for the next result set, simply pass the _bookmark_ received in the first response in the second request.
