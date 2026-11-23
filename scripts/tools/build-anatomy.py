"""Build platform/kit/anatomy.data.js from the extracted BodyParts3D 4.0 ISA archive.

Usage: python build_anatomy.py <work-dir> <out-js>

<work-dir> must contain:
  isa/isa_BP3D_4.0_obj_99/*.obj     extracted ISA archive
  isa_objmap.json                   file / rep / name, one row per member
  partof_element_parts.txt          compound organ -> element file ids
  isa_element_parts.txt             same, ISA flavour

BodyParts3D only ships ELEMENT meshes: whole organs are COMPOUND and must be
assembled from their element list. Lungs have no parenchyma surface in this
dataset, so 'airways' keeps the bronchial trees only.
"""
import base64
import json
import os
import sys
import time

import numpy as np
import open3d as o3d

HEIGHT = 3.8  # world units for a full adult body

# part -> how to collect its element files
PARTS = {
    'body': {'groups': ['skin']},
    'brain': {
        'groups': ['segment of brain'],
        'files': ['FJ1781', 'FJ1770', 'FJ1775', 'FJ1769', 'FJ1758', 'FJ1806'],
    },
    'heart': {'groups': ['heart']},
    'liver': {'groups': ['liver']},
    'stomach': {'groups': ['stomach']},
    'kidneys': {'groups': ['right kidney', 'left kidney']},
    'airways': {'groups': ['right lung', 'left lung'], 'name_has': 'bronchial tree'},
}

# triangle budget per part after decimation
TARGET = {
    'body': 11000,
    'brain': 4500,
    'heart': 3500,
    'liver': 2500,
    'stomach': 900,
    'kidneys': 1200,
    'airways': 5500,
}


def read_groups(path):
    groups = {}
    with open(path, encoding='utf-8') as fh:
        rows = [line.rstrip('\n').split('\t') for line in fh if line.strip()]
    for row in rows[1:]:
        if len(row) >= 3:
            groups.setdefault(row[1], []).append(row[2])
    return groups


def load_obj(path):
    verts = []
    faces = []
    with open(path, 'r', encoding='utf-8', errors='replace') as fh:
        for line in fh:
            if line.startswith('v '):
                parts = line.split()
                verts.append((float(parts[1]), float(parts[2]), float(parts[3])))
            elif line.startswith('f '):
                idx = []
                for token in line.split()[1:]:
                    n = int(token.split('/')[0])
                    idx.append(n - 1 if n > 0 else len(verts) + n)
                for i in range(1, len(idx) - 1):
                    faces.append((idx[0], idx[i], idx[i + 1]))
    return np.asarray(verts, dtype=np.float64), np.asarray(faces, dtype=np.int32)


def merge(paths):
    vs, fs, base = [], [], 0
    for p in paths:
        v, f = load_obj(p)
        if len(f) == 0:
            continue
        vs.append(v)
        fs.append(f + base)
        base += len(v)
    return np.vstack(vs), np.vstack(fs)


def to_open3d(verts, faces):
    mesh = o3d.geometry.TriangleMesh(
        o3d.utility.Vector3dVector(verts),
        o3d.utility.Vector3iVector(faces.astype(np.int32)),
    )
    mesh.remove_duplicated_vertices()
    mesh.remove_degenerate_triangles()
    return mesh


def decimate(verts, faces, target):
    mesh = to_open3d(verts, faces)
    before = len(mesh.triangles)
    if before > target:
        try:
            mesh = mesh.simplify_quadric_decimation(target_number_of_triangles=target)
        except TypeError:
            mesh = mesh.simplify_quadric_decimation(target)
        mesh.remove_unreferenced_vertices()
    return np.asarray(mesh.vertices), np.asarray(mesh.triangles), before


def rot_x_neg90(v):
    """Z-up (BodyParts3D) -> Y-up: (x, y, z) -> (x, z, -y)."""
    return np.column_stack((v[:, 0], v[:, 2], -v[:, 1]))


def flip_y(v):
    """180 deg around Y: (x, y, z) -> (-x, y, -z). Keeps handedness."""
    return np.column_stack((-v[:, 0], v[:, 1], -v[:, 2]))


def resolve_files(groups_map, spec, name_of):
    ids = []
    for group in spec.get('groups', []):
        if group not in groups_map:
            raise SystemExit('missing compound group: ' + group)
        ids.extend(groups_map[group])
    ids.extend(spec.get('files', []))
    seen = []
    for f in ids:
        if f not in seen:
            seen.append(f)
    key = spec.get('name_has')
    if key:
        seen = [f for f in seen if key in name_of.get(f, '').lower()]
    return seen


def main():
    work, out_path = sys.argv[1], sys.argv[2]
    root = os.path.join(work, 'isa', 'isa_BP3D_4.0_obj_99')
    objmap = json.load(open(os.path.join(work, 'isa_objmap.json'), encoding='utf-8'))
    name_of = {row['file'].split('.')[0]: row['name'] for row in objmap}
    groups_map = read_groups(os.path.join(work, 'isa_element_parts.txt'))
    groups_map.update(read_groups(os.path.join(work, 'partof_element_parts.txt')))

    raw = {}
    for part, spec in PARTS.items():
        files = resolve_files(groups_map, spec, name_of)
        missing = [f for f in files if not os.path.exists(os.path.join(root, f + '.obj'))]
        if missing:
            raise SystemExit('%s: missing %d files, e.g. %s' % (part, len(missing), missing[:4]))
        t0 = time.time()
        verts, faces = merge([os.path.join(root, f + '.obj') for f in files])
        raw[part] = (verts, faces)
        print('%-8s files=%4d raw tris=%8d  %.1fs'
              % (part, len(files), len(faces), time.time() - t0))

    # Orientation: Y-up first, then make sure the toes (anterior) point at +Z.
    for part, (verts, faces) in raw.items():
        raw[part] = (rot_x_neg90(verts), faces)

    skin = raw['body'][0]
    y0, y1 = skin[:, 1].min(), skin[:, 1].max()
    span = y1 - y0
    foot = skin[skin[:, 1] < y0 + 0.12 * span]
    calf = skin[(skin[:, 1] > y0 + 0.22 * span) & (skin[:, 1] < y0 + 0.45 * span)]
    forward = float(np.median(foot[:, 2]) - np.median(calf[:, 2]))
    print('toe offset %.1f mm -> anterior is %s Z' % (forward, '+' if forward > 0 else '-'))
    if forward < 0:
        for part, (verts, faces) in raw.items():
            raw[part] = (flip_y(verts), faces)
        skin = raw['body'][0]

    lo = skin.min(axis=0)
    hi = skin.max(axis=0)
    scale = HEIGHT / (hi[1] - lo[1])
    cx = (lo[0] + hi[0]) / 2
    cz = (lo[2] + hi[2]) / 2
    print('skin bbox x[%.0f %.0f] y[%.0f %.0f] z[%.0f %.0f] mm, scale %.6f'
          % (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2], scale))

    parts = {}
    for part, (verts, faces) in raw.items():
        v = verts.copy()
        v[:, 0] = (v[:, 0] - cx) * scale
        v[:, 1] = (v[:, 1] - lo[1]) * scale
        v[:, 2] = (v[:, 2] - cz) * scale
        t0 = time.time()
        dv, df, before = decimate(v, faces, TARGET[part])
        parts[part] = (dv, df)
        print('%-8s %7d -> %5d tris, %5d verts  %.1fs'
              % (part, before, len(df), len(dv), time.time() - t0))

    origin = [0.0, HEIGHT / 2, 0.0]
    max_abs = 0.0
    for verts, _ in parts.values():
        max_abs = max(max_abs, float(np.abs(verts - np.asarray(origin)).max()))
    step = max_abs / 32767.0
    print('quantize step %.6f, max_abs %.4f' % (step, max_abs))

    payload = {'version': 1, 'height': HEIGHT, 'step': step, 'origin': origin, 'parts': {}}
    total_tris = 0
    for part, (verts, faces) in parts.items():
        if len(verts) > 65535:
            raise SystemExit(part + ': too many vertices for uint16 index')
        q = np.rint((verts - np.asarray(origin)) / step)
        q = np.clip(q, -32767, 32767).astype('<i2')
        lo = verts.min(axis=0)
        hi = verts.max(axis=0)
        payload['parts'][part] = {
            'tris': int(len(faces)),
            'pos': base64.b64encode(q.tobytes()).decode('ascii'),
            'idx': base64.b64encode(faces.astype('<u2').tobytes()).decode('ascii'),
            'bounds': [round(float(x), 4) for x in
                       (lo[0], lo[1], lo[2], hi[0], hi[1], hi[2])],
        }
        total_tris += len(faces)

    body = json.dumps(payload, separators=(',', ':'), ensure_ascii=True)
    with open(out_path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('/**\n')
        fh.write(' * TT.anatomy 数据：BodyParts3D 4.0（DBCLS）器官网格，减面 + int16 量化。\n')
        fh.write(' * 由 scripts/tools/build-anatomy.py 生成，不要手改。\n')
        fh.write(' * BodyParts3D, © The Database Center for Life Science, CC BY 4.0.\n')
        fh.write(' */\n')
        fh.write('const __TT_ANATOMY = ' + body + ';\n')
    print('total %d tris, written %s  %.1f KB'
          % (total_tris, out_path, os.path.getsize(out_path) / 1024.0))


if __name__ == '__main__':
    main()
