import assert from 'node:assert/strict';
import test from 'node:test';
import { chromiumArgs } from './chromium-args.mjs';

const swiftshader = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

test('普通 Chrome 未配置时保持本机 GPU 路径', () => {
  assert.deepEqual(chromiumArgs({}), ['--enable-features=MediaCodec']);
  assert.deepEqual(chromiumArgs({ TICKTOON_CHROME_PATH: 'C:/Chrome/chrome.exe' }), ['--enable-features=MediaCodec']);
});

test('chrome-headless-shell 未配置时自动使用 SwiftShader', () => {
  for (const key of ['TICKTOON_CHROME_PATH', 'CHROME_PATH']) {
    const args = chromiumArgs({ [key]: 'C:/chromium_headless_shell-1223/chrome-headless-shell.exe' });
    assert.deepEqual(args, ['--enable-features=MediaCodec', ...swiftshader]);
  }
});

test('显式 DH_VIDEO_WEBGL 优先于可执行文件自动检测', () => {
  const env = {
    TICKTOON_CHROME_PATH: 'C:/chrome-headless-shell-win64/chrome-headless-shell.exe',
    DH_VIDEO_WEBGL: 'auto',
  };
  assert.deepEqual(chromiumArgs(env), ['--enable-features=MediaCodec']);
});

test('非法 WebGL 配置仍然报错', () => {
  assert.throws(() => chromiumArgs({ DH_VIDEO_WEBGL: 'disable-gpu' }), /DH_VIDEO_WEBGL/);
});
