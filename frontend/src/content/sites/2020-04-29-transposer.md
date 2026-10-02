---
title: transposer
pubDate: 2020-04-29T00:00:00.000Z
description: Lyric and guitar tab database with transposition
heroImage: ../../assets/marius-masalar-rPOmLGwai2w-unsplash.jpg
---

> The source code for this site is here https://github.com/glynnbird/transposer

# transposer

A database of song tabs. It uses Cloudflare's KV to store the lists of tabs. 

A copy of song list is cached locally and fetched from the cloud on first page load. When a single song is selected, it is loaded from the Cloud and cached in localstorage for speedier loading next time.

## Screenshots

### Adding a song

![add](../../assets/transposer1.png)

User supplies a song name, artist and lyrics or lyrics/chords.

### Viewing a song

![view](../../assets/transposer2.png)

The data is rendered in two columns with the chord names picked out in bold.

### Changing key

![key change](../../assets/transposer3.png)

Moving the key slider up or down will change the chords up or down by the interval selected.

### Home page

![home](../../assets/transposer4.png)

The application home page shows a list of all the song titles/artists and a search bar.

The icon on the top right is a "shuffle" button, bringing up each song in turn but in a random order.

### Search

![home](../../assets/transposer5.png)

Typing in the search bar triggers client-side filtering of the list by matching titles or artist. When the search bar is cleared, the full list is displayed again.

## API

```sh
# list all songs
curl -X POST -H'Content-type:application/json' -H"apikey: $APIKEY" "https://transposer.glynnbird.com/api/list"
{
  "ok": true,
  "list": [
    {
      "id": "QNJNZ3B7",
      "artist": "Taylor Swift",
      "song": "All too well",
      "hash": "4c94ccb9d2bb1b735828d71796312f76"
    }
  ]
}
```

# get a single song

```sh
curl -X POST -H'Content-type:application/json' -H"apikey: $APIKEY" -d'{"id":"QNJNZ3B7"}' "https://transposer.glynnbird.com/api/get"
{"ok":true,"doc":{"artist":"Taylor Swift","song":"All too well","tab":"C F G","date":"2024-10-14T13:26:51.029Z","hash":"4c94ccb9d2bb1b735828d71796312f76","id":"QNJNZ3B7"}
```

# add a song

```sh
curl -X POST -H'Content-type:application/json' -H"apikey: $APIKEY" -d'{"artist":"Taylor Swift","song":"All too well","tab":"C F G"}' "https://transposer.glynnbird.com/api/add"
{"ok":true,"id":"QNJNZ3B7"}
```
