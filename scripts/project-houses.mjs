// Project a row of historical houses onto a modern street.
//
// This treats an old map as a set of LOGICAL entities rather than as a raster
// to be warped: each house gets an id, houses are ordered along a street, and
// each carries a facade width measured off the map. The street itself is taken
// from present-day data, because streets survive where canals and buildings do
// not. Houses are then distributed along the real street centreline in
// proportion to their facade widths.
//
// Why this beats georeferencing the whole scan:
//   * only RELATIVE facade widths matter, so the map's absolute scale,
//     rotation and even its foreshortening drop out
//   * error stays local to one street instead of contaminating a global fit
//   * it works on bird's-eye views, which are the only maps that actually
//     draw individual houses
//
//   node scripts/project-houses.mjs [street-record.json ...]
//
// Records live in data/historic-streets/. See that directory's README.
import { readdir, readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../data/historic-streets/', import.meta.url);
const BAG = new URL('../public/data/hoorn-bag.json', import.meta.url);

const cumulative = (xs) => xs.reduce((a, x) => (a.push((a.at(-1) ?? 0) + x), a), []);

function polylineLength(pts) {
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push({ from: pts[i - 1], to: pts[i], start: total, len: d });
    total += d;
  }
  return { total, segs };
}

// Point at distance `s` along the polyline, plus the unit normal there.
function alongPolyline(segs, total, s) {
  const d = Math.max(0, Math.min(total, s));
  const seg = segs.find((g) => d <= g.start + g.len) ?? segs.at(-1);
  const t = seg.len === 0 ? 0 : (d - seg.start) / seg.len;
  const x = seg.from[0] + t * (seg.to[0] - seg.from[0]);
  const y = seg.from[1] + t * (seg.to[1] - seg.from[1]);
  const ux = (seg.to[0] - seg.from[0]) / (seg.len || 1);
  const uy = (seg.to[1] - seg.from[1]) / (seg.len || 1);
  return { pos: [x, y], normal: [-uy, ux] };   // left-hand normal
}

async function loadBagRD() {
  const data = JSON.parse(await readFile(BAG, 'utf8'));
  return data.buildings.map((b) => {
    const ring = b.rings[0];
    let sx = 0, sy = 0;
    for (const [x, z] of ring) { sx += x; sy += z; }
    const n = ring.length;
    // local -> RD (inverse of scripts/lib/hoorn-boundary.mjs)
    return {
      id: b.id,
      year: b.year,
      rd: [data.originX + sx / n, data.originY - sy / n],
      // rough frontage proxy: the ring's longest bounding dimension
      size: (() => {
        const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
        return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      })(),
    };
  });
}

function project(record) {
  const houses = record.houses ?? [];
  if (!houses.length) return { ...record, status: 'PENDING: no houses recorded' };
  if (!record.street_centreline_rd?.length) return { ...record, status: 'PENDING: no street centreline' };

  const widths = houses.map((h) => h.facade_width);
  if (widths.some((w) => !(w > 0))) throw new Error(`${record.id}: every house needs a positive facade_width`);

  const { total, segs } = polylineLength(record.street_centreline_rd);
  // A frontage usually covers only PART of a street. Spreading a handful of
  // houses over the whole centreline would invent absurd facade widths, so a
  // record may pin the stretch it actually spans.
  const segStart = record.segment_start_m ?? 0;
  const segLen = record.segment_length_m ?? total - segStart;
  if (segStart < 0 || segStart + segLen > total + 1e-6) {
    throw new Error(`${record.id}: segment ${segStart}..${segStart + segLen} m falls outside the ${total.toFixed(1)} m centreline`);
  }
  const sumW = widths.reduce((a, b) => a + b, 0);
  const ends = cumulative(widths);
  const side = record.side === 'right' ? -1 : 1;
  const offset = record.frontage_offset_m ?? 6;

  const placed = houses.map((h, i) => {
    const midFrac = (ends[i] - widths[i] / 2) / sumW;         // centre of this facade
    const { pos, normal } = alongPolyline(segs, total, segStart + midFrac * segLen);
    return {
      ...h,
      order: i + 1,
      facade_frac: Number((widths[i] / sumW).toFixed(5)),
      facade_m: Number(((widths[i] / sumW) * segLen).toFixed(2)),
      rd: [
        Number((pos[0] + side * normal[0] * offset).toFixed(2)),
        Number((pos[1] + side * normal[1] * offset).toFixed(2)),
      ],
    };
  });

  return {
    ...record,
    street_length_m: Number(total.toFixed(1)),
    segment_m: [Number(segStart.toFixed(1)), Number((segStart + segLen).toFixed(1))],
    houses: placed,
    status: 'projected',
  };
}

// Does a projected historical house plausibly correspond to a surviving one?
function matchBag(record, bag) {
  const tol = record.match_tolerance_m ?? 12;
  const built = record.source_year ?? 9999;
  for (const h of record.houses) {
    const near = bag
      .filter((b) => Math.hypot(b.rd[0] - h.rd[0], b.rd[1] - h.rd[1]) <= tol)
      .map((b) => ({ ...b, dist: Math.hypot(b.rd[0] - h.rd[0], b.rd[1] - h.rd[1]) }))
      .sort((a, b) => a.dist - b.dist);
    // only a building already standing at the map's date can BE this house
    const plausible = near.filter((b) => b.year && b.year <= built);
    h.bag_candidates = near.slice(0, 3).map((b) => ({ id: b.id, year: b.year, dist_m: Number(b.dist.toFixed(1)) }));
    h.bag_match = plausible.length
      ? { id: plausible[0].id, year: plausible[0].year, dist_m: Number(plausible[0].dist.toFixed(1)) }
      : null;
  }
  const matched = record.houses.filter((h) => h.bag_match).length;
  return { ...record, survivors: matched };
}

const args = process.argv.slice(2);
const files = args.length ? args.map((a) => new URL(a.split('/').pop(), DIR))
                          : (await readdir(DIR)).filter((f) => f.endsWith('.json')).map((f) => new URL(f, DIR));
const bag = await loadBagRD();
for (const path of files) {
  const rec = JSON.parse(await readFile(path, 'utf8'));
  let out = project(rec);
  if (out.status === 'projected') {
    out = matchBag(out, bag);
    console.log(`${out.id}: ${out.houses.length} houses spanning ${out.segment_m[0]}-${out.segment_m[1]} m along ${out.street} (centreline ${out.street_length_m} m); ` +
      `${out.survivors} plausibly still standing`);
    for (const h of out.houses) {
      const m = h.bag_match ? `BAG ${h.bag_match.id} (${h.bag_match.year}, ${h.bag_match.dist_m} m)` : '-';
      console.log(`    ${String(h.order).padStart(3)} ${h.id.padEnd(28)} ${String(h.facade_m).padStart(6)} m  ${m}`);
    }
  } else {
    console.log(`${rec.id}: ${out.status}`);
  }
  await writeFile(path, `${JSON.stringify(out, null, 2)}\n`);
}
