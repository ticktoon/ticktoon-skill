/**
 * recipe audit —— "复制阶段"的守门人。
 *
 * audit 就是用机器确认：骨架能建工程，params 的骨架 / code 的 ref-shots 合成片能编译干净，
 * recipe 的 fonts / rules / captions / audio / template 必须通过结构校验，
 * code recipe 还必须有 visual.md 与可解析的 ref-shots/。
 * 视觉质量由 tt qa 的抽帧联系表交给人或 agent 判断。
 *
 * audit 不起浏览器——像素级的事是 tt qa 的职责，这里只做"结构上站得住"。
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildProject } from './build.mjs';
import { recipeRegressionInput } from './ref-shots.mjs';

export async function auditRecipe({ root, catalog, id }) {
  const recipe = catalog.recipes.get(id);
  const checks = [];
  const add = (pass, code, msg) => checks.push({ pass, code, msg });

  if (!recipe) {
    return { id, ok: false, checks: [{ pass: false, code: 'RECIPE_UNKNOWN', msg: '未注册' }] };
  }

  // fonts / rules / captions / audio / template 的结构校验在 loadCatalog 里完成，
  // 这里只把结果报出来。
  if (recipe.recipeErrors?.length) {
    for (const error of recipe.recipeErrors) add(false, error.code, `${error.path} — ${error.msg}`);
  } else {
    add(true, 'RECIPE_VALID', `${recipe.mode} 模式：fonts / rules / captions / audio / template 校验通过`);
  }

  const input = recipeRegressionInput({ root, recipe });
  for (const error of input.errors) {
    add(false, error.code, `${error.file ? `${error.file} — ` : ''}${error.msg}`);
  }
  if (recipe.mode === 'code' && input.refShots.length && !input.errors.length) {
    add(true, 'REF_SHOTS_VALID', `${input.refShots.length} 个镜头参考通过文件头与元数据校验`);
  }

  let built = null;
  if (input.file && !input.errors.length) {
    built = await buildProject({
      root, dir: recipe.dir, file: input.file, tts: null, write: false, receipts: false,
    });
    const label = input.kind === 'code' ? 'ref-shots 合成片' : 'skeleton';
    add(built.ok, 'BUILD_CLEAN',
      built.ok ? `${label} 编译通过` : `${label} 编译失败：${built.report.errors.map((e) => e.code).join(' / ')}`);
  }

  // code recipe 的骨架也会被 tt new 原样复制，必须自己站得住。
  if (recipe.mode === 'code') {
    const skeleton = path.join(recipe.dir, 'skeleton.storyboard.json');
    if (existsSync(skeleton)) {
      const skeletonBuilt = await buildProject({
        root, dir: recipe.dir, file: skeleton, tts: null, write: false, receipts: false,
      });
      add(skeletonBuilt.ok, 'SKELETON_CLEAN',
        skeletonBuilt.ok ? 'skeleton 编译通过' : `skeleton 编译失败：${skeletonBuilt.report.errors.map((e) => e.code).join(' / ')}`);
    }
  }

  const report = built?.report || {};
  if (built?.ok && typeof report.duration === 'number') {
    report.duration = Number(report.duration.toFixed(2));
  }

  return {
    id,
    mode: recipe.mode,
    ok: checks.every((check) => check.pass),
    duration: report.duration ?? 0,
    scenes: report.scenes ?? 0,
    codeScenes: report.codeScenes ?? 0,
    paramsScenes: report.paramsScenes ?? 0,
    units: report.units ?? 0,
    refShots: input.refShots.length,
    checks,
  };
}
