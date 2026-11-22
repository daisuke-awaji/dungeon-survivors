import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import type { WeaponId, WeaponStats } from '../data/weapons';
import { ATLAS } from '../gfx/atlas';
import { weaponStats } from '../logic/skills';
import type { GameScene } from '../scenes/GameScene';
import { DEPTH, type Enemy, type Projectile } from './types';

interface IceWave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  damage: number;
  slowF: number;
  hit: Set<number>;
  img: Phaser.GameObjects.Image;
}

interface Meteor {
  x: number;
  y: number;
  t: number;
  damage: number;
  area: number;
  img: Phaser.GameObjects.Image;
}

const METEOR_FALL = 0.45;
const ICE_EXPAND = 0.38;
const SLASH_ORIGIN_X = 8 / 136;
const SLASH_REACH = 118;
const RING_RADIUS = 120;

/** 武器6種の動き。たまなどは使い回す */
export class WeaponSystem {
  private readonly timers: Record<WeaponId, number> = {
    sword: 0.3,
    bolt: 0.3,
    fireball: 0.5,
    thunder: 0.5,
    shield: 0,
    ice: 0.6,
  };
  private readonly projectiles: Projectile[] = [];
  private readonly shields: Phaser.GameObjects.Image[] = [];
  private readonly waves: IceWave[] = [];
  private readonly meteors: Meteor[] = [];
  private readonly tmp: Enemy[] = [];
  private readonly tmp2: Enemy[] = [];
  private shieldAngle = 0;

  constructor(private readonly g: GameScene) {}

  update(dt: number): void {
    for (const w of this.g.loadout.weapons) {
      const st = weaponStats(w);
      if (w.id === 'shield') {
        this.updateShield(st, w.evolved, dt);
        continue;
      }
      this.timers[w.id] -= dt;
      if (this.timers[w.id] > 0) continue;
      const fired = this.fire(w.id, st, w.evolved);
      this.timers[w.id] = fired ? st.cooldown * this.g.stats.cooldownMul : 0.12;
    }
    this.updateProjectiles(dt);
    this.updateWaves(dt);
    this.updateMeteors(dt);
  }

  private fire(id: WeaponId, st: WeaponStats, evolved: boolean): boolean {
    switch (id) {
      case 'sword':
        return this.fireSword(st);
      case 'bolt':
        return this.fireShots(st, 'bolt', evolved ? 'star' : 'bolt', 640);
      case 'fireball':
        return evolved ? this.fireMeteor(st) : this.fireShots(st, 'fire', 'fireball', 600);
      case 'thunder':
        return this.fireThunder(st, evolved);
      case 'ice':
        return this.fireIce(st, evolved);
      default:
        return false;
    }
  }

  private fireSword(st: WeaponStats): boolean {
    const g = this.g;
    const reach = st.area * g.stats.areaMul;
    const target = g.nearestEnemies(1, reach + 40)[0];
    if (!target) return false;

    const base = Math.atan2(target.y - g.py, target.x - g.px);
    const full = st.extra >= 360;
    const half = Phaser.Math.DegToRad(st.extra) / 2 + 0.15;

    this.tmp.length = 0;
    g.grid.query(g.px, g.py, reach, this.tmp);
    for (const e of this.tmp) {
      const dx = e.x - g.px;
      const dy = e.y - g.py;
      const d = Math.hypot(dx, dy) || 1;
      let hit = full || d < e.radius + 30;
      for (let i = 0; i < st.count && !hit; i++) {
        hit = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - base - i * Math.PI)) <= half;
      }
      if (hit) g.damageEnemy(e, st.damage, (dx / d) * 260, (dy / d) * 260);
    }

    if (full) {
      g.fx.ring(g.px, g.py, reach, 0xffe14d, 0.3);
      g.fx.flash(g.px, g.py, reach * 0.7, 0xfff2a8, 0.25);
    } else {
      const s = reach / SLASH_REACH;
      for (let i = 0; i < st.count; i++) {
        g.fx.sprite('slash', g.px, g.py, {
          s0: s * 0.8,
          s1: s * 1.05,
          dur: 0.2,
          rotation: base + i * Math.PI,
          originX: SLASH_ORIGIN_X,
        });
      }
    }
    sfx.play('slash');
    return true;
  }

  private fireShots(st: WeaponStats, kind: Projectile['kind'], frame: string, range: number): boolean {
    const g = this.g;
    const targets = g.nearestEnemies(st.count, range);
    if (targets.length === 0) return false;
    for (let i = 0; i < st.count; i++) {
      const t = targets[i % targets.length];
      let angle = Math.atan2(t.y - g.py, t.x - g.px);
      const lap = Math.floor(i / targets.length);
      if (lap > 0) angle += (lap % 2 === 1 ? 1 : -1) * 0.2 * Math.ceil(lap / 2);
      this.spawnProjectile(kind, frame, angle, st);
    }
    sfx.play('shoot');
    return true;
  }

  private spawnProjectile(kind: Projectile['kind'], frame: string, angle: number, st: WeaponStats): void {
    const g = this.g;
    let p = this.projectiles.find((v) => !v.active);
    if (!p) {
      p = {
        active: false,
        kind,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        damage: 0,
        pierce: 0,
        area: 0,
        life: 0,
        spin: 0,
        hit: [],
        sprite: g.add.image(0, 0, ATLAS, frame).setDepth(DEPTH.fx - 20),
      };
      this.projectiles.push(p);
    }
    p.active = true;
    p.kind = kind;
    p.x = g.px;
    p.y = g.py;
    p.vx = Math.cos(angle) * st.speed;
    p.vy = Math.sin(angle) * st.speed;
    p.radius = kind === 'bolt' ? st.area : 18;
    p.damage = st.damage;
    p.pierce = Math.max(1, st.pierce);
    p.area = st.area * g.stats.areaMul;
    p.life = kind === 'bolt' ? 1.1 : 1.5;
    p.spin = frame === 'star' ? 9 : 0;
    p.hit.length = 0;
    p.sprite.setFrame(frame).setPosition(p.x, p.y).setRotation(0).setVisible(true);
  }

  private updateProjectiles(dt: number): void {
    const g = this.g;
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.sprite.setPosition(p.x, p.y);
      if (p.spin) p.sprite.rotation += p.spin * dt;

      if (p.life <= 0) {
        if (p.kind === 'fire') this.explode(p.x, p.y, p.area, p.damage, false);
        this.retire(p);
        continue;
      }

      this.tmp.length = 0;
      g.grid.query(p.x, p.y, p.radius, this.tmp);
      for (const e of this.tmp) {
        if (!e.active) continue;
        if (p.kind === 'fire') {
          this.explode(p.x, p.y, p.area, p.damage, false);
          this.retire(p);
          break;
        }
        if (p.hit.includes(e.uid)) continue;
        p.hit.push(e.uid);
        g.damageEnemy(e, p.damage, p.vx * 0.25, p.vy * 0.25);
        if (--p.pierce <= 0) {
          this.retire(p);
          break;
        }
      }
    }
  }

  private retire(p: Projectile): void {
    p.active = false;
    p.sprite.setVisible(false);
  }

  private explode(x: number, y: number, radius: number, damage: number, big: boolean): void {
    const g = this.g;
    this.tmp2.length = 0;
    g.grid.query(x, y, radius, this.tmp2);
    for (const e of this.tmp2) {
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      g.damageEnemy(e, damage, (dx / d) * 200, (dy / d) * 200);
    }
    g.fx.flash(x, y, radius, 0xff9a3c, 0.3);
    g.fx.ring(x, y, radius, 0xffd76a, 0.25);
    g.fx.puff(x, y, 0xffb347, big ? 14 : 8);
    sfx.play('boom');
    if (big) g.shake(0.006);
  }

  private fireMeteor(st: WeaponStats): boolean {
    const g = this.g;
    const targets = g.randomEnemiesInView(st.count);
    if (targets.length === 0) return false;
    for (const t of targets) {
      this.meteors.push({
        x: t.x,
        y: t.y,
        t: METEOR_FALL,
        damage: st.damage,
        area: st.area * g.stats.areaMul,
        img: g.add.image(t.x, t.y, ATLAS, 'meteor').setDepth(DEPTH.fx - 5),
      });
    }
    return true;
  }

  private updateMeteors(dt: number): void {
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t -= dt;
      if (m.t <= 0) {
        this.explode(m.x, m.y, m.area, m.damage, true);
        m.img.destroy();
        this.meteors.splice(i, 1);
        continue;
      }
      const left = m.t / METEOR_FALL;
      m.img.setPosition(m.x + left * 150, m.y - left * 600).setRotation(left * 4);
    }
  }

  private fireThunder(st: WeaponStats, evolved: boolean): boolean {
    const g = this.g;
    const targets = g.randomEnemiesInView(st.count, 460);
    if (targets.length === 0) return false;
    const radius = st.area * g.stats.areaMul;
    const top = g.py - g.viewH / 2 - 60;
    for (const t of targets) {
      this.tmp2.length = 0;
      g.grid.query(t.x, t.y, radius, this.tmp2);
      for (const e of this.tmp2) g.damageEnemy(e, st.damage);
      g.fx.lightning(t.x + (Math.random() - 0.5) * 120, top, t.x, t.y);
      g.fx.flash(t.x, t.y, radius * 1.2, 0xbfe6ff, 0.22);
    }
    sfx.play('zap');
    if (evolved) g.shake(0.003);
    return true;
  }

  private updateShield(st: WeaponStats, evolved: boolean, dt: number): void {
    const g = this.g;
    const frame = evolved ? 'shield2' : 'shield';
    while (this.shields.length < st.count) {
      this.shields.push(g.add.image(0, 0, ATLAS, frame).setDepth(DEPTH.fx - 10));
    }
    this.shieldAngle += st.speed * dt;
    const orbit = st.area * g.stats.areaMul;
    const knock = evolved ? 420 : 140;
    for (let i = 0; i < st.count; i++) {
      const a = this.shieldAngle + (i * Math.PI * 2) / st.count;
      const x = g.px + Math.cos(a) * orbit;
      const y = g.py + Math.sin(a) * orbit;
      this.shields[i].setFrame(frame).setPosition(x, y);

      this.tmp.length = 0;
      g.grid.query(x, y, 24, this.tmp);
      for (const e of this.tmp) {
        if (!e.active || e.shieldCd > 0) continue;
        e.shieldCd = st.cooldown;
        const dx = e.x - g.px;
        const dy = e.y - g.py;
        const d = Math.hypot(dx, dy) || 1;
        g.damageEnemy(e, st.damage, (dx / d) * knock, (dy / d) * knock);
      }
    }
  }

  private fireIce(st: WeaponStats, evolved: boolean): boolean {
    const g = this.g;
    const maxR = st.area * g.stats.areaMul;
    if (g.nearestEnemies(1, maxR + 60).length === 0) return false;
    this.waves.push({
      x: g.px,
      y: g.py,
      r: 10,
      maxR,
      damage: st.damage,
      slowF: st.extra,
      hit: new Set(),
      img: g.add
        .image(g.px, g.py, ATLAS, 'ring')
        .setTint(evolved ? 0xe2f8ff : 0x9fe8ff)
        .setDepth(DEPTH.fx - 5),
    });
    if (evolved) g.fx.flash(g.px, g.py, maxR * 0.8, 0xbfefff, 0.4);
    sfx.play('ice');
    return true;
  }

  private updateWaves(dt: number): void {
    const g = this.g;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.r = Math.min(w.maxR, w.r + (w.maxR / ICE_EXPAND) * dt);
      w.img.setScale(w.r / RING_RADIUS).setAlpha(1 - 0.75 * (w.r / w.maxR) ** 2);

      this.tmp.length = 0;
      g.grid.query(w.x, w.y, w.r, this.tmp);
      for (const e of this.tmp) {
        if (!e.active || w.hit.has(e.uid)) continue;
        w.hit.add(e.uid);
        g.damageEnemy(e, w.damage);
        if (!e.active) continue;
        if (e.def.boss) {
          e.slowT = 1.2;
          e.slowF = Math.max(0.6, w.slowF);
        } else {
          e.slowT = w.slowF === 0 ? 1.8 : 2.4;
          e.slowF = w.slowF;
        }
      }

      if (w.r >= w.maxR) {
        w.img.destroy();
        this.waves.splice(i, 1);
      }
    }
  }
}
