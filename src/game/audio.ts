/**
 * 100% Procedural Web Audio synthesizer for Taiwanese Temple soundscapes:
 * - Bronze temple bell (平安鐘)
 * - Hollow woodblock / muyu (木魚)
 * - Moon block clatter (擲筊落木)
 * - Bamboo fortune tube shake (搖籤筒)
 * - Pentatonic guzheng blessing chime (祈福古箏)
 * - Soft ambient chime pulse
 */
class TempleAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (!this.muted) {
      this.playChime(523.25);
    }
    return this.muted;
  }

  /** Rich metallic bronze temple bell (平安鐘) */
  public playTempleBell(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const partials = [
      { freq: 196, gain: 0.24, decay: 3.6 },
      { freq: 392.4, gain: 0.14, decay: 2.8 },
      { freq: 587.3, gain: 0.08, decay: 2.1 },
      { freq: 912.0, gain: 0.05, decay: 1.4 },
    ];

    for (const p of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      osc.frequency.exponentialRampToValueAtTime(p.freq * 0.996, now + p.decay);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(p.gain, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + p.decay + 0.05);
    }
  }

  /** Hollow woodblock / muyu tap on bow or worship */
  public playWoodblock(pitchScale = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const base = 540 * pitchScale * jitter;
    osc.frequency.setValueAtTime(base * 1.18, now);
    osc.frequency.exponentialRampToValueAtTime(base, now + 0.06);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Authentic wooden double-clatter for Moon Blocks (擲筊) */
  public playBweiClatter(outcome: 'sheng' | 'xiao' | 'yin'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const offsets = [0, 0.085, 0.19, 0.27];
    offsets.forEach((delay, idx) => {
      window.setTimeout(() => {
        this.playWoodblock(1.15 + idx * 0.11);
      }, delay * 1000);
    });

    if (outcome === 'sheng') {
      window.setTimeout(() => this.playBlessingFanfare(), 360);
    } else if (outcome === 'xiao') {
      window.setTimeout(() => {
        this.playChime(587.33);
        window.setTimeout(() => this.playChime(659.25), 110);
      }, 360);
    }
  }

  /** Bamboo fortune tube shake ticks (搖籤筒) */
  public playFortuneShake(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    for (let i = 0; i < 6; i++) {
      window.setTimeout(() => {
        this.playWoodblock(1.45 + (i % 3) * 0.14);
      }, i * 75);
    }
  }

  /** Single pentatonic chime note */
  public playChime(freq = 659.25): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  /** Warm Chinese pentatonic arpeggio (宮商角徵羽: C5 D5 E5 G5 A5 C6) */
  public playBlessingFanfare(): void {
    const notes = [523.25, 587.33, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      window.setTimeout(() => this.playChime(freq), i * 85);
    });
  }
}

export const templeAudio = new TempleAudioEngine();
