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
  if (f.kind === 'facade' && (f.houses?.length ?? 0) !== f.points.length - 1) {
    problems.push(`${f.id}: ${f.points.length - 1} segments but ${f.houses?.length ?? 0} house records`);
  }
}
if (problems.length) {
  console.log(`\n${problems.length} geometry problem(s):`);
  for (const p of problems) console.log(`   ${p}`);
}

// --- facade runs
//
// The whole point of tracing frontages rather than footprints is that a
// frontage is a MEASUREMENT and a footprint is a guess. So measure them: widths
// in pixels always, and in metres wherever the street they face has been
// anchored to the ground by two control points.
//
// The scale used is LOCAL to that street. On a plate no global transform fits —
// Utenwael's leave-one-out error is 187 m — the scale along one street over a
// couple of hundred metres is still roughly constant, and that is exactly the
// assumption the Blaeu frontage work already relies on.
const runs = features.filter((f) => f.kind === 'facade' && f.points.length >= 2);
if (runs.length) {
  console.log(`\n${runs.length} facade run(s)`);
  const allM = [];
  for (const f of runs) {
    const w = segLengths(f.points);
    const street = features.find((s) => s.id === f.streetId);
    const scale = street ? localScale(street, features) : null;

    console.log(`   ${f.id}  ${f.label || '(unlabelled)'}  ${w.length} house(s)` +
      `  ${street ? `on ${street.label || street.id}` : 'NOT ATTACHED to a street'}`);

    if (!street) {
      console.log('      widths are relative only until this run is attached to a street.');
    } else if (!scale) {
      console.log('      street has no scale: put control points on two of its vertices,');
      console.log('      give them RD, and these widths become metres.');
    } else {
      const m = w.map((x) => x * scale.mPerPx);
      allM.push(...m);
      console.log(`      scale ${scale.mPerPx.toFixed(4)} m/px  (from ${scale.anchors} anchors, ` +
        `${scale.rdDist.toFixed(1)} m over ${scale.pxArc.toFixed(0)} px)`);
      console.log(`      widths m: ${m.map((x) => x.toFixed(1)).join(' ')}`);
      console.log(`      mean ${mean(m).toFixed(2)} m   total ${m.reduce((a, b) => a + b, 0).toFixed(1)} m`);
      // Check each run on its own. A single 18 m house averages away to nothing
      // across a whole plate, and a missed party wall is the likeliest cause of
      // it — so say which house, per run, where it can still be fixed.
      //
      // Compare against the MEDIAN. An outlier drags the mean toward itself, so
      // a run of 6, 6, 18, 6 has a mean of 9 and the 18 m house sits exactly on
      // the 2x line and escapes. The median is 6 and catches it.
      //
      // And use 1.75x rather than 2x: a terrace of near-equal houses with one
      // division missed gives a house of EXACTLY twice the median, so the
      // commonest mistake lands precisely on a 2x threshold and slips past.
      const wide = m.map((x, i) => (x > 1.75 * median(m) ? i + 1 : 0)).filter(Boolean);
      if (wide.length) {
        console.log(`      CHECK house ${wide.join(', ')} — far wider than the rest of this run.`);
        console.log('      A missed party wall looks exactly like one wide house.');
      }
      const narrow = m.filter((x) => x < 2.5).length;
      if (narrow) console.log(`      CHECK ${narrow} house(s) under 2.5 m — narrower than a real frontage.`);
      if (scale.bend > 1.02) {
        console.log(`      WARNING — the street bends between its anchors (plate arc is`);
        console.log(`      ${scale.bend.toFixed(2)}x the chord). RD distance is measured straight, so`);
        console.log('      this scale is an UNDERESTIMATE. Anchor a straighter stretch.');
      }
    }
    if (f.depthM == null) {
      console.log('      depth not set — footprints cannot be built from this run yet.');
    } else {
      console.log(`      assumed depth ${f.depthM} m  (a guess, and recorded as one)`);
    }
  }
  if (allM.length) {
    // Hoorn's frontages were measured independently off Blaeu at 4.91 m mean,
    // corroborated by house numbering at 5.07 m per plot. A run landing far
    // from that is worth a second look before it becomes geometry.
    const mu = mean(allM);
    console.log(`\n   ${allM.length} house(s) in metres: mean ${mu.toFixed(2)} m, ` +
      `range ${Math.min(...allM).toFixed(1)}–${Math.max(...allM).toFixed(1)} m`);
    if (mu < 3 || mu > 9) {
      console.log(`   SUSPECT — Hoorn's measured frontages average 4.91 m (docs/lessons.md).`);
      console.log('   A mean this far off usually means the anchors, not the houses, are wrong.');
    }
  }
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
function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
function segLengths(pts) {
  return pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
}

/**
 * Metres per pixel along one street, from control points sitting on its
 * vertices. Uses the two anchors furthest apart, since a short baseline
 * multiplies any placement error straight into the scale.
 */
function localScale(street, features, tol = 6) {
  const anchors = [];
  for (const c of features) {
    if (c.kind !== 'control' || !Array.isArray(c.rd) || !c.points.length) continue;
    const [cx, cy] = c.points[0];
    let bi = -1, bd = tol;
    street.points.forEach((p, i) => {
      const d = Math.hypot(p[0] - cx, p[1] - cy);
      if (d <= bd) { bd = d; bi = i; }
    });
    if (bi >= 0) anchors.push({ i: bi, rd: c.rd });
  }
  if (anchors.length < 2) return null;
  anchors.sort((a, b) => a.i - b.i);
  const A = anchors[0], B = anchors[anchors.length - 1];
  if (A.i === B.i) return null;

  const seg = segLengths(street.points.slice(A.i, B.i + 1));
  const pxArc = seg.reduce((a, b) => a + b, 0);
  const pxChord = Math.hypot(street.points[B.i][0] - street.points[A.i][0],
                             street.points[B.i][1] - street.points[A.i][1]);
  const rdDist = Math.hypot(B.rd[0] - A.rd[0], B.rd[1] - A.rd[1]);
  if (!(pxArc > 0) || !(rdDist > 0)) return null;
  return {
    mPerPx: rdDist / pxArc,
    pxArc, rdDist,
    anchors: anchors.length,
    bend: pxChord > 0 ? pxArc / pxChord : 1,
  };
}
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
