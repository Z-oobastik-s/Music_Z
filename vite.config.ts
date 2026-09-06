import { defineConfig, type Plugin } from "vite";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const SITE = "https://zoobastik.me/Music_Z";

type TrackRow = {
  id: string;
  title: string;
  artist: string;
  description?: string;
  cover?: string;
  src: string;
};

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Strip em/en dashes from user-facing copy. */
function cleanCopy(s: string): string {
  return s
    .replace(/[—–‒―]/g, ":")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim();
}

function sharePageHtml(t: TrackRow): string {
  const title = `${t.artist}: ${t.title}`;
  const desc = cleanCopy(
    t.description?.slice(0, 160) || `Слушай «${t.title}» от ${t.artist} на Music_Z`,
  );
  const pageUrl = `${SITE}/t/${encodeURIComponent(t.id)}.html`;
  const appUrl = `${SITE}/?track=${encodeURIComponent(t.id)}&play=1`;
  const audioUrl = `${SITE}/${t.src.replace(/^\/+/, "")}`;
  const imageUrl = `${SITE}/og-default.png`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} | Music_Z</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${esc(pageUrl)}" />
  <meta property="og:type" content="music.song" />
  <meta property="og:site_name" content="Music_Z" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(pageUrl)}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta property="og:image:secure_url" content="${esc(imageUrl)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:audio" content="${esc(audioUrl)}" />
  <meta property="og:audio:secure_url" content="${esc(audioUrl)}" />
  <meta property="og:audio:type" content="audio/mpeg" />
  <meta property="music:musician" content="${esc(t.artist)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#f0f0f0;
      font-family:system-ui,sans-serif;padding:1.5rem;text-align:center}
    a.cta{display:inline-block;margin-top:1rem;padding:.75rem 1.25rem;background:#e10600;color:#fff;
      text-decoration:none;font-weight:700;letter-spacing:.04em}
    .muted{color:#8a8a8a;font-size:.9rem;margin:.4rem 0 0}
    audio{width:min(100%,420px);margin-top:1.25rem}
  </style>
</head>
<body>
  <div>
    <p><strong>${esc(title)}</strong></p>
    <p class="muted">Music_Z</p>
    <p><a class="cta" href="${esc(appUrl)}">Слушать на Music_Z</a></p>
    <audio controls preload="none" src="${esc(audioUrl)}"></audio>
  </div>
</body>
</html>
`;
}

function versionPlugin(): Plugin {
  return {
    name: "music-z-version",
    closeBundle() {
      const dir = resolve(process.cwd(), "dist");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        resolve(dir, "version.json"),
        JSON.stringify({ buildId, builtAt: new Date().toISOString() }),
      );

      const catalogPath = resolve(process.cwd(), "public/data/tracks.json");
      if (!existsSync(catalogPath)) return;
      const tracks = JSON.parse(readFileSync(catalogPath, "utf8")) as TrackRow[];
      const outDir = resolve(dir, "t");
      mkdirSync(outDir, { recursive: true });
      for (const t of tracks) {
        if (!t?.id) continue;
        writeFileSync(resolve(outDir, `${t.id}.html`), sharePageHtml(t), "utf8");
      }
      console.log(`[music-z] share pages: ${tracks.length} → dist/t/`);
    },
  };
}

export default defineConfig({
  base: "/Music_Z/",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: false,
    cssMinify: true,
  },
  plugins: [versionPlugin()],
});
