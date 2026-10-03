/**
 * Hero girl — continuous spring head-bob (no frame swapping).
 */

export class HeroGirl {
  private stage: HTMLElement | null = null;
  private root: HTMLElement | null = null;
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
    this.stage = host?.querySelector(".hero-girl-stage") ?? null;
    this.root = host?.closest("#app") ?? document.getElementById("app");

    const frames = host ? Array.from(host.querySelectorAll<HTMLImageElement>(".hero-girl-frame")) : [];
    frames.forEach((el, i) => {
      const on = i === 0;
      el.classList.toggle("is-on", on);
      el.hidden = !on;
      el.style.visibility = on ? "visible" : "hidden";
      el.style.opacity = on ? "1" : "0";
      if (on) {
        el.decoding = "sync";
        void el.decode().catch(() => undefined);
      }
    });

    this.apply(0, 0);
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.y = 0;
    this.rot = 0;
    this.vy = 0;
    this.vr = 0;
    this.phase = 0;
    this.lastTs = 0;
    if (!on) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.apply(0, 0);
      return;
    }
    if (!this.raf) this.tick(performance.now());
  }

  onBeat(_beatIndex: number, bpm: number): void {
    if (!this.playing || !this.stage) return;
    this.bpm = Math.max(70, Math.min(160, bpm || 96));
    // Soft impulse — spring carries the motion (no pose cut)
    this.vy += 520;
    this.vr += 95;
    if (!this.raf) this.tick(performance.now());
  }

  private tick = (ts: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.playing || !this.stage) return;

    const dt = this.lastTs ? Math.min(0.033, (ts - this.lastTs) / 1000) : 0.016;
    this.lastTs = ts;

    // Critically-damped-ish spring back to rest
    const stiff = 92;
    const damp = 14;
    this.vy += (-stiff * this.y - damp * this.vy) * dt;
    this.vr += (-stiff * this.rot - damp * this.vr) * dt;
    this.y += this.vy * dt;
    this.rot += this.vr * dt;

    // Continuous BPM sway (smooth sine, not stepped frames)
    const hz = this.bpm / 60;
    this.phase += hz * Math.PI * 2 * dt;
    const swayY = Math.sin(this.phase) * 3.2;
    const swayR = Math.sin(this.phase * 0.5 + 0.4) * 1.1;

    // Live audio envelopes from BeatMotion CSS vars
    const kick = this.readVar("--kick");
    const bass = this.readVar("--bass");
    const beat = this.readVar("--beat");

    const y = this.y + swayY + kick * 11 + bass * 4.5;
    const r = this.rot + swayR + kick * 4.2 + beat * 1.2;
    this.apply(y, r);
  };

  private readVar(name: string): number {
    if (!this.root) return 0;
    // BeatMotion writes these inline — cheaper than getComputedStyle each frame
    const v = this.root.style.getPropertyValue(name).trim();
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  private apply(y: number, r: number): void {
    if (!this.stage) return;
    const yy = Math.max(-2, Math.min(18, y));
    const rr = Math.max(-3, Math.min(8, r));
    this.stage.style.transform = `scale(var(--hero-girl-scale, 0.92)) translate3d(0, ${yy.toFixed(2)}px, 0) rotate(${rr.toFixed(2)}deg)`;
  }
}
