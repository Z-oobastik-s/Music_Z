import { prefetchMedia, resolvePlaybackUrl } from "./media-cache";
import type { Track } from "./tracks";

export type RepeatMode = "off" | "all" | "one";

/** Overlap length when auto-advancing or skipping tracks (seconds). */
const CROSSFADE_SEC = 3.5;

type PlayerCallbacks = {
  onChange: (track: Track | null, playing: boolean) => void;
  onTime: (current: number, duration: number) => void;
  onMode?: (shuffle: boolean, repeat: RepeatMode) => void;
  /** Fired while a track file is being fetched / prepared for playback. */
  onLoading?: (track: Track | null, loading: boolean) => void;
  onError?: (track: Track | null, message: string) => void;
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
  private readonly audioA = new Audio();
  private readonly audioB = new Audio();
  /** 0 = A active, 1 = B active */
  private slot: 0 | 1 = 0;

  private ctx: AudioContext | null = null;
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private track: Track | null = null;
  private source: Track[] = [];
  private queue: Track[] = [];
  private shuffleOn = false;
  private repeat: RepeatMode = "off";
  private readonly cb: PlayerCallbacks;
  private playGen = 0;
  private userVolume = 0.88;
  private crossfading = false;
  private crossfadeArmed = false;
  private graphReady: Promise<void> | null = null;
  private loading = false;
  /** Element feeding the seek bar while crossfading (incoming). */
  private timeEl: HTMLAudioElement | null = null;

  constructor(cb: PlayerCallbacks) {
    this.cb = cb;
    for (const el of [this.audioA, this.audioB]) {
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.addEventListener("timeupdate", () => this.onTimeUpdate(el));
      el.addEventListener("ended", () => this.onEnded(el));
      el.addEventListener("playing", () => {
        if (el === this.activeEl && !this.crossfading) this.cb.onChange(this.track, true);
      });
      el.addEventListener("pause", () => {
        if (el === this.activeEl && !this.crossfading) this.cb.onChange(this.track, false);
      });
      el.addEventListener("error", () => {
        if (el !== this.activeEl && el !== this.idleEl) return;
        if (this.loading) {
          this.setLoading(null, false);
          this.cb.onError?.(this.track, "Не удалось загрузить трек");
        }
      });
    }
  }

  private get activeEl(): HTMLAudioElement {
    return this.slot === 0 ? this.audioA : this.audioB;
  }

  private get idleEl(): HTMLAudioElement {
    return this.slot === 0 ? this.audioB : this.audioA;
  }

  private get activeGain(): GainNode | null {
    return this.slot === 0 ? this.gainA : this.gainB;
  }

  private get idleGain(): GainNode | null {
    return this.slot === 0 ? this.gainB : this.gainA;
  }

  get current(): Track | null {
    return this.track;
  }

  get playing(): boolean {
    return (
      (!this.audioA.paused && !this.audioA.ended) || (!this.audioB.paused && !this.audioB.ended)
    );
  }

  get isLoading(): boolean {
    return this.loading;
  }

  private setLoading(track: Track | null, loading: boolean): void {
    this.loading = loading;
    this.cb.onLoading?.(loading ? track : null, loading);
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

  /** Primary element — for legacy hooks; graph routes both elements. */
  get media(): HTMLAudioElement {
    return this.activeEl;
  }

  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  isAudioLive(): boolean {
    return this.playing;
  }

  /** Wire Web Audio graph (once) — call before playback / beat attach. */
  initAudio(): Promise<void> {
    if (!this.graphReady) {
      this.graphReady = this.setupGraph();
    }
    return this.graphReady;
  }

  private async setupGraph(): Promise<void> {
    if (this.ctx) return;

    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    this.ctx = new AC();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.28;
    this.analyser.minDecibels = -85;
    this.analyser.maxDecibels = -25;

    this.gainA = this.ctx.createGain();
    this.gainB = this.ctx.createGain();
    this.gainA.gain.value = this.userVolume;
    this.gainB.gain.value = 0;

    const srcA = this.ctx.createMediaElementSource(this.audioA);
    const srcB = this.ctx.createMediaElementSource(this.audioB);
    // Element volume must stay at 1 — loudness is controlled by GainNodes only
    this.audioA.volume = 1;
    this.audioB.volume = 1;
    srcA.connect(this.gainA);
    srcB.connect(this.gainB);
    this.gainA.connect(this.analyser);
    this.gainB.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
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

  private prefetchNeighbors(): void {
    if (!this.track || !this.queue.length) return;
    const i = this.queue.findIndex((t) => t.id === this.track?.id);
    if (i < 0) return;
    const next = this.queue[i + 1] ?? (this.repeat === "all" ? this.queue[0] : undefined);
    const prev =
      this.queue[i - 1] ?? (this.repeat === "all" ? this.queue[this.queue.length - 1] : undefined);
    if (next) prefetchMedia(next.src);
    if (prev && prev.id !== next?.id) prefetchMedia(prev.src);
    if (this.track.cover) prefetchMedia(this.track.cover);
  }

  private resetCrossfadeState(): void {
    this.crossfading = false;
    this.crossfadeArmed = false;
    this.timeEl = null;
  }

  private cancelCrossfade(): void {
    if (!this.crossfading) return;
    this.resetCrossfadeState();
    const t = this.ctx?.currentTime ?? 0;
    if (this.gainA && this.gainB) {
      this.gainA.gain.cancelScheduledValues(t);
      this.gainB.gain.cancelScheduledValues(t);
      this.gainA.gain.value = this.slot === 0 ? this.userVolume : 0;
      this.gainB.gain.value = this.slot === 1 ? this.userVolume : 0;
    }
    this.idleEl.pause();
    this.idleEl.currentTime = 0;
  }

  private resolveNext(fromUser: boolean): Track | null {
    if (!this.queue.length) return null;
    if (!fromUser && this.repeat === "one" && this.track) return this.track;

    const i = this.queue.findIndex((t) => t.id === this.track?.id);
    if (i < 0) return this.queue[0] ?? null;

    if (i >= this.queue.length - 1) {
      if (this.repeat === "all" || fromUser) {
        if (this.shuffleOn) this.rebuildQueue(false);
        return this.queue[0] ?? null;
      }
      return null;
    }
    return this.queue[i + 1] ?? null;
  }

  private async loadInto(el: HTMLAudioElement, track: Track, gen: number): Promise<boolean> {
    try {
      const url = resolvePlaybackUrl(track.src);
      if (gen !== this.playGen) return false;
      if (el.src !== url) {
        el.src = url;
        el.load();
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Hard switch without crossfade (fallback + cold start). */
  private async hardCutTo(track: Track, gen: number): Promise<void> {
    this.cancelCrossfade();
    this.track = track;
    this.setLoading(track, true);
    this.cb.onChange(track, false);

    if (!(await this.loadInto(this.activeEl, track, gen))) {
      if (gen === this.playGen) {
        this.setLoading(null, false);
        this.cb.onChange(this.track, false);
        this.cb.onError?.(track, "Не удалось загрузить трек");
      }
      return;
    }

    this.idleEl.pause();
    this.idleEl.currentTime = 0;
    if (this.activeGain) this.activeGain.gain.value = this.userVolume;
    if (this.idleGain) this.idleGain.gain.value = 0;

    try {
      this.activeEl.currentTime = 0;
      await this.activeEl.play();
      if (gen === this.playGen) this.prefetchNeighbors();
    } catch (err) {
      if (gen === this.playGen) {
        this.cb.onChange(this.track, false);
        const blocked = err instanceof DOMException && err.name === "NotAllowedError";
        this.cb.onError?.(
          track,
          blocked ? "Нажми Play: браузер блокирует автозапуск" : "Не удалось начать воспроизведение",
        );
      }
    } finally {
      if (gen === this.playGen) this.setLoading(null, false);
    }
  }

  private async crossfadeTo(track: Track, gen: number): Promise<boolean> {
    if (!this.ctx || !this.activeGain || !this.idleGain) {
      this.crossfadeArmed = false;
      return false;
    }

    this.cancelCrossfade();
    this.crossfading = true;
    this.crossfadeArmed = true;
    this.setLoading(track, true);

    const outEl = this.activeEl;
    const inEl = this.idleEl;
    const outGain = this.activeGain;
    const inGain = this.idleGain;

    if (!(await this.loadInto(inEl, track, gen))) {
      this.resetCrossfadeState();
      if (gen === this.playGen) this.setLoading(null, false);
      return false;
    }

    try {
      inEl.currentTime = 0;
      await inEl.play();
    } catch {
      this.resetCrossfadeState();
      if (gen === this.playGen) this.setLoading(null, false);
      return false;
    }

    if (gen !== this.playGen) {
      inEl.pause();
      this.resetCrossfadeState();
      this.setLoading(null, false);
      return false;
    }

    this.track = track;
    this.timeEl = inEl;
    this.setLoading(null, false);
    this.cb.onChange(track, true);

    const t0 = this.ctx.currentTime;
    const remaining = Math.max(0.35, (outEl.duration || CROSSFADE_SEC) - outEl.currentTime);
    const fade = Math.min(CROSSFADE_SEC, remaining);

    outGain.gain.cancelScheduledValues(t0);
    inGain.gain.cancelScheduledValues(t0);
    outGain.gain.setValueAtTime(outGain.gain.value, t0);
    inGain.gain.setValueAtTime(0, t0);
    outGain.gain.linearRampToValueAtTime(0, t0 + fade);
    inGain.gain.linearRampToValueAtTime(this.userVolume, t0 + fade);

    window.setTimeout(() => {
      if (gen !== this.playGen) return;
      outEl.pause();
      outEl.currentTime = 0;
      outGain.gain.cancelScheduledValues(this.ctx!.currentTime);
      inGain.gain.cancelScheduledValues(this.ctx!.currentTime);
      outGain.gain.value = 0;
      inGain.gain.value = this.userVolume;
      this.slot = this.slot === 0 ? 1 : 0;
      this.resetCrossfadeState();
      this.cb.onChange(track, true);
      this.prefetchNeighbors();
    }, fade * 1000 + 40);

    return true;
  }

  async play(track: Track): Promise<void> {
    const gen = ++this.playGen;
    await this.initAudio();

    if (this.track?.id === track.id) {
      this.setLoading(track, true);
      try {
        await this.activeEl.play();
        if (gen === this.playGen) this.prefetchNeighbors();
      } catch (err) {
        if (gen === this.playGen) {
          this.cb.onChange(this.track, false);
          const blocked = err instanceof DOMException && err.name === "NotAllowedError";
          this.cb.onError?.(
            track,
            blocked ? "Нажми Play: браузер блокирует автозапуск" : "Не удалось начать воспроизведение",
          );
        }
      } finally {
        if (gen === this.playGen) this.setLoading(null, false);
      }
      return;
    }

    const wasPlaying = this.playing;

    if (this.track && wasPlaying) {
      const ok = await this.crossfadeTo(track, gen);
      if (!ok && gen === this.playGen) {
        await this.hardCutTo(track, gen);
      }
      return;
    }

    await this.hardCutTo(track, gen);
  }

  toggle(track?: Track): void {
    const t = track ?? this.track;
    if (!t) return;
    if (this.track?.id === t.id && this.playing) {
      this.audioA.pause();
      this.audioB.pause();
      return;
    }
    void this.play(t);
  }

  pause(): void {
    this.cancelCrossfade();
    this.audioA.pause();
    this.audioB.pause();
  }

  prev(): void {
    if (!this.queue.length) return;
    if (this.activeEl.currentTime > 3) {
      this.activeEl.currentTime = 0;
      return;
    }
    const i = this.queue.findIndex((t) => t.id === this.track?.id);
    const prev = this.queue[i <= 0 ? this.queue.length - 1 : i - 1];
    if (prev) void this.play(prev);
  }

  next(fromUser = true): void {
    if (!fromUser && this.repeat === "one" && this.track) {
      this.activeEl.currentTime = 0;
      void this.activeEl.play();
      return;
    }
    const nextTrack = this.resolveNext(fromUser);
    if (nextTrack) void this.play(nextTrack);
  }

  private onTimeUpdate(el: HTMLAudioElement): void {
    const source = this.crossfading && this.timeEl ? this.timeEl : this.activeEl;
    if (el !== source) return;
    if (source.paused && !this.crossfading) return;
    this.cb.onTime(source.currentTime, source.duration || 0);
    if (!this.crossfading) this.maybeStartCrossfade();
  }

  private maybeStartCrossfade(): void {
    if (this.crossfading || this.crossfadeArmed || this.repeat === "one") return;

    const el = this.activeEl;
    const dur = el.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;

    const remaining = dur - el.currentTime;
    const lead = Math.min(CROSSFADE_SEC, Math.max(1.2, dur * 0.08));
    if (remaining > lead || remaining <= 0.05) return;

    const nextTrack = this.resolveNext(false);
    if (!nextTrack || nextTrack.id === this.track?.id) return;

    this.crossfadeArmed = true;
    const gen = this.playGen;
    void this.crossfadeTo(nextTrack, gen).then((ok) => {
      if (!ok && gen === this.playGen) {
        void this.hardCutTo(nextTrack, gen);
      }
    });
  }

  private onEnded(el: HTMLAudioElement): void {
    if (el !== this.activeEl || this.crossfading) return;

    if (this.repeat === "one" && this.track) {
      el.currentTime = 0;
      void el.play();
      return;
    }

    this.next(false);
  }

  seek(ratio: number): void {
    const el = this.crossfading && this.timeEl ? this.timeEl : this.activeEl;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    el.currentTime = Math.min(1, Math.max(0, ratio)) * el.duration;
    this.crossfadeArmed = false;
  }

  setVolume(v: number): void {
    this.userVolume = Math.min(1, Math.max(0, v));
    if (this.gainA && this.gainB) {
      this.audioA.volume = 1;
      this.audioB.volume = 1;
      if (this.crossfading) return;
      if (this.activeGain) this.activeGain.gain.value = this.userVolume;
      if (this.idleGain) this.idleGain.gain.value = 0;
      return;
    }
    this.audioA.volume = this.userVolume;
    this.audioB.volume = this.userVolume;
  }
}
