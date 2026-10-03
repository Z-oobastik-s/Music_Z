/**
 * Hero girl — head-bob locked to track BPM × audio.currentTime.
 * Smooth continuous motion (no hard frame cuts).
 */

export class HeroGirl {
  private stage: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private media: HTMLAudioElement | null = null;
  private bpm = 124;
  private playing = false;
  private raf = 0;
  /** Optional phase offset in beats if a track intro is off the grid */
  private beatOffset = 0;

  bind(host: HTMLElement | null): void {
    this.host = host;
    this.stage = host?.querySelector(".hero-girl-stage") ?? null;
    const frame = host?.querySelector<HTMLImageElement>(".hero-girl-frame");
    if (frame) {
      frame.classList.add("is-on");
      frame.hidden = false;
      frame.decoding = "sync";
      void frame.decode().catch(() => undefined);
    }
    this.write(0, 0, 0);
    if (this.playing) this.ensureLoop();
  }

  /** Call when the active track / media element changes. */
  setClock(media: HTMLAudioElement | null, bpm: number): void {
    this.media = media;
    this.bpm = Math.max(70, Math.min(180, bpm || 124));
    this.beatOffset = 0;
    if (this.playing) this.ensureLoop();
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    if (!on) {
      this.stopLoop();
      this.write(0, 0, 0);
      this.stage?.classList.remove("is-live");
      return;
    }
    this.stage?.classList.add("is-live");
    this.ensureLoop();
  }

  /** Kept for BeatMotion wiring — unused; clock is audio+BPM. */
  onBeat(_beatIndex: number, _bpm: number): void {
    /* tempo comes from track prompt via setClock */
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
    if (!this.playing) return;

    if (!this.stage || !this.stage.isConnected) {
      this.stage = this.host?.querySelector(".hero-girl-stage") ?? null;
      if (!this.stage) return;
      this.stage.classList.add("is-live");
    }

    const media = this.media;
    const t = media && !media.paused ? media.currentTime : 0;
    const bpm = this.bpm;
    const beats = t * (bpm / 60) + this.beatOffset;
    const phase = beats - Math.floor(beats); // 0 = on the kick

    // Smooth headbang: slam down on the beat, ease back up (continuous, not stepped)
    const attack = Math.pow(1 - phase, 2.1);
    const lift = Math.sin(phase * Math.PI) * 0.35;
    const nod = Math.min(1, attack * 0.92 + lift);

    // Half-beat shoulder sway
    const half = (beats * 0.5) % 1;
    const sway = Math.sin(half * Math.PI * 2) * 0.35;

    const y = nod * 16 + Math.abs(sway) * 3;
    const r = nod * 6.5 + sway * 2.2;
    this.write(y, r, nod);
  };

  private write(y: number, r: number, intensity: number): void {
    if (!this.stage) return;
    this.stage.style.setProperty("--hero-nod-y", y.toFixed(2));
    this.stage.style.setProperty("--hero-nod-r", r.toFixed(2));
    this.stage.style.setProperty("--hero-nod-i", intensity.toFixed(3));
  }
}
