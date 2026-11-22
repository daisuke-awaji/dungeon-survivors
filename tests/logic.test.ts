import { describe, expect, it } from 'vitest';
import { GAME_WIDTH, MAX_HEIGHT, MIN_HEIGHT, RUN_SECONDS } from '../src/config';
import { CHARACTERS } from '../src/data/characters';
import { ENEMIES, SPAWN_RULES } from '../src/data/enemies';
import { SpatialGrid } from '../src/logic/grid';
import { computeGameHeight, formatTime } from '../src/logic/layout';
import { addXp, xpToNext } from '../src/logic/leveling';
import { applyRun, CLEAR_BONUS, coinsEarned, DRAGON_BONUS, isBetter, type RunResult } from '../src/logic/rewards';
import { mulberry32, pickWeighted, shuffle } from '../src/logic/rng';
import { defaultSave } from '../src/logic/save';
import { activeRules, hpScale, pickEnemy, rushSize, spawnRate } from '../src/logic/spawn';
import { BASE_HP, BASE_PICKUP, BASE_SPEED, computeStats, MIN_COOLDOWN_MUL } from '../src/logic/stats';

const noMeta = defaultSave().meta;

describe('leveling', () => {
  it('必要な経験値はレベルとともに増える', () => {
    expect(xpToNext(1)).toBe(5);
    for (let l = 1; l < 60; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('ちょうど必要な分でレベルが上がり、あまりは残る', () => {
    expect(addXp({ level: 1, xp: 0 }, 4)).toEqual({ level: 1, xp: 4, gained: 0 });
    expect(addXp({ level: 1, xp: 4 }, 1)).toEqual({ level: 2, xp: 0, gained: 1 });
    expect(addXp({ level: 1, xp: 0 }, 7)).toEqual({ level: 2, xp: 2, gained: 1 });
  });

  it('一度に何レベルも上がる', () => {
    const total = xpToNext(1) + xpToNext(2) + xpToNext(3);
    expect(addXp({ level: 1, xp: 0 }, total)).toEqual({ level: 4, xp: 0, gained: 3 });
  });

  it('負の値は無視する', () => {
    expect(addXp({ level: 3, xp: 2 }, -10)).toEqual({ level: 3, xp: 2, gained: 0 });
  });
});

describe('stats', () => {
  it('強化なしのけんしは基本値にキャラ補正だけがかかる', () => {
    const st = computeStats(CHARACTERS.knight, [], noMeta);
    expect(st.maxHp).toBe(Math.round(BASE_HP * 1.25));
    expect(st.moveSpeed).toBe(BASE_SPEED);
    expect(st.damageMul).toBe(1);
    expect(st.cooldownMul).toBe(1);
    expect(st.areaMul).toBe(1);
    expect(st.pickupRange).toBe(BASE_PICKUP);
    expect(st.revives).toBe(0);
  });

  it('パッシブと永続強化は足し合わせる', () => {
    const st = computeStats(CHARACTERS.knight, [{ id: 'power', level: 3 }], { ...noMeta, atk: 2 });
    expect(st.damageMul).toBeCloseTo(1 + 0.3 + 0.1);
  });

  it('キャラクターごとの特ちょうが出る', () => {
    const mage = computeStats(CHARACTERS.mage, [], noMeta);
    const thief = computeStats(CHARACTERS.thief, [], noMeta);
    expect(mage.cooldownMul).toBeLessThan(1);
    expect(mage.maxHp).toBeLessThan(BASE_HP);
    expect(thief.moveSpeed).toBeGreaterThan(BASE_SPEED);
    expect(thief.pickupRange).toBeGreaterThan(BASE_PICKUP);
  });

  it('こうげき間かくは下限より短くならない', () => {
    const st = computeStats({ ...CHARACTERS.mage, cooldownMul: 0.1 }, [{ id: 'book', level: 5 }], noMeta);
    expect(st.cooldownMul).toBe(MIN_COOLDOWN_MUL);
  });

  it('ふっかつを買っていると 1 回復活できる', () => {
    expect(computeStats(CHARACTERS.knight, [], { ...noMeta, revive: 1 }).revives).toBe(1);
  });

  it('各パッシブが対応するステータスだけを上げる', () => {
    const base = computeStats(CHARACTERS.knight, [], noMeta);
    expect(computeStats(CHARACTERS.knight, [{ id: 'heart', level: 5 }], noMeta).maxHp).toBe(base.maxHp * 2);
    expect(computeStats(CHARACTERS.knight, [{ id: 'boots', level: 5 }], noMeta).moveSpeed).toBeCloseTo(BASE_SPEED * 1.4);
    expect(computeStats(CHARACTERS.knight, [{ id: 'mushroom', level: 5 }], noMeta).areaMul).toBeCloseTo(1.5);
    expect(computeStats(CHARACTERS.knight, [{ id: 'magnet', level: 5 }], noMeta).pickupRange).toBeCloseTo(BASE_PICKUP * 2.5);
    expect(computeStats(CHARACTERS.knight, [{ id: 'book', level: 5 }], noMeta).cooldownMul).toBeCloseTo(0.6);
  });
});

describe('spawn', () => {
  it('0秒ではスライムだけが出る', () => {
    expect(activeRules(0).map((r) => r.enemy)).toEqual(['slime']);
    const rng = mulberry32(1);
    for (let i = 0; i < 20; i++) expect(pickEnemy(0, rng)).toBe('slime');
  });

  it('どの時間でも、出るてきが1種類以上いる', () => {
    for (let t = 0; t <= RUN_SECONDS + 120; t += 5) expect(activeRules(t).length).toBeGreaterThan(0);
  });

  it('出現表にボスは入っていない', () => {
    for (const r of SPAWN_RULES) expect(ENEMIES[r.enemy].boss).toBe(0);
  });

  it('時間とともに出現数と HP が上がる', () => {
    expect(spawnRate(RUN_SECONDS - 1)).toBeGreaterThan(spawnRate(0) * 4);
    expect(hpScale(0)).toBe(1);
    expect(hpScale(RUN_SECONDS)).toBeGreaterThan(2);
    for (let t = 0; t < RUN_SECONDS - 10; t += 10) expect(spawnRate(t + 10)).toBeGreaterThan(spawnRate(t));
  });

  it('ボス戦中は出現数が下がり、HP の上がり方に上限がある', () => {
    expect(spawnRate(RUN_SECONDS)).toBeLessThan(spawnRate(RUN_SECONDS - 1));
    expect(hpScale(10_000)).toBe(hpScale(RUN_SECONDS * 1.2));
  });

  it('ラッシュの数には上限がある', () => {
    expect(rushSize(0)).toBe(10);
    expect(rushSize(100_000)).toBe(36);
  });
});

describe('rewards', () => {
  const run: RunResult = { time: 125, kills: 260, level: 12, pickedCoins: 7, cleared: false, dragon: false };

  it('コイン = ひろった数 + 時間/10 + たおした数/25', () => {
    expect(coinsEarned(run, 1)).toBe(7 + 12 + 10);
  });

  it('クリアとドラゴンでボーナスがつく', () => {
    expect(coinsEarned({ ...run, cleared: true }, 1)).toBe(29 + CLEAR_BONUS);
    expect(coinsEarned({ ...run, cleared: true, dragon: true }, 1)).toBe(29 + CLEAR_BONUS + DRAGON_BONUS);
  });

  it('コイン倍率をかけて切り捨てる。1 より小さい倍率は使わない', () => {
    expect(coinsEarned(run, 1.5)).toBe(43);
    expect(coinsEarned(run, 0)).toBe(29);
  });

  it('記録の比べ方: クリア > 時間 > たおした数', () => {
    const best = { time: 125, kills: 260, level: 12, cleared: false, dragon: false };
    expect(isBetter(run, best)).toBe(false);
    expect(isBetter({ ...run, time: 126 }, best)).toBe(true);
    expect(isBetter({ ...run, kills: 261 }, best)).toBe(true);
    expect(isBetter({ ...run, time: 10, kills: 1, cleared: true }, best)).toBe(true);
    expect(isBetter({ ...run, time: 999 }, { ...best, cleared: true })).toBe(false);
    expect(isBetter({ ...run, cleared: true, dragon: true }, { ...best, cleared: true })).toBe(true);
  });

  it('applyRun はコインを足し、記録を更新し、プレイ回数を増やす', () => {
    const save = { ...defaultSave(), coins: 50 };
    const r = applyRun(save, run, 1);
    expect(r.coins).toBe(29);
    expect(r.newBest).toBe(true);
    expect(r.save.coins).toBe(79);
    expect(r.save.plays).toBe(1);
    expect(r.save.best).toEqual({ time: 125, kills: 260, level: 12, cleared: false, dragon: false });
    expect(save.coins).toBe(50);
  });

  it('記録に届かないときは、記録は変わらない', () => {
    const save = { ...defaultSave(), best: { time: 200, kills: 500, level: 20, cleared: false, dragon: false } };
    const r = applyRun(save, run, 1);
    expect(r.newBest).toBe(false);
    expect(r.save.best).toBe(save.best);
  });
});

describe('rng', () => {
  it('shuffle は中身を変えずに並べかえ、元の配列は変えない', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffle(src, mulberry32(9));
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pickWeighted は重みが 0 のものを選ばない', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 100; i++) {
      expect(
        pickWeighted(
          [
            { item: 'a', weight: 0 },
            { item: 'b', weight: 1 },
          ],
          rng,
        ),
      ).toBe('b');
    }
  });

  it('pickWeighted は空のリストでエラーになる', () => {
    expect(() => pickWeighted([], mulberry32(1))).toThrow();
  });

  it('mulberry32 は 0 以上 1 未満を返す', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('SpatialGrid', () => {
  const mk = (x: number, y: number, radius = 10) => ({ x, y, radius });

  it('円と重なるものだけを返す（相手の半径もふくめる）', () => {
    const grid = new SpatialGrid<{ x: number; y: number; radius: number }>(96);
    const near = mk(50, 0);
    const edge = mk(110, 0, 10);
    const far = mk(111, 0, 10);
    for (const e of [near, edge, far]) grid.insert(e);
    const out = grid.query(0, 0, 100, []);
    expect(out).toContain(near);
    expect(out).toContain(edge);
    expect(out).not.toContain(far);
  });

  it('マス目の境界や負の座標をまたいでも見つかる', () => {
    const grid = new SpatialGrid<{ x: number; y: number; radius: number }>(96);
    const items = [mk(-5, -5), mk(5, 5), mk(-200, 300), mk(95, 97)];
    for (const e of items) grid.insert(e);
    expect(grid.query(0, 0, 20, [])).toHaveLength(2);
    expect(grid.query(-200, 300, 1, [])).toEqual([items[2]]);
    expect(grid.query(96, 96, 5, [])).toEqual([items[3]]);
  });

  it('総当たりと同じ結果になる', () => {
    const rng = mulberry32(77);
    const grid = new SpatialGrid<{ x: number; y: number; radius: number }>(96);
    const items = Array.from({ length: 300 }, () => mk(rng() * 2000 - 1000, rng() * 2000 - 1000, 10 + rng() * 100));
    for (const e of items) grid.insert(e);
    for (let i = 0; i < 30; i++) {
      const x = rng() * 2000 - 1000;
      const y = rng() * 2000 - 1000;
      const r = rng() * 300;
      const expected = items.filter((e) => Math.hypot(e.x - x, e.y - y) <= r + e.radius);
      expect(new Set(grid.query(x, y, r, []))).toEqual(new Set(expected));
    }
  });

  it('clear すると空になり、入れ直せる', () => {
    const grid = new SpatialGrid<{ x: number; y: number; radius: number }>(96);
    grid.insert(mk(0, 0));
    grid.clear();
    expect(grid.query(0, 0, 500, [])).toHaveLength(0);
    grid.insert(mk(10, 10));
    expect(grid.query(0, 0, 500, [])).toHaveLength(1);
  });
});

describe('layout', () => {
  it('スマホの縦画面では縦横比どおりの高さになる', () => {
    expect(computeGameHeight(390, 844)).toBe(Math.round((GAME_WIDTH * 844) / 390));
  });

  it('横長の画面では最小の高さ、とても縦長なら最大の高さになる', () => {
    expect(computeGameHeight(1920, 1080)).toBe(MIN_HEIGHT);
    expect(computeGameHeight(300, 2000)).toBe(MAX_HEIGHT);
  });

  it('大きさが取れないときは最小の高さ', () => {
    expect(computeGameHeight(0, 0)).toBe(MIN_HEIGHT);
    expect(computeGameHeight(NaN, 100)).toBe(MIN_HEIGHT);
  });

  it('formatTime は 分:秒 にする', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(300)).toBe('5:00');
    expect(formatTime(-3)).toBe('0:00');
  });
});
