import * as THREE from 'three';

/**
 * One colour per evidence source, defined in one place.
 *
 * The point is not decoration. The three layers carry very different claims,
 * and a viewer has to be able to tell them apart at a glance:
 *
 *   BAG          survey data, exact footprints and dates
 *   Blaeu 1649   hand-measured facade widths, ASSUMED along-street position
 *   Topo 1880    georeferenced footprints, INVENTED heights, blocks not houses
 *
 * Hues are picked to stay separable: warm brick against cool verdigris against
 * the BAG's neutral browns and greys. Do not reuse a hue across sources.
 */
export const SOURCE_COLORS = {
  /** Blaeu 1649 house sequences — warm brick. */
  blaeu1649: new THREE.Color(0.78, 0.36, 0.20),
  /** Topotijdreis raster blocks — verdigris, cool against the brick. */
  topoRaster: new THREE.Color(0.20, 0.52, 0.50),
} as const;

/** Legend rows for the UI, so the swatches cannot drift from the geometry. */
export const LEGEND: Array<{ key: keyof typeof SOURCE_COLORS | 'bag'; label: string; note: string }> = [
  { key: 'bag', label: 'BAG', note: 'survey — footprint and year are exact' },
  { key: 'blaeu1649', label: 'Blaeu 1649', note: 'measured facades, assumed position' },
  { key: 'topoRaster', label: 'Topo 1880', note: 'georeferenced blocks, assumed heights' },
];

export const BAG_SWATCH = new THREE.Color(0.62, 0.58, 0.52);

export function css(c: THREE.Color): string {
  return `#${c.getHexString()}`;
}
