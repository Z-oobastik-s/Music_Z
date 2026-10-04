/**
 * Sidebar samurai — key poses + bob from shared TempoDrive.
 */

import { tempoDrive, type TempoTick } from "./tempo-drive";

export class SideSamurai {
  private frames: HTMLImageElement[] = [];
  private stage: HTMLElement | null = null;
  private index = 0;
  private dir = 1;
  private playing = false;
  private lastBeat = -1;
  private unsub: (() => void) | null = null;

  constructor() {
    this.unsub = tempoDrive.subscribe((t) => this.onTick(t));
  }

  bind(root: HTMLElement): void {
    this.stage = root.querySelector(".side-fx-stage");
    this.frames = Array.from(root.querySelectorAll<HTMLImageElement>(".side-fx-frame"));
    this.frames.forEach((el) => {
      el.decoding = "async";
      el.classList.remove("is-on");
      el.style.visibility = "hidden";
      el.style.opacity = "0";
    });
    this.lastBeat = -1;
    if (this.playing) this.paint(this.index);
    else this.clear();
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.dir = 1;
    this.index = 0;
    this.lastBeat = -1;
    if (!on) {
      this.clear();
      this.writeMotion(0);
      return;
    }
    this.paint(0);
  }

  private onTick(t: TempoTick): void {
    if (!this.playing || this.frames.length < 2) return;

    const nod = Math.pow(1 - t.phase, 2);
    this.writeMotion(nod);

    if (t.time <= 0) return;
    if (t.beatIndex !== this.lastBeat) {
      if (this.lastBeat >= 0) this.step();
      this.lastBeat = t.beatIndex;
    }
  }

  private writeMotion(nod: number): void {
    if (!this.stage) return;
    this.stage.style.setProperty("--samurai-nod", nod.toFixed(3));
  }

  private clear(): void {
    this.frames.forEach((el) => {
      el.classList.remove("is-on");
      el.style.visibility = "hidden";
      el.style.opacity = "0";
    });
  }

  private step(): void {
    const n = this.frames.length;
    if (n < 2) return;
    let next = this.index + this.dir;
    if (next >= n - 1) {
      next = n - 1;
      this.dir = -1;
    } else if (next <= 0) {
      next = 0;
      this.dir = 1;
    }
    this.paint(next);
  }

  private paint(i: number): void {
    this.index = Math.max(0, Math.min(this.frames.length - 1, i));
    for (let k = 0; k < this.frames.length; k++) {
      const el = this.frames[k]!;
      const on = k === this.index;
      el.classList.toggle("is-on", on);
      el.style.visibility = on ? "visible" : "hidden";
      el.style.opacity = on ? "1" : "0";
    }
    this.stage?.style.setProperty("--samurai-pose", String(this.index));
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
  }
}
