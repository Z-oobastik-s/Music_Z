/**
 * Sidebar samurai — few key poses, hard cut on each beat (no flipbook).
 */

export class SideSamurai {
  private frames: HTMLImageElement[] = [];
  private stage: HTMLElement | null = null;
  private index = 0;
  private dir = 1;
  private playing = false;
  private lastStepAt = 0;

  bind(root: HTMLElement): void {
    this.stage = root.querySelector(".side-fx-stage");
    const all = Array.from(root.querySelectorAll<HTMLImageElement>(".side-fx-frame"));
    // Keep only distant key poses so each beat is a punch, not a film strip
    const keys =
      all.length >= 9
        ? [0, 4, 8, 12, Math.min(all.length - 1, 16)].map((i) => all[i]!).filter(Boolean)
        : all;

    all.forEach((el) => {
      el.classList.remove("is-on");
      el.hidden = true;
    });
    keys.forEach((el) => {
      el.hidden = false;
      el.decoding = "sync";
      // Warm decode so the first swap isn't blank
      void el.decode().catch(() => undefined);
    });

    this.frames = keys;
    this.clear();
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.dir = 1;
    this.index = 0;
    this.lastStepAt = 0;
    if (!on) {
      this.clear();
      return;
    }
    this.paint(0);
  }

  onBeat(_beatIndex: number, bpm: number): void {
    if (!this.playing || this.frames.length < 2) return;
    const period = 60000 / Math.max(70, Math.min(160, bpm || 96));
    const now = performance.now();
    if (now - this.lastStepAt < period * 0.5) return;
    this.lastStepAt = now;
    this.step();
  }

  private clear(): void {
    this.frames.forEach((el) => el.classList.remove("is-on"));
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
    const active = this.frames[this.index];
    for (let k = 0; k < this.frames.length; k++) {
      const el = this.frames[k]!;
      const on = k === this.index;
      // visibility avoids any opacity compositing that reads as a fade
      el.classList.toggle("is-on", on);
      el.style.visibility = on ? "visible" : "hidden";
      el.style.opacity = on ? "1" : "0";
    }
    if (active) void active.decode().catch(() => undefined);
    this.stage?.style.setProperty("--samurai-pose", String(this.index));
  }
}
