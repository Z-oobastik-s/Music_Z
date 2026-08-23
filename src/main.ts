import "./styles.css";
import { AudioPlayer } from "./lib/player";
import {
  assetUrl,
  formatDuration,
  matchesQuery,
  type Track,
} from "./lib/tracks";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app missing");
const app: HTMLDivElement = root;

async function loadTracks(): Promise<Track[]> {
  const res = await fetch(assetUrl("data/tracks.json"));
  if (!res.ok) throw new Error("Не удалось загрузить каталог треков");
  return (await res.json()) as Track[];
}

function render(tracks: Track[]): void {
  let query = "";
  let activeId: string | null = null;
  let playing = false;

  app.innerHTML = `
    <header class="site-header">
      <h1 class="brand">Music_Z</h1>
      <p class="tagline">Личная библиотека треков: слушай, ищи, держи всё в одном месте.</p>
    </header>
    <div class="toolbar">
      <input class="search" type="search" placeholder="Поиск по названию, артисту, тегам…" aria-label="Поиск треков" />
      <span class="meta-count" data-count></span>
    </div>
    <main class="library" data-list></main>
    <footer class="player-bar" data-player>
      <div class="player-row">
        <button type="button" class="player-btn" data-toggle aria-label="Play/Pause">▶</button>
        <div class="player-title" data-now>Выбери трек</div>
      </div>
      <input class="progress" data-seek type="range" min="0" max="1000" value="0" aria-label="Прогресс" />
    </footer>
  `;

  const listEl = app.querySelector<HTMLElement>("[data-list]")!;
  const countEl = app.querySelector<HTMLElement>("[data-count]")!;
  const searchEl = app.querySelector<HTMLInputElement>(".search")!;
  const nowEl = app.querySelector<HTMLElement>("[data-now]")!;
  const toggleEl = app.querySelector<HTMLButtonElement>("[data-toggle]")!;
  const seekEl = app.querySelector<HTMLInputElement>("[data-seek]")!;

  const player = new AudioPlayer({
    onChange: (track, isPlaying) => {
      activeId = track?.id ?? null;
      playing = isPlaying;
      nowEl.textContent = track
        ? `${track.title} — ${track.artist}`
        : "Выбери трек";
      toggleEl.textContent = isPlaying ? "❚❚" : "▶";
      paintList();
    },
    onTime: (current, duration) => {
      if (!duration || seeking) return;
      seekEl.value = String(Math.round((current / duration) * 1000));
    },
  });

  let seeking = false;

  const filtered = (): Track[] => tracks.filter((t) => matchesQuery(t, query));

  function paintList(): void {
    const items = filtered();
    countEl.textContent = `${items.length} / ${tracks.length}`;

    if (!items.length) {
      listEl.innerHTML = `<p class="empty">Ничего не найдено. Попробуй другой запрос.</p>`;
      return;
    }

    listEl.innerHTML = items
      .map((t, i) => {
        const active = t.id === activeId;
        return `
          <button type="button" class="track${active ? " is-active" : ""}" data-id="${t.id}" style="animation-delay:${Math.min(i, 12) * 0.03}s">
            <img class="cover" src="${assetUrl(t.cover)}" alt="" width="72" height="72" loading="lazy" />
            <div class="track-body">
              <h2>${escapeHtml(t.title)}</h2>
              <p>${escapeHtml(t.artist)} — ${escapeHtml(t.description)}</p>
            </div>
            <div class="track-side">
              <span>${formatDuration(t.durationSec)}</span>
              <span class="play-dot">${active && playing ? "❚❚" : "▶"}</span>
            </div>
          </button>
        `;
      })
      .join("");

    listEl.querySelectorAll<HTMLButtonElement>(".track").forEach((btn) => {
      btn.addEventListener("click", () => {
        const track = tracks.find((t) => t.id === btn.dataset.id);
        if (track) player.toggle(track);
      });
    });
  }

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    paintList();
  });

  toggleEl.addEventListener("click", () => {
    const track = player.current ?? filtered()[0] ?? tracks[0];
    if (track) player.toggle(track);
  });

  seekEl.addEventListener("pointerdown", () => {
    seeking = true;
  });
  seekEl.addEventListener("pointerup", () => {
    seeking = false;
    player.seek(Number(seekEl.value) / 1000);
  });
  seekEl.addEventListener("change", () => {
    seeking = false;
    player.seek(Number(seekEl.value) / 1000);
  });

  paintList();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

loadTracks()
  .then(render)
  .catch((err: unknown) => {
    app.innerHTML = `<p class="empty">${err instanceof Error ? err.message : "Ошибка загрузки"}</p>`;
  });
