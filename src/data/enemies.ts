export type EnemyId =
  | 'slime'
  | 'bat'
  | 'goblin'
  | 'skeleton'
  | 'ghost'
  | 'orc'
  | 'orcKing'
  | 'dragon'
  | 'iceSlime'
  | 'snowBat'
  | 'iceWolf'
  | 'snowman'
  | 'iceGolem'
  | 'yeti'
  | 'iceDragon';

/** かまえてから、まっすぐ走ってくる動き */
export interface ChargeDef {
  /** このきょりより近いと、かまえ始める */
  range: number;
  windup: number;
  time: number;
  /** 走っている間の速度倍率 */
  mul: number;
  /** 次にかまえるまでの時間 */
  rest: number;
  /** 走り終わったときに投げる雪玉の数（0 なら投げない） */
  volley: number;
}

/** はなれた所から雪玉を投げる動き */
export interface ShootDef {
  /** このきょりより近いと投げる */
  range: number;
  /** このきょりより近づかない */
  hold: number;
  every: number;
  speed: number;
  /** 雪玉のダメージ */
  damage: number;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  frame: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  /** 0: ふつう, 1: 中ボス, 2: 最後のボス */
  boss: 0 | 1 | 2;
  charge?: ChargeDef;
  shoot?: ShootDef;
  /** 最後のボスがはくブレスの種類 */
  breath?: 'fire' | 'ice';
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  slime: { id: 'slime', name: 'スライム', frame: 'slime', hp: 10, speed: 80, damage: 5, radius: 22, xp: 1, boss: 0 },
  bat: { id: 'bat', name: 'コウモリ', frame: 'bat', hp: 6, speed: 150, damage: 4, radius: 18, xp: 1, boss: 0 },
  goblin: { id: 'goblin', name: 'ゴブリン', frame: 'goblin', hp: 24, speed: 110, damage: 7, radius: 24, xp: 2, boss: 0 },
  skeleton: { id: 'skeleton', name: 'ガイコツ', frame: 'skeleton', hp: 50, speed: 95, damage: 9, radius: 26, xp: 3, boss: 0 },
  ghost: { id: 'ghost', name: 'ゴースト', frame: 'ghost', hp: 36, speed: 135, damage: 9, radius: 26, xp: 3, boss: 0 },
  orc: { id: 'orc', name: 'オーク', frame: 'orc', hp: 160, speed: 85, damage: 15, radius: 38, xp: 8, boss: 0 },
  orcKing: {
    id: 'orcKing',
    name: 'オークキング',
    frame: 'orcKing',
    hp: 1500,
    speed: 105,
    damage: 20,
    radius: 72,
    xp: 0,
    boss: 1,
    charge: { range: 720, windup: 0.8, time: 0.7, mul: 3, rest: 3.5, volley: 0 },
  },
  dragon: {
    id: 'dragon',
    name: 'ドラゴン',
    frame: 'dragon',
    hp: 12000,
    speed: 90,
    damage: 28,
    radius: 105,
    xp: 0,
    boss: 2,
    breath: 'fire',
  },

  iceSlime: { id: 'iceSlime', name: 'アイススライム', frame: 'iceSlime', hp: 14, speed: 85, damage: 6, radius: 22, xp: 1, boss: 0 },
  snowBat: { id: 'snowBat', name: 'ゆきコウモリ', frame: 'snowBat', hp: 10, speed: 160, damage: 5, radius: 18, xp: 1, boss: 0 },
  iceWolf: {
    id: 'iceWolf',
    name: 'こおりオオカミ',
    frame: 'iceWolf',
    hp: 30,
    speed: 115,
    damage: 8,
    radius: 26,
    xp: 2,
    boss: 0,
    charge: { range: 340, windup: 0.5, time: 0.45, mul: 3.2, rest: 4, volley: 0 },
  },
  snowman: {
    id: 'snowman',
    name: 'ゆきだるま',
    frame: 'snowman',
    hp: 46,
    speed: 75,
    damage: 9,
    radius: 26,
    xp: 3,
    boss: 0,
    shoot: { range: 520, hold: 300, every: 4, speed: 210, damage: 7 },
  },
  iceGolem: { id: 'iceGolem', name: 'アイスゴーレム', frame: 'iceGolem', hp: 200, speed: 80, damage: 15, radius: 40, xp: 9, boss: 0 },
  yeti: {
    id: 'yeti',
    name: 'イエティ',
    frame: 'yeti',
    hp: 2000,
    speed: 110,
    damage: 24,
    radius: 74,
    xp: 0,
    boss: 1,
    charge: { range: 720, windup: 0.75, time: 0.7, mul: 3, rest: 3.2, volley: 3 },
  },
  iceDragon: {
    id: 'iceDragon',
    name: '氷のドラゴン',
    frame: 'iceDragon',
    hp: 15000,
    speed: 95,
    damage: 34,
    radius: 105,
    xp: 0,
    boss: 2,
    breath: 'ice',
  },
};

export interface SpawnRule {
  enemy: EnemyId;
  from: number;
  to: number;
  weight: number;
}
