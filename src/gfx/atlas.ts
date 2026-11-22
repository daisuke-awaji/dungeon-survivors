import Phaser from 'phaser';
import { FONT_FAMILY } from '../config';
import { artKey } from './charArt';
import { drawFloor, FLOORS, SPRITES, type SpriteDef } from './sprites';

export const ATLAS = 'atlas';
export const DIGITS = 'digits';

const ATLAS_SIZE = 1024;
const PAD = 3;
const DIGIT_W = 26;
const DIGIT_H = 38;
const DIGIT_CHARS = '0123456789+';

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`テクスチャを作れませんでした: ${key}`);
  return tex;
}

/** 絵のファイルがあるキャラクターはその絵を、ないものはコードでかいた絵を使う */
function resolveSprites(scene: Phaser.Scene): SpriteDef[] {
  return SPRITES.map((s) => {
    const key = artKey(s.name);
    if (!scene.textures.exists(key)) return s;
    const img = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number };
    return { name: s.name, w: img.width, h: img.height, draw: (c) => c.drawImage(img, 0, 0) };
  });
}

/** 起動時に1枚のテクスチャアトラスをつくる。キャラクターは絵のファイル、ほかは Canvas 2D でかく */
export function buildTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS)) return;

  const atlas = canvasTexture(scene, ATLAS, ATLAS_SIZE, ATLAS_SIZE);
  const c = atlas.getContext();
  const sprites = resolveSprites(scene);
  const sorted = [...sprites].sort((a, b) => b.h - a.h);
  let x = PAD;
  let y = PAD;
  let rowH = 0;
  for (const s of sorted) {
    if (x + s.w + PAD > ATLAS_SIZE) {
      x = PAD;
      y += rowH + PAD;
      rowH = 0;
    }
    if (y + s.h + PAD > ATLAS_SIZE) throw new Error('アトラスに入りきりません');
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.rect(0, 0, s.w, s.h);
    c.clip();
    s.draw(c);
    c.restore();
    atlas.add(s.name, 0, x, y, s.w, s.h);
    x += s.w + PAD;
    rowH = Math.max(rowH, s.h);
  }
  atlas.refresh();
  const fromArt = SPRITES.filter((s) => scene.textures.exists(artKey(s.name))).map((s) => s.name);
  for (const name of fromArt) scene.textures.remove(artKey(name));
  // 動作確認で、どのキャラクターが絵のファイルを使ったかを見る
  (atlas.customData as { fromArt?: string[] }).fromArt = fromArt;

  for (const [key, colors] of Object.entries(FLOORS)) {
    const floor = canvasTexture(scene, key, 256, 256);
    drawFloor(floor.getContext(), 256, colors);
    floor.refresh();
  }

  const digits = canvasTexture(scene, DIGITS, DIGIT_W * DIGIT_CHARS.length, DIGIT_H);
  const d = digits.getContext();
  d.font = `bold 32px ${FONT_FAMILY}`;
  d.textAlign = 'center';
  d.textBaseline = 'middle';
  d.lineJoin = 'round';
  d.lineWidth = 6;
  d.strokeStyle = '#1b1530';
  d.fillStyle = '#ffffff';
  for (let i = 0; i < DIGIT_CHARS.length; i++) {
    const cx = i * DIGIT_W + DIGIT_W / 2;
    d.strokeText(DIGIT_CHARS[i], cx, DIGIT_H / 2 + 1);
    d.fillText(DIGIT_CHARS[i], cx, DIGIT_H / 2 + 1);
  }
  digits.refresh();

  scene.cache.bitmapFont.add(
    DIGITS,
    Phaser.GameObjects.RetroFont.Parse(scene, {
      image: DIGITS,
      width: DIGIT_W,
      height: DIGIT_H,
      chars: DIGIT_CHARS,
      charsPerRow: DIGIT_CHARS.length,
      'offset.x': 0,
      'offset.y': 0,
      'spacing.x': 0,
      'spacing.y': 0,
      lineSpacing: 0,
    }),
  );
}
