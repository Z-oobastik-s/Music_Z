/**
 * Music_Z service worker
 * - HTML / navigations: network-first (avoid black screen from stale index → missing hashed JS)
 * - Hashed /assets/: cache-first (immutable filenames)
 * - Media: stable cache across deploys
 */
const BUILD = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL = `music-z-shell-${BUILD}`;
const MEDIA = "music-z-media-v1";

const PRECACHE = [
  "./favicon.svg",
  "./favicon.png",
  "./character.png",
  "./characters/01-open.png",
  "./characters/02-blink.png",
  "./characters/03-soft.png",
  "./characters/04-closed.png",
  "./characters/05-smirk.png",
  "./characters/hair-00.png",
  "./characters/hair-01.png",
  "./characters/hair-02.png",
  "./characters/hair-03.png",
  "./characters/head-turn.png",
  "./characters/body-sway.png",
  "./characters/06-wind.png",
  "./characters/07-breath.png",
  "./logo.png",
  "./hero-banner.png",
];

self.addEventListener("install", (event) => {
  const e = /** @type {ExtendableEvent} */ (event);
  e.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      for (const p of PRECACHE) {
        try {
          await cache.add(new URL(p, self.location.href).href);
        } catch {
          /* skip missing */
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  const e = /** @type {ExtendableEvent} */ (event);
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => {
            if (k.startsWith("music-z-shell-") && k !== SHELL) return true;
            if (k.startsWith("music-z-media-") && k !== MEDIA) return true;
            return false;
          })
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * @param {Request} req
 * @param {string} cacheName
 */
async function cacheFirst(req, cacheName) {
  if (req.headers.has("Range")) return fetch(req);
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) {
    try {
      await cache.put(req, res.clone());
    } catch {
      /* quota */
    }
  }
  return res;
}

/**
 * Always try network first — critical for index.html after deploys.
 * @param {Request} req
 * @param {string} cacheName
 */
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req, { cache: "no-store" });
    if (res.ok) {
      try {
        await cache.put(req, res.clone());
      } catch {
        /* quota */
      }
    }
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

/**
 * @param {Request} req
 * @param {string} cacheName
 */
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refreshing = fetch(req)
    .then((res) => {
      if (res.ok) void cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refreshing;
}

self.addEventListener("fetch", (event) => {
  const e = /** @type {FetchEvent} */ (event);
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  if (path.endsWith("/version.json") || path.endsWith("/tracks.json")) {
    return;
  }

  if (/mz-theme-cat|mz-play-cat|mz-dl-|mz-search-/i.test(path)) {
    e.respondWith(staleWhileRevalidate(req, MEDIA));
    return;
  }

  if (
    path.includes("/tracks/") ||
    path.includes("/covers/") ||
    path.includes("/characters/") ||
    /\/character\.png$/i.test(path) ||
    /\/hero-banner\.png$/i.test(path) ||
    /\/logo\.png$/i.test(path) ||
    /\/favicon\.(svg|png)$/i.test(path)
  ) {
    if (path.includes("/tracks/") && req.headers.has("Range")) {
      e.respondWith(fetch(req));
      return;
    }
    e.respondWith(cacheFirst(req, MEDIA));
    return;
  }

  const underApp = path.includes("/Music_Z/") || path.endsWith("/Music_Z");
  if (!underApp) return;

  // Navigation / HTML — never prefer stale shell (black screen after deploy)
  const isNav = req.mode === "navigate" || path.endsWith(".html") || /\/Music_Z\/?$/.test(path);
  if (isNav) {
    e.respondWith(networkFirst(req, SHELL));
    return;
  }

  // Hashed JS/CSS bundles
  if (path.includes("/assets/")) {
    e.respondWith(cacheFirst(req, SHELL));
  }
});
