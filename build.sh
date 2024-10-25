#!/bin/bash

# build frontend
echo "Building frontend 🏢"
cd frontend
npm install
npm run build
cd ..
