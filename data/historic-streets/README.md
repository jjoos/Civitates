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

## Honest status

The projection maths is verified against a synthetic straight street with
known widths (exact recovery of facade metres, positions and side offset).
What is **not** yet done is measuring real facade widths off the Blaeu
engraving — `houses` arrays are empty, and the script reports PENDING rather
than inventing them. Our current Blaeu scan is 1500x1193, where a house is
only ~10 px wide; a higher-resolution scan is likely needed before facade
extraction is reliable.
