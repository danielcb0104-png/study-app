// Study App — LaTeX en los comentarios
// Convierte el código LaTeX de un comentario en bloques (párrafos, fórmulas, listas,
// títulos) y los dibuja con MathJax (SVG). El análisis es tolerante: el código a medio
// escribir nunca rompe la vista previa; los errores se marcan en rojo, como en Overleaf.

/* =========================================================
   MathJax (se carga solo cuando hace falta)
   ========================================================= */
let mjPromise = null;
export function loadMathJax() {
  if (mjPromise) return mjPromise;
  mjPromise = new Promise((resolve, reject) => {
    window.MathJax = {
      loader: { load: [] },
      tex: {
        packages: { '[+]': ['noerrors', 'noundefined', 'physics', 'braket', 'cancel', 'mathtools', 'boldsymbol', 'textmacros', 'color', 'mhchem'] },
        tags: 'ams',
        inlineMath: [['$', '$'], ['\\(', '\\)']],
      },
      svg: { fontCache: 'none' },
      options: { enableMenu: false },
      startup: {
        typeset: false,
        ready() {
          window.MathJax.startup.defaultReady();
          window.MathJax.startup.promise.then(() => {
            try { document.head.append(window.MathJax.svgStylesheet()); } catch {}
            resolve(window.MathJax);
          });
        },
      },
    };
    const s = document.createElement('script');
    s.src = './vendor/mathjax/tex-svg-full.js';
    s.async = true;
    s.onerror = () => { mjPromise = null; reject(new Error('No se pudo cargar MathJax')); };
    document.head.append(s);
  });
  return mjPromise;
}

/* =========================================================
   Análisis del código LaTeX
   ========================================================= */
const MATH_ENVS = /^(equation|align|gather|multline|flalign|alignat|eqnarray|displaymath|math)\*?$/;
const NUMBERED = /\\begin\{(equation|align|gather|multline|flalign|alignat|eqnarray)\}/;

// Quita comentarios (% no escapado)
function stripComments(src) {
  return src.replace(/(^|[^\\])%.*$/gm, '$1');
}
// Lee un argumento entre llaves desde la posición i (que apunta a '{'); devuelve [contenido, fin]
function readGroup(s, i) {
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') { k++; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return [s.slice(i + 1, k), k + 1]; }
  }
  return [s.slice(i + 1), s.length]; // sin cerrar: hasta el final
}
const skipWs = (s, i) => { while (i < s.length && /[ \t]/.test(s[i])) i++; return i; };

// Extrae \newcommand, \renewcommand, \def y \DeclareMathOperator (valen para todo el comentario)
function extractMacros(src) {
  const macros = [];
  let out = '', i = 0;
  const re = /\\(newcommand|renewcommand|providecommand|DeclareMathOperator\*?|def)(?![a-zA-Z])/g;
  let m;
  while ((m = re.exec(src))) {
    out += src.slice(i, m.index);
    let k = m.index + m[0].length;
    const start = m.index;
    if (m[1] === 'def') {
      const nm = /^\s*\\[a-zA-Z]+(#\d)*/.exec(src.slice(k));
      if (nm) k += nm[0].length;
      k = skipWs(src, k);
      const g = readGroup(src, k); if (g) k = g[1];
    } else {
      k = skipWs(src, k);
      if (src[k] === '*') k++;
      k = skipWs(src, k);
      if (src[k] === '{') { const g = readGroup(src, k); k = g[1]; } else { const nm = /^\\[a-zA-Z]+/.exec(src.slice(k)); if (nm) k += nm[0].length; }
      for (let rep = 0; rep < 2; rep++) { k = skipWs(src, k); if (src[k] === '[') { const e = src.indexOf(']', k); if (e > 0) k = e + 1; } }
      k = skipWs(src, k);
      const g = readGroup(src, k); if (g) k = g[1];
    }
    macros.push(src.slice(start, k));
    i = k; re.lastIndex = k;
  }
  out += src.slice(i);
  return { body: out, macros: macros.join('') };
}

/* Bloques:
   {type:'p', inl:[…]}                párrafo
   {type:'math', tex}                 fórmula centrada
   {type:'h', level, inl:[…]}         título
   {type:'list', ordered, items:[[bloques…], …]}
   {type:'center'|'quote', blocks:[…]}
   Elementos en línea:
   {t:'text', s, b, i, u, tt, sc} | {t:'math', tex} | {t:'br'} | {t:'err', s} */
export function parseLatex(src) {
  const { body, macros } = extractMacros(stripComments(src || ''));
  return { blocks: parseBlocks(body), macros };
}

function parseBlocks(s) {
  const blocks = [];
  let para = '';
  const flush = () => { if (para.trim()) blocks.push({ type: 'p', inl: parseInline(para.trim()) }); para = ''; };
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    // párrafo nuevo: línea en blanco o \par
    let m = /^\n[ \t]*\n\s*/.exec(rest) || /^\\par(?![a-zA-Z])\s*/.exec(rest);
    if (m) { flush(); i += m[0].length; continue; }
    // fórmulas centradas
    if (rest.startsWith('\\[')) {
      const e = findClose(s, i + 2, '\\]');
      flush(); blocks.push({ type: 'math', tex: s.slice(i + 2, e.end) }); i = e.next; continue;
    }
    if (rest.startsWith('$$')) {
      const e = findClose(s, i + 2, '$$');
      flush(); blocks.push({ type: 'math', tex: s.slice(i + 2, e.end) }); i = e.next; continue;
    }
    m = /^\\begin\{([a-zA-Z*]+)\}/.exec(rest);
    if (m) {
      const env = m[1];
      const { inner, next, full } = readEnv(s, i, env);
      if (MATH_ENVS.test(env)) {
        flush();
        const tex = env === 'displaymath' || env === 'math' ? inner : full;
        blocks.push({ type: 'math', tex }); i = next; continue;
      }
      if (env === 'itemize' || env === 'enumerate' || env === 'description') {
        flush();
        const items = splitItems(inner).map((it) => {
          let label = null;
          const lm = /^\s*\[([^\]]*)\]/.exec(it);
          if (lm) { label = lm[1]; it = it.slice(lm[0].length); }
          return { label, blocks: parseBlocks(it.trim()) };
        });
        blocks.push({ type: 'list', ordered: env === 'enumerate', desc: env === 'description', items }); i = next; continue;
      }
      if (env === 'center' || env === 'quote' || env === 'quotation' || env === 'flushleft' || env === 'flushright') {
        flush(); blocks.push({ type: env === 'quotation' ? 'quote' : env, blocks: parseBlocks(inner) }); i = next; continue;
      }
      // entorno desconocido (p. ej. theorem): se muestra su contenido con el nombre en negrita
      flush();
      blocks.push({ type: 'env', name: env, blocks: parseBlocks(inner) }); i = next; continue;
    }
    m = /^\\(section|subsection|subsubsection|paragraph)\*?(?![a-zA-Z])\s*/.exec(rest);
    if (m && s[i + m[0].length] === '{') {
      flush();
      const g = readGroup(s, i + m[0].length);
      const level = { section: 1, subsection: 2, subsubsection: 3, paragraph: 4 }[m[1]];
      blocks.push({ type: 'h', level, inl: parseInline(g[0]) }); i = g[1]; continue;
    }
    // \noindent, \medskip… se ignoran
    m = /^\\(noindent|smallskip|medskip|bigskip|newpage|clearpage|centering|maketitle)(?![a-zA-Z])\s*/.exec(rest);
    if (m) { i += m[0].length; continue; }
    // texto normal (saltando las fórmulas en línea para no cortarlas)
    if (rest[0] === '$' || rest.startsWith('\\(')) {
      const open = rest[0] === '$' ? '$' : '\\(', close = open === '$' ? '$' : '\\)';
      const e = findClose(s, i + open.length, close);
      para += s.slice(i, e.next); i = e.next; continue;
    }
    if (rest[0] === '\\') { para += s.slice(i, i + 2); i += 2; continue; }
    para += s[i]; i++;
  }
  flush();
  return blocks;
}
// Divide el contenido de una lista en sus \item (sin entrar en listas anidadas)
function splitItems(inner) {
  const items = [];
  let depth = 0, cur = null, k = 0;
  while (k < inner.length) {
    const r = inner.slice(k);
    let m = /^\\begin\{[a-zA-Z*]+\}/.exec(r);
    if (m) { depth++; if (cur != null) cur += m[0]; k += m[0].length; continue; }
    m = /^\\end\{[a-zA-Z*]+\}/.exec(r);
    if (m) { depth--; if (cur != null) cur += m[0]; k += m[0].length; continue; }
    if (depth === 0 && /^\\item(?![a-zA-Z])/.test(r)) { if (cur != null) items.push(cur); cur = ''; k += 5; continue; }
    if (inner[k] === '\\') { if (cur != null) cur += inner.slice(k, k + 2); k += 2; continue; }
    if (cur != null) cur += inner[k];
    k++;
  }
  if (cur != null) items.push(cur);
  return items;
}
// Busca el cierre de una fórmula; si no existe, llega hasta el final
function findClose(s, from, close) {
  for (let k = from; k < s.length; k++) {
    if (s[k] === '\\' && close !== '\\]' && close !== '\\)') { k++; continue; }
    if (s.startsWith(close, k)) {
      if (close === '$' && s[k - 1] === '\\') continue;
      return { end: k, next: k + close.length };
    }
    if (s[k] === '\\') k++;
  }
  return { end: s.length, next: s.length };
}
// Lee \begin{env} … \end{env} respetando anidamientos
function readEnv(s, i, env) {
  const open = `\\begin{${env}}`, close = `\\end{${env}}`;
  let depth = 0, k = i;
  while (k < s.length) {
    if (s.startsWith(open, k)) { depth++; k += open.length; continue; }
    if (s.startsWith(close, k)) { depth--; if (depth === 0) return { inner: s.slice(i + open.length, k), next: k + close.length, full: s.slice(i, k + close.length) }; k += close.length; continue; }
    k++;
  }
  return { inner: s.slice(i + open.length), next: s.length, full: s.slice(i) + close };
}

const TEXT_SYMBOLS = {
  '\\%': '%', '\\&': '&', '\\$': '$', '\\#': '#', '\\_': '_', '\\{': '{', '\\}': '}', '\\ ': ' ', '\\,': '\u2009', '\\;': ' ', '\\!': '',
  '\\ldots': '…', '\\dots': '…', '\\textellipsis': '…', '\\LaTeX': 'LaTeX', '\\TeX': 'TeX', '\\quad': '\u2003', '\\qquad': '\u2003\u2003',
  '\\textbackslash': '\\', '\\textasciitilde': '~', '\\textasciicircum': '^', '\\S': '§', '\\P': '¶', '\\copyright': '©',
  '\\ss': 'ß', '\\o': 'ø', '\\O': 'Ø', '\\ae': 'æ', '\\AE': 'Æ', '\\aa': 'å', '\\AA': 'Å', '\\l': 'ł', '\\L': 'Ł', '\\i': 'ı',
  '\\textendash': '–', '\\textemdash': '—', '\\textbullet': '•', '\\degree': '°', '\\textdegree': '°', '\\euro': '€',
  '\\newline': '\n', '\\linebreak': '\n', '\\hfill': ' ', '\\today': new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
};
const SYM_KEYS = Object.keys(TEXT_SYMBOLS).sort((a, b) => b.length - a.length);
const ACCENTS = { "'": '\u0301', '`': '\u0300', '^': '\u0302', '"': '\u0308', '~': '\u0303', '=': '\u0304', '.': '\u0307', 'c': '\u0327', 'v': '\u030C', 'u': '\u0306', 'H': '\u030B' };
const STYLE_CMDS = { textbf: { b: 1 }, bfseries: { b: 1 }, textit: { i: 1 }, emph: { i: 1 }, textsl: { i: 1 }, itshape: { i: 1 }, underline: { u: 1 }, uline: { u: 1 }, texttt: { tt: 1 }, textsc: { sc: 1 }, textrm: {}, textsf: {}, textup: {}, textnormal: {}, mbox: {}, text: {}, hbox: {} };

function parseInline(s, style = {}) {
  const out = [];
  let buf = '';
  const push = () => { if (buf) { out.push({ t: 'text', s: typo(buf), ...style }); buf = ''; } };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '$' || s.startsWith('\\(', i)) {
      const open = c === '$' ? (s[i + 1] === '$' ? '$$' : '$') : '\\(';
      const close = open === '\\(' ? '\\)' : open;
      const e = findClose(s, i + open.length, close);
      push();
      const tex = s.slice(i + open.length, e.end);
      if (tex.trim()) out.push({ t: 'math', tex, display: open === '$$' });
      i = e.next; continue;
    }
    if (s.startsWith('\\\\', i)) { push(); out.push({ t: 'br' }); i += 2; const sk = /^\s*\[[^\]]*\]/.exec(s.slice(i)); if (sk) i += sk[0].length; continue; }
    if (c === '\\') {
      // símbolos y acentos
      const sym = SYM_KEYS.find((k) => s.startsWith(k, i) && !(/[a-zA-Z]$/.test(k) && /[a-zA-Z]/.test(s[i + k.length] || '')));
      if (sym) { const v = TEXT_SYMBOLS[sym]; if (v === '\n') { push(); out.push({ t: 'br' }); } else buf += v; i += sym.length; if (/[a-zA-Z]$/.test(sym)) i = skipSpaceAfterCmd(s, i); continue; }
      const acc = /^\\(['`^"~=.]|[cvuH](?![a-zA-Z]))\s*(\{([a-zA-Z\\]*)\}|([a-zA-Z]))/.exec(s.slice(i));
      if (acc && ACCENTS[acc[1]]) { const base = (acc[3] ?? acc[4] ?? '').replace('\\i', 'i').replace('\\j', 'j'); buf += (base + ACCENTS[acc[1]]).normalize('NFC'); i += acc[0].length; continue; }
      const cm = /^\\([a-zA-Z]+)\*?/.exec(s.slice(i));
      if (cm) {
        const name = cm[1];
        let k = skipWs(s, i + cm[0].length);
        if (STYLE_CMDS[name] && s[k] === '{') {
          const g = readGroup(s, k);
          push(); out.push(...parseInline(g[0], { ...style, ...STYLE_CMDS[name] })); i = g[1]; continue;
        }
        if ((name === 'ref' || name === 'eqref') && s[k] === '{') {
          const g = readGroup(s, k); push(); out.push({ t: 'math', tex: `\\${name}{${g[0]}}` }); i = g[1]; continue;
        }
        if (name === 'label' && s[k] === '{') { i = readGroup(s, k)[1]; continue; }
        if ((name === 'footnote' || name === 'textcolor' || name === 'color') && s[k] === '{') {
          // \footnote{…} → (…); \textcolor{c}{…} → contenido
          const g = readGroup(s, k);
          if (name === 'footnote') { push(); out.push({ t: 'text', s: ' (', ...style }, ...parseInline(g[0], style), { t: 'text', s: ')', ...style }); i = g[1]; continue; }
          const k2 = skipWs(s, g[1]);
          if (name === 'textcolor' && s[k2] === '{') { const g2 = readGroup(s, k2); push(); out.push(...parseInline(g2[0], style)); i = g2[1]; continue; }
          i = g[1]; continue;
        }
        if (name === 'url' && s[k] === '{') { const g = readGroup(s, k); push(); out.push({ t: 'text', s: g[0], ...style, tt: 1 }); i = g[1]; continue; }
        // comando desconocido: se muestra en rojo
        push(); out.push({ t: 'err', s: cm[0] }); i += cm[0].length; continue;
      }
      buf += s[i + 1] || ''; i += 2; continue;
    }
    if (c === '{' ) { const g = readGroup(s, i); push(); out.push(...parseInline(g[0], style)); i = g[1]; continue; }
    if (c === '}') { i++; continue; }
    if (c === '~') { buf += '\u00A0'; i++; continue; }
    if (c === '\n') { buf += ' '; i++; continue; }
    buf += c; i++;
  }
  push();
  return out;
}
function skipSpaceAfterCmd(s, i) { while (s[i] === ' ') i++; if (s.startsWith('{}', i)) i += 2; return i; }
function typo(t) {
  return t.replace(/---/g, '—').replace(/--/g, '–').replace(/``/g, '“').replace(/''/g, '”').replace(/`/g, '‘').replace(/[ \t]+/g, ' ');
}

/* =========================================================
   Dibujo en HTML (vista previa y hojas de notas)
   ========================================================= */
const mathCache = new Map();
async function mathNode(MJ, tex, display, macros, numbered) {
  const key = `${display ? 'D' : 'I'}|${macros}|${tex}`;
  if (!numbered && mathCache.has(key)) return mathCache.get(key).cloneNode(true);
  let node;
  try {
    node = await MJ.tex2svgPromise(macros + tex, { display });
  } catch (e) {
    node = document.createElement('span');
    node.className = 'tex-err'; node.textContent = tex;
  }
  if (!numbered) { mathCache.set(key, node.cloneNode(true)); if (mathCache.size > 800) mathCache.delete(mathCache.keys().next().value); }
  return node;
}

// Devuelve una lista de elementos (uno por bloque) listos para colocar y paginar
export async function renderLatex(src) {
  const { blocks, macros } = parseLatex(src);
  if (!blocks.length) return [];
  const MJ = await loadMathJax();
  MJ.texReset();
  // 1.ª pasada: fórmulas centradas (para que \ref y \eqref encuentren sus etiquetas)
  const displayNodes = new Map();
  const walk = async (bs) => {
    for (const b of bs) {
      if (b.type === 'math') displayNodes.set(b, await mathNode(MJ, b.tex, true, macros, NUMBERED.test(b.tex) || /\\tag|\\label/.test(b.tex)));
      if (b.blocks) await walk(b.blocks);
      if (b.items) for (const it of b.items) await walk(it.blocks);
    }
  };
  await walk(blocks);
  const inl = async (items) => {
    const frag = document.createDocumentFragment();
    for (const it of items) {
      if (it.t === 'text') {
        let el = document.createTextNode(it.s);
        if (it.b || it.i || it.u || it.tt || it.sc) {
          const sp = document.createElement('span');
          sp.className = ['b', 'i', 'u', 'tt', 'sc'].filter((k) => it[k]).map((k) => `tx-${k}`).join(' ');
          sp.append(el); el = sp;
        }
        frag.append(el);
      } else if (it.t === 'math') {
        frag.append(await mathNode(MJ, it.tex, !!it.display, macros, /\\ref|\\eqref/.test(it.tex)));
      } else if (it.t === 'br') frag.append(document.createElement('br'));
      else if (it.t === 'err') { const e = document.createElement('span'); e.className = 'tex-err'; e.textContent = it.s; frag.append(e); }
    }
    return frag;
  };
  const build = async (b) => {
    const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
    switch (b.type) {
      case 'p': { const p = el('p', 'tx-p'); p.append(await inl(b.inl)); return p; }
      case 'h': { const hh = el('div', `tx-h tx-h${b.level}`); hh.append(await inl(b.inl)); return hh; }
      case 'math': { const d = el('div', 'tx-display'); d.append(displayNodes.get(b)); return d; }
      case 'list': {
        const l = el(b.ordered ? 'ol' : 'ul', 'tx-list');
        for (const it of b.items) {
          const li = el('li');
          if (it.label != null) { const lb = el('span', 'tx-b'); lb.textContent = `${it.label} `; li.append(lb); if (!b.desc) li.classList.add('tx-custom'); }
          for (const bb of it.blocks) li.append(await build(bb));
          l.append(li);
        }
        return l;
      }
      default: {
        const d = el('div', `tx-${b.type === 'env' ? 'env' : b.type}`);
        if (b.type === 'env') { const t = el('span', 'tx-env-name'); t.textContent = `${b.name[0].toUpperCase()}${b.name.slice(1).replace('*', '')}. `; d.append(t); }
        for (const bb of b.blocks) d.append(await build(bb));
        return d;
      }
    }
  };
  const out = [];
  for (const b of blocks) out.push(await build(b));
  return out;
}

/* =========================================================
   Para el PDF exportado: fórmulas como imágenes PNG
   ========================================================= */
// Convierte el SVG de MathJax en PNG; devuelve {png (bytes), w, h, depth} en puntos
export async function mathToPng(container, fontSizePt, maxWidthPt) {
  const svg = container.querySelector('svg');
  if (!svg) return null;
  const exPt = fontSizePt * 0.44;
  const parse = (v) => (v && v.endsWith('ex') ? parseFloat(v) * exPt : null);
  let w = parse(svg.getAttribute('width'));
  const hgt = parse(svg.getAttribute('height'));
  if (!hgt) return null;
  if (w == null) w = maxWidthPt; // fórmulas con número de ecuación ocupan todo el ancho
  const va = /vertical-align:\s*(-?[\d.]+)ex/.exec(svg.getAttribute('style') || '');
  const depth = va ? -parseFloat(va[1]) * exPt : 0;
  const scale = 4; // px por punto
  const clone = svg.cloneNode(true);
  clone.setAttribute('width', `${w * scale}`); clone.setAttribute('height', `${hgt * scale}`);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('style');
  clone.setAttribute('color', '#1d2330');
  // estilos de MathJax que el SVG necesita fuera de la página (errores, líneas de tablas)
  const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  st.textContent = 'g[data-mml-node="merror"] > g { fill: #c0392b; stroke: #c0392b; }'
    + ' g[data-mml-node="merror"] > rect[data-background] { fill: #fff3a8; stroke: none; }'
    + ' g[data-mml-node="mtable"] > line[data-line], svg[data-table] > g > line[data-line] { stroke-width: 70px; fill: none; }'
    + ' g[data-mml-node="mtable"] > rect[data-frame], svg[data-table] > g > rect[data-frame] { stroke-width: 70px; fill: none; }'
    + ' g[data-mml-node="mtable"] > .mjx-dashed, svg[data-table] > g > .mjx-dashed { stroke-dasharray: 140; }'
    + ' svg { overflow: visible; } a { fill: #1d2330; stroke: #1d2330; }';
  clone.insertBefore(st, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, '#1d2330');
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * scale)); c.height = Math.max(1, Math.ceil(hgt * scale));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  return { png: new Uint8Array(await blob.arrayBuffer()), w, h: hgt, depth };
}

// Prepara los bloques del comentario para el PDF: [{kind, …}] con fórmulas ya rasterizadas
export async function latexForPdf(src, fontSizePt, maxWidthPt) {
  const { blocks, macros } = parseLatex(src);
  if (!blocks.length) return [];
  const MJ = await loadMathJax();
  MJ.texReset();
  const disp = new Map();
  const walk = async (bs) => {
    for (const b of bs) {
      if (b.type === 'math') disp.set(b, await mathToPng(await mathNode(MJ, b.tex, true, macros, true), fontSizePt, maxWidthPt));
      if (b.blocks) await walk(b.blocks);
      if (b.items) for (const it of b.items) await walk(it.blocks);
    }
  };
  await walk(blocks);
  const inl = async (items) => {
    const out = [];
    for (const it of items) {
      if (it.t === 'math') {
        const r = await mathToPng(await mathNode(MJ, it.tex, !!it.display, macros, true), fontSizePt, maxWidthPt);
        if (r) out.push({ t: 'img', ...r });
      } else out.push(it);
    }
    return out;
  };
  const conv = async (b) => {
    switch (b.type) {
      case 'p': return { kind: 'p', inl: await inl(b.inl) };
      case 'h': return { kind: 'h', level: b.level, inl: await inl(b.inl) };
      case 'math': return { kind: 'math', img: disp.get(b) };
      case 'list': {
        const items = [];
        for (const it of b.items) { const bl = []; for (const bb of it.blocks) bl.push(await conv(bb)); items.push({ label: it.label, blocks: bl }); }
        return { kind: 'list', ordered: b.ordered, items };
      }
      default: {
        const bl = []; for (const bb of b.blocks) bl.push(await conv(bb));
        return { kind: 'group', type: b.type, name: b.name, blocks: bl };
      }
    }
  };
  const out = [];
  for (const b of blocks) out.push(await conv(b));
  return out;
}

/* =========================================================
   Autocompletado para el editor
   ========================================================= */
export const COMPLETIONS = [
  // estructura
  ['\\textbf{¦}', 'negrita'], ['\\emph{¦}', 'cursiva'], ['\\textit{¦}', 'cursiva'], ['\\underline{¦}', 'subrayado'], ['\\texttt{¦}', 'monoespaciada'],
  ['\\section*{¦}', 'título'], ['\\subsection*{¦}', 'subtítulo'], ['\\item ', 'elemento de lista'],
  ['\\begin{itemize}\n  \\item ¦\n\\end{itemize}', 'lista'], ['\\begin{enumerate}\n  \\item ¦\n\\end{enumerate}', 'lista numerada'],
  ['\\begin{equation}\n  ¦\n\\end{equation}', 'ecuación numerada'], ['\\begin{equation*}\n  ¦\n\\end{equation*}', 'ecuación'],
  ['\\begin{align}\n  ¦ &= \\\\\n\\end{align}', 'ecuaciones alineadas'], ['\\begin{align*}\n  ¦ &= \\\\\n\\end{align*}', 'ecuaciones alineadas'],
  ['\\begin{cases}\n  ¦ & \\text{si } \\\\\n\\end{cases}', 'casos'], ['\\begin{pmatrix}\n  ¦ & \\\\\n\\end{pmatrix}', 'matriz ( )'],
  ['\\begin{bmatrix}\n  ¦ & \\\\\n\\end{bmatrix}', 'matriz [ ]'], ['\\begin{vmatrix}\n  ¦ & \\\\\n\\end{vmatrix}', 'determinante'],
  ['\\newcommand{\\¦}{}', 'nuevo comando'], ['\\label{¦}', 'etiqueta'], ['\\eqref{¦}', 'referencia (1)'], ['\\ref{¦}', 'referencia'],
  ['\\text{¦}', 'texto en fórmula'], ['\\quad', 'espacio'], ['\\qquad', 'espacio doble'],
  // matemáticas
  ['\\frac{¦}{}', 'fracción'], ['\\dfrac{¦}{}', 'fracción grande'], ['\\sqrt{¦}', 'raíz'], ['\\sqrt[¦]{}', 'raíz n-ésima'],
  ['\\sum_{¦}^{}', 'sumatorio'], ['\\prod_{¦}^{}', 'productorio'], ['\\int_{¦}^{}', 'integral'], ['\\iint', 'integral doble'], ['\\oint', 'integral de línea'],
  ['\\lim_{¦ \\to }', 'límite'], ['\\partial', '∂'], ['\\nabla', '∇'], ['\\infty', '∞'], ['\\cdot', '·'], ['\\times', '×'], ['\\pm', '±'], ['\\mp', '∓'],
  ['\\leq', '≤'], ['\\geq', '≥'], ['\\neq', '≠'], ['\\approx', '≈'], ['\\equiv', '≡'], ['\\sim', '∼'], ['\\simeq', '≃'], ['\\propto', '∝'], ['\\ll', '≪'], ['\\gg', '≫'],
  ['\\to', '→'], ['\\rightarrow', '→'], ['\\leftarrow', '←'], ['\\Rightarrow', '⇒'], ['\\Leftrightarrow', '⇔'], ['\\iff', '⟺'], ['\\implies', '⟹'], ['\\mapsto', '↦'],
  ['\\in', '∈'], ['\\notin', '∉'], ['\\subset', '⊂'], ['\\subseteq', '⊆'], ['\\cup', '∪'], ['\\cap', '∩'], ['\\emptyset', '∅'], ['\\forall', '∀'], ['\\exists', '∃'], ['\\neg', '¬'], ['\\land', '∧'], ['\\lor', '∨'],
  ['\\mathbb{¦}', 'ℝ ℕ ℤ'], ['\\mathcal{¦}', '𝒜'], ['\\mathrm{¦}', 'recto'], ['\\mathbf{¦}', 'negrita'], ['\\boldsymbol{¦}', 'símbolo negrita'], ['\\vec{¦}', 'vector'],
  ['\\hat{¦}', 'gorro'], ['\\bar{¦}', 'barra'], ['\\overline{¦}', 'barra larga'], ['\\dot{¦}', 'derivada'], ['\\ddot{¦}', '2.ª derivada'], ['\\tilde{¦}', 'tilde'],
  ['\\left( ¦ \\right)', '( ) ajustables'], ['\\left[ ¦ \\right]', '[ ] ajustables'], ['\\left\\{ ¦ \\right\\}', '{ } ajustables'], ['\\left| ¦ \\right|', '| | ajustables'],
  ['\\langle ¦ \\rangle', '⟨ ⟩'], ['\\hbar', 'ħ'], ['\\ell', 'ℓ'], ['\\ldots', '…'], ['\\cdots', '⋯'], ['\\dagger', '†'], ['\\otimes', '⊗'], ['\\oplus', '⊕'],
  ['\\sin', 'seno'], ['\\cos', 'coseno'], ['\\tan', 'tangente'], ['\\log', 'logaritmo'], ['\\ln', 'log. neperiano'], ['\\exp', 'exponencial'], ['\\det', 'determinante'], ['\\max', 'máximo'], ['\\min', 'mínimo'],
  ['\\dv{¦}{}', 'derivada (physics)'], ['\\pdv{¦}{}', 'parcial (physics)'], ['\\abs{¦}', '|x| (physics)'], ['\\norm{¦}', '‖x‖ (physics)'], ['\\ket{¦}', '|ψ⟩'], ['\\bra{¦}', '⟨ψ|'], ['\\braket{¦}{}', '⟨φ|ψ⟩'],
  ...'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega'
    .split(' ').map((g) => [`\\${g}`, 'griega']),
];
