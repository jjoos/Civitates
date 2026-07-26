// Fetch a georeferenced historical topographic sheet of Hoorn from Kadaster's
// Topotijdreis tile service and stitch it into one image plus a bounds file.
//
//   node scripts/fetch-topotijdreis.mjs 1880 [1900 1930 ...]
//
// Unlike every other map in this project these sheets are ALREADY georeferenced
// in EPSG:28992, so nothing has to be warped or fitted — the tile grid is the
// coordinate system. That makes them the one historical source we can extract
// building geometry from mechanically. See scripts/extract-map-blocks.py.
//
// The service moved host: it used to live at services.arcgisonline.nl under a
// `Historisch` folder, which now 404s. Current home is the tiles.arcgis.com
// org below, found in topotijdreis.nl's own bundle.
//
// Years run 1815-2025 (184 services), but they are VALIDITY RANGES, not
// separate surveys: 1880/1885/1890/1895/1898 return byte-identical tiles. Every
// sheet records a `sheet_hash`, and fetching several years at once reports any
// that turn out to be the same survey.
import { writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { getHoornBoundary, bboxOfMultiPolygon, originOf } from './lib/hoorn-boundary.mjs';

const SERVICE = (year) =>
  `https://tiles.arcgis.com/tiles/nSZVuSZjHpEZZbRo/arcgis/rest/services/Historische_tijdreis_${year}/MapServer/tile`;

// LOD 11 is the finest the service publishes. That is the hard ceiling on what
// can be read off these sheets: at 1.5875 m/px a 5 m house frontage is 3 px, so
// individual houses are NOT recoverable — building blocks are.
const LOD = 11;
const RES = 1.5875;
const TILE_SIZE = 256;
const TILE_SPAN = RES * TILE_SIZE;
const ORIGIN = { x: -30515500.0, y: 31112399.999999993 };

// Full-resolution sheets are ~90 MB each and are INTERMEDIATES, not build
// output: only the extracted blocks get committed. Keep them out of public/,
// which ships to Pages.
const OUT_DIR = new URL('../data/raster-cache/', import.meta.url);

function colRowRange([minX, minY, maxX, maxY]) {
  return {
    minCol: Math.floor((minX - ORIGIN.x) / TILE_SPAN),
    maxCol: Math.floor((maxX - ORIGIN.x) / TILE_SPAN),
    minRow: Math.floor((ORIGIN.y - maxY) / TILE_SPAN),
    maxRow: Math.floor((ORIGIN.y - minY) / TILE_SPAN),
  };
}

async function fetchTile(year, col, row) {
  const res = await fetch(`${SERVICE(year)}/${LOD}/${row}/${col}`);
  // Sheets do not all cover the same area; a missing tile is blank, not fatal.
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function fetchYear(year, bbox, origin) {
  const { minCol, maxCol, minRow, maxRow } = colRowRange(bbox);
  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;

  const composites = [];
  const hashes = [];
  let done = 0;
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const buf = await fetchTile(year, col, row);
      done++;
      process.stdout.write(`\r${year}: ${done}/${cols * rows} tiles`);
      if (!buf) continue;
      hashes.push(createHash('sha256').update(buf).digest('hex'));
      composites.push({ input: buf, left: (col - minCol) * TILE_SIZE, top: (row - minRow) * TILE_SIZE });
    }
  }
  process.stdout.write('\n');

  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  const imagePath = new URL(`hoorn-topo-${year}.png`, OUT_DIR).pathname;
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite(composites)
    .png()
    .toFile(imagePath);

  const worldMinX = ORIGIN.x + minCol * TILE_SPAN;
  const worldMaxY = ORIGIN.y - minRow * TILE_SPAN;
  const meta = {
    year: Number(String(year).slice(0, 4)),
    service: `Historische_tijdreis_${year}`,
    crs: 'EPSG:28992',
    lod: LOD,
    m_per_px: RES,
    width,
    height,
    // top-left corner in RD, so px -> RD is rd = [rdMinX + px*res, rdMaxY - py*res]
    rd_min_x: worldMinX,
    rd_max_y: worldMaxY,
    // same local convention as hoorn-bag.json / the basemap
    localMinX: worldMinX - origin.originX,
    localMaxX: worldMinX - origin.originX + width * RES,
    localMinZ: origin.originY - worldMaxY,
    localMaxZ: origin.originY - worldMaxY + height * RES,
    sheet_hash: createHash('sha256').update(hashes.join('')).digest('hex').slice(0, 16),
  };
  await writeFile(new URL(`hoorn-topo-${year}.json`, OUT_DIR), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`  -> hoorn-topo-${year}.png (${width}x${height}), sheet hash ${meta.sheet_hash}`);
  return meta;
}

const years = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!years.length) {
  console.error('usage: node scripts/fetch-topotijdreis.mjs YEAR [YEAR ...]');
  process.exit(1);
}

const boundary = await getHoornBoundary();
const bbox = bboxOfMultiPolygon(boundary);
const origin = originOf(bbox);
await mkdir(OUT_DIR, { recursive: true });

const seen = new Map();
for (const year of years) {
  const meta = await fetchYear(year, bbox, origin);
  if (seen.has(meta.sheet_hash)) {
    console.log(`  !! identical sheet to ${seen.get(meta.sheet_hash)} — same survey, different validity year`);
  } else {
    seen.set(meta.sheet_hash, year);
  }
}
