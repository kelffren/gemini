from pathlib import Path
from PIL import Image
import numpy as np
import cv2

SRC = Path('assets/Arboleskelo1.PNG')
OUT = Path('assets/plaza-tree-large-v1.png')

# Exact source region of the large green tree in the user-uploaded Arboleskelo1 pack.
LEFT, TOP, RIGHT, BOTTOM = 10, 20, 440, 550

im = Image.open(SRC).convert('RGB')
assert im.size == (1536, 1024), im.size
crop = np.array(im.crop((LEFT, TOP, RIGHT, BOTTOM)))
h, w, _ = crop.shape
bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)

# Start from probable background, then seed only obvious tree regions.
# This removes the baked presentation background without redrawing the asset RGB.
mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
mask[:20, :] = cv2.GC_BGD
mask[-20:, :] = cv2.GC_BGD
mask[:, :20] = cv2.GC_BGD
mask[:, -20:] = cv2.GC_BGD

# Probable foreground: full tree silhouette area.
cv2.ellipse(mask, (215, 170), (190, 150), 0, 0, 360, cv2.GC_PR_FGD, -1)
trunk_poly = np.array([[120,240],[300,240],[310,445],[280,505],[140,505],[100,445]], np.int32)
cv2.fillPoly(mask, [trunk_poly], cv2.GC_PR_FGD)

# Definite foreground seeds on unmistakable canopy/trunk/base pixels.
for cx,cy,rx,ry in [
    (210,120,80,60),
    (120,180,45,45),
    (305,190,45,45),
    (220,280,30,45),
    (205,365,35,70),
    (190,455,70,30),
]:
    cv2.ellipse(mask, (cx,cy), (rx,ry), 0, 0, 360, cv2.GC_FGD, -1)

bgd = np.zeros((1,65), np.float64)
fgd = np.zeros((1,65), np.float64)
cv2.grabCut(bgr, mask, None, bgd, fgd, 10, cv2.GC_INIT_WITH_MASK)
alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

# Keep meaningful tree components only; tiny presentation-background fragments are discarded.
num, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0).astype(np.uint8), 8)
assert num > 1, 'tree segmentation failed'
order = sorted(range(1, num), key=lambda i: int(stats[i, cv2.CC_STAT_AREA]), reverse=True)
keep = np.zeros((h, w), dtype=bool)
for i in order[:12]:
    if int(stats[i, cv2.CC_STAT_AREA]) >= 50:
        keep |= labels == i
alpha = np.where(keep, 255, 0).astype(np.uint8)

out = Image.fromarray(np.dstack([crop, alpha]), 'RGBA')
bbox = out.getchannel('A').getbbox()
assert bbox, 'empty alpha mask'
out = out.crop(bbox)

# Guard against a partial extraction.
assert out.width >= 340 and out.height >= 450, out.size
out.save(OUT, 'PNG', optimize=True)
print('PASS extracted', OUT, out.size)
