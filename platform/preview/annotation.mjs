/**
 * 预览页的 skill 层补丁：底部圈注坞 + 右上角「复制 board JSON」。
 *
 * 引擎页面本身没有轨道区，只留 #bottom 扩展槽。用户可连续圈注多帧，圈注先进入
 * 页面内的待发送列表；点「发送圈注」后一次性 POST /api/annotations，
 * 由 scripts/preview.mjs 落到 <工程>/annotations/<batch>/request.json + PNG。
 * 发送成功显示 2 秒半透明提示并落盘；后续由对话驱动修改。
 * 「导出 MP4」写入导出请求，关闭预览窗口与服务，由 tt preview 接续构建和渲染。
 * 页面仍是只读的：没有任何写回 composition 的通道。
 */
const PAGE_TAG = 'ticktoon-preview-page';
const PANEL_TAG = 'ticktoon-preview-panel';
const panel = document.getElementById('panel');
const stage = document.getElementById('stage');
const top = document.getElementById('top');
const bottom = document.getElementById('bottom');
const errorLabel = document.getElementById('error');
const status = document.getElementById('status');
if (!(panel instanceof HTMLIFrameElement) || !stage || !top || !bottom || !errorLabel || !status) {
  throw new Error('Ticktoon annotation host is missing its preview elements');
}

const style = document.createElement('style');
style.textContent = `
  #bottom { max-height: 52vh !important; }
  #skill-annotation-dock { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 12px; border-top: 1px solid #2a303c; background: #171d26; }
  #skill-annotation-dock button { padding: 4px 9px; border: 1px solid #465064; border-radius: 4px; background: #252c38; color: #e4e9f2; cursor: pointer; font: inherit; }
  #skill-annotation-dock button:disabled { opacity: .45; cursor: default; }
  #skill-annotation-description { flex: 1; min-width: 200px; padding: 5px 8px; border: 1px solid #465064; border-radius: 4px; background: #10141a; color: #e4e9f2; font: inherit; outline: none; transition: border-color .15s, box-shadow .15s; }
  #skill-annotation-description:focus { border-color: #4f8cff; box-shadow: 0 0 0 2px rgb(79 140 255 / 28%); }
  #skill-annotation-description:disabled { opacity: .55; }
  #skill-annotation-send { margin-left: auto; }
  #skill-annotation-send.ready { border-color: #4f8cff; color: #fff; }
  #skill-board-copy { margin-left: auto; padding: 4px 9px; border: 1px solid #465064; border-radius: 4px; background: #252c38; color: #e4e9f2; cursor: pointer; font: inherit; }
  #skill-annotation-list { flex: 1 1 auto; display: flex; gap: 8px; min-height: 0; padding: 8px 12px; overflow: auto; border-top: 1px solid #2a303c; }
  #skill-annotation-list:empty { display: none; }
  .skill-annotation-card { flex: none; width: 180px; border: 1px solid #39404e; border-radius: 6px; background: #171d26; overflow: hidden; }
  .skill-annotation-card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; cursor: pointer; }
  .skill-annotation-card .body { padding: 5px 7px 7px; font-size: 11px; color: #aab5c8; }
  .skill-annotation-card .head { display: flex; align-items: center; gap: 6px; }
  .skill-annotation-card .time { flex: 1; color: #8590a4; }
  .skill-annotation-card .remove { border: 0; background: transparent; color: #ff9d9d; cursor: pointer; padding: 0 2px; font: inherit; }
  .skill-annotation-card .desc { margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
  #skill-annotation-shell { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; }
  #skill-annotation-ink { position: absolute; z-index: 3; display: none; cursor: crosshair; touch-action: none; }
`;
document.head.appendChild(style);

const shell = document.createElement('div');
shell.id = 'skill-annotation-shell';
panel.before(shell);
shell.appendChild(panel);
const ink = document.createElement('canvas');
ink.id = 'skill-annotation-ink';
ink.setAttribute('aria-label', '画笔圈注层');
shell.appendChild(ink);
const inkContext = ink.getContext('2d');
if (!inkContext) throw new Error('Unable to create the annotation canvas');

const copyBoardButton = document.createElement('button');
copyBoardButton.id = 'skill-board-copy';
copyBoardButton.textContent = '复制 board JSON';
top.appendChild(copyBoardButton);

const dock = document.createElement('div');
dock.id = 'skill-annotation-dock';
const annotateButton = annotationButton('画笔圈注', () => void start());
const description = document.createElement('input');
description.id = 'skill-annotation-description';
description.placeholder = '描述要改什么，例如：把圈出的标题放大';
description.disabled = true;
const undoButton = annotationButton('撤销笔迹', () => undo());
const clearButton = annotationButton('清空', () => clearStrokes());
const addButton = annotationButton('完成圈注', () => void finish());
const cancelButton = annotationButton('取消', () => cancel());
const sendButton = annotationButton('发送圈注', () => void sendDrafts());
sendButton.id = 'skill-annotation-send';
dock.append(annotateButton, description, undoButton, clearButton, addButton, cancelButton, sendButton);
bottom.prepend(dock);

const list = document.createElement('div');
list.id = 'skill-annotation-list';
bottom.appendChild(list);

let active = false;
let starting = false;
let finishing = false;
let sending = false;
let session = 0;
let strokes = [];
let currentStroke = null;
let activePointer = null;
let composition = null;
let originalFrame = null;
let annotationTime = 0;
let currentTime = 0;
let querySequence = 0;
const pendingQueries = new Map();
/** 待发送圈注；images 保留 Blob，发送时才转 data URL。 */
const drafts = [];

function annotationButton(text, onClick) {
  const button = document.createElement('button');
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function post(type, payload = {}) {
  panel.contentWindow?.postMessage({ __source: PAGE_TAG, type, ...payload }, '*');
}

function query(type, payload = {}) {
  const requestId = `annotation-${Date.now()}-${++querySequence}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingQueries.delete(requestId);
      reject(new Error(`${type} query timed out`));
    }, 15000);
    pendingQueries.set(requestId, {
      resolve: (value) => { clearTimeout(timeout); resolve(value); },
      reject: (error) => { clearTimeout(timeout); reject(error); },
    });
    post(type, { requestId, ...payload });
  });
}

window.addEventListener('message', (event) => {
  if (event.source !== panel.contentWindow) return;
  const data = event.data;
  if (!data || data.__source !== PANEL_TAG) return;
  if (data.type === 'time') currentTime = Number(data.time) || 0;
  if (data.type === 'loaded' && active) cancel();
  const requestId = data.requestId;
  const pending = pendingQueries.get(requestId);
  if (!pending) return;
  if (data.type === 'capture-result' || data.type === 'clips-at-result') {
    pendingQueries.delete(requestId);
    pending.resolve(data);
  } else if (data.type === 'capture-error' || data.type === 'clips-at-error') {
    pendingQueries.delete(requestId);
    pending.reject(new Error(String(data.message || `${data.type} failed`)));
  }
});

async function start() {
  if (active || starting || finishing || sending) return;
  const startSession = ++session;
  starting = true;
  errorLabel.textContent = '';
  updateButtons();
  post('pause');
  try {
    const [nextComposition, capture] = await Promise.all([
      fetch('/api/track').then((response) => {
        if (!response.ok) throw new Error(`Composition request failed: HTTP ${response.status}`);
        return response.json();
      }),
      query('capture', { time: currentTime }),
    ]);
    if (startSession !== session) return;
    composition = nextComposition;
    originalFrame = capture.image;
    annotationTime = capture.time;
    ink.width = capture.width;
    ink.height = capture.height;
    strokes = [];
    currentStroke = null;
    activePointer = null;
    description.value = '';
    redraw();
    active = true;
    ink.style.display = 'block';
    panel.style.pointerEvents = 'none';
    alignInk();
    updateButtons();
    description.focus();
  } catch (error) {
    if (startSession === session) errorLabel.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    if (startSession === session) {
      starting = false;
      updateButtons();
    }
  }
}

function cancel() {
  session += 1;
  active = false;
  starting = false;
  finishing = false;
  currentStroke = null;
  activePointer = null;
  strokes = [];
  originalFrame = null;
  redraw();
  ink.style.display = 'none';
  panel.style.pointerEvents = '';
  updateButtons();
}

function undo() {
  if (!active || activePointer !== null) return;
  strokes.pop();
  redraw();
  updateButtons();
}

function clearStrokes() {
  if (!active || activePointer !== null) return;
  strokes = [];
  currentStroke = null;
  redraw();
  updateButtons();
}

function updateButtons() {
  const hasInk = strokes.length > 0;
  annotateButton.disabled = active || starting || finishing || sending;
  description.disabled = !active || finishing || sending;
  undoButton.disabled = !active || !hasInk || activePointer !== null || finishing;
  clearButton.disabled = !active || !hasInk || activePointer !== null || finishing;
  addButton.disabled = !active || !hasInk || activePointer !== null || finishing;
  cancelButton.disabled = !active || finishing;
  sendButton.disabled = drafts.length === 0 || active || starting || finishing || sending;
  sendButton.textContent = drafts.length ? `发送圈注（${drafts.length}）` : '发送圈注';
  sendButton.classList.toggle('ready', drafts.length > 0 && !active && !sending);
}

function contentBounds() {
  const frameDocument = panel.contentDocument;
  const canvas = frameDocument?.getElementById('cv');
  if (!canvas || !composition) return null;
  const canvasBounds = canvas.getBoundingClientRect();
  const panelBounds = panel.getBoundingClientRect();
  const scale = Math.min(canvasBounds.width / composition.width, canvasBounds.height / composition.height);
  if (!scale) return null;
  const width = composition.width * scale;
  const height = composition.height * scale;
  return new DOMRect(
    panelBounds.left + canvasBounds.left + (canvasBounds.width - width) / 2,
    panelBounds.top + canvasBounds.top + (canvasBounds.height - height) / 2,
    width,
    height,
  );
}

function alignInk() {
  if (!active) return;
  const bounds = contentBounds();
  const shellBounds = shell.getBoundingClientRect();
  if (!bounds) return;
  ink.style.left = `${bounds.left - shellBounds.left}px`;
  ink.style.top = `${bounds.top - shellBounds.top}px`;
  ink.style.width = `${bounds.width}px`;
  ink.style.height = `${bounds.height}px`;
}

function eventPoint(event, clamp = false) {
  const bounds = ink.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !composition) return null;
  const outside = event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside && !clamp) return null;
  const clientX = Math.max(bounds.left, Math.min(bounds.right, event.clientX));
  const clientY = Math.max(bounds.top, Math.min(bounds.bottom, event.clientY));
  return {
    x: (clientX - bounds.left) / bounds.width * composition.width,
    y: (clientY - bounds.top) / bounds.height * composition.height,
  };
}

function appendPoint(stroke, point) {
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1) return;
  stroke.points.push(point);
}

function redraw() {
  inkContext.setTransform(1, 0, 0, 1, 0, 0);
  inkContext.clearRect(0, 0, ink.width, ink.height);
  for (const stroke of strokes) {
    const first = stroke.points[0];
    if (!first) continue;
    inkContext.strokeStyle = stroke.color;
    inkContext.fillStyle = stroke.color;
    inkContext.lineWidth = stroke.width;
    inkContext.lineCap = 'round';
    inkContext.lineJoin = 'round';
    if (stroke.points.length === 1) {
      inkContext.beginPath();
      inkContext.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
      inkContext.fill();
      continue;
    }
    inkContext.beginPath();
    inkContext.moveTo(first.x, first.y);
    for (let index = 1; index < stroke.points.length; index += 1) {
      const point = stroke.points[index];
      inkContext.lineTo(point.x, point.y);
    }
    inkContext.stroke();
  }
}

ink.addEventListener('pointerdown', (event) => {
  if (!active || activePointer !== null || event.button !== 0) return;
  const point = eventPoint(event);
  if (!point) return;
  const stroke = { color: '#ff5a5f', width: 6, points: [point] };
  strokes.push(stroke);
  currentStroke = stroke;
  activePointer = event.pointerId;
  ink.setPointerCapture(event.pointerId);
  redraw();
  updateButtons();
  event.preventDefault();
});
ink.addEventListener('pointermove', (event) => {
  if (!active || event.pointerId !== activePointer || !currentStroke) return;
  const samples = event.getCoalescedEvents?.() ?? [];
  for (const sample of samples.length ? samples : [event]) {
    const point = eventPoint(sample, true);
    if (point) appendPoint(currentStroke, point);
  }
  redraw();
  event.preventDefault();
});
ink.addEventListener('pointerup', (event) => {
  if (event.pointerId !== activePointer || !currentStroke) return;
  const point = eventPoint(event, true);
  if (point) appendPoint(currentStroke, point);
  currentStroke = null;
  activePointer = null;
  redraw();
  updateButtons();
  event.preventDefault();
});
ink.addEventListener('pointercancel', (event) => {
  if (event.pointerId !== activePointer) return;
  if (currentStroke) strokes = strokes.filter((stroke) => stroke !== currentStroke);
  currentStroke = null;
  activePointer = null;
  redraw();
  updateButtons();
});
ink.addEventListener('lostpointercapture', (event) => {
  if (event.pointerId !== activePointer) return;
  currentStroke = null;
  activePointer = null;
  redraw();
  updateButtons();
});

/**
 * 画面只有一个场景，全画幅，所以命中的永远是它；音频事件没有可视位置，
 * 只作为「这一刻在响什么」的上下文带出去。
 */
function hitClip(annotationStrokes, activeClips) {
  return activeClips.find((item) => item.kind === 'scene') ?? null;
}

function clipContext(hit) {
  if (!hit || !composition) return null;
  const scene = (composition.scenes ?? []).find((item) => item.id === hit.id);
  if (!scene) return null;
  return {
    id: scene.id,
    kind: 'scene',
    start: hit.start,
    duration: scene.duration,
    rect: hit.rect,
    cues: scene.cues ?? [],
    code: scene.code,
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the annotation image'));
    reader.readAsDataURL(blob);
  });
}

async function finish() {
  if (!active || finishing || !originalFrame || !strokes.length) return;
  const finishSession = session;
  const finishFrame = originalFrame;
  const finishDescription = description.value.trim();
  const finishStrokes = structuredClone(strokes);
  const inkSnapshot = document.createElement('canvas');
  inkSnapshot.width = ink.width;
  inkSnapshot.height = ink.height;
  const snapshotContext = inkSnapshot.getContext('2d');
  if (!snapshotContext) {
    errorLabel.textContent = 'Unable to copy the annotation canvas';
    return;
  }
  snapshotContext.drawImage(ink, 0, 0);
  finishing = true;
  updateButtons();
  post('pause');
  try {
    const [inkBlob, clipData] = await Promise.all([
      canvasToBlob(inkSnapshot),
      query('clipsAt', { time: annotationTime }),
    ]);
    if (finishSession !== session) return;
    const hit = hitClip(finishStrokes, clipData.clips);
    const annotated = document.createElement('canvas');
    annotated.width = inkSnapshot.width;
    annotated.height = inkSnapshot.height;
    const annotatedContext = annotated.getContext('2d');
    if (!annotatedContext) throw new Error('Unable to compose the annotated frame');
    const frameBitmap = await createImageBitmap(finishFrame);
    try {
      annotatedContext.drawImage(frameBitmap, 0, 0);
      annotatedContext.drawImage(inkSnapshot, 0, 0);
    } finally {
      frameBitmap.close();
    }
    if (finishSession !== session) return;
    const annotatedBlob = await canvasToBlob(annotated);
    if (finishSession !== session) return;
    cancel();
    addDraft({
      t: annotationTime,
      desc: finishDescription,
      strokes: finishStrokes,
      clip: clipContext(hit),
      images: { frame: finishFrame, ink: inkBlob, annotatedFrame: annotatedBlob },
    });
  } catch (error) {
    if (finishSession === session) {
      errorLabel.textContent = error instanceof Error ? error.message : String(error);
    }
  } finally {
    if (finishSession === session) {
      finishing = false;
      updateButtons();
    }
  }
}

function addDraft(draft) {
  draft.thumbnailUrl = URL.createObjectURL(draft.images.annotatedFrame);
  drafts.push(draft);
  errorLabel.textContent = '';
  renderList();
  updateButtons();
  status.textContent = `${drafts.length} 条待发送：可继续圈注其他时刻`;
}

function removeDraft(draft) {
  const index = drafts.indexOf(draft);
  if (index < 0 || sending) return;
  drafts.splice(index, 1);
  URL.revokeObjectURL(draft.thumbnailUrl);
  renderList();
  updateButtons();
  status.textContent = drafts.length ? `${drafts.length} 条待发送` : '画一笔并写描述，可连续圈注多帧；圈注完成后点「发送圈注」。';
}

function renderList() {
  list.replaceChildren();
  for (const draft of drafts) {
    const card = document.createElement('div');
    card.className = 'skill-annotation-card';
    const image = document.createElement('img');
    image.src = draft.thumbnailUrl;
    image.alt = `t=${draft.t.toFixed(2)}s 的圈注`;
    image.title = '点击跳转到该时刻';
    image.addEventListener('click', () => {
      post('pause');
      post('seek', { time: draft.t });
    });
    const body = document.createElement('div');
    body.className = 'body';
    const head = document.createElement('div');
    head.className = 'head';
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = `t=${draft.t.toFixed(2)}s`;
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = '×';
    remove.title = '移除这条圈注';
    remove.addEventListener('click', () => removeDraft(draft));
    head.append(time, remove);
    const text = document.createElement('div');
    text.className = 'desc';
    text.textContent = draft.desc || '（无描述，按笔迹修改）';
    const where = document.createElement('div');
    where.className = 'desc';
    where.style.color = '#6f7a8d';
    where.textContent = draft.clip?.id ? `场景 ${draft.clip.id}` : '';
    body.append(head, text, where);
    card.append(image, body);
    list.appendChild(card);
  }
}

function showSentConfirmation(count) {
  document.getElementById('skill-annotation-sent')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'skill-annotation-sent';
  overlay.setAttribute('role', 'status');
  overlay.style.cssText = 'position:fixed;top:96px;left:50%;transform:translateX(-50%);z-index:10000;width:max-content;max-width:calc(100vw - 40px);pointer-events:none;color:#eef2f7;font:13px/1.55 system-ui,sans-serif;';
  const card = document.createElement('div');
  card.style.cssText = 'position:relative;max-width:560px;padding:15px 20px;border:1px solid rgba(139,163,190,.35);border-radius:12px;background:rgba(27,35,48,.78);backdrop-filter:blur(12px);box-shadow:0 10px 34px rgba(0,0,0,.25);pointer-events:auto;';
  const title = document.createElement('div');
  title.style.cssText = 'margin-bottom:5px;color:#ffffff;font-size:15px;font-weight:650;';
  title.textContent = `已发送 ${count} 条圈注`;
  const working = document.createElement('div');
  working.style.cssText = 'color:#b2bdd0;font-size:12px;';
  working.textContent = 'Agent已收到，正在逐条解读截图并修改。';
  card.append(title, working);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2000);
}

async function sendDrafts() {
  if (!drafts.length || sending || active) return;
  sending = true;
  errorLabel.textContent = '';
  updateButtons();
  try {
    const items = [];
    for (const draft of drafts) {
      items.push({
        t: draft.t,
        desc: draft.desc,
        strokes: draft.strokes,
        clip: draft.clip,
        images: {
          annotatedFrame: await blobToDataUrl(draft.images.annotatedFrame),
          frame: await blobToDataUrl(draft.images.frame),
          ink: await blobToDataUrl(draft.images.ink),
        },
      });
    }
    const response = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const reply = await response.json().catch(() => ({}));
    if (!response.ok || !reply.ok) throw new Error(reply.error || `发送失败: HTTP ${response.status}`);
    const count = drafts.length;
    for (const draft of drafts) URL.revokeObjectURL(draft.thumbnailUrl);
    drafts.length = 0;
    renderList();
    status.textContent = `已发送 ${count} 条圈注，Agent 开始解读和修改。`;
    sending = false;
    updateButtons();
    showSentConfirmation(count);
  } catch (error) {
    errorLabel.textContent = error instanceof Error ? error.message : String(error);
    sending = false;
    updateButtons();
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to encode the annotation image'));
    }, 'image/png');
  });
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 非安全上下文或权限被拒时退回 execCommand。
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('当前上下文不能使用剪贴板，请手动复制');
}

copyBoardButton.addEventListener('click', async () => {
  errorLabel.textContent = '';
  copyBoardButton.disabled = true;
  try {
    const response = await fetch('/api/track');
    if (!response.ok) throw new Error(`board JSON 读取失败: HTTP ${response.status}`);
    const board = await response.json();
    const text = JSON.stringify(board, null, 2);
    await writeClipboard(text);
    status.textContent = `已复制完整 board JSON（${(text.length / 1024).toFixed(1)} KB）`;
  } catch (error) {
    errorLabel.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    copyBoardButton.disabled = false;
  }
});

window.addEventListener('ticktoon-preview-loaded', () => {
  document.getElementById('skill-annotation-sent')?.remove();
});
status.textContent = '需要改稿时用画笔圈注；需要导出时，在任务对话里直接说明。';
updateButtons();
window.addEventListener('resize', alignInk);
panel.addEventListener('load', () => setTimeout(alignInk, 0));
window.addEventListener('keydown', (event) => {
  if (!active) return;
  if (event.key === 'Escape') {
    cancel();
    return;
  }
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  }
});
