/** Deep-link / share helpers for Music_Z tracks. */

export type DeepLink = {
  id: string;
  /** Auto-start playback when the page opens */
  play: boolean;
};

const SITE_ORIGIN = "https://zoobastik.me";

function appPathname(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function absBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${appPathname()}`;
  }
  return `${SITE_ORIGIN}${appPathname()}`;
}

/** User-facing label without em/en dashes. */
export function trackLabel(artist: string, title: string): string {
  return `${artist}: ${title}`;
}

function parseHashParams(hash: string): URLSearchParams {
  const raw = hash.replace(/^#/, "");
  if (!raw) return new URLSearchParams();
  const q = raw.startsWith("?") ? raw.slice(1) : raw;
  return new URLSearchParams(q);
}

/**
 * Public share URL: static OG page (good Telegram/VK preview), then opens the player.
 * Falls back to SPA deep-link when share pages are unavailable.
 */
export function trackShareUrl(trackId: string, play = true): string {
  const base = absBase();
  const safe = encodeURIComponent(trackId);
  // Static card at /t/<id>.html (generated at build)
  return `${base}t/${safe}.html${play ? "" : "?play=0"}`;
}

/** SPA deep-link (internal navigation / embed). */
export function trackAppUrl(trackId: string, play = true): string {
  const url = new URL(absBase());
  url.searchParams.set("track", trackId);
  if (play) url.searchParams.set("play", "1");
  else url.searchParams.delete("play");
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

  // Keep hash light: only track id (no duplicate play noise in shares from address bar)
  url.hash = `track=${encodeURIComponent(trackId)}`;

  history.replaceState(null, "", url);
}

/** Remove track deep-link params from the address bar (e.g. when opening Home). */
export function clearTrackInUrl(): void {
  const url = new URL(window.location.href);
  url.pathname = appPathname();
  const dirty =
    url.searchParams.has("track") ||
    url.searchParams.has("t") ||
    url.searchParams.has("play") ||
    Boolean(url.hash);
  if (!dirty) return;
  url.search = "";
  url.hash = "";
  history.replaceState(null, "", url);
}

/** Embed snippet for other sites (iframe + API note). */
export function trackEmbedSnippet(trackId: string, title: string): string {
  const src = trackAppUrl(trackId, true);
  return `<!-- Music_Z: ${title} -->
<iframe
  src="${src}"
  title="${title.replaceAll('"', "'")}: Music_Z"
  width="100%"
  height="720"
  style="border:0;border-radius:8px;max-width:1100px;background:#000"
  allow="autoplay; encrypted-media"
  loading="lazy"
></iframe>

<!-- API:
  ?track=<id>&play=1   open and play
  ?track=<id>&play=0   open without autoplay
  ?t=<id>              short alias
  /t/<id>.html         share card (Open Graph)
-->`;
}

export function telegramShareUrl(trackId: string, title: string, artist: string): string {
  const url = trackShareUrl(trackId, true);
  const text = trackLabel(artist, title);
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/** Direct MP3: Telegram shows a native audio player (unlike website embeds). */
export function telegramAudioShareUrl(trackSrc: string, title: string, artist: string): string {
  const base = absBase();
  const clean = trackSrc.replace(/^\/+/, "");
  const audioUrl = `${base}${clean}`;
  // Only the label in text — Telegram already attaches `url` as the preview
  const text = trackLabel(artist, title);
  return `https://t.me/share/url?url=${encodeURIComponent(audioUrl)}&text=${encodeURIComponent(text)}`;
}

export function vkShareUrl(trackId: string, title: string, artist: string): string {
  const url = trackShareUrl(trackId, true);
  return `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(trackLabel(artist, title))}`;
}

export function whatsappShareUrl(trackId: string, title: string, artist: string): string {
  const url = trackShareUrl(trackId, true);
  const text = `${trackLabel(artist, title)}\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
