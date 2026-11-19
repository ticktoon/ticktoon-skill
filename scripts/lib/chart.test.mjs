import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.TT = {};
await import('../../platform/kit/chart.js');
const chart = globalThis.TT.chart;
const rect = { x: 100, y: 80, w: 600, h: 400 };

test('columns：列形保持在 rect 内，量程与基线一致', () => {
  const rows = [{ label: 'A', value: 20 }, { label: 'B', value: 173 }, { label: 'C', value: 0 }];
  const out = chart.columns(rect, rows, { maxWidth: 48 });
  assert.equal(out.max, 200);
  assert.equal(out.baselineY, 480);
  assert.equal(out.bars.length, 3);
  for (const bar of out.bars) {
    assert.ok(bar.x >= rect.x);
    assert.ok(bar.x + bar.w <= rect.x + rect.w);
    assert.ok(bar.y >= rect.y);
    assert.ok(bar.y + bar.h <= out.baselineY + 1e-9);
  }
  assert.equal(out.bars[1].h, rect.h * 173 / 200);
  assert.equal(out.bars[2].h, 0);
});

test('columns：空数据与类别上限显式处理', () => {
  assert.deepEqual(chart.columns(rect, []).bars, []);
  assert.throws(() => chart.columns(rect, Array.from({ length: 13 }, () => ({ label: 'x', value: 1 }))), /最多 12 列/);
});

test('radar：网格、标签和系列共用中心与量程', () => {
  const out = chart.radar(rect, {
    labels: ['性能', '易用', '稳定'],
    series: [{ name: 'A', values: [50, 100, 0] }],
    rings: 4,
  });
  assert.equal(out.max, 100);
  assert.equal(out.grid.length, 4);
  assert.equal(out.spokes.length, 3);
  assert.equal(out.labels.length, 3);
  assert.equal(out.series[0].points[0].ratio, 0.5);
  assert.equal(out.series[0].points[1].ratio, 1);
  assert.equal(out.series[0].points[2].x, out.center.x);
  assert.equal(out.series[0].points[2].y, out.center.y);
  assert.equal(out.series[0].points[0].y, out.center.y - out.radius * 0.5);
  assert.equal(out.series[0].points[1].y, out.center.y + out.radius * 0.5);
});

test('radar：轴数和系列长度必须匹配', () => {
  assert.throws(() => chart.radar(rect, { labels: ['A', 'B'], series: [] }), /3–8/);
  assert.throws(() => chart.radar(rect, {
    labels: ['A', 'B', 'C'], series: [{ name: 'bad', values: [1, 2] }],
  }), /数量必须等于轴数/);
});

test('pie：占比、环图内径与等宽缝几何确定', () => {
  const rows = [{ label: 'A', value: 50 }, { label: 'B', value: 30 }, { label: 'C', value: 20 }];
  const out = chart.pie(rect, rows, { innerRadius: 0.55, gapPx: 6 });
  assert.equal(out.total, 100);
  assert.equal(out.innerRadius, out.outerRadius * 0.55);
  assert.equal(out.slices.length, 3);
  assert.ok(Math.abs(out.slices.reduce((sum, slice) => sum + slice.pct, 0) - 100) < 1e-9);
  for (const slice of out.slices) {
    assert.ok(slice.outerEnd > slice.outerStart);
    assert.ok(slice.innerEnd > slice.innerStart);
    assert.ok(slice.label.textX !== slice.label.breakX);
  }
  assert.equal(out.slices[0].midAngle, -Math.PI / 2 + Math.PI / 2);
});

test('pie：progress 控制扇区角度，零总量不绘制', () => {
  const rows = [{ label: 'A', value: 25 }, { label: 'B', value: 75 }];
  const out = chart.pie(rect, rows, { progress: 0.5, gapPx: 0 });
  assert.ok(Math.abs((out.slices[1].outerEnd - out.slices[1].outerStart) - Math.PI * 1.5 * 0.2) < 1e-9);
  assert.deepEqual(chart.pie(rect, [{ label: 'empty', value: 0 }]).slices, []);
  assert.throws(() => chart.pie(rect, Array.from({ length: 9 }, () => ({ label: 'x', value: 1 }))), /最多 8 个/);
});
