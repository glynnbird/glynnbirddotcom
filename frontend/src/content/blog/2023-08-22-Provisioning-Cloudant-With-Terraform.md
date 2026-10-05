---
title: "Provisioning Cloudant With Terraform"
description: How to deploy a Cloudant instance using Terraform.
pubDate: 2023-08-22T00:00:00Z
heroImage: ../../assets/xavi-cabrera-kn-UmDZQDjM-unsplash.jpg
relCanonical: https://blog.cloudant.com/2023/08/22/Provisioning-Cloudant-With-Terraform.html
---

[Terraform](https://www.terraform.io/) is a hugely popular infrastructure management tool. It allows the representation of _infrastructure as code_, allowing definitions of complex systems to be specified in simple text files which can be committed to a multi-user change control system (like Git).

Terraform can be used to provision Cloudant services and to modify some characteristics of the provisioned Cloudant instance throughout its lifetime. In this blog post, we'll discuss how this is done and where Terraform's responsibility begins and ends.

## Terraform primer

Terraform is a command-line tool that reads local `.tf` files from disk that define infrastructure that is to be provisioned. Terraform can use one, or several _Terraform Providers_ to perform the actual provisioning - the providers perfom interactions with the cloud provider's API. Once provisioned, Terraform stores its _state_ in additional local files (`*.tfstate`), or can be configured to write state to a remote S3 bucket, for example.

Terraform is adept at modifying an existing set of infrastructure under its control to a new state. This allows infrastructure deployments to be managed like code deployments, with pull requests, reviews, merging and CI workflows - in tandem with the versioning of software releases running on the provisioned infrastructure.

Some of Terraform's configuration can be parameterised with input _variables_. Similarly, output values from the provisioned infrastructure can be exported as _outputs_. A typical input variable might be the "region" where a database is provisioned and an output might be the URL amd credentials of that service - data that is only known after provisioning has taken place.

A nice feature of Terraform is to be able to configure multiple "workspaces", so identical infrastructure can be deployed to dev/staging/production "workspaces".

## Configuring a Cloudant deployment with Terraform

First we need to tell Terraform that we're using the [IBM Cloud Terraform provider](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs). In the `main.tf` we tell Terraform about which version of the provider we need:

```terraform
terraform {
  required_providers {
    ibm = {
      source = "IBM-Cloud/ibm"
      version = ">= 1.56.1"
    }
  }
}
provider "ibm" {
  ibmcloud_api_key = var.ibmcloud_api_key
  region           = var.region
}
```

Notice that we are configuring our "ibm" provider by supplying two variables that hold our IBM Cloud API key and which region we plan to deploy into. These variables are defined in a `variables.tf`:

```terraform
variable "ibmcloud_api_key" {
  description = "IBM Cloud API key"
}
variable "region" {
  description = "The IBM Cloud region to deploy to"
}
```

and the values of those variables are supplied in a `terraform.tfvars` file:

```terraform
ibmcloud_api_key = "ABC123!"
region = "us-south"
```

> Note: you can create an API key for your IBM Cloud account by [following these instructions](https://cloud.ibm.com/docs/account?topic=account-userapikey&interface=ui#create_user_key).

We can then tell Terraform to provision a Cloudant instance in a `cloudant.tf` file:

```terraform
resource "ibm_cloudant" "cloudant_dallas" {
  name      = "my-dallas-service"
  location  = var.region
  plan      = "standard"
  capacity  = 15
}
```

- `ibm_cloudant` is the IBM Cloud Terraform Provider's tag that deals with Cloudant instances. See https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/resources/cloudant.
- `cloudant_dallas` is our name for this instance in Terraform. It is used elsewhere in the Terraform to reference this resource.
- `name`/`location`/`plan`/`capacity` - argument values that configure the Cloudant instance. The `ibm_cloudant` documentation lists the [accepted arguments](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/resources/cloudant#argument-reference), their defaults and any constraints of their usage.


We may also add one or more Cloudant databases to our instance:

```terraform
resource "ibm_cloudant_database" "sales_database" {
  instance_crn  = ibm_cloudant.cloudant_dallas.crn
  db            = "sales"
}
resource "ibm_cloudant_database" "users_database" {
  instance_crn  = ibm_cloudant.cloudant_dallas.crn
  db            = "users"
}
resource "ibm_cloudant_database" "returns_database" {
  instance_crn  = ibm_cloudant.cloudant_dallas.crn
  db            = "returns"
}
```

[ibm_cloudant_database](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/resources/cloudant_database) is a second resource type supported by the IBM Cloud Terraform Provider for creation of databases within an instance. Notice the reference to the Cloudant instance we created elsewhere: `ibm_cloudant.cloudant_dallas.crn`.

## Deploying with Terraform

As this is the first time using a new Terraform provider, we must first initialise Terraform to pull in any required providers:

```sh
terraform init
```

We can then see what infrastructure would be provisioned. This "plan" operation does a dry run, comparing any pre-existing infrastructure with that defined in the current `.tf` files and produces a plan of action for how to reach the desired end state:

```sh
terraform plan
```

When the plan is been reviewed, we can go ahead and deploy the infrastructure:

```sh
terraform apply
```

## Modifying infrastructure

We can add more infrastructure as needed. The IBM Cloud Terraform Provider has resources for log management, databases, container registries, DNS services, event streams, Kubernetes clusters and lots more.

The simplest modification might be to increase the capacity of your Cloudant service. To do that we would simply change the `capacity` value in our `cloudant.tf` file:

```terraform
resource "ibm_cloudant" "cloudant_dallas" {
  name      = "my-dallas-service"
  location  = var.region
  plan      = "standard"
  capacity  = 20
}
```

After a `terraform apply`, the new capacity would be saved and Cloudant would asynchronously increase the Cloudant instance's capacity to meet that demand. Terraform knows that the `cloudant_dallas` instance already exists and that it need only tweak its provisioned capacity.

Note that not all options can be modified this easily - some options, if changed, would result a new Cloudant instance being created e.g. `location` - so be careful, look for "Forces new resource" in the [provider documentation](https://registry.terraform.io/providers/IBM-Cloud/ibm/latest/docs/resources/cloudant) and make sure you do `terraform plan` before `terraform apply` to see what would happen.

## Accessing our Cloudant instance

It's all very well provisioning a Cloudant service but what is its URL and how can I authenticate against it?

By adding the following to our `cloudant.tf` we can create an API key with `Manager` access to your Cloudant service

```terraform
resource "ibm_resource_key" "cloudant_credentials" {
  name                  = "my-cloudant-iam-key"
  role                  = "Manager"
  resource_instance_id  = ibm_cloudant.cloudant_dallas.id
}

output "cloudant_credentials" {
  value = ibm_resource_key.cloudant_credentials.credentials
  sensitive = true
}
```

This creates an `ibm_resource_key` and outputs its details, which will include the API key and the Cloudant URL.

We can export our Terraform outputs `terraform output` e.g.:

```sh
terraform output --json
{
  "cloudant_credentials": {
    "sensitive": true,
    "type": [
      "map",
      "string"
    ],
    "value": {
      "apikey": "my-api-key",
      "host": "someid5-bluemix.cloudantnosqldb.appdomain.cloud",
      "iam_apikey_description": "Auto-generated for key crn:v1:bluemix:public:cloudantnosqldb:us-south:a/x:y:resource-key:z",
      "iam_apikey_name": "my-cloudant-iam-key",
      "iam_role_crn": "crn:v1:bluemix:public:iam::::serviceRole:Manager",
      "iam_serviceid_crn": "crn:v1:bluemix:public:cloudantnosqldb:us-south:a/x:y:resource-key:",
      "url": "https://someid5-bluemix.cloudantnosqldb.appdomain.cloud",
      "username": "someid5-bluemix"
    }
  }
}
```

- the `cloudant_credentials.value.apikey` is the IAM API key used to access the Cloudant service.
- the `cloudant.credentials.value.url` is the URL of the Cloudant service.

## What can the Cloudant Terraform provider do (and not do)?

The Cloudant Terraform provider allows for the creation of:

- Cloudant instances in the region of your choice.
- Cloudant instances hosted on pre-existing dedicated hardware clusters.
- New Cloudant databases on either of the above.

It cannot:

- Move a Cloudant instance to a different region.
- Enable/Disable legacy credentials support after instance creation.
- Move a Cloudant instance between resource groups after instance creation.
- Modify a Cloudant database's shard count or partitioned status after database creation.
- Create or change the authorisation of legacy credentials.

In addition, the Cloudant Terraform provider does not support the managment of replication tasks, any document management or indexing APIs.

