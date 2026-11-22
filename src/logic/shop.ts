import { CHARACTERS, type CharacterId } from '../data/characters';
import { META, type MetaId } from '../data/meta';
import type { SaveData } from './save';

/** 次のレベルの値段。最大まで上げていたら null */
export function metaCost(save: SaveData, id: MetaId): number | null {
  const level = save.meta[id] ?? 0;
  const costs = META[id].costs;
  return level < costs.length ? costs[level] : null;
}

export function buyMeta(save: SaveData, id: MetaId): SaveData | null {
  const cost = metaCost(save, id);
  if (cost === null || save.coins < cost) return null;
  return { ...save, coins: save.coins - cost, meta: { ...save.meta, [id]: (save.meta[id] ?? 0) + 1 } };
}

export function buyCharacter(save: SaveData, id: CharacterId): SaveData | null {
  if (save.unlocked.includes(id)) return null;
  const cost = CHARACTERS[id].cost;
  if (save.coins < cost) return null;
  return { ...save, coins: save.coins - cost, unlocked: [...save.unlocked, id], selected: id };
}

export function selectCharacter(save: SaveData, id: CharacterId): SaveData | null {
  if (!save.unlocked.includes(id)) return null;
  return { ...save, selected: id };
}
