import type { EnemyId, SpawnRule } from './enemies';

export type StageId = 'dungeon' | 'iceCave';

export interface StageDef {
  id: StageId;
  /** 画面に出す番号（1 から） */
  number: number;
  name: string;
  /** 床のテクスチャ */
  floor: string;
  /** ふつうのてきの出現表（秒） */
  spawnRules: SpawnRule[];
  midBoss: EnemyId;
  finalBoss: EnemyId;
  /** はじめのうちのラッシュで出てくるてき */
  earlyRush: EnemyId;
  /** たおした数の横に出す絵 */
  killIcon: string;
  /** 1秒あたりの出現数: 開始時と、5分かけて増える分 */
  rateBase: number;
  rateGrowth: number;
  /** てきの HP が5分かけて増える割合 */
  hpGrowth: number;
  /** この面の最後のボスをたおすと遊べるようになる。null なら最初から遊べる */
  requires: StageId | null;
}

export const STAGES: Record<StageId, StageDef> = {
  dungeon: {
    id: 'dungeon',
    number: 1,
    name: 'ダンジョン',
    floor: 'floor',
    spawnRules: [
      { enemy: 'slime', from: 0, to: 150, weight: 10 },
      { enemy: 'bat', from: 30, to: 240, weight: 6 },
      { enemy: 'goblin', from: 60, to: 9999, weight: 8 },
      { enemy: 'skeleton', from: 120, to: 9999, weight: 7 },
      { enemy: 'ghost', from: 180, to: 9999, weight: 6 },
      { enemy: 'orc', from: 210, to: 9999, weight: 3 },
    ],
    midBoss: 'orcKing',
    finalBoss: 'dragon',
    earlyRush: 'bat',
    killIcon: 'slime',
    rateBase: 1.0,
    rateGrowth: 4.3,
    hpGrowth: 0.9,
    requires: null,
  },
  iceCave: {
    id: 'iceCave',
    number: 2,
    name: '氷のどうくつ',
    floor: 'floor_ice',
    spawnRules: [
      { enemy: 'iceSlime', from: 0, to: 150, weight: 10 },
      { enemy: 'snowBat', from: 20, to: 240, weight: 6 },
      { enemy: 'iceWolf', from: 50, to: 9999, weight: 8 },
      { enemy: 'snowman', from: 100, to: 9999, weight: 3 },
      { enemy: 'iceGolem', from: 190, to: 9999, weight: 3 },
    ],
    midBoss: 'yeti',
    finalBoss: 'iceDragon',
    earlyRush: 'snowBat',
    killIcon: 'iceSlime',
    rateBase: 1.0,
    rateGrowth: 4.3,
    hpGrowth: 0.9,
    requires: 'dungeon',
  },
};

export const STAGE_IDS = Object.keys(STAGES) as StageId[];
