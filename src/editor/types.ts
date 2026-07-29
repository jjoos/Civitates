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
 *
 * The same principle decides `facade` versus `house`. A bird's-eye engraver
 * standing off the town drew the STREET ELEVATION — the row of gables — and
 * could not see how far back the plots ran. Tracing a house outline therefore
 * asks the tracer to draw a line nobody ever observed. `facade` records only
 * what was actually seen: the frontage, divided at the party walls. Depth is a
 * separate field, explicitly a guess. Use `house` only where the source really
 * does show a footprint, such as a cadastral or measured plan.
 */

export type FeatureKind =
  | 'facade' | 'house' | 'block' | 'street' | 'wall' | 'water' | 'landmark' | 'control';

/** One dwelling in a facade run, described by the two divisions either side. */
export interface HouseInRun {
  label: string;
  notes: string;
}

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
  /**
   * Facade runs only: one entry per SEGMENT, so `houses.length` is
   * `points.length - 1`. A terrace is one frontage with party-wall divisions,
   * not a collection of unrelated lines, and storing it that way means the
   * divisions are literally shared rather than coincidentally equal.
   */
  houses?: HouseInRun[];
  /** facade runs only: which street feature this frontage faces */
  streetId?: string | null;
  /**
   * Facade runs only: how deep the plots are assumed to be, in metres.
   *
   * This is a GUESS and is stored separately from everything traced so that it
   * stays visibly a guess. Van Deventer measured street lines and facade widths
   * and re-measured them; his depths were invention. Ours are too, and mixing
   * the two into one polygon is what this field exists to prevent.
   */
  depthM?: number | null;
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
  facade: '#f4b942',
  house: '#e2703a',
  block: '#2f857f',
  street: '#3b82f6',
  wall: '#8b5cf6',
  water: '#0ea5e9',
  landmark: '#16a34a',
  control: '#dc2626',
};

/**
 * Which kinds are areas, which are paths, which are single points — and which
 * are RUNS: an open path whose every segment is a separate thing (a house),
 * with the vertices being the divisions between them.
 */
export const KIND_SHAPE: Record<FeatureKind, 'area' | 'path' | 'point' | 'run'> = {
  facade: 'run',
  house: 'area',
  block: 'area',
  street: 'path',
  wall: 'path',
  water: 'area',
  landmark: 'point',
  control: 'point',
};
