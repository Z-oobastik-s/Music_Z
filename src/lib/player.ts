import type { Track } from "./tracks";
import { assetUrl } from "./tracks";

export type RepeatMode = "off" | "all" | "one";

type PlayerCallbacks = {
  onChange: (track: Track | null, playing: boolean) => void;
  onTime: (current: number, duration: number) => void;
  onMode?: (shuffle: boolean, repeat: RepeatMode) => void;
};

function shuffleCopy(list: Track[], keepId?: string | null): Track[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (keepId) {
    const idx = arr.findIndex((t) => t.id === keepId);
    if (idx > 0) {
      const [cur] = arr.splice(idx, 1);
      arr.unshift(cur);
    }
  }
  return arr;
}

export class AudioPlayer {
  private readonly audio = new Audio();
  private track: Track | null = null;
  private source: Track[] = [];
  private queue: Track[] = [];
  private shuffleOn = false;
  private repeat: RepeatMode = "off";
  private readonly cb: PlayerCallbacks;

  constructor(cb: PlayerCallbacks) {
    this.cb = cb;
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () => {
      this.cb.onTime(this.audio.currentTime, this.audio.duration || 0);
    });
    this.audio.addEventListener("ended", () => this.onEnded());
    this.audio.addEventListener("play", () => this.cb.onChange(this.track, true));
    this.audio.addEventListener("pause", () => this.cb.onChange(this.track, false));
  }

  get current(): Track | null {
    return this.track;
  }

  get playing(): boolean {
    return !this.audio.paused;
  }

  get shuffle(): boolean {
    return this.shuffleOn;
  }

  get repeatMode(): RepeatMode {
    return this.repeat;
  }

  getQueue(): Track[] {
    return [...this.queue];
  }

  private emitMode(): void {
    this.cb.onMode?.(this.shuffleOn, this.repeat);
  }

  private rebuildQueue(keepCurrent = true): void {
    if (!this.source.length) {
      this.queue = [];
      return;
    }
    this.queue = this.shuffleOn
      ? shuffleCopy(this.source, keepCurrent ? this.track?.id : null)
      : [...this.source];
  }

  setQueue(tracks: Track[]): void {
    this.source = tracks;
    this.rebuildQueue(true);
  }

  toggleShuffle(): boolean {
    this.shuffleOn = !this.shuffleOn;
    this.rebuildQueue(true);
    this.emitMode();
    return this.shuffleOn;
  }

  toggleRepeat(): RepeatMode {
    this.repeat = this.repeat === "off" ? "all" : this.repeat === "all" ? "one" : "off";
    this.emitMode();
    return this.repeat;
  }

  async play(track: Track): Promise<void> {
    if (this.track?.id !== track.id) {
      this.track = track;
      this.audio.src = assetUrl(track.src);
      this.audio.load();
    }
    try {
      await this.audio.play();
    } catch {
      this.cb.onChange(this.track, false);
    }
  }

  toggle(track?: Track): void {
    const t = track ?? this.track;
    if (!t) return;
    if (this.track?.id === t.id && !this.audio.paused) {
      this.audio.pause();
      return;
    }
    void this.play(t);
  }

  pause(): void {
    this.audio.pause();
  }

  prev(): void {
    if (!this.queue.length) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    const i = this.queue.findIndex((t) => t.id === this.track?.id);
    const next = this.queue[i <= 0 ? this.queue.length - 1 : i - 1];
    if (next) void this.play(next);
  }

  next(fromUser = true): void {
    if (!this.queue.length) return;
    if (!fromUser && this.repeat === "one" && this.track) {
      this.audio.currentTime = 0;
      void this.audio.play();
      return;
    }
    const i = this.queue.findIndex((t) => t.id === this.track?.id);
    if (i < 0) {
      void this.play(this.queue[0]);
      return;
    }
    if (i >= this.queue.length - 1) {
      if (this.repeat === "all" || fromUser) {
        if (this.shuffleOn) this.rebuildQueue(false);
        void this.play(this.queue[0]);
      }
      return;
    }
    void this.play(this.queue[i + 1]);
  }

  private onEnded(): void {
    if (this.repeat === "one" && this.track) {
      this.audio.currentTime = 0;
      void this.audio.play();
      return;
    }
    this.next(false);
  }

  seek(ratio: number): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) return;
    this.audio.currentTime = Math.min(1, Math.max(0, ratio)) * this.audio.duration;
  }

  setVolume(v: number): void {
    this.audio.volume = Math.min(1, Math.max(0, v));
  }

  /** For Web Audio analyser — one MediaElementSource per element. */
  get media(): HTMLAudioElement {
    return this.audio;
  }
}
