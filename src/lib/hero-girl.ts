/**
 * Hero girl — smooth head-bob from shared TempoDrive (track BPM × audio time).
 */

import { tempoDrive, type TempoTick } from "./tempo-drive";

export class HeroGirl {
  private stage: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private playing = false;
  private unsub: (() => void) | null = null;

  constructor() {
    this.unsub = tempoDrive.subscribe((t) => this.onTick(t));
  }

  bind(host: HTMLElement | null): void {
    this.host = host;
    this.stage = host?.querySelector(".hero-girl-stage") ?? null;
    const frame = host?.querySelector<HTMLImageElement>(".hero-girl-frame");
    if (frame) {
      frame.classList.add("is-on");
      frame.hidden = false;
    }
    this.write(0, 0, 0);
    if (this.playing) this.stage?.classList.add("is-live");
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    if (!on) {
      this.write(0, 0, 0);
      this.stage?.classList.remove("is-live");
      return;
    }
    this.stage?.classList.add("is-live");
  }

  private onTick(t: TempoTick): void {
    if (!this.playing) return;
    if (!this.stage || !this.stage.isConnected) {
      this.stage = this.host?.querySelector(".hero-girl-stage") ?? null;
      if (!this.stage) return;
      this.stage.classList.add("is-live");
    }

    const { phase, beats } = t;
    const attack = Math.pow(1 - phase, 2.1);
    const lift = Math.sin(phase * Math.PI) * 0.35;
    const nod = Math.min(1, attack * 0.92 + lift);
    const half = (beats * 0.5) % 1;
    const sway = Math.sin(half * Math.PI * 2) * 0.35;

    this.write(nod * 16 + Math.abs(sway) * 3, nod * 6.5 + sway * 2.2, nod);
  }

  private write(y: number, r: number, intensity: number): void {
    if (!this.stage) return;
    this.stage.style.setProperty("--hero-nod-y", y.toFixed(2));
    this.stage.style.setProperty("--hero-nod-r", r.toFixed(2));
    this.stage.style.setProperty("--hero-nod-i", intensity.toFixed(3));
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
  }
}
