/**
 * 凭证与 Provider 配置统一入口
 *
 * 凭证链（优先级从高到低）：
 *   1. 环境变量（如 PEXELS_API_KEY）
 *   2. ~/.dh-video/credentials.json（用 scripts/auth.mjs 写入）
 *
 * 业务 payload 永远不携带密钥，只携带 provider 名称；
 * provider 运行时按上面的链路取密钥。缺密钥的 provider 视为不可用，
 * 凭证缺失由调用方直接报错；Pexels 查询不再使用内置素材降级。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CRED_FILE = path.join(os.homedir(), '.dh-video', 'credentials.json');

/** 已知凭证键清单（doctor 报告与 README 文档以此为准） */
export const CREDENTIAL_KEYS = {
  PEXELS_API_KEY: { usedBy: 'assets:pexels', desc: 'Pexels 视频素材检索（pexels.com/api 免费申请）' },
  VOLC_TTS_APP_ID: { usedBy: 'tts:volc-tts', desc: '火山引擎语音合成 App Key（控制台-语音技术）' },
  VOLC_TTS_ACCESS_TOKEN: { usedBy: 'tts:volc-tts', desc: '火山引擎语音合成 Access Token' },
};

let cache;
function fileCredentials() {
  if (cache === undefined) {
    try { cache = JSON.parse(readFileSync(CRED_FILE, 'utf-8')); } catch { cache = {}; }
  }
  return cache;
}

/** 取凭证：环境变量优先，回落 credentials.json；都没有返回 '' */
export function getCredential(name) {
  return process.env[name] || fileCredentials()[name] || '';
}

export function hasCredential(name) {
  return !!getCredential(name);
}

/** 凭证来源（'env' | 文件路径 | null），供 doctor 报告 */
export function credentialSource(name) {
  if (process.env[name]) return 'env';
  if (fileCredentials()[name]) return CRED_FILE;
  return null;
}

/** 写入/删除凭证（auth.mjs 使用） */
export function saveCredential(name, value) {
  const creds = { ...fileCredentials() };
  if (value == null || value === '') delete creds[name];
  else creds[name] = value;
  mkdirSync(path.dirname(CRED_FILE), { recursive: true });
  writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2));
  cache = creds;
}

/** volc TTS 两个键是否齐备 */
export function hasVolcTts() {
  return hasCredential('VOLC_TTS_APP_ID') && hasCredential('VOLC_TTS_ACCESS_TOKEN');
}

