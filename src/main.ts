import "./styles.css";
import { BeatMotion } from "./lib/beat";
import { AudioPlayer, type RepeatMode } from "./lib/player";
import {
  readDeepLink,
  syncTrackInUrl,
  trackEmbedSnippet,
  trackShareUrl,
} from "./lib/share";
import { applyTheme, getTheme, setTheme, toggleTheme } from "./lib/theme";
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

/** Запрет drag / save картинок и случайного выделения */
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
    const t = e.target;
    if (t instanceof HTMLImageElement || (t instanceof Element && t.closest("img, .deco-panel, .hero-art"))) {
      e.preventDefault();
    }
  },
  true,
);

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
  style: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h10M4 17h7"/></svg>`,
  prompt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h9l3 3v13a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M9 13h6M9 17h4"/></svg>`,
  shuffle: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>`,
  prev: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
  next: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 18h2V6h-2zM6 18l8.5-6L6 6z"/></svg>`,
  repeat: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  repeatOne: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="8" font-family="IBM Plex Sans, sans-serif" font-weight="700">1</text></svg>`,
  playBig: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pauseBig: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`,
  queue: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
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
          <li><button type="button" data-nav="downloads"><span class="nav-ico">${ICONS.down}</span> Загрузки</button></li>
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
              <label class="search-box">
                ${ICONS.search}
                <input type="search" placeholder="Поиск трека, артиста…" data-search aria-label="Поиск" />
              </label>
              <div class="theme-switch" data-theme-root>
                <span class="theme-label" data-theme-pick="dark">
                  <span class="theme-ico" aria-hidden="true">☾</span>
                  Тёмная
                </span>
                <button type="button" class="theme-toggle" data-theme-toggle aria-label="Сменить тему">
                  <span class="theme-knob"></span>
                </button>
                <span class="theme-label" data-theme-pick="light">
                  <span class="theme-ico" aria-hidden="true">☀</span>
                  Светлая
                </span>
              </div>
            </header>

            <div class="grid">
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
          </div>
        </div>
        <div class="player-ctrl">
          <button type="button" data-shuffle title="Перемешать" aria-pressed="false">${ICONS.shuffle}</button>
          <button type="button" data-prev title="Назад">${ICONS.prev}</button>
          <button type="button" class="play-main" data-toggle title="Play">${ICONS.playBig}</button>
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
  const lyricsEl = app.querySelector<HTMLElement>("[data-lyrics]")!;
  const decoEl = app.querySelector<HTMLElement>("[data-deco]")!;
  const countEl = app.querySelector<HTMLElement>("[data-count]")!;
  const searchEl = app.querySelector<HTMLInputElement>("[data-search]")!;
  const miniWave = app.querySelector<HTMLElement>("[data-mini-wave]")!;
  const nowCover = app.querySelector<HTMLImageElement>("[data-now-cover]")!;
  const nowTitle = app.querySelector<HTMLElement>("[data-now-title]")!;
  const nowArtist = app.querySelector<HTMLElement>("[data-now-artist]")!;
  const toggleEl = app.querySelector<HTMLButtonElement>("[data-toggle]")!;
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

  let seeking = false;
  let modalText = "";
  let modalMode: "text" | "queue" = "text";

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
    modalTitle.textContent = title;
    modalBody.className = "modal-body";
    modalBody.textContent = text;
    modalText = text;
    modalCopy.hidden = false;
    modal.hidden = false;
  }

  function openQueueModal(): void {
    modalMode = "queue";
    const q = player.getQueue();
    modalTitle.textContent = "Очередь";
    modalCopy.hidden = true;
    if (!q.length) {
      modalBody.className = "modal-body";
      modalBody.textContent = "Очередь пуста — выбери трек.";
      modal.hidden = false;
      return;
    }
    modalBody.className = "modal-body modal-queue";
    modalBody.innerHTML = q
      .map((t, i) => {
        const on = t.id === (activeId ?? focusId);
        return `<button type="button" class="queue-item${on ? " is-on" : ""}" data-qid="${escapeHtml(t.id)}">
          <span class="queue-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="queue-meta">
            <strong>${escapeHtml(t.title)}</strong>
            <em>${escapeHtml(t.artist)}</em>
          </span>
          <span class="queue-dur">${formatDuration(t.durationSec)}</span>
        </button>`;
      })
      .join("");
    modalBody.querySelectorAll<HTMLButtonElement>("[data-qid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-qid");
        const track = tracks.find((t) => t.id === id);
        if (!track) return;
        player.setQueue(filtered().length ? filtered() : tracks);
        void player.play(track);
        closeModal();
      });
    });
    modal.hidden = false;
  }

  function closeModal(): void {
    modal.hidden = true;
    modalMode = "text";
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

  const beat = new BeatMotion(app);
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
      toggleEl.innerHTML = isPlaying ? ICONS.pauseBig : ICONS.playBig;
      miniWave.classList.toggle("is-paused", !isPlaying);
      app.classList.toggle("is-playing", isPlaying);
      if (track) syncTrackInUrl(track.id);
      paintHero();
      paintList();
      paintLyrics();
      paintDeco();
      if (isPlaying) {
        void beat.connect(player.media).then(() => beat.start());
      } else {
        beat.stop();
      }
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
    await beat.connect(player.media);
    beat.start();
  }

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
    const canNativeShare = typeof navigator.share === "function";
    heroEl.innerHTML = `
      <div class="hero-art">
        <img class="brand-hero" src="${assetUrl("hero-banner.png")}" alt="Music_Z" />
      </div>
      <div class="hero-foot">
        <div class="hero-actions">
          <button type="button" class="btn btn-fill" data-hero-play>${ICONS.play} ${on ? "Пауза" : "Воспроизвести"}</button>
          <a class="btn btn-line" href="${assetUrl(track.src)}" download="${escapeHtml(track.title)}.mp3">${ICONS.dl} Скачать</a>
          <div class="share-wrap">
            <button type="button" class="btn btn-line btn-icon" data-hero-share title="Поделиться" aria-haspopup="menu" aria-expanded="false">${ICONS.more}</button>
            <div class="share-menu" data-share-menu hidden role="menu">
              <button type="button" role="menuitem" data-share-copy>${ICONS.copy} Копировать ссылку</button>
              ${canNativeShare ? `<button type="button" role="menuitem" data-share-native>${ICONS.share} Поделиться…</button>` : ""}
              <button type="button" role="menuitem" data-share-embed>${ICONS.code} Код для сайта</button>
            </div>
          </div>
        </div>
      </div>
    `;
    heroEl.querySelector<HTMLButtonElement>("[data-hero-play]")!.onclick = () => {
      player.setQueue(filtered().length ? filtered() : tracks);
      void armBeat().then(() => player.toggle(track));
    };

    const shareBtn = heroEl.querySelector<HTMLButtonElement>("[data-hero-share]")!;
    const shareMenu = heroEl.querySelector<HTMLElement>("[data-share-menu]")!;

    const closeShareMenu = () => {
      shareMenu.hidden = true;
      shareBtn.setAttribute("aria-expanded", "false");
    };

    shareBtn.onclick = (e) => {
      e.stopPropagation();
      const open = shareMenu.hidden;
      shareMenu.hidden = !open;
      shareBtn.setAttribute("aria-expanded", String(open));
    };

    heroEl.querySelector<HTMLButtonElement>("[data-share-copy]")!.onclick = async (e) => {
      e.stopPropagation();
      const url = trackShareUrl(track.id, true);
      try {
        await navigator.clipboard.writeText(url);
        const btn = e.currentTarget as HTMLButtonElement;
        const prev = btn.innerHTML;
        btn.innerHTML = `${ICONS.copy} Скопировано`;
        setTimeout(() => {
          btn.innerHTML = prev;
        }, 1200);
      } catch {
        openModal(`Ссылка · ${track.title}`, url);
      }
    };

    heroEl.querySelector<HTMLButtonElement>("[data-share-native]")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const url = trackShareUrl(track.id, true);
      try {
        await navigator.share({
          title: `${track.title} — Music_Z`,
          text: `${track.artist} — ${track.title}`,
          url,
        });
        closeShareMenu();
      } catch {
        /* user cancel / unsupported */
      }
    });

    heroEl.querySelector<HTMLButtonElement>("[data-share-embed]")!.onclick = (e) => {
      e.stopPropagation();
      closeShareMenu();
      openModal(`Встроить · ${track.title}`, trackEmbedSnippet(track.id, track.title));
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
    decoEl.innerHTML = `
      <div class="char-stage">
        <img class="char-art" src="${assetUrl("character.png")}" alt="" draggable="false" />
      </div>
      <div class="deco-vignette"></div>
      <div class="deco-pulse" aria-hidden="true"></div>
      <div class="deco-tag">${escapeHtml(track?.title ?? "Music_Z")}</div>
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
        const styleBtn = t.style
          ? `<button type="button" class="chip" data-style="${t.id}" title="Стиль">Стиль</button>`
          : "";
        const promptBtn = t.prompt
          ? `<button type="button" class="chip" data-prompt="${t.id}" title="Промпт">Промпт</button>`
          : "";
        return `
          <li>
            <div class="track-item${on ? " is-on" : ""}" data-id="${t.id}">
              <button type="button" class="track-main" data-play-id="${t.id}">
                <span class="num">${num}</span>
                <img src="${assetUrl(t.cover)}" alt="" width="48" height="48" loading="lazy" />
                <div class="track-meta">
                  <h4>${escapeHtml(t.title)}</h4>
                  <p>${escapeHtml(t.artist)}</p>
                </div>
                <span class="track-dur">${formatDuration(t.durationSec)}</span>
                <span class="ico-btn" aria-hidden="true">${on && playing ? ICONS.pause : ICONS.play}</span>
              </button>
              <div class="track-actions">
                ${styleBtn}
                ${promptBtn}
                <a class="ico-btn" href="${assetUrl(t.src)}" download="${escapeHtml(t.title)}.mp3" data-dl title="Скачать">${ICONS.dl}</a>
              </div>
            </div>
          </li>
        `;
      })
      .join("");
  }

  listEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-dl]")) return;

    const styleBtn = target.closest<HTMLButtonElement>("[data-style]");
    if (styleBtn?.dataset.style) {
      e.preventDefault();
      const track = tracks.find((t) => t.id === styleBtn.dataset.style);
      if (track?.style) openModal(`Стиль · ${track.title}`, track.style);
      return;
    }

    const promptBtn = target.closest<HTMLButtonElement>("[data-prompt]");
    if (promptBtn?.dataset.prompt) {
      e.preventDefault();
      const track = tracks.find((t) => t.id === promptBtn.dataset.prompt);
      if (track?.prompt) openModal(`Промпт · ${track.title}`, track.prompt);
      return;
    }

    const playBtn = target.closest<HTMLButtonElement>("[data-play-id]");
    const id = playBtn?.dataset.playId ?? target.closest<HTMLElement>(".track-item")?.dataset.id;
    if (!id) return;
    const track = tracks.find((t) => t.id === id);
    if (!track) return;
    player.setQueue(filtered().length ? filtered() : tracks);
    void armBeat().then(() => player.toggle(track));
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    paintList();
  });

  app.querySelectorAll<HTMLElement>("[data-theme-pick]").forEach((el) => {
    el.addEventListener("click", () => setTheme(el.dataset.themePick as "dark" | "light"));
  });
  app.querySelector<HTMLButtonElement>("[data-theme-toggle]")!.addEventListener("click", () => {
    toggleTheme();
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
    void armBeat().then(() => player.toggle(track));
  });
  app.querySelector<HTMLButtonElement>("[data-prev]")!.addEventListener("click", () => {
    void armBeat().then(() => player.prev());
  });
  app.querySelector<HTMLButtonElement>("[data-next]")!.addEventListener("click", () => {
    void armBeat().then(() => player.next(true));
  });
  shuffleBtn.addEventListener("click", () => {
    player.setQueue(filtered().length ? filtered() : tracks);
    player.toggleShuffle();
  });
  repeatBtn.addEventListener("click", () => {
    player.toggleRepeat();
  });
  queueBtn.addEventListener("click", () => {
    player.setQueue(filtered().length ? filtered() : tracks);
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

  app.querySelector<HTMLButtonElement>('[data-nav="music"]')!.addEventListener("click", () => {
    document.getElementById("tracks")?.scrollIntoView({ behavior: "smooth" });
    side.classList.remove("is-open");
    backdrop.classList.remove("is-open");
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

  const deep = readDeepLink();
  if (deep) {
    const deepTrack = tracks.find((t) => t.id === deep.id);
    if (deepTrack) {
      focusId = deepTrack.id;
      player.setQueue(tracks);
      if (deep.play) {
        void armBeat()
          .then(() => player.play(deepTrack))
          .catch(() => {
            syncTrackInUrl(deepTrack.id);
          });
      } else {
        syncTrackInUrl(deepTrack.id);
      }
    }
  }

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
