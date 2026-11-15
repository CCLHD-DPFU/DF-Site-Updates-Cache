const CACHE = "site-update-v22";
const PREFIX = "site-update";
const SCOPE_URL = self.registration.scope;
const APP_URL = new URL("./index.html", SCOPE_URL).href;
const CORE_FILES = [
  APP_URL,
  new URL("./manifest.webmanifest", SCOPE_URL).href,
  new URL("./icon-180.png", SCOPE_URL).href,
  new URL("./icon-192.png", SCOPE_URL).href,
  new URL("./icon-512.png", SCOPE_URL).href
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(PREFIX) && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always serve the installed app shell from cache first.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cachedApp = await cache.match(APP_URL);
      if (cachedApp) return cachedApp;

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(APP_URL, response.clone());
        }
        return response;
      } catch (error) {
        return new Response(
          "The Site Update app has not been cached yet. Please open it once while connected to the internet.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  // Cache-first for local app files, with network fallback.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.ok && url.origin === self.location.origin) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response("This file is not available offline.", { status: 503 });
    }
  })());
});
