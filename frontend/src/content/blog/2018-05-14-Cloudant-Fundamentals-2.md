---
title: Cloudant Fundamentals 2/10
pubDate: 2018-05-14T09:00:00.000Z
description: The _id
heroImage: ../../assets/boats.jpeg
relCanonical: https://blog.cloudant.com/2018/05/14/Cloudant-Fundamentals-2.html
---


[Last time](/2018/04/27/Cloudant-Fundamentals-1.html) we looked at how to design a JSON document schema that models the data in your application. I didn't mention a vital field: the document's `_id`. 

Every Cloudant document has an `_id` - if you don't supply one when you write a new document then Cloudant will generate one for you. Letting Cloudant make an `_id` for you is the easiest solution, but there are some cases where you might want to keep control of the `_id` field for yourself.

The `_id` field is a document's unique identifier in a database and as such, it is indexed. This means that Cloudant can retrieve a document from a given `_id` very quickly by consulting the index - without having to page through all the documents in the collection to find the right one. 

The *primary index* used to write and retrieve documents by the `_id` field also keeps the documents in id-order on disk. We can use this to our advantage when we design your own `_id` values as we can employ the primary index to perform range queries e.g find documents where _id is less than, greater than or between supplied values. See the [GET /db/_all_docs](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-get-documents) API endpoint for querying the primary index.

Let's say we are storing user objects in a Cloudant database. It would be perfectly valid to store documents like this:

```js
{
  "type": "user",
  "name": "Abe Froman",
  "email": "abe.froman@aol.com",
  "registered": "2018-03-09T11:48:11.491Z",
  "profile": "Sausage maker",
  "city": "Chicago"
}
```

We omit the `_id` field and let Cloudant pick one. Something like `e87a03636ee3d9d0943cd1f35f431fe7` will be generated on our behalf.

If we _know_ something unique about our user, such as their email address, we could modify the document to look like this:

```js
{
  "_id": "user:abe.froman@aol.com",
  "type": "user",
  "name": "Abe Froman",
  "email": "abe.froman@aol.com",
  "registered": "2018-03-09T11:48:11.491Z",
  "profile": "Sausage maker",
  "city": "Chicago"
}
```

Now we are storing the user type and the email address in the `_id` field. This means we can use the primary index to add a little value. We can query the primary index toget a list of all documents whose ids start with `user:` and the returned list will be in email address order.

## I want my auto-incrementing values back

If you're used to relational databases, you may be familiar with auto-incrementing primary keys. The key starts at "1" for the first record and the number increments each time - easy! With Cloudant, you either get Cloudant to generate a unique id for you, or you create your own. If you want your document's ids to be "1", "2", "3" etc, it's up to you to keep track of where you're up to! 

I'd recommend using Cloudant's auto-generated id's or supplying your own when you know something unique about the object you are saving. 

## How do I generate my own unique identifier

There are libraries to do that can generate unique identifiers for you  such as the [uuid](https://www.npmjs.com/package/uuid) package for Node.js:

```js
const uuidv4 = require('uuid/v4');
uuidv4(); // ⇨ '416ac246-e7ac-49ff-93b4-f7e94d997e6b'
```

Alternatively you could ask Cloudant to supply a list of ids for you with the [GET /_uuids](https://cloud.ibm.com/apidocs/cloudant#getuuids) API call.

```js
{
	"uuids": [
	  "6260efe4dfe1b6fc9b1f65257446080c", 
	  "6260efe4dfe1b6fc9b1f6525744613dd", 
	  "6260efe4dfe1b6fc9b1f6525744616b1", 
	  "6260efe4dfe1b6fc9b1f6525744616c3", 
	  "6260efe4dfe1b6fc9b1f652574461d91"]
}
```

## Can I edit an _id once it's in the database?

Although you can edit a document body, you can't change a document's id. There's nothing stopping you deleting the unwanted document and creating a new one. You can even do both the delete and the insert operations at the same time usint a `POST /db/_bulk_docs` request.

## Next time

In the next post, we'll unlock the mysteries of the `_rev` token.
