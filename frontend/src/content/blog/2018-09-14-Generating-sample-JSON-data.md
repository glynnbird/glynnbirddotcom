---
title: Generating sample data
pubDate: 2018-09-14T09:00:00.000Z
description: Creating realistic JSON data in bulk
heroImage: ../../assets/kristian-strand-791607-unsplash.jpg
---


Application development using Cloudant as the database, for me, starts with data design. Having carefully considered how your application's data should be modelled in JSON we may turn to the querying and indexing required:

- How do my queries perform with 10k, 1m or 10m documents?
- How long does it take for a new batch of data to be indexed?
- Is it better to use a Cloudant MapReduce or Cloudant Search index to solve a particular problem?

Oftentimes, app development starts with a blank database. It's helpful at this point to put the theory to the test with a meaningful amount of data - to a/b test two indexes, benchmark queries and measure indexing and throughput performance.

To do this we need a source of data. As our application isn't live yet, we don't have any real data.

This is where the [datamaker](https://www.npmjs.com/package/datamaker) tool comes in.


## What is datamaker?

*datamaker* is a command-line tool that can generate random data. Not just random numbers, but company names, addresses, emails, dates etc.

It's a free, open-source tool published on npm (Node.js & npm are required). To install it, simply run :

```sh
$ npm install -g datamaker
```

Give it a spin by piping in a template string. Placeholders for random data are signified by named tags encased in double curly braces:

```sh
{% raw %}
$ echo 'My name is {{name}}.' | datamaker
My name is Loreta Brenner.
{% endraw %}
```

If you need more data, the `--iterations`/`-i` flag is used to specify the number of data points:

```sh
{% raw %}
$ echo '{{date}},{{company}}' | datamaker -i 10
1975-03-21,Refoment Holdings LLC
1989-12-13,Unmold Stores 
1977-02-10,Psammite Mutual S.A
1983-04-15,Spinsterdom GmbH
2018-06-22,Recite Stores B.V
2012-02-24,Willing SIA
1989-09-22,Pong 
1996-04-28,Sabotage Industries LLC
2004-03-24,Toxidermic Mutual Corp
2014-01-04,Betaine Corp 
{% endraw %}
```

We can use *datamaker* to form CSV or XML data, but for a Cloudant database we need JSON. The best way to do this is to create a template containing one of your documents, with placeholder tags marking where the data should go:

```js
{% raw %}
{
  "_id": "{{uuid}}",
  "name": "{{firstname}} {{surname}}",
  "dob": "{{date 2014-01-01}}",
  "address": {
    "street": "{{street}}",
    "town": "{{town}}",
    "postode": "{{postcode}}"
  },
  "telephone": "{{tel}}",
  "pets": ["{{cat}}","{{dog}}"],
  "score": {{float 1 10 1}},
  "email": "{{email}}",
  "url": "{{website}}",
  "description": "{{words 20}}",
  "verified": {{boolean 0.75}},
  "salary": {{float 10000 70000 0}}
}
{% endraw %}
```

Notice how some of the *datamaker* tags can take parameters: `{{float 1 10 1}}` means "generate a floating point number between 1 and 10, with 1 decimal place.

We can then pass the path of the file to *datamaker* with the `--template`/`-t` option and specify "json" with the `--format`/`-f` flag:

```sh
$ datamaker -t ./template.json -f json -i 10
{"_id":"8ZDJ7JJPK4LFN2SH","name":"Selena High","dob":"2015-07-02","address":{"street":"2568 Holbrook","town":"Masham","postode":"HR10 1YL"},"telephone":"+213-5637-126-628","pets":["Romeo","Bailey"],"score":1.1,"email":"elissa-bonds@hotmail.com","url":"http://montana.com","description":"offer purposes ends closure cherry applying heather incidents mar alien precipitation universities apartment cycling containing graham remedy lance tackle cotton","verified":true,"salary":13628}
{"_id":"AQ4LAEZYGPUCKAG9","name":"Madalyn Bernal","dob":"2015-11-30","address":{"street":"3656 Palace Street","town":"Winsford","postode":"SP5 8FR"},"telephone":"+255-4662-982-251","pets":["Lilly","Apollo"],"score":5.9,"email":"aleshia_marshall@washer.com","url":"https://volunteer.com","description":"generated our languages relates enlargement questionnaire kitty passes parish coin progressive safe either primarily de remedy barbie dvd defining table","verified":false,"salary":26392}
{"_id":"ZS1S800XUJAPX53J","name":"Demetra Alba","dob":"2014-10-16","address":{"street":"9270 Wilpshire Street","town":"Lancaster","postode":"WC4 0BP"},"telephone":"+216-6024-252-842","pets":["Midnight","Shadow"],"score":8.4,"email":"marline-alarcon@hotmail.com","url":"http://www.tap.com","description":"mg charging sharon blake deutsch popularity bang addition canal dt cycle prayer bowl eleven karaoke reuters urban iraqi cholesterol soviet","verified":false,"salary":47107}
{"_id":"GNMTP3ODG3SR31PX","name":"Sal Riggs","dob":"2014-09-29","address":{"street":"9029 O Road","town":"Framlingham","postode":"TD9 4KF"},"telephone":"+66-0335-951-687","pets":["Angel","Harley"],"score":5.7,"email":"lovemessenger@yahoo.com","url":"http://www.brochure.com","description":"require cameron possibilities evaluating slovenia us nightlife guarantee distributed norfolk middle ob sponsored newman terrain bolivia examines arms quantitative advance","verified":true,"salary":21190}
{"_id":"87XJDY18USNMRG86","name":"Norberto Pacheco","dob":"2018-07-03","address":{"street":"1809 Winser Avenue","town":"Bridgnorth","postode":"AL59 1LV"},"telephone":"+34-8379-225-249","pets":["sox","Buddy"],"score":1.2,"email":"leida-carey-elder@legacy.com","url":"http://reason.skanland.no","description":"gambling ensuring sporting worldwide losing norfolk east are exception princess boxing costumes macedonia maintenance phone mens clinics disagree arrival text","verified":true,"salary":15901}
{"_id":"Q0LN7F6DXGZQIHAH","name":"Arlie Bosley","dob":"2015-02-02","address":{"street":"0889 Arcon Lane","town":"Airth","postode":"LE51 3UC"},"telephone":"+266-9546-824-552","pets":["Ziggy","Bentley"],"score":8.8,"email":"skye.pitts@produces.com","url":"http://www.applications.com","description":"sport completely pain reno weighted junction humanitarian bent algeria papers council newspaper wa electronic nano visiting chinese largely showed generic","verified":true,"salary":30753}
{"_id":"2EQ9YKFKK024BQ94","name":"Cherryl Cooney-Holland","dob":"2018-04-29","address":{"street":"8591 Warham Lane","town":"Whitstable","postode":"TF28 6LN"},"telephone":"+973-8154-367-109","pets":["Maggie","Apollo"],"score":8.5,"email":"beatriz-schulze@yahoo.com","url":"https://electrical.com","description":"people surname engineering rid reduction charging salvation telescope kb for subjects comments honest memory civilization patricia employ election was honors","verified":true,"salary":39242}
{"_id":"482AB79QSS80URSL","name":"Manuel Loftis","dob":"2016-12-07","address":{"street":"4548 Blucher Avenue","town":"Hunstanton","postode":"EN77 1TR"},"telephone":"+61-1705-364-098","pets":["Rusty","Ginger"],"score":7.7,"email":"ladawn_battle@hotmail.com","url":"http://www.aircraft.mil.ge","description":"arrive labour pamela realistic platforms typing thou wc spa scan animal passion patients wayne contamination fiber roses mixing wanting aids","verified":false,"salary":15796}
{"_id":"RJA2DPS954J22AQ9","name":"Lovella Richmond","dob":"2018-01-12","address":{"street":"6173 Byrth","town":"Skipton","postode":"WA5 7FR"},"telephone":"+33-7083-380-202","pets":["Daisy","Gus"],"score":5.5,"email":"jayne.roche@wet.com","url":"http://www.source.com","description":"livestock geography italy commitment reseller strengthen gp meals announces href wage supervision guarantees problems lip tuner did site site then","verified":true,"salary":69739}
{"_id":"HNI4ISQDR17SEBD2","name":"Keesha Tong","dob":"2014-06-16","address":{"street":"0567 Penny Road","town":"North Berwick","postode":"LA63 0MM"},"telephone":"+675-7584-818-118","pets":["Muffin","Cody"],"score":4.4,"email":"isobel_fowler@gmail.com","url":"https://www.retro.lib.ct.us","description":"nuclear pennsylvania cooperation builder penny identical palestine detected le frequently collect customer providers string ticket col receivers spring suited chip","verified":false,"salary":44255}
```

The *datamaker* project has tens of supported tags - see the [project's documentation](https://github.com/glynnbird/datamaker#tag-reference) for details. Airport codes, URLs, email addresses, prices, currencies etc.

## Importing data into a Cloudant database

The tool to import JSON data into Cloudant already exists: it's [couchimport](https://www.npmjs.com/package/couchimport) which supports the `jsonl` format (one JSON document per line) out of the box. Simply pipe the output of *datamaker* into *couchimport*:

```sh
$  datamaker -t ./template.json -f json -i 10000 | couchimport --db mydatabase
```

The output of the *datamaker* is written to Cloudant in a series of bulk HTTP API calls. Simple as that!

## References

- [datamaker on npm](https://www.npmjs.com/package/datamaker)
- [source code](https://github.com/glynnbird/datamaker)
