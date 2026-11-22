export interface XpState {
  level: number;
  xp: number;
}

/** 今のレベルから次のレベルまでに必要な経験値 */
export function xpToNext(level: number): number {
  const n = Math.max(0, Math.floor(level) - 1);
  return 4 + 3 * n + Math.floor(0.25 * n * n);
}

export function addXp(state: XpState, amount: number): XpState & { gained: number } {
  let { level, xp } = state;
  let gained = 0;
  xp += Math.max(0, amount);
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    gained++;
  }
  return { level, xp, gained };
}
