import "./styles.css";
import { AudioPlayer } from "./lib/player";
import { applyTheme, getTheme, toggleTheme } from "./lib/theme";
import {
  assetUrl,
  escapeHtml,
  formatDuration,
  matchesQuery,
  type Track,
} from "./lib/tracks";
import { startAutoUpdate } from "./lib/update";

const rootEl = document.querySelector<HTMLDivElement>("#app");
if (!rootEl) throw new Error("#app missing");
const app: HTMLDivElement = rootEl;

applyTheme(getTheme());
startAutoUpdate();

const BUILD = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : String(Date.now());

async function loadTracks(): Promise<Track[]> {
  const res = await fetch(assetUrl("data/tracks.json", BUILD), { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить каталог треков");
  return (await res.json()) as Track[];
}

function render(tracks: Track[]): void {
  let query = "";
  let activeId: string | null = null;
  let playing = false;
  let featuredId = tracks[0]?.id ?? null;

  app.innerHTML = `
    <header class="top">
      <h1 class="brand">Music<span>_Z</span></h1>
      <input class="search" type="search" placeholder="Поиск треков, артистов, тегов…" aria-label="Поиск" />
      <button type="button" class="icon-btn" data-theme title="Тема" aria-label="Сменить тему">◐</button>
    </header>

    <section class="featured" data-featured></section>

    <section class="section">
      <div class="section-head">
        <h3>Треки</h3>
        <span class="count" data-count></span>
      </div>
      <div class="list" data-list></div>
    </section>

    <footer class="dock">
      <div class="dock-main">
        <div class="now">
          <img data-now-cover alt="" width="44" height="44" />
          <div>
            <strong data-now-title>Выбери трек</strong>
            <span data-now-artist>—</span>
          </div>
        </div>
        <div class="controls">
          <button type="button" class="ctrl" data-prev aria-label="Предыдущий">⏮</button>
          <button type="button" class="ctrl main" data-toggle aria-label="Play">▶</button>
          <button type="button" class="ctrl" data-next aria-label="Следующий">⏭</button>
        </div>
        <div class="side">
          <input class="vol" data-vol type="range" min="0" max="100" value="90" aria-label="Громкость" />
        </div>
      </div>
      <div class="seek-row">
        <span data-t0>0:00</span>
        <input class="seek" data-seek type="range" min="0" max="1000" value="0" aria-label="Прогресс" />
        <span data-t1>0:00</span>
      </div>
    </footer>
  `;

  const featuredEl = app.querySelector<HTMLElement>("[data-featured]")!;
  const listEl = app.querySelector<HTMLElement>("[data-list]")!;
  const countEl = app.querySelector<HTMLElement>("[data-count]")!;
  const searchEl = app.querySelector<HTMLInputElement>(".search")!;
  const themeBtn = app.querySelector<HTMLButtonElement>("[data-theme]")!;
  const nowCover = app.querySelector<HTMLImageElement>("[data-now-cover]")!;
  const nowTitle = app.querySelector<HTMLElement>("[data-now-title]")!;
  const nowArtist = app.querySelector<HTMLElement>("[data-now-artist]")!;
  const toggleEl = app.querySelector<HTMLButtonElement>("[data-toggle]")!;
  const prevEl = app.querySelector<HTMLButtonElement>("[data-prev]")!;
  const nextEl = app.querySelector<HTMLButtonElement>("[data-next]")!;
  const seekEl = app.querySelector<HTMLInputElement>("[data-seek]")!;
  const volEl = app.querySelector<HTMLInputElement>("[data-vol]")!;
  const t0 = app.querySelector<HTMLElement>("[data-t0]")!;
  const t1 = app.querySelector<HTMLElement>("[data-t1]")!;

  let seeking = false;

  const player = new AudioPlayer({
    onChange: (track, isPlaying) => {
      activeId = track?.id ?? null;
      playing = isPlaying;
      if (track) featuredId = track.id;
      nowTitle.textContent = track?.title ?? "Выбери трек";
      nowArtist.textContent = track?.artist ?? "—";
      nowCover.src = track ? assetUrl(track.cover) : "";
      nowCover.hidden = !track;
      toggleEl.textContent = isPlaying ? "❚❚" : "▶";
      paintFeatured();
      syncActiveRows();
    },
    onTime: (current, duration) => {
      t0.textContent = formatDuration(current);
      t1.textContent = formatDuration(duration || 0);
      if (!duration || seeking) return;
      seekEl.value = String(Math.round((current / duration) * 1000));
    },
  });

  player.setVolume(0.9);

  const filtered = (): Track[] => tracks.filter((t) => matchesQuery(t, query));

  function paintFeatured(): void {
    const track =
      tracks.find((t) => t.id === (activeId ?? featuredId)) ?? tracks[0];
    if (!track) {
      featuredEl.innerHTML = "";
      return;
    }
    const isThis = activeId === track.id && playing;
    featuredEl.innerHTML = `
      <img src="${assetUrl(track.cover)}" alt="" width="200" height="200" />
      <div>
        <p class="eyebrow">Сейчас в фокусе</p>
        <h2>${escapeHtml(track.title)}</h2>
        <p class="artist">${escapeHtml(track.artist)} · ${formatDuration(track.durationSec)}</p>
        <p class="desc">${escapeHtml(track.description)}</p>
        <div class="cta-row">
          <button type="button" class="btn btn-primary" data-feat-play>${isThis ? "Пауза" : "Слушать"}</button>
          <button type="button" class="btn btn-ghost" data-feat-next>Дальше</button>
        </div>
      </div>
    `;
    featuredEl.querySelector<HTMLButtonElement>("[data-feat-play]")!.onclick = () => {
      player.setQueue(filtered().length ? filtered() : tracks);
      player.toggle(track);
    };
    featuredEl.querySelector<HTMLButtonElement>("[data-feat-next]")!.onclick = () => {
      player.setQueue(filtered().length ? filtered() : tracks);
      if (!player.current) void player.play(track);
      player.next();
    };
  }

  function syncActiveRows(): void {
    listEl.querySelectorAll<HTMLButtonElement>(".row").forEach((row) => {
      const on = row.dataset.id === activeId;
      row.classList.toggle("is-on", on);
      const play = row.querySelector(".play");
      if (play) play.textContent = on && playing ? "❚❚" : "▶";
    });
  }

  function paintList(): void {
    const items = filtered();
    player.setQueue(items.length ? items : tracks);
    countEl.textContent = `${items.length} / ${tracks.length}`;

    if (!items.length) {
      listEl.innerHTML = `<p class="empty">Ничего не найдено</p>`;
      return;
    }

    listEl.innerHTML = items
      .map((t) => {
        const on = t.id === activeId;
        return `
          <button type="button" class="row${on ? " is-on" : ""}" data-id="${t.id}">
            <img src="${assetUrl(t.cover)}" alt="" width="52" height="52" loading="lazy" />
            <div>
              <h4>${escapeHtml(t.title)}</h4>
              <p>${escapeHtml(t.artist)}</p>
            </div>
            <span class="dur">${formatDuration(t.durationSec)}</span>
            <span class="play">${on && playing ? "❚❚" : "▶"}</span>
          </button>
        `;
      })
      .join("");
  }

  listEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".row");
    if (!btn?.dataset.id) return;
    const track = tracks.find((t) => t.id === btn.dataset.id);
    if (!track) return;
    player.setQueue(filtered().length ? filtered() : tracks);
    player.toggle(track);
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    paintList();
  });

  themeBtn.addEventListener("click", () => {
    toggleTheme();
  });

  toggleEl.addEventListener("click", () => {
    const track = player.current ?? filtered()[0] ?? tracks[0];
    if (!track) return;
    player.setQueue(filtered().length ? filtered() : tracks);
    player.toggle(track);
  });
  prevEl.addEventListener("click", () => player.prev());
  nextEl.addEventListener("click", () => player.next());

  volEl.addEventListener("input", () => {
    player.setVolume(Number(volEl.value) / 100);
  });

  seekEl.addEventListener("pointerdown", () => {
    seeking = true;
  });
  const commitSeek = () => {
    seeking = false;
    player.seek(Number(seekEl.value) / 1000);
  };
  seekEl.addEventListener("pointerup", commitSeek);
  seekEl.addEventListener("change", commitSeek);

  nowCover.hidden = true;
  paintFeatured();
  paintList();
}

loadTracks()
  .then(render)
  .catch((err: unknown) => {
    app.innerHTML = `<p class="empty">${err instanceof Error ? err.message : "Ошибка загрузки"}</p>`;
  });
