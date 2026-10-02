/**
 * Music-reactive motion + tempo-locked beat grid.
 * Visual punch uses onsets; samurai / pose FX should use onBeat (stable grid).
 */

export class BeatMotion {
  private ctx: AudioContext | null = null;
  private src: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array | null = null;
  private time: Uint8Array | null = null;
  private mediaEl: HTMLAudioElement | null = null;
  private raf = 0;
  private enabled = false;
  private sampleRate = 44100;

  private envBass = 0;
  private envMid = 0;
  private envVoice = 0;
  private envEnergy = 0;
  private kick = 0;
  private prevBass = 0;
  private prevSub = 0;
  private prevFlux = 0;
  private prevBins: Float32Array | null = null;

  /** Tempo lock */
  private bpm = 108;
  private beatPeriod = 60000 / 108;
  private nextBeatAt = 0;
  private gridLocked = false;
  private lastHitAt = 0;
  private iois: number[] = [];
  private beatIndex = 0;

  private readonly root: HTMLElement;
  private isLiveFn: (() => boolean) | null = null;
  private onBeatFn: ((beatIndex: number, bpm: number) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /** Stable quarter-note grid (not raw noisy onsets). */
  setBeatHandler(fn: ((beatIndex: number, bpm: number) => void) | null): void {
    this.onBeatFn = fn;
  }

  async attach(
    ctx: AudioContext,
    analyser: AnalyserNode,
    isLive: () => boolean,
  ): Promise<void> {
    this.ctx = ctx;
    this.analyser = analyser;
    this.isLiveFn = isLive;
    this.sampleRate = ctx.sampleRate;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.time = new Uint8Array(this.analyser.fftSize);
    this.prevBins = new Float32Array(this.analyser.frequencyBinCount);
    await this.resume();
  }

  async connect(audio: HTMLAudioElement): Promise<void> {
    this.mediaEl = audio;
    if (this.isLiveFn) {
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
      /* analyser unavailable */
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
    this.resetGrid();
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
    this.prevSub = 0;
    this.prevFlux = 0;
    this.resetGrid();
    this.apply(0, 0, 0, 0, 0);
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private resetGrid(): void {
    this.gridLocked = false;
    this.nextBeatAt = 0;
    this.lastHitAt = 0;
    this.iois = [];
    this.beatIndex = 0;
    this.bpm = 108;
    this.beatPeriod = 60000 / 108;
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
    sub: number;
    bass: number;
    mid: number;
    voice: number;
    energy: number;
    onset: number;
    bassHit: boolean;
    alive: boolean;
  } {
    if (!this.analyser || !this.freq) {
      return {
        sub: 0,
        bass: 0,
        mid: 0,
        voice: 0,
        energy: 0,
        onset: 0,
        bassHit: false,
        alive: false,
      };
    }

    this.analyser.getByteFrequencyData(this.freq as Uint8Array<ArrayBuffer>);

    const sub = this.bandAvg(25, 70);
    const bass = this.bandAvg(70, 160);
    const lowMid = this.bandAvg(160, 400);
    const mid = this.bandAvg(400, 1600);
    const voice = this.bandAvg(300, 3200);
    const high = this.bandAvg(4000, 10000);
    const level = this.rms();

    const bassMix = Math.min(1, sub * 1.35 + bass * 1.1);
    const midMix = Math.min(1, lowMid * 0.85 + mid * 0.9);
    const voiceMix = Math.min(1, voice * 1.15);
    const energy = Math.min(1, level * 3.2 + high * 0.45 + midMix * 0.25);

    const flux = this.bandFlux(30, 160);
    const bassJump = Math.max(0, bassMix - this.prevBass);
    const subJump = Math.max(0, sub - this.prevSub);
    this.prevBass = bassMix * 0.7 + this.prevBass * 0.3;
    this.prevSub = sub * 0.7 + this.prevSub * 0.3;
    this.prevFlux = flux;

    // Visual onset (can be a bit looser)
    const onset = Math.min(1, bassJump * 4.2 + flux * 5.5 + subJump * 3);

    // Tempo hits: stricter — need real low-end body, ignore hats/snares
    const bassHit =
      sub > 0.2 &&
      subJump > 0.035 &&
      bassJump > 0.028 &&
      flux > 0.012 &&
      midMix < bassMix * 1.85;

    const alive = bassMix + midMix + voiceMix + energy > 0.035;
    return {
      sub,
      bass: bassMix,
      mid: midMix,
      voice: voiceMix,
      energy,
      onset,
      bassHit,
      alive,
    };
  }

  private fallback(): {
    sub: number;
    bass: number;
    mid: number;
    voice: number;
    energy: number;
    onset: number;
    bassHit: boolean;
    alive: boolean;
  } {
    const t = performance.now() / 1000;
    const phase = (t * (this.bpm / 60)) % 1;
    const kick = Math.pow(1 - phase, 8);
    return {
      sub: 0.3 + kick * 0.5,
      bass: 0.35 + kick * 0.55,
      mid: 0.22 + Math.sin(t * 2.1) * 0.08,
      voice: 0.18 + Math.sin(t * 3.4 + 1.2) * 0.1,
      energy: 0.3 + kick * 0.25,
      onset: kick > 0.55 ? kick : 0,
      bassHit: kick > 0.72,
      alive: true,
    };
  }

  private follow(current: number, target: number, attack: number, release: number): number {
    const k = target > current ? attack : release;
    return current + (target - current) * k;
  }

  private median(xs: number[]): number {
    if (!xs.length) return this.beatPeriod;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]!;
  }

  /** Learn tempo from sparse bass hits; drive a free-running beat clock. */
  private updateGrid(now: number, bassHit: boolean): void {
    if (bassHit && now - this.lastHitAt > 170) {
      if (this.lastHitAt > 0) {
        const ioi = now - this.lastHitAt;
        // Accept quarter / eighth-ish intervals
        if (ioi >= 260 && ioi <= 1200) {
          this.iois.push(ioi);
          if (this.iois.length > 12) this.iois.shift();

          let period = this.median(this.iois);
          // Fold to ~70–150 BPM quarter notes
          while (period < 400 && period * 2 <= 950) period *= 2;
          while (period > 900) period *= 0.5;

          const measured = 60000 / period;
          this.bpm = this.bpm * 0.82 + measured * 0.18;
          this.bpm = Math.max(72, Math.min(148, this.bpm));
          this.beatPeriod = 60000 / this.bpm;
        }
      }
      this.lastHitAt = now;

      if (!this.gridLocked) {
        this.gridLocked = true;
        this.nextBeatAt = now;
      } else {
        // Phase correct toward this hit if near a grid line
        const period = this.beatPeriod;
        const k = Math.round((now - this.nextBeatAt) / period);
        const nearest = this.nextBeatAt + k * period;
        const drift = now - nearest;
        if (Math.abs(drift) < period * 0.22) {
          this.nextBeatAt += drift * 0.35;
        }
      }
    }

    if (!this.gridLocked) {
      // Until we hear a few hits, run a calm default clock
      if (!this.nextBeatAt) this.nextBeatAt = now + this.beatPeriod;
    }

    let steps = 0;
    while (now >= this.nextBeatAt && steps < 3) {
      this.nextBeatAt += this.beatPeriod;
      this.beatIndex += 1;
      steps += 1;
      this.onBeatFn?.(this.beatIndex, this.bpm);
      // Soft visual kick on grid so punch feels regular
      this.kick = Math.max(this.kick, 0.72);
    }

    this.root.style.setProperty("--bpm", this.bpm.toFixed(1));
  }

  private apply(beat: number, bass: number, energy: number, voice: number, kick: number): void {
    const lift = -(kick * 5.5 + bass * 1.8 + voice * 0.6);
    const scale = kick * 0.028 + bass * 0.01 + energy * 0.006;
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

    let { bass, mid, voice, energy, onset, bassHit, alive } = this.read();

    const audioLive = this.isLiveFn
      ? this.isLiveFn()
      : !!this.mediaEl &&
        !this.mediaEl.paused &&
        !this.mediaEl.ended &&
        this.mediaEl.readyState >= 2;

    if (!audioLive) {
      this.envBass = this.follow(this.envBass, 0, 0.5, 0.2);
      this.envMid = this.follow(this.envMid, 0, 0.5, 0.2);
      this.envVoice = this.follow(this.envVoice, 0, 0.5, 0.2);
      this.envEnergy = this.follow(this.envEnergy, 0, 0.5, 0.2);
      this.kick *= 0.7;
      this.apply(0, 0, 0, 0, 0);
      return;
    }

    if (!alive) {
      ({ bass, mid, voice, energy, onset, bassHit } = this.fallback());
    }

    this.envBass = this.follow(this.envBass, bass, 0.55, 0.12);
    this.envMid = this.follow(this.envMid, mid, 0.4, 0.1);
    this.envVoice = this.follow(this.envVoice, voice, 0.35, 0.08);
    this.envEnergy = this.follow(this.envEnergy, energy, 0.45, 0.14);

    if (onset > 0.1) {
      this.kick = Math.min(1, Math.max(this.kick, onset * 1.2));
    }
    this.kick *= 0.82;

    this.updateGrid(performance.now(), bassHit);

    const beat = Math.min(
      1,
      this.kick * 0.75 + this.envBass * 0.35 + this.envMid * 0.12 + this.envEnergy * 0.1,
    );

    this.apply(beat, this.envBass, this.envEnergy, this.envVoice, this.kick);
  };
}
