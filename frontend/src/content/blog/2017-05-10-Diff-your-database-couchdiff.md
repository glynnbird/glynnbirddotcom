---
title: couchdiff
pubDate: 2017-05-10T09:00:00.000Z
description: Compare two databases on the command line
heroImage: ../../assets/hermes-rivera-265380-unsplash.jpg
relCanonical: https://blog.cloudant.com/2017/05/10/Diff-your-database-couchdiff.html
---

The Unix `diff` command-line utility has been around since the 1970s. It compares two text files line by line and tells you the differences between them.

If I `diff` two files [a.txt](https://gist.github.com/glynnbird/03ea265a3a670e8b514512e36fd63582) and [b.txt](https://gist.github.com/glynnbird/c0705e06d633cdbc40b680b2d8e69c96) containing versions of the same poem I can find the differences between them with the command:

```sh
$ diff a.txt b.txt
2c2
< T.S. Eliot 1888-1965
---
> T.S. Eliot
6a7
> Sprouting despondently at area gates.	
13,14d13
< 
< From Prufrock, and other observations (The Egoist, Ltd, 1917)
```

Lines starting with `<` means "this line needs removing" and lines starting with `>` means "this line needs adding". The other lines specify where in the file the changes would need to be made - this machine-readble data allows one file to be "patched" to match another.

We can also output the same data in a so-called "unified" format by passing a `-u` parameter:

```sh
$ diff -u a.txt b.txt
--- a.txt	2017-04-25 14:03:12.000000000 +0100
+++ b.txt	2017-04-25 13:56:20.000000000 +0100
@@ -1,14 +1,13 @@
 Morning at the Window
-T.S. Eliot 1888-1965
+T.S. Eliot
 
 They are rattling breakfast plates in basement kitchens,
 And along the trampled edges of the street
 I am aware of the damp souls of housemaids
+Sprouting despondently at area gates.	
  
 The brown waves of fog toss up to me	        
 Twisted faces from the bottom of the street,
 And tear from a passer-by with muddy skirts
 An aimless smile that hovers in the air
 And vanishes along the level of the roofs.
-
-From Prufrock, and other observations (The Egoist, Ltd, 1917)
```

This format uses '-' and '+' in place of '<' and '>' and provides a few lines of context around each change making it a little easier to digest.

## Diffing a database

Let's say we have two databases instead of two text files - in this case two Apache CouchDB or Cloudant databases. How can we tell if documents in each database are identical, and if they're not, which ones differ? 

I've written a command-line tool to do just that: [couchdiff](https://www.npmjs.com/package/couchdiff).

It is installed using the `npm` command:

```sh
npm install -g couchdiff
```

and can then be used just like `diff`, except that it expects two *URLs* instead of two file paths e.g.

```sh
$ couchdiff http://localhost:5984/mydb1 http://localhost:5984/mydb2
spooling changes...
sorting...
calculating difference...
2c2
< 1000543/1-3256046064953e2f0fdb376211fe78ab
---
> 1000543/2-7d93e4800a6479d8045d192577cff4f7
```

In this case, the two databases are identical except for document id `1000543` which is at a later revision in the second database.

The URLs can point to local CouchDB datbases or remote Cloudant databases, or both:

```sh
$ couchdiff http://localhost:5984/mydb1 https://USER:PASS@myhost.cloudant.com/mydb2
spooling changes...
sorting...
calculating difference...
```

Like `diff`, `couchdiff` also accepts a `-u` parameter to output the data in "unified format". 

## How does couchdiff work?

The couchdiff utility:

1) Gets the [changes feed](https://console.ng.bluemix.net/docs/services/Cloudant/api/database.html#get-changes) for each of the databases and writes the document id and revision token to a temporary file - one file for each database.
2) The temporary files are sorted using the `sort` command-line tool. This ensures that both files are in "id order".
3) The two files are "diffed" using the `diff` utility, which is the output you see. If the databases are identical there will be no output.

You need both `sort` and `diff` to be installed on your machine for this to work. A Mac and most Linux distributions would have them pre-installed.

## What about conflicts?

Conflicted documents are ignored by `couchdiff` by default but by adding the `--conflicts` parameter brings them into play. With

```sh
$ couchdiff --conflicts http://localhost:5984/mydb1 http://localhost:5984/mydb2
2c2
< mydoc/2-4c740c74de23b6e55214996ab0eda9a3
---
> mydoc/2-7942b2ce39cc4dd85f1809c1756a40c9
```

both databases will be compared *including* any variance in conflicted revisions.

## What about attachments?

The `couchdiff` tool doesn't the examine the bodies of binary attachments explicitly but as the document bodies contain a digest of each attachment, it will be able to detect differences in attachments.

## Other command-line tools

If you need to access your CouchDB or Cloudant database from the command-line then there are other tools you can use

- [couchimport](https://www.npmjs.com/package/couchimport) - import data to your database
