---
title: "CouchDB Auth Gen 2"
description: How to use CouchDB authentication in Cloudant Gen 2
pubDate: 2026-09-22T09:00:00+00:00
heroImage: ../../assets/dave-meckler-u1ebF25geyI-unsplash.jpg
relCanonical: https://blog.cloudant.com/2026/09/22/CouchDB-Auth-Gen-2.html
---

[Cloudant Gen 2](https://cloud.ibm.com/docs/cloudant-gen2) is the newest Cloudant plan built on IBM Cloud’s latest platform. It is based on a highly secure software-defined networking architecture and is ideal for cloud-native applications.

Cloudant Gen 2 instances have an almost identical API to other Cloudant services but one key difference is that they only support IAM authentication. So what happens if your application was built for _basic_ or _session_ auth?

This blog post runs through the options for migrating your application to be compatible with Cloudant Gen 2.

## Cloudant SDK - switch to IAM

If you are using the Cloudant SDKs for Node.js, Java, Python or Go, then it is very straightforward to reconfigure an application to use IAM authentication.

The SDKs know of a Cloudant instance's credentials in one of three ways, which we'll deal with in turn using the Node.js SDK as an example.

### Environment variables

The SDKs can be configured for basic auth or session auth by providing the username, password and URL as separate environment variables.

```sh
CLOUDANT_AUTH_TYPE=BASIC
# or if you're using session auth
# CLOUDANT_AUTH_TYPE=COUCHDB_SESSION
CLOUDANT_URL=https://00000000-0000-0000-0000-000000000000.zzz.cloudant.us-south.dataservices.appdomain.cloud # use your own Cloudant public or private URL
CLOUDANT_USERNAME=username # replace with your Cloudant legacy username
CLOUDANT_PASSWORD=password # replace with your Cloudant legacy password or API key
```

to switch to IAM API Key authentication we need only two environment variables:

```
CLOUDANT_URL=https://~replace-with-cloudant-host~.cloudantnosqldb.appdomain.cloud # use your own Cloudant public or private URL
CLOUDANT_APIKEY={your IAM API Key} # use your own IAM API key
```

> Note: IAM API keys is only one form of IAM authentication. Read more [here](https://github.com/IBM/cloudant-node-sdk/blob/main/docs/Authentication.md) to find out about Trusted Profiles.

### Programmatic

The `BasicAuthenticator` is switched for the `IamAuthenticator`:

```js
import { CloudantV1 } from '@ibm-cloud/cloudant';
import { IamAuthenticator } from 'ibm-cloud-sdk-core';

const authenticator = new IamAuthenticator({
    apikey: '{apikey}'
});

const service = new CloudantV1({
    authenticator: authenticator
});
```

### Credentials file

The `ibm-credentials.env` now contains the URL and IAM API key:

```
CLOUDANT_APIKEY={your IAM API Key}
CLOUDANT_URL={your Cloudant instance's URL}
```

## Using Basic Auth with Cloudant Gen 2

For applications using HTTP clients other than the Cloudant SDKs, switching to IAM is harder (it is possible - see this guide on [how to exchange an API key for a bearer token](https://cloud.ibm.com/docs/iam?topic=iam-iamtoken_from_apikey)) so a pragmatic choice might be to find a way to use Basic or Session auth with Cloudant Gen 2.

It turns out that Cloudant Gen 2 will still respect Apache CouchDB's authentication mechanism so as long as you have:

- a `_users` database - this is used to store the username and hashed password of each user.
- a `{db_name}/_security` document for each database - this grants access to users from the `_users` database as either "members" or "admins".

The "members" can act insert, update and delete regular Cloudant documents and perform queries. They cannot write to design documents.
The "admins" can do everything that "members" can, and in addition be able to insert, update and delete design documents.

> Important! To be able to create the `_users` database and to write the `_security` documents we need to be authenticated using IAM with a Manager role.

In curl we could do:

```sh
# exchange an IAM API Key for a time-limited bearer token
BEARER_TOKEN=`curl -s -X POST https://iam.cloud.ibm.com/identity/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=$CLOUDANT_APIKEY" \
  | jq -r .access_token`

# create a new, empty _users database
curl -H "Authorization: Bearer $BEARER_TOKEN" \
  -X PUT \
  "$CLOUDANT_URL/_users"
# {"ok":true}

# create a user in the _users database. Username: foo, Password: bar
# in practice, use a high-entropy password
curl -H "Authorization: Bearer $BEARER_TOKEN" \
  -X PUT \
  -H 'Content-type: application/json' \
  -d '{"name": "foo", "password": "bar", "roles":[], "type": "user"}' \
  "$CLOUDANT_URL/_users/org.couchdb.user:foo"
# {"ok":true,"id":"org.couchdb.user:foo","rev":"1-d62ec..."}

# create a database that we want this user to access: orders
curl -H "Authorization: Bearer $BEARER_TOKEN" \
  -X PUT \
  -H 'Content-type: application/json' \
  "$CLOUDANT_URL/orders"
# {"ok":true}

# grant user "foo" access to the database "orders" as one of the "admins"
curl -H "Authorization: Bearer $BEARER_TOKEN" \
  -X PUT \
  -H 'Content-type: application/json' \
  -d '{"couchdb_auth_only": true, "admins":{ "names":["foo"],"roles":[]}, "members":{ "names":[], "roles":[]}}' \
  "$CLOUDANT_URL/orders/_security"
# {"ok":true}

# To add foo as one of the members, it's this
# curl -H "Authorization: Bearer $BEARER_TOKEN" \
#  -X PUT \
#  -H 'Content-type: application/json' \
#  -d '{"couchdb_auth_only": true, "admins":{ "names":[""],"roles":[]}, "members":{ "names":["foo"], "roles":[]}}' \
#  "$CLOUDANT_URL/orders/_security"
# {"ok":true}

# try our new credentials using basic auth
curl -u foo:bar "$CLOUDANT_URL/orders/_all_docs"
#{"total_rows":0,"offset":0,"rows":[
#
#]}
```

There is also a Node.js script which performs these steps which can be found [here](https://github.com/glynnbird/create_cloudant_user) e.g.

```sh
# create a user "foo" with password "bar" that has access to
# the "orders" databases as one of the "admins"
node create_cloudant_user.js foo bar orders admins

# create a second user "foo2" and grant that user to the members
# list of the same database
node create_cloudant_user.js foo2 bar2 orders members

# grant "foo2" user members access to the reports database as well
node create_cloudant_user.js foo2 bar2 reports members
```

The script creates users only if they don't already exist, will append new users to existing arrays in the `_security` document and won't modify the `_security` document if the user being added is present already.

## Using CouchDB credentials

We now have a username and password which we can use to be authorised as a _member_ or as an _admin_ of one or more databases in our Cloudant instance.

There are, however, some limitations:

- A `{db_name}/_security` document is required for each database that is to be accessed with CouchDB credentials
- CouchDB credentials are not shared between Cloudant instances.
- There is no way for the CouchDB credentials to perform manager level tasks such as database creation, database deletion, listing all databases, inspecting active tasks etc.
- To manage replications, access is required to add or modify documents into the `_replicator` database. This is possible if the basic auth user is added to a `_replicator/_security` document. It is not possible to use the `_replicate` endpoint.
