from pathlib import Path
from PIL import Image
import numpy as np
import cv2

SRC = Path('assets/Arboleskelo1.PNG')
OUT = Path('assets/plaza-tree-large-v1.png')

# Source cell containing the large green tree in Arboleskelo1. The crop is kept at
# its full authored cell size so rocks, flowers, roots and shadows cannot be lost
# merely because they are disconnected from the main trunk/canopy silhouette.
LEFT, TOP, RIGHT, BOTTOM = 10, 20, 440, 550
FRAME_W, FRAME_H = RIGHT - LEFT, BOTTOM - TOP

im = Image.open(SRC).convert('RGB')
assert im.size == (1536, 1024), im.size
rgb = np.array(im.crop((LEFT, TOP, RIGHT, BOTTOM)))
h, w, _ = rgb.shape
assert (w, h) == (FRAME_W, FRAME_H)

# Estimate the presentation background from the outer frame. This is deliberately
# data-driven instead of hand-drawing a tree-shaped mask.
border = np.concatenate([
    rgb[:12, :, :].reshape(-1, 3),
    rgb[-12:, :, :].reshape(-1, 3),
    rgb[:, :12, :].reshape(-1, 3),
    rgb[:, -12:, :].reshape(-1, 3),
], axis=0).astype(np.float32)
bg = np.median(border, axis=0)
dist = np.linalg.norm(rgb.astype(np.float32) - bg[None, None, :], axis=2)

# Two-level threshold keeps antialiased/pale edge pixels while still rejecting the
# near-uniform sheet background. Morphology then reconnects tiny authored gaps.
core = (dist >= 30).astype(np.uint8)
soft = (dist >= 12).astype(np.uint8)
core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)

num, labels, stats, centroids = cv2.connectedComponentsWithStats(core, 8)
assert num > 1, 'foreground segmentation failed'

# The large tree is the dominant component in this source cell. Instead of keeping
# only that component, expand around it and absorb nearby authored components so
# decorative stones, flowers, roots and ground shadow remain part of the sprite.
main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
mx, my, mw, mh, ma = stats[main]
assert ma > 15000, ('unexpected main component', int(ma))

main_mask = (labels == main).astype(np.uint8)
proximity = cv2.dilate(main_mask, np.ones((39, 39), np.uint8), iterations=1)
keep = main_mask.astype(bool)

for i in range(1, num):
    if i == main:
        continue
    x, y, cw, ch, area = stats[i]
    if area < 18:
        continue
    component = labels == i
    # Keep pieces touching the expanded silhouette OR living directly beneath the
    # trunk/base within the authored base band. This is the important protection
    # against the previously clipped rocks and flowers.
    near_main = bool(np.any(proximity[component]))
    cx, cy = centroids[i]
    in_base_band = (mx - 45 <= cx <= mx + mw + 45 and my + int(mh * 0.66) <= cy <= h - 8)
    if near_main or in_base_band:
        keep |= component

# Grow selected components into the soft antialias mask; this preserves edge pixels
# without pulling distant neighbouring assets into the frame.
expanded = cv2.dilate(keep.astype(np.uint8), np.ones((7, 7), np.uint8), iterations=1).astype(bool)
keep |= expanded & (soft > 0)
alpha = np.where(keep, 255, 0).astype(np.uint8)

# Clear only the absolute outer edge. The image remains the full authored source
# cell (430x530), with transparent padding rather than a destructive tight crop.
alpha[:2, :] = 0
alpha[-2:, :] = 0
alpha[:, :2] = 0
alpha[:, -2:] = 0

# Regression guards: require foreground low in the base region and meaningful
# content in both lower corners of the tree footprint. A future extraction that
# loses the decorative base must fail CI instead of silently shipping.
ys, xs = np.where(alpha > 0)
assert len(xs) > 20000, len(xs)
assert ys.max() >= h - 55, ('base clipped', int(ys.max()), h)
base_pixels = int(np.count_nonzero(alpha[int(h * 0.72):, :]))
assert base_pixels >= 2200, ('insufficient base detail', base_pixels)

out = Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')
out.save(OUT, 'PNG', optimize=True)
print('PASS complete authored tree frame', OUT, out.size, 'bg=', tuple(int(v) for v in bg), 'base_pixels=', base_pixels)
