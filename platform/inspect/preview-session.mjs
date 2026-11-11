/**
 * 一次预览会话，多种采样复用。
 *
 * 走引擎 preview-panel 的 capture 协议：面板 pause → seek → await video.settle(t)
 * → 同步重绘 → toBlob。调用方只给时间，不再自己算 RAF / 固定 sleep。
 *
 * 所有帧都在同一个 Chrome 页面里完成；联系表也在页内按 capture 顺序拼，
 * 不再为了拼图多渲染一轮。
 */
import { launchChrome } from '../../scripts/lib/chrome-cdp.mjs';

const INIT_SCRIPT = `
(() => {
  window.__panelMsgs = [];
  window.__ttReceipts = [];
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.__source !== 'ticktoon-preview-panel') return;
    if (data.type === 'ready' || data.type === 'loading' || data.type === 'error') {
      window.__panelMsgs.push({ type: data.type, message: data.message });
    } else if (data.type === 'loaded') {
      window.__panelMsgs.push({
        type: 'loaded',
        duration: data.duration,
        width: data.width,
        height: data.height,
      });
    }
  });
  globalThis.__ttReceipt = (payload) => {
    window.__ttReceipts.push(payload);
  };
})();
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitPanelMessage(page, type, timeout = 60000) {
  const started = Date.now();
  for (;;) {
    const state = await page.evaluate((wanted) => {
      const index = window.__panelMsgs.findIndex((message) => message.type === wanted);
      if (index >= 0) return { entry: window.__panelMsgs.splice(index, 1)[0] };
      const error = window.__panelMsgs.find((message) => message.type === 'error');
      return error ? { error: error.message || '预览面板错误' } : null;
    }, type);
    if (state?.error) throw new Error(`预览面板错误：${state.error}`);
    if (state?.entry) return state.entry;
    if (Date.now() - started > timeout) throw new Error(`等面板消息 ${type} 超时`);
    await sleep(100);
  }
}

export class PreviewSession {
  constructor(browser, page, loaded) {
    this.browser = browser;
    this.page = page;
    this.duration = Number(loaded.duration) || 0;
    this.width = Number(loaded.width) || 0;
    this.height = Number(loaded.height) || 0;
    this.captureSequence = 0;
    this.closed = false;
  }

  /**
   * 在同一页面装载新 composition。
   * code lab 的缩略图与静态预览共用这一个会话，避免每张图都重启 Chrome。
   */
  async load(composition) {
    await this.page.evaluate(() => { window.__panelMsgs = []; });
    await this.page.evaluate((input) => {
      window.postMessage({
        __source: 'ticktoon-preview-page',
        type: 'load',
        composition: input,
        controls: false,
      }, '*');
    }, composition);
    const loaded = await waitPanelMessage(this.page, 'loaded');
    this.duration = Number(loaded.duration) || 0;
    this.width = Number(loaded.width) || 0;
    this.height = Number(loaded.height) || 0;
    return loaded;
  }

  async initSheet(spec) {
    await this.page.evaluate((input) => {
      const cv = document.getElementById('cv');
      if (!cv) throw new Error('找不到画布 #cv（面板可能没有进入预览模式）');
      const scale = input.cellWidth / cv.width;
      const cellH = Math.round(cv.height * scale);
      const sheet = document.createElement('canvas');
      sheet.width = input.cols * input.cellWidth + (input.cols + 1) * input.gap;
      sheet.height = Math.ceil(input.count / input.cols) * (cellH + input.labelH) + input.gap;
      const ctx = sheet.getContext('2d');
      ctx.fillStyle = '#0b0d11';
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      window.__sheet = { canvas: sheet, ctx, cellH, spec: input, drawn: 0 };
    }, spec);
  }

  resetReceipts() {
    return this.page.evaluate(() => { window.__ttReceipts = []; });
  }

  receipts() {
    return this.page.evaluate(() => window.__ttReceipts);
  }

  frameDataUrl() {
    return this.page.evaluate(() => document.getElementById('cv')?.toDataURL('image/png') ?? null);
  }

  sheetDataUrl() {
    return this.page.evaluate(() => window.__sheet?.canvas.toDataURL('image/png') ?? null);
  }

  /**
   * 捕获一个时刻。面板负责 seek + video settle + 重绘；同一次页内调用顺手做亮度探针
   * 和联系表贴图，减少 CDP 往返。
   *
   * @param {number} time
   * @param {{ sheet?: boolean, image?: boolean }} options
   * @returns {Promise<{ time, width, height, mean, image?, drawn? }>}
   */
  async captureAt(time, { sheet = false, image = false } = {}) {
    const requestId = `capture-${++this.captureSequence}`;
    const result = await this.page.evaluate(async (input) => {
      return await new Promise((resolve, reject) => {
        const finish = (fn, value) => {
          clearTimeout(timer);
          window.removeEventListener('message', onMessage);
          fn(value);
        };
        const timer = setTimeout(() => finish(reject, new Error('捕获帧超时')), 120000);
        const onMessage = (event) => {
          const data = event.data;
          if (!data || data.__source !== 'ticktoon-preview-panel' || data.requestId !== input.requestId) return;
          if (data.type === 'capture-error') {
            finish(reject, new Error(data.message || '捕获帧失败'));
            return;
          }
          if (data.type !== 'capture-result') return;

          const cv = document.getElementById('cv');
          if (!cv) {
            finish(reject, new Error('找不到画布 #cv（面板可能没有进入预览模式）'));
            return;
          }

          const probe = document.createElement('canvas');
          probe.width = 32;
          probe.height = 18;
          const probeCtx = probe.getContext('2d', { willReadFrequently: true });
          probeCtx.drawImage(cv, 0, 0, 32, 18);
          const pixels = probeCtx.getImageData(0, 0, 32, 18).data;
          let sum = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            sum += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
          }
          const mean = Number((sum / (pixels.length / 4)).toFixed(2));

          let drawn = null;
          if (input.sheet && window.__sheet) {
            const state = window.__sheet;
            const index = state.drawn;
            const col = index % state.spec.cols;
            const row = Math.floor(index / state.spec.cols);
            const x = state.spec.gap + col * (state.spec.cellWidth + state.spec.gap);
            const y = state.spec.gap + row * (state.cellH + state.spec.labelH + state.spec.gap);
            state.ctx.drawImage(cv, x, y, state.spec.cellWidth, state.cellH);
            state.ctx.fillStyle = '#8a94a6';
            state.ctx.font = '600 13px ui-monospace, Menlo, monospace';
            state.ctx.fillText(state.spec.labels[index] || '', x + 4, y + state.cellH + 14);
            state.drawn += 1;
            drawn = index;
          }

          finish(resolve, {
            time: data.time,
            width: data.width,
            height: data.height,
            mean,
            drawn,
          });
        };
        window.addEventListener('message', onMessage);
        window.postMessage({
          __source: 'ticktoon-preview-page',
          type: 'capture',
          requestId: input.requestId,
          time: input.time,
        }, '*');
      });
    }, { time, requestId, sheet }, { timeout: 150000 });

    if (image) {
      const dataUrl = await this.frameDataUrl();
      if (!dataUrl) throw new Error('找不到画布 #cv（面板可能没有进入预览模式）');
      return { ...result, image: dataUrl };
    }
    return result;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.browser.close();
  }
}

/**
 * 打开页面、装载 composition，返回可复用会话。
 * @param {{ base: string, composition: object, onPageError?: (message: string) => void }} options
 */
export async function openPreviewSession({ base, composition, onPageError = null }) {
  const browser = await launchChrome();
  const page = browser.page;

  if (onPageError) {
    page.onPageError((message) => onPageError(message.slice(0, 300)));
    page.onConsole(({ type, text }) => {
      if (type === 'error') onPageError(text.slice(0, 300));
    });
  }

  try {
    await page.addInitScript(INIT_SCRIPT);
    await page.navigate(`${base}/preview-panel.html`);

    await waitPanelMessage(page, 'ready');
    await page.evaluate((input) => {
      window.postMessage({ __source: 'ticktoon-preview-page', type: 'load', composition: input, controls: false }, '*');
    }, composition);
    const loaded = await waitPanelMessage(page, 'loaded', 120000);
    return new PreviewSession(browser, page, loaded);
  } catch (error) {
    await browser.close();
    throw error;
  }
}
