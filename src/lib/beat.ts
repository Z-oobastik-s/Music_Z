/** Subtle beat-linked motion. No flashes / glow. */

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
  private audio: HTMLAudioElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async connect(audio: HTMLAudioElement): Promise<void> {
    if (this.audio === audio && this.analyser) return;
    this.audio = audio;

    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }

    if (!this.src) {
      this.src = this.ctx.createMediaElementSource(audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.src.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  start(): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this.enabled = true;
    this.root.classList.add("is-alive");
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
    const bEnd = Math.max(2, Math.floor(n * 0.08));
    const mEnd = Math.max(bEnd + 1, Math.floor(n * 0.35));
    for (let i = 0; i < n; i++) {
      const v = this.data[i] / 255;
      all += v;
      if (i < bEnd) bass += v;
      else if (i < mEnd) mid += v;
    }
    return {
      bass: Math.min(1, (bass / bEnd) * 1.35),
      mid: Math.min(1, (mid / (mEnd - bEnd)) * 1.2),
      energy: Math.min(1, (all / n) * 1.8),
    };
  }

  private apply(beat: number, bass: number, energy: number): void {
    const breathe = this.enabled ? Math.sin(this.t * 0.0016) * 0.5 + 0.5 : 0;
    const y = -bass * 4.5 - breathe * 1.2;
    const x = Math.sin(this.t * 0.0009) * (1.2 + energy * 1.5);
    const scale = beat * 0.016 + breathe * 0.004;

    this.root.style.setProperty("--beat", beat.toFixed(3));
    this.root.style.setProperty("--bass", bass.toFixed(3));
    this.root.style.setProperty("--energy", energy.toFixed(3));
    this.root.style.setProperty("--beat-x", x.toFixed(2));
    this.root.style.setProperty("--beat-y", y.toFixed(2));
    this.root.style.setProperty("--beat-scale", scale.toFixed(4));
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);
    this.t = performance.now();
    if (!this.enabled) {
      this.apply(0, 0, 0);
      return;
    }
    const { bass, mid, energy } = this.read();
    const target = Math.max(bass * 0.75 + mid * 0.2 + energy * 0.15, 0);
    this.smooth += (target - this.smooth) * 0.18;
    this.smoothBass += (bass - this.smoothBass) * 0.22;
    this.apply(this.smooth, this.smoothBass, energy);
  };
}
