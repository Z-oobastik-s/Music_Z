import type { Track } from "./tracks";
import { assetUrl } from "./tracks";

type PlayerCallbacks = {
  onChange: (track: Track | null, playing: boolean) => void;
  onTime: (current: number, duration: number) => void;
};

export class AudioPlayer {
  private readonly audio = new Audio();
  private track: Track | null = null;
  private queue: Track[] = [];
  private readonly cb: PlayerCallbacks;

  constructor(cb: PlayerCallbacks) {
    this.cb = cb;
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () => {
      this.cb.onTime(this.audio.currentTime, this.audio.duration || 0);
    });
    this.audio.addEventListener("ended", () => this.next());
    this.audio.addEventListener("play", () => this.cb.onChange(this.track, true));
    this.audio.addEventListener("pause", () => this.cb.onChange(this.track, false));
  }

  get current(): Track | null {
    return this.track;
  }

  get playing(): boolean {
    return !this.audio.paused;
  }

  setQueue(tracks: Track[]): void {
    this.queue = tracks;
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

  next(): void {
    if (!this.queue.length) return;
    const i = this.queue.findIndex((t) => t.id === this.track?.id);
    const next = this.queue[i < 0 || i >= this.queue.length - 1 ? 0 : i + 1];
    if (next) void this.play(next);
  }

  seek(ratio: number): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) return;
    this.audio.currentTime = Math.min(1, Math.max(0, ratio)) * this.audio.duration;
  }

  setVolume(v: number): void {
    this.audio.volume = Math.min(1, Math.max(0, v));
  }
}
