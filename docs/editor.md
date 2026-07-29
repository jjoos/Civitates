# The tracing editor

A browser tool for drawing houses, streets, walls and water on a historical
plate by hand, and exporting them as structured data.

Open it at `/editor.html` (`npm run dev`, then <http://localhost:5173/editor.html>;
on the published site, `/Civitates/editor.html`).

## Why it exists

Everything else in this repository extracts geometry from a plate by machine:
segment the carmine ink, trace the block boundaries, autocorrelate the facade
rhythm. That works on *printed* sheets with flat colour — the 1880 Bonneblad
gave 1224 blocks that way.

It fails on engravings. A 1596 bird's-eye view of Hoorn has roofs drawn in
perspective, hatching at the same spatial frequency as the houses themselves,
and no colour separation at all. [docs/lessons.md](lessons.md) records what
happened when the machine was asked to read one anyway: the facade
autocorrelation locked onto the engraver's hatching and returned houses a
quarter of their true width, and identifying a single named building in the
dense plate went wrong twice — once picking the wrong church, once producing an
"orientation" that placed the Hoofdtoren in open sea.

The split that actually works is the one that file names: **mark by hand,
measure by machine.** A human can see in one second which roof is the
Hoofdtoren; deriving a width, an axis, or a transform from a marked point is
arithmetic, and arithmetic is reliable. This editor is the marking half.

## What it produces

A JSON file. One plate per file:

```json
{
  "source": { "id": "utenwael-1596", "label": "05A_Hoorn_Utenwael_1596.jpg",
              "width": 7700, "height": 5516, "imageHash": "67f58833924f1e94" },
  "crs": "source-pixels",
  "features": [
    { "id": "house-0001", "kind": "house", "label": "", "closed": true,
      "points": [[3312, 2088], [3355, 2081], [3361, 2140], [3318, 2147]],
      "notes": "", "rd": null, "createdAt": "2026-07-29T…" }
  ],
  "savedAt": "2026-07-29T…"
}
```

### Coordinates are source-image pixels. Always.

`crs` is `source-pixels` and there is no way to make it anything else. Not
metres, not RD, not a normalised 0–1 box. This is the central design decision
and it is worth being stubborn about:

- A 16th-century town view **is not metric**, and no global transform makes it
  so. The best affine fit over Utenwael 1596 has a leave-one-out error of 187 m
  on a city 950 m across. Storing metres would mean storing that error, baked
  in and unrecoverable.
- Pixel coordinates are *checkable*. Anyone with the same scan can reopen the
  trace, see the outline land exactly on the roof, and correct it.
- Georeferencing is a separate, arguable, revisable step. Different plates
  need different treatments — a global affine for a survey sheet, stations
  along surviving geometry for a portrait. Keeping the tracing free of that
  choice means a better method later does not require re-tracing.

`imageHash` is the SHA-256 of the image bytes (first 16 hex chars). It exists
so a trace can be *proven* to belong to a particular scan. Pixel coordinates
are meaningless against a different crop or a different resolution of the same
map, and that mismatch is invisible — a trace against the 1500 px copy laid
over the 7700 px copy looks like a georeferencing error, not a file mix-up.
The editor warns when you load an image whose hash differs from the one the
current features were drawn on.

### Feature kinds

| kind | shape | what it is for |
|---|---|---|
| `house` | area | one dwelling, as the engraver drew it |
| `block` | area | a whole terrace or island where individual houses are not separable |
| `street` | path | centreline, in the direction of increasing house numbers where known |
| `wall` | path | curtain wall, rampart, palisade |
| `water` | area | harbour, canal, moat |
| `landmark` | point | a named building whose position matters but whose footprint does not |
| `control` | point | **the only place ground truth enters**: carries an `rd` pair |

`rd` is `[x, y]` in EPSG:28992 and is only meaningful on `control` features. It
is what the fitting step consumes.

## Using it

Load an image with the file button or by dropping it on the window. Pick a
tool, then tap to place vertices.

| | |
|---|---|
| tap | add a vertex |
| Enter / **Finish** | close the ring or end the path |
| Esc | discard the shape in progress |
| Backspace | remove the last vertex |
| shift-tap | select an existing feature |
| drag a white handle | move that vertex |
| drag elsewhere | pan |
| wheel / pinch | zoom |
| `f` | fit the whole plate to the window |
| ⌘Z / Ctrl-Z | undo (80 deep) |
| Delete | delete the selected feature |

Vertices snap to any existing vertex within 12 screen pixels. That matters more
than it sounds: adjoining houses share a party wall, and a shared wall that is
*nearly* shared leaves slivers that every downstream area calculation has to
cope with.

Work is written to `localStorage` after every change, so a reload or a closed
tab does not lose hours of tracing. It is still browser storage — **export to a
file when you stop**, and commit that file.

The layout collapses to a single column below 820 px, because tracing on a
tablet with a stylus is a genuinely better way to do this than a mouse.

## Checking a trace

```sh
node scripts/ingest-trace.mjs utenwael-1596-trace.json
```

It reports what the file contains, flags degenerate geometry (closed rings with
no area, paths with one point), and — given four or more control points — fits
an affine to RD and interrogates it.

The interrogation is the point. Every check in it exists because something got
past the obvious ones:

- **It refuses to fit three control points.** An affine has six parameters, so
  three points determine it exactly, leaving a residual of zero that proves
  nothing whatsoever.
- **It reports how the control points are arranged** before fitting. Points
  strung along one street fit perfectly and predict nothing to either side.
  Elongation above 8:1 gets a warning.
- **It reports leave-one-out error**, which is the only honest accuracy figure
  when there are five points and six parameters. On a degenerate layout the RMS
  reads 0.0 m and leave-one-out reads 2650 m.
- **It reports anisotropy** and rejects above 3:1. A near-collinear squash
  lowers the residual by collapsing an axis; a fit with RMS 21.8 m once beat
  one with 28.2 m while being geometrically impossible, and anisotropy — 22
  against 1.47 — was what separated them.
- **It reports the determinant.** Image *y* runs downward and RD *y* runs
  north, so an ordinary north-up plate gives a *negative* determinant; a
  positive one means mirrored, or north is not up.

Verdicts are `REJECT`, `ORIENTATION ONLY`, or `usable` — and `usable` still
says to check a landmark that was not in the fit, because a fit is only ever
tested by what it was not fitted to.

## Where a trace goes next

Nothing consumes traces automatically yet, and that is deliberate — the
georeferencing method should be chosen per plate rather than assumed. The
sequence is:

1. Trace the plate, including at least four control points on features that
   still exist and can be given RD coordinates (church towers, surviving gates,
   street junctions).
2. Run `ingest-trace.mjs` and read the verdict.
3. If `usable`, apply the transform to the traced houses to get footprints in
   RD. If `ORIENTATION ONLY`, use the trace the way the Blaeu frontages were
   used — as an ordered sequence of facade widths along a street, laid out by
   arc length against the surviving modern centreline. See
   [docs/georeferencing.md](georeferencing.md).

An `ORIENTATION ONLY` verdict is not a failed trace. The Blaeu work produced
real, corroborated house positions from a plate no affine will ever fit.
