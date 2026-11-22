// スクリーンショットの中心付近に、指定した色がどれだけあるかを数える（目視できない環境での確認用）
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const [file, ...colors] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  const data = fs.readFileSync(file).toString('base64');
  const out = await p.evaluate(async ([d, cols]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    const TOL = 6;
    const res = { size: [c.width, c.height] };
    for (const col of cols) {
      const [r, g, bl] = col.match(/\w\w/g).map((h) => parseInt(h, 16));
      let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let yy = 0; yy < c.height; yy += 2) for (let xx = 0; xx < c.width; xx += 2) {
        const i = (yy * c.width + xx) * 4;
        if (Math.abs(px[i] - r) < TOL && Math.abs(px[i + 1] - g) < TOL && Math.abs(px[i + 2] - bl) < TOL) {
          n++; x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
        }
      }
      res[col] = n ? { n, box: [x0, y0, x1, y1] } : { n: 0 };
    }
    return res;
  }, [data, colors]);
  console.log(file, JSON.stringify(out));
  await b.close();
})();
