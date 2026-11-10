/**
 * 单任务预览服务登记与回收。
 * 登记文件放在任务目录，render 成功后按 trackFile + pid 双重核对再关闭，
 * 避免端口复用时误停其他任务的预览。
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REGISTRY_FILE = '.dh-video-preview.json';
const registryPath = (trackFile) => path.join(path.dirname(trackFile), REGISTRY_FILE);
const sameFile = (a, b) => path.resolve(String(a || '')) === path.resolve(String(b || ''));

export function registerPreview(trackFile, port) {
  const info = { version: 1, trackFile: path.resolve(trackFile), port, pid: process.pid };
  writeFileSync(registryPath(trackFile), JSON.stringify(info, null, 2));
  return info;
}

export function unregisterPreview(trackFile, pid = process.pid) {
  const file = registryPath(trackFile);
  try {
    if (!existsSync(file)) return;
    const info = JSON.parse(readFileSync(file, 'utf-8'));
    // 不删除后来启动的新预览进程的登记。
    if (info.pid === pid) rmSync(file, { force: true });
  } catch { /* 进程退出阶段的清理不阻塞主流程 */ }
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
