import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { buildTextures } from '../gfx/atlas';
import { artKey, CHAR_ART } from '../gfx/charArt';
import { getSave } from '../store';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // 読みこめなかった絵は、コードでかいた絵をかわりに使う
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`絵を読みこめませんでした: ${file.key}`);
    });
    for (const [name, url] of Object.entries(CHAR_ART)) this.load.image(artKey(name), url);
  }

  create(): void {
    buildTextures(this);
    sfx.setMuted(getSave().muted);
    this.scene.start('Title');
  }
}
