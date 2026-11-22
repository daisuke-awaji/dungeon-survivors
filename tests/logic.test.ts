import { describe, expect, it } from 'vitest';
import { GAME_WIDTH, MAX_HEIGHT, MIN_HEIGHT, RUN_SECONDS } from '../src/config';
import { CHARACTERS } from '../src/data/characters';
import { ENEMIES } from '../src/data/enemies';
import { META } from '../src/data/meta';
import { STAGE_IDS, STAGES } from '../src/data/stages';
import { SpatialGrid } from '../src/logic/grid';
import { computeGameHeight, formatTime, TITLE_SIZES, titleLayout } from '../src/logic/layout';
import { addXp, xpToNext } from '../src/logic/leveling';
import { applyRun, CLEAR_BONUS, coinsEarned, DRAGON_BONUS, isBetter, type RunResult } from '../src/logic/rewards';
import { mulberry32, pickWeighted, shuffle } from '../src/logic/rng';
import { defaultBest, defaultSave } from '../src/logic/save';
import { activeRules, hpScale, pickEnemy, rushSize, spawnRate } from '../src/logic/spawn';
import { isStageUnlocked, selectStage, unlockedStages } from '../src/logic/stages';
import { BASE_HP, BASE_PICKUP, BASE_SPEED, computeStats, MIN_COOLDOWN_MUL } from '../src/logic/stats';

const noMeta = defaultSave().meta;

describe('leveling', () => {
  it('必要な経験値はレベルとともに増える', () => {
    expect(xpToNext(1)).toBe(4);
    for (let l = 1; l < 60; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('ちょうど必要な分でレベルが上がり、あまりは残る', () => {
    expect(addXp({ level: 1, xp: 0 }, 3)).toEqual({ level: 1, xp: 3, gained: 0 });
    expect(addXp({ level: 1, xp: 3 }, 1)).toEqual({ level: 2, xp: 0, gained: 1 });
    expect(addXp({ level: 1, xp: 0 }, 6)).toEqual({ level: 2, xp: 2, gained: 1 });
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
    expect(st.damageMul).toBeCloseTo(1 + 0.3 + 2 * META.atk.perLevel);
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
  const dungeon = STAGES.dungeon;

  it('0秒ではスライムだけが出る', () => {
    expect(activeRules(dungeon, 0).map((r) => r.enemy)).toEqual(['slime']);
    const rng = mulberry32(1);
    for (let i = 0; i < 20; i++) expect(pickEnemy(dungeon, 0, rng)).toBe('slime');
  });

  it('ラッシュの数には上限がある', () => {
    expect(rushSize(0)).toBe(10);
    expect(rushSize(100_000)).toBe(36);
  });

  describe.each(STAGE_IDS)('面 %s', (id) => {
    const stage = STAGES[id];

    it('どの時間でも、出るてきが1種類以上いる', () => {
      for (let t = 0; t <= RUN_SECONDS + 120; t += 5) expect(activeRules(stage, t).length).toBeGreaterThan(0);
    });

    it('出現表にボスは入っておらず、ボスは中ボスと最後のボスになっている', () => {
      for (const r of stage.spawnRules) expect(ENEMIES[r.enemy].boss).toBe(0);
      expect(ENEMIES[stage.earlyRush].boss).toBe(0);
      expect(ENEMIES[stage.midBoss].boss).toBe(1);
      expect(ENEMIES[stage.finalBoss].boss).toBe(2);
    });

    it('時間とともに出現数と HP が上がる', () => {
      expect(spawnRate(stage, RUN_SECONDS - 1)).toBeGreaterThan(spawnRate(stage, 0) * 4);
      expect(hpScale(stage, 0)).toBe(1);
      expect(hpScale(stage, RUN_SECONDS)).toBeGreaterThan(1.5);
      for (let t = 0; t < RUN_SECONDS - 10; t += 10)
        expect(spawnRate(stage, t + 10)).toBeGreaterThan(spawnRate(stage, t));
    });

    it('ボス戦中は出現数が下がり、HP の上がり方に上限がある', () => {
      expect(spawnRate(stage, RUN_SECONDS)).toBeLessThan(spawnRate(stage, RUN_SECONDS - 1));
      expect(hpScale(stage, 10_000)).toBe(hpScale(stage, RUN_SECONDS * 1.2));
    });
  });
});

describe('stages', () => {
  it('面1の中身は、面が1つだけだったころと同じ', () => {
    const d = STAGES.dungeon;
    expect(d.spawnRules).toEqual([
      { enemy: 'slime', from: 0, to: 150, weight: 10 },
      { enemy: 'bat', from: 30, to: 240, weight: 6 },
      { enemy: 'goblin', from: 60, to: 9999, weight: 8 },
      { enemy: 'skeleton', from: 120, to: 9999, weight: 7 },
      { enemy: 'ghost', from: 180, to: 9999, weight: 6 },
      { enemy: 'orc', from: 210, to: 9999, weight: 3 },
    ]);
    expect([d.midBoss, d.finalBoss, d.earlyRush]).toEqual(['orcKing', 'dragon', 'bat']);
    expect(spawnRate(d, 0)).toBe(1);
    expect(spawnRate(d, 150)).toBeCloseTo(1 + 4.3 * 0.5, 10);
    expect(hpScale(d, 300)).toBeCloseTo(1.9, 10);
    const stats = (id: keyof typeof ENEMIES) => {
      const e = ENEMIES[id];
      return [e.hp, e.speed, e.damage, e.radius, e.xp];
    };
    expect(stats('slime')).toEqual([10, 80, 5, 22, 1]);
    expect(stats('bat')).toEqual([6, 150, 4, 18, 1]);
    expect(stats('goblin')).toEqual([24, 110, 7, 24, 2]);
    expect(stats('skeleton')).toEqual([50, 95, 9, 26, 3]);
    expect(stats('ghost')).toEqual([36, 135, 9, 26, 3]);
    expect(stats('orc')).toEqual([160, 85, 15, 38, 8]);
    expect(stats('orcKing')).toEqual([1500, 105, 20, 72, 0]);
    expect(stats('dragon')).toEqual([12000, 90, 28, 105, 0]);
    expect(ENEMIES.orcKing.charge).toEqual({ range: 720, windup: 0.8, time: 0.7, mul: 3, rest: 3.5, volley: 0 });
    expect(ENEMIES.dragon.breath).toBe('fire');
  });

  it('面2のてきは、面1のてきとは別の種類', () => {
    const first = new Set(STAGES.dungeon.spawnRules.map((r) => r.enemy));
    for (const r of STAGES.iceCave.spawnRules) expect(first.has(r.enemy)).toBe(false);
    expect(STAGES.iceCave.midBoss).not.toBe(STAGES.dungeon.midBoss);
    expect(STAGES.iceCave.finalBoss).not.toBe(STAGES.dungeon.finalBoss);
  });

  it('面2は面1より強い（最初のてき・一番かたいてき・ボスの HP とダメージ。出現数と HP の上がり方は面1以上）', () => {
    const a = STAGES.dungeon;
    const b = STAGES.iceCave;
    const first = (s: typeof a) => ENEMIES[s.spawnRules[0].enemy];
    const toughest = (s: typeof a) =>
      s.spawnRules.map((r) => ENEMIES[r.enemy]).reduce((x, y) => (y.hp > x.hp ? y : x));
    for (const pick of [first, toughest, (s: typeof a) => ENEMIES[s.midBoss], (s: typeof a) => ENEMIES[s.finalBoss]]) {
      expect(pick(b).hp).toBeGreaterThan(pick(a).hp);
      expect(pick(b).damage).toBeGreaterThanOrEqual(pick(a).damage);
    }
    for (const key of ['midBoss', 'finalBoss'] as const)
      expect(ENEMIES[b[key]].damage).toBeGreaterThan(ENEMIES[a[key]].damage);
    for (const t of [0, 100, 200, 299]) {
      expect(spawnRate(b, t)).toBeGreaterThanOrEqual(spawnRate(a, t));
      expect(hpScale(b, t)).toBeGreaterThanOrEqual(hpScale(a, t));
    }
  });

  it('番号は 1 から順につく', () => {
    expect(STAGE_IDS.map((id) => STAGES[id].number)).toEqual(STAGE_IDS.map((_, i) => i + 1));
  });

  it('面2は、面1のドラゴンをたおすまで遊べない', () => {
    const best = defaultSave().best;
    expect(isStageUnlocked(best, 'dungeon')).toBe(true);
    expect(isStageUnlocked(best, 'iceCave')).toBe(false);
    expect(unlockedStages(best)).toEqual(['dungeon']);
    const cleared = { ...best, dungeon: { ...defaultBest(), cleared: true } };
    expect(isStageUnlocked(cleared, 'iceCave')).toBe(false);
    const slain = { ...best, dungeon: { ...defaultBest(), cleared: true, dragon: true } };
    expect(unlockedStages(slain)).toEqual(['dungeon', 'iceCave']);
  });

  it('遊べる面だけ選べる', () => {
    const save = defaultSave();
    expect(selectStage(save, 'iceCave')).toBeNull();
    const open = { ...save, best: { ...save.best, dungeon: { ...defaultBest(), cleared: true, dragon: true } } };
    expect(selectStage(open, 'iceCave')?.stage).toBe('iceCave');
    expect(open.stage).toBe('dungeon');
  });
});

describe('rewards', () => {
  const run: RunResult = { stage: 'dungeon', time: 125, kills: 260, level: 12, pickedCoins: 7, cleared: false, dragon: false };

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
    expect(r.save.best.dungeon).toEqual({ time: 125, kills: 260, level: 12, cleared: false, dragon: false });
    expect(r.save.best.iceCave).toEqual(defaultBest());
    expect(r.unlocked).toEqual([]);
    expect(save.coins).toBe(50);
  });

  it('記録は面ごとに別々に残る', () => {
    const open = { ...defaultBest(), time: 300, kills: 900, level: 30, cleared: true, dragon: true };
    const save = { ...defaultSave(), best: { dungeon: open, iceCave: defaultBest() } };
    const r = applyRun(save, { ...run, stage: 'iceCave' }, 1);
    expect(r.newBest).toBe(true);
    expect(r.save.best.dungeon).toBe(open);
    expect(r.save.best.iceCave).toEqual({ time: 125, kills: 260, level: 12, cleared: false, dragon: false });
  });

  it('面1のドラゴンをはじめてたおしたときだけ、面2が新しく遊べるようになる', () => {
    const win: RunResult = { ...run, time: 340, cleared: true, dragon: true };
    const first = applyRun(defaultSave(), win, 1);
    expect(first.unlocked).toEqual(['iceCave']);
    expect(applyRun(first.save, win, 1).unlocked).toEqual([]);
    expect(applyRun(defaultSave(), { ...win, dragon: false }, 1).unlocked).toEqual([]);
    expect(applyRun(first.save, { ...win, stage: 'iceCave' }, 1).unlocked).toEqual([]);
  });

  it('記録に届かないときは、記録は変わらない', () => {
    const base = defaultSave();
    const save = {
      ...base,
      best: { ...base.best, dungeon: { time: 200, kills: 500, level: 20, cleared: false, dragon: false } },
    };
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

  it.each([MIN_HEIGHT, 1300, 1558, MAX_HEIGHT])('タイトル画面の部品は、高さ %d で重ならず画面に収まる', (h) => {
    const L = titleLayout(h);
    // [上はし, 下はし] を上から順に
    const boxes = [
      [L.title - 52, L.title + 148],
      [L.stage - TITLE_SIZES.stage / 2, L.stage + TITLE_SIZES.stage / 2],
      [L.cards - TITLE_SIZES.cards / 2, L.cards + TITLE_SIZES.cards / 2],
      [L.start - 60, L.start + 68],
      [L.shop - 46, L.shop + 54],
      [L.footer - TITLE_SIZES.footer / 2, L.footer + TITLE_SIZES.footer / 2],
    ];
    expect(boxes[0][0]).toBeGreaterThanOrEqual(40);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i][0] - boxes[i - 1][1]).toBeGreaterThanOrEqual(9);
    expect(boxes[boxes.length - 1][1]).toBeLessThanOrEqual(h - 6);
  });

  it('formatTime は 分:秒 にする', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(300)).toBe('5:00');
    expect(formatTime(-3)).toBe('0:00');
  });
});
