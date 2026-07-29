import type { Feature, FeatureKind, HouseInRun, Project } from './types';
import { KIND_SHAPE } from './types';

const KEY = 'civitates-editor-v1';

/**
 * Autosaving to localStorage is not a nicety here. Tracing a plate is hours of
 * irreplaceable manual work, and a reload that lost it would make the tool
 * worse than useless. Every mutation writes through immediately, and export to
 * a file is always one click away.
 */
export class Store {
  project: Project;
  private undoStack: string[] = [];
  private listeners = new Set<() => void>();

  constructor() {
    this.project = this.load() ?? Store.empty();
  }

  static empty(): Project {
    return {
      source: { id: '', label: '', width: 0, height: 0 },
      crs: 'source-pixels',
      features: [],
      savedAt: new Date().toISOString(),
    };
  }

  private load(): Project | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? Store.normalise(JSON.parse(raw) as Project) : null;
    } catch {
      return null;
    }
  }

  /**
   * `houses.length === points.length - 1` is an invariant the editor maintains,
   * but an imported or hand-edited file need not respect it. Repair rather than
   * reject: a trace is hours of work and a length mismatch loses nothing.
   */
  static normalise(p: Project): Project {
    for (const f of p.features) {
      if (KIND_SHAPE[f.kind] !== 'run') continue;
      const want = Math.max(0, f.points.length - 1);
      f.houses ??= [];
      while (f.houses.length < want) f.houses.push({ label: '', notes: '' });
      f.houses.length = want;
      f.streetId ??= null;
      f.depthM ??= null;
    }
    return p;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Snapshot before a mutation so undo has something to restore. */
  private snapshot() {
    this.undoStack.push(JSON.stringify(this.project));
    if (this.undoStack.length > 80) this.undoStack.shift();
  }

  private commit() {
    this.project.savedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.project));
    } catch {
      // Quota is the realistic failure once a plate has thousands of vertices.
      // Say so rather than silently stopping to save.
      console.warn('Could not autosave — export to a file now.');
    }
    for (const fn of this.listeners) fn();
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.project = JSON.parse(prev) as Project;
    this.commit();
  }

  setSource(src: Project['source']) {
    this.snapshot();
    this.project.source = src;
    this.commit();
  }

  add(kind: FeatureKind, points: Array<[number, number]>, closed: boolean): Feature {
    this.snapshot();
    const n = this.project.features.filter((f) => f.kind === kind).length + 1;
    const feature: Feature = {
      id: `${kind}-${String(n).padStart(4, '0')}`,
      kind,
      label: '',
      points,
      closed,
      notes: '',
      rd: null,
      createdAt: new Date().toISOString(),
    };
    if (KIND_SHAPE[kind] === 'run') {
      feature.houses = points.slice(1).map(() => ({ label: '', notes: '' }));
      feature.streetId = null;
      feature.depthM = null;
    }
    this.project.features.push(feature);
    this.commit();
    return feature;
  }

  /**
   * Split a house in two by adding a party wall at `at`, which lies on the
   * segment starting at division `i`. The new house inherits nothing — a
   * division is a statement that these are two dwellings, not one relabelled.
   */
  insertDivision(id: string, i: number, at: [number, number]) {
    const f = this.project.features.find((x) => x.id === id);
    if (!f || !f.houses) return;
    this.snapshot();
    f.points.splice(i + 1, 0, at);
    f.houses.splice(i + 1, 0, { label: '', notes: '' });
    this.commit();
  }

  /** Merge house `i` into `i-1` by removing the division between them. */
  removeDivision(id: string, i: number) {
    const f = this.project.features.find((x) => x.id === id);
    // Removing an end division would shorten the run rather than merge, and
    // a run needs two divisions to describe even one house.
    if (!f || !f.houses || i <= 0 || i >= f.points.length - 1) return;
    this.snapshot();
    f.points.splice(i, 1);
    f.houses.splice(i, 1);
    this.commit();
  }

  updateHouse(id: string, i: number, patch: Partial<HouseInRun>) {
    const f = this.project.features.find((x) => x.id === id);
    if (!f?.houses?.[i]) return;
    this.snapshot();
    Object.assign(f.houses[i], patch);
    this.commit();
  }

  update(id: string, patch: Partial<Feature>) {
    const f = this.project.features.find((x) => x.id === id);
    if (!f) return;
    this.snapshot();
    Object.assign(f, patch);
    this.commit();
  }

  remove(id: string) {
    this.snapshot();
    this.project.features = this.project.features.filter((f) => f.id !== id);
    this.commit();
  }

  replaceAll(p: Project) {
    this.snapshot();
    this.project = Store.normalise(p);
    this.commit();
  }

  clear() {
    this.snapshot();
    this.project = Store.empty();
    this.commit();
  }
}
