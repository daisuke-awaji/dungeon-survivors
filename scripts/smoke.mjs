// ヘッドレス Chromium（スマホ画面サイズ）での動作確認。
// 使い方: npm run build && npx vite preview --port 4173 を起動してから node scripts/smoke.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// playwright-core はこのリポジトリの依存ではなく、実行環境に入っているものを使う
const { chromium } = createRequire(import.meta.url)('playwright-core');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const OUT = process.env.SHOT_DIR ?? 'shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const active = () => page.evaluate(() => window.__ds.scene.getScenes(true).map((s) => s.scene.key));
const game = (fn, arg) => page.evaluate(fn, arg);

/** ゲーム内の座標 (720 x H) を画面の座標に直してタップする */
async function tap(gx, gy) {
  const p = await page.evaluate(
    ([x, y]) => {
      const r = window.__ds.canvas.getBoundingClientRect();
      const s = window.__ds.scale;
      return [r.left + (x / s.width) * r.width, r.top + (y / s.height) * r.height];
    },
    [gx, gy],
  );
  await page.touchscreen.tap(p[0], p[1]);
  await page.waitForTimeout(250);
}

await page.goto(`${BASE}?debug`);
await page.waitForFunction(() => window.__ds?.scene.isActive('Title'));
await page.waitForTimeout(500);

const info = await game(() => ({
  w: window.__ds.scale.width,
  h: window.__ds.scale.height,
  webgl: window.__ds.renderer.type === 2,
  frames: Object.keys(window.__ds.textures.get('atlas').frames).length,
}));
console.log('info', info);
const H = info.h;
check('画面サイズ 720 x 縦横比どおり', info.w === 720 && info.h === Math.round((720 * 844) / 390));
check('アトラスのフレームがそろっている', info.frames >= 45, `${info.frames}`);
await shot('01-title');

// ---- ショップ ----
await tap(360, H * 0.735 + 146);
check('強化ショップへ移動', (await active()).includes('Shop'));
await shot('02-shop');
await tap(360, H - 90);
check('タイトルへもどる', (await active()).includes('Title'));

// ---- ゲーム開始 ----
await tap(360, H * 0.735);
await page.waitForTimeout(400);
check('ゲームと HUD が起動', (await active()).join(',') === 'Game,Hud', (await active()).join(','));

// ---- ドラッグで移動 ----
const before = await game(() => {
  const g = window.__ds.scene.getScene('Game');
  return { x: g.px, y: g.py };
});
const cdp = await context.newCDPSession(page);
const touch = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
  });
await touch('touchStart', 200, 600);
for (let i = 1; i <= 10; i++) {
  await touch('touchMove', 200 + i * 8, 600);
  await page.waitForTimeout(40);
}
await page.waitForTimeout(600);
await shot('03-play-drag');
const after = await game(() => {
  const g = window.__ds.scene.getScene('Game');
  return { x: g.px, y: g.py };
});
check('右へドラッグすると右へ動く', after.x - before.x > 100 && Math.abs(after.y - before.y) < 30, JSON.stringify(after));
await touch('touchEnd', 280, 600);
await page.waitForTimeout(300);
const stopped = await game(() => {
  const g = window.__ds.scene.getScene('Game');
  const x = g.px;
  return new Promise((r) => setTimeout(() => r(Math.abs(g.px - x)), 300));
});
check('指をはなすと止まる', stopped < 1, String(stopped));

// ---- ポーズ ----
await tap(720 - 58, 88);
check('ポーズで止まる', (await game(() => window.__ds.scene.getScene('Game').mode)) === 'paused');
await shot('04-pause');
await tap(360, H * 0.42);
check('つづけるで再開', (await game(() => window.__ds.scene.getScene('Game').mode)) === 'play');

// ---- レベルアップ ----
await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.debug.invincible = true;
  g.pendingLevels = 1;
});
await page.waitForFunction(() => window.__ds.scene.getScene('Game').mode === 'choosing');
await page.waitForTimeout(700);
await shot('05-levelup');
const weaponsBefore = await game(() => JSON.stringify(window.__ds.scene.getScene('Game').loadout));
await tap(360, H * 0.15 + 210);
const picked = await game(() => {
  const g = window.__ds.scene.getScene('Game');
  return { mode: g.mode, loadout: JSON.stringify(g.loadout) };
});
check('スキルを選ぶと再開し、反映される', picked.mode === 'play' && picked.loadout !== weaponsBefore, picked.loadout);

// ---- 全武器・進化を持たせて戦わせる ----
for (const set of [
  ['sword', 'bolt', 'fireball'],
  ['thunder', 'shield', 'ice'],
]) {
  for (const evolved of [false, true]) {
    await game(
      ([ids, evo]) => {
        const g = window.__ds.scene.getScene('Game');
        g.loadout = { weapons: ids.map((id) => ({ id, level: 5, evolved: evo })), passives: [] };
        g.loadoutVersion++;
        g.debug.damageDealt = 0;
        g.elapsed = Math.max(g.elapsed, 100);
      },
      [set, evolved],
    );
    await page.waitForTimeout(3500);
    const dmg = await game(() => window.__ds.scene.getScene('Game').debug.damageDealt);
    check(`${set.join('/')} ${evolved ? '進化後' : 'Lv5'} がダメージを与える`, dmg > 0, `${dmg}`);
    await shot(`06-weapons-${set[0]}-${evolved ? 'evo' : 'lv5'}`);
  }
}

// ---- ボス ----
await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.elapsed = 149.5;
});
await page.waitForFunction(() => window.__ds.scene.getScene('Game').boss?.def.id === 'orcKing');
await page.waitForTimeout(1500);
check('2:30 にオークキングが出る', true);
await shot('07-midboss');

await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.elapsed = 299.5;
});
await page.waitForFunction(() => window.__ds.scene.getScene('Game').boss?.def.id === 'dragon');
await page.waitForTimeout(2500);
check('5:00 にドラゴンが出てクリアあつかいになる', await game(() => window.__ds.scene.getScene('Game').cleared));
await shot('08-dragon');

// ---- ゲームオーバー → 結果 → もう1回 ----
await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.debug.invincible = false;
  g.revivesLeft = 0;
  g.invuln = 0;
  g.hp = 1;
  g.hurtPlayer(999);
});
await page.waitForTimeout(2200);
await shot('09-result');
const saved = await game(() => JSON.parse(localStorage.getItem('dungeon-survivors:save:v1')));
check('結果が保存される（コイン・記録・回数）', saved.coins >= 100 && saved.best.cleared === true && saved.plays === 1, JSON.stringify(saved));

await page.reload();
await page.waitForFunction(() => window.__ds?.scene.isActive('Title'));
await page.waitForTimeout(400);
await shot('10-title-after');
const reloaded = await game(() => JSON.parse(localStorage.getItem('dungeon-survivors:save:v1')));
check('リロード後も残る', reloaded.coins === saved.coins);

check('エラーが出ていない', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} 件失敗`);
  process.exit(1);
}
console.log('\nすべて成功');
