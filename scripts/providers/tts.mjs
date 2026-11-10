/**
 * TTS Provider：语音合成统一接口
 *
 *   synthesizeSpeech({ script, provider, voice, outFile })
 *     → { audioFile, webvtt | null, durationSec }
 *
 * provider:
 *   - 'edge-tts'（默认，零密钥）：微软 Edge 大声朗读接口（msedge-tts）。
 *     附带 WordBoundary 逐词时间戳，本模块直接生成 webvtt 字幕，无需 ASR。
 *   - 'volc-tts'：火山引擎 seed-tts-2.0 单向流式（移植自 dh-backend tts_api.py），
 *     需要 VOLC_TTS_APP_ID / VOLC_TTS_ACCESS_TOKEN；不产词级时间戳，逐字字幕按字符等比降级。
 *
 * 音色：edge 用 'zh-CN-YunxiNeural' 等 ShortName；volc 用 voiceType
 * （⚠️ 仅 seed-tts-2.0 音色，S_ 开头 ICL 克隆音色在此接口会零数据挂起）。
 */
import { createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import WebSocket from 'ws';
import { getCredential } from '../config.mjs';

export const TTS_PROVIDERS = ['edge-tts', 'volc-tts'];
export const DEFAULT_EDGE_VOICE = 'zh-CN-YunxiNeural';
export const DEFAULT_VOLC_VOICE = 'zh_male_jieshuoxiaoming_uranus_bigtts';

export async function synthesizeSpeech({ script, provider = 'edge-tts', voice, outFile }) {
  if (!script?.trim()) throw new Error('TTS 入参 script 为空');
  if (provider === 'edge-tts') return edgeTts(script, voice || DEFAULT_EDGE_VOICE, outFile);
  if (provider === 'volc-tts') return volcTts(script, voice || DEFAULT_VOLC_VOICE, outFile);
  throw new Error(`未知 TTS provider: ${provider}（可选 ${TTS_PROVIDERS.join('/')}）`);
}

// ============================== edge-tts ==============================

async function edgeTts(script, voice, outFile) {
  const tts = new MsEdgeTTS();
  const boundaries = [];
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
    const { audioStream, metadataStream } = tts.toStream(script);
    // 注意：msedge-tts 的 metadataStream 在 turn.end 时不会收到 end（库的实现如此），
    // 以 audioStream 结束为完成信号；WordBoundary 元数据全部先于 turn.end 到达。
    metadataStream?.on('data', (chunk) => {
      try {
        for (const m of JSON.parse(chunk.toString()).Metadata ?? []) {
          if (m.Type === 'WordBoundary') {
            boundaries.push({
              offset: m.Data.Offset / 1e7,             // 100ns → s
              end: (m.Data.Offset + m.Data.Duration) / 1e7,
              text: m.Data.text.Text,
            });
          }
        }
      } catch { /* 忽略半包/非 JSON */ }
    });
    await new Promise((resolve, reject) => {
      const ws = createWriteStream(outFile);
      audioStream.pipe(ws);
      audioStream.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', resolve);
    });
  } finally {
    tts.close();
  }
  if (boundaries.length === 0) throw new Error('edge-tts 未返回 WordBoundary 元数据，无法生成字幕');
  const webvtt = boundariesToWebvtt(script, boundaries);
  // boundaries 原样带出：编译层做词级字幕对齐用，比解析 webvtt 再反推字符区间更准。
  return { audioFile: outFile, webvtt, durationSec: boundaries.at(-1).end, boundaries };
}

/**
 * WordBoundary 序列 → webvtt。
 * 边界文本按序对齐回 script（indexOf 前进式匹配），按句读标点归并成 cue；
 * 超过 maxChars 的句在词边界处折断。cue 文本清洗：去空白、去末尾标点
 * （对齐 dh-backend subtitle_llm_utils.clean_subtitle_text 的风格）。
 */
export function boundariesToWebvtt(script, boundaries, maxChars = 20) {
  // 1. 每个 boundary 对齐到 script 的字符区间
  let cursor = 0;
  const words = [];
  for (const b of boundaries) {
    const idx = script.indexOf(b.text, cursor);
    if (idx === -1) continue; // 对齐失败（罕见），丢弃该词
    words.push({ ...b, charStart: idx, charEnd: idx + b.text.length });
    cursor = idx + b.text.length;
  }
  if (words.length === 0) throw new Error('WordBoundary 与 script 对齐失败');

  // 2. 归并 cue：句读标点必断；超 maxChars 时优先回退到最近的逗号级软断点，
  //    没有软断点才在词边界硬断（避免"万亿/元"式孤字 cue）
  const isBreakPunct = (ch) => '。！？；…\n'.includes(ch);
  const isSoftPunct = (ch) => '，、：,.!?;—'.includes(ch);
  const hardAfter = words.map((w) => { const c = script[w.charEnd]; return c !== undefined && isBreakPunct(c); });
  const softAfter = words.map((w) => { const c = script[w.charEnd]; return c !== undefined && isSoftPunct(c); });
  const cueWords = [];
  let i = 0;
  while (i < words.length) {
    let j = i, lastSoft = -1;
    while (j < words.length) {
      const len = words[j].charEnd - words[i].charStart;
      if (len > maxChars) {
        j = lastSoft >= i ? lastSoft + 1 : Math.max(j, i + 1);
        break;
      }
      if (hardAfter[j]) { j++; break; }
      if (softAfter[j]) lastSoft = j;
      j++;
    }
    cueWords.push(words.slice(i, j));
    i = j;
  }
  const cues = cueWords.map((ws) => ({
    text: script.slice(ws[0].charStart, ws.at(-1).charEnd),
    offset: ws[0].offset,
    end: ws.at(-1).end,
    chars: ws.flatMap((word) => {
      const characters = Array.from(word.text);
      let units = 0;
      return characters.map((text) => {
        const start = word.offset + (word.end - word.offset) * units / characters.length;
        units += 1;
        return {
          text,
          start,
          end: word.offset + (word.end - word.offset) * units / characters.length,
        };
      });
    }),
  }));

  // 3. 输出
  const fmt = (sec) => {
    const ms = Math.round(sec * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, '0')}`;
  };
  const clean = (t) => t.replace(/\s+/g, ' ').replace(/([一-龥])\s+([a-zA-Z0-9])/g, '$1$2')
    .replace(/([a-zA-Z0-9])\s+([一-龥])/g, '$1$2').replace(/[，。；！？：、,;!?:\s]+$/g, '').trim();
  let vtt = 'WEBVTT\n\n';
  cues.forEach((c, i) => {
    const text = clean(c.text);
    if (!text) return;
    const start = Math.round(c.offset * 1000) / 1000;
    const end = Math.round(c.end * 1000) / 1000;
    const chars = c.chars.map((char) => {
      const charStart = Math.max(start, Math.min(end, Math.round(char.start * 1000) / 1000));
      const charEnd = Math.max(charStart, Math.min(end, Math.round(char.end * 1000) / 1000));
      return { text: char.text, start: charStart, end: charEnd };
    });
    vtt += `NOTE ticktoon-chars ${JSON.stringify(chars)}\n${i + 1}\n${fmt(start)} --> ${fmt(end)}\n${text}\n\n`;
  });
  return vtt;
}

// ============================== volc-tts ==============================
// 火山 V3 单向流式协议移植（dh-backend src/utils/tts_protocols.py 的最小子集）：
// 帧头 4 字节 [version<<4|headerSize, msgType<<4|flag, serialization<<4|compression, reserved]
// 后续字段按 flag：PositiveSeq/NegativeSeq → int32 seq；WithEvent → int32 event + sessionId + connectId
// 末尾 payload：uint32 长度 + 字节

const VOLC_TTS_ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream';
const MT_FULL_CLIENT = 0b0001, MT_FULL_SERVER = 0b1001, MT_AUDIO_SERVER = 0b1011, MT_ERROR = 0b1111;
const FLAG_NO_SEQ = 0, FLAG_POS_SEQ = 0b1, FLAG_NEG_SEQ = 0b11, FLAG_WITH_EVENT = 0b100;
const EV_SESSION_FINISHED = 152;

function encodeFullClientRequest(payloadBuf) {
  const header = Buffer.from([(1 << 4) | 1, (MT_FULL_CLIENT << 4) | FLAG_NO_SEQ, (1 << 4) | 0, 0]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payloadBuf.length);
  return Buffer.concat([header, len, payloadBuf]);
}

function decodeMessage(buf) {
  const msgType = buf[1] >> 4, flag = buf[1] & 0b1111;
  const headerSize = (buf[0] & 0b1111) * 4;
  let p = headerSize;
  let event = 0;
  if ([MT_FULL_CLIENT, MT_FULL_SERVER, MT_AUDIO_SERVER].includes(msgType) && (flag === FLAG_POS_SEQ || flag === FLAG_NEG_SEQ)) {
    p += 4; // sequence
  } else if (msgType === MT_ERROR) {
    p += 4; // error code
  }
  if (flag === FLAG_WITH_EVENT) {
    event = buf.readInt32BE(p); p += 4;
    // session_id / connect_id：读掉但不使用
    for (let i = 0; i < 2; i++) {
      if (p + 4 > buf.length) break;
      const sz = buf.readUInt32BE(p); p += 4 + sz;
    }
  }
  let payload = Buffer.alloc(0);
  if (p + 4 <= buf.length) {
    const sz = buf.readUInt32BE(p); p += 4;
    payload = buf.subarray(p, p + sz);
  }
  return { msgType, event, payload };
}

async function volcTts(script, voice, outFile) {
  const appId = getCredential('VOLC_TTS_APP_ID');
  const token = getCredential('VOLC_TTS_ACCESS_TOKEN');
  if (!appId || !token) {
    throw new Error('volc-tts 需要凭证 VOLC_TTS_APP_ID / VOLC_TTS_ACCESS_TOKEN（node scripts/auth.mjs set 写入，或设环境变量）');
  }
  const req = {
    user: { uid: randomUUID() },
    req_params: {
      speaker: voice,
      audio_params: { format: 'mp3', sample_rate: 24000, speech_rate: 0, enable_timestamp: false },
      text: script,
      additions: JSON.stringify({ disable_markdown_filter: true }),
    },
  };
  const chunks = [];
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(VOLC_TTS_ENDPOINT, {
      headers: {
        'X-Api-App-Key': appId,
        'X-Api-Access-Key': token,
        'X-Api-Resource-Id': 'seed-tts-2.0',
        'X-Api-Connect-Id': randomUUID(),
      },
    });
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('volc-tts 超时（120s）；S_ 开头 ICL 音色在本接口不受支持，会零数据挂起')); }, 120_000);
    ws.on('open', () => ws.send(encodeFullClientRequest(Buffer.from(JSON.stringify(req), 'utf-8'))));
    ws.on('message', (data) => {
      const msg = decodeMessage(data);
      if (msg.msgType === MT_AUDIO_SERVER) chunks.push(msg.payload);
      else if (msg.msgType === MT_ERROR) { clearTimeout(timer); reject(new Error(`volc-tts 服务端错误: ${msg.payload.toString('utf-8').slice(0, 200)}`)); }
      else if (msg.msgType === MT_FULL_SERVER && msg.event === EV_SESSION_FINISHED) { clearTimeout(timer); ws.close(); resolve(); }
    });
    ws.on('error', (e) => { clearTimeout(timer); reject(new Error('volc-tts 连接失败: ' + e.message)); });
  });
  if (chunks.length === 0) throw new Error('volc-tts 未返回音频数据');
  const audio = Buffer.concat(chunks);
  await new Promise((resolve, reject) => {
    const ws2 = createWriteStream(outFile);
    ws2.write(audio);
    ws2.end(() => resolve());
    ws2.on('error', reject);
  });
  // 24kHz 16bit mono mp3 ≈ 3KB/s（48kbps 近似估算仅作日志参考），真实时长以 ASR 为准
  return { audioFile: outFile, webvtt: null, durationSec: null };
}
