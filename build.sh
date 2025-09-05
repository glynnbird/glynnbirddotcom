#!/bin/bash

# build frontend
echo "Building frontend 🏢"
cd frontend
npm ci
npm run build
cd ..
