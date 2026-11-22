import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { GAME_WIDTH } from '../config';
import { CHARACTER_IDS, CHARACTERS, type CharacterId } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { STAGE_IDS, STAGES, type StageId } from '../data/stages';
import { ATLAS } from '../gfx/atlas';
import { formatTime, TITLE_SIZES, titleLayout, type TitleLayout } from '../logic/layout';
import { buyCharacter, selectCharacter } from '../logic/shop';
import { isStageUnlocked, selectStage } from '../logic/stages';
import { getSave, setSave } from '../store';
import { COLORS, makeButton, onTap, panel, textStyle } from '../ui';

const CARD_W = 214;
const CARD_H = TITLE_SIZES.cards;
const STAGE_W = 330;
const STAGE_H = TITLE_SIZES.stage;

export class TitleScene extends Phaser.Scene {
  /** 部品の位置。動作確認のスクリプトからも読む */
  layout!: TitleLayout;
  private floor!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('Title');
  }

  create(): void {
    const W = GAME_WIDTH;
    const H = this.scale.height;
    const save = getSave();
    const stage = STAGES[save.stage];
    const L = (this.layout = titleLayout(H));

    this.floor = this.add.tileSprite(0, 0, W, H, stage.floor).setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x14122b, 0.4).setOrigin(0);
    this.add
      .image(W / 2, L.title + 78, ATLAS, ENEMIES[stage.finalBoss].frame)
      .setScale(1.7)
      .setAlpha(0.2);

    const titleY = L.title;
    const t1 = this.add
      .text(W / 2, titleY, 'ダンジョン', textStyle(92, '#ffe14d', { strokeThickness: 14 }))
      .setOrigin(0.5);
    const t2 = this.add
      .text(W / 2, titleY + 100, 'サバイバーズ', textStyle(84, '#ffffff', { strokeThickness: 14 }))
      .setOrigin(0.5);
    this.tweens.add({ targets: [t1, t2], y: '+=10', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.image(W - 170, 44, ATLAS, 'coin').setScale(1.4);
    this.add.text(W - 142, 44, String(save.coins), textStyle(34, '#ffe14d')).setOrigin(0, 0.5);

    STAGE_IDS.forEach((id, i) =>
      this.stageTab(id, W / 2 + (i - (STAGE_IDS.length - 1) / 2) * (STAGE_W + 16), L.stage),
    );

    const cardY = L.cards;
    CHARACTER_IDS.forEach((id, i) => this.characterCard(id, W / 2 + (i - 1) * (CARD_W + 16), cardY));

    const startY = L.start;
    const start = makeButton(this, W / 2, startY, 520, 120, 'スタート', () => this.scene.start('Game'), {
      fontSize: 56,
    });
    this.tweens.add({ targets: start, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    makeButton(this, W / 2, L.shop, 420, 92, '強化ショップ', () => this.scene.start('Shop'), {
      color: COLORS.blue,
      fontSize: 38,
    });

    const sound = makeButton(
      this,
      124,
      L.footer,
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
      .text(W - 24, L.footer, 'ドラッグで移動\nこうげきは自動', textStyle(24, '#cfd3ff', { align: 'right' }))
      .setOrigin(1, 0.5);

    this.input.once('pointerdown', () => sfx.unlock());
  }

  override update(_time: number, delta: number): void {
    this.floor.tilePositionY -= delta * 0.02;
  }

  private soundLabel(): string {
    return getSave().muted ? '音: オフ' : '音: オン';
  }

  private recordText(id: StageId): string {
    const best = getSave().best[id];
    if (best.time === 0 && !best.cleared) return '5分間 生き残れ！';
    const head = best.dragon ? '完全クリア！' : best.cleared ? 'クリア！' : `最高記録 ${formatTime(best.time)}`;
    return `${head} ${best.kills}体 Lv${best.level}`;
  }

  private stageTab(id: StageId, x: number, y: number): void {
    const def = STAGES[id];
    const save = getSave();
    const unlocked = isStageUnlocked(save.best, id);
    const selected = save.stage === id;

    const g = this.add.graphics();
    panel(
      g,
      -STAGE_W / 2,
      -STAGE_H / 2,
      STAGE_W,
      STAGE_H,
      selected ? COLORS.panelLight : COLORS.panel,
      selected ? COLORS.gold : COLORS.ink,
      20,
      selected ? 7 : 5,
    );
    const name = this.add
      .text(0, -19, `${def.number} ${def.name}`, textStyle(30, unlocked ? '#ffffff' : '#9a9ab8'))
      .setOrigin(0.5);
    const boss = def.requires ? ENEMIES[STAGES[def.requires].finalBoss].name : '';
    const sub = this.add
      .text(
        0,
        22,
        unlocked ? this.recordText(id) : `${boss}をたおすと あそべる`,
        textStyle(20, unlocked ? '#cfd3ff' : '#ffd76a', { strokeThickness: 3 }),
      )
      .setOrigin(0.5);
    const tab = this.add.container(x, y, [g, name, sub]);
    if (!unlocked) tab.add(this.add.image(-STAGE_W / 2 + 34, -19, ATLAS, 'lock').setScale(0.8));

    tab.setSize(STAGE_W, STAGE_H);
    tab.setInteractive({ useHandCursor: true });
    onTap(tab, () => {
      if (selected) return;
      const next = selectStage(getSave(), id);
      if (!next) {
        sfx.play('deny');
        this.tweens.add({ targets: tab, x: x + 8, duration: 50, yoyo: true, repeat: 2 });
        return;
      }
      setSave(next);
      sfx.play('select');
      this.scene.restart();
    });
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
