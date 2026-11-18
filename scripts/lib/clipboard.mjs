import { spawnSync } from 'node:child_process';

/** 通过系统剪贴板写入文本，避开内置浏览器的 navigator.clipboard 权限限制。 */
export function setClipboardText(text) {
  let command;
  let args;
  if (process.platform === 'win32') {
    command = 'powershell.exe';
    args = ['-NoProfile', '-Command', '$input | Set-Clipboard'];
  } else if (process.platform === 'darwin') {
    command = 'pbcopy';
    args = [];
  } else {
    command = 'xclip';
    args = ['-selection', 'clipboard'];
  }
  const result = spawnSync(command, args, {
    input: String(text),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 8000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `系统剪贴板写入失败（退出码 ${result.status}）`);
}
