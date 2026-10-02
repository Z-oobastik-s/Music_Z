/**
 * Sidebar samurai — snaps pose on each beat (no fade lag).
 */

export class SideSamurai {
  private frames: HTMLElement[] = [];
  private stage: HTMLElement | null = null;
  private index = 0;
  private dir = 1;
  private playing = false;
  private lastStepAt = 0;

  bind(root: HTMLElement): void {
    this.stage = root.querySelector(".side-fx-stage");
    this.frames = Array.from(root.querySelectorAll<HTMLElement>(".side-fx-frame"));
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
    this.show(0);
  }

  /** Called on each quarter-note from BeatMotion (already look-ahead compensated). */
  onBeat(_beatIndex: number, bpm: number): void {
    if (!this.playing || this.frames.length < 2) return;

    const period = 60000 / Math.max(70, Math.min(160, bpm || 96));
    const now = performance.now();
    // Guard only against true double-fires from the same kick
    if (now - this.lastStepAt < Math.min(140, period * 0.28)) return;
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
    this.show(next);
  }

  private show(i: number): void {
    this.index = Math.max(0, Math.min(this.frames.length - 1, i));
    // Hard cut — fade made poses land after the kick
    this.frames.forEach((el, idx) => {
      el.classList.toggle("is-on", idx === this.index);
    });
    this.stage?.style.setProperty("--samurai-pose", String(this.index));
  }
}
