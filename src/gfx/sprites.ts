import { ell, eye, line, mirror, OUTLINE, poly, radial, rrect, starPoints, type Ctx } from './draw';

export interface SpriteDef {
  name: string;
  w: number;
  h: number;
  draw: (c: Ctx) => void;
}

const SKIN = '#f6cfa6';

function feet(c: Ctx, cx: number, y: number, color = '#4a3426'): void {
  ell(c, cx - 8, y, 8, 5, color, OUTLINE, 3);
  ell(c, cx + 8, y, 8, 5, color, OUTLINE, 3);
}

function dotEyes(c: Ctx, cx: number, y: number, gap = 7): void {
  ell(c, cx - gap, y, 3, 3.6, OUTLINE, null, 0);
  ell(c, cx + gap, y, 3, 3.6, OUTLINE, null, 0);
  ell(c, cx - gap + 1, y - 1.2, 1, 1, '#ffffff', null, 0);
  ell(c, cx + gap + 1, y - 1.2, 1, 1, '#ffffff', null, 0);
}

function brows(c: Ctx, cx: number, y: number, gap: number, len: number, lw = 3): void {
  line(c, cx - gap - len, y - len * 0.5, cx - gap + len, y + len * 0.5, OUTLINE, lw);
  line(c, cx + gap + len, y - len * 0.5, cx + gap - len, y + len * 0.5, OUTLINE, lw);
}

// ---- プレイヤー ----

function knight(c: Ctx): void {
  feet(c, 36, 76);
  line(c, 58, 64, 66, 34, OUTLINE, 9);
  line(c, 58, 64, 66, 34, '#e6edf5', 5);
  line(c, 53, 58, 65, 62, '#c9902e', 5);
  rrect(c, 22, 46, 28, 26, 8, '#3b6fd4');
  ell(c, 15, 60, 10, 11, '#f0c040', OUTLINE, 3);
  ell(c, 15, 60, 4, 5, '#d9423a', null, 0);
  ell(c, 36, 31, 20, 19, SKIN);
  c.beginPath();
  c.arc(36, 29, 21, Math.PI, 0);
  c.closePath();
  c.fillStyle = '#b9c2cf';
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = OUTLINE;
  c.stroke();
  ell(c, 36, 9, 7, 8, '#e04848', OUTLINE, 3);
  dotEyes(c, 36, 37);
}

function mage(c: Ctx): void {
  line(c, 61, 30, 61, 78, OUTLINE, 8);
  line(c, 61, 30, 61, 78, '#8d5a2b', 4);
  ell(c, 61, 26, 7, 7, '#6fe3ff', OUTLINE, 3);
  poly(c, [22, 50, 50, 50, 57, 80, 15, 80], '#7a3fd0');
  ell(c, 36, 42, 18, 17, SKIN);
  poly(c, [36, 2, 56, 34, 16, 34], '#5b2aa8');
  ell(c, 36, 34, 27, 7, '#5b2aa8');
  poly(c, starPoints(36, 22, 6, 2.6), '#ffe14d', null, 0);
  dotEyes(c, 36, 46);
}

function thief(c: Ctx): void {
  feet(c, 36, 76, '#2b2b3a');
  line(c, 56, 66, 66, 52, OUTLINE, 8);
  line(c, 56, 66, 66, 52, '#e6edf5', 4);
  rrect(c, 22, 46, 28, 26, 8, '#2f7d4f');
  ell(c, 36, 31, 20, 19, SKIN);
  c.beginPath();
  c.moveTo(14, 34);
  c.bezierCurveTo(10, 4, 62, 4, 58, 34);
  c.lineTo(52, 30);
  c.bezierCurveTo(50, 18, 22, 18, 20, 30);
  c.closePath();
  c.fillStyle = '#256341';
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = OUTLINE;
  c.lineJoin = 'round';
  c.stroke();
  rrect(c, 18, 45, 36, 9, 4, '#d9423a', OUTLINE, 3);
  dotEyes(c, 36, 36);
}

// ---- てき ----

function slimeBody(c: Ctx, color: string): void {
  c.beginPath();
  c.moveTo(5, 42);
  c.bezierCurveTo(5, 4, 55, 4, 55, 42);
  c.quadraticCurveTo(30, 52, 5, 42);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = OUTLINE;
  c.lineJoin = 'round';
  c.stroke();
  ell(c, 19, 19, 6, 4, 'rgba(255,255,255,0.6)', null, 0);
  eye(c, 22, 31, 6);
  eye(c, 38, 31, 6);
  c.beginPath();
  c.arc(30, 39, 4, 0.1 * Math.PI, 0.9 * Math.PI);
  c.lineWidth = 2.5;
  c.strokeStyle = OUTLINE;
  c.stroke();
}

function slime(c: Ctx): void {
  slimeBody(c, '#5fd35f');
}

function batBody(c: Ctx, wing: string, body: string, eyeColor: string): void {
  mirror(c, 36, () => poly(c, [30, 22, 20, 5, 4, 9, 10, 20, 2, 32, 17, 27, 26, 36], wing, OUTLINE, 3));
  mirror(c, 36, () => poly(c, [27, 14, 26, 3, 34, 11], body, OUTLINE, 3));
  ell(c, 36, 24, 13, 13, body, OUTLINE, 3);
  eye(c, 31, 22, 4, '#1b1530', eyeColor);
  eye(c, 41, 22, 4, '#1b1530', eyeColor);
  poly(c, [32, 29, 34, 34, 36, 29], '#ffffff', null, 0);
  poly(c, [36, 29, 38, 34, 40, 29], '#ffffff', null, 0);
}

function bat(c: Ctx): void {
  batBody(c, '#6a3fa8', '#8e5bd0', '#ffe14d');
}

function goblin(c: Ctx): void {
  feet(c, 32, 64);
  rrect(c, 20, 44, 24, 20, 6, '#8d5a2b');
  mirror(c, 32, () => poly(c, [16, 22, 1, 14, 13, 36], '#7fb342', OUTLINE, 3));
  ell(c, 32, 28, 19, 18, '#8bc34a');
  eye(c, 25, 27, 5);
  eye(c, 39, 27, 5);
  brows(c, 32, 19, 7, 5);
  line(c, 26, 38, 38, 38, OUTLINE, 2.5);
  poly(c, [35, 38, 37, 33, 39, 38], '#ffffff', OUTLINE, 1.5);
}

function skeleton(c: Ctx): void {
  feet(c, 30, 68, '#e4e4d8');
  rrect(c, 21, 46, 18, 20, 4, '#e4e4d8', OUTLINE, 3);
  line(c, 23, 52, 37, 52, OUTLINE, 2);
  line(c, 23, 58, 37, 58, OUTLINE, 2);
  rrect(c, 20, 32, 20, 14, 4, '#f4f4ea', OUTLINE, 3);
  ell(c, 30, 23, 19, 18, '#f4f4ea');
  ell(c, 23, 24, 5, 6, OUTLINE, null, 0);
  ell(c, 37, 24, 5, 6, OUTLINE, null, 0);
  poly(c, [30, 29, 27, 34, 33, 34], OUTLINE, null, 0);
  for (const x of [25, 30, 35]) line(c, x, 39, x, 44, OUTLINE, 2);
}

function ghost(c: Ctx): void {
  c.beginPath();
  c.moveTo(8, 60);
  c.lineTo(8, 30);
  c.bezierCurveTo(8, 0, 52, 0, 52, 30);
  c.lineTo(52, 60);
  c.quadraticCurveTo(44.7, 50, 37.3, 60);
  c.quadraticCurveTo(30, 50, 22.7, 60);
  c.quadraticCurveTo(15.3, 50, 8, 60);
  c.closePath();
  c.fillStyle = 'rgba(228,240,255,0.94)';
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = '#4a5f8f';
  c.lineJoin = 'round';
  c.stroke();
  ell(c, 22, 27, 5, 7, OUTLINE, null, 0);
  ell(c, 38, 27, 5, 7, OUTLINE, null, 0);
  ell(c, 30, 42, 5, 6, OUTLINE, null, 0);
}

function orcBody(c: Ctx, skin: string, skinDark: string, cloth: string): void {
  feet(c, 46, 90, skinDark);
  rrect(c, 22, 50, 48, 38, 12, cloth);
  rrect(c, 22, 68, 48, 9, 3, '#6b4423', OUTLINE, 3);
  rrect(c, 41, 67, 10, 11, 2, '#f0c040', OUTLINE, 2);
  mirror(c, 46, () => poly(c, [22, 26, 4, 20, 18, 42], skinDark, OUTLINE, 3));
  ell(c, 46, 34, 28, 26, skin);
  eye(c, 36, 30, 6, '#1b1530', '#ffdf6b');
  eye(c, 56, 30, 6, '#1b1530', '#ffdf6b');
  brows(c, 46, 20, 10, 7, 4);
  line(c, 34, 46, 58, 46, OUTLINE, 3);
  mirror(c, 46, () => poly(c, [33, 47, 37, 35, 41, 47], '#ffffff', OUTLINE, 2));
}

function orc(c: Ctx): void {
  orcBody(c, '#5d9645', '#4e7d3a', '#7a5a3a');
}

function orcKing(c: Ctx): void {
  c.save();
  c.translate(4, 14);
  c.scale(1.85, 1.85);
  orcBody(c, '#c9573f', '#a8442f', '#5b2aa8');
  poly(c, [24, 14, 22, -4, 34, 6, 46, -6, 58, 6, 70, -4, 68, 14], '#ffd23f', OUTLINE, 3);
  ell(c, 46, 7, 3, 3, '#e04848', null, 0);
  c.restore();
}

interface DragonColors {
  wing: string;
  body: string;
  belly: string;
  bellyLine: string;
  snout: string;
  horn: string;
  eye: string;
}

function dragonBody(c: Ctx, p: DragonColors): void {
  mirror(c, 130, () =>
    poly(c, [124, 112, 62, 18, 8, 40, 32, 78, 6, 110, 42, 118, 30, 152, 92, 142], p.wing, OUTLINE, 5),
  );
  mirror(c, 130, () => line(c, 118, 108, 40, 60, 'rgba(0,0,0,0.25)', 4));
  mirror(c, 130, () => ell(c, 98, 208, 22, 13, p.wing, OUTLINE, 5));
  ell(c, 130, 152, 62, 60, p.body, OUTLINE, 5);
  ell(c, 130, 164, 38, 42, p.belly, OUTLINE, 4);
  for (const y of [146, 162, 178]) line(c, 104, y, 156, y, p.bellyLine, 3);
  mirror(c, 130, () => poly(c, [104, 54, 88, 12, 118, 44], p.horn, OUTLINE, 4));
  ell(c, 130, 84, 50, 42, p.body, OUTLINE, 5);
  ell(c, 130, 104, 28, 18, p.snout, OUTLINE, 4);
  ell(c, 120, 101, 3.5, 4.5, OUTLINE, null, 0);
  ell(c, 140, 101, 3.5, 4.5, OUTLINE, null, 0);
  mirror(c, 130, () => {
    ell(c, 108, 74, 12, 10, p.eye, OUTLINE, 3);
    ell(c, 109, 74, 3.5, 8, OUTLINE, null, 0);
    line(c, 92, 58, 120, 66, OUTLINE, 5);
    poly(c, [112, 116, 117, 127, 122, 117], '#ffffff', OUTLINE, 2);
  });
}

function dragon(c: Ctx): void {
  dragonBody(c, {
    wing: '#a82a22',
    body: '#e0362c',
    belly: '#f6c453',
    bellyLine: 'rgba(120,70,0,0.45)',
    snout: '#ee6a5c',
    horn: '#f4ead5',
    eye: '#ffe14d',
  });
}

// ---- てき（氷のどうくつ） ----

function iceSlime(c: Ctx): void {
  slimeBody(c, '#9fe8ff');
  mirror(c, 30, () => poly(c, [14, 14, 10, 2, 22, 9], '#eafaff', OUTLINE, 3));
}

function snowBat(c: Ctx): void {
  batBody(c, '#bcd9f2', '#f2f8ff', '#6fd6ff');
}

function iceWolf(c: Ctx): void {
  ell(c, 26, 65, 8, 5, '#a9c4dc', OUTLINE, 3);
  ell(c, 50, 65, 8, 5, '#a9c4dc', OUTLINE, 3);
  poly(c, [52, 54, 72, 40, 66, 60], '#eef5fc', OUTLINE, 3);
  rrect(c, 22, 40, 32, 24, 10, '#c3d8ea');
  mirror(c, 38, () => poly(c, [20, 20, 15, 2, 32, 12], '#c3d8ea', OUTLINE, 3));
  ell(c, 38, 28, 22, 19, '#dbe9f5');
  ell(c, 38, 37, 11, 8, '#ffffff', OUTLINE, 2.5);
  ell(c, 38, 33, 3.5, 2.5, OUTLINE, null, 0);
  eye(c, 28, 25, 4.5, '#1b1530', '#8fe0ff');
  eye(c, 48, 25, 4.5, '#1b1530', '#8fe0ff');
  brows(c, 38, 17, 9, 5);
  mirror(c, 38, () => poly(c, [32, 41, 34, 47, 36, 41], '#ffffff', OUTLINE, 1.5));
}

function snowman(c: Ctx): void {
  mirror(c, 32, () => line(c, 11, 58, 3, 44, OUTLINE, 7));
  mirror(c, 32, () => line(c, 11, 58, 3, 44, '#8d5a2b', 3));
  ell(c, 32, 60, 24, 21, '#ffffff');
  ell(c, 32, 28, 18, 17, '#ffffff');
  poly(c, [19, 15, 23, 2, 41, 2, 45, 15], '#3b6fd4', OUTLINE, 3);
  rrect(c, 40, 44, 9, 17, 3, '#e04848', OUTLINE, 3);
  rrect(c, 15, 40, 34, 9, 4, '#e04848', OUTLINE, 3);
  ell(c, 25, 26, 3, 3.6, OUTLINE, null, 0);
  ell(c, 39, 26, 3, 3.6, OUTLINE, null, 0);
  brows(c, 32, 19, 7, 4);
  poly(c, [31, 29, 46, 33, 31, 35], '#ff9a1f', OUTLINE, 2);
  ell(c, 32, 58, 2.6, 2.6, OUTLINE, null, 0);
  ell(c, 32, 68, 2.6, 2.6, OUTLINE, null, 0);
}

function iceGolem(c: Ctx): void {
  rrect(c, 27, 84, 20, 21, 5, '#5f9fd0');
  rrect(c, 57, 84, 20, 21, 5, '#5f9fd0');
  mirror(c, 52, () => rrect(c, 3, 40, 22, 44, 8, '#8cc8ee'));
  mirror(c, 52, () => ell(c, 14, 86, 13, 12, '#b6e4fa'));
  mirror(c, 52, () => poly(c, [24, 38, 13, 16, 36, 30], '#e3f6ff', OUTLINE, 3));
  rrect(c, 22, 34, 60, 56, 12, '#8cc8ee');
  line(c, 30, 44, 42, 56, 'rgba(255,255,255,0.55)', 3);
  line(c, 66, 76, 74, 66, 'rgba(255,255,255,0.4)', 3);
  poly(c, [52, 50, 62, 63, 52, 78, 42, 63], '#eafcff', OUTLINE, 3);
  rrect(c, 32, 8, 40, 34, 8, '#b6e4fa');
  rrect(c, 38, 21, 10, 8, 2, '#fff27a', OUTLINE, 2);
  rrect(c, 56, 21, 10, 8, 2, '#fff27a', OUTLINE, 2);
  brows(c, 52, 16, 9, 6, 3.5);
  line(c, 44, 35, 60, 35, OUTLINE, 3);
}

function yeti(c: Ctx): void {
  mirror(c, 95, () => ell(c, 62, 186, 26, 12, '#bfd3ea', OUTLINE, 5));
  mirror(c, 95, () => ell(c, 30, 120, 24, 50, '#eef3fa', OUTLINE, 5));
  mirror(c, 95, () => ell(c, 27, 166, 20, 16, '#8fbde6', OUTLINE, 5));
  ell(c, 95, 124, 62, 64, '#f4f8fd', OUTLINE, 5);
  ell(c, 95, 138, 36, 38, '#cfe2f5', OUTLINE, 4);
  mirror(c, 95, () => poly(c, [60, 42, 40, 6, 76, 26], '#8fbde6', OUTLINE, 4));
  poly(c, [66, 28, 78, 8, 87, 22, 95, 4, 103, 22, 112, 8, 124, 28], '#f4f8fd', OUTLINE, 4);
  ell(c, 95, 64, 50, 44, '#f4f8fd', OUTLINE, 5);
  ell(c, 95, 72, 35, 29, '#8fbde6', OUTLINE, 4);
  mirror(c, 95, () => eye(c, 80, 62, 8, '#1b1530', '#ffe14d'));
  brows(c, 95, 48, 15, 10, 5);
  rrect(c, 76, 80, 38, 14, 5, '#3a2440', OUTLINE, 3);
  mirror(c, 95, () => poly(c, [80, 81, 85, 91, 90, 81], '#ffffff', OUTLINE, 2));
}

function iceDragon(c: Ctx): void {
  dragonBody(c, {
    wing: '#3d8fd0',
    body: '#74c8f7',
    belly: '#d8f1ff',
    bellyLine: 'rgba(20,70,130,0.4)',
    snout: '#8fcdf5',
    horn: '#ffffff',
    eye: '#fff27a',
  });
}

// ---- アイテム・たま ----

function gem(color: string, light: string, s: number): (c: Ctx) => void {
  return (c) => {
    c.save();
    c.scale(s, s);
    poly(c, [13, 2, 24, 12, 13, 28, 2, 12], color, OUTLINE, 3);
    poly(c, [13, 4, 5, 12, 13, 12], light, null, 0);
    poly(c, [13, 4, 21, 12, 13, 12], 'rgba(255,255,255,0.25)', null, 0);
    c.restore();
  };
}

function coin(c: Ctx): void {
  ell(c, 15, 15, 12, 12, '#ffd23f', '#7a4e00', 3);
  ell(c, 15, 15, 7, 7, '#ffe98a', '#c98f00', 2);
  ell(c, 11, 10, 2.5, 2.5, 'rgba(255,255,255,0.8)', null, 0);
}

function heart(c: Ctx): void {
  c.beginPath();
  c.moveTo(17, 29);
  c.bezierCurveTo(-4, 14, 6, -2, 17, 9);
  c.bezierCurveTo(28, -2, 38, 14, 17, 29);
  c.closePath();
  c.fillStyle = '#ff4d6d';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = OUTLINE;
  c.lineJoin = 'round';
  c.stroke();
  ell(c, 11, 11, 3, 2.2, 'rgba(255,255,255,0.75)', null, 0);
}

function magnet(c: Ctx): void {
  const path = () => {
    c.beginPath();
    c.moveTo(8, 6);
    c.lineTo(8, 17);
    c.arc(18, 17, 10, Math.PI, 0, true);
    c.lineTo(28, 6);
  };
  c.lineCap = 'butt';
  path();
  c.lineWidth = 14;
  c.strokeStyle = OUTLINE;
  c.stroke();
  path();
  c.lineWidth = 9;
  c.strokeStyle = '#e04848';
  c.stroke();
  c.lineWidth = 9;
  c.strokeStyle = '#ffffff';
  for (const x of [8, 28]) {
    c.beginPath();
    c.moveTo(x, 6);
    c.lineTo(x, 12);
    c.stroke();
  }
}

function bolt(c: Ctx): void {
  ell(c, 16, 16, 16, 16, radial(c, 16, 16, 16, [[0, 'rgba(160,230,255,0.9)'], [1, 'rgba(120,200,255,0)']]), null, 0);
  ell(c, 16, 16, 8, 8, '#eafaff', '#3b8fd4', 2.5);
}

function starShot(c: Ctx): void {
  poly(c, starPoints(20, 21, 17, 7.5), '#ffe14d', '#8a5a00', 3);
  poly(c, starPoints(20, 21, 8, 3.5), '#fff8c4', null, 0);
}

function fireball(c: Ctx): void {
  const g = radial(c, 24, 24, 21, [[0, '#fff7b0'], [0.55, '#ff9a1f'], [1, '#e0361a']]);
  ell(c, 24, 24, 20, 20, g, '#7a1500', 3);
}

function meteor(c: Ctx): void {
  const g = radial(c, 40, 40, 39, [[0.4, '#ffd76a'], [0.75, '#ff7a1f'], [1, 'rgba(224,54,26,0)']]);
  ell(c, 40, 40, 39, 39, g, null, 0);
  ell(c, 40, 40, 24, 24, '#6b3b24', OUTLINE, 3);
  ell(c, 33, 34, 6, 5, '#4f2a18', null, 0);
  ell(c, 48, 46, 5, 4, '#4f2a18', null, 0);
}

function shield(fill: string, edge: string): (c: Ctx) => void {
  return (c) => {
    poly(c, [22, 3, 40, 9, 40, 26, 22, 47, 4, 26, 4, 9], fill, OUTLINE, 4);
    poly(c, [22, 9, 34, 13, 34, 25, 22, 39, 10, 25, 10, 13], null, edge, 2.5);
    line(c, 22, 14, 22, 33, '#ffffff', 4);
    line(c, 15, 21, 29, 21, '#ffffff', 4);
  };
}

function enemyFire(c: Ctx): void {
  const g = radial(c, 20, 20, 18, [[0, '#ffffff'], [0.45, '#ff5a3c'], [1, '#8a1f6a']]);
  ell(c, 20, 20, 16, 16, g, '#3d0a2a', 3);
}

/** てきの玉は、ジェムとまちがえないよう、外側を赤くふちどる */
const DANGER_RIM = '#ff4b3a';

function enemyIce(c: Ctx): void {
  ell(c, 22, 22, 19.5, 19.5, null, DANGER_RIM, 3);
  const g = radial(c, 22, 22, 18, [[0, '#ffffff'], [0.5, '#7fdcff'], [1, '#2a6fd0']]);
  ell(c, 22, 22, 16, 16, g, '#0b1f3a', 3);
  poly(c, starPoints(22, 22, 9, 3.5, 4), '#ffffff', null, 0);
}

function snowball(c: Ctx): void {
  ell(c, 19, 19, 16.5, 16.5, null, DANGER_RIM, 3);
  ell(c, 19, 19, 13, 13, '#ffffff', '#0b1f3a', 4);
  ell(c, 22, 23, 6.5, 5.5, 'rgba(140,180,225,0.55)', null, 0);
}

function lock(c: Ctx): void {
  c.beginPath();
  c.arc(20, 19, 10, Math.PI, 0);
  c.lineWidth = 10;
  c.strokeStyle = OUTLINE;
  c.stroke();
  c.lineWidth = 4;
  c.strokeStyle = '#cfd3ff';
  c.stroke();
  rrect(c, 5, 19, 30, 24, 6, '#ffc93f');
  ell(c, 20, 29, 3.5, 3.5, OUTLINE, null, 0);
  line(c, 20, 30, 20, 36, OUTLINE, 3);
}

// ---- エフェクト ----

function slash(c: Ctx): void {
  const arc = (r: number, a: number, lw: number, color: string) => {
    c.beginPath();
    c.arc(8, 125, r, -a, a);
    c.lineWidth = lw;
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.stroke();
  };
  arc(98, 1.05, 40, 'rgba(255,255,255,0.28)');
  arc(104, 1.0, 24, 'rgba(255,255,255,0.6)');
  arc(110, 0.92, 10, '#ffffff');
}

function ring(c: Ctx): void {
  c.beginPath();
  c.arc(128, 128, 104, 0, Math.PI * 2);
  c.lineWidth = 26;
  c.strokeStyle = 'rgba(255,255,255,0.3)';
  c.stroke();
  c.beginPath();
  c.arc(128, 128, 114, 0, Math.PI * 2);
  c.lineWidth = 12;
  c.strokeStyle = '#ffffff';
  c.stroke();
}

function glow(c: Ctx): void {
  const g = radial(c, 64, 64, 64, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  ell(c, 64, 64, 64, 64, g, null, 0);
}

function icon(bg: string, emoji: string): (c: Ctx) => void {
  return (c) => {
    rrect(c, 3, 3, 70, 70, 16, bg, 'rgba(255,255,255,0.55)', 4);
    c.font = '44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffffff';
    c.fillText(emoji, 38, 41);
  };
}

const WEAPON_BG = '#2b3f7a';
const PASSIVE_BG = '#2c6a45';
const BONUS_BG = '#7a552b';

export const SPRITES: SpriteDef[] = [
  { name: 'knight', w: 72, h: 84, draw: knight },
  { name: 'mage', w: 72, h: 84, draw: mage },
  { name: 'thief', w: 72, h: 84, draw: thief },
  { name: 'slime', w: 60, h: 52, draw: slime },
  { name: 'bat', w: 72, h: 40, draw: bat },
  { name: 'goblin', w: 64, h: 72, draw: goblin },
  { name: 'skeleton', w: 60, h: 76, draw: skeleton },
  { name: 'ghost', w: 60, h: 66, draw: ghost },
  { name: 'orc', w: 92, h: 98, draw: orc },
  { name: 'orcKing', w: 180, h: 200, draw: orcKing },
  { name: 'dragon', w: 260, h: 226, draw: dragon },
  { name: 'iceSlime', w: 60, h: 52, draw: iceSlime },
  { name: 'snowBat', w: 72, h: 40, draw: snowBat },
  { name: 'iceWolf', w: 76, h: 72, draw: iceWolf },
  { name: 'snowman', w: 64, h: 84, draw: snowman },
  { name: 'iceGolem', w: 104, h: 108, draw: iceGolem },
  { name: 'yeti', w: 190, h: 200, draw: yeti },
  { name: 'iceDragon', w: 260, h: 226, draw: iceDragon },
  { name: 'gem_s', w: 26, h: 30, draw: gem('#4fc3f7', '#b8ecff', 1) },
  { name: 'gem_m', w: 32, h: 36, draw: gem('#5fe08a', '#c4ffd6', 1.2) },
  { name: 'gem_l', w: 38, h: 43, draw: gem('#ff6b8b', '#ffc9d4', 1.42) },
  { name: 'coin', w: 30, h: 30, draw: coin },
  { name: 'heart', w: 34, h: 32, draw: heart },
  { name: 'magnet', w: 36, h: 32, draw: magnet },
  { name: 'bolt', w: 32, h: 32, draw: bolt },
  { name: 'star', w: 40, h: 40, draw: starShot },
  { name: 'fireball', w: 48, h: 48, draw: fireball },
  { name: 'meteor', w: 80, h: 80, draw: meteor },
  { name: 'shield', w: 44, h: 50, draw: shield('#4d8df0', '#bcd6ff') },
  { name: 'shield2', w: 44, h: 50, draw: shield('#ffc93f', '#fff3b8') },
  { name: 'efire', w: 40, h: 40, draw: enemyFire },
  { name: 'eice', w: 44, h: 44, draw: enemyIce },
  { name: 'snowball', w: 38, h: 38, draw: snowball },
  { name: 'lock', w: 40, h: 46, draw: lock },
  { name: 'slash', w: 136, h: 250, draw: slash },
  { name: 'ring', w: 256, h: 256, draw: ring },
  { name: 'glow', w: 128, h: 128, draw: glow },
  { name: 'dot', w: 16, h: 16, draw: (c) => ell(c, 8, 8, 6, 6, '#ffffff', null, 0) },
  { name: 'shadow', w: 64, h: 26, draw: (c) => ell(c, 32, 13, 30, 11, 'rgba(0,0,0,0.32)', null, 0) },
  {
    name: 'joyBase',
    w: 200,
    h: 200,
    draw: (c) => ell(c, 100, 100, 94, 94, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.35)', 6),
  },
  { name: 'joyKnob', w: 88, h: 88, draw: (c) => ell(c, 44, 44, 40, 40, 'rgba(255,255,255,0.45)', null, 0) },
  { name: 'ic_sword', w: 76, h: 76, draw: icon(WEAPON_BG, '🗡️') },
  { name: 'ic_bolt', w: 76, h: 76, draw: icon(WEAPON_BG, '🔮') },
  { name: 'ic_fireball', w: 76, h: 76, draw: icon(WEAPON_BG, '🔥') },
  { name: 'ic_thunder', w: 76, h: 76, draw: icon(WEAPON_BG, '⚡') },
  { name: 'ic_shield', w: 76, h: 76, draw: icon(WEAPON_BG, '🛡️') },
  { name: 'ic_ice', w: 76, h: 76, draw: icon(WEAPON_BG, '❄️') },
  { name: 'ic_power', w: 76, h: 76, draw: icon(PASSIVE_BG, '💍') },
  { name: 'ic_book', w: 76, h: 76, draw: icon(PASSIVE_BG, '📖') },
  { name: 'ic_mushroom', w: 76, h: 76, draw: icon(PASSIVE_BG, '🍄') },
  { name: 'ic_boots', w: 76, h: 76, draw: icon(PASSIVE_BG, '👢') },
  { name: 'ic_heart', w: 76, h: 76, draw: icon(PASSIVE_BG, '❤️') },
  { name: 'ic_magnet', w: 76, h: 76, draw: icon(PASSIVE_BG, '🧲') },
  { name: 'ic_heal', w: 76, h: 76, draw: icon(BONUS_BG, '🍖') },
  { name: 'ic_coins', w: 76, h: 76, draw: icon(BONUS_BG, '💰') },
];

export interface FloorColors {
  base: string;
  shades: string[];
  speck: string;
  /** ひびの線の色。なければ、ひびはかかない */
  crack?: string;
}

export const FLOORS: Record<string, FloorColors> = {
  floor: { base: '#211f38', shades: ['#2c2b47', '#2f2e4c', '#292842', '#2d2c49'], speck: 'rgba(255,255,255,0.045)' },
  // 白い雪玉や水色のジェムがまぎれないよう、暗めの青にする
  floor_ice: {
    base: '#17324a',
    shades: ['#24506e', '#275574', '#214a66', '#255271'],
    speck: 'rgba(200,235,255,0.16)',
    crack: 'rgba(200,235,255,0.13)',
  },
};

export function drawFloor(c: Ctx, size: number, colors: FloorColors): void {
  const tile = size / 4;
  c.fillStyle = colors.base;
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      c.fillStyle = colors.shades[(i * 3 + j * 5 + ((i * j) % 2)) % colors.shades.length];
      c.fillRect(i * tile + 1.5, j * tile + 1.5, tile - 3, tile - 3);
    }
  }
  c.fillStyle = colors.speck;
  const specks = [12, 20, 70, 44, 130, 18, 200, 90, 40, 150, 100, 210, 170, 160, 230, 230, 90, 100, 150, 60];
  for (let i = 0; i < specks.length; i += 2) c.fillRect(specks[i] % size, specks[i + 1] % size, 5, 5);
  if (colors.crack) {
    for (const pts of [
      [20, 96, 44, 110, 40, 132, 58, 150],
      [150, 30, 170, 52, 196, 48],
      [190, 180, 176, 204, 200, 226],
    ]) {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.lineWidth = 2.5;
      c.strokeStyle = colors.crack;
      c.lineJoin = 'round';
      c.stroke();
    }
  }
}
