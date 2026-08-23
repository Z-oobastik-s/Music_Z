import { assetUrl } from "./tracks";

/** Expression frames for the side character (same pose, different face). */
export const CHAR_FRAMES = [
  "characters/01-open.png",
  "characters/02-blink.png",
  "characters/03-soft.png",
  "characters/04-closed.png",
  "characters/05-smirk.png",
] as const;

/** How long each expression stays visible (ms). Blink/closed are short beats. */
const HOLD_MS = [4200, 220, 3800, 720, 4000];

/** Fade-in only (old frame stays solid underneath — no dip to black). */
const FADE_MS = 520;
const FADE_BLINK_MS = 280;

/**
 * Soft expression morph: new frame fades in on top of the old one.
 * Never fades both out at once — no black flash.
 */
export class CharacterCycle {
  private readonly a: HTMLImageElement;
  private readonly b: HTMLImageElement;
  private readonly urls: string[];
  private idx = 0;
  private frontIsA = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;
  private switching = false;

  constructor(stage: HTMLElement, frames: readonly string[] = CHAR_FRAMES) {
    this.urls = frames.map((f) => assetUrl(f));
    stage.querySelectorAll("img.char-art").forEach((el) => el.remove());

    this.a = document.createElement("img");
    this.b = document.createElement("img");
    for (const img of [this.a, this.b]) {
      img.className = "char-art";
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      stage.appendChild(img);
    }

    this.a.src = this.urls[0];
    this.b.src = this.urls[1] ?? this.urls[0];
    this.a.classList.add("is-front");
    this.b.classList.add("is-back");

    for (const u of this.urls) {
      const pre = new Image();
      pre.src = u;
    }

    this.arm();
  }

  setPlaying(on: boolean): void {
    if (this.playing === on) return;
    this.playing = on;
    this.clearTimer();
    if (on) this.arm();
    else void this.goTo(0, false);
  }

  destroy(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private arm(): void {
    this.clearTimer();
    if (!this.playing) return;
    const hold = HOLD_MS[this.idx] ?? 3500;
    const jitter = hold * (0.85 + Math.random() * 0.35);
    this.timer = setTimeout(() => void this.next(), jitter);
  }

  private nextIndex(from: number): number {
    const isHoldFace = from === 0 || from === 2 || from === 4;
    if (isHoldFace && Math.random() < 0.55) return 1;
    if (from === 1) {
      if (Math.random() < 0.35) return 3;
      const faces = [0, 2, 4];
      return faces[Math.floor(Math.random() * faces.length)] ?? 0;
    }
    if (from === 3) {
      const faces = [0, 2, 4];
      return faces[Math.floor(Math.random() * faces.length)] ?? 0;
    }
    const pool = [0, 2, 4].filter((i) => i !== from);
    return pool[Math.floor(Math.random() * pool.length)] ?? 0;
  }

  private async next(): Promise<void> {
    if (!this.playing || this.switching) {
      this.arm();
      return;
    }
    const to = this.nextIndex(this.idx);
    await this.goTo(to, true);
    this.arm();
  }

  private waitDecode(img: HTMLImageElement): Promise<void> {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        resolve();
      };
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    });
  }

  private async goTo(to: number, animate: boolean): Promise<void> {
    if (to === this.idx && animate) return;
    this.switching = true;

    const incoming = this.frontIsA ? this.b : this.a;
    const outgoing = this.frontIsA ? this.a : this.b;

    incoming.src = this.urls[to];
    await this.waitDecode(incoming);

    const finish = () => {
      outgoing.classList.remove("is-front");
      outgoing.classList.add("is-back");
      incoming.classList.remove("is-incoming", "is-back");
      incoming.classList.add("is-front");
      incoming.style.transition = "";
      incoming.style.opacity = "";
      this.frontIsA = !this.frontIsA;
      this.idx = to;
      this.switching = false;
    };

    if (!animate) {
      finish();
      return;
    }

    const ms = to === 1 || this.idx === 1 || to === 3 || this.idx === 3 ? FADE_BLINK_MS : FADE_MS;

    // Keep outgoing fully visible; only fade the new frame in on top.
    outgoing.classList.add("is-front");
    outgoing.classList.remove("is-back");
    incoming.classList.remove("is-front");
    incoming.classList.add("is-back", "is-incoming");
    incoming.style.opacity = "0";
    incoming.style.transition = "none";

    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    incoming.style.transition = `opacity ${ms}ms ease-out`;
    incoming.style.opacity = "1";

    await new Promise<void>((r) => window.setTimeout(r, ms + 20));
    finish();
  }
}
