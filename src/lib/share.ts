/** Deep-link / share helpers for Music_Z tracks. */

export type DeepLink = {
  id: string;
  /** Auto-start playback when the page opens */
  play: boolean;
};

/** Absolute share URL that opens the site on a specific track. */
export function trackShareUrl(trackId: string, play = true): string {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  url.searchParams.set("track", trackId);
  if (play) url.searchParams.set("play", "1");
  return url.toString();
}

/** Short alias also accepted: ?t=id */
export function readDeepLink(): DeepLink | null {
  const url = new URL(window.location.href);
  const id =
    url.searchParams.get("track") ||
    url.searchParams.get("t") ||
    (() => {
      const m = url.hash.match(/(?:^|[&#])track=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    })();
  if (!id) return null;
  const playParam = url.searchParams.get("play");
  const play = playParam === null ? true : playParam !== "0" && playParam !== "false";
  return { id, play };
}

/** Keep the address bar in sync with the focused track (no autoplay flag). */
export function syncTrackInUrl(trackId: string): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get("track") === trackId && !url.searchParams.has("play")) return;
  url.searchParams.set("track", trackId);
  url.searchParams.delete("play");
  url.searchParams.delete("t");
  history.replaceState(null, "", url);
}

/** Embed snippet for other sites (iframe + optional JS note). */
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

<!-- API (query):
  ?track=<id>&play=1   — открыть и сразу играть
  ?track=<id>&play=0   — открыть без автозапуска
  ?t=<id>              — короткий алиас
-->`;
}
