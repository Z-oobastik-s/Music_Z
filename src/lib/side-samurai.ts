/**
 * Sidebar samurai — pose changes on tempo grid (not noisy kick onsets).
 * Ping-pong crossfade; step every 1–2 beats depending on BPM.
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
    this.show(0, true);
  }

  /** Called on each quarter-note from BeatMotion grid. */
  onBeat(beatIndex: number, bpm: number): void {
    if (!this.playing || this.frames.length < 2) return;

    // Slow tracks: every beat. Faster: every 2 beats (half-note poses).
    const every = bpm >= 112 ? 2 : 1;
    if (beatIndex % every !== 0) return;

    const now = performance.now();
    // Hard floor so we never stutter even if grid double-fires
    if (now - this.lastStepAt < 240) return;
    this.lastStepAt = now;
    this.step();
  }

  private clear(): void {
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
    this.frames.forEach((el, idx) => {
      const on = idx === this.index;
      if (instant) {
        el.classList.toggle("is-on", on);
        el.classList.remove("is-exit");
        return;
      }
      if (idx === prev && prev !== this.index) {
        el.classList.add("is-exit");
        el.classList.remove("is-on");
        window.setTimeout(() => el.classList.remove("is-exit"), 260);
      } else if (on) {
        el.classList.add("is-on");
        el.classList.remove("is-exit");
      } else {
        el.classList.remove("is-on");
      }
    });
    this.stage?.style.setProperty("--samurai-pose", String(this.index));
  }
}
