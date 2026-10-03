/**
 * Single rAF clock for BPM-locked visuals (hero + sidebar).
 * Avoids multiple competing animation loops.
 */

export type TempoTick = {
  time: number;
  bpm: number;
  beats: number;
  beatIndex: number;
  phase: number;
};

type Listener = (tick: TempoTick) => void;

export class TempoDrive {
  private media: HTMLAudioElement | null = null;
  private bpm = 124;
  private playing = false;
  private raf = 0;
  private listeners = new Set<Listener>();
  private onVis: (() => void) | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setClock(media: HTMLAudioElement | null, bpm: number): void {
    this.media = media;
    this.bpm = Math.max(70, Math.min(180, bpm || 124));
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    if (!on) {
      this.stop();
      return;
    }
    this.ensureVisHook();
    this.start();
  }

  private ensureVisHook(): void {
    if (this.onVis) return;
    this.onVis = () => {
      if (!this.playing) return;
      if (document.hidden) this.stop();
      else this.start();
    };
    document.addEventListener("visibilitychange", this.onVis);
  }

  private start(): void {
    if (this.raf || document.hidden) return;
    this.tick();
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.playing || document.hidden || this.listeners.size === 0) return;

    const media = this.media;
    const time = media && !media.paused && !media.ended ? media.currentTime : 0;
    const bpm = this.bpm;
    const beats = time * (bpm / 60);
    const beatIndex = Math.floor(beats);
    const phase = beats - beatIndex;
    const payload: TempoTick = { time, bpm, beats, beatIndex, phase };

    for (const fn of this.listeners) fn(payload);
  };
}

/** App-wide shared driver */
export const tempoDrive = new TempoDrive();
