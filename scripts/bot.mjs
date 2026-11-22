// 自動プレイで難易度の目安を確認する。
// 使い方: npm run build && npx vite preview --port 4173 を起動してから
//   node scripts/bot.mjs [キャラクター=knight] [うまさ=0.5] [早送り=6] [永続強化レベル=0] [面=dungeon]
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const [char = 'knight', skillArg = '0.5', stepsArg = '6', metaArg = '0', stage = 'dungeon'] = process.argv.slice(2);
const skill = Number(skillArg);
const steps = Number(stepsArg);
const metaLevel = Number(metaArg);

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));

await page.addInitScript(
  ([c, m, st]) => {
    const none = { time: 0, kills: 0, level: 1, cleared: false, dragon: false };
    localStorage.setItem(
      'dungeon-survivors:save:v2',
      JSON.stringify({
        version: 2,
        coins: 0,
        meta: { atk: m, hp: m, speed: m, xp: m, coin: m, revive: m > 0 ? 1 : 0 },
        unlocked: ['knight', 'mage', 'thief'],
        selected: c,
        stage: st,
        // どの面でも始められるよう、全部の面をクリアずみにしておく
        best: { dungeon: { ...none, cleared: true, dragon: true }, iceCave: { ...none, cleared: true, dragon: true } },
        muted: true,
        plays: 0,
      }),
    );
  },
  [char, metaLevel, stage],
);

await page.goto(`${BASE}?debug`);
await page.waitForFunction(() => window.__ds?.scene.isActive('Title'));
await page.evaluate(() => window.__ds.scene.getScene('Title').scene.start('Game'));
await page.waitForFunction(() => window.__ds.scene.isActive('Hud'));
const playing = await page.evaluate(() => window.__ds.scene.getScene('Game').stage.id);
if (playing !== stage) throw new Error(`面 ${stage} を始められませんでした（始まったのは ${playing}）`);

await page.evaluate(
  ([stepCount, skillLevel]) => {
    const g = window.__ds.scene.getScene('Game');
    const log = (window.__log = { marks: [], minHp: 1, hits: 0, by: {}, midBossDead: null, dragonSeen: null, lastHp: g.hp });
    g.debug.steps = stepCount;
    g.debug.autoPick = (choices) => {
      const evo = choices.findIndex((c) => c.kind === 'evolve');
      return evo >= 0 ? evo : Math.floor(Math.random() * choices.length);
    };
    const dir = { x: 0, y: 0 };
    g.debug.input = dir;
    let nextThink = 0;
    let nextMark = 30;
    let wander = Math.random() * Math.PI * 2;

    g.events.on('postupdate', () => {
      if (g.hp < log.lastHp) {
        log.hits++;
        // だれに当たったかの目安: ふれているてきがいればそのてき、いなければ玉
        let src = 'たま';
        for (const e of g.enemies) {
          if (e.active && Math.hypot(e.x - g.px, e.y - g.py) < e.radius + 18 + 30) {
            src = e.def.name;
            break;
          }
        }
        log.by[src] = (log.by[src] ?? 0) + 1;
      }
      log.lastHp = g.hp;
      log.minHp = Math.min(log.minHp, g.hp / g.stats.maxHp);
      if (g.elapsed >= nextMark) {
        log.marks.push({
          t: nextMark,
          lv: g.level,
          kills: g.kills,
          hp: Math.round((g.hp / g.stats.maxHp) * 100),
          enemies: g.activeEnemies,
          dmg: g.debug.damageDealt,
        });
        nextMark += 30;
      }
      if (log.midBossDead === null && g.midBossSpawned && !g.enemies.some((e) => e.active && e.def.boss === 1))
        log.midBossDead = Math.round(g.elapsed);
      if (g.cleared && log.dragonSeen === null) log.dragonSeen = Math.round(g.elapsed);

      // うまさが低いほど、考え直す間かくが長い（反応がおそい）
      if (g.elapsed < nextThink) return;
      nextThink = g.elapsed + 0.12 + (1 - skillLevel) * 0.5;

      // 近すぎるてきからはなれる。安全なら一番近いアイテムを取りに行く
      const safe = 110 + skillLevel * 60;
      let fx = 0;
      let fy = 0;
      for (const e of g.enemies) {
        if (!e.active) continue;
        const dx = g.px - e.x;
        const dy = g.py - e.y;
        const d = Math.max(10, Math.hypot(dx, dy) - e.radius);
        const reach = e.def.boss ? safe * 2.2 : safe;
        // 中ボスがとっしんの構えをしたら、横へよける（うまいほど気づきやすい）
        if (e.def.boss === 1 && e.aiState > 0 && d < 600 && skillLevel >= 0.5) {
          fx += (-dy / (d + e.radius)) * 3;
          fy += (dx / (d + e.radius)) * 3;
          continue;
        }
        // ふつうのてきのとっしんも、近ければ横へよける
        if (!e.def.boss && e.def.charge && e.aiState > 0 && d < 260 && skillLevel >= 0.5) {
          fx += -dy / (d + e.radius);
          fy += dx / (d + e.radius);
          continue;
        }
        if (d > reach) continue;
        const w = (reach - d) / reach;
        fx += (dx / (d + e.radius)) * w;
        fy += (dy / (d + e.radius)) * w;
      }
      for (const b of g.bullets) {
        if (!b.active) continue;
        const dx = g.px - b.x;
        const dy = g.py - b.y;
        const d = Math.max(10, Math.hypot(dx, dy));
        if (d > 200) continue;
        // たまの進む向きに対して横へよける
        const side = dx * b.vy - dy * b.vx > 0 ? 1 : -1;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        fx += (side * b.vy / sp) * skillLevel * 1.5;
        fy += (-side * b.vx / sp) * skillLevel * 1.5;
      }
      const threat = Math.hypot(fx, fy);

      let gx = 0;
      let gy = 0;
      let best = Infinity;
      for (const p of g.pickups) {
        if (!p.active) continue;
        const d = Math.hypot(p.x - g.px, p.y - g.py);
        if (d < best && d < 900) {
          best = d;
          gx = (p.x - g.px) / (d || 1);
          gy = (p.y - g.py) / (d || 1);
        }
      }

      wander += (Math.random() - 0.5) * 0.8;
      const noise = 0.15 + (1 - skillLevel) * 0.5;
      const flee = threat > 0.05 ? 2.5 : 0;
      let x = fx * flee + gx + Math.cos(wander) * noise;
      let y = fy * flee + gy + Math.sin(wander) * noise;
      const len = Math.hypot(x, y) || 1;
      x /= len;
      y /= len;
      dir.x = x;
      dir.y = y;
    });
  },
  [steps, skill],
);

const started = Date.now();
await page.waitForFunction(() => window.__ds.scene.getScene('Game').mode === 'over', null, {
  timeout: 600_000,
  polling: 500,
});
const result = await page.evaluate(() => {
  const g = window.__ds.scene.getScene('Game');
  return {
    time: Math.round(g.elapsed),
    level: g.level,
    kills: g.kills,
    coins: g.coins,
    cleared: g.cleared,
    dragon: g.dragonSlain,
    loadout: g.loadout.weapons.map((w) => `${w.id}${w.evolved ? '★' : w.level}`).join(' ') +
      ' | ' + g.loadout.passives.map((p) => `${p.id}${p.level}`).join(' '),
    log: window.__log,
  };
});

console.log(`\n== ${stage} ${char} うまさ=${skill} 永続強化=${metaLevel} (実時間 ${Math.round((Date.now() - started) / 1000)}秒) ==`);
for (const m of result.log.marks) {
  console.log(`  ${String(m.t).padStart(3)}秒  Lv${String(m.lv).padStart(2)}  たおした数 ${String(m.kills).padStart(4)}  HP ${String(m.hp).padStart(3)}%  てき ${String(m.enemies).padStart(3)}  与ダメージ ${m.dmg}`);
}
console.log(
  `  結果: ${result.dragon ? '完全クリア' : result.cleared ? 'クリア（最後のボスに負け）' : 'ゲームオーバー'}  時間 ${result.time}秒  Lv${result.level}  ${result.kills}体  コイン ${result.coins}`,
);
console.log(`  被弾 ${result.log.hits}回  中ボス撃破 ${result.log.midBossDead ?? '-'}秒  ${result.loadout}`);
console.log(
  `  内訳: ${Object.entries(result.log.by)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join('  ')}`,
);
await browser.close();
