import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../src/config';
import { CHARACTERS } from '../src/data/characters';
import { META } from '../src/data/meta';
import { defaultSave, loadSave, sanitizeSave, writeSave, type SaveData } from '../src/logic/save';
import { buyCharacter, buyMeta, metaCost, selectCharacter } from '../src/logic/shop';

function memoryStorage(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(SAVE_KEY, initial);
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('sanitizeSave', () => {
  it('正しいデータはそのまま通る', () => {
    const data: SaveData = {
      version: 1,
      coins: 123,
      meta: { atk: 2, hp: 1, speed: 0, xp: 5, coin: 3, revive: 1 },
      unlocked: ['knight', 'thief'],
      selected: 'thief',
      best: { time: 300, kills: 900, level: 25, cleared: true, dragon: false },
      muted: true,
      plays: 12,
    };
    expect(sanitizeSave(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it.each([null, undefined, 1, 'x', [], {}, { version: 2 }])('こわれたデータ %j は初期値になる', (raw) => {
    expect(sanitizeSave(raw)).toEqual(defaultSave());
  });

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
    const s = sanitizeSave({ version: 1, best: { time: '300', kills: -4, level: 0, cleared: 'yes', dragon: 1 } });
    expect(s.best).toEqual({ time: 0, kills: 0, level: 1, cleared: false, dragon: false });
  });

  it('プロトタイプをよごすキーがあっても影響しない', () => {
    const raw = JSON.parse('{"version":1,"__proto__":{"coins":999},"meta":{"__proto__":{"atk":5}}}');
    const s = sanitizeSave(raw);
    expect(s.coins).toBe(0);
    expect(s.meta.atk).toBe(0);
    expect(({} as Record<string, unknown>).coins).toBeUndefined();
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
