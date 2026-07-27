// Fill in RD coordinates for the landmark index from PDOK's locatieserver.
//
//   node scripts/geocode-landmarks.mjs [--dry]
//
// Coordinates are DERIVED, never typed in by hand: each record carries a
// `locate_query` and this script resolves it, writing back the result together
// with what it matched and how well. Re-run it and you get the same answer, or
// a visibly different one — which is the point.
//
// `locate_kind` states what the query can actually pin down, and the resulting
// `position_confidence` is deliberately pessimistic:
//
//   address  -> "building"  the query names a specific address
//   street   -> "street"    only the street is known, so this is its centroid,
//                           which for a demolished building is the honest limit
//   (none)   -> "unlocated" left alone; no query means no guess
//
// A street centroid is NOT the building. Anything marked "street" is a
// placeholder good enough to hang photographs off and not good enough to model.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../data/landmarks/landmarks.json', import.meta.url);
const BAG = new URL('../public/data/hoorn-bag.json', import.meta.url);
const ENDPOINT = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';

// Every landmark in these legends stood inside the walled town, which measures
// about 950 m across. A hit much further out than that is the search engine
// being helpful rather than right — "Westerdijk" is a dijk running kilometres
// west and its centroid sits 1.4 km from the core, which is not where the
// Westerpoort was. Reject rather than record a plausible-looking wrong answer.
const MAX_FROM_CORE_M = 900;

/** Centre of the historic core, derived from pre-1800 BAG buildings. */
async function historicCore() {
  const bag = JSON.parse(await readFile(BAG, 'utf8'));
  let sx = 0, sy = 0, n = 0;
  for (const b of bag.buildings) {
    if (!b.year || b.year >= 1800) continue;
    const ring = b.rings[0];
    let x = 0, y = 0;
    for (const [px, pz] of ring) { x += px; y += pz; }
    sx += bag.originX + x / ring.length;
    sy += bag.originY - y / ring.length;
    n++;
  }
  return { x: sx / n, y: sy / n, n };
}

const STOP = new Set(['hoorn', 'de', 'het', 'van', 'der', 'den']);
const tokens = (s) =>
  s.toLowerCase().replace(/[^a-zà-ſ0-9 ]/g, ' ').split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));

async function geocode(query, kind) {
  const url = `${ENDPOINT}?${new URLSearchParams({ q: query, rows: '10', fq: 'gemeentenaam:Hoorn' })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${query} -> HTTP ${res.status}`);
  const docs = (await res.json()).response?.docs ?? [];

  // The locatieserver is a fuzzy search and always returns SOMETHING. Asking it
  // for a street that no longer exists cheerfully answers with an unrelated one
  // ("Doelenstraat" -> "Kaap Hoorn"), so require the match to actually share a
  // word with the query. Without this the index fills up with confident nonsense.
  const want = tokens(query);
  const related = (d) => {
    const got = tokens(d.weergavenaam ?? '');
    return want.some((w) => got.some((g) => g === w || g.startsWith(w) || w.startsWith(g)));
  };

  // Honour what the record asked for: a street query wants the STREET centroid,
  // not whichever house number the search happens to rank first. Picking an
  // arbitrary address off the right street looks precise and is not.
  const rank = kind === 'address' ? { adres: 0, postcode: 1, weg: 2 } : { weg: 0, adres: 1, postcode: 2 };
  const candidates = docs
    .filter((d) => d.type in rank && d.centroide_rd && related(d))
    .sort((a, b) => rank[a.type] - rank[b.type]);
  for (const hit of candidates) {
    const [x, y] = hit.centroide_rd.match(/-?\d+\.?\d*/g).map(Number);
    const away = Math.hypot(x - core.x, y - core.y);
    if (away > MAX_FROM_CORE_M) {
      rejected.push(`${query} -> ${hit.weergavenaam} (${Math.round(away)} m from the core)`);
      continue;
    }
    return {
      rd: [Number(x.toFixed(2)), Number(y.toFixed(2))],
      matched: hit.weergavenaam, type: hit.type, from_core_m: Math.round(away),
    };
  }
  return null;
}

const rejected = [];
const dry = process.argv.includes('--dry');
const core = await historicCore();
console.log(`historic core centre ${core.x.toFixed(0)}, ${core.y.toFixed(0)} (from ${core.n} pre-1800 BAG buildings)\n`);
const data = JSON.parse(await readFile(FILE, 'utf8'));
let located = 0;
let skipped = 0;

for (const l of data.landmarks) {
  if (!l.locate_query) {
    l.rd = null;
    l.position_confidence = 'unlocated';
    skipped++;
    continue;
  }
  const hit = await geocode(l.locate_query, l.locate_kind);
  if (!hit) {
    l.position_confidence = 'unlocated';
    console.log(`  ${l.id.padEnd(24)} NO MATCH for "${l.locate_query}"`);
    skipped++;
    continue;
  }
  l.rd = hit.rd;
  l.position_confidence = l.locate_kind === 'address' ? 'building' : 'street';
  l.geocode = {
    query: l.locate_query, matched: hit.matched, result_type: hit.type,
    from_core_m: hit.from_core_m, source: 'PDOK locatieserver v3_1',
  };
  located++;
  console.log(`  ${l.id.padEnd(24)} ${l.position_confidence.padEnd(9)} ${hit.rd.join(', ')}  <- ${hit.matched}`);
}

data.geocoded_at_utc = new Date().toISOString().slice(0, 10);
data.located_count = located;
if (!dry) await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`\n${located} located, ${skipped} left unlocated${dry ? ' (dry run, nothing written)' : ''}`);
if (rejected.length) {
  console.log(`\nrejected as too far from the historic core (>${MAX_FROM_CORE_M} m):`);
  for (const r of rejected) console.log(`  ${r}`);
}
