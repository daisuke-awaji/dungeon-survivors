import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { GAME_WIDTH, RUN_SECONDS } from '../config';
import { PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';
import { ATLAS } from '../gfx/atlas';
import { formatTime } from '../logic/layout';
import { xpToNext } from '../logic/leveling';
import type { RunResult } from '../logic/rewards';
import type { Choice } from '../logic/skills';
import { getSave, setSave } from '../store';
import { COLORS, makeButton, onTap, panel, textStyle } from '../ui';
import type { GameScene } from './GameScene';

export interface ResultInfo {
  run: RunResult;
  coins: number;
  newBest: boolean;
}

interface CardView {
  icon: string;
  name: string;
  tag: string;
  desc: string;
  border: number;
}

const CARD_W = 650;
const CARD_H = 170;
const BOSS_BAR_W = 440;
const OVERLAY_DEPTH = 100;
const HUD_SHADE_STEPS = 6;

function cardView(c: Choice): CardView {
  switch (c.kind) {
    case 'weapon': {
      const def = WEAPONS[c.id];
      return {
        icon: def.icon,
        name: def.name,
        tag: c.nextLevel === 1 ? 'NEW!' : `Lv ${c.nextLevel}`,
        desc: def.levelDesc[c.nextLevel - 1],
        border: COLORS.blue,
      };
    }
    case 'passive': {
      const def = PASSIVES[c.id];
      return {
        icon: def.icon,
        name: def.name,
        tag: c.nextLevel === 1 ? 'NEW!' : `Lv ${c.nextLevel}`,
        desc: def.desc,
        border: COLORS.green,
      };
    }
    case 'evolve': {
      const def = WEAPONS[c.id];
      return { icon: def.icon, name: def.evoName, tag: '進化！', desc: def.evoDesc, border: COLORS.gold };
    }
    case 'bonus':
      return c.id === 'heal'
        ? { icon: 'ic_heal', name: 'おにく', tag: '', desc: 'HPを 30% 回復する', border: COLORS.gray }
        : { icon: 'ic_coins', name: 'コインぶくろ', tag: '', desc: 'コインを 25 まいもらう', border: COLORS.gray };
  }
}

export class HudScene extends Phaser.Scene {
  private g!: GameScene;
  private ready = false;
  private xpFill!: Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private bossBox!: Phaser.GameObjects.Container;
  private bossFill!: Phaser.GameObjects.Rectangle;
  private bossName!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private vignette!: Phaser.GameObjects.Rectangle;
  private icons!: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Container | null = null;
  private iconsVersion = -1;
  private shownLevel = -1;
  private shownTimer = '';
  private shownKills = -1;
  private shownCoins = -1;
  private shownBoss = '';

  constructor() {
    super('Hud');
  }

  create(): void {
    const W = GAME_WIDTH;
    const H = this.scale.height;
    this.g = this.scene.get('Game') as GameScene;
    this.overlay = null;
    this.iconsVersion = -1;
    this.shownLevel = -1;
    this.shownTimer = '';
    this.shownKills = -1;
    this.shownCoins = -1;
    this.shownBoss = '';

    this.vignette = this.add.rectangle(0, 0, W, H, 0xff2a2a, 0).setOrigin(0);

    // 上の表示がてきにまぎれないよう、うしろを少し暗くする
    for (let i = 0; i < HUD_SHADE_STEPS; i++) {
      this.add.rectangle(0, 32 + i * 22, W, 22, COLORS.ink, 0.5 * (1 - i / HUD_SHADE_STEPS)).setOrigin(0);
    }
    this.add.rectangle(0, 0, W, 32, COLORS.ink).setOrigin(0);
    this.add.rectangle(3, 3, W - 6, 26, 0x2a3156).setOrigin(0);
    this.xpFill = this.add.rectangle(3, 3, W - 6, 26, 0x4fc3f7).setOrigin(0).setScale(0, 1);
    this.levelText = this.add.text(W / 2, 16, '', textStyle(24, '#ffffff', { strokeThickness: 5 })).setOrigin(0.5);

    this.timerText = this.add.text(W / 2, 80, '', textStyle(48)).setOrigin(0.5);

    this.add.image(42, 66, ATLAS, 'slime').setScale(0.62);
    this.killText = this.add.text(70, 66, '', textStyle(28)).setOrigin(0, 0.5);
    this.add.image(42, 108, ATLAS, 'coin');
    this.coinText = this.add.text(70, 108, '', textStyle(28, '#ffe14d')).setOrigin(0, 0.5);

    this.buildPauseButton(W - 58, 88);

    this.icons = this.add.container(0, 0);

    const bossBack = this.add.rectangle(0, 0, BOSS_BAR_W + 8, 34, COLORS.ink).setStrokeStyle(3, 0xffffff, 0.6);
    this.bossFill = this.add.rectangle(-BOSS_BAR_W / 2, 0, BOSS_BAR_W, 26, 0xe0362c).setOrigin(0, 0.5);
    this.bossName = this.add.text(0, 0, '', textStyle(22, '#ffffff', { strokeThickness: 5 })).setOrigin(0.5);
    this.bossBox = this.add.container(W / 2, 284, [bossBack, this.bossFill, this.bossName]).setVisible(false);

    this.bannerText = this.add
      .text(W / 2, H * 0.3, '', textStyle(50, '#ffffff', { align: 'center', strokeThickness: 10 }))
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(50);

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ready = false;
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    });
    this.ready = true;
  }

  override update(): void {
    if (!this.ready) return;
    const g = this.g;

    this.xpFill.setScale(Phaser.Math.Clamp(g.xp / xpToNext(g.level), 0, 1), 1);
    if (g.level !== this.shownLevel) {
      this.shownLevel = g.level;
      this.levelText.setText(`Lv ${g.level}`);
    }

    const remain = Math.max(0, Math.ceil(RUN_SECONDS - g.elapsed));
    const timer = g.cleared ? 'ドラゴンをたおせ！' : formatTime(remain);
    if (timer !== this.shownTimer) {
      this.shownTimer = timer;
      this.timerText
        .setText(timer)
        .setFontSize(g.cleared ? 34 : 48)
        .setColor(g.cleared ? '#ffe14d' : remain <= 10 ? '#ff8a8a' : '#ffffff');
    }

    if (g.kills !== this.shownKills) {
      this.shownKills = g.kills;
      this.killText.setText(String(g.kills));
    }
    if (g.coins !== this.shownCoins) {
      this.shownCoins = g.coins;
      this.coinText.setText(String(g.coins));
    }
    if (g.loadoutVersion !== this.iconsVersion) this.rebuildIcons();

    const boss = g.boss;
    if (boss && boss.active && g.mode !== 'over') {
      this.bossBox.setVisible(true);
      this.bossFill.setScale(Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1), 1);
      if (boss.def.name !== this.shownBoss) {
        this.shownBoss = boss.def.name;
        this.bossName.setText(boss.def.name);
      }
    } else {
      this.bossBox.setVisible(false);
    }
  }

  // ---- つねに出ている部品 ----

  private buildPauseButton(x: number, y: number): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(COLORS.ink, 0.75);
    gfx.fillCircle(0, 0, 38);
    gfx.lineStyle(4, 0xffffff, 0.8);
    gfx.strokeCircle(0, 0, 38);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRoundedRect(-15, -16, 10, 32, 3);
    gfx.fillRoundedRect(5, -16, 10, 32, 3);
    const btn = this.add.container(x, y, [gfx]);
    btn.setSize(96, 96);
    btn.setInteractive({ useHandCursor: true });
    onTap(btn, () => this.openPause());
  }

  private rebuildIcons(): void {
    const g = this.g;
    this.iconsVersion = g.loadoutVersion;
    this.icons.removeAll(true);
    const put = (icon: string, label: string, gold: boolean, col: number, row: number) => {
      const x = 38 + col * 58;
      const y = 164 + row * 58;
      this.icons.add(this.add.image(x, y, ATLAS, icon).setScale(0.66));
      this.icons.add(
        this.add
          .text(x + 24, y + 22, label, textStyle(20, gold ? '#ffe14d' : '#ffffff', { strokeThickness: 5 }))
          .setOrigin(1, 1),
      );
    };
    g.loadout.weapons.forEach((w, i) => put(WEAPONS[w.id].icon, w.evolved ? '★' : String(w.level), w.evolved, i, 0));
    g.loadout.passives.forEach((p, i) => put(PASSIVES[p.id].icon, String(p.level), false, i, 1));
  }

  banner(text: string, color = '#ffffff', hold = 2200): void {
    if (!this.ready) return;
    this.tweens.killTweensOf(this.bannerText);
    this.bannerText.setText(text).setColor(color).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.bannerText, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.bannerText, alpha: 0, duration: 400, delay: hold });
  }

  hurtFlash(): void {
    if (!this.ready) return;
    this.tweens.killTweensOf(this.vignette);
    this.vignette.setFillStyle(0xff2a2a, 0.3);
    this.tweens.add({ targets: this.vignette, fillAlpha: 0, duration: 280 });
  }

  // ---- オーバーレイ ----

  private openOverlay(dimAlpha: number): Phaser.GameObjects.Container {
    this.closeOverlay();
    const dim = this.add
      .rectangle(0, 0, GAME_WIDTH, this.scale.height, 0x0b0a1a, dimAlpha)
      .setOrigin(0)
      .setInteractive();
    this.overlay = this.add.container(0, 0, [dim]).setDepth(OVERLAY_DEPTH);
    return this.overlay;
  }

  private closeOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  showLevelUp(choices: Choice[], onPick: (choice: Choice) => void): void {
    if (!this.ready) return;
    const W = GAME_WIDTH;
    const H = this.scale.height;
    const box = this.openOverlay(0.72);

    const y0 = H / 2 - 330;
    const title = this.add
      .text(W / 2, y0, 'レベルアップ！', textStyle(68, '#ffe14d', { strokeThickness: 12 }))
      .setOrigin(0.5);
    const sub = this.add.text(W / 2, y0 + 70, 'スキルを1つ選ぼう', textStyle(30)).setOrigin(0.5);
    box.add([title, sub]);
    this.tweens.add({ targets: title, scale: { from: 0.5, to: 1 }, duration: 300, ease: 'Back.easeOut' });

    let armed = false;
    this.time.delayedCall(350, () => (armed = true));

    const top = y0 + 210;
    choices.forEach((choice, i) => {
      const v = cardView(choice);
      const gfx = this.add.graphics();
      panel(gfx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, COLORS.panel, v.border, 24, 7);
      const icon = this.add.image(-CARD_W / 2 + 76, 0, ATLAS, v.icon).setScale(1.35);
      const name = this.add
        .text(-CARD_W / 2 + 148, -34, v.name, textStyle(34, choice.kind === 'evolve' ? '#ffe14d' : '#ffffff'))
        .setOrigin(0, 0.5);
      const tag = this.add
        .text(CARD_W / 2 - 20, -40, v.tag, textStyle(26, v.tag.startsWith('Lv') ? '#9fe8ff' : '#ffe14d'))
        .setOrigin(1, 0.5);
      const desc = this.add
        .text(-CARD_W / 2 + 148, 30, v.desc, textStyle(24, '#cfd3ff', { strokeThickness: 3 }))
        .setOrigin(0, 0.5);

      const card = this.add.container(W / 2, top + i * (CARD_H + 24), [gfx, icon, name, tag, desc]);
      card.setSize(CARD_W, CARD_H);
      card.setInteractive({ useHandCursor: true });
      card.setAlpha(0);
      this.tweens.add({
        targets: card,
        alpha: 1,
        scale: { from: 0.85, to: 1 },
        duration: 220,
        delay: 80 + i * 70,
        ease: 'Back.easeOut',
      });
      onTap(card, () => {
        if (!armed || this.overlay !== box) return;
        sfx.play('select');
        this.closeOverlay();
        onPick(choice);
      });
      box.add(card);
    });
  }

  private onHidden(): void {
    this.openPause();
  }

  private openPause(): void {
    if (!this.ready || this.g.mode !== 'play') return;
    this.g.setPaused(true);
    const W = GAME_WIDTH;
    const H = this.scale.height;
    const box = this.openOverlay(0.78);

    const cy = H / 2;
    const back = this.add.graphics();
    panel(back, W / 2 - 280, cy - 300, 560, 600, COLORS.panel);
    box.add(back);
    box.add(this.add.text(W / 2, cy - 215, 'ポーズ', textStyle(72, '#ffffff', { strokeThickness: 12 })).setOrigin(0.5));

    const soundLabel = () => (getSave().muted ? '音: オフ' : '音: オン');
    const resume = makeButton(this, W / 2, cy - 70, 440, 108, 'つづける', () => {
      this.closeOverlay();
      this.g.setPaused(false);
    });
    const sound = makeButton(
      this,
      W / 2,
      cy + 70,
      440,
      92,
      soundLabel(),
      () => {
        const next = { ...getSave(), muted: !getSave().muted };
        setSave(next);
        sfx.setMuted(next.muted);
        sound.label.setText(soundLabel());
        sfx.play('select');
      },
      { color: COLORS.blue, fontSize: 36, sound: false },
    );
    const quit = makeButton(this, W / 2, cy + 200, 440, 92, 'タイトルへ', () => this.toTitle(), {
      color: COLORS.gray,
      fontSize: 36,
    });
    box.add([resume, sound, quit]);
  }

  showResult(info: ResultInfo): void {
    if (!this.ready) return;
    const W = GAME_WIDTH;
    const H = this.scale.height;
    const { run } = info;
    const box = this.openOverlay(0.8);
    // 結果の見出しのうしろに「ドラゴンをたおせ！」などが残らないようにする
    this.timerText.setVisible(false);

    const head = run.dragon
      ? { title: '完全クリア！！', color: '#ffe14d', sub: 'ドラゴンを たおした！' }
      : run.cleared
        ? { title: 'クリア！', color: '#6ee7a0', sub: '5分 生き残った！ 次はドラゴンをたおそう' }
        : { title: 'ゲームオーバー', color: '#ff8a8a', sub: 'また ちょうせんしよう！' };

    const top = Math.max(190, H / 2 - 352);
    const title = this.add
      .text(W / 2, top, head.title, textStyle(76, head.color, { strokeThickness: 14 }))
      .setOrigin(0.5);
    box.add(title);
    box.add(this.add.text(W / 2, top + 84, head.sub, textStyle(30)).setOrigin(0.5));
    this.tweens.add({ targets: title, scale: { from: 0.4, to: 1 }, duration: 380, ease: 'Back.easeOut' });

    const panelY = top + 150;
    const gfx = this.add.graphics();
    panel(gfx, W / 2 - 290, panelY, 580, 316, COLORS.panel);
    box.add(gfx);

    const rows: [string, string, string][] = [
      ['生き残った時間', formatTime(run.time), '#ffffff'],
      ['たおした数', `${run.kills}体`, '#ffffff'],
      ['レベル', String(run.level), '#ffffff'],
      ['もらったコイン', `+${info.coins}`, '#ffe14d'],
    ];
    rows.forEach(([label, value, color], i) => {
      const y = panelY + 52 + i * 70;
      box.add(this.add.text(W / 2 - 250, y, label, textStyle(30, '#cfd3ff')).setOrigin(0, 0.5));
      box.add(this.add.text(W / 2 + 250, y, value, textStyle(36, color)).setOrigin(1, 0.5));
    });

    if (info.newBest) {
      const best = this.add
        .text(W / 2 + 200, top - 64, '新記録！', textStyle(36, '#ffe14d'))
        .setOrigin(0.5)
        .setAngle(8);
      box.add(best);
      this.tweens.add({ targets: best, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
    }

    const btnY = panelY + 316 + 96;
    const retry = makeButton(this, W / 2, btnY, 460, 110, 'もう1回', () => this.g.scene.restart(), { fontSize: 48 });
    const quit = makeButton(this, W / 2, btnY + 136, 460, 88, 'タイトルへ', () => this.toTitle(), {
      color: COLORS.gray,
      fontSize: 34,
    });
    retry.setAlpha(0);
    quit.setAlpha(0);
    this.tweens.add({ targets: [retry, quit], alpha: 1, duration: 250, delay: 500 });
    box.add([retry, quit]);
  }

  private toTitle(): void {
    this.scene.stop('Game');
    this.scene.start('Title');
  }
}
