export type Ctx = CanvasRenderingContext2D;

export const OUTLINE = '#1b1530';
const TAU = Math.PI * 2;

function paint(c: Ctx, fill: string | CanvasGradient | null, stroke: string | null, lw: number): void {
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke && lw > 0) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
}

export function ell(
  c: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string | CanvasGradient | null,
  stroke: string | null = OUTLINE,
  lw = 4,
): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  paint(c, fill, stroke, lw);
}

export function rrect(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient | null,
  stroke: string | null = OUTLINE,
  lw = 4,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
  paint(c, fill, stroke, lw);
}

export function poly(
  c: Ctx,
  pts: number[],
  fill: string | CanvasGradient | null,
  stroke: string | null = OUTLINE,
  lw = 4,
): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  paint(c, fill, stroke, lw);
}

export function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw: number): void {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  paint(c, null, color, lw);
}

/** 左右対称の形を、中心線 cx で反転して2回かく */
export function mirror(c: Ctx, cx: number, draw: () => void): void {
  draw();
  c.save();
  c.translate(cx * 2, 0);
  c.scale(-1, 1);
  draw();
  c.restore();
}

export function eye(c: Ctx, x: number, y: number, r: number, pupil = '#1b1530', white = '#ffffff'): void {
  ell(c, x, y, r, r, white, OUTLINE, 2);
  ell(c, x, y + r * 0.1, r * 0.5, r * 0.5, pupil, null, 0);
}

export function radial(c: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

export function starPoints(x: number, y: number, outer: number, inner: number, points = 5): number[] {
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  return pts;
}
