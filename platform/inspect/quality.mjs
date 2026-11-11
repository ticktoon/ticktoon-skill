/**
 * 统一质量管线：一次 build + 一次浏览器采样，机器只跑轻门禁。
 *
 * 退出码只看 must：渲染异常、空墨迹。
 * 构图、安全框、碰撞、对比度、停留、时间维都留给 12 格联系表和人审。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildProject } from '../project/build.mjs';
import { sampleFilm, sampleTimes, reviewSampleTimes } from './sample.mjs';
import { runQa } from './qa.mjs';

function uniquePicks(picks) {
  const out = [];
  for (const pick of picks) {
    const time = Number(pick?.time);
    if (!Number.isFinite(time)) continue;
    if (out.some((item) => Math.abs(item.time - time) < 0.05)) continue;
    out.push({ ...pick, time: Number(time.toFixed(3)) });
  }
  return out.sort((a, b) => a.time - b.time);
}

/**
 * @param {{
 *   root: string, dir: string, file?: string|null, tts?: object|null,
 *   count?: number, gridCount?: number, cols?: number,
 *   log?: (line: string) => void,
 * }} options
 * @returns {Promise<{ ok: boolean, built: object, sampled: object|null, result: object }>}
 */
export async function runFilmQuality({
  root,
  dir,
  file = null,
  tts = null,
  count = 24,
  gridCount = 12,
  cols = 4,
  log = () => {},
}) {
  mkdirSync(dir, { recursive: true });
  const built = await buildProject({ root, dir, file, tts, write: false, receipts: true });
  if (!built.ok) {
    return {
      ok: false,
      built,
      sampled: null,
      result: {
        ok: false,
        summary: { must: 1, should: 0, nice: 0 },
        issues: [],
        checks: null,
        coverage: null,
        sheet: null,
        sampling: null,
      },
    };
  }

  const scanPicks = sampleTimes(built.planned, Math.max(1, count));
  const reviewPicks = reviewSampleTimes(built.planned, gridCount, scanPicks);
  const picks = uniquePicks([...reviewPicks, ...scanPicks]);
  const grid = reviewPicks.length
    ? {
      cols,
      count: reviewPicks.length,
      cellWidth: 420,
      gap: 10,
      labelH: 20,
      labels: reviewPicks.map((pick) => `${pick.time.toFixed(2)}s  ${pick.sceneId}`),
      picks: reviewPicks.map((pick) => pick.time),
      file: 'qa-sheet.png',
    }
    : null;

  const sampled = await sampleFilm({
    root,
    dir,
    planned: built.planned,
    composition: built.composition,
    report: built.report,
    times: picks.map((pick) => pick.time),
    grid,
    log,
  });

  const inkless = built.recipe?.template?.inkless ? new Set([built.recipe.id]) : new Set();
  const qa = runQa({
    receipts: sampled.receipts,
    inkless,
  });
  // 渲染异常不是"建议"：页内抛错说明这一帧没有按预期画出来。
  const renderIssues = (sampled.pageErrors || []).map((message) => ({
    level: 'must', code: 'RENDER_PAGE_ERROR', t: 0, msg: message,
  }));

  const issues = [...qa.issues, ...renderIssues];
  const countLevel = (level) => issues.filter((issue) => issue.level === level).length;
  const summary = {
    must: countLevel('must'),
    should: countLevel('should'),
    nice: countLevel('nice'),
  };
  const checks = { qa: qa.summary };
  const result = {
    ok: summary.must === 0,
    summary,
    issues,
    checks,
    coverage: sampled.coverage,
    sheet: sampled.grid ? path.relative(dir, sampled.grid).replaceAll('\\', '/') : null,
    sampling: {
      frames: picks.length,
      review: reviewPicks.length,
      cols,
    },
  };

  const outDir = path.join(dir, 'out');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(result, null, 2));
  const reportPath = path.join(outDir, 'report.json');
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    // 清掉旧质检命令写在 report.json 里的字段，避免同一份报告同时出现新旧口径。
    const {
      qa: _qa, coverage: _coverage, sheet: _sheet, rubric: _rubric, receipts: _receipts,
      ...rest
    } = report;
    writeFileSync(reportPath, JSON.stringify({
      ...rest,
      quality: {
        ok: result.ok,
        summary,
        checks,
        sheet: result.sheet,
        coverage: sampled.coverage,
      },
    }, null, 2));
  }

  return { ok: result.ok, built, sampled, result };
}
