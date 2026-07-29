/**
 * Everything the editor produces is expressed in SOURCE IMAGE PIXELS of one
 * named plate — never in metres and never in RD. That is deliberate.
 *
 * A 16th- or 17th-century town view is not metric (see docs/lessons.md: no
 * global transform makes Utenwael 1596 measurable, leave-one-out error 187 m on
 * a 950 m city). Anything traced here is therefore a faithful record of *what
 * the engraver drew*, and converting it to ground coordinates is a separate,
 * later, arguable step. Baking a guess at that conversion into the tracing
 * would destroy the one thing the tracing is good for.
 */

export type FeatureKind = 'house' | 'block' | 'street' | 'wall' | 'water' | 'landmark' | 'control';

export interface Feature {
  id: string;
  kind: FeatureKind;
  /** free-text name, e.g. "Ouden Noort" or "Oosterpoort" */
  label: string;
  /** closed ring for areas, open path for lines, single vertex for points */
  points: Array<[number, number]>;
  closed: boolean;
  notes: string;
  /**
   * Control points only: the real-world position this pixel corresponds to,
   * in EPSG:28992. This is the bridge to georeferencing, and the only place
   * the editor lets ground truth in.
   */
  rd?: [number, number] | null;
  createdAt: string;
}

export interface Project {
  /** which plate these pixels belong to — meaningless without it */
  source: {
    id: string;
    label: string;
    width: number;
    height: number;
    /** sha256 of the image bytes, so a re-traced plate can be proven identical */
    imageHash?: string;
  };
  crs: 'source-pixels';
  features: Feature[];
  savedAt: string;
}

export const KIND_COLOR: Record<FeatureKind, string> = {
  house: '#e2703a',
  block: '#2f857f',
  street: '#3b82f6',
  wall: '#8b5cf6',
  water: '#0ea5e9',
  landmark: '#16a34a',
  control: '#dc2626',
};

/** Which kinds are areas, which are paths, which are single points. */
export const KIND_SHAPE: Record<FeatureKind, 'area' | 'path' | 'point'> = {
  house: 'area',
  block: 'area',
  street: 'path',
  wall: 'path',
  water: 'area',
  landmark: 'point',
  control: 'point',
};
