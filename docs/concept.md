# Civitates — Historical Cities in 3D

## Idea

Reconstruct a city's built environment across time, anchored to real
geo-coordinates, using historical sources (maps, paintings, photographs,
written descriptions). The result is a 3D scene that a viewer can navigate
freely, with a time slider that adds/removes/replaces buildings to match the
selected year. Published as a static site on GitHub Pages.

## Why Hoorn

Hoorn is a good first case: a former VOC (Dutch East India Company) port
city with a well-preserved historic core, a rich body of cartography from
the 16th century onward, and — crucially — modern open data (BAG, see
below) covering everything built in the 20th century. It gives us both a
hard historical-reconstruction problem (pre-1800 core) and an easy,
automatable one (post-1900 expansion) in a single, bounded case study.

## Decisions (from initial scoping conversation, 2026-07-25)

- **Geographic scope**: the current municipality of Hoorn — i.e. the
  historic walled core *and* the areas built up between roughly 1950–2000.
  This is a big scope; see "Phasing" below for how we get there
  incrementally instead of boiling the ocean on day one.
- **Fidelity**: mixed. Most of the city is schematic massing (extruded
  footprints, era-appropriate color/material). A small number of
  well-documented landmark buildings (Hoofdtoren, Waag, Grote Kerk, VOC-era
  warehouses, etc.) get higher-detail treatment where sources support it.
- **Time model**: continuous per-building lifespans, not discrete snapshot
  years. Each building carries a real `built`/`demolished` date (or a
  dated range when uncertain), and the slider shows exactly what should
  exist at that year — no synthetic in-between states needed except a
  short cross-fade at the moment a building appears/disappears.
- **Sources so far**: a curated overview of historical plans of Hoorn,
  1545–2000: https://www.kwaad.net/PlansHrn/Hoorn_Historische_Plattegronden.html
  (scanned map images with historical commentary, not georeferenced or
  vector data — useful as a reference and for tracing, not a direct data
  feed). Additional sources to evaluate (see Open Questions).

## Key research finding: BAG solves the modern era almost for free

The Netherlands' cadastral open dataset, **BAG** (Basisregistratie Adressen
en Gebouwen, published via PDOK), contains a footprint polygon *and* a real
`oorspronkelijkbouwjaar` (original construction year) for every building
currently standing in the country. For Hoorn's 1900–2000 expansion —
exactly the part of the scope that would otherwise require the most tedious
manual digitizing — this means we can likely script the data acquisition
almost entirely: pull BAG features inside the municipal boundary, and for
any building whose construction year is 1900 or later, its lifespan start
is already known and its footprint is already accurate.

This only covers buildings that are *still standing today*. It does not
help with: buildings demolished before now, pre-1832 structures (BAG/Kadaster
history doesn't reach that far back), or appearance/material/height (BAG is
2D + a year, not a 3D model). Those still need the historical-map/painting
/photo pipeline below.

## Pipeline (draft)

1. **Source collection** — gather georeferenced or georeferenceable
   historical maps, paintings, photos, and textual descriptions for Hoorn,
   each tagged with a date or date range.
2. **Modern baseline via BAG** — script a pull of BAG building footprints +
   construction years for the municipality; this seeds the post-1900
   dataset directly.
3. **Georeferencing** — for pre-BAG sources, align each historical map scan
   to real-world coordinates (EPSG:28992 / RD New fits the Netherlands
   well) using control points (e.g. QGIS georeferencer against features
   that still exist today, like the city walls' former line or surviving
   towers).
4. **Building/feature extraction** — derive footprints, lifespans, heights,
   and appearance per building: footprints and existence spans from maps,
   facades/heights/materials from paintings and photos, construction/
   demolition dates from text where available.
5. **Data model** — a structured record per building: footprint geometry,
   `built`/`demolished` (each possibly a range with a confidence level),
   height/roof/material, era tag, fidelity level, and source citations.
6. **3D generation** — turn the data model into geometry: procedural
   extrusion from footprints as the schematic baseline, hand-modeled
   meshes for the small set of hero buildings.
7. **Time-aware rendering** — a web renderer (three.js) that filters
   buildings by whether the slider's year falls within their lifespan, with
   a short cross-fade at appear/disappear transitions, plus free camera
   navigation.
8. **Publishing** — static build deployed to GitHub Pages.

## Phasing (to make the full-municipality scope tractable)

The end goal is the whole municipality, but building it in one pass isn't
realistic. Suggested order — each phase produces something viewable:

1. **Scaffold**: repo tooling, coordinate system decision, three.js scene
   with the terrain/water outline and a placeholder slider, deployed to
   GitHub Pages from day one (even with fake data) so the pipeline is
   proven end-to-end early.
2. **Modern layer via BAG**: script the BAG pull for the municipal
   boundary, render every present-day building at its real footprint,
   colored/appearing by real construction year. This alone gives a
   navigable "Hoorn today, built up over time" experience with almost no
   manual modeling.
3. **Historic core, coarse**: georeference 3-4 key historical maps spanning
   the core (e.g. Blaeu 1649, Kadaster 1811-1832, Kuypers 1868), trace
   footprints, assign lifespans, render as schematic massing alongside the
   BAG layer.
4. **Hero buildings**: add higher-fidelity models for a handful of
   well-documented landmarks.
5. **Fill in the gaps**: demolished buildings, uncertain-date structures,
   refine transitions, expand map coverage across the full timeline.

## Open questions

- Beyond the kwaad.net overview, do we have (or should we pursue) access to
  vector/georeferenced historical map sources — e.g. Kadaster's historical
  topographic map viewer, or a local georeferencing effort in QGIS against
  the kwaad.net scans?
- For photos/paintings of demolished or altered buildings (facades,
  heights), which archives are usable — and under what license/rights? This
  matters for what can legally be published on a public GitHub Pages site
  vs. kept as private reference material only.
- Is there a target platform/browser constraint (e.g. must work well on
  mobile), since that affects how much detail/how many buildings can be
  live in the scene at once?
