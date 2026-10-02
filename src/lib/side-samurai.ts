/**
 * Sidebar samurai — tempo-grid poses with underlay crossfade (no blink).
 */

export class SideSamurai {
  private frames: HTMLElement[] = [];
  private stage: HTMLElement | null = null;
  private index = 0;
  private dir = 1;
  private playing = false;
  private lastStepAt = 0;
  private swapTimer = 0;

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
    window.clearTimeout(this.swapTimer);
    this.swapTimer = 0;
    if (!on) {
      this.clear();
      return;
    }
    this.show(0, true);
  }

  /** Called on each quarter-note from BeatMotion grid. */
  onBeat(_beatIndex: number, bpm: number): void {
    if (!this.playing || this.frames.length < 2) return;

    const every = bpm >= 140 ? 2 : 1;
    if (_beatIndex % every !== 0) return;

    const now = performance.now();
    // Wait for crossfade to settle a bit so we don't stack blinks
    if (now - this.lastStepAt < 220) return;
    this.lastStepAt = now;
    this.step();
  }

  private clear(): void {
    window.clearTimeout(this.swapTimer);
    this.swapTimer = 0;
    this.frames.forEach((el) => el.classList.remove("is-on", "is-exit"));
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
    this.show(next, false);
  }

  private show(i: number, instant: boolean): void {
    const prev = this.index;
    this.index = Math.max(0, Math.min(this.frames.length - 1, i));
    const nextEl = this.frames[this.index];
    if (!nextEl) return;

    if (instant || prev === this.index) {
      this.frames.forEach((el, idx) => {
        el.classList.toggle("is-on", idx === this.index);
        el.classList.remove("is-exit");
      });
      return;
    }

    // Underlay crossfade: keep previous fully visible underneath,
    // fade new on top, then drop previous — never a dark gap/flash.
    window.clearTimeout(this.swapTimer);
    nextEl.classList.add("is-on");
    nextEl.classList.remove("is-exit");
    this.swapTimer = window.setTimeout(() => {
      this.frames.forEach((el, idx) => {
        if (idx !== this.index) el.classList.remove("is-on", "is-exit");
      });
      this.swapTimer = 0;
    }, 380);

    this.stage?.style.setProperty("--samurai-pose", String(this.index));
  }
}
