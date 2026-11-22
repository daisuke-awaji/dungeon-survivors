import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { buildTextures } from '../gfx/atlas';
import { getSave } from '../store';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    buildTextures(this);
    sfx.setMuted(getSave().muted);
    this.scene.start('Title');
  }
}
