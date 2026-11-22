const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://localhost:4173/?debug');
  await p.waitForFunction(() => window.__ds?.scene.isActive('Title'));
  const url = await p.evaluate(() => {
    const src = window.__ds.textures.get('atlas').getSourceImage();
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const x = c.getContext('2d');
    x.fillStyle = '#3a3860'; x.fillRect(0, 0, 1024, 1024);
    x.drawImage(src, 0, 0);
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(process.argv[2], Buffer.from(url.split(',')[1], 'base64'));
  const used = await p.evaluate(() => { const f = window.__ds.textures.get('atlas').frames; let m = 0; for (const k in f) if (k !== '__BASE') m = Math.max(m, f[k].cutY + f[k].cutHeight); return m; });
  console.log('atlas used height', used);
  await b.close();
})();
