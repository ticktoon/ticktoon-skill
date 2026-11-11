/**
 * L2 静帧：渲染指定时刻，并（可选）带回布局凭据。
 *
 * 走 preview-panel 的 capture 协议，和用户看到的完全是同一条链路——
 * 如果这里能出图而 panel 里不行，那一定是环境差异而不是渲染差异，排查范围立刻缩小。
 *
 * receipts 的采集：emit 时注入的 `globalThis.__ttReceipt` 每帧被调用一次，
 * 这里在 capture 前清空、capture 后读走。静帧只有一帧，所以拿到的是**该时刻真实绘制过**的元素，
 * 不是"这一场里声明过的元素"。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildProject } from '../project/build.mjs';
import { createStaticServer } from '../../scripts/lib/serve.mjs';
import { buildAssetBasenameMap, rewriteLocalRefs } from '../../scripts/lib/refs.mjs';
import { getEngineDir } from '../../scripts/lib/engine-runtime.mjs';
import { openPreviewSession } from './preview-session.mjs';
import { mergeFrameReceipts } from './receipts.mjs';

export async function renderStills({ root, dir, file = null, times, outDir, tts = null, captionOverride = null, log = console.log }) {
  const engineDir = getEngineDir(root);
  const assetsDir = path.join(root, 'assets');

  const built = await buildProject({ root, dir, file, tts, captionOverride, write: false, receipts: true });
  if (!built.ok) {
    return { ok: false, report: built.report, files: [] };
  }

  const targetDir = outDir || path.join(dir, 'review', 'stills');
  mkdirSync(targetDir, { recursive: true });

  const assetBasenameMap = buildAssetBasenameMap({ assetsDir });
  const { server, port } = await createStaticServer({ ENGINE_DIR: engineDir, ASSETS_DIR: assetsDir, JOB_DIR: path.join(dir, 'out') });
  const base = `http://127.0.0.1:${port}`;
  const composition = rewriteLocalRefs(structuredClone(built.composition), base, assetBasenameMap);

  const files = [];
  const receipts = [];
  const pageErrors = [];
  let session = null;

  try {
    session = await openPreviewSession({
      base,
      composition,
      onPageError: (message) => pageErrors.push(message),
    });
    const duration = session.duration;

    for (const time of times) {
      if (duration && time > duration) {
        log(`  ! t=${time}s 超出片长 ${duration.toFixed(2)}s，跳过`);
        continue;
      }
      await session.resetReceipts();
      const shot = await session.captureAt(time, { image: true });
      const file = path.join(targetDir, `t${time.toFixed(2)}s.png`);
      writeFileSync(file, Buffer.from(shot.image.split(',')[1], 'base64'));
      files.push(file);

      const entries = mergeFrameReceipts(await session.receipts(), time);
      receipts.push(...entries);
      log(`  t=${time}s → ${path.basename(file)}（${entries.length} 条凭据）`);
    }
  } finally {
    await session?.close();
    server.close();
  }

  return { ok: true, report: built.report, composition: built.composition, files, receipts, pageErrors };
}
