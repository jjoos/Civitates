# Historic street records

Old maps treated as **logical entities** rather than as rasters to be warped.

A record is one side of one street, from one map. Each house on that frontage
gets an id, a position in the sequence, and a facade width measured off the
map. The street centreline comes from present-day data. Houses are then
distributed along the real street in proportion to their facade widths, and
compared against BAG to see which might still be standing.

    node scripts/project-houses.mjs

## Why this instead of georeferencing the scan

Warping a 16th/17th-century scan into RD coordinates failed repeatedly (see
`docs/georeferencing.md`). This approach sidesteps all of it:

- Only **relative** facade widths matter, so the map's absolute scale,
  rotation and even its foreshortening cancel out.
- The frame of reference is the **surviving street network**, not vanished
  canals or demolished buildings.
- Error stays **local to one street** instead of contaminating a global fit.
- It works on **bird's-eye views**, which — crucially — are the only maps that
  draw individual houses at all.

## Which maps can supply houses

Verified by inspecting the scans at full resolution:

| Map | Draws individual houses? | Usable here |
|---|---|---|
| Blaeu 1649 | **yes** — rows of individual gabled houses, countable | **yes** |
| Utenwael 1596 | **yes** — same view family, finer engraving | **yes** |
| Guicciardini 1582 | yes, coarser | probably |
| Van Deventer 1545 / 1560 | **no** — blocks drawn as undifferentiated masses with generic texture | no |

This inverts the earlier ranking. The Van Deventer plans have the better
*geometry* but cannot support this method; the oblique views have poor global
geometry but draw every house, and their weakness does not matter here because
foreshortening is roughly constant along a single street frontage.

## Record format

```json
{
  "id": "blaeu1649-grote-oost-north",
  "source_id": "kwaad-blaeu-1649",
  "source_year": 1649,
  "street": "Grote Oost",
  "side": "left",
  "crs": "EPSG:28992",
  "street_centreline_rd": [[x, y], ...],
  "frontage_offset_m": 7,
  "match_tolerance_m": 12,
  "houses": [{ "id": "...", "facade_width": 12.4 }]
}
```

- `facade_width` — measured off the map in **any consistent unit** (pixels are
  fine); only the ratios are used.
- `side` — `left` or `right` of the centreline, in its direction of travel.
- The script fills in `order`, `facade_frac`, `facade_m`, `rd`,
  `bag_candidates` and `bag_match`.

`bag_match` only accepts a BAG building whose construction year is **at or
before the map's date** — a 1920s building standing on the spot is not that
house. Nearby buildings of any date are still listed under `bag_candidates`
for inspection.

## Segments

A frontage usually covers only part of a street. Spreading eight houses over a
355 m centreline would invent 44 m facades, so a record pins the stretch it
actually spans with `segment_start_m` and `segment_length_m`.

Derive `segment_length_m` from the **apex-to-apex** span of the detected
facades, not from the length of frontage you searched — using the search
length inflated every facade by 1.33x when this was first run.

## First end-to-end run

`blaeu1649-noort-block-north` — 8 houses on the Grote Noord frontage of the
block between Blaeu's "Ouden Noort" and "Nieuwen Noort":

| # | facade |  | # | facade |
|---|---|---|---|---|
| 1 | 2.94 m | | 5 | 3.87 m |
| 2 | 4.81 m | | 6 | 4.01 m |
| 3 | 3.47 m | | 7 | 4.14 m |
| 4 | 3.74 m | | 8 | 4.14 m |

**The widths are the validation.** Scaled by Blaeu's own *Virgae Rhijnlandicae*
bar (0.267 m/px on the 5978px plate), they land at **2.9–4.8 m, mean 3.9 m** —
exactly the range for 17th-century Dutch canal houses. Nothing in the pipeline
was tuned to produce that; it falls out of the gable spacing and the printed
scale bar independently.

**Survivors: 0.** The nearest standing buildings are dated **1880 and 1890**,
so the matcher rejects them — correctly, since a building put up in 1890
cannot be a house drawn in 1649. That is the year filter doing its job.

### What is real here and what is not

Real: the facade widths, their ordering, the metre scale, and the street
identification (Blaeu's "Nieuwen Noort" is modern Nieuwe Noord — it was the
Burchwal *canal* until 1595 — so "Ouden Noort" is modern Grote Noord).

Not real: `segment_start_m = 0`. The **along-street position** of this frontage
has not been established, so the houses currently sit at the Roode Steen end of
Grote Noord by assumption. The survivor count therefore says nothing about
these particular houses yet. Fixing it means sampling a frontage that runs
between two identifiable junctions and using the matching modern segment.

## Rendering

`scripts/build-historic-houses.mjs` turns projected records into
`public/data/hoorn-historic-houses.json`, which the app renders alongside the
BAG buildings in a warm brick tone so reconstructions never read as survey
data. Each house is visible only while the slider sits inside its attested
window, and a button flies the camera to them — eight ~4 m frontages in a
12 km scene are otherwise impossible to find.

Facade widths come from the map. **Plot depth (12 m) and eaves height (9 m)
are assumptions**, recorded in the file's `assumptions` block: a bird's-eye
map gives frontage but not depth or height.

Neighbours in a terrace are built to touch **exactly**, and coordinates are
rounded to millimetres rather than decimetres. Both matter: an earlier attempt
to inset each house by 12 cm produced gaps that are sub-pixel at normal
viewing distance and aliased badly, and decimetre rounding pulled shared
corners apart into slivers.

But touching exactly means a uniform terrace renders as **one featureless
box** — which is exactly what it did, twice. Three things make the individual
houses legible, all **stylisation for legibility, not evidence**:

- **Gabled roofs**, ridge running front-to-back so the gable end faces the
  street. This is the one with real support: Blaeu draws these houses with
  prominent street-facing gables. The sawtooth roofline is what actually makes
  a terrace read as separate houses.
- **Height jitter** of ±0.8 m around the assumed 9 m, so the roofline steps.
- **A per-house brick tint**, emitted as `tint` in the data file.

Geometry is built by hand rather than by `ExtrudeGeometry`, so the quad is
emitted in a known order (front-left, front-right, back-right, back-left) and
faces are wound explicitly instead of guessed.

Both derive from the house id through an FNV-1a hash with an fmix32
finaliser, so rebuilds are stable. **The avalanche is the point**: house ids
differ only in their final character, and a naive `hash * 31 + charCode`
followed by `% 1000` varied by about 5 parts in 1000 — every house came out
the same height and the same colour, and the terrace still looked like one
box.

### Known artifact

Close-up screenshots from the headless test container show speckle on the
historic facades. It survives every fix tried — ring winding, near/far plane,
party-wall gap, coordinate precision, render order, dev vs production build,
and removing the BAG layer entirely — which points at the container's
**software WebGL (SwiftShader)** rasteriser rather than the scene. A
logarithmic depth buffer suppressed it only by hiding the mesh outright, since
raw `ShaderMaterial`s need the logdepth shader chunks to work with it. Worth
confirming on real GPU hardware before chasing further.

## Cache busting

Vite content-hashes the JS bundle, but files in `public/` keep stable URLs and
GitHub Pages serves them with `max-age=600`. A data-only change therefore
ships a fresh bundle that reads a **stale cached JSON** — which is how a fixed
dataset kept rendering as the old one.

`scripts/gen-data-manifest.mjs` runs as npm's `prebuild`, hashes each file in
`public/data/`, and generates `src/data-manifest.ts` (gitignored). The app
requests `data/foo.json?v=<hash>`. Per-file, so changing the small historic
dataset does not force a re-download of the 9 MB BAG file.
