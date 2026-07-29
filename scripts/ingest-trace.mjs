// Read a trace exported from the editor, report what is in it, and — if it
// carries enough control points — fit and CHECK a transform to RD.
//
//   node scripts/ingest-trace.mjs utenwael-1596-trace.json
//
// The fit is the part that needs care, and this script exists mostly to stop
// the mistakes docs/lessons.md records:
//
//   * it refuses to fit with exactly the minimum number of points, because a
//     fit with no residual always looks perfect and tells you nothing;
//   * it reports PER-POINT residuals and leave-one-out error, not just RMS;
//   * it rejects a transform whose geometry is impossible even when the RMS is
//     good — an anisotropy of 22 beat 1.47 on RMS once, by collapsing an axis;
//   * it checks how the control points are ARRANGED before trusting the fit:
//     points strung along a line fit any number of transforms equally well, and
//     report a perfect residual while predicting nothing off that line;
//   * it prints the determinant, because a mirrored fit is self-consistent and
//     wrong.
import { readFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path) {
  console.error('usage: node scripts/ingest-trace.mjs <trace.json>');
  process.exit(1);
}
const trace = JSON.parse(await readFile(path, 'utf8'));
if (trace.crs !== 'source-pixels') {
  console.error(`${path}: crs is "${trace.crs}", expected "source-pixels"`);
  process.exit(1);
}

const { source, features } = trace;
console.log(`${source.label || source.id}  ${source.width}x${source.height}  (hash ${source.imageHash ?? '—'})`);

const byKind = new Map();
for (const f of features) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f]);
console.log(`${features.length} features:`);
for (const [k, list] of [...byKind].sort()) {
  const verts = list.reduce((a, f) => a + f.points.length, 0);
  const unlabelled = list.filter((f) => !f.label).length;
  console.log(`   ${k.padEnd(9)} ${String(list.length).padStart(4)}   ${verts} vertices` +
    (unlabelled ? `   (${unlabelled} unlabelled)` : ''));
}

// --- geometry sanity, per feature
const problems = [];
for (const f of features) {
  if (f.closed && f.points.length < 3) problems.push(`${f.id}: closed ring with ${f.points.length} points`);
  if (!f.closed && f.kind !== 'landmark' && f.kind !== 'control' && f.points.length < 2) {
    problems.push(`${f.id}: path with ${f.points.length} points`);
  }
  if (f.closed && f.points.length >= 3 && Math.abs(ringArea(f.points)) < 1) {
    problems.push(`${f.id}: ring encloses no area (collinear?)`);
  }
}
if (problems.length) {
  console.log(`\n${problems.length} geometry problem(s):`);
  for (const p of problems) console.log(`   ${p}`);
}

// --- control points
const cps = features.filter((f) => f.kind === 'control' && Array.isArray(f.rd) && f.points.length);
console.log(`\n${cps.length} control point(s) with RD coordinates`);
for (const c of cps) {
  console.log(`   ${c.id}  ${c.label || '(unlabelled)'}  px ${c.points[0].map(r2).join(', ')}  ->  RD ${c.rd.join(', ')}`);
}

if (cps.length < 4) {
  console.log('\nNot fitting a transform: an affine has 6 parameters, so 3 points fit it');
  console.log('EXACTLY and leave no residual to inspect. Add a 4th control point — that');
  console.log('is precisely what turned the Utenwael orientation from a guess into a result.');
  process.exit(0);
}

// --- how are the control points ARRANGED?
// Five points along a street fit an affine perfectly and predict nothing to
// either side of it. The residual cannot show this — it is a property of the
// point layout, not of the fit — so measure it separately, before fitting.
const spread = pointSpread(cps.map((c) => c.points[0]));
console.log(`   layout: spread ${spread.s1.toFixed(0)} x ${spread.s2.toFixed(0)} px` +
  `   elongation ${(spread.s1 / spread.s2).toFixed(1)}`);
if (spread.s1 / spread.s2 > 8) {
  console.log('   WARNING — these points lie nearly along a line. The fit below will');
  console.log('   look excellent and will be unconstrained across that line. Add points');
  console.log('   off the axis before believing any of it.');
}

// --- affine fit, over-determined
const P = cps.map((c) => [c.points[0][0], c.points[0][1], 1]);
const R = cps.map((c) => c.rd);
const sol = lstsq(P, R);
const pred = P.map((row) => mul(row, sol));
const res = pred.map((p, i) => Math.hypot(p[0] - R[i][0], p[1] - R[i][1]));
const rms = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / res.length);

const M = [[sol[0][0], sol[1][0]], [sol[0][1], sol[1][1]]];
const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
const { s1, s2 } = singularValues(M);

console.log(`\naffine fit over ${cps.length} points`);
console.log(`   RMS ${rms.toFixed(1)} m   max ${Math.max(...res).toFixed(1)} m`);
cps.forEach((c, i) => console.log(`      ${c.id.padEnd(14)} ${(c.label || '').padEnd(16)} ${res[i].toFixed(1)} m`));
console.log(`   scales ${s1.toFixed(4)} / ${s2.toFixed(4)} m/px    anisotropy ${(s1 / s2).toFixed(2)}`);
// Image y increases DOWNWARD while RD y increases northward, so a plain
// north-up plate flips handedness and lands here with a negative determinant.
// That is the ordinary case. A POSITIVE determinant is the one to look at: it
// means the plate is mirrored, or drawn with north somewhere other than up.
console.log(`   determinant ${det.toFixed(5)}  -> ${det < 0 ? 'north-up (ordinary)' : 'MIRRORED or north not up'}`);

// leave-one-out, the only honest accuracy estimate with few points
const loo = cps.map((_, k) => {
  const Pk = P.filter((_, i) => i !== k);
  const Rk = R.filter((_, i) => i !== k);
  if (Pk.length < 3) return NaN;
  const s = lstsq(Pk, Rk);
  const p = mul(P[k], s);
  return Math.hypot(p[0] - R[k][0], p[1] - R[k][1]);
});
const looMean = loo.filter(Number.isFinite).reduce((a, b) => a + b, 0) / loo.filter(Number.isFinite).length;
console.log(`   leave-one-out mean ${looMean.toFixed(1)} m  [${loo.map((v) => v.toFixed(0)).join(', ')}]`);

console.log('\nverdict:');
if (s1 / s2 > 3) {
  console.log('   REJECT — anisotropy above 3 is not a bird\'s-eye view, it is a');
  console.log('   near-collinear squash that lowers residuals by collapsing an axis.');
} else if (looMean > 60) {
  console.log(`   ORIENTATION ONLY — leave-one-out error of ${looMean.toFixed(0)} m is too large to`);
  console.log('   place anything. Some plates are portraits, not surveys, and no global');
  console.log('   transform makes them metric. Use stations along surviving geometry.');
} else {
  console.log('   usable — but still check a landmark that was NOT in the fit.');
}

function r2(n) { return Math.round(n * 100) / 100; }
function ringArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return a / 2;
}
function mul(row, sol) {
  return [row[0] * sol[0][0] + row[1] * sol[0][1] + row[2] * sol[0][2],
          row[0] * sol[1][0] + row[1] * sol[1][1] + row[2] * sol[1][2]];
}
/** least squares for [x y 1] * a = X and = Y, returned as [[ax,ay,ac],[bx,by,bc]] */
function lstsq(P, R) {
  const AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const AtX = [0, 0, 0], AtY = [0, 0, 0];
  for (let k = 0; k < P.length; k++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) AtA[i][j] += P[k][i] * P[k][j];
      AtX[i] += P[k][i] * R[k][0];
      AtY[i] += P[k][i] * R[k][1];
    }
  }
  return [solve3(AtA, AtX), solve3(AtA, AtY)];
}
function solve3(A, b) {
  const m = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c || m[c][c] === 0) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}
/** Principal spread of a point set about its centroid, as two sigmas in px. */
function pointSpread(pts) {
  const n = pts.length;
  const cx = pts.reduce((a, p) => a + p[0], 0) / n;
  const cy = pts.reduce((a, p) => a + p[1], 0) / n;
  let xx = 0, xy = 0, yy = 0;
  for (const [x, y] of pts) {
    xx += (x - cx) ** 2; xy += (x - cx) * (y - cy); yy += (y - cy) ** 2;
  }
  const { s1, s2 } = singularValues([[xx / n, xy / n], [xy / n, yy / n]]);
  return { s1: Math.sqrt(s1), s2: Math.sqrt(s2) };
}
function singularValues(M) {
  const a = M[0][0], b = M[0][1], c = M[1][0], d = M[1][1];
  const e = (a * a + b * b + c * c + d * d) / 2;
  const f = Math.sqrt(Math.max(0, e * e - (a * d - b * c) ** 2));
  return { s1: Math.sqrt(e + f), s2: Math.sqrt(Math.max(1e-12, e - f)) };
}
