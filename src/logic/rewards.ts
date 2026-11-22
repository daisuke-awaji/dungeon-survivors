import type { BestRecord, SaveData } from './save';

export interface RunResult {
  /** 生き残った秒数 */
  time: number;
  kills: number;
  level: number;
  /** プレイ中にひろったコイン */
  pickedCoins: number;
  cleared: boolean;
  dragon: boolean;
}

export const CLEAR_BONUS = 100;
export const DRAGON_BONUS = 200;

export function coinsEarned(run: RunResult, coinMul: number): number {
  const base =
    Math.max(0, run.pickedCoins) +
    Math.floor(Math.max(0, run.time) / 10) +
    Math.floor(Math.max(0, run.kills) / 25) +
    (run.cleared ? CLEAR_BONUS : 0) +
    (run.dragon ? DRAGON_BONUS : 0);
  return Math.floor(base * Math.max(1, coinMul));
}

/** クリア状きょう → 時間 → たおした数 の順で、前の記録より良いかを判定する */
export function isBetter(run: RunResult, best: BestRecord): boolean {
  const rank = (r: { cleared: boolean; dragon: boolean }) => (r.dragon ? 2 : r.cleared ? 1 : 0);
  if (rank(run) !== rank(best)) return rank(run) > rank(best);
  if (rank(run) === 0 && Math.floor(run.time) !== Math.floor(best.time)) return run.time > best.time;
  return run.kills > best.kills;
}

export function applyRun(save: SaveData, run: RunResult, coinMul: number): { save: SaveData; coins: number; newBest: boolean } {
  const coins = coinsEarned(run, coinMul);
  const newBest = isBetter(run, save.best);
  const best: BestRecord = newBest
    ? { time: Math.floor(run.time), kills: run.kills, level: run.level, cleared: run.cleared, dragon: run.dragon }
    : save.best;
  return { save: { ...save, coins: save.coins + coins, best, plays: save.plays + 1 }, coins, newBest };
}
