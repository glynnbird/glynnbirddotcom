---
title: Cloudant Fundamentals 5/10
pubDate: 2018-06-04T09:00:00.000Z
description: Using the Bulk API
heroImage: ../../assets/matt-schwartz-408909-unsplash.jpg
---


In the last blog post we saw how to do CRUD (Create/Read/Update/Delete) operations with the Cloudant database using the curl command line tool. In this post we'll use just two API calls to achieve the same thing, but with the capability of working on multiple documents at the same time.

If you have two or five or a hundred documents to add to Cloudant, then you need to look at [bulk operations API](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-bulk-operations). If your app is going to go to the trouble making an HTTP call (doing a DNS lookup, creating a connection, negotiating a HTTPS handshake etc), then it may as well do as much work as it can with that connection while it can. It is much more efficient for you to bulk upload 100 documents in a single bulk request than send them in 100 separate API calls.

There's only two API calls you need to know about:

- `GET or POST /db/_all_docs` - for reads
- `POST /db/_bulk_docs` - for creates, updates and deletions

## Creating documents in bulk

Let's create a file called `bulk.json` that contains the documents we want to write:

```js
{
  "docs": [
    {"name": "Ferris Bueller", "actor": "Matthew Broderick", "dob": "1962-03-21"},
    {"name": "Sloane Peterson", "actor": "Mia Sara", "dob": "1967-06-19"},
    {"name": "Cameron Frye", "actor": "Alan Ruck", "dob": "1956-07-01"}
  ] 
}
```

We can write the three documents in a single API call:

```sh
$ curl -X POST \
       -H 'Content-type: application/json' \
       -d@bulk.json \
       "$URL/newdb/_bulk_docs"
[{"ok":true,"id":"6545abac34ff08ea39aaafb5ca1765c4","rev":"1-974e44505640c47cd31db6d4949aaff5"},{"ok":true,"id":"6545abac34ff08ea39aaafb5ca176920","rev":"1-9bcc8585a4cb3144fcffe8201f3c56d4"},{"ok":true,"id":"6545abac34ff08ea39aaafb5ca177037","rev":"1-8e73b2f79fcf8ef1cafa37d196808ecd"}]
```

Cloudant replies back with an array, with one element for each document inserted telling you the auto-generated id and the calculated rev token.

If we'd wanted to specify the _id fields we could have simply included them in the document objects in the submitted `bulk.json` file.

## Reading the documents back in bulk

As well as reading back single documents:

```sh
$ curl "$URL/newdb/6545abac34ff08ea39aaafb5ca1765c4"
{"_id":"6545abac34ff08ea39aaafb5ca1765c4","_rev":"1-974e44505640c47cd31db6d4949aaff5","name":"Ferris Bueller","actor":"Matthew Broderick","dob":"1962-03-21"}
```

we can use the `GET /db/_all_docs` endpoint to fetch multiple documents at once if we supply an array of document ids:

```sh
$ curl "$URL/newdb/_all_docs"
{"total_rows":3,"offset":null,"rows":[
{"id":"6545abac34ff08ea39aaafb5ca1765c4","key":"6545abac34ff08ea39aaafb5ca1765c4","value":{"rev":"1-974e44505640c47cd31db6d4949aaff5"}},
{"id":"6545abac34ff08ea39aaafb5ca176920","key":"6545abac34ff08ea39aaafb5ca176920","value":{"rev":"1-9bcc8585a4cb3144fcffe8201f3c56d4"}},
{"id":"6545abac34ff08ea39aaafb5ca177037","key":"6545abac34ff08ea39aaafb5ca177037","value":{"rev":"1-8e73b2f79fcf8ef1cafa37d196808ecd"}}
]}
```

But wait! Where are the document bodies? Cloudant has only returned the id of the documents (twice!) and the revision token.

If you want the document bodies too, you have specify `include_docs=true` in your request:

```sh
$ curl "$URL/newdb/_all_docs?include_docs=true"
{"total_rows":3,"offset":0,"rows":[
{"id":"6545abac34ff08ea39aaafb5ca1765c4","key":"6545abac34ff08ea39aaafb5ca1765c4","value":{"rev":"1-974e44505640c47cd31db6d4949aaff5"},"doc":{"_id":"6545abac34ff08ea39aaafb5ca1765c4","_rev":"1-974e44505640c47cd31db6d4949aaff5","name":"Ferris Bueller","actor":"Matthew Broderick","dob":"1962-03-21"}},
{"id":"6545abac34ff08ea39aaafb5ca176920","key":"6545abac34ff08ea39aaafb5ca176920","value":{"rev":"1-9bcc8585a4cb3144fcffe8201f3c56d4"},"doc":{"_id":"6545abac34ff08ea39aaafb5ca176920","_rev":"1-9bcc8585a4cb3144fcffe8201f3c56d4","name":"Sloane Peterson","actor":"Mia Sara","dob":"1967-06-19"}},
{"id":"6545abac34ff08ea39aaafb5ca177037","key":"6545abac34ff08ea39aaafb5ca177037","value":{"rev":"1-8e73b2f79fcf8ef1cafa37d196808ecd"},"doc":{"_id":"6545abac34ff08ea39aaafb5ca177037","_rev":"1-8e73b2f79fcf8ef1cafa37d196808ecd","name":"Cameron Frye","actor":"Alan Ruck","dob":"1956-07-01"}}
]}
```

Now we can see the whole document in a `doc` attribute of each element of the rows array.

## Updating documents in bulk

Let's update our `bulk.json` file to prepare it for a bulk update. We need to:

 - add the `_id`/`_rev` of each document 
 - add the data we want to add, in this case the IMDB URL of each actor

```js
{
  "docs": [
    {
      "_id": "6545abac34ff08ea39aaafb5ca1765c4",
      "_rev": "1-974e44505640c47cd31db6d4949aaff5",
      "name": "Ferris Bueller",
      "actor": "Matthew Broderick",
      "dob": "1962-03-21",
      "imdb": "http://www.imdb.com/name/nm0000111/?ref_=tt_cl_t1"
    },
    {
      "_id": "6545abac34ff08ea39aaafb5ca176920",
      "_rev": "1-9bcc8585a4cb3144fcffe8201f3c56d4",
      "name": "Sloane Peterson",
      "actor": "Mia Sara",
      "dob": "1967-06-19",
      "imdb": "http://www.imdb.com/name/nm0000214/?ref_=tt_cl_t3"
    },
    {
      "_id": "6545abac34ff08ea39aaafb5ca177037",
      "_rev": "1-8e73b2f79fcf8ef1cafa37d196808ecd",
      "name": "Cameron Frye",
      "actor": "Alan Ruck",
      "dob": "1956-07-01",
      "imdb": "http://www.imdb.com/name/nm0001688/?ref_=tt_cl_t2"
    }
  ]
}
```

Updating these three documents is simply a matter of posting this JSON to `POST /db/_bulk_docs`

```sh
$ curl -X POST -H 'Content-type: application/json' -d@bulk.json "$URL/newdb/_bulk_docs"
[{"ok":true,"id":"6545abac34ff08ea39aaafb5ca1765c4","rev":"2-3fe304e13f53719d577846b93a7fa865"},{"ok":true,"id":"6545abac34ff08ea39aaafb5ca176920","rev":"2-fa0d94cb2361136c666267746ae4b682"},{"ok":true,"id":"6545abac34ff08ea39aaafb5ca177037","rev":"2-bccbb9d28769bb4bf79116cf59c01c45"}]
```

and Cloudant gives back a new revision token for each document.

## Bulk deletions

Bulk deletions is similar to bulk updates, except that we don't need to supply a document body, only a `_deleted: true` flag for each id/rev pair:

```js
{
  "docs": [
    {
      "_id": "6545abac34ff08ea39aaafb5ca1765c4",
      "_rev": "2-3fe304e13f53719d577846b93a7fa865",
      "_deleted": true
    },
    {
      "_id": "6545abac34ff08ea39aaafb5ca176920",
      "_rev": "2-fa0d94cb2361136c666267746ae4b682",
      "_deleted": true
    },
    {
      "_id": "6545abac34ff08ea39aaafb5ca177037",
      "_rev": "2-bccbb9d28769bb4bf79116cf59c01c45",
      "_deleted": true
    }
  ]
}
```

which we post to `_bulk_docs`:

```sh
$ curl -X POST \
       -H 'Content-type: application/json' \
       -d@bulk.json \
       "$URL/newdb/_bulk_docs"
[{"ok":true,"id":"6545abac34ff08ea39aaafb5ca1765c4","rev":"3-6f40626814e930dbcb0d17ad4a82e9eb"},{"ok":true,"id":"6545abac34ff08ea39aaafb5ca176920","rev":"3-b0d3619a0af1d356b67dd15e7309e1a6"},{"ok":true,"id":"6545abac34ff08ea39aaafb5ca177037","rev":"3-1f4738f25cf3da86f1646f69740d88fb"}]
```

to get another set of revision tokens.

Note you can combine inserts, updates and deletes in the same `bulk_docs` call.

Don't forget we can use the `acurl` alias we created in the last post to shorten these commands:

```sh
$ acurl -X POST -d@bulk.json "$URL/newdb/_bulk_docs"
```

If you're not keen on command-line tools but want to learn the API, then you could also look at the [Postman](https://chrome.google.com/webstore/detail/postman/fhbjgbiflinjbdggehcddcbncdddomop?hl=en) Chrome extension, which allows low-level API calls to constructed in a graphical user interface.

## Next time

In the next blog we'll look at the programmatic equivalents of these Cloudant create/read/update/delete and bulk operations.
