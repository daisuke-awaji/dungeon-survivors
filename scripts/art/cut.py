"""マゼンタ背景のキャラクター画像（art/source/*.png）から1体ずつ切り抜き、
ゲームの大きさにちぢめて src/assets/sprites/<name>.webp に書き出す。

使い方: python3 scripts/art/cut.py   （Python 3 と Pillow・numpy が必要）
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art' / 'source'
OUT = ROOT / 'src' / 'assets' / 'sprites'

# シートごとの並び（上の段の左から右、つぎに下の段）
SHEETS = {
    'heroes.png': [['knight', 'mage', 'thief']],
    'stage1-enemies.png': [['slime', 'bat', 'goblin'], ['skeleton', 'ghost', 'orc']],
    'stage1-bosses.png': [['orcKing', 'dragon']],
    'stage2-enemies.png': [['iceSlime', 'snowBat', 'iceWolf'], ['snowman', 'iceGolem']],
    'stage2-bosses.png': [['yeti', 'iceDragon']],
}

# コードでかいた絵の枠（src/gfx/sprites.ts の w, h）。
# 高さをこの枠にそろえ、横幅は枠の 1.25 倍まで広げてよい。
BOX = {
    'knight': (72, 84), 'mage': (72, 84), 'thief': (72, 84),
    'slime': (60, 52), 'bat': (72, 40), 'goblin': (64, 72), 'skeleton': (60, 76),
    'ghost': (60, 66), 'orc': (92, 98), 'orcKing': (180, 200), 'dragon': (260, 226),
    'iceSlime': (60, 52), 'snowBat': (72, 40), 'iceWolf': (76, 72), 'snowman': (64, 84),
    'iceGolem': (104, 108), 'yeti': (190, 200), 'iceDragon': (260, 226),
}
MAX_WIDEN = 1.25
# 紫・ピンクを絵として使っているキャラクター。これ以外は、体の内側に残ったマゼンタまじりの色も直す
USES_MAGENTA = {'mage', 'orcKing', 'bat'}

MAGENTA = np.array([255.0, 0.0, 255.0])
DOWN = 4  # 体を見つけるときの縮小率（速さのため）
MIN_PARTS = 200  # これより小さいかたまりはごみとして捨てる（縮小後の画素数）


def components(mask: np.ndarray) -> tuple[np.ndarray, list[tuple[int, int, float, float]]]:
    """4近傍でつながったかたまりに番号をつける。(番号, 画素数, 重心y, 重心x) を返す。"""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    found = []
    n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]:
            continue
        n += 1
        lab[y0, x0] = n
        q = deque([(y0, x0)])
        count, sy, sx = 0, 0, 0
        while q:
            y, x = q.popleft()
            count += 1
            sy += y
            sx += x
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    q.append((yy, xx))
        found.append((n, count, sy / count, sx / count))
    return lab, found


def cut_sheet(path: Path, rows: list[list[str]]) -> dict[str, Image.Image]:
    a = np.array(Image.open(path).convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # マゼンタがどれくらいまざっているか（0〜1）
    mix = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1)
    bg = (r > 170) & (b > 170) & (g < 90) & (np.abs(r - b) < 70)

    lab, found = components(~bg[::DOWN, ::DOWN])
    found = [f for f in found if f[1] > MIN_PARTS]
    names = [n for row in rows for n in row]
    if len(found) != len(names):
        raise SystemExit(f'{path.name}: {len(names)} 体のはずが {len(found)} 個見つかった')

    found.sort(key=lambda f: f[2])
    ordered = []
    i = 0
    for row in rows:
        ordered += sorted(found[i:i + len(row)], key=lambda f: f[3])
        i += len(row)

    full = np.kron(lab, np.ones((DOWN, DOWN), np.int32))[: a.shape[0], : a.shape[1]]
    out = {}
    for name, (n, *_rest) in zip(names, ordered):
        region = np.array(Image.fromarray(((full == n) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))) > 0
        body = region & ~bg
        inner = np.array(Image.fromarray((body * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 0
        soft_alpha = np.clip(1 - mix * 1.15, 0, 1)
        # 輪郭のまわりと、体のすきまに残ったぼけた背景（色合いがマゼンタそのもの）
        pocket = body & (r > 200) & (b > 200) & (np.abs(r - b) < 24) & ((np.minimum(r, b) - g) > 60)
        soft = (body & ~inner) | pocket
        alpha = np.where(body, 1.0, 0.0)
        alpha = np.where(soft, np.minimum(alpha, soft_alpha), alpha)

        al = alpha[..., None]
        rgb = np.where(al > 0.02, (a - (1 - al) * MAGENTA) / np.maximum(al, 1e-3), 0)
        rgb = np.clip(rgb, 0, 255)
        # 残ったマゼンタのにじみをおさえる
        limit = rgb[..., 1] + 40
        fix = soft & ((np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]) > 40)
        rgb[..., 0] = np.where(fix, np.minimum(rgb[..., 0], limit), rgb[..., 0])
        rgb[..., 2] = np.where(fix, np.minimum(rgb[..., 2], limit), rgb[..., 2])
        if name not in USES_MAGENTA:
            # 体の内側の、背景がうすくまざった色（白や水色がピンクがかったもの）から、マゼンタを引く
            tinted = body & ~soft & (np.abs(r - b) < 50) & ((np.minimum(r, b) - g) > 30)
            keep = np.clip(1 - mix * 1.15, 0.05, 1)[..., None]
            unmixed = np.clip((a - (1 - keep) * MAGENTA) / keep, 0, 255)
            rgb = np.where(tinted[..., None], unmixed, rgb)

        ys, xs = np.nonzero(alpha > 0.05)
        crop = np.dstack([rgb, alpha * 255]).astype(np.uint8)[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
        out[name] = Image.fromarray(crop, 'RGBA')
    return out


def fit(name: str, im: Image.Image) -> Image.Image:
    bw, bh = BOX[name]
    k = min(bh / im.height, bw * MAX_WIDEN / im.width)
    size = (max(1, round(im.width * k)), max(1, round(im.height * k)))
    # 透明なところの色がまざらないよう、色にアルファをかけてからちぢめる
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for sheet, rows in SHEETS.items():
        for name, im in cut_sheet(SRC / sheet, rows).items():
            small = fit(name, im)
            small.save(OUT / f'{name}.webp', 'WEBP', lossless=True, method=6)
            print(f'{name:10s} {small.width:4d}x{small.height:<4d} (枠 {BOX[name][0]}x{BOX[name][1]})')


if __name__ == '__main__':
    main()
