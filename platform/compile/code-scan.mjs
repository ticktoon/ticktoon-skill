/**
 * storyboard 里 `scene.code` 的静态闸门。
 *
 * code 场景是可信作者输入（引擎本来就用 new Function 执行它），但编译层仍要拦两类事：
 *   1. 破坏确定性的墙钟/随机数与外部 IO —— 这些一旦进片，det 就失去意义；
 *   2. 引用本场没有声明的资源 —— api.img/api.data/api.video 拿到 null 只会静默少一层。
 *
 * 扫描是词法级的，不追求完整语法分析：字符串里出现 `document.` 也会被拦，
 * 因为规则宁可误伤一行注释，也不放过一个真调用。
 */

const FORBIDDEN = [
  { name: 'import(', re: /\bimport\s*\(/g },
  { name: 'require(', re: /\brequire\s*\(/g },
  { name: 'fetch(', re: /\bfetch\s*\(/g },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/g },
  { name: 'WebSocket', re: /\bWebSocket\b/g },
  { name: 'document.', re: /\bdocument\s*\./g },
  { name: 'window.', re: /\bwindow\s*\./g },
  { name: 'localStorage', re: /\blocalStorage\b/g },
  { name: 'eval(', re: /\beval\s*\(/g },
  { name: 'new Function', re: /\bnew\s+Function\b/g },
  { name: 'Date.now', re: /\bDate\s*\.\s*now\b/g },
  { name: 'new Date', re: /\bnew\s+Date\b/g },
  { name: 'Math.random', re: /\bMath\s*\.\s*random\b/g },
];

const LOOPS = [
  { name: 'while(', re: /\bwhile\s*\(/g },
  { name: 'for (;;', re: /\bfor\s*\(\s*;\s*;/g },
];

const RESOURCE_REF = /api\.(img|video|data)\s*\(\s*(?:'([^']*)'|"([^"]*)")\s*\)/g;

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}


/**
 * 把注释内容替换成等长空格（换行保留），供词法扫描用。
 * 保留长度是为了 `lineOf` 的行号仍指向原 code 的真实行；
 * 字符串字面量内部的 `//` 与 `/*` 不会被误判为注释。
 * 用 charCode 常量写换行/反斜杠，避免多层转义把源码写坏。
 */
function blankComments(code) {
  const NL = String.fromCharCode(10);
  const BSL = String.fromCharCode(92);
  let out = '';
  let i = 0;
  let quote = null;
  let inLine = false;
  let inBlock = false;
  const blank2 = () => { out += '  '; i += 2; };
  while (i < code.length) {
    const c = code[i];
    const n = code[i + 1];
    if (inLine) {
      if (c === NL) { inLine = false; out += c; } else out += ' ';
      i += 1; continue;
    }
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; blank2(); continue; }
      out += c === NL ? NL : ' ';
      i += 1; continue;
    }
    if (quote) {
      out += c;
      if (c === BSL && i + 1 < code.length) { out += code[i + 1]; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i += 1; continue; }
    if (c === '/' && n === '/') { inLine = true; blank2(); continue; }
    if (c === '/' && n === '*') { inBlock = true; blank2(); continue; }
    out += c; i += 1;
  }
  return out;
}

/** 资源声明既接受归一化后的对象，也接受名字字符串；只有 image/video/data 参与 api 查询。 */
function declaredResources(resources) {
  const names = new Set();
  if (!Array.isArray(resources)) return names;
  for (const item of resources) {
    if (typeof item === 'string') {
      if (item.trim()) names.add(item.trim());
    } else if (item && typeof item === 'object') {
      if ((item.type === 'image' || item.type === 'video' || item.type === 'data') && typeof item.name === 'string' && item.name.trim()) {
        names.add(item.name.trim());
      }
    }
  }
  return names;
}

/**
 * @param {string} code
 * @param {{ sceneId?: string, resources?: Array }} options
 * @returns {{ errors: Array<{ code, msg }>, warnings: Array<{ level, code, msg }> }}
 */
export function scanSceneCode(code, { sceneId = '', resources = [] } = {}) {
  const text = String(code == null ? '' : code);
  // 注释只是说明，不是调用；扫描前抹掉，误报就没了（行号仍按 text 算）。
  const scanText = blankComments(text);
  const errors = [];
  const warnings = [];

  for (const item of FORBIDDEN) {
    item.re.lastIndex = 0;
    const match = item.re.exec(scanText);
    if (!match) continue;
    errors.push({
      code: 'CODE_FORBIDDEN_API',
      msg: `scene ${sceneId || '<unknown>'} 的 code 用了禁用 API "${item.name}"（第 ${lineOf(text, match.index)} 行）；` +
        'code 必须确定性、同步且无外部 IO：墙钟/随机数用 api.seed + TT.rng，资源用 api.img/api.data/api.video 读取本场 resources',
    });
  }

  for (const item of LOOPS) {
    item.re.lastIndex = 0;
    const match = item.re.exec(scanText);
    if (!match) continue;
    warnings.push({
      level: 'should',
      code: 'CODE_LOOP_RISK',
      msg: `scene ${sceneId || '<unknown>'} 的 code 出现 "${item.name}"（第 ${lineOf(text, match.index)} 行）；` +
        'code 每帧同步执行，无界循环会把预览/导出卡死。确认有确定上界',
    });
  }

  const hasFont = Array.isArray(resources)
    && resources.some((item) => item && typeof item === 'object' && item.type === 'font');
  if (!hasFont && /\bTT\s*\.\s*text\b/.test(scanText)) {
    errors.push({
      code: 'SCENE_FONTS_MISSING',
      msg: `scene ${sceneId || '<unknown>'} 调用了 TT.text，但本场 resources 没有 font 条目；` +
        '在 scene.resources 里加 { type: "font", name: "<manifest 字体键>" }，src 由编译期补齐',
    });
  }

  const known = declaredResources(resources);
  const missing = new Set();
  for (const match of scanText.matchAll(RESOURCE_REF)) {
    const name = (match[2] ?? match[3] ?? '').trim();
    if (!name || known.has(name)) continue;
    missing.add(name);
  }
  for (const name of missing) {
    errors.push({
      code: 'CODE_RESOURCE_MISSING',
      msg: `scene ${sceneId || '<unknown>'} 的 code 引用了资源 "${name}"，但它不在本场 resources 里` +
        `（已声明：${[...known].join(' / ') || '无'}）；在 scene.resources 里补 { type: 'image' | 'data' | 'video', name: '${name}', src }`,
    });
  }

  return { errors, warnings };
}
