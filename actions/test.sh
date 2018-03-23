#!/bin/bash

if [ -z "$COUCH_HOST" ]; then echo "COUCH_HOST is required"; exit 1; fi
if [ -z "$ACCESS_KEY" ]; then echo "ACCESS_KEY is required"; exit 1; fi
if [ -z "$SECRET_KEY" ]; then echo "SECRET_KEY is required"; exit 1; fi
if [ -z "$BUCKET" ]; then echo "BUCKET is required"; exit 1; fi
if [ -z "$ENDPOINT" ]; then echo "ENDPOINT is required"; exit 1; fi

# deploy to OpenWhisk
bx wsk package update instapuppy --param COUCH_HOST "$COUCH_HOST" --param access_key "$ACCESS_KEY" --param secret_key "$SECRET_KEY" --param bucket "$BUCKET" --param endpoint "$ENDPOINT"

# create actions
cd actions
ls *.js | tr '\n' '\0' | xargs -0 -n1 ./deploy_action.sh
cd ..

# create API
bx wsk api create /instapuppy /login post instapuppy/login --response-type http
bx wsk api create /instapuppy /verify post instapuppy/verify --response-type http
bx wsk api create /instapuppy /alldocs post instapuppy/alldocs --response-type http
bx wsk api create /instapuppy /mydocs post instapuppy/mydocs --response-type http
bx wsk api create /instapuppy /userdocs post instapuppy/userdocs --response-type http
bx wsk api create /instapuppy /upload post instapuppy/upload --response-type http
bx wsk api create /instapuppy /save post instapuppy/save --response-type http
bx wsk api create /instapuppy /download get instapuppy/download --response-type http
