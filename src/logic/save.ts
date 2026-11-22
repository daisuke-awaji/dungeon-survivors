import { LEGACY_SAVE_KEY, SAVE_KEY } from '../config';
import { CHARACTER_IDS, type CharacterId } from '../data/characters';
import { META, META_IDS, type MetaId } from '../data/meta';
import { STAGE_IDS, type StageId } from '../data/stages';
import { isStageUnlocked } from './stages';

export interface BestRecord {
  time: number;
  kills: number;
  level: number;
  cleared: boolean;
  dragon: boolean;
}

export type BestRecords = Record<StageId, BestRecord>;

export interface SaveData {
  version: 2;
  coins: number;
  meta: Record<MetaId, number>;
  unlocked: CharacterId[];
  selected: CharacterId;
  /** えらんでいる面 */
  stage: StageId;
  /** 面ごとの最高記録 */
  best: BestRecords;
  muted: boolean;
  plays: number;
}

const MAX_COINS = 9_999_999;

export function defaultBest(): BestRecord {
  return { time: 0, kills: 0, level: 1, cleared: false, dragon: false };
}

export function defaultSave(): SaveData {
  return {
    version: 2,
    coins: 0,
    meta: { atk: 0, hp: 0, speed: 0, xp: 0, coin: 0, revive: 0 },
    unlocked: ['knight'],
    selected: 'knight',
    stage: 'dungeon',
    best: { dungeon: defaultBest(), iceCave: defaultBest() },
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

function sanitizeBest(raw: unknown): BestRecord {
  const best = defaultBest();
  if (!isRecord(raw)) return best;
  best.time = clampInt(raw.time, 0, 86_400, 0);
  best.kills = clampInt(raw.kills, 0, 9_999_999, 0);
  best.level = clampInt(raw.level, 1, 999, 1);
  best.cleared = raw.cleared === true;
  best.dragon = raw.dragon === true;
  return best;
}

/**
 * 保存データを検証し、おかしな値は初期値や上限・下限に直す。
 * version 1（面が1つだけだったころ）のデータは、記録を面1のものとして引きつぐ
 */
export function sanitizeSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isRecord(raw) || (raw.version !== 1 && raw.version !== 2)) return base;

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

  const best = base.best;
  if (raw.version === 1) {
    best.dungeon = sanitizeBest(raw.best);
  } else if (isRecord(raw.best)) {
    for (const id of STAGE_IDS) best[id] = sanitizeBest(raw.best[id]);
  }

  const stage =
    raw.version === 2 && STAGE_IDS.includes(raw.stage as StageId) && isStageUnlocked(best, raw.stage as StageId)
      ? (raw.stage as StageId)
      : base.stage;

  return {
    version: 2,
    coins: clampInt(raw.coins, 0, MAX_COINS, 0),
    meta,
    unlocked,
    selected,
    stage,
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
    const text = storage.getItem(SAVE_KEY) ?? storage.getItem(LEGACY_SAVE_KEY);
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
