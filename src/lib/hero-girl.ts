/**
 * Hero girl — smooth continuous head-bob via spring + live audio envelopes.
 * Sets CSS vars only (never freezes transform to a static inline value).
 */

export class HeroGirl {
  private stage: HTMLElement | null = null;
  private host: HTMLElement | null = null;
  private playing = false;
  private raf = 0;
  private lastTs = 0;

  private y = 0;
  private rot = 0;
  private vy = 0;
  private vr = 0;
  private phase = 0;
  private bpm = 96;

  bind(host: HTMLElement | null): void {
    this.host = host;
    this.stage = host?.querySelector(".hero-girl-stage") ?? null;

    const frame = host?.querySelector<HTMLImageElement>(".hero-girl-frame");
    if (frame) {
      frame.classList.add("is-on");
      frame.hidden = false;
      frame.decoding = "sync";
      void frame.decode().catch(() => undefined);
    }

    this.write(0, 0);
    if (this.playing) this.ensureLoop();
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.lastTs = 0;

    if (!on) {
      this.stopLoop();
      this.y = 0;
      this.rot = 0;
      this.vy = 0;
      this.vr = 0;
      this.phase = 0;
      this.write(0, 0);
      this.stage?.classList.remove("is-live");
      return;
    }

    this.stage?.classList.add("is-live");
    this.ensureLoop();
  }

  onBeat(_beatIndex: number, bpm: number): void {
    if (!this.playing) return;
    this.bpm = Math.max(70, Math.min(160, bpm || 96));
    // Stronger impulse so the nod is obvious
    this.vy += 780;
    this.vr += 140;
    this.ensureLoop();
  }

  private ensureLoop(): void {
    if (!this.raf) this.tick(performance.now());
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (ts: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.playing) return;
    if (!this.stage || !this.stage.isConnected) {
      this.stage = this.host?.querySelector(".hero-girl-stage") ?? null;
      if (!this.stage) return;
      this.stage.classList.add("is-live");
    }

    const dt = this.lastTs ? Math.min(0.033, (ts - this.lastTs) / 1000) : 0.016;
    this.lastTs = ts;

    const stiff = 70;
    const damp = 11;
    this.vy += (-stiff * this.y - damp * this.vy) * dt;
    this.vr += (-stiff * this.rot - damp * this.vr) * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;

    const hz = this.bpm / 60;
    this.phase += hz * Math.PI * 2 * dt;
    // Continuous sway — visible even between kicks
    const swayY = (0.5 - 0.5 * Math.cos(this.phase)) * 7;
    const swayR = Math.sin(this.phase) * 2.4;

    this.write(this.y + swayY, this.rot + swayR);
  };

  /** Drive motion through CSS variables so audio envelopes can layer in CSS. */
  private write(nodY: number, nodR: number): void {
    if (!this.stage) return;
    const y = Math.max(-4, Math.min(22, nodY));
    const r = Math.max(-4, Math.min(10, nodR));
    this.stage.style.setProperty("--hero-nod-y", y.toFixed(2));
    this.stage.style.setProperty("--hero-nod-r", r.toFixed(2));
  }
}
