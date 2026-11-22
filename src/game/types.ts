import type Phaser from 'phaser';
import type { EnemyDef } from '../data/enemies';

export const PLAYER_RADIUS = 18;

export const DEPTH = {
  floor: -10,
  pickup: 500,
  actor: 1000,
  fx: 5000,
  numbers: 6000,
  ui: 9000,
};

export enum EnemyTint {
  None,
  Flash,
  Slow,
  Windup,
}

export interface Enemy {
  active: boolean;
  uid: number;
  def: EnemyDef;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  /** おそくなっている残り時間と、そのときの速度倍率 */
  slowT: number;
  slowF: number;
  /** はじき飛ばされている速度 */
  kx: number;
  ky: number;
  flashT: number;
  shieldCd: number;
  phase: number;
  tint: EnemyTint;
  /** ボスの行動用 */
  aiT: number;
  aiState: number;
  /** れん発の残り回数と、次をうつまでの時間 */
  burst: number;
  burstT: number;
  dirX: number;
  dirY: number;
  sprite: Phaser.GameObjects.Image;
}

export interface Projectile {
  active: boolean;
  kind: 'bolt' | 'fire';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  area: number;
  life: number;
  spin: number;
  hit: number[];
  sprite: Phaser.GameObjects.Image;
}

export type PickupKind = 'gem' | 'coin' | 'heart' | 'magnet';

export interface Pickup {
  active: boolean;
  kind: PickupKind;
  value: number;
  x: number;
  y: number;
  pull: boolean;
  speed: number;
  sprite: Phaser.GameObjects.Image;
}

export interface EnemyBullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  /** 当たったプレイヤーの足がおそくなる時間（0 ならおそくならない） */
  chill: number;
  sprite: Phaser.GameObjects.Image;
}
