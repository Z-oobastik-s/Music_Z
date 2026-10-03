/**
 * Sidebar samurai — pose steps locked to track BPM × audio.currentTime.
 */

export class SideSamurai {
  private frames: HTMLImageElement[] = [];
  private stage: HTMLElement | null = null;
  private media: HTMLAudioElement | null = null;
  private bpm = 124;
  private index = 0;
  private dir = 1;
  private playing = false;
  private raf = 0;
  private lastBeat = -1;

  bind(root: HTMLElement): void {
    this.stage = root.querySelector(".side-fx-stage");
    const all = Array.from(root.querySelectorAll<HTMLImageElement>(".side-fx-frame"));
    // Distant key poses — punchy, not a film strip
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
      void el.decode().catch(() => undefined);
    });

    this.frames = keys;
    this.clear();
    if (this.playing) {
      this.paint(this.index);
      this.ensureLoop();
    }
  }

  setClock(media: HTMLAudioElement | null, bpm: number): void {
    this.media = media;
    this.bpm = Math.max(70, Math.min(180, bpm || 124));
    this.lastBeat = -1;
    if (this.playing) this.ensureLoop();
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.dir = 1;
    this.index = 0;
    this.lastBeat = -1;
    if (!on) {
      this.stopLoop();
      this.clear();
      this.writeMotion(0);
      return;
    }
    this.paint(0);
    this.ensureLoop();
  }

  /** Legacy BeatMotion hook — clock is audio+BPM now. */
  onBeat(_beatIndex: number, _bpm: number): void {
    /* unused */
  }

  private ensureLoop(): void {
    if (!this.raf) this.tick();
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.playing || this.frames.length < 2) return;

    const media = this.media;
    if (!media || media.paused) {
      this.writeMotion(0);
      return;
    }

    const beats = media.currentTime * (this.bpm / 60);
    const beatIndex = Math.floor(beats);
    const phase = beats - beatIndex;

    // Smooth bob between pose cuts (BPM-locked)
    const nod = Math.pow(1 - phase, 2);
    this.writeMotion(nod);

    if (beatIndex !== this.lastBeat && beatIndex >= 0) {
      // Step on each new quarter-note from the track clock
      if (this.lastBeat >= 0) this.step();
      this.lastBeat = beatIndex;
    }
  };

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
}
