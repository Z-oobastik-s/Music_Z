/** Beat-linked motion for the UI. No flashes / neon glow. */

export class BeatMotion {
  private ctx: AudioContext | null = null;
  private src: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array | null = null;
  private raf = 0;
  private smooth = 0;
  private smoothBass = 0;
  private t = 0;
  private enabled = false;
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async connect(audio: HTMLAudioElement): Promise<void> {
    if (this.src && this.analyser) {
      await this.resume();
      return;
    }

    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    try {
      if (!this.ctx) this.ctx = new AC();
      await this.resume();

      this.src = this.ctx.createMediaElementSource(audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.7;
      this.src.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
    } catch {
      /* fallback pulse still works without analyser */
    }
  }

  private async resume(): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
  }

  start(): void {
    this.enabled = true;
    this.root.classList.add("is-alive");
    void this.resume();
    if (!this.raf) this.tick();
  }

  stop(): void {
    this.enabled = false;
    this.root.classList.remove("is-alive");
    this.smooth = 0;
    this.smoothBass = 0;
    this.apply(0, 0, 0);
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private read(): { bass: number; mid: number; energy: number } {
    if (!this.analyser || !this.data) return { bass: 0, mid: 0, energy: 0 };
    this.analyser.getByteFrequencyData(this.data as Uint8Array<ArrayBuffer>);
    const n = this.data.length;
    let bass = 0;
    let mid = 0;
    let all = 0;
    const bEnd = Math.max(3, Math.floor(n * 0.1));
    const mEnd = Math.max(bEnd + 1, Math.floor(n * 0.4));
    for (let i = 0; i < n; i++) {
      const v = this.data[i] / 255;
      all += v;
      if (i < bEnd) bass += v;
      else if (i < mEnd) mid += v;
    }
    return {
      bass: Math.min(1, (bass / bEnd) * 1.6),
      mid: Math.min(1, (mid / (mEnd - bEnd)) * 1.35),
      energy: Math.min(1, (all / n) * 2.2),
    };
  }

  /** Soft pulse if WebAudio analysis is blocked. */
  private fallback(): { bass: number; mid: number; energy: number } {
    const t = this.t * 0.001;
    const kick = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4.83)), 10);
    const sway = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.35));
    return {
      bass: Math.min(1, kick * 0.55 + sway * 0.35),
      mid: sway * 0.4,
      energy: 0.28 + kick * 0.25,
    };
  }

  private apply(beat: number, bass: number, energy: number): void {
    const breathe = this.enabled ? 0.5 + 0.5 * Math.sin(this.t * 0.00135) : 0;
    // Soft lift + micro-scale only — no sideways jump
    const lift = -(bass * 2.4 + breathe * 1.4);
    const scale = beat * 0.012 + breathe * 0.008;
    const tilt = Math.sin(this.t * 0.00075) * (0.12 + energy * 0.18);

    this.root.style.setProperty("--beat", beat.toFixed(3));
    this.root.style.setProperty("--bass", bass.toFixed(3));
    this.root.style.setProperty("--energy", energy.toFixed(3));
    this.root.style.setProperty("--beat-x", "0");
    this.root.style.setProperty("--beat-y", lift.toFixed(2));
    this.root.style.setProperty("--beat-scale", scale.toFixed(4));
    this.root.style.setProperty("--beat-tilt", tilt.toFixed(3));
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);
    this.t = performance.now();
    if (!this.enabled) {
      this.apply(0, 0, 0);
      return;
    }

    let { bass, mid, energy } = this.read();
    // If analyser is silent / blocked, drive a musical fallback so motion is always visible
    if (bass + mid + energy < 0.04) {
      ({ bass, mid, energy } = this.fallback());
    }

    const target = Math.min(1, bass * 0.7 + mid * 0.2 + energy * 0.2);
    this.smooth += (target - this.smooth) * 0.28;
    this.smoothBass += (bass - this.smoothBass) * 0.32;
    this.apply(this.smooth, this.smoothBass, energy);
  };
}
