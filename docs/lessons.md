# Lessons

Every substantive error in this project so far has produced a **plausible
number that survived every internal check**. None was caught by the pipeline
noticing something was wrong. Each was caught by an outside reference, or by
looking at the right picture.

This file is the transferable part. Detail lives in `docs/georeferencing.md`,
`data/historic-rasters/README.md`, `data/historic-streets/README.md` and
`scripts/experiments/README.md`; this is the pattern and the checklist.

## The pattern

| What was measured | Looked like | Actually was |
|---|---|---|
| Blaeu facade widths | 3.9 m, "right for canal houses" | 4× too narrow — reading hatching, not gables |
| Blaeu scale bar | 0.267 m/px | 0.32156 m/px — 20% out |
| 1880 built area | 118 ha, plausible for a town of 11,000 | included 64 ha of roads |
| 1880 blocks | 622 blocks, 54 ha | the core was ONE 25 ha polygon |
| 1880 blocks, take two | 913 blocks, 47 ha | only 38% of the source ink survived |
| 1880 georeferencing | fine at a glance | 78 m out |
| Canal registration | Dice rising with scale | "a bigger mask overlaps more" |
| Church-tower RANSAC | residuals 0.9 and 2.5 px | confidently wrong |

Sub-pixel residuals, high autocorrelation and plausible totals are all
compatible with being completely wrong. **Internal consistency is not evidence.**

## Checks that have actually caught things

1. **Compare against an independent source, in different units if possible.**
   House numbering (5.07 m per plot from the address register) caught the facade
   error where every internal metric had passed. Documentary evidence is cheap
   and it fails independently of your image processing.

2. **Measure what fraction of the input survives.** "1880 gives 47 ha" is
   unfalsifiable. "Only 38% of the carmine ink reaches the output" is a
   question with an answer, and it exposed two bugs at once.

3. **Overlay and look — but pick the right rendering.** Outline overlays hide
   exactly the failure where regions merge: one polygon around a whole
   neighbourhood looks like many adjacent ones when you only see edges. Filling
   each feature in **its own colour** showed the blob instantly.

4. **Test a case where you already know the answer.** A 19th-century sheet
   being loosely georeferenced is plausible, so the 78 m offset proved nothing
   on its own. Fetching the **2025** sheet from the same tile grid settled it:
   modern topography must line up with BAG, and it was off by the same 60 m. The
   conversion was convicted, not the map.

5. **Check whether a filter deletes things it obviously shouldn't.** The road
   filter dropped 6.18 ha *inside the historic core*. A rule that removes
   buildings from the middle of a city is wrong regardless of how sensible its
   parameters look.

6. **Distrust an optimum sitting on the search boundary.** It has meant "your
   metric is monotonic, not peaked" every single time — the canal registration,
   the anchored street scan, and the first attempt at measuring the 1880 offset.
   Normalise (Dice, not raw intersection), widen the window, and confirm the
   score falls away on both sides.

## Traps specific to this kind of work

**Never transfer a scale bar between scans by image size.** Two scans of the
same plate are cropped differently — the Rijksmuseum Blaeu sheet carries a wide
paper margin, the kwaad.net one does not (aspect 1.204 vs 1.257). Measure the
bar on the scan you are actually using.

**Never hardcode a tiling scheme.** Rounding LOD 11 from 1.5875031750063502 to
1.5875 moved Hoorn 61 m, because the tiling origin is 30.5 million metres away
and the city is 75,412 tiles from it. Read resolution and origin from the
service, and assert the tile size so a change fails loudly.

**Morphological closing merges the things you are trying to separate.** The
streets between blocks are ~4 px wide at 1.59 m/px, so a 5×5 closing kernel
closes the streets. Opening is the safe direction: it erodes thin bridges before
dilating back.

**Know what your boundary tracer returns.** Moore tracing gives pixel *centres*,
so rings undershoot by half a pixel all round — about a third of the area for a
3 px wide bar. That silently dropped 387 components under a minimum-area filter.

**A strong periodicity is not the right periodicity.** Autocorrelation on a
darkness profile reported 0.75 while locked onto the engraver's hatching inside
each gable, at roughly a quarter of the true house width.

**Fuzzy geocoders always return something.** Asked for "Doelenstraat", a street
that no longer exists, PDOK's locatieserver confidently answers "Kaap Hoorn".
Require the match to share a word with the query, and reject hits implausibly
far from where the thing must have been.

**Modern administrative units are not historical ones.** A BAG *pand* is a
modern amalgamation — 57 of them cover 105 house numbers on Grote Noord — so
their median width measures two or three historic plots and made a correct
reconstruction look 4× wrong.

## Source facts worth not rediscovering

- **Topotijdreis years are validity ranges, not surveys.** 1880/1885/1890/1895/
  1898 return byte-identical tiles, as do 1870/1872/1875. Every sheet we fetch
  records a `sheet_hash` so duplicates are visible.
- Its host moved; there are **184** year-services (1815–2025), not 89.
- **Colour starts in 1880**, not 1924. 1815 is a regional sheet where the whole
  town is a ~400 px blob and nothing can be extracted from it.
- **LOD 11 (1.59 m/px) is the ceiling.** A 5 m frontage is 3 px, so these sheets
  give blocks, never individual houses, and never gates or bastions.
- Hoorn's gates came down on **different dates** — Westerpoort 1806,
  Noorderpoort 1850, the rest resolved 27 June 1871 — so "before the
  fortifications went" is not one cutoff. See `docs/fortifications.md`.

## Writing it down is part of the work

Two of the corrections in this project were to claims made confidently in
earlier commits — including one where the *benchmark* was wrong rather than the
measurement. When a number is superseded, say so in the place the old number
lived, with what it was and why it was wrong. A dead end that is not recorded
gets retried.
