import { assetUrl } from "./tracks";

/** Stable across deploys — shell cache is versioned separately in sw.js */
const CACHE_NAME = "music-z-media-v1";
const memory = new Map<string, string>(); // path -> blob:
const inflight = new Map<string, Promise<string>>();
const MAX_MEMORY_BLOBS = 12;

function absUrl(path: string): string {
  const rel = assetUrl(path);
  return new URL(rel, window.location.href).href;
}

function rememberBlob(path: string, blobUrl: string): void {
  if (memory.has(path)) {
    memory.delete(path);
  }
  memory.set(path, blobUrl);
  while (memory.size > MAX_MEMORY_BLOBS) {
    const oldest = memory.keys().next().value;
    if (!oldest) break;
    const url = memory.get(oldest);
    memory.delete(oldest);
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }
}

async function fetchToBlobUrl(path: string): Promise<string> {
  const url = absUrl(path);

  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      let res = await cache.match(url);
      if (!res || !res.ok) {
        res = await fetch(url, { credentials: "same-origin", mode: "cors" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        try {
          await cache.put(url, res.clone());
        } catch {
          /* quota / opaque */
        }
      }
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      /* fall through */
    }
  }

  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Instant playback URL: memory blob if ready, else network URL (progressive).
 * Warms Cache API / memory in the background without blocking play.
 */
export function resolvePlaybackUrl(path: string): string {
  const hit = memory.get(path);
  if (hit) return hit;
  warmMedia(path);
  return absUrl(path);
}

/** Full blob resolve (prefetch / offline). Prefer resolvePlaybackUrl for play(). */
export async function getCachedMediaUrl(path: string): Promise<string> {
  const hit = memory.get(path);
  if (hit) return hit;

  let pending = inflight.get(path);
  if (!pending) {
    pending = fetchToBlobUrl(path)
      .then((blobUrl) => {
        rememberBlob(path, blobUrl);
        inflight.delete(path);
        return blobUrl;
      })
      .catch((err) => {
        inflight.delete(path);
        throw err;
      });
    inflight.set(path, pending);
  }
  return pending;
}

function warmMedia(path: string): void {
  if (memory.has(path) || inflight.has(path)) return;
  void getCachedMediaUrl(path).catch(() => {
    /* ignore warm errors */
  });
}

/** Warm cache without blocking UI. */
export function prefetchMedia(path: string): void {
  warmMedia(path);
}

export function prefetchMany(paths: string[]): void {
  for (const p of paths) prefetchMedia(p);
}

/** Drop memory blob URLs (Cache API entries remain). */
export function clearMediaMemory(): void {
  for (const url of memory.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  memory.clear();
}
