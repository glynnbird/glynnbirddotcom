//From http://www.html5rocks.com/en/tutorials/service-worker/introduction/
//and https://ponyfoo.com/articles/simple-offline-site-serviceworker

var CACHE_NAME = 'offline-first-cache-v5';
var urlsToCache = [
  '/',
  '/about',
  '/ingredients',
  '/img/me.jpg',
  '/css/glynnbirddotcom.css',
  '/js/glynnbirddotcom.js',
  'https://cdn.jsdelivr.net/pouchdb/5.4.3/pouchdb.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/0.97.6/css/materialize.min.css',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://code.jquery.com/jquery-2.1.1.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/0.97.6/js/materialize.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/0.97.6/fonts/roboto/Roboto-Light.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/0.97.6/fonts/roboto/Roboto-Regular.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/0.97.6/fonts/roboto/Roboto-Bold.woff2'
];

// all of my images start with this URL
var imagesStub = 'https://s3-eu-west-1.amazonaws.com/glynnbirddotcom/';

function shouldCache(url) {
  if (url.indexOf(imagesStub) ===0) {
    return true;
  }
  if (url.substr(0, location.origin.length) === location.origin) {
    return urlsToCache.indexOf(url.substr(location.origin.length)) > -1;
  } else {
    return urlsToCache.indexOf(url) > -1;
  }
}

// capture the service worker's install event
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

// captuer each outgoing web request from this page
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    // console.log(['WORKER: fetch event ignored.', event.request]);
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(function (cached) {
        var networked = fetch(event.request)
          .then(fetchedFromNetwork, unableToResolve)
          .catch(unableToResolve);

        // console.log("Responding from " + (cached ? 'cache' : 'network') + ' url:' + event.request.url);
        return cached || networked;

        function fetchedFromNetwork(response) {
          var newCopy = response.clone();
          if (shouldCache(event.request.url)) {
//            console.log('WORKER: caching new response from network', event.request.url);
            caches
              .open(CACHE_NAME)
              .then(function (cache) {
                cache.put(event.request, newCopy);
              })
              .then(function () {
  //              console.log('WORKER: fetch response stored in cache.', event.request.url);
              });
          } else {
  //          console.log('WORKER: not caching ', event.request.url);
          }
          return response;
        }

        function unableToResolve() {
  //        console.log('WORKER: fetch request failed in both cache and network.');
          return new Response('<h1>Service Unavailable</h1>', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/html'
            })
          });
        }
      })
  )
}
);

// capture the service worker's activate event
// this is called when a new service worker supercedes
// the older one. In this case it invalidates any old cache keys
self.addEventListener('activate', function (event) {
  var cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});