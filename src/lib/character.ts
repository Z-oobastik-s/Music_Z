import { assetUrl } from "./tracks";

/** Expression frames for the side character (same pose, different face). */
export const CHAR_FRAMES = [
  "characters/01-open.png",
  "characters/02-blink.png",
  "characters/03-soft.png",
  "characters/04-closed.png",
  "characters/05-smirk.png",
] as const;

/** Occasional body/hair morphs (used sparingly — framing differs a bit). */
const MOTION_FRAMES = ["characters/06-wind.png", "characters/07-breath.png"] as const;

/** How long each expression stays visible (ms). Blink/closed are short beats. */
const HOLD_MS = [4200, 220, 3800, 720, 4000];

const FADE_MS = 520;
const FADE_BLINK_MS = 280;

/**
 * Soft expression morph + live body layers (hair / chest / arm).
 * New frame fades in on top — no dip to black.
 */
export class CharacterCycle {
  private readonly stage: HTMLElement;
  private readonly body: HTMLElement;
  private readonly a: HTMLImageElement;
  private readonly b: HTMLImageElement;
  private readonly fxHair: HTMLImageElement;
  private readonly fxChest: HTMLImageElement;
  private readonly fxArm: HTMLImageElement;
  private readonly urls: string[];
  private readonly motionUrls: string[];
  private idx = 0;
  private frontIsA = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;
  private switching = false;
  private onMotionFrame = false;

  constructor(stage: HTMLElement, frames: readonly string[] = CHAR_FRAMES) {
    this.stage = stage;
    this.urls = frames.map((f) => assetUrl(f));
    this.motionUrls = MOTION_FRAMES.map((f) => assetUrl(f));

    stage.replaceChildren();
    stage.classList.add("has-puppet");

    const puppet = document.createElement("div");
    puppet.className = "char-puppet";

    this.body = document.createElement("div");
    this.body.className = "char-body";

    this.a = this.makeImg("char-art");
    this.b = this.makeImg("char-art");
    this.body.append(this.a, this.b);

    this.fxHair = this.makeImg("char-fx char-fx--hair");
    this.fxChest = this.makeImg("char-fx char-fx--chest");
    this.fxArm = this.makeImg("char-fx char-fx--arm");

    puppet.append(this.body, this.fxHair, this.fxChest, this.fxArm);
    stage.appendChild(puppet);

    this.a.src = this.urls[0];
    this.b.src = this.urls[1] ?? this.urls[0];
    this.a.classList.add("is-front");
    this.b.classList.add("is-back");
    this.syncFx(this.urls[0]);

    for (const u of [...this.urls, ...this.motionUrls]) {
      const pre = new Image();
      pre.src = u;
    }

    this.arm();
  }

  setPlaying(on: boolean): void {
    this.stage.classList.toggle("is-animating", on);
    if (this.playing === on) return;
    this.playing = on;
    this.clearTimer();
    if (on) this.arm();
    else {
      this.onMotionFrame = false;
      void this.goTo(0, false);
    }
  }

  destroy(): void {
    this.clearTimer();
    this.stage.classList.remove("is-animating", "has-puppet");
  }

  private makeImg(className: string): HTMLImageElement {
    const img = document.createElement("img");
    img.className = className;
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    return img;
  }

  private syncFx(src: string): void {
    this.fxHair.src = src;
    this.fxChest.src = src;
    this.fxArm.src = src;
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
    const hold = this.onMotionFrame ? 1600 : (HOLD_MS[this.idx] ?? 3500);
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

    // Rare wind / breath morph from a calm face
    if (
      !this.onMotionFrame &&
      (this.idx === 0 || this.idx === 2 || this.idx === 4) &&
      Math.random() < 0.18
    ) {
      const motion = this.motionUrls[Math.floor(Math.random() * this.motionUrls.length)];
      await this.goToSrc(motion, true, true);
      this.arm();
      return;
    }

    if (this.onMotionFrame) {
      await this.goTo(this.idx, true);
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
    await this.goToSrc(this.urls[to], animate, false, to);
  }

  private async goToSrc(
    src: string,
    animate: boolean,
    motion: boolean,
    faceIdx = this.idx,
  ): Promise<void> {
    this.switching = true;

    const incoming = this.frontIsA ? this.b : this.a;
    const outgoing = this.frontIsA ? this.a : this.b;

    incoming.src = src;
    await this.waitDecode(incoming);

    const finish = () => {
      outgoing.classList.remove("is-front");
      outgoing.classList.add("is-back");
      incoming.classList.remove("is-incoming", "is-back");
      incoming.classList.add("is-front");
      incoming.style.transition = "";
      incoming.style.opacity = "";
      this.frontIsA = !this.frontIsA;
      if (!motion) this.idx = faceIdx;
      this.onMotionFrame = motion;
      this.syncFx(src);
      this.switching = false;
    };

    if (!animate) {
      finish();
      return;
    }

    const ms =
      !motion && (faceIdx === 1 || this.idx === 1 || faceIdx === 3 || this.idx === 3)
        ? FADE_BLINK_MS
        : motion
          ? 640
          : FADE_MS;

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
