#!/usr/bin/env node
/**
 * Extract static shadow-puppet leather from a bb-video compatible shadow.js into
 * declarative data resources. The runtime never evaluates the source library.
 *
 * Usage: node scripts/tools/extract-shadow-archetypes.mjs <reference-project> <out-dir>
 * Source style: MIT (bb-video). Keep the upstream copyright notice with derived data.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [sourceRoot, outDir] = process.argv.slice(2);
if (!sourceRoot || !outDir) throw new Error('usage: extract-shadow-archetypes.mjs <reference-project> <out-dir>');
const source = readFileSync(path.join(sourceRoot, 'lib', 'shadow.js'), 'utf8');

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.children = [];
    this.dataset = {};
    this.style = {};
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  appendChild(child) { this.children.push(child); return child; }
}

const callbacks = [];
const P = {
  E: {
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    cubicInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2),
    quartOut: (t) => 1 - (1 - t) ** 4,
    quartIn: (t) => t ** 4,
    expoIn: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
    backOut: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  },
  seg: (t, a, b, e = (x) => x) => e(Math.max(0, Math.min(1, b === a ? 1 : (t - a) / (b - a)))),
  set: (node, attrs) => Object.assign(node.attrs, attrs),
  el: (tag, style, parent) => {
    const node = new FakeNode(tag);
    node.styleText = style;
    if (parent) parent.appendChild(node);
    return node;
  },
};
const F = {
  W: 1920,
  H: 1080,
  portrait: false,
  theme: { fonts: { display: 'serif' } },
  px: (n) => n,
  add: (fn) => callbacks.push(fn),
  sfx: () => {},
  text: () => {},
};
const window = { PROMO: P, EV: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), lerp: (a, b, t) => a + (b - a) * t } };
const document = { documentElement: { lang: 'zh-CN' }, createElementNS: (_ns, tag) => new FakeNode(tag) };
new Function('window', 'document', source)(window, document);
const Y = P.shadow(F, {});
Y.floor = 864;

function serialize(node, ids = new Map()) {
  const out = { tag: node.tag, attrs: { ...node.attrs } };
  if (ids.has(node)) out.id = ids.get(node);
  if (node.children.length) out.children = node.children.map((child) => serialize(child, ids));
  return out;
}

function parts(parent) {
  const wrap = parent.children[0];
  const svg = wrap.children[0];
  const rods = svg.children[0];
  const root = svg.children[1];
  const flip = root.children[0];
  return { wrap, svg, rods, root, flip };
}

function extractFigure(kind, look = {}) {
  const parent = new FakeNode('div');
  Y.puppet(parent, {
    kind,
    look: { ...look, faceColor: look.faceColor ?? '$face' },
    colors: { robe: '$robe', trim: '$trim' },
    x: 0,
    size: 600,
    at: 0,
    sfx: false,
  });
  const { flip } = parts(parent);
  const children = flip.children;
  let index = 0;
  const result = { version: 1, kind, small: kind === 'soldier' ? 0.86 : kind === 'crone' ? 0.92 : 1 };
  if (kind === 'crone') result.stoop = 1;
  if (kind === 'general' || kind === 'rebel' || look.flags) result.flags = serialize(children[index++]);
  const backArm = children[index++];
  let legs = null;
  if (kind === 'soldier' || kind === 'general' || kind === 'rebel') {
    result.armor = true;
    legs = children[index++];
  }
  const boots = [];
  if (!result.armor) {
    while (children[index]?.tag === 'path') boots.push(serialize(children[index++]));
  }
  const body = children[index++];
  const head = children[index++];
  const frontArm = children[index++];
  if (!body || !head || !frontArm) throw new Error(`unable to split ${kind}`);
  return {
    ...result,
    tree: {
      backArm: serialize(backArm),
      frontArm: serialize(frontArm),
      legs: legs ? serialize(legs) : null,
      boots,
      body: serialize(body),
      head: serialize(head),
    },
  };
}

function extractProp(kind, extra = {}) {
  const parent = new FakeNode('div');
  Y.prop(parent, { kind, x: 0, y: 0, size: 400, at: 0, sfx: false, ...extra });
  const wrap = parent.children[0];
  const svg = wrap.children[0];
  const root = svg.children[0];
  const g = root.children[0];
  const ids = new Map();
  if (g._body) ids.set(g._body, 'horseBody');
  (g._legs || []).forEach((node, i) => ids.set(node, `horseLeg${i}`));
  if (g._cloth) ids.set(g._cloth, 'flagCloth');
  if (g._reeds) {
    ids.set(g._reeds.leaf, 'reedsLeaf');
    ids.set(g._reeds.head, 'reedsHead');
  }
  (g._fire || []).forEach(({ f }, i) => ids.set(f, `fire${i}`));
  const out = { version: 1, kind, tree: serialize(g, ids) };
  if (g._reeds) {
    out.reeds = {
      seed: g._reeds.seed,
      B: g._reeds.B,
      leaf: { ...g._reeds.leaf.attrs },
      head: { ...g._reeds.head.attrs },
    };
  }
  return out;
}

mkdirSync(path.join(outDir, 'archetypes'), { recursive: true });
mkdirSync(path.join(outDir, 'props'), { recursive: true });
const figures = {
  official: extractFigure('official', { hat: 'guan', beard: 'full', face: 'solid', faceColor: '$face' }),
  soldier: extractFigure('soldier', { hat: 'hair', beard: null }),
  crone: extractFigure('crone'),
};
for (const [name, data] of Object.entries(figures)) {
  writeFileSync(path.join(outDir, 'archetypes', `${name}.json`), JSON.stringify(data) + '\n');
}
for (const kind of ['moon', 'gate', 'jar', 'reeds', 'horse', 'flag', 'fire', 'mountain', 'tree', 'cloud']) {
  writeFileSync(path.join(outDir, 'props', `${kind}.json`), JSON.stringify(extractProp(kind), null, 2) + '\n');
}

const cast = {
  刘邦: { kind: 'official', look: { hat: 'guan', beard: 'full', face: 'solid', faceColor: 'red' }, colors: { robe: 'red', trim: 'black' }, scale: 1 },
  老妪: { kind: 'crone', colors: { robe: 'blue', trim: 'black' }, scale: 1 },
  徒甲: { kind: 'soldier', look: { hat: 'hair' }, colors: { robe: 'blue', trim: 'black' }, scale: 1.03 },
  徒乙: { kind: 'soldier', look: { hat: 'hair' }, colors: { robe: 'deep', trim: 'black' }, scale: 0.9 },
  探路人: { kind: 'soldier', look: { hat: 'hair' }, colors: { robe: 'green', trim: 'black' }, scale: 0.96 },
};
writeFileSync(path.join(outDir, 'cast.json'), JSON.stringify(cast, null, 2) + '\n');
console.log('extracted', Object.keys(figures).join(', '), 'and 10 props to', outDir);
