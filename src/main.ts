import Phaser from 'phaser';
import { GAME_WIDTH } from './config';
import { computeGameHeight } from './logic/layout';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { ShopScene } from './scenes/ShopScene';
import { TitleScene } from './scenes/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: computeGameHeight(window.innerWidth, window.innerHeight),
  backgroundColor: '#14122b',
  banner: false,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  render: { antialias: true, powerPreference: 'high-performance' },
  scene: [BootScene, TitleScene, ShopScene, GameScene, HudScene],
});

if (new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __ds: Phaser.Game }).__ds = game;
}
