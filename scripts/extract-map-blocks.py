"""Extract building blocks from a georeferenced Topotijdreis sheet.

    python3 scripts/extract-map-blocks.py 1880 [1900 ...]

Reads data/raster-cache/hoorn-topo-<year>.png + .json (see fetch-topotijdreis.mjs)
and writes data/historic-rasters/topo-<year>-blocks.json.

Why this map and not the hand-drawn ones: Topotijdreis sheets are published
already georeferenced in EPSG:28992, so the tile grid IS the coordinate system.
Nothing is warped, fitted or assumed — a pixel's RD coordinate is exact. That
makes them the only historical source in this project we can extract geometry
from mechanically rather than by measuring a frontage by hand.

What it can and cannot give:

  * LOD 11 = 1.5875 m/px is the finest the service publishes, so a 5 m house
    frontage is 3 px. Individual houses are NOT recoverable. Building BLOCKS
    are, and blocks are what the project's stated fidelity ("schematic massing
    city-wide") actually calls for.
  * Sheets from 1880 on print buildings in **carmine**, which segments cleanly
    by hue. Before 1880 they are monochrome engravings and this will not work
    (1815 in particular is a regional sheet where the whole town is a ~400 px
    blob under Zuiderzee hatching).

Holes are not traced. A courtyard inside a block comes out filled, which is
the right call for massing and the wrong one for footprints — do not treat
these polygons as footprints.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import Polygon

Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "raster-cache"
OUT_DIR = ROOT / "data" / "historic-rasters"

MIN_AREA_M2 = 120.0      # below this it is a symbol, a lone farmhouse or speckle
SIMPLIFY_M = 2.5         # ~1.5 px; keeps block corners, drops raster staircase
CLOSE_PX = 2             # bridge the white street-line hairlines inside a block

# Roads are the dominant false positive and CANNOT be separated by colour: on
# these sheets a country road's fill is the same carmine as a building's
# (sampled: R-G 73 and saturation 80 on a road, 67 and 73 in the historic core).
# Shape is the only discriminator. A road casing is long and narrow; a building
# block is not. Outside the built-up area, roads carry more ink than buildings
# do — this rule drops 64 of the 118 ha the mask picks up on the 1880 sheet.
MAX_LINEAR_LENGTH_M = 300.0
MIN_BLOCK_WIDTH_M = 25.0


def building_mask(rgb):
    """Carmine building fill. Deliberately generous on lightness (the ink is
    printed as a screen, so blocks are a stipple of pink and white) and strict
    on hue (green woodland and blue water must not leak in)."""
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    return (r > 90) & (r - g > 35) & (r - b > 25)


def trace_outer(sub):
    """Moore-neighbour boundary trace of one connected component.

    Returns pixel-corner coordinates, so the polygon wraps the pixels rather
    than running through their centres.
    """
    h, w = sub.shape
    start = None
    for y in range(h):
        xs = np.flatnonzero(sub[y])
        if len(xs):
            start = (int(xs[0]), y)
            break
    if start is None:
        return []

    # 8-neighbourhood, clockwise from west
    nbr = [(-1, 0), (-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1)]
    contour = [start]
    cur, back = start, 0
    for _ in range(8 * sub.sum() + 8):
        found = False
        for k in range(8):
            d = nbr[(back + k) % 8]
            nx, ny = cur[0] + d[0], cur[1] + d[1]
            if 0 <= nx < w and 0 <= ny < h and sub[ny, nx]:
                back = (nbr.index(d) + 5) % 8      # re-enter from where we came
                cur = (nx, ny)
                contour.append(cur)
                found = True
                break
        if not found:
            break
        if cur == start and len(contour) > 2:
            break
    return contour


def extract(year):
    meta = json.loads((CACHE / f"hoorn-topo-{year}.json").read_text())
    rgb = np.asarray(Image.open(CACHE / f"hoorn-topo-{year}.png").convert("RGB"))
    res = meta["m_per_px"]

    mask = building_mask(rgb)
    mask = ndimage.binary_closing(mask, np.ones((CLOSE_PX * 2 + 1,) * 2))
    mask = ndimage.binary_opening(mask, np.ones((3, 3)))
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    print(f"{year}: {mask.mean() * 100:.1f}% of the sheet is building ink, {n} components")

    min_px = MIN_AREA_M2 / (res * res)
    blocks = []
    dropped_linear = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        sub = lab[sl] == i
        if sub.sum() < min_px:
            continue
        ring = trace_outer(sub)
        if len(ring) < 4:
            continue
        x0, y0 = sl[1].start, sl[0].start
        pts = [(meta["rd_min_x"] + (x0 + px) * res, meta["rd_max_y"] - (y0 + py) * res)
               for px, py in ring]
        poly = Polygon(pts)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if poly.geom_type == "MultiPolygon":
            poly = max(poly.geoms, key=lambda p: p.area)
        poly = poly.simplify(SIMPLIFY_M, preserve_topology=True)
        if poly.is_empty or poly.area < MIN_AREA_M2:
            continue
        # For a ribbon, half the perimeter is its length and 2*area/perimeter
        # is its mean width. Both are cheap and neither needs a skeleton.
        length = poly.length / 2
        width = 2 * poly.area / poly.length
        if length > MAX_LINEAR_LENGTH_M and width < MIN_BLOCK_WIDTH_M:
            dropped_linear.append(poly.area)
            continue
        blocks.append({
            "id": f"topo{year}-b{len(blocks) + 1:04d}",
            "area_m2": round(poly.area, 1),
            "width_m": round(width, 1),
            "rd": [[round(x, 2), round(y, 2)] for x, y in poly.exterior.coords[:-1]],
        })

    blocks.sort(key=lambda b: -b["area_m2"])
    out = {
        "id": f"topo-{year}-blocks",
        "source": meta["service"],
        "source_year": meta["year"],
        "crs": meta["crs"],
        "m_per_px": res,
        "sheet_hash": meta["sheet_hash"],
        "method": (
            "Carmine building ink segmented by hue, closed by "
            f"{CLOSE_PX} px, components traced and simplified to {SIMPLIFY_M} m. "
            "Sheet is already georeferenced in EPSG:28992, so no fit is involved "
            "and there are no residuals to report."
        ),
        "caveats": [
            f"Blocks, not footprints: at {res} m/px a 5 m house frontage is 3 px.",
            "Roads share the buildings' carmine ink and are rejected by shape, not "
            f"colour: {len(dropped_linear)} components longer than {MAX_LINEAR_LENGTH_M:.0f} m "
            f"and narrower than {MIN_BLOCK_WIDTH_M:.0f} m were dropped "
            f"({sum(dropped_linear) / 1e4:.1f} ha). Short road stubs still get through.",
            "Courtyards inside a block are filled — outer rings only, no holes.",
            "Heights are not on the map. Rendering assumes them.",
            "Topotijdreis years are validity ranges, not surveys: check sheet_hash "
            "before treating two years as independent evidence.",
        ],
        "block_count": len(blocks),
        "total_area_m2": round(sum(b["area_m2"] for b in blocks), 1),
        "blocks": blocks,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"topo-{year}-blocks.json"
    path.write_text(json.dumps(out, indent=1) + "\n")
    print(f"  -> {len(blocks)} blocks, {out['total_area_m2'] / 1e4:.1f} ha built "
          f"({len(dropped_linear)} linear symbols / {sum(dropped_linear) / 1e4:.1f} ha rejected), {path.name}")


if __name__ == "__main__":
    for y in sys.argv[1:]:
        extract(y)
