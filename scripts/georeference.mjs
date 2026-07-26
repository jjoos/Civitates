// Fits a pixel -> RD (EPSG:28992) transform for a scanned historical map from
// a list of control points, and reports per-point residuals so a bad point or
// a flipped axis shows up instead of hiding inside a perfect-looking fit.
//
//   node scripts/georeference.mjs                     # all records
//   node scripts/georeference.mjs vandeventer-1560    # one record by id
//
// Records live in data/georeferences/<id>.json. A record with fewer control
// points than its model needs is reported as pending rather than fitted.
import { readdir, readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../data/georeferences/', import.meta.url);

// Minimum control points per model. Always supply MORE than the minimum: a fit
// with exactly the minimum has zero residual by construction, so an orientation
// or sign error produces a mirrored/rotated result that still looks perfect.
const MIN_POINTS = { similarity: 2, affine: 3 };

// Similarity: uniform scale + rotation + translation (4 dof). Valid only for
// true planimetric maps. Solved linearly in (a, b, tx, ty) where
//   X = a*x - b*y + tx
//   Y = b*x + a*y + ty
function fitSimilarity(points) {
  const rows = [];
  const rhs = [];
  for (const { px, rd } of points) {
    rows.push([px[0], -px[1], 1, 0]);
    rhs.push(rd[0]);
    rows.push([px[1], px[0], 0, 1]);
    rhs.push(rd[1]);
  }
  const [a, b, tx, ty] = lstsq(rows, rhs, 4);
  return {
    model: 'similarity',
    matrix: [[a, -b, tx], [b, a, ty]],
    scale_m_per_px: Math.hypot(a, b),
    // Rotation of the scan relative to north-up, in degrees clockwise.
    rotation_deg: (Math.atan2(b, a) * 180) / Math.PI,
  };
}

// Affine: independent scale/shear per axis (6 dof). Use for maps that are
// foreshortened along one axis; still NOT valid for true bird's-eye views,
// where building parallax displaces footprints on top of the foreshortening.
function fitAffine(points) {
  const solve = (i) => {
    const rows = points.map(({ px }) => [px[0], px[1], 1]);
    const rhs = points.map(({ rd }) => rd[i]);
    return lstsq(rows, rhs, 3);
  };
  const [a, b, tx] = solve(0);
  const [c, d, ty] = solve(1);
  return { model: 'affine', matrix: [[a, b, tx], [c, d, ty]] };
}

// Least squares via normal equations + Gaussian elimination with partial
// pivoting. n is small (3-4), so this is plenty.
function lstsq(rows, rhs, n) {
  const A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i][j] += rows[r][i] * rows[r][j];
      A[i][n] += rows[r][i] * rhs[r];
    }
  }
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) throw new Error('control points are degenerate (collinear or coincident)');
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let j = col; j <= n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((row, i) => row[n] / A[i][i]);
}

function apply(matrix, [x, y]) {
  return [
    matrix[0][0] * x + matrix[0][1] * y + matrix[0][2],
    matrix[1][0] * x + matrix[1][1] * y + matrix[1][2],
  ];
}

function residuals(matrix, points) {
  return points.map((p) => {
    const [X, Y] = apply(matrix, p.px);
    return { label: p.label, error_m: Math.hypot(X - p.rd[0], Y - p.rd[1]) };
  });
}

async function run(record) {
  const pts = record.control_points ?? [];
  const model = record.model ?? 'similarity';
  const need = MIN_POINTS[model];
  if (need === undefined) throw new Error(`${record.id}: unknown model "${model}"`);

  if (pts.length < need) {
    console.log(`${record.id}: PENDING - ${pts.length}/${need} control points (need > ${need} to get a meaningful residual)`);
    return record;
  }

  const fit = model === 'affine' ? fitAffine(pts) : fitSimilarity(pts);
  const res = residuals(fit.matrix, pts);
  const rms = Math.sqrt(res.reduce((s, r) => s + r.error_m ** 2, 0) / res.length);

  console.log(`${record.id}: fitted ${model} from ${pts.length} points, RMS ${rms.toFixed(1)} m`);
  for (const r of res) console.log(`    ${r.label}: ${r.error_m.toFixed(1)} m`);
  if (pts.length === need) {
    console.log('    WARNING: exactly the minimum number of points - residuals are zero by construction and prove nothing.');
  }

  return {
    ...record,
    fit: {
      ...fit,
      fitted_at: new Date().toISOString().slice(0, 10),
      point_count: pts.length,
      rms_error_m: Number(rms.toFixed(2)),
      residuals_m: Object.fromEntries(res.map((r) => [r.label, Number(r.error_m.toFixed(2))])),
    },
  };
}

const only = process.argv[2];
const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const path = new URL(file, DIR);
  const record = JSON.parse(await readFile(path, 'utf8'));
  if (only && record.id !== only) continue;
  const updated = await run(record);
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
}
