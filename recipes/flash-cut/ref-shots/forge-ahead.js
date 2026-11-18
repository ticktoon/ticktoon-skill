/* @ticktoon-ref-shot
{
  "title": "砥砺前行视差字",
  "note": "底层英文横移，上层中文回弹入场并缓慢放大，形成双层视差",
  "duration": 1.858,
  "bg": "#F1EEE7",
  "thumbTime": 1.2,
  "tags": [
    "视差",
    "大字",
    "回弹"
  ],
  "resources": [
    {
      "type": "font",
      "name": "WenYuanSerifSC-Bold"
    }
  ]
}
*/
// 示例 · 4 拍：双层文字视差，字体使用抖音美好体与卓特悦动黑。
const T = api.t;
const W = api.W;
const H = api.H;
const q = TT.clamp01(T / api.d);
const lerp = (a, b, k) => a + (b - a) * k;
ctx.fillStyle = '#F1EEE7';
ctx.fillRect(0, 0, W, H);

// 下层：全程从右向左移动。
ctx.save();
ctx.globalAlpha = 0.13;
ctx.fillStyle = '#B42318';
ctx.font = TT.font(FONTS, 400, 'WenYuanSerifSC-Bold').css;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
const bx = W * 0.52 + lerp(120, -120, q);
ctx.fillText('FORGE', bx, H * 0.56);
ctx.restore();

// 上层：入场后仍缓慢放大，和下层横移形成视差。
const p = TT.ease.outExpo(TT.clamp01(T / 0.35));
const scale = lerp(0.82, 1, p) * (1 + q * 0.05);
ctx.save();
ctx.translate(W / 2, H * 0.45);
ctx.scale(scale, scale);
ctx.globalAlpha = p;
ctx.fillStyle = '#12233F';
ctx.font = TT.font(FONTS, 200, 'WenYuanSerifSC-Bold').css;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('砥砺前行', 0, 0);
ctx.font = TT.font(FONTS, 50, 'WenYuanSerifSC-Bold').css;
ctx.fillText('F O R G E   A H E A D', 0, 138);
ctx.restore();
