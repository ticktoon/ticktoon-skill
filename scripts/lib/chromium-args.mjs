/**
 * 渲染、抽帧与环境自检共用的 Chrome 启动参数。
 * 默认保持本机 GPU 路径；无 GPU 的服务器可显式选择 SwiftShader 软件 WebGL。
 */
export function chromiumArgs(env = process.env) {
  const args = ['--enable-features=MediaCodec'];
  const webgl = String(env.DH_VIDEO_WEBGL || 'auto').toLowerCase();
  if (!['auto', 'swiftshader'].includes(webgl)) {
    throw new Error(`DH_VIDEO_WEBGL 仅支持 auto / swiftshader，当前为 ${webgl}`);
  }
  if (webgl === 'swiftshader') {
    args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  }
  return args;
}
