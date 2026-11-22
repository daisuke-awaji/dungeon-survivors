export const GAME_WIDTH = 720;
export const MIN_HEIGHT = 1100;
export const MAX_HEIGHT = 1600;

export const RUN_SECONDS = 300;
export const MIDBOSS_SECONDS = 150;

export const MAX_WEAPONS = 4;
export const MAX_PASSIVES = 4;
export const MAX_SKILL_LEVEL = 5;

export const MAX_ENEMIES = 220;
export const MAX_ENEMIES_BOSS_PHASE = 90;
export const MAX_PICKUPS = 320;
/** てきの玉（ボスの玉もふくむ）がこの数あるあいだは、ふつうのてきは玉を投げない */
export const MAX_MINION_BULLETS = 10;

export const FONT_FAMILY =
  '"Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP","Noto Sans CJK JP","Yu Gothic","Meiryo",sans-serif';

export const SAVE_KEY = 'dungeon-survivors:save:v2';
/** 面が1つだけだったころのセーブ。新しいセーブがないときだけ読み、書きかえない */
export const LEGACY_SAVE_KEY = 'dungeon-survivors:save:v1';
