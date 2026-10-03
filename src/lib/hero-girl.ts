/**
 * Hero girl — hard head-nod on each beat (pose frames + CSS punch).
 */

export class HeroGirl {
  private stage: HTMLElement | null = null;
  private frames: HTMLImageElement[] = [];
  private playing = false;
  private pose = 0;
  private lastAt = 0;
  private nodTimer = 0;

  /** Sequence: neutral → down → neutral → up */
  private readonly cycle = [0, 1, 0, 2];

  bind(host: HTMLElement | null): void {
    this.stage = host?.querySelector(".hero-girl-stage") ?? null;
    this.frames = host ? Array.from(host.querySelectorAll<HTMLImageElement>(".hero-girl-frame")) : [];
    this.frames.forEach((el) => {
      el.decoding = "sync";
      void el.decode().catch(() => undefined);
    });
    this.paint(0);
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.pose = 0;
    this.lastAt = 0;
    window.clearTimeout(this.nodTimer);
    this.nodTimer = 0;
    this.stage?.classList.remove("is-nod");
    this.paint(0);
  }

  onBeat(_beatIndex: number, bpm: number): void {
    if (!this.playing || !this.stage || this.frames.length < 2) return;
    const period = 60000 / Math.max(70, Math.min(160, bpm || 96));
    const now = performance.now();
    if (now - this.lastAt < period * 0.45) return;
    this.lastAt = now;

    this.pose = (this.pose + 1) % this.cycle.length;
    this.paint(this.cycle[this.pose]!);

    this.stage.classList.remove("is-nod");
    // retrigger CSS nod punch
    void this.stage.offsetWidth;
    this.stage.classList.add("is-nod");
    window.clearTimeout(this.nodTimer);
    this.nodTimer = window.setTimeout(() => {
      this.stage?.classList.remove("is-nod");
      this.nodTimer = 0;
    }, 240);
  }

  private paint(frameIndex: number): void {
    const i = Math.max(0, Math.min(this.frames.length - 1, frameIndex));
    this.frames.forEach((el, idx) => {
      const on = idx === i;
      el.classList.toggle("is-on", on);
      el.style.visibility = on ? "visible" : "hidden";
      el.style.opacity = on ? "1" : "0";
    });
  }
}
