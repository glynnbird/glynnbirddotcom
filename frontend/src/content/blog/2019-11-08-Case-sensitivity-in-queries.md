---
title: Case-sensitivity in queries
pubDate: 2019-11-08T06:00:00.000Z
description: Making Cloudant query, search and MapReduce case sensitive or case-insensitive
heroImage: ../../assets/amador-loureiro-BVyNlchWqzs-unsplash.jpg
relCanonical: https://blog.cloudant.com/2019/11/08/Case-sensitivity-in-queries.html
---

By default, some Cloudant operations are _case sensitive_ - the query parameter must match the value in the document exactly for it to be included in search results - but if you need a _case insensitive_ query then there are number of solutions.

Let's see how each of the Cloudant query mechanisms handle case sensitivity with a database of cars whose documents look like this which we need to query by the "model" attribute:
 
```js
{
  "_id": "15c08063d9b1f382e2b865f50216e350",
  "_rev": "1-9ae2a466f4fab57060a3080ed006809f",
  "year": 1987,
  "make": "Buick",
  "model": "Skylark"
}
```

## MapReduce

If we create a MapReduce index with a map function that looks like this:

```js
function(doc) {
  emit(doc.model, null)
}
```

We can expected to be able to retrieve documents by the indexed key: `model` with a query like so:

```
GET /cars/_design/mydesigndoc/_view/bymodel?key="Skylark"
```

but the index will be _case sensitive_ and only queries supplying the original case will match. So a supplied key of `skylark` (lowercase 'S') would yield no results.

To make a MapReduce index _case insensitive_, the index data should be coerced to be lowercase and all queries treated the same way. So our map function becomes:

```js
function(doc) {
  emit(doc.model.toLowerCase(), null)
}
```

and our query:

```
GET /cars/_design/mydesigndoc/_view/bymodel?key="skylark"
```

As long as we remember to lowercase the key at query-time, we have a *case-insensitive* MapReduce index.

## Cloudant Search

Cloudant Search is a different beast because it is built for free-text matching, and its default behaviour is to build *case-insensitive* indexes. So if we build our index with a map function:

```js
function(doc) {
  index('model', doc.model)
}
```

and query it with

```
# lowercase
GET /cars/_design/mydesigndoc/_search/modelsearch?q=model%3Askylark
```

or

```
# uppercase
GET /cars/_design/mydesigndoc/_search/modelsearch?q=model%3ASkylark
```

we should get the same results. 

The way Cloudant Search behaves with supplied text depends on the _analyzer_ used to pre-process and split the string into indexable tokens. The default Cloudant Search _analyzer_ is the _standard analyzer_ which removes punctuation, splits strings into words, removes stop words and lowercases everything prior to indexing. Other analyzers are available which pre-process the data in different ways. If you need a _case sensitive_ Cloudant Search, then you can opt to use the _whitespace analyzer_ instead.

## Cloudant Query

### Cloudant Query - type=json

We can create an a Cloudant Query index on the `model` field with the `POST /cars/_index` endpoint:

```
POST /cars/_index
{"index":{"fields":["model"]},"type":"json"}
```

and query it with the `POST /cars/_find` endpoint:

```
POST /cars/_find
{"selector":{"model":"Skylark"}}
```

The `type: json` indexes are _case sensitive_ (which isn't surprising as they are backed by MapReduce technology under-the-hood)

### Cloudant Query - type=text

The `type: text` are built for free-text searching because they are backed by the same Lucene-based indexed used by Cloudant Search. So creating a index with:

```
POST $URL/cars/_index
{"index":{"fields":[{"name":"model","type":"string"}]},"type":"text"}
```

allows a query

```
POST /cars/_find
{"selector":{"$text":"Skylark"}}
```

to be _case-insenstive_ (notice the use of the `$text` operator to indicate we want to engage free-text comparison of the supplied string with the indexed data).

If, however, you query with the "equality" operator `$eq`, a _case sensitive_ match will be performed:

```
POST /cars/_find
{"selector":{"$eq":{"model":"Skylark"}}}
```

Note: if you need to change the _analyzer_ used by in `type: text` Cloudant Query index, then this is [possible at index-time](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query).

## How _not_ to do it - Regular Expressions

It is possible to get a case-insensitive result out of Cloudant Query, without employing a `type: text` index by using the `$regex` operator and constructing a suitable regular expression. This is **not** the recommended approach because Cloudant cannot optimise the query, even if the searchable field is indexed. Each document in the database would have to be examined in turn to see it matched the provided regular expression. This process becomes very inefficient as the size of the data set increases and leads to very slow performance.
