---
title: cryptario
pubDate: 2017-01-01T00:00:00.000Z
description: Anagram solver using AWS Lambda and data embelished by Wikipedia.
heroImage: ../../assets/andrey-soldatov-ytGk9Q2IpEU-unsplash.jpg
---

> The source code for this site is here https://github.com/danmermel/cryptario

> Try it yourself at https://cryptario.net/

An anagram solving service........

## Dependencies

- Node.js
- Terraform
- aws-cli

Check out this GitHub repository.

## Deployment

## Staging

```sh
# Create infrastructure
cd terraform
terraform workspace set stage
terraform apply

# Add test data
cd ..
cd scripts
cp stagedata.txt data.txt
# !edit config.json to add "stage" to the database name
node bulkimport.js

# Deploy code
cd ..
cd lambda
./deploy.sh stage
```

## Production

```sh
# Create infrastructure
cd terraform
terraform workspace set prod
terraform apply

# Add test data
cd ..
cd scripts
cp proddata.txt data.txt
# !edit config.json to add "prod" to the database name
node bulkimport.js

# Deploy code
cd ..
cd lambda
./deploy.sh prod
```

## Taint the infrastructure

Terraform doesn't correctly update the AWS API Gateway infrastructure, so for every new API call we need to "taint" the API Gateway and re-deploy:

```sh
# prod
terraform taint -state=./terraform.tfstate.d/prod/terraform.tfstate  aws_api_gateway_rest_api.cryptario_api

# stage
terraform taint -state=./terraform.tfstate.d/stage/terraform.tfstate  aws_api_gateway_rest_api.cryptario_api
```

Remember to be in the right "workspace" otherwise it doesn't work.

## Test the API

```sh
curl -X POST -H 'Content-type: application/json' -d'{"clue":"ylator switf"}' https://stage.remebit.com/solver

or

curl -X POST -H 'Content-type: application/json' -d'{"clue":"ylator switf"}' https://prod.remebit.com/solver
```

