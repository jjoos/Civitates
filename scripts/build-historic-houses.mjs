// Turn projected historic street records into geometry the app can render.
//
// Reads data/historic-streets/*.json (produced by project-houses.mjs) and emits
// public/data/hoorn-historic-houses.json in the same LOCAL scene coordinates
// the BAG buildings use, so the two layers line up.
//
//   node scripts/build-historic-houses.mjs
//
// Each house becomes a rectangular footprint: its measured facade width along
// the street, by an assumed plot depth running back from the frontage. The
// facade width is real; the depth and height are stated assumptions, because a
// bird's-eye map gives frontage but not plot depth.
import { readdir, readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../data/historic-streets/', import.meta.url);
const BAG = new URL('../public/data/hoorn-bag.json', import.meta.url);
const OUT = new URL('../public/data/hoorn-historic-houses.json', import.meta.url);

const DEFAULT_DEPTH_M = 12;   // typical Dutch town-house depth; NOT measured
const DEFAULT_HEIGHT_M = 9;   // ~3 storeys to the eaves; NOT measured
// Houses touch exactly, so a uniform height would render the whole terrace as
// one featureless box. Real Dutch terraces step; vary the height a little,
// deterministically per house, so the individual units read. This is a
// STYLISATION for legibility - the eaves height was never measured anyway.
const HEIGHT_VARIATION_M = 1.6;
// Blaeu draws these houses with prominent street-facing gables, so model a
// pitched roof rather than a flat box: the sawtooth roofline is what makes a
// terrace read as individual houses. Ridge runs front-to-back (gable end to
// the street), the standard Dutch arrangement.
const ROOF_PITCH_M = 3.4;
// Neighbours in a terrace share a party wall. Let them touch EXACTLY: the
// shared face is then back-to-back and culled from every exterior view. An
// earlier attempt to inset each house by 12 cm was worse - at normal viewing
// distance those gaps are sub-pixel and alias into heavy speckle.
const PARTY_WALL_GAP_M = 0;

// FNV-1a plus an fmix32 finaliser. The avalanche matters: house ids differ
// only in their last character, and a naive `hash * 31 + charCode` then
// `% 1000` varied by ~5 parts in 1000, making every house the same height.
function hash01(id) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h = (h ^ id.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 3266489909) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;                                // 0..1
}

function houseHeight(id, base) {
  return Math.round((base + (hash01(id) - 0.5) * HEIGHT_VARIATION_M) * 100) / 100;
}

function signedArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

// Direction of travel along the centreline nearest to a given point.
function bearingAt(centreline, rd) {
  let best = null;
  for (let i = 1; i < centreline.length; i++) {
    const a = centreline[i - 1], b = centreline[i];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const d = Math.hypot(mx - rd[0], my - rd[1]);
    if (!best || d < best.d) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      best = { d, u: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] };
    }
  }
  return best.u;
}

const bag = JSON.parse(await readFile(BAG, 'utf8'));
const { originX, originY } = bag;
const toLocal = ([x, y]) => [x - originX, originY - y];

const houses = [];
const sources = new Set();
for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.json'))) {
  const rec = JSON.parse(await readFile(new URL(file, DIR), 'utf8'));
  if (rec.status !== 'projected') continue;

  const depth = rec.plot_depth_m ?? DEFAULT_DEPTH_M;
  const side = rec.side === 'right' ? -1 : 1;
  sources.add(rec.source_id);

  for (const h of rec.houses) {
    const u = bearingAt(rec.street_centreline_rd, h.rd);   // along street
    const n = [-u[1] * side, u[0] * side];                  // away from the street, into the plot
    const halfW = Math.max(h.facade_m / 2 - PARTY_WALL_GAP_M, 0.4);
    // corners: frontage edge then back edge
    const corners = [
      [h.rd[0] - u[0] * halfW, h.rd[1] - u[1] * halfW],
      [h.rd[0] + u[0] * halfW, h.rd[1] + u[1] * halfW],
      [h.rd[0] + u[0] * halfW + n[0] * depth, h.rd[1] + u[1] * halfW + n[1] * depth],
      [h.rd[0] - u[0] * halfW + n[0] * depth, h.rd[1] - u[1] * halfW + n[1] * depth],
    // Round to mm, not decimetres. Neighbours in a terrace share corner
    // coordinates exactly; rounding to 0.1 m pulled those shared corners
    // apart and left sub-pixel slivers that aliased into heavy speckle.
    ].map(toLocal).map(([x, z]) => [Math.round(x * 1000) / 1000, Math.round(z * 1000) / 1000]);

    // Emit the quad in a KNOWN order - front-left, front-right, back-right,
    // back-left - so the renderer can build gable geometry without having to
    // guess which edge faces the street.

    houses.push({
      id: h.id,
      source: rec.source_id,
      street: rec.street,
      attested_from: rec.attested_from ?? rec.source_year,
      attested_to: rec.attested_to ?? null,
      facade_m: h.facade_m,
      eaves: houseHeight(h.id, rec.building_height_m ?? DEFAULT_HEIGHT_M),
      ridge: Math.round((houseHeight(h.id, rec.building_height_m ?? DEFAULT_HEIGHT_M) + ROOF_PITCH_M) * 100) / 100,
      // per-house brick tint, so a terrace of touching houses stays legible
      tint: Math.round(hash01(`${h.id}-tint`) * 1000) / 1000,
      position_confidence: rec.along_street_offset_verified === false ? 'approximate' : 'located',
      quad: corners,
    });
  }
}

const out = {
  originX,
  originY,
  assumptions: {
    plot_depth_m: DEFAULT_DEPTH_M,
    building_height_m: DEFAULT_HEIGHT_M,
    height_variation_m: HEIGHT_VARIATION_M,
    roof_pitch_m: ROOF_PITCH_M,
    party_wall_gap_m: PARTY_WALL_GAP_M,
    note: 'Facade widths are measured from the map. Depth and height are assumptions - a '
      + "bird's-eye map gives frontage but not plot depth or eaves height. Heights are "
      + 'additionally jittered per house so a terrace of touching houses reads as individual '
      + 'units rather than one box; that jitter is legibility, not evidence.',
  },
  sources: [...sources],
  houses,
};
await writeFile(OUT, `${JSON.stringify(out)}\n`);
console.log(`${houses.length} historic houses from ${sources.size} source(s) -> ${OUT.pathname}`);
for (const h of houses) {
  console.log(`   ${h.id.padEnd(30)} ${String(h.facade_m).padStart(5)} m  ${h.street}  [${h.position_confidence}]`);
}
