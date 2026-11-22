import { describe, expect, it } from 'vitest';
import { MAX_PASSIVES, MAX_SKILL_LEVEL, MAX_WEAPONS } from '../src/config';
import { PASSIVE_IDS, PASSIVES } from '../src/data/passives';
import { WEAPON_IDS, WEAPONS } from '../src/data/weapons';
import { mulberry32 } from '../src/logic/rng';
import {
  applyChoice,
  availableChoices,
  canEvolve,
  drawChoices,
  newLoadout,
  weaponStats,
  type Choice,
  type Loadout,
} from '../src/logic/skills';

const key = (c: Choice) => `${c.kind}:${c.id}`;

describe('武器・パッシブのデータ', () => {
  it('すべての武器に Lv1〜5 と進化が定義されている', () => {
    for (const id of WEAPON_IDS) {
      const def = WEAPONS[id];
      expect(def.levels).toHaveLength(MAX_SKILL_LEVEL);
      expect(def.levelDesc).toHaveLength(MAX_SKILL_LEVEL);
      expect(PASSIVE_IDS).toContain(def.evoPassive);
      for (const st of [...def.levels, def.evo]) {
        expect(st.damage).toBeGreaterThan(0);
        expect(st.cooldown).toBeGreaterThan(0);
        expect(st.count).toBeGreaterThan(0);
        expect(st.area).toBeGreaterThan(0);
      }
    }
  });

  it('進化に使うパッシブは武器ごとにちがう', () => {
    const used = WEAPON_IDS.map((id) => WEAPONS[id].evoPassive);
    expect(new Set(used).size).toBe(WEAPON_IDS.length);
  });

  it('レベルが上がって弱くなることはない', () => {
    for (const id of WEAPON_IDS) {
      const { levels, evo } = WEAPONS[id];
      const dps = (i: number) => (levels[i].damage * levels[i].count) / levels[i].cooldown;
      for (let i = 1; i < levels.length; i++) {
        expect(dps(i)).toBeGreaterThanOrEqual(dps(i - 1));
        expect(levels[i].area).toBeGreaterThanOrEqual(levels[i - 1].area);
      }
      expect((evo.damage * evo.count) / evo.cooldown).toBeGreaterThan(dps(levels.length - 1));
    }
  });

  it('パッシブの効果は正の値', () => {
    for (const id of PASSIVE_IDS) expect(PASSIVES[id].perLevel).toBeGreaterThan(0);
  });
});

describe('availableChoices', () => {
  it('最初は持っている武器の強化・新しい武器・新しいパッシブが出る', () => {
    const { evolutions, upgrades } = availableChoices(newLoadout('sword'));
    expect(evolutions).toHaveLength(0);
    expect(upgrades).toHaveLength(WEAPON_IDS.length + PASSIVE_IDS.length);
    expect(upgrades).toContainEqual({ kind: 'weapon', id: 'sword', nextLevel: 2 });
    expect(upgrades).toContainEqual({ kind: 'weapon', id: 'bolt', nextLevel: 1 });
    expect(upgrades).toContainEqual({ kind: 'passive', id: 'power', nextLevel: 1 });
  });

  it('武器が上限数なら、新しい武器は出ない', () => {
    const loadout: Loadout = {
      weapons: WEAPON_IDS.slice(0, MAX_WEAPONS).map((id) => ({ id, level: 1, evolved: false })),
      passives: [],
    };
    const ids = availableChoices(loadout)
      .upgrades.filter((c) => c.kind === 'weapon')
      .map((c) => c.id);
    expect(ids.sort()).toEqual(WEAPON_IDS.slice(0, MAX_WEAPONS).sort());
  });

  it('パッシブが上限数なら、新しいパッシブは出ない', () => {
    const loadout: Loadout = {
      weapons: [{ id: 'sword', level: 1, evolved: false }],
      passives: PASSIVE_IDS.slice(0, MAX_PASSIVES).map((id) => ({ id, level: 1 })),
    };
    const passives = availableChoices(loadout).upgrades.filter((c) => c.kind === 'passive');
    expect(passives).toHaveLength(MAX_PASSIVES);
  });

  it('最大レベルの武器・パッシブは強化に出ない', () => {
    const loadout: Loadout = {
      weapons: [{ id: 'sword', level: MAX_SKILL_LEVEL, evolved: false }],
      passives: [{ id: 'book', level: MAX_SKILL_LEVEL }],
    };
    const keys = availableChoices(loadout).upgrades.map(key);
    expect(keys).not.toContain('weapon:sword');
    expect(keys).not.toContain('passive:book');
  });
});

describe('進化', () => {
  const ready: Loadout = {
    weapons: [{ id: 'sword', level: MAX_SKILL_LEVEL, evolved: false }],
    passives: [{ id: 'power', level: 1 }],
  };

  it('Lv5 と対応パッシブがそろうと進化できる', () => {
    expect(canEvolve(ready, 'sword')).toBe(true);
    expect(availableChoices(ready).evolutions).toEqual([{ kind: 'evolve', id: 'sword' }]);
  });

  it('Lv4 では進化できない', () => {
    expect(canEvolve({ ...ready, weapons: [{ id: 'sword', level: 4, evolved: false }] }, 'sword')).toBe(false);
  });

  it('対応パッシブがないと進化できない', () => {
    expect(canEvolve({ ...ready, passives: [{ id: 'book', level: 5 }] }, 'sword')).toBe(false);
  });

  it('持っていない武器は進化できない', () => {
    expect(canEvolve(ready, 'bolt')).toBe(false);
  });

  it('進化できるときは、必ず選たく肢に入る', () => {
    for (let seed = 0; seed < 50; seed++) {
      const choices = drawChoices(ready, mulberry32(seed));
      expect(choices[0]).toEqual({ kind: 'evolve', id: 'sword' });
    }
  });

  it('進化を選ぶと evolved になり、もう進化も強化も出ない', () => {
    const next = applyChoice(ready, { kind: 'evolve', id: 'sword' });
    expect(next.weapons[0]).toEqual({ id: 'sword', level: MAX_SKILL_LEVEL, evolved: true });
    const { evolutions, upgrades } = availableChoices(next);
    expect(evolutions).toHaveLength(0);
    expect(upgrades.map(key)).not.toContain('weapon:sword');
    expect(weaponStats(next.weapons[0])).toBe(WEAPONS.sword.evo);
  });

  it('条件を満たさない進化は反映されない', () => {
    const base = newLoadout('sword');
    expect(applyChoice(base, { kind: 'evolve', id: 'sword' }).weapons[0].evolved).toBe(false);
  });
});

describe('drawChoices', () => {
  it('3つ返し、重複しない', () => {
    for (let seed = 0; seed < 100; seed++) {
      const choices = drawChoices(newLoadout('bolt'), mulberry32(seed));
      expect(choices).toHaveLength(3);
      expect(new Set(choices.map(key)).size).toBe(3);
    }
  });

  it('同じ種なら同じ結果になる', () => {
    expect(drawChoices(newLoadout('ice'), mulberry32(7))).toEqual(drawChoices(newLoadout('ice'), mulberry32(7)));
  });

  it('全部最大なら、ボーナス（回復・コイン）でうめる', () => {
    const maxed: Loadout = {
      weapons: WEAPON_IDS.slice(0, MAX_WEAPONS).map((id) => ({ id, level: MAX_SKILL_LEVEL, evolved: true })),
      passives: PASSIVE_IDS.slice(0, MAX_PASSIVES).map((id) => ({ id, level: MAX_SKILL_LEVEL })),
    };
    expect(drawChoices(maxed, mulberry32(1))).toEqual([
      { kind: 'bonus', id: 'heal' },
      { kind: 'bonus', id: 'coins' },
    ]);
  });

  it('残りが1つなら、その1つとボーナス2つになる', () => {
    const almost: Loadout = {
      weapons: WEAPON_IDS.slice(0, MAX_WEAPONS).map((id) => ({ id, level: MAX_SKILL_LEVEL, evolved: true })),
      passives: PASSIVE_IDS.slice(0, MAX_PASSIVES).map((id, i) => ({ id, level: i === 0 ? 4 : MAX_SKILL_LEVEL })),
    };
    const choices = drawChoices(almost, mulberry32(3));
    expect(choices).toHaveLength(3);
    expect(choices[0]).toEqual({ kind: 'passive', id: PASSIVE_IDS[0], nextLevel: 5 });
    expect(choices.slice(1).every((c) => c.kind === 'bonus')).toBe(true);
  });
});

describe('applyChoice', () => {
  it('元の Loadout は変えない', () => {
    const base = newLoadout('sword');
    const next = applyChoice(base, { kind: 'weapon', id: 'sword', nextLevel: 2 });
    expect(base.weapons[0].level).toBe(1);
    expect(next.weapons[0].level).toBe(2);
  });

  it('新しい武器・パッシブを追加する', () => {
    let l = newLoadout('sword');
    l = applyChoice(l, { kind: 'weapon', id: 'ice', nextLevel: 1 });
    l = applyChoice(l, { kind: 'passive', id: 'magnet', nextLevel: 1 });
    expect(l.weapons.map((w) => w.id)).toEqual(['sword', 'ice']);
    expect(l.passives).toEqual([{ id: 'magnet', level: 1 }]);
  });

  it('最大レベルと所持数の上限をこえない', () => {
    let l = newLoadout('sword');
    for (let i = 0; i < 10; i++) l = applyChoice(l, { kind: 'weapon', id: 'sword', nextLevel: 0 });
    expect(l.weapons[0].level).toBe(MAX_SKILL_LEVEL);
    for (const id of WEAPON_IDS) l = applyChoice(l, { kind: 'weapon', id, nextLevel: 1 });
    expect(l.weapons).toHaveLength(MAX_WEAPONS);
    for (const id of PASSIVE_IDS) l = applyChoice(l, { kind: 'passive', id, nextLevel: 1 });
    expect(l.passives).toHaveLength(MAX_PASSIVES);
  });

  it('ボーナスは Loadout を変えない', () => {
    const base = newLoadout('sword');
    expect(applyChoice(base, { kind: 'bonus', id: 'heal' })).toEqual(base);
  });

  it('出てきた選たく肢を選び続けると、全部最大になって止まる', () => {
    const rng = mulberry32(42);
    let l = newLoadout('thunder');
    let steps = 0;
    for (; steps < 200; steps++) {
      const c = drawChoices(l, rng)[0];
      if (c.kind === 'bonus') break;
      l = applyChoice(l, c);
    }
    expect(steps).toBeLessThan(200);
    expect(l.weapons).toHaveLength(MAX_WEAPONS);
    expect(l.passives).toHaveLength(MAX_PASSIVES);
    expect(l.passives.every((p) => p.level === MAX_SKILL_LEVEL)).toBe(true);
    expect(l.weapons.every((w) => w.level === MAX_SKILL_LEVEL)).toBe(true);
  });
});
