/**
 * 最小 Chrome CDP 驱动：启动本机 Chrome，连页面 target，直接执行页内逻辑。
 *
 * 为什么不用 Playwright：
 * - QA / stills / snapshot 真正需要的只是"在引擎页面里按时间调用 capture"，不是一整套
 *   自动化框架；Playwright 的安装体积、启动开销和额外依赖都落不到引擎的帧捕获能力上。
 * - 引擎的 capture 会 await 视频 settle、同步重绘，再回传 PNG；用 CDP 把这条链路包一层
 *   就够了。页面错误、console、绑定回调都能通过 Runtime 事件拿到。
 *
 * 这里只做本项目用得到的子集：导航、页内 evaluate、等待条件、初始化脚本、CDP binding。
 * 不做选择器、点击、截图等 UI 自动化。
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromiumArgs } from './chromium-args.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function commandPath(command) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(finder, [command], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  const line = String(result.stdout || '').split(/\r?\n/).map((value) => value.trim()).find(Boolean);
  return line || null;
}

/** 找本机 Chrome。可用 TICKTOON_CHROME_PATH / CHROME_PATH 显式覆盖。 */
export function findChrome(env = process.env) {
  const explicit = env.TICKTOON_CHROME_PATH || env.CHROME_PATH;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`TICKTOON_CHROME_PATH 指向的 Chrome 不存在：${explicit}`);
    return explicit;
  }

  const candidates = [];
  if (process.platform === 'win32') {
    const roots = [
      env.ProgramFiles || 'C:\\Program Files',
      env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      env.LOCALAPPDATA || path.join(env.USERPROFILE || '', 'AppData', 'Local'),
    ];
    for (const root of roots) candidates.push(path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
    );
  } else {
    for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      const found = commandPath(command);
      if (found) candidates.push(found);
    }
  }

  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  throw new Error('未找到本机 Chrome（>=120）。请安装 Google Chrome，或设置 TICKTOON_CHROME_PATH 指向 chrome.exe');
}

class CdpConnection {
  constructor(ws) {
    this.ws = ws;
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.waiters = new Map();
    this.closed = false;
    ws.on('message', (raw) => this.onMessage(raw));
    ws.on('close', () => this.failAll(new Error('Chrome CDP 连接已关闭')));
    ws.on('error', (error) => this.failAll(error instanceof Error ? error : new Error(String(error))));
  }

  onMessage(raw) {
    let message;
    try { message = JSON.parse(String(raw)); } catch { return; }
    if (message.id != null) {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry.resolve(message.result);
      return;
    }
    const method = message.method;
    if (!method) return;
    for (const listener of this.listeners.get(method) || []) {
      try { listener(message.params || {}); } catch { /* 监听器异常不能打断 CDP 读循环 */ }
    }
    const waiters = this.waiters.get(method);
    if (waiters?.length) {
      const waiter = waiters.shift();
      clearTimeout(waiter.timer);
      waiter.resolve(message.params || {});
    }
  }

  send(method, params = {}, timeout = 60000) {
    if (this.closed) return Promise.reject(new Error('Chrome CDP 连接已关闭'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} 超时（${Math.round(timeout / 1000)}s）`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const list = this.listeners.get(method) || [];
    list.push(listener);
    this.listeners.set(method, list);
  }

  wait(method, timeout = 30000) {
    if (this.closed) return Promise.reject(new Error('Chrome CDP 连接已关闭'));
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const list = this.waiters.get(method) || [];
        const index = list.indexOf(waiter);
        if (index >= 0) list.splice(index, 1);
        reject(new Error(`等待 ${method} 超时（${Math.round(timeout / 1000)}s）`));
      }, timeout);
      const list = this.waiters.get(method) || [];
      list.push(waiter);
      this.waiters.set(method, list);
    });
  }

  failAll(error) {
    this.closed = true;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
    for (const list of this.waiters.values()) {
      for (const waiter of list) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
    }
    this.waiters.clear();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try { this.ws.close(); } catch { /* already closed */ }
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Chrome CDP 连接已关闭'));
    }
    this.pending.clear();
  }
}

class CdpPage {
  constructor(connection) {
    this.conn = connection;
  }

  /** 在每次新文档创建前注入脚本；必须在 navigate 前调用。 */
  async addInitScript(source) {
    await this.conn.send('Page.addScriptToEvaluateOnNewDocument', { source }, 10000);
  }

  async navigate(url, { timeout = 60000 } = {}) {
    const loaded = this.conn.wait('Page.loadEventFired', timeout);
    const result = await this.conn.send('Page.navigate', { url }, timeout);
    if (result.errorText) throw new Error(`导航失败 ${url}: ${result.errorText}`);
    await loaded;
  }

  /**
   * 执行页内表达式。传函数时自动序列化并带上一个 JSON 参数；返回 Promise 时等待完成。
   */
  async evaluate(input, arg, { timeout = 60000, awaitPromise = true, returnByValue = true } = {}) {
    const expression = typeof input === 'function'
      ? `(${input.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`
      : String(input);
    const response = await this.conn.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue,
      userGesture: true,
      includeCommandLineAPI: true,
    }, timeout);
    if (response.exceptionDetails) {
      const detail = response.exceptionDetails.exception?.description
        || response.exceptionDetails.exception?.value
        || response.exceptionDetails.text
        || '页面执行失败';
      throw new Error(String(detail));
    }
    return response.result?.value;
  }

  async waitFor(expression, { timeout = 60000, interval = 100 } = {}) {
    const started = Date.now();
    for (;;) {
      const value = await this.evaluate(expression, undefined, { timeout: Math.min(timeout, 10000) });
      if (value) return value;
      if (Date.now() - started >= timeout) throw new Error(`等待页面条件超时（${Math.round(timeout / 1000)}s）`);
      await sleep(interval);
    }
  }

  onConsole(listener) {
    this.conn.on('Runtime.consoleAPICalled', (event) => {
      const text = (event.args || []).map((item) => {
        if (item.value !== undefined) return typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        if (item.unserializableValue) return item.unserializableValue;
        return item.description || '';
      }).join(' ');
      listener({ type: event.type, text });
    });
  }

  onPageError(listener) {
    this.conn.on('Runtime.exceptionThrown', (event) => {
      const details = event.exceptionDetails || {};
      listener(details.exception?.description || details.exception?.value || details.text || '页面异常');
    });
  }

  /** 注入一个可从页内直接调用的函数；CDP binding 没有返回值，调用方按事件顺序消费。 */
  async addBinding(name, listener) {
    await this.conn.send('Runtime.addBinding', { name }, 10000);
    this.conn.on('Runtime.bindingCalled', (event) => {
      if (event.name === name) listener(event.payload);
    });
  }
}

class ChromeSession {
  constructor(child, connection, page, profileDir) {
    this.child = child;
    this.connection = connection;
    this.page = page;
    this.profileDir = profileDir;
    this.closed = false;
  }

  async version() {
    const info = await this.connection.send('Browser.getVersion', {}, 10000);
    return info.product || '';
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.connection.close();
    if (this.child.pid) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(this.child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      } else {
        try { this.child.kill('SIGTERM'); } catch { /* already exited */ }
      }
    }
    try { rmSync(this.profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* profile cleanup is best-effort */ }
  }
}

/**
 * 启动 Chrome 并连接首个 page target。
 * @returns {Promise<ChromeSession>}
 */
export async function launchChrome({ env = process.env, headless = true, args = [], startupTimeout = 30000 } = {}) {
  let WebSocket;
  try {
    ({ default: WebSocket } = await import('ws'));
  } catch {
    throw new Error('缺少 npm 依赖 ws；先在 SKILL 目录执行 npm install');
  }
  const executable = findChrome(env);
  const profileDir = mkdtempSync(path.join(os.tmpdir(), 'ticktoon-chrome-'));
  const flags = [
    ...(headless ? ['--headless=new'] : []),
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,800',
    ...(env.TICKTOON_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
    ...chromiumArgs(env),
    ...args,
    'about:blank',
  ];

  const child = spawn(executable, flags, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

  let port = null;
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + startupTimeout;
  try {
    for (;;) {
      if (existsSync(portFile)) {
        const [value] = readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
        if (value) { port = Number(value); break; }
      }
      if (child.exitCode !== null) throw new Error(`Chrome 启动失败（退出码 ${child.exitCode}）：${stderr.split(/\r?\n/).slice(-3).join(' ')}`);
      if (Date.now() > deadline) throw new Error(`Chrome 启动超时：${stderr.split(/\r?\n/).slice(-3).join(' ')}`);
      await sleep(50);
    }

    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
      || targets.find((item) => item.webSocketDebuggerUrl);
    if (!target) throw new Error('Chrome 没有可用的 page target');

    const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('连接 Chrome page target 超时')), 10000);
      ws.once('open', () => { clearTimeout(timer); resolve(); });
      ws.once('error', (error) => { clearTimeout(timer); reject(error); });
    });
    const connection = new CdpConnection(ws);
    await connection.send('Page.enable', {}, 10000);
    await connection.send('Runtime.enable', {}, 10000);
    const page = new CdpPage(connection);
    return new ChromeSession(child, connection, page, profileDir);
  } catch (error) {
    try {
      if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else child.kill('SIGTERM');
    } catch { /* best-effort */ }
    try { rmSync(profileDir, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 }); } catch { /* best-effort */ }
    throw error;
  }
}
