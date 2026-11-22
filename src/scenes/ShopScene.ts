import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { GAME_WIDTH } from '../config';
import { META, META_IDS, type MetaId } from '../data/meta';
import { ATLAS, FLOOR } from '../gfx/atlas';
import { buyMeta, metaCost } from '../logic/shop';
import { getSave, setSave } from '../store';
import { COLORS, makeButton, panel, textStyle } from '../ui';

const ROW_H = 112;
const ROW_GAP = 128;

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create(): void {
    const W = GAME_WIDTH;
    const H = this.scale.height;
    const save = getSave();

    this.add.tileSprite(0, 0, W, H, FLOOR).setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x14122b, 0.55).setOrigin(0);

    this.add.text(W / 2, 80, '強化ショップ', textStyle(60, '#ffe14d', { strokeThickness: 10 })).setOrigin(0.5);
    this.add.image(W / 2 - 60, 150, ATLAS, 'coin').setScale(1.4);
    this.add.text(W / 2 - 32, 150, String(save.coins), textStyle(36, '#ffe14d')).setOrigin(0, 0.5);

    const top = Math.max(250, H * 0.2);
    META_IDS.forEach((id, i) => this.row(id, top + i * ROW_GAP));

    makeButton(this, W / 2, H - 90, 360, 88, 'もどる', () => this.scene.start('Title'), {
      color: COLORS.gray,
      fontSize: 36,
    });
  }

  private row(id: MetaId, y: number): void {
    const W = GAME_WIDTH;
    const def = META[id];
    const save = getSave();
    const level = save.meta[id];
    const max = def.costs.length;
    const cost = metaCost(save, id);

    const g = this.add.graphics();
    panel(g, 26, y - ROW_H / 2, W - 52, ROW_H, COLORS.panel);
    this.add.image(84, y, ATLAS, def.icon);
    this.add.text(134, y - 24, def.name, textStyle(30)).setOrigin(0, 0.5);
    this.add
      .text(134, y + 22, def.desc, textStyle(22, '#cfd3ff', { strokeThickness: 3 }))
      .setOrigin(0, 0.5);
    this.add
      .text(308, y - 24, '★'.repeat(level) + '☆'.repeat(max - level), textStyle(24, '#ffe14d', { strokeThickness: 3 }))
      .setOrigin(0, 0.5);

    if (cost === null) {
      makeButton(this, W - 122, y - 4, 164, 72, 'MAX', () => sfx.play('deny'), {
        color: COLORS.gray,
        fontSize: 30,
        sound: false,
      });
      return;
    }

    const affordable = save.coins >= cost;
    const btn = makeButton(
      this,
      W - 122,
      y - 4,
      164,
      72,
      `   ${cost}`,
      () => {
        const next = buyMeta(getSave(), id);
        if (!next) {
          sfx.play('deny');
          this.tweens.add({ targets: btn, x: btn.x + 8, duration: 50, yoyo: true, repeat: 2 });
          return;
        }
        setSave(next);
        sfx.play('buy');
        this.scene.restart();
      },
      { color: affordable ? COLORS.green : COLORS.gray, fontSize: 30, sound: false },
    );
    btn.add(this.add.image(-52, -2, ATLAS, 'coin'));
  }
}
