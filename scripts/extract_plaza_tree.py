from pathlib import Path
from PIL import Image
import numpy as np
import cv2

SRC = Path('assets/Arboleskelo1.PNG')
OUT = Path('assets/plaza-tree-large-v1.png')

# Exact source region of tree_large_v1 in the uploaded Kelo asset sheet.
LEFT, TOP, RIGHT, BOTTOM = 965, 20, 1195, 260

im = Image.open(SRC).convert('RGB')
assert im.size == (1536, 1024), im.size
crop = np.array(im.crop((LEFT, TOP, RIGHT, BOTTOM)))

# Remove only the baked background. RGB pixels of the asset are never redrawn.
bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)
mask = np.zeros(bgr.shape[:2], np.uint8)
bgd = np.zeros((1, 65), np.float64)
fgd = np.zeros((1, 65), np.float64)
rect = (8, 4, bgr.shape[1] - 16, bgr.shape[0] - 8)
cv2.grabCut(bgr, mask, rect, bgd, fgd, 8, cv2.GC_INIT_WITH_RECT)
fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

# Keep the main connected component only, removing background remnants.
num, labels, stats, _ = cv2.connectedComponentsWithStats((fg > 0).astype(np.uint8), 8)
assert num > 1, 'tree segmentation failed'
largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
fg = np.where(labels == largest, 255, 0).astype(np.uint8)

rgba = np.dstack([crop, fg])
out = Image.fromarray(rgba, 'RGBA')
bbox = out.getchannel('A').getbbox()
assert bbox, 'empty alpha mask'
out = out.crop(bbox)
out.save(OUT, 'PNG', optimize=True)

print('PASS extracted', OUT, out.size)
assert out.size == (191, 229), out.size
