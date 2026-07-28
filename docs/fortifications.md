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

## Suggested approach when we build them

The ring survives in the modern street and water network — Draafsingel is the
former defensive moat — so the fortifications can be anchored the same way the
houses were: to surviving geometry, not by warping a scan. The Oosterpoort
gives one exact fixed point, and the singels give the ring's line. What the old
maps then have to supply is only what the ground no longer shows: where along
the ring each gate sat, and what it looked like.
