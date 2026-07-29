import { Store } from './store';
import { EditorCanvas } from './canvas';
import { KIND_COLOR, KIND_SHAPE, type Feature, type FeatureKind, type Project } from './types';
import './editor.css';

const store = new Store();
const cv = document.getElementById('surface') as HTMLCanvasElement;
const editor = new EditorCanvas(cv, store);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------- image load
async function loadFile(file: File) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  const img = new Image();
  img.onload = () => {
    editor.setImage(img);
    // Changing plate mid-project would silently mix two pixel spaces, so warn
    // rather than quietly accept it.
    const s = store.project.source;
    if (s.imageHash && s.imageHash !== hex && store.project.features.length) {
      if (!confirm(`This is a DIFFERENT image from the one traced (${s.label}).\nPixel coordinates will not match. Load anyway?`)) return;
    }
    store.setSource({
      id: s.id || file.name.replace(/\.[^.]+$/, ''),
      label: file.name,
      width: img.naturalWidth,
      height: img.naturalHeight,
      imageHash: hex,
    });
    refresh();
  };
  img.src = URL.createObjectURL(file);
}

$('file').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) loadFile(f);
});
document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f && f.type.startsWith('image/')) loadFile(f);
});

// ---------------------------------------------------------------- tools
const tools = $('tools');
for (const kind of Object.keys(KIND_COLOR) as FeatureKind[]) {
  const b = document.createElement('button');
  b.className = 'tool';
  b.dataset.kind = kind;
  b.innerHTML = `<span class="sw" style="background:${KIND_COLOR[kind]}"></span>${kind}<small>${KIND_SHAPE[kind]}</small>`;
  b.addEventListener('click', () => {
    editor.kind = kind;
    editor.cancelDraft();
    refresh();
  });
  tools.appendChild(b);
}

// ---------------------------------------------------------------- actions
$('finish').addEventListener('click', () => editor.commitDraft());
$('cancel').addEventListener('click', () => editor.cancelDraft());
$('undo').addEventListener('click', () => { store.undo(); refresh(); editor.render(); });
$('fit').addEventListener('click', () => editor.fit());
$('del').addEventListener('click', () => {
  if (editor.selectedId) { store.remove(editor.selectedId); editor.selectedId = null; refresh(); editor.render(); }
});

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
  if (e.key === 'Enter') editor.commitDraft();
  else if (e.key === 'Escape') editor.cancelDraft();
  else if (e.key === 'Backspace') { e.preventDefault(); editor.undoDraftPoint(); }
  else if (e.key === 'f') editor.fit();
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { store.undo(); refresh(); editor.render(); }
  else if (e.key === 'Delete' && editor.selectedId) { store.remove(editor.selectedId); editor.selectedId = null; refresh(); editor.render(); }
});

// ---------------------------------------------------------------- export
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(store.project, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${store.project.source.id || 'trace'}-trace.json`;
  a.click();
});
$('import').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const p = JSON.parse(await f.text()) as Project;
    if (p.crs !== 'source-pixels') throw new Error('not a source-pixel trace');
    store.replaceAll(p);
    refresh(); editor.render();
  } catch (err) {
    alert(`Could not read that file: ${(err as Error).message}`);
  }
});
$('clear').addEventListener('click', () => {
  if (confirm('Delete every traced feature? Export first if you want to keep them.')) {
    store.clear(); editor.selectedId = null; refresh(); editor.render();
  }
});

// ---------------------------------------------------------------- panel
function refresh() {
  for (const b of Array.from(tools.children) as HTMLElement[]) {
    b.classList.toggle('on', b.dataset.kind === editor.kind);
  }
  const p = store.project;
  $('srcname').textContent = p.source.label
    ? `${p.source.label} — ${p.source.width}×${p.source.height}`
    : 'no image loaded';

  const counts = new Map<string, number>();
  for (const f of p.features) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  $('counts').innerHTML = [...counts].map(([k, n]) =>
    `<span class="chip"><i style="background:${KIND_COLOR[k as FeatureKind]}"></i>${k} ${n}</span>`).join('') || '<span class="muted">nothing traced yet</span>';

  const list = $('list');
  list.innerHTML = '';
  for (const f of [...p.features].reverse()) {
    const row = document.createElement('div');
    row.className = 'row' + (f.id === editor.selectedId ? ' on' : '');
    row.innerHTML = `<i style="background:${KIND_COLOR[f.kind]}"></i>
      <b>${f.id}</b><span>${f.label || '<em>unlabelled</em>'}</span><small>${f.points.length}pt</small>`;
    row.addEventListener('click', () => { editor.selectedId = f.id; refresh(); editor.render(); });
    list.appendChild(row);
  }

  const sel = p.features.find((f) => f.id === editor.selectedId);
  const insp = $('inspector');
  if (!sel) { insp.innerHTML = '<p class="muted">Shift-tap a feature to select it.</p>'; return; }
  const isRun = KIND_SHAPE[sel.kind] === 'run';
  insp.innerHTML = `
    <label>label<input id="i-label" value="${esc(sel.label)}"></label>
    <label>notes<textarea id="i-notes" rows="2">${esc(sel.notes)}</textarea></label>
    ${sel.kind === 'control' ? `<label>RD x, y (EPSG:28992)
      <input id="i-rd" placeholder="133060.65, 516664.91" value="${sel.rd ? sel.rd.join(', ') : ''}"></label>` : ''}
    ${isRun ? runPanel(sel, p) : ''}
    <p class="muted">${sel.points.length} vertices · drag the white handles to adjust${
      isRun ? ' · tap the run to add a party wall' : ''}</p>`;
  $('i-label').addEventListener('input', (e) => store.update(sel.id, { label: (e.target as HTMLInputElement).value }));
  $('i-notes').addEventListener('input', (e) => store.update(sel.id, { notes: (e.target as HTMLTextAreaElement).value }));
  const rd = document.getElementById('i-rd') as HTMLInputElement | null;
  rd?.addEventListener('change', () => {
    const m = rd.value.match(/(-?\d+\.?\d*)\D+(-?\d+\.?\d*)/);
    store.update(sel.id, { rd: m ? [Number(m[1]), Number(m[2])] : null });
  });
  if (isRun) bindRunPanel(sel);
}

// ------------------------------------------------------------- facade runs
/** Widths of every house in a run, in source pixels. */
function widths(f: Feature): number[] {
  return f.points.slice(1).map((q, i) =>
    Math.hypot(q[0] - f.points[i][0], q[1] - f.points[i][1]));
}

/**
 * Which side of its street a frontage sits on, from the sign of the cross
 * product of the street's local direction with the offset to the frontage.
 * Derived rather than asked: the tracer already showed us, by drawing it there.
 */
function sideOfStreet(f: Feature, street: Feature): string {
  const mid = f.points[Math.floor(f.points.length / 2)];
  let best = { d: Infinity, s: 0 };
  for (let i = 1; i < street.points.length; i++) {
    const a = street.points[i - 1], b = street.points[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = dx * dx + dy * dy;
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((mid[0] - a[0]) * dx + (mid[1] - a[1]) * dy) / L));
    const px = a[0] + t * dx, py = a[1] + t * dy;
    const d = Math.hypot(mid[0] - px, mid[1] - py);
    if (d < best.d) best = { d, s: Math.sign(dx * (mid[1] - a[1]) - dy * (mid[0] - a[0])) };
  }
  return best.s < 0 ? 'left' : 'right';
}

function runPanel(f: Feature, p: Project): string {
  const w = widths(f);
  const streets = p.features.filter((x) => x.kind === 'street');
  const street = streets.find((s) => s.id === f.streetId);
  const mean = w.reduce((a, b) => a + b, 0) / (w.length || 1);
  // A house twice its neighbours' width is nearly always a division that was
  // missed, not a mansion. Flagging it while tracing is far cheaper than
  // finding it later.
  //
  // Compare against the MEDIAN, not the mean: an outlier drags the mean toward
  // itself, so widths of 6, 6, 18, 6 average to 9 and the wide one lands exactly
  // on the 2x line and slips through. The median is 6 and catches it.
  const sorted = [...w].sort((a, b) => a - b);
  const mid = sorted.length
    ? (sorted.length % 2 ? sorted[sorted.length >> 1]
      : (sorted[(sorted.length >> 1) - 1] + sorted[sorted.length >> 1]) / 2)
    : 0;
  // 1.75x, not 2x. A terrace of near-equal houses with one division missed
  // gives a house of EXACTLY twice the median — the commonest mistake lands
  // precisely on a 2x threshold and a strict > lets it through.
  const suspect = w.map((x, i) => (mid > 0 && x > 1.75 * mid ? i : -1)).filter((i) => i >= 0);

  return `
    <label>fronts onto
      <select id="i-street">
        <option value="">— not attached —</option>
        ${streets.map((s) => `<option value="${s.id}"${s.id === f.streetId ? ' selected' : ''}>${
          esc(s.label || s.id)}</option>`).join('')}
      </select></label>
    ${street ? `<p class="muted">on the <b>${sideOfStreet(f, street)}</b> side, walking the street as drawn</p>` : ''}
    <label>assumed plot depth, m (a guess — kept out of the tracing)
      <input id="i-depth" type="number" step="0.5" placeholder="e.g. 25" value="${f.depthM ?? ''}"></label>
    <p class="muted">${w.length} house${w.length === 1 ? '' : 's'} · mean ${mean.toFixed(1)} px · run ${
      w.reduce((a, b) => a + b, 0).toFixed(0)} px</p>
    ${suspect.length ? `<p class="warn">house ${suspect.map((i) => i + 1).join(', ')} ${
      suspect.length === 1 ? 'is' : 'are'} far wider than the rest of the row — a missed party wall?</p>` : ''}
    <div class="houses">
      ${w.map((x, i) => `<div class="hrow${suspect.includes(i) ? ' warn' : ''}">
        <b>${i + 1}</b>
        <input data-h="${i}" class="hlabel" placeholder="unnamed" value="${esc(f.houses?.[i]?.label ?? '')}">
        <small>${x.toFixed(0)}px</small>
        <button data-merge="${i}" title="merge into the house before it"${i === 0 ? ' disabled' : ''}>⌫</button>
      </div>`).join('')}
    </div>`;
}

function bindRunPanel(f: Feature) {
  const st = document.getElementById('i-street') as HTMLSelectElement | null;
  st?.addEventListener('change', () => { store.update(f.id, { streetId: st.value || null }); refresh(); });
  const dp = document.getElementById('i-depth') as HTMLInputElement | null;
  dp?.addEventListener('change', () => {
    store.update(f.id, { depthM: dp.value === '' ? null : Number(dp.value) });
  });
  for (const el of Array.from(document.querySelectorAll('.hlabel')) as HTMLInputElement[]) {
    el.addEventListener('input', () => store.updateHouse(f.id, Number(el.dataset.h), { label: el.value }));
  }
  for (const el of Array.from(document.querySelectorAll('[data-merge]')) as HTMLButtonElement[]) {
    el.addEventListener('click', () => {
      store.removeDivision(f.id, Number(el.dataset.merge));
      refresh(); editor.render();
    });
  }
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));

editor.onChange = refresh;
store.subscribe(() => { /* autosaved; panel refreshes on explicit calls */ });
refresh();
