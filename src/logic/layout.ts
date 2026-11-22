import { GAME_WIDTH, MAX_HEIGHT, MIN_HEIGHT } from '../config';

/** 画面の縦横比から、ゲーム内の高さ（横は GAME_WIDTH 固定）を決める */
export function computeGameHeight(viewportWidth: number, viewportHeight: number): number {
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return MIN_HEIGHT;
  const h = Math.round((GAME_WIDTH * viewportHeight) / viewportWidth);
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h));
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
