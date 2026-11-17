/**
 * 渲染、抽帧与环境自检共用的 Chrome 启动参数。
 * 普通 Chrome 默认保持本机 GPU；chrome-headless-shell 的 Canvas→WebCodecs
 * GPU 纹理回读在部分 Windows 环境会失败，因此未显式配置时默认使用 SwiftShader。
 */
export function chromiumArgs(env = process.env) {
  const args = ['--enable-features=MediaCodec'];
  const executable = env.TICKTOON_CHROME_PATH || env.CHROME_PATH || '';
  const defaultWebgl = /headless[-_]?shell/i.test(executable) ? 'swiftshader' : 'auto';
  const webgl = String(env.DH_VIDEO_WEBGL || defaultWebgl).toLowerCase();
  if (!['auto', 'swiftshader'].includes(webgl)) {
    throw new Error(`DH_VIDEO_WEBGL 仅支持 auto / swiftshader，当前为 ${webgl}`);
  }
  if (webgl === 'swiftshader') {
    args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  }
  return args;
}
