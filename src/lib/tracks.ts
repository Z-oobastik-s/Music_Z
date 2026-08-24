export type TrackSource = {
  name: string;
  url: string;
};

export type Track = {
  id: string;
  title: string;
  artist: string;
  description: string;
  durationSec: number;
  tags: string[];
  cover: string;
  src: string;
  lyrics?: string[];
  style?: string;
  prompt?: string;
  /** Where the track was AI-generated */
  source?: TrackSource;
};

export const DEFAULT_TRACK_SOURCE: TrackSource = {
  name: "MusicHero",
  url: "https://musichero.ai/ru/app",
};

/** Default source is MusicHero unless a track sets `source` explicitly (e.g. AISong). */

export function trackSource(track: Track): TrackSource {
  return track.source ?? DEFAULT_TRACK_SOURCE;
}

export function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Catalog / playlist total — includes hours when needed (e.g. 2:15:30). */
export function formatTotalDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function sumDuration(list: Track[]): number {
  return list.reduce((acc, t) => acc + (t.durationSec || 0), 0);
}

export function assetUrl(path: string, bust?: string): string {
  const base = import.meta.env.BASE_URL;
  const clean = path.replace(/^\/+/, "");
  const url = `${base}${clean}`;
  return bust ? `${url}?v=${encodeURIComponent(bust)}` : url;
}

export function matchesQuery(track: Track, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [track.title, track.artist, track.description, ...track.tags]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function defaultLyrics(track: Track): string[] {
  if (track.lyrics?.length) return track.lyrics;
  return [
    track.description,
    "",
    `[ ${track.artist} ]`,
    track.tags.map((t) => `#${t}`).join("  "),
  ].filter(Boolean);
}
