import { Store } from './store';
import { EditorCanvas } from './canvas';
import { KIND_COLOR, KIND_SHAPE, type FeatureKind, type Project } from './types';
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
  insp.innerHTML = `
    <label>label<input id="i-label" value="${esc(sel.label)}"></label>
    <label>notes<textarea id="i-notes" rows="2">${esc(sel.notes)}</textarea></label>
    ${sel.kind === 'control' ? `<label>RD x, y (EPSG:28992)
      <input id="i-rd" placeholder="133060.65, 516664.91" value="${sel.rd ? sel.rd.join(', ') : ''}"></label>` : ''}
    <p class="muted">${sel.points.length} vertices · drag the white handles to adjust</p>`;
  $('i-label').addEventListener('input', (e) => store.update(sel.id, { label: (e.target as HTMLInputElement).value }));
  $('i-notes').addEventListener('input', (e) => store.update(sel.id, { notes: (e.target as HTMLTextAreaElement).value }));
  const rd = document.getElementById('i-rd') as HTMLInputElement | null;
  rd?.addEventListener('change', () => {
    const m = rd.value.match(/(-?\d+\.?\d*)\D+(-?\d+\.?\d*)/);
    store.update(sel.id, { rd: m ? [Number(m[1]), Number(m[2])] : null });
  });
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));

editor.onChange = refresh;
store.subscribe(() => { /* autosaved; panel refreshes on explicit calls */ });
refresh();
