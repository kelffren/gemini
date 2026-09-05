from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def estimate_background(rgb: np.ndarray, border: int = 12) -> np.ndarray:
    strips = np.concatenate([
        rgb[:border].reshape(-1, 3),
        rgb[-border:].reshape(-1, 3),
        rgb[:, :border].reshape(-1, 3),
        rgb[:, -border:].reshape(-1, 3),
    ], axis=0).astype(np.float32)
    return np.median(strips, axis=0)


def alpha_from_background(rgb: np.ndarray, bg: np.ndarray, soft: float, core: float) -> np.ndarray:
    dist = np.linalg.norm(rgb.astype(np.float32) - bg[None, None, :], axis=2)
    alpha = np.clip((dist - soft) / max(1.0, core - soft), 0.0, 1.0) * 255.0
    return alpha.astype(np.uint8), dist


def boxes_touch(a, b, gap: int) -> bool:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return not (ax2 + gap < bx1 or bx2 + gap < ax1 or ay2 + gap < by1 or by2 + gap < ay1)


def union_box(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def merge_boxes(boxes, gap: int):
    boxes = list(boxes)
    changed = True
    while changed:
        changed = False
        out = []
        while boxes:
            current = boxes.pop(0)
            i = 0
            while i < len(boxes):
                if boxes_touch(current, boxes[i], gap):
                    current = union_box(current, boxes.pop(i))
                    changed = True
                else:
                    i += 1
            out.append(current)
        boxes = out
    return boxes


def expand_box(box, margin, width, height):
    x1, y1, x2, y2 = box
    return (
        max(0, x1 - margin),
        max(0, y1 - margin),
        min(width, x2 + margin),
        min(height, y2 + margin),
    )


def row_sort(boxes):
    # Geometry-only ordering. Tall top-row trees are naturally grouped before lower props.
    return sorted(boxes, key=lambda b: (round(b[1] / 90), b[0], b[1]))


def assign_names(boxes):
    named = {}
    top_trees = [b for b in boxes if (b[3] - b[1]) >= 250 and b[1] < 300]
    top_trees = sorted(top_trees, key=lambda b: b[0])
    preferred = ['tree_large', 'tree_pink', 'tree_medium', 'tree_cypress', 'tree_small']
    used = set()
    for name, box in zip(preferred, top_trees[:5]):
        named[name] = box
        used.add(box)
    n = 1
    for box in row_sort(boxes):
        if box in used:
            continue
        while f'sprite_{n:02d}' in named:
            n += 1
        named[f'sprite_{n:02d}'] = box
        n += 1
    return named


def main():
    p = argparse.ArgumentParser(description='Detect irregular sprites in a presentation sheet and emit reusable atlas metadata.')
    p.add_argument('source')
    p.add_argument('--atlas', required=True)
    p.add_argument('--json', required=True)
    p.add_argument('--js', required=True)
    p.add_argument('--preview', required=True)
    p.add_argument('--margin', type=int, default=14)
    p.add_argument('--merge-gap', type=int, default=16)
    p.add_argument('--soft-threshold', type=float, default=8.0)
    p.add_argument('--core-threshold', type=float, default=28.0)
    p.add_argument('--min-component-area', type=int, default=20)
    args = p.parse_args()

    src = Path(args.source)
    rgba_out = Path(args.atlas)
    json_out = Path(args.json)
    js_out = Path(args.js)
    preview_out = Path(args.preview)
    for out in [rgba_out, json_out, js_out, preview_out]:
        out.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(src).convert('RGB')
    rgb = np.array(image)
    h, w = rgb.shape[:2]
    bg = estimate_background(rgb)
    alpha, dist = alpha_from_background(rgb, bg, args.soft_threshold, args.core_threshold)

    # Detection uses solid foreground, but output alpha keeps antialiased edge pixels.
    core = (dist >= args.core_threshold).astype(np.uint8)
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(core, 8)

    raw_boxes = []
    for i in range(1, count):
        x, y, cw, ch, area = [int(v) for v in stats[i]]
        if area < args.min_component_area:
            continue
        raw_boxes.append((x, y, x + cw, y + ch))

    # Proximity grouping is the core rule: decorative stones/flowers/roots remain with
    # their parent object instead of being dropped because they are disconnected pixels.
    merged = merge_boxes(raw_boxes, args.merge_gap)
    merged = [expand_box(b, args.margin, w, h) for b in merged]
    merged = [b for b in merged if (b[2] - b[0]) >= 16 and (b[3] - b[1]) >= 16]

    names = assign_names(merged)
    if 'tree_large' not in names:
        raise SystemExit('IMPORT_FAIL tree_large was not detected automatically')

    tree = names['tree_large']
    tw, th = tree[2] - tree[0], tree[3] - tree[1]
    if tw < 300 or th < 350:
        raise SystemExit(f'IMPORT_FAIL tree_large bounds too small: {tw}x{th}')

    cleaned = Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')
    cleaned.save(rgba_out, 'PNG', optimize=True)

    frames = {}
    for name, (x1, y1, x2, y2) in names.items():
        fw, fh = x2 - x1, y2 - y1
        frames[name] = {
            'x': x1, 'y': y1, 'w': fw, 'h': fh,
            'anchor': {'x': round(fw * 0.5), 'y': max(0, fh - 4)},
            'footprint': {'w': max(16, round(fw * 0.34)), 'h': max(12, round(fh * 0.10))},
        }

    meta = {
        'version': 'kelo-irregular-atlas-v1',
        'source': src.as_posix(),
        'atlas': rgba_out.as_posix(),
        'width': w,
        'height': h,
        'background': [round(float(v), 2) for v in bg],
        'detection': {
            'softThreshold': args.soft_threshold,
            'coreThreshold': args.core_threshold,
            'mergeGap': args.merge_gap,
            'margin': args.margin,
            'minComponentArea': args.min_component_area,
        },
        'frames': frames,
    }
    json_out.write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
    js_out.write_text(
        "window.KELO_ARBOL_1_ATLAS_META=Object.freeze(" + json.dumps(meta, separators=(',', ':')) + ");\n",
        encoding='utf-8',
    )

    preview = image.copy()
    draw = ImageDraw.Draw(preview)
    font = ImageFont.load_default()
    for idx, (name, f) in enumerate(frames.items(), 1):
        x1, y1, x2, y2 = f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']
        draw.rectangle((x1, y1, x2, y2), outline=(255, 0, 0), width=3)
        label = f'{idx:02d} {name}'
        tb = draw.textbbox((x1 + 4, y1 + 4), label, font=font)
        draw.rectangle((tb[0] - 2, tb[1] - 2, tb[2] + 2, tb[3] + 2), fill=(255, 255, 255))
        draw.text((x1 + 4, y1 + 4), label, fill=(0, 0, 0), font=font)
    preview.save(preview_out, 'PNG', optimize=True)

    print('IMPORT_OK', src, 'sprites=', len(frames), 'tree_large=', frames['tree_large'])


if __name__ == '__main__':
    main()
