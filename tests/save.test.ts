import { describe, expect, it } from 'vitest';
import { LEGACY_SAVE_KEY, SAVE_KEY } from '../src/config';
import { CHARACTERS } from '../src/data/characters';
import { META } from '../src/data/meta';
import { defaultBest, defaultSave, loadSave, sanitizeSave, writeSave, type SaveData } from '../src/logic/save';
import { buyCharacter, buyMeta, metaCost, selectCharacter } from '../src/logic/shop';

function memoryStorage(initial?: string, key = SAVE_KEY) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(key, initial);
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('sanitizeSave', () => {
  it('正しいデータはそのまま通る', () => {
    const data: SaveData = {
      version: 2,
      coins: 123,
      meta: { atk: 2, hp: 1, speed: 0, xp: 5, coin: 3, revive: 1 },
      unlocked: ['knight', 'thief'],
      selected: 'thief',
      stage: 'iceCave',
      best: {
        dungeon: { time: 340, kills: 900, level: 25, cleared: true, dragon: true },
        iceCave: { time: 120, kills: 200, level: 9, cleared: false, dragon: false },
      },
      muted: true,
      plays: 12,
    };
    expect(sanitizeSave(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it.each([null, undefined, 1, 'x', [], {}, { version: 0 }, { version: 3 }, { version: '2' }])(
    'こわれたデータ %j は初期値になる',
    (raw) => {
      expect(sanitizeSave(raw)).toEqual(defaultSave());
    },
  );

  it('範囲外の数値は上限・下限に直す', () => {
    const s = sanitizeSave({
      version: 1,
      coins: -50,
      meta: { atk: 99, hp: -1, speed: 2.9, xp: 'a', coin: null, revive: 7 },
      plays: Infinity,
    });
    expect(s.coins).toBe(0);
    expect(s.meta).toEqual({ atk: META.atk.costs.length, hp: 0, speed: 2, xp: 0, coin: 0, revive: 1 });
    expect(s.plays).toBe(0);
  });

  it('コインは上限をこえない', () => {
    expect(sanitizeSave({ version: 1, coins: 1e12 }).coins).toBe(9_999_999);
  });

  it('知らないキャラクターは捨て、けんしは必ず使える', () => {
    const s = sanitizeSave({ version: 1, unlocked: ['hacker', 'mage', 'mage'], selected: 'hacker' });
    expect(s.unlocked).toEqual(['knight', 'mage']);
    expect(s.selected).toBe('knight');
  });

  it('解放していないキャラクターは選べない', () => {
    expect(sanitizeSave({ version: 1, unlocked: ['knight'], selected: 'thief' }).selected).toBe('knight');
  });

  it('記録の型がちがうときは初期値にする', () => {
    const bad = { time: '300', kills: -4, level: 0, cleared: 'yes', dragon: 1 };
    expect(sanitizeSave({ version: 1, best: bad }).best).toEqual(defaultSave().best);
    expect(sanitizeSave({ version: 2, best: { dungeon: bad, iceCave: 5 } }).best).toEqual(defaultSave().best);
    expect(sanitizeSave({ version: 2, best: 'x' }).best).toEqual(defaultSave().best);
  });

  it('知らない面や、まだ遊べない面は選べない', () => {
    expect(sanitizeSave({ version: 2, stage: 'iceCave' }).stage).toBe('dungeon');
    expect(sanitizeSave({ version: 2, stage: 'moon' }).stage).toBe('dungeon');
    expect(sanitizeSave({ version: 2, stage: 'iceCave', best: { dungeon: { cleared: true } } }).stage).toBe('dungeon');
    expect(sanitizeSave({ version: 2, stage: 'iceCave', best: { dungeon: { dragon: true } } }).stage).toBe('iceCave');
  });

  it('プロトタイプをよごすキーがあっても影響しない', () => {
    const raw = JSON.parse('{"version":1,"__proto__":{"coins":999},"meta":{"__proto__":{"atk":5}}}');
    const s = sanitizeSave(raw);
    expect(s.coins).toBe(0);
    expect(s.meta.atk).toBe(0);
    expect(({} as Record<string, unknown>).coins).toBeUndefined();
  });
});

describe('version 1 からの引きつぎ', () => {
  const v1 = {
    version: 1,
    coins: 456,
    meta: { atk: 2, hp: 1, speed: 0, xp: 5, coin: 3, revive: 1 },
    unlocked: ['knight', 'mage'],
    selected: 'mage',
    best: { time: 300, kills: 900, level: 25, cleared: true, dragon: false },
    muted: true,
    plays: 12,
  };

  it('コイン・強化・キャラクター・音の設定・回数はそのまま残り、記録は面1のものになる', () => {
    expect(sanitizeSave(JSON.parse(JSON.stringify(v1)))).toEqual({
      version: 2,
      coins: 456,
      meta: v1.meta,
      unlocked: ['knight', 'mage'],
      selected: 'mage',
      stage: 'dungeon',
      best: { dungeon: v1.best, iceCave: defaultBest() },
      muted: true,
      plays: 12,
    });
  });

  it('面1のドラゴンをたおしていれば、引きついだあと面2を選べる', () => {
    const s = sanitizeSave({ ...v1, best: { ...v1.best, dragon: true } });
    expect(s.stage).toBe('dungeon');
    expect(s.best.dungeon.dragon).toBe(true);
    expect(sanitizeSave({ ...s, stage: 'iceCave' }).stage).toBe('iceCave');
  });

  it('新しいセーブがなければ古いセーブを読み、古いセーブは書きかえない', () => {
    const text = JSON.stringify(v1);
    const storage = memoryStorage(text, LEGACY_SAVE_KEY);
    const loaded = loadSave(storage);
    expect(loaded.coins).toBe(456);
    expect(loaded.best.dungeon).toEqual(v1.best);
    expect(writeSave(storage, { ...loaded, coins: 500 })).toBe(true);
    expect(storage.map.get(LEGACY_SAVE_KEY)).toBe(text);
    expect(JSON.parse(storage.map.get(SAVE_KEY)!).version).toBe(2);
  });

  it('新しいセーブがあれば、古いセーブより優先する', () => {
    const storage = memoryStorage(JSON.stringify(v1), LEGACY_SAVE_KEY);
    writeSave(storage, { ...defaultSave(), coins: 7 });
    expect(loadSave(storage).coins).toBe(7);
  });
});

describe('loadSave / writeSave', () => {
  it('保存がなければ初期値', () => {
    expect(loadSave(memoryStorage())).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
  });

  it('JSON でない文字列は初期値', () => {
    expect(loadSave(memoryStorage('{oops'))).toEqual(defaultSave());
  });

  it('書いたものを読みもどせる', () => {
    const storage = memoryStorage();
    const data = { ...defaultSave(), coins: 77, muted: true };
    expect(writeSave(storage, data)).toBe(true);
    expect(loadSave(storage)).toEqual(data);
  });

  it('ストレージが例外を出しても落ちない', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadSave(broken)).toEqual(defaultSave());
    expect(writeSave(broken, defaultSave())).toBe(false);
    expect(writeSave(null, defaultSave())).toBe(false);
  });
});

describe('shop', () => {
  it('コインが足りれば強化を買え、コインが減ってレベルが上がる', () => {
    const save = { ...defaultSave(), coins: 100 };
    const next = buyMeta(save, 'atk');
    expect(next?.coins).toBe(100 - META.atk.costs[0]);
    expect(next?.meta.atk).toBe(1);
    expect(save.meta.atk).toBe(0);
  });

  it('ちょうどの金がくでも買える。1 足りないと買えない', () => {
    const cost = META.hp.costs[0];
    expect(buyMeta({ ...defaultSave(), coins: cost }, 'hp')?.coins).toBe(0);
    expect(buyMeta({ ...defaultSave(), coins: cost - 1 }, 'hp')).toBeNull();
  });

  it('レベルが上がると値段も上がり、最大になると買えない', () => {
    let save: SaveData = { ...defaultSave(), coins: 100_000 };
    const costs: number[] = [];
    for (;;) {
      const c = metaCost(save, 'speed');
      if (c === null) break;
      costs.push(c);
      save = buyMeta(save, 'speed')!;
    }
    expect(costs).toEqual(META.speed.costs);
    expect(save.meta.speed).toBe(META.speed.costs.length);
    expect(buyMeta(save, 'speed')).toBeNull();
  });

  it('ふっかつは 1 回だけ買える', () => {
    const save = buyMeta({ ...defaultSave(), coins: 1000 }, 'revive')!;
    expect(save.meta.revive).toBe(1);
    expect(metaCost(save, 'revive')).toBeNull();
  });

  it('キャラクターを買うと解放され、そのキャラクターが選ばれる', () => {
    const save = { ...defaultSave(), coins: CHARACTERS.mage.cost };
    const next = buyCharacter(save, 'mage');
    expect(next?.coins).toBe(0);
    expect(next?.unlocked).toEqual(['knight', 'mage']);
    expect(next?.selected).toBe('mage');
  });

  it('コイン不足・解放ずみのキャラクターは買えない', () => {
    expect(buyCharacter({ ...defaultSave(), coins: CHARACTERS.thief.cost - 1 }, 'thief')).toBeNull();
    expect(buyCharacter({ ...defaultSave(), coins: 9999 }, 'knight')).toBeNull();
  });

  it('解放ずみのキャラクターだけ選べる', () => {
    expect(selectCharacter(defaultSave(), 'mage')).toBeNull();
    const save = buyCharacter({ ...defaultSave(), coins: 9999 }, 'mage')!;
    expect(selectCharacter(save, 'knight')?.selected).toBe('knight');
  });
});
