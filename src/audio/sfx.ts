export type SfxName =
  | 'hit'
  | 'kill'
  | 'gem'
  | 'coin'
  | 'levelup'
  | 'select'
  | 'hurt'
  | 'boom'
  | 'zap'
  | 'slash'
  | 'shoot'
  | 'ice'
  | 'warn'
  | 'win'
  | 'lose'
  | 'heal'
  | 'evolve'
  | 'buy'
  | 'deny';

const MIN_INTERVAL: Partial<Record<SfxName, number>> = {
  hit: 0.06,
  kill: 0.05,
  gem: 0.04,
  coin: 0.05,
  boom: 0.08,
  zap: 0.08,
  slash: 0.08,
  shoot: 0.08,
  hurt: 0.15,
};

type AudioCtor = typeof AudioContext;

/** 音声ファイルを使わず、Web Audio で効果音を合成する */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private readonly last = new Map<SfxName, number>();
  private gemCombo = 0;

  /** ブラウザの制限のため、最初のタップで呼ぶ */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor: AudioCtor | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.5);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      // iOS では、ほかのアプリから戻ったあと 'interrupted' になることがある
      if (this.ctx.state !== 'running') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo = freq,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, cutoff: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff * 0.2), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(name: SfxName): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const prev = this.last.get(name) ?? -1;
    if (now - prev < (MIN_INTERVAL[name] ?? 0)) return;
    this.last.set(name, now);

    switch (name) {
      case 'hit':
        this.tone(320, 0.05, 'square', 0.05, 180);
        break;
      case 'kill':
        this.tone(520, 0.09, 'triangle', 0.1, 140);
        break;
      case 'gem': {
        this.gemCombo = now - prev < 0.5 ? Math.min(10, this.gemCombo + 1) : 0;
        this.tone(700 + this.gemCombo * 55, 0.07, 'sine', 0.1, 1000 + this.gemCombo * 55);
        break;
      }
      case 'coin':
        this.tone(988, 0.06, 'square', 0.06);
        this.tone(1319, 0.14, 'square', 0.06, 1319, 0.06);
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'square', 0.09, f, i * 0.08));
        break;
      case 'select':
        this.tone(660, 0.07, 'triangle', 0.12, 880);
        break;
      case 'hurt':
        this.tone(180, 0.22, 'sawtooth', 0.16, 60);
        this.burst(0.12, 0.12, 900);
        break;
      case 'boom':
        this.burst(0.32, 0.3, 1400);
        this.tone(110, 0.25, 'sine', 0.2, 40);
        break;
      case 'zap':
        this.burst(0.14, 0.2, 6000);
        this.tone(1400, 0.12, 'sawtooth', 0.06, 200);
        break;
      case 'slash':
        this.burst(0.1, 0.1, 5000);
        break;
      case 'shoot':
        this.tone(900, 0.08, 'triangle', 0.06, 400);
        break;
      case 'ice':
        this.tone(1600, 0.3, 'sine', 0.08, 500);
        this.burst(0.25, 0.06, 8000);
        break;
      case 'warn':
        [0, 0.28, 0.56].forEach((d) => this.tone(330, 0.2, 'sawtooth', 0.12, 220, d));
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'square', 0.09, f, i * 0.11));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.14, f, i * 0.2));
        break;
      case 'heal':
        this.tone(440, 0.12, 'sine', 0.12, 880);
        this.tone(660, 0.18, 'sine', 0.1, 1320, 0.1);
        break;
      case 'evolve':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.07, f * 1.01, i * 0.07));
        break;
      case 'buy':
        this.tone(784, 0.08, 'square', 0.08);
        this.tone(1175, 0.18, 'square', 0.08, 1175, 0.08);
        break;
      case 'deny':
        this.tone(160, 0.16, 'square', 0.08, 120);
        break;
    }
  }
}

export const sfx = new Sfx();
