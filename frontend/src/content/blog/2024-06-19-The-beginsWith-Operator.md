---
title: "The beginsWith Operator"
description: Using the new $beginsWith Cloudant Query operator
pubDate: 2024-06-19T15:46:06+01:00
heroImage: ../../assets/annie-spratt-88HN85BJbq4-unsplash.jpg
relCanonical: https://blog.cloudant.com/2024/06/19/The-BeginsWith-Operator.html
---

Cloudant Query implements a declarative query language, where a number of operators can be combined to form complex queries which return a subset of documents in the database.

In this blog post we'll explore a technique that creates an index on a composite key and uses the new `$beginsWith` operator to extract slices of the keyspace.

## The problem

Let's say we have an e-commerce shop with a hierarchy of categories, each containing one or more subcategories. At the bottom of the category hierarchy are the products themselves, with each product belonging to one category. The customers navigate through the category heirarchy to find the products.

Here are some sample documents:

```js
{
  "_id": "prod_abc123",
  "type": "product",
  "name": "Roland Jazz Chorus JC-40",
  "price": 599.99,
  "weight": 25,
  "category": "Amplifiers#Stereo#Solid State"
}

{
  "_id": "prod_abc456",
  "type": "product",
  "name": "Fender Princeton",
  "price": 899.99,
  "weight": 32,
  "category": "Amplifiers#Mono#Tube"
}

{
  "_id": "prod_abc789",
  "type": "product",
  "name": "Fender Telecaster",
  "price": 999.99,
  "weight": 4,
  "category": "Guitars#Electrics#Solid Body"
}

{
  "_id": "prod_abc2000",
  "type": "product",
  "name": "Martin D42",
  "price": 4999.99,
  "weight": 3,
  "category": "Guitars#Acoustics#Dreadnoughts"
}
```

Notice that the `category` field contains the hierarchy of categories, using the `#` character to delineate the levels of the hierarchy

```
Amplifiers
  Stereo
    Solid State
    Tube
  Mono
    Solid State
    Tube
Guitars
  Electrics
    Solid Body
    Hollow Body
  Acoustics
    Dreadnoughts
    OM
    Parlour
```

## Creating an index

We can create a Cloudant Query index on this `category` field:

```
POST /products/_index HTTP/1.1
{
  "index": {
    "fields": ["category"]
  },
  "name" : "category-index",
  "type" : "json"
}
```

We can now use this index to extract slices of the category hierarchy.

## Querying using $beginsWith

We query by POSTing a an object containing a `selector` object to `/<db_name>/_find`

```
POST /products/_find
{
  "selector": {
     "category": {
       "$beginsWith": "Guitars#Acoustics#"
     }
  }
}
```

This will return any document whose `category` attributes starts with the string "Guitars#Acoustics#" i.e. any category below the one supplied. As the index built on the `category` field is in alphabetical order, our `$beginsWith` operator works very efficiently, extracting rows from the index that share the same prefix.

We could explore any part of hierarchy with different query values

- `Guitars#` - all guitars
- `Guitars#Electrics#` - all electric guitars
- `Amplifiers#` - all amplifiers
- `Amplifiers#Stereo` - all stereo amplifiers
- `Amplifiers#Stereo#Solid State` - all solid-state stereo amplifiers

## Sorting by price

If we want our category data to be presented in cheapest-first order then we can add the product price to our indexed string, being careful to pad the prices so that they are the same length:

e.g.

```js
{
  "_id": "prod_abc123",
  "type": "product",
  "name": "Roland Jazz Chorus JC-40",
  "price": 599.99,
  "weight": 25,
  "category": "Amplifiers#Stereo#Solid State#00599"
}
```

We append the padded price (ignoring the figures after the decimal point) to the category.

Then when we ask for a query such as

```js
{
  "selector": {
    "$beginsWith": "Amplifiers#Stereo#Solid State#"
  }
}
```

although we don't explicitly ask for it, the results will be returned in price order.

> Note: when asking for higher level categories, e.g. `Guitars#` the results will be presented grouped by sub-category and then price.


