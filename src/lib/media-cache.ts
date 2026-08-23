import { assetUrl } from "./tracks";

declare const __BUILD_ID__: string;

const CACHE_NAME = `music-z-media-${typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev"}`;
const memory = new Map<string, string>(); // path -> blob:
const inflight = new Map<string, Promise<string>>();

function absUrl(path: string): string {
  const rel = assetUrl(path);
  return new URL(rel, window.location.href).href;
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
        // Store opaque-safe clone for next visits
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
 * Resolve a public asset path to a blob: URL (memory → Cache API → network).
 * Playback uses blob URLs so the audio element does not keep a hotlink to /tracks/*.mp3.
 */
export async function getCachedMediaUrl(path: string): Promise<string> {
  const hit = memory.get(path);
  if (hit) return hit;

  let pending = inflight.get(path);
  if (!pending) {
    pending = fetchToBlobUrl(path)
      .then((blobUrl) => {
        memory.set(path, blobUrl);
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

/** Warm cache without blocking UI. */
export function prefetchMedia(path: string): void {
  if (memory.has(path) || inflight.has(path)) return;
  void getCachedMediaUrl(path).catch(() => {
    /* ignore prefetch errors */
  });
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
