"""Follow a street across a bird's-eye map as a POLYLINE, not a straight line.

    python3 scripts/experiments/follow_street.py IMAGE x0 y0 x1 y1 [--back N] [--fwd N]

A straight axis fit is only good locally. On Blaeu 1649 the fitted Ouden Noort
axis stays inside the roadway for about 250 px and is 47 px off it by station
700, because the real street curves — Grote Noord bows 4.1 m off its own chord
over 354 m on the ground, and the drawing bends more than that. Measuring
anything at street scale therefore needs the axis to bend too.

Method: seed from a rough segment, then walk forward in short steps. At each
step, sample across the roadway, take the brightest point as the street centre,
and turn the heading toward it, limited to a small angle per step so ink blots
and side openings cannot yank the track off course. Walk backward from the seed
the same way. The result is an ordered polyline with an arc-length station on
every vertex.

Two guards, because the failure mode is drifting onto a neighbouring street and
carrying on confidently:

  * `bright` — how light the roadway is under the track. Roads are the light
    background of this engraving; if the track wanders onto a block, this drops.
  * `--max-turn` — the heading cannot swing more than this per step.

Output rows are `station_px x y bright`. Inspect `bright` before trusting a
station: the track is only meaningful while it stays high.
"""
import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

STEP_PX = 6.0        # walking step
HALF_WIDTH = 26.0    # how far to sample either side when locating the centre
MAX_TURN_DEG = 7.0   # per step
SMOOTH = 5           # samples in the cross-street profile smoother


def sample(img, pts):
    return img[np.clip(pts[:, 1].astype(int), 0, img.shape[0] - 1),
               np.clip(pts[:, 0].astype(int), 0, img.shape[1] - 1)]


def centre_and_brightness(img, p, u, half=HALF_WIDTH):
    """Brightest point across the street at p, looking perpendicular to u."""
    n = np.array([-u[1], u[0]])
    offs = np.arange(-half, half + 0.5, 0.5)
    vals = sample(img, p + np.outer(offs, n))
    k = np.ones(SMOOTH) / SMOOTH
    sm = np.convolve(vals, k, "same")
    i = int(np.argmax(sm[SMOOTH:-SMOOTH])) + SMOOTH
    return p + offs[i] * n, float(sm[i])


# Snapping the point fully onto the measured centre each step makes the track
# zigzag: the centre can be HALF_WIDTH away laterally, so arc length inflates
# (measured: 4920 px of track for 2280 px of walking). Correct only part of the
# way and let the heading do the rest.
LATERAL_GAIN = 0.35


def walk(img, p, u, steps, max_turn):
    out = []
    n_hat = lambda v: np.array([-v[1], v[0]])
    for _ in range(steps):
        p = p + STEP_PX * u
        c, bright = centre_and_brightness(img, p, u)
        lateral = float(np.dot(c - p, n_hat(u)))
        # turn toward the measured centre, capped
        turn = np.clip(np.arctan2(lateral, STEP_PX * 3.0), -max_turn, max_turn)
        ca, sa = np.cos(turn), np.sin(turn)
        u = np.array([u[0] * ca - u[1] * sa, u[0] * sa + u[1] * ca])
        u /= np.hypot(*u)
        p = p + LATERAL_GAIN * lateral * n_hat(u)
        out.append((p.copy(), bright))
    return out


def main(argv):
    img_path, x0, y0, x1, y1 = argv[:5]
    opt = argv[5:]
    def flag(name, default):
        return float(opt[opt.index(name) + 1]) if name in opt else default
    back = int(flag("--back", 200))
    fwd = int(flag("--fwd", 200))
    max_turn = np.radians(flag("--max-turn", MAX_TURN_DEG))

    img = np.asarray(Image.open(img_path).convert("L"), float)
    p0 = np.array([float(x0), float(y0)])
    p1 = np.array([float(x1), float(y1)])
    u = (p1 - p0) / np.hypot(*(p1 - p0))
    seed, _ = centre_and_brightness(img, p0, u)

    fwd_pts = walk(img, seed, u, fwd, max_turn)
    back_pts = walk(img, seed, -u, back, max_turn)
    pts = [p for p, _ in reversed(back_pts)] + [seed] + [p for p, _ in fwd_pts]
    br = [b for _, b in reversed(back_pts)] + [centre_and_brightness(img, seed, u)[1]] + [b for _, b in fwd_pts]

    s = 0.0
    print("# station_px  x  y  bright")
    for i, p in enumerate(pts):
        if i:
            s += float(np.hypot(*(p - pts[i - 1])))
        print(f"{s:9.2f} {p[0]:9.2f} {p[1]:9.2f} {br[i]:7.1f}")


if __name__ == "__main__":
    main(sys.argv[1:])
