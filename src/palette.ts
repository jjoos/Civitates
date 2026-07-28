import * as THREE from 'three';

/**
 * One entry per evidence layer, defined in one place.
 *
 * This is the single source for the colour the geometry renders in, the swatch
 * the legend draws, and the checkbox that toggles it — so a layer cannot end up
 * a different colour in the legend than on the ground.
 *
 * The point is not decoration. The layers carry very different claims, and a
 * viewer has to be able to tell them apart at a glance. Hues are picked to stay
 * separable: warm brick against cool verdigris against the BAG's neutral
 * browns and greys. Do not reuse a hue across sources.
 */
export interface LayerSpec {
  id: 'bag' | 'blaeu1649' | 'topoRaster';
  label: string;
  note: string;
  /** the swatch colour; for BAG this is representative, its shader ramps by year */
  color: THREE.Color;
}

export const LAYERS: LayerSpec[] = [
  {
    id: 'bag',
    label: 'BAG',
    note: 'survey — footprint and year exact',
    color: new THREE.Color(0.62, 0.58, 0.52),
  },
  {
    id: 'blaeu1649',
    label: 'Blaeu 1649',
    note: 'measured facades, assumed position',
    color: new THREE.Color(0.78, 0.36, 0.20),
  },
  {
    id: 'topoRaster',
    label: 'Topo 1880',
    note: 'georeferenced blocks, assumed heights',
    color: new THREE.Color(0.20, 0.52, 0.50),
  },
];

export const layer = (id: LayerSpec['id']): LayerSpec =>
  LAYERS.find((l) => l.id === id)!;

export const css = (c: THREE.Color): string => `#${c.getHexString()}`;

/**
 * Shared fragment-shader snippet for the time filter.
 *
 * A layer appears at its source's date and STAYS ON from then on, rather than
 * vanishing at some inferred end year — otherwise scrubbing forward silently
 * empties the scene and there is nothing left to compare against.
 *
 * But "still drawn" must not read as "still standing". Past the year the source
 * actually attests, the geometry is desaturated and darkened to a ghost. Blaeu
 * 1649 is evidence for 1649; that the houses are still on screen in 1900 is a
 * convenience, and the render has to say so. Layers with no known end date
 * (attested_to null, emitted as 9999) never dim.
 */
export const TIME_FILTER_GLSL = /* glsl */ `
  vec3 applyAttestation(vec3 col, float year, float from, float to) {
    if (year > to) {
      // Desaturate toward a NEUTRAL MID-GREY rather than just darkening.
      // Darkening alone reads as shadow — the first attempt produced dark brown
      // boxes that looked like unlit buildings, not like a ghost.
      return mix(col, vec3(0.56, 0.57, 0.60), 0.84);
    }
    return col;
  }
`;
