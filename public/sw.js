/**
 * Music_Z service worker
 * - HTML / navigations: network-first (avoid black screen from stale index → missing hashed JS)
 * - Hashed /assets/: cache-first (immutable filenames)
 * - Media: stable cache across deploys
 */
const BUILD = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL = `music-z-shell-${BUILD}`;
const MEDIA = "music-z-media-v3";

const PRECACHE = [
  "./favicon.svg",
  "./favicon.png",
  "./logo.webp",
  "./hero-mark.webp",
  "./hero-girl/00.webp",
  // Scene: webp only (jpg is CSS fallback, not precached)
  "./bg-japan-dim.webp",
  "./bg-japan-lit.webp",
  // Sidebar key poses only
  "./side-samurai/01.webp",
  "./side-samurai/05.webp",
  "./side-samurai/09.webp",
  "./side-samurai/13.webp",
  "./side-samurai/17.webp",
  // Character core frames (rest cache-on-demand)
  "./characters/01-open.webp",
  "./characters/02-blink.webp",
  "./characters/hair-00.webp",
  "./characters/body-sway.webp",
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
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const e = /** @type {FetchEvent} */ (event);
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // Never SW-cache live catalog / version
  if (path.endsWith("/tracks.json") || path.endsWith("/version.json") || path.endsWith("/data/tracks.json")) {
    return;
  }

  // Navigations / HTML: network-first
  if (req.mode === "navigate" || req.destination === "document" || path.endsWith(".html")) {
    e.respondWith(networkFirst(req, SHELL));
    return;
  }

  // Built hashed assets
  if (path.includes("/assets/")) {
    e.respondWith(cacheFirst(req, SHELL));
    return;
  }

  // Media + static images
  if (
    path.includes("/tracks/") ||
    path.includes("/covers/") ||
    path.includes("/characters/") ||
    path.includes("/side-samurai/") ||
    path.includes("/hero-girl/") ||
    /\.(?:mp3|webp|png|jpg|jpeg|svg)$/i.test(path)
  ) {
    e.respondWith(cacheFirst(req, MEDIA));
    return;
  }
});
