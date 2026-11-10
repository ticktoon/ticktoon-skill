/**
 * 凭证管理命令行
 *
 * 用法:
 *   node scripts/auth.mjs                      # 列出所有凭证状态（不显示值）
 *   node scripts/auth.mjs set <KEY> <value>    # 写入 ~/.dh-video/credentials.json
 *   node scripts/auth.mjs unset <KEY>          # 删除
 *
 * 优先级：环境变量 > credentials.json（env 存在时 set 不会覆盖 env 的效果）
 */
import { CRED_FILE, CREDENTIAL_KEYS, credentialSource, hasCredential, saveCredential } from './config.mjs';

const [cmd, key, ...rest] = process.argv.slice(2);

if (cmd === 'set' && key && rest.length) {
  saveCredential(key, rest.join(' '));
  console.log(`已写入 ${key} → ${CRED_FILE}${process.env[key] ? '\n⚠️ 环境变量同名键存在，优先生效的是环境变量' : ''}`);
} else if (cmd === 'unset' && key) {
  saveCredential(key, null);
  console.log(`已删除 ${key}`);
} else if (!cmd) {
  console.log(`凭证文件: ${CRED_FILE}\n`);
  for (const [name, meta] of Object.entries(CREDENTIAL_KEYS)) {
    const src = credentialSource(name);
    console.log(`${src ? '✅' : '⬜'} ${name}  [${meta.usedBy}]  ${src ? `来源: ${src}` : '未配置'}\n   ${meta.desc}`);
  }
  console.log('\n自定义键也可以 set，供 fork 的 provider 读取（getCredential 不限制键名）。');
} else {
  console.error('用法: node scripts/auth.mjs [set <KEY> <value> | unset <KEY>]');
  process.exit(1);
}
