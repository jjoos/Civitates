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

### Facades, not footprints

**This is the important one.** A bird's-eye engraver stood off the town and drew
the *street elevation* — the row of gables. He could not see how far back the
plots ran, and did not draw it. Tracing a house *outline* therefore asks the
tracer to draw a line nobody ever observed, and silently mixes a measurement
(the frontage) with an invention (the depth) in a single polygon that no longer
distinguishes them.

Van Deventer is the precedent. He measured street lines and facade widths, and
re-measured them; his depths were guesswork. That distinction survives because
he kept it. Ours should too.

So the default tool is `facade`, and a facade is a **run**: you tap the party
walls straight along a terrace, and *n*+1 taps give *n* houses. The divisions
are shared because they are literally the same point, not two points that
happen to coincide. Depth lives in one field on the run, marked as the guess it
is, and nothing downstream can mistake it for something observed.

Use `house` only where the source genuinely shows a footprint — a cadastral
plan, a measured survey.

Two checks run while you trace. Each house's width in source pixels is printed
on the run, and a house far wider than the rest of its row is flagged in the
panel, because a missed party wall and one wide house look identical. The
threshold is 1.75× the row's **median**: the median because an outlier drags the
mean toward itself and can hide behind it, and 1.75 rather than 2 because a
terrace of near-equal houses with one division missed produces a house of
*exactly* twice the median — the commonest mistake lands precisely on a 2×
threshold and slips through.

To fix a run: tap anywhere on it to add a party wall, or press ⌫ on a row in
the panel to merge that house into the one before it.

### Attaching a run to a street

Set **fronts onto** in the panel. Which side of the street the row sits on is
*derived* from the geometry, not asked — you already said it by drawing the run
where you did.

Attachment is what makes the widths metric. Put `control` points on two vertices
of that street, give them RD coordinates, and `ingest-trace.mjs` converts every
frontage on it into metres using a scale **local to that street**. That is the
only kind of scale a portrait plate has: no global transform fits Utenwael, but
over a couple of hundred metres along one street the scale is near enough
constant. It is the same assumption the Blaeu frontage work already runs on.

Anchor a *straight* stretch. RD distance is measured straight while the plate
distance is measured along the street, so a bend between the anchors makes the
scale an underestimate; the script reports the bend ratio and warns above 1.02.

### Feature kinds

| kind | shape | what it is for |
|---|---|---|
| `facade` | run | **the default.** A terrace's frontage, tapped at the party walls: each segment is one house |
| `house` | area | a real footprint, from a source that actually shows one |
| `block` | area | an island where individual houses are not separable at all |
| `street` | path | centreline, in the direction of increasing house numbers where known |
| `wall` | path | curtain wall, rampart, palisade |
| `water` | area | harbour, canal, moat |
| `landmark` | point | a named building whose position matters but whose footprint does not |
| `control` | point | **the only place ground truth enters**: carries an `rd` pair |

`rd` is `[x, y]` in EPSG:28992 and is only meaningful on `control` features. It
is what the fitting step consumes. Facade runs additionally carry `houses` (one
record per segment, so `houses.length === points.length - 1`), `streetId`, and
`depthM`.

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
| tap a selected run | add a party wall there |
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
file when you stop**, and commit that file. The plate image itself is *not*
stored — a 42 MP scan will not fit — so after a reload you re-open the image
and the trace is still there, checked against its hash.

The layout collapses to a single column below 820 px, because tracing on a
tablet with a stylus is a genuinely better way to do this than a mouse.

## Checking a trace

```sh
node scripts/ingest-trace.mjs utenwael-1596-trace.json
```

It reports what the file contains, flags degenerate geometry (closed rings with
no area, paths with one point, runs whose house records do not match their
divisions), measures every facade run, and — given four or more control points —
fits an affine to RD and interrogates it.

For each run it prints the house widths in pixels, and in metres wherever the
street is anchored, with the mean and total. It re-runs the wide-house check
there too, flags houses under 2.5 m as narrower than a real frontage, and
compares the overall mean against Hoorn's independently measured 4.91 m — a
figure corroborated at 5.07 m per plot by house numbering. A mean far from that
usually means the anchors are wrong, not the houses.

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

1. Trace the streets first, then the frontages along them, attaching each run to
   its street as you go.
2. Add control points: on street vertices that still exist, to make those
   streets metric, and — if the plate might be metric as a whole — at least four
   spread across it on identifiable landmarks.
3. Run `ingest-trace.mjs`. Read the per-run metres before the verdict; a run
   whose houses come out at 12 m or 2 m is telling you about the anchors.
4. Place the houses. If the fit is `usable`, the transform puts the frontages
   straight into RD. If it is `ORIENTATION ONLY`, use the runs the way the Blaeu
   frontages were used — an ordered sequence of widths laid out by arc length
   against the surviving modern centreline. See
   [docs/georeferencing.md](georeferencing.md).
5. Extrude backwards by `depthM` only at the point of building geometry, and
   keep it labelled as an assumption wherever it surfaces.

An `ORIENTATION ONLY` verdict is not a failed trace. The Blaeu work produced
real, corroborated house positions from a plate no affine will ever fit, and it
did it from exactly this data: an ordered run of frontage widths against a
street that still exists.
