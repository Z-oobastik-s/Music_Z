/**
 * Sidebar samurai FX — beat-locked pose crossfades (design-style loop).
 * Advances on kick onsets, ping-pongs through frames, soft opacity blends.
 */

export class SideSamurai {
  private frames: HTMLElement[] = [];
  private stage: HTMLElement | null = null;
  private index = 0;
  private dir = 1;
  private playing = false;
  private lastStep = 0;
  private minGapMs = 320;
  private kickArmed = true;

  bind(root: HTMLElement): void {
    this.stage = root.querySelector(".side-fx-stage");
    this.frames = Array.from(root.querySelectorAll<HTMLElement>(".side-fx-frame"));
    this.show(0, true);
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.kickArmed = true;
    if (!on) {
      this.index = 0;
      this.dir = 1;
      this.frames.forEach((el) => el.classList.remove("is-on", "is-exit"));
      return;
    }
    this.show(0, true);
  }

  /** Call from BeatMotion on kick / onset. */
  onKick(strength: number): void {
    if (!this.playing || this.frames.length < 2) return;
    const now = performance.now();
    // Dense kicks → need breathing room; strong kicks can step a bit sooner
    const gap = Math.max(220, this.minGapMs - strength * 90);
    if (now - this.lastStep < gap) return;
    if (!this.kickArmed && strength < 0.35) return;

    this.kickArmed = false;
    window.setTimeout(() => {
      this.kickArmed = true;
    }, gap * 0.55);

    this.lastStep = now;
    this.step();
  }

  /** Soft fallback pulse when analyser is quiet but track is playing. */
  onFallbackPulse(): void {
    if (!this.playing) return;
    const now = performance.now();
    if (now - this.lastStep < 520) return;
    this.lastStep = now;
    this.step();
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
        window.setTimeout(() => el.classList.remove("is-exit"), 220);
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
