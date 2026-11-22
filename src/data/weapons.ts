import type { PassiveId } from './passives';

export type WeaponId = 'sword' | 'bolt' | 'fireball' | 'thunder' | 'shield' | 'ice';

export interface WeaponStats {
  /** 1回あたりのダメージ */
  damage: number;
  /** こうげき間かく（秒）。シールドは同じてきに当たり直すまでの時間 */
  cooldown: number;
  /** たまの数・落とす数・方向の数 */
  count: number;
  /** はんい（半径 px） */
  area: number;
  /** つらぬく数 */
  pierce: number;
  /** たまの速さ(px/秒)。シールドは回る速さ(rad/秒) */
  speed: number;
  /** 武器ごとの追加パラメータ（ソード: 角度、アイス: 速度倍率） */
  extra: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  /** levelDesc[0] は新しく手に入れたときの説明 */
  levelDesc: [string, string, string, string, string];
  levels: [WeaponStats, WeaponStats, WeaponStats, WeaponStats, WeaponStats];
  evoName: string;
  evoDesc: string;
  evoPassive: PassiveId;
  evo: WeaponStats;
}

const s = (
  damage: number,
  cooldown: number,
  count: number,
  area: number,
  pierce = 0,
  speed = 0,
  extra = 0,
): WeaponStats => ({ damage, cooldown, count, area, pierce, speed, extra });

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sword: {
    id: 'sword',
    name: 'ソード',
    icon: 'ic_sword',
    levelDesc: [
      '近くのてきをなぎはらう',
      'ダメージアップ',
      'はんいアップ',
      'ダメージアップ・少し速く',
      'うしろも同時にこうげき',
    ],
    levels: [
      s(14, 0.95, 1, 160, 0, 0, 140),
      s(20, 0.95, 1, 160, 0, 0, 140),
      s(20, 0.95, 1, 195, 0, 0, 140),
      s(28, 0.85, 1, 195, 0, 0, 140),
      s(32, 0.85, 2, 195, 0, 0, 140),
    ],
    evoName: 'エクスカリバー',
    evoDesc: 'まわり全部を大きくなぎはらう',
    evoPassive: 'power',
    evo: s(60, 0.7, 1, 250, 0, 0, 360),
  },
  bolt: {
    id: 'bolt',
    name: 'マジックショット',
    icon: 'ic_bolt',
    levelDesc: [
      '近くのてきにたまを飛ばす',
      'たまが2つになる',
      'ダメージアップ',
      'たまが3つになる',
      'ダメージアップ・つらぬく',
    ],
    levels: [
      s(10, 0.9, 1, 14, 1, 700),
      s(10, 0.9, 2, 14, 1, 700),
      s(15, 0.9, 2, 14, 1, 700),
      s(15, 0.9, 3, 14, 1, 700),
      s(20, 0.9, 3, 14, 2, 700),
    ],
    evoName: 'スターバースト',
    evoDesc: '星を連射して、てきをつらぬく',
    evoPassive: 'book',
    evo: s(28, 0.45, 5, 18, 4, 850),
  },
  fireball: {
    id: 'fireball',
    name: 'ファイアボール',
    icon: 'ic_fireball',
    levelDesc: [
      '当たるとばくはつする火の玉',
      'ダメージアップ',
      'ばくはつが大きくなる',
      '火の玉が2つになる',
      'ダメージアップ・少し速く',
    ],
    levels: [
      s(20, 2.2, 1, 100, 0, 420),
      s(30, 2.2, 1, 100, 0, 420),
      s(30, 2.2, 1, 130, 0, 420),
      s(30, 2.2, 2, 130, 0, 420),
      s(45, 1.9, 2, 130, 0, 420),
    ],
    evoName: 'メテオ',
    evoDesc: '空からいん石が3つふってくる',
    evoPassive: 'mushroom',
    evo: s(90, 1.6, 3, 170, 0, 0),
  },
  thunder: {
    id: 'thunder',
    name: 'サンダー',
    icon: 'ic_thunder',
    levelDesc: [
      '画面内のてきにかみなりを落とす',
      'かみなりが2本になる',
      'ダメージアップ',
      'かみなりが3本になる',
      'かみなりが4本・ダメージアップ',
    ],
    levels: [s(24, 1.8, 1, 55), s(24, 1.8, 2, 55), s(36, 1.8, 2, 55), s(36, 1.8, 3, 55), s(44, 1.8, 4, 55)],
    evoName: 'サンダーストーム',
    evoDesc: 'かみなりが7本ふりそそぐ',
    evoPassive: 'boots',
    evo: s(75, 1.1, 7, 95),
  },
  shield: {
    id: 'shield',
    name: 'まわるシールド',
    icon: 'ic_shield',
    levelDesc: [
      '自分のまわりを回るたて',
      'たてが3つになる',
      'ダメージアップ',
      'たてが4つになる',
      'ダメージアップ・速く回る',
    ],
    levels: [
      s(9, 0.5, 2, 110, 0, 3.2),
      s(9, 0.5, 3, 110, 0, 3.2),
      s(14, 0.5, 3, 110, 0, 3.2),
      s(14, 0.5, 4, 110, 0, 3.2),
      s(20, 0.5, 4, 110, 0, 4.2),
    ],
    evoName: 'ホーリーシールド',
    evoDesc: '光るたて6つで、てきをはじき飛ばす',
    evoPassive: 'heart',
    evo: s(38, 0.4, 6, 150, 0, 5),
  },
  ice: {
    id: 'ice',
    name: 'アイスウェーブ',
    icon: 'ic_ice',
    levelDesc: [
      '氷の輪を広げて、てきをおそくする',
      'ダメージアップ',
      'はんいアップ',
      'こうげきが速くなる',
      'ダメージアップ・もっとおそくする',
    ],
    levels: [
      s(10, 3.6, 1, 190, 0, 0, 0.5),
      s(16, 3.6, 1, 190, 0, 0, 0.5),
      s(16, 3.6, 1, 240, 0, 0, 0.5),
      s(16, 2.9, 1, 240, 0, 0, 0.5),
      s(26, 2.9, 1, 240, 0, 0, 0.25),
    ],
    evoName: 'ブリザード',
    evoDesc: '大きな氷のあらしで、てきをこおらせる',
    evoPassive: 'magnet',
    evo: s(55, 2.2, 1, 340, 0, 0, 0),
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
