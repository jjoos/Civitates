"""SUPERSEDED by measure_frontage.py — this measured the wrong thing.

The 1-D darkness profile below is dominated by the hatching strokes drawn
INSIDE each gable, not by the gables. Autocorrelation locks onto the stroke
rhythm (14.6 px on Blaeu 1649, about a quarter of a real house) and reports a
confident 0.75 while being four times out. Kept for the record; use
measure_frontage.py, which detects the roof silhouette instead.

Extract individual house facade widths from a bird's-eye town map.

Old maps drawn as bird's-eye views (Blaeu 1649, Utenwael 1596) draw every
house as a gabled unit in a row. Sampling a band along a street frontage and
reducing it to a 1-D darkness profile makes that row periodic, so the gable
apexes -- and hence facade widths -- can be measured without georeferencing
anything.

    python3 scripts/experiments/extract_facades.py IMAGE x0 y0 x1 y1 [valid_px]

Prints the dominant house spacing, the autocorrelation strength (the quality
signal: >0.6 means a real rhythm, <0.4 means the line is not on a frontage),
and the individual facade widths.

Two things that decide whether this works:
  * The band must be sampled toward the STREET, not into the block interior.
    Sampling the wrong way crosses roof ridges and the rhythm vanishes
    (measured: autocorrelation 0.29 wrong side vs 0.75 right side).
  * A straight segment only tracks a block edge for so long before drifting
    off it. Pass valid_px, or use short segments and chain them.
"""
import sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
STEP = 0.5          # sampling interval along the frontage, px
DEPTH = 34          # how far to reach toward the street, px


def profile(img, p0, p1, depth=DEPTH):
    a = np.asarray(Image.open(img).convert("L")).astype(float)
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    d = p1 - p0
    length = np.hypot(*d)
    u = d / length
    n = np.array([-u[1], u[0]])          # points into the block
    ss = np.arange(0, length, STEP)
    band = np.empty((depth + 2, len(ss)))
    for i, dep in enumerate(np.arange(-depth, 2, 1.0)):
        pts = p0 + np.outer(ss, u) + dep * n
        band[i] = a[np.clip(pts[:, 1].astype(int), 0, a.shape[0] - 1),
                    np.clip(pts[:, 0].astype(int), 0, a.shape[1] - 1)]
    prof = band.mean(0)
    prof = (prof - prof.mean()) / prof.std()
    k = np.hanning(7); k /= k.sum()
    return length, np.convolve(-prof, k, "same")   # dark = high


def rhythm(sig):
    ac = np.correlate(sig - sig.mean(), sig - sig.mean(), "full")[len(sig) - 1:]
    ac /= ac[0]
    lo, hi = int(8 / STEP), int(70 / STEP)
    lag = lo + int(np.argmax(ac[lo:hi]))
    return lag * STEP, ac[lag]


def apexes(sig, min_sep_px=9, thresh=0.25):
    sep = int(min_sep_px / STEP)
    cand = [i for i in range(1, len(sig) - 1)
            if sig[i] > sig[i - 1] and sig[i] >= sig[i + 1] and sig[i] > thresh]
    peaks = []
    for i in sorted(cand, key=lambda i: -sig[i]):
        if all(abs(i - p) >= sep for p in peaks):
            peaks.append(i)
    return sorted(p * STEP for p in peaks)


def main(img, x0, y0, x1, y1, valid=None):
    length, sig = profile(img, (float(x0), float(y0)), (float(x1), float(y1)))
    if valid:
        sig = sig[: int(float(valid) / STEP)]
    spacing, strength = rhythm(sig)
    print(f"frontage {length:.0f} px | spacing {spacing:.1f} px | autocorr {strength:.2f}"
          f"{'  <-- WEAK, line probably not on a frontage' if strength < 0.4 else ''}")
    pos = apexes(sig)
    w = np.diff(pos)
    print(f"{len(pos)} gable apexes -> {len(w)} facades")
    print("widths px:", [round(float(x), 1) for x in w])
    if len(w):
        print(f"mean {w.mean():.1f}  median {np.median(w):.1f}  sd {w.std():.1f}")


if __name__ == "__main__":
    main(*sys.argv[1:])
