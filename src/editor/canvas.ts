import { KIND_COLOR, KIND_SHAPE, type Feature, type FeatureKind } from './types';
import type { Store } from './store';

interface View {
  scale: number;
  x: number;
  y: number;
}

/**
 * The tracing surface: a plate image, pan/zoom, and features drawn over it.
 *
 * Touch matters more than it looks. The map-reading in this project has
 * repeatedly happened on a phone — that is where three landmarks the desktop
 * sweep missed were actually spotted — so one-finger pan, pinch zoom and
 * tap-to-place are first-class, not an afterthought.
 */
export class EditorCanvas {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: HTMLImageElement | null = null;
  private view: View = { scale: 1, x: 0, y: 0 };

  /** vertices of the feature currently being drawn, in image pixels */
  draft: Array<[number, number]> = [];
  /** facade by default: on most plates it is the only thing actually observed */
  kind: FeatureKind = 'facade';
  selectedId: string | null = null;
  /** index of the vertex being dragged on the selected feature */
  private dragVertex: { id: string; i: number } | null = null;
  onChange: () => void = () => {};

  constructor(cv: HTMLCanvasElement, private store: Store) {
    this.cv = cv;
    this.ctx = cv.getContext('2d')!;
    this.bind();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.cv.getBoundingClientRect();
    this.cv.width = Math.round(r.width * dpr);
    this.cv.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  setImage(img: HTMLImageElement) {
    this.img = img;
    this.fit();
  }

  fit() {
    if (!this.img) return;
    const r = this.cv.getBoundingClientRect();
    const s = Math.min(r.width / this.img.naturalWidth, r.height / this.img.naturalHeight) * 0.95;
    this.view = {
      scale: s,
      x: (r.width - this.img.naturalWidth * s) / 2,
      y: (r.height - this.img.naturalHeight * s) / 2,
    };
    this.render();
  }

  /** screen -> image pixels; everything stored is in image pixels */
  toImage(sx: number, sy: number): [number, number] {
    return [(sx - this.view.x) / this.view.scale, (sy - this.view.y) / this.view.scale];
  }
  toScreen(ix: number, iy: number): [number, number] {
    return [ix * this.view.scale + this.view.x, iy * this.view.scale + this.view.y];
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const [ix, iy] = this.toImage(sx, sy);
    this.view.scale = Math.min(40, Math.max(0.02, this.view.scale * factor));
    this.view.x = sx - ix * this.view.scale;
    this.view.y = sy - iy * this.view.scale;
    this.render();
  }

  /** Nearest existing vertex within `tol` screen px — snapping keeps shared
   *  walls actually shared instead of nearly-shared. */
  private snap(ix: number, iy: number, tol = 12): [number, number] | null {
    const t = tol / this.view.scale;
    let best: { d: number; p: [number, number] } | null = null;
    for (const f of this.store.project.features) {
      for (const p of f.points) {
        const d = Math.hypot(p[0] - ix, p[1] - iy);
        if (d < t && (!best || d < best.d)) best = { d, p: [p[0], p[1]] };
      }
    }
    for (const p of this.draft) {
      const d = Math.hypot(p[0] - ix, p[1] - iy);
      if (d < t && (!best || d < best.d)) best = { d, p: [p[0], p[1]] };
    }
    return best ? best.p : null;
  }

  private hitVertex(ix: number, iy: number): { id: string; i: number } | null {
    if (!this.selectedId) return null;
    const f = this.store.project.features.find((x) => x.id === this.selectedId);
    if (!f) return null;
    const t = 14 / this.view.scale;
    for (let i = 0; i < f.points.length; i++) {
      if (Math.hypot(f.points[i][0] - ix, f.points[i][1] - iy) < t) return { id: f.id, i };
    }
    return null;
  }

  private hitFeature(ix: number, iy: number): Feature | null {
    const t = 10 / this.view.scale;
    // reverse order so the most recently drawn wins, matching what is on top
    for (let k = this.store.project.features.length - 1; k >= 0; k--) {
      const f = this.store.project.features[k];
      const shape = KIND_SHAPE[f.kind];
      if (shape === 'point') {
        if (Math.hypot(f.points[0][0] - ix, f.points[0][1] - iy) < t * 1.5) return f;
        continue;
      }
      if (shape === 'area' && pointInPoly(ix, iy, f.points)) return f;
      for (let i = 1; i < f.points.length; i++) {
        if (distToSegment(ix, iy, f.points[i - 1], f.points[i]) < t) return f;
      }
    }
    return null;
  }

  commitDraft() {
    const shape = KIND_SHAPE[this.kind];
    // A run needs 2 points for its first house, same as a path.
    const need = shape === 'point' ? 1 : shape === 'area' ? 3 : 2;
    if (this.draft.length < need) return;
    const f = this.store.add(this.kind, this.draft.slice(), shape === 'area');
    this.draft = [];
    this.selectedId = f.id;
    this.onChange();
    this.render();
  }

  cancelDraft() {
    this.draft = [];
    this.render();
  }

  undoDraftPoint() {
    this.draft.pop();
    this.render();
  }

  private bind() {
    let panning = false;
    let last: [number, number] = [0, 0];
    let moved = 0;
    let pinch: { d: number; cx: number; cy: number } | null = null;

    const pos = (e: PointerEvent | Touch): [number, number] => {
      const r = this.cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    this.cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && pinch) return;
      this.cv.setPointerCapture(e.pointerId);
      const [sx, sy] = pos(e);
      const [ix, iy] = this.toImage(sx, sy);
      const v = this.hitVertex(ix, iy);
      if (v && e.button === 0) { this.dragVertex = v; return; }
      panning = true; last = [sx, sy]; moved = 0;
    });

    this.cv.addEventListener('pointermove', (e) => {
      const [sx, sy] = pos(e);
      if (this.dragVertex) {
        const [ix, iy] = this.toImage(sx, sy);
        const f = this.store.project.features.find((x) => x.id === this.dragVertex!.id);
        if (f) { f.points[this.dragVertex.i] = [round2(ix), round2(iy)]; this.render(); }
        return;
      }
      if (!panning) return;
      const dx = sx - last[0], dy = sy - last[1];
      moved += Math.abs(dx) + Math.abs(dy);
      this.view.x += dx; this.view.y += dy;
      last = [sx, sy];
      this.render();
    });

    const end = (e: PointerEvent) => {
      const [sx, sy] = pos(e);
      if (this.dragVertex) {
        const f = this.store.project.features.find((x) => x.id === this.dragVertex!.id);
        if (f) this.store.update(f.id, { points: f.points });
        this.dragVertex = null;
        this.onChange();
        return;
      }
      panning = false;
      // A drag is a pan; a tap is a click. 6 px of slop covers a shaky finger.
      if (moved < 6) this.click(sx, sy, e.shiftKey);
    };
    this.cv.addEventListener('pointerup', end);
    this.cv.addEventListener('pointercancel', () => { panning = false; this.dragVertex = null; });

    this.cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = pos(e as unknown as PointerEvent);
      this.zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });

    // pinch zoom
    this.cv.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const [a, b] = [pos(e.touches[0]), pos(e.touches[1])];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
        panning = false;
      }
    }, { passive: true });
    this.cv.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        const [a, b] = [pos(e.touches[0]), pos(e.touches[1])];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.zoomAt(pinch.cx, pinch.cy, d / pinch.d);
        pinch = { d, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
      }
    }, { passive: false });
    this.cv.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });
  }

  private click(sx: number, sy: number, shift: boolean) {
    const [rawX, rawY] = this.toImage(sx, sy);
    if (shift) {
      const f = this.hitFeature(rawX, rawY);
      this.selectedId = f ? f.id : null;
      this.draft = [];
      this.onChange();
      this.render();
      return;
    }
    // With a run selected and nothing being drawn, a tap on the run itself adds
    // a party wall there — the common repair when a division was missed. It is
    // only reachable when the tap lands on the run, so drawing elsewhere is
    // unaffected.
    if (!this.draft.length && this.selectedId) {
      const sel = this.store.project.features.find((x) => x.id === this.selectedId);
      if (sel && KIND_SHAPE[sel.kind] === 'run') {
        const hit = nearestOnPath(rawX, rawY, sel.points, 12 / this.view.scale);
        if (hit) {
          this.store.insertDivision(sel.id, hit.i, [round2(hit.x), round2(hit.y)]);
          this.onChange();
          this.render();
          return;
        }
      }
    }

    const snapped = this.snap(rawX, rawY);
    const p: [number, number] = snapped ?? [round2(rawX), round2(rawY)];
    this.draft.push(p);
    if (KIND_SHAPE[this.kind] === 'point') this.commitDraft();
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const r = this.cv.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.fillStyle = '#141a1f';
    ctx.fillRect(0, 0, r.width, r.height);

    if (this.img) {
      ctx.imageSmoothingEnabled = this.view.scale < 4;
      ctx.drawImage(this.img, this.view.x, this.view.y,
        this.img.naturalWidth * this.view.scale, this.img.naturalHeight * this.view.scale);
    } else {
      ctx.fillStyle = '#7d8894';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('Load a plate image to start tracing', 24, 40);
    }

    for (const f of this.store.project.features) this.drawFeature(f, f.id === this.selectedId);
    this.drawDraft();
  }

  private drawFeature(f: Feature, selected: boolean) {
    const ctx = this.ctx;
    const col = KIND_COLOR[f.kind];
    const shape = KIND_SHAPE[f.kind];
    const pts = f.points.map(([x, y]) => this.toScreen(x, y));

    if (shape === 'point') {
      const [x, y] = pts[0];
      ctx.beginPath(); ctx.arc(x, y, selected ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = selected ? '#fff' : 'rgba(0,0,0,.5)'; ctx.stroke();
      if (f.label) { ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.fillText(f.label, x + 11, y + 4); }
      return;
    }

    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (f.closed) ctx.closePath();
    if (shape === 'area') { ctx.fillStyle = col + '4d'; ctx.fill(); }
    ctx.strokeStyle = col;
    ctx.lineWidth = shape === 'run' ? (selected ? 5 : 3.5) : selected ? 3 : 1.8;
    ctx.stroke();

    // A run is a terrace: draw the party walls as ticks across the frontage,
    // because that is the thing being recorded. Without them a run of twelve
    // houses and a single long wall look identical.
    if (shape === 'run') this.drawDivisions(pts, col, f, selected);

    if (selected) {
      for (const [x, y] of pts) {
        ctx.beginPath(); ctx.rect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    if (f.label && pts.length) {
      const [x, y] = pts[0];
      ctx.fillStyle = '#fff'; ctx.font = '12px system-ui';
      ctx.fillText(f.label, x + 8, y - 6);
    }
  }

  /**
   * Party-wall ticks, plus each house's width in source pixels once there is
   * room to print it. Seeing the widths while tracing is the cheapest check
   * available: a division dropped or doubled shows up immediately as one house
   * twice its neighbours' width, or two at half.
   */
  private drawDivisions(pts: Array<[number, number]>, col: string, f: Feature, selected: boolean) {
    const ctx = this.ctx;
    const len = 9;
    for (let i = 0; i < pts.length; i++) {
      // normal to the local run direction, so the tick reads as a party wall
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
      ctx.beginPath();
      ctx.moveTo(pts[i][0] - nx * len, pts[i][1] - ny * len);
      ctx.lineTo(pts[i][0] + nx * len, pts[i][1] + ny * len);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = selected ? 2.5 : 1.5; ctx.stroke();
    }
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    for (let i = 1; i < pts.length; i++) {
      const sw = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (sw < 26) continue;                       // no room; would just be noise
      const w = Math.hypot(f.points[i][0] - f.points[i - 1][0], f.points[i][1] - f.points[i - 1][1]);
      const mx = (pts[i][0] + pts[i - 1][0]) / 2, my = (pts[i][1] + pts[i - 1][1]) / 2;
      const label = f.houses?.[i - 1]?.label || `${Math.round(w)}px`;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      const tw = ctx.measureText(label).width;
      ctx.fillRect(mx - tw / 2 - 3, my - 20, tw + 6, 14);
      ctx.fillStyle = col;
      ctx.fillText(label, mx, my - 9);
    }
    ctx.textAlign = 'left';
  }

  private drawDraft() {
    if (!this.draft.length) return;
    const ctx = this.ctx;
    const col = KIND_COLOR[this.kind];
    const pts = this.draft.map(([x, y]) => this.toScreen(x, y));
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke();
    ctx.setLineDash([]);
    for (const [x, y] of pts) {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    }
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function pointInPoly(x: number, y: number, poly: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Closest point on a polyline within `tol`, with the index of its segment. */
function nearestOnPath(x: number, y: number, pts: Array<[number, number]>, tol: number) {
  let best: { d: number; i: number; x: number; y: number } | null = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = dx * dx + dy * dy;
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L));
    const px = a[0] + t * dx, py = a[1] + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < tol && (!best || d < best.d)) best = { d, i: i - 1, x: px, y: py };
  }
  return best;
}

function distToSegment(x: number, y: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
