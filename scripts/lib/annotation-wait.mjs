import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const LOCK_FILE = path.join(os.homedir(), '.dh-video', 'annotations-wait.json');

function current() {
  try {
    return JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function acquireAnnotationWait(projectDir) {
  const token = randomUUID();
  mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  writeFileSync(LOCK_FILE, JSON.stringify({
    version: 1,
    token,
    pid: process.pid,
    projectDir: path.resolve(projectDir),
    startedAt: new Date().toISOString(),
  }, null, 2));
  return token;
}

export function annotationWaitActive(token) {
  return current()?.token === token;
}

export function releaseAnnotationWait(token) {
  if (annotationWaitActive(token)) rmSync(LOCK_FILE, { force: true });
}

export function stopAnnotationWait() {
  if (existsSync(LOCK_FILE)) rmSync(LOCK_FILE, { force: true });
}
