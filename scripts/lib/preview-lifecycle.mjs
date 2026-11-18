/**
 * 全局单例预览服务登记与回收。
 * 任务目录与全局登记结合，复用与显式停止都按 trackFile + pid 双重核对，
 * 避免端口复用时误停其他任务的预览。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REGISTRY_FILE = '.dh-video-preview.json';
const GLOBAL_REGISTRY = path.join(os.homedir(), '.dh-video', 'preview.json');
const registryPath = (trackFile) => path.join(path.dirname(trackFile), REGISTRY_FILE);
const sameFile = (a, b) => path.resolve(String(a || '')) === path.resolve(String(b || ''));

export function registerPreview(trackFile, port) {
  const info = { version: 1, trackFile: path.resolve(trackFile), port, pid: process.pid };
  writeFileSync(registryPath(trackFile), JSON.stringify(info, null, 2));
  mkdirSync(path.dirname(GLOBAL_REGISTRY), { recursive: true });
  writeFileSync(GLOBAL_REGISTRY, JSON.stringify(info, null, 2));
  return info;
}

export function unregisterPreview(trackFile, pid = process.pid) {
  const file = registryPath(trackFile);
  try {
    if (existsSync(file)) {
      const info = JSON.parse(readFileSync(file, 'utf-8'));
      if (info.pid === pid) rmSync(file, { force: true });
    }
  } catch { /* 进程退出阶段的清理不阻塞主流程 */ }
  try {
    if (existsSync(GLOBAL_REGISTRY)) {
      const info = JSON.parse(readFileSync(GLOBAL_REGISTRY, 'utf-8'));
      if (info.pid === pid) rmSync(GLOBAL_REGISTRY, { force: true });
    }
  } catch { /* 全局登记清理同样不阻塞退出 */ }
}

export async function getActivePreview() {
  if (!existsSync(GLOBAL_REGISTRY)) return { status: 'none' };
  let info;
  try {
    info = JSON.parse(readFileSync(GLOBAL_REGISTRY, 'utf-8'));
    const port = Number(info.port);
    if (!Number.isInteger(info.pid) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('预览登记无效');
    const response = await fetch(`http://127.0.0.1:${port}/api/preview-info`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) throw new Error('预览服务未响应');
    const running = await response.json();
    if (running.pid !== info.pid) return { status: 'mismatch' };
    return { status: 'running', trackFile: running.trackFile, port, pid: info.pid, url: `http://127.0.0.1:${port}` };
  } catch {
    if (info?.pid) {
      try {
        const current = JSON.parse(readFileSync(GLOBAL_REGISTRY, 'utf-8'));
        if (current.pid === info.pid) rmSync(GLOBAL_REGISTRY, { force: true });
      } catch { /* 忽略损坏或已被替换的登记 */ }
    }
    return { status: 'none' };
  }
}

export async function getTaskPreview(trackFile) {
  const file = registryPath(trackFile);
  if (!existsSync(file)) return { status: 'none' };
  let info;
  try {
    info = JSON.parse(readFileSync(file, 'utf-8'));
    const port = Number(info.port);
    if (!sameFile(info.trackFile, trackFile) || !Number.isInteger(info.pid) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('预览登记内容无效');
    }
    const response = await fetch(`http://127.0.0.1:${port}/api/preview-info`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) throw new Error('预览信息请求失败');
    const running = await response.json();
    if (!sameFile(running.trackFile, trackFile) || running.pid !== info.pid) return { status: 'mismatch' };
    return { status: 'running', port, pid: info.pid, url: `http://127.0.0.1:${port}` };
  } catch {
    if (info?.pid) unregisterPreview(trackFile, info.pid);
    return { status: 'none' };
  }
}

export async function stopTaskPreview(trackFile) {
  const file = registryPath(trackFile);
  if (!existsSync(file)) return { status: 'none' };
  let info;
  try {
    info = JSON.parse(readFileSync(file, 'utf-8'));
    const port = Number(info.port);
    if (!sameFile(info.trackFile, trackFile) || !Number.isInteger(info.pid) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('预览登记内容无效');
    }
    const base = `http://127.0.0.1:${port}`;
    const response = await fetch(base + '/api/preview-info', { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error(`预览信息请求失败 (${response.status})`);
    const running = await response.json();
    if (!sameFile(running.trackFile, trackFile) || running.pid !== info.pid) {
      return { status: 'mismatch' };
    }
    const stopped = await fetch(base + '/shutdown', { method: 'POST', signal: AbortSignal.timeout(2000) });
    if (!stopped.ok) throw new Error(`预览关闭请求失败 (${stopped.status})`);
    unregisterPreview(trackFile, info.pid);
    return { status: 'stopped', port };
  } catch (error) {
    return { status: 'error', error: String(error?.message || error) };
  }
}
