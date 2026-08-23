export type Track = {
  id: string;
  title: string;
  artist: string;
  description: string;
  durationSec: number;
  tags: string[];
  /** Path relative to site base, e.g. covers/x.svg or tracks/song.mp3 */
  cover: string;
  src: string;
};

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const clean = path.replace(/^\/+/, "");
  return `${base}${clean}`;
}

export function matchesQuery(track: Track, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [track.title, track.artist, track.description, ...track.tags]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}
