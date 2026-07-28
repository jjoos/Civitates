"""Straighten a city's defensive ring into one long strip.

    python3 scripts/experiments/rectify_ring.py IMAGE OUT.png x0,y0 x1,y1 ... [--depth N] [--scale S]

Sampling a fortification ring at guessed spots misses things: a first pass over
Utenwael 1596 checked six likely places and found one gate, several bastions and
a windmill, with no way to know what lay between them. Rectifying the whole ring
along a polyline puts the entire enceinte in one image, in order, so gates,
bastions, mills and bridges can be counted rather than hunted.

The polyline is given by hand from a gridded overview — the ring is not a bright
corridor like a street, so `follow_street.py` cannot track it. Points are
interpolated with a Catmull-Rom spline so a handful of waypoints gives a smooth
curve, and every output column records the arc-length station along that curve,
which is what makes positions along the ring comparable to positions along the
surviving singels on the ground.

Output is the strip plus a `.stations.txt` giving station -> source pixel, so
anything spotted in the strip can be located back on the plate.
"""
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def catmull_rom(pts, samples_per_seg=60):
    """Smooth curve through the given points (not merely near them)."""
    p = np.asarray(pts, float)
    p = np.vstack([p[0] + (p[0] - p[1]), p, p[-1] + (p[-1] - p[-2])])
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        t = np.linspace(0, 1, samples_per_seg, endpoint=False)[:, None]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t
                          + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(p[-2][None, :])
    return np.vstack(out)


def resample(curve, step=1.0):
    seg = np.hypot(*(curve[1:] - curve[:-1]).T)
    s = np.concatenate([[0], np.cumsum(seg)])
    want = np.arange(0, s[-1], step)
    return np.column_stack([np.interp(want, s, curve[:, i]) for i in range(2)]), want


def main(argv):
    img_path, out_path = argv[0], argv[1]
    pts, opt = [], []
    for a in argv[2:]:
        if a.startswith("--"):
            opt = argv[argv.index(a):]
            break
        pts.append([float(v) for v in a.split(",")])
    def flag(name, default):
        return float(opt[opt.index(name) + 1]) if name in opt else default
    depth = int(flag("--depth", 320))     # how far either side of the curve
    scale = flag("--scale", 1.0)

    img = np.asarray(Image.open(img_path).convert("RGB"))
    curve, _ = resample(catmull_rom(pts), 1.0)
    xy, stations = resample(curve, 1.0)

    # unit tangent per station, then sample perpendicular
    d = np.gradient(xy, axis=0)
    d /= np.hypot(d[:, 0], d[:, 1])[:, None]
    n = np.column_stack([-d[:, 1], d[:, 0]])

    offs = np.arange(-depth, depth + 1)
    strip = np.zeros((len(offs), len(xy), 3), np.uint8)
    for i, o in enumerate(offs):
        p = xy + o * n
        strip[i] = img[np.clip(p[:, 1].astype(int), 0, img.shape[0] - 1),
                       np.clip(p[:, 0].astype(int), 0, img.shape[1] - 1)]

    out = Image.fromarray(strip)
    if scale != 1.0:
        out = out.resize((int(out.width * scale), int(out.height * scale)), Image.LANCZOS)
    out.save(out_path)

    with open(out_path + ".stations.txt", "w") as f:
        f.write("# station_px  src_x  src_y\n")
        for s, (x, y) in zip(stations, xy):
            f.write(f"{s:9.1f} {x:9.1f} {y:9.1f}\n")
    print(f"{out_path}: {out.width}x{out.height}, ring length {stations[-1]:.0f} px, "
          f"{len(pts)} waypoints -> {len(xy)} stations")


if __name__ == "__main__":
    main(sys.argv[1:])
