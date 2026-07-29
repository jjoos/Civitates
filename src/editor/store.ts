import type { Feature, FeatureKind, Project } from './types';

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
      return raw ? (JSON.parse(raw) as Project) : null;
    } catch {
      return null;
    }
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
    this.project.features.push(feature);
    this.commit();
    return feature;
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
    this.project = p;
    this.commit();
  }

  clear() {
    this.snapshot();
    this.project = Store.empty();
    this.commit();
  }
}
