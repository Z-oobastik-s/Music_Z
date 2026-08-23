import "./styles.css";
import { AudioPlayer } from "./lib/player";
import { applyTheme, getTheme, setTheme } from "./lib/theme";
import {
  assetUrl,
  defaultLyrics,
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

const ICONS = {
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"/></svg>`,
  music: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  list: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  down: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>`,
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>`,
  play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`,
  dl: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>`,
  shuffle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>`,
  prev: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
  next: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z"/></svg>`,
  repeat: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  vol: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5zM15 9a4 4 0 010 6M17 7a7 7 0 010 10"/></svg>`,
};

function waveBars(n = 48): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    const h = 4 + Math.round(Math.abs(Math.sin(i * 0.55)) * 22);
    s += `<i style="height:${h}px"></i>`;
  }
  return s;
}

async function loadTracks(): Promise<Track[]> {
  const res = await fetch(assetUrl("data/tracks.json", BUILD), { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить каталог");
  return (await res.json()) as Track[];
}

function render(tracks: Track[]): void {
  let query = "";
  let activeId: string | null = null;
  let playing = false;
  let focusId = tracks[0]?.id ?? null;

  app.innerHTML = `
    <div class="backdrop" data-backdrop></div>
    <div class="shell">
      <aside class="side" data-side>
        <div class="side-logo">Music_Z</div>
        <ul class="nav">
          <li><button type="button" class="is-on" data-nav="home">${ICONS.home} Главная</button></li>
          <li><button type="button" data-nav="music">${ICONS.music} Музыка</button></li>
          <li><button type="button" data-nav="playlists">${ICONS.list} Плейлисты</button></li>
          <li><button type="button" data-nav="artists">${ICONS.user} Артисты</button></li>
          <li><button type="button" data-nav="downloads">${ICONS.down} Загрузки</button></li>
          <li><button type="button" data-nav="info">${ICONS.info} Инфо</button></li>
        </ul>
        <div class="side-foot">
          <div class="mini-wave" data-mini-wave>${waveBars(5)}</div>
          © ${new Date().getFullYear()} Music_Z
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button type="button" class="menu-btn" data-menu aria-label="Меню">☰</button>
          <label class="search-box">
            ${ICONS.search}
            <input type="search" placeholder="Поиск трека, артиста…" data-search aria-label="Поиск" />
          </label>
          <div class="theme-switch">
            <button type="button" data-theme-pick="dark">Тёмная</button>
            <button type="button" data-theme-pick="light">Светлая</button>
          </div>
        </header>

        <div class="grid">
          <section class="hero" data-hero></section>

          <section class="tracks-panel" id="tracks">
            <div class="panel-head">Популярные треки <span data-count></span></div>
            <ul class="track-list" data-list></ul>
          </section>

          <aside class="lyrics-panel">
            <div class="panel-head">Текст песни</div>
            <div class="lyrics-body" data-lyrics></div>
          </aside>

          <aside class="deco-panel" data-deco></aside>
        </div>
      </div>
    </div>

    <footer class="player">
      <div class="player-row">
        <div class="now-play">
          <img data-now-cover alt="" width="48" height="48" hidden />
          <div>
            <strong data-now-title>Выбери трек</strong>
            <span data-now-artist>Music_Z</span>
          </div>
        </div>
        <div class="player-ctrl">
          <button type="button" data-shuffle title="Shuffle">${ICONS.shuffle}</button>
          <button type="button" data-prev title="Назад">${ICONS.prev}</button>
          <button type="button" class="play-main" data-toggle title="Play">${ICONS.play}</button>
          <button type="button" data-next title="Вперёд">${ICONS.next}</button>
          <button type="button" data-repeat title="Repeat">${ICONS.repeat}</button>
        </div>
        <div class="player-side">
          ${ICONS.vol}
          <input type="range" min="0" max="100" value="88" data-vol aria-label="Громкость" />
        </div>
      </div>
      <div class="wave-seek">
        <time data-t0>0:00</time>
        <div class="wave-wrap">
          <div class="wave-bars">${waveBars()}</div>
          <div class="wave-fill" data-wave-fill style="width:0"><div class="wave-bars">${waveBars()}</div></div>
          <input class="wave-input" type="range" min="0" max="1000" value="0" data-seek aria-label="Прогресс" />
        </div>
        <time data-t1>0:00</time>
      </div>
    </footer>
  `;

  applyTheme(getTheme());

  const side = app.querySelector<HTMLElement>("[data-side]")!;
  const backdrop = app.querySelector<HTMLElement>("[data-backdrop]")!;
  const heroEl = app.querySelector<HTMLElement>("[data-hero]")!;
  const listEl = app.querySelector<HTMLElement>("[data-list]")!;
  const lyricsEl = app.querySelector<HTMLElement>("[data-lyrics]")!;
  const decoEl = app.querySelector<HTMLElement>("[data-deco]")!;
  const countEl = app.querySelector<HTMLElement>("[data-count]")!;
  const searchEl = app.querySelector<HTMLInputElement>("[data-search]")!;
  const miniWave = app.querySelector<HTMLElement>("[data-mini-wave]")!;
  const nowCover = app.querySelector<HTMLImageElement>("[data-now-cover]")!;
  const nowTitle = app.querySelector<HTMLElement>("[data-now-title]")!;
  const nowArtist = app.querySelector<HTMLElement>("[data-now-artist]")!;
  const toggleEl = app.querySelector<HTMLButtonElement>("[data-toggle]")!;
  const seekEl = app.querySelector<HTMLInputElement>("[data-seek]")!;
  const waveFill = app.querySelector<HTMLElement>("[data-wave-fill]")!;
  const volEl = app.querySelector<HTMLInputElement>("[data-vol]")!;
  const t0 = app.querySelector<HTMLElement>("[data-t0]")!;
  const t1 = app.querySelector<HTMLElement>("[data-t1]")!;

  let seeking = false;

  const player = new AudioPlayer({
    onChange: (track, isPlaying) => {
      activeId = track?.id ?? null;
      playing = isPlaying;
      if (track) focusId = track.id;
      nowTitle.textContent = track?.title ?? "Выбери трек";
      nowArtist.textContent = track?.artist ?? "Music_Z";
      if (track) {
        nowCover.src = assetUrl(track.cover);
        nowCover.hidden = false;
      } else {
        nowCover.hidden = true;
      }
      toggleEl.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
      miniWave.classList.toggle("is-paused", !isPlaying);
      paintHero();
      paintList();
      paintLyrics();
      paintDeco();
    },
    onTime: (current, duration) => {
      t0.textContent = formatDuration(current);
      t1.textContent = formatDuration(duration || 0);
      if (!duration || seeking) return;
      const ratio = current / duration;
      seekEl.value = String(Math.round(ratio * 1000));
      waveFill.style.width = `${ratio * 100}%`;
    },
  });

  player.setVolume(0.88);

  const filtered = (): Track[] => tracks.filter((t) => matchesQuery(t, query));

  const currentTrack = (): Track | undefined =>
    tracks.find((t) => t.id === (activeId ?? focusId)) ?? tracks[0];

  function paintHero(): void {
    const track = currentTrack();
    if (!track) {
      heroEl.innerHTML = "";
      return;
    }
    const on = activeId === track.id && playing;
    heroEl.innerHTML = `
      <h2 class="hero-title">${escapeHtml(track.title)}</h2>
      <p class="hero-sub">${escapeHtml(track.artist)} · ${formatDuration(track.durationSec)}</p>
      <div class="hero-actions">
        <button type="button" class="btn btn-fill" data-hero-play>${on ? "Пауза" : "Воспроизвести"}</button>
        <a class="btn btn-line" href="${assetUrl(track.src)}" download="${escapeHtml(track.title)}.mp3">${ICONS.dl} Скачать</a>
        <button type="button" class="btn btn-line btn-icon" data-hero-next title="Следующий">⋯</button>
      </div>
    `;
    heroEl.querySelector<HTMLButtonElement>("[data-hero-play]")!.onclick = () => {
      player.setQueue(filtered().length ? filtered() : tracks);
      player.toggle(track);
    };
    heroEl.querySelector<HTMLButtonElement>("[data-hero-next]")!.onclick = () => {
      player.setQueue(filtered().length ? filtered() : tracks);
      player.next();
    };
  }

  function paintLyrics(): void {
    const track = currentTrack();
    if (!track) {
      lyricsEl.innerHTML = `<p class="empty">Выбери трек</p>`;
      return;
    }
    const lines = defaultLyrics(track);
    let html = "";
    let block = 0;
    lines.forEach((line, i) => {
      if (!line) {
        if (block > 0) html += `<div class="sep"></div>`;
        block = 0;
        return;
      }
      html += `<p>${escapeHtml(line)}</p>`;
      block++;
      if (block >= 4 && i < lines.length - 1) {
        html += `<div class="sep"></div>`;
        block = 0;
      }
    });
    lyricsEl.innerHTML = html || `<p>${escapeHtml(track.description)}</p>`;
  }

  function paintDeco(): void {
    const track = currentTrack();
    if (!track) {
      decoEl.innerHTML = "";
      return;
    }
    decoEl.innerHTML = `
      <img src="${assetUrl(track.cover)}" alt="" />
      <div class="deco-tag">${escapeHtml(track.title)}</div>
    `;
  }

  function paintList(): void {
    const items = filtered();
    player.setQueue(items.length ? items : tracks);
    countEl.textContent = `${items.length} / ${tracks.length}`;

    if (!items.length) {
      listEl.innerHTML = `<li class="empty">Ничего не найдено</li>`;
      return;
    }

    listEl.innerHTML = items
      .map((t, i) => {
        const on = t.id === activeId;
        const num = String(i + 1).padStart(2, "0");
        return `
          <li>
            <button type="button" class="track-item${on ? " is-on" : ""}" data-id="${t.id}">
              <span class="num">${num}</span>
              <img src="${assetUrl(t.cover)}" alt="" width="48" height="48" loading="lazy" />
              <div class="track-meta">
                <h4>${escapeHtml(t.title)}</h4>
                <p>${escapeHtml(t.artist)}</p>
              </div>
              <span class="track-dur">${formatDuration(t.durationSec)}</span>
              <span class="ico-btn" data-play aria-hidden="true">${on && playing ? ICONS.pause : ICONS.play}</span>
              <a class="ico-btn" href="${assetUrl(t.src)}" download="${escapeHtml(t.title)}.mp3" data-dl>${ICONS.dl}</a>
            </button>
          </li>
        `;
      })
      .join("");
  }

  listEl.addEventListener("click", (e) => {
    const dl = (e.target as HTMLElement).closest("[data-dl]");
    if (dl) {
      e.stopPropagation();
      return;
    }
    const row = (e.target as HTMLElement).closest<HTMLButtonElement>(".track-item");
    if (!row?.dataset.id) return;
    const track = tracks.find((t) => t.id === row.dataset.id);
    if (!track) return;
    player.setQueue(filtered().length ? filtered() : tracks);
    player.toggle(track);
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    paintList();
  });

  app.querySelectorAll<HTMLButtonElement>("[data-theme-pick]").forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themePick as "dark" | "light"));
  });

  app.querySelector<HTMLButtonElement>("[data-menu]")!.addEventListener("click", () => {
    side.classList.add("is-open");
    backdrop.classList.add("is-open");
  });
  backdrop.addEventListener("click", () => {
    side.classList.remove("is-open");
    backdrop.classList.remove("is-open");
  });

  app.querySelector<HTMLButtonElement>("[data-toggle]")!.addEventListener("click", () => {
    const track = player.current ?? filtered()[0] ?? tracks[0];
    if (!track) return;
    player.setQueue(filtered().length ? filtered() : tracks);
    player.toggle(track);
  });
  app.querySelector<HTMLButtonElement>("[data-prev]")!.addEventListener("click", () => player.prev());
  app.querySelector<HTMLButtonElement>("[data-next]")!.addEventListener("click", () => player.next());

  volEl.addEventListener("input", () => player.setVolume(Number(volEl.value) / 100));

  seekEl.addEventListener("pointerdown", () => {
    seeking = true;
  });
  const commitSeek = () => {
    seeking = false;
    const ratio = Number(seekEl.value) / 1000;
    player.seek(ratio);
    waveFill.style.width = `${ratio * 100}%`;
  };
  seekEl.addEventListener("input", () => {
    waveFill.style.width = `${(Number(seekEl.value) / 1000) * 100}%`;
  });
  seekEl.addEventListener("pointerup", commitSeek);
  seekEl.addEventListener("change", commitSeek);

  app.querySelector<HTMLButtonElement>('[data-nav="music"]')!.addEventListener("click", () => {
    document.getElementById("tracks")?.scrollIntoView({ behavior: "smooth" });
    side.classList.remove("is-open");
    backdrop.classList.remove("is-open");
  });

  paintHero();
  paintList();
  paintLyrics();
  paintDeco();
}

loadTracks()
  .then(render)
  .catch((err: unknown) => {
    app.innerHTML = `<p class="empty">${err instanceof Error ? err.message : "Ошибка загрузки"}</p>`;
  });
