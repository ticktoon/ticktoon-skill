/**
 * 诊断收集：一次跑完全部规则，把错误攒起来再报。
 *
 * 逐个抛错对 LLM 最不友好——它改一处、再跑一次、再撞下一处。
 * 一次给全，它才能一轮改对。所以这里只有 `add`，没有 `throw`。
 */
export class Bag {
  constructor(limit = 40) {
    this.errors = [];
    this.warnings = [];
    this.limit = limit;
  }

  error(code, path, msg) {
    if (this.errors.length < this.limit) this.errors.push({ level: 'must', code, path, msg });
  }

  /** level: must | should | nice —— must/should 给 agent 看，nice 只进 report。 */
  warn(level, code, path, msg) {
    this.warnings.push({ level, code, path, msg });
  }

  get ok() {
    return this.errors.length === 0;
  }

  summary() {
    return { errors: this.errors.length, warnings: this.warnings.length };
  }
}

export const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const round3 = (v) => Math.round(v * 1000) / 1000;
