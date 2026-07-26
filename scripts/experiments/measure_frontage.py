"""Measure house facade widths off a bird's-eye town map, street-aligned.

Supersedes the band-profile approach in `extract_facades.py`, which measured
the wrong thing (see that file's header and the experiments README).

    python3 scripts/experiments/measure_frontage.py IMAGE x0 y0 x1 y1 SIDE \
        [--range SMIN SMAX] [--minsep PX] [--scale M_PER_PX]

(x0,y0)-(x1,y1) only has to land roughly along the street; the script fits the
real street axis itself from the light band between the two facade rows, which
matters because a hand-drawn line is easily 10 degrees off and the drift then
walks the sample band across the gables it is meant to be counting.

SIDE is `left` or `right` of the fitted axis in image terms (the script prints
both so you can pick by eye from the overlay).

Three things this gets right that the band-profile version did not:

  1. It works in a STREET-ALIGNED frame, so the sample never drifts off the
     frontage and long stretches stay usable.
  2. It detects the **roof silhouette** — for each station, how close the block
     comes to the street — rather than average darkness. Average darkness is
     dominated by the engraver's hatching *inside* each gable, whose stroke
     spacing has nothing to do with house widths, and locking onto it makes
     every house come out about a quarter of its true size.
  3. It requires a sustained dark run (RUN px) to call an edge, so the street
     name lettering drawn in the roadway does not register as a building.

Validate the output two ways before trusting it, because the apex count is
sensitive to --minsep:
  * overlay the apexes on a rectified strip and look at them;
  * compare the mean facade against the street's house-numbering density
    (see docs/georeferencing.md) — an independent, documentary check.
"""
import sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
STEP = 0.5        # sampling interval along the street, px
DARK = 145        # grey level below which a pixel counts as ink
RUN = 4           # consecutive dark px needed to call a block edge, not a stroke
BASELINE = 121    # detrending window, px — wide enough to ignore single gables


def load(path):
    return np.asarray(Image.open(path).convert("L"), float)


def at(img, pts):
    return img[np.clip(pts[:, 1].astype(int), 0, img.shape[0] - 1),
               np.clip(pts[:, 0].astype(int), 0, img.shape[1] - 1)]


def fit_street_axis(img, p0, p1, reach=110):
    """Refine a rough line onto the street's own axis via its light band."""
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    d = p1 - p0
    length = float(np.hypot(*d))
    u = d / length
    n = np.array([-u[1], u[0]])
    ss = np.arange(0, length, 1.0)
    deps = np.arange(-reach, reach * 0.4, 1.0)
    band = np.array([at(img, p0 + np.outer(ss, u) + dep * n) for dep in deps])
    centre = np.array([deps[int(np.argmax(np.convolve(band[:, i], np.ones(9) / 9, "same")[4:-4])) + 4]
                       for i in range(band.shape[1])])
    k = 31
    a, b = np.polyfit(ss[k // 2:-(k // 2)], np.convolve(centre, np.ones(k) / k, "same")[k // 2:-(k // 2)], 1)
    th = np.arctan(a)
    U = u * np.cos(th) + n * np.sin(th)
    return p0 + b * n, U, np.array([-U[1], U[0]]), np.degrees(th)


def silhouette(img, O, U, N, sign, smin, smax, dmax=70):
    """Depth from the street axis at which the block edge starts, per station."""
    ss = np.arange(smin, smax, STEP)
    deps = np.arange(2, dmax, STEP)
    dark = np.array([at(img, O + np.outer(ss, U) + sign * dep * N) for dep in deps]) < DARK
    out = np.full(len(ss), np.nan)
    for i in range(dark.shape[1]):
        run = 0
        for k in range(dark.shape[0]):
            run = run + 1 if dark[k, i] else 0
            if run >= RUN:
                out[i] = deps[k - RUN + 1]
                break
    return ss, out


def apexes(ss, dep, minsep):
    """Gable apexes = local minima of depth, i.e. where the block juts streetward."""
    d = np.asarray(dep, float)
    idx = np.arange(len(d))
    good = ~np.isnan(d)
    d = np.interp(idx, idx[good], d[good])
    r = np.convolve(d, np.ones(BASELINE) / BASELINE, "same") - d
    sep = int(minsep / STEP)
    cand = [i for i in range(2, len(r) - 2) if r[i] == max(r[i - 2:i + 3]) and r[i] > 0]
    peaks = []
    for i in sorted(cand, key=lambda i: -r[i]):
        if all(abs(i - p) >= sep for p in peaks):
            peaks.append(i)
    return sorted(float(ss[p]) for p in peaks)


def main(argv):
    img_path, x0, y0, x1, y1, side = argv[:6]
    opt = argv[6:]
    def flag(name, n, default):
        return [float(opt[opt.index(name) + 1 + i]) for i in range(n)] if name in opt else default
    minsep = flag("--minsep", 1, [12.0])[0]
    scale = flag("--scale", 1, [None])[0]

    img = load(img_path)
    O, U, N, ang = fit_street_axis(img, (float(x0), float(y0)), (float(x1), float(y1)))
    L = float(np.hypot(float(x1) - float(x0), float(y1) - float(y0)))
    smin, smax = flag("--range", 2, [0.0, L])
    print(f"street axis refined by {ang:+.2f} deg; origin {O.round(1)} dir {U.round(4)}")

    sign = -1 if side == "left" else 1
    ss, dep = silhouette(img, O, U, N, sign, smin - 20, smax + 20)
    pos = [p for p in apexes(ss, dep, minsep) if smin <= p <= smax]
    w = np.diff(pos)
    print(f"{len(pos)} apexes -> {len(w)} facades over {pos[-1] - pos[0]:.1f} px")
    print("apex px  :", [round(p, 1) for p in pos])
    print("widths px:", [round(float(x), 1) for x in w])
    if scale:
        m = w * scale
        print("widths m :", [round(float(x), 2) for x in m])
        print(f"span {(pos[-1] - pos[0]) * scale:.1f} m | mean {m.mean():.2f} m | median {np.median(m):.2f} m")


if __name__ == "__main__":
    main(sys.argv[1:])
