import { SAVE_KEY } from '../config';
import { CHARACTER_IDS, type CharacterId } from '../data/characters';
import { META, META_IDS, type MetaId } from '../data/meta';

export interface BestRecord {
  time: number;
  kills: number;
  level: number;
  cleared: boolean;
  dragon: boolean;
}

export interface SaveData {
  version: 1;
  coins: number;
  meta: Record<MetaId, number>;
  unlocked: CharacterId[];
  selected: CharacterId;
  best: BestRecord;
  muted: boolean;
  plays: number;
}

const MAX_COINS = 9_999_999;

export function defaultSave(): SaveData {
  return {
    version: 1,
    coins: 0,
    meta: { atk: 0, hp: 0, speed: 0, xp: 0, coin: 0, revive: 0 },
    unlocked: ['knight'],
    selected: 'knight',
    best: { time: 0, kills: 0, level: 1, cleared: false, dragon: false },
    muted: false,
    plays: 0,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

/** 保存データを検証し、おかしな値は初期値や上限・下限に直す */
export function sanitizeSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isRecord(raw) || raw.version !== 1) return base;

  const meta = { ...base.meta };
  if (isRecord(raw.meta)) {
    for (const id of META_IDS) meta[id] = clampInt(raw.meta[id], 0, META[id].costs.length, 0);
  }

  const unlocked: CharacterId[] = ['knight'];
  if (Array.isArray(raw.unlocked)) {
    for (const id of CHARACTER_IDS) {
      if (id !== 'knight' && raw.unlocked.includes(id)) unlocked.push(id);
    }
  }

  const selected =
    typeof raw.selected === 'string' && unlocked.includes(raw.selected as CharacterId)
      ? (raw.selected as CharacterId)
      : 'knight';

  const best = { ...base.best };
  if (isRecord(raw.best)) {
    best.time = clampInt(raw.best.time, 0, 86_400, 0);
    best.kills = clampInt(raw.best.kills, 0, 9_999_999, 0);
    best.level = clampInt(raw.best.level, 1, 999, 1);
    best.cleared = raw.best.cleared === true;
    best.dragon = raw.best.dragon === true;
  }

  return {
    version: 1,
    coins: clampInt(raw.coins, 0, MAX_COINS, 0),
    meta,
    unlocked,
    selected,
    best,
    muted: raw.muted === true,
    plays: clampInt(raw.plays, 0, 9_999_999, 0),
  };
}

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

export function loadSave(storage: ReadStorage | null | undefined): SaveData {
  if (!storage) return defaultSave();
  try {
    const text = storage.getItem(SAVE_KEY);
    if (!text) return defaultSave();
    return sanitizeSave(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage: WriteStorage | null | undefined, data: SaveData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
