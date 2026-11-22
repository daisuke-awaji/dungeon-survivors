import Phaser from 'phaser';
import { ATLAS, DIGITS } from '../gfx/atlas';
import { DEPTH } from './types';

interface Transient {
  img: Phaser.GameObjects.Image;
  life: number;
  dur: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
}

interface FloatingNumber {
  txt: Phaser.GameObjects.BitmapText;
  life: number;
}

interface Lightning {
  pts: number[];
  life: number;
}

export interface SpriteFxOptions {
  /** 始まりと終わりの大きさ */
  s0: number;
  s1: number;
  a0?: number;
  a1?: number;
  dur: number;
  tint?: number;
  rotation?: number;
  originX?: number;
  additive?: boolean;
}

const NUMBER_POOL = 48;
const NUMBER_LIFE = 0.55;
const TRANSIENT_MAX = 90;
const LIGHTNING_LIFE = 0.16;

/** ダメージ数字・光・パーティクルなどの演出。すべて使い回して、プレイ中に作り直さない */
export class Fx {
  private readonly transients: Transient[] = [];
  private readonly numbers: FloatingNumber[] = [];
  private readonly lightnings: Lightning[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private numberIndex = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.fx + 2);
    this.emitter = scene.add
      .particles(0, 0, ATLAS, {
        frame: 'dot',
        lifespan: { min: 220, max: 440 },
        speed: { min: 70, max: 280 },
        scale: { start: 1.1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.fx + 1);
    for (let i = 0; i < NUMBER_POOL; i++) {
      const txt = scene.add.bitmapText(0, 0, DIGITS, '').setOrigin(0.5).setDepth(DEPTH.numbers).setVisible(false);
      this.numbers.push({ txt, life: 0 });
    }
  }

  number(x: number, y: number, text: string, tint = 0xffffff, scale = 1): void {
    const n = this.numbers[this.numberIndex];
    this.numberIndex = (this.numberIndex + 1) % NUMBER_POOL;
    n.life = NUMBER_LIFE;
    n.txt
      .setText(text)
      .setPosition(x + (Math.random() - 0.5) * 24, y)
      .setTint(tint)
      .setScale(scale)
      .setAlpha(1)
      .setVisible(true);
  }

  puff(x: number, y: number, tint: number, count: number): void {
    this.emitter.setParticleTint(tint);
    this.emitter.emitParticleAt(x, y, count);
  }

  sprite(frame: string, x: number, y: number, o: SpriteFxOptions): void {
    let t = this.transients.find((v) => v.life <= 0);
    if (!t) {
      if (this.transients.length >= TRANSIENT_MAX) return;
      t = { img: this.scene.add.image(0, 0, ATLAS, frame), life: 0, dur: 1, s0: 1, s1: 1, a0: 1, a1: 0 };
      this.transients.push(t);
    }
    t.life = t.dur = o.dur;
    t.s0 = o.s0;
    t.s1 = o.s1;
    t.a0 = o.a0 ?? 1;
    t.a1 = o.a1 ?? 0;
    t.img
      .setFrame(frame)
      .setOrigin(o.originX ?? 0.5, 0.5)
      .setPosition(x, y)
      .setRotation(o.rotation ?? 0)
      .setScale(o.s0)
      .setAlpha(t.a0)
      .setTint(o.tint ?? 0xffffff)
      .setBlendMode(o.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setDepth(DEPTH.fx)
      .setVisible(true);
  }

  /** 光の玉が広がって消える */
  flash(x: number, y: number, radius: number, tint: number, dur = 0.28): void {
    this.sprite('glow', x, y, { s0: radius / 90, s1: radius / 48, a0: 0.95, a1: 0, dur, tint, additive: true });
  }

  /** 輪が広がって消える */
  ring(x: number, y: number, radius: number, tint: number, dur = 0.35): void {
    this.sprite('ring', x, y, { s0: (radius * 0.25) / 120, s1: radius / 120, a0: 1, a1: 0, dur, tint });
  }

  lightning(x1: number, y1: number, x2: number, y2: number): void {
    const pts: number[] = [x1, y1];
    const segments = 7;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      pts.push(x1 + (x2 - x1) * t + (Math.random() - 0.5) * 56, y1 + (y2 - y1) * t);
    }
    pts.push(x2, y2);
    this.lightnings.push({ pts, life: LIGHTNING_LIFE });
  }

  update(dt: number): void {
    for (const t of this.transients) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.img.setVisible(false);
        continue;
      }
      const p = 1 - t.life / t.dur;
      t.img.setScale(t.s0 + (t.s1 - t.s0) * p).setAlpha(t.a0 + (t.a1 - t.a0) * p);
    }

    for (const n of this.numbers) {
      if (n.life <= 0) continue;
      n.life -= dt;
      if (n.life <= 0) {
        n.txt.setVisible(false);
        continue;
      }
      n.txt.y -= 80 * dt;
      n.txt.setAlpha(Math.min(1, n.life / 0.2));
    }

    this.gfx.clear();
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      const l = this.lightnings[i];
      l.life -= dt;
      if (l.life <= 0) {
        this.lightnings.splice(i, 1);
        continue;
      }
      const a = l.life / LIGHTNING_LIFE;
      this.strokePath(l.pts, 14, 0x7fc8ff, a * 0.45);
      this.strokePath(l.pts, 5, 0xffffff, a);
    }
  }

  private strokePath(pts: number[], width: number, color: number, alpha: number): void {
    this.gfx.lineStyle(width, color, alpha);
    this.gfx.beginPath();
    this.gfx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) this.gfx.lineTo(pts[i], pts[i + 1]);
    this.gfx.strokePath();
  }
}
