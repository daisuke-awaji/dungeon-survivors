import { RUN_SECONDS } from '../config';
import { SPAWN_RULES, type EnemyId, type SpawnRule } from '../data/enemies';
import { pickWeighted, type Rng } from './rng';

export const RUSH_INTERVAL = 40;

export function activeRules(t: number): SpawnRule[] {
  return SPAWN_RULES.filter((r) => t >= r.from && t < r.to);
}

export function pickEnemy(t: number, rng: Rng): EnemyId {
  const rules = activeRules(t);
  if (rules.length === 0) return 'slime';
  return pickWeighted(
    rules.map((r) => ({ item: r.enemy, weight: r.weight })),
    rng,
  );
}

/** 1秒あたりの出現数 */
export function spawnRate(t: number): number {
  if (t >= RUN_SECONDS) return 2.5;
  const p = Math.max(0, t) / RUN_SECONDS;
  return 1.2 + 6.3 * p;
}

/** 時間がたつほど、てきの HP が上がる */
export function hpScale(t: number): number {
  const p = Math.min(Math.max(0, t), RUN_SECONDS * 1.2) / RUN_SECONDS;
  return 1 + 1.4 * p;
}

/** 一定時間ごとに、てきがプレイヤーを囲んで出てくる数 */
export function rushSize(t: number): number {
  return Math.min(36, 10 + Math.floor(Math.max(0, t) / 12));
}
