# Georeferencing historical maps

How we turn a scanned historical map of Hoorn into real-world coordinates,
and what we've learned about each map so far. Per-map facts live in
`data/sources.json` (`projection`, `orientation`, `scale_bar`,
`georef_notes`, `image_urls`); this file covers the method and the
reasoning behind it.

## Coordinate system

Everything lands in the same local scene coordinates the buildings already
use (see `scripts/lib/hoorn-boundary.mjs`):

```
localX = RD_easting  - originX
localZ = originY     - RD_northing     (so +Z is south)
```

with RD = EPSG:28992 (Amersfoort / RD New) and the origin at the centre of
the Hoorn municipality bounding box. Any map we georeference has to end up
expressed this way so it lines up with the BAG footprints and the basemap.

## Check the projection before fitting anything

The single most important question about a historical town map is **whether
it is a true plan or a bird's-eye view**, because it decides which
transform is even valid:

- **True plan (planimetric)** — streets and blocks drawn flat, as if seen
  from straight above. A *similarity* transform (rotate + uniform scale +
  translate) can fit it, and footprints traced from it are meaningful.
- **Bird's-eye / oblique view** — the city drawn from an elevated angle,
  buildings shown as little 3D houses with visible roofs and facades. The
  ground plan is foreshortened along one axis, so a similarity transform
  *cannot* fit it; you need at least an affine or projective (homography)
  fit with 4+ control points. Even then, building height creates parallax
  that displaces footprints, so precision stays limited. Useful for street
  layout, block structure, and "did this building exist" — not for exact
  footprints.

### How to test it cheaply

Compare the map's proportions against ground truth we already have, rather
than trusting the drawing style or a page caption:

1. Measure the walled city's extent on the scan, in pixels.
2. Measure the real historic core's extent, in metres. Two good sources,
   both already available: pre-1700 building centroids from
   `public/data/hoorn-bag.json`, and the CBS `Binnenstad` buurt polygons
   from the PDOK wijkenbuurten WFS.
3. Compare the aspect ratios, and derive the implied m/px along each axis.

A true plan gives a matching aspect ratio and one consistent scale. A
foreshortened view gives a stretched ratio and two different scales.

## Findings so far

### Blaeu 1649 — bird's-eye view, not a plan

Investigated first, and it turned out to be the harder case:

- The walled city occupies roughly **1240 x 580 px** on the 1500px-wide
  scan (ratio ~2.1), while the real pre-1700 built-up area measures
  **975 x 799 m** (ratio 1.22) from BAG footprints.
- That implies **~0.79 m/px along one axis and ~1.38 m/px along the
  other** — inconsistent, i.e. foreshortened by roughly 1.7x.
- Buildings are drawn as 3D houses, confirming the oblique viewpoint.

Its own printed scale bar ("Virgae Rhijnlandicae", ticks every 10 roeden)
measures **3.54 px per roede**; at 1 Rijnlandse roede = 3.767 m that is
~1.06 m/px — which sits between the two axis scales above, as you'd expect
for a bar drawn at one nominal scale on a foreshortened view.

Orientation (established two independent ways, since it is easy to get
backwards): **north is at the bottom, east at the left**, about 4 degrees
off a straight 180-degree rotation. The compass rose needle runs
top-to-bottom, and the open water full of ships along the top edge is the
Zuiderzee, which lies south/south-east of Hoorn.

### Van Deventer 1545 — true plan, and the oldest map we have

- Genuinely **planimetric**: streets, blocks and the moat drawn flat, with
  only churches and gates as small pictorial symbols.
- **Unambiguous orientation** — the sheet is labelled *Septentrio* (top),
  *Meridies* (bottom), *Oriens* (right), *Occidens* (left): north up, east
  right, standard.
- Has a **scale bar** ("Passus quingentum", ticks every 100 passus).
- Van Deventer surveyed the Netherlandish cities for Philip II, so these
  are the earliest systematic true-plan surveys of Dutch towns.

This makes it the **best first georeferencing target of the pre-1811 set**:
both the oldest source we have *and* the most geometrically faithful.

Caveat on the scan: it is a two-page atlas spread (Biblioteca Nacional de
España) with a book gutter. The left inset panel shows the city at larger
scale than the right-hand regional sheet — prefer the inset for the city
itself.

## Pre-1600 survey (all four maps)

Every map in the catalogue dated before 1600 has been examined. Only half of
them are georeferenceable as plans:

| Year | Map | Projection | Orientation | Georeferenceable |
|---|---|---|---|---|
| 1545 | Van Deventer | **true plan** | north up, east right (*Septentrio* / *Oriens* labelled) | yes |
| 1560 | Van Deventer | **true plan** | north up, east right ("Noordt"/"West"/"Oost" labelled) | yes |
| 1582 | Guicciardini | bird's-eye oblique | north at bottom, water at top | no (indicative only) |
| 1596 | Utenwael | bird's-eye oblique | north at bottom, water at top | no (indicative only) |

Notes worth carrying forward:

- **Van Deventer 1560 is the best pre-1600 target** — the clearest true plan
  of the set, and its detail crop (*uitsnede*) is high resolution. Its scan is
  a 19th-century Smulders lithographic facsimile rather than the original
  manuscript, so facsimile redrawing is an extra error source when judging
  residuals.
- **Guicciardini 1582 and Utenwael 1596 are the same view family** — shared
  viewpoint, framing and Neptune-on-a-sea-monster cartouche. Treat them as one
  source, not two independent ones. Utenwael is the more detailed engraving.
- Van Deventer 1545 is a two-page atlas spread; its left inset panel and
  right regional sheet are separate drawings and each needs its own transform.

### Dead end: don't fit against surviving old buildings

Matching a map's built-up area to the distribution of surviving pre-1600 BAG
buildings does not work. Only 28 BAG buildings in Hoorn are dated 1600 or
earlier, and the principal axis of that point cloud swings from -136 deg to
61 deg to 83 deg as the cutoff moves from 1600 to 1650 to 1700 — the sample is
too small and too biased by which buildings happened to survive. It is not
stable ground truth.

### Recommended bridge: georeference via TOPraster ~1815

The reliable path for the pre-1600 plans is to fit them against the earliest
**Topotijdreis / TOPraster** sheet instead of against modern data. That map is
already georeferenced in EPSG:28992 (no manual work for that link), and
Hoorn's core barely changed between the VOC-era build-out and 1815 — the city
stagnated rather than expanded — so its street and moat pattern is a far
closer match to the 16th-century plans than anything present-day. Chain the
fit: old plan -> 1815 raster -> RD.

## Tooling

`scripts/georeference.mjs` fits and checks transforms from control-point
records in `data/georeferences/<id>.json`:

```sh
node scripts/georeference.mjs                  # all records
node scripts/georeference.mjs vandeventer-1560 # one record
```

It fits a similarity (plans) or affine (foreshortened views) transform by
least squares, writes the result back into the record, and prints the RMS plus
a **per-point residual** so a mis-picked point stands out instead of being
absorbed into the fit. Verified against a synthetic case with a known
transform and one deliberately corrupted point: scale and rotation recovered
to 4 significant figures, and the bad point showed 20 m against ~5 m for the
rest.

Records for all four pre-1600 maps exist with projection, orientation and
model locked in; `control_points` are still empty, which the script reports as
PENDING rather than fitting.

## Strategy experiments for placing control points

Hand-picking pixels on 16th-century engravings produced a wrong answer once
(Blaeu 1649), so these are the alternatives, with what has actually been
tested.

### Tested: search for an existing georeference — partial win

The IISG dataset *Georeferenced regional maps associated with Jacob van
Deventer, 1536-1546* (hdl:10622/F3LGB4) publishes six georeferenced GeoTIFFs
(Flanders, Holland, Brabant, Guelders, Frisia, Zeeland) with QGIS control
point files, **CC0**. The Holland sheet covers Noord-Holland, but these are
*regional* maps on which Hoorn is a dot — not a substitute for the city plan.

Two things worth carrying forward from it:

- **The professional method**: control points are *church towers*, fitted with
  a thin-plate-spline transform. Towers are point features, survive, and are
  independently documented — much better targets than street corners.
- **An accuracy benchmark**: Van Deventer surveyed by triangulation, and his
  1560 Amsterdam plan reportedly deviates nowhere by more than ~10 m. So a
  good fit here should land in the low tens of metres; anything much worse
  means the fit is wrong, not that the map is bad.

Not yet explored: `oudhoorn.nl/stadsplattegronden`, a Hoorn-specific local
history resource that may already have done this work.

### Tested: colour segmentation — works, and is reusable

`scripts/experiments/segment_map.py` splits a coloured plan into its
canal/moat network and its building blocks by ink colour. On Van Deventer
1560 it cleanly recovers the entire canal network and the block structure. It
is a good basis for tracing and for visual overlays, independent of whether
it feeds a registration.

### Tested: automatic canal registration vs. modern water — does not work

Segment the 1560 canals, segment modern canals from PDOK BRT "water" tiles,
then grid-search scale (0.55-1.35 m/px) and rotation (±6°) with FFT
cross-correlation solving translation exhaustively, scored by Dice overlap.

Peak Dice was only **0.16**, and the score rose monotonically with scale
rather than peaking — the signature of "a bigger mask overlaps more", not of
a real match.

The cause is historical, not technical: **most of Hoorn's 1560 canals no
longer exist.** The Gedempte Turfhaven ("filled-in turf harbour") is the
obvious case, and the harbour was rebuilt wholesale after 1600. Segmentation
quality was fine. Don't retry this against present-day data.

### Untested, in rough order of promise

### Tested: TOPraster ~1815 bridge — blocked

The 1815 sheet fetches fine and is genuinely georeferenced (ArcGIS service
`Historische_tijdreis_1815`, EPSG:28992, 1.5875 m/px; 89 historical years are
available). But it is a **monochrome engraving**, so colour segmentation
cannot separate its water, and colour only enters the series around **1924** —
far too late to preserve the 1560 canal layout.

### Tested: automatic church-tower matching — confident false match

Hoorn has four landmarks that existed in 1560 and still stand: Noorderkerk,
Grote Kerk, Oosterkerk (15th century) and the Hoofdtoren (1532). Detecting
church symbols and RANSAC-matching the configuration produced a top
hypothesis that scored far above the runner-up, with the two *independent*
landmarks landing **0.9 px and 2.5 px** from detected symbols — and it was
**completely wrong**, as the overlay immediately showed: warped canals across
open fields, all four landmarks bunched in one patch, the harbour tower
inland. A properly constrained re-run found no good match at all.

**Sub-pixel residuals on a small control-point set prove nothing.** This is
the second time an unverified fit looked right and wasn't.

### Where this leaves us

Every automated route tried has failed for a different reason: the canals are
gone, the early rasters are monochrome, and symbol detection is not reliable
enough to identify churches. The remaining option is the pragmatic one:

**Human-in-the-loop.** Someone who can read the plan identifies three or four
landmarks, and `scripts/experiments/verify_fit.py` renders the resulting fit
over the scan to confirm or reject it. The verification step is not optional —
it is the only thing in this exercise that has ever caught a wrong answer.

Still untested: **street-network matching** (Hoorn's medieval streets survive
far better than its canals, and many keep their names), and the
Hoorn-specific `oudhoorn.nl/stadsplattegronden` resource, which may already
have done this work.

## Preferred order of work

1. **Anything from ~1815 on: don't georeference by hand at all.** Use
   Topotijdreis / TOPraster, which Kadaster already publishes georeferenced
   in EPSG:28992. This covers the Kadaster 1811-1832 minuutplans and
   Kuypers 1868 in our catalogue — trace from the georeferenced raster
   instead of the kwaad.net scans of the same maps.
2. **Pre-1811: start with Van Deventer 1545**, for the reasons above.
3. **Bird's-eye views (Guicciardini 1582, Utenwael 1596, Blaeu 1649)**: treat as
   corroborating evidence for street layout, block structure and building
   existence/appearance, not as footprint geometry. If fitted, use a
   projective transform with 4+ control points and record the residuals.

## Control points

Prefer features that still exist today and can be geocoded exactly, so the
fit is checkable. Useful ones in Hoorn, with RD coordinates from the PDOK
locatieserver:

| Feature | RD (x, y) |
|---|---|
| Hoofdtoren (Hoofd 2) | 133060.6, 516664.9 |
| Oosterpoort (surviving 1578 city gate) | 133446.7, 517126.5 |
| Kerkplein (Grote Kerk site) | 132875.5, 517018.5 |
| Roode Steen (Waag square) | ~132805, ~516890 |
| Veermanskade | 133044.2, 516726.6 |
| Bierkade | 132971.3, 516841.9 |
| Grote Havensteeg | 132829.7, 516857.8 |

The surviving medieval street pattern is the other good source of control:
many street names on the old maps (Grote Oost, Kerkstraat, Nieuwstraat,
Grote/Kleine Havensteeg, Veermanskade …) still exist and can be geocoded
directly.

**Always fit with more control points than the transform needs, and record
the residuals.** A similarity transform needs 2 points and a projective one
4; fitting with exactly that many hides all error, and an orientation or
axis-sign mistake will silently produce a mirrored or 180-degree-rotated
result that still "fits" perfectly. Sanity-check by predicting where known
landmarks should land and confirming the right feature is actually there.
