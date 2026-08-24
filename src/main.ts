import "./styles.css";
import { BeatMotion } from "./lib/beat";
import { CharacterCycle } from "./lib/character";
import { AudioPlayer, type RepeatMode } from "./lib/player";
import {
  clearTrackInUrl,
  readDeepLink,
  syncTrackInUrl,
  telegramAudioShareUrl,
  telegramShareUrl,
  trackEmbedSnippet,
  trackLabel,
  trackShareUrl,
  vkShareUrl,
  whatsappShareUrl,
} from "./lib/share";
import { applyTheme, getTheme, toggleTheme } from "./lib/theme";
import {
  assetUrl,
  defaultLyrics,
  escapeHtml,
  formatDuration,
  formatTotalDuration,
  sumDuration,
  matchesQuery,
  trackSource,
  type Track,
} from "./lib/tracks";
import { startAutoUpdate } from "./lib/update";
import { prefetchMany } from "./lib/media-cache";

const rootEl = document.querySelector<HTMLDivElement>("#app");
if (!rootEl) throw new Error("#app missing");
const app: HTMLDivElement = rootEl;

const BUILD = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : String(Date.now());

applyTheme(getTheme());

/** Service worker: instant revisits for tracks / art (production only). */
function registerSw(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const swUrl = `${import.meta.env.BASE_URL}sw.js?v=${encodeURIComponent(BUILD)}`;
  void navigator.serviceWorker
    .register(swUrl)
    .then((reg) => {
      void reg.update();
    })
    .catch(() => {
      /* private mode / blocked */
    });
}
registerSw();

/** Warm character frames into Cache API / memory after first paint */
function warmCharacterCache(): void {
  prefetchMany([
    "character.png",
    "characters/01-open.png",
    "characters/02-blink.png",
    "characters/03-soft.png",
    "characters/04-closed.png",
    "characters/05-smirk.png",
    "characters/hair-00.png",
    "characters/hair-01.png",
    "characters/hair-02.png",
    "characters/hair-03.png",
    "characters/head-turn.png",
    "characters/body-sway.png",
    "characters/06-wind.png",
    "characters/07-breath.png",
    "hero-banner.png",
    "logo.png",
  ]);
}
if (typeof requestIdleCallback === "function") {
  requestIdleCallback(() => warmCharacterCache(), { timeout: 2500 });
} else {
  window.setTimeout(warmCharacterCache, 1200);
}

/** Запрет drag / save картинок и ПКМ по всему сайту */
document.addEventListener(
  "dragstart",
  (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement || (t instanceof Element && t.closest("img"))) {
      e.preventDefault();
    }
  },
  true,
);
document.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
  },
  true,
);

const ICONS = {
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"/></svg>`,
  music: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  list: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  down: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>`,
  tags: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.6 13.4L12.7 21.3a2 2 0 01-2.8 0L2.7 14.1a2 2 0 010-2.8L11.4 2.6A2 2 0 0112.8 2H20a2 2 0 012 2v7.2a2 2 0 01-.6 1.4z"/><circle cx="16.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>`,
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>`,
  play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  tg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.7 14.5l-.3 4.2c.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8L21.8 5c.3-1.2-.4-1.7-1.3-1.4L3.3 10c-1.2.4-1.1 1.1-.2 1.4l4.4 1.4 10.2-6.4c.5-.3.9-.1.5.2"/></svg>`,
  pause: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`,
  dl: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>`,
  style: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h10M4 17h7"/></svg>`,
  prompt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h9l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M9 13h6M9 17h4"/></svg>`,
  shuffle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>`,
  prev: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
  next: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z"/></svg>`,
  repeat: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  repeatOne: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="8" font-family="IBM Plex Sans, sans-serif" font-weight="700">1</text></svg>`,
  playBig: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pauseBig: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`,
  spinner: `<svg class="icon-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity=".25"/><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  spinnerSm: `<svg class="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity=".25"/><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  queue: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h12M3 12h12M3 18h8"/><path d="M17 9.5v5l4.5-2.5L17 9.5z" fill="currentColor" stroke="none"/></svg>`,
  vol: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5zM15 9a4 4 0 010 6M17 7a7 7 0 010 10"/></svg>`,
  share: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  code: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>`,
  more: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
};

function waveBars(n = 120): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    // SoundCloud-like envelope: soft edges, dense mid energy
    const env =
      Math.sin(Math.PI * t) * 0.72 +
      Math.sin(Math.PI * t * 2.4) * 0.18 +
      Math.sin(Math.PI * t * 5.1 + 0.7) * 0.1;
    const noise =
      Math.abs(Math.sin(i * 1.7 + 0.3)) * 0.22 +
      Math.abs(Math.cos(i * 2.9)) * 0.14;
    const h = Math.max(0.08, Math.min(1, Math.abs(env) * 0.85 + noise * 0.55));
    s += `<i style="--h:${(h * 100).toFixed(1)}%"></i>`;
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
  let loadingId: string | null = null;
  let focusId = tracks[0]?.id ?? null;

  app.innerHTML = `
    <div class="backdrop" data-backdrop></div>
    <div class="shell">
      <aside class="side" data-side>
        <div class="side-logo"><img src="${assetUrl("logo.png")}" alt="Music_Z" /></div>
        <ul class="nav">
          <li><button type="button" class="is-on" data-nav="home"><span class="nav-ico">${ICONS.home}</span> Главная</button></li>
          <li><button type="button" data-nav="music"><span class="nav-ico">${ICONS.music}</span> Музыка</button></li>
          <li><button type="button" data-nav="playlists"><span class="nav-ico">${ICONS.list}</span> Плейлисты</button></li>
          <li><button type="button" data-nav="artists"><span class="nav-ico">${ICONS.user}</span> Артисты</button></li>
          <li><button type="button" data-nav="genres"><span class="nav-ico">${ICONS.tags}</span> Жанры</button></li>
          <li><button type="button" data-nav="info"><span class="nav-ico">${ICONS.info}</span> Инфо</button></li>
        </ul>
        <div class="side-foot">
          <div class="mini-wave" data-mini-wave>${waveBars(5)}</div>
          <div class="barcode" aria-hidden="true"></div>
          © ${new Date().getFullYear()} Music_Z
        </div>
      </aside>

      <div class="main">
        <div class="stage">
          <div class="stage-mid">
            <header class="topbar kit-box">
              <button type="button" class="menu-btn" data-menu aria-label="Меню">☰</button>
              <div class="search-fx" data-search-fx>
                <label class="search-box">
                  ${ICONS.search}
                  <input type="search" placeholder="Поиск трека, артиста…" data-search aria-label="Поиск" />
                  <span class="search-bat-letter" data-search-bat hidden aria-hidden="true"></span>
                  <div class="search-paw" data-search-paw data-frame="0" aria-hidden="true">
                    <img class="search-paw-f search-paw-f--1" src="${assetUrl("mz-search-paw-01.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
                    <img class="search-paw-f search-paw-f--2" src="${assetUrl("mz-search-paw-02.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
                    <img class="search-paw-f search-paw-f--3" src="${assetUrl("mz-search-paw-03.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
                    <img class="search-paw-f search-paw-f--4" src="${assetUrl("mz-search-paw-04.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
                    <img class="search-paw-f search-paw-f--5" src="${assetUrl("mz-search-paw-05.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
                  </div>
                  <div class="search-tail" data-search-tail data-frame="0" aria-hidden="true">
                    <img class="search-tail-f search-tail-f--1" src="${assetUrl("mz-search-tail-01.png", BUILD)}" alt="" width="120" height="60" draggable="false" />
                    <img class="search-tail-f search-tail-f--2" src="${assetUrl("mz-search-tail-02.png", BUILD)}" alt="" width="120" height="60" draggable="false" />
                    <img class="search-tail-f search-tail-f--3" src="${assetUrl("mz-search-tail-03.png", BUILD)}" alt="" width="120" height="60" draggable="false" />
                    <img class="search-tail-f search-tail-f--4" src="${assetUrl("mz-search-tail-04.png", BUILD)}" alt="" width="120" height="60" draggable="false" />
                  </div>
                </label>
                <div class="search-smirk" data-search-smirk aria-hidden="true">
                  <img src="${assetUrl("mz-search-smirk.png", BUILD)}" alt="" width="48" height="48" draggable="false" />
                </div>
              </div>
              <div class="theme-cat-wrap" data-theme-root>
                <button type="button" class="theme-cat-btn" data-theme-toggle aria-label="Сменить тему" title="Котик переключит тему">
                  <span class="theme-cat-stage" aria-hidden="true">
                    <img class="theme-cat-sprite theme-cat-sprite--idle" src="${assetUrl("mz-theme-cat-idle.png", BUILD)}" alt="" width="52" height="52" draggable="false" />
                    <img class="theme-cat-sprite theme-cat-sprite--tap" src="${assetUrl("mz-theme-cat-tap.png", BUILD)}" alt="" width="52" height="52" draggable="false" />
                  </span>
                  <span class="theme-cat-pad">
                    <span class="theme-cat-icon theme-cat-icon--moon" aria-hidden="true">☾</span>
                    <span class="theme-cat-icon theme-cat-icon--sun" aria-hidden="true">☀</span>
                    <span class="theme-cat-pulse" aria-hidden="true"></span>
                  </span>
                </button>
              </div>
            </header>

            <div class="view-stack" data-views>
              <div class="grid view is-on" data-view="home">
                <section class="hero kit-box" data-hero></section>

                <section class="tracks-panel kit-box" id="tracks">
                  <div class="panel-head">Популярные треки <span data-count></span></div>
                  <ul class="track-list" data-list></ul>
                </section>

                <aside class="lyrics-panel kit-box">
                  <div class="panel-head">Текст песни</div>
                  <div class="lyrics-body" data-lyrics></div>
                </aside>
              </div>

              <div class="view view-page" data-view="music" hidden>
                <section class="page-panel kit-box">
                  <div class="panel-head"><span data-music-title>Вся музыка</span> <span data-count-music></span></div>
                  <ul class="track-list" data-list-music></ul>
                </section>
              </div>

              <div class="view view-page" data-view="playlists" hidden>
                <section class="page-panel kit-box" data-playlists></section>
              </div>

              <div class="view view-page" data-view="artists" hidden>
                <section class="page-panel kit-box" data-artists></section>
              </div>

              <div class="view view-page" data-view="genres" hidden>
                <section class="page-panel kit-box" data-genres></section>
              </div>

              <div class="view view-page" data-view="info" hidden>
                <section class="page-panel kit-box info-page">
                  <div class="info-hero">
                    <p class="info-kicker">Music_Z</p>
                    <h2>Личная сцена звука</h2>
                    <p class="info-lead">Тёмный плеер для треков Zoobastiks: без шума ленты, только музыка, текст и атмосфера.</p>
                  </div>

                  <div class="info-grid">
                    <article class="info-card">
                      <h3>Об авторе</h3>
                      <p class="info-name">Zoobastiks <span>(Владислав)</span></p>
                      <p>Автор музыки и этого сайта. Здесь собираются релизы, эксперименты и версии треков в одном жёстком визуальном мире.</p>
                      <a class="btn btn-fill info-tg" href="https://t.me/Zoobastiks" target="_blank" rel="noopener noreferrer">${ICONS.tg} Telegram: @Zoobastiks</a>
                    </article>

                    <article class="info-card">
                      <h3>О сайте</h3>
                      <ul class="info-list">
                        <li>Каталог треков со стилем, промптом и текстом</li>
                        <li>Шаринг конкретного трека по ссылке</li>
                        <li>Очередь, повтор, shuffle и тёмная/светлая тема</li>
                        <li>Кэш треков и арта для быстрых повторных заходов</li>
                      </ul>
                    </article>

                    <article class="info-card info-card--wide">
                      <h3>Лицензия и права</h3>
                      <p>Весь контент Music_Z: музыка, тексты, промпты, графика, персонаж и оформление: защищён. Копирование, выкладывание «как своё», парсинг каталога и коммерческое использование без разрешения автора запрещены.</p>
                      <p>Скачивание треков с сайта допускается только для личного прослушивания. Репосты: с указанием автора <strong>Zoobastiks</strong> и ссылки на Music_Z / Telegram.</p>
                      <p class="info-note">© ${new Date().getFullYear()} Zoobastiks: Music_Z. All rights reserved.</p>
                    </article>

                    <article class="info-card">
                      <h3>Контакты</h3>
                      <p>Новости, дропы и связь: в Telegram-канале.</p>
                      <a class="info-link" href="https://t.me/Zoobastiks" target="_blank" rel="noopener noreferrer">t.me/Zoobastiks</a>
                      <a class="info-link" href="https://zoobastik.me/Music_Z/" target="_blank" rel="noopener noreferrer">zoobastik.me/Music_Z</a>
                    </article>

                    <article class="info-card">
                      <h3>Технологии</h3>
                      <p>Клиентский плеер на Vite. Аудио и изображения кэшируются локально в браузере. Deep-link API: <code>?track=id&amp;play=1</code>.</p>
                      <p>Треки созданы через AI: <a class="info-link" href="https://musichero.ai/ru/app" target="_blank" rel="noopener noreferrer">MusicHero</a> и <a class="info-link" href="https://aisong.io/ai-music-generator" target="_blank" rel="noopener noreferrer">AISong</a>: ссылка у каждого трека в списке.</p>
                    </article>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <aside class="deco-panel kit-box" data-deco></aside>
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
            <span class="now-status" data-now-status hidden>Загрузка трека…</span>
          </div>
        </div>
        <div class="player-ctrl">
          <button type="button" data-shuffle title="Перемешать" aria-pressed="false">${ICONS.shuffle}</button>
          <button type="button" data-prev title="Назад">${ICONS.prev}</button>
          <button type="button" class="play-main play-cat-btn" data-toggle title="Play">
            <span class="play-cat play-cat--lg" data-play-cat data-pose="idle" aria-hidden="true">
              <img class="play-cat-f play-cat-f--1" src="${assetUrl("mz-play-cat-01.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
              <img class="play-cat-f play-cat-f--2" src="${assetUrl("mz-play-cat-02.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
              <img class="play-cat-f play-cat-f--3" src="${assetUrl("mz-play-cat-03.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
              <img class="play-cat-f play-cat-f--4" src="${assetUrl("mz-play-cat-04.png", BUILD)}" alt="" width="40" height="40" draggable="false" />
            </span>
            <span class="play-cat-glyph" data-toggle-glyph>${ICONS.playBig}</span>
          </button>
          <button type="button" data-next title="Вперёд">${ICONS.next}</button>
          <button type="button" data-repeat title="Повтор: выкл" aria-pressed="false">${ICONS.repeat}</button>
        </div>
        <div class="wave-seek">
          <div class="wave-wrap">
            <div class="wave-bars" aria-hidden="true">${waveBars(140)}</div>
            <div class="wave-fill" data-wave-fill style="width:0">
              <div class="wave-bars" aria-hidden="true">${waveBars(140)}</div>
            </div>
            <input class="wave-input" type="range" min="0" max="1000" value="0" data-seek aria-label="Прогресс" />
          </div>
        </div>
        <div class="player-time"><time data-t0>0:00</time><span>/</span><time data-t1>0:00</time></div>
        <div class="player-side">
          ${ICONS.vol}
          <input type="range" min="0" max="100" value="88" data-vol aria-label="Громкость" />
          <button type="button" class="queue-btn" data-queue title="Очередь">${ICONS.queue}</button>
        </div>
      </div>
    </footer>

    <div class="toast" data-toast hidden role="status" aria-live="polite"></div>
    <div class="update-bar" data-update-bar hidden>
      <span>Доступна новая версия Music_Z</span>
      <button type="button" class="btn btn-fill" data-update-reload>Обновить</button>
    </div>

    <div class="modal" data-modal hidden>
      <div class="modal-card">
        <div class="modal-head">
          <strong data-modal-title></strong>
          <button type="button" class="ico-btn" data-modal-close aria-label="Закрыть">✕</button>
        </div>
        <div class="modal-body" data-modal-body></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-line" data-modal-copy>Копировать</button>
          <button type="button" class="btn btn-fill" data-modal-close2>Закрыть</button>
        </div>
      </div>
    </div>
  `;

  applyTheme(getTheme());

  const side = app.querySelector<HTMLElement>("[data-side]")!;
  const backdrop = app.querySelector<HTMLElement>("[data-backdrop]")!;
  const heroEl = app.querySelector<HTMLElement>("[data-hero]")!;
  const listEl = app.querySelector<HTMLElement>("[data-list]")!;
  const listMusicEl = app.querySelector<HTMLElement>("[data-list-music]")!;
  const lyricsEl = app.querySelector<HTMLElement>("[data-lyrics]")!;
  const decoEl = app.querySelector<HTMLElement>("[data-deco]")!;
  const countEl = app.querySelector<HTMLElement>("[data-count]")!;
  const countMusicEl = app.querySelector<HTMLElement>("[data-count-music]")!;
  const musicTitleEl = app.querySelector<HTMLElement>("[data-music-title]")!;
  const playlistsEl = app.querySelector<HTMLElement>("[data-playlists]")!;
  const artistsEl = app.querySelector<HTMLElement>("[data-artists]")!;
  const genresEl = app.querySelector<HTMLElement>("[data-genres]")!;
  const searchEl = app.querySelector<HTMLInputElement>("[data-search]")!;
  const miniWave = app.querySelector<HTMLElement>("[data-mini-wave]")!;
  const nowCover = app.querySelector<HTMLImageElement>("[data-now-cover]")!;
  const nowTitle = app.querySelector<HTMLElement>("[data-now-title]")!;
  const nowArtist = app.querySelector<HTMLElement>("[data-now-artist]")!;
  const nowStatus = app.querySelector<HTMLElement>("[data-now-status]")!;
  const toggleEl = app.querySelector<HTMLButtonElement>("[data-toggle]")!;
  const toggleGlyph = app.querySelector<HTMLElement>("[data-toggle-glyph]")!;
  type PlayCatPose = "idle" | "tap" | "vibe" | "pause";
  let playCatPose: PlayCatPose = "idle";
  let playCatTimer = 0;
  let playCatLockUntil = 0;

  function applyPlayCatPose(pose: PlayCatPose): void {
    playCatPose = pose;
    app.querySelectorAll<HTMLElement>("[data-play-cat]").forEach((c) => {
      c.dataset.pose = pose;
    });
  }

  /** Smooth tap → vibe / pause → idle */
  function animatePlayCat(willPlay: boolean): void {
    window.clearTimeout(playCatTimer);
    playCatLockUntil = Date.now() + 1100;
    applyPlayCatPose("tap");
    playCatTimer = window.setTimeout(() => {
      if (willPlay) {
        applyPlayCatPose(loadingId ? "tap" : "vibe");
        playCatLockUntil = Date.now() + 180;
        return;
      }
      applyPlayCatPose("pause");
      playCatTimer = window.setTimeout(() => {
        playCatLockUntil = 0;
        applyPlayCatPose("idle");
      }, 520);
    }, 420);
  }

  function syncPlayCatPose(): void {
    if (Date.now() < playCatLockUntil) return;
    window.clearTimeout(playCatTimer);
    if (loadingId) {
      applyPlayCatPose("tap");
      return;
    }
    applyPlayCatPose(playing ? "vibe" : "idle");
  }
  const shuffleBtn = app.querySelector<HTMLButtonElement>("[data-shuffle]")!;
  const repeatBtn = app.querySelector<HTMLButtonElement>("[data-repeat]")!;
  const queueBtn = app.querySelector<HTMLButtonElement>("[data-queue]")!;
  const seekEl = app.querySelector<HTMLInputElement>("[data-seek]")!;
  const waveFill = app.querySelector<HTMLElement>("[data-wave-fill]")!;
  const volEl = app.querySelector<HTMLInputElement>("[data-vol]")!;
  const t0 = app.querySelector<HTMLElement>("[data-t0]")!;
  const t1 = app.querySelector<HTMLElement>("[data-t1]")!;
  const modal = app.querySelector<HTMLElement>("[data-modal]")!;
  const modalTitle = app.querySelector<HTMLElement>("[data-modal-title]")!;
  const modalBody = app.querySelector<HTMLElement>("[data-modal-body]")!;
  const modalCopy = app.querySelector<HTMLButtonElement>("[data-modal-copy]")!;
  const toastEl = app.querySelector<HTMLElement>("[data-toast]")!;
  const updateBar = app.querySelector<HTMLElement>("[data-update-bar]")!;
  let toastTimer = 0;

  function showToast(message: string): void {
    toastEl.textContent = message;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 4200);
  }

  startAutoUpdate(() => {
    updateBar.hidden = false;
  });
  updateBar.querySelector<HTMLButtonElement>("[data-update-reload]")?.addEventListener("click", () => {
    // Bypass possible stale SW HTML by hard navigation with cache bust
    const u = new URL(location.href);
    u.searchParams.set("_r", String(Date.now()));
    location.replace(u.href);
  });

  let seeking = false;
  let modalText = "";
  let modalMode: "text" | "queue" = "text";
  type ViewId = "home" | "music" | "playlists" | "artists" | "genres" | "info";
  let viewId: ViewId = "home";
  let browseList: Track[] | null = null;
  let browseTitle: string | null = null;

  function closeSide(): void {
    side.classList.remove("is-open");
    backdrop.classList.remove("is-open");
  }

  function setView(id: ViewId): void {
    viewId = id;
    app.querySelectorAll<HTMLElement>("[data-view]").forEach((el) => {
      const on = el.dataset.view === id;
      el.classList.toggle("is-on", on);
      el.hidden = !on;
    });
    app.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.nav === id);
    });
    if (id === "home") {
      browseList = null;
      browseTitle = null;
      clearTrackInUrl();
    }
    if (id === "playlists") paintPlaylists();
    if (id === "artists") paintArtists();
    if (id === "genres") paintGenres();
    if (id === "music" || id === "home") paintList();
    closeSide();
  }

  function playList(list: Track[], start?: Track): void {
    if (!list.length) return;
    const t = start ?? list[0];
    void playTrack(t, { queue: list });
  }

  function openCollection(list: Track[], title: string): void {
    browseList = list;
    browseTitle = title;
    playList(list);
    setView("music");
  }

  function paintPlaylists(): void {
    const v1 = tracks.filter((t) => !t.id.endsWith("-v2"));
    const v2 = tracks.filter((t) => t.id.endsWith("-v2"));
    const tagMap = new Map<string, Track[]>();
    for (const t of tracks) {
      for (const tag of t.tags.slice(0, 3)) {
        const arr = tagMap.get(tag) ?? [];
        if (!arr.some((x) => x.id === t.id)) arr.push(t);
        tagMap.set(tag, arr);
      }
    }
    const tagPlaylists = [...tagMap.entries()]
      .filter(([, list]) => list.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8);

    const cards: { id: string; title: string; sub: string; list: Track[]; cover: string }[] = [
      {
        id: "all",
        title: "Все треки",
        sub: `${tracks.length} треков · полный каталог`,
        list: tracks,
        cover: tracks[0]?.cover ?? "covers/zhizn.svg",
      },
      {
        id: "v1",
        title: "Оригиналы",
        sub: `${v1.length} треков · без v2`,
        list: v1,
        cover: v1[0]?.cover ?? "covers/zhizn.svg",
      },
      {
        id: "v2",
        title: "Версии v2",
        sub: `${v2.length} треков · альтернативы`,
        list: v2,
        cover: v2[0]?.cover ?? "covers/zhizn.svg",
      },
      ...tagPlaylists.map(([tag, list]) => ({
        id: `tag-${tag}`,
        title: tag,
        sub: `${list.length} треков · жанр / настроение`,
        list,
        cover: list[0]?.cover ?? "covers/zhizn.svg",
      })),
    ];

    playlistsEl.innerHTML = `
      <div class="panel-head">Плейлисты <span>${cards.length}</span></div>
      <div class="browse-grid">
        ${cards
          .map(
            (c) => `
          <button type="button" class="browse-card" data-plist="${escapeHtml(c.id)}">
            <img src="${assetUrl(c.cover)}" alt="" draggable="false" />
            <div>
              <strong>${escapeHtml(c.title)}</strong>
              <em>${escapeHtml(c.sub)}</em>
            </div>
            <span class="browse-play">${ICONS.play}</span>
          </button>`,
          )
          .join("")}
      </div>
    `;

    playlistsEl.querySelectorAll<HTMLButtonElement>("[data-plist]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.plist;
        const card = cards.find((c) => c.id === id);
        if (!card) return;
        openCollection(card.list, card.title);
      });
    });
  }

  function paintArtists(): void {
    const map = new Map<string, Track[]>();
    for (const t of tracks) {
      const arr = map.get(t.artist) ?? [];
      arr.push(t);
      map.set(t.artist, arr);
    }
    const artists = [...map.entries()].sort((a, b) => b[1].length - a[1].length);

    artistsEl.innerHTML = `
      <div class="panel-head">Артисты <span>${artists.length}</span></div>
      <div class="browse-grid browse-grid--artists">
        ${artists
          .map(
            ([name, list]) => `
          <button type="button" class="browse-card browse-card--artist" data-artist="${escapeHtml(name)}">
            <img src="${assetUrl(list[0].cover)}" alt="" draggable="false" />
            <div>
              <strong>${escapeHtml(name)}</strong>
              <em>${list.length} ${list.length === 1 ? "трек" : list.length < 5 ? "трека" : "треков"}</em>
            </div>
            <span class="browse-play">${ICONS.play}</span>
          </button>`,
          )
          .join("")}
      </div>
    `;

    artistsEl.querySelectorAll<HTMLButtonElement>("[data-artist]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.artist;
        const list = name ? map.get(name) : undefined;
        if (!list?.length || !name) return;
        openCollection(list, name);
      });
    });
  }

  function paintGenres(): void {
    const map = new Map<string, Track[]>();
    for (const t of tracks) {
      for (const tag of t.tags) {
        const arr = map.get(tag) ?? [];
        if (!arr.some((x) => x.id === t.id)) arr.push(t);
        map.set(tag, arr);
      }
    }
    const genres = [...map.entries()].sort((a, b) => b[1].length - a[1].length);

    genresEl.innerHTML = `
      <div class="panel-head">Жанры и теги <span>${genres.length}</span></div>
      <div class="genre-cloud">
        ${genres
          .map(
            ([tag, list]) => `
          <button type="button" class="genre-chip" data-genre="${escapeHtml(tag)}">
            <strong>${escapeHtml(tag)}</strong>
            <span>${list.length}</span>
          </button>`,
          )
          .join("")}
      </div>
      <p class="page-hint">Нажми жанр: соберём очередь и откроем музыку.</p>
    `;

    genresEl.querySelectorAll<HTMLButtonElement>("[data-genre]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.dataset.genre;
        const list = tag ? map.get(tag) : undefined;
        if (!list?.length || !tag) return;
        openCollection(list, tag);
      });
    });
  }

  function paintModes(shuffle: boolean, repeat: RepeatMode): void {
    shuffleBtn.classList.toggle("is-active", shuffle);
    shuffleBtn.setAttribute("aria-pressed", String(shuffle));
    shuffleBtn.title = shuffle ? "Перемешивание: вкл" : "Перемешивание: выкл";

    repeatBtn.classList.toggle("is-active", repeat !== "off");
    repeatBtn.setAttribute("aria-pressed", String(repeat !== "off"));
    if (repeat === "one") {
      repeatBtn.innerHTML = ICONS.repeatOne;
      repeatBtn.title = "Повтор: один трек";
    } else if (repeat === "all") {
      repeatBtn.innerHTML = ICONS.repeat;
      repeatBtn.title = "Повтор: весь список";
    } else {
      repeatBtn.innerHTML = ICONS.repeat;
      repeatBtn.title = "Повтор: выкл";
    }
  }

  function openModal(title: string, text: string): void {
    modalMode = "text";
    modal.querySelector(".modal-card")?.classList.remove("modal-card--queue");
    modalTitle.textContent = title;
    modalBody.className = "modal-body";
    modalBody.textContent = text;
    modalText = text;
    modalCopy.hidden = false;
    modal.hidden = false;
  }

  function setQueueBtnActive(on: boolean): void {
    app.querySelector<HTMLButtonElement>("[data-queue]")?.classList.toggle("is-active", on);
  }

  function openQueueModal(): void {
    modalMode = "queue";
    const q = player.getQueue();
    const card = modal.querySelector(".modal-card");
    card?.classList.add("modal-card--queue");
    modalTitle.innerHTML = `Очередь <span class="modal-count">${q.length}</span>`;
    modalCopy.hidden = true;
    setQueueBtnActive(true);
    if (!q.length) {
      modalBody.className = "modal-body modal-queue";
      modalBody.innerHTML = `<p class="queue-empty">Очередь пуста: выбери трек.</p>`;
      modal.hidden = false;
      return;
    }
    modalBody.className = "modal-body modal-queue";
    modalBody.innerHTML = q
      .map((t, i) => {
        const on = t.id === (activeId ?? focusId);
        const live = on && playing;
        const loading = t.id === loadingId;
        return `<button type="button" class="queue-item${on ? " is-on" : ""}${live ? " is-live" : ""}${loading ? " is-loading" : ""}" data-qid="${escapeHtml(t.id)}"><span class="queue-num">${String(i + 1).padStart(2, "0")}</span><img class="queue-cover" src="${assetUrl(t.cover)}" alt="" width="40" height="40" loading="lazy" draggable="false" /><span class="queue-meta"><span class="queue-title">${escapeHtml(t.title)}</span><span class="queue-artist">${loading ? "Загрузка…" : escapeHtml(t.artist)}</span></span><span class="queue-side">${loading ? `<span class="queue-spin" aria-hidden="true">${ICONS.spinnerSm}</span>` : live ? `<span class="queue-eq" aria-hidden="true"><i></i><i></i><i></i></span>` : ""}<span class="queue-dur">${formatDuration(t.durationSec)}</span></span></button>`;
      })
      .join("");
    modalBody.querySelectorAll<HTMLButtonElement>("[data-qid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-qid");
        const track = tracks.find((t) => t.id === id);
        if (!track) return;
        void playTrack(track, { queue: player.getQueue() });
        closeModal();
      });
    });
    modal.hidden = false;
  }

  function closeModal(): void {
    modal.hidden = true;
    modalMode = "text";
    modal.querySelector(".modal-card")?.classList.remove("modal-card--queue");
    setQueueBtnActive(false);
  }

  app.querySelectorAll("[data-modal-close], [data-modal-close2]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  app.querySelector<HTMLButtonElement>("[data-modal-copy]")!.addEventListener("click", async () => {
    if (modalMode !== "text") return;
    try {
      await navigator.clipboard.writeText(modalText);
      const prev = modalCopy.textContent;
      modalCopy.textContent = "Скопировано";
      setTimeout(() => {
        modalCopy.textContent = prev;
      }, 1200);
    } catch {
      /* ignore */
    }
  });

  function paintPlayButton(): void {
    if (loadingId) {
      toggleEl.classList.add("is-loading");
      toggleEl.title = "Загрузка…";
      toggleEl.setAttribute("aria-busy", "true");
      toggleGlyph.innerHTML = ICONS.spinner;
      syncPlayCatPose();
      return;
    }
    toggleEl.classList.remove("is-loading");
    toggleEl.removeAttribute("aria-busy");
    toggleGlyph.innerHTML = playing ? ICONS.pauseBig : ICONS.playBig;
    toggleEl.title = playing ? "Пауза" : "Play";
    syncPlayCatPose();
  }

  function paintLoadingUi(): void {
    const on = Boolean(loadingId);
    app.classList.toggle("is-loading-track", on);
    nowStatus.hidden = !on;
    nowArtist.hidden = on;
    paintPlayButton();
    paintList();
    paintHero();
    if (modalMode === "queue" && !modal.hidden) openQueueModal();
  }

  let loadingWatch = 0;

  async function runDownload(track: Track, btn: HTMLElement): Promise<void> {
    if (btn.classList.contains("is-dl") || btn.classList.contains("is-dl-done")) return;
    const label = btn.querySelector(".dl-label");
    btn.classList.add("is-dl");
    btn.setAttribute("aria-busy", "true");
    if (label) label.textContent = "Качаю…";

    const finishOk = () => {
      btn.classList.remove("is-dl");
      btn.classList.add("is-dl-done");
      if (label) label.textContent = "Готово";
      window.setTimeout(() => {
        btn.classList.remove("is-dl-done");
        btn.removeAttribute("aria-busy");
        if (label) label.textContent = "Скачать";
      }, 1400);
    };

    const finishFail = () => {
      btn.classList.remove("is-dl", "is-dl-done");
      btn.removeAttribute("aria-busy");
      if (label) label.textContent = "Скачать";
      showToast("Не удалось скачать трек");
    };

    try {
      // Let pull frame show before network work
      await new Promise((r) => window.setTimeout(r, 220));
      const res = await fetch(assetUrl(track.src), { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${track.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 4000);
      finishOk();
    } catch {
      finishFail();
    }
  }

  /** Show loading UI immediately (before AudioContext / fetch). */
  function primeTrackLoading(track: Track): void {
    loadingId = track.id;
    focusId = track.id;
    nowTitle.textContent = track.title;
    nowCover.src = assetUrl(track.cover);
    nowCover.hidden = false;
    paintLoadingUi();
    window.clearTimeout(loadingWatch);
    loadingWatch = window.setTimeout(() => {
      if (!loadingId) return;
      loadingId = null;
      paintLoadingUi();
      showToast("Нажми Play: загрузка заняла слишком долго");
    }, 14000);
  }

  async function playTrack(
    track: Track,
    opts?: { toggle?: boolean; queue?: Track[] },
  ): Promise<void> {
    if (opts?.toggle && activeId === track.id && playing && !loadingId) {
      player.pause();
      return;
    }
    primeTrackLoading(track);
    player.setQueue(opts?.queue ?? queueScope());
    try {
      await armBeat();
      if (opts?.toggle) player.toggle(track);
      else await player.play(track);
    } catch {
      window.clearTimeout(loadingWatch);
      loadingId = null;
      paintLoadingUi();
      showToast("Не удалось начать воспроизведение");
    }
  }

  const beat = new BeatMotion(app);
  let charCycle: CharacterCycle | null = null;
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
      paintPlayButton();
      miniWave.classList.toggle("is-paused", !isPlaying);
      app.classList.toggle("is-playing", isPlaying);
      if (track && viewId !== "home") syncTrackInUrl(track.id);
      paintHero();
      paintList();
      paintLyrics();
      paintDeco();
      charCycle?.setPlaying(isPlaying);
      if (isPlaying) {
        void beat.connect(player.media).then(() => beat.start());
      } else {
        beat.stop();
      }
    },
    onLoading: (track, loading) => {
      loadingId = loading && track ? track.id : null;
      if (!loading) window.clearTimeout(loadingWatch);
      if (track && loading) {
        focusId = track.id;
        nowTitle.textContent = track.title;
        nowCover.src = assetUrl(track.cover);
        nowCover.hidden = false;
      }
      paintLoadingUi();
    },
    onError: (_track, message) => {
      window.clearTimeout(loadingWatch);
      showToast(message);
      loadingId = null;
      paintLoadingUi();
    },
    onTime: (cur, dur) => {
      if (!seeking) {
        const ratio = dur > 0 ? cur / dur : 0;
        seekEl.value = String(Math.round(ratio * 1000));
        waveFill.style.width = `${ratio * 100}%`;
      }
      t0.textContent = formatDuration(Math.floor(cur));
      t1.textContent = formatDuration(Math.floor(dur || 0));
    },
    onMode: paintModes,
  });
  player.setQueue(tracks);
  player.setVolume(Number(volEl.value) / 100);
  paintModes(false, "off");

  async function armBeat(): Promise<void> {
    await player.initAudio();
    const ctx = player.audioContext;
    const analyser = player.analyserNode;
    if (ctx && analyser) {
      await beat.attach(ctx, analyser, () => player.isAudioLive());
      return;
    }
    await beat.connect(player.media);
  }

  const listScope = (): Track[] => browseList ?? tracks;
  const filtered = (): Track[] => listScope().filter((t) => matchesQuery(t, query));
  const queueScope = (): Track[] => {
    const items = filtered();
    return items.length ? items : listScope();
  };

  const currentTrack = (): Track | undefined =>
    tracks.find((t) => t.id === (activeId ?? focusId)) ?? tracks[0];

  function paintHero(): void {
    const track = currentTrack();
    if (!track) {
      heroEl.innerHTML = "";
      return;
    }
    const on = activeId === track.id && playing;
    const loading = loadingId === track.id;
    const heroLabel = loading ? "Загрузка…" : on ? "Пауза" : "Воспроизвести";
    const heroPose =
      Date.now() < playCatLockUntil ? playCatPose : loading ? "tap" : on ? "vibe" : "idle";
    heroEl.innerHTML = `
      <div class="hero-art">
        <img class="brand-hero" src="${assetUrl("hero-banner.png")}" alt="Music_Z" />
      </div>
      <div class="hero-foot">
        <div class="hero-actions">
          <button type="button" class="btn btn-line btn-play-cat${loading ? " is-loading" : ""}" data-hero-play ${loading ? 'aria-busy="true"' : ""}>
            <span class="play-cat play-cat--md" data-play-cat data-pose="${heroPose}" aria-hidden="true">
              <img class="play-cat-f play-cat-f--1" src="${assetUrl("mz-play-cat-01.png", BUILD)}" alt="" width="28" height="28" draggable="false" />
              <img class="play-cat-f play-cat-f--2" src="${assetUrl("mz-play-cat-02.png", BUILD)}" alt="" width="28" height="28" draggable="false" />
              <img class="play-cat-f play-cat-f--3" src="${assetUrl("mz-play-cat-03.png", BUILD)}" alt="" width="28" height="28" draggable="false" />
              <img class="play-cat-f play-cat-f--4" src="${assetUrl("mz-play-cat-04.png", BUILD)}" alt="" width="28" height="28" draggable="false" />
            </span>
            <span class="btn-play-label">${heroLabel}</span>
          </button>
          <button type="button" class="btn btn-line btn-dl" data-hero-dl title="Скачать трек">
            <span class="dl-fx" aria-hidden="true">
              <img class="dl-sprite dl-sprite--idle" src="${assetUrl("mz-dl-idle.png", BUILD)}" alt="" width="22" height="22" draggable="false" />
              <img class="dl-sprite dl-sprite--pull" src="${assetUrl("mz-dl-pull.png", BUILD)}" alt="" width="22" height="22" draggable="false" />
              <img class="dl-sprite dl-sprite--done" src="${assetUrl("mz-dl-done.png", BUILD)}" alt="" width="22" height="22" draggable="false" />
            </span>
            <span class="dl-label">Скачать</span>
          </button>
          <div class="share-wrap">
            <button type="button" class="btn btn-line btn-icon" data-hero-share title="Поделиться" aria-haspopup="menu" aria-expanded="false">${ICONS.more}</button>
            <div class="share-menu" data-share-menu hidden role="menu">
              <div class="share-menu-head">Поделиться</div>
              <button type="button" role="menuitem" class="share-item" data-share-copy>
                <span class="share-ico">${ICONS.copy}</span>
                <span class="share-item-text"><strong>Скопировать ссылку</strong><small>Карточка трека</small></span>
              </button>
              <div class="share-menu-label">Мессенджеры</div>
              <a role="menuitem" class="share-item" data-share-tg href="${telegramShareUrl(track.id, track.title, track.artist)}" target="_blank" rel="noopener noreferrer">
                <span class="share-ico">${ICONS.tg}</span>
                <span class="share-item-text"><strong>Telegram</strong><small>Карточка с превью</small></span>
              </a>
              <a role="menuitem" class="share-item share-item--accent" data-share-tg-audio href="${telegramAudioShareUrl(track.src, track.title, track.artist)}" target="_blank" rel="noopener noreferrer">
                <span class="share-ico">${ICONS.play}</span>
                <span class="share-item-text"><strong>Telegram: аудио</strong><small>Слушать прямо в чате</small></span>
              </a>
              <a role="menuitem" class="share-item" data-share-vk href="${vkShareUrl(track.id, track.title, track.artist)}" target="_blank" rel="noopener noreferrer">
                <span class="share-ico">${ICONS.share}</span>
                <span class="share-item-text"><strong>ВКонтакте</strong><small>Пост со ссылкой</small></span>
              </a>
              <a role="menuitem" class="share-item" data-share-wa href="${whatsappShareUrl(track.id, track.title, track.artist)}" target="_blank" rel="noopener noreferrer">
                <span class="share-ico">${ICONS.share}</span>
                <span class="share-item-text"><strong>WhatsApp</strong><small>Сообщение со ссылкой</small></span>
              </a>
              <div class="share-menu-sep"></div>
              <button type="button" role="menuitem" class="share-item" data-share-embed>
                <span class="share-ico">${ICONS.code}</span>
                <span class="share-item-text"><strong>Код для сайта</strong><small>iframe / встройка</small></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    heroEl.querySelector<HTMLButtonElement>("[data-hero-play]")!.onclick = () => {
      const willPlay = !(activeId === track.id && playing && !loadingId);
      animatePlayCat(willPlay);
      void playTrack(track, { toggle: true });
    };

    heroEl.querySelector<HTMLButtonElement>("[data-hero-dl]")!.onclick = () => {
      void runDownload(track, heroEl.querySelector<HTMLButtonElement>("[data-hero-dl]")!);
    };

    const shareBtn = heroEl.querySelector<HTMLButtonElement>("[data-hero-share]")!;
    const shareMenu = heroEl.querySelector<HTMLElement>("[data-share-menu]")!;

    const placeShareMenu = () => {
      const r = shareBtn.getBoundingClientRect();
      const gap = 6;
      const menuW = Math.max(shareMenu.offsetWidth || 208, 208);
      const menuH = shareMenu.offsetHeight || 220;
      let left = Math.min(r.right - menuW, window.innerWidth - menuW - 8);
      left = Math.max(8, left);
      // Prefer below the button; flip above if not enough room
      const spaceBelow = window.innerHeight - r.bottom - gap;
      const spaceAbove = r.top - gap;
      if (spaceBelow >= Math.min(menuH, 160) || spaceBelow >= spaceAbove) {
        shareMenu.style.top = `${Math.min(r.bottom + gap, window.innerHeight - 8)}px`;
        shareMenu.style.bottom = "auto";
        shareMenu.style.maxHeight = `${Math.max(120, spaceBelow - 8)}px`;
      } else {
        shareMenu.style.bottom = `${window.innerHeight - r.top + gap}px`;
        shareMenu.style.top = "auto";
        shareMenu.style.maxHeight = `${Math.max(120, spaceAbove - 8)}px`;
      }
      shareMenu.style.left = `${left}px`;
      shareMenu.style.right = "auto";
    };

    const closeShareMenu = () => {
      shareMenu.hidden = true;
      shareBtn.setAttribute("aria-expanded", "false");
    };

    shareBtn.onclick = (e) => {
      e.stopPropagation();
      if (!shareMenu.hidden) {
        closeShareMenu();
        return;
      }
      shareMenu.hidden = false;
      shareBtn.setAttribute("aria-expanded", "true");
      placeShareMenu();
    };

    heroEl.querySelector<HTMLButtonElement>("[data-share-copy]")!.onclick = async (e) => {
      e.stopPropagation();
      const url = trackShareUrl(track.id, true);
      const payload = `${trackLabel(track.artist, track.title)}\n${url}`;
      try {
        await navigator.clipboard.writeText(payload);
        const btn = e.currentTarget as HTMLButtonElement;
        const prev = btn.innerHTML;
        btn.innerHTML = `${ICONS.copy} Скопировано`;
        setTimeout(() => {
          btn.innerHTML = prev;
        }, 1200);
      } catch {
        openModal(`Ссылка: ${track.title}`, payload);
      }
      closeShareMenu();
    };

    heroEl
      .querySelectorAll<HTMLAnchorElement>("[data-share-tg], [data-share-tg-audio], [data-share-vk], [data-share-wa]")
      .forEach((a) => {
        a.addEventListener("click", (e) => e.stopPropagation());
      });

    heroEl.querySelector<HTMLButtonElement>("[data-share-embed]")!.onclick = (e) => {
      e.stopPropagation();
      closeShareMenu();
      openModal(`Встроить: ${track.title}`, trackEmbedSnippet(track.id, track.title));
    };
  }

  function paintLyrics(): void {
    const track = currentTrack();
    if (!track) {
      lyricsEl.innerHTML = `<p class="empty">Выбери трек</p>`;
      return;
    }
    const lines = defaultLyrics(track);
    const stanzas: string[][] = [[]];
    for (const line of lines) {
      if (!line.trim()) {
        if (stanzas[stanzas.length - 1].length) stanzas.push([]);
        continue;
      }
      stanzas[stanzas.length - 1].push(line);
    }
    while (stanzas.length && !stanzas[stanzas.length - 1].length) stanzas.pop();

    lyricsEl.innerHTML = stanzas
      .map((stanza, i) => {
        const body = stanza.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
        const sep = i < stanzas.length - 1 ? `<div class="sep" aria-hidden="true"></div>` : "";
        return `<div class="stanza">${body}</div>${sep}`;
      })
      .join("");
  }

  function paintDeco(): void {
    const track = currentTrack();
    let stage = decoEl.querySelector<HTMLElement>("[data-char-stage]");
    if (!stage) {
      const marks = Array.from({ length: 24 }, () => "<span>Zoobastiks</span>").join("");
      decoEl.innerHTML = `
        <div class="char-stage" data-char-stage></div>
        <div class="deco-mark" aria-hidden="true"><div class="deco-mark-grid">${marks}</div></div>
        <div class="deco-vignette"></div>
        <div class="deco-pulse" aria-hidden="true"></div>
        <div class="deco-tag" data-deco-tag></div>
      `;
      stage = decoEl.querySelector<HTMLElement>("[data-char-stage]")!;
      charCycle?.destroy();
      charCycle = new CharacterCycle(stage);
      charCycle.setPlaying(playing);
    }
    const tag = decoEl.querySelector<HTMLElement>("[data-deco-tag]");
    if (tag) tag.textContent = track?.title ?? "Music_Z";
  }

  function trackRowHtml(t: Track, i: number): string {
    const on = t.id === (activeId ?? focusId);
    const loading = t.id === loadingId;
    const num = String(i + 1).padStart(2, "0");
    const src = trackSource(t);
    const styleBtn = t.style
      ? `<button type="button" class="chip" data-style="${t.id}" title="Стиль">Стиль</button>`
      : "";
    const promptBtn = t.prompt
      ? `<button type="button" class="chip" data-prompt="${t.id}" title="Промпт">Промпт</button>`
      : "";
    const genBtn = `<a class="chip chip-src" href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" data-src title="Сгенерировано на ${escapeHtml(src.name)}">·</a>`;
    const stateIcon = loading
      ? ICONS.spinnerSm
      : on && playing
        ? ICONS.pause
        : ICONS.play;
    return `
      <li>
        <div class="track-item${on ? " is-on" : ""}${loading ? " is-loading" : ""}" data-id="${t.id}">
          <button type="button" class="track-main" data-play-id="${t.id}" ${loading ? 'aria-busy="true"' : ""}>
            <span class="num">${num}</span>
            <img src="${assetUrl(t.cover)}" alt="" width="48" height="48" loading="lazy" />
            <div class="track-meta">
              <h4>${escapeHtml(t.title)}</h4>
              <p>${loading ? "Загрузка…" : escapeHtml(t.artist)}</p>
            </div>
            <span class="track-dur">${formatDuration(t.durationSec)}</span>
            <span class="ico-btn${loading ? " is-loading" : ""}" aria-hidden="true">${stateIcon}</span>
          </button>
          <div class="track-actions">
            ${styleBtn}
            ${promptBtn}
            ${genBtn}
            <button type="button" class="ico-btn ico-dl" data-dl="${escapeHtml(t.id)}" title="Скачать">
              <span class="dl-fx dl-fx--sm" aria-hidden="true">
                <img class="dl-sprite dl-sprite--idle" src="${assetUrl("mz-dl-idle.png", BUILD)}" alt="" width="14" height="14" draggable="false" />
                <img class="dl-sprite dl-sprite--pull" src="${assetUrl("mz-dl-pull.png", BUILD)}" alt="" width="14" height="14" draggable="false" />
                <img class="dl-sprite dl-sprite--done" src="${assetUrl("mz-dl-done.png", BUILD)}" alt="" width="14" height="14" draggable="false" />
              </span>
            </button>
          </div>
        </div>
      </li>
    `;
  }

  function listCountLabel(items: Track[], total: number): string {
    const dur = formatTotalDuration(sumDuration(items));
    return `${items.length} / ${total}: ${dur}`;
  }

  function paintList(): void {
    const homeItems = tracks.filter((t) => matchesQuery(t, query));
    const musicItems = filtered();
    const scope = listScope();
    const musicTotal = browseList ? scope.length : tracks.length;

    countEl.textContent = listCountLabel(homeItems, tracks.length);
    countEl.title = "Треков в списке · общая длительность";
    if (musicTitleEl) {
      musicTitleEl.textContent = browseTitle ?? "Вся музыка";
    }
    countMusicEl.textContent = listCountLabel(musicItems, musicTotal);
    countMusicEl.title = "Треков в списке · общая длительность";

    const homeHtml = homeItems.length
      ? homeItems.map((t, i) => trackRowHtml(t, i)).join("")
      : `<li class="empty">Ничего не найдено</li>`;
    const musicHtml = musicItems.length
      ? musicItems.map((t, i) => trackRowHtml(t, i)).join("")
      : `<li class="empty">Ничего не найдено</li>`;
    listEl.innerHTML = homeHtml;
    listMusicEl.innerHTML = musicHtml;
  }

  function onTrackListClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest("[data-src]")) return;

    const dlBtn = target.closest<HTMLButtonElement>("[data-dl]");
    if (dlBtn?.dataset.dl) {
      e.preventDefault();
      e.stopPropagation();
      const track = tracks.find((t) => t.id === dlBtn.dataset.dl);
      if (track) void runDownload(track, dlBtn);
      return;
    }

    const styleBtn = target.closest<HTMLButtonElement>("[data-style]");
    if (styleBtn?.dataset.style) {
      e.preventDefault();
      const track = tracks.find((t) => t.id === styleBtn.dataset.style);
      if (track?.style) openModal(`Стиль: ${track.title}`, track.style);
      return;
    }

    const promptBtn = target.closest<HTMLButtonElement>("[data-prompt]");
    if (promptBtn?.dataset.prompt) {
      e.preventDefault();
      const track = tracks.find((t) => t.id === promptBtn.dataset.prompt);
      if (track?.prompt) openModal(`Промпт: ${track.title}`, track.prompt);
      return;
    }

    const playBtn = target.closest<HTMLButtonElement>("[data-play-id]");
    const id = playBtn?.dataset.playId ?? target.closest<HTMLElement>(".track-item")?.dataset.id;
    if (!id) return;
    const track = tracks.find((t) => t.id === id);
    if (!track) return;
    const willPlay = !(activeId === track.id && playing && !loadingId);
    animatePlayCat(willPlay);
    void playTrack(track, { toggle: true });
  }

  listEl.addEventListener("click", onTrackListClick);
  listMusicEl.addEventListener("click", onTrackListClick);

  const searchFx = app.querySelector<HTMLElement>("[data-search-fx]")!;
  const searchBox = searchFx.querySelector<HTMLElement>(".search-box")!;
  const searchPaw = app.querySelector<HTMLElement>("[data-search-paw]")!;
  const searchTail = app.querySelector<HTMLElement>("[data-search-tail]")!;
  const searchBat = app.querySelector<HTMLElement>("[data-search-bat]")!;
  let searchPawTimer = 0;
  let searchTailTimer = 0;
  let searchSmirkTimer = 0;
  let searchDeleteStreak = 0;
  let measureCtx: CanvasRenderingContext2D | null = null;

  function caretXInSearch(): number {
    const input = searchEl;
    const box = searchBox;
    const style = getComputedStyle(input);
    if (!measureCtx) {
      measureCtx = document.createElement("canvas").getContext("2d");
    }
    if (!measureCtx) return 12;
    measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const caret = input.selectionStart ?? input.value.length;
    const text = input.value.slice(0, caret);
    const textW = measureCtx.measureText(text).width;
    const inputLeft = input.offsetLeft;
    const padL = parseFloat(style.paddingLeft) || 0;
    const x = inputLeft + padL + textW;
    const max = box.clientWidth - 16;
    return Math.max(inputLeft + 4, Math.min(max, x));
  }

  function runSearchPawBat(letter: string): void {
    window.clearTimeout(searchPawTimer);
    searchFx.classList.remove("is-sweeping", "is-smirking");
    searchFx.classList.add("is-batting");
    const x = caretXInSearch();
    searchBox.style.setProperty("--paw-x", `${x}px`);
    searchBox.style.setProperty("--bat-x", `${x}px`);
    if (letter && letter !== " ") {
      searchBat.hidden = false;
      searchBat.textContent = letter;
      searchBox.style.setProperty("--bat-rot", `${Math.random() * 16 - 8}deg`);
      searchBat.classList.remove("is-pop");
      void searchBat.offsetWidth;
      searchBat.classList.add("is-pop");
    }
    let frame = 1;
    const tick = (): void => {
      searchPaw.dataset.frame = String(frame);
      frame += 1;
      if (frame <= 5) {
        searchPawTimer = window.setTimeout(tick, 72);
      } else {
        searchPaw.dataset.frame = "0";
        searchFx.classList.remove("is-batting");
        searchBat.hidden = true;
        searchBat.classList.remove("is-pop");
      }
    };
    tick();
  }

  function runSearchTailSweep(): void {
    window.clearTimeout(searchTailTimer);
    searchFx.classList.remove("is-batting");
    searchPaw.dataset.frame = "0";
    searchFx.classList.add("is-sweeping");
    let frame = 1;
    const tick = (): void => {
      searchTail.dataset.frame = String(frame);
      frame += 1;
      if (frame <= 4) {
        searchTailTimer = window.setTimeout(tick, 95);
      } else {
        searchTail.dataset.frame = "0";
        searchFx.classList.remove("is-sweeping");
      }
    };
    tick();
  }

  function peekSearchSmirk(): void {
    window.clearTimeout(searchSmirkTimer);
    searchFx.classList.add("is-smirking");
    searchSmirkTimer = window.setTimeout(() => {
      searchFx.classList.remove("is-smirking");
    }, 1400);
  }

  function runSearchCatFx(prev: string, next: string): void {
    if (next.length > prev.length) {
      searchDeleteStreak = 0;
      searchFx.classList.remove("is-smirking");
      const added = next.slice(prev.length);
      const letter = added.length === 1 ? added : next.slice(-1);
      runSearchPawBat(letter);
      return;
    }
    if (next.length < prev.length) {
      searchDeleteStreak += 1;
      runSearchTailSweep();
      if (next.length === 0 || searchDeleteStreak >= 3) {
        peekSearchSmirk();
        if (next.length === 0) searchDeleteStreak = 0;
      }
    }
  }

  searchEl.addEventListener("input", () => {
    const next = searchEl.value;
    const prev = query;
    query = next;
    paintList();
    runSearchCatFx(prev, next);
  });

  app.querySelector<HTMLButtonElement>("[data-theme-toggle]")!.addEventListener("click", () => {
    const btn = app.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
    if (btn.classList.contains("is-tapping")) return;
    btn.classList.add("is-tapping");
    window.setTimeout(() => toggleTheme(), 160);
    window.setTimeout(() => btn.classList.remove("is-tapping"), 520);
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
    const track = player.current ?? queueScope()[0] ?? tracks[0];
    if (!track) return;
    const willPlay = !(activeId === track.id && playing && !loadingId);
    animatePlayCat(willPlay);
    void playTrack(track, { toggle: true });
  });
  app.querySelector<HTMLButtonElement>("[data-prev]")!.addEventListener("click", () => {
    void armBeat().then(() => player.prev());
  });
  app.querySelector<HTMLButtonElement>("[data-next]")!.addEventListener("click", () => {
    void armBeat().then(() => player.next(true));
  });
  shuffleBtn.addEventListener("click", () => {
    player.setQueue(queueScope());
    player.toggleShuffle();
  });
  repeatBtn.addEventListener("click", () => {
    player.toggleRepeat();
  });
  queueBtn.addEventListener("click", () => {
    if (modalMode === "queue" && !modal.hidden) {
      closeModal();
      return;
    }
    openQueueModal();
  });

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

  app.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.nav as ViewId | undefined;
      if (!id) return;
      if (id === "home" || id === "music") {
        browseList = null;
        browseTitle = null;
      }
      setView(id);
    });
  });

  document.addEventListener("click", (e) => {
    const menu = heroEl.querySelector<HTMLElement>("[data-share-menu]");
    const btn = heroEl.querySelector<HTMLButtonElement>("[data-hero-share]");
    if (!menu || menu.hidden) return;
    const wrap = heroEl.querySelector(".share-wrap");
    if (e.target instanceof Node && wrap?.contains(e.target)) return;
    menu.hidden = true;
    btn?.setAttribute("aria-expanded", "false");
  });
  window.addEventListener(
    "resize",
    () => {
      const menu = heroEl.querySelector<HTMLElement>("[data-share-menu]");
      if (menu && !menu.hidden) menu.hidden = true;
    },
    { passive: true },
  );
  app.querySelector(".stage-mid")?.addEventListener(
    "scroll",
    () => {
      const menu = heroEl.querySelector<HTMLElement>("[data-share-menu]");
      if (menu && !menu.hidden) menu.hidden = true;
    },
    { passive: true },
  );

  const deep = readDeepLink();
  if (deep) {
    const deepTrack = tracks.find((t) => t.id === deep.id);
    if (deepTrack) {
      focusId = deepTrack.id;
      activeId = deepTrack.id;
      player.setQueue(tracks);
      nowTitle.textContent = deepTrack.title;
      nowArtist.textContent = deepTrack.artist;
      nowCover.src = assetUrl(deepTrack.cover);
      nowCover.hidden = false;
      // Consume play flag; Telegram redirect usually loses user gesture
      syncTrackInUrl(deepTrack.id, false);

      if (deep.play) {
        const canAuto =
          typeof navigator !== "undefined" &&
          "userActivation" in navigator &&
          Boolean(
            (navigator as Navigator & { userActivation?: { isActive?: boolean } }).userActivation
              ?.isActive,
          );
        if (canAuto) {
          void playTrack(deepTrack, { queue: tracks });
        } else {
          showToast("Нажми Play, чтобы слушать");
        }
      }
    }
  }

  paintHero();
  paintList();
  paintLyrics();
  paintDeco();

  if (deep?.id) {
    requestAnimationFrame(() => {
      app.querySelector<HTMLElement>(`.track-item[data-id="${CSS.escape(deep.id)}"]`)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  }
}

loadTracks()
  .then(render)
  .catch(async (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Ошибка загрузки";
    app.innerHTML = `<div class="boot-fail" data-boot-fail>
      <p class="empty">${escapeHtml(msg)}</p>
      <button type="button" class="btn btn-fill" data-boot-repair>Сбросить кэш и обновить</button>
    </div>`;
    app.querySelector("[data-boot-repair]")?.addEventListener("click", async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(
            keys.filter((k) => k.startsWith("music-z-")).map((k) => caches.delete(k)),
          );
        }
      } catch {
        /* ignore */
      }
      location.reload();
    });
  });
