import Phaser from 'phaser';
import { sfx } from './audio/sfx';
import { FONT_FAMILY } from './config';

export const COLORS = {
  ink: 0x1b1530,
  panel: 0x2a2850,
  panelLight: 0x3a3870,
  green: 0x3fb950,
  blue: 0x3b7be0,
  red: 0xd9423a,
  gold: 0xffc93f,
  gray: 0x6b6b85,
};

export function textStyle(
  size: number,
  color = '#ffffff',
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    stroke: '#1b1530',
    strokeThickness: Math.max(4, Math.round(size / 6)),
    padding: { x: 6, y: 8 },
    ...extra,
  };
}

export function panel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  border = COLORS.ink,
  radius = 22,
  borderWidth = 5,
): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(borderWidth, border, 1);
  g.strokeRoundedRect(x, y, w, h, radius);
}

export interface ButtonOptions {
  color?: number;
  fontSize?: number;
  textColor?: string;
  sound?: boolean;
}

export interface Button extends Phaser.GameObjects.Container {
  label: Phaser.GameObjects.Text;
}

/** おすと少しへこむボタン。指をはなしたときに onClick を呼ぶ */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Button {
  const color = opts.color ?? COLORS.green;
  const dark = Phaser.Display.Color.IntegerToColor(color).darken(28).color;
  const g = scene.add.graphics();
  g.fillStyle(dark, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 22);
  g.fillStyle(color, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h - 4, 22);
  g.lineStyle(5, COLORS.ink, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h + 8, 22);

  const label = scene.add
    .text(0, -2, text, textStyle(opts.fontSize ?? Math.round(h * 0.42), opts.textColor ?? '#ffffff'))
    .setOrigin(0.5);

  const btn = scene.add.container(x, y, [g, label]) as Button;
  btn.label = label;
  btn.setSize(w, h + 8);
  btn.setInteractive({ useHandCursor: true });

  let down = false;
  btn.on('pointerdown', () => {
    down = true;
    btn.setScale(0.95);
  });
  btn.on('pointerout', () => {
    down = false;
    btn.setScale(1);
  });
  btn.on('pointerup', () => {
    btn.setScale(1);
    if (!down) return;
    down = false;
    sfx.unlock();
    if (opts.sound !== false) sfx.play('select');
    onClick();
  });
  return btn;
}

/** 指をおしてからはなしたときだけ反応する（ドラッグ中の指が上を通っても反応しない） */
export function onTap(obj: Phaser.GameObjects.GameObject, handler: () => void): void {
  let down = false;
  obj.on('pointerdown', () => {
    down = true;
  });
  obj.on('pointerout', () => {
    down = false;
  });
  obj.on('pointerup', () => {
    if (!down) return;
    down = false;
    sfx.unlock();
    handler();
  });
}
