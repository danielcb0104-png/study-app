// Study App — lector de PDF para estudiar
// Guarda todo en IndexedDB (en este dispositivo). Sin servidor.
import * as pdfjsLib from './vendor/pdf.min.mjs';
import { renderLatex, latexForPdf, loadMathJax, COMPLETIONS } from './latex.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

/* =========================================================
   Etiquetas / colores
   ========================================================= */
export const TAGS = [
  { id: 'imp',  name: 'Importante',  color: '#f2b705' },
  { id: 'def',  name: 'Definición',  color: '#3b82d6' },
  { id: 'obs',  name: 'Observación', color: '#2fa866' },
  { id: 'ej',   name: 'Ejemplo',     color: '#9056c9' },
  { id: 'com',  name: 'Comentario',  color: '#e8743b' },
  { id: 'cor',  name: 'Corregir',    color: '#e3261c' }, // marca en rojo + corrección escrita al lado
  // etiquetas de versiones anteriores (solo para marcas antiguas)
  { id: 'duda', name: 'Duda',        color: '#e0483a', legacy: true },
  { id: 'idea', name: 'Idea',        color: '#2fa866', legacy: true },
];
const MARK_TAGS = ['imp', 'def', 'obs', 'ej', 'cor']; // botones de marcado rápido
// ¿La marca tiene comentario (aparece en la página de notas)? Las antiguas, sí.
const hasNote = (m) => m.note !== false;
const tagById = (id) => TAGS.find((t) => t.id === id) || TAGS[0];

/* ---------- Idioma del documento (páginas de notas, editor y marcado) ---------- */
const LANGS = [['es', 'Castellano'], ['ca', 'Català'], ['en', 'English']];
const I18N = {
  es: {
    notes: 'Notas', page: 'página', sheetOf: (k, n) => `hoja ${k} de ${n}`, cont: 'continuación', contShort: 'cont.',
    code: 'Código LaTeX', result: 'Resultado', done: 'Listo', saving: 'Guardando…', saved: 'Guardado', comment: 'Comentario',
    figure: 'Figura', equation: 'Ecuación', bullets: 'Lista de puntos (itemize)', numbered: 'Lista numerada (enumerate)',
    bold: 'Negrita', italic: 'Cursiva', figTip: 'Insertar una figura (imagen centrada)', eqTip: 'Ecuación sin numerar',
    placeholder: 'Pulsa aquí para escribir tu comentario (admite LaTeX: $x^2$, \\[ … \\], \\textbf{…})',
    previewPh: 'Aquí verás el resultado mientras escribes.', addComment: 'Añadir comentario',
    addCommentTip: 'Marcar y escribir un comentario en la página de notas', markAs: (n) => `Marcar como «${n}»`,
    editTip: 'Escribir / editar comentario (LaTeX)', upTip: 'Ver en la página', delTip: 'Eliminar nota', bodyTip: 'Pulsa para editar (LaTeX)',
    tags: { imp: 'Importante', def: 'Definición', obs: 'Observación', ej: 'Ejemplo', com: 'Comentario', cor: 'Corregir', duda: 'Duda', idea: 'Idea' },
    corrPh: 'Escribe la corrección…', corrHint: 'Intro: guardar · Mayús+Intro: nueva línea', save: 'Guardar', removeMark: 'Quitar la marca', corrTip: 'Pulsa para editar la corrección', corrBtnTip: 'Marcar en rojo y escribir la corrección al margen',
  },
  ca: {
    notes: 'Notes', page: 'pàgina', sheetOf: (k, n) => `full ${k} de ${n}`, cont: 'continuació', contShort: 'cont.',
    code: 'Codi LaTeX', result: 'Resultat', done: 'Fet', saving: 'Desant…', saved: 'Desat', comment: 'Comentari',
    figure: 'Figura', equation: 'Equació', bullets: 'Llista de punts (itemize)', numbered: 'Llista numerada (enumerate)',
    bold: 'Negreta', italic: 'Cursiva', figTip: 'Inserir una figura (imatge centrada)', eqTip: 'Equació sense numerar',
    placeholder: 'Fes clic aquí per escriure el teu comentari (admet LaTeX: $x^2$, \\[ … \\], \\textbf{…})',
    previewPh: 'Aquí veuràs el resultat mentre escrius.', addComment: 'Afegeix un comentari',
    addCommentTip: 'Marcar i escriure un comentari a la pàgina de notes', markAs: (n) => `Marcar com a «${n}»`,
    editTip: 'Escriure / editar el comentari (LaTeX)', upTip: 'Veure a la pàgina', delTip: 'Eliminar la nota', bodyTip: 'Fes clic per editar (LaTeX)',
    tags: { imp: 'Important', def: 'Definició', obs: 'Observació', ej: 'Exemple', com: 'Comentari', cor: 'Corregir', duda: 'Dubte', idea: 'Idea' },
    corrPh: 'Escriu la correcció…', corrHint: 'Retorn: desar · Maj+Retorn: línia nova', save: 'Desa', removeMark: 'Treure la marca', corrTip: 'Fes clic per editar la correcció', corrBtnTip: 'Marcar en vermell i escriure la correcció al marge',
  },
  en: {
    notes: 'Notes', page: 'page', sheetOf: (k, n) => `sheet ${k} of ${n}`, cont: 'continued', contShort: 'cont.',
    code: 'LaTeX code', result: 'Result', done: 'Done', saving: 'Saving…', saved: 'Saved', comment: 'Comment',
    figure: 'Figure', equation: 'Equation', bullets: 'Bulleted list (itemize)', numbered: 'Numbered list (enumerate)',
    bold: 'Bold', italic: 'Italic', figTip: 'Insert a figure (centred image)', eqTip: 'Unnumbered equation',
    placeholder: 'Click here to write your comment (LaTeX supported: $x^2$, \\[ … \\], \\textbf{…})',
    previewPh: 'The result will appear here as you type.', addComment: 'Add comment',
    addCommentTip: 'Mark and write a comment on the notes page', markAs: (n) => `Mark as “${n}”`,
    editTip: 'Write / edit comment (LaTeX)', upTip: 'Show on the page', delTip: 'Delete note', bodyTip: 'Click to edit (LaTeX)',
    tags: { imp: 'Important', def: 'Definition', obs: 'Remark', ej: 'Example', com: 'Comment', cor: 'Correct', duda: 'Question', idea: 'Idea' },
    corrPh: 'Type the correction…', corrHint: 'Enter: save · Shift+Enter: new line', save: 'Save', removeMark: 'Remove mark', corrTip: 'Click to edit the correction', corrBtnTip: 'Mark in red and write the correction in the margin',
  },
};
const docLang = () => (I18N[R.doc?.lang] ? R.doc.lang : 'es');
const T = (k) => I18N[docLang()][k];
const tagName = (t) => I18N[docLang()].tags[t.id] || t.name;
// Detecta castellano / catalán / inglés por las palabras más frecuentes de cada idioma
function detectLang(text) {
  const words = (text || '').toLowerCase().match(/[a-zà-öø-ÿ·]+/g) || [];
  const SW = {
    es: 'los las y por con para más su sus son pero también lo como muy este esta estos entre sobre cuando donde puede hay ya fue sin desde todo',
    ca: 'els les i per amb més seu seva són però també com molt aquest aquesta aquests entre sobre quan on pot hi ja va sense des tot pel dels als una',
    en: 'the of and to in is that for it with as are on be this by an which or from at we can its these there',
  };
  const sets = Object.fromEntries(Object.entries(SW).map(([k, v]) => [k, new Set(v.split(' '))]));
  const score = { es: 0, ca: 0, en: 0 };
  for (const w of words) for (const k of Object.keys(sets)) if (sets[k].has(w)) score[k]++;
  score.ca += ((text || '').match(/\b[ldsn]['’][a-zà-ÿ]/gi) || []).length + ((text || '').match(/l·l|ç|ny/gi) || []).length * 0.3;
  score.es += ((text || '').match(/ñ|ción\b|ción/gi) || []).length * 0.5;
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 3 ? best[0] : 'es';
}

/* =========================================================
   Base de datos (IndexedDB)
   ========================================================= */
const DB_NAME = 'study-app';
let dbp = null;
function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('marks')) db.createObjectStore('marks', { keyPath: 'id' }).createIndex('docId', 'docId');
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const db = {
  getAll: (store) => tx(store, 'readonly', (s) => reqP(s.getAll())),
  get: (store, id) => tx(store, 'readonly', (s) => reqP(s.get(id))),
  put: (store, val) => tx(store, 'readwrite', (s) => reqP(s.put(val))),
  del: (store, id) => tx(store, 'readwrite', (s) => reqP(s.delete(id))),
  marksOf: (docId) => tx('marks', 'readonly', (s) => reqP(s.index('docId').getAll(docId))),
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
};
const svgIcon = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = d; return s; };
const ICON = {
  check: '<path d="M5 12l5 5 9-10"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
  folderPlus: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path d="M12 10.5v5M9.5 13h5"/>',
  move: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path d="M9 13h6M13 10.5l2.5 2.5-2.5 2.5"/>',
  more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  bullets: '<rect x="2.5" y="4.5" width="3.6" height="3.6" style="fill:var(--ico-accent);stroke:none"/><rect x="2.5" y="10.2" width="3.6" height="3.6" style="fill:var(--ico-accent);stroke:none"/><rect x="2.5" y="15.9" width="3.6" height="3.6" style="fill:var(--ico-accent);stroke:none"/><path d="M9.5 6.3h12M9.5 12h12M9.5 17.7h12"/>',
  numbers: '<g style="fill:var(--ico-accent);stroke:none;font:700 7.8px -apple-system,system-ui,sans-serif" text-anchor="middle"><text x="4.4" y="9.1">1</text><text x="4.4" y="14.8">2</text><text x="4.4" y="20.5">3</text></g><path d="M9.5 6.3h12M9.5 12h12M9.5 17.7h12"/>',
  merge: '<path d="M6 3v4c0 4 6 5 6 9v5"/><path d="M18 3v4c0 4-6 5-6 9"/><path d="M9 18l3 3 3-3"/>',
  split: '<path d="M12 3v5c0 4-6 5-6 9v4"/><path d="M12 8c0 4 6 5 6 9v4"/><path d="M3.5 18.5L6 21l2.5-2.5M15.5 18.5L18 21l2.5-2.5"/>',
  arrowUp: '<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>',
  arrowDown: '<path d="M12 5v13M6.5 12.5L12 18l5.5-5.5"/>',
  grip: '<circle cx="9" cy="7" r="1.1"/><circle cx="15" cy="7" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="17" r="1.1"/><circle cx="15" cy="17" r="1.1"/>',
  restore: '<path d="M4 12a8 8 0 108-8 8.3 8.3 0 00-5.7 2.3L4 8.6"/><path d="M4 4v4.6h4.6"/>',
  correct: '<path d="M3 13h8"/><path d="M13.5 19.5l7-7a2.1 2.1 0 00-3-3l-7 7-1 4z"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4.5 3.5"/>',
};

/* =========================================================
   Utilidades UI
   ========================================================= */
let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  el.replaceChildren(h('span', {}, msg));
  if (action) el.append(h('button', { onclick: () => { el.hidden = true; action.fn(); } }, action.label));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 3000);
}
function busy(on, text = 'Procesando…') {
  $('#busy').hidden = !on;
  $('#busyText').textContent = text;
}
function fmtPct(p) { return `${Math.round(p * 100)} %`; }

/* Progreso ponderado por cantidad de texto de cada página.
   Si el PDF no tiene texto (escaneado) se usa nº de páginas. */
function progressOf(doc) {
  const read = new Set(doc.read || []);
  const n = doc.pageCount || 0;
  if (!n) return 0;
  const chars = doc.pageChars;
  const total = chars ? chars.reduce((a, b) => a + b, 0) : 0;
  if (chars && total > 50) {
    let r = 0;
    for (const p of read) r += chars[p - 1] || 0;
    return r / total;
  }
  return read.size / n;
}

/* =========================================================
   BIBLIOTECA
   ========================================================= */
/* ---------- Carpetas ----------
   Cada documento tiene folderId (null = raíz de la biblioteca). Las carpetas se
   pueden anidar: {id, name, parentId, createdAt}. */
const LIB = { folderId: null, trash: false };
const live = (d) => !d.trashedAt; // documentos que no están en la papelera
try { LIB.folderId = localStorage.getItem('study-folder') || null; } catch {}
function setFolder(id) {
  LIB.folderId = id || null;
  try { if (LIB.folderId) localStorage.setItem('study-folder', LIB.folderId); else localStorage.removeItem('study-folder'); } catch {}
  renderLibrary();
}
const byName = (a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });
function folderPath(folders, id) {
  const map = new Map(folders.map((f) => [f.id, f]));
  const path = [];
  let f = map.get(id);
  while (f && path.length < 50) { path.unshift(f); f = map.get(f.parentId); }
  return path;
}
// ids de una carpeta y todas sus subcarpetas
function descendants(folders, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) { grew = false; for (const f of folders) if (out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; } }
  return out;
}

async function renderLibrary() {
  const [docsEvery, folders, allMarks] = await Promise.all([db.getAll('docs'), db.getAll('folders'), db.getAll('marks')]);
  const trashed = docsEvery.filter((d) => !live(d));
  const docsAll = docsEvery.filter(live);
  const tc = $('#trashCount');
  tc.textContent = String(trashed.length); tc.hidden = !trashed.length;
  $('#btnTrash').classList.toggle('active', LIB.trash);
  if (LIB.trash) return renderTrash(trashed, folders);
  $('#trashBar').hidden = true;
  if (LIB.folderId && !folders.some((f) => f.id === LIB.folderId)) LIB.folderId = null;
  const cur = LIB.folderId;
  const counts = {};
  for (const m of allMarks) if (hasNote(m)) counts[m.docId] = (counts[m.docId] || 0) + 1;
  const subfolders = folders.filter((f) => (f.parentId || null) === cur).sort(byName);
  const docs = docsAll.filter((d) => (d.folderId || null) === cur)
    .sort((a, b) => (b.openedAt || b.addedAt) - (a.openedAt || a.addedAt));

  // Ruta: Biblioteca › Física › Tema 1
  const crumbs = $('#crumbs');
  crumbs.replaceChildren();
  const path = folderPath(folders, cur);
  const addCrumb = (label, id, isLast) => {
    const c = h(isLast ? 'span' : 'button', { class: `crumb${isLast ? ' current' : ''}`, type: isLast ? null : 'button' }, label);
    if (!isLast) c.addEventListener('click', () => setFolder(id));
    makeDropTarget(c, id);
    crumbs.append(c);
    if (!isLast) crumbs.append(svgIcon(ICON.chevron));
  };
  addCrumb('Biblioteca', null, path.length === 0);
  path.forEach((f, i) => addCrumb(f.name, f.id, i === path.length - 1));
  crumbs.hidden = folders.length === 0 && !cur;

  const grid = $('#docGrid');
  grid.replaceChildren();
  const empty = !docsAll.length && !folders.length;
  $('#emptyState').hidden = !empty;
  $('#folderEmpty').hidden = empty || subfolders.length + docs.length > 0;

  for (const f of subfolders) {
    const ids = descendants(folders, f.id);
    const nDocs = docsAll.filter((d) => ids.has(d.folderId)).length;
    const nSub = folders.filter((x) => x.parentId === f.id).length;
    const more = h('button', { class: 'icon-btn small more', title: 'Opciones', 'aria-label': `Opciones de la carpeta ${f.name}` }, svgIcon(ICON.more));
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      showMenu(more, [
        { label: 'Cambiar nombre', icon: ICON.edit, fn: () => renameFolder(f) },
        { label: 'Mover a…', icon: ICON.move, fn: () => moveItem({ type: 'folder', id: f.id }) },
        { label: 'Eliminar carpeta', icon: ICON.trash, danger: true, fn: () => deleteFolder(f) },
      ]);
    });
    const card = h('div', { class: 'card folder-card', title: f.name, draggable: 'true', tabindex: '0', role: 'button' },
      h('div', { class: 'folder-icon' }, svgIcon(ICON.folder)),
      h('div', { class: 'body' },
        h('div', { class: 'name' }, f.name),
        h('div', { class: 'meta' },
          h('span', {}, [nDocs ? `${nDocs} documento${nDocs > 1 ? 's' : ''}` : 'Vacía', nSub ? `${nSub} carpeta${nSub > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')),
          more)));
    card.addEventListener('click', () => setFolder(f.id));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') setFolder(f.id); });
    makeDraggable(card, { type: 'folder', id: f.id });
    makeDropTarget(card, f.id);
    grid.append(card);
  }

  for (const d of docs) {
    const p = progressOf(d);
    const more = h('button', { class: 'icon-btn small more', title: 'Opciones', 'aria-label': `Opciones de ${d.name}` }, svgIcon(ICON.more));
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      showMenu(more, [
        { label: 'Mover a carpeta…', icon: ICON.move, fn: () => moveItem({ type: 'doc', id: d.id }) },
        { label: 'Fusionar con otros…', icon: ICON.merge, fn: () => mergeDialog([d.id]) },
        ...(d.pageCount > 1 ? [{ label: 'Fisionar (separar en dos)…', icon: ICON.split, fn: () => splitDialog(d.id) }] : []),
        { label: 'Cambiar nombre', icon: ICON.edit, fn: () => renameDoc(d) },
        { label: 'Mover a la papelera', icon: ICON.trash, danger: true, fn: () => deleteDoc(d) },
      ]);
    });
    const card = h('div', { class: 'card', onclick: () => openDoc(d.id), title: d.name, draggable: 'true' },
      h('div', { class: 'thumb' }, d.thumb ? h('img', { src: d.thumb, alt: '', draggable: 'false' }) : null),
      h('div', { class: 'body' },
        h('div', { class: 'name' }, d.name),
        h('div', { class: 'bar' }, h('div', { style: { width: `${p * 100}%` } })),
        h('div', { class: 'meta' },
          h('span', {}, `${fmtPct(p)} leído · ${d.pageCount || '?'} pág.${counts[d.id] ? ` · ${counts[d.id]} notas` : ''}`),
          more),
      ),
    );
    makeDraggable(card, { type: 'doc', id: d.id });
    grid.append(card);
  }
}

/* Arrastrar documentos y carpetas a otra carpeta (ordenador) */
const DRAG_TYPE = 'application/x-study-item';
let dragItem = null;
function makeDraggable(el, item) {
  el.addEventListener('dragstart', (e) => {
    dragItem = item;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => { dragItem = null; el.classList.remove('dragging'); document.querySelectorAll('.drop-over').forEach((x) => x.classList.remove('drop-over')); });
}
function makeDropTarget(el, folderId) {
  const ok = (e) => dragItem && [...e.dataTransfer.types].includes(DRAG_TYPE) && !(dragItem.type === 'folder' && dragItem.id === folderId);
  el.addEventListener('dragover', (e) => { if (!ok(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drop-over'));
  el.addEventListener('drop', async (e) => {
    if (!ok(e)) return;
    e.preventDefault(); e.stopPropagation();
    el.classList.remove('drop-over');
    const item = dragItem; dragItem = null;
    await moveTo(item, folderId);
  });
}

async function moveTo(item, folderId) {
  folderId = folderId || null;
  if (item.type === 'doc') {
    const d = await db.get('docs', item.id);
    if (!d || (d.folderId || null) === folderId) return;
    d.folderId = folderId;
    await db.put('docs', d);
  } else {
    const folders = await db.getAll('folders');
    const f = folders.find((x) => x.id === item.id);
    if (!f || (f.parentId || null) === folderId) return;
    if (folderId && descendants(folders, f.id).has(folderId)) { toast('No se puede mover una carpeta dentro de sí misma'); return; }
    f.parentId = folderId;
    await db.put('folders', f);
  }
  const folders = await db.getAll('folders');
  const dest = folderId ? folders.find((x) => x.id === folderId)?.name : 'Biblioteca';
  toast(`Movido a «${dest}»`);
  renderLibrary();
}

async function createFolder(parentId = LIB.folderId) {
  LIB.trash = false;
  const name = await askText({ title: 'Nueva carpeta', label: 'Nombre de la carpeta', value: '', ok: 'Crear' });
  if (!name) return null;
  const f = { id: uid(), name, parentId: parentId || null, createdAt: Date.now() };
  await db.put('folders', f);
  renderLibrary();
  return f;
}
async function renameFolder(f) {
  const name = await askText({ title: 'Cambiar nombre', label: 'Nombre de la carpeta', value: f.name, ok: 'Guardar' });
  if (!name || name === f.name) return;
  f.name = name; await db.put('folders', f); renderLibrary();
}
async function renameDoc(d) {
  const name = await askText({ title: 'Cambiar nombre', label: 'Nombre del documento', value: d.name, ok: 'Guardar' });
  if (!name || name === d.name) return;
  d.name = name; await db.put('docs', d); renderLibrary();
}
async function deleteFolder(f) {
  const [folders, docs] = await Promise.all([db.getAll('folders'), db.getAll('docs')]);
  const parentName = f.parentId ? folders.find((x) => x.id === f.parentId)?.name || 'Biblioteca' : 'Biblioteca';
  const inDocs = docs.filter((d) => d.folderId === f.id), inFolders = folders.filter((x) => x.parentId === f.id);
  const n = inDocs.filter(live).length + inFolders.length;
  const msg = n ? `¿Eliminar la carpeta «${f.name}»?\n\nSu contenido (${n} elemento${n > 1 ? 's' : ''}) no se borra: pasará a «${parentName}».` : `¿Eliminar la carpeta «${f.name}»?`;
  if (!confirm(msg)) return;
  for (const d of inDocs) { d.folderId = f.parentId || null; await db.put('docs', d); }
  for (const x of inFolders) { x.parentId = f.parentId || null; await db.put('folders', x); }
  await db.del('folders', f.id);
  if (LIB.folderId === f.id) LIB.folderId = f.parentId || null;
  renderLibrary();
}
// Elegir carpeta de destino (funciona también en el móvil)
async function moveItem(item) {
  let folders = await db.getAll('folders');
  const exclude = item.type === 'folder' ? descendants(folders, item.id) : new Set();
  const current = item.type === 'doc' ? (await db.get('docs', item.id))?.folderId || null : folders.find((f) => f.id === item.id)?.parentId || null;
  return new Promise((resolve) => {
    let selected = current;
    const list = h('div', { class: 'folder-list', role: 'listbox' });
    const draw = () => {
      list.replaceChildren();
      const row = (id, name, depth) => {
        const disabled = id && exclude.has(id);
        const b = h('button', { type: 'button', class: `folder-row${selected === id ? ' is-sel' : ''}${id === current ? ' cur' : ''}`, disabled: disabled ? 'disabled' : null,
          style: { paddingLeft: `${12 + depth * 18}px` }, role: 'option', 'aria-selected': String(selected === id) },
        svgIcon(id ? ICON.folder : ICON.circle), h('span', {}, name), id === current ? h('span', { class: 'here' }, 'actual') : null);
        b.addEventListener('click', () => { selected = id; draw(); });
        list.append(b);
      };
      row(null, 'Biblioteca (sin carpeta)', 0);
      const walk = (parent, depth) => {
        for (const f of folders.filter((x) => (x.parentId || null) === parent).sort(byName)) { row(f.id, f.name, depth); walk(f.id, depth + 1); }
      };
      walk(null, 1);
    };
    draw();
    const newBtn = h('button', { type: 'button', class: 'btn ghost' }, svgIcon(ICON.folderPlus), 'Nueva carpeta');
    newBtn.addEventListener('click', async () => {
      const name = await askText({ title: 'Nueva carpeta', label: `Dentro de «${selected ? folders.find((f) => f.id === selected)?.name : 'Biblioteca'}»`, value: '', ok: 'Crear' });
      if (!name) return;
      const f = { id: uid(), name, parentId: selected, createdAt: Date.now() };
      await db.put('folders', f);
      folders = await db.getAll('folders');
      selected = f.id; draw();
    });
    const dlg = h('dialog', { class: 'move-dialog' },
      h('form', { method: 'dialog' },
        h('h3', {}, 'Mover a…'),
        list,
        h('div', { class: 'dialog-actions spread' }, newBtn,
          h('div', { class: 'dialog-actions' },
            h('button', { class: 'btn ghost', value: 'cancel', type: 'submit' }, 'Cancelar'),
            h('button', { class: 'btn primary', value: 'ok', type: 'submit' }, 'Mover')))));
    document.body.append(dlg);
    dlg.addEventListener('close', async () => {
      const ok = dlg.returnValue === 'ok';
      dlg.remove();
      if (ok) await moveTo(item, selected);
      else renderLibrary();
      resolve();
    });
    dlg.showModal();
  });
}

/* =========================================================
   COMBINAR DOCUMENTOS (PDF + notas) en uno nuevo
   ========================================================= */
async function mergeDialog(preselected = []) {
  const [docsEvery, folders] = await Promise.all([db.getAll('docs'), db.getAll('folders')]);
  const docs = docsEvery.filter(live);
  if (docs.length < 2) { toast('Necesitas al menos dos documentos en la biblioteca'); return; }
  const where = (d) => folderPath(folders, d.folderId || null).map((f) => f.name).join(' › ') || 'Biblioteca';
  docs.sort((a, b) => where(a).localeCompare(where(b), 'es') || byName(a, b));
  const byId = new Map(docs.map((d) => [d.id, d]));
  let order = preselected.filter((id) => byId.has(id)); // en el orden en que se marcan
  let step = 1;
  const content = h('div', { class: 'merge-body' });
  const title = h('h3');
  const sub = h('p', { class: 'merge-sub' });
  const back = h('button', { type: 'button', class: 'btn ghost' });
  const next = h('button', { type: 'button', class: 'btn primary' });
  const nameInput = h('input', { type: 'text', class: 'name-input', maxlength: '120' });
  let nameTouched = false;
  const defaultName = () => order.map((id) => byId.get(id).name).join(' + ').slice(0, 110);
  const dlg = h('dialog', { class: 'merge-dialog' },
    h('form', { method: 'dialog', onsubmit: (e) => e.preventDefault() }, title, sub, content,
      h('div', { class: 'dialog-actions' }, back, next)));

  const drawSelect = () => {
    title.textContent = 'Fusionar documentos';
    sub.textContent = 'Elige los documentos que quieres fusionar en uno (dos o más). Sus notas también se copiarán.';
    const list = h('div', { class: 'folder-list merge-list' });
    let lastWhere = null;
    for (const d of docs) {
      const w = where(d);
      if (w !== lastWhere) { list.append(h('div', { class: 'merge-group' }, w)); lastWhere = w; }
      const on = order.includes(d.id);
      const cb = h('input', { type: 'checkbox' }); cb.checked = on;
      const row = h('label', { class: `folder-row merge-row${on ? ' is-on' : ''}` }, cb,
        h('span', {}, d.name), h('span', { class: 'here' }, `${d.pageCount || '?'} pág.`));
      cb.addEventListener('change', () => {
        order = cb.checked ? [...order, d.id] : order.filter((x) => x !== d.id);
        row.classList.toggle('is-on', cb.checked);
        updateButtons();
      });
      list.append(row);
    }
    content.replaceChildren(list);
    back.textContent = 'Cancelar';
    next.textContent = 'Siguiente';
    updateButtons();
  };
  const drawOrder = () => {
    title.textContent = '¿En qué orden los fusiono?';
    sub.textContent = 'El primero de la lista irá al principio. Usa las flechas o arrastra para cambiar el orden.';
    const list = h('ol', { class: 'merge-order' });
    const move = (i, j) => { if (j < 0 || j >= order.length) return; const [x] = order.splice(i, 1); order.splice(j, 0, x); refresh(); };
    let dragFrom = null;
    const refresh = () => {
      list.replaceChildren(...order.map((id, i) => {
        const d = byId.get(id);
        const up = h('button', { type: 'button', class: 'icon-btn small', title: 'Subir', 'aria-label': `Subir ${d.name}`, disabled: i === 0 ? 'disabled' : null }, svgIcon(ICON.arrowUp));
        const down = h('button', { type: 'button', class: 'icon-btn small', title: 'Bajar', 'aria-label': `Bajar ${d.name}`, disabled: i === order.length - 1 ? 'disabled' : null }, svgIcon(ICON.arrowDown));
        up.addEventListener('click', () => move(i, i - 1));
        down.addEventListener('click', () => move(i, i + 1));
        const li = h('li', { class: 'merge-item', draggable: 'true' },
          h('span', { class: 'grip' }, svgIcon(ICON.grip)), h('span', { class: 'pos' }, String(i + 1)),
          h('span', { class: 'nm' }, h('b', {}, d.name), h('small', {}, `${d.pageCount || '?'} pág. · ${where(d)}`)), up, down);
        li.addEventListener('dragstart', (e) => { dragFrom = i; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); });
        li.addEventListener('dragend', () => li.classList.remove('dragging'));
        li.addEventListener('dragover', (e) => { if (dragFrom != null) { e.preventDefault(); li.classList.add('over'); } });
        li.addEventListener('dragleave', () => li.classList.remove('over'));
        li.addEventListener('drop', (e) => { e.preventDefault(); li.classList.remove('over'); const f = dragFrom; dragFrom = null; if (f != null && f !== i) move(f, i); });
        return li;
      }));
    };
    refresh();
    const pages = order.reduce((a, id) => a + (byId.get(id).pageCount || 0), 0);
    content.replaceChildren(list, h('p', { class: 'merge-note' }, `${pages} páginas en total.`));
    back.textContent = 'Atrás';
    next.textContent = 'Siguiente';
    updateButtons();
  };
  // Paso 3: nombre del nuevo documento
  const drawName = () => {
    title.textContent = 'Nombre del nuevo documento';
    sub.textContent = '¿Cómo quieres que se llame el documento fusionado?';
    if (!nameTouched) nameInput.value = defaultName();
    const err = h('p', { class: 'merge-err', hidden: true }, 'Escribe un nombre para el documento.');
    nameInput.oninput = () => { nameTouched = true; err.hidden = true; next.disabled = !nameInput.value.trim(); };
    nameInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); next.click(); } };
    content.replaceChildren(
      h('label', { class: 'name-label' }, 'Nombre'), h('div', { class: 'name-row' }, nameInput), err,
      h('p', { class: 'merge-note' }, `Contendrá ${order.map((id) => `«${byId.get(id).name}»`).join(', ')} en este orden. Se guardará en «${folderPath(folders, LIB.folderId).map((f) => f.name).join(' › ') || 'Biblioteca'}». Los documentos originales no cambian.`));
    back.textContent = 'Atrás';
    next.textContent = 'Crear documento';
    next.disabled = !nameInput.value.trim();
    setTimeout(() => { nameInput.focus(); nameInput.select(); }, 0);
  };
  const updateButtons = () => {
    next.disabled = order.length < 2;
    if (step === 1) next.textContent = order.length >= 2 ? `Siguiente (${order.length})` : 'Siguiente';
  };
  back.addEventListener('click', () => { if (step === 3) { step = 2; drawOrder(); } else if (step === 2) { step = 1; drawSelect(); } else dlg.close(); });
  next.addEventListener('click', async () => {
    if (order.length < 2) return;
    if (step === 1) { step = 2; drawOrder(); return; }
    if (step === 2) { step = 3; drawName(); return; }
    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    if (!name) { content.querySelector('.merge-err').hidden = false; nameInput.focus(); return; }
    dlg.close();
    await mergeDocs([...order], name);
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  drawSelect();
  dlg.showModal();
}

/* =========================================================
   FISIONAR: separar un documento en dos (con sus notas)
   ========================================================= */
async function splitDialog(preId = null) {
  const [docsAll, folders] = await Promise.all([db.getAll('docs'), db.getAll('folders')]);
  const docs = docsAll.filter((d) => live(d) && (d.pageCount || 0) > 1);
  if (!docs.length) { toast('No hay ningún documento con más de una página'); return; }
  const where = (d) => folderPath(folders, d.folderId || null).map((f) => f.name).join(' › ') || 'Biblioteca';
  docs.sort((a, b) => where(a).localeCompare(where(b), 'es') || byName(a, b));
  let doc = docs.find((d) => d.id === preId) || null;
  let cut = 2; // primera página de la segunda parte
  let pdfP = null, pdfFor = null, thumbT = null;
  let step = doc ? 2 : 1;
  const title = h('h3'), sub = h('p', { class: 'merge-sub' }), content = h('div', { class: 'merge-body' });
  const back = h('button', { type: 'button', class: 'btn ghost' });
  const next = h('button', { type: 'button', class: 'btn primary' });
  const name1 = h('input', { type: 'text', class: 'name-input', maxlength: '120' });
  const name2 = h('input', { type: 'text', class: 'name-input', maxlength: '120' });
  let namesFor = null;
  const dlg = h('dialog', { class: 'merge-dialog split-dialog' },
    h('form', { method: 'dialog', onsubmit: (e) => e.preventDefault() }, title, sub, content, h('div', { class: 'dialog-actions' }, back, next)));
  const range = (a, b) => (a === b ? `pág. ${a}` : `págs. ${a}–${b}`);

  const drawPick = () => {
    title.textContent = 'Fisionar un documento';
    sub.textContent = 'Elige el documento que quieres separar en dos. Sus notas se repartirán entre las dos partes.';
    const list = h('div', { class: 'folder-list merge-list', role: 'radiogroup' });
    let lastWhere = null;
    for (const d of docs) {
      const w = where(d);
      if (w !== lastWhere) { list.append(h('div', { class: 'merge-group' }, w)); lastWhere = w; }
      const rb = h('input', { type: 'radio', name: 'splitdoc' }); rb.checked = doc?.id === d.id;
      const row = h('label', { class: `folder-row merge-row${rb.checked ? ' is-on' : ''}` }, rb, h('span', {}, d.name), h('span', { class: 'here' }, `${d.pageCount} pág.`));
      rb.addEventListener('change', () => { doc = d; list.querySelectorAll('.merge-row').forEach((r) => r.classList.toggle('is-on', r === row)); next.disabled = false; });
      row.addEventListener('dblclick', () => { doc = d; next.click(); });
      list.append(row);
    }
    content.replaceChildren(list);
    back.textContent = 'Cancelar'; next.textContent = 'Siguiente'; next.disabled = !doc;
  };

  // el PDF se carga una sola vez (aunque se pidan dos miniaturas a la vez)
  const getPdf = () => {
    if (pdfFor !== doc.id) {
      const old = pdfP; pdfFor = doc.id;
      pdfP = (async () => {
        old?.then((x) => x.destroy()).catch(() => {});
        const file = await db.get('files', doc.id);
        return pdfjsLib.getDocument({ data: file.data.slice(0) }).promise;
      })();
    }
    return pdfP;
  };
  const thumb = async (canvas, num) => {
    const tok = (canvas._tok = (canvas._tok || 0) + 1);
    try {
      const page = await (await getPdf()).getPage(num);
      const v0 = page.getViewport({ scale: 1 });
      const v = page.getViewport({ scale: (120 * (window.devicePixelRatio || 1)) / v0.width });
      const off = document.createElement('canvas');
      off.width = Math.round(v.width); off.height = Math.round(v.height);
      await page.render({ canvasContext: off.getContext('2d'), viewport: v }).promise;
      if (canvas._tok !== tok) return; // ya se pidió otra página
      canvas.width = off.width; canvas.height = off.height;
      canvas.getContext('2d').drawImage(off, 0, 0);
    } catch (e) { console.warn(e); }
  };
  const drawCut = () => {
    const n = doc.pageCount;
    cut = Math.min(Math.max(cut, 2), n);
    title.textContent = '¿Dónde lo separo?';
    sub.textContent = `«${doc.name}» tiene ${n} páginas. Elige la página con la que empieza la segunda parte.`;
    const num = h('input', { type: 'number', class: 'name-input split-num', min: '2', max: String(n), value: String(cut), inputmode: 'numeric' });
    const slider = h('input', { type: 'range', class: 'split-range', min: '2', max: String(n), value: String(cut) });
    const c1 = h('canvas'), c2 = h('canvas');
    const cap1 = h('small'), cap2 = h('small');
    const summary = h('div', { class: 'split-summary' });
    const update = (v, from) => {
      cut = Math.min(Math.max(parseInt(v, 10) || 2, 2), n);
      if (from !== num) num.value = String(cut);
      if (from !== slider) slider.value = String(cut);
      cap1.textContent = `pág. ${cut - 1}`; cap2.textContent = `pág. ${cut}`;
      summary.replaceChildren(
        h('div', {}, h('b', {}, 'Parte 1: '), `${range(1, cut - 1)} (${cut - 1})`),
        h('div', {}, h('b', {}, 'Parte 2: '), `${range(cut, n)} (${n - cut + 1})`));
      clearTimeout(thumbT);
      thumbT = setTimeout(() => { thumb(c1, cut - 1); thumb(c2, cut); }, 120);
    };
    num.addEventListener('input', () => { if (num.value !== '') update(num.value, num); });
    num.addEventListener('change', () => update(num.value, null));
    slider.addEventListener('input', () => update(slider.value, slider));
    content.replaceChildren(
      h('label', { class: 'name-label' }, 'Primera página de la segunda parte'),
      h('div', { class: 'split-pick' }, num, n > 2 ? slider : null),
      h('div', { class: 'split-preview' },
        h('figure', {}, c1, h('figcaption', {}, 'Fin de la parte 1 · ', cap1)),
        h('div', { class: 'split-scissors', 'aria-hidden': 'true' }, '✂'),
        h('figure', {}, c2, h('figcaption', {}, 'Inicio de la parte 2 · ', cap2))),
      summary);
    update(cut, null);
    back.textContent = preId && step === 2 && doc.id === preId ? 'Cancelar' : 'Atrás';
    next.textContent = 'Siguiente'; next.disabled = false;
  };

  const drawNames = () => {
    const n = doc.pageCount;
    title.textContent = 'Nombres de los dos documentos';
    sub.textContent = '¿Cómo quieres que se llamen las dos partes?';
    const key = `${doc.id}|${cut}`;
    if (namesFor !== key) { name1.value = `${doc.name} (1)`; name2.value = `${doc.name} (2)`; namesFor = key; }
    const err = h('p', { class: 'merge-err', hidden: true }, 'Escribe un nombre para cada documento.');
    const check = () => { err.hidden = true; next.disabled = !name1.value.trim() || !name2.value.trim(); };
    name1.oninput = check; name2.oninput = check;
    name1.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); name2.focus(); name2.select(); } };
    name2.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); next.click(); } };
    content.replaceChildren(
      h('label', { class: 'name-label' }, `Parte 1 · ${range(1, cut - 1)}`), h('div', { class: 'name-row' }, name1),
      h('label', { class: 'name-label' }, `Parte 2 · ${range(cut, n)}`), h('div', { class: 'name-row' }, name2), err,
      h('p', { class: 'merge-note' }, `Se guardarán en «${where(doc)}». El documento original no cambia.`));
    back.textContent = 'Atrás'; next.textContent = 'Crear documentos';
    check();
    setTimeout(() => { name1.focus(); name1.select(); }, 0);
  };

  const draw = () => (step === 1 ? drawPick() : step === 2 ? drawCut() : drawNames());
  back.addEventListener('click', () => {
    if (step === 1 || (step === 2 && back.textContent === 'Cancelar')) { dlg.close(); return; }
    step--; draw();
  });
  next.addEventListener('click', async () => {
    if (step === 1) { if (!doc) return; step = 2; draw(); return; }
    if (step === 2) { step = 3; draw(); return; }
    const n1 = name1.value.trim().replace(/\s+/g, ' '), n2 = name2.value.trim().replace(/\s+/g, ' ');
    if (!n1 || !n2) { content.querySelector('.merge-err').hidden = false; return; }
    dlg.close();
    await splitDoc(doc.id, cut, [n1, n2]);
  });
  dlg.addEventListener('close', () => { clearTimeout(thumbT); pdfP?.then((x) => x.destroy()).catch(() => {}); dlg.remove(); });
  document.body.append(dlg);
  draw();
  dlg.showModal();
}

async function splitDoc(id, cut, names) {
  busy(true, 'Fisionando el documento…');
  try {
    const { PDFDocument } = await loadPdfLib();
    const [doc, file] = await Promise.all([db.get('docs', id), db.get('files', id)]);
    if (!doc || !file) throw new Error('Documento no encontrado');
    const src = await PDFDocument.load(file.data.slice(0), { ignoreEncryption: true });
    const n = src.getPageCount();
    if (cut < 2 || cut > n) throw new Error('Página de separación no válida');
    const allMarks = await db.marksOf(id);
    const parts = [[1, cut - 1], [cut, n]];
    const created = [];
    for (const [k, [a, b]] of parts.entries()) {
      busy(true, `Fisionando el documento… (${k + 1}/2)`);
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
      pages.forEach((pg) => out.addPage(pg));
      const bytes = await out.save();
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const info = await analyzePdf(buf.slice(0));
      const newId = uid();
      const marks = allMarks.filter((m) => m.page >= a && m.page <= b).map((m) => {
        const c = structuredClone(m);
        c.id = uid(); c.docId = newId; c.page = m.page - a + 1;
        return c;
      });
      await db.put('files', { id: newId, data: buf });
      await db.put('docs', {
        id: newId, name: names[k], size: buf.byteLength, addedAt: Date.now() + k, openedAt: 0,
        pageCount: info.pageCount, pageChars: info.pageChars, thumb: info.thumb,
        read: (doc.read || []).filter((p) => p >= a && p <= b).map((p) => p - a + 1),
        lastPage: 1, zoom: doc.zoom || 1, folderId: doc.folderId || null,
        lang: doc.lang || info.lang, splitFrom: { id, pages: [a, b] },
      });
      for (const m of marks) await db.put('marks', m);
      created.push(`«${names[k]}» (${b - a + 1} pág.)`);
    }
    busy(false);
    await renderLibrary();
    toast(`Creados ${created.join(' y ')}`);
  } catch (err) {
    console.error(err);
    busy(false);
    toast(`No se pudo fisionar el documento${err?.message ? `: ${err.message}` : ''}`);
  }
}

async function mergeDocs(ids, name) {
  busy(true, 'Fusionando documentos…');
  try {
    const { PDFDocument } = await loadPdfLib();
    const out = await PDFDocument.create();
    const newId = uid();
    const marks = [], read = [];
    let firstLang = null;
    let offset = 0;
    for (const [k, id] of ids.entries()) {
      busy(true, `Fusionando documentos… (${k + 1}/${ids.length})`);
      const [doc, file] = await Promise.all([db.get('docs', id), db.get('files', id)]);
      if (!doc || !file) throw new Error('Documento no encontrado');
      const src = await PDFDocument.load(file.data.slice(0), { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((pg) => out.addPage(pg));
      for (const m of await db.marksOf(id)) {
        const c = structuredClone(m);
        c.id = uid(); c.docId = newId; c.page = m.page + offset;
        marks.push(c);
      }
      for (const n of doc.read || []) read.push(n + offset);
      if (k === 0) firstLang = doc.lang || null;
      offset += pages.length;
    }
    busy(true, 'Guardando el nuevo documento…');
    const bytes = await out.save();
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const info = await analyzePdf(buf.slice(0));
    await db.put('files', { id: newId, data: buf });
    await db.put('docs', {
      id: newId, name, size: buf.byteLength, addedAt: Date.now(), openedAt: 0,
      pageCount: info.pageCount, pageChars: info.pageChars, thumb: info.thumb,
      read: [...new Set(read)].sort((a, b) => a - b), lastPage: 1, zoom: 1, folderId: LIB.folderId,
      lang: firstLang || info.lang, mergedFrom: ids, // idioma del primer documento
    });
    for (const m of marks) await db.put('marks', m);
    busy(false);
    await renderLibrary();
    toast(`Creado «${name}» (${info.pageCount} páginas${marks.length ? `, ${marks.length} marcas` : ''})`);
  } catch (err) {
    console.error(err);
    busy(false);
    toast(`No se pudieron fusionar los documentos${err?.message ? `: ${err.message}` : ''}`);
  }
}

/* Menú contextual pequeño */
let menuEl = null;
function closeMenu() { menuEl?.remove(); menuEl = null; }
function showMenu(anchor, items) {
  closeMenu();
  menuEl = h('div', { class: 'ctx-menu', role: 'menu' }, items.map((it) => {
    const b = h('button', { type: 'button', class: `ctx-item${it.danger ? ' danger' : ''}`, role: 'menuitem' }, svgIcon(it.icon), it.label);
    b.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); it.fn(); });
    return b;
  }));
  document.body.append(menuEl);
  const r = anchor.getBoundingClientRect();
  const mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
  let left = Math.min(window.innerWidth - mw - 8, r.right - mw);
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  menuEl.style.left = `${Math.max(8, left)}px`; menuEl.style.top = `${top}px`;
  menuEl.querySelector('button')?.focus();
}
document.addEventListener('pointerdown', (e) => { if (menuEl && !e.target.closest('.ctx-menu')) closeMenu(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('scroll', closeMenu, { passive: true });

/* Diálogo para escribir un nombre */
function askText({ title, label, value = '', ok = 'Aceptar' }) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', class: 'name-input', value, maxlength: '120' });
    const dlg = h('dialog', { class: 'name-dialog' },
      h('form', { method: 'dialog' },
        h('h3', {}, title),
        h('label', { class: 'name-label' }, label),
        h('div', { class: 'name-row' }, input),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn ghost', value: 'cancel', type: 'submit' }, 'Cancelar'),
          h('button', { class: 'btn primary', value: 'ok', type: 'submit' }, ok))));
    document.body.append(dlg);
    dlg.addEventListener('close', () => {
      const v = input.value.trim().replace(/\s+/g, ' ');
      dlg.remove();
      resolve(dlg.returnValue === 'ok' && v ? v : null);
    });
    dlg.showModal();
    input.focus(); input.select();
  });
}

/* ---------- Papelera ----------
   «Eliminar» manda el documento a la papelera (se puede restaurar con sus notas).
   Desde la papelera se puede borrar de forma permanente. */
async function deleteDoc(d) {
  const doc = await db.get('docs', d.id);
  if (!doc) return;
  doc.trashedAt = Date.now();
  await db.put('docs', doc);
  await renderLibrary();
  toast(`«${doc.name}» se ha movido a la papelera`, { label: 'Deshacer', fn: () => restoreDoc(doc, true) });
}
async function restoreDoc(d, quiet = false) {
  const [doc, folders] = await Promise.all([db.get('docs', d.id), db.getAll('folders')]);
  if (!doc) return;
  delete doc.trashedAt;
  const lost = doc.folderId && !folders.some((f) => f.id === doc.folderId);
  if (lost) doc.folderId = null; // su carpeta ya no existe: vuelve a la Biblioteca
  await db.put('docs', doc);
  await renderLibrary();
  if (!quiet) toast(`«${doc.name}» restaurado en «${folderPath(folders, doc.folderId).map((f) => f.name).join(' › ') || 'Biblioteca'}»`);
}
async function purgeDoc(d) {
  for (const m of await db.marksOf(d.id)) await db.del('marks', m.id);
  await db.del('files', d.id);
  await db.del('docs', d.id);
}
async function purgeOne(d) {
  if (!confirm(`¿Eliminar «${d.name}» de forma permanente?\n\nSe borrarán el PDF y todas sus notas. No se podrá recuperar.`)) return;
  await purgeDoc(d);
  await renderLibrary();
  toast(`«${d.name}» eliminado definitivamente`);
}
async function emptyTrash() {
  const docs = (await db.getAll('docs')).filter((d) => !live(d));
  if (!docs.length) return;
  if (!confirm(`¿Vaciar la papelera?\n\nSe eliminarán de forma permanente ${docs.length} documento${docs.length > 1 ? 's' : ''} con sus notas. No se podrán recuperar.`)) return;
  busy(true, 'Vaciando la papelera…');
  try { for (const d of docs) await purgeDoc(d); } finally { busy(false); }
  await renderLibrary();
  toast('Papelera vaciada');
}
function setTrash(on) { LIB.trash = on; closeMenu(); renderLibrary(); scrollTo(0, 0); }
const fmtDate = (t) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
function renderTrash(trashed, folders) {
  const crumbs = $('#crumbs');
  const lib = h('button', { class: 'crumb', type: 'button' }, 'Biblioteca');
  lib.addEventListener('click', () => setTrash(false));
  crumbs.replaceChildren(lib, svgIcon(ICON.chevron), h('span', { class: 'crumb current' }, 'Papelera'));
  crumbs.hidden = false;
  $('#emptyState').hidden = true;
  $('#folderEmpty').hidden = true;
  const bar = $('#trashBar');
  bar.hidden = false;
  $('#trashInfo').textContent = trashed.length
    ? 'Los documentos eliminados se guardan aquí con sus notas. Puedes restaurarlos o eliminarlos de forma permanente.'
    : 'La papelera está vacía.';
  $('#btnEmptyTrash').hidden = !trashed.length;
  const grid = $('#docGrid');
  grid.replaceChildren();
  trashed.sort((a, b) => b.trashedAt - a.trashedAt);
  for (const d of trashed) {
    const from = folderPath(folders, d.folderId || null).map((f) => f.name).join(' › ') || 'Biblioteca';
    const rest = h('button', { type: 'button', class: 'btn small' }, svgIcon(ICON.restore), 'Restaurar');
    const del = h('button', { type: 'button', class: 'btn small danger', title: 'Eliminar de forma permanente' }, svgIcon(ICON.trash), 'Eliminar');
    rest.addEventListener('click', (e) => { e.stopPropagation(); restoreDoc(d); });
    del.addEventListener('click', (e) => { e.stopPropagation(); purgeOne(d); });
    grid.append(h('div', { class: 'card trash-card', title: d.name },
      h('div', { class: 'thumb' }, d.thumb ? h('img', { src: d.thumb, alt: '', draggable: 'false' }) : null),
      h('div', { class: 'body' },
        h('div', { class: 'name' }, d.name),
        h('div', { class: 'meta trash-meta' }, `Eliminado el ${fmtDate(d.trashedAt)} · de «${from}»`),
        h('div', { class: 'trash-actions' }, rest, del))));
  }
}

async function importFiles(fileList) {
  LIB.trash = false;
  const files = [...fileList].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!files.length) { toast('Solo se admiten archivos PDF'); return; }
  for (const [i, f] of files.entries()) {
    busy(true, `Importando ${files.length > 1 ? `${i + 1}/${files.length}: ` : ''}${f.name}`);
    try {
      const buf = await f.arrayBuffer();
      const info = await analyzePdf(buf.slice(0));
      const id = uid();
      await db.put('files', { id, data: buf });
      await db.put('docs', {
        id, name: f.name.replace(/\.pdf$/i, ''), size: f.size, addedAt: Date.now(), openedAt: 0,
        pageCount: info.pageCount, pageChars: info.pageChars, thumb: info.thumb,
        read: [], lastPage: 1, zoom: 1, folderId: LIB.folderId, lang: info.lang,
      });
    } catch (err) {
      console.error(err);
      toast(`No se pudo abrir ${f.name}${err?.name === 'PasswordException' ? ' (protegido con contraseña)' : ''}`);
    }
  }
  busy(false);
  try { await navigator.storage?.persist?.(); } catch {}
  renderLibrary();
}

/* Cuenta caracteres por página (para el % leído) y crea miniatura */
async function analyzePdf(buf) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageChars = [];
  let thumb = null, sample = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    if (sample.length < 30000) sample += ` ${tc.items.map((it) => it.str || '').join(' ')}`;
    pageChars.push(tc.items.reduce((a, it) => a + (it.str ? it.str.replace(/\s+/g, '').length : 0), 0));
    if (i === 1) {
      const vp = page.getViewport({ scale: 1 });
      const scale = 320 / vp.width;
      const v = page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.round(v.width); c.height = Math.round(v.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
      thumb = c.toDataURL('image/jpeg', 0.75);
    }
    page.cleanup();
  }
  const pageCount = pdf.numPages;
  await pdf.destroy();
  return { pageCount, pageChars, thumb, lang: detectLang(sample) };
}

/* =========================================================
   LECTOR
   ========================================================= */
const R = {
  doc: null, pdf: null, marks: [], pages: [], // pages[i] = {num, w, h, rot, el, block, sheet, rendered, ...}
  baseScale: 1, scale: 1, mode: 'text', observer: null, visObserver: null, saveTimer: null,
  bytes: null, glyphs: new Map(),
};

async function openDoc(id) {
  busy(true, 'Abriendo…');
  try {
    const doc = await db.get('docs', id);
    const file = await db.get('files', id);
    if (!doc || !file) throw new Error('No encontrado');
    R.doc = doc;
    R.bytes = file.data;
    R.marks = await db.marksOf(id);
    R.glyphs = new Map();
    R.pdf = await pdfjsLib.getDocument({ data: file.data.slice(0) }).promise;
    doc.openedAt = Date.now();
    db.put('docs', doc);
    $('#library').hidden = true;
    $('#reader').hidden = false;
    $('#readerTitle').textContent = doc.name;
    document.title = `${doc.name} · Study App`;
    setMode('text');
    updateLangButton();
    labelTagRow();
    await buildPages();
    updateProgress();
    scrollToPage(doc.lastPage || 1, false);
    history.pushState({ doc: id }, '', `#doc=${id}`);
    // Si el documento se importó antes de tener recuento de texto, calcularlo ahora
    if (!doc.pageChars || doc.pageChars.length !== R.pdf.numPages) computeCharsInBackground();
    if (!doc.lang) detectLangInBackground();
  } catch (err) {
    console.error(err);
    toast('No se pudo abrir el documento');
    closeReader(false);
  } finally {
    busy(false);
  }
}

async function computeCharsInBackground() {
  const pdf = R.pdf, doc = R.doc;
  const chars = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    if (R.pdf !== pdf) return;
    const p = await pdf.getPage(i);
    const tc = await p.getTextContent();
    chars.push(tc.items.reduce((a, it) => a + (it.str ? it.str.replace(/\s+/g, '').length : 0), 0));
  }
  doc.pageChars = chars; doc.pageCount = pdf.numPages;
  await db.put('docs', doc);
  updateProgress();
}

async function detectLangInBackground() {
  const pdf = R.pdf, doc = R.doc;
  let sample = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 8) && sample.length < 30000; i++) {
    if (R.pdf !== pdf) return;
    const tc = await (await pdf.getPage(i)).getTextContent();
    sample += ` ${tc.items.map((it) => it.str || '').join(' ')}`;
  }
  if (R.doc !== doc || doc.lang) return;
  await setDocLang(detectLang(sample));
}
function updateLangButton() {
  const b = $('#btnLang');
  if (b) { b.textContent = docLang().toUpperCase(); b.title = `Idioma del documento: ${LANGS.find(([k]) => k === docLang())[1]} (notas y editor)`; }
}
async function setDocLang(l) {
  if (!R.doc) return;
  R.doc.lang = l;
  await db.put('docs', R.doc);
  updateLangButton();
  labelTagRow();
  for (const p of R.pages) if (noteMarksOfPage(p.num).length) renderSheet(p.num);
}
function chooseLang(anchor) {
  showMenu(anchor, LANGS.map(([k, name]) => ({ icon: k === docLang() ? ICON.check : '', label: name, fn: () => { if (k !== docLang()) setDocLang(k); } })));
}

function closeReader(push = true) {
  R.observer?.disconnect(); R.visObserver?.disconnect();
  if (R.pdf) { R.pdf.destroy(); }
  R.pdf = null; R.doc = null; R.pages = []; R.bytes = null;
  $('#pages').replaceChildren();
  $('#reader').hidden = true;
  $('#library').hidden = false;
  hidePopup();
  document.title = 'Study App';
  if (push) history.pushState({}, '', location.pathname);
  renderLibrary();
}

function computeBaseScale(firstW) {
  const avail = Math.min(document.documentElement.clientWidth, window.innerWidth) - 16;
  return Math.min(avail / firstW, 1.4);
}

async function buildPages() {
  const container = $('#pages');
  clearSelection(); hidePopup();
  container.replaceChildren();
  R.observer?.disconnect(); R.visObserver?.disconnect();
  R.pages = [];
  const n = R.pdf.numPages;
  // Tamaños de todas las páginas
  for (let i = 1; i <= n; i++) {
    const page = await R.pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    R.pages.push({ num: i, page, w: vp.width, h: vp.height, rendered: false });
  }
  R.baseScale = computeBaseScale(R.pages[0].w);
  R.scale = R.baseScale * (R.doc.zoom || 1);
  $('#zoomLabel').textContent = `${Math.round((R.doc.zoom || 1) * 100)} %`;

  R.observer = new IntersectionObserver(onRenderIntersect, { rootMargin: '1200px 0px' });
  R.visObserver = new IntersectionObserver(onVisibleIntersect, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  const frag = document.createDocumentFragment();
  for (const p of R.pages) {
    const W = Math.floor(p.w * R.scale), H = Math.floor(p.h * R.scale);
    p.el = h('section', { class: 'page', 'data-page': p.num, style: { width: `${W}px`, height: `${H}px` } });
    p.canvas = h('canvas');
    p.markLayer = h('div', { class: 'mark-layer' });
    p.badgeLayer = h('div', { class: 'badge-layer' });
    p.areaLayer = h('div', { class: 'area-layer' });
    p.corrLayer = h('div', { class: 'corr-layer' });
    p.selLayer = h('div', { class: 'sel-layer' });
    p.handleLayer = h('div', { class: 'handle-layer' });
    p.el.append(p.canvas, p.markLayer, p.selLayer, p.corrLayer, p.badgeLayer, p.areaLayer, p.handleLayer);
    attachAreaHandlers(p);
    attachTextSelection(p);

    p.toggle = h('button', { class: 'read-toggle', onclick: () => toggleRead(p.num) });
    const footer = h('div', { class: 'page-footer', style: { width: `${W}px` } },
      h('span', {}, `Página ${p.num} de ${n}`), p.toggle);
    p.sheetHolder = h('div');
    p.block = h('div', { class: 'page-block', id: `p${p.num}` }, p.el, footer, p.sheetHolder);
    p.footer = footer;
    frag.append(p.block);
    R.observer.observe(p.el);
    R.visObserver.observe(p.el);
  }
  container.append(frag);
  for (const p of R.pages) { refreshReadUI(p.num); drawMarks(p.num); renderSheet(p.num); }
}

function onRenderIntersect(entries) {
  for (const e of entries) {
    const p = R.pages[+e.target.dataset.page - 1];
    if (!p) continue;
    if (e.isIntersecting) renderPage(p);
    else releasePage(p);
  }
}

const visRatios = new Map();
function onVisibleIntersect(entries) {
  for (const e of entries) visRatios.set(+e.target.dataset.page, e.intersectionRatio * e.target.offsetHeight);
  let best = 0, bestNum = 1;
  for (const [num, v] of visRatios) if (v > best) { best = v; bestNum = num; }
  if (R.doc && best > 0) {
    $('#pageIndicator').textContent = `Pág. ${bestNum} / ${R.pages.length}`;
    if (R.doc.lastPage !== bestNum) {
      R.doc.lastPage = bestNum;
      clearTimeout(R.saveTimer);
      R.saveTimer = setTimeout(() => R.doc && db.put('docs', R.doc), 800);
    }
  }
}

async function renderPage(p) {
  if (p.rendered || p.rendering) return;
  p.rendering = true;
  const token = (p.token = Symbol());
  try {
    const vp = p.page.getViewport({ scale: R.scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    // límite de memoria del canvas (iOS ~16 Mpx)
    let ratio = dpr;
    const maxPx = 12e6;
    if (vp.width * vp.height * ratio * ratio > maxPx) ratio = Math.sqrt(maxPx / (vp.width * vp.height));
    const canvas = p.canvas;
    canvas.width = Math.floor(vp.width * ratio);
    canvas.height = Math.floor(vp.height * ratio);
    const ctx = canvas.getContext('2d');
    p.renderTask = p.page.render({ canvasContext: ctx, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null });
    await p.renderTask.promise;
    if (p.token !== token) return;
    // Posición exacta de cada carácter (para seleccionar letra a letra)
    if (!R.glyphs.has(p.num)) R.glyphs.set(p.num, extractGlyphs(p.page).catch((e) => { console.warn('glyphs', e); return emptyGlyphs(); }));
    p.glyphs = await R.glyphs.get(p.num);
    upgradeCorrections(p);
    if (p.token !== token) return;
    p.rendered = true;
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') console.warn(err);
  } finally {
    p.rendering = false;
  }
}

/* ---------- Posición exacta de cada carácter ----------
   Se leen las órdenes de dibujo de la página (las mismas que usa pdf.js para
   pintarla) y se calcula la caja de cada letra en la página. Así la selección
   coincide letra a letra con lo que se ve, sea cual sea la fuente. */
const MATH_FONT_RE = /CMMI|CMSY|CMEX|CMBSY|CMMIB|MSAM|MSBM|EUFM|EUSM|RSFS|STMARY|WASY|Math|STIX|XITS|Symbol|Cambria.?Math|Asana/i;
const MATH_CHAR_RE = /[Ͱ-Ͽ⁰-₟℀-⅏←-⋿⨀-⫿⟨-⟯±×÷²³¹\u{1D400}-\u{1D7FF}]/u;
const mulM = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const emptyGlyphs = () => ({ g: [], nl: new Uint8Array(0), sp: new Uint8Array(0) });

async function extractGlyphs(page) {
  const OPS = pdfjsLib.OPS;
  const vp = page.getViewport({ scale: 1 });
  const VW = vp.width, VH = vp.height;
  const { fnArray: fns, argsArray: args } = await page.getOperatorList();
  const fonts = new Map();
  const fontOf = (name) => {
    if (fonts.has(name)) return fonts.get(name);
    let f = null;
    try { if (page.commonObjs.has(name)) f = page.commonObjs.get(name); } catch {}
    const fm = f?.fontMatrix || [0.001, 0, 0, 0.001, 0, 0];
    let asc = f?.ascent, desc = f?.descent;
    if (!(asc > 0.3 && asc < 1.6)) asc = 0.8;
    if (!(desc < 0 && desc > -0.7)) desc = -0.2;
    const info = { fm, asc, desc, type3: !!f?.isType3Font, vertical: !!f?.vertical, math: MATH_FONT_RE.test(f?.name || '') };
    fonts.set(name, info);
    return info;
  };
  let st = { ctm: vp.transform.slice(), tm: [1, 0, 0, 1, 0, 0], x: 0, y: 0, lx: 0, ly: 0,
    font: null, fs: 0, dir: 1, tc: 0, tw: 0, th: 1, tl: 0, rise: 0 };
  const stack = [];
  const out = [];
  let ann = 0;
  const setFont = (name, size) => { st.font = fontOf(name); st.dir = size < 0 ? -1 : 1; st.fs = Math.abs(size); };
  const moveText = (x, y) => { st.lx += x; st.ly += y; st.x = st.lx; st.y = st.ly; };
  const show = (glyphs) => {
    const f = st.font;
    if (!f || !glyphs) return;
    const fs = st.fs, dir = st.dir, th = st.th * dir;
    const wScale = fs * f.fm[0];
    const M = mulM(mulM(st.ctm, st.tm), [1, 0, 0, 1, st.x, st.y + (f.type3 ? 0 : st.rise)]);
    const yT = f.asc * fs * dir, yB = f.desc * fs * dir;
    let x = 0;
    for (const g of glyphs) {
      if (typeof g === 'number') { x -= g * fs / 1000; continue; }
      const spacing = (g.isSpace ? st.tw : 0) + st.tc;
      const w = g.width * wScale;
      if (!ann && fs > 0 && !f.vertical && g.unicode) {
        const xa = x * th, xb = (x + w) * th;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [px, py] of [[xa, yB], [xb, yB], [xa, yT], [xb, yT]]) {
          const dx = M[0] * px + M[2] * py + M[4], dy = M[1] * px + M[3] * py + M[5];
          if (dx < x0) x0 = dx; if (dx > x1) x1 = dx; if (dy < y0) y0 = dy; if (dy > y1) y1 = dy;
        }
        if (x1 > 0 && y1 > 0 && x0 < VW && y0 < VH && y1 - y0 > 0.5) {
          const c = g.unicode.normalize('NFKC');
          out.push({ c, x0: x0 / VW, y0: y0 / VH, x1: Math.max(x1, x0 + 0.3) / VW, y1: y1 / VH,
            space: /^\s+$/.test(c), math: f.math });
        }
      }
      x += f.type3 ? w + spacing : w + spacing * dir;
    }
    st.x += x * th;
  };
  for (let i = 0; i < fns.length; i++) {
    const a = args[i];
    switch (fns[i]) {
      case OPS.save: stack.push({ ...st }); break;
      case OPS.restore: if (stack.length) st = stack.pop(); break;
      case OPS.transform: st.ctm = mulM(st.ctm, a); break;
      case OPS.paintFormXObjectBegin: stack.push({ ...st }); if (a?.[0]) st.ctm = mulM(st.ctm, a[0]); break;
      case OPS.paintFormXObjectEnd: if (stack.length) st = stack.pop(); break;
      case OPS.beginGroup: stack.push({ ...st }); if (a?.[0]?.matrix) st.ctm = mulM(st.ctm, a[0].matrix); break;
      case OPS.endGroup: if (stack.length) st = stack.pop(); break;
      case OPS.beginAnnotation: ann++; break;
      case OPS.endAnnotation: ann = Math.max(0, ann - 1); break;
      case OPS.beginText: st.tm = [1, 0, 0, 1, 0, 0]; st.x = st.lx = 0; st.y = st.ly = 0; break;
      case OPS.setCharSpacing: st.tc = a[0]; break;
      case OPS.setWordSpacing: st.tw = a[0]; break;
      case OPS.setHScale: st.th = a[0] / 100; break;
      case OPS.setLeading: st.tl = -a[0]; break;
      case OPS.setTextRise: st.rise = a[0]; break;
      case OPS.setFont: setFont(a[0], a[1]); break;
      case OPS.setGState: for (const [k, v] of a[0] || []) if (k === 'Font') setFont(v[0], v[1]); break;
      case OPS.moveText: moveText(a[0], a[1]); break;
      case OPS.setLeadingMoveText: st.tl = a[1]; moveText(a[0], a[1]); break;
      case OPS.setTextMatrix: st.tm = [a[0], a[1], a[2], a[3], a[4], a[5]]; st.x = st.lx = 0; st.y = st.ly = 0; break;
      case OPS.nextLine: moveText(0, st.tl); break;
      case OPS.showText: case OPS.showSpacedText: show(a[0]); break;
      case OPS.nextLineShowText: moveText(0, st.tl); show(a[0]); break;
      case OPS.nextLineSetSpacingShowText: st.tw = a[0]; st.tc = a[1]; moveText(0, st.tl); show(a[2]); break;
    }
  }
  // Saltos de línea y espacios implícitos entre caracteres consecutivos
  const n = out.length, nl = new Uint8Array(n), sp = new Uint8Array(n);
  const ar = VH / VW; // para comparar distancias horizontales y verticales
  for (let i = 1; i < n; i++) {
    const a = out[i - 1], b = out[i];
    const ha = a.y1 - a.y0, hb = b.y1 - b.y0, hm = Math.min(ha, hb);
    const dy = Math.abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
    if (dy > hm * 0.55 || b.x1 < a.x0 - hm * ar * 0.5 || b.x0 > a.x1 + hm * ar * 4) nl[i] = 1;
    else if (!a.space && !b.space && b.x0 - a.x1 > hm * ar * 0.18) sp[i] = 1;
  }
  return { g: out, nl, sp };
}

function releasePage(p) {
  if (!p.rendered && !p.rendering) return;
  p.token = null;
  try { p.renderTask?.cancel(); } catch {}
  p.canvas.width = 0; p.canvas.height = 0;
  p.rendered = false; p.rendering = false;
}

function scrollToPage(num, smooth = true) {
  const p = R.pages[num - 1];
  if (!p) return;
  const top = p.block.getBoundingClientRect().top + window.scrollY - 70;
  window.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
}

async function setZoom(z) {
  z = Math.max(0.5, Math.min(4, Math.round(z * 100) / 100));
  if (!R.doc || z === R.doc.zoom) return;
  const current = R.doc.lastPage || 1;
  // posición relativa dentro de la página actual
  const p = R.pages[current - 1];
  const rect = p.el.getBoundingClientRect();
  const rel = rect.height ? (70 - rect.top) / rect.height : 0;
  R.doc.zoom = z;
  db.put('docs', R.doc);
  for (const pg of R.pages) releasePage(pg);
  await buildPages();
  const np = R.pages[current - 1];
  const top = np.el.getBoundingClientRect().top + window.scrollY - 70 + rel * np.el.offsetHeight;
  window.scrollTo({ top, behavior: 'instant' });
}

/* ---------- Páginas leídas y progreso ---------- */
async function toggleRead(num) {
  const read = new Set(R.doc.read || []);
  if (read.has(num)) read.delete(num); else read.add(num);
  R.doc.read = [...read].sort((a, b) => a - b);
  await db.put('docs', R.doc);
  refreshReadUI(num);
  updateProgress();
}
function refreshReadUI(num) {
  const p = R.pages[num - 1];
  const on = (R.doc.read || []).includes(num);
  p.el.classList.toggle('read', on);
  p.toggle.classList.toggle('on', on);
  p.toggle.replaceChildren(svgIcon(on ? ICON.check : ICON.circle), on ? 'Leída' : 'Marcar como leída');
}
function updateProgress() {
  if (!R.doc) return;
  const pr = progressOf(R.doc);
  $('#progressText').textContent = `${fmtPct(pr)} leído`;
  $('#progressBar').style.width = `${pr * 100}%`;
}

/* =========================================================
   MARCAS
   ========================================================= */
const marksOfPage = (num) => R.marks
  .filter((m) => m.page === num)
  .sort((a, b) => (a.rects[0][1] - b.rects[0][1]) || (a.rects[0][0] - b.rects[0][0]) || (a.createdAt - b.createdAt));
const noteMarksOfPage = (num) => marksOfPage(num).filter(hasNote);

function drawMarks(num) {
  const p = R.pages[num - 1];
  p.markLayer.replaceChildren();
  p.badgeLayer.replaceChildren();
  let n = 0;
  marksOfPage(num).forEach((m) => {
    const c = tagById(m.tag).color;
    for (const [x, y, w, hh] of m.rects) {
      const el = h('div', { class: `hl ${m.kind === 'area' ? 'area' : ''}`, 'data-id': m.id, style: {
        left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${hh * 100}%`,
        background: hexA(c, 0.42),
      } });
      el.style.setProperty('--c', c);
      p.markLayer.append(el);
    }
    if (!hasNote(m)) return; // solo color, sin número
    const [x0, y0] = m.rects[0];
    const b = h('div', { class: 'badge', title: 'Ir a la nota', style: { left: `${x0 * 100}%`, top: `${y0 * 100}%` },
      onclick: () => focusNote(m.id, false) }, String(++n));
    b.style.setProperty('--c', c);
    p.badgeLayer.append(b);
  });
  drawCorrections(p);
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- Páginas de notas tras cada página ----------
   Cada hoja de notas tiene el mismo tamaño que la página del PDF. El comentario
   se escribe en LaTeX (editor tipo Overleaf) y en la hoja se ve el resultado.
   Si no cabe, continúa en otra hoja justo detrás (se reparte por párrafos,
   fórmulas y listas). */
const imgSizes = new Map(); // id de nota → {w, h} de su imagen
async function ensureImageSizes(ms) {
  await Promise.all(ms.filter((m) => m.image && !imgSizes.has(m.id)).map((m) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { imgSizes.set(m.id, { w: im.naturalWidth, h: im.naturalHeight }); res(); };
    im.onerror = () => { imgSizes.set(m.id, { w: 1, h: 1 }); res(); };
    im.src = m.image;
  })));
}
// Imagen del fragmento; los renglones con fórmulas se muestran al mismo tamaño que en la página
function cropImg(m) {
  const sz = imgSizes.get(m.id);
  const img = h('img', { class: `crop ${m.imagePpu ? 'line' : ''}`, src: m.image, alt: m.text || 'Fragmento marcado',
    width: sz?.w, height: sz?.h });
  if (m.imagePpu && sz) img.style.width = `${(sz.w / m.imagePpu) * R.scale}px`;
  return img;
}

// Imagen del fragmento en el editor: un poco mayor que en la página y nunca diminuta
function editorImg(m) {
  const sz = imgSizes.get(m.id);
  const img = h('img', { class: 'crop', src: m.image, alt: m.text || 'Fragmento marcado' });
  if (sz && sz.w > 1) {
    let w = m.imagePpu ? (sz.w / m.imagePpu) * R.scale * 1.3 : sz.w;
    const minH = 34; // altura mínima legible (px)
    if ((sz.h * w) / sz.w < minH) w = (minH * sz.w) / sz.h;
    img.style.width = `${Math.round(w)}px`;
  }
  return img;
}

// Comentarios antiguos (texto normal) → código LaTeX equivalente
const plainToLatex = (t) => (t || '').replace(/([%$&#])/g, '\\$1');
const commentSource = (m) => (m.fmt === 'latex' ? m.comment || '' : plainToLatex(m.comment));
// Bloques ya dibujados de cada comentario (caché)
const commentCache = new Map();
const figsKey = (m) => Object.entries(m.figs || {}).map(([k, v]) => `${k}:${v.url.length}`).join('|');
function commentBlocks(m) {
  const src = commentSource(m);
  const key = `${src}\u0000${figsKey(m)}\u0000${docLang()}`;
  const c = commentCache.get(m.id);
  if (c && c.src === key) return c.promise;
  const promise = (src.trim() ? renderLatex(src, m.figs || {}, T('figure')) : Promise.resolve([])).catch((e) => {
    console.warn(e);
    return [h('p', { class: 'tx-p' }, m.comment || '')];
  });
  commentCache.set(m.id, { src: key, promise });
  return promise;
}

function sheetShell(num, W, H) {
  const title = h('h3', {}, `${T('notes')} · ${T('page')} ${num}`);
  const body = h('div', { class: 'sheet-body' });
  const sheet = h('section', { class: 'sheet', 'data-page': num, style: { width: `${W}px`, height: `${H}px` } }, title, body);
  return { sheet, title, body };
}
// Bloque de una nota (o de la parte que continúa de la hoja anterior)
function noteBlock(m, i, first, blocks, interactive, num) {
  const t = tagById(m.tag);
  let head;
  if (first) {
    const sel = h('span', { class: 'tag-label' }, tagName(t)); // el tipo de la nota no se cambia desde aquí
    const edit = h('button', { class: 'icon-btn small', title: T('editTip'), 'aria-label': T('editTip') }, svgIcon(ICON.edit));
    const up = h('button', { class: 'icon-btn small', title: T('upTip'), 'aria-label': T('upTip') }, svgIcon(ICON.up));
    const del = h('button', { class: 'icon-btn small', title: T('delTip'), 'aria-label': T('delTip') }, svgIcon(ICON.trash));
    if (interactive) {
      edit.addEventListener('click', () => openEditor(m));
      up.addEventListener('click', () => focusMark(m.id));
      del.addEventListener('click', () => deleteMark(m));
    }
    head = h('div', { class: 'note-head' }, h('span', { class: 'num' }, String(i + 1)), sel, h('span', { class: 'spacer' }), edit, up, del);
  } else {
    head = h('div', { class: 'note-head cont' }, h('span', { class: 'num' }, String(i + 1)), h('span', { class: 'cont-label' }, `${tagName(t)} · ${T('cont')}`));
  }
  const empty = first && !(m.comment || '').trim();
  const body = h('div', { class: `note-body latex${empty ? ' empty' : ''}`, title: interactive ? T('bodyTip') : null },
    empty ? h('span', { class: 'placeholder' }, T('placeholder')) : blocks.map((b) => b.cloneNode(true)));
  if (interactive) body.addEventListener('click', (e) => { if (!e.target.closest('a')) openEditor(m); });
  const note = h('article', { class: `note${first ? '' : ' cont'}`, 'data-id': m.id },
    head,
    first ? (m.image ? cropImg(m) : h('blockquote', {}, m.text || '')) : null,
    body);
  note.style.setProperty('--c', t.color);
  return note;
}

// Reparto en hojas: [[{id, i, first, from, to}, …], …] (from/to = índices de bloque)
let measureBox = null;
function paginateNotes(num, ms, blocksById, W, H) {
  if (!measureBox) { measureBox = h('div', { class: 'measure-box' }); document.body.append(measureBox); }
  measureBox.replaceChildren();
  let shell = sheetShell(num, W, H);
  measureBox.append(shell.sheet);
  const sheets = [[]];
  const fits = () => shell.body.scrollHeight <= shell.body.clientHeight + 1;
  const newSheet = () => { shell.sheet.remove(); shell = sheetShell(num, W, H); measureBox.append(shell.sheet); sheets.push([]); };
  ms.forEach((m, i) => {
    const blocks = blocksById.get(m.id) || [];
    let pos = 0, first = true;
    for (let guard = 0; guard < 500; guard++) {
      const tryN = (end) => {
        const note = noteBlock(m, i, first, blocks.slice(pos, end), false, num);
        shell.body.append(note);
        const ok = fits();
        note.remove();
        return ok;
      };
      const place = (end) => {
        shell.body.append(noteBlock(m, i, first, blocks.slice(pos, end), false, num));
        sheets[sheets.length - 1].push({ id: m.id, i, first, from: pos, to: end });
      };
      if (tryN(blocks.length)) { place(blocks.length); break; }
      // cuántos bloques caben en esta hoja
      let lo = pos + 1, hi = blocks.length - 1, best = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (tryN(mid)) { best = mid; lo = mid + 1; } else hi = mid - 1; }
      const emptySheet = shell.body.childElementCount === 0;
      if (best > pos) { place(best); pos = best; first = false; newSheet(); }
      else if (!emptySheet) newSheet();
      else {
        // un bloque más alto que una hoja entera: se coloca solo en su hoja
        const end = Math.max(pos + 1, Math.min(blocks.length, pos + 1));
        place(end); pos = end; first = false;
        if (pos >= blocks.length) break;
        newSheet();
      }
    }
  });
  measureBox.replaceChildren();
  return sheets.filter((sh, k) => sh.length || k === 0);
}

const sheetRenders = new Map(); // nº de página → contador (descarta dibujados viejos)
async function renderSheet(num) {
  const p = R.pages[num - 1];
  if (!p) return;
  const ms = noteMarksOfPage(num);
  const ticket = (sheetRenders.get(num) || 0) + 1;
  sheetRenders.set(num, ticket);
  if (!ms.length) { p.sheetHolder.replaceChildren(); return; }
  // comentarios antiguos sin imagen del extracto: crearla ahora
  for (const m of ms) {
    if (m.kind === 'text' && (!m.image || m.cropV !== CROP_V) && R.pages[m.page - 1]) { await captureMathImage(m); if (m.cropV === CROP_V) await db.put('marks', m); }
  }
  await ensureImageSizes(ms);
  const blocksById = new Map();
  for (const m of ms) blocksById.set(m.id, await commentBlocks(m));
  if (R.pages[num - 1] !== p || sheetRenders.get(num) !== ticket) return;
  const W = parseFloat(p.el.style.width), H = parseFloat(p.el.style.height);
  const plan = paginateNotes(num, ms, blocksById, W, H);
  const byId = new Map(ms.map((m) => [m.id, m]));
  const frag = document.createDocumentFragment();
  plan.forEach((sh, k) => {
    const shell = sheetShell(num, W, H);
    if (plan.length > 1) shell.title.textContent = `${T('notes')} · ${T('page')} ${num} · ${T('sheetOf')(k + 1, plan.length)}`;
    for (const sg of sh) shell.body.append(noteBlock(byId.get(sg.id), sg.i, sg.first, (blocksById.get(sg.id) || []).slice(sg.from, sg.to), true, num));
    frag.append(shell.sheet);
  });
  p.sheetHolder.replaceChildren(frag);
}
const saveTimers = new Map();
function saveComment(m, now = false) {
  clearTimeout(saveTimers.get(m.id));
  const doSave = () => { m.updatedAt = Date.now(); return db.put('marks', m); };
  if (now) return doSave();
  saveTimers.set(m.id, setTimeout(doSave, 500));
}

/* ---------- Editor de comentarios tipo Overleaf ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}
function loadCss(href) { document.head.append(h('link', { rel: 'stylesheet', href })); }
let cmPromise = null;
function loadCodeMirror() {
  if (cmPromise) return cmPromise;
  loadCss('./vendor/codemirror/codemirror.css');
  loadCss('./vendor/codemirror/show-hint.css');
  cmPromise = loadScript('./vendor/codemirror/codemirror.js')
    .then(() => Promise.all(['stex', 'closebrackets', 'matchbrackets', 'show-hint'].map((f) => loadScript(`./vendor/codemirror/${f}.js`))))
    .then(() => window.CodeMirror);
  return cmPromise;
}
// Inserta un fragmento; «¦» marca dónde queda el cursor
function insertSnippet(cm, snippet, from, to) {
  const cur = cm.getCursor();
  from = from || cur; to = to || cur;
  const indent = (cm.getLine(from.line).match(/^\s*/) || [''])[0];
  const text = snippet.replace(/\n/g, `\n${indent}`);
  const idx = text.indexOf('¦');
  const clean = text.replace('¦', '');
  cm.replaceRange(clean, from, to);
  const start = cm.indexFromPos(from);
  cm.setCursor(cm.posFromIndex(start + (idx >= 0 ? idx : clean.length)));
  cm.focus();
}
function latexHint(cm) {
  const cur = cm.getCursor();
  const before = cm.getLine(cur.line).slice(0, cur.ch);
  const m = /\\[a-zA-Z]*$/.exec(before);
  if (!m) return null;
  const word = m[0];
  const starts = COMPLETIONS.filter(([c]) => c.startsWith(word));
  const contains = word.length > 2 ? COMPLETIONS.filter(([c]) => !c.startsWith(word) && c.toLowerCase().includes(word.slice(1).toLowerCase())) : [];
  const list = [...starts, ...contains].slice(0, 60).map(([snip, desc]) => ({
    text: snip.replace('¦', ''),
    displayText: `${snip.replace('¦', '').split('\n')[0]}   ${desc}`,
    hint: (cmi, data) => insertSnippet(cmi, snip, data.from, data.to),
  }));
  if (!list.length) return null;
  return { list, from: { line: cur.line, ch: cur.ch - word.length }, to: cur };
}
// Botones rápidos del editor: [etiqueta, título, fragmento | acción, ¿bloque propio?]
const KEYS = [
  [() => h('b', {}, 'B'), () => `${T('bold')}: \\textbf{…}`, '\\textbf{¦}'],
  [() => h('i', {}, 'I'), () => `${T('italic')}: \\textit{…}`, '\\textit{¦}'],
  [() => svgIcon(ICON.bullets), () => T('bullets'), '\\begin{itemize}\n  \\item ¦\n\\end{itemize}', true],
  [() => svgIcon(ICON.numbers), () => T('numbered'), '\\begin{enumerate}\n  \\item ¦\n\\end{enumerate}', true],
  [() => [svgIcon(ICON.image), ` ${T('figure')}`], () => T('figTip'), 'figure', true],
  [() => T('equation'), () => `${T('eqTip')}: \\begin{equation*} … \\end{equation*}`, '\\begin{equation*}\n  ¦\n\\end{equation*}', true],
];
// Inserta en su propia línea (saltos de línea delante/detrás si hace falta)
function insertBlock(cm, snippet) {
  const cur = cm.getCursor();
  const line = cm.getLine(cur.line);
  const pre = line.slice(0, cur.ch).trim() ? '\n' : '';
  const post = line.slice(cur.ch).trim() ? '\n' : '';
  insertSnippet(cm, pre + snippet + post);
}
// Lee una imagen y la reduce (máx. 1600 px); PNG o JPEG para que también vaya al PDF
async function readFigure(file) {
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('No se pudo leer la imagen')); img.src = url; });
  const nw = img.naturalWidth || 800, nh = img.naturalHeight || 600;
  const k = Math.min(1, 1600 / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * k)), hh = Math.max(1, Math.round(nh * k));
  const c = document.createElement('canvas'); c.width = w; c.height = hh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh);
  ctx.drawImage(img, 0, 0, w, hh);
  let out = /png|gif|svg|webp|bmp/.test(file.type) ? c.toDataURL('image/png') : '';
  if (!out || out.length > 1.6e6) out = c.toDataURL('image/jpeg', 0.9);
  return { url: out, w, h: hh };
}
let figInput = null;
function pickFigure() {
  if (!figInput) { figInput = h('input', { type: 'file', accept: 'image/*', hidden: true }); document.body.append(figInput); }
  figInput.value = '';
  figInput.onchange = async () => {
    const file = figInput.files[0];
    if (!file || !ED?.m) return;
    const m = ED.m;
    try {
      const fig = await readFigure(file);
      m.figs = m.figs || {};
      let n = 1; while (Object.keys(m.figs).some((k) => k.startsWith(`figura${n}.`))) n++;
      const name = `figura${n}.${fig.url.startsWith('data:image/png') ? 'png' : 'jpg'}`;
      m.figs[name] = fig;
      const frac = Math.max(0.2, Math.min(0.8, Math.round((fig.w / 567) * 20) / 20));
      await saveComment(m, true);
      if (ED.m !== m) return;
      insertBlock(ED.cm, `\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=${frac}\\textwidth]{${name}}\n  \\caption{¦}\n\\end{figure}`);
    } catch (e) { console.warn(e); toast('No se pudo añadir la imagen'); }
  };
  figInput.click();
}

let ED = null; // { root, cm, paper, quote, status, m, renderId, timer }
async function openEditor(m) {
  hidePopup(); clearSelection();
  const CM = await loadCodeMirror();
  loadMathJax().catch(() => {});
  if (!ED) {
    const status = h('span', { class: 'te-status' }, '');
    const done = h('button', { class: 'btn primary' }, T('done'));
    const title = h('div', { class: 'te-title' });
    const codeBox = h('div', { class: 'te-cm' });
    const paper = h('div', { class: 'te-paper latex' });
    const quote = h('div', { class: 'te-quote' });
    const keys = h('div', { class: 'te-keys' });
    const fillKeys = () => keys.replaceChildren(...KEYS.map(([label, title, snip, block]) => {
      const b = h('button', { class: 'te-key', type: 'button', title: title() }, label());
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        if (snip === 'figure') return pickFigure();
        const cm = ED.cm;
        // con texto seleccionado, negrita/cursiva lo envuelven
        if (!block && cm.somethingSelected()) {
          const sel = cm.getSelection();
          const [a, z] = snip.split('¦');
          cm.replaceSelection(a + sel + z); cm.focus(); return;
        }
        (block ? insertBlock : insertSnippet)(cm, snip);
      });
      return b;
    }));
    const codeLabel = h('div', { class: 'te-label' }), resultLabel = h('div', { class: 'te-label' });
    const root = h('div', { class: 'tex-editor', hidden: true },
      h('div', { class: 'te-panel', role: 'dialog', 'aria-label': 'Editor de comentario LaTeX' },
        h('header', { class: 'te-bar' }, title, h('span', { class: 'spacer' }), status, done),
        h('div', { class: 'te-main' },
          h('section', { class: 'te-code' }, codeLabel, codeBox, keys),
          h('section', { class: 'te-preview' }, resultLabel, h('div', { class: 'te-scroll' }, quote, paper)),
        )));
    document.body.append(root);
    const cm = CM(codeBox, {
      mode: 'stex', lineWrapping: true, lineNumbers: !coarsePointer, autoCloseBrackets: '()[]{}$$', matchBrackets: true,
      indentUnit: 2, tabSize: 2, viewportMargin: Infinity, spellcheck: false, inputStyle: 'contenteditable',
      hintOptions: { hint: latexHint, completeSingle: false },
      extraKeys: {
        'Ctrl-Space': 'autocomplete', 'Cmd-Enter': () => closeEditor(), 'Ctrl-Enter': () => closeEditor(),
        Esc: (c) => { if (c.state.completionActive) c.state.completionActive.close(); else closeEditor(); },
        Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('  ')),
      },
    });
    cm.on('inputRead', (c, ch) => {
      if (!/^[a-zA-Z\\]$/.test(ch.text[0] || '')) return;
      const cur = c.getCursor();
      if (/\\[a-zA-Z]*$/.test(c.getLine(cur.line).slice(0, cur.ch))) c.showHint();
    });
    cm.on('change', () => {
      if (!ED.m) return;
      ED.m.comment = cm.getValue(); ED.m.fmt = 'latex';
      ED.status.textContent = T('saving');
      clearTimeout(ED.saveT);
      ED.saveT = setTimeout(async () => { await saveComment(ED.m, true); if (ED?.m) ED.status.textContent = T('saved'); }, 500);
      clearTimeout(ED.timer);
      ED.timer = setTimeout(updatePreview, 220);
    });
    done.addEventListener('click', () => closeEditor());
    root.addEventListener('pointerdown', (e) => { if (e.target === root) closeEditor(); });
    ED = { root, cm, paper, quote, status, title, relabel: () => { fillKeys(); done.textContent = T('done'); codeLabel.textContent = T('code'); resultLabel.textContent = T('result'); } };
  }
  ED.m = m;
  ED.relabel();
  const t = tagById(m.tag);
  const idx = noteMarksOfPage(m.page).indexOf(m);
  ED.title.replaceChildren(h('span', { class: 'num', style: { background: t.color } }, String(idx + 1)),
    h('b', {}, T('comment')), h('span', { class: 'te-sub' }, ` · ${T('page')} ${m.page} · ${tagName(t)}`));
  await ensureImageSizes([m]);
  ED.quote.replaceChildren(m.image ? editorImg(m) : h('blockquote', {}, m.text || ''));
  ED.quote.style.setProperty('--c', t.color);
  ED.root.hidden = false;
  document.body.classList.add('editing');
  ED.cm.setValue(commentSource(m));
  ED.cm.clearHistory();
  ED.status.textContent = '';
  ED.cm.refresh();
  ED.cm.focus();
  ED.cm.setCursor(ED.cm.lineCount(), 0);
  updatePreview();
}
async function updatePreview() {
  if (!ED?.m) return;
  const id = (ED.renderId = (ED.renderId || 0) + 1);
  const src = ED.cm.getValue();
  let nodes;
  try { nodes = src.trim() ? await renderLatex(src, ED.m.figs || {}, T('figure')) : [h('p', { class: 'tx-p placeholder' }, T('previewPh'))]; }
  catch (e) { nodes = [h('p', { class: 'tex-err' }, String(e.message || e))]; }
  if (id !== ED.renderId) return;
  ED.paper.replaceChildren(...nodes);
}
async function closeEditor() {
  if (!ED?.m) return;
  const m = ED.m;
  clearTimeout(ED.timer); clearTimeout(ED.saveT);
  m.comment = ED.cm.getValue();
  m.fmt = 'latex';
  // imágenes que ya no se usan en el comentario
  if (m.figs) for (const k of Object.keys(m.figs)) if (!m.comment.includes(`{${k}}`)) delete m.figs[k];
  await saveComment(m, true);
  ED.m = null;
  ED.root.hidden = true;
  document.body.classList.remove('editing');
  await renderSheet(m.page);
  const el = document.querySelector(`.note[data-id="${m.id}"]`);
  if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
}

function focusNote(id, focusInput = true) {
  const el = document.querySelector(`.note[data-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  if (focusInput) { const m = R.marks.find((x) => x.id === id); if (m) setTimeout(() => openEditor(m), 350); }
}
function focusMark(id) {
  const els = document.querySelectorAll(`.hl[data-id="${id}"]`);
  if (!els.length) return;
  els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  els.forEach((el) => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); });
}
async function deleteMark(m) {
  if ((m.comment || '').trim() && !confirm('¿Eliminar esta nota y su comentario?')) return;
  await db.del('marks', m.id);
  R.marks = R.marks.filter((x) => x.id !== m.id);
  drawMarks(m.page); renderSheet(m.page);
}

/* ---------- Correcciones ----------
   La marca «Corregir» pinta el fragmento en rojo y escribe la corrección al lado.
   La posición se elige entre varios huecos (a la derecha, encima, debajo, márgenes)
   buscando el que no tape texto de la página y quede más cerca del fragmento.
   Se guarda en coordenadas de la página (0–1) para que no cambie con el zoom. */
const CORR_FONT = 'Helvetica, Arial, sans-serif';
let corrCtx = null;
const corrWidthPt = (s, size) => { corrCtx ||= document.createElement('canvas').getContext('2d'); corrCtx.font = `${size}px ${CORR_FONT}`; return corrCtx.measureText(s).width; };
function wrapCorr(text, size, maxPt) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (line && corrWidthPt(t, size) > maxPt) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
const corrMarksOfPage = (num) => R.marks.filter((m) => m.page === num && m.tag === 'cor' && m.corr?.text);
// v2: siempre en el margen (así nunca tapa texto ni figuras del PDF)
const CORR_V = 2;
function placeCorrection(p, m, text) {
  const PW = p.w, PH = p.h;
  const rects = m.rects, F = rects[0], L = rects[rects.length - 1];
  const glyphs = (glyphsOf(p).g || []).filter((q) => !q.space && q.x1 > q.x0);
  // borde del bloque de texto (percentiles: ignora números de línea o de página sueltos)
  const pct = (arr, k) => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * k)))]; };
  const textL = Math.min(pct(glyphs.map((q) => q.x0), 0.02) ?? 0.12, ...rects.map((r) => r[0]));
  const textR = Math.max(pct(glyphs.map((q) => q.x1), 0.98) ?? 0.88, ...rects.map((r) => r[0] + r[2]));
  const gap = 0.008, edge = 0.008;
  const sides = [
    { side: 'r', x0: textR + gap, w: 1 - edge - (textR + gap), from: [textR + 0.002, L[1] + L[3] / 2] },
    { side: 'l', x0: edge, w: textL - gap - edge, from: [textL - 0.002, F[1] + F[3] / 2] },
  ];
  // margen más cercano al fragmento (si tiene sitio); si no, el más ancho
  const fragMid = ((F[0] + L[0] + L[2]) / 2);
  sides.forEach((sd) => { sd.pref = (sd.side === 'r' ? textR - fragMid : fragMid - textL) + (sd.w * PW < 40 ? 1 : 0); });
  sides.sort((a, b) => a.pref - b.pref);
  const obstacles = glyphs.map((q) => [q.x0, q.y0, q.x1, q.y1]);
  for (const o of corrMarksOfPage(p.num)) if (o.id !== m.id && o.corr?.v === CORR_V) obstacles.push([o.corr.x, o.corr.y, o.corr.x + o.corr.w, o.corr.y + o.corr.h]);
  const overlap = (b) => {
    let a = 0;
    const x0 = b.x - 0.0015, y0 = b.y - 0.001, x1 = b.x + b.w + 0.0015, y1 = b.y + b.h + 0.001;
    for (const o of obstacles) { const ix = Math.min(x1, o[2]) - Math.max(x0, o[0]), iy = Math.min(y1, o[3]) - Math.max(y0, o[1]); if (ix > 0 && iy > 0) a += ix * iy; }
    return a;
  };
  let best = null, bestScore = Infinity;
  sides.forEach((sd, si) => {
    const wPt = Math.max(18, sd.w * PW);
    // letra según el sitio: normal 0,8 × renglón (7–10 pt); más pequeña si el margen es estrecho
    let fsPt = Math.min(10, Math.max(7, L[3] * PH * 0.8));
    if (wPt < 60) fsPt = Math.max(5.5, fsPt * Math.max(0.6, wPt / 60));
    const lineV = (fsPt * 1.25) / PH, padU = 3 / PW, padV = 1.5 / PH;
    const lines = wrapCorr(text, fsPt, Math.max(12, wPt - 6));
    const w = Math.min(sd.w, Math.max(1, ...lines.map((l) => corrWidthPt(l, fsPt))) / PW + padU * 2);
    const h = lines.length * lineV + padV * 2;
    const x = sd.side === 'r' ? sd.x0 : textL - gap - w; // pegada al texto
    const yc = sd.from[1];
    for (let k = 0; k <= 80; k++) {
      const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * lineV * 0.5;
      const y = Math.min(0.992 - h, Math.max(0.008, yc - h / 2 + off));
      const b = { x: Math.max(0.002, x), y, w, h, fs: fsPt / PH, lines };
      const ov = overlap(b);
      const score = (ov > 0 ? 10 + ov * 2e4 : 0) + Math.abs(y + h / 2 - yc) * 3 + si * 0.15;
      if (score < bestScore) { bestScore = score; best = { ...b, from: sd.from, side: sd.side }; }
      if (ov === 0 && k > 2 && Math.abs(off) > h) break;
    }
  });
  const near = [best.side === 'r' ? best.x : best.x + best.w, Math.min(Math.max(best.from[1], best.y), best.y + best.h)];
  return { v: CORR_V, text, x: best.x, y: best.y, w: best.w, h: best.h, fs: best.fs, lines: best.lines, leader: [best.from[0], best.from[1], near[0], near[1]] };
}
// Correcciones guardadas con la versión anterior (dentro del texto): pasarlas al margen
async function upgradeCorrections(p) {
  const old = corrMarksOfPage(p.num).filter((m) => m.corr.v !== CORR_V);
  if (!old.length || !p.glyphs) return;
  for (const m of old) { m.corr = placeCorrection(p, m, m.corr.text); await db.put('marks', m); }
  drawMarks(p.num);
}
function drawCorrections(p) {
  if (!p.corrLayer) return;
  p.corrLayer.replaceChildren();
  const H = parseFloat(p.el.style.height) || p.el.offsetHeight;
  const ms = corrMarksOfPage(p.num);
  if (!ms.length) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1 1'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'corr-lines');
  for (const m of ms) {
    const c = m.corr;
    if (c.leader) {
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', c.leader[0]); ln.setAttribute('y1', c.leader[1]); ln.setAttribute('x2', c.leader[2]); ln.setAttribute('y2', c.leader[3]);
      svg.append(ln);
    }
    const el = h('div', { class: 'corr', 'data-id': m.id, title: T('corrTip'), style: {
      left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, fontSize: `${c.fs * H}px`,
    } }, c.lines.join('\n'));
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { e.stopPropagation(); openCorrEditor(m); });
    // al pasar por encima se resalta su fragmento (útil si hay varias en el mismo renglón)
    const link = (on) => { p.markLayer.querySelectorAll(`.hl[data-id="${m.id}"]`).forEach((x) => x.classList.toggle('corr-hover', on)); el.classList.toggle('hover', on); };
    el.addEventListener('pointerenter', () => link(true));
    el.addEventListener('pointerleave', () => link(false));
    p.corrLayer.append(el);
  }
  p.corrLayer.prepend(svg);
}
// Cuadro para escribir la corrección, junto al fragmento
let corrEd = null;
function closeCorrEditor(save = true) {
  if (!corrEd) return;
  const { el, m, ta } = corrEd;
  corrEd = null;
  el.remove();
  if (save) saveCorrection(m, ta.value);
}
async function saveCorrection(m, text) {
  text = (text || '').replace(/\s+$/g, '').replace(/^\s+/g, '');
  const p = R.pages[m.page - 1];
  if (!p || !R.marks.includes(m)) return;
  m.corr = text ? placeCorrection(p, m, text) : null;
  await db.put('marks', m);
  drawMarks(m.page);
}
function openCorrEditor(m) {
  closeCorrEditor(true);
  hidePopup(); clearSelection();
  const p = R.pages[m.page - 1];
  if (!p) return;
  const ta = h('textarea', { class: 'corr-input', rows: '2', placeholder: T('corrPh'), spellcheck: 'true' });
  ta.value = m.corr?.text || '';
  const save = h('button', { type: 'button', class: 'btn primary small' }, T('save'));
  const del = h('button', { type: 'button', class: 'icon-btn small', title: T('removeMark'), 'aria-label': T('removeMark') }, svgIcon(ICON.trash));
  const el = h('div', { class: 'corr-editor', role: 'dialog' }, ta, h('div', { class: 'corr-ed-bar' }, h('small', {}, T('corrHint')), h('span', { class: 'spacer' }), del, save));
  document.body.append(el);
  // posición: justo debajo (o encima) del final del fragmento
  const r = p.el.getBoundingClientRect();
  const L = m.rects[m.rects.length - 1];
  const ax = r.left + (L[0] + L[2]) * r.width, ay = r.top + (L[1] + L[3]) * r.height;
  const ew = el.offsetWidth, eh = el.offsetHeight;
  let left = Math.max(8, Math.min(window.innerWidth - ew - 8, ax - ew / 2));
  let top = ay + 8;
  if (top + eh > window.innerHeight - 8) top = Math.max(8, r.top + L[1] * r.height - eh - 8);
  el.style.left = `${left}px`; el.style.top = `${top}px`;
  corrEd = { el, m, ta };
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeCorrEditor(true); }
    else if (e.key === 'Escape') { e.preventDefault(); closeCorrEditor(false); }
  });
  save.addEventListener('click', () => closeCorrEditor(true));
  del.addEventListener('click', async () => {
    closeCorrEditor(false);
    await db.del('marks', m.id);
    R.marks = R.marks.filter((x) => x.id !== m.id);
    drawMarks(m.page);
    toast('Marca quitada');
  });
  setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
}
document.addEventListener('pointerdown', (e) => { if (corrEd && !e.target.closest('.corr-editor')) closeCorrEditor(true); }, true);

async function createMark({ page, kind, rects, text, image, imagePpu, tag, math, note }) {
  const m = { id: uid(), docId: R.doc.id, page, kind, rects, text: (text || '').trim(), image: image || null, imagePpu: imagePpu || null, cropV: image && kind === 'text' ? CROP_V : undefined, math: !!math, tag, note: !!note, comment: '', createdAt: Date.now() };
  R.marks.push(m);
  await db.put('marks', m);
  drawMarks(page);
  if (m.note) { await renderSheet(page); focusNote(m.id, true); }
  return m;
}
// Imagen del fragmento (para la página de notas) cuando tiene matemáticas
// El extracto de los comentarios se guarda como imagen de lo seleccionado: el texto que
// extrae el PDF a veces sale mal (símbolos como μ, fórmulas, fuentes especiales).
const CROP_V = 2; // versión del recorte (las imágenes de versiones anteriores se rehacen)
async function captureMathImage(d) {
  if (d.kind === 'text' && (!d.image || d.cropV !== CROP_V)) {
    try { const c = await cropLines(R.pages[d.page - 1], d.rects); d.image = c.url; d.imagePpu = c.ppu; d.cropV = CROP_V; imgSizes.delete(d.id); } catch (e) { console.warn(e); }
  }
}
// Convertir una marca de color en marca con comentario
async function addCommentTo(m) {
  await captureMathImage(m);
  m.note = true;
  await db.put('marks', m);
  drawMarks(m.page);
  await renderSheet(m.page);
  focusNote(m.id, true);
}

/* ---------- Popup al marcar ----------
   Colores (Importante, Definición, Observación, Ejemplo): solo marcan el texto.
   «Añadir comentario»: marca y abre la página de notas para escribir.
   Al pulsar una marca de color ya hecha, el mismo popup permite cambiar el
   color, añadirle un comentario o quitarla. */
let pending = null; // selección nueva {page, kind, rects, text, …} o {edit: marca}
function showPopup(x, y, data) {
  pending = data;
  const pop = $('#tagPopup');
  const editing = !!data.edit;
  $('#tagRemove').hidden = !editing;
  pop.querySelectorAll('.tag-btn[data-tag]').forEach((b) => b.classList.toggle('current', editing && b.dataset.tag === data.edit.tag));
  pop.hidden = false;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = Math.max(8, Math.min(vw - pw - 8, x - pw / 2));
  let top = y + 14;
  if (top + ph > vh - 8) top = Math.max(70, y - ph - 50);
  pop.style.left = `${left}px`; pop.style.top = `${top}px`;
}
function hidePopup() { $('#tagPopup').hidden = true; pending = null; }
// Textos del popup de marcado en el idioma del documento
function labelTagRow() {
  document.querySelectorAll('#tagRow .tag-btn[data-tag]').forEach((b) => {
    const n = tagName(tagById(b.dataset.tag));
    b.querySelector('.tag-name').textContent = n; b.title = b.dataset.tag === 'cor' ? T('corrBtnTip') : T('markAs')(n);
  });
  const com = document.querySelector('#tagRow .tag-comment');
  if (com) { com.querySelector('.tag-name').textContent = T('addComment'); com.title = T('addCommentTip'); }
}
function buildTagRow() {
  const row = $('#tagRow');
  const take = () => { const d = pending; hidePopup(); clearSelection(); $('.draft-rect')?.remove(); return d; };
  const tagBtns = MARK_TAGS.map((id) => {
    const t = tagById(id);
    // «Corregir» se ve como «Añadir comentario» (los dos añaden texto propio)
    const b = id === 'cor'
      ? h('button', { class: 'tag-btn tag-write tag-correct', 'data-tag': id }, svgIcon(ICON.correct), h('span', { class: 'tag-name' }))
      : h('button', { class: 'tag-btn', 'data-tag': id }, h('i'), h('span', { class: 'tag-name' }));
    b.style.setProperty('--c', t.color);
    // pointerdown + preventDefault para no perder la selección
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('click', async () => {
      if (!pending) return;
      const d = take();
      if (d.edit) { // cambiar el color de una marca existente
        const m = d.edit;
        if (m.tag !== id) { m.tag = id; await db.put('marks', m); drawMarks(m.page); if (hasNote(m)) renderSheet(m.page); }
        if (id === 'cor') openCorrEditor(m);
        return;
      }
      const m = await createMark({ ...d, tag: id, note: false });
      if (id === 'cor') openCorrEditor(m);
    });
    return b;
  });
  const com = h('button', { class: 'tag-btn tag-write tag-comment' }, svgIcon(ICON.edit), h('span', { class: 'tag-name' }));
  com.addEventListener('pointerdown', (e) => e.preventDefault());
  com.addEventListener('click', async () => {
    if (!pending) return;
    const d = take();
    if (d.edit) { await addCommentTo(d.edit); return; }
    await captureMathImage(d);
    await createMark({ ...d, tag: 'com', note: true });
  });
  const colorBtns = tagBtns.filter((b) => b.dataset.tag !== 'cor'), corBtn = tagBtns.find((b) => b.dataset.tag === 'cor');
  row.replaceChildren(...colorBtns, h('span', { class: 'tag-sep' }), corBtn, com);
  labelTagRow();
  $('#tagRemove').addEventListener('pointerdown', (e) => e.preventDefault());
  $('#tagRemove').addEventListener('click', async () => {
    const d = pending; hidePopup();
    if (!d?.edit) return;
    const m = d.edit;
    await db.del('marks', m.id);
    R.marks = R.marks.filter((x) => x.id !== m.id);
    drawMarks(m.page);
    toast('Marca quitada');
  });
}

/* ---------- Selección de texto letra a letra ----------
   No se usa la selección del navegador (con PDFs da saltos y letras a medias).
   Se usan las cajas exactas de cada carácter (extractGlyphs): el cursor se
   coloca entre dos letras según dónde esté el puntero. Después se pueden
   ajustar los extremos con los tiradores o con Mayúsculas + flechas. */
const coarsePointer = matchMedia('(pointer: coarse)').matches;
let S = null; // selección: { p, a, b, active } — a y b son posiciones entre caracteres (0..n)

const glyphsOf = (p) => p.glyphs || emptyGlyphs();
// Posición entre caracteres más cercana a un punto (coordenadas 0–1 de la página)
function caretAt(p, u, v) {
  const { g } = glyphsOf(p);
  let best = -1, bd = Infinity;
  for (let i = 0; i < g.length; i++) {
    const q = g[i];
    const dx = u < q.x0 ? q.x0 - u : u > q.x1 ? u - q.x1 : 0;
    const dy = v < q.y0 ? q.y0 - v : v > q.y1 ? v - q.y1 : 0;
    const d = dy * p.h * 3 + dx * p.w + Math.abs(u - (q.x0 + q.x1) / 2) * p.w * 0.001;
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) return -1;
  const q = g[best];
  return u > (q.x0 + q.x1) / 2 ? best + 1 : best;
}
// Rango [lo, hi) sin espacios en los bordes
function selBounds(trim = true) {
  if (!S) return null;
  const { g } = glyphsOf(S.p);
  let lo = Math.min(S.a, S.b), hi = Math.max(S.a, S.b);
  if (trim) { while (lo < hi && g[lo].space) lo++; while (hi > lo && g[hi - 1].space) hi--; }
  return [lo, hi];
}
// Rectángulos (0–1) de cada renglón de un rango de caracteres
function runsOf(p, lo, hi) {
  const { g, nl } = glyphsOf(p);
  const runs = [];
  let r = null;
  for (let i = lo; i < hi; i++) {
    const q = g[i];
    if (!r || nl[i]) { r = { x0: q.x0, y0: q.y0, x1: q.x1, y1: q.y1 }; runs.push(r); continue; }
    r.x0 = Math.min(r.x0, q.x0); r.x1 = Math.max(r.x1, q.x1); r.y0 = Math.min(r.y0, q.y0); r.y1 = Math.max(r.y1, q.y1);
  }
  return runs;
}
function textOf(p, idxs) {
  const { g, nl, sp } = glyphsOf(p);
  let out = '';
  idxs.forEach((i, k) => {
    if (k) {
      const prev = idxs[k - 1];
      if (i !== prev + 1) out += ' ';
      else if (nl[i]) out += '\n';
      else if (sp[i]) out += ' ';
    }
    out += g[i].c;
  });
  return out.replace(/(\p{L})-\n(\p{L})/gu, '$1$2').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}
const rangeIdx = (lo, hi) => Array.from({ length: Math.max(0, hi - lo) }, (_, k) => lo + k);
function selText() { const [lo, hi] = selBounds(); return textOf(S.p, rangeIdx(lo, hi)); }

function drawSelection() {
  document.querySelectorAll('.sel-layer, .handle-layer').forEach((l) => l.replaceChildren());
  if (!S) return;
  const [lo, hi] = selBounds(false);
  const runs = runsOf(S.p, lo, hi);
  for (const r of runs) {
    S.p.selLayer.append(h('div', { class: 'sel', style: {
      left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`, width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%` } }));
  }
  if (!S.active && runs.length) {
    const f = runs[0], l = runs[runs.length - 1];
    S.p.handleLayer.append(
      makeHandle('start', f.x0, f.y0, f.y1),
      makeHandle('end', l.x1, l.y0, l.y1),
    );
  }
}
function clearSelection() { S = null; drawSelection(); hideLoupe(); }
function finishSelection() {
  if (!S) return;
  S.active = false;
  const [lo, hi] = selBounds();
  if (hi <= lo) { clearSelection(); return; }
  const p = S.p;
  const runs = runsOf(p, lo, hi);
  const rects = runs.map((r) => [r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0].map((v) => +v.toFixed(5)));
  const text = selText();
  if (!text) { clearSelection(); return; }
  const { g } = glyphsOf(p);
  const math = g.slice(lo, hi).some((q) => q.math) || MATH_CHAR_RE.test(text);
  drawSelection();
  const pr = p.el.getBoundingClientRect();
  const last = runs[runs.length - 1];
  showPopup(pr.left + ((last.x0 + last.x1) / 2) * pr.width, pr.top + last.y1 * pr.height + 18,
    { page: p.num, kind: 'text', rects, text, math });
}
// Seleccionar la palabra que contiene la posición
function selectWordAt(p, u, v) {
  const c = caretAt(p, u, v);
  if (c < 0) return;
  const { g, nl, sp } = glyphsOf(p);
  let i = Math.min(c, g.length - 1);
  if (g[i].space && i > 0) i--;
  let lo = i, hi = i + 1;
  const isWordChar = (k) => !g[k].space && /[\p{L}\p{N}_'’-]/u.test(g[k].c);
  if (isWordChar(i)) {
    while (lo > 0 && !nl[lo] && !sp[lo] && isWordChar(lo - 1)) lo--;
    while (hi < g.length && !nl[hi] && !sp[hi] && isWordChar(hi)) hi++;
  }
  S = { p, a: lo, b: hi, active: false };
  finishSelection();
}
function moveFocus(delta) {
  if (!S || S.active) return;
  const n = glyphsOf(S.p).g.length;
  S.b = Math.max(0, Math.min(n, S.b + delta));
  hidePopup();
  finishSelection();
}

/* Tiradores para ajustar el principio y el final */
function makeHandle(which, x, y0, y1) {
  const el = h('div', { class: `sel-handle ${which}`, style: { left: `${x * 100}%`, top: `${y0 * 100}%`, height: `${(y1 - y0) * 100}%` } });
  el.addEventListener('pointerdown', (e) => {
    if (!S) return;
    e.preventDefault(); e.stopPropagation();
    const p = S.p;
    const [lo, hi] = selBounds(false);
    S.a = which === 'start' ? hi : lo;
    S.b = which === 'start' ? lo : hi;
    S.active = true; S.handle = true;
    hidePopup();
    // distancia entre el dedo y el centro del renglón, para que el dedo no tape la letra
    const pr = p.el.getBoundingClientRect();
    const lineMid = pr.top + ((y0 + y1) / 2) * pr.height;
    const offY = e.clientY - lineMid;
    const touch = e.pointerType !== 'mouse';
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = p.el.getBoundingClientRect();
      const cy = ev.clientY - offY;
      const c = caretAt(p, (ev.clientX - r.left) / r.width, (cy - r.top) / r.height);
      if (c >= 0 && c !== S.b) { S.b = c; drawSelectionKeepHandles(el); }
      if (touch) showLoupe(p, ev.clientX, cy);
    };
    const up = () => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      hideLoupe(); S.handle = false; finishSelection();
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  return el;
}
// Durante el arrastre de un tirador se redibuja la selección sin destruir el tirador que se arrastra
function drawSelectionKeepHandles(keep) {
  S.p.selLayer.replaceChildren();
  const [lo, hi] = selBounds(false);
  for (const r of runsOf(S.p, lo, hi)) {
    S.p.selLayer.append(h('div', { class: 'sel', style: {
      left: `${r.x0 * 100}%`, top: `${r.y0 * 100}%`, width: `${(r.x1 - r.x0) * 100}%`, height: `${(r.y1 - r.y0) * 100}%` } }));
  }
  [...S.p.handleLayer.children].forEach((c) => { if (c !== keep) c.remove(); });
  const runs = runsOf(S.p, lo, hi);
  if (runs.length) {
    const r = S.b >= S.a ? runs[runs.length - 1] : runs[0];
    const x = S.b >= S.a ? r.x1 : r.x0;
    Object.assign(keep.style, { left: `${x * 100}%`, top: `${r.y0 * 100}%`, height: `${(r.y1 - r.y0) * 100}%` });
  }
}

/* Lupa (móvil): amplía la zona bajo el dedo mientras se selecciona */
let loupeEl = null;
function showLoupe(p, clientX, clientY) {
  if (!p.rendered || !p.canvas.width) return;
  const W = 168, H = 72, Z = 1.9, dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (!loupeEl) {
    loupeEl = h('canvas', { class: 'loupe' });
    loupeEl.width = W * dpr; loupeEl.height = H * dpr;
    document.body.append(loupeEl);
  }
  loupeEl.hidden = false;
  const r = p.el.getBoundingClientRect();
  const k = p.canvas.width / r.width;
  const cx = clientX - r.left, cy = clientY - r.top;
  const sw = W / Z, sh = H / Z;
  const ctx = loupeEl.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, loupeEl.width, loupeEl.height);
  ctx.drawImage(p.canvas, (cx - sw / 2) * k, (cy - sh / 2) * k, sw * k, sh * k, 0, 0, loupeEl.width, loupeEl.height);
  if (S) {
    const [lo, hi] = selBounds(false);
    ctx.fillStyle = 'rgba(0,100,255,.25)';
    const sx = loupeEl.width / sw;
    for (const q of runsOf(p, lo, hi)) {
      ctx.fillRect((q.x0 * r.width - (cx - sw / 2)) * sx, (q.y0 * r.height - (cy - sh / 2)) * sx, (q.x1 - q.x0) * r.width * sx, (q.y1 - q.y0) * r.height * sx);
    }
  }
  loupeEl.style.left = `${Math.max(4, Math.min(window.innerWidth - W - 4, clientX - W / 2))}px`;
  loupeEl.style.top = `${Math.max(4, clientY - H - 56)}px`;
}
function hideLoupe() { if (loupeEl) loupeEl.hidden = true; }

let noTextWarned = false;
function attachTextSelection(p) {
  const el = p.el;
  let pressTimer = null, start = null, autoScroll = null, lastPt = null, isTouch = false;
  const uv = (cx, cy) => { const r = el.getBoundingClientRect(); return [(cx - r.left) / r.width, (cy - r.top) / r.height]; };
  const begin = (e) => {
    if (!glyphsOf(p).g.length) {
      if (p.glyphs && !noTextWarned) { noTextWarned = true; toast('Esta página no tiene texto seleccionable: usa el modo Recuadro'); }
      return false;
    }
    const c = caretAt(p, ...uv(e.clientX, e.clientY));
    if (c < 0) return false;
    hidePopup();
    if (e.shiftKey && S && S.p === p) S.active = true;
    else S = { p, a: c, b: c, active: true };
    S.b = c;
    drawSelection();
    return true;
  };
  const update = (cx, cy) => {
    const c = caretAt(p, ...uv(cx, cy));
    if (c >= 0 && c !== S.b) { S.b = c; drawSelection(); }
    if (isTouch) showLoupe(p, cx, cy);
  };
  const move = (e) => {
    if (!S?.active || S.p !== p || S.handle) return;
    lastPt = [e.clientX, e.clientY];
    update(e.clientX, e.clientY);
    const edge = e.clientY < 90 ? -1 : e.clientY > window.innerHeight - 50 ? 1 : 0;
    if (edge && !autoScroll) {
      autoScroll = setInterval(() => {
        if (!S?.active) return;
        const dir = lastPt[1] < 90 ? -1 : lastPt[1] > window.innerHeight - 50 ? 1 : 0;
        if (dir) { window.scrollBy(0, dir * 16); update(lastPt[0], lastPt[1]); }
      }, 30);
    } else if (!edge && autoScroll) { clearInterval(autoScroll); autoScroll = null; }
  };
  const end = () => {
    clearInterval(autoScroll); autoScroll = null; hideLoupe();
    if (!S?.active || S.p !== p) return;
    finishSelection();
  };

  el.addEventListener('pointerdown', (e) => {
    if (R.mode !== 'text' || e.button !== 0 || e.target.closest('.badge, .sel-handle')) return;
    isTouch = e.pointerType !== 'mouse';
    start = [e.clientX, e.clientY];
    if (!isTouch) {
      e.preventDefault();
      if (begin(e)) el.setPointerCapture(e.pointerId);
    } else {
      // táctil: mantener pulsado para empezar; si el dedo se mueve antes, es desplazamiento
      clearTimeout(pressTimer);
      const ev = { clientX: e.clientX, clientY: e.clientY, shiftKey: false };
      pressTimer = setTimeout(() => {
        pressTimer = null;
        if (begin(ev)) { navigator.vibrate?.(12); try { el.setPointerCapture(e.pointerId); } catch {} showLoupe(p, ev.clientX, ev.clientY); }
      }, 380);
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (pressTimer && start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10) { clearTimeout(pressTimer); pressTimer = null; }
    move(e);
  });
  el.addEventListener('pointerup', (e) => {
    clearTimeout(pressTimer); pressTimer = null;
    if (!S?.active || S.p !== p || S.handle) return;
    // un clic sin arrastrar borra la selección
    if (!isTouch && !e.shiftKey && start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 3 && S.a === S.b) {
      clearSelection(); return;
    }
    end();
  });
  el.addEventListener('pointercancel', () => { clearTimeout(pressTimer); pressTimer = null; if (S?.active && S.p === p && !S.handle) end(); });
  // clic (o toque) sobre un fragmento marcado: ir a su comentario
  el.addEventListener('click', (e) => {
    if (R.mode !== 'text' || e.target.closest('.badge, .sel-handle')) return;
    if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 4) return;
    if (e.detail > 1 || (S && S.a !== S.b)) return;
    const [u, v] = uv(e.clientX, e.clientY);
    const hit = marksOfPage(p.num).find((m) => m.rects.some(([x, y, w, hh]) => u >= x && u <= x + w && v >= y && v <= y + hh));
    if (!hit) return;
    if (hasNote(hit)) focusNote(hit.id, false);
    else if (hit.tag === 'cor') openCorrEditor(hit);
    else showPopup(e.clientX, e.clientY, { edit: hit });
  });
  el.addEventListener('dblclick', (e) => {
    if (R.mode !== 'text' || e.target.closest('.badge, .sel-handle')) return;
    selectWordAt(p, ...uv(e.clientX, e.clientY));
  });
  // impedir el desplazamiento mientras se selecciona con el dedo
  el.addEventListener('touchmove', (e) => { if (S?.active && S.p === p) e.preventDefault(); }, { passive: false });
  el.addEventListener('contextmenu', (e) => { if (R.mode === 'text' && coarsePointer) e.preventDefault(); });
}

// Une rectángulos de la misma línea
function mergeLineRects(rs) {
  rs.sort((a, b) => a.t - b.t || a.l - b.l);
  const out = [];
  for (const r of rs) {
    const prev = out[out.length - 1];
    const sameLine = prev && Math.abs((prev.t + prev.b) / 2 - (r.t + r.b) / 2) < Math.min(prev.b - prev.t, r.b - r.t) * 0.6;
    if (sameLine && r.l <= prev.r + Math.max(12, (r.b - r.t) * 0.9)) {
      prev.l = Math.min(prev.l, r.l); prev.r = Math.max(prev.r, r.r);
      prev.t = Math.min(prev.t, r.t); prev.b = Math.max(prev.b, r.b);
    } else out.push({ ...r });
  }
  return out;
}

/* ---------- Marcado por recuadro ---------- */
function attachAreaHandlers(p) {
  let start = null, draft = null;
  const layer = p.areaLayer;
  layer.addEventListener('pointerdown', (e) => {
    if (R.mode !== 'area') return;
    e.preventDefault();
    hidePopup();
    $('.draft-rect')?.remove();
    const r = layer.getBoundingClientRect();
    start = { x: e.clientX - r.left, y: e.clientY - r.top, r };
    draft = h('div', { class: 'draft-rect' });
    layer.append(draft);
    layer.setPointerCapture(e.pointerId);
  });
  layer.addEventListener('pointermove', (e) => {
    if (!start) return;
    const x = Math.max(0, Math.min(start.r.width, e.clientX - start.r.left));
    const y = Math.max(0, Math.min(start.r.height, e.clientY - start.r.top));
    Object.assign(draft.style, {
      left: `${Math.min(x, start.x)}px`, top: `${Math.min(y, start.y)}px`,
      width: `${Math.abs(x - start.x)}px`, height: `${Math.abs(y - start.y)}px`,
    });
  });
  const end = async (e) => {
    if (!start) return;
    const s = start; start = null;
    const W = s.r.width, H = s.r.height;
    const x = Math.max(0, Math.min(W, e.clientX - s.r.left));
    const y = Math.max(0, Math.min(H, e.clientY - s.r.top));
    const l = Math.min(x, s.x), t = Math.min(y, s.y), w = Math.abs(x - s.x), hh = Math.abs(y - s.y);
    if (w < 10 || hh < 10) { draft.remove(); return; }
    const rect = [l / W, t / H, w / W, hh / H].map((v) => +v.toFixed(5));
    const image = await cropArea(p, rect);
    const text = textInArea(p, rect);
    const lr = layer.getBoundingClientRect();
    showPopup(lr.left + l + w / 2, lr.top + t + hh, { page: p.num, kind: 'area', rects: [rect], text, image });
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', () => { start = null; draft?.remove(); });
}

// Renderiza una zona de la página (coordenadas 0–1) a buena resolución, independiente del zoom
async function cropCanvas(p, [x, y, w, hh], maxSide = 1400) {
  const scale = Math.max(2.5, R.scale * 1.5);
  const vp = p.page.getViewport({ scale });
  const c = document.createElement('canvas');
  const cw = Math.max(1, Math.round(w * vp.width)), ch = Math.max(1, Math.round(hh * vp.height));
  const k = Math.min(1, maxSide / Math.max(cw, ch));
  c.width = Math.max(1, Math.round(cw * k)); c.height = Math.max(1, Math.round(ch * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await p.page.render({ canvasContext: ctx, viewport: vp, transform: [k, 0, 0, k, -x * vp.width * k, -y * vp.height * k] }).promise;
  c.ppu = scale * k; // píxeles por unidad PDF
  return c;
}
async function cropArea(p, rect) {
  return (await cropCanvas(p, rect)).toDataURL('image/jpeg', 0.88);
}
// Quita del recorte los trozos de los renglones vecinos: desde la franja del renglón
// se amplía hacia arriba/abajo mientras haya tinta "pegada" (exponentes, subíndices, acentos)
function trimToLine(c, coreTopF, coreBotF) {
  const ctx = c.getContext('2d');
  const { width: w, height: hgt } = c;
  const d = ctx.getImageData(0, 0, w, hgt).data;
  const rowInk = new Uint8Array(hgt);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0, o = y * w * 4; x < w; x++, o += 4) {
      if (d[o] + d[o + 1] + d[o + 2] < 600) { rowInk[y] = 1; break; }
    }
  }
  const coreTop = Math.max(0, Math.floor(coreTopF * hgt)), coreBot = Math.min(hgt - 1, Math.ceil(coreBotF * hgt));
  const maxGap = Math.max(2, Math.round((coreBot - coreTop) * 0.12));
  // hacia arriba solo mientras la tinta sea continua (el renglón de arriba suele estar separado)
  let top = coreTop, gap = 0;
  for (let y = coreTop - 1; y >= 0 && rowInk[y]; y--) top = y;
  let bot = coreBot; gap = 0;
  for (let y = coreBot + 1; y < hgt; y++) { if (rowInk[y]) { bot = y; gap = 0; } else if (++gap > maxGap) break; }
  top = Math.max(0, top - 2); bot = Math.min(hgt - 1, bot + 3);
  const out = document.createElement('canvas');
  out.width = w; out.height = bot - top + 1;
  out.getContext('2d').drawImage(c, 0, top, w, out.height, 0, 0, w, out.height);
  out.ppu = c.ppu;
  return out;
}
// Recorte de cada renglón seleccionado, apilados (para fragmentos con matemáticas)
// Recorte exacto de la zona resaltada al seleccionar (un trozo por renglón, apilados)
async function cropLines(p, rects) {
  const parts = [];
  for (const [x, y, w, hh] of rects) {
    const r = [Math.max(0, x), Math.max(0, y), 0, 0];
    r[2] = Math.min(1, x + w) - r[0]; r[3] = Math.min(1, y + hh) - r[1];
    parts.push(await cropCanvas(p, r, 2400));
  }
  const gap = Math.round(parts[0].height * 0.25);
  const W = Math.max(...parts.map((c) => c.width));
  const H = parts.reduce((a, c) => a + c.height, 0) + gap * (parts.length - 1);
  const out = document.createElement('canvas');
  const k = Math.min(1, 1600 / W, 2400 / H);
  out.width = Math.round(W * k); out.height = Math.round(H * k);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
  let yy = 0;
  for (const c of parts) { ctx.drawImage(c, 0, yy * k, c.width * k, c.height * k); yy += c.height + gap; }
  return { url: out.toDataURL('image/png'), ppu: parts[0].ppu * k };
}
function textInArea(p, [x, y, w, hh]) {
  const { g } = glyphsOf(p);
  const idx = [];
  g.forEach((q, i) => {
    const cx = (q.x0 + q.x1) / 2, cy = (q.y0 + q.y1) / 2;
    if (cx >= x && cx <= x + w && cy >= y && cy <= y + hh) idx.push(i);
  });
  return textOf(p, idx);
}
function setMode(mode) {
  R.mode = mode;
  $('#modeText').classList.toggle('active', mode === 'text');
  $('#modeArea').classList.toggle('active', mode === 'area');
  $('#reader').classList.toggle('reader-area', mode === 'area');
  hidePopup();
  clearSelection();
  $('.draft-rect')?.remove();
  if (mode === 'area') toast('Arrastra sobre la página para marcar una zona');
}

/* =========================================================
   EXPORTAR PDF AMPLIADO (con páginas de notas)
   ========================================================= */
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = './vendor/pdf-lib.min.js';
    s.onload = () => res(window.PDFLib);
    s.onerror = rej;
    document.head.append(s);
  });
}

async function exportAnnotated() {
  if (!R.doc) return;
  const target = await chooseSaveTarget(`${R.doc.name} (con notas).pdf`, 'pdf');
  if (!target) return;
  busy(true, 'Generando PDF con notas…');
  try {
    const { PDFDocument, StandardFonts, rgb, BlendMode, degrees } = await loadPdfLib();
    const src = await PDFDocument.load(R.bytes.slice(0), { ignoreEncryption: true });
    const out = await PDFDocument.create();
    out.setTitle(`${R.doc.name} (con notas)`);
    out.setCreator('Study App');
    const font = await out.embedFont(StandardFonts.Helvetica);
    const bold = await out.embedFont(StandardFonts.HelveticaBold);
    const ital = await out.embedFont(StandardFonts.HelveticaOblique);
    const copied = await out.copyPages(src, src.getPageIndices());
    const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

    // Codificación WinAnsi: sustituye caracteres no soportados
    const okCache = new Map();
    const clean = (str) => {
      str = (str || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/–|—/g, '-')
        .replace(/…/g, '...').replace(/ /g, ' ').replace(/\t/g, '    ').replace(/\r/g, '')
        .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
        .replace(/[→⟶]/g, '->').replace(/←/g, '<-').replace(/⇒/g, '=>')
        .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=');
      let o = '';
      for (const ch of str) {
        if (ch === '\n') { o += ch; continue; }
        let ok = okCache.get(ch);
        if (ok === undefined) { try { font.encodeText(ch); ok = true; } catch { ok = false; } okCache.set(ch, ok); }
        o += ok ? ch : '?';
      }
      return o;
    };
    const wrap = (text, f, size, maxW) => {
      const lines = [];
      for (const para of clean(text).split('\n')) {
        const words = para.split(/ +/);
        let line = '';
        for (const w0 of words) {
          let w = w0;
          // palabra más larga que la línea: partirla
          while (f.widthOfTextAtSize(w, size) > maxW) {
            let i = w.length; while (i > 1 && f.widthOfTextAtSize(w.slice(0, i), size) > maxW) i--;
            if (line) { lines.push(line); line = ''; }
            lines.push(w.slice(0, i)); w = w.slice(i);
          }
          const test = line ? `${line} ${w}` : w;
          if (f.widthOfTextAtSize(test, size) > maxW && line) { lines.push(line); line = w; } else line = test;
        }
        lines.push(line);
      }
      return lines;
    };

    // Comentarios con LaTeX: texto en Times y fórmulas como imágenes
    const TF = {
      r: await out.embedFont(StandardFonts.TimesRoman), b: await out.embedFont(StandardFonts.TimesRomanBold),
      i: await out.embedFont(StandardFonts.TimesRomanItalic), bi: await out.embedFont(StandardFonts.TimesRomanBoldItalic),
      tt: await out.embedFont(StandardFonts.Courier),
    };
    const fontFor = (it) => (it.tt ? TF.tt : it.b && it.i ? TF.bi : it.b ? TF.b : it.i ? TF.i : TF.r);
    const ink = rgb(0.11, 0.14, 0.19);
    const CSIZE = 11;
    const embedUrl = (u) => (u.startsWith('data:image/png') ? out.embedPng(u) : out.embedJpg(u));
    const embedRich = async (blocks) => {
      for (const b of blocks) {
        if (b.kind === 'figure') {
          for (const im of b.imgs) if (im.url) { try { im.pdfImg = await embedUrl(im.url); } catch (e) { console.warn(e); } }
          if (b.caption) for (const it of b.caption) if (it.t === 'img') it.pdfImg = await out.embedPng(it.png);
        }
        if (b.kind === 'math' && b.img) b.pdfImg = await out.embedPng(b.img.png);
        if (b.inl) for (const it of b.inl) if (it.t === 'img') it.pdfImg = await out.embedPng(it.png);
        if (b.items) for (const it of b.items) await embedRich(it.blocks);
        if (b.blocks) await embedRich(b.blocks);
      }
    };
    const richOf = async (m, width) => {
      const plain = () => (m.comment || '').split(/\n{2,}/).map((par) => ({ kind: 'p', inl: par.split('\n').flatMap((ln, k) => (k ? [{ t: 'br' }, { t: 'text', s: ln }] : [{ t: 'text', s: ln }])) }));
      if (m.fmt !== 'latex') return plain();
      try { const r = await latexForPdf(m.comment, CSIZE, width, m.figs || {}, T('figure')); await embedRich(r); return r; } catch (e) { console.warn(e); return plain(); }
    };

    for (let i = 0; i < copied.length; i++) {
      const num = i + 1;
      const page = out.addPage(copied[i]);
      const ms = marksOfPage(num);
      if (!ms.length) continue;
      // 1) Dibujar los subrayados sobre la página original
      const cb = page.getCropBox();
      const rot = ((page.getRotation().angle % 360) + 360) % 360;
      const map = (u, v) => {
        switch (rot) {
          case 90: return [cb.x + v * cb.width, cb.y + u * cb.height];
          case 180: return [cb.x + (1 - u) * cb.width, cb.y + v * cb.height];
          case 270: return [cb.x + (1 - v) * cb.width, cb.y + (1 - u) * cb.height];
          default: return [cb.x + u * cb.width, cb.y + (1 - v) * cb.height];
        }
      };
      let nIdx = 0;
      ms.forEach((m) => {
        const color = toRgb(tagById(m.tag).color);
        for (const [x, y, w, hh] of m.rects) {
          const [ax, ay] = map(x, y), [bx, by] = map(x + w, y + hh);
          const rx = Math.min(ax, bx), ry = Math.min(ay, by), rw = Math.abs(bx - ax), rh = Math.abs(by - ay);
          if (m.kind === 'area') page.drawRectangle({ x: rx, y: ry, width: rw, height: rh, borderColor: color, borderWidth: 1.5, color, opacity: 0.12, borderOpacity: 0.9 });
          else page.drawRectangle({ x: rx, y: ry, width: rw, height: rh, color, opacity: 0.38, blendMode: BlendMode.Multiply });
        }
        if (m.tag === 'cor' && m.corr?.text) { // corrección escrita al lado del fragmento
          const c = m.corr, ph = rot % 180 ? cb.width : cb.height, pw = rot % 180 ? cb.height : cb.width;
          const size = c.fs * ph, red = toRgb(tagById('cor').color);
          if (c.leader) { const [l0x, l0y] = map(c.leader[0], c.leader[1]), [l1x, l1y] = map(c.leader[2], c.leader[3]); page.drawLine({ start: { x: l0x, y: l0y }, end: { x: l1x, y: l1y }, thickness: 0.6, color: red, opacity: 0.8 }); }
          const [bx, by] = map(c.x, c.y), [ex, ey] = map(c.x + c.w, c.y + c.h);
          page.drawRectangle({ x: Math.min(bx, ex), y: Math.min(by, ey), width: Math.abs(ex - bx), height: Math.abs(ey - by), color: rgb(1, 1, 1), opacity: 0.85, borderColor: red, borderWidth: 0.5, borderOpacity: 0.6 });
          c.lines.forEach((ln, k) => {
            const [tx, ty] = map(c.x + 3 / pw, c.y + 1.5 / ph + (k * 1.25 + 0.97) * c.fs);
            page.drawText(clean(ln), { x: tx, y: ty, size, font, color: red, rotate: degrees(rot) });
          });
        }
        if (!hasNote(m)) return; // marca solo de color: sin número
        const [bx0, by0] = map(m.rects[0][0], m.rects[0][1]);
        page.drawCircle({ x: bx0, y: by0, size: 6.5, color });
        const label = String(++nIdx);
        page.drawText(label, { x: bx0 - bold.widthOfTextAtSize(label, 7.5) / 2, y: by0 - 2.7, size: 7.5, font: bold, color: rgb(1, 1, 1) });
      });

      // 2) Páginas de notas detrás (solo si hay marcas con comentario)
      const nms = ms.filter(hasNote);
      if (!nms.length) continue;
      const vw = rot % 180 ? cb.height : cb.width, vh = rot % 180 ? cb.width : cb.height;
      const M = Math.max(36, Math.min(56, vw * 0.08));
      const maxW = vw - M * 2 - 12;
      let np, y;
      const newNotesPage = (cont) => {
        np = out.addPage([vw, vh]);
        np.drawRectangle({ x: 0, y: 0, width: vw, height: vh, color: rgb(1, 0.996, 0.976) });
        y = vh - M;
        np.drawText(clean(`${T('notes')} · ${T('page')} ${num}${cont ? ` (${T('contShort')})` : ''}`), { x: M, y: y - 12, size: 13, font: bold, color: rgb(0.54, 0.5, 0.42) });
        np.drawText(clean(R.doc.name).slice(0, 90), { x: M, y: y - 26, size: 8, font, color: rgb(0.6, 0.6, 0.6) });
        y -= 46;
      };
      const ensure = (need) => { if (y - need < M) newNotesPage(true); };
      newNotesPage(false);

      // Texto con fórmulas en línea, partido en renglones
      const drawInline = (inl, x, width, size, align) => {
        const toks = [];
        for (const it of inl) {
          if (it.t === 'text' || it.t === 'err') {
            const f = it.t === 'err' ? TF.tt : fontFor(it);
            const txt = clean(it.sc ? it.s.toUpperCase() : it.s).replace(/\n/g, ' ');
            for (const part of txt.split(/( +)/)) {
              if (!part) continue;
              if (/^ +$/.test(part)) toks.push({ k: 'sp', w: f.widthOfTextAtSize(' ', size) });
              else toks.push({ k: 'w', s: part, f, w: f.widthOfTextAtSize(part, size), u: it.u, color: it.t === 'err' ? rgb(0.75, 0.22, 0.17) : ink });
            }
          } else if (it.t === 'br') toks.push({ k: 'br' });
          else if (it.t === 'img' && it.pdfImg) {
            let w = it.w, hh = it.h, d = it.depth;
            if (w > width) { const k = width / w; w *= k; hh *= k; d *= k; }
            toks.push({ k: 'img', w, h: hh, d, img: it.pdfImg });
          }
        }
        const lines = []; let line = [], lw = 0;
        const flushLine = () => { while (line.length && line[line.length - 1].k === 'sp') lw -= line.pop().w; lines.push({ toks: line, w: lw }); line = []; lw = 0; };
        for (const t of toks) {
          if (t.k === 'br') { flushLine(); continue; }
          if (t.k === 'sp' && !line.length) continue;
          if (t.k !== 'sp' && lw + t.w > width && line.length) flushLine();
          line.push(t); lw += t.w;
        }
        if (line.length) flushLine();
        const lead = size * 0.34;
        for (const L of lines) {
          let asc = size * 0.72, desc = size * 0.22;
          for (const t of L.toks) if (t.k === 'img') { asc = Math.max(asc, t.h - t.d); desc = Math.max(desc, t.d); }
          ensure(asc + desc + lead);
          const base = y - lead / 2 - asc;
          let cx = x + (align === 'center' ? Math.max(0, (width - L.w) / 2) : 0);
          for (const t of L.toks) {
            if (t.k === 'w') {
              np.drawText(t.s, { x: cx, y: base, size, font: t.f, color: t.color });
              if (t.u) np.drawLine({ start: { x: cx, y: base - 1.6 }, end: { x: cx + t.w, y: base - 1.6 }, thickness: 0.6, color: ink });
            } else if (t.k === 'img') np.drawImage(t.img, { x: cx, y: base - t.d, width: t.w, height: t.h });
            cx += t.w;
          }
          y = base - desc - lead / 2;
        }
      };
      const drawBlocks = (blocks, x, width, align) => {
        for (const b of blocks) {
          if (b.kind === 'p') { drawInline(b.inl, x, width, CSIZE, align); y -= 3; }
          else if (b.kind === 'h') {
            drawInline(b.inl.map((it) => (it.t === 'text' ? { ...it, b: 1 } : it)), x, width, b.level === 1 ? 13.5 : b.level === 2 ? 12.5 : 11.5, align);
            y -= 2;
          } else if (b.kind === 'math' && b.pdfImg) {
            let w = b.img.w, hh = b.img.h;
            if (w > width) { hh *= width / w; w = width; }
            ensure(hh + 8); y -= 4;
            np.drawImage(b.pdfImg, { x: x + (width - w) / 2, y: y - hh, width: w, height: hh });
            y -= hh + 4;
          } else if (b.kind === 'figure') {
            y -= 6;
            for (const im of b.imgs) {
              if (im.pdfImg) {
                let w = width * im.frac, hh = (w * im.h) / im.w;
                const maxH = vh - 2 * M - 70;
                if (hh > maxH) { w *= maxH / hh; hh = maxH; }
                ensure(hh + 6);
                np.drawImage(im.pdfImg, { x: x + (width - w) / 2, y: y - hh, width: w, height: hh });
                y -= hh + 6;
              } else drawInline([{ t: 'err', s: `Imagen no encontrada: ${im.missing || '?'}` }], x, width, 9.5, 'center');
            }
            if (b.caption) drawInline(b.caption, x, width, CSIZE - 1, 'center');
            y -= 6;
          } else if (b.kind === 'list') {
            b.items.forEach((it, k) => {
              const label = it.label ?? (b.ordered ? `${k + 1}.` : '•');
              ensure(CSIZE * 1.3);
              np.drawText(clean(label), { x: x + 2, y: y - CSIZE * 0.17 - CSIZE * 0.72, size: CSIZE, font: TF.r, color: ink });
              drawBlocks(it.blocks, x + 18, width - 18, align);
            });
            y -= 2;
          } else if (b.kind === 'group') {
            if (b.type === 'env' && b.blocks[0]?.kind === 'p') b.blocks[0].inl.unshift({ t: 'text', s: `${b.name[0].toUpperCase()}${b.name.slice(1).replace('*', '')}. `, b: 1 });
            if (b.type === 'center') drawBlocks(b.blocks, x, width, 'center');
            else if (b.type === 'quote') drawBlocks(b.blocks, x + 14, width - 28, align);
            else drawBlocks(b.blocks, x, width, align);
          }
        }
      };

      for (const [idx, m] of nms.entries()) {
        const tag = tagById(m.tag); const color = toRgb(tag.color);
        ensure(40);
        const blockTop = y;
        // cabecera
        np.drawCircle({ x: M + 9, y: y - 6, size: 8, color });
        const lab = String(idx + 1);
        np.drawText(lab, { x: M + 9 - bold.widthOfTextAtSize(lab, 9) / 2, y: y - 9.2, size: 9, font: bold, color: rgb(1, 1, 1) });
        np.drawText(clean(tagName(tag)), { x: M + 24, y: y - 10, size: 10.5, font: bold, color });
        y -= 24;
        const startPage = np;
        // extracto
        if (m.image) {
          try {
            const img = await embedUrl(m.image);
            const k = m.imagePpu ? Math.min(maxW / img.width, 1 / m.imagePpu, 260 / img.height) : Math.min((maxW * 0.8) / img.width, 160 / img.height, 1);
            const iw = img.width * k, ih = img.height * k;
            ensure(ih + 8);
            np.drawImage(img, { x: M + 12, y: y - ih, width: iw, height: ih });
            if (!m.imagePpu) np.drawRectangle({ x: M + 12, y: y - ih, width: iw, height: ih, borderColor: rgb(0.85, 0.82, 0.75), borderWidth: 0.6 });
            y -= ih + 10;
          } catch (e) { console.warn(e); }
        } else if (m.text) {
          const lines = wrap(`"${m.text}"`, ital, 9.5, maxW - 8);
          for (const ln of lines) { ensure(13); np.drawText(ln, { x: M + 16, y: y - 9.5, size: 9.5, font: ital, color: rgb(0.33, 0.35, 0.4) }); y -= 13; }
          y -= 6;
        }
        // comentario
        const comment = (m.comment || '').trim();
        if (comment) {
          drawBlocks(await richOf(m, maxW), M + 12, maxW);
        } else {
          ensure(15); np.drawText('(sin comentario)', { x: M + 12, y: y - 10, size: 9.5, font: ital, color: rgb(0.65, 0.65, 0.65) }); y -= 15;
        }
        // barra lateral de color (solo en el tramo de la página inicial)
        if (np === startPage) np.drawRectangle({ x: M, y: y, width: 2.5, height: blockTop - y - 18, color, opacity: 0.8 });
        y -= 16;
      }
    }

    const bytes = await out.save();
    await writeTarget(target, new Blob([bytes], { type: 'application/pdf' }));
  } catch (err) {
    console.error(err);
    toast('No se pudo generar el PDF');
  } finally {
    busy(false);
  }
}

/* Guardar archivos: se pregunta el nombre y la carpeta antes de generar el archivo.
   En Chrome/Edge se abre la ventana «Guardar como» del sistema. Donde no existe
   (Safari, móvil), se pregunta el nombre y se descarga o se comparte. */
const FILE_TYPES = {
  pdf: { description: 'Documento PDF', accept: { 'application/pdf': ['.pdf'] }, ext: '.pdf' },
  json: { description: 'Copia de seguridad de Study App', accept: { 'application/json': ['.json'] }, ext: '.json' },
};
async function chooseSaveTarget(suggested, kind) {
  const t = FILE_TYPES[kind];
  const touch = matchMedia('(pointer: coarse)').matches;
  if (window.showSaveFilePicker && !touch) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: suggested, types: [{ description: t.description, accept: t.accept }], id: `study-${kind}`, startIn: 'documents' });
      return { handle, name: handle.name };
    } catch (e) {
      if (e.name === 'AbortError') return null; // cancelado
      console.warn('showSaveFilePicker', e);
    }
  }
  const name = await askFileName(suggested, t.ext);
  return name ? { name } : null;
}
function askFileName(suggested, ext) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', class: 'name-input', value: suggested.replace(new RegExp(`\\${ext}$`), '') });
    const dlg = h('dialog', { class: 'name-dialog' },
      h('form', { method: 'dialog' },
        h('h3', {}, 'Guardar como'),
        h('label', { class: 'name-label' }, 'Nombre del archivo'),
        h('div', { class: 'name-row' }, input, h('span', { class: 'name-ext' }, ext)),
        h('p', { class: 'name-hint' }, 'Tu navegador no permite elegir la carpeta desde aquí: el archivo irá a la carpeta de descargas. En Safari: Ajustes → General → «Ubicación de las descargas» → «Preguntar en cada descarga» para elegirla siempre.'),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn ghost', value: 'cancel', type: 'submit' }, 'Cancelar'),
          h('button', { class: 'btn primary', value: 'ok', type: 'submit' }, 'Guardar'))));
    document.body.append(dlg);
    dlg.addEventListener('close', () => {
      const v = input.value.trim().replace(/[\\/:*?"<>|]/g, '-');
      dlg.remove();
      resolve(dlg.returnValue === 'ok' && v ? v + ext : null);
    });
    dlg.showModal();
    input.select();
  });
}
async function writeTarget(target, blob) {
  if (target.handle) {
    const w = await target.handle.createWritable();
    await w.write(blob); await w.close();
    toast(`Guardado: ${target.name}`);
    return;
  }
  const name = target.name;
  const file = new File([blob], name, { type: blob.type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(`Descargado: ${name}`);
}

/* =========================================================
   COPIA DE SEGURIDAD (para pasar datos entre dispositivos)
   ========================================================= */
function bufToB64(buf) {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64); const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}
async function exportBackup() {
  const target = await chooseSaveTarget(`study-app-copia-${new Date().toISOString().slice(0, 10)}.json`, 'json');
  if (!target) return;
  busy(true, 'Preparando copia…');
  try {
    const docs = await db.getAll('docs');
    const marks = await db.getAll('marks');
    const folders = await db.getAll('folders');
    const parts = [`{"app":"study-app","version":2,"exportedAt":${Date.now()},"folders":${JSON.stringify(folders)},"docs":${JSON.stringify(docs)},"marks":${JSON.stringify(marks)},"files":[`];
    for (const [i, d] of docs.entries()) {
      const f = await db.get('files', d.id);
      if (!f) continue;
      parts.push(`${i ? ',' : ''}{"id":${JSON.stringify(d.id)},"b64":"`, bufToB64(f.data), '"}');
    }
    parts.push(']}');
    await writeTarget(target, new Blob(parts, { type: 'application/json' }));
  } catch (e) { console.error(e); toast('No se pudo crear la copia'); }
  finally { busy(false); }
}
async function importBackup(file) {
  busy(true, 'Restaurando…');
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'study-app') throw new Error('Formato no válido');
    for (const f of data.folders || []) await db.put('folders', f);
    for (const f of data.files || []) await db.put('files', { id: f.id, data: b64ToBuf(f.b64) });
    for (const d of data.docs || []) await db.put('docs', d);
    for (const m of data.marks || []) await db.put('marks', m);
    toast(`Restaurados ${data.docs?.length || 0} documentos`);
    renderLibrary();
  } catch (e) { console.error(e); toast('El archivo de copia no es válido'); }
  finally { busy(false); }
}

/* =========================================================
   Eventos
   ========================================================= */
function init() {
  buildTagRow();
  $('#fileInput').addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
  $('#btnBack').addEventListener('click', () => closeReader());
  $('#modeText').addEventListener('click', () => setMode('text'));
  $('#modeArea').addEventListener('click', () => setMode('area'));
  $('#zoomIn').addEventListener('click', () => setZoom((R.doc?.zoom || 1) + 0.25));
  $('#zoomOut').addEventListener('click', () => setZoom((R.doc?.zoom || 1) - 0.25));
  $('#btnExport').addEventListener('click', exportAnnotated);
  $('#btnLang').addEventListener('click', (e) => chooseLang(e.currentTarget));
  $('#tagCancel').addEventListener('click', () => { hidePopup(); clearSelection(); $('.draft-rect')?.remove(); });
  $('#btnBackup').addEventListener('click', () => $('#backupDialog').showModal());
  $('#btnNewFolder').addEventListener('click', () => createFolder());
  $('#btnMerge').addEventListener('click', () => mergeDialog());
  $('#btnSplit').addEventListener('click', () => splitDialog());
  $('#btnTrash').addEventListener('click', () => setTrash(!LIB.trash));
  $('#btnEmptyTrash').addEventListener('click', emptyTrash);
  $('#btnExportBackup').addEventListener('click', () => { $('#backupDialog').close(); exportBackup(); });
  $('#backupInput').addEventListener('change', (e) => { $('#backupDialog').close(); if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; });
  document.addEventListener('pointerdown', (e) => {
    if (!$('#tagPopup').hidden && !e.target.closest('#tagPopup') && !e.target.closest('.page')) {
      hidePopup(); clearSelection(); $('.draft-rect')?.remove();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ($('#reader').hidden || e.target.matches('textarea, input, select') || e.target.closest?.('.tex-editor') || document.body.classList.contains('editing')) return;
    if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); setZoom((R.doc?.zoom || 1) + 0.25); }
    else if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); setZoom((R.doc?.zoom || 1) - 0.25); }
    else if (e.key === 'Escape') { hidePopup(); clearSelection(); $('.draft-rect')?.remove(); }
    else if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && S && !S.active) { e.preventDefault(); moveFocus(e.key === 'ArrowLeft' ? -1 : 1); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && S && !S.active) { e.preventDefault(); navigator.clipboard?.writeText(selText()).then(() => toast('Texto copiado')).catch(() => {}); }
    else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) setMode(R.mode === 'area' ? 'text' : 'area');
    else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && R.doc) toggleRead(R.doc.lastPage || 1);
  });

  // Arrastrar y soltar PDF en la biblioteca
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { if ($('#library').hidden) return; if ([...e.dataTransfer.types].includes('Files')) { dragDepth++; $('#dropHint').hidden = false; } });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#dropHint').hidden = true; } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; $('#dropHint').hidden = true; if (!$('#library').hidden && e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });

  // Ajustar tamaño al girar el móvil o redimensionar
  let lastW = window.innerWidth, rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(async () => {
      if (!R.doc || Math.abs(window.innerWidth - lastW) < 40) return;
      lastW = window.innerWidth;
      const z = R.doc.zoom; R.doc.zoom = -1; await setZoom(z);
    }, 300);
  });

  window.addEventListener('popstate', () => { if (!location.hash.startsWith('#doc=') && R.doc) closeReader(false); });

  renderLibrary().then(() => {
    const m = location.hash.match(/^#doc=(.+)$/);
    if (m) db.get('docs', m[1]).then((d) => d && live(d) && openDoc(d.id));
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
  }
}

init();
// Acceso para pruebas automáticas
window.__study = { R, get S() { return S; }, selInfo: () => { if (!S) return null; const [lo, hi] = selBounds(); return { text: selText(), runs: runsOf(S.p, lo, hi) }; } };
