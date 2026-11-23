# TT.anatomy · 真实解剖模型

`TT.anatomy` 提供一套真实建模的人体外壳与器官，替代用球体、圆柱拼出来的人体。数据来自 BodyParts3D 4.0，已减面并量化，随 kit 内联；没有网络请求，也没有运行时下载。

## 坐标与部位

- Y 轴向上，脚底 `y = 0`，身高 `TT.anatomy.height`（3.8 世界单位）。
- 外壳与器官共享同一坐标系，相对位置就是解剖位置。不要重设比例或挪动器官来"让画面好看"。
- 可用部位：`body`（完整皮肤，含头颈）、`brain`、`heart`、`liver`、`stomach`、`kidneys`、`airways`（气管与双侧支气管树）。

## API

| 成员 | 返回 | 说明 |
|---|---|---|
| `TT.anatomy.parts` | `string[]` | 可用部位名 |
| `TT.anatomy.height` | `number` | 人体总高（世界单位） |
| `TT.anatomy.geometry(T, part)` | `BufferGeometry` | 部位几何，含 position / index / 法线；首次调用解码，之后缓存 |
| `TT.anatomy.mesh(T, part, material)` | `Mesh` | 用共享几何造网格，`mesh.name` 即部位名 |
| `TT.anatomy.bounds(part)` | `{ min, max, center, size }` | 部位包围盒（世界单位） |
| `TT.anatomy.center(part)` | `[x, y, z]` | 部位中心，直接当相机注视点 |

`T` 是 `api.THREE`。几何只能在本场 setup 阶段创建；`geometry()` 自带缓存，同一个部位多次调用拿到同一个对象，不要在每帧里重新解码。

## 用法

```js
const layer = api.three({ rect: { x: 0, y: 0, width: W * 0.5, height: H } });
const T = api.THREE;

const shell = new T.MeshStandardMaterial({
  color: '#A8D4EA', transparent: true, opacity: 0.18, roughness: 0.6, depthWrite: false,
});
const root = new T.Group();
root.add(TT.anatomy.mesh(T, 'body', shell));
root.add(TT.anatomy.mesh(T, 'heart', new T.MeshStandardMaterial({ color: '#E86A78', roughness: 0.55 })));
layer.scene.add(root);

const heart = TT.anatomy.center('heart');
layer.camera.position.set(heart[0] + 0.9, heart[1] + 0.2, heart[2] + 2.2);
layer.camera.lookAt(heart[0], heart[1], heart[2]);
```

- 外壳（`body`）必须用 `transparent` + `depthWrite: false`，器官才不会被皮肤挡住。
- 器官材质由场景决定：颜色、粗糙度都属于视觉规范，kit 不预设。`brain` 单独一份材质，镜头推进时可以只淡掉它。
- `airways` 是气道树，不是肺实质：BodyParts3D 没有肺叶表面网格。需要讲呼吸时，用气道树讲通路，肺泡层面的气体交换交给二维示意图，不要声称这是"肺"的完整外形。
- 相机默认 `fov 38`（`api.three({ fov })` 可改）。按 `bounds('body').size[1]` 推距离：可见高度 ≈ `0.689 × 距目标距离`。

## 署名

BodyParts3D 采用 CC BY 4.0：使用本 kit 的成片必须在片尾或说明中保留署名——

> BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution 4.0 International

`anatomy.data.js` 由 `scripts/tools/build-anatomy.py` 从 BodyParts3D 4.0 的 ISA 归档生成（合并 compound 器官 → 减面 → int16 量化），需要 `numpy` 与 `open3d`；改动模型来源或面数预算时重跑脚本，不要手改数据文件。

## 边界

- 只用于科普表达，不支持手术级解剖精度，也不提供病理、诊断或治疗建议。
- 部位是整体网格：没有逐块骨骼、血管、神经，也没有可用于标注的子结构锚点。需要标注时用 `bounds` / `center` 定位，不要假装有子结构。
- 没有肺实质、没有肠道与骨骼；`airways` 之外的呼吸系统结构都用二维示意图表达。
- 模型是成年人体型，没有性别与年龄变体。
