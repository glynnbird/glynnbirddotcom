---
title: Partitioned Databases - Data Design
pubDate: 2019-03-05T07:00:00.000Z
description: Designing your data for a partitioned database, including indexing and querying
heroImage: ../../assets/toa-heftiba-239004-unsplash.jpg
relCanonical: https://blog.cloudant.com/2019/03/05/Partition-Databases-Data-Design.html
---

Modelling data with a JSON document store is very different from modelling data in a relational database system. Generations of computer scientists have been taught how to [normalize data](https://en.wikipedia.org/wiki/Database_normalization) into tables, that is organising data into their own collections so that information is not repeated and relationships between collections are modelled with foreign keys.

Organising data in a "NoSQL" database like Cloudant makes "joins" prohibitively expensive and as a result the data design may involve the repetition of data. As with any data modelling exercise, there should be careful consideration of how the data is to be consumed - it is these "access patterns" that, together with database's best practise documentation, will influence how data is represented in the JSON documents.

Let's imagine we are building an e-commerce store with the Cloudant service. To do so we are going to use three Cloudant databases to store the following objects:

- `users` - a *user* is a registered user of the site with their contact details, delivery addresses and payment methods.
- `products` - a *product* is a sellable product on our e-commerce store.
- `orders` - an *order* represents the sale of one or more products to a user, together with how they paid and information from the courier to indicate dispatch and delivery.

We are going to design our data with the following goals:

- Favouring small documents that tend to be added or removed (not updated over and over).
- Leveraging Cloudant's *partitioned databases* feature where possible - two-part `_id` fields group documents that logically belong together on the same database shard.
- Although there are relationships within the databases (i.e. an order represents a *user* buying one or more *products*), data is allowed to be duplicated where it makes sense to prevent the application having to make multiple round trips to the database to populate a web page.

## The products database

The *products* database contains one document per sellable product. Products are categorised into a taxonomy of categories e.g. "Home > Kitchen > Small Appliances", a hierarchy which is surfaced in the website as a clickable menu of category names.

Each product has a simple list of attributes, some of which are searchable (e.g. keywords) others (e.g. image) are used to render the front-end web page or mobile app.

The document's _id contains:

- The product's place in the taxonomy joined by "#" characters e.g. Home#Kitchen#Small Appliances. This forms the partition key, so products in the same category are stored together.
- A ":" to indicate the divide between the partition key and the document key.
- The document's *productid* following the colon. 

A sample document looks like this:

```js
{
  "_id": "Home#Kitchen#Small Appliances:1000042",
  "type": "product",
  "taxonomy": ["Home","Kitchen","Small Appliances"],
  "keywords": ["Salter","Scales","Weight","Digital","Kitchen"],
  "productid": "1000042",
  "brand": "Salter",
  "name": "Digital Kitchen Scales",
  "description": "Slim Colourful Design Electronic Cooking Appliance for Home / Kitchen, Weigh up to 5kg + Aquatronic for Liquids ml + fl. oz. 15Yr Guarantee - Green",
  "colours": ["red","green","black","blue"],
  "price": 14.99,
  "delivery"; 0,
  "image": "assets/img/0gmsnghhew.jpg"
}
```

## Users database

The *users* database stores details about the registered users of our store. We store:

- 1 core document per user.
- 1 additional document for each user's delivery addresses.

The document's `_id` fields are organised so that for a known `userid` (i.e. if a user is logged in and we know their `userid`), we can fetch everything we need to know about that user in one Cloudant Query because the data resides in the same partition. If we need to store other data about the user in the future e.g. payment methods, user preferences etc, further documents can be added following the same pattern.

Here's some example documents:

```js
{
  "_id": "user19952622:auth",
  "type": "user",
  "userid": "user19952622",
  "name": "Bob Smith",
  "email": "bob.smith@aol.com",
  "password": "1f6b5d0e151388786d3820cded9408e2",
  "salt": "43614d9b1dec23da34a5b6f4eb71fb59",
  "active": true,
  "email_verified": true
}
{
  "_id": "user19952622:delivery1",
  "type": "userdelivery",
  "userid": "user19952622",
  "name": "home",
  "address": "19 Front Street, Darlington, DL5 1TY",
  "default": true
}
{
  "_id": "user19952622:delivery2",
  "type": "userdelivery",
  "userid": "user19952622",
  "name": "work",
  "address": "22 Central Tower, Newcastle, NE1 4JD",
  "default": false
}
```

## Orders database

An order consists of a number of documents written to the database when a shopping basket of items is paid for:

- 1 core "order" document containing meta data.
- a number of "orderlineitem" - one per item in the basket.
- 1 "payment" document containing details of how the payment was made.
- 1 dispatch document indicating which courier is deliverying the items.
- 1 delivery document to indicate the arrival of the items.

As all of the documents reside in the same partition and can be fetched with a single query directed to the order's partition. In most cases, data is only written to Cloudant - the same document is not updated over and over as the order progresses.

```js
{
  "_id": "order555:order",
  "type": "order",
  "user": "Bob Smith",
  "orderid": "order555",
  "userid": "user19952622",
  "basket": ["Salter - Digital Kitchen Scales", "Kenwood - Stand Mixer"],
  "total": "214.98",
  "deliveryAddress": "19 Front Street, Darlington, DL5 1TY",
  "date": "2019-01-28T10:44:22.000Z"
}
{
  "_id": "order555:item1",
  "type": "orderlineitem",
  "orderid": "order555",
  "userid": "user19952622",
  "productid": "1000042",
  "name": "Salter - Digital Kitchen Scales",
  "quantity": 1,
  "unitPrice": 14.99,
  "delivery": 0
}
{
  "_id": "order555:item2",
  "type": "orderlineitem",
  "orderid": "order555",
  "userid": "user19952622",
  "productid": "88752",
  "name": "Kenwood - Stand Mixer",
  "quantity": 1,
  "unitPrice": 199.99,
  "delivery": 0
}
{
  "_id": "order555:payment",
  "type": "orderpayment",
  "orderid": "order555",
  "userid": "user19952622",
  "paid": "true",
  "provider": "PayPal",
  "provider_ref": "PayPal161619885998772",
  "date": "2019-01-28T10:45:27.000Z",
  "total": "214.98"
}
{
  "_id": "order555:dispatch",
  "type": "orderdispatch",
  "orderid": "order555",
  "userid": "user19952622",
  "dispatched": "true",
  "date": "2019-01-28T16:02:00.000Z",
  "courier": "UPS",
  "courierid": "15125425151261289"
}
{
  "_id": "order555:delivery",
  "type": "orderdelivery",
  "orderid": "order555",
  "userid": "user19952622",
  "delivered": "true",
  "courier": "UPS",
  "courierid": "15125425151261289"
}
```

## Querying the partitions

The database already indexes each document's `_id` field and with *partitioned databases*, documents belonging to the same partition reside on the same shard, making querying data in a single partition very efficient. We've made use of partitions to keep:

- products belonging to the same category in a partition per category.
- orders and the supplemental order data stored in a partition per order,
- users and other user meta data is stored in a partition per user.

Here's how we can use Cloudant Query to fetch documents from these partitions.

### Fetch products belonging a category

To fetch the first one hundred products from the `Home#Kitchen#Small Appliances` category, we can simply send a blank *selector* to the partition's `_find` endpoint:

```
POST /products/_partition/Home%23Kitchen%23Small%20Appliances/_find
{
  "selector": {},
  "limit": 100
}
```

Alternatively, the `_all_docs` endpoint can be used to fetch all the data from a partition

```
GET /products/_partition/Home%23Kitchen%23Small%20Appliances/_all_docs
```

### Searching within a known category

If we know the product category (perhaps the user has navigated to the "Home#Kitchen#Small Appliances" page), we can search for products within that partition by first defining a partitioned index and then querying it. A query aimed at a single partition and serviced by a pre-defined index constitutes best practice for a Cloudant database.

We can define a partial Cloudant Search index with a JavaScript function 

```js
function(doc) {
  if (doc.type == 'product') {
    var words = doc.taxonomy.join(' ') + 
                doc.keywords.join(' ') + 
                doc.brand + ' ' +
                doc.name + ' ' +
                doc.description + ' ' +
                doc.colours.join(' ');
    index('default', words, { store: false, index: true });
  }
}
```

Queries can be directed to a single partition with:

```sh
curl $URL/products/_partition/Home%23Kitchen%23Small%20Appliances/_design/mydesigndoc/_search/mysearchindex?q=salter+scales+red
```

Note that an index defined on a partitioned database is itself partitioned by default, although this behaviour can be overridden by supplying a `partitioned: false` flag at query-time to create a *global index*.

### Fetch order data

Similarly, all of an order's details can be fetched by pulling all of the data from the order's partition:

```
GET /orders/_partition/order555/_all_docs
```

If we only need the line items from the order we can be more specific:

```
POST /products/_partition/order555/_find
{
  "selector": {
    "type": "orderlineitem"
  },
  "limit": 100
}
```

If we only need the top-level meta data we can be even more selective: in fact, we don't even need to perform a query - we can simply fetch the document by its `_id`:

```
GET /orders/order555:order
```

### Fetch user data

The same technique can be used for the users database:

```
GET /users/_partition/user19952622/_all_docs
```

or we could fetch a user's default postal address with this query:

```
POST /users/_partition/user19952622/_find
{
  "selector": {
    "type": "userdelivery",
    "default": "true"
  },
  "fields": ["address"]
}
```

## Querying the whole data set - Indexing

In addition to the default primary index, we can define secondary indicies to instruct the database to create additional data structures, ordering the documents by different attributes. The secondary indicies can service additional access patterns we need for our application. Here's some examples:

- Product Search - a user needs to be able to perform a free-text search for products across all categories or within a single category.
- Orders by Customer - in the customer's dashboard they need to be able to view their order history.
- Orders by Time - for reporting purposes, the business needs to be able to extract all of the orders made between two dates.
- Sales Report - a total of paid-for orders needs to generated by year, year/month or year/month/day.
- Authentication - for authentication we need to pull back the "auth" document for a user of a known email address.

Let's dive into the detail of how we would achieve each of these use-cases using different features of Cloudant.

### Indexing - Product Search

In order to allow the user to search products with a string of words e.g. "Salter Scales Red" or "Digital Aquatronic", we need to index each document's searchable words and employ a "free text" search engine. Cloudant has a free text search engine built in in the form of its [Cloudant Search](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search) API. An index is defined with a JavaScript index definition function inside a design document. The function calls `index` to instruct the database to index selected data items. Here's an example:

```js
function(doc) {
  if (doc.type == 'product') {
    var words = doc.taxonomy.join(' ') + 
                doc.keywords.join(' ') + 
                doc.brand + ' ' +
                doc.name + ' ' +
                doc.description + ' ' +
                doc.colours.join(' ');
    index('default', words, { store: false, index: true });
  }
}
```

In this case we are concatenating all the strings we want to be searchable and indexing them as the `default` text index, which provides a general-purpose search facility. We can query the index with a simple HTTP API call:

```sh
curl $URL/_design/mydesigndoc/_search/mysearchindex?q=salter+scales+red
```

With a little extra work we could:

- Index strings separately which would allow searches to restricted to certain fields e.g. searching only product names. See [here](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search#index-functions).
- Indicate that we wish the database to count repeated strings in the result set or to group the price into multiple price brackets using *faceting*. See [here](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search#faceting).
- Query the data by weighting some fields more than others e.g. matches to the product name are worth more than matches to the product description. See [here](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-cloudant-search#query-syntax).

Note that in order to create an index that spans all the partitions, we need to supply `partitioned: false` in the design document that defines the index. See [documentation](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-database-partitioning#creating-a-global-view-index)

### Indexing - Orders by Customer

In our website's dashboard, we need to display a single user's order history. To service this access pattern, the *orders* database needs a *global* secondary index on the `userid` and `date` fields.

To create an index that only works on documents where `type="order"` and is indexed by `userid` and `date` we POST the following JSON to the `/orders/_index` endpoint:

```js
{
   "index": {
     "partial_filter_selector": {
       "type": "order"
     },
     "fields": [ "userid", "date" ]
   },
   "ddoc": "orders-by-customer-index",
   "type": "json",
   "partitioned": false
}
```

- The `partial_filter_selector` is the query that is performed at index-time to determine whether a document belongs in the the index. Only the top-level order summary documents get past this filter.
- The `fields` array is a list of documents fields to be indexed.
- The `ddoc` is our reference for this index. It determines which design document the index definition will be stored in and allows us to select the use of this index at query-time.
- The `type` specifies whether we want a "json" index powered by Cloudant's MapReduce engine or a "text" index powered by Cloudant Search.

We can then query the index by posting JSON to the `/orders/_find` endpoint:

```js
{
   "selector": {
      "type": "order",
      "userid": "user19952622"
   },
   "use_index": "orders-by-customer-index"
}
```

### Indexing - Orders by Time

In order to get all orders ordered by time, we need to create another *global* Cloudant Query index, again only including the core order documents and ordering by the `date` field:

```js
{
   "index": {
     "partial_filter_selector": {
       "type": "order"
     },
     "fields": ["date" ]
   },
   "ddoc": "orders-by-date",
   "type": "json",
   "partitioned": false
}
```

We can then query the index by posting JSON to the `/orders/_find` endpoint, in this case to find orders occuring after in January 2019:

```js
{
   "selector": {
      "type": "order",
      "date": {
         "$gte": "2019-01-01",
         "$lt": "2019-01-02"
      }
   },
   "use_index": "orders-by-date"
}
```

### Indexing - Sales Report

Performing aggregations for reporting purposes requires the use of Cloudant's MapReduce feature. A JavaScript function, embedded in a design document, is called by Cloudant for every document in the database. The function emits the keys/value pairs that define the ordering and grouping of the data and which fields are to be aggregated. Here's an example function that emits orders by year/month/day:

```js
function(doc) {
  if (doc.type == "order") {
    // turn the date string into a Date object
    var date = new Date(doc.date);
    // extract the date parts
    var year = date.getFullYear();
    var month = date.getMonth() + 1; // months go 0-11
    var day = date.getDate();
    // emit the key and value
    emit([year,month,day], doc.total);
  }
}
```

By choosing the `_sum` reducer, we instruct Cloudant to totalise the emitted value (`doc.total`). The MapReduce query engine allows data to be grouped by year/month/day, year/month, year or to group all the data to produce a grand total. In addition, the data can be filtered between `startkey` and `endkey` key values and the reducer can be switched off at query-time to just extract data between two dates.

Note that in order to create an index that spans all the partitions, we need to supply `partitioned: false` in the design document that defines the index. See [documentation](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-database-partitioning#creating-a-global-view-index)

### Indexing - Authentication

When a user is logging in, we can't do partitioned query on our `users` database because we don't yet know the user's `userid`. We have to create a secondary index on the user's email address and select a user record by the email field. We can reduce the index size by using a `partial_filter_selector` to only include the main user records that are active and have been verified:

```js
{
   "index": {
     "partial_filter_selector": {
       "type": "user",
       "active": true,
       "email_verified": true
     },
     "fields": ["email" ]
   },
   "ddoc": "users-by-email",
   "type": "json",
   "partitioned": false
}
```

To find a document matching a supplied email address we can use the following query, only asking for the fields we need:

```js
{
   "selector": {
      "type": "user",
      "active": true,
      "email_verified": true,
      "email": "joe@aol.com"
   },
   "use_index": "users-by-email",
   fields: ["userid", "password", "salt"]
}
```

## Summary

The Cloudant partial databases feature provides a step change in query performance for data designs that use the `_id` field to store a partition key and a document key. Careful data design can ensure that data that belongs together, and that you application expects to query in isolation, is stored in its own partition. Queries directed at a single partition only use fraction of the computing resource of a "whole database" query, resulting in faster performance and lower per-query pricing.

Other use-cases and access patterns can be serviced by secondary indexes that span *all* the partitions.


