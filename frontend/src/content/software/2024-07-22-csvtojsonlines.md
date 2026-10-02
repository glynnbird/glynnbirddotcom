---
title: csvtojsonlines
pubDate: 2024-07-22T00:00:00.000Z
description: Utility to covert CSV data into JSON
heroImage: ../../assets/pankaj-patel-fvMeP4ml4bU-unsplash.jpg
---

> The source code for this utility is here https://github.com/glynnbird/csvtojsonl

A simple command-line utility that transforms a CSV file into JSON documents - one document per line.

The default CSV delimiter is the tab character and it is expected that the first line of the file contains column headings which will become the JSON attribute names.

## Installation

```sh
npm install -g csvtojsonlines
```

## Usage

Pipe a CSV/TSV file to `csvtojsonlines` (or its alias `csvtojsonl`) e.g.

```sh
> cat guitars.tsv | csvtojsonlines
{"product_id":"26","brand":"Gibson","type":"Electric","range":"Flying V","model":"Flying V 120","country":"USA","year":"2014","colour":"White","price":"1999.00","description":"The Flying V is the original rebel-rousing rocker, way ahead of its time in the late ’50s and still a major style statement today. Following in the footsteps of this iconic guitar, the Limited Run Flying V 120 is the perfect candidate to join in Gibson USA’s 120th Anniversary celebrations. Combining time-tested tonewoods, versatile pickups, and unparalleled Gibson USA craftsmanship at an unbeatable price, the Flying V 120 launches your music into the stratosphere, while making the perfect ticket to the party for collector and player alike.","url":"http://www2.gibson.com/Products/Electric-Guitars/Flying-V/Gibson-USA/Flying-V-120.aspx","image":"http://images.gibson.com/Products/Electric-Guitars/Designer/Gibson-USA/Flying-V-120/Gallery-Images/DV120CWCH1-Finish-Shot.jpg","sold":"FALSE"}
```

or redirect the output to a file

```sh
cat transactions.csv | csvtojsonlines --delimiter ',' > output.jsonl
```

## Parameters

- `--delimiter/-d` - the CSV file delimiter to expect (default :`\t`)
- `--help/-h` - show help

## Using programmatically

The `csvtojsonlines` function expects an object with the following items:

- `rs` the Node.js readstream where the input will come from.
- `ws` the Node.js writestream where the text output will go to.
- `delimiter` the CSV delimiter e.g. `','`

```js
const fs = require('fs')
const csvtojsonlines = require('csvtojsonlines')

const main = async () => {
  const opts = {
    rs: fs.createReadStream('./hp1.csv'),
    ws: process.stdout,
    delimiter: ','
  }
  await csvtojsonlines(opts)
}
main()
```
