// ヘッドレス Chromium（スマホ画面サイズ）での動作確認。
// 使い方: npm run build && npx vite preview --port 4173 を起動してから node scripts/smoke.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// playwright-core はこのリポジトリの依存ではなく、実行環境に入っているものを使う
const { chromium } = createRequire(import.meta.url)('playwright-core');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const KEY = 'dungeon-survivors:save:v2';
const OLD_KEY = 'dungeon-survivors:save:v1';
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
const readSave = () => game((k) => JSON.parse(localStorage.getItem(k)), KEY);
const toTitle = async () => {
  await page.reload();
  await page.waitForFunction(() => window.__ds?.scene.isActive('Title'));
  await page.waitForTimeout(400);
};
/** オーバーレイ（結果画面など）に出ている文字 */
const overlayTexts = () =>
  game(() =>
    (window.__ds.scene.getScene('Hud').overlay?.list ?? []).filter((o) => o.type === 'Text').map((o) => o.text),
  );

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
const L = await game(() => window.__ds.scene.getScene('Title').layout);
const STAGE_X = [360 - 173, 360 + 173];
check('画面サイズ 720 x 縦横比どおり', info.w === 720 && info.h === Math.round((720 * 844) / 390));
check('アトラスのフレームがそろっている', info.frames >= 55, `${info.frames}`);
await shot('01-title');

// ---- 面2はロックされている ----
await tap(STAGE_X[1], L.stage);
check('ロック中の面2はタップしても選べない', (await readSave()) === null);

// ---- ショップ ----
await tap(360, L.shop);
check('強化ショップへ移動', (await active()).includes('Shop'));
await shot('02-shop');
await tap(360, H - 90);
check('タイトルへもどる', (await active()).includes('Title'));

// ---- ゲーム開始 ----
await tap(360, L.start);
await page.waitForTimeout(400);
check('ゲームと HUD が起動', (await active()).join(',') === 'Game,Hud', (await active()).join(','));
check('最初は面1で始まる', (await game(() => window.__ds.scene.getScene('Game').stage.id)) === 'dungeon');

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
await tap(360, H / 2 - 70);
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
await tap(360, H / 2 - 120);
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
const saved = await readSave();
check(
  '結果が保存される（コイン・面1の記録・回数）',
  saved.coins >= 100 && saved.best.dungeon.cleared === true && saved.best.dungeon.dragon === false && saved.plays === 1,
  JSON.stringify(saved),
);
check('ドラゴンをたおしていないので、面2はまだ遊べない', !(await overlayTexts()).some((t) => t.includes('氷のどうくつ')));

// ---- もう1回 → ポーズ → タイトルへ ----
const timerShown = () => game(() => window.__ds.scene.getScene('Hud').timerText.visible);
check('結果画面では残り時間の表示をかくす', (await timerShown()) === false);
await tap(360, Math.max(190, H / 2 - 352) + 562);
await page.waitForTimeout(500);
const retried = await game(() => {
  const g = window.__ds.scene.getScene('Game');
  return { mode: g.mode, elapsed: g.elapsed, hp: g.hp, max: g.stats.maxHp, kills: g.kills };
});
check(
  'もう1回で最初からやり直せる',
  retried.mode === 'play' && retried.elapsed < 3 && retried.hp === retried.max && retried.kills === 0,
  JSON.stringify(retried),
);
check('やり直すと残り時間の表示がもどる', (await timerShown()) === true);
check('やり直し後もゲームと HUD だけが動いている', (await active()).join(',') === 'Game,Hud', (await active()).join(','));
await tap(720 - 58, 88);
await tap(360, H / 2 + 200);
await page.waitForTimeout(400);
check('ポーズからタイトルへもどれる', (await active()).join(',') === 'Title', (await active()).join(','));

// ---- リロード後も残る ----
await page.reload();
await page.waitForFunction(() => window.__ds?.scene.isActive('Title'));
await page.waitForTimeout(400);
await shot('10-title-after');
const reloaded = await readSave();
check('リロード後も残る', reloaded.coins === saved.coins && reloaded.plays === 1);

// ---- キャラクター解放と強化の購入 ----
await tap(360 + 230, L.cards);
check('コインが足りないとキャラクターを買えない', !(await readSave()).unlocked.includes('thief'));
await game((k) => {
  localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)), coins: 1000 }));
}, KEY);
await toTitle();
await tap(360, L.cards);
let s = await readSave();
check('まほう使いを買うと解放されて選ばれる', s.unlocked.includes('mage') && s.selected === 'mage' && s.coins === 850, JSON.stringify(s));
await tap(360 - 230, L.cards);
check('けんしにもどせる', (await readSave()).selected === 'knight');
await tap(360, L.shop);
await tap(720 - 122, Math.max(250, H * 0.2) - 4);
s = await readSave();
check('強化を買うとコインが減ってレベルが上がる', s.meta.atk === 1 && s.coins === 820, JSON.stringify(s.meta));
await shot('11-shop-bought');
await tap(360, H - 90);
await tap(360 + 0, L.cards);
await tap(360, L.start);
await page.waitForTimeout(400);
const mage = await game(() => {
  const g = window.__ds.scene.getScene('Game');
  return { weapon: g.loadout.weapons[0].id, dmg: g.stats.damageMul };
});
check('選んだキャラクターと強化がプレイに反映される', mage.weapon === 'bolt' && Math.abs(mage.dmg - 1.08) < 1e-9, JSON.stringify(mage));

// ---- 面1のドラゴンをたおすと、面2が遊べるようになる ----
await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.debug.invincible = true;
  g.debug.autoPick = () => 0;
  g.elapsed = 299.5;
});
await page.waitForFunction(() => window.__ds.scene.getScene('Game').boss?.def.id === 'dragon');
await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.damageEnemy(g.boss, 1e9);
});
await page.waitForFunction(() => window.__ds.scene.getScene('Hud').overlay !== null);
await page.waitForTimeout(900);
await shot('12-result-unlock');
let texts = await overlayTexts();
check('ドラゴンをたおすと、結果画面で面2の解放を知らせる', texts.some((t) => t.includes('氷のどうくつ')), texts.join(' / '));
s = await readSave();
check('面1の完全クリアが記録される', s.best.dungeon.dragon === true && s.stage === 'dungeon', JSON.stringify(s.best));
const dungeonBest = JSON.stringify(s.best.dungeon);
const fits = await game(() =>
  window.__ds.scene
    .getScene('Hud')
    .overlay.list.filter((o) => o.type === 'Text')
    .every((o) => o.getBounds().left >= 0 && o.getBounds().right <= 720),
);
check('結果画面の文字が画面からはみ出していない', fits);

// ---- 面2を選んで遊ぶ ----
await toTitle();
await shot('13-title-stage2-open');
await tap(STAGE_X[1], L.stage);
check('面2を選べる', (await readSave()).stage === 'iceCave');
await page.waitForTimeout(300);
await shot('14-title-stage2-selected');
await tap(360, L.shop);
await shot('15-shop-stage2');
await tap(360, H - 90);
await tap(360, L.start);
await page.waitForTimeout(400);
const ICE = ['iceSlime', 'snowBat', 'iceWolf', 'snowman', 'iceGolem', 'yeti', 'iceDragon'];
const ice = await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.debug.invincible = true;
  g.debug.autoPick = () => 0;
  return { stage: g.stage.id, floor: g.floor.displayTexture.key, killIcon: g.stage.killIcon };
});
check('面2が氷の床で始まる', ice.stage === 'iceCave' && ice.floor === 'floor_ice', JSON.stringify(ice));
await page.waitForTimeout(4000);
await shot('16-stage2-start');

await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.loadout = { weapons: [{ id: 'sword', level: 3, evolved: false }], passives: [] };
  g.loadoutVersion++;
  g.elapsed = 120;
});
const seen = await page
  .waitForFunction(
    () => {
      const g = window.__ds.scene.getScene('Game');
      const w = (window.__seen ??= { ids: new Set(), dash: false, snowball: false, maxMinionBullets: 0 });
      for (const e of g.enemies) {
        if (!e.active) continue;
        w.ids.add(e.def.id);
        if (e.def.id === 'iceWolf' && e.aiState === 2) w.dash = true;
      }
      const balls = g.bullets.filter((b) => b.active && b.sprite.frame.name === 'snowball').length;
      if (balls > 0) w.snowball = true;
      w.maxMinionBullets = Math.max(w.maxMinionBullets, balls);
      return w.dash && w.snowball && w.ids.has('snowman') && g.elapsed > 135
        ? { ids: [...w.ids], max: w.maxMinionBullets }
        : false;
    },
    null,
    { timeout: 60_000, polling: 50 },
  )
  .then((h) => h.jsonValue())
  .catch(() => null);
check('面2では、オオカミが走り、ゆきだるまが雪玉を投げる', seen !== null, JSON.stringify(seen));
check('面2に出るのは氷のてきだけ', seen !== null && seen.ids.every((id) => ICE.includes(id)), JSON.stringify(seen?.ids));
// 上限は src/config.ts の MAX_MINION_BULLETS
check('ふつうのてきの雪玉は上限をこえない', seen !== null && seen.max <= 10, String(seen?.max));
await shot('17-stage2-snowman');

await game(() => {
  window.__ds.scene.getScene('Game').elapsed = 149.5;
});
await page.waitForFunction(() => window.__ds.scene.getScene('Game').boss?.def.id === 'yeti');
await page.waitForTimeout(1500);
check('面2の 2:30 にイエティが出る', true);
await shot('18-stage2-yeti');
const volley = await page
  .waitForFunction(
    () => {
      const g = window.__ds.scene.getScene('Game');
      if (g.boss?.aiState === 2) window.__charged = true;
      return window.__charged && g.boss?.aiState === 0;
    },
    null,
    { timeout: 30_000, polling: 30 },
  )
  .then(() => true)
  .catch(() => false);
check('イエティがとっしんする', volley);

await game(() => {
  window.__ds.scene.getScene('Game').elapsed = 299.5;
});
await page.waitForFunction(() => window.__ds.scene.getScene('Game').boss?.def.id === 'iceDragon');
await page.waitForFunction(() =>
  window.__ds.scene.getScene('Game').bullets.some((b) => b.active && b.sprite.frame.name === 'eice'),
);
await page.waitForTimeout(700);
check('面2の 5:00 に氷のドラゴンが出て、氷の玉をはく', await game(() => window.__ds.scene.getScene('Game').cleared));
await shot('19-stage2-icedragon');
const hudFits = await game(() => {
  const t = window.__ds.scene.getScene('Hud').timerText;
  const b = t.getBounds();
  return { text: t.text, left: Math.round(b.left), right: Math.round(b.right) };
});
check(
  'ボス戦の表示が左右の部品に重ならない',
  hudFits.text === '氷のドラゴンをたおせ！' && hudFits.left > 150 && hudFits.right < 620,
  JSON.stringify(hudFits),
);

// 氷の玉に当たると足がおそくなる
const speedOf = (chill) =>
  game(async (c) => {
    const g = window.__ds.scene.getScene('Game');
    g.debug.input = { x: 1, y: 0 };
    let ratio = NaN;
    // 計っている間にレベルアップで移動速度が変わったら、計り直す
    for (let i = 0; i < 8; i++) {
      g.chillT = c;
      const speed = g.stats.moveSpeed;
      const x0 = g.px;
      const t0 = g.elapsed;
      await new Promise((r) => setTimeout(r, 500));
      ratio = (g.px - x0) / (g.elapsed - t0) / speed;
      if (g.stats.moveSpeed === speed) break;
    }
    g.debug.input = null;
    return ratio;
  }, chill);
const slow = await speedOf(30);
const normal = await speedOf(0);
check('足がおそくなっている間は速度が 0.6 倍', Math.abs(slow - 0.6) < 0.03 && Math.abs(normal - 1) < 0.03, `${slow} / ${normal}`);
const chilled = await game(async () => {
  const g = window.__ds.scene.getScene('Game');
  g.chillT = 0;
  g.debug.invincible = false;
  g.invuln = 0;
  g.revivesLeft = 0;
  g.hp = 1e9;
  const t0 = performance.now();
  while (performance.now() - t0 < 30_000 && !(g.chillT > 0)) {
    // 氷の玉だけが当たるよう、ほかのてきは消し、ドラゴンは少しはなれた真上に止めておく
    for (const e of g.enemies) if (e.active && e.def.boss !== 2) g.damageEnemy(e, 1e9);
    for (const e of g.enemies) {
      if (!e.active) continue;
      e.x = g.px;
      e.y = g.py - 420;
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  const hit = g.chillT > 0;
  g.debug.invincible = true;
  g.hp = g.stats.maxHp;
  return hit;
});
check('氷の玉に当たると足がおそくなる', chilled);
await page.waitForTimeout(150);
await shot('20-stage2-chilled');

await game(() => {
  const g = window.__ds.scene.getScene('Game');
  g.damageEnemy(g.boss, 1e9);
});
await page.waitForFunction(() => window.__ds.scene.getScene('Hud').overlay !== null);
await page.waitForTimeout(900);
await shot('21-stage2-result');
texts = await overlayTexts();
s = await readSave();
check(
  '面2の結果は面2の記録として残り、面1の記録は変わらない',
  s.best.iceCave.dragon === true && JSON.stringify(s.best.dungeon) === dungeonBest,
  JSON.stringify(s.best),
);
check('面2の結果画面は氷のドラゴンの名前を出す', texts.some((t) => t.includes('氷のドラゴンを たおした')), texts.join(' / '));
await tap(360, Math.max(190, H / 2 - 352) + 562);
await page.waitForTimeout(500);
check('もう1回で、同じ面2をやり直せる', (await game(() => window.__ds.scene.getScene('Game').stage.id)) === 'iceCave');

// ---- 面1にもどせる ----
await toTitle();
await tap(STAGE_X[0], L.stage);
check('面1にもどせる', (await readSave()).stage === 'dungeon');

// ---- 古いセーブ（面が1つだけだったころ）の引きつぎ ----
const v1 = {
  version: 1,
  coins: 321,
  meta: { atk: 2, hp: 1, speed: 0, xp: 0, coin: 0, revive: 1 },
  unlocked: ['knight', 'mage'],
  selected: 'mage',
  best: { time: 340, kills: 777, level: 31, cleared: true, dragon: true },
  muted: true,
  plays: 9,
};
await game(
  ([k, old, data]) => {
    localStorage.removeItem(k);
    localStorage.setItem(old, JSON.stringify(data));
  },
  [KEY, OLD_KEY, v1],
);
await toTitle();
await shot('22-title-migrated');
await tap(STAGE_X[1], L.stage);
s = await readSave();
check(
  '古いセーブのコイン・強化・キャラクター・記録が残り、ドラゴンをたおしていれば面2を選べる',
  s.version === 2 &&
    s.coins === 321 &&
    s.meta.atk === 2 &&
    s.meta.revive === 1 &&
    s.selected === 'mage' &&
    s.plays === 9 &&
    s.best.dungeon.kills === 777 &&
    s.best.dungeon.dragon === true &&
    s.stage === 'iceCave',
  JSON.stringify(s),
);
check('古いセーブは書きかえない', (await game((k) => localStorage.getItem(k), OLD_KEY)) === JSON.stringify(v1));

// ---- 横長の画面（タブレットなど）のタイトル ----
const wide = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
const widePage = await wide.newPage();
widePage.on('pageerror', (e) => errors.push(`pageerror(wide): ${e.message}`));
await widePage.addInitScript(
  ([k, data]) => localStorage.setItem(k, JSON.stringify(data)),
  [OLD_KEY, { ...v1, best: { ...v1.best, dragon: false } }],
);
await widePage.goto(`${BASE}?debug`);
await widePage.waitForFunction(() => window.__ds?.scene.isActive('Title'));
await widePage.waitForTimeout(500);
await widePage.screenshot({ path: `${OUT}/23-title-wide.png` });
const wideInfo = await widePage.evaluate(() => {
  const scene = window.__ds.scene.getScene('Title');
  // 面えらび 2 + キャラクター 3 + スタート + 強化ショップ + 音 のボタン
  const boxes = scene.children.list
    .filter((o) => o.type === 'Container')
    .map((o) => [o.x - o.width / 2, o.y - o.height / 2, o.x + o.width / 2, o.y + o.height / 2].map(Math.round));
  const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  let overlaps = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i], boxes[j])) overlaps++;
  return { h: window.__ds.scale.height, n: boxes.length, overlaps, maxBottom: Math.max(...boxes.map((b) => b[3])) };
});
check(
  '横長の画面でも、タイトルのボタンやカードが重ならず画面に収まる',
  wideInfo.h === 1100 && wideInfo.n === 8 && wideInfo.overlaps === 0 && wideInfo.maxBottom <= 1100,
  JSON.stringify(wideInfo),
);
await wide.close();

check('エラーが出ていない', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} 件失敗`);
  process.exit(1);
}
console.log('\nすべて成功');
