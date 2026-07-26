# Georeferencing experiments

Exploratory scripts for getting control points onto pre-1600 town plans
without hand-picking pixels (which produced a wrong answer on Blaeu 1649).
Python rather than Node because these lean on numpy/scipy/Pillow:

    pip install pillow numpy scipy

## segment_map.py — WORKS, reusable

Splits a coloured historical plan into its canal/moat network and its
building blocks by ink colour. On Van Deventer 1560 it cleanly recovers the
whole canal network and the block structure, which is a solid basis for
tracing footprints or building visual overlays.

    python3 scripts/experiments/segment_map.py vandeventer-1560.jpg /tmp/vd1560

## Automatic canal registration — TRIED, DOES NOT WORK

Segment the 1560 canal network, segment the modern canal network from PDOK's
BRT "water" tiles, then grid-search scale (0.55-1.35 m/px) and rotation
(±6°) with FFT cross-correlation solving translation exhaustively, scoring by
Dice overlap.

Result: peak Dice only **0.16**, and the score rose monotonically with scale
instead of showing a distinct peak — the signature of "a bigger mask overlaps
more", not of a real match.

Cause is historical, not technical: **most of Hoorn's 1560 canals no longer
exist.** The Gedempte Turfhaven ("filled-in turf harbour") is the obvious
case, and the harbour was rebuilt wholesale after 1600. Segmentation quality
was fine — there simply is not enough surviving shared structure to register
against. Do not retry this against present-day data.

The same method against the **georeferenced TOPraster ~1815** sheet is worth
trying, because most canals were still open then. See `docs/georeferencing.md`.

## TOPraster ~1815 bridge — blocked

Fetched the georeferenced 1815 sheet successfully (ArcGIS tile service
`Historische_tijdreis_1815`, EPSG:28992, LOD 11 = 1.5875 m/px; the service
directory lists 89 historical years). Two problems:

- It is a **monochrome engraving**, so the colour segmentation that works on
  the Van Deventer lithograph cannot separate water from land on it.
- Colour only appears in the series from about **1924** onward — far too late
  to still show the 1560 canal layout.

The tile-fetch recipe is worth keeping even so; the service is the right
source for any later-period work.

## Church-tower matching — produced a CONFIDENT FALSE MATCH

The professional method (church towers as control points) applied
automatically: detect dark church-like symbols on the 1560 plan, then
RANSAC over candidate pairs — each pair hypothesises the
Noorderkerk-Oosterkerk baseline, fixing scale, rotation and offset — and
score by whether the two *unused* landmarks (Grote Kerk, Hoofdtoren) have
symbols where predicted.

Hoorn has four landmarks that existed in 1560 and still stand: Noorderkerk,
Grote Kerk, Oosterkerk (all 15th century) and the Hoofdtoren (1532). The
three churches are nearly collinear, so the tower is required to condition
the fit.

The top hypothesis looked excellent — score 1.52 against 0.96 for the
runner-up, with the two independent landmarks landing **0.9 px and 2.5 px**
from detected symbols. **It was wrong.** `verify_fit.py` showed the warped
modern canals scattered across open fields instead of following the drawn
canals, all four landmarks bunched into one small patch instead of spanning
the city, and the harbour tower placed inland.

Re-running with the search properly constrained (scale 0.80-1.10 m/px,
rotation ±3.5°, and requiring the Hoofdtoren to land on drawn water) found
**no** good match at all: the best candidate missed the Grote Kerk by 60 px,
and every alternative misplaced the Hoofdtoren by 100-250 px. The symbol
detector is not reliably finding the actual churches.

Two lessons worth keeping:

1. **Sub-pixel residuals prove nothing** on a small control-point set. A
   4-point fit can be self-consistent and still be a coincidence.
2. **Always run `verify_fit.py`.** It is the only step in this whole
   exercise that has actually caught a wrong answer.
