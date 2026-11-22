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

/** タイトル画面の部品の高さ（上から順） */
export const TITLE_SIZES = { title: 200, stage: 92, cards: 316, start: 128, shop: 100, footer: 64 };

export interface TitleLayout {
  /** タイトル1行目の中心 */
  title: number;
  /** 面えらびの中心 */
  stage: number;
  /** キャラクターカードの中心 */
  cards: number;
  /** スタートボタンの中心 */
  start: number;
  /** 強化ショップボタンの中心 */
  shop: number;
  /** 一番下の行の中心 */
  footer: number;
}

const TITLE_MIN_GAPS = [46, 10, 10, 10, 10, 10, 8];
const TITLE_GAP_WEIGHTS = [0.6, 1, 0.7, 1.2, 0.5, 1, 0.6];

/** タイトル画面の部品を、重ならないように上から並べる。あまった高さは、すき間に配分する */
export function titleLayout(height: number): TitleLayout {
  const sizes = Object.values(TITLE_SIZES);
  const used = sizes.reduce((a, b) => a + b, 0) + TITLE_MIN_GAPS.reduce((a, b) => a + b, 0);
  const unit = Math.max(0, height - used) / TITLE_GAP_WEIGHTS.reduce((a, b) => a + b, 0);
  const tops: number[] = [];
  let y = 0;
  sizes.forEach((size, i) => {
    y += TITLE_MIN_GAPS[i] + TITLE_GAP_WEIGHTS[i] * unit;
    tops.push(y);
    y += size;
  });
  return {
    title: Math.round(tops[0] + 52),
    stage: Math.round(tops[1] + TITLE_SIZES.stage / 2),
    cards: Math.round(tops[2] + TITLE_SIZES.cards / 2),
    start: Math.round(tops[3] + 60),
    shop: Math.round(tops[4] + 46),
    footer: Math.round(tops[5] + TITLE_SIZES.footer / 2),
  };
}
