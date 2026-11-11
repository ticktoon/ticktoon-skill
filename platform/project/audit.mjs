/**
 * recipe audit —— "复制阶段"的守门人。
 *
 * audit 就是用机器确认：demo 必须编译干净、recipe 的 fonts / rules / verify 必须通过
 * 结构校验、verify 断言必须能被 tt qa 执行。ABI 8 起 recipe 不再声明 defaults，
 * 版式与节奏由 block 本地配置承载。
 *
 * audit 不起浏览器——像素级的事是 tt qa 的职责，这里只做"结构上站得住"。
 */
import { buildProject } from './build.mjs';

export async function auditRecipe({ root, catalog, id }) {
  const recipe = catalog.recipes.get(id);
  const checks = [];
  const add = (pass, code, msg) => checks.push({ pass, code, msg });

  if (!recipe) {
    return { id, ok: false, checks: [{ pass: false, code: 'RECIPE_UNKNOWN', msg: '未注册' }] };
  }

  // abi 8：fonts / rules / captions / audio / verify / blocks 的结构校验在 loadCatalog
  // 里完成，这里只把结果报出来。
  const isV8 = recipe.abi === '8';
  if (isV8 && recipe.v8Errors?.length) {
    for (const error of recipe.v8Errors) add(false, error.code, `${error.path} — ${error.msg}`);
  } else if (isV8) {
    add(true, 'RECIPE_V8_VALID', 'fonts / rules / captions / audio / verify / blocks 校验通过');
  }

  const demoPath = `${recipe.dir}/demo.storyboard.json`;
  const built = await buildProject({ root, dir: recipe.dir, file: demoPath, tts: null, write: false, receipts: false });
  add(built.ok, 'BUILD_CLEAN', built.ok ? 'demo 编译通过' : `demo 编译失败：${built.report.errors.map((e) => e.code).join(' / ')}`);

  const planned = built.planned;
  let duration = 0;
  let scenes = 0;
  let elements = 0;

  if (built.ok && planned) {
    duration = Number(built.report.duration.toFixed(2));
    scenes = planned.scenes.length;
    elements = built.report.elements;
  }

  if (isV8) {
    // verify ≥2 且断言名可被 tt qa 执行（未知名在 qa 里 warn+skip）。
    const verify = Array.isArray(recipe.verify) ? recipe.verify : [];
    add(verify.length >= 2, 'VERIFY_EXECUTABLE',
      verify.length >= 2 ? `verify ${verify.length} 条断言（${verify.map((item) => item.assert).join(' / ')}）` : 'verify 少于 2 条');
    if (recipe.signature) {
      add(!!recipe.signature.verify, 'SIGNATURE_VERIFIABLE',
        recipe.signature.verify
          ? `签名镜头「${recipe.signature.name}」带 verify 时刻 t=${recipe.signature.verify.t}`
          : 'signature.verify 缺失——记忆点必须可验证，否则只是自我感觉');
    }
  }

  return {
    id,
    ok: checks.every((check) => check.pass),
    duration,
    scenes,
    elements,
    checks,
  };
}
