#!/usr/bin/env node
/** 合成 52ms 单声道机械键声；固定噪声种子，重复运行字节一致。 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'assets', 'sfx', 'type.wav');
const sampleRate = 44100;
const seconds = 0.052;
const count = Math.round(sampleRate * seconds);
const samples = new Int16Array(count);
let seed = 0x51f15e;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296 * 2 - 1;
};
let previousNoise = 0;
for (let i = 0; i < count; i += 1) {
  const t = i / sampleRate;
  const noise = random();
  const highNoise = noise - previousNoise * 0.82;
  previousNoise = noise;
  const attack = Math.min(1, t / 0.0012);
  const click = highNoise * Math.exp(-t * 105) * 0.52;
  const wood = Math.sin(2 * Math.PI * 720 * t) * Math.exp(-t * 88) * 0.24;
  const mechanism = Math.sin(2 * Math.PI * 1850 * t) * Math.exp(-t * 145) * 0.17;
  const release = t > 0.037 ? Math.exp(-(t - 0.037) * 160) : 1;
  const value = attack * release * (click + wood + mechanism);
  samples[i] = Math.round(Math.max(-1, Math.min(1, value)) * 32767 * 0.82);
}

const buffer = Buffer.alloc(44 + samples.length * 2);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + samples.length * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(samples.length * 2, 40);
Buffer.from(samples.buffer).copy(buffer, 44);
writeFileSync(out, buffer);
console.log(`${out}  ${seconds * 1000}ms / ${sampleRate}Hz / mono PCM16`);
