import { RUN_SECONDS } from '../config';
import type { EnemyId, SpawnRule } from '../data/enemies';
import type { StageDef } from '../data/stages';
import { pickWeighted, type Rng } from './rng';

export const RUSH_INTERVAL = 40;

export function activeRules(stage: StageDef, t: number): SpawnRule[] {
  return stage.spawnRules.filter((r) => t >= r.from && t < r.to);
}

export function pickEnemy(stage: StageDef, t: number, rng: Rng): EnemyId {
  const rules = activeRules(stage, t);
  if (rules.length === 0) return stage.spawnRules[0].enemy;
  return pickWeighted(
    rules.map((r) => ({ item: r.enemy, weight: r.weight })),
    rng,
  );
}

/** 1秒あたりの出現数 */
export function spawnRate(stage: StageDef, t: number): number {
  if (t >= RUN_SECONDS) return 1.5;
  const p = Math.max(0, t) / RUN_SECONDS;
  return stage.rateBase + stage.rateGrowth * p;
}

/** 時間がたつほど、てきの HP が上がる */
export function hpScale(stage: StageDef, t: number): number {
  const p = Math.min(Math.max(0, t), RUN_SECONDS * 1.2) / RUN_SECONDS;
  return 1 + stage.hpGrowth * p;
}

/** 一定時間ごとに、てきがプレイヤーを囲んで出てくる数 */
export function rushSize(t: number): number {
  return Math.min(36, 10 + Math.floor(Math.max(0, t) / 12));
}
