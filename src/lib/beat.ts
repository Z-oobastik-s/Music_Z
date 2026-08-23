/**
 * Music-reactive motion from real frequency + onset analysis.
 * Punch follows kicks/bass hits; sway follows mid/vocal energy — not a free-running pulse.
 */

export class BeatMotion {
  private ctx: AudioContext | null = null;
  private src: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array | null = null;
  private time: Uint8Array | null = null;
  private raf = 0;
  private enabled = false;
  private sampleRate = 44100;

  /** Slow envelopes (release) */
  private envBass = 0;
  private envMid = 0;
  private envVoice = 0;
  private envEnergy = 0;
  /** Onset / kick pulse with fast decay */
  private kick = 0;
  private prevBass = 0;
  private prevFlux = 0;
  private prevBins: Float32Array | null = null;

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
      this.sampleRate = this.ctx.sampleRate;
      await this.resume();

      this.src = this.ctx.createMediaElementSource(audio);
      this.analyser = this.ctx.createAnalyser();
      // More bins → cleaner low-end separation for kicks
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.28;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -25;
      this.src.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.time = new Uint8Array(this.analyser.fftSize);
      this.prevBins = new Float32Array(this.analyser.frequencyBinCount);
    } catch {
      /* analyser unavailable — soft music-like fallback only */
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
    this.envBass = 0;
    this.envMid = 0;
    this.envVoice = 0;
    this.envEnergy = 0;
    this.kick = 0;
    this.prevBass = 0;
    this.prevFlux = 0;
    this.apply(0, 0, 0, 0, 0);
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private hzToBin(hz: number): number {
    if (!this.analyser) return 0;
    const n = this.analyser.frequencyBinCount;
    return Math.max(0, Math.min(n - 1, Math.round((hz * this.analyser.fftSize) / this.sampleRate)));
  }

  private bandAvg(fromHz: number, toHz: number): number {
    if (!this.analyser || !this.freq) return 0;
    const a = this.hzToBin(fromHz);
    const b = Math.max(a + 1, this.hzToBin(toHz));
    let sum = 0;
    for (let i = a; i < b; i++) sum += this.freq[i] / 255;
    return sum / (b - a);
  }

  /** Spectral flux in a band — rises on hits / note changes */
  private bandFlux(fromHz: number, toHz: number): number {
    if (!this.analyser || !this.freq || !this.prevBins) return 0;
    const a = this.hzToBin(fromHz);
    const b = Math.max(a + 1, this.hzToBin(toHz));
    let up = 0;
    for (let i = a; i < b; i++) {
      const v = this.freq[i] / 255;
      const d = v - this.prevBins[i];
      if (d > 0) up += d;
      this.prevBins[i] = v;
    }
    return up / (b - a);
  }

  private rms(): number {
    if (!this.analyser || !this.time) return 0;
    this.analyser.getByteTimeDomainData(this.time as Uint8Array<ArrayBuffer>);
    let s = 0;
    for (let i = 0; i < this.time.length; i++) {
      const x = (this.time[i] - 128) / 128;
      s += x * x;
    }
    return Math.sqrt(s / this.time.length);
  }

  private read(): {
    bass: number;
    mid: number;
    voice: number;
    energy: number;
    onset: number;
    alive: boolean;
  } {
    if (!this.analyser || !this.freq) {
      return { bass: 0, mid: 0, voice: 0, energy: 0, onset: 0, alive: false };
    }

    this.analyser.getByteFrequencyData(this.freq as Uint8Array<ArrayBuffer>);

    // Musical bands (Hz)
    const sub = this.bandAvg(25, 70); // sub / kick body
    const bass = this.bandAvg(70, 160); // bassline
    const lowMid = this.bandAvg(160, 400);
    const mid = this.bandAvg(400, 1600);
    const voice = this.bandAvg(300, 3200); // vocal presence
    const high = this.bandAvg(4000, 10000);
    const level = this.rms();

    const bassMix = Math.min(1, sub * 1.35 + bass * 1.1);
    const midMix = Math.min(1, lowMid * 0.85 + mid * 0.9);
    const voiceMix = Math.min(1, voice * 1.15);
    const energy = Math.min(1, level * 3.2 + high * 0.45 + midMix * 0.25);

    // Kick / rhythm onset: bass jump + low spectral flux
    const flux = this.bandFlux(30, 180);
    const bassJump = Math.max(0, bassMix - this.prevBass);
    this.prevBass = bassMix * 0.65 + this.prevBass * 0.35;

    const fluxJump = Math.max(0, flux - this.prevFlux * 0.5);
    this.prevFlux = flux;

    const onset = Math.min(1, bassJump * 4.2 + fluxJump * 6.5 + sub * bassJump * 2);

    const alive = bassMix + midMix + voiceMix + energy > 0.035;
    return {
      bass: bassMix,
      mid: midMix,
      voice: voiceMix,
      energy,
      onset,
      alive,
    };
  }

  /**
   * Only if analyser is dead — tempo-ish pulse from wall clock,
   * still less "random" than multi-phase sines.
   */
  private fallback(): {
    bass: number;
    mid: number;
    voice: number;
    energy: number;
    onset: number;
    alive: boolean;
  } {
    const t = performance.now() / 1000;
    // ~128 BPM feel
    const phase = (t * (128 / 60)) % 1;
    const kick = Math.pow(1 - phase, 8);
    return {
      bass: 0.35 + kick * 0.55,
      mid: 0.22 + Math.sin(t * 2.1) * 0.08,
      voice: 0.18 + Math.sin(t * 3.4 + 1.2) * 0.1,
      energy: 0.3 + kick * 0.25,
      onset: kick > 0.55 ? kick : 0,
      alive: true,
    };
  }

  private follow(current: number, target: number, attack: number, release: number): number {
    const k = target > current ? attack : release;
    return current + (target - current) * k;
  }

  private apply(beat: number, bass: number, energy: number, voice: number, kick: number): void {
    // Motion driven by music only — no free-running breathe/tilt
    const lift = -(kick * 5.5 + bass * 1.8 + voice * 0.6);
    const scale = kick * 0.028 + bass * 0.01 + energy * 0.006;
    // Vocal / mid energy → tiny sway (locked to signal, not time)
    const tilt = (voice - 0.35) * 1.1 + (energy - 0.3) * 0.35;

    this.root.style.setProperty("--beat", beat.toFixed(3));
    this.root.style.setProperty("--bass", bass.toFixed(3));
    this.root.style.setProperty("--energy", energy.toFixed(3));
    this.root.style.setProperty("--voice", voice.toFixed(3));
    this.root.style.setProperty("--kick", kick.toFixed(3));
    this.root.style.setProperty("--beat-x", "0");
    this.root.style.setProperty("--beat-y", lift.toFixed(2));
    this.root.style.setProperty("--beat-scale", Math.min(0.05, scale).toFixed(4));
    this.root.style.setProperty("--beat-tilt", Math.max(-1.2, Math.min(1.2, tilt)).toFixed(3));
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.enabled) {
      this.apply(0, 0, 0, 0, 0);
      return;
    }

    let { bass, mid, voice, energy, onset, alive } = this.read();
    if (!alive) {
      ({ bass, mid, voice, energy, onset } = this.fallback());
    }

    // Fast attack / slower release → punches read as hits, not mush
    this.envBass = this.follow(this.envBass, bass, 0.55, 0.12);
    this.envMid = this.follow(this.envMid, mid, 0.4, 0.1);
    this.envVoice = this.follow(this.envVoice, voice, 0.35, 0.08);
    this.envEnergy = this.follow(this.envEnergy, energy, 0.45, 0.14);

    // Kick pulse: snap up on onset, decay quickly
    if (onset > 0.08) {
      this.kick = Math.min(1, Math.max(this.kick, onset * 1.35));
    }
    this.kick *= 0.82;

    const beat = Math.min(
      1,
      this.kick * 0.75 + this.envBass * 0.35 + this.envMid * 0.12 + this.envEnergy * 0.1,
    );

    this.apply(beat, this.envBass, this.envEnergy, this.envVoice, this.kick);
  };
}
