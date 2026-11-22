export type PassiveId = 'power' | 'book' | 'mushroom' | 'boots' | 'heart' | 'magnet';

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  desc: string;
  perLevel: number;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  power: { id: 'power', name: 'パワーリング', icon: 'ic_power', desc: 'ダメージ +10%', perLevel: 0.1 },
  book: { id: 'book', name: 'まほうの本', icon: 'ic_book', desc: 'こうげきが 8% 速くなる', perLevel: 0.08 },
  mushroom: { id: 'mushroom', name: 'ビッグキノコ', icon: 'ic_mushroom', desc: 'はんい +10%', perLevel: 0.1 },
  boots: { id: 'boots', name: 'スピードブーツ', icon: 'ic_boots', desc: '移動速度 +8%', perLevel: 0.08 },
  heart: { id: 'heart', name: 'ハートのうつわ', icon: 'ic_heart', desc: '最大HP +20%', perLevel: 0.2 },
  magnet: { id: 'magnet', name: 'マグネット', icon: 'ic_magnet', desc: 'ひろえるきょり +30%', perLevel: 0.3 },
};

export const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];
