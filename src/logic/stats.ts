import type { CharacterDef } from '../data/characters';
import { META, type MetaId } from '../data/meta';
import { PASSIVES, type PassiveId } from '../data/passives';
import type { OwnedPassive } from './skills';

export const BASE_HP = 100;
export const BASE_SPEED = 260;
export const BASE_PICKUP = 95;
export const MIN_COOLDOWN_MUL = 0.4;

export interface PlayerStats {
  maxHp: number;
  moveSpeed: number;
  damageMul: number;
  cooldownMul: number;
  areaMul: number;
  pickupRange: number;
  xpMul: number;
  coinMul: number;
  revives: number;
}

export type MetaLevels = Record<MetaId, number>;

function passiveBonus(passives: readonly OwnedPassive[], id: PassiveId): number {
  const p = passives.find((x) => x.id === id);
  return p ? p.level * PASSIVES[id].perLevel : 0;
}

function metaBonus(meta: MetaLevels, id: MetaId): number {
  return (meta[id] ?? 0) * META[id].perLevel;
}

export function computeStats(
  char: CharacterDef,
  passives: readonly OwnedPassive[],
  meta: MetaLevels,
): PlayerStats {
  const cooldownMul = char.cooldownMul * (1 - passiveBonus(passives, 'book'));
  return {
    maxHp: Math.round(BASE_HP * char.hpMul * (1 + passiveBonus(passives, 'heart') + metaBonus(meta, 'hp'))),
    moveSpeed: BASE_SPEED * char.speedMul * (1 + passiveBonus(passives, 'boots') + metaBonus(meta, 'speed')),
    damageMul: 1 + passiveBonus(passives, 'power') + metaBonus(meta, 'atk'),
    cooldownMul: Math.max(MIN_COOLDOWN_MUL, cooldownMul),
    areaMul: 1 + passiveBonus(passives, 'mushroom'),
    pickupRange: BASE_PICKUP * char.pickupMul * (1 + passiveBonus(passives, 'magnet')),
    xpMul: 1 + metaBonus(meta, 'xp'),
    coinMul: 1 + metaBonus(meta, 'coin'),
    revives: (meta.revive ?? 0) > 0 ? 1 : 0,
  };
}
