"""Render a proposed georeference over the historical scan so it can be judged
by eye. This is the step that matters: a 4-point fit on Van Deventer 1560
scored residuals of 0.9 px and 2.5 px on its two independent landmarks and was
still completely wrong — the overlay is what exposed it.

    python3 scripts/experiments/verify_fit.py data/georeferences/vandeventer-1560.json out.png

Needs >=2 control points in the record. Draws:
  * each control point, at the pixel position the fitted transform predicts
  * the modern canal network warped into the scan's pixel space

What a correct fit looks like: warped canals follow the drawn canals, and each
landmark lands on the feature it names (a harbour tower on the water, not
inland). Anything else means the fit is wrong regardless of its residuals.
"""
import json
import sys
import numpy as np
from PIL import Image, ImageDraw


def similarity_from_two(a_rd, a_px, b_rd, b_px):
    """Scale/rotation/offset fixed by two correspondences. RD is east/north,
    pixels are x-right/y-down, so north is flipped."""
    dW = np.asarray(b_rd) - np.asarray(a_rd)
    dP = np.asarray(b_px) - np.asarray(a_px)
    s = np.hypot(*dW) / np.hypot(*dP)
    th = np.arctan2(dW[1], dW[0]) - np.arctan2(-dP[1], dP[0])
    c, si = np.cos(th), np.sin(th)

    def to_px(W):
        d = (np.asarray(W, float) - a_rd) / s
        return np.asarray(a_px, float) + np.stack(
            [c * d[..., 0] + si * d[..., 1], si * d[..., 0] - c * d[..., 1]], -1)

    return to_px, s, np.degrees(th)


def main(record_path, out_path, canals_npy=None, canals_meta=None):
    rec = json.load(open(record_path))
    pts = rec.get("control_points", [])
    if len(pts) < 2:
        sys.exit(f"{rec['id']}: need >=2 control points, have {len(pts)}")

    to_px, s, rot = similarity_from_two(pts[0]["rd"], pts[0]["px"], pts[1]["rd"], pts[1]["px"])
    print(f"{rec['id']}: {s:.3f} m/px, rotation {rot:.2f} deg")

    im = Image.open(rec["local_image"]).convert("RGB")
    dr = ImageDraw.Draw(im)

    if canals_npy:
        mask = np.load(canals_npy)
        meta = json.load(open(canals_meta))
        ys, xs = np.nonzero(mask[::3, ::3])
        world = np.column_stack([meta["minX"] + xs * 3 * meta["res"],
                                 meta["maxY"] - ys * 3 * meta["res"]])
        for x, y in to_px(world):
            if 0 <= x < im.width and 0 <= y < im.height:
                dr.point((x, y), fill=(0, 140, 255))

    for p in pts:
        x, y = to_px(np.asarray(p["rd"], float))
        dr.ellipse([x - 11, y - 11, x + 11, y + 11], outline=(255, 0, 0), width=4)
        dr.text((x + 14, y - 6), p.get("label", ""), fill=(255, 0, 0))

    im.save(out_path)
    print("wrote", out_path)


if __name__ == "__main__":
    main(*sys.argv[1:])
