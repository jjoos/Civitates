// One-off data-prep script: pulls present-day building footprints + construction
// years for the Hoorn municipality from Dutch open data (BAG via PDOK) and bakes
// them into a static file the app fetches at runtime. Re-run manually to refresh:
//   node scripts/fetch-bag.mjs
import { writeFile } from 'node:fs/promises';
import { getHoornBoundary, bboxOfMultiPolygon, isInsideMultiPolygon, originOf } from './lib/hoorn-boundary.mjs';

const BAG_WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
const PAGE_SIZE = 1000;
const OUT_PATH = new URL('../public/data/hoorn-bag.json', import.meta.url);

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function centroidOfRing(ring) {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}

// PDOK refuses startIndex > 50000 (anti-scraping cap). A bbox with more hits
// than that has to be split into smaller tiles and paginated separately.
const MAX_STARTINDEX = 50_000;

async function countHits(bbox) {
  const url =
    `${BAG_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand` +
    `&outputFormat=json&resultType=hits&bbox=${bbox.join(',')},urn:ogc:def:crs:EPSG::28992`;
  const res = await fetch(url);
  const text = await res.text();
  const match = text.match(/numberMatched="(\d+)"/);
  if (!match) throw new Error(`Could not parse hits from: ${text}`);
  return Number(match[1]);
}

function splitBbox([minX, minY, maxX, maxY]) {
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  return [
    [minX, minY, midX, midY],
    [midX, minY, maxX, midY],
    [minX, midY, midX, maxY],
    [midX, midY, maxX, maxY],
  ];
}

async function fetchPage(bbox, startIndex) {
  const url =
    `${BAG_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand` +
    `&outputFormat=json&count=${PAGE_SIZE}&startIndex=${startIndex}` +
    `&bbox=${bbox.join(',')},urn:ogc:def:crs:EPSG::28992`;
  return fetchJson(url);
}

async function fetchAllPanden(bbox, seen = new Map()) {
  const hits = await countHits(bbox);
  if (hits > MAX_STARTINDEX) {
    for (const tile of splitBbox(bbox)) {
      await fetchAllPanden(tile, seen);
    }
    return [...seen.values()];
  }

  let startIndex = 0;
  for (;;) {
    const data = await fetchPage(bbox, startIndex);
    for (const f of data.features) seen.set(f.id, f);
    process.stdout.write(`\rFetched ${seen.size} unique panden so far...`);
    if (data.features.length < PAGE_SIZE) break;
    startIndex += PAGE_SIZE;
  }
  return [...seen.values()];
}

function round(n) {
  return Math.round(n * 10) / 10; // 10cm precision is plenty for schematic massing
}

async function main() {
  console.log('Fetching Hoorn municipality boundary...');
  const boundary = await getHoornBoundary();
  const bbox = bboxOfMultiPolygon(boundary);
  console.log('Bbox (RD):', bbox);

  console.log('Fetching BAG panden in bbox...');
  const panden = await fetchAllPanden(bbox);

  const { originX, originY } = originOf(bbox);

  const buildings = [];
  for (const f of panden) {
    if (f.geometry?.type !== 'Polygon') continue; // skip any odd multi-part panden
    const [outer, ...holes] = f.geometry.coordinates;
    const centroid = centroidOfRing(outer);
    if (!isInsideMultiPolygon(centroid, boundary)) continue;

    const toLocal = (ring) => ring.map(([x, y]) => [round(x - originX), round(originY - y)]);
    buildings.push({
      id: f.properties.identificatie,
      year: f.properties.bouwjaar ?? null,
      rings: [toLocal(outer), ...holes.map(toLocal)],
    });
  }

  console.log(`${buildings.length} buildings inside the Hoorn boundary (of ${panden.length} in bbox)`);

  const out = { originX, originY, buildings };
  await writeFile(OUT_PATH, JSON.stringify(out));
  console.log(`Wrote ${OUT_PATH.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
