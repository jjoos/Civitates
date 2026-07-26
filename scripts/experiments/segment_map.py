"""Extract the canal/moat network and building blocks from a coloured
historical town plan by ink colour.

Works well on the Van Deventer 1560 lithograph, where water is drawn in cool
grey-blue and building blocks in warm orange. Produces binary masks usable as
input to registration, tracing, or visual overlays.

    python3 scripts/experiments/segment_map.py <image.jpg> <out-prefix>

Writes <prefix>-water.png, <prefix>-built.png and <prefix>-compare.png.
"""
import sys
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

WARM_MIN = 90    # R-B above this = orange building ink
COOL_MAX = 45    # R-B below this = cool/neutral
LUM_MAX = 175    # ...and dark enough to be ink rather than paper


def segment(path):
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    rb = rgb[..., 0] - rgb[..., 2]
    lum = rgb.mean(2)
    built = rb > WARM_MIN
    water = ndi.binary_closing((rb < COOL_MAX) & (lum < LUM_MAX), iterations=2)
    return rgb, water, built


def main(path, prefix):
    rgb, water, built = segment(path)
    Image.fromarray((water * 255).astype(np.uint8)).save(f"{prefix}-water.png")
    Image.fromarray((built * 255).astype(np.uint8)).save(f"{prefix}-built.png")

    vis = np.full(rgb.shape, 255, np.uint8)
    vis[built] = (220, 60, 40)
    vis[water] = (30, 90, 200)
    h = rgb.shape[0] // 2
    w = int(rgb.shape[1] * h / rgb.shape[0])
    side = np.concatenate([
        np.asarray(Image.fromarray(rgb.astype(np.uint8)).resize((w, h))),
        np.asarray(Image.fromarray(vis).resize((w, h))),
    ], axis=1)
    Image.fromarray(side).save(f"{prefix}-compare.png")
    print(f"water {100 * water.mean():.1f}%  built {100 * built.mean():.1f}%")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
