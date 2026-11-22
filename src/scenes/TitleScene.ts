import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { GAME_WIDTH } from '../config';
import { CHARACTER_IDS, CHARACTERS, type CharacterId } from '../data/characters';
import { ATLAS, FLOOR } from '../gfx/atlas';
import { formatTime } from '../logic/layout';
import { buyCharacter, selectCharacter } from '../logic/shop';
import { getSave, setSave } from '../store';
import { COLORS, makeButton, onTap, panel, textStyle } from '../ui';

const CARD_W = 214;
const CARD_H = 316;

export class TitleScene extends Phaser.Scene {
  private floor!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('Title');
  }

  create(): void {
    const W = GAME_WIDTH;
    const H = this.scale.height;
    const save = getSave();

    this.floor = this.add.tileSprite(0, 0, W, H, FLOOR).setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x14122b, 0.4).setOrigin(0);
    this.add
      .image(W / 2, H * 0.15, ATLAS, 'dragon')
      .setScale(1.7)
      .setAlpha(0.2);

    const titleY = H * 0.1;
    const t1 = this.add
      .text(W / 2, titleY, 'ダンジョン', textStyle(92, '#ffe14d', { strokeThickness: 14 }))
      .setOrigin(0.5);
    const t2 = this.add
      .text(W / 2, titleY + 100, 'サバイバーズ', textStyle(84, '#ffffff', { strokeThickness: 14 }))
      .setOrigin(0.5);
    this.tweens.add({ targets: [t1, t2], y: '+=10', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.image(W - 170, 44, ATLAS, 'coin').setScale(1.4);
    this.add.text(W - 142, 44, String(save.coins), textStyle(34, '#ffe14d')).setOrigin(0, 0.5);

    this.add.text(W / 2, titleY + 188, this.recordText(), textStyle(28, '#cfd3ff')).setOrigin(0.5);

    const cardY = H * 0.47;
    CHARACTER_IDS.forEach((id, i) => this.characterCard(id, W / 2 + (i - 1) * (CARD_W + 16), cardY));

    const startY = H * 0.735;
    const start = makeButton(this, W / 2, startY, 520, 120, 'スタート', () => this.scene.start('Game'), {
      fontSize: 56,
    });
    this.tweens.add({ targets: start, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    makeButton(this, W / 2, startY + 146, 420, 92, '強化ショップ', () => this.scene.start('Shop'), {
      color: COLORS.blue,
      fontSize: 38,
    });

    const sound = makeButton(
      this,
      124,
      H - 62,
      208,
      64,
      this.soundLabel(),
      () => {
        const next = { ...getSave(), muted: !getSave().muted };
        setSave(next);
        sfx.setMuted(next.muted);
        sound.label.setText(this.soundLabel());
        sfx.play('select');
      },
      { color: COLORS.gray, fontSize: 26, sound: false },
    );

    this.add
      .text(W - 24, H - 62, 'ドラッグで移動\nこうげきは自動', textStyle(24, '#cfd3ff', { align: 'right' }))
      .setOrigin(1, 0.5);

    this.input.once('pointerdown', () => sfx.unlock());
  }

  override update(_time: number, delta: number): void {
    this.floor.tilePositionY -= delta * 0.02;
  }

  private soundLabel(): string {
    return getSave().muted ? '音: オフ' : '音: オン';
  }

  private recordText(): string {
    const { best, plays } = getSave();
    if (plays === 0) return '5分間 生き残れ！';
    const head = best.dragon ? '完全クリア！' : best.cleared ? 'クリア！' : `最高記録 ${formatTime(best.time)}`;
    return `${head}  ${best.kills}体  Lv ${best.level}`;
  }

  private characterCard(id: CharacterId, x: number, y: number): void {
    const def = CHARACTERS[id];
    const save = getSave();
    const unlocked = save.unlocked.includes(id);
    const selected = save.selected === id;

    const g = this.add.graphics();
    panel(
      g,
      -CARD_W / 2,
      -CARD_H / 2,
      CARD_W,
      CARD_H,
      selected ? COLORS.panelLight : COLORS.panel,
      selected ? COLORS.gold : COLORS.ink,
      22,
      selected ? 8 : 5,
    );
    const sprite = this.add.image(0, -90, ATLAS, def.frame).setScale(1.5);
    if (!unlocked) sprite.setTint(0x40405a);
    const name = this.add.text(0, -8, def.name, textStyle(30)).setOrigin(0.5);
    const desc = this.add
      .text(0, 46, def.desc, textStyle(20, '#cfd3ff', { align: 'center', strokeThickness: 3 }))
      .setOrigin(0.5);

    const card = this.add.container(x, y, [g, sprite, name, desc]);
    if (selected) {
      card.add(this.add.text(0, 112, 'えらび中', textStyle(24, '#ffe14d')).setOrigin(0.5));
      this.tweens.add({ targets: sprite, y: '-=8', duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (unlocked) {
      card.add(this.add.text(0, 112, 'タップでえらぶ', textStyle(20)).setOrigin(0.5));
    } else {
      const affordable = save.coins >= def.cost;
      card.add(this.add.image(-38, 112, ATLAS, 'coin').setScale(1.1));
      card.add(
        this.add.text(-16, 112, String(def.cost), textStyle(28, affordable ? '#ffe14d' : '#ff8a8a')).setOrigin(0, 0.5),
      );
    }

    card.setSize(CARD_W, CARD_H);
    card.setInteractive({ useHandCursor: true });
    onTap(card, () => {
      const current = getSave();
      const next = unlocked ? selectCharacter(current, id) : buyCharacter(current, id);
      if (!next) {
        sfx.play('deny');
        this.tweens.add({ targets: card, x: x + 8, duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      setSave(next);
      sfx.play(unlocked ? 'select' : 'buy');
      this.scene.restart();
    });
  }
}
