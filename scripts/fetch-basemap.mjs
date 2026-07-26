// One-off data-prep script: stitches PDOK's BRT Achtergrondkaart (national
// topographic basemap) WMTS tiles covering the Hoorn municipality into a
// single ground texture, aligned to the same local coordinate system as
// hoorn-bag.json. Re-run manually to refresh:
//   node scripts/fetch-basemap.mjs
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { getHoornBoundary, bboxOfMultiPolygon, originOf } from './lib/hoorn-boundary.mjs';

const WMTS_TEMPLATE =
  'https://service.pdok.nl/kadaster/brt-achtergrondkaart/wmts/v2_0/standaard/EPSG:28992/{z}/{col}/{row}.png';

// Level 9: ~6.72m/pixel. Plenty for a background reference layer viewed from
// city-wide zoom; higher levels would multiply tile count for no visible gain.
const ZOOM = '09';
const TILE_SIZE = 256;
const TILE_SPAN = 1720.32; // meters covered by one tile at this zoom level
const ORIGIN = { x: -285401.92, y: 903401.92 }; // NL WMTS tiling scheme top-left corner

const OUT_IMAGE_PATH = new URL('../public/data/hoorn-basemap.jpg', import.meta.url);
const OUT_META_PATH = new URL('../public/data/hoorn-basemap.json', import.meta.url);

function colRowRange(bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  const minCol = Math.floor((minX - ORIGIN.x) / TILE_SPAN);
  const maxCol = Math.floor((maxX - ORIGIN.x) / TILE_SPAN);
  const minRow = Math.floor((ORIGIN.y - maxY) / TILE_SPAN);
  const maxRow = Math.floor((ORIGIN.y - minY) / TILE_SPAN);
  return { minCol, maxCol, minRow, maxRow };
}

async function fetchTile(col, row) {
  const url = WMTS_TEMPLATE.replace('{z}', ZOOM).replace('{col}', col).replace('{row}', row);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log('Fetching Hoorn municipality boundary...');
  const boundary = await getHoornBoundary();
  const bbox = bboxOfMultiPolygon(boundary);
  const { originX, originY } = originOf(bbox);

  const { minCol, maxCol, minRow, maxRow } = colRowRange(bbox);
  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;
  console.log(`Fetching ${cols * rows} basemap tiles (${cols}x${rows}) at zoom ${ZOOM}...`);

  const composites = [];
  let done = 0;
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const buf = await fetchTile(col, row);
      composites.push({
        input: buf,
        left: (col - minCol) * TILE_SIZE,
        top: (row - minRow) * TILE_SIZE,
      });
      done++;
      process.stdout.write(`\rFetched ${done}/${cols * rows} tiles...`);
    }
  }
  process.stdout.write('\n');

  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite(composites)
    .jpeg({ quality: 85 })
    .toFile(OUT_IMAGE_PATH.pathname);
  console.log(`Wrote ${OUT_IMAGE_PATH.pathname} (${width}x${height})`);

  // World bounds of the stitched image, converted with the exact same
  // localX = worldX - originX / localZ = originY - worldY convention that
  // hoorn-bag.json uses (see lib/hoorn-boundary.mjs + buildings.ts), so this
  // image lines up with the buildings without any extra sign-flipping.
  const res = TILE_SPAN / TILE_SIZE;
  const worldMinX = ORIGIN.x + minCol * TILE_SPAN;
  const worldMaxY = ORIGIN.y - minRow * TILE_SPAN; // north edge (top row)
  const worldMinY = worldMaxY - height * res; // south edge (bottom row)
  const meta = {
    localMinX: worldMinX - originX,
    localMaxX: worldMinX - originX + width * res,
    localMinZ: originY - worldMaxY, // north edge -> smaller/more-negative Z
    localMaxZ: originY - worldMinY, // south edge -> larger Z
  };
  await writeFile(OUT_META_PATH, JSON.stringify(meta));
  console.log(`Wrote ${OUT_META_PATH.pathname}`, meta);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
