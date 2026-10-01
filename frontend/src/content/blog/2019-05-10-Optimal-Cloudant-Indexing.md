---
title: Optimal Cloudant Indexing
pubDate: 2019-05-10T06:00:00.000Z
description: Getting away with fewer indexes
heroImage: ../../assets/edgar-chaparro-1421246-unsplash.jpg
---


Traditionally, this is taught at Cloudant data modelling class:

- Design JSON representations of the objects that exist in your application - products, users, orders etc.
- If necessary, create multiple document "types" in the same database - use a field in the document to differentiate one from the other e.g. `"type": "product"`, `"type": "user"` etc
- Build indexes on the fields which you are going to query against e.g. if I am going to search products by category in product name order, I'm going to need an index on `category` & `name`. If I'm going to query my users by their email address, I'm going to need an index on `email`.
- Build app.
- Profit.

This is a perfectly valid approach: different document types *can* co-exist in the same database in Cloudant and we can define a handful of easily identifiable indexes per document type to service the access patterns our application needs. 

The downside is that we may have many indexes, let's say three indexes per document type or nine in total - one for each use-case. The more indexes your database has, the more computation, IO and disk space will be consumed creating and updating them.

To make an index apply to only one of our document types in a scenario where many document types co-exist in the same database, we will have to setup a [partial_filter_selector](https://cloud.ibm.com/docs/services/Cloudant?topic=cloudant-query#creating-a-partial-index) in the index definition - Cloudant churns through each document in the collection for each index definition and applies the _partial filter selector_ to see if it qualifies to be recorded in each index. It works, but it's an extra level of complication and to build an index on *products*, Cloudant would also have to churn through (and ignore) all of the *users* and *orders* in the same database.

Is there a way to manage with fewer indexes and without a partial filter selector? There is - read on.

## General purpose indexes

In our data design process we're going to include a handful of additional fields in our `product` document that are explicitly _indexed fields_:

```js
{
  "_id": "998877",
  "type": "product",
  "mpn": "25888529952",
  "category": "Celebration cakes",
  "name": "Chocolate Cake 400g (Serves 6)",
  "keywords": ["chocolate","cake","sophies", "birthday", "occasion", "walnut"],
  "brand": "Sophies's Snacks",
  "cost": 3.50,
  "vat_rate": 0.20,
  "vat": 0.70,
  "total": 4.20,
  "description": "Chocolate Cake layered with chocolate buttercream and topped with chocolate buttercream and walnuts",
  "fat": 21.9,
  "saturates": 7.6,
  "energy_kj": 176,
  "energy_kcal": 422,
  "i1": "",
  "i2": "",
  "i3": ""
}
```

The top-most fields are our normal data fields. The last three `i1`, `i2` and `i3` are fields designated to store data that is to be indexed, in the order that data is to be retrieved. 

We want to service the following three use-cases on our `"type": "product"` documents with our indexes:

1. Retrieve products by category name, ordered by order total, ascending or descending.
2. Fetch a product by its manufacturer's part number
3. Search for products by keywords

So when we store a document we also populate `i1`, `i2` and `i3` like so:

```js
  .
  .
  .
  "i1": "category#celebration cakes#4.20",
  "i2": "25888529952",
  "i3": "chocolate cake sophies celebration walnut"
}
```

- `i1` stores several strings, delimited by `#` - the word `catgegory`, the category name and the product price.
- `i2` stores the manufacturer's part number as a string.
- `i3` stores the keywords we wish to be searchable for this product.

If we query against one of these three `i*` fields, we can achieve performant searching and retrieve in the order we intended. We'll deal with querying later - first let's look at our `user` document:

```js
{
  "_id": "22815e7bb9",
  "type": "user",
  "name": "Bob Harry",
  "email": "bob.harry66632@aol.com",
  "date_joined": "2018-05-25",
  "verified": true,
  "password_hash": "edf944a17a1e0b5b5b9109cdb3486ee6",
  "salt": "a2f67b329fbba8e859d7ea2dd4aa8dce",
  "active": true,
  "i1": "",
  "i2": "",
  "i3": ""
}
```

Our use-cases this time are:

1. Fetch a user by their email address.
2. Get users in the order that they signed up.
3. Search for users by their name.

So we populate `i1`, `i2` and `i3` like so for users:

```js
  .
  .
  .
  "i1": "user#bob.harry66632@aol.com",
  "i2": "2018-05-25",
  "i3": "bob harry"
}
```

- `i1` stores two strings, delimited by `#` - the word `user`, and the user's email address.
- `i2` stores the user's sign-up date.
- `i3` stores the keywords we wish to be searchable for this user.


For our `order` document we are storing:

```js
{
  "_id": "8866743",
  "type": "order",
  "user_id": "22815e7bb9",
  "date": "2019-05-03",
  "products": [
    { 
      "product_id": "998877", 
      "name": "Chocolate Cake 400g (Serves 6)",
      "cost": 3.50,
      "vat": 0.70,
      "total": 4.20
    }
  ],
  "total_vat": 0.70,
  "total": 4.20,
  "paid": true,
  "i1": "",
  "i2": "",
  "i3": ""
}
```

Our use-cases for orders are:

1. Fetch all orders for a known `user_id` ordered by `date`
2. All orders, ordered by `date`
3. n/a

So we populate `i1`, `i2` and `i3` like so:

```js
  .
  .
  .
  "i1": "order#22815e7bb9#2019-05-03",
  "i2": "2018-05-25",
  "i3": ""
}
```

- `i1` stores three strings, delimited by `#` - the word "order", the order's `user_id` and the order `date`.
- `i2` stores the order `date`.
- `i3` is a blank string because we don't need a third index for orders.


## Indexing

This the part where we can make some savings.

Instead of creating many indexes for each document type's needs, we simply need create an index on each of our `i*` fields:

```
POST /mydb/_index HTTP/1.1

Content-Type: application/json
{
  "index": {
    "fields": ["i1"]
  },
  "name" : "i1",
  "type" : "json"
}
```

```
POST /mydb/_index HTTP/1.1

Content-Type: application/json
{
  "index": {
    "fields": ["i2"]
  },
  "name" : "i2",
  "type" : "json"
}
```

```
POST /mydb/_index HTTP/1.1

Content-Type: application/json
{
  "index": {
    "fields": [
      { "name": "type", "type": "string"},
      { "name": "i3", "type": "string"}
    ]
  },
  "name" : "i3",
  "type" : "text"
}
```

The `i1` & `i2` indexes are `type=json` indexes which can be used for selection and range query while preserving the order of the data in the indexed fields. The `i3` index is a `type=text` index because it's used for free-text searching.

In your application you may need different combinations of "json"/"text" indexes and you may need more than three `i` fields, or perhaps fewer.

## Querying

Querying against our `i1`/`i2`/`i3` indexes is little more opaque compared with composing JSON selector queries against named fields, but it does have a certain purity. We have to know which `i` field to use to answer a use-case and the form of the data we stored in that field. I like to keep a table that relates the index to the object type, and explains the form of data stored:

|         | i1                               | i2            | i3         |
|---------|----------------------------------|---------------|------------|
| product | category#\<category name\>#\<total\> | \<mpn\>         | \<keywords\> |
| user    | user#\<email\>                     | \<date_joined\> | \<name\>     |
| order   | order#\<user_id\>#\<date\>           | \<date\>        | n/a        |

Let's take a couple of examples.

### Retrieve products by category ordered by price, ascending

If we know our category is "Celebration Cakes" our query would be

```js
{
  "selector": {
     "i1": {
       "$gt": "category#celebration cakes#"
       "$lt": "category#celebration cakes#z"
     }
  }
}
```

which performs a range query on the `i1` field to retrieve documents which have values of `i1` in that range. As the product documents store data in `i1` in this form:

```
"category#celebration cakes#4.20"
```

we can be assured that data will come out in price order. To get reverse price order, we simply add `"sort": [ {"i1": "desc"} ]` to the query.

### Search for users by their name

If we want to search for the user "Liz Oakwell" we would perform the query:

```js
{
  "selector": {
     "type": "user",
     "i3": "Liz Oakwell"
  }
}
```

## Summary

By creating additional fields to store content that is to be indexed, your app can:

- Write the fields to be indexed as discrete fields in a form separate from the main data.
- Ensure that the form of the data stored in the indexed fields is consistent with your querying needs (e.g case insensitive/insensitive match) and in the sort order your application requires.
- Use fewer indexes, especially when storing multiple document types in the same database as all data types can share the same indexed fields. In this example, eight access patterns are achieved with three indexes. Creating fewer indexes places less indexing load on Cloudant and uses smaller amount of disk space.

Downsides? Querying is little less obvious at first and there is some repetition of data within the source objects.
