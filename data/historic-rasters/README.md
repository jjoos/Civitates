# Historic raster records

The cross-cutting methodological lessons — what went wrong and what caught it
— are collected in [docs/lessons.md](../../docs/lessons.md).

Building blocks extracted from **georeferenced** historical sheets. The
complement to `data/historic-streets/`, and deliberately the opposite trade-off:

| | `historic-streets/` | `historic-rasters/` (here) |
|---|---|---|
| source | hand-drawn bird's-eye views | Kadaster Topotijdreis sheets |
| georeferencing | none — houses are projected onto a modern street | **already done**, EPSG:28992 |
| position | assumed | **exact** |
| granularity | individual houses, measured facades | blocks, ~1.6 m/px |
| heights | assumed | assumed |
| coverage | one street frontage | the whole municipality |

So: Blaeu gives real houses in an assumed place; Topotijdreis gives real places
at block granularity. Neither is a substitute for the other, which is why they
render in different colours (`src/palette.ts`).

## Pipeline

    node scripts/fetch-topotijdreis.mjs 1880       # -> data/raster-cache/ (gitignored, ~90 MB/sheet)
    python3 scripts/extract-map-blocks.py 1880     # -> topo-1880-blocks.json
    node scripts/build-historic-blocks.mjs         # -> public/data/hoorn-historic-blocks.json

Only the block JSON is committed. The rasters are intermediates.

## Which years are usable

Fetching found **184** year-services from 1815 to 2025, but only some are worth
anything here:

| Years | What the sheet is | Usable |
|---|---|---|
| 1815 | regional engraving; Hoorn is a ~400 px blob under sea hatching | **no** |
| 1850–1875 | monochrome town plan, block structure legible | blocks only, by hand |
| **1880 onward** | **full-colour Bonneblad, buildings in carmine** | **yes, automatically** |

**The years are validity ranges, not surveys.** 1880/1885/1890/1895/1898 return
byte-identical tiles, as do 1870/1872/1875. Each record carries a `sheet_hash`;
check it before treating two years as independent evidence.

## The limits, stated up front

- **Blocks, not footprints.** LOD 11 (1.5875 m/px) is the finest the service
  publishes. A 5 m house frontage is 3 px — individual houses are not
  recoverable at any amount of cleverness. This is the "schematic massing
  city-wide" end of the project's fidelity decision.
- **Courtyards are filled.** Outer rings only, no holes.
- **Heights are invented** (8.5 m + up to 3 m, hashed per block id). Nothing on
  the sheet records height.
- **`attested_to` is null.** The sheet says a block was there when surveyed. It
  never says when it stopped being there. Do not read the window as a lifespan.

## Roads are the hard part

Roads **cannot be separated from buildings by colour**: a country road's fill
is the same carmine as a building's. Sampled on the 1880 sheet, R−G was 73 and
saturation 80 on a road against 67 and 73 in the historic core — the same ink.

They are rejected by **shape** instead: a component longer than **1000 m** whose
mean width (2·area/perimeter) is under 25 m is a linear map symbol, not a block.

**The threshold was 300 m and that ate the city.** A terrace of houses along a
street is also long and narrow, so the rule deleted building rows as well as
road casings — including a 12,457 m² row at the Roode Steen, the dead centre of
Hoorn. The test that fixes it: *a road rule must not delete anything in the dense
historic core, because the core is buildings.* Area dropped within 900 m of the
core centre:

| rule | dropped in the core |
|---|---|
| len > 300 m | **6.18 ha** ← eating the city |
| len > 600 m | 3.67 ha |
| len > 1000 m | **0.00 ha** ← clean |

At 1000 m it still removes 18.3 ha of genuine rural road, the longest 6 km. The
populations separate cleanly on length: real roads here run 1400–6000 m, the
building rows it used to eat were 570–920 m.

Short road stubs and stretches of the red dotted boundary symbol still get
through. The filter is a heuristic, not a classifier.

## The trace undershoots by half a pixel

`trace_outer` returns pixel **centres**, so every ring runs down the middle of
its boundary pixels and encloses less area than the component actually covers.
For a 3 px wide bar that is about a third of the area. Left uncorrected it
pushed thin blocks under the minimum-area threshold and silently dropped **387
components**. `extract()` grows the ring by half a pixel before simplifying.

## Never close this mask

The first version closed the mask by 2 px to bridge hairlines inside a block.
That quietly welded the entire historic core into **one 25 ha polygon** — 46% of
all built area in a single blob, which is exactly what it looked like on screen.

The streets that separate blocks are only about **4 px wide** at 1.5875 m/px (a
6 m street), so a 5x5 closing kernel closes the streets themselves. Measured on
the core:

| | blocks ≥120 m² | largest |
|---|---|---|
| close 2 px | 77 | **202,396 m²** ← the blob |
| close 1 px | 130 | 34,355 m² |
| no closing | 181 | 14,536 m² ← actual blocks |

The **opening** is what does the useful work: eroding before dilating breaks the
thin ink bridges between blocks, so it separates rather than merges. On the core
it raises the block count from 146 to 181 while costing only 4% of the area.
Whole sheet: **1224 blocks, 89.3 ha, largest 1.35 ha** — 3% of the built area
rather than 46%. Of the 125.9 ha of raw carmine ink, what is discarded is 8.6 ha
to the opening, 8 ha of sub-120 m² specks and 18.3 ha of road, all deliberate.

## Never hardcode the tiling scheme

The blocks sat **78 m** from where they belonged, which is what a misaligned
prison on the Oostereiland looked like on screen.

The cause was a rounded constant. The service publishes LOD 11 as
`1.5875031750063502` m/px; rounding that to `1.5875` looks harmless. It is not,
because the tiling origin is at x = −30,515,500 — **30.5 million metres away**.
Hoorn sits 75,412 tiles from it, so an error of 0.0000032 m/px accumulates to
**61 m in x and 61 m in y**.

`fetch-topotijdreis.mjs` now reads the resolution and the origin from the
service and stores them in the sheet metadata. It also asserts the tile size,
so a scheme change fails loudly rather than silently shifting the city.

**How the maths was convicted rather than the old sheet.** A 19th-century sheet
being loosely georeferenced is entirely plausible, so the offset alone proved
nothing. Fetching the **2025** sheet from the same tile grid settled it: modern
topography must line up with BAG, and it showed the same −60 m displacement. The
error therefore had to be in the conversion, not in the map.

| | offset vs pre-1880 BAG | Dice at zero shift |
|---|---|---|
| before | 78 m | 0.234 |
| after | 11 m | 0.319 |

The 11 m residual is a shallow optimum — 0.342 against 0.319, a 7% gain, versus
47% before — so it is within the noise of comparing whole blocks against
individual footprints, plus whatever slack the 1880 sheet's own georeferencing
carries. Do not chase it without better evidence.

## Verify visually, every time

The extraction is only trustworthy because it was overlaid on the sheet and
looked at — and the blob got through anyway, because the overlay was drawn as
outlines and one polygon wrapping a whole neighbourhood looks much like many.
Filling each block in its own colour showed it instantly. That check is also
what caught the roads — the numbers alone looked
perfectly reasonable at 86 ha. It is the same lesson as
`scripts/experiments/README.md`: a plausible aggregate proves nothing.
