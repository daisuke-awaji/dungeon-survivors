export type EnemyId = 'slime' | 'bat' | 'goblin' | 'skeleton' | 'ghost' | 'orc' | 'orcKing' | 'dragon';

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
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  slime: { id: 'slime', name: 'スライム', frame: 'slime', hp: 10, speed: 80, damage: 6, radius: 22, xp: 1, boss: 0 },
  bat: { id: 'bat', name: 'コウモリ', frame: 'bat', hp: 6, speed: 150, damage: 5, radius: 18, xp: 1, boss: 0 },
  goblin: { id: 'goblin', name: 'ゴブリン', frame: 'goblin', hp: 24, speed: 110, damage: 9, radius: 24, xp: 2, boss: 0 },
  skeleton: { id: 'skeleton', name: 'ガイコツ', frame: 'skeleton', hp: 50, speed: 95, damage: 12, radius: 26, xp: 3, boss: 0 },
  ghost: { id: 'ghost', name: 'ゴースト', frame: 'ghost', hp: 36, speed: 135, damage: 12, radius: 26, xp: 3, boss: 0 },
  orc: { id: 'orc', name: 'オーク', frame: 'orc', hp: 160, speed: 85, damage: 20, radius: 38, xp: 8, boss: 0 },
  orcKing: { id: 'orcKing', name: 'オークキング', frame: 'orcKing', hp: 2600, speed: 105, damage: 28, radius: 72, xp: 0, boss: 1 },
  dragon: { id: 'dragon', name: 'ドラゴン', frame: 'dragon', hp: 16000, speed: 90, damage: 35, radius: 105, xp: 0, boss: 2 },
};

export interface SpawnRule {
  enemy: EnemyId;
  from: number;
  to: number;
  weight: number;
}

/** ふつうのてきの出現表（秒） */
export const SPAWN_RULES: SpawnRule[] = [
  { enemy: 'slime', from: 0, to: 150, weight: 10 },
  { enemy: 'bat', from: 30, to: 240, weight: 6 },
  { enemy: 'goblin', from: 60, to: 9999, weight: 8 },
  { enemy: 'skeleton', from: 120, to: 9999, weight: 7 },
  { enemy: 'ghost', from: 180, to: 9999, weight: 6 },
  { enemy: 'orc', from: 210, to: 9999, weight: 3 },
];
