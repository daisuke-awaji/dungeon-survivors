import type { WeaponId } from './weapons';

export type CharacterId = 'knight' | 'mage' | 'thief';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  frame: string;
  desc: string;
  cost: number;
  weapon: WeaponId;
  hpMul: number;
  speedMul: number;
  cooldownMul: number;
  pickupMul: number;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  knight: {
    id: 'knight',
    name: 'けんし',
    frame: 'knight',
    desc: 'HPが多い\nソードで戦う',
    cost: 0,
    weapon: 'sword',
    hpMul: 1.25,
    speedMul: 1,
    cooldownMul: 1,
    pickupMul: 1,
  },
  mage: {
    id: 'mage',
    name: 'まほう使い',
    frame: 'mage',
    desc: 'こうげきが速い\nHPは少なめ',
    cost: 150,
    weapon: 'bolt',
    hpMul: 0.85,
    speedMul: 1,
    cooldownMul: 0.85,
    pickupMul: 1,
  },
  thief: {
    id: 'thief',
    name: 'とうぞく',
    frame: 'thief',
    desc: '足が速い\n遠くからひろえる',
    cost: 300,
    weapon: 'thunder',
    hpMul: 1,
    speedMul: 1.18,
    cooldownMul: 1,
    pickupMul: 1.6,
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
