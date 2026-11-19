import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 全局圈注索引：只存批次指针，原始 JSON / PNG 仍留在各自工程。 */
const INBOX_FILE = process.env.TICKTOON_ANNOTATION_INBOX_FILE
  || path.join(os.homedir(), '.dh-video', 'annotations-inbox.jsonl');

function append(event) {
  mkdirSync(path.dirname(INBOX_FILE), { recursive: true });
  appendFileSync(INBOX_FILE, `${JSON.stringify(event)}\n`, 'utf8');
}

const keyOf = (record) => `${path.resolve(record.projectDir)}\0${record.batchId}`;

export function publishAnnotationBatch({ projectDir, compositionFile, batch, createdAt }) {
  append({
    type: 'batch',
    projectDir: path.resolve(projectDir),
    compositionFile: path.resolve(compositionFile),
    batchId: batch.id,
    batchDir: batch.dir,
    request: batch.json,
    createdAt,
  });
}

export function acknowledgeAnnotationBatch(projectDir, batchId) {
  append({ type: 'ack', projectDir: path.resolve(projectDir), batchId });
}

/** ACK 以追加事件记录，避免预览进程与 CLI 同时重写索引而丢批次。 */
export function readAnnotationInbox() {
  if (!existsSync(INBOX_FILE)) return [];
  const pending = new Map();
  for (const line of readFileSync(INBOX_FILE, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (!event.projectDir || !event.batchId) continue;
      const key = keyOf(event);
      if (event.type === 'batch') pending.set(key, event);
      else if (event.type === 'ack') pending.delete(key);
    } catch { /* 最后一行可能仍在写入；下一轮继续读 */ }
  }
  return [...pending.values()].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
