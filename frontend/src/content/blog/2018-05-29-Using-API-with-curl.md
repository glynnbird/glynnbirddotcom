---
title: Cloudant Fundamentals 4/10
pubDate: 2018-05-29T09:00:00.000Z
description: Using the API with curl
heroImage: ../../assets/michael-podger-43123-unsplash.jpg
relCanonical: https://blog.cloudant.com/2018/05/29/Using-API-with-curl.html
---


The [curl](https://curl.haxx.se/) command-line tool allows you to make HTTP requests from a terminal:

```sh
$ curl 'http://www.website.com/'
<html>
<h1>This is a web page</h1>
</html>
```

[Cloudant's API](https://cloud.ibm.com/apidocs/cloudant) is entirely HTTP. You don't need any special software drivers or to understand a bespoke protocol &mdash; it's just web requests. You can access the database from a browser, a mobile app, any programming language or, in this case, from the command line.

The first thing you'll need is your Cloudant service's URL. It'll look something like this:

```
https://username:password@hostname.cloudant.com
```

- all traffic between you and Cloudant is sent over HTTPS
- the administrator's username and password are encoded into a URL using "Basic" authentication (other forms of [authentication](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-work-with-your-account#authentication) are available)
- the domain name `hostname.cloudant.com` is the address of your Cloudant cluster. 

## Put your URL in an environment variable

We don't want to have to type that URL every time, so a nice shortcut is to put it into an environment variable:

```sh
$ export URL="https://username:password@hostname.cloudant.com"
```

We can then access our the `$URL` variable using `curl` which comes pre-installed on Macs and Linux machines and is available [to download](https://curl.haxx.se/) on other platforms:

```sh
$ curl $URL
{"couchdb":"Welcome","version":"2.1.1","vendor":{"name":"IBM Cloudant","version":"6656","variant":"paas"},"features":["geo","scheduler","iam"]}
```

If you see some JSON, you're in!

![A dewy spider web]({{< param "image" >}})
> Photo by [michael podger](https://unsplash.com/photos/jpgRztEuaV4?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on Unsplash

## Let's create a database

Databases are created with a `PUT` API call.

```sh
$ curl -X PUT "$URL/newdb"
{"ok":true}
```

the `-X` parameter defines the HTTP method. If omitted it is assumed to be `GET`, but `PUT`, `POST` and `DELETE` (and others) are allowed. We are asking a database called `newdb` to be created and as we got `{"ok":true}` back, then it worked!

If we tried to do the same thing again, we'd get an error because it already exists:

```sh
$ curl -X PUT "$URL/newdb"
{"error":"file_exists","reason":"The database could not be created, the file already exists."}
```

Sometimes it's good to see the HTTP status code in the response. Adding `-i` to the command will do that:

```sh
$ curl -i -X PUT "$URL/newdb"
HTTP/2 412
content-type: application/json

{"error":"file_exists","reason":"The database could not be created, the file already exists."}
```

In the above example `412` is our error code. There's a [full list here](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes), but in general:

- 20x - good
- 30x - nothing happened
- 40x/50x - your request failed

## Adding data

We can add data to our database by posting a JSON object. We have to specify the data *is* JSON by specifying a "Content-type" header:

```sh
$ curl -X POST \
    -H "Content-type: application/json" \
    -d '{"x":1}' \
    "$URL/newdb"
{"ok":true,"id":"2ded8ec775b6728227143ac575613060","rev":"1-0785e9eb543380151003dc452c3a001a"}
```

This time we're using a `POST` endpoint and passing our JSON using the `-d` parameter. Cloudant has auto-generated an ID for us which we see in the response.

If the JSON you want to add is in a file, you can do the following instead:

```sh
$ curl -X POST \
    -H "Content-type: application/json" \
    -d@myfile.json \
    "$URL/newdb"
```

## Reading the document back

We can read the document back again with a `GET` request:

```sh
$ curl "$URL/newdb/2ded8ec775b6728227143ac575613060"
{"_id":"2ded8ec775b6728227143ac575613060","_rev":"1-0785e9eb543380151003dc452c3a001a","x":1}
```

Where `2ded8ec775b6728227143ac575613060` was the auto-generated ID (it will be a different ID in your case).

## Modifying a document

To create another revision we need to do a new POST request, passing in the new document body *including the old document's revision token*:

```sh
$ curl -X POST \
       -H "Content-type: application/json" \
       -d '{"_id":"2ded8ec775b6728227143ac575613060","_rev":"1-0785e9eb543380151003dc452c3a001a","x":2}' \
       "$URL/newdb"
{"ok":true,"id":"2ded8ec775b6728227143ac575613060","rev":"2-8c49edca19d786e747fb5bea32c4cb91"}
```

We are free to add any new fields we want in the next revision of the document. Your schema can evolve over time to reflect the data your application needs to store. Cloudant doesn't allow you to modify individual attributes of the document &mdash; you must present the entire document you want to write with each revision.

## Deleting a document

The act of deleting a document causes a final revision to the document to be added with a `_deleted: true` flag added. Cloudant needs to know the ID of the document and the revision token that is to be deleted.

```sh
$ curl -X DELETE "$URL/newdb/2ded8ec775b6728227143ac575613060?rev=2-8c49edca19d786e747fb5bea32c4cb91"
{"ok":true,"id":"2ded8ec775b6728227143ac575613060","rev":"3-fb567087695adb203ba116e130794a84"}
```

This time our HTTP method is "DELETE" and the URL contains the document ID. The revision token is passed in as a "rev" parameter. Notice how you get another revision token in reply.

## Reducing the keyboard strain

If you're sick of typing long curl commands, you can reduce the strain by creating an "alias".

```sh
$ alias acurl='curl -i -H "Content-type: application/json"'
```

Using your `acurl` alias conjunction with your `URL` environment variable, you get:

```sh
$ acurl -X POST -d@myfile.json "$URL/newdb"
```

A more comprehensive `acurl` can be found [here](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-working-with-curl) which exchanges your credentials for a token and uses this in subsequent requests.

## Next time

Now we are able to create, read, update and delete single documents, next time we'll find out how to do the same thing in bulk.



