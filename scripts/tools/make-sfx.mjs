/**
 * 生成 assets/sfx 下的三支音效（一次性，产物入库）。
 *
 *   node scripts/tools/make-sfx.mjs
 *
 * 不用采样素材：这三支都是"合成比采样更干净"的类型——低频落地、单频轻点、噪声扫频，
 * 用代码写出来体积只有几十 KB，也没有授权问题。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'assets', 'sfx');
const RATE = 44100;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const lerp = (a, b, t) => a + (b - a) * t;

/** 低频落地：80→48Hz 下滑 + 短噪声，指数衰减。 */
function impactSoft(dur = 0.36) {
  const n = Math.floor(RATE * dur);
  const out = new Float32Array(n);
  let phase = 0;
  let noise = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const p = t / dur;
    const freq = lerp(92, 46, Math.pow(p, 0.55));
    phase += (Math.PI * 2 * freq) / RATE;
    const body = Math.sin(phase) * Math.exp(-6.2 * p);
    noise = noise * 0.72 + (Math.random() * 2 - 1) * 0.28;
    const click = noise * Math.exp(-42 * p) * 0.5;
    const fade = p > 0.86 ? (1 - p) / 0.14 : 1;
    out[i] = (body * 0.82 + click) * fade * 0.9;
  }
  return out;
}

/** 数字收尾：单频快上滑 + 极短包络。 */
function tickUp(dur = 0.22) {
  const n = Math.floor(RATE * dur);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const p = t / dur;
    const freq = lerp(1160, 1680, Math.pow(p, 0.4));
    phase += (Math.PI * 2 * freq) / RATE;
    const env = Math.min(1, p / 0.012) * Math.exp(-9 * p);
    out[i] = Math.sin(phase) * env * 0.5;
  }
  return out;
}

/** 滑入：带通噪声扫频，听起来像布料掠过。 */
function swipe(dur = 0.18) {
  const n = Math.floor(RATE * dur);
  const out = new Float32Array(n);
  let low = 0;
  let prevLow = 0;
  for (let i = 0; i < n; i += 1) {
    const p = i / n;
    const noise = Math.random() * 2 - 1;
    // 一阶低通取低频包络，与其差分得到带通；截止频率随进度上移
    low += lerp(0.05, 0.3, p) * (noise - low);
    const band = low - prevLow;
    prevLow = low;
    out[i] = band * Math.sin(Math.PI * p) ** 0.8 * 2.4;
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['common-impact-soft.wav', impactSoft()],
  ['common-tick-up.wav', tickUp()],
  ['common-swipe.wav', swipe()],
];
for (const [name, samples] of files) {
  writeFileSync(path.join(OUT, name), wav(samples));
  console.log(`${name}  ${(samples.length / RATE).toFixed(2)}s`);
}
