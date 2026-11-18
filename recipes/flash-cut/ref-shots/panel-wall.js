/* @ticktoon-ref-shot
{
  "title": "四格斜墙",
  "note": "四块素材斜切并置，图本身当主角，四拍",
  "duration": 1.858,
  "tags": [
    "拼贴",
    "素材",
    "斜切"
  ],
  "resources": [
    {
      "type": "video",
      "name": "city",
      "src": "skill:assets/demo/city.mp4"
    },
    {
      "type": "video",
      "name": "nature",
      "src": "skill:assets/demo/nature.mp4"
    },
    {
      "type": "video",
      "name": "tech",
      "src": "skill:assets/demo/tech.mp4"
    },
    {
      "type": "video",
      "name": "office",
      "src": "skill:assets/demo/office.mp4"
    },
    {
      "type": "font",
      "name": "sans-900"
    },
    {
      "type": "font",
      "name": "sans-400"
    }
  ]
}
*/
// 示例 · 4 拍：四格斜墙，图本身当主角。
const T = api.t;
const W = api.W;
const H = api.H;
ctx.fillStyle = '#0A0A0A'; ctx.fillRect(0, 0, W, H);
const S = '#FFFFFF';
const A = '#FF4D00';
const L = '#12305C';
const M = '#8A8A8A';

function roundedPath(x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cover(source, x, y, w, h) {
  if (!source) return;
  const sw = source.videoWidth || source.naturalWidth || source.width || 0;
  const sh = source.videoHeight || source.naturalHeight || source.height || 0;
  if (sw <= 0 || sh <= 0) return;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

TT.text(ctx, '04 / 09 — WALL', W * 0.04, H * 0.08, 20, {
  color: M, align: 'left', baseline: 'alphabetic', fontKey: 'sans-400',
});

const box = { x: W * 0.06, y: H * 0.14, w: W * 0.88, h: H * 0.7 };
const cw = (box.w - 20 * 3) / 4;
const cells = [
  { source: api.video('city'), label: 'CITY / 01', tint: A, tintAlpha: 0.16 },
  { source: api.video('nature'), label: 'NATURE / 02' },
  { source: api.video('tech'), label: 'TECH / 03', tint: L, tintAlpha: 0.22 },
  { source: api.video('office'), label: 'OFFICE / 04' },
];
const underlays = [A, L, S, M];

// 整面共享斜切；每格仍按自己的中心缩放，四拍依次从下方砸入。
ctx.save();
ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
ctx.transform(1, 0, -0.055, 1, 0, 0);
ctx.translate(-(box.x + box.w / 2), -(box.y + box.h / 2));
for (let i = 0; i < cells.length; i += 1) {
  const p = TT.clamp01((T - i * 0.08) / 0.4);
  if (p <= 0) continue;
  const e = TT.ease.outCubic(p);
  const scale = 0.9 + 0.1 * e;
  const x = box.x + i * (cw + 20);
  const y = box.y;
  const cell = cells[i];
  const labelSize = Math.max(9, Math.min(box.h * 0.08, 28));

  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 3.4);
  ctx.translate(x + cw / 2, y + box.h / 2 + 44 * (1 - e));
  ctx.scale(scale, scale);
  ctx.translate(-(x + cw / 2), -(y + box.h / 2));
  ctx.beginPath();
  roundedPath(x, y, cw, box.h, 20);
  ctx.clip();
  ctx.fillStyle = underlays[i];
  ctx.fillRect(x, y, cw, box.h);
  cover(cell.source, x, y, cw, box.h);
  if (cell.tint) {
    ctx.save();
    ctx.globalAlpha *= cell.tintAlpha;
    ctx.fillStyle = cell.tint;
    ctx.fillRect(x, y, cw, box.h);
    ctx.restore();
  }
  TT.text(ctx, cell.label, x + 14, y + 14 + labelSize * 0.8, labelSize, {
    color: S, align: 'left', baseline: 'alphabetic', fontKey: 'sans-400',
  });
  ctx.restore();
}
ctx.restore();

TT.text(ctx, 'FOUR CITIES / ONE BEAT', W * 0.04, H * 0.93, 18, {
  color: S, align: 'left', baseline: 'alphabetic', fontKey: 'sans-400',
});
TT.text(ctx, '4 BEATS / 1.86s', W * 0.96, H * 0.93, 16, {
  color: A, align: 'right', baseline: 'alphabetic', fontKey: 'sans-400',
});
