import { MAX_PASSIVES, MAX_SKILL_LEVEL, MAX_WEAPONS } from '../config';
import { PASSIVE_IDS, type PassiveId } from '../data/passives';
import { WEAPONS, WEAPON_IDS, type WeaponId, type WeaponStats } from '../data/weapons';
import { shuffle, type Rng } from './rng';

export interface OwnedWeapon {
  id: WeaponId;
  level: number;
  evolved: boolean;
}

export interface OwnedPassive {
  id: PassiveId;
  level: number;
}

export interface Loadout {
  weapons: OwnedWeapon[];
  passives: OwnedPassive[];
}

export type BonusId = 'heal' | 'coins';

export type Choice =
  | { kind: 'weapon'; id: WeaponId; nextLevel: number }
  | { kind: 'passive'; id: PassiveId; nextLevel: number }
  | { kind: 'evolve'; id: WeaponId }
  | { kind: 'bonus'; id: BonusId };

export function newLoadout(startWeapon: WeaponId): Loadout {
  return { weapons: [{ id: startWeapon, level: 1, evolved: false }], passives: [] };
}

export function weaponStats(w: OwnedWeapon): WeaponStats {
  const def = WEAPONS[w.id];
  return w.evolved ? def.evo : def.levels[Math.min(MAX_SKILL_LEVEL, Math.max(1, w.level)) - 1];
}

export function canEvolve(loadout: Loadout, id: WeaponId): boolean {
  const w = loadout.weapons.find((x) => x.id === id);
  if (!w || w.evolved || w.level < MAX_SKILL_LEVEL) return false;
  return loadout.passives.some((p) => p.id === WEAPONS[id].evoPassive);
}

/** 進化とそれ以外に分けて、今えらべるものを全部返す */
export function availableChoices(loadout: Loadout): { evolutions: Choice[]; upgrades: Choice[] } {
  const evolutions: Choice[] = [];
  const upgrades: Choice[] = [];

  for (const id of WEAPON_IDS) {
    const owned = loadout.weapons.find((w) => w.id === id);
    if (owned) {
      if (canEvolve(loadout, id)) evolutions.push({ kind: 'evolve', id });
      else if (!owned.evolved && owned.level < MAX_SKILL_LEVEL)
        upgrades.push({ kind: 'weapon', id, nextLevel: owned.level + 1 });
    } else if (loadout.weapons.length < MAX_WEAPONS) {
      upgrades.push({ kind: 'weapon', id, nextLevel: 1 });
    }
  }

  for (const id of PASSIVE_IDS) {
    const owned = loadout.passives.find((p) => p.id === id);
    if (owned) {
      if (owned.level < MAX_SKILL_LEVEL) upgrades.push({ kind: 'passive', id, nextLevel: owned.level + 1 });
    } else if (loadout.passives.length < MAX_PASSIVES) {
      upgrades.push({ kind: 'passive', id, nextLevel: 1 });
    }
  }

  return { evolutions, upgrades };
}

/** レベルアップ時の選たく肢。進化できるものは必ず入れ、足りない分はボーナスでうめる */
export function drawChoices(loadout: Loadout, rng: Rng, count = 3): Choice[] {
  const { evolutions, upgrades } = availableChoices(loadout);
  const pool = [...shuffle(evolutions, rng), ...shuffle(upgrades, rng)];
  const out: Choice[] = pool.slice(0, count);
  // 武器が1つも出ないと強くなりにくいので、出せるときは最後の1つを武器にする
  const isWeapon = (c: Choice) => c.kind === 'weapon' || c.kind === 'evolve';
  if (out.length === count && !out.some(isWeapon)) {
    const weapon = pool.slice(count).find(isWeapon);
    if (weapon) out[count - 1] = weapon;
  }
  const bonuses: Choice[] = [
    { kind: 'bonus', id: 'heal' },
    { kind: 'bonus', id: 'coins' },
  ];
  for (const b of bonuses) {
    if (out.length >= count) break;
    out.push(b);
  }
  return out;
}

/** 選んだものを反映した新しい Loadout を返す（ボーナスは Loadout を変えない） */
export function applyChoice(loadout: Loadout, choice: Choice): Loadout {
  const weapons = loadout.weapons.map((w) => ({ ...w }));
  const passives = loadout.passives.map((p) => ({ ...p }));

  if (choice.kind === 'weapon') {
    const owned = weapons.find((w) => w.id === choice.id);
    if (owned) {
      if (!owned.evolved) owned.level = Math.min(MAX_SKILL_LEVEL, owned.level + 1);
    } else if (weapons.length < MAX_WEAPONS) {
      weapons.push({ id: choice.id, level: 1, evolved: false });
    }
  } else if (choice.kind === 'passive') {
    const owned = passives.find((p) => p.id === choice.id);
    if (owned) owned.level = Math.min(MAX_SKILL_LEVEL, owned.level + 1);
    else if (passives.length < MAX_PASSIVES) passives.push({ id: choice.id, level: 1 });
  } else if (choice.kind === 'evolve') {
    const owned = weapons.find((w) => w.id === choice.id);
    if (owned && canEvolve(loadout, choice.id)) owned.evolved = true;
  }

  return { weapons, passives };
}
