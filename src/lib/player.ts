import type { Track } from "./tracks";
import { assetUrl, formatDuration } from "./tracks";

type PlayerCallbacks = {
  onChange: (track: Track | null, playing: boolean) => void;
  onTime: (current: number, duration: number) => void;
};

export class AudioPlayer {
  private readonly audio = new Audio();
  private track: Track | null = null;
  private readonly cb: PlayerCallbacks;

  constructor(cb: PlayerCallbacks) {
    this.cb = cb;
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () => {
      this.cb.onTime(this.audio.currentTime, this.audio.duration || 0);
    });
    this.audio.addEventListener("ended", () => {
      this.cb.onChange(this.track, false);
    });
    this.audio.addEventListener("play", () => this.cb.onChange(this.track, true));
    this.audio.addEventListener("pause", () => this.cb.onChange(this.track, false));
  }

  get current(): Track | null {
    return this.track;
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

  toggle(track: Track): void {
    if (this.track?.id === track.id && !this.audio.paused) {
      this.audio.pause();
      return;
    }
    void this.play(track);
  }

  pause(): void {
    this.audio.pause();
  }

  seek(ratio: number): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) return;
    this.audio.currentTime = Math.min(1, Math.max(0, ratio)) * this.audio.duration;
  }

  setVolume(v: number): void {
    this.audio.volume = Math.min(1, Math.max(0, v));
  }

  label(): string {
    if (!this.track) return "Ничего не играет";
    return `${this.track.title} · ${formatDuration(this.track.durationSec)}`;
  }
}
