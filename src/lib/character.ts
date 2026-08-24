import { assetUrl } from "./tracks";

/** Expression frames (same base pose, different face). */
export const CHAR_FRAMES = [
  "characters/01-open.png",
  "characters/02-blink.png",
  "characters/03-soft.png",
  "characters/04-closed.png",
  "characters/05-smirk.png",
] as const;

/** Hair wind loop — ping-pong for smoother motion. */
const HAIR_FRAMES = [
  "characters/hair-00.png",
  "characters/hair-01.png",
  "characters/hair-02.png",
  "characters/hair-03.png",
  "characters/hair-02.png",
  "characters/hair-01.png",
] as const;

/** Occasional head / body life. */
const LIFE_FRAMES = [
  "characters/head-turn.png",
  "characters/body-sway.png",
  "characters/06-wind.png",
  "characters/07-breath.png",
] as const;

const HOLD_MS = [4200, 220, 3800, 720, 4000];
const FADE_MS = 520;
const FADE_BLINK_MS = 280;
const HAIR_FADE_MS = 380;
const HAIR_STEP_MS = 420;

function makeImg(className: string): HTMLImageElement {
  const img = document.createElement("img");
  img.className = className;
  img.alt = "";
  img.draggable = false;
  img.decoding = "async";
  return img;
}

function waitDecode(img: HTMLImageElement): Promise<void> {
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

/** Dual-buffer fade-in crossfade (no black dip). */
async function fadeSwap(
  a: HTMLImageElement,
  b: HTMLImageElement,
  frontIsA: boolean,
  src: string,
  ms: number,
): Promise<boolean> {
  const incoming = frontIsA ? b : a;
  const outgoing = frontIsA ? a : b;
  incoming.src = src;
  await waitDecode(incoming);

  outgoing.classList.add("is-front");
  outgoing.classList.remove("is-back");
  incoming.classList.remove("is-front");
  incoming.classList.add("is-back", "is-incoming");
  incoming.style.opacity = "0";
  incoming.style.transition = "none";

  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  incoming.style.transition = `opacity ${ms}ms ease-out`;
  incoming.style.opacity = "1";
  await new Promise<void>((r) => window.setTimeout(r, ms + 16));

  outgoing.classList.remove("is-front");
  outgoing.classList.add("is-back");
  incoming.classList.remove("is-incoming", "is-back");
  incoming.classList.add("is-front");
  incoming.style.transition = "";
  incoming.style.opacity = "";
  return !frontIsA;
}

/**
 * Soft expression morph + multi-frame hair loop + head/body life.
 */
export class CharacterCycle {
  private readonly stage: HTMLElement;
  private readonly faceA: HTMLImageElement;
  private readonly faceB: HTMLImageElement;
  private readonly hairA: HTMLImageElement;
  private readonly hairB: HTMLImageElement;
  private readonly fxChest: HTMLImageElement;
  private readonly fxArm: HTMLImageElement;
  private readonly faceUrls: string[];
  private readonly hairUrls: string[];
  private readonly lifeUrls: string[];
  private faceIdx = 0;
  private hairIdx = 0;
  private faceFrontA = true;
  private hairFrontA = true;
  private faceTimer: ReturnType<typeof setTimeout> | null = null;
  private hairTimer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;
  private faceBusy = false;
  private hairBusy = false;
  private onLifeFrame = false;

  constructor(stage: HTMLElement) {
    this.stage = stage;
    this.faceUrls = CHAR_FRAMES.map((f) => assetUrl(f));
    this.hairUrls = HAIR_FRAMES.map((f) => assetUrl(f));
    this.lifeUrls = LIFE_FRAMES.map((f) => assetUrl(f));

    stage.replaceChildren();
    stage.classList.add("has-puppet");

    const puppet = document.createElement("div");
    puppet.className = "char-puppet";

    const body = document.createElement("div");
    body.className = "char-body";
    this.faceA = makeImg("char-art");
    this.faceB = makeImg("char-art");
    body.append(this.faceA, this.faceB);

    const hair = document.createElement("div");
    hair.className = "char-hair";
    this.hairA = makeImg("char-hair-frame");
    this.hairB = makeImg("char-hair-frame");
    hair.append(this.hairA, this.hairB);

    this.fxChest = makeImg("char-fx char-fx--chest");
    this.fxArm = makeImg("char-fx char-fx--arm");

    puppet.append(body, hair, this.fxChest, this.fxArm);
    stage.appendChild(puppet);

    this.faceA.src = this.faceUrls[0];
    this.faceB.src = this.faceUrls[1] ?? this.faceUrls[0];
    this.faceA.classList.add("is-front");
    this.faceB.classList.add("is-back");

    this.hairA.src = this.hairUrls[0];
    this.hairB.src = this.hairUrls[1] ?? this.hairUrls[0];
    this.hairA.classList.add("is-front");
    this.hairB.classList.add("is-back");

    this.syncBodyFx(this.faceUrls[0]);

    for (const u of [...this.faceUrls, ...this.hairUrls, ...this.lifeUrls]) {
      const pre = new Image();
      pre.src = u;
    }

    this.armFace();
    this.armHair();
  }

  setPlaying(on: boolean): void {
    this.stage.classList.toggle("is-animating", on);
    if (this.playing === on) return;
    this.playing = on;
    this.clearFaceTimer();
    this.clearHairTimer();
    if (on) {
      this.armFace();
      this.armHair();
    } else {
      this.onLifeFrame = false;
      void this.setFace(0, false);
      void this.setHair(0, false);
    }
  }

  destroy(): void {
    this.clearFaceTimer();
    this.clearHairTimer();
    this.stage.classList.remove("is-animating", "has-puppet");
  }

  private syncBodyFx(src: string): void {
    this.fxChest.src = src;
    this.fxArm.src = src;
  }

  private clearFaceTimer(): void {
    if (this.faceTimer != null) {
      clearTimeout(this.faceTimer);
      this.faceTimer = null;
    }
  }

  private clearHairTimer(): void {
    if (this.hairTimer != null) {
      clearTimeout(this.hairTimer);
      this.hairTimer = null;
    }
  }

  private armFace(): void {
    this.clearFaceTimer();
    if (!this.playing) return;
    const hold = this.onLifeFrame ? 1500 : (HOLD_MS[this.faceIdx] ?? 3500);
    const jitter = hold * (0.85 + Math.random() * 0.35);
    this.faceTimer = setTimeout(() => void this.nextFace(), jitter);
  }

  private armHair(): void {
    this.clearHairTimer();
    if (!this.playing) return;
    // Faster hair steps when energy/kick high — read CSS vars from root
    const energy = Number.parseFloat(
      getComputedStyle(this.stage.closest("#app") ?? this.stage).getPropertyValue("--energy") || "0",
    );
    const kick = Number.parseFloat(
      getComputedStyle(this.stage.closest("#app") ?? this.stage).getPropertyValue("--kick") || "0",
    );
    const step = Math.max(260, HAIR_STEP_MS - energy * 120 - kick * 80);
    this.hairTimer = setTimeout(() => void this.nextHair(), step);
  }

  private nextFaceIndex(from: number): number {
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

  private async nextFace(): Promise<void> {
    if (!this.playing || this.faceBusy) {
      this.armFace();
      return;
    }

    if (
      !this.onLifeFrame &&
      (this.faceIdx === 0 || this.faceIdx === 2 || this.faceIdx === 4) &&
      Math.random() < 0.28
    ) {
      const life = this.lifeUrls[Math.floor(Math.random() * this.lifeUrls.length)];
      await this.setFaceSrc(life, true, true);
      this.armFace();
      return;
    }

    if (this.onLifeFrame) {
      await this.setFace(this.faceIdx, true);
      this.armFace();
      return;
    }

    await this.setFace(this.nextFaceIndex(this.faceIdx), true);
    this.armFace();
  }

  private async nextHair(): Promise<void> {
    if (!this.playing || this.hairBusy) {
      this.armHair();
      return;
    }
    const next = (this.hairIdx + 1) % this.hairUrls.length;
    await this.setHair(next, true);
    this.armHair();
  }

  private async setFace(to: number, animate: boolean): Promise<void> {
    await this.setFaceSrc(this.faceUrls[to], animate, false, to);
  }

  private async setFaceSrc(
    src: string,
    animate: boolean,
    life: boolean,
    faceIdx = this.faceIdx,
  ): Promise<void> {
    this.faceBusy = true;
    try {
      if (!animate) {
        const front = this.faceFrontA ? this.faceA : this.faceB;
        const back = this.faceFrontA ? this.faceB : this.faceA;
        front.src = src;
        front.classList.add("is-front");
        front.classList.remove("is-back");
        back.classList.add("is-back");
        back.classList.remove("is-front");
        if (!life) this.faceIdx = faceIdx;
        this.onLifeFrame = life;
        this.syncBodyFx(src);
        return;
      }
      const ms =
        !life && (faceIdx === 1 || this.faceIdx === 1 || faceIdx === 3 || this.faceIdx === 3)
          ? FADE_BLINK_MS
          : life
            ? 700
            : FADE_MS;
      this.faceFrontA = await fadeSwap(this.faceA, this.faceB, this.faceFrontA, src, ms);
      if (!life) this.faceIdx = faceIdx;
      this.onLifeFrame = life;
      this.syncBodyFx(src);
    } finally {
      this.faceBusy = false;
    }
  }

  private async setHair(to: number, animate: boolean): Promise<void> {
    this.hairBusy = true;
    try {
      const src = this.hairUrls[to];
      if (!animate) {
        const front = this.hairFrontA ? this.hairA : this.hairB;
        const back = this.hairFrontA ? this.hairB : this.hairA;
        front.src = src;
        front.classList.add("is-front");
        front.classList.remove("is-back");
        back.classList.add("is-back");
        back.classList.remove("is-front");
        this.hairIdx = to;
        return;
      }
      this.hairFrontA = await fadeSwap(this.hairA, this.hairB, this.hairFrontA, src, HAIR_FADE_MS);
      this.hairIdx = to;
    } finally {
      this.hairBusy = false;
    }
  }
}
