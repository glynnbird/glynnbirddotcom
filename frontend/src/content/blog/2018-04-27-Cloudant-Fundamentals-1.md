---
title: Cloudant Fundamentals 1/10
pubDate: 2018-04-27T09:00:00.000Z
description: The Document
heroImage: ../../assets/kristina-tripkovic.jpg
relCanonical: https://blog.cloudant.com/2018/04/27/Cloudant-Fundamentals-1.html
---

> Note: Given the age of this blog post, several links may be broken.

[Cloudant](https://www.ibm.com/cloud/cloudant) is a JSON document store, based on [Apache CouchDB](http://couchdb.apache.org/), running as-a-service in the IBM Cloud. The form of JSON you store in the database is up to you. You don't need to tell the database about the _schema_ you're using ahead of time.

Here's a typical document:

```js
{
  "type": "person",
  "born": "1743-04-13",
  "name": "Thomas Jefferson",
  "potus": 3,
  "diedInOffice": false,
  "address": {
    "street": "931 Thomas Jefferson Pkwy",
    "town": "Charlottesville",
    "state": "Virginia",
    "stateCode": "VA",
    "zip": "22902"
  },
  "description": "Thomas Jefferson (April 13 [O.S. April 2] 1743 – July 4, 1826) was an American Founding Father who was the principal author of the Declaration of Independence and later served as the third President of the United States from 1801 to 1809. Previously, he was elected the second Vice President of the United States, serving under John Adams from 1797 to 1801. A proponent of democracy, republicanism, and individual rights motivating American colonists to break from Great Britain and form a new nation, he produced formative documents and decisions at both the state and national level. He was a land owner and farmer.",
  "offices": ["Governor of Virginia","Secretary of State", "Vice President"]
}  
```

JSON allows you to represent your data through key/value pairs that are:

- strings
- numbers
- booleans
- objects
- arrays of any of the above

Cloudant doesn't restrict you on how detailed or "nested" your objects are (other database services restrict you to top-level key/values, for instance), so you can have arrays of objects that contain arrays of objects, if that is what you need.

## Rules of thumb

### Avoid thinking in joins

Cloudant doesn't do joins like a relational database, so the JSON objects tend to be denormalised (i.e., contain repetitions of data held elsewhere)ok . Don't try to  model your data in a relational way and join it yourself in your app. 

### Size matters

Cloudant will refuse to store documents over 1MB in size, but you shouldn't be going anywhere near that hard limit. The example document above is less than 1KB. 

### Schemaless doesn't mean schema-free

Although Cloudant won't object if you use a different schema for each document in your database, that's probably not what you want. One of the first things I do when creating a new project is design the schema, in other words sketch the JSON that represents the objects I'm going to save and the data types of each key. I don't have to tell *Cloudant* what the schema is, but that doesn't mean I shouldn't give careful consideration to my data model before I jump into the code.

Unlike other databases, Cloudant doesn't enforce data types or mandatory fields or permitted ranges of values, but it's likely that you still want to do that in your app. 

### Multiple object types in the same database

One widely used pattern that is odd to folks coming from a relational background is storing different object types in the same database. You could have blog posts and authors in the same Cloudant database using their own separate schema. One convention is to use the `type` field to indicate which flavour of object it is.

```js
{
  "type": "post",
  "name": "Thought Leadership for Beginners",
  "description": "How to think yourself to success.",
  "url": "https://myblog.com/2018-04-02-thougt-leadership.html",
  "data": "2018-04-02",
  "author": "John Doe"
}
```

```js
{
  "type": "author",
  "name": "John Doe",
  "url": "https://myblog.com/",
  "registered": "2005-09-18",
  "email": "john.doe@myspace.com",
  "confirmed": true
}
```

### Write-only document patterns

Cloudant allows documents to be updated, but not on a field-by-field basis. For example, your e-commerce site can't do:

```sql
UPDATE stock SET stock_level = stock_level  - 1 WHERE product_id='45'
```
    
Your app would have to fetch the whole document and write the whole, modified document back to the database. 

Think about whether you can adopt a "write only" approach. For the e-commerce example, a database could contain:

- a document every time inventory is received into the warehouse
- a document every time an item is sold

The sum of the stock levels could then be calculated for each product by aggregating the documents. Using this technique you are only ever *writing* documents, not updating an existing document over and over.

If you're interested in data modelling, then be sure to read [this guide](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-five-tips-for-modeling-your-data-to-scale-faq) from the Cloudant documentation and watch Joan Touzet's excellent talk [10 Common Misconceptions about CouchDB](https://www.youtube.com/watch?v=BKQ9kXKoHS8).

## Next time

Next time we'll look at a vital component of a Cloudant document: the `_id` field.
