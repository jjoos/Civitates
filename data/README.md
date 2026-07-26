# Sources catalog

`sources.json` is the reference catalog of historical and open-data sources
for reconstructing Hoorn — separate from `public/data/`, which holds
processed data the running app actually fetches. This file is for people
(and scripts) doing the digitizing/georeferencing work: a place to look up
what a source is, where it came from, and whether it's usable yet.

## Schema

Each entry:

- `id` — stable slug, referenced later from building records (`sources: [id, ...]`)
  once phase 3 starts assigning per-building citations.
- `title` — human-readable name.
- `type` — `"map"`, `"vector-dataset"`, `"raster-basemap"`, `"painting"`, `"photo"`, or `"text"`.
- `year` — a single year, or `"start-end"` for a range/series.
- `publisher` — who made/hosts it.
- `url` — where to find it.
- `license` — rights notes; for old maps this is usually "public domain
  (age)" but the specific scan/digitization may carry its own terms —
  worth checking per-source before republishing anything (not just tracing
  from it).
- `status` — where it stands in our pipeline:
  - `"ingested"` — already pulled into `public/data/` by a script.
  - `"georeferenced"` — has real-world coordinates already (from the
    publisher), ready to trace footprints from directly.
  - `"needs-georeferencing"` — usable, but someone has to align it to real
    coordinates first (control points in QGIS) before footprints can be traced.
  - `"reference-only"` — background/context, not itself a geometry source.
- `notes` — anything else worth knowing.

## Adding a source

Append an entry to `sources.json`. Don't remove or renumber existing `id`s
once a building record could plausibly cite one.
