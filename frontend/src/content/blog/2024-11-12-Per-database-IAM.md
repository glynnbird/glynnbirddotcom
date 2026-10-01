---
title: "Per Database IAM"
description: Finer-grained controls over IAM polices.
pubDate: 2024-11-12T00:00:00Z
heroImage: ../../assets/patrick-robert-doyle--XiKxvvFGgU-unsplash.jpg
---

Until recently, IBM's Identity and Access Management (IAM) system could be used to grant access to whole IBM Cloudant instances or groups of instances, including all of their databases and all of those databases' documents. As of November 2024, this has been improved to allow finer-grained _database-level_ access.

An IAM Service ID, user or access group can be granted access to:

- A single database.
- A group of databases using wildcard operators.

This blog post will explore how to set up database-level IAM access to one or more Cloudant databases using Terraform.

## Service IDs

First we create a Service ID, an identity used by a program or service to access the database. The Service ID lists which Cloudant service or services it covers e.g.:

- A single Cloudant instance.
- All Cloudant instances in a region.
- All Cloudant instances in the entire IBM Cloud account.
- Cloudant instances matched by name, including wildcard e.g. `ecommerce-prod-*`.

The Service ID can be associated with one or more Service Policies. These define which roles will be granted to the Service ID when accessing services e.g whether it can just read data, write data or manage the entire service.

API keys can be attached to the Service ID. These case are used by the database client to authenticate with the IBM Cloud and gain access to a Cloudant database.

This Terraform configuration defines a Service ID that applies to all Cloudant instances in the IBM Cloud account, granting `Reader` and `Writer` access to the client, with a single API key.

```terraform
# configure Terraform to use the IBM Cloud provider
terraform {
  required_providers {
    ibm = {
      source = "IBM-Cloud/ibm"
      version = ">= 1.71.0"
    }
  }
}

# configure the IBM Cloud Terraform provider to use our IBM Cloud API key
# which is provided in terraform.tfvars file or as CLI option:
#   terraform apply -var="ibmcloud_api_key=XXXX"
provider "ibm" {
  region = "eu-gb"
  ibmcloud_api_key = var.ibmcloud_api_key
}

# the service id - the identity assumed by the entity that 
# authenticates with IBM IAM
resource "ibm_iam_service_id" "my_service_id" {
  name = "my_service_id"
  description="A service id for per-database access demo"
}

# the policy attached to the service id. In this case
# - it applies to all Cloudant services in this IBM Cloud account
# - and gives Reader/Writer access to the user
resource "ibm_iam_service_policy" "policy" {
  description = "policy for per-database access demo"
  iam_service_id = ibm_iam_service_id.my_service_id.id
  roles           = ["Reader","Writer"]

  # grant access to all Cloudant services in this IBM Cloud account
  resource_attributes {
    name = "serviceName"
    value = "cloudantnosqldb"
  }
}

# attach an API key to the service id to allow 
# someone to authenticate
resource "ibm_iam_service_api_key" "myApiKey" {
  name = "my_api_key"
  description = "Per-database access demo"
  iam_service_id = ibm_iam_service_id.my_service_id.iam_id
}

# output the API key so the terraform user can use the 
# generated key
output apiKey {
  value = ibm_iam_service_api_key.myApiKey.apikey
  sensitive = true
}
```

We can create our Service ID, Policy & API key with 

```sh
terraform init
terraform apply
```

and see the generated API key with:

```sh
terraform output -json
```

Now we have a working Service ID with an accompanying API key, we need to narrow its scope such that it can only act on a subset of the Cloudant databases.

## Limiting access to single database name

To limit this Service ID's access to a single database, we need to add some extra clauses to our policy:

```terraform
resource "ibm_iam_service_policy" "policy" {
  description = "policy for per-database access demo"
  iam_service_id = ibm_iam_service_id.my_service_id.id
  roles           = ["Reader","Writer"]

  # grant access to all Cloudant services in this IBM Cloud account
  resource_attributes {
    name = "serviceName"
    value = "cloudantnosqldb"
  }

  # restrict access by database
  resource_attributes {
    name = "resourceType"
    value = "database"
  }

  # ... whose name is 'mydatabase'
  resource_attributes {
    name = "resource"
    value = "mydatabase"
  }
}
```

The last two "resource_attributes" define that this policy only applies to Cloudant databases called "mydatabase". This would apply to any "mydatabase" on any Cloudant instance in this IBM Cloud account.

## Limiting access to a range of database names

It is good practice to spread time-series data across several "timeboxed databases" e.g. monthly databases for events named `events_2024_01` and `events_2024_02`. Instead of supplying fixed database names in our policy, we are also permitted to provide a `*` multi-character wildcard to allow access to a range of related database names:

```terraform
resource "ibm_iam_service_policy" "policy" {
  description = "policy for per-database access demo"
  iam_service_id = ibm_iam_service_id.my_service_id.id
  roles           = ["Reader","Writer"]

  # grant access to all Cloudant services in this IBM Cloud account
  resource_attributes {
    name = "serviceName"
    value = "cloudantnosqldb"
  }

  # limit access to a database name
  resource_attributes {
    name = "resourceType"
    value = "database"
  }

  # ... that matches the wildcarded string...
  resource_attributes {
    name = "resource"
    value = "events_*"
    operator = "stringMatch"
  }
}
```

A small change to the last `resource_attributes` defines the pattern that the database name must match to be covered by this policy. Notice that the `operator` is set to `stringMatch` where before we were relying on the default operator of `stringEquals`. The use of `stringMatch` unlocks wildcard matching.

We can also employ the `?` single-character wildcard character when we know we have one or a fixed number of characters to deal with. e.g for databases with names of the form `events_001`, `events_002` and where we don't want to match `events_history` etc:

```terraform
  resource_attributes {
    name = "resource"
    value = "events_???"
    operator = "stringMatch"
  }
```

or the two wildcards can be combined, so if we are expecting database names of the form `events_001_prod` and `events_101_dev` we can use:

```terraform
  resource_attributes {
    name = "resource"
    value = "events_???_*"
    operator = "stringMatch"
  }
```

## URL encoding database names

If database names include special characters that need to urlencoded, then it is the urlencoded forms of these database names that need to appear in the policy definitions e.g. for a database name of `movies+reviews`, a policy that matched on that exact name would be:

```terraform
  # restrict access by database
  resource_attributes {
    name = "resourceType"
    value = "database"
  }

  # ... whose name is 'movies+reviews'
  resource_attributes {
    name = "resource"
    value = "movies%2Breviews"
  }
```

The one exception to this rule is database names that contain a forward slash character e.g. a database named `movies/reviews` would appear like:

```terraform
  # restrict access by database
  resource_attributes {
    name = "resourceType"
    value = "database"
  }

  # ... whose name is 'movies/reviews'
  resource_attributes {
    name = "resource"
    value = "movies/reviews"
  }
```

Further examples are listed in [the Cloudant documentation](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-managing-access-for-cloudant).

## Further information

- [Cloudant Documentation](https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-managing-access-for-cloudant#database-level-iam-policies)
- [IAM Service Policy - Terraform](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/resources/iam_service_policy)
- [IAM Service ID - Terraform](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/resources/iam_service_id)
- [IAM Service API Key - Terraform](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/resources/iam_service_api_key)
