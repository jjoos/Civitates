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
