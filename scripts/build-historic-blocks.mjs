// Turn extracted raster blocks into geometry the app can render.
//
// Reads data/historic-rasters/*.json (produced by extract-map-blocks.py) and
// emits public/data/hoorn-historic-blocks.json in the same LOCAL scene
// coordinates the BAG buildings use, so all three layers line up.
//
//   node scripts/build-historic-blocks.mjs
//
// These are city-wide massing blocks, the coarse end of the project's stated
// "mixed" fidelity — the opposite end from the hand-measured Blaeu houses.
// Footprints are real (the sheet is georeferenced); heights are invented.
import { readdir, readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../data/historic-rasters/', import.meta.url);
const BAG = new URL('../public/data/hoorn-bag.json', import.meta.url);
const OUT = new URL('../public/data/hoorn-historic-blocks.json', import.meta.url);

// A 19th-century Dutch town block is mostly 2-3 storeys. Nothing on the sheet
// records height, so this is a stated assumption, varied per block only so the
// massing does not read as one extruded slab.
const BASE_HEIGHT_M = 8.5;
const HEIGHT_VARIATION_M = 3.0;

// Same FNV-1a + fmix32 as build-historic-houses.mjs. The avalanche matters:
// block ids differ only in their last characters.
function hash01(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h / 0x100000000;
}

const bag = JSON.parse(await readFile(BAG, 'utf8'));
const { originX, originY } = bag;

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort();
const blocks = [];
const sources = [];

for (const file of files) {
  const rec = JSON.parse(await readFile(new URL(file, DIR), 'utf8'));
  sources.push({
    id: rec.id,
    source: rec.source,
    year: rec.source_year,
    crs: rec.crs,
    block_count: rec.block_count,
    method: rec.method,
    caveats: rec.caveats,
  });
  for (const b of rec.blocks) {
    const t = hash01(b.id);
    blocks.push({
      id: b.id,
      source: rec.id,
      attested_from: rec.source_year,
      // The sheet attests that the block was there when surveyed. It says
      // nothing about when it went away, so this is an ATTESTATION window,
      // not a lifespan — see the note in the output below.
      attested_to: rec.attested_to ?? null,
      height: Number((BASE_HEIGHT_M + t * HEIGHT_VARIATION_M).toFixed(3)),
      tint: Number(t.toFixed(4)),
      // RD -> local, the same convention as lib/hoorn-boundary.mjs
      ring: b.rd.map(([x, y]) => [
        Number((x - originX).toFixed(2)),
        Number((originY - y).toFixed(2)),
      ]),
    });
  }
}

const out = {
  sources,
  assumptions: {
    height_m: `${BASE_HEIGHT_M} + up to ${HEIGHT_VARIATION_M} m, hashed per block id. NOT measured — the sheet carries no height information.`,
    footprints: 'Real. The Topotijdreis sheet is published georeferenced in EPSG:28992, so no fit was involved.',
    attestation: 'attested_from is the survey year. attested_to is null: the map says a block was there, never when it stopped being there. Do not read the window as a lifespan.',
    granularity: 'Blocks, not buildings. At 1.5875 m/px an individual house is 3 px wide.',
  },
  blocks,
};

await writeFile(OUT, `${JSON.stringify(out)}\n`);
console.log(`${blocks.length} blocks from ${sources.length} source(s) -> ${OUT.pathname}`);
for (const s of sources) console.log(`   ${s.id.padEnd(22)} ${s.block_count} blocks  (${s.year})`);
