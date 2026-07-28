# Lessons

Every substantive error in this project so far has produced a **plausible
result that survived every internal check** — a number that looked right, a
build that reported success, a fit that converged. None was caught by the
pipeline noticing something was wrong. Each was caught by an outside reference,
or by looking at the right picture.

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

**Measure the span you found, not the span you searched.** Scaling facade widths
by the 155 px of frontage that was *searched*, rather than the 116.5 px actually
spanned apex-to-apex, inflated every house by 1.33×. The two numbers look
equally reasonable in isolation.

**Survivors are not a random sample.** Only 28 BAG buildings in Hoorn are dated
1600 or earlier, and the principal axis of that point cloud swings from −136° to
61° to 83° as the cutoff moves 1600 → 1650 → 1700. What survived is biased by
what was worth keeping, so a small survivor set is not stable ground truth to
fit against — this is why the house method anchors to **streets**, which survive
for different reasons than buildings do.

## Engineering traps, same species

Measurement is not the only place a wrong answer looks right. These all cost
real time in the same way — the system reported success while doing something
else.

**A failed type-check leaves the previous build in place.** `npm run build` is
`tsc -b && vite build`, so an unused import aborts before Vite runs and `dist/`
silently keeps yesterday's bundle. An isolation test — removing the BAG layer to
see whether an artifact persisted — therefore tested the *old* code and returned
a confident, false "yes, it persists". **If a build step can fail, check it
succeeded before believing what you are looking at.**

**Headless WebGL lies about rendering.** Close-up screenshots from the container
showed heavy speckle on the historic facades. It survived every fix tried —
winding, near/far planes, party-wall gap, coordinate precision, render order,
dev vs production, removing the BAG layer entirely — because it was the
container's software rasteriser (SwiftShader), not the scene. A phone screenshot
settled it in seconds. **Confirm a visual bug on real hardware before chasing
it.**

**An invalid server-side filter can return the wrong thing instead of an
error.** A CQL filter on a property that did not exist did not fail; PDOK
returned a feature for *Buitenland*. Same species as the fuzzy geocoder that
answers "Kaap Hoorn" for a street that no longer exists. **Validate that what
came back is what you asked for** — we now fetch by bbox and filter client-side.

**Paginated APIs have caps that are not errors.** PDOK stops at
`startIndex` 50,000 and simply stops; `fetch-bag.mjs` subdivides the bbox
recursively to get all 50,198 buildings.

**Files in `public/` are not content-hashed.** Vite fingerprints the JS bundle,
but `public/` keeps stable URLs and Pages serves them with `max-age=600`, so a
data-only fix ships a fresh bundle reading **stale JSON**. That is why a
corrected dataset kept rendering as the old one, twice.
`scripts/gen-data-manifest.mjs` hashes each file and appends `?v=`.

**Deploys can fail with no logs at all.** A GitHub Pages run failing instantly
and empty was the `github-pages` **environment's deployment-branch policy** not
listing `main` — not the workflow, not permissions, not the Pages source. Also
worth knowing: an account-level custom domain will redirect
`<user>.github.io/<repo>/` away entirely, which looks exactly like a broken
deploy.

**Axis and sign conventions fail silently and symmetrically.** Two separate
instances: `ExtrudeGeometry` + `rotateX(-90°)` maps a shape point `(x, y)` to
world `(x, ·, -y)`, so ring coordinates must be negated or the whole layer
mirrors in Z; and deriving the Blaeu axes from the compass rose produced a
determinant of −1, a mirrored fit that still "worked". **Check the determinant
of any fitted transform, and check a layer against a known landmark rather than
against its own bounding box.**

**A raw `ShaderMaterial` ignores `logarithmicDepthBuffer`** unless you include
the logdepth shader chunks — enabling it made the historic mesh vanish
altogether rather than fixing depth precision.

**A centroid is usually not the place you want the camera.** The municipal bbox
centre is farmland; the plain vertex centroid of the 1880 blocks is farmland;
the area-weighted centroid is *also* farmland, because most blocks are outlying
farms. What works is the centroid of the **largest** feature — on this sheet the
historic core is one contiguous mass an order of magnitude bigger than anything
else.

**A uniform terrace renders as one featureless box.** Neighbours share party
walls and touch exactly, so nothing separates them visually. Three things fix
it, all stylisation rather than evidence: gabled roofs (the sawtooth roofline is
what actually reads), height jitter, and a per-house tint. And the hash driving
them needs **avalanche** — ids differing only in the last character put through
`hash * 31 + charCode` then `% 1000` varied by about 5 parts in 1000, so every
house came out identical. FNV-1a with an fmix32 finaliser fixed it.

## How the techniques have evolved, and what to combine next

None of these methods arrived working. Each is the residue of a failure, and the
useful ones keep pieces of the ones they replaced. Worth knowing what was
learned rather than just what is current, because the next method will want the
same parts.

**Sampling direction is a parameter, and it has a quality signal.** Sampling a
frontage band *toward the street* gave autocorrelation 0.75; sampling *into the
block* gave 0.29, because the band crossed roof ridges instead of running along
a facade line. That contrast was the first useful quality metric here — and also
the first lesson in its own limits, since 0.75 later turned out to be a
confident lock onto the wrong feature entirely (hatching, not gables). **A
metric that discriminates between parameter values is not thereby validating the
answer.** Keep both halves of that.

**A straight line only tracks a curved street so far.** The frontage sampler
held for about 155 px of a 247 px line before drifting off the block edge; the
street-axis fit is straight while Grote Noord bows 4.1 m off its own chord over
354 m, so the axis stays inside the roadway for the measured stretch and wanders
across blocks beyond it. Current answers: fit the axis from the roadway rather
than drawing it by hand, and restrict to the range where it holds. **Not yet
done: chain overlapping windows into a polyline axis, and have the sampler
refuse stations where it has drifted more than half a roadway width.** That
would turn a silent failure into a reported one.

### Pieces worth combining

The methods in this repo were built separately and overlap more than they
currently exploit:

- **The alignment measurement built for the 1880 offset** (rasterise two layers,
  FFT cross-correlate, Dice, check for falloff) is generic. It is not yet
  pointed at the Blaeu houses, which would give an objective answer to whether
  their assumed along-street position is right.
- **The landmark index** now carries the Blaeu legend keyed a–z, and several of
  those landmarks survive with exact RD coordinates. That is a control-point set
  for the plate that did not exist when georeferencing Blaeu was first abandoned.
- **The house-sequence method** anchors to surviving streets. The fortification
  work needs the same treatment against surviving singels, and the gates need
  the landmark index to say where along the ring each one sat.
- **Colour segmentation** (`segment_map.py`) works on lithographs and was
  written for Van Deventer; the raster block extractor rediscovered much of it
  for Topotijdreis. They should probably be one thing.

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
