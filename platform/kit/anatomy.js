/**
 * TT.anatomy —— 真实解剖模型：人体皮肤外壳与脑、心、肝、胃、双肾、气道树。
 *
 * 模型来自 BodyParts3D 4.0（DBCLS），经减面 + int16 量化后随 kit 内联
 * （platform/kit/anatomy.data.js，由 scripts/tools/build-anatomy.py 生成）。
 * 坐标统一：Y 轴向上、脚底 y = 0、身高 TT.anatomy.height；外壳与所有器官共享
 * 同一坐标系，镜头用 TT.anatomy.center('heart') 定位即可，不要手填魔法数字。
 *
 * 几何在第一次调用时解码并计算法线，之后按部位缓存：3D 对象必须跨帧复用。
 * 缓存按 THREE 实例区分，同一场景换 api.THREE 不会串用旧几何。
 *
 * 许可：BodyParts3D, © The Database Center for Life Science, CC BY 4.0。
 * 用到本 kit 的成片需要在片尾或说明里保留该署名。
 */
(() => {
  const DATA = __TT_ANATOMY;
  const PARTS = Object.keys(DATA.parts);
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const LUT = new Uint8Array(128);
  for (let i = 0; i < LUT.length; i += 1) LUT[i] = 255;
  for (let i = 0; i < B64.length; i += 1) LUT[B64.charCodeAt(i)] = i;

  const cache = {};

  function partOf(part) {
    const spec = DATA.parts[part];
    if (!spec) {
      throw new Error('TT.anatomy 没有部位 "' + part + '"（可用：' + PARTS.join(' / ') + '）');
    }
    return spec;
  }

  /** base64 → 字节。自带解码器，不依赖宿主的 atob / Buffer。 */
  function decode(text) {
    let count = 0;
    for (let i = 0; i < text.length; i += 1) {
      if (LUT[text.charCodeAt(i)] !== 255) count += 1;
    }
    const out = new Uint8Array(count * 3 >> 2);
    let acc = 0;
    let bits = 0;
    let at = 0;
    for (let i = 0; i < text.length; i += 1) {
      const v = LUT[text.charCodeAt(i)];
      if (v === 255) continue;
      acc = ((acc << 6) | v) & 0xffffff;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out[at] = (acc >> bits) & 255;
        at += 1;
      }
    }
    return out;
  }

  const int16 = (bytes) => {
    const out = new Int16Array(bytes.length >> 1);
    for (let i = 0; i < out.length; i += 1) {
      const v = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
      out[i] = v > 0x7fff ? v - 0x10000 : v;
    }
    return out;
  };

  const uint16 = (bytes) => {
    const out = new Uint16Array(bytes.length >> 1);
    for (let i = 0; i < out.length; i += 1) {
      out[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
    }
    return out;
  };

  /** 部位几何：延迟解码 + 缓存，返回 BufferGeometry（含 position / index / 法线）。 */
  function geometry(T, part) {
    const hit = cache[part];
    if (hit && hit.T === T) return hit.geometry;
    const spec = partOf(part);
    const q = int16(decode(spec.pos));
    const pos = new Float32Array(q.length);
    const step = DATA.step;
    const [ox, oy, oz] = DATA.origin;
    for (let i = 0; i < q.length; i += 3) {
      pos[i] = q[i] * step + ox;
      pos[i + 1] = q[i + 1] * step + oy;
      pos[i + 2] = q[i + 2] * step + oz;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setIndex(new T.BufferAttribute(uint16(decode(spec.idx)), 1));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    cache[part] = { T, geometry: geo };
    return geo;
  }

  /** 部位网格：几何共享，材质由场景给；name 写成部位名，便于按名字找对象。 */
  function mesh(T, part, material) {
    const m = new T.Mesh(geometry(T, part), material);
    m.name = part;
    return m;
  }

  /** 部位包围盒（世界单位）。center 可直接当相机注视点。 */
  function bounds(part) {
    const b = partOf(part).bounds;
    return {
      min: [b[0], b[1], b[2]],
      max: [b[3], b[4], b[5]],
      center: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2],
      size: [b[3] - b[0], b[4] - b[1], b[5] - b[2]],
    };
  }

  TT.anatomy = {
    parts: PARTS,
    height: DATA.height,
    geometry,
    mesh,
    bounds,
    center: (part) => bounds(part).center,
  };
})();
