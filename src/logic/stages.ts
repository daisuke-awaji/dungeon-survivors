import { STAGE_IDS, STAGES, type StageId } from '../data/stages';
import type { BestRecords, SaveData } from './save';

/** 前の面の最後のボスをたおしていれば遊べる */
export function isStageUnlocked(best: BestRecords, id: StageId): boolean {
  const requires = STAGES[id].requires;
  return requires === null || best[requires].dragon;
}

export function unlockedStages(best: BestRecords): StageId[] {
  return STAGE_IDS.filter((id) => isStageUnlocked(best, id));
}

export function selectStage(save: SaveData, id: StageId): SaveData | null {
  if (!isStageUnlocked(save.best, id)) return null;
  return { ...save, stage: id };
}
