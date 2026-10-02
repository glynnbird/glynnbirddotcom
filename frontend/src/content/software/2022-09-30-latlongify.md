---
title: latlongify
pubDate: 2022-09-30T00:00:00.000Z
description: A simple utilty to give human readable version of a lat/long
heroImage: ../../assets/tobias-rademacher-p79nyt2CUj4-unsplash.jpg
---

> The source code for this utility is here https://github.com/glynnbird/latlongify

A simple utility to lookup a lat/long pair and tell you:

- which country it is in
- which UK county it is in (if in the UK)
- which US state it is in (if in the USA)
- the nearest UK town/city (if in the UK)

## Installation

```sh
npm install --save latlongify
```

## Usage

```js
import * as latlongify from 'latlongify'
const r = await latlongify.find(52.4226, 0.01) // latitude & longitude
console.log(r)
// {
//   country: { name: 'United Kingdom', code: 'GBR', group: 'Countries' },
//   state: undefined,
//   county: { name: 'Cambridgeshire', group: 'UK Counties' },
//   city: { name: 'Somersham', lat: 52.3823, long: 0.0006 }
// }
```

