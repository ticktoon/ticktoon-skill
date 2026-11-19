/**
 * 把 dh-front 的 1 秒实录键盘声（keyboard-click.ts 的 KEYBOARD_PCM_RAW）
 * 导出成 assets/sfx/common-keyboard-loop.wav（48kHz 单声道 PCM16），并在 manifest 注册 common-keyboard-loop。
 *
 *   node scripts/tools/export-keyboard-sfx.mjs [源文件.ts]
 *
 * 只做数字提取，不执行源文件；源文件末尾 5ms 已线性淡出到 0，循环接缝无爆音。
 * 参考方实际播放电平是 RAW * 0.6（FIX_VOL），这里导出峰值 1.0 的原始 PCM，
 * 0.6 的电平写在 manifest.volume 里，由引擎统一施加。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_SRC = 'D:/AI/dh_video/dh-front/src/views/clip-page/av-clips/gsap-clip/animations/text/keyboard-click.ts';
const SRC = process.argv[2] || DEFAULT_SRC;
const RATE = 48000;
const OUT_WAV = path.join(ROOT, 'assets', 'sfx', 'common-keyboard-loop.wav');
const MANIFEST = path.join(ROOT, 'assets', 'sfx', 'manifest.json');

const ts = readFileSync(SRC, 'utf-8');
const match = ts.match(/KEYBOARD_PCM_RAW\s*=\s*new Float32Array\(\[([\s\S]*?)\]\)/);
if (!match) throw new Error('没在源文件里找到 KEYBOARD_PCM_RAW 数组');
const pcm = JSON.parse(`[${match[1].replace(/[\s\n]+/g, ' ').replace(/,\s*$/, '')}]`);
if (pcm.length !== RATE) throw new Error(`样本数应为 ${RATE}，实际 ${pcm.length}`);

const peak = pcm.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rms = Math.sqrt(pcm.reduce((s, v) => s + v * v, 0) / pcm.length);
const firstSound = pcm.findIndex((v) => Math.abs(v) > 0.0001);
const tail240 = pcm.slice(-240);
const tailPeak = tail240.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const headPeak = pcm.slice(0, 240).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
// 模拟 3 次循环的接缝：接缝两侧各 5ms 的峰值不能突变
let seamMaxJump = 0;
for (const k of [1, 2]) {
  const at = k * RATE;
  for (let i = -240; i < 240; i += 1) {
    seamMaxJump = Math.max(seamMaxJump, Math.abs(pcm[(at + i) % RATE] - pcm[(at + i - 1 + RATE) % RATE]));
  }
}

const data = Buffer.alloc(pcm.length * 2);
for (let i = 0; i < pcm.length; i += 1) {
  const v = Math.max(-1, Math.min(1, pcm[i]));
  data.writeInt16LE(Math.round(v * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // 单声道
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(OUT_WAV, Buffer.concat([header, data]));

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
manifest['common-keyboard-loop'] = {
  src: 'skill:assets/sfx/common-keyboard-loop.wav',
  duration: 1.0,
  volume: 0.6,
  loop: true,
  desc: '1s 实录键盘声，循环铺满打字时长（48kHz 单声道，末尾 5ms 淡出保证无缝）',
};
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`写出 ${path.relative(ROOT, OUT_WAV)} (${(data.length / 1024).toFixed(1)} KB PCM16)`);
console.log(`样本 ${pcm.length} | 峰值 ${peak.toFixed(4)} | RMS ${rms.toFixed(4)} | 首个有声样本 ${firstSound} (${(firstSound / RATE * 1000).toFixed(1)}ms)`);
console.log(`接缝校验：头 5ms 峰值 ${headPeak.toExponential(2)}，尾 5ms 峰值 ${tailPeak.toExponential(2)}，接缝最大跳变 ${seamMaxJump.toExponential(2)}`);
console.log('manifest 已注册 common-keyboard-loop（volume 0.6，对齐 dh-front FIX_VOL）');
