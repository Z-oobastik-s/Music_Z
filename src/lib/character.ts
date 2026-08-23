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

/**
 * Crossfades stacked character images to feel alive.
 * When music plays, cycles expressions; occasional blinks feel natural.
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

    // Preload the rest
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
    else this.goTo(0, false);
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
    // After open/soft/smirk → often a quick blink, else pick another expression
    const isHoldFace = from === 0 || from === 2 || from === 4;
    if (isHoldFace && Math.random() < 0.55) return 1; // blink
    if (from === 1) {
      // blink resolves to closed sometimes, else back to a face
      if (Math.random() < 0.35) return 3;
      const faces = [0, 2, 4].filter((i) => i !== from);
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

  private goTo(to: number, animate: boolean): Promise<void> {
    if (to === this.idx && animate) return Promise.resolve();
    this.switching = true;
    const back = this.frontIsA ? this.b : this.a;
    const front = this.frontIsA ? this.a : this.b;
    back.src = this.urls[to];

    const finish = () => {
      front.classList.remove("is-front");
      front.classList.add("is-back");
      back.classList.remove("is-back");
      back.classList.add("is-front");
      this.frontIsA = !this.frontIsA;
      this.idx = to;
      this.switching = false;
    };

    if (!animate) {
      finish();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Force reflow then crossfade
      back.style.opacity = "0";
      requestAnimationFrame(() => {
        back.classList.add("is-fading-in");
        front.classList.add("is-fading-out");
        window.setTimeout(() => {
          back.classList.remove("is-fading-in");
          front.classList.remove("is-fading-out");
          back.style.opacity = "";
          finish();
          resolve();
        }, 700);
      });
    });
  }
}
