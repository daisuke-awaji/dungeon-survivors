import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import {
  GAME_WIDTH,
  MAX_ENEMIES,
  MAX_ENEMIES_BOSS_PHASE,
  MAX_PICKUPS,
  MIDBOSS_SECONDS,
  RUN_SECONDS,
} from '../config';
import { CHARACTERS, type CharacterDef } from '../data/characters';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { Fx } from '../game/Fx';
import {
  DEPTH,
  EnemyTint,
  PLAYER_RADIUS,
  type Enemy,
  type EnemyBullet,
  type Pickup,
  type PickupKind,
} from '../game/types';
import { WeaponSystem } from '../game/Weapons';
import { ATLAS, FLOOR } from '../gfx/atlas';
import { SpatialGrid } from '../logic/grid';
import { addXp } from '../logic/leveling';
import { applyRun, type RunResult } from '../logic/rewards';
import { applyChoice, drawChoices, newLoadout, type Choice, type Loadout } from '../logic/skills';
import { hpScale, pickEnemy, RUSH_INTERVAL, rushSize, spawnRate } from '../logic/spawn';
import { computeStats, type MetaLevels, type PlayerStats } from '../logic/stats';
import { getSave, setSave } from '../store';
import type { HudScene } from './HudScene';

export type GameMode = 'play' | 'choosing' | 'paused' | 'over';

const VIEW_MARGIN = 90;
const PLAYER_SCALE = 1.15;
const JOY_RADIUS = 90;
const INVULN_TIME = 0.6;
const LEVEL_UP_HEAL = 0.07;
const HEAL_RATIO = 0.3;
const BONUS_COINS = 25;
const COIN_DROP = 0.06;
const HEART_DROP = 0.012;
const MAGNET_DROP = 0.003;
const SLOW_TINT = 0x8fd0ff;
const WINDUP_TINT = 0xff7a7a;

export interface GameDebug {
  /** 自動プレイ用の入力。null ならふつうの操作 */
  input: { x: number; y: number } | null;
  /** 1フレームに何回分進めるか（早送り） */
  steps: number;
  /** レベルアップの選たく肢を自動で選ぶ関数 */
  autoPick: ((choices: Choice[]) => number) | null;
  damageDealt: number;
  invincible: boolean;
}

export class GameScene extends Phaser.Scene {
  px = 0;
  py = 0;
  hp = 0;
  level = 1;
  xp = 0;
  kills = 0;
  coins = 0;
  elapsed = 0;
  cleared = false;
  dragonSlain = false;
  mode: GameMode = 'play';
  viewH = 0;
  loadoutVersion = 0;
  stats!: PlayerStats;
  loadout!: Loadout;
  fx!: Fx;
  boss: Enemy | null = null;
  readonly grid = new SpatialGrid<Enemy>(96);
  readonly debug: GameDebug = { input: null, steps: 1, autoPick: null, damageDealt: 0, invincible: false };

  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private bullets: EnemyBullet[] = [];
  private activeEnemies = 0;
  private nextUid = 1;
  private char!: CharacterDef;
  private meta!: MetaLevels;
  private weapons!: WeaponSystem;
  private revivesLeft = 0;
  private invuln = 0;
  private hurtFlash = 0;
  private pendingLevels = 0;
  private spawnTimer = 0;
  private nextRush = RUSH_INTERVAL;
  private midBossSpawned = false;
  private walk = 0;
  private facingLeft = false;

  private joyId = -1;
  private joyOX = 0;
  private joyOY = 0;
  private joyX = 0;
  private joyY = 0;

  private floor!: Phaser.GameObjects.TileSprite;
  private playerSprite!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private hpBack!: Phaser.GameObjects.Rectangle;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private joyBase!: Phaser.GameObjects.Image;
  private joyKnob!: Phaser.GameObjects.Image;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key> | null;
  private readonly tmp: Enemy[] = [];
  private readonly sorted: Enemy[] = [];

  constructor() {
    super('Game');
  }

  private get hud(): HudScene {
    return this.scene.get('Hud') as HudScene;
  }

  create(): void {
    const save = getSave();
    this.char = CHARACTERS[save.selected];
    this.meta = save.meta;
    this.loadout = newLoadout(this.char.weapon);
    this.stats = computeStats(this.char, this.loadout.passives, this.meta);
    this.viewH = this.scale.height;

    this.px = 0;
    this.py = 0;
    this.hp = this.stats.maxHp;
    this.level = 1;
    this.xp = 0;
    this.kills = 0;
    this.coins = 0;
    this.elapsed = 0;
    this.cleared = false;
    this.dragonSlain = false;
    this.mode = 'play';
    this.loadoutVersion = 0;
    this.boss = null;
    this.enemies = [];
    this.pickups = [];
    this.bullets = [];
    this.activeEnemies = 0;
    this.nextUid = 1;
    this.revivesLeft = this.stats.revives;
    this.invuln = 1;
    this.hurtFlash = 0;
    this.pendingLevels = 0;
    this.spawnTimer = 0;
    this.nextRush = RUSH_INTERVAL;
    this.midBossSpawned = false;
    this.walk = 0;
    this.facingLeft = false;
    this.debug.input = null;
    this.debug.steps = 1;
    this.debug.autoPick = null;
    this.debug.damageDealt = 0;
    this.debug.invincible = false;
    this.grid.clear();

    this.floor = this.add
      .tileSprite(0, 0, GAME_WIDTH, this.viewH, FLOOR)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH.floor);
    // てきが多くても自分の位置がわかるよう、足元を光らせる
    this.aura = this.add
      .image(0, 0, ATLAS, 'glow')
      .setTint(0xfff2a8)
      .setAlpha(0.3)
      .setScale(1.25)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.actor - 2);
    this.shadow = this.add.image(0, 0, ATLAS, 'shadow').setDepth(DEPTH.actor - 1);
    this.playerSprite = this.add
      .image(0, 0, ATLAS, this.char.frame)
      .setOrigin(0.5, 0.6)
      .setScale(PLAYER_SCALE)
      .setDepth(DEPTH.actor + 2100);
    this.hpBack = this.add.rectangle(0, 0, 68, 12, 0x1b1530).setDepth(DEPTH.fx - 30);
    this.hpFill = this.add.rectangle(0, 0, 62, 6, 0x4ade80).setOrigin(0, 0.5).setDepth(DEPTH.fx - 29);
    this.joyBase = this.add.image(0, 0, ATLAS, 'joyBase').setScrollFactor(0).setDepth(DEPTH.ui).setVisible(false);
    this.joyKnob = this.add.image(0, 0, ATLAS, 'joyKnob').setScrollFactor(0).setDepth(DEPTH.ui).setVisible(false);

    this.fx = new Fx(this);
    this.weapons = new WeaponSystem(this);

    this.resetJoystick();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.keys = this.input.keyboard
      ? (this.input.keyboard.addKeys({
          up: Phaser.Input.Keyboard.KeyCodes.UP,
          down: Phaser.Input.Keyboard.KeyCodes.DOWN,
          left: Phaser.Input.Keyboard.KeyCodes.LEFT,
          right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
          w: Phaser.Input.Keyboard.KeyCodes.W,
          a: Phaser.Input.Keyboard.KeyCodes.A,
          s: Phaser.Input.Keyboard.KeyCodes.S,
          d: Phaser.Input.Keyboard.KeyCodes.D,
        }) as GameScene['keys'])
      : null;

    this.syncView();
    this.scene.launch('Hud');
  }

  // ---- 入力 ----

  private onPointerDown(p: Phaser.Input.Pointer): void {
    sfx.unlock();
    if (this.mode !== 'play' || this.joyId !== -1) return;
    this.joyId = p.id;
    this.joyOX = p.x;
    this.joyOY = p.y;
    this.joyX = 0;
    this.joyY = 0;
    this.joyBase.setPosition(p.x, p.y).setVisible(true);
    this.joyKnob.setPosition(p.x, p.y).setVisible(true);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyId || this.mode !== 'play') return;
    let dx = p.x - this.joyOX;
    let dy = p.y - this.joyOY;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      // 指が大きく動いたら、スティックの中心もついていく
      this.joyOX += (dx / len) * (len - JOY_RADIUS);
      this.joyOY += (dy / len) * (len - JOY_RADIUS);
      dx = p.x - this.joyOX;
      dy = p.y - this.joyOY;
    }
    this.joyX = dx / JOY_RADIUS;
    this.joyY = dy / JOY_RADIUS;
    this.joyBase.setPosition(this.joyOX, this.joyOY);
    this.joyKnob.setPosition(p.x, p.y);
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.joyId) this.resetJoystick();
  }

  private resetJoystick(): void {
    this.joyId = -1;
    this.joyX = 0;
    this.joyY = 0;
    this.joyBase.setVisible(false);
    this.joyKnob.setVisible(false);
  }

  private readInput(): { x: number; y: number } {
    if (this.debug.input) return this.debug.input;
    let x = this.joyX;
    let y = this.joyY;
    const k = this.keys;
    if (k) {
      if (k.left.isDown || k.a.isDown) x -= 1;
      if (k.right.isDown || k.d.isDown) x += 1;
      if (k.up.isDown || k.w.isDown) y -= 1;
      if (k.down.isDown || k.s.isDown) y += 1;
    }
    const len = Math.hypot(x, y);
    if (len < 0.12) return { x: 0, y: 0 };
    const mag = Math.min(1, len / 0.5);
    return { x: (x / len) * mag, y: (y / len) * mag };
  }

  // ---- メインループ ----

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    if (this.mode === 'play') {
      const steps = Math.max(1, Math.floor(this.debug.steps));
      for (let i = 0; i < steps && this.mode === 'play'; i++) this.step(dt);
    } else if (this.mode === 'over') {
      this.fx.update(dt);
    }
    this.syncView();
  }

  private step(dt: number): void {
    this.elapsed += dt;
    this.updateSpawns(dt);
    this.updatePlayer(dt);

    this.grid.clear();
    for (const e of this.enemies) if (e.active) this.grid.insert(e);

    this.updateEnemies(dt);
    this.weapons.update(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.fx.update(dt);

    if (this.pendingLevels > 0 && this.mode === 'play') this.openLevelUp();
  }

  private syncView(): void {
    const cam = this.cameras.main;
    cam.setScroll(this.px - GAME_WIDTH / 2, this.py - this.viewH / 2);
    this.floor.setTilePosition(cam.scrollX, cam.scrollY);

    const bob = Math.sin(this.walk) * 3;
    const blink = this.invuln > 0 && Math.floor(this.elapsed * 14) % 2 === 0;
    this.playerSprite
      .setPosition(this.px, this.py + bob)
      .setFlipX(this.facingLeft)
      .setAlpha(blink ? 0.45 : 1);
    if (this.hurtFlash > 0) this.playerSprite.setTint(0xff6b6b);
    else this.playerSprite.clearTint();
    this.shadow.setPosition(this.px, this.py + 38);
    this.aura.setPosition(this.px, this.py + 10).setScale(1.25 + Math.sin(this.elapsed * 4) * 0.08);

    const ratio = Phaser.Math.Clamp(this.hp / this.stats.maxHp, 0, 1);
    this.hpBack.setPosition(this.px, this.py + 58);
    this.hpFill
      .setPosition(this.px - 31, this.py + 58)
      .setScale(ratio, 1)
      .setFillStyle(ratio > 0.5 ? 0x4ade80 : ratio > 0.25 ? 0xfacc15 : 0xf87171);
  }

  private updatePlayer(dt: number): void {
    const input = this.readInput();
    const moving = input.x !== 0 || input.y !== 0;
    if (moving) {
      this.px += input.x * this.stats.moveSpeed * dt;
      this.py += input.y * this.stats.moveSpeed * dt;
      this.walk += dt * 16;
      if (Math.abs(input.x) > 0.2) this.facingLeft = input.x < 0;
    } else {
      this.walk = 0;
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
  }

  // ---- てきの出現 ----

  private updateSpawns(dt: number): void {
    const t = this.elapsed;

    if (!this.midBossSpawned && t >= MIDBOSS_SECONDS) {
      this.midBossSpawned = true;
      const [x, y] = this.edgePoint();
      this.spawnEnemy('orcKing', x, y);
      this.hud.banner('オークキングが\nあらわれた！', '#ff8a8a');
      sfx.play('warn');
    }

    if (!this.cleared && t >= RUN_SECONDS) this.onSurvived();

    const cap = this.cleared ? MAX_ENEMIES_BOSS_PHASE : MAX_ENEMIES;
    this.spawnTimer += dt * spawnRate(t);
    while (this.spawnTimer >= 1) {
      this.spawnTimer -= 1;
      if (this.activeEnemies >= cap) continue;
      const [x, y] = this.edgePoint();
      this.spawnEnemy(pickEnemy(t, Math.random), x, y);
    }

    if (!this.cleared && t >= this.nextRush) {
      this.nextRush += RUSH_INTERVAL;
      this.rush();
    }
  }

  /** 画面のすぐ外の点 */
  private edgePoint(): [number, number] {
    const hw = GAME_WIDTH / 2 + VIEW_MARGIN;
    const hh = this.viewH / 2 + VIEW_MARGIN;
    const sign = Math.random() < 0.5 ? -1 : 1;
    if (Math.random() * (hw + hh) < hw) {
      return [this.px + (Math.random() * 2 - 1) * hw, this.py + sign * hh];
    }
    return [this.px + sign * hw, this.py + (Math.random() * 2 - 1) * hh];
  }

  private rush(): void {
    const t = this.elapsed;
    const n = rushSize(t);
    const id: EnemyId = t < 100 ? 'bat' : pickEnemy(t, Math.random);
    const rx = GAME_WIDTH / 2 + VIEW_MARGIN;
    const ry = this.viewH / 2 + VIEW_MARGIN;
    for (let i = 0; i < n && this.activeEnemies < MAX_ENEMIES + 40; i++) {
      const a = (i / n) * Math.PI * 2;
      this.spawnEnemy(id, this.px + Math.cos(a) * rx, this.py + Math.sin(a) * ry);
    }
    this.hud.banner('てきの大ぐんだ！', '#ffd76a', 1200);
    sfx.play('warn');
  }

  private spawnEnemy(id: EnemyId, x: number, y: number): Enemy {
    const def = ENEMIES[id];
    let e = this.enemies.find((v) => !v.active);
    if (!e) {
      e = {
        active: false,
        uid: 0,
        def,
        x: 0,
        y: 0,
        radius: 0,
        hp: 0,
        maxHp: 0,
        speed: 0,
        damage: 0,
        slowT: 0,
        slowF: 1,
        kx: 0,
        ky: 0,
        flashT: 0,
        shieldCd: 0,
        phase: 0,
        tint: EnemyTint.None,
        aiT: 0,
        aiState: 0,
        dirX: 0,
        dirY: 0,
        sprite: this.add.image(0, 0, ATLAS, def.frame),
      };
      this.enemies.push(e);
    }
    e.active = true;
    e.uid = this.nextUid++;
    e.def = def;
    e.x = x;
    e.y = y;
    e.radius = def.radius;
    e.maxHp = Math.round(def.hp * (def.boss ? 1 : hpScale(this.elapsed)));
    e.hp = e.maxHp;
    e.speed = def.speed * (def.boss ? 1 : 0.9 + Math.random() * 0.2);
    e.damage = def.damage;
    e.slowT = 0;
    e.slowF = 1;
    e.kx = 0;
    e.ky = 0;
    e.flashT = 0;
    e.shieldCd = 0;
    e.phase = Math.random() * Math.PI * 2;
    e.tint = EnemyTint.None;
    e.aiT = def.boss ? 2.5 : 0;
    e.aiState = 0;
    e.sprite
      .setFrame(def.frame)
      .setPosition(x, y)
      .clearTint()
      .setAlpha(id === 'ghost' ? 0.85 : 1)
      .setVisible(true);
    this.activeEnemies++;
    if (def.boss && (!this.boss || def.boss >= this.boss.def.boss)) this.boss = e;
    return e;
  }

  // ---- てきの動き ----

  private updateEnemies(dt: number): void {
    const wobT = this.elapsed * 7;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const d = Math.hypot(dx, dy) || 0.001;

      if (!e.def.boss && d > 1500) {
        [e.x, e.y] = this.edgePoint();
        continue;
      }

      let mx = dx / d;
      let my = dy / d;
      let speed = e.speed;
      if (e.slowT > 0) {
        e.slowT -= dt;
        speed *= e.slowF;
      }

      if (e.def.boss === 1) {
        e.aiT -= dt;
        if (e.aiState === 0) {
          if (e.aiT <= 0 && d < 720) {
            e.aiState = 1;
            e.aiT = 0.8;
          }
        } else if (e.aiState === 1) {
          speed = 0;
          e.dirX = mx;
          e.dirY = my;
          if (e.aiT <= 0) {
            e.aiState = 2;
            e.aiT = 0.7;
          }
        } else {
          speed = e.speed * 3;
          mx = e.dirX;
          my = e.dirY;
          if (e.aiT <= 0) {
            e.aiState = 0;
            e.aiT = 3.5;
          }
        }
      } else if (e.def.boss === 2) {
        e.aiT -= dt;
        if (e.aiT <= 0) {
          e.aiT = 2.4;
          e.aiState++;
          this.dragonAttack(e, Math.atan2(dy, dx), e.aiState % 3 === 0);
        }
      }

      e.x += (mx * speed + e.kx) * dt;
      e.y += (my * speed + e.ky) * dt;
      const decay = Math.exp(-8 * dt);
      e.kx *= decay;
      e.ky *= decay;

      if (!e.def.boss) {
        this.tmp.length = 0;
        this.grid.query(e.x, e.y, e.radius * 0.8, this.tmp, 40);
        for (const o of this.tmp) {
          if (o === e || !o.active || o.def.boss) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const od = Math.hypot(ox, oy) || 0.01;
          const overlap = (e.radius + o.radius) * 0.85 - od;
          if (overlap > 0) {
            const push = Math.min(overlap, 140 * dt);
            e.x += (ox / od) * push;
            e.y += (oy / od) * push;
          }
        }
      }

      if (d < e.radius + PLAYER_RADIUS) this.hurtPlayer(e.damage);
      if (e.shieldCd > 0) e.shieldCd -= dt;
      if (e.flashT > 0) e.flashT -= dt;

      const want =
        e.flashT > 0
          ? EnemyTint.Flash
          : e.def.boss === 1 && e.aiState === 1
            ? EnemyTint.Windup
            : e.slowT > 0
              ? EnemyTint.Slow
              : EnemyTint.None;
      if (want !== e.tint) {
        e.tint = want;
        if (want === EnemyTint.Flash) e.sprite.setTintFill(0xffffff);
        else if (want === EnemyTint.Windup) e.sprite.setTint(WINDUP_TINT);
        else if (want === EnemyTint.Slow) e.sprite.setTint(SLOW_TINT);
        else e.sprite.clearTint();
      }

      const wob = Math.sin(wobT + e.phase) * 0.06;
      e.sprite
        .setPosition(e.x, e.y)
        .setScale(1 + wob, 1 - wob)
        .setDepth(DEPTH.actor + Phaser.Math.Clamp(e.y - this.py + 1000, 0, 2000));
    }
  }

  private dragonAttack(e: Enemy, aim: number, ring: boolean): void {
    const n = ring ? 16 : 5;
    for (let i = 0; i < n; i++) {
      const a = ring ? (i / n) * Math.PI * 2 : aim + (i - (n - 1) / 2) * 0.22;
      this.spawnBullet(e.x, e.y - 20, Math.cos(a) * 300, Math.sin(a) * 300, Math.round(e.damage * 0.6));
    }
    sfx.play('boom');
  }

  private spawnBullet(x: number, y: number, vx: number, vy: number, damage: number): void {
    let b = this.bullets.find((v) => !v.active);
    if (!b) {
      b = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        damage: 0,
        sprite: this.add.image(0, 0, ATLAS, 'efire').setDepth(DEPTH.fx - 15),
      };
      this.bullets.push(b);
    }
    b.active = true;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.life = 5;
    b.damage = damage;
    b.sprite.setPosition(x, y).setVisible(true);
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.sprite.setPosition(b.x, b.y);
      const hit = Math.hypot(b.x - this.px, b.y - this.py) < 16 + PLAYER_RADIUS;
      if (hit) this.hurtPlayer(b.damage);
      if (hit || b.life <= 0) {
        b.active = false;
        b.sprite.setVisible(false);
      }
    }
  }

  // ---- 武器から使う関数 ----

  /** 近い順に count 体まで返す。とどくところにボスがいれば、ボスを先頭にする */
  nearestEnemies(count: number, maxDist: number): Enemy[] {
    const out = this.sorted;
    out.length = 0;
    this.grid.query(this.px, this.py, maxDist, out);
    let n = 0;
    for (const e of out) if (e.active) out[n++] = e;
    out.length = n;
    out.sort((a, b) => this.targetOrder(a) - this.targetOrder(b));
    return out.slice(0, count);
  }

  private targetOrder(e: Enemy): number {
    return e.def.boss ? -1 : this.dist2(e);
  }

  private dist2(e: Enemy): number {
    return (e.x - this.px) ** 2 + (e.y - this.py) ** 2;
  }

  /**
   * 画面内のてきから、ランダムに count 体まで返す。
   * ボスがいれば先に選び、nearFirst を指定すると、そのきょりより近いてきを次に選ぶ
   */
  randomEnemiesInView(count: number, nearFirst = 0): Enemy[] {
    const hw = GAME_WIDTH / 2 - 20;
    const hh = this.viewH / 2 - 20;
    const boss: Enemy[] = [];
    const near: Enemy[] = [];
    const far: Enemy[] = [];
    for (const e of this.enemies) {
      if (!e.active || Math.abs(e.x - this.px) >= hw || Math.abs(e.y - this.py) >= hh) continue;
      if (e.def.boss) boss.push(e);
      else (this.dist2(e) < nearFirst * nearFirst ? near : far).push(e);
    }
    const out: Enemy[] = [];
    this.takeRandom(boss, count, out);
    this.takeRandom(near, count, out);
    this.takeRandom(far, count, out);
    return out;
  }

  private takeRandom(pool: Enemy[], count: number, out: Enemy[]): void {
    while (out.length < count && pool.length > 0) {
      const i = Math.floor(Math.random() * pool.length);
      out.push(pool[i]);
      pool[i] = pool[pool.length - 1];
      pool.pop();
    }
  }

  shake(intensity: number): void {
    this.cameras.main.shake(110, intensity);
  }

  damageEnemy(e: Enemy, base: number, kx = 0, ky = 0): void {
    if (!e.active) return;
    const amount = Math.max(1, Math.round(base * this.stats.damageMul));
    e.hp -= amount;
    e.flashT = 0.08;
    this.debug.damageDealt += amount;
    if (!e.def.boss) {
      e.kx += kx;
      e.ky += ky;
    }
    this.fx.number(e.x, e.y - e.radius - 6, String(amount), amount >= 50 ? 0xffe14d : 0xffffff, amount >= 50 ? 1.15 : 0.85);
    if (e.hp <= 0) this.killEnemy(e);
    else sfx.play('hit');
  }

  private killEnemy(e: Enemy): void {
    e.active = false;
    e.sprite.setVisible(false);
    this.activeEnemies--;
    this.kills++;
    sfx.play('kill');

    if (e.def.boss) {
      if (this.boss === e) this.boss = this.enemies.find((v) => v.active && v.def.boss) ?? null;
      this.fx.flash(e.x, e.y, 320, 0xffe9a8, 0.6);
      this.fx.ring(e.x, e.y, 360, 0xffffff, 0.5);
      this.fx.puff(e.x, e.y, 0xffd76a, 40);
      this.shake(0.012);
      sfx.play('boom');
      for (let i = 0; i < 10; i++) this.dropAround('gem', 14, e.x, e.y, 110);
      for (let i = 0; i < 8; i++) this.dropAround('coin', 5, e.x, e.y, 110);
      this.dropAround('heart', 1, e.x, e.y, 30);
      if (e.def.boss === 2) {
        this.dragonSlain = true;
        this.finish();
      } else {
        this.hud.banner(`${e.def.name}を たおした！`, '#ffe14d');
      }
      return;
    }

    this.fx.puff(e.x, e.y, 0xffffff, 5);
    this.spawnPickup('gem', e.def.xp, e.x, e.y);
    const r = Math.random();
    if (r < COIN_DROP) this.spawnPickup('coin', 1, e.x + 14, e.y + 8);
    else if (r < COIN_DROP + HEART_DROP) this.spawnPickup('heart', 1, e.x, e.y + 12);
    else if (r < COIN_DROP + HEART_DROP + MAGNET_DROP && !this.pickups.some((p) => p.active && p.kind === 'magnet'))
      this.spawnPickup('magnet', 1, e.x, e.y + 12);
  }

  private dropAround(kind: PickupKind, value: number, x: number, y: number, spread: number): void {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    this.spawnPickup(kind, value, x + Math.cos(a) * r, y + Math.sin(a) * r);
  }

  // ---- アイテム ----

  private gemFrame(value: number): string {
    return value >= 5 ? 'gem_l' : value >= 2 ? 'gem_m' : 'gem_s';
  }

  private spawnPickup(kind: PickupKind, value: number, x: number, y: number): void {
    let p = this.pickups.find((v) => !v.active);
    if (!p) {
      if (this.pickups.length >= MAX_PICKUPS) {
        // 上限に達したら、新しく作らずに今あるジェムへまとめる
        if (kind !== 'gem') return;
        const gem = this.pickups.find((v) => v.active && v.kind === 'gem');
        if (!gem) return;
        gem.value += value;
        gem.sprite.setFrame(this.gemFrame(gem.value));
        return;
      }
      p = {
        active: false,
        kind,
        value: 0,
        x: 0,
        y: 0,
        pull: false,
        speed: 0,
        sprite: this.add.image(0, 0, ATLAS, 'gem_s').setDepth(DEPTH.pickup),
      };
      this.pickups.push(p);
    }
    p.active = true;
    p.kind = kind;
    p.value = value;
    p.x = x;
    p.y = y;
    p.pull = false;
    p.speed = 0;
    p.sprite
      .setFrame(kind === 'gem' ? this.gemFrame(value) : kind)
      .setPosition(x, y)
      .setVisible(true);
  }

  private updatePickups(dt: number): void {
    const range = this.stats.pickupRange;
    for (const p of this.pickups) {
      if (!p.active) continue;
      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (!p.pull && d < range) p.pull = true;
      if (!p.pull) continue;
      p.speed = Math.min(1200, p.speed + 2600 * dt);
      const move = p.speed * dt;
      if (d <= move + 26) {
        p.active = false;
        p.sprite.setVisible(false);
        this.collect(p);
        continue;
      }
      p.x += (dx / d) * move;
      p.y += (dy / d) * move;
      p.sprite.setPosition(p.x, p.y);
    }
  }

  private collect(p: Pickup): void {
    switch (p.kind) {
      case 'gem': {
        const r = addXp({ level: this.level, xp: this.xp }, p.value * this.stats.xpMul);
        this.level = r.level;
        this.xp = r.xp;
        this.pendingLevels += r.gained;
        sfx.play('gem');
        break;
      }
      case 'coin':
        this.coins += p.value;
        sfx.play('coin');
        break;
      case 'heart':
        this.heal(this.stats.maxHp * HEAL_RATIO);
        break;
      case 'magnet':
        for (const o of this.pickups) if (o.active && o.kind !== 'magnet') o.pull = true;
        this.fx.ring(this.px, this.py, 500, 0xff8a8a, 0.5);
        sfx.play('heal');
        break;
    }
  }

  private heal(amount: number): void {
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    const gained = Math.round(this.hp - before);
    if (gained > 0) this.fx.number(this.px, this.py - 60, `+${gained}`, 0x6ee7a0, 1.1);
    this.fx.flash(this.px, this.py, 90, 0x6ee7a0, 0.35);
    sfx.play('heal');
  }

  // ---- プレイヤーのダメージ ----

  private hurtPlayer(damage: number): void {
    if (this.invuln > 0 || this.mode !== 'play' || this.debug.invincible) return;
    this.hp -= damage;
    this.invuln = INVULN_TIME;
    this.hurtFlash = 0.15;
    this.shake(0.008);
    this.hud.hurtFlash();
    sfx.play('hurt');
    if (this.hp > 0) return;

    if (this.revivesLeft > 0) {
      this.revivesLeft--;
      this.hp = Math.round(this.stats.maxHp * 0.5);
      this.invuln = 2.5;
      this.tmp.length = 0;
      this.grid.query(this.px, this.py, 460, this.tmp);
      for (const e of this.tmp) {
        const dx = e.x - this.px;
        const dy = e.y - this.py;
        const d = Math.hypot(dx, dy) || 1;
        this.damageEnemy(e, 150, (dx / d) * 700, (dy / d) * 700);
      }
      this.fx.ring(this.px, this.py, 460, 0xffe14d, 0.5);
      this.fx.flash(this.px, this.py, 300, 0xfff2a8, 0.5);
      this.hud.banner('ふっかつ！', '#ffe14d');
      sfx.play('evolve');
      return;
    }

    this.hp = 0;
    this.finish();
  }

  // ---- レベルアップ ----

  private openLevelUp(): void {
    this.mode = 'choosing';
    this.resetJoystick();
    const choices = drawChoices(this.loadout, Math.random);
    if (this.debug.autoPick) {
      const i = Phaser.Math.Clamp(Math.floor(this.debug.autoPick(choices)), 0, choices.length - 1);
      this.choose(choices[i]);
      return;
    }
    sfx.play('levelup');
    this.hud.showLevelUp(choices, (c) => this.choose(c));
  }

  private choose(choice: Choice): void {
    if (this.mode !== 'choosing') return;
    if (choice.kind === 'bonus') {
      if (choice.id === 'heal') this.heal(this.stats.maxHp * HEAL_RATIO);
      else this.coins += BONUS_COINS;
    } else {
      const oldMax = this.stats.maxHp;
      this.loadout = applyChoice(this.loadout, choice);
      this.stats = computeStats(this.char, this.loadout.passives, this.meta);
      if (this.stats.maxHp > oldMax) this.hp += this.stats.maxHp - oldMax;
      this.loadoutVersion++;
      if (choice.kind === 'evolve') {
        this.hud.banner(`${WEAPONS[choice.id].evoName}に\n進化した！`, '#ffe14d');
        this.fx.ring(this.px, this.py, 300, 0xffe14d, 0.6);
        sfx.play('evolve');
      }
    }
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * LEVEL_UP_HEAL);
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    this.mode = 'play';
    this.invuln = Math.max(this.invuln, 0.6);
    if (this.pendingLevels > 0) this.openLevelUp();
  }

  // ---- ポーズ・終了 ----

  setPaused(paused: boolean): void {
    if (paused && this.mode === 'play') {
      this.mode = 'paused';
      this.resetJoystick();
    } else if (!paused && this.mode === 'paused') {
      this.mode = 'play';
    }
  }

  /** 5分生き残った。画面のてきを一気にたおして、ドラゴンを出す */
  private onSurvived(): void {
    this.cleared = true;
    for (const e of this.enemies) {
      if (e.active && !e.def.boss) this.killEnemy(e);
    }
    this.fx.flash(this.px, this.py, 700, 0xffffff, 0.6);
    this.shake(0.01);
    const [x, y] = this.edgePoint();
    this.spawnEnemy('dragon', x, y);
    this.hud.banner('5分 生き残った！\nさいごのボス ドラゴン！', '#ffe14d', 3200);
    sfx.play('warn');
  }

  private finish(): void {
    if (this.mode === 'over') return;
    this.mode = 'over';
    this.resetJoystick();
    const run: RunResult = {
      time: this.elapsed,
      kills: this.kills,
      level: this.level,
      pickedCoins: this.coins,
      cleared: this.cleared,
      dragon: this.dragonSlain,
    };
    const result = applyRun(getSave(), run, this.stats.coinMul);
    setSave(result.save);
    sfx.play(this.cleared ? 'win' : 'lose');
    if (!this.dragonSlain) this.playerSprite.setAngle(90);
    this.time.delayedCall(this.dragonSlain ? 1500 : 900, () =>
      this.hud.showResult({ run, coins: result.coins, newBest: result.newBest }),
    );
  }
}
