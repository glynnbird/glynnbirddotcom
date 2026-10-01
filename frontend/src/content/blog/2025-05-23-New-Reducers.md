---
title: "New Reducers"
description: Understanding the new MapReduce reducers.
pubDate: 2025-05-23T00:00:00+00:00
heroImage: ../../assets/javier-quiroga-IuGDNXawS9M-unsplash.jpg
---

As of June 2025, Cloudant now supports some new MapReduce _reducers_. In this blog post we'll discuss what each of these reducers does and useful applications for each.

Before we get to the new reducers, let's just refresh what we know about MapReduce views and the existing reducers.

## MapReduce - roll-your-own indexes

Cloudant MapReduce allows secondary indexes to be generated from the primary document data by using user-supplied JavaScript "map" functions which are executed on every document in the database - any data "emitted", by the map function forms the key/value pairs stored in the secondary index structure.

The map function's `emit` call has two parameters

1. The key that forms the sort order of the index. This is usually a string, number or array of strings or numbers.
2. The value that is stored against the key in the primary index and can be any JavaScript data. This value is returned when using the MapReduce index for selection.

Some map function examples:

```js
// create an index on email
function (doc) {
  // create an index keyed on the document's email address
  // with nothing (null) as the index's "value"
  emit(doc.email.toLowerCase(), null)
}

// create a view keyed on the year/month/day with the order's total
// as the index's value, but only for 'delivered' orders
function (doc) {

  // only delivered orders are included...
  if (doc.status === 'delivered') {
    // parse the document's ISO-8601 date into a JavaScript Date object
    const d = new Date(doc.date)

    // create an array key ordered by Year, Month, Day e.g. [2025, 4, 25]
    // the key contains the order basket total and tax cost
    emit([ d.getFullYear(), d.getMonth() + 1, d.getDate() ], [doc.total, doc.tax])
  }
}

// create a view on an IoT application's deviceid and timestamp with the 
// full document emitted as the index's key.
function(doc) {
  emit([doc.deviceid, doc.timestamp], doc)
}
```

The above examples demonstrate some useful features of MapReduce:

- Creating simple indexes for selection, based on data that is within the document such as an index on a document's email address.
- Tidying up data using JavaScript prior to indexing, such as lowercasing the email address.
- Creating partial indexes based on logic, such as the second map function's "if" statement to only included "delivered" orders.
- Using arrays as keys to create a keyspace which can be used for grouping by purchase year, year/month or year/month/day.
- Emitting numerical values which can summed or used as the basis of statistical calculations. Arrays of numbers or objects with numeric keys can also be aggregated into totals and statistics as well as single numbers.
- Emitting the entire document as a value, to avoid having to use `?include_docs` to fetch the document body at query-time. This makes for a bigger index, but faster queries.

At their simplest, MapReduce views are used for _selection_ only - finding view rows by an exact matching key or keys(e.g `key="bob@aol.com"` or `keys=["fred@gmail.com","rita@apple.com"]`) or by performing a range query on the keyspace (e.g. `startkey=["2024","06"]&endkey=["2025","01"]`). The view returns the matching keys and the accompanying "value" from the index, or with `include_docs=true` the addition of the whole document that was used to generate the view row.

> Note that adding `?include_docs=true` makes for a more computationally expensive query, as each matching row needs to fetch the document body too.

If a _reducer_ was supplied with the index definition, it can be used to _aggregate_ the resultant view rows, instead of returning all of the matching rows.

> Note: a view with a reducer can also be used for _selection_ only - simply switch off query-time reduction with `?reduce=false`.

The original reducers are:

- `_count` - counts view rows.
- `_sum` - sums numeric view values, including arrays of numbers or objects with numeric attribute values.
- `_stats`- produces sums, counts and "sum of squares" totals, suitable for creating mean, variance and standard deviation calculations on numeric view values.
- `_approx_count_distinct` - estimates a count of the distinct _keys_ in the view. Note that unlike count/sum/stats, this reducer acts on the keys, not the values of the view.

Adding grouping options (`group=true` or `group_level=<number>`) unlocks grouping of the count/sum/stats data by unique keys. This is especially useful with array-based keys such as `[2025, 4, 14]`:

```js
// ?group_level=2 with a _count reducer returns counts of view rows
// grouped by year/month and ordered by year/month.
{"rows":[
{"key":[2024,1],"value":683},
{"key":[2024,2],"value":635},
{"key":[2024,3],"value":592},
{"key":[2024,4],"value":620},
{"key":[2024,5],"value":642},
{"key":[2024,6],"value":652},
{"key":[2024,7],"value":679},
{"key":[2024,8],"value":620},
{"key":[2024,9],"value":666},
{"key":[2024,10],"value":721},
{"key":[2024,11],"value":608},
{"key":[2024,12],"value":649},
{"key":[2025,1],"value":623},
{"key":[2025,2],"value":611},
{"key":[2025,3],"value":721},
{"key":[2025,4],"value":278}
]}
```

## The new reducers

The new reducers add additional query-time aggregation functionality.

### \_top_n/\_bottom_n

The `_top_n` and `_bottom_n` reducers return the highest "n" _values_ from a view or grouping within the view, where n is a number between 1 and 100.

Imagine an online game where each game run's score is recorded in a Cloudant database, with documents of this form:

```json
{
  "type": "score",
  "user": "bsmith",
  "game": "Bellicose_Badgers",
  "date": "2025-04-14T13:11:01.000Z",
  "score": 8752
}
```

We want the top ten scores a user has scored for a given game, or for all the games that they've played. First, we create a view keyed, on `game` & `user` we would use a map function like this:

```js
function (doc) {
  // if this is a score document
  if (doc.type === 'score') {
    // create an index with:
    //   key - an array of [game, user]
    //   value - the points scored in that game
    emit([doc.game, doc.user], doc.score)
  }
}
```

and we use the `_top_10` reducer, which returns the 10 highest _values_ from the index for the given grouping. 

> Note: any reducer name from `_top_1` to `_top_100` is valid e.g. `_top_25`.

When we query the view without any parameters, we get the top 10 scores for any game and any user:

```js
{"rows":[
{"key":null,"value":[9968,9966,9952,9928,9902,9894,9870,9864,9863,9849]}
]}
```

By employing MapReduce's grouping feature, we can group by `game` to get the top 10 scores for each game:

```js
// ?group_level=1
{"rows":[
{"key":["Bellicose_Badgers"],"value":[9968,9952,9863,9849,9800,9778,9771,9763,9746,9700]},
{"key":["Cunning_Capybaras"],"value":[9928,9902,9870,9704,9601,9544,9479,9470,9445,9434]},
{"key":["Friendly_Fruitbats"],"value":[9864,9847,9818,9810,9787,9740,9734,9721,9667,9643]},
{"key":["Hungry_Hedgehogs"],"value":[9966,9894,9747,9720,9651,9615,9605,9596,9585,9567]}
]}
```

or group by `game` and `user` to get the top 10 scores for each game/user combination:

```js
{"rows":[
{"key":["Bellicose_Badgers","ajones"],"value":[9952,9863,9678,9644,9526,9516,9034,8795,8711,8676]},
{"key":["Bellicose_Badgers","bsmith"],"value":[9778,9771,9682,9630,9460,9196,8973,8861,8857,8093]},
{"key":["Bellicose_Badgers","cjackson"],"value":[9968,9495,9109,8553,8534,8514,8341,8244,8038,7822]},
{"key":["Bellicose_Badgers","dparkinson"],"value":[9800,9746,9700,9694,9625,9375,9297,9285,9204,9100]},
{"key":["Bellicose_Badgers","estanwick"],"value":[9849,9763,9543,8833,8435,8387,8287,8154,8028,8009]},
{"key":["Bellicose_Badgers","fwilkes"],"value":[9690,9612,9339,9192,9027,8478,8428,8337,7452,7414]},
{"key":["Cunning_Capybaras","ajones"],"value":[9704,9311,9307,9175,9073,8848,8751,8465,8464,8128]},
{"key":["Cunning_Capybaras","bsmith"],"value":[9870,9445,9434,9226,8519,8269,8263,7339,7266,7126]},
{"key":["Cunning_Capybaras","cjackson"],"value":[9928,9902,9544,9349,9003,8370,8328,8057,7933,7415]},
{"key":["Cunning_Capybaras","dparkinson"],"value":[9601,9479,9470,9253,8720,8701,8579,8572,8490,8488]},
{"key":["Cunning_Capybaras","estanwick"],"value":[8963,8916,8643,8489,8264,8173,7790,7722,7628,7381]},
{"key":["Cunning_Capybaras","fwilkes"],"value":[9328,9258,9129,9121,9099,9031,8899,8647,8421,8334]},
{"key":["Friendly_Fruitbats","ajones"],"value":[9864,9847,9818,9734,9643,9527,9488,9302,8771,8592]},
{"key":["Friendly_Fruitbats","bsmith"],"value":[9721,9570,9240,9221,9126,8781,8259,8193,7658,6894]},
{"key":["Friendly_Fruitbats","cjackson"],"value":[9740,9217,9154,8984,8584,7975,7761,7666,6799,6724]},
{"key":["Friendly_Fruitbats","dparkinson"],"value":[9787,9239,8844,8681,8676,8286,8231,8093,7550,7460]},
{"key":["Friendly_Fruitbats","estanwick"],"value":[9810,9586,9579,9429,8956,8762,8426,8408,8349,8246]},
{"key":["Friendly_Fruitbats","fwilkes"],"value":[9667,9454,9256,8582,8330,8277,8089,8064,7950,7936]},
{"key":["Hungry_Hedgehogs","ajones"],"value":[9615,9605,9567,9129,9121,9038,8984,8613,8013,7963]},
{"key":["Hungry_Hedgehogs","bsmith"],"value":[9894,9544,9293,9285,9251,9082,9016,9012,8882,8524]},
{"key":["Hungry_Hedgehogs","cjackson"],"value":[9720,9484,9172,8703,8275,8072,7605,7540,7455,7272]},
{"key":["Hungry_Hedgehogs","dparkinson"],"value":[9585,9378,9230,8798,8721,8689,8599,7885,7772,7524]},
{"key":["Hungry_Hedgehogs","estanwick"],"value":[9966,9747,9651,9399,9086,8765,8479,8292,8265,7530]},
{"key":["Hungry_Hedgehogs","fwilkes"],"value":[9596,9450,8825,8798,6772,6644,6640,6381,6332,5767]}
]}
```

If we know the game/user combination we want, we can supply a `key` parameter:

```js
// ?key=["Cunning_Capybaras","cjackson"]
{"rows":[
{"key":null,"value":[9928,9902,9544,9349,9003,8370,8328,8057,7933,7415]}
]}
```

Of course, the reducer can be switched off at query-time to use the view for selection:

```js
// ?key=["Cunning_Capybaras","cjackson"]&reduce=false
{"total_rows":1000,"offset":357,"rows":[
{"id":"4913b1dccc7b8fa4720d99f706001099","key":["Cunning_Capybaras","cjackson"],"value":3980},
{"id":"4913b1dccc7b8fa4720d99f70601653d","key":["Cunning_Capybaras","cjackson"],"value":6920},
{"id":"4913b1dccc7b8fa4720d99f706016698","key":["Cunning_Capybaras","cjackson"],"value":5839}
...
]}
```

The `_bottom_n` reducer works just the same but returns the lowest values for the given grouping. Like `_top_n`, the value of `n` can be any number between 1 and 100.

### \_first/\_last

The `_first` and `_last` reducers return one _value_ from a view with the lowest or highest _keys_ respectively, for the given grouping. This is best demonstrated by example. Let's say we have IoT data arriving from a number of remote devices, each with their own unique `deviceid`, where each reading stores documents like this:

```js
{
  "_id":"93117567370d41d091b8dd160a3adf3f",
  "deviceid":"A00",  // the unique id of the IoT device
  "reading":13.8986, // the reading from the IoT device
  "timestamp":"2025-03-26T04:44:08.917Z" // when the reading was taken
}
```

We can create a MapReduce view with a map function that orders its keys by `deviceid` and `timestamp` and stores the whole document as the view's "value":

```js
function (doc) {
  emit([doc.deviceid, doc.timestamp], doc)
}
```

When paired with the `_last` reducer, we can use the resultant view to find the latest reading from each unique deviceid ("latest" because we are using the `_last` reducer and the data is ordered by `timestamp` for each `deviceid`, so the latest data sorts last):

```json
// ?group_level=1
{"rows":[
{"key":["A00"],"value":{"_id":"93117567370d41d091b8dd160a3adf3f","_rev":"1-bc05e93e592d5a5a18e240240b581a55","deviceid":"A00","reading":13.8986,"timestamp":"2025-03-26T04:44:08.917Z"}},
{"key":["A01"],"value":{"_id":"c9f53ac9e4a8444487ed0eaa11dc1c78","_rev":"1-1fcf121c73db03e49bac4c1981518b19","deviceid":"A01","reading":59.8453,"timestamp":"2025-04-01T01:52:34.254Z"}},
{"key":["A02"],"value":{"_id":"577b7108a8a1458f9a17194ed1da398a","_rev":"1-71d345a773ab31f35ceb998f3c107c41","deviceid":"A02","reading":2.6208,"timestamp":"2025-03-31T00:22:17.175Z"}},
{"key":["A03"],"value":{"_id":"150839b1d363427496a4f4e2917b8b1d","_rev":"1-860a2ed5f1f48aa642495dfb21dff3ce","deviceid":"A03","reading":55.8677,"timestamp":"2025-03-22T10:15:57.890Z"}},
{"key":["A04"],"value":{"_id":"d3317bdc1f7b4466ae6bf7a30ca9e328","_rev":"1-a58762532f6980ca5b06a8d01d113814","deviceid":"A04","reading":44.1822,"timestamp":"2025-03-23T10:56:10.639Z"}},
{"key":["A05"],"value":{"_id":"946754d3762f44e297ca20d13bbceb5e","_rev":"1-41fa2bb3ef8782c90b28ee44628abeab","deviceid":"A05","reading":13.2874,"timestamp":"2025-03-27T13:59:04.723Z"}},
{"key":["A06"],"value":{"_id":"bbcd8a5c0ae948baae713a9fcb5262d5","_rev":"1-66883211ee20a0772374672aa175dc50","deviceid":"A06","reading":7.9525,"timestamp":"2025-04-01T15:13:04.305Z"}},
{"key":["A07"],"value":{"_id":"a600caccdb82400698b158ecebfaa6f2","_rev":"1-68975a8d7133a13c6cc8ae34d28ea1c6","deviceid":"A07","reading":89.4818,"timestamp":"2025-03-07T02:12:59.934Z"}},
{"key":["A08"],"value":{"_id":"be20bae911db4da685f891fd01e07d3a","_rev":"1-d69b559627cf01e80fe85ea2f54d2f4b","deviceid":"A08","reading":97.6739,"timestamp":"2025-03-29T13:46:31.689Z"}},
{"key":["A09"],"value":{"_id":"96526e80f2ff48e89e9e42aa47abae24","_rev":"1-85e56901f7113d7d6ff8ba573c535eb3","deviceid":"A09","reading":26.1597,"timestamp":"2025-03-18T03:22:19.848Z"}}
]}
```

Before the release of the `_last` reducer, to get the the above result set would have required us to run one query _per device_ to get the answer.

Note:

- We need a key with at least two parts: the first is the item we intend to _group_ by and the second determines the sort order within the group.
- In this case, we emit the entire document into the view's value so that we get all of the IoT reading's data back at query time.

The `_first` reducer works in the same way but returns the value of the _lowest_ sorting key in the group: the earliest reading for each device, in our case.

For reference, the table below shows which readings are considered "first" and "last" for a `group_level=1` query on our data set:

| key                                | value                                                                                      | First reading (group_level=1) | Last reading (group_level=1) |
|------------------------------------|--------------------------------------------------------------------------------------------|-------------------------------|------------------------------|
| ["A00","2025-01-01T10:00:00.000Z"] | {"reading": 65,"timestamp":2025-01-01T10:00:00.000Z","deviceid":"A00"} | x                             |                              |
| ["A00","2025-01-01T10:01:00.000Z"] | {"reading": 64,"timestamp":2025-01-01T10:01:00.000Z","deviceid":"A00"} |                               |                              |
| ["A00","2025-01-01T10:02:00.000Z"] | {"reading": 59,"timestamp":2025-01-01T10:02:00.000Z","deviceid":"A00"} |                               | x                            |
| ["A01","2025-01-01T10:00:00.000Z"] | {"reading": 12,"timestamp":2025-01-01T10:00:00.000Z","deviceid":"A01"} | x                             |                              |
| ["A01","2025-01-01T10:01:00.000Z"] | {"reading": 15,"timestamp":2025-01-01T10:01:00.000Z","deviceid":"A01"} |                               |                              |
| ["A01","2025-01-01T10:02:00.000Z"] | {"reading": 19,"timestamp":2025-01-01T10:02:00.000Z","deviceid":"A01"} |                               | x                            |
| ["A02","2025-01-01T10:00:00.000Z"] | {"reading": 55,"timestamp":2025-01-01T10:00:00.000Z","deviceid":"A02"} | x                             |                              |
| ["A02","2025-01-01T10:01:00.000Z"] | {"reading": 54,"timestamp":2025-01-01T10:01:00.000Z","deviceid":"A02"} |                               |                              |
| ["A02","2025-01-01T10:02:00.000Z"] | {"reading": 56,"timestamp":2025-01-01T10:02:00.000Z","deviceid":"A02"} |                               | x                            |

## SQL equivalents

Here are the SQL equivalents of each reducer , for a view of this form, where the key is made up of `[year, month, day]` with a single numeric `value`:

| year | month | day | value |
| ---- | ----- | --- | ----- |
| 2020 | 10    | 14  | 12345 |
| 2020 | 10    | 15  | 23456 |
| 2020 | 10    | 16  | 34567 |
| 2021 | 2     | 21  | 912345 |
| 2021 | 2     | 22  | 923456 |
| 2021 | 2     | 23  | 934567 |

The examples below assume a `?group_level=2` grouping.

### \_count

```sql
SELECT year, month, COUNT() as count
FROM view
GROUP BY year, month
ORDER BY year, month, day;
```

|year|month|count|
| ---|----|------|
|2020|10|3|
|2021|2|3|

### \_sum

```sql
SELECT year, month, SUM(value) as sum
FROM view
GROUP BY year, month
ORDER BY year, month, day;
```

|year|month|sum|
| ---|----|------|
|2020|10|70368|
|2021|2|2770368|

### \_stats

```sql
SELECT year, month, COUNT() as count, SUM(value) as sum, MIN(value) as min, MAX(value) as max, SUM(value*value) as sumsqr FROM view
GROUP BY year, month
ORDER BY year, month, day;
```

|year|month|count|sum|min|max|sumsqr|
|----|-----|-----|---|---|---|------|
|2020|10|3|70368|12345|34567|1897460450|
|2021|2|3|2770368|912345|934567|2558559860450|


### \_approx_count_distinct

```sql
SELECT year, month, COUNT() as count
FROM view
GROUP BY year, month
ORDER BY year, month
```

| year | month |count|
|------|-------|-----|
|2020  | 10    | 3   |
|2021  | 2     | 3   |

> Note: remember `_approx_count_distinct` works on the keys, and this is an _exact_ count distinct instead of an approximation.

This reducer would likely be used to find the approximate distinct count of all keys, so without any grouping, which would be a query similar to:

```sql
SELECT COUNT(DISTINCT(CONCAT(year,month,day))) as count
FROM view;
```

| count | 
| ----- |
| 6     |

### \_top_2

```sql
SELECT
 year,
 month,
 (SELECT GROUP_CONCAT(v) FROM (SELECT value AS v FROM view WHERE year=months.year AND month=months.month ORDER BY value DESC LIMIT 2)) as top_2
 FROM view AS months
 GROUP BY year, month
 ORDER BY year,month;
 ```

| year|month|top_2|
|-----|-----|-----|
|2020|10|34567,23456|
|2021|2|934567,923456|

 > Note: the innermost sub-query gets the top 2 values for a single year/month. These 2 values are "group concat'ed" into a list in the outer sub-query which is fed from a grouped list of years and months.

 ### \_bottom_2

 ```sql
SELECT
  year,
  month,
  (SELECT GROUP_CONCAT(v) FROM (SELECT value AS v FROM view WHERE year=months.year AND month=months.month ORDER BY value ASC LIMIT 2)) as bottom_2
FROM view AS months
GROUP BY year, month
ORDER BY year,month;
```

|year|month|bottom_2|
|-----|-----|-----|
|2020|10|12345,23456|
|2021|2|912345,923456|

 > Note: nearly identical to the `_top_2` query, but with `ASC` instead of `DESC`.

### \_first

```sql
SELECT
  year,
  month,
  (SELECT value AS v FROM view WHERE year=months.year AND month=months.month ORDER BY day limit 1) as first
FROM view as months
GROUP BY year, month
ORDER BY year,month;
```

|year|month|first|
|-----|-----|-----|
|2020|10|12345|
|2021|2|912345|


> Note: the sub-query gets the first value (ordered by day) for each year/month.

### \_last


```sql
SELECT
  year,
  month,
  (SELECT value AS v FROM view WHERE year=months.year AND month=months.month ORDER BY day DESC limit 1) as last
FROM view as months
GROUP BY year, month
ORDER BY year,month;
```

|year|month|last|
|-----|-----|-----|
|2020|10|34567|
|2021|2|934567|


> Note: Same as `_first` but with the order of the sub-query changed to `DESC`.
