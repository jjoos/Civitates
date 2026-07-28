# Gates and fortifications

Hoorn's walls, bastions and gates are gone; the ring survives as singels and
parks. Reconstructing them needs a map drawn **while they still stood**, and
which map that is depends entirely on which gate you want.

## The demolition timeline decides the map

| Gate | Gone |
|---|---|
| Westerpoort (the second one) | **1806** |
| Noorderpoort | **1850** |
| Koepoort | **1871** |
| Oosterpoort | **survives** |
| — | 27 June 1871: the council resolves to demolish *all* the gates |

The Oosterpoort (1578) was itself slated for demolition in **1876** and was
saved by a private gift from a Hoorn citizen plus a state subsidy. It still
stands, which makes it the one gate with an exact modern RD position — and
therefore the natural control point for placing the others.

So:

- **All five gates** → the map must predate **1806**.
- **Koepoort + Noorderpoort + Oosterpoort + the full ring** → 1806–1850.
- **Koepoort + Oosterpoort** → 1850–1871.

The ring itself outlasted the gates as a promenade: on the Topotijdreis
**1836–1849** sheet the western defensive line is already drawn tree-lined, so
the rampart-to-park conversion was under way well before the gates came down.
"Fortifications" and "gates" are two different dates, not one.

## Sources, best first

### 1. Utenwael 1596 — the one to use, and it needs no archive visit

<https://commons.wikimedia.org/wiki/File:Plattegrond_van_Hoorn_Hoorn_in_Westfrijslandt_(titel_op_object),_RP-P-1907-2166.jpg>
· Rijksmuseum RP-P-1907-2166 · **CC0** · **7700×5516, 42.5 MP** · already downloaded

Found by following kwaad.net's own outbound links, which point at Commons for
two sewer maps. kwaad.net publishes everything at 1500 px on the long side —
that is its export size, not the best available anywhere.

This changes the picture completely. The walled city spans about 6580 px for
~950 m, so roughly **0.14 m/px**: 2.2× finer than the Blaeu plate (0.32) and
**7.6× finer than the only Doesjan scan that exists** (1.1). At that resolution:

- **Bastions** are drawn with their earthwork profile, revetment, ditch and the
  guardhouse inside them.
- **Gates** are drawn in elevation — tower, stepped gable, spired turret, the
  bridge across the moat, figures walking through.

And 1596 predates every demolition, the earliest being the Westerpoort in 1806,
so **all the gates are present** — the same coverage Doesjan was wanted for.

It remains a bird's-eye oblique, so it is evidence for **appearance, sequence
and which works existed**, not for footprint geometry. That is the same
trade-off the Blaeu house work already runs on, and the same method applies:
anchor to surviving geometry — here the singels — rather than warping the plate.

### 2. Doesjan 1794 — still the only one that catches every gate *and* is late

Already in `data/sources.json` as `kwaad-doesjan-1794`. A bird's-eye oblique in
the same family as Blaeu 1649, which matters twice over: it draws the gates **in
elevation** (so we get their appearance, not just a footprint), and the
house-sequence method in `data/historic-streets/` transfers to it unchanged.

It carries **two lettered legends**, and the gates are the first entries:

| Key | Legend |
|---|---|
| A | Wester Poort |
| B | Noorder Poort |
| C | Koe Poort |
| D | Ooster Poort |
| E | Oude Ooster- / Gouwse poort |
| F | 't Hoofd |

That is a ready-made index of logical entities — exactly the treatment the
house work uses, applied to gates.

Two details from kwaad.net worth carrying: **north is at the bottom**, and
Schrickx (2011, WAR22) dates the survey to **1796** rather than 1794 — "pas uit
1796 dateert een echt nieuw gemaakte stadsplattegrond". Saaltink (1980) also
warns the map probably flatters the state of the built-up area, which matters
if it is ever used for building counts. The maker is **Adriaan Doesjan**
(Hoorn, 1740–1817).

#### Blocker: no high-resolution scan, and none found

The only scan we have is **1500×1133 (1.7 MP)**. Scaled against the historic
core's real extent (~950 m, from pre-1800 BAG buildings) the city occupies
roughly 800–900 px, i.e. about **1.1 m/px**. A 10 m gate is ~9 px. That is
enough to confirm the gates are drawn and lettered, and nowhere near enough to
measure them: the Blaeu plate that supported facade measurement works out at
0.32 m/px. **Doesjan needs roughly a 5000 px plate — about 3.5× linear on what
we have.**

Searched, without success:

| Where | Result |
|---|---|
| kwaad.net page source | only the 1500 px file; no larger variant linked |
| Wikimedia Commons | no Doesjan *map* — only his trompe-l'œil paintings. (Commons does have far better scans of the OTHER Hoorn plates; see above.) |
| Rijksmuseum | holds two other Hoorn plans, neither is this |
| Archeologie West-Friesland (WAR 93) | reproduces it as a **927×656 crop** — smaller than ours |
| Westfries Archief beeldbank | holds the original; the search is a JS app that ignores query params server-side, so it cannot be queried from here |
| RCE Beeldbank | bot-protected (Anubis) |

So this is the same position as Blaeu before the Rijksmuseum plate turned up,
with one difference: for Blaeu a better scan was publicly downloadable, and for
Doesjan it does not appear to be. The **Westfries Archief** holds the original
(they are credited for the neighbouring Oostwoud 1743 sheet on kwaad.net) and
is the place to request a scan; the Westfries Museum is the second port of
call. This is a request-a-scan job, not a search job.

**But it is no longer blocking.** Utenwael 1596 above carries the gates and the
fortifications at 7.6× the resolution. Doesjan's remaining value is its *date*:
1794 shows the works as they stood two centuries later, after the 17th-century
rebuilding, which Utenwael cannot. Worth asking for when convenient; not worth
waiting for.

### 3. HisGIS Hoorn — the 1832 cadastre, already vectorised

<https://hisgis.nl/projecten/hoorn/> · viewer at `https://hisgis.fa.knaw.nl/?db=hoorn`

The richest thing found: the 1832 cadastral map **already georeferenced and
vectorised**, with separate parcel and building layers, owner data, and
historical backgrounds spanning 1651–1888 (including 1651–54, 1745 and 1888).
Coverage is the modern municipality plus Zwaag, Blokker, Wognum and Berkhout.
The georeferencing was done by Thomas Vermaut.

At 1832 the Westerpoort is already gone, but the Koepoort, Noorderpoort,
Oosterpoort and the entire bastioned ring are present — as *parcels*, which is
the strongest possible form for this project.

**Access is the catch.** There is no public WMS/WFS or download; the viewer is
a bespoke app, and the host returns 403 to our requests. This needs arranging
with HisGIS rather than scraping.

### 4. RCE Beeldbank minuutplans 1811–1832 — the cadastral originals

Cadastral municipality code for Hoorn is **07052**; sheets are identified like
`MIN07052B01` (minuutplan, section B, sheet 01), with matching `OAT…`
*oorspronkelijke aanwijzende tafel* registers naming the owners.

Free, public domain, downloadable in high resolution — **by hand**. The
beeldbank sits behind bot protection, so it cannot be fetched by script. Same
survey as HisGIS layer above, but as raster and un-georeferenced.

### 5. Van Asperen sewer map 1838, and 1842

Already catalogued as `kwaad-sewer-maps-1838-1884`. Town-wide engineering plans
comfortably inside the window. Currently only 960×811, so same scan problem.

## Tested and does not work: Topotijdreis

Checked directly on the 1850 and 1865 sheets at LOD 11 (1.5875 m/px, the finest
published): **gates and bastion detail are not resolvable.** You get block
massing and nothing more — a gatehouse is a handful of pixels. The georeferenced
raster is the right source for built-up extent (see
`data/historic-rasters/README.md`) and the wrong one for structures.

This corrects earlier advice in `data/sources.json`, which said to prefer
tracing the 1811–1832 cadastre from Topotijdreis rather than georeferencing the
scan. True for blocks, false for fortifications.

There are four distinct pre-1880 surveys in the series, if that is ever useful:
1820 (valid 1820–1835), 1836–1849, 1850 (valid to 1864) and 1865 (valid to
1875). 1815 is regional and useless.

## Progress: the ring is readable, the gates are not yet named

`scripts/experiments/rectify_ring.py` straightens the whole enceinte from
Utenwael 1596 into a single strip — **10,224 px** from 17 waypoints, in four
readable pieces. What is visibly present, in the drawing:

- **Round bastions** (*rondelen*), drawn with earthwork profile, revetment,
  ditch, and a guardhouse inside
- **Square wall towers** along the medieval curtain
- **Gates** in elevation — tower, stepped gable, spired turret, bridge over the
  moat
- **Wall-mounted windmills**
- The **palisade / hedge line** beyond the moat

That is more than enough to model from. What is **not** established is which
gate is which.

### Attempted and not resolved: the orientation

Tried, and stopped rather than forced. The plan was to fix orientation from the
church triangle: Hoorn's three medieval churches have known modern positions
(Kerkplein 132817.2/517015.0, Grote Oost 133202.5/517010.0, Kleine Noord
132420.6/517349.2), and from the Grote Kerk the Oosterkerk is due **east** 386 m,
the Noorderkerk **north-west** 518 m and the Hoofdtoren **south-east** 449 m —
distances of 2760, 3700 and 3210 px at this plate's ~0.14 m/px, easily told
apart.

**Only one church is unambiguously identifiable on the plate.** A nine-tile
sweep of the built area found exactly one large church with a tall tower, at
about plate (3800, 2400) — almost certainly the Grote Kerk, since it is the
principal church and the only one Hoorn gave a big tower. The Noorderkerk and
Oosterkerk are hall churches without prominent towers and do not stand out from
the surrounding roofscape at a glance.

One landmark is not enough. Placing that church as a fraction across the city
gives plate (0.51, 0.39) against RD (0.43 W→E, 0.57 S→N), and the four candidate
orientations predict:

| orientation | predicted plate x, y | error |
|---|---|---|
| north up, east left | 0.57, 0.43 | 0.10 |
| north up, east right | 0.43, 0.43 | 0.11 |
| north down, east left | 0.57, 0.57 | 0.24 |
| north down, east right | 0.43, 0.57 | 0.26 |

The best and worst differ by 0.16 of the city width — about **190 m** — which is
inside the error of eyeballing a city outline on an oblique view. The top two
are separated by 0.01. **That does not decide anything**, and note it also sits
awkwardly with the "north at bottom" recorded for this view family in
`docs/georeferencing.md`, which was itself inferred rather than measured.

What would settle it, in order of preference:

1. **Find the Hoofdtoren on the plate.** It survives (Hoofd 2, 133060.65/
   516664.91), it is a large round harbour tower, and it is 449 m SE of the
   Grote Kerk. Two confirmed points fix orientation, scale and handedness
   outright. A first look at the harbour crop did not isolate it among the
   shipping and the pier — it needs a careful pass along the harbour front.
2. **Match the ring outline to the surviving singels.** The CBS *Binnenstad*
   buurt is not the ring — 95.6 ha against the walled city's ~55 ha, because it
   includes the harbour and later ground — so this needs the singel watercourses
   from BRT rather than an administrative boundary.

### Second attempt: three churches found, fit still fails

The user supplied two phone screenshots showing the churches the tile sweep had
missed. Locating them was done by template matching rather than by eye, and the
matcher was validated first on a known crop of the plate — **NCC 0.923 at the
exact position**, collapsing to 0.07 at ±25% scale, which is why the earlier
coarse scale grids found nothing. Both screenshots matched **kwaad.net's 1500 px
Utenwael copies**, not the Rijksmuseum plate, at a consistent scale and away from
any search boundary; the located crops were then confirmed visually against the
hi-res plate.

Church positions on the Rijksmuseum plate:

| church | plate px |
|---|---|
| large, tall tower | 3800, 2400 |
| screenshot A | 6036, 3543 |
| screenshot B | 2791, 2222 |

The RD side also had to be corrected. The first attempt used **street addresses
chosen as proxies** — "Grote Oost 114" for the Oosterkerk — which are not the
churches at all, and the geocoder has no entry for either the Noorderkerk or the
Oosterkerk. Taking the largest old BAG buildings in the core instead gives real
positions: **3132 m² built 1492** at 132639.3/517370.3 (Noorderkerk), **1442 m²
built 1883** at 132866.4/517044.7 (Grote Kerk, rebuilt after the 1878 fire), and
**716 m² built 1519** at 133076.8/516949.3 (Oosterkerk).

With real coordinates on both sides, one of the six assignments wins clearly —
anisotropy **2.88 against 18.66** for the runner-up, a 6.5× gap:

    tall tower = Grote Kerk / screenshot A = Noorderkerk / screenshot B = Oosterkerk

**And it fails its held-out test.** Predicting the Hoofdtoren — deliberately not
used in the fit, and known at 133060.65/516664.91 — puts it at plate (1366, 990),
which is **open sea**, among the ships beside the title cartouche. The Hoofdtoren
is a harbour tower on land.

So the orientation is *still* not established, and this is the same shape of
failure as the church-tower RANSAC: a candidate that wins by a wide margin on
its own metric and is refuted the moment an unused landmark is checked. Two
independent instances now, on two different plates. **Do not accept a fit here
without a held-out landmark.**

What remains suspect, in order: whether the structures picked out inside the two
verified crops are really the Noorderkerk and Oosterkerk rather than nearby
buildings with spires; and whether an affine is adequate at all for this
viewpoint, since three points fit one exactly and leave no residual to inspect.
The next attempt should locate the Hoofdtoren **first**, by eye along the harbour
front, and use it as a fourth point rather than as the test.

### Resolved: the orientation is north at bottom, east at LEFT

The Hoofdtoren was the missing fourth point, and the user identified it: plate
**(2542, 925)**, confirmed by eye as a substantial tower with a stepped gable at
the water's edge with the harbour pier running out from it.

Four points over-determine an affine, so there is finally a residual to read.
Six church assignments were fitted; two are close on RMS and one is physically
impossible:

| assignment | RMS | anisotropy | scales m/px |
|---|---|---|---|
| church1=Grote, church2=**Ooster**, church3=**Noorder** | 21.8 m | **22.16** | 0.858 / 0.039 |
| church1=Grote, church2=**Noorder**, church3=**Ooster** | 28.2 m | **1.47** | 0.217 / 0.148 |

The lower RMS is the degenerate one: an anisotropy of 22 is not a bird's-eye
view, it is a near-collinear squash that reduces residuals by collapsing an
axis. **Lower error, impossible geometry — take the geometry.** The second
option's 1.47 sits in the expected range for an oblique, and its scales bracket
the ~0.14 m/px estimated independently from the city's extent.

That gives:

    church1 = Grote Kerk    church2 = Noorderkerk    church3 = Oosterkerk

and hence the orientation. In RD the Noorderkerk is **north-west** of the Grote
Kerk and the Oosterkerk **east-south-east**; on the plate those are right+down
and left+up respectively. So **plate down is roughly north and plate right is
roughly west — east is at the LEFT.**

This confirms the "north at bottom" recorded for this view family, which had
only ever been inferred, and it matches what Blaeu 1649 was independently found
to do. The two "north up" candidates from the one-landmark attempt are
eliminated.

**Testable consequence, and it holds.** If east is at the left, the Oosterpoort
must be a gate on the *left* side of the ring. There is one, at plate
**~(1150, 3100)** — a building astride the wall with an archway and a bridge
over the moat. The clearest gate found earlier, at (6650, 3800) on the right,
is therefore on the **western** side.

### But do not use this transform to place anything

The fit establishes orientation and nothing more. Leave-one-out errors are
66, 203, 138 and 340 m — mean **187 m** on a city 950 m across — and the
surviving Oosterpoort, never used in the fit, is predicted about 800 px from
the gate that is actually there.

That is not a transform choice that can be tuned. A 1596 engraver drew a
*portrait* of the city, adjusting spacing for legibility; there is no global
affine, projective or otherwise that makes it metric. Buildings drawn in
elevation are displaced by their own height on top of that.

So placement must use the method the rest of this project already uses:
**anchor to surviving geometry and work in stations, not coordinates.** Take the
Oosterpoort as the fixed point, walk the ring with `rectify_ring.py`, and place
each gate by its fractional station along the ring against the surviving
singels — exactly as the houses are placed by station along a surviving street.

### Why naming them is the careful step

The plate is a bird's-eye oblique with north at the bottom, so gate identity
depends on getting the orientation right, and this project has already produced
one confident false match by fitting landmarks on a 16th-century plan without
verifying — see the church-tower RANSAC in `scripts/experiments/README.md`,
which had 0.9 px residuals and was completely wrong.

The anchor to use is the **Oosterpoort**: it survives, so it has an exact RD
position (133446.70, 517126.54) and is the one gate whose plate location can be
confirmed rather than inferred. Everything else should be placed relative to it,
by station along the ring, against the surviving singels — the same
anchor-to-surviving-geometry move the house work uses, with the singels standing
in for the streets.

Do not name a gate from its position on the plate alone.

## Suggested approach when we build them

The ring survives in the modern street and water network — Draafsingel is the
former defensive moat — so the fortifications can be anchored the same way the
houses were: to surviving geometry, not by warping a scan. The Oosterpoort
gives one exact fixed point, and the singels give the ring's line. What the old
maps then have to supply is only what the ground no longer shows: where along
the ring each gate sat, and what it looked like.
