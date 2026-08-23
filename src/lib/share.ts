/** Deep-link / share helpers for Music_Z tracks. */

export type DeepLink = {
  id: string;
  /** Auto-start playback when the page opens */
  play: boolean;
};

function appPathname(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function parseHashParams(hash: string): URLSearchParams {
  const raw = hash.replace(/^#/, "");
  if (!raw) return new URLSearchParams();
  // Support "#track=id&play=1" and "#?track=id"
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  return new URLSearchParams(q);
}

/** Absolute share URL that opens the site on a specific track. */
export function trackShareUrl(trackId: string, play = true): string {
  const url = new URL(window.location.href);
  // Keep trailing slash under /Music_Z/ so hosts don't redirect and drop ?query
  url.pathname = appPathname();
  url.search = "";
  url.searchParams.set("track", trackId);
  if (play) url.searchParams.set("play", "1");
  else url.searchParams.delete("play");
  // Hash backup: survives redirects that strip search params
  const hash = new URLSearchParams();
  hash.set("track", trackId);
  if (play) hash.set("play", "1");
  url.hash = hash.toString();
  return url.toString();
}

/** Short alias also accepted: ?t=id or #track=id */
export function readDeepLink(): DeepLink | null {
  const url = new URL(window.location.href);
  const hash = parseHashParams(url.hash);

  const id =
    url.searchParams.get("track") ||
    url.searchParams.get("t") ||
    hash.get("track") ||
    hash.get("t");

  if (!id) return null;

  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    /* already plain */
  }

  const playRaw = url.searchParams.get("play") ?? hash.get("play");
  const play = playRaw === null ? true : playRaw !== "0" && playRaw !== "false";
  return { id: decoded, play };
}

/**
 * Keep the address bar in sync with the focused track.
 * Preserves play=1 only when still needed for a pending deep-link handoff.
 */
export function syncTrackInUrl(trackId: string, keepPlay = false): void {
  const url = new URL(window.location.href);
  url.pathname = appPathname();
  const same =
    url.searchParams.get("track") === trackId &&
    (keepPlay ? url.searchParams.get("play") === "1" : !url.searchParams.has("play"));
  if (same && !url.hash) return;

  url.searchParams.set("track", trackId);
  url.searchParams.delete("t");
  if (keepPlay) url.searchParams.set("play", "1");
  else url.searchParams.delete("play");

  const hash = new URLSearchParams();
  hash.set("track", trackId);
  if (keepPlay) hash.set("play", "1");
  url.hash = hash.toString();

  history.replaceState(null, "", url);
}

/** Embed snippet for other sites (iframe + API note). */
export function trackEmbedSnippet(trackId: string, title: string): string {
  const src = trackShareUrl(trackId, true);
  return `<!-- Music_Z: ${title} -->
<iframe
  src="${src}"
  title="${title.replaceAll('"', "'")} — Music_Z"
  width="100%"
  height="720"
  style="border:0;border-radius:8px;max-width:1100px;background:#000"
  allow="autoplay; encrypted-media"
  loading="lazy"
></iframe>

<!-- API:
  ?track=<id>&play=1   — открыть и играть (дублируется в #track=&play=)
  ?track=<id>&play=0   — открыть без автозапуска
  ?t=<id>              — короткий алиас
-->`;
}

export function telegramShareUrl(trackId: string, title: string, artist: string): string {
  const url = trackShareUrl(trackId, true);
  const text = `${artist} — ${title}`;
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

export function vkShareUrl(trackId: string, title: string, artist: string): string {
  const url = trackShareUrl(trackId, true);
  return `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(`${artist} — ${title}`)}`;
}

export function whatsappShareUrl(trackId: string, title: string, artist: string): string {
  const url = trackShareUrl(trackId, true);
  const text = `${artist} — ${title}\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
