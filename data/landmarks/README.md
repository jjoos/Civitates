# Landmark index

A worklist for collecting history, photographs and paintings against — one
record per landmark, with the slots deliberately left empty. It is **not** a set
of claims about what these buildings were or where they stood.

    node scripts/geocode-landmarks.mjs      # refresh the coordinates

## Where the index came from

The seed is not a modern list of "important buildings in Hoorn". It is the
**map legends themselves**, which are contemporary indexes of exactly this kind,
written by people who could see the buildings:

- **Blaeu 1649**, read at full resolution off Rijksmuseum plate
  RP-P-AO-7-36-1A. Letters **a–z** are buildings and institutions; numbers
  **1–65** are markets, streets and alleys. Only 1–10 are carried here — the
  rest are streets and belong to `data/historic-streets/`. Note the early-modern
  alphabet has no j, v or w, so the letters run a…i, k…u, x, y, z.
- **Doesjan 1794**, letters **A–F**, the gates. G onward is not legible on the
  1500 px scan we have; see `docs/fortifications.md`.

This is the same "logical entities" treatment the house and street work uses,
applied to landmarks: the legend already assigned every building an id, and we
are just carrying it forward.

## Record shape

```json
{
  "id": "hoofdtoren",
  "name": "Hoofdtoren",
  "type": "tower-harbour",
  "status": "standing",
  "built": 1532,
  "demolished": null,

  "history": "",        // ← to fill, with a citation
  "images": [],         // ← to fill
  "paintings": [],      // ← to fill
  "links": [],          // ← to fill

  "map_references": [
    { "source": "kwaad-blaeu-1649",   "key": "e", "label": "'t Hooft en inganck van d'oude havens" },
    { "source": "kwaad-doesjan-1794", "key": "F", "label": "'t Hoofd" }
  ],
  "locate_query": "Hoofd 2 Hoorn",
  "rd": [133060.65, 516664.91],
  "position_confidence": "building",
  "identification_confidence": "certain"
}
```

`map_references` is the useful part for collecting: it says which historical
maps depict the landmark and under what name, so a search has something
concrete to go on. Historical spellings are what archives are catalogued under —
"'t Hooft", not "Hoofdtoren".

## The two confidence fields, and why they are separate

They fail independently, so they are recorded independently.

**`position_confidence`** — do we know *where*?

| Value | Meaning |
|---|---|
| `building` | the query named a specific address |
| `street` | only the street is known; this is its **centroid** |
| `unlocated` | no defensible query; left null rather than guessed |

**A street centroid is not the building.** It is good enough to hang a
photograph off and nowhere near good enough to model. Nineteen of 36 records are
located, and most of those are `street`.

**`identification_confidence`** — do we know *what*?

| Value | Meaning |
|---|---|
| `certain` | verified this session (the gates, from documented demolition dates) |
| `probable` | a standard identification, not independently checked here |
| `unidentified` | legend entry transcribed off the plate, not yet matched to a site |

Thirteen records are `unidentified` — the four markets (*Visch*, *Paerde*,
*Kooren*, *Vercken*), the *Gaaren en Lindemarct*, both India-trade warehouses,
and *Boschuys gevankenis*, *Rusthuys*, *Fabricks huys*, *Pesthuys*, *H.H. Staten
logement*, *Water poort*. Their ids are `blaeu-<key>` until someone matches them
to a site. The legend text is evidence; the modern location is not known. Those
are the most interesting entries to research, not the least.

## Geocoding is derived, not typed

Coordinates come from `scripts/geocode-landmarks.mjs` against PDOK's
locatieserver, and the script records what it matched. Two guards exist because
both failures actually happened:

- **Fuzzy-match guard.** The locatieserver always returns *something*: asking it
  for "Doelenstraat", a street that no longer exists, confidently answers "Kaap
  Hoorn". A match must share a word with the query.
- **Distance guard.** Every landmark in these legends stood inside a walled town
  about 950 m across, so a hit more than 900 m from the historic core centre is
  rejected. This caught "Westerdijk", a dijk running kilometres west whose
  centroid sits 1.4 km out — not where the Westerpoort was. The core centre is
  itself derived, from the 323 pre-1800 BAG buildings.

Two results are worth knowing as a cross-check: the Hoofdtoren and the
Oosterpoort geocode to 133060.65/516664.91 and 133446.70/517126.54, matching the
control-point table in `docs/georeferencing.md` to the decimetre. Those were
recorded independently, so the agreement is real corroboration.

## What is missing

- 17 records unlocated, 7 unidentified.
- Doesjan's legend beyond F, which needs a better scan.
- Bastions and rampart works are not here at all. The Blaeu legend does not name
  them individually, though street names still do — `Vale Hen` geocodes cleanly
  and is a bastion name. Worth a pass once `docs/fortifications.md` has a source
  that draws them.
- Nothing is dated except the gates. `built` and `demolished` are null rather
  than guessed.
