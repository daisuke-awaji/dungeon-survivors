export type MetaId = 'atk' | 'hp' | 'speed' | 'xp' | 'coin' | 'revive';

export interface MetaDef {
  id: MetaId;
  name: string;
  icon: string;
  desc: string;
  perLevel: number;
  costs: number[];
}

const STD_COSTS = [30, 70, 150, 300, 500];

export const META: Record<MetaId, MetaDef> = {
  atk: { id: 'atk', name: 'こうげき力', icon: 'ic_sword', desc: 'ダメージ +8%', perLevel: 0.08, costs: STD_COSTS },
  hp: { id: 'hp', name: '最大HP', icon: 'ic_heart', desc: '最大HP +12%', perLevel: 0.12, costs: STD_COSTS },
  speed: { id: 'speed', name: '移動速度', icon: 'ic_boots', desc: '移動速度 +3%', perLevel: 0.03, costs: STD_COSTS },
  xp: { id: 'xp', name: '経験値', icon: 'ic_book', desc: '経験値 +8%', perLevel: 0.08, costs: STD_COSTS },
  coin: { id: 'coin', name: 'コイン', icon: 'ic_coins', desc: 'コイン +15%', perLevel: 0.15, costs: STD_COSTS },
  revive: { id: 'revive', name: 'ふっかつ', icon: 'ic_heal', desc: '1回だけ生き返る', perLevel: 1, costs: [300] },
};

export const META_IDS = Object.keys(META) as MetaId[];
