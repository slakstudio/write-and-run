/*!
 * Slak v1.7.0
 * Kode Slak berlisensi MIT, (c) 2026 Para pengembang Slak. Lihat berkas LICENSE.
 * Framework aplikasi data & antarmuka yang berjalan sepenuhnya di browser.
 *
 * Gaya API-nya terinspirasi Streamlit (skrip dijalankan ulang dari atas ke
 * bawah, widget langsung mengembalikan nilai), tetapi seluruh kode di sini
 * ditulis dari nol dalam JavaScript murni — tanpa server, tanpa build step,
 * tanpa dependensi, dan tanpa menyalin kode sumber Streamlit.
 *
 * Filosofi: WRITE AND RUN — tulis, simpan, klik, langsung jalan.
 * Tanpa build, tanpa compile, tanpa npm install, tanpa instalasi.
 *
 * Pemakaian singkat:
 *   <script src="slak.js"></script>
 *   <script type="text/slak">
 *     sl.title("Halo, Slak!");
 *     const n = sl.slider("Angka", 0, 100, 25);
 *     sl.write(`Kuadratnya adalah **${n * n}**`);
 *   </script>
 */
(function (global) {
  'use strict';

  const VERSION = '1.9.1';
  const RERUN = { slak: 'rerun' };
  const STOP = { slak: 'stop' };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  /* Kait ekstensi (Slak 1.2): slak-data.js, slak-sql.js, dan lainnya
   * menempelkan fungsi lewat Slak.extend({...}). */
  const EXT = { api: {}, table: [], write: [], blob: [], wrap: [] };
  const NEEDS = {};
  'DataFrame Series read_csv load_csv read_json read_excel excel_sheets read_sheets from_csv from_json to_excel concat merge cut qcut get_dummies crosstab pivot_table melt date_range to_datetime to_numeric dataset datasets stats ml ts analysis python read_url github huggingface worldbank kaggle open_data offline_button'.split(' ').forEach(k => { NEEDS[k] = 'slak-data.js'; });
  NEEDS.sql = NEEDS.sqlite = 'slak-sql.js';
  NEEDS.duckdb = NEEDS.read_parquet = 'slak-duckdb.js';
  'map choropleth geo read_geojson'.split(' ').forEach(k => { NEEDS[k] = 'slak-peta.js'; });

  /* ======================================================================
   * Utilitas umum
   * ==================================================================== */

  const isNum = v => typeof v === 'number' && isFinite(v);
  /* Pengganti Math.max(...larik): spread gagal ("Maximum call stack") di atas ~120 ribu nilai. */
  function maxOf(a) { let m = -Infinity; for (const v of a) m = Math.max(m, v); return m; }
  function minOf(a) { let m = Infinity; for (const v of a) m = Math.min(m, v); return m; }
  function pushAll(t, a) { for (const v of a) t.push(v); return t.length; }
  const isPlainObj = v => v !== null && typeof v === 'object' && !Array.isArray(v) &&
    !(v instanceof Date) && !(v instanceof Blob) && !(v instanceof ArrayBuffer) && !ArrayBuffer.isView(v);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  }

  let LOCALE;
  /* Pemformat Intl disimpan dan dipakai ulang: membuatnya baru untuk setiap sel ~30x lebih lambat. */
  const NF_CACHE = new Map(), DF_CACHE = new Map();
  function nf(o, loc) {
    const L = loc !== undefined ? loc : LOCALE, k = (L || '') + '|' + (o ? JSON.stringify(o) : '');
    let f = NF_CACHE.get(k);
    if (!f) { o = o || undefined; try { f = new Intl.NumberFormat(L, o); } catch (e) { f = new Intl.NumberFormat(undefined, o); } NF_CACHE.set(k, f); }
    return f;
  }
  function dtf(o) {
    const k = (LOCALE || '') + '|' + JSON.stringify(o);
    let f = DF_CACHE.get(k);
    if (!f) { try { f = new Intl.DateTimeFormat(LOCALE, o); } catch (e) { f = new Intl.DateTimeFormat(undefined, o); } DF_CACHE.set(k, f); }
    return f;
  }
  const DT_DATE = { year: 'numeric', month: 'numeric', day: 'numeric' };
  const DT_FULL = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
  function fmtNum(v) {
    if (!isNum(v)) return String(v);
    return Number.isInteger(v) ? nf(null).format(v) : nf({ maximumFractionDigits: 4 }).format(v);
  }
  /* Singkatan angka di sumbu grafik. Bahasa Indonesia: rb (ribu), jt (juta), M (miliar), T (triliun),
   * karena "M" dalam bahasa Indonesia berarti miliar, bukan juta. Bahasa lain: k, M, B, T. */
  function isIndo() {
    let L = LOCALE;
    if (!L) { try { L = navigator.language; } catch (e) { L = 'id'; } }
    return /^(id|in|ms)\b/i.test(L || 'id');
  }
  function fmtTick(v) {
    const a = Math.abs(v);
    const id = isIndo();
    const t = x => id ? String(+x.toPrecision(3)).replace('.', ',') : String(+x.toPrecision(3));
    const U = id ? [' T', ' M', ' jt', ' rb'] : ['T', 'B', 'M', 'k'];
    if (a >= 1e12) return t(v / 1e12) + U[0];
    if (a >= 1e9) return t(v / 1e9) + U[1];
    if (a >= 1e6) return t(v / 1e6) + U[2];
    if (a >= 1e3) return t(v / 1e3) + U[3];
    return id ? String(+v.toPrecision(6)).replace('.', ',') : String(+v.toPrecision(6));
  }
  function fmtDate(v) {
    if (isNaN(v)) return '—';
    return v.getHours() || v.getMinutes() || v.getSeconds() || v.getMilliseconds()
      ? dtf(DT_FULL).format(v) : dtf(DT_DATE).format(v);
  }
  function fmtCat(v) {
    if (v instanceof Date) return dtf(DT_DATE).format(v);
    if (v == null) return '—';
    return String(v);
  }
  function fmtOpt(o) {
    if (o == null) return '—';
    if (typeof o === 'object') return o.label != null ? String(o.label) : JSON.stringify(o);
    return String(o);
  }
  function sameVal(a, b) {
    if (a === b) return true;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
    }
    return false;
  }
  function optIndex(options, v) {
    const i = options.indexOf(v);
    if (i >= 0) return i;
    return options.findIndex(o => sameVal(o, v));
  }
  function toOptions(o) {
    if (o == null) return [];
    if (Array.isArray(o)) return o;
    if (o instanceof Set || o instanceof Map) return [...o.keys()];
    if (typeof o === 'object') return Object.keys(o);
    return [o];
  }
  function stableKey(args) {
    try { return JSON.stringify(args); } catch (e) { return String(args); }
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function nowHM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function decimalsOf(step) {
    const s = String(step);
    if (s.includes('e-')) return +s.split('e-')[1];
    return (s.split('.')[1] || '').length;
  }

  /** Ubah argumen posisi ala Streamlit menjadi objek opsi. */
  function A(rest, names) {
    const o = {};
    let i = 0;
    for (; i < rest.length && i < names.length; i++) {
      const v = rest[i];
      if (isPlainObj(v) && i === rest.length - 1) break;
      o[names[i]] = v;
    }
    const last = rest[i];
    if (isPlainObj(last)) Object.assign(o, last);
    return o;
  }

  /* ======================================================================
   * Markdown kecil yang aman (HTML di-escape kecuali diizinkan)
   * ==================================================================== */

  function safeUrl(u, img) {
    const raw = u.replace(/&amp;/g, '&').replace(/[\u0000- \u007f]/g, '');
    const m = raw.match(/^([a-z][a-z0-9+.\-]*):/i);
    if (m) {
      const sch = m[1].toLowerCase();
      const ok = ['http', 'https', 'mailto', 'tel'].includes(sch) || (img && /^data:image\//i.test(raw)) || (img && sch === 'blob');
      if (!ok) return '#';
    }
    return u;
  }

  function inline(s) {
    const slots = [];
    const keep = x => { slots.push(x); return '\u0001' + (slots.length - 1) + '\u0002'; };
    s = s.replace(/`([^`\n]+)`/g, (m, c) => keep('<code>' + c + '</code>'));
    const unesc = t => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    s = s.replace(/\$\$([^$]+?)\$\$/g, (m, t) => keep(texToMathML(unesc(t), true)));
    s = s.replace(/(^|[^\\$\w])\$(?=\S)([^$\n]*?\S)\$(?![\w$])/g, (m, pre, t) => pre + keep(texToMathML(unesc(t), false)));
    s = s.replace(/\\\$/g, '$');
    s = s.replace(/:material\/([a-z0-9_]+):/g, (m, n) => keep(iconHTML(m)));
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => keep(`<img src="${safeUrl(u, true)}" alt="${a}">`));
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => keep(`<a href="${safeUrl(u)}" target="_blank" rel="noopener noreferrer">${t}</a>`));
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g, (m, pre, u) => pre + keep(`<a href="${safeUrl(u)}" target="_blank" rel="noopener noreferrer">${u}</a>`));
    s = emo(s);
    s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>');
    s = s.replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>');
    s = s.replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
    s = s.replace(/:(red|green|blue|orange|yellow|violet|gray|grey|primary)-background\[([^\]]+)\]/g, '<span class="slak-bg slak-bg-$1">$2</span>');
    s = s.replace(/:(red|green|blue|orange|yellow|violet|gray|grey|primary)-badge\[([^\]]+)\]/g, '<span class="slak-badge slak-bc-$1">$2</span>');
    s = s.replace(/:(red|green|blue|orange|yellow|violet|gray|grey|primary|rainbow)\[([^\]]+)\]/g, '<span class="slak-c-$1">$2</span>');
    s = s.replace(/\u0001(\d+)\u0002/g, (m, i) => slots[+i]);
    return s;
  }

  const LIST_RE = /^\s*([-*+]|\d+[.)])\s+/;
  function md(src, allowHtml) {
    let lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    const indents = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
    const ind = indents.length ? minOf(indents) : 0;
    if (ind > 0) lines = lines.map(l => l.slice(ind));
    const E = allowHtml ? (x => x) : esc;
    const I = x => inline(E(x));
    const isBlockStart = l => /^\s*(```|#{1,6}\s|>)/.test(l) || LIST_RE.test(l) || /^\s*(---|\*\*\*|___)\s*$/.test(l);
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const L = lines[i];
      let m;
      if (!L.trim()) { i++; continue; }
      if (/^\s*\$\$\s*$/.test(L) || /^\s*\$\$[^$]+\$\$\s*$/.test(L)) {
        let t;
        if (/^\s*\$\$\s*$/.test(L)) { const buf = []; i++; while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) buf.push(lines[i++]); i++; t = buf.join('\n'); }
        else { t = L.trim().slice(2, -2); i++; }
        out.push(`<div class="slak-math">${texToMathML(t, true)}</div>`);
        continue;
      }
      if (/^\s*```/.test(L)) {
        const buf = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push(`<pre class="slak-pre"><code>${esc(buf.join('\n'))}</code></pre>`);
        continue;
      }
      if ((m = L.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
        const n = m[1].length;
        out.push(`<h${n}>${I(m[2])}</h${n}>`); i++; continue;
      }
      if (/^\s*(---|\*\*\*|___)\s*$/.test(L)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(L)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push(`<blockquote>${md(buf.join('\n'), allowHtml)}</blockquote>`);
        continue;
      }
      if (LIST_RE.test(L)) {
        const ordered = /^\s*\d/.test(L);
        const items = [];
        while (i < lines.length && LIST_RE.test(lines[i])) {
          let t = lines[i++].replace(LIST_RE, '');
          while (i < lines.length && lines[i].trim() && /^\s{2,}/.test(lines[i]) && !LIST_RE.test(lines[i])) t += ' ' + lines[i++].trim();
          let cb = '';
          const c = t.match(/^\[([ xX])\]\s+/);
          if (c) { cb = `<input type="checkbox" disabled${c[1] !== ' ' ? ' checked aria-label="Selesai"' : ' aria-label="Belum selesai"'}> `; t = t.slice(c[0].length); }
          items.push(`<li>${cb}${I(t)}</li>`);
        }
        const tag = ordered ? 'ol' : 'ul';
        out.push(`<${tag}>${items.join('')}</${tag}>`);
        continue;
      }
      if (L.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const head = cells(L);
        const al = cells(lines[i + 1]).map(c => (c.startsWith(':') && c.endsWith(':')) ? 'center' : c.endsWith(':') ? 'right' : '');
        i += 2;
        const body = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) body.push(cells(lines[i++]));
        const cell = (tag, c, j) => `<${tag}${al[j] ? ` style="text-align:${al[j]}"` : ''}>${I(c)}</${tag}>`;
        out.push(`<table><thead><tr>${head.map((c, j) => cell('th', c, j)).join('')}</tr></thead><tbody>${
          body.map(r => `<tr>${head.map((_, j) => cell('td', r[j] == null ? '' : r[j], j)).join('')}</tr>`).join('')}</tbody></table>`);
        continue;
      }
      const buf = [L]; i++;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
      out.push('<p>' + buf.map((l, k) => {
        const hard = / {2,}$|\\$/.test(l);
        const txt = I(l.replace(/\\$/, '').replace(/\s+$/, ''));
        return txt + (k < buf.length - 1 ? (hard ? '<br>' : ' ') : '');
      }).join('') + '</p>');
    }
    return out.join('');
  }

  function jsonHTML(v) {
    let s;
    try {
      s = JSON.stringify(v, (k, x) => typeof x === 'bigint' ? x.toString()
        : x instanceof Map ? Object.fromEntries(x)
        : x instanceof Set ? [...x]
        : x instanceof Error ? { name: x.name, message: x.message } : x, 2);
    } catch (e) { s = String(v); }
    if (s === undefined) s = String(v);
    return esc(s).replace(/(&quot;(?:\\.|[^\\])*?&quot;)(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi,
      (m, str, colon, kw) => str ? `<span class="${colon ? 'k' : 's'}">${str}</span>${colon || ''}`
        : kw ? `<span class="b">${m}</span>` : `<span class="n">${m}</span>`);
  }

  /* ======================================================================
   * Data: tabel, CSV
   * ==================================================================== */

  function toTable(data) {
    if (data == null) return { rows: [], cols: [] };
    for (const f of EXT.table) { const t = f(data); if (t) return t; }
    if (data instanceof Map) data = Object.fromEntries(data);
    if (Array.isArray(data)) {
      if (!data.length) return { rows: [], cols: [] };
      if (data.every(r => isPlainObj(r))) {
        const cols = [];
        const seen = new Set();
        for (const r of data) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); cols.push(k); }
        return { rows: data, cols };
      }
      if (data.every(Array.isArray)) {
        const w = maxOf(data.map(r => r.length));
        const cols = Array.from({ length: w }, (_, i) => String(i));
        return { rows: data.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]]))), cols };
      }
      return { rows: data.map(v => ({ value: v })), cols: ['value'] };
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length && keys.every(k => Array.isArray(data[k]))) {
        const n = maxOf(keys.map(k => data[k].length));
        const rows = Array.from({ length: n }, (_, i) => Object.fromEntries(keys.map(k => [k, data[k][i]])));
        return { rows, cols: keys };
      }
      return { rows: keys.map(k => ({ key: k, value: data[k] })), cols: ['key', 'value'] };
    }
    return { rows: [{ value: data }], cols: ['value'] };
  }

  /** Pemotong CSV cepat: memotong teks dengan slice (bukan menyambung huruf demi huruf),
   *  sehingga 5x lebih cepat dan jauh lebih hemat memori untuk berkas besar. */
  function csvRows(text, delim) {
    const D = delim.charCodeAt(0), Q = 34, N = 10, R = 13, L = text.length, rows = [];
    let row = [], i = 0;
    while (i < L) {
      let c = text.charCodeAt(i), v;
      if (c === Q) {
        let j = i + 1, st = j, s = '';
        for (;;) {
          const k = text.indexOf('"', j);
          if (k < 0) { s += text.slice(st); j = L; break; }
          if (text.charCodeAt(k + 1) === Q) { s += text.slice(st, k + 1); j = k + 2; st = j; }
          else { s += text.slice(st, k); j = k + 1; break; }
        }
        let e = j;   // teks setelah tanda kutip penutup (jarang): ikut sel
        while (e < L) { const x = text.charCodeAt(e); if (x === D || x === N || x === R) break; e++; }
        if (e > j) s += text.slice(j, e);
        v = s; i = e; c = i < L ? text.charCodeAt(i) : N;
      } else {
        let j = i;
        while (j < L) { c = text.charCodeAt(j); if (c === D || c === N || c === R) break; j++; }
        v = text.slice(i, j); i = j; if (j >= L) c = N;
      }
      row.push(v);
      if (c === D) { i++; if (i >= L) row.push(''); }
      else {
        if (c === R && text.charCodeAt(i + 1) === N) i++;
        i++;
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      }
    }
    if (row.length && (row.length > 1 || row[0] !== '')) rows.push(row);
    return rows;
  }

  /* ======================================================================
   * sl.worker (Slak 1.9): jalankan hitungan berat di Web Worker supaya halaman tidak membeku.
   *   const hasil = await sl.worker((data, k) => { ... return ... }, df, 3)
   * Fungsinya dikirim sebagai teks, jadi tidak boleh memakai variabel dari luar fungsi.
   * DataFrame dikirim sebagai daftar objek. Bila browser menolak worker, fungsi dijalankan biasa.
   * ==================================================================== */
  let workerOK = null;
  function workerSource(src) {
    return `self.onmessage = async (e) => { try { const f = (${src}); const r = await f(...e.data); self.postMessage({ ok: true, r }); } catch (err) { self.postMessage({ ok: false, m: String(err && err.message || err), n: err && err.name }); } };`;
  }
  function runWorker(src, args, o) {
    o = o || {};
    const inline = async () => { const f = (0, eval)('(' + src + ')'); return f(...args); };   // pengganti dengan aturan yang sama: tanpa variabel luar
    if (workerOK === false || typeof Worker !== 'function' || typeof Blob !== 'function') return inline();
    return new Promise((resolve, reject) => {
      let url = null, w = null, tm = null;
      const end = () => { clearTimeout(tm); try { w && w.terminate(); } catch (e) { /* abaikan */ } try { url && URL.revokeObjectURL(url); } catch (e) { /* abaikan */ } };
      try {
        url = URL.createObjectURL(new Blob([workerSource(src)], { type: 'text/javascript' }));
        w = new Worker(url);
      } catch (e) {
        workerOK = false; end();
        console.warn('[Slak] Web Worker tidak tersedia di halaman ini; sl.worker menjalankan fungsinya biasa.');
        inline().then(resolve, reject); return;
      }
      workerOK = true;
      w.onmessage = (e) => {
        end();
        const d = e.data || {};
        if (d.ok) return resolve(d.r);
        const m = /is not defined/.test(d.m) ? `Fungsi di sl.worker memakai ${d.m.replace(' is not defined', '')} yang tidak ada di dalam worker. Fungsi worker tidak bisa memakai variabel dari luar dirinya (termasuk sl); kirim nilainya sebagai argumen: sl.worker((data) => { ... }, data).` : d.m;
        reject(new Error(m));
      };
      w.onerror = (e) => { end(); e.preventDefault && e.preventDefault(); reject(new Error('Galat di sl.worker: ' + (e.message || 'tanpa keterangan'))); };
      if (o.timeout) tm = setTimeout(() => { end(); reject(new Error(`sl.worker belum selesai setelah ${o.timeout / 1000} detik.`)); }, o.timeout);
      try { w.postMessage(args); }
      catch (e) { end(); reject(new Error('Data untuk sl.worker tidak bisa dikirim ke worker (' + e.message + '). Kirim angka, teks, larik, objek biasa, atau DataFrame.')); }
    });
  }
  function workerArg(v) {
    if (v && typeof v === 'object' && typeof v.to_records === 'function') return v.to_records();
    if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'Series' && typeof v.to_list === 'function') return v.to_list();
    return v;
  }
  function slWorker(fn, ...args) {
    if (typeof fn !== 'function') throw new Error('sl.worker butuh fungsi, misalnya await sl.worker((data) => data.length, df).');
    let o = null;
    if (args.length && isPlainObj(args[args.length - 1]) && args[args.length - 1].__slak_worker_opts) o = args.pop();
    return runWorker(fn.toString(), args.map(workerArg), o);
  }

  function parseCSV(text, o) {
    o = o || {};
    text = String(text).replace(/^﻿/, '');
    const nl = text.search(/\r?\n/), first = nl < 0 ? text : text.slice(0, nl);
    const delim = o.delimiter || [',', ';', '\t', '|'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = csvRows(text, delim);
    const conv = v => {
      if (o.numbers === false) return v;
      const t = v.trim();
      if (t === '') return null;
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t);
      if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
      return v;
    };
    if (o.header === false) return o.numbers === false ? rows : rows.map(r => r.map(conv));
    const head = (rows.shift() || []).map((h, i) => h.trim() || `kolom_${i + 1}`);
    return rows.map(r => Object.fromEntries(head.map((k, i) => [k, conv(r[i] == null ? '' : r[i])])));
  }

  function toCSV(data) {
    const { rows, cols } = toTable(data);
    const q = v => {
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.map(q).join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n');
  }

  /* ======================================================================
   * Cache & query params
   * ==================================================================== */

  const CACHE = new Map();
  const RCACHE = new Map();
  function cacheFactory(store, kind) {
    const make = (fn, o) => {
      if (isPlainObj(fn) && o === undefined) return f => make(f, fn);
      if (typeof fn !== 'function') throw new Error(`sl.cache_${kind}() butuh fungsi, misalnya const muat = sl.cache_${kind}(async (url) => ...).`);
      o = o || {};
      const id = kind + '\u0000' + fn.toString();
      const ttl = o.ttl == null ? null : isNum(o.ttl) ? o.ttl * 1000 : parseDuration(o.ttl);
      const keyOf = args => id + '\u0000' + stableKey(args);
      const wrapped = (...args) => {
        const k = keyOf(args);
        const hit = store.get(k);
        const now = Date.now();
        if (hit && (!ttl || now - hit.t < ttl)) { hit.u = now; return hit.v; }
        const v = fn(...args);
        store.set(k, { v, t: now, u: now, id });
        if (v && typeof v.then === 'function') v.catch(() => store.delete(k));
        if (o.max_entries) {
          const mine = [...store.entries()].filter(([, x]) => x.id === id).sort((a, b) => a[1].u - b[1].u);
          while (mine.length > o.max_entries) store.delete(mine.shift()[0]);
        }
        return v;
      };
      wrapped.clear = (...args) => {
        if (args.length) { store.delete(keyOf(args)); return; }
        for (const [k, x] of [...store]) if (x.id === id) store.delete(k);
      };
      return wrapped;
    };
    make.clear = () => store.clear();
    return make;
  }
  const cacheData = cacheFactory(CACHE, 'data');
  const cacheResource = cacheFactory(RCACHE, 'resource');

  const queryParams = {
    get(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } },
    get_all(k) { try { return new URLSearchParams(location.search).getAll(k); } catch (e) { return []; } },
    has(k) { try { return new URLSearchParams(location.search).has(k); } catch (e) { return false; } },
    all() { try { return Object.fromEntries(new URLSearchParams(location.search)); } catch (e) { return {}; } },
    to_dict() { return this.all(); },
    keys() { return Object.keys(this.all()); },
    set(k, v) {
      try {
        const u = new URL(location.href);
        u.searchParams.delete(k);
        if (v != null) for (const x of [].concat(v)) u.searchParams.append(k, x);
        history.replaceState(null, '', u);
      } catch (e) { /* mis. file:// di sebagian browser */ }
    },
    delete(k) { this.set(k, null); },
    from_dict(obj) {
      try {
        const u = new URL(location.href);
        u.search = '';
        for (const k in (obj || {})) for (const x of [].concat(obj[k])) if (x != null) u.searchParams.append(k, x);
        history.replaceState(null, '', u);
      } catch (e) { /* abaikan */ }
    },
    clear() { this.from_dict({}); }
  };

  /* ======================================================================
   * Rekonsiliasi: setiap "konteks" adalah wadah elemen yang
   * dicocokkan ulang pada setiap kali skrip dijalankan.
   * ==================================================================== */

  function newCtx(app, el, path, extra) {
    const c = Object.assign({ app, el, path, map: new Map(), used: [], counts: new Map(), runId: -1, form: null, frag: null, single: false }, extra || {});
    if (app) (app._ctxPath || (app._ctxPath = new Map())).set(path, c);   // mode sel: cari wadah menurut jalurnya
    return c;
  }
  function touch(c) {
    if (c.runId !== c.app.runId) {
      c.runId = c.app.runId;
      c.used = [];
      c.counts = new Map();
      c.app.touched.add(c);
    }
  }
  function place(c, type, ident, create) {
    const app = c.app;
    if (!app.running) throw new Error('Elemen Slak hanya bisa dibuat ketika skrip sedang berjalan.');
    if (app.abort) throw RERUN;
    touch(c);
    const base = type + '|' + ident;
    const n = c.counts.get(base) || 0;
    c.counts.set(base, n + 1);
    const id = base + '#' + n;
    let rec = c.map.get(id);
    if (!rec) {
      rec = { id, type, app, ctx: c };
      create(rec);
      c.map.set(id, rec);
    }
    const prev = c.used[c.used.length - 1];
    c.used.push(rec);
    const want = prev ? prev.el.nextSibling : c.el.firstChild;
    if (rec.el !== want) c.el.insertBefore(rec.el, want);
    return rec;
  }
  function unplace(c, rec) {
    const i = c.used.indexOf(rec);
    if (i >= 0) c.used.splice(i, 1);
    c.map.delete(rec.id);
    rec.el.remove();
    if (rec.dispose) rec.dispose();
  }
  function prune(c) {
    const keep = new Set(c.used);
    for (const [id, rec] of c.map) {
      if (!keep.has(rec)) {
        rec.el.remove();
        c.map.delete(id);
        if (rec.dispose) rec.dispose();
      }
    }
  }
  function beginSingle(c) {
    touch(c);
    c.used = [];
    c.counts = new Map();
  }
  function childCtx(rec, el, name, parent, extra) {
    return newCtx(rec.app, el, parent.path + '/' + rec.id + (name ? '/' + name : ''), Object.assign({ form: parent.form, frag: parent.frag }, extra || {}));
  }

  /* ======================================================================
   * Widget: penyimpanan nilai, commit, pemicu
   * ==================================================================== */

  function ident(label, o) {
    return o && o.key != null ? 'key:' + o.key : String(label);
  }

  function bindWidget(rec, ctx, o, def) {
    const app = ctx.app;
    rec.opts = o;
    rec.form = ctx.form;
    if (o.key != null) {
      if (app.seenKeys.has(o.key)) throw new Error(`Key widget "${o.key}" dipakai lebih dari sekali.`);
      app.seenKeys.add(o.key);
      rec.key = o.key;
      rec.wid = 'k:' + o.key;
    } else {
      rec.key = null;
      rec.wid = ctx.path + '/' + rec.id;
    }
    app.seenWids.add(rec.wid);
    if (rec.el && o.width != null && rec.type !== 'data_editor') { setWidth(rec.el, o.width === 'stretch' ? null : o.width); rec.el.classList.toggle('slak-wstretch', o.width === 'stretch'); }
    rec.persist = !!o.persist && rec.type !== 'file_uploader';
    if (rec.persist && Object.prototype.hasOwnProperty.call(app.ls.widgets, rec.wid)) {
      const fresh = rec.key != null ? !(rec.key in app.ss) : !app.vals.has(rec.wid);
      if (fresh) def = app.ls.widgets[rec.wid];
    }
    let v;
    if (rec.key != null) {
      if (!(rec.key in app.ss)) app.ss[rec.key] = def;
      v = app.ss[rec.key];
    } else {
      if (!app.vals.has(rec.wid)) app.vals.set(rec.wid, def);
      v = app.vals.get(rec.wid);
    }
    const pend = rec.form ? app.pendingFor(rec.form).get(rec.wid) : undefined;
    rec.value = v;
    rec.shown = pend ? pend.v : v;
    if (rec.form && app.clearingNow.has(rec.form)) {
      // Form dengan clear_on_submit: kembalikan nilai terkirim, lalu kosongkan tampilannya.
      if (rec.key != null) app.ss[rec.key] = def; else app.vals.set(rec.wid, def);
      rec.shown = def;
      rec.force = true;
    }
    return v;
  }
  function canSync(rec, el) {
    const ok = rec.force || document.activeElement !== el;
    rec.force = false;
    return ok;
  }
  function store(rec, v) {
    const app = rec.app;
    if (rec.key != null) app.ss[rec.key] = v; else app.vals.set(rec.wid, v);
    rec.value = v;
    if (rec.persist) { app.ls.widgets[rec.wid] = v; app.saveLocalSoon(); }
  }
  function fixValue(rec, v) {
    store(rec, v);
    rec.shown = v;
    return v;
  }
  function commit(rec, v) {
    const app = rec.app;
    rec.shown = v;
    if (rec.form) { app.pendingFor(rec.form).set(rec.wid, { rec, v }); return; }
    store(rec, v);
    app.callback(rec.opts.on_change, rec.opts.args);
    if (rec.opts.on_change === 'ignore') return;
    rerunFor(rec);
  }
  function rerunFor(rec) {
    const fr = rec.ctx && rec.ctx.frag;
    if (fr && fr.run && rec.app.wantFull !== true) rec.app.rerunFragment(fr); else rec.app.rerun();
  }
  function trigger(rec, value) {
    const app = rec.app;
    app.triggers.set(rec.wid, value === undefined ? true : value);
    app.callback(rec.opts.on_click || rec.opts.on_submit, rec.opts.args);
    rerunFor(rec);
  }

  function fieldShell(rec, cls) {
    rec.el = h('div', { class: 'slak-el slak-field ' + (cls || '') });
    rec.lab = h('label', { class: 'slak-label' });
    rec.el.append(rec.lab);
  }
  let labSeq = 0;
  function setLabel(rec, label, o) {
    const html = esc(label) + (o.help ? ` <span class="slak-help" title="${esc(o.help)}">?</span>` : '');
    if (rec.labHTML !== html) { rec.labHTML = html; rec.lab.innerHTML = html; }
    const lv = o.label_visibility || 'visible';
    rec.lab.style.display = lv === 'collapsed' ? 'none' : '';
    rec.lab.style.visibility = lv === 'hidden' ? 'hidden' : '';
    linkLabel(rec, label);
  }
  /* Aksesibilitas (Slak 1.9): kontrol isian diberi nama dari labelnya, termasuk saat label disembunyikan,
   * sehingga pembaca layar menyebut "Kota, kotak pilih" alih-alih "kotak pilih". */
  function linkLabel(rec, label) {
    if (!rec.lab || !rec.el) return;
    if (!rec.lab.id) rec.lab.id = 'slak-lab-' + (++labSeq);
    const id = rec.lab.id, plain = String(label == null ? '' : label);
    for (const c of rec.el.querySelectorAll('input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select, textarea')) {
      if (c.closest('.slak-chips') || c.getAttribute('data-own-label')) continue;
      if (rec.lab.style.display === 'none') { c.removeAttribute('aria-labelledby'); if (c.getAttribute('aria-label') !== plain) c.setAttribute('aria-label', plain); }
      else if (!c.hasAttribute('aria-label') && c.getAttribute('aria-labelledby') !== id) c.setAttribute('aria-labelledby', id);
    }
    const r0 = rec.el.querySelector('input[type=radio]');
    if (r0 && r0.parentElement) {
      const g = r0.closest('.slak-radios, .slak-opts') || r0.parentElement.parentElement;
      if (g && g.getAttribute('role') !== 'radiogroup') { g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-labelledby', id); }
    }
  }
  function setDisabled(rec, els, o) {
    const d = !!o.disabled;
    for (const e of els) if (e) e.disabled = d;
    rec.el.classList.toggle('slak-disabled', d);
  }

  /* ======================================================================
   * Grafik SVG
   * ==================================================================== */

  function niceStep(span, count) {
    const raw = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const r = raw / mag;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  }
  function niceTicks(lo, hi, count) {
    if (hi - lo < 1e-12) { const d = Math.abs(lo) * 0.1 || 1; lo -= d; hi += d; }
    const st = niceStep(hi - lo, count);
    const a = Math.floor(lo / st + 1e-9) * st, b = Math.ceil(hi / st - 1e-9) * st;
    const ticks = [];
    for (let v = a; v <= b + st * 1e-6; v += st) ticks.push(+v.toPrecision(12));
    return { lo: a, hi: b, ticks };
  }
  function rangeTicks(lo, hi, count) {
    if (hi === lo) return [lo];
    const st = niceStep(hi - lo, count);
    const out = [];
    for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-6; v += st) out.push(+v.toPrecision(12));
    return out;
  }

  /* ======================================================================
   * Dataframe
   * ==================================================================== */

  function cmp(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (isNum(a) && isNum(b)) return a - b;
    return String(a).localeCompare(String(b), LOCALE, { numeric: true });
  }
  function cellHTML(v, num) {
    if (v == null || (typeof v === 'number' && isNaN(v))) return '<td class="nil">—</td>';
    if (typeof v === 'boolean') return `<td class="bool">${v ? '✓' : '✗'}</td>`;
    if (v instanceof Date) return `<td>${esc(fmtDate(v))}</td>`;
    if (typeof v === 'object') return `<td class="obj">${esc(JSON.stringify(v))}</td>`;
    if (isNum(v)) return `<td class="n">${esc(fmtNum(v))}</td>`;
    return `<td${num ? ' class="n"' : ''}>${esc(v)}</td>`;
  }
  function renderDF(rec) {
    const { rows } = rec.t, o = rec.o;
    const cc = o.column_config || {};
    let cols = rec.t.cols;
    if (o.column_order) cols = [].concat(o.column_order).filter(c => cols.includes(c));
    const conf = {};
    cols = cols.filter(c => { const cf = colConf(cc, c, rows); if (!cf) return false; conf[c] = cf; return true; });
    if (o.format) for (const c in o.format) if (conf[c] && o.format[c] != null) { conf[c].format = o.format[c]; if (conf[c].type === 'text' && rows.some(r => isNum(r[c]))) conf[c].type = 'number'; }
    for (const c of cols) {
      const cf = conf[c];
      if (cf.format != null || (cf.type !== 'number' && cf.type !== 'text')) continue;
      const vals = sampleRows(rows).map(r => r[c]).filter(v => v != null);
      if (vals.length && vals.every(v => Number.isInteger(v)) && (/(^|_)(tahun|year|thn)($|_)/i.test(c) || vals.every(v => v >= 1900 && v <= 2100))) cf.format = 'plain';
    }
    const idxCf = cc._index === null ? null : (typeof cc._index === 'string' ? { label: cc._index } : (cc._index || {}));
    let order = rows.map((_, i) => i);
    if (rec.query) {
      const q = rec.query.toLowerCase();
      order = order.filter(i => cols.some(c => {
        const v = rows[i][c];
        if (v == null) return false;
        const s = v instanceof Date ? fmtDate(v) : typeof v === 'object' ? JSON.stringify(v) : String(v);
        return s.toLowerCase().includes(q);
      }));
    }
    if (rec.sort) {
      const { col, dir } = rec.sort;
      order.sort((a, b) => cmp(rows[a][col], rows[b][col]) * dir || a - b);
    }
    const limit = rec.interactive ? (o.max_rows || 1000) : Infinity;
    const shown = order.slice(0, limit);
    const showIdx = !o.hide_index && idxCf !== null;
    const modes = rec.modes || new Set();
    const rowSel = modes.has('single-row') || modes.has('multi-row') || modes.has('single-row-required');
    const colSel = modes.has('single-column') || modes.has('multi-column');
    const cellSel = modes.has('single-cell') || modes.has('multi-cell');
    const sel = (rec.shown && rec.shown.selection) || { rows: [], columns: [], cells: [] };
    const selRows = new Set(sel.rows || []), selCols = new Set(sel.columns || []);
    const selCells = new Set((sel.cells || []).map(x => x[0] + '\u0000' + x[1]));
    const smp = sampleRows(rows);
    const numCol = cols.map(c => conf[c].type === 'number' || (conf[c].type === 'text' && rows.length > 0 && smp.every(r => r[c] == null || isNum(r[c]))));
    const grad = o.gradient === true ? cols.filter((c, j) => numCol[j]) : o.gradient ? [].concat(o.gradient) : [];
    const gr = cols.map(c => {
      if (!grad.includes(c)) return null;
      const v = rows.map(r => r[c]).filter(isNum);
      return v.length ? [minOf(v), maxOf(v)] : null;
    });
    const radio = modes.has('single-row') || modes.has('single-row-required');
    let html = '<table><thead><tr>' + (rowSel ? '<th class="sel"><span class="slak-sr">Pilih</span></th>' : '') + (showIdx ? `<th class="idx">${idxCf.label ? esc(idxCf.label) : '<span class="slak-sr">Indeks</span>'}</th>` : '') +
      cols.map((c, j) => {
        const cf = conf[c];
        const s = rec.sort && rec.sort.col === c ? (rec.sort.dir > 0 ? ' ↑' : ' ↓') : '';
        const cls = [numCol[j] ? 'n' : '', cf.pinned ? 'pin' : '', selCols.has(c) ? 'on' : '', colSel ? 'csel' : ''].filter(Boolean).join(' ');
        return `<th data-c="${j}"${cls ? ` class="${cls}"` : ''} style="${colStyle(cf)}"${cf.help ? ` title="${esc(cf.help)}"` : ''}>${esc(cf.label)}${s}</th>`;
      }).join('') + '</tr></thead><tbody>';
    const rh = o.row_height ? ` style="height:${o.row_height}px"` : '';
    for (const i of shown) {
      html += `<tr data-i="${i}"${selRows.has(i) ? ' class="on"' : ''}${rh}>` + (rowSel ? `<td class="sel"><input type="${radio ? 'radio' : 'checkbox'}" tabindex="-1" data-row="${i}"${selRows.has(i) ? ' checked' : ''} aria-label="Pilih baris ${i}"></td>` : '') +
        (showIdx ? `<td class="idx">${i}</td>` : '') + cols.map((c, j) => {
          const v = rows[i][c], cf = conf[c];
          const cv = cellView(v, numCol[j] && cf.type === 'text' ? Object.assign({}, cf, { type: 'number' }) : cf, o);
          let st = colStyle(cf);
          if (gr[j] && isNum(v)) {
            const t = gr[j][1] > gr[j][0] ? (v - gr[j][0]) / (gr[j][1] - gr[j][0]) : 0.5;
            st += `background:color-mix(in srgb,var(--accent) ${Math.round(6 + t * 46)}%,transparent);`;
          }
          const cls = [cv.cls, cf.pinned ? 'pin' : '', selCols.has(c) || selCells.has(i + '\u0000' + c) ? 'on' : ''].filter(Boolean).join(' ');
          return `<td data-c="${j}"${cls ? ` class="${cls}"` : ''}${st ? ` style="${st}"` : ''}>${cv.html}</td>`;
        }).join('') + '</tr>';
    }
    if (!shown.length && rows.length && rec.query) html += `<tr><td class="empty" colspan="${cols.length + (showIdx ? 1 : 0) + (rowSel ? 1 : 0)}">Tidak ada baris yang cocok dengan "${esc(rec.query)}".</td></tr>`;
    html += '</tbody></table>';
    rec.cols = cols;
    rec.box.innerHTML = html;
    rec.box.classList.toggle('cellsel', cellSel);
    stickPinned(rec.box);
    if (rec.note) {
      rec.note.textContent = rec.query ? `${order.length} dari ${rows.length} baris cocok`
        : rows.length > shown.length ? `Menampilkan ${shown.length} dari ${rows.length} baris`
        : `${rows.length} baris × ${cols.length} kolom`;
    }
  }

  /* ======================================================================
   * Berkas unggahan
   * ==================================================================== */

  async function readUpload(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text;
    return {
      name: file.name, size: file.size, type: file.type, lastModified: file.lastModified,
      bytes, file, url: URL.createObjectURL(file),
      get text() { if (text === undefined) text = new TextDecoder().decode(bytes); return text; },
      json() { return JSON.parse(this.text); },
      csv(o) { return parseCSV(this.text, o); }
    };
  }
  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  /* ---------- Format gaya Streamlit: printf, preset, tanggal (Slak 1.3.1) ---------- */

  function printf(fmt, v) {
    const n = Number(v);
    return String(fmt).replace(/%([-+ 0,#']*)(\d+)?(?:\.(\d+))?([dfieEgGsx%])/g, (m, fl, w, p, t) => {
      if (t === '%') return '%';
      const group = /[,']/.test(fl);
      let s;
      if (t === 's') s = String(v);
      else if (t === 'd' || t === 'i') s = group ? nf(null).format(Math.round(n)) : String(Math.round(n));
      else if (t === 'f') {
        const d = p != null ? +p : 6;
        s = group ? nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(n) : n.toFixed(d);
      } else if (t === 'e' || t === 'E') { s = n.toExponential(p != null ? +p : 6); if (t === 'E') s = s.toUpperCase(); }
      else if (t === 'g' || t === 'G') s = String(+n.toPrecision(p != null ? Math.max(1, +p) : 6));
      else if (t === 'x') s = Math.round(n).toString(16);
      if (fl.includes('+') && n >= 0 && t !== 's') s = '+' + s;
      if (w && s.length < +w) s = fl.includes('-') ? s.padEnd(+w) : s.padStart(+w, fl.includes('0') ? '0' : ' ');
      return s;
    });
  }
  function fmtBytes(b) {
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, v = Math.abs(b);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (b < 0 ? '-' : '') + (i ? v.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) : v) + ' ' + u[i];
  }
  const CURRENCY = { dollar: 'USD', euro: 'EUR', yen: 'JPY' };
  function presetFmt(s) {
    const k = String(s).toLowerCase();
    if (k === 'plain') return v => String(v);
    if (k === 'localized') return v => nf(null).format(v);
    if (CURRENCY[k]) { const F = { style: 'currency', currency: CURRENCY[k], maximumFractionDigits: k === 'yen' ? 0 : 2 }; return v => nf(F).format(v); }
    if (k === 'accounting') return v => { const t = nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v)); return v < 0 ? '(' + t + ')' : t; };
    if (k === 'bytes') return fmtBytes;
    if (k === 'scientific') return v => v.toExponential(2);
    if (k === 'engineering') return v => {
      if (!v) return '0';
      const e = Math.floor(Math.log10(Math.abs(v)) / 3) * 3;
      return (v / Math.pow(10, e)).toFixed(2).replace(/\.?0+$/, '') + (e ? 'E' + e : '');
    };
    return null;
  }

  function toDateAny(v) {
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (isNum(v)) return new Date(v);
    if (typeof v === 'string' && v.trim()) {
      const s = v.trim();
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
      m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (m) { const d = new Date(1970, 0, 1); d.setHours(+m[1], +m[2], +(m[3] || 0)); return d; }
      const d = new Date(s);
      return isNaN(d) ? null : d;
    }
    return null;
  }
  function relTime(d) {
    const diff = (d.getTime() - Date.now()) / 1000;
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    let rtf;
    try { rtf = new Intl.RelativeTimeFormat(LOCALE || 'id', { numeric: 'auto' }); } catch (e) { return d.toLocaleString(LOCALE); }
    for (const [u, s] of units) if (Math.abs(diff) >= s || u === 'second') return rtf.format(Math.round(diff / s), u);
  }
  /** Format tanggal bergaya moment.js (dipakai Streamlit): "DD MMM YYYY", "HH:mm", "localized", "distance", "iso8601". */
  function fmtDateTok(v, f, kind) {
    const d = toDateAny(v);
    if (!d) return v == null ? '' : String(v);
    const p = (n, k) => String(n).padStart(k || 2, '0');
    if (!f || f === 'localized') {
      if (kind === 'time') return dtf({ hour: '2-digit', minute: '2-digit' }).format(d);
      if (kind === 'datetime') return dtf({ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
      return dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    }
    if (f === 'distance') return relTime(d);
    if (f === 'iso8601') return kind === 'time' ? `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : kind === 'date' ? isoDay(d) : d.toISOString();
    if (f === 'calendar') return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const L = LOCALE || undefined;
    return String(f).replace(/\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|hh|h|mm|m|ss|s|A|a/g, (t, lit) => {
      if (lit != null) return lit;
      switch (t) {
        case 'YYYY': return String(d.getFullYear());
        case 'YY': return p(d.getFullYear() % 100);
        case 'MMMM': return d.toLocaleDateString(L, { month: 'long' });
        case 'MMM': return d.toLocaleDateString(L, { month: 'short' });
        case 'MM': return p(d.getMonth() + 1);
        case 'M': return String(d.getMonth() + 1);
        case 'DD': return p(d.getDate());
        case 'D': return String(d.getDate());
        case 'dddd': return d.toLocaleDateString(L, { weekday: 'long' });
        case 'ddd': return d.toLocaleDateString(L, { weekday: 'short' });
        case 'HH': return p(d.getHours());
        case 'H': return String(d.getHours());
        case 'hh': return p(d.getHours() % 12 || 12);
        case 'h': return String(d.getHours() % 12 || 12);
        case 'mm': return p(d.getMinutes());
        case 'm': return String(d.getMinutes());
        case 'ss': return p(d.getSeconds());
        case 's': return String(d.getSeconds());
        case 'A': return d.getHours() < 12 ? 'AM' : 'PM';
        case 'a': return d.getHours() < 12 ? 'am' : 'pm';
      }
      return t;
    });
  }

  /* ---------- Grafik mini (sparkline) untuk metric dan kolom tabel ---------- */

  function sparkSVG(vals, kind, o) {
    o = o || {};
    const v = [].concat(vals || []).map(x => (x == null || x === '' ? null : Number(x))).map(x => (x == null || isNaN(x) ? null : x));
    const nums = v.filter(x => x != null);
    const W = o.width || 120, H = o.height || 30;
    if (!nums.length) return `<svg class="slak-spark" width="${W}" height="${H}"></svg>`;
    let lo = o.y_min != null ? o.y_min : minOf(nums), hi = o.y_max != null ? o.y_max : maxOf(nums);
    if (kind === 'bar') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (hi === lo) { hi += 1; lo -= 1; }
    const n = v.length, pad = 2;
    const X = i => n === 1 ? W / 2 : pad + i * (W - 2 * pad) / (n - 1);
    const Y = x => H - pad - (x - lo) / (hi - lo) * (H - 2 * pad);
    const col = o.color || 'var(--accent)';
    const f = x => x.toFixed(1);
    let body = '';
    if (kind === 'bar') {
      const bw = Math.max(1, (W - 2 * pad) / n - 1);
      v.forEach((x, i) => {
        if (x == null) return;
        const y0 = Y(Math.max(lo, 0)), y1 = Y(x);
        body += `<rect x="${f(pad + i * (W - 2 * pad) / n)}" y="${f(Math.min(y0, y1))}" width="${f(bw)}" height="${f(Math.max(1, Math.abs(y0 - y1)))}" fill="${col}" rx="1"/>`;
      });
    } else {
      const pts = v.map((x, i) => x == null ? null : [X(i), Y(x)]).filter(Boolean);
      const d = 'M' + pts.map(q => f(q[0]) + ',' + f(q[1])).join('L');
      if (kind === 'area') body += `<path d="${d}L${f(pts[pts.length - 1][0])},${H}L${f(pts[0][0])},${H}Z" fill="${col}" fill-opacity=".18"/>`;
      body += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    return `<svg class="slak-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${body}</svg>`;
  }

  /* ---------- Jenis kolom (st.column_config) untuk dataframe dan data_editor ---------- */

  const COL_WIDTH = { small: 80, medium: 180, large: 360 };
  const READONLY_TYPES = new Set(['progress', 'image', 'audio', 'video', 'line_chart', 'bar_chart', 'area_chart', 'button', 'markdown']);
  function colConf(cc, c, rows) {
    let x = cc ? cc[c] : undefined;
    if (x === null || x === false) return null;
    if (typeof x === 'string') x = { label: x };
    x = Object.assign({}, x || {});
    if (x.hidden) return null;
    let type = x.type || (x.options ? 'select' : inferType(rows, c));
    if (type === 'selectbox') type = 'select';
    x.type = type;
    if (x.label == null) x.label = c;
    if (x.min_value != null && x.min == null) x.min = x.min_value;
    if (x.max_value != null && x.max == null) x.max = x.max_value;
    return x;
  }
  function colStyle(cf) {
    let s = '';
    const w = COL_WIDTH[cf.width] || (isNum(cf.width) ? cf.width : null);
    if (w) s += `min-width:${w}px;max-width:${w}px;`;
    if (cf.alignment) s += `text-align:${cf.alignment};`;
    return s;
  }
  function linkText(url, disp) {
    if (!disp) return url;
    try {
      const m = String(url).match(new RegExp(disp));
      if (m && m.length > 1) return m[1];
    } catch (e) { /* bukan regex */ }
    return disp;
  }
  /** HTML isi sel untuk satu nilai menurut konfigurasi kolomnya. */
  function cellView(v, cf, o) {
    o = o || {};
    const t = cf.type;
    const nil = v == null || (typeof v === 'number' && isNaN(v)) || (v === '' && t !== 'text');
    if (nil && t !== 'checkbox') return { html: esc(o.placeholder != null ? o.placeholder : '—'), cls: 'nil' };
    switch (t) {
      case 'checkbox': return { html: v ? '✓' : '✗', cls: 'bool' };
      case 'number': return { html: esc(cf.format != null ? makeFmt(cf.format)(Number(v)) : isNum(v) ? fmtNum(v) : String(v)), cls: 'n' };
      case 'progress': {
        const lo = cf.min != null ? cf.min : 0, hi = cf.max != null ? cf.max : (isNum(v) && v <= 1 ? 1 : 100);
        const p = Math.max(0, Math.min(1, (Number(v) - lo) / ((hi - lo) || 1)));
        const txt = cf.format != null ? makeFmt(cf.format)(Number(v)) : (hi === 1 ? Math.round(Number(v) * 100) + '%' : fmtNum(Number(v)));
        return { html: `<span class="slak-cprog"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span class="slak-cprog-t">${esc(txt)}</span>`, cls: 'prog' };
      }
      case 'link': {
        const u = String(v);
        return { html: `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(linkText(u, cf.display_text))}</a>`, cls: 'link' };
      }
      case 'image': return { html: `<img src="${esc(safeUrl(String(v), true))}" alt="" loading="lazy">`, cls: 'img' };
      case 'audio': return { html: `<audio controls preload="none" src="${esc(safeUrl(String(v), true))}"></audio>`, cls: 'media' };
      case 'video': return { html: `<video controls preload="none" src="${esc(safeUrl(String(v), true))}"></video>`, cls: 'media' };
      case 'line_chart': case 'bar_chart': case 'area_chart':
        return { html: sparkSVG(Array.isArray(v) ? v : [v], t.split('_')[0], { y_min: cf.y_min, y_max: cf.y_max, width: 110, height: 26, color: cf.color }), cls: 'spark' };
      case 'list': case 'multiselect': {
        const arr = Array.isArray(v) ? v : String(v).split(',').map(s => s.trim()).filter(Boolean);
        return { html: arr.map(x => `<span class="slak-tag">${esc(fmtOpt(x))}</span>`).join(''), cls: 'tags' };
      }
      case 'json': return { html: esc(typeof v === 'string' ? v : JSON.stringify(v)), cls: 'obj' };
      case 'markdown': return { html: inline(esc(String(v))), cls: 'mdc' };
      case 'select': return { html: esc(cf.format_func ? cf.format_func(v) : fmtOpt(v)), cls: '' };
      case 'date': case 'datetime': case 'time':
        return { html: esc(fmtDateTok(v, cf.format, t)), cls: 'dt' };
      case 'button': return { html: `<button type="button" class="slak-cbtn" data-btn="1">${esc(cf.button_label || String(v))}</button>`, cls: 'btnc' };
      default:
        if (v instanceof Date) return { html: esc(fmtDate(v)), cls: '' };
        if (typeof v === 'boolean') return { html: v ? '✓' : '✗', cls: 'bool' };
        if (typeof v === 'object') return { html: esc(JSON.stringify(v)), cls: 'obj' };
        if (isNum(v)) return { html: esc(cf.format != null ? makeFmt(cf.format)(v) : fmtNum(v)), cls: 'n' };
        return { html: esc(String(v)), cls: '' };
    }
  }
  /** Kolom yang dipin: tempelkan di kiri dengan offset sesuai lebar kolom sebelumnya. */
  function stickPinned(box) {
    const head = box.querySelector('thead tr');
    if (!head) return;
    const pins = [...head.children].filter(th => th.classList.contains('pin'));
    if (!pins.length) return;
    let left = 0;
    const idxs = new Set();
    for (const th of head.children) {
      if (th.classList.contains('pin') || th.classList.contains('idx') || th.classList.contains('sel')) {
        th.style.left = left + 'px';
        th.classList.add('stick');
        idxs.add([...head.children].indexOf(th));
        left += th.offsetWidth;
      } else break;
    }
    box.querySelectorAll('tbody tr').forEach(tr => {
      let l = 0;
      [...tr.children].forEach((td, i) => { if (idxs.has(i)) { td.style.left = l + 'px'; td.classList.add('stick'); l += head.children[i].offsetWidth; } });
    });
  }

  /** Pembuat konfigurasi kolom bergaya st.column_config. */
  function colBuilder(type) {
    return (label, o) => {
      if (isPlainObj(label)) { o = label; label = undefined; }
      const x = Object.assign({}, o || {}, { type });
      if (label != null) x.label = label;
      return x;
    };
  }
  const column_config = {
    Column: (label, o) => { if (isPlainObj(label)) { o = label; label = undefined; } const x = Object.assign({}, o || {}); if (label != null) x.label = label; return x; },
    TextColumn: colBuilder('text'), MarkdownColumn: colBuilder('markdown'), NumberColumn: colBuilder('number'),
    CheckboxColumn: colBuilder('checkbox'), ButtonColumn: colBuilder('button'), SelectboxColumn: colBuilder('select'),
    MultiselectColumn: colBuilder('multiselect'), DatetimeColumn: colBuilder('datetime'), DateColumn: colBuilder('date'),
    TimeColumn: colBuilder('time'), JsonColumn: colBuilder('json'), ListColumn: colBuilder('list'), LinkColumn: colBuilder('link'),
    ImageColumn: colBuilder('image'), AudioColumn: colBuilder('audio'), VideoColumn: colBuilder('video'),
    AreaChartColumn: colBuilder('area_chart'), LineChartColumn: colBuilder('line_chart'), BarChartColumn: colBuilder('bar_chart'),
    ProgressColumn: colBuilder('progress')
  };

  /* ---------- Pemuat pustaka opsional dari internet (Plotly, ECharts, Mermaid, Graphviz, ikon) ---------- */

  const LIB_URLS = {
    plotly: 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js',
    echarts: 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js',
    mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js',
    graphviz: 'https://cdn.jsdelivr.net/npm/@viz-js/viz@3.11.0/lib/viz-standalone.js',
    deckgl: 'https://cdn.jsdelivr.net/npm/deck.gl@9.1.15/dist.min.js',
    deckgl_json: 'https://cdn.jsdelivr.net/npm/@deck.gl/json@9.1.15/dist.min.js',
    material_icons: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block'
  };
  const LIB_GLOBAL = { plotly: 'Plotly', echarts: 'echarts', mermaid: 'mermaid', graphviz: 'Viz', deckgl: 'deck' };
  const LIB_NAME = { plotly: 'Plotly', echarts: 'ECharts', mermaid: 'Mermaid', graphviz: 'Graphviz (viz.js)', deckgl: 'deck.gl' };
  const LIBS = {};
  /* ======================================================================
   * Pemuat berkas lokal (Slak 1.3.2): read_csv("data.csv") tetap jalan saat
   * HTML dibuka dengan klik dua kali. Urutan pencarian:
   *   1. Slak.files / SLAK_FILES  (berkas data yang dibungkus: data.csv.js)
   *   2. <script data-file="data.csv"> atau <script id="data.csv" type="text/csv"> di halaman
   *   3. Slak Studio (folder proyek)
   *   4. halaman file://  → muat otomatis <script src="data.csv.js"> bila ada
   *   5. fetch biasa (hosting / server lokal)
   *   6. halaman file://  → berkas yang pernah dipilih (disimpan di browser), atau tombol pilih berkas
   * ==================================================================== */
  const isFileProto = () => typeof location !== 'undefined' && location.protocol === 'file:';
  const shortName = n => String(n).split(/[?#]/)[0].split('/').pop();
  function fileVal(v) {
    if (v == null) return null;
    if (v instanceof Uint8Array) return v;
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (typeof v === 'string') return new TextEncoder().encode(v);
    if (typeof v === 'object' && typeof v.base64 === 'string') return b64ToBytes(v.base64);
    if (typeof v === 'object' && typeof v.text === 'string') return new TextEncoder().encode(v.text);
    return null;
  }
  function b64ToBytes(b64) {
    const bin = atob(String(b64).replace(/\s+/g, '')), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function registry(name) {
    const base = String(name).split(/[?#]/)[0], short = shortName(name);
    for (const reg of [Slak.files, global.SLAK_FILES]) {
      if (!reg) continue;
      if (reg[base] != null) return fileVal(reg[base]);
      if (reg[short] != null) return fileVal(reg[short]);
    }
    return null;
  }
  function pageEmbedded(name) {
    if (typeof document === 'undefined') return null;
    const base = String(name).split(/[?#]/)[0], short = shortName(name);
    for (const el of document.querySelectorAll('script[data-file],script[data-name],script[id]')) {
      const n = el.getAttribute('data-file') || el.getAttribute('data-name') || (/^(text\/(csv|plain|tab-separated-values)|application\/(json|octet-stream|base64))$/i.test(el.type) ? el.id : null);
      if (!n || (n !== base && n !== short)) continue;
      if ((el.getAttribute('data-encoding') || '').toLowerCase() === 'base64' || /base64/i.test(el.type)) return b64ToBytes(el.textContent);
      return new TextEncoder().encode(el.textContent.replace(/^\r?\n/, ''));
    }
    return null;
  }
  const WRAP_TRIED = new Map();
  function loadWrapped(name) {
    const src = String(name).split(/[?#]/)[0] + '.js';
    if (!WRAP_TRIED.has(src)) WRAP_TRIED.set(src, new Promise(res => {
      const sc = document.createElement('script');
      sc.src = src;
      sc.onload = () => res(true); sc.onerror = () => { sc.remove(); res(false); };
      document.head.append(sc);
    }));
    return WRAP_TRIED.get(src).then(() => registry(name));
  }
  /* --- berkas yang dipilih pengguna, diingat di IndexedDB --- */
  const PICK_DB = 'slak-berkas';
  const pickKey = name => (typeof location !== 'undefined' ? location.pathname : '') + '|' + shortName(name);
  function pickDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(PICK_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function pickGet(name) {
    try {
      const d = await pickDB();
      return await new Promise(res => { const r = d.transaction('f').objectStore('f').get(pickKey(name)); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
    } catch (e) { return null; }
  }
  async function pickPut(name, rec) {
    try {
      const d = await pickDB();
      await new Promise(res => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(rec, pickKey(name)); t.oncomplete = res; t.onerror = res; });
    } catch (e) { /* penyimpanan ditolak: tetap dipakai untuk sesi ini */ }
  }
  const PICK_SESSION = new Map(), PICK_USED = new Set();
  let pickQueue = Promise.resolve();
  function askFile(name, ao) {
    ao = ao || {};
    const run = () => new Promise((resolve, reject) => {
      const short = shortName(name);
      const ext = (short.match(/\.[^.]+$/) || [''])[0];
      const wrap = h('div', { class: 'slak-pick-wrap', role: 'dialog', 'aria-modal': 'true' });
      const inp = h('input', { type: 'file', accept: ao.accept || ext || '', multiple: true, hidden: true });
      const btn = h('button', { type: 'button', class: 'slak-pick-btn' }, ao.button || ('📂 Pilih ' + short));
      const no = h('button', { type: 'button', class: 'slak-pick-no' }, 'Batal');
      const card = h('div', { class: 'slak-pick' },
        h('div', { class: 'slak-pick-t' }, ao.title || 'Berkas data dibutuhkan'),
        ao.message ? h('p', { html: ao.message }) : h('p', {}, 'Halaman ini dibuka langsung dari komputer, jadi browser tidak mengizinkan Slak membaca ', h('b', {}, short), ' sendiri. Pilih berkasnya sekali, Slak akan mengingatnya di browser ini.'),
        h('div', { class: 'slak-pick-row' }, btn, no),
        ao.tip === false ? null : h('p', { class: 'slak-pick-tip' }, ao.tip || 'Supaya tidak perlu memilih lagi (misalnya saat dibuka di komputer lain), bungkus datanya menjadi ' + short + '.js lewat Slak Studio (Alat → Bungkus data) atau bungkus.html, lalu taruh di folder yang sama.'),
        inp);
      wrap.append(card);
      (document.body || document.documentElement).append(wrap);
      btn.focus();
      const close = () => wrap.remove();
      btn.addEventListener('click', () => inp.click());
      no.addEventListener('click', () => { close(); reject(new Error('dibatalkan')); });
      inp.addEventListener('change', async () => {
        const fs = [...inp.files];
        if (!fs.length) return;
        let mine = fs.find(f => f.name === short) || fs[0];
        for (const f of fs) {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const key = f === mine ? short : f.name;
          PICK_SESSION.set(key, bytes);
          pickPut(key, { bytes, file: f.name, size: f.size, t: Date.now() });
        }
        close();
        resolve(PICK_SESSION.get(short));
      });
    });
    const p = pickQueue.then(run, run);
    pickQueue = p.catch(() => {});
    return p;
  }
  function pickChip() {
    if (typeof document === 'undefined' || !PICK_USED.size) return;
    let chip = document.querySelector('.slak-pick-chip');
    if (!chip) {
      chip = h('div', { class: 'slak-pick-chip' });
      chip.addEventListener('click', async e => {
        const b = e.target.closest('button[data-f]');
        if (!b) return;
        try { await askFile(b.dataset.f); location.reload(); } catch (err) { /* batal */ }
      });
      document.body.append(chip);
    }
    chip.innerHTML = '📂 ' + [...PICK_USED].map(n => `${esc(n)} <button type="button" data-f="${esc(n)}" title="Pilih berkas lain">ganti</button>`).join(' · ');
  }
  /** Muat berkas sebagai Uint8Array. o.error(name, why) membuat pesan galat yang ramah. */
  async function loadFile(name, o) {
    o = o || {};
    name = String(name);
    const mkErr = (why) => o.error ? o.error(name, why) : new Error(`Berkas "${name}" tidak bisa dibaca${why ? ' (' + why + ')' : ''}.`);
    const remote = /^(https?:|data:|blob:)/i.test(name);
    if (!remote) {
      const r = registry(name) || pageEmbedded(name);
      if (r) return r;
      if (typeof Slak.resolveFile === 'function') {
        const x = await Slak.resolveFile(name, { quiet: !!o.local_only });
        if (x != null) return typeof x === 'string' ? new TextEncoder().encode(x) : new Uint8Array(x);
      }
      if (isFileProto() && typeof document !== 'undefined' && !/^[a-z][\w-]*:/i.test(name)) {
        const w = await loadWrapped(name);
        if (w) return w;
      }
    }
    if (o.local_only) return null;
    let res, why;
    try { res = await fetch(name); } catch (e) { why = e.message; }
    if (res && res.ok) return new Uint8Array(await res.arrayBuffer());
    if (res && !why) why = 'HTTP ' + res.status;
    if (!remote && isFileProto() && typeof document !== 'undefined' && o.pick !== false) {
      const short = shortName(name);
      let b = PICK_SESSION.get(short);
      if (!b) { const rec = await pickGet(name); if (rec && rec.bytes) { b = rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes); PICK_SESSION.set(short, b); } }
      if (!b) { try { b = await askFile(name); } catch (e) { throw mkErr('pemilihan berkas dibatalkan'); } }
      PICK_USED.add(short);
      pickChip();
      return b;
    }
    throw mkErr(why);
  }
  /** Bungkus berkas menjadi teks JavaScript (isi berkas "nama.csv.js"). */
  function wrapFile(name, bytes) {
    const short = shortName(name);
    const head = `/* Dibungkus Slak ${VERSION}: data untuk read_csv/read_excel/sqlite("${short}"). Taruh berkas ini di folder yang sama dengan halaman. */\n`;
    const set = v => `${head}(self.SLAK_FILES = self.SLAK_FILES || {})[${JSON.stringify(short)}] = ${v};\n`;
    if (typeof bytes === 'string') return set(JSON.stringify(bytes));
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const text = /\.(csv|tsv|txt|json|geojson|md)$/i.test(short);
    if (text) {
      try { return set(JSON.stringify(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); } catch (e) { /* bukan UTF-8: simpan sebagai base64 */ }
    }
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return set(`{ base64: "${btoa(bin)}" }`);
  }

  function loadLib(name) {
    if (LIB_GLOBAL[name] && global[LIB_GLOBAL[name]]) return Promise.resolve(global[LIB_GLOBAL[name]]);
    if (LIBS[name]) return LIBS[name];
    const url = (Slak.lib_urls && Slak.lib_urls[name]) || LIB_URLS[name];
    LIBS[name] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = () => res(global[LIB_GLOBAL[name]]);
      s.onerror = () => { delete LIBS[name]; rej(new Error(`${LIB_NAME[name] || name} belum bisa dimuat. Fungsi ini butuh internet saat pertama dipakai (pustaka diunduh dari ${url.split('/')[2] || url}). Periksa koneksi lalu jalankan ulang.`)); };
      document.head.append(s);
    });
    return LIBS[name];
  }
  let iconFontAsked = false;
  function useIconFont() {
    if (iconFontAsked || typeof document === 'undefined') return;
    iconFontAsked = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = (Slak.lib_urls && Slak.lib_urls.material_icons) || LIB_URLS.material_icons;
    l.onload = () => {
      if (!document.fonts || !document.fonts.load) { document.documentElement.classList.add('slak-mi-ok'); return; }
      document.fonts.load('20px "Material Symbols Rounded"', 'home').then(f => { if (f && f.length) document.documentElement.classList.add('slak-mi-ok'); }, () => {});
    };
    document.head.append(l);
  }
  /* ======================================================================
   * Emoji dengan nama (Slak 1.4): ":smile:" (nama Streamlit), ":kantung_uang:"
   * (nama resmi Indonesia, Unicode CLDR), ":uang:" (alias pendek). Semua luring.
   * ==================================================================== */
  /*__EMOJI_DATA__*/
  /* Data emoji: nama Streamlit (emojilib 2.4.0, MIT), nama Indonesia (Unicode CLDR, Unicode License v3),
     alias pendek Slak (MIT). Ikon: Material Symbols Rounded (Google, Apache 2.0). Lihat folder Lisensi/. */
  const EMOJI_EN = "grinning=😀,grimacing=😬,grin=😁,joy=😂,rofl=🤣,partying=🥳,smiley=😃,smile=😄,sweat_smile=😅,laughing=😆,innocent=😇,wink=😉,blush=😊,slightly_smiling_face=🙂,upside_down_face=🙃,relaxed=☺️,yum=😋,relieved=😌,heart_eyes=😍,smiling_face_with_three_hearts=🥰,kissing_heart=😘,kissing=😗,kissing_smiling_eyes=😙,kissing_closed_eyes=😚,stuck_out_tongue_winking_eye=😜,zany=🤪,raised_eyebrow=🤨,monocle=🧐,stuck_out_tongue_closed_eyes=😝,stuck_out_tongue=😛,money_mouth_face=🤑,nerd_face=🤓,sunglasses=😎,star_struck=🤩,clown_face=🤡,cowboy_hat_face=🤠,hugs=🤗,smirk=😏,no_mouth=😶,neutral_face=😐,expressionless=😑,unamused=😒,roll_eyes=🙄,thinking=🤔,lying_face=🤥,hand_over_mouth=🤭,shushing=🤫,symbols_over_mouth=🤬,exploding_head=🤯,flushed=😳,disappointed=😞,worried=😟,angry=😠,rage=😡,pensive=😔,confused=😕,slightly_frowning_face=🙁,frowning_face=☹,persevere=😣,confounded=😖,tired_face=😫,weary=😩,pleading=🥺,triumph=😤,open_mouth=😮,scream=😱,fearful=😨,cold_sweat=😰,hushed=😯,frowning=😦,anguished=😧,cry=😢,disappointed_relieved=😥,drooling_face=🤤,sleepy=😪,sweat=😓,hot=🥵,cold=🥶,sob=😭,dizzy_face=😵,astonished=😲,zipper_mouth_face=🤐,nauseated_face=🤢,sneezing_face=🤧,vomiting=🤮,mask=😷,face_with_thermometer=🤒,face_with_head_bandage=🤕,woozy=🥴,sleeping=😴,zzz=💤,poop=💩,smiling_imp=😈,imp=👿,japanese_ogre=👹,japanese_goblin=👺,skull=💀,ghost=👻,alien=👽,robot=🤖,smiley_cat=😺,smile_cat=😸,joy_cat=😹,heart_eyes_cat=😻,smirk_cat=😼,kissing_cat=😽,scream_cat=🙀,crying_cat_face=😿,pouting_cat=😾,palms_up=🤲,raised_hands=🙌,clap=👏,wave=👋,call_me_hand=🤙,+1=👍,-1=👎,facepunch=👊,fist=✊,fist_left=🤛,fist_right=🤜,v=✌,ok_hand=👌,raised_hand=✋,raised_back_of_hand=🤚,open_hands=👐,muscle=💪,pray=🙏,foot=🦶,leg=🦵,handshake=🤝,point_up=☝,point_up_2=👆,point_down=👇,point_left=👈,point_right=👉,fu=🖕,raised_hand_with_fingers_splayed=🖐,love_you=🤟,metal=🤘,crossed_fingers=🤞,vulcan_salute=🖖,writing_hand=✍,selfie=🤳,nail_care=💅,lips=👄,tooth=🦷,tongue=👅,ear=👂,nose=👃,eye=👁,eyes=👀,brain=🧠,bust_in_silhouette=👤,busts_in_silhouette=👥,speaking_head=🗣,baby=👶,child=🧒,boy=👦,girl=👧,adult=🧑,man=👨,woman=👩,blonde_woman=👱‍♀️,blonde_man=👱,bearded_person=🧔,older_adult=🧓,older_man=👴,older_woman=👵,man_with_gua_pi_mao=👲,woman_with_headscarf=🧕,woman_with_turban=👳‍♀️,man_with_turban=👳,policewoman=👮‍♀️,policeman=👮,construction_worker_woman=👷‍♀️,construction_worker_man=👷,guardswoman=💂‍♀️,guardsman=💂,female_detective=🕵️‍♀️,male_detective=🕵,woman_health_worker=👩‍⚕️,man_health_worker=👨‍⚕️,woman_farmer=👩‍🌾,man_farmer=👨‍🌾,woman_cook=👩‍🍳,man_cook=👨‍🍳,woman_student=👩‍🎓,man_student=👨‍🎓,woman_singer=👩‍🎤,man_singer=👨‍🎤,woman_teacher=👩‍🏫,man_teacher=👨‍🏫,woman_factory_worker=👩‍🏭,man_factory_worker=👨‍🏭,woman_technologist=👩‍💻,man_technologist=👨‍💻,woman_office_worker=👩‍💼,man_office_worker=👨‍💼,woman_mechanic=👩‍🔧,man_mechanic=👨‍🔧,woman_scientist=👩‍🔬,man_scientist=👨‍🔬,woman_artist=👩‍🎨,man_artist=👨‍🎨,woman_firefighter=👩‍🚒,man_firefighter=👨‍🚒,woman_pilot=👩‍✈️,man_pilot=👨‍✈️,woman_astronaut=👩‍🚀,man_astronaut=👨‍🚀,woman_judge=👩‍⚖️,man_judge=👨‍⚖️,woman_superhero=🦸‍♀️,man_superhero=🦸‍♂️,woman_supervillain=🦹‍♀️,man_supervillain=🦹‍♂️,mrs_claus=🤶,santa=🎅,sorceress=🧙‍♀️,wizard=🧙‍♂️,woman_elf=🧝‍♀️,man_elf=🧝‍♂️,woman_vampire=🧛‍♀️,man_vampire=🧛‍♂️,woman_zombie=🧟‍♀️,man_zombie=🧟‍♂️,woman_genie=🧞‍♀️,man_genie=🧞‍♂️,mermaid=🧜‍♀️,merman=🧜‍♂️,woman_fairy=🧚‍♀️,man_fairy=🧚‍♂️,angel=👼,pregnant_woman=🤰,breastfeeding=🤱,princess=👸,prince=🤴,bride_with_veil=👰,man_in_tuxedo=🤵,running_woman=🏃‍♀️,running_man=🏃,walking_woman=🚶‍♀️,walking_man=🚶,dancer=💃,man_dancing=🕺,dancing_women=👯,dancing_men=👯‍♂️,couple=👫,two_men_holding_hands=👬,two_women_holding_hands=👭,bowing_woman=🙇‍♀️,bowing_man=🙇,man_facepalming=🤦‍♂️,woman_facepalming=🤦‍♀️,woman_shrugging=🤷,man_shrugging=🤷‍♂️,tipping_hand_woman=💁,tipping_hand_man=💁‍♂️,no_good_woman=🙅,no_good_man=🙅‍♂️,ok_woman=🙆,ok_man=🙆‍♂️,raising_hand_woman=🙋,raising_hand_man=🙋‍♂️,pouting_woman=🙎,pouting_man=🙎‍♂️,frowning_woman=🙍,frowning_man=🙍‍♂️,haircut_woman=💇,haircut_man=💇‍♂️,massage_woman=💆,massage_man=💆‍♂️,woman_in_steamy_room=🧖‍♀️,man_in_steamy_room=🧖‍♂️,couple_with_heart_woman_man=💑,couple_with_heart_woman_woman=👩‍❤️‍👩,couple_with_heart_man_man=👨‍❤️‍👨,couplekiss_man_woman=💏,couplekiss_woman_woman=👩‍❤️‍💋‍👩,couplekiss_man_man=👨‍❤️‍💋‍👨,family_man_woman_boy=👪,family_man_woman_girl=👨‍👩‍👧,family_man_woman_girl_boy=👨‍👩‍👧‍👦,family_man_woman_boy_boy=👨‍👩‍👦‍👦,family_man_woman_girl_girl=👨‍👩‍👧‍👧,family_woman_woman_boy=👩‍👩‍👦,family_woman_woman_girl=👩‍👩‍👧,family_woman_woman_girl_boy=👩‍👩‍👧‍👦,family_woman_woman_boy_boy=👩‍👩‍👦‍👦,family_woman_woman_girl_girl=👩‍👩‍👧‍👧,family_man_man_boy=👨‍👨‍👦,family_man_man_girl=👨‍👨‍👧,family_man_man_girl_boy=👨‍👨‍👧‍👦,family_man_man_boy_boy=👨‍👨‍👦‍👦,family_man_man_girl_girl=👨‍👨‍👧‍👧,family_woman_boy=👩‍👦,family_woman_girl=👩‍👧,family_woman_girl_boy=👩‍👧‍👦,family_woman_boy_boy=👩‍👦‍👦,family_woman_girl_girl=👩‍👧‍👧,family_man_boy=👨‍👦,family_man_girl=👨‍👧,family_man_girl_boy=👨‍👧‍👦,family_man_boy_boy=👨‍👦‍👦,family_man_girl_girl=👨‍👧‍👧,yarn=🧶,thread=🧵,coat=🧥,labcoat=🥼,womans_clothes=👚,tshirt=👕,jeans=👖,necktie=👔,dress=👗,bikini=👙,kimono=👘,lipstick=💄,kiss=💋,footprints=👣,flat_shoe=🥿,high_heel=👠,sandal=👡,boot=👢,mans_shoe=👞,athletic_shoe=👟,hiking_boot=🥾,socks=🧦,gloves=🧤,scarf=🧣,womans_hat=👒,tophat=🎩,billed_hat=🧢,rescue_worker_helmet=⛑,mortar_board=🎓,crown=👑,school_satchel=🎒,luggage=🧳,pouch=👝,purse=👛,handbag=👜,briefcase=💼,eyeglasses=👓,dark_sunglasses=🕶,goggles=🥽,ring=💍,closed_umbrella=🌂,dog=🐶,cat=🐱,mouse=🐭,hamster=🐹,rabbit=🐰,fox_face=🦊,bear=🐻,panda_face=🐼,koala=🐨,tiger=🐯,lion=🦁,cow=🐮,pig=🐷,pig_nose=🐽,frog=🐸,squid=🦑,octopus=🐙,shrimp=🦐,monkey_face=🐵,gorilla=🦍,see_no_evil=🙈,hear_no_evil=🙉,speak_no_evil=🙊,monkey=🐒,chicken=🐔,penguin=🐧,bird=🐦,baby_chick=🐤,hatching_chick=🐣,hatched_chick=🐥,duck=🦆,eagle=🦅,owl=🦉,bat=🦇,wolf=🐺,boar=🐗,horse=🐴,unicorn=🦄,honeybee=🐝,bug=🐛,butterfly=🦋,snail=🐌,beetle=🐞,ant=🐜,grasshopper=🦗,spider=🕷,scorpion=🦂,crab=🦀,snake=🐍,lizard=🦎,t-rex=🦖,sauropod=🦕,turtle=🐢,tropical_fish=🐠,fish=🐟,blowfish=🐡,dolphin=🐬,shark=🦈,whale=🐳,whale2=🐋,crocodile=🐊,leopard=🐆,zebra=🦓,tiger2=🐅,water_buffalo=🐃,ox=🐂,cow2=🐄,deer=🦌,dromedary_camel=🐪,camel=🐫,giraffe=🦒,elephant=🐘,rhinoceros=🦏,goat=🐐,ram=🐏,sheep=🐑,racehorse=🐎,pig2=🐖,rat=🐀,mouse2=🐁,rooster=🐓,turkey=🦃,dove=🕊,dog2=🐕,poodle=🐩,cat2=🐈,rabbit2=🐇,chipmunk=🐿,hedgehog=🦔,raccoon=🦝,llama=🦙,hippopotamus=🦛,kangaroo=🦘,badger=🦡,swan=🦢,peacock=🦚,parrot=🦜,lobster=🦞,mosquito=🦟,paw_prints=🐾,dragon=🐉,dragon_face=🐲,cactus=🌵,christmas_tree=🎄,evergreen_tree=🌲,deciduous_tree=🌳,palm_tree=🌴,seedling=🌱,herb=🌿,shamrock=☘,four_leaf_clover=🍀,bamboo=🎍,tanabata_tree=🎋,leaves=🍃,fallen_leaf=🍂,maple_leaf=🍁,ear_of_rice=🌾,hibiscus=🌺,sunflower=🌻,rose=🌹,wilted_flower=🥀,tulip=🌷,blossom=🌼,cherry_blossom=🌸,bouquet=💐,mushroom=🍄,chestnut=🌰,jack_o_lantern=🎃,shell=🐚,spider_web=🕸,earth_americas=🌎,earth_africa=🌍,earth_asia=🌏,full_moon=🌕,waning_gibbous_moon=🌖,last_quarter_moon=🌗,waning_crescent_moon=🌘,new_moon=🌑,waxing_crescent_moon=🌒,first_quarter_moon=🌓,waxing_gibbous_moon=🌔,new_moon_with_face=🌚,full_moon_with_face=🌝,first_quarter_moon_with_face=🌛,last_quarter_moon_with_face=🌜,sun_with_face=🌞,crescent_moon=🌙,star=⭐,star2=🌟,dizzy=💫,sparkles=✨,comet=☄,sunny=☀️,sun_behind_small_cloud=🌤,partly_sunny=⛅,sun_behind_large_cloud=🌥,sun_behind_rain_cloud=🌦,cloud=☁️,cloud_with_rain=🌧,cloud_with_lightning_and_rain=⛈,cloud_with_lightning=🌩,zap=⚡,fire=🔥,boom=💥,snowflake=❄️,cloud_with_snow=🌨,snowman=⛄,snowman_with_snow=☃,wind_face=🌬,dash=💨,tornado=🌪,fog=🌫,open_umbrella=☂,umbrella=☔,droplet=💧,sweat_drops=💦,ocean=🌊,green_apple=🍏,apple=🍎,pear=🍐,tangerine=🍊,lemon=🍋,banana=🍌,watermelon=🍉,grapes=🍇,strawberry=🍓,melon=🍈,cherries=🍒,peach=🍑,pineapple=🍍,coconut=🥥,kiwi_fruit=🥝,mango=🥭,avocado=🥑,broccoli=🥦,tomato=🍅,eggplant=🍆,cucumber=🥒,carrot=🥕,hot_pepper=🌶,potato=🥔,corn=🌽,leafy_greens=🥬,sweet_potato=🍠,peanuts=🥜,honey_pot=🍯,croissant=🥐,bread=🍞,baguette_bread=🥖,bagel=🥯,pretzel=🥨,cheese=🧀,egg=🥚,bacon=🥓,steak=🥩,pancakes=🥞,poultry_leg=🍗,meat_on_bone=🍖,bone=🦴,fried_shrimp=🍤,fried_egg=🍳,hamburger=🍔,fries=🍟,stuffed_flatbread=🥙,hotdog=🌭,pizza=🍕,sandwich=🥪,canned_food=🥫,spaghetti=🍝,taco=🌮,burrito=🌯,green_salad=🥗,shallow_pan_of_food=🥘,ramen=🍜,stew=🍲,fish_cake=🍥,fortune_cookie=🥠,sushi=🍣,bento=🍱,curry=🍛,rice_ball=🍙,rice=🍚,rice_cracker=🍘,oden=🍢,dango=🍡,shaved_ice=🍧,ice_cream=🍨,icecream=🍦,pie=🥧,cake=🍰,cupcake=🧁,moon_cake=🥮,birthday=🎂,custard=🍮,candy=🍬,lollipop=🍭,chocolate_bar=🍫,popcorn=🍿,dumpling=🥟,doughnut=🍩,cookie=🍪,milk_glass=🥛,beer=🍺,beers=🍻,clinking_glasses=🥂,wine_glass=🍷,tumbler_glass=🥃,cocktail=🍸,tropical_drink=🍹,champagne=🍾,sake=🍶,tea=🍵,cup_with_straw=🥤,coffee=☕,baby_bottle=🍼,salt=🧂,spoon=🥄,fork_and_knife=🍴,plate_with_cutlery=🍽,bowl_with_spoon=🥣,takeout_box=🥡,chopsticks=🥢,soccer=⚽,basketball=🏀,football=🏈,baseball=⚾,softball=🥎,tennis=🎾,volleyball=🏐,rugby_football=🏉,flying_disc=🥏,8ball=🎱,golf=⛳,golfing_woman=🏌️‍♀️,golfing_man=🏌,ping_pong=🏓,badminton=🏸,goal_net=🥅,ice_hockey=🏒,field_hockey=🏑,lacrosse=🥍,cricket=🏏,ski=🎿,skier=⛷,snowboarder=🏂,person_fencing=🤺,women_wrestling=🤼‍♀️,men_wrestling=🤼‍♂️,woman_cartwheeling=🤸‍♀️,man_cartwheeling=🤸‍♂️,woman_playing_handball=🤾‍♀️,man_playing_handball=🤾‍♂️,ice_skate=⛸,curling_stone=🥌,skateboard=🛹,sled=🛷,bow_and_arrow=🏹,fishing_pole_and_fish=🎣,boxing_glove=🥊,martial_arts_uniform=🥋,rowing_woman=🚣‍♀️,rowing_man=🚣,climbing_woman=🧗‍♀️,climbing_man=🧗‍♂️,swimming_woman=🏊‍♀️,swimming_man=🏊,woman_playing_water_polo=🤽‍♀️,man_playing_water_polo=🤽‍♂️,woman_in_lotus_position=🧘‍♀️,man_in_lotus_position=🧘‍♂️,surfing_woman=🏄‍♀️,surfing_man=🏄,bath=🛀,basketball_woman=⛹️‍♀️,basketball_man=⛹,weight_lifting_woman=🏋️‍♀️,weight_lifting_man=🏋,biking_woman=🚴‍♀️,biking_man=🚴,mountain_biking_woman=🚵‍♀️,mountain_biking_man=🚵,horse_racing=🏇,business_suit_levitating=🕴,trophy=🏆,running_shirt_with_sash=🎽,medal_sports=🏅,medal_military=🎖,1st_place_medal=🥇,2nd_place_medal=🥈,3rd_place_medal=🥉,reminder_ribbon=🎗,rosette=🏵,ticket=🎫,tickets=🎟,performing_arts=🎭,art=🎨,circus_tent=🎪,woman_juggling=🤹‍♀️,man_juggling=🤹‍♂️,microphone=🎤,headphones=🎧,musical_score=🎼,musical_keyboard=🎹,drum=🥁,saxophone=🎷,trumpet=🎺,guitar=🎸,violin=🎻,clapper=🎬,video_game=🎮,space_invader=👾,dart=🎯,game_die=🎲,chess_pawn=♟,slot_machine=🎰,jigsaw=🧩,bowling=🎳,red_car=🚗,taxi=🚕,blue_car=🚙,bus=🚌,trolleybus=🚎,racing_car=🏎,police_car=🚓,ambulance=🚑,fire_engine=🚒,minibus=🚐,truck=🚚,articulated_lorry=🚛,tractor=🚜,kick_scooter=🛴,motorcycle=🏍,bike=🚲,motor_scooter=🛵,rotating_light=🚨,oncoming_police_car=🚔,oncoming_bus=🚍,oncoming_automobile=🚘,oncoming_taxi=🚖,aerial_tramway=🚡,mountain_cableway=🚠,suspension_railway=🚟,railway_car=🚃,train=🚋,monorail=🚝,bullettrain_side=🚄,bullettrain_front=🚅,light_rail=🚈,mountain_railway=🚞,steam_locomotive=🚂,train2=🚆,metro=🚇,tram=🚊,station=🚉,flying_saucer=🛸,helicopter=🚁,small_airplane=🛩,airplane=✈️,flight_departure=🛫,flight_arrival=🛬,sailboat=⛵,motor_boat=🛥,speedboat=🚤,ferry=⛴,passenger_ship=🛳,rocket=🚀,artificial_satellite=🛰,seat=💺,canoe=🛶,anchor=⚓,construction=🚧,fuelpump=⛽,busstop=🚏,vertical_traffic_light=🚦,traffic_light=🚥,checkered_flag=🏁,ship=🚢,ferris_wheel=🎡,roller_coaster=🎢,carousel_horse=🎠,building_construction=🏗,foggy=🌁,tokyo_tower=🗼,factory=🏭,fountain=⛲,rice_scene=🎑,mountain=⛰,mountain_snow=🏔,mount_fuji=🗻,volcano=🌋,japan=🗾,camping=🏕,tent=⛺,national_park=🏞,motorway=🛣,railway_track=🛤,sunrise=🌅,sunrise_over_mountains=🌄,desert=🏜,beach_umbrella=🏖,desert_island=🏝,city_sunrise=🌇,city_sunset=🌆,cityscape=🏙,night_with_stars=🌃,bridge_at_night=🌉,milky_way=🌌,stars=🌠,sparkler=🎇,fireworks=🎆,rainbow=🌈,houses=🏘,european_castle=🏰,japanese_castle=🏯,stadium=🏟,statue_of_liberty=🗽,house=🏠,house_with_garden=🏡,derelict_house=🏚,office=🏢,department_store=🏬,post_office=🏣,european_post_office=🏤,hospital=🏥,bank=🏦,hotel=🏨,convenience_store=🏪,school=🏫,love_hotel=🏩,wedding=💒,classical_building=🏛,church=⛪,mosque=🕌,synagogue=🕍,kaaba=🕋,shinto_shrine=⛩,watch=⌚,iphone=📱,calling=📲,computer=💻,keyboard=⌨,desktop_computer=🖥,printer=🖨,computer_mouse=🖱,trackball=🖲,joystick=🕹,clamp=🗜,minidisc=💽,floppy_disk=💾,cd=💿,dvd=📀,vhs=📼,camera=📷,camera_flash=📸,video_camera=📹,movie_camera=🎥,film_projector=📽,film_strip=🎞,telephone_receiver=📞,phone=☎️,pager=📟,fax=📠,tv=📺,radio=📻,studio_microphone=🎙,level_slider=🎚,control_knobs=🎛,compass=🧭,stopwatch=⏱,timer_clock=⏲,alarm_clock=⏰,mantelpiece_clock=🕰,hourglass_flowing_sand=⏳,hourglass=⌛,satellite=📡,battery=🔋,electric_plug=🔌,bulb=💡,flashlight=🔦,candle=🕯,fire_extinguisher=🧯,wastebasket=🗑,oil_drum=🛢,money_with_wings=💸,dollar=💵,yen=💴,euro=💶,pound=💷,moneybag=💰,credit_card=💳,gem=💎,balance_scale=⚖,toolbox=🧰,wrench=🔧,hammer=🔨,hammer_and_pick=⚒,hammer_and_wrench=🛠,pick=⛏,nut_and_bolt=🔩,gear=⚙,brick=🧱,chains=⛓,magnet=🧲,gun=🔫,bomb=💣,firecracker=🧨,hocho=🔪,dagger=🗡,crossed_swords=⚔,shield=🛡,smoking=🚬,skull_and_crossbones=☠,coffin=⚰,funeral_urn=⚱,amphora=🏺,crystal_ball=🔮,prayer_beads=📿,nazar_amulet=🧿,barber=💈,alembic=⚗,telescope=🔭,microscope=🔬,hole=🕳,pill=💊,syringe=💉,dna=🧬,microbe=🦠,petri_dish=🧫,test_tube=🧪,thermometer=🌡,broom=🧹,basket=🧺,toilet_paper=🧻,label=🏷,bookmark=🔖,toilet=🚽,shower=🚿,bathtub=🛁,soap=🧼,sponge=🧽,lotion_bottle=🧴,key=🔑,old_key=🗝,couch_and_lamp=🛋,sleeping_bed=🛌,bed=🛏,door=🚪,bellhop_bell=🛎,teddy_bear=🧸,framed_picture=🖼,world_map=🗺,parasol_on_ground=⛱,moyai=🗿,shopping=🛍,shopping_cart=🛒,balloon=🎈,flags=🎏,ribbon=🎀,gift=🎁,confetti_ball=🎊,tada=🎉,dolls=🎎,wind_chime=🎐,crossed_flags=🎌,izakaya_lantern=🏮,red_envelope=🧧,email=✉️,envelope_with_arrow=📩,incoming_envelope=📨,e-mail=📧,love_letter=💌,postbox=📮,mailbox_closed=📪,mailbox=📫,mailbox_with_mail=📬,mailbox_with_no_mail=📭,package=📦,postal_horn=📯,inbox_tray=📥,outbox_tray=📤,scroll=📜,page_with_curl=📃,bookmark_tabs=📑,receipt=🧾,bar_chart=📊,chart_with_upwards_trend=📈,chart_with_downwards_trend=📉,page_facing_up=📄,date=📅,calendar=📆,spiral_calendar=🗓,card_index=📇,card_file_box=🗃,ballot_box=🗳,file_cabinet=🗄,clipboard=📋,spiral_notepad=🗒,file_folder=📁,open_file_folder=📂,card_index_dividers=🗂,newspaper_roll=🗞,newspaper=📰,notebook=📓,closed_book=📕,green_book=📗,blue_book=📘,orange_book=📙,notebook_with_decorative_cover=📔,ledger=📒,books=📚,open_book=📖,safety_pin=🧷,link=🔗,paperclip=📎,paperclips=🖇,scissors=✂️,triangular_ruler=📐,straight_ruler=📏,abacus=🧮,pushpin=📌,round_pushpin=📍,triangular_flag_on_post=🚩,white_flag=🏳,black_flag=🏴,rainbow_flag=🏳️‍🌈,closed_lock_with_key=🔐,lock=🔒,unlock=🔓,lock_with_ink_pen=🔏,pen=🖊,fountain_pen=🖋,black_nib=✒️,memo=📝,pencil2=✏️,crayon=🖍,paintbrush=🖌,mag=🔍,mag_right=🔎,heart=❤️,orange_heart=🧡,yellow_heart=💛,green_heart=💚,blue_heart=💙,purple_heart=💜,black_heart=🖤,broken_heart=💔,heavy_heart_exclamation=❣,two_hearts=💕,revolving_hearts=💞,heartbeat=💓,heartpulse=💗,sparkling_heart=💖,cupid=💘,gift_heart=💝,heart_decoration=💟,peace_symbol=☮,latin_cross=✝,star_and_crescent=☪,om=🕉,wheel_of_dharma=☸,star_of_david=✡,six_pointed_star=🔯,menorah=🕎,yin_yang=☯,orthodox_cross=☦,place_of_worship=🛐,ophiuchus=⛎,aries=♈,taurus=♉,gemini=♊,cancer=♋,leo=♌,virgo=♍,libra=♎,scorpius=♏,sagittarius=♐,capricorn=♑,aquarius=♒,pisces=♓,id=🆔,atom_symbol=⚛,u7a7a=🈳,u5272=🈹,radioactive=☢,biohazard=☣,mobile_phone_off=📴,vibration_mode=📳,u6709=🈶,u7121=🈚,u7533=🈸,u55b6=🈺,u6708=🈷️,eight_pointed_black_star=✴️,vs=🆚,accept=🉑,white_flower=💮,ideograph_advantage=🉐,secret=㊙️,congratulations=㊗️,u5408=🈴,u6e80=🈵,u7981=🈲,a=🅰️,b=🅱️,ab=🆎,cl=🆑,o2=🅾️,sos=🆘,no_entry=⛔,name_badge=📛,no_entry_sign=🚫,x=❌,o=⭕,stop_sign=🛑,anger=💢,hotsprings=♨️,no_pedestrians=🚷,do_not_litter=🚯,no_bicycles=🚳,non-potable_water=🚱,underage=🔞,no_mobile_phones=📵,exclamation=❗,grey_exclamation=❕,question=❓,grey_question=❔,bangbang=‼️,interrobang=⁉️,100=💯,low_brightness=🔅,high_brightness=🔆,trident=🔱,fleur_de_lis=⚜,part_alternation_mark=〽️,warning=⚠️,children_crossing=🚸,beginner=🔰,recycle=♻️,u6307=🈯,chart=💹,sparkle=❇️,eight_spoked_asterisk=✳️,negative_squared_cross_mark=❎,white_check_mark=✅,diamond_shape_with_a_dot_inside=💠,cyclone=🌀,loop=➿,globe_with_meridians=🌐,m=Ⓜ️,atm=🏧,sa=🈂️,passport_control=🛂,customs=🛃,baggage_claim=🛄,left_luggage=🛅,wheelchair=♿,no_smoking=🚭,wc=🚾,parking=🅿️,potable_water=🚰,mens=🚹,womens=🚺,baby_symbol=🚼,restroom=🚻,put_litter_in_its_place=🚮,cinema=🎦,signal_strength=📶,koko=🈁,ng=🆖,ok=🆗,up=🆙,cool=🆒,new=🆕,free=🆓,zero=0️⃣,one=1️⃣,two=2️⃣,three=3️⃣,four=4️⃣,five=5️⃣,six=6️⃣,seven=7️⃣,eight=8️⃣,nine=9️⃣,keycap_ten=🔟,asterisk=*⃣,1234=🔢,eject_button=⏏️,arrow_forward=▶️,pause_button=⏸,next_track_button=⏭,stop_button=⏹,record_button=⏺,play_or_pause_button=⏯,previous_track_button=⏮,fast_forward=⏩,rewind=⏪,twisted_rightwards_arrows=🔀,repeat=🔁,repeat_one=🔂,arrow_backward=◀️,arrow_up_small=🔼,arrow_down_small=🔽,arrow_double_up=⏫,arrow_double_down=⏬,arrow_right=➡️,arrow_left=⬅️,arrow_up=⬆️,arrow_down=⬇️,arrow_upper_right=↗️,arrow_lower_right=↘️,arrow_lower_left=↙️,arrow_upper_left=↖️,arrow_up_down=↕️,left_right_arrow=↔️,arrows_counterclockwise=🔄,arrow_right_hook=↪️,leftwards_arrow_with_hook=↩️,arrow_heading_up=⤴️,arrow_heading_down=⤵️,hash=#️⃣,information_source=ℹ️,abc=🔤,abcd=🔡,capital_abcd=🔠,symbols=🔣,musical_note=🎵,notes=🎶,wavy_dash=〰️,curly_loop=➰,heavy_check_mark=✔️,arrows_clockwise=🔃,heavy_plus_sign=➕,heavy_minus_sign=➖,heavy_division_sign=➗,heavy_multiplication_x=✖️,infinity=♾,heavy_dollar_sign=💲,currency_exchange=💱,copyright=©️,registered=®️,tm=™️,end=🔚,back=🔙,on=🔛,top=🔝,soon=🔜,ballot_box_with_check=☑️,radio_button=🔘,white_circle=⚪,black_circle=⚫,red_circle=🔴,large_blue_circle=🔵,small_orange_diamond=🔸,small_blue_diamond=🔹,large_orange_diamond=🔶,large_blue_diamond=🔷,small_red_triangle=🔺,black_small_square=▪️,white_small_square=▫️,black_large_square=⬛,white_large_square=⬜,small_red_triangle_down=🔻,black_medium_square=◼️,white_medium_square=◻️,black_medium_small_square=◾,white_medium_small_square=◽,black_square_button=🔲,white_square_button=🔳,speaker=🔈,sound=🔉,loud_sound=🔊,mute=🔇,mega=📣,loudspeaker=📢,bell=🔔,no_bell=🔕,black_joker=🃏,mahjong=🀄,spades=♠️,clubs=♣️,hearts=♥️,diamonds=♦️,flower_playing_cards=🎴,thought_balloon=💭,right_anger_bubble=🗯,speech_balloon=💬,left_speech_bubble=🗨,clock1=🕐,clock2=🕑,clock3=🕒,clock4=🕓,clock5=🕔,clock6=🕕,clock7=🕖,clock8=🕗,clock9=🕘,clock10=🕙,clock11=🕚,clock12=🕛,clock130=🕜,clock230=🕝,clock330=🕞,clock430=🕟,clock530=🕠,clock630=🕡,clock730=🕢,clock830=🕣,clock930=🕤,clock1030=🕥,clock1130=🕦,clock1230=🕧,afghanistan=🇦🇫,aland_islands=🇦🇽,albania=🇦🇱,algeria=🇩🇿,american_samoa=🇦🇸,andorra=🇦🇩,angola=🇦🇴,anguilla=🇦🇮,antarctica=🇦🇶,antigua_barbuda=🇦🇬,argentina=🇦🇷,armenia=🇦🇲,aruba=🇦🇼,australia=🇦🇺,austria=🇦🇹,azerbaijan=🇦🇿,bahamas=🇧🇸,bahrain=🇧🇭,bangladesh=🇧🇩,barbados=🇧🇧,belarus=🇧🇾,belgium=🇧🇪,belize=🇧🇿,benin=🇧🇯,bermuda=🇧🇲,bhutan=🇧🇹,bolivia=🇧🇴,caribbean_netherlands=🇧🇶,bosnia_herzegovina=🇧🇦,botswana=🇧🇼,brazil=🇧🇷,british_indian_ocean_territory=🇮🇴,british_virgin_islands=🇻🇬,brunei=🇧🇳,bulgaria=🇧🇬,burkina_faso=🇧🇫,burundi=🇧🇮,cape_verde=🇨🇻,cambodia=🇰🇭,cameroon=🇨🇲,canada=🇨🇦,canary_islands=🇮🇨,cayman_islands=🇰🇾,central_african_republic=🇨🇫,chad=🇹🇩,chile=🇨🇱,cn=🇨🇳,christmas_island=🇨🇽,cocos_islands=🇨🇨,colombia=🇨🇴,comoros=🇰🇲,congo_brazzaville=🇨🇬,congo_kinshasa=🇨🇩,cook_islands=🇨🇰,costa_rica=🇨🇷,croatia=🇭🇷,cuba=🇨🇺,curacao=🇨🇼,cyprus=🇨🇾,czech_republic=🇨🇿,denmark=🇩🇰,djibouti=🇩🇯,dominica=🇩🇲,dominican_republic=🇩🇴,ecuador=🇪🇨,egypt=🇪🇬,el_salvador=🇸🇻,equatorial_guinea=🇬🇶,eritrea=🇪🇷,estonia=🇪🇪,ethiopia=🇪🇹,eu=🇪🇺,falkland_islands=🇫🇰,faroe_islands=🇫🇴,fiji=🇫🇯,finland=🇫🇮,fr=🇫🇷,french_guiana=🇬🇫,french_polynesia=🇵🇫,french_southern_territories=🇹🇫,gabon=🇬🇦,gambia=🇬🇲,georgia=🇬🇪,de=🇩🇪,ghana=🇬🇭,gibraltar=🇬🇮,greece=🇬🇷,greenland=🇬🇱,grenada=🇬🇩,guadeloupe=🇬🇵,guam=🇬🇺,guatemala=🇬🇹,guernsey=🇬🇬,guinea=🇬🇳,guinea_bissau=🇬🇼,guyana=🇬🇾,haiti=🇭🇹,honduras=🇭🇳,hong_kong=🇭🇰,hungary=🇭🇺,iceland=🇮🇸,india=🇮🇳,indonesia=🇮🇩,iran=🇮🇷,iraq=🇮🇶,ireland=🇮🇪,isle_of_man=🇮🇲,israel=🇮🇱,it=🇮🇹,cote_divoire=🇨🇮,jamaica=🇯🇲,jp=🇯🇵,jersey=🇯🇪,jordan=🇯🇴,kazakhstan=🇰🇿,kenya=🇰🇪,kiribati=🇰🇮,kosovo=🇽🇰,kuwait=🇰🇼,kyrgyzstan=🇰🇬,laos=🇱🇦,latvia=🇱🇻,lebanon=🇱🇧,lesotho=🇱🇸,liberia=🇱🇷,libya=🇱🇾,liechtenstein=🇱🇮,lithuania=🇱🇹,luxembourg=🇱🇺,macau=🇲🇴,macedonia=🇲🇰,madagascar=🇲🇬,malawi=🇲🇼,malaysia=🇲🇾,maldives=🇲🇻,mali=🇲🇱,malta=🇲🇹,marshall_islands=🇲🇭,martinique=🇲🇶,mauritania=🇲🇷,mauritius=🇲🇺,mayotte=🇾🇹,mexico=🇲🇽,micronesia=🇫🇲,moldova=🇲🇩,monaco=🇲🇨,mongolia=🇲🇳,montenegro=🇲🇪,montserrat=🇲🇸,morocco=🇲🇦,mozambique=🇲🇿,myanmar=🇲🇲,namibia=🇳🇦,nauru=🇳🇷,nepal=🇳🇵,netherlands=🇳🇱,new_caledonia=🇳🇨,new_zealand=🇳🇿,nicaragua=🇳🇮,niger=🇳🇪,nigeria=🇳🇬,niue=🇳🇺,norfolk_island=🇳🇫,northern_mariana_islands=🇲🇵,north_korea=🇰🇵,norway=🇳🇴,oman=🇴🇲,pakistan=🇵🇰,palau=🇵🇼,palestinian_territories=🇵🇸,panama=🇵🇦,papua_new_guinea=🇵🇬,paraguay=🇵🇾,peru=🇵🇪,philippines=🇵🇭,pitcairn_islands=🇵🇳,poland=🇵🇱,portugal=🇵🇹,puerto_rico=🇵🇷,qatar=🇶🇦,reunion=🇷🇪,romania=🇷🇴,ru=🇷🇺,rwanda=🇷🇼,st_barthelemy=🇧🇱,st_helena=🇸🇭,st_kitts_nevis=🇰🇳,st_lucia=🇱🇨,st_pierre_miquelon=🇵🇲,st_vincent_grenadines=🇻🇨,samoa=🇼🇸,san_marino=🇸🇲,sao_tome_principe=🇸🇹,saudi_arabia=🇸🇦,senegal=🇸🇳,serbia=🇷🇸,seychelles=🇸🇨,sierra_leone=🇸🇱,singapore=🇸🇬,sint_maarten=🇸🇽,slovakia=🇸🇰,slovenia=🇸🇮,solomon_islands=🇸🇧,somalia=🇸🇴,south_africa=🇿🇦,south_georgia_south_sandwich_islands=🇬🇸,kr=🇰🇷,south_sudan=🇸🇸,es=🇪🇸,sri_lanka=🇱🇰,sudan=🇸🇩,suriname=🇸🇷,swaziland=🇸🇿,sweden=🇸🇪,switzerland=🇨🇭,syria=🇸🇾,taiwan=🇹🇼,tajikistan=🇹🇯,tanzania=🇹🇿,thailand=🇹🇭,timor_leste=🇹🇱,togo=🇹🇬,tokelau=🇹🇰,tonga=🇹🇴,trinidad_tobago=🇹🇹,tunisia=🇹🇳,tr=🇹🇷,turkmenistan=🇹🇲,turks_caicos_islands=🇹🇨,tuvalu=🇹🇻,uganda=🇺🇬,ukraine=🇺🇦,united_arab_emirates=🇦🇪,uk=🇬🇧,england=🏴󠁧󠁢󠁥󠁮󠁧󠁿,scotland=🏴󠁧󠁢󠁳󠁣󠁴󠁿,wales=🏴󠁧󠁢󠁷󠁬󠁳󠁿,us=🇺🇸,us_virgin_islands=🇻🇮,uruguay=🇺🇾,uzbekistan=🇺🇿,vanuatu=🇻🇺,vatican_city=🇻🇦,venezuela=🇻🇪,vietnam=🇻🇳,wallis_futuna=🇼🇫,western_sahara=🇪🇭,yemen=🇾🇪,zambia=🇿🇲,zimbabwe=🇿🇼,united_nations=🇺🇳,pirate_flag=🏴‍☠️";
  const EMOJI_ALIAS = "senyum=😄,senang=😀,tertawa=😂,ngakak=🤣,sedih=😢,menangis=😭,marah=😠,kaget=😲,bingung=😕,mikir=🤔,cinta=😍,kedip=😉,keren=😎,malu=😊,takut=😨,lelah=😩,tidur=😴,sakit=😷,pesta=🥳,hati=❤️,jempol=👍,jempol_bawah=👎,tepuk=👏,salam=🙏,oke=👌,lambai=👋,otot=💪,api=🔥,bintang=⭐,kilau=✨,petir=⚡,pelangi=🌈,matahari=☀️,bulan=🌙,awan=☁️,hujan=🌧,payung=☔,salju=❄️,pohon=🌳,bunga=🌸,daun=🍃,sawit=🌴,gunung=⛰,pantai=🏖,laut=🌊,bumi=🌏,dunia=🌐,peta=🗺,pin=📍,rumah=🏠,gedung=🏢,toko=🏪,pabrik=🏭,sekolah=🏫,rumah_sakit=🏥,masjid=🕌,gereja=⛪,kuil=🛕,uang=💰,duit=💸,dolar=💵,kartu=💳,dompet=👛,struk=🧾,koin=🪙,keranjang=🛒,belanja=🛍,tas=👜,hadiah=🎁,kotak=📦,truk=🚚,mobil=🚗,motor=🛵,kereta=🚋,pesawat=✈️,kapal=🚢,sepeda=🚲,roket=🚀,grafik=📊,naik=📈,turun=📉,tren=📈,diagram=📊,kalender=📆,tanggal=📅,jam=🕒,waktu=⌛,alarm=⏰,target=🎯,trofi=🏆,medali=🏅,juara=🥇,mahkota=👑,buku=📖,buku_catatan=📓,catatan=📝,pensil=✏️,kertas=📄,map_folder=📁,folder=📂,klip=📎,gunting=✂️,lampu=💡,ide=💡,kunci=🔑,gembok=🔒,terbuka=🔓,perisai=🛡,peringatan=⚠️,larangan=⛔,centang=✅,salah=❌,silang=❌,tanya=❓,seru=❗,info=ℹ️,baru=🆕,gratis=🆓,cari=🔍,lup=🔍,setelan=⚙,alat=🔧,palu=🔨,laptop=💻,komputer=🖥,ponsel=📱,telepon=📞,surel=✉️,surat=✉️,kirim=📤,terima=📥,pesan=💬,lonceng=🔔,pengeras=📢,kamera=📷,video=📹,musik=🎵,mikrofon=🎤,foto=🖼,gambar=🎨,palet=🎨,kode=💻,data=📇,basis_data=🗃,otak=🧠,mata=👀,orang=👤,tim=👥,keluarga=👪,bayi=👶,guru=🧑‍🏫,siswa=🧑‍🎓,petani=🧑‍🌾,dokter=🧑‍⚕️,koki=🧑‍🍳,polisi=👮,kopi=☕,teh=🍵,nasi=🍚,mi=🍜,roti=🍞,kue=🍰,buah=🍎,pisang=🍌,sayur=🥬,ikan=🐟,ayam=🐔,kucing=🐱,anjing=🐶,sapi=🐮,burung=🐦,kupu=🦋,bola=⚽,lari=🏃,bendera=🚩,merah_putih=🇮🇩,selesai=🏁,mulai=▶️,atas=⬆️,bawah=⬇️,kiri=⬅️,kanan=➡️,ulang=🔄,plus=➕,minus=➖";
  const EMOJI_ID = "kurung_kurawal_buka={,warna_kulit_cerah=🏻,warna_kulit_cerah_sedang=🏼,warna_kulit_sedang=🏽,warna_kulit_gelap_sedang=🏾,warna_kulit_gelap=🏿,garis_atas=‾,garis_bawah=_,tanda_hubung_minus=-,tanda_hubung=‐,en_dash=–,em_dash=—,batang_horizontal=―,titik_tengah_katakana=・,koma=,,koma_arab=،,koma_ideograf=、,titik_koma=;,titik_koma_arab=؛,titik_dua=:,tanda_seru=!,tanda_seru_terbalik=¡,tanda_tanya=?,tanda_tanya_terbalik=¿,tanda_tanya_arab=؟,interobang=‽,titik=.,elipsis=…,titik_ideografis=。,titik_tengah=·,apostrof_mesin_tik=',apostrof_kiri=‘,apostrof_kanan=’,apostrof_kanan_bawah=‚,tanda_petik_kiri=“,tanda_petik_kanan=”,tanda_petik_kanan_bawah=„,guillemet_kiri=«,guillemet_kanan=»,kurung_tutup=),kurung_siku_buka=[,kurung_siku_tutup=],kurung_kurawal_tutup=},kurung_sudut_buka=〈,kurung_sudut_tutup=〉,kurung_sudut_ganda_buka=《,kurung_sudut_ganda_tutup=》,kurung_tekuk_buka=「,kurung_tekuk_tutup=」,kurung_tekuk_bolong_buka=『,kurung_tekuk_bolong_tutup=』,kurung_lensa_penuh_buka=【,kurung_lensa_penuh_tutup=】,tanda_kurung_tempurung_buka=〔,tanda_kurung_tempurung_tutup=〕,kurung_lensa_bolong_buka=〖,kurung_lensa_bolong_tutup=〗,bagian=§,tanda_paragraf=¶,tanda_et=@,garis_miring=/,garis_miring_terbalik=\\,ampersan=&,tanda_pagar=#,persen=%,permil=‰,tanda_dagger=†,tanda_dagger_ganda=‡,bullet=•,titik_hubung=‧,prime=′,prime_ganda=″,prime_tripel=‴,caret=‸,tanda_referensi=※,asterisme=⁂,tanda_aksen_rendah=`,tanda_aksen_tirus=´,aksen_sirkumfleks=^,diaeresis=¨,derajat=°,hak_cipta_rekaman_suara=℗,tanda_panah_mengarah_ke_kiri=←,panah_arah_kiri=↚,tanda_panah_mengarah_ke_kanan=→,panah_arah_kanan=↛,tanda_panah_mengarah_ke_atas=↑,tanda_panah_mengarah_ke_bawah=↓,gelombang_panah_arah_kiri=↜,gelombang_panah_arah_kanan=↝,panah_dua_mata_arah_kiri=↞,panah_dua_mata_arah_naik=↟,panah_dua_mata_arah_kanan=↠,panah_dua_mata_arah_turun=↡,anak_panah_ke_kiri=↢,anak_panah_ke_kanan=↣,panah_ke_kiri_dari_batang=↤,panah_ke_atas_dari_batang=↥,panah_ke_kanan_dari_batang=↦,panah_ke_bawah_dari_batang=↧,panah_naik_turun_berdudukan=↨,panah_simpal_ke_kiri=↫,panah_simpal_ke_kanan=↬,panah_simpal_kanan_kiri=↭,panah_zigzag_turun=↯,panah_naik_mata_ke_kiri=↰,panah_naik_mata_ke_kanan=↱,panah_turun_mata_ke_kiri=↲,panah_turun_mata_ke_kanan=↳,panah_kanan_siku_turun=↴,panah_turun_siku_ke_kiri=↵,panah_lengkung_atas_ke_kiri=↶,panah_lengkung_atas_ke_kanan=↷,panah_barat_laut_bilah_panjang=↸,panah_ke_batang_kiri_di_atas_panah_ke_batang_kanan=↹,panah_lingkar_terbuka_melawan_arah_jarum_jam=↺,panah_lingkar_terbuka_searah_jarum_jam=↻,panah_seruit_atas_ke_kiri=↼,panah_seruit_bawah_ke_kiri=↽,panah_seruit_kanan_ke_atas=↾,panah_seruit_kiri_ke_atas=↿,panah_seruit_atas_ke_kanan=⇀,panah_seruit_bawah_ke_kanan=⇁,panah_seruit_kanan_ke_bawah=⇂,panah_seruit_kiri_ke_bawah=⇃,panah_ke_kanan_di_atas_panah_ke_kiri=⇄,tanda_panah_mengarah_ke_atas_dan_ke_bawah=⇅,tanda_panah_mengarah_ke_kiri_di_atas_tanda_panah_mengarah_ke_kanan=⇆,sepasang_panah_ke_kiri=⇇,sepasang_panah_ke_atas=⇈,sepasang_panah_ke_kanan=⇉,sepasang_panah_ke_bawah=⇊,panah_seruit_ke_kiri_di_atas_panah_seruit_ke_kanan=⇋,panah_seruit_ke_kanan_di_atas_panah_seruit_ke_kiri=⇌,panah_ganda_ke_kiri=⇐,panah_ganda_ke_kiri_dicoret=⇍,panah_ganda_ke_atas=⇑,panah_ganda_ke_kanan=⇒,panah_ganda_ke_kanan_dicoret=⇏,panah_ganda_ke_bawah=⇓,panah_ganda_ke_kanan_kiri=⇔,panah_ganda_ke_kanan_kiri_dicoret=⇎,panah_ganda_barat_laut=⇖,panah_ganda_timur_laut=⇗,panah_ganda_tenggara=⇘,panah_ganda_barat_daya=⇙,panah_tripel_ke_kiri=⇚,panah_tripel_ke_kanan=⇛,panah_keriting_ke_kiri=⇜,panah_keriting_ke_kanan=⇝,panah_ke_atas_coret_ganda=⇞,panah_ke_bawah_coret_ganda=⇟,panah_bergaris_putus_putus_ke_kiri=⇠,panah_bergaris_putus_putus_ke_atas=⇡,panah_bergaris_putus_putus_ke_kanan=⇢,panah_bergaris_putus_putus_ke_bawah=⇣,batang_panah_ke_kiri=⇤,batang_panah_ke_kanan=⇥,panah_putih_ke_kiri=⇦,panah_putih_ke_atas=⇧,panah_putih_ke_kanan=⇨,panah_putih_ke_bawah=⇩,panah_putih_ke_atas_dari_batang=⇪,panah_ke_bawah_di_sebelah_kiri_panah_ke_atas=⇵,untuk_semua=∀,diferensial_parsial=∂,di_sana_ada=∃,himpunan_kosong=∅,pertambahan=∆,nabla=∇,anggota=∈,bukan_elemen=∉,berisi=∋,pembuktian_selesai=∎,produk_n_ary=∏,penjumlahan_n_ary=∑,tanda_plus=+,plus_minus=±,tanda_pembagian=÷,tanda_perkalian=×,kurang_dari=<,tidak_kurang_dari=≮,sama_dengan==,tidak_sama_dengan=≠,lebih_dari=>,tidak_lebih_dari=≯,negasi=¬,garis_vertikal=|,tilde=~,tanda_minus=−,minus_superskrip=⁻,minus_atau_plus=∓,garis_miring_pembagian=∕,garis_miring_pecahan=⁄,operator_asterisk=∗,operator_cincin=∘,operator_bullet=∙,akar_kuadrat=√,proporsional=∝,tanda_tak_terhingga=∞,sudut_kanan=∟,sudut=∠,membagi=∣,paralel=∥,dan_logika=∧,irisan=∩,gabungan=∪,integral=∫,integral_ganda=∬,integral_kontur=∮,karena_itu=∴,karena=∵,rasio=∶,proporsi=∷,operator_tilde=∼,tilde_terbalik=∽,lazy_s_terbalik=∾,sama_asimptotis=≃,kira_kira_sama=≅,hampir_sama_dengan=≈,semua_sama=≌,kira_kira_sama_dengan_atau_gambaran=≒,cincin_di_dalam_tanda_sama_dengan=≖,setara_dengan=≡,setara_terbatas=≣,kurang_dari_atau_sama_dengan=≤,lebih_dari_atau_sama_dengan=≥,kurang_dari_di_atas_sama_dengan=≦,lebih_dari_di_atas_sama_dengan=≧,jauh_lebih_sedikit_dari=≪,jauh_lebih_besar_dari=≫,antara=≬,lebih_besar_dari_atau_setara=≳,mendahului=≺,mengikuti=≻,tidak_mengikuti=⊁,subhimpunan_dari=⊂,superset=⊃,subset_sama_dengan=⊆,superset_sama_dengan=⊇,plus_dilingkari=⊕,minus_dilingkari=⊖,tanda_perkalian_dilingkari=⊗,garis_miring_pembagian_dilingkari=⊘,operator_titik_dilingkari=⊙,operator_cincin_dilingkari=⊚,operator_asterisk_dilingkari=⊛,tanda_plus_dalam_persegi=⊞,tanda_minus_dalam_persegi=⊟,falsum=⊥,tidak_memaksa=⊮,mendahului_di_bawah_relasi=⊰,mengikuti_di_bawah_relasi=⊱,tidak_mencakup_sebagai_subgrup_normal_atau_sama_dengan=⋭,orisinal=⊶,matriks_konjugasi_hermitian=⊹,segitiga_kanan=⊿,atau_logika_n_ary=⋁,irisan_n_ary=⋂,gabungan_n_ary=⋃,operator_titik=⋅,operator_bintang=⋆,gabungan_alami=⋈,irisan_ganda=⋒,sangat_lebih_sedikit_dari=⋘,sangat_lebih_besar_dari=⋙,elipsis_vertikal=⋮,elipsis_horizontal_garis_tengah=⋯,elipsis_diagonal_naik_ke_kanan=⋰,elipsis_diagonal_turun_ke_kanan=⋱,persegi_hitam=■,persegi_putih=□,persegi_putih_dengan_sudut_lengkung=▢,persegi_putih_berisi_persegi_hitam=▣,persegi_dengan_isian_horizontal=▤,persegi_dengan_isian_vertikal=▥,persegi_isian_garis_silang_ortogonal=▦,persegi_isian_garis_diagonal_turun_ke_kanan=▧,persegi_isian_garis_diagonal_turun_ke_kiri=▨,persegi_isian_garis_silang_diagonal=▩,persegi_panjang_hitam=▬,persegi_panjang_putih=▭,persegi_panjang_vertikal_hitam=▮,jajar_genjang_hitam=▰,segitiga_solid_mengarah_ke_atas=▲,segitiga_putih_menghadap_atas=△,segitiga_kecil_hitam_menghadap_atas=▴,segitiga_kecil_putih_menghadap_atas=▵,segitiga_putih_menghadap_kanan=▷,segitiga_kecil_hitam_menghadap_kanan=▸,segitiga_kecil_putih_menghadap_kanan=▹,penunjuk_hitam_menghadap_kanan=►,penunjuk_putih_menghadap_kanan=▻,segitiga_solid_mengarah_ke_bawah=▼,segitiga_putih_menghadap_bawah=▽,segitiga_kecil_hitam_menghadap_bawah=▾,segitiga_kecil_putih_menghadap_bawah=▿,segitiga_putih_menghadap_kiri=◁,segitiga_kecil_hitam_menghadap_kiri=◂,segitiga_kecil_putih_menghadap_kiri=◃,penunjuk_hitam_menghadap_kiri=◄,penunjuk_putih_menghadap_kiri=◅,belah_ketupat_hitam=◆,belah_ketupat_putih=◇,belah_ketupat_putih_berisi_belah_ketupat_hitam=◈,lingkaran_putih_berisi_lingkaran_hitam=◉,belah_ketupat=◊,lingkaran_kosong=○,lingkaran_bergaris_putus_putus=◌,lingkaran_dengan_isian_vertikal=◍,lingkaran_konsentris=◎,lingkaran_solid=●,lingkaran_dengan_setengah_kiri_hitam=◐,lingkaran_dengan_setengah_kanan_hitam=◑,lingkaran_dengan_setengah_bawah_hitam=◒,lingkaran_dengan_setengah_atas_hitam=◓,lingkaran_dengan_kuadran_kanan_atas_hitam=◔,lingkaran_hitam_kecuali_kuadran_kiri_atas=◕,setengah_lingkaran_kiri_hitam=◖,setengah_lingkaran_kanan_hitam=◗,bullet_dalam_persegi_hitam=◘,persegi_hitam_berisi_lingkaran_putih=◙,busur_lingkaran_kuadran_kiri_atas=◜,busur_lingkaran_kuadran_kanan_atas=◝,busur_lingkaran_kuadran_kanan_bawah=◞,busur_lingkaran_kuadran_kiri_bawah=◟,setengah_lingkaran_atas=◠,setengah_lingkaran_bawah=◡,segitiga_kanan_bawah_hitam=◢,segitiga_kiri_bawah_hitam=◣,segitiga_kiri_atas_hitam=◤,segitiga_kanan_atas_hitam=◥,peluru_putih=◦,lingkaran_kosong_besar=◯,persegi_putih_kuadran_kanan_atas=◳,lingkaran_putih_dengan_kuadran_kanan_atas=◷,segitiga_kanan_bawah=◿,not_seperdelapan=♪,plus_dengan_subskrip_angka_dua=⨧,produk_vektor=⨯,produk_interior=⨼,atau_logika_dengan_dua_garis_bawah=⩣,kurang_dari_dengan_tanda_sama_dengan_miring=⩽,kurang_dari_di_atas_tanda_sama_dengan_atau_kira_kira_sama_dengan=⪍,dua_garis_sama_dengan_di_atas_tanda_lebih_dari=⪚,mengikuti_di_atas_tanda_tidak_hampir_sama=⪺,nada_mol=♭,nada_kres=♯,wajah_gembira=😀,wajah_tersenyum_lebar=😃,wajah_tersenyum_lebar_dan_mata_tertutup=😄,wajah_gembira_dengan_mata_bahagia=😁,wajah_tersenyum_lebar_dan_memejamkan_mata=😆,wajah_tersenyum_lebar_dan_berkeringat=😅,tertawa_terbahak_bahak=🤣,wajah_gembira_berurai_air_mata=😂,wajah_agak_tersenyum=🙂,wajah_terbalik=🙃,wajah_meleleh=🫠,wajah_retak=🫫,wajah_berkedip=😉,wajah_tersenyum_dengan_mata_bahagia=😊,wajah_malaikat=😇,wajah_tersenyum_dengan_3_hati=🥰,wajah_tersenyum_lebar_bermata_hati=😍,wajah_dengan_mata_berbentuk_bintang=🤩,wajah_memberikan_ciuman_jauh=😘,wajah_memberikan_ciuman=😗,wajah_tersenyum=☺️,wajah_memberikan_ciuman_dengan_mata_tertutup=😚,wajah_memberikan_ciuman_dengan_mata_bahagia=😙,wajah_tersenyum_dengan_air_mata=🥲,wajah_menikmati=😋,wajah_menjulurkan_lidah=😛,wajah_menjulurkan_lidah_dan_mengedipkan_mata=😜,wajah_konyol=🤪,wajah_menjulurkan_lidah_dan_memejamkan_mata=😝,wajah_materialistis=🤑,wajah_memeluk=🤗,wajah_dengan_tangan_menutup_mulut=🤭,wajah_dengan_mata_terbuka_dan_tangan_menutupi_mulut=🫢,wajah_dengan_mata_mengintip=🫣,wajah_menyuruh_diam=🤫,wajah_berpikir=🤔,wajah_memberi_hormat=🫡,wajah_dengan_mulut_tertutup_rapat=🤐,wajah_dengan_alis_terangkat=🤨,wajah_netral=😐,wajah_tanpa_ekspresi=😑,wajah_tanpa_mulut=😶,wajah_dengan_garis_titik_titik=🫥,wajah_di_awan=😶‍🌫,wajah_tersenyum_sombong=😏,wajah_bosan=😒,wajah_dengan_mata_ke_atas=🙄,wajah_menyeringai=😬,wajah_mengembuskan_napas=😮‍💨,bohong=🤥,wajah_gemetar=🫨,kepala_bergeleng=🙂‍↔,kepala_mengangguk=🙂‍↕,wajah_lega=😌,wajah_merenung=😔,wajah_mengantuk=😪,ngiler=🤤,wajah_tidur=😴,wajah_dengan_kantung_mata=🫩,wajah_bermasker=😷,wajah_bertermometer=🤒,wajah_diperban_di_kepala=🤕,mual=🤢,wajah_muntah=🤮,bersin=🤧,wajah_kepanasan=🥵,wajah_kedinginan=🥶,wajah_pusing_karena_mabuk=🥴,wajah_pusing=😵,wajah_dengan_mata_berputar=😵‍💫,kepala_meledak=🤯,wajah_koboi=🤠,wajah_pesta=🥳,wajah_menyamar=🥸,wajah_berkacamata_hitam=😎,wajah_kutu_buku=🤓,wajah_dengan_monokel=🧐,wajah_bingung=😕,wajah_dengan_mulut_diagonal=🫤,wajah_cemas=😟,wajah_agak_cemberut=🙁,wajah_cemberut=☹,wajah_dengan_mulut_terbuka=😮,wajah_hening=😯,wajah_terpukau=😲,wajah_tersipu=😳,wajah_syok=🫪,wajah_memelas=🥺,wajah_menahan_air_mata=🥹,wajah_mengerutkan_kening_dengan_mulut_terbuka=😦,wajah_menderita=😧,wajah_ketakutan=😨,wajah_ketakutan_berkeringat=😰,wajah_kecewa_namun_lega=😥,wajah_menangis=😢,wajah_menangis_keras=😭,wajah_sangat_ketakutan=😱,wajah_stres=😖,wajah_tidak_setuju=😣,wajah_kecewa=😞,wajah_berkeringat=😓,wajah_terlalu_lelah=😩,wajah_kelelahan=😫,wajah_menguap=🥱,wajah_bersungguh_sungguh=😤,wajah_sangat_marah=😡,wajah_marah=😠,wajah_dengan_simbol_pada_mulut=🤬,wajah_tersenyum_bertanduk=😈,wajah_marah_dengan_tanduk=👿,tengkorak=💀,tengkorak_dan_tulang=☠,kotoran=💩,badut=🤡,wajah_monster=👹,topeng_hidung_panjang=👺,hantu=👻,monster_alien=👾,wajah_kucing_tersenyum_lebar=😺,wajah_kucing_gembira_dengan_mata_bahagia=😸,wajah_kucing_gembira_berurai_air_mata=😹,wajah_kucing_gembira_bermata_hati=😻,wajah_kucing_tersenyum_sombong=😼,wajah_kucing_memberikan_ciuman_dengan_mata_tertutup=😽,wajah_kucing_ketakutan=🙀,wajah_kucing_menangis=😿,wajah_kucing_marah=😾,tidak_melihat=🙈,tidak_mendengar=🙉,tidak_bicara=🙊,surat_cinta=💌,hati_terpanah=💘,hati_berpita=💝,hati_bersinar=💖,hati_membesar=💗,hati_berdetak=💓,hati_berputar=💞,dua_hati=💕,dekorasi_hati=💟,tanda_seru_berbentuk_hati=❣,patah_hati=💔,hati_berapi_api=❤‍🔥,mengobati_hati_terluka=❤‍🩹,hati_merah=❤️,hati_merah_muda=🩷,hati_oranye=🧡,hati_kuning=💛,hati_hijau=💚,hati_biru=💙,hati_biru_muda=🩵,hati_ungu=💜,hati_cokelat=🤎,hati_hitam=🖤,hati_abu_abu=🩶,hati_putih=🤍,tanda_ciuman=💋,nilai_seratus=💯,awan_duel=🫯,tabrakan=💥,pusing=💫,keringat=💦,berlari=💨,lubang=🕳,balon_ucapan=💬,mata_di_dalam_gelembung_ucapan=👁‍🗨,gelembung_ucapan_kiri=🗨,gelembung_marah_kanan=🗯,gelembung_pikiran=💭,tangan_melambai=👋,angkat_tangan=🤚,telapak_tangan_terbuka=🖐,telapak_tangan_terbuka_dengan_jari_rapat=✋,salam_vulcan=🖖,tangan_menghadap_kanan=🫱,tangan_menghadap_kiri=🫲,telapak_tangan_menghadap_ke_bawah=🫳,telapak_tangan_menghadap_ke_atas=🫴,tangan_mendorong_ke_kiri=🫷,tangan_mendorong_ke_kanan=🫸,jari_terkuncup=🤌,tangan_menjepit=🤏,isyarat_kemenangan=✌,jari_menyilang=🤞,tangan_dengan_jari_telunjuk_dan_ibu_jari_menyilang=🫰,gerakan_sayang_kamu=🤟,lambang_tanduk=🤘,panggil_saya=🤙,menunjuk_ke_arah_kiri=👈,menunjuk_ke_arah_kanan=👉,menunjuk_ke_atas_dibalik=👆,jari_tengah=🖕,menunjuk_ke_bawah=👇,menunjuk_ke_atas=☝,jari_telunjuk_menunjuk_penonton=🫵,jempol_ke_atas=👍,jempol_ke_bawah=👎,isyarat_jempol_ke_kiri=🫹,isyarat_jempol_ke_kanan=🫺,tangan_terkepal_ke_atas=✊,tangan_terkepal_ke_depan=👊,tinju_kiri=🤛,tinju_kanan=🤜,tepuk_tangan=👏,mengangkat_tangan=🙌,tangan_membentuk_hati=🫶,tangan_terbuka=👐,tangan_diangkat_dan_dirapatkan_bersama=🤲,jabat_tangan=🤝,melipat_tangan=🙏,tangan_menulis=✍,poles_kuku=💅,lengan_berotot=💪,lengan_robot=🦾,tungkai_robot=🦿,tungkai=🦵,telapak_kaki=🦶,telinga=👂,telinga_dengan_alat_bantu_dengar=🦻,hidung=👃,organ_jantung=🫀,paru_paru=🫁,gigi=🦷,tulang=🦴,dua_mata=👀,satu_mata=👁,lidah=👅,mulut=👄,menggigit_bibir=🫦,anak=🧒,anak_laki_laki=👦,anak_perempuan=👧,dewasa=🧑,orang_rambut_pirang=👱,pria=👨,orang_janggut=🧔,pria_janggut=🧔‍♂,pria_berambut_pirang=👱‍♂,wanita=👩,wanita_janggut=🧔‍♀,wanita_berambut_pirang=👱‍♀️,lanjut_usia=🧓,pria_tua=👴,wanita_tua=👵,orang_marah=🙍,pria_muka_tidak_senang=🙍‍♂️,wanita_muka_tidak_senang=🙍‍♀,orang_tidak_senang=🙎,pria_tidak_senang=🙎‍♂️,wanita_tidak_senang=🙎‍♀,orang_mengisyaratkan_tidak=🙅,pria_mengisyaratkan_tidak=🙅‍♂️,wanita_mengisyaratkan_tidak=🙅‍♀,orang_mengisyaratkan_oke=🙆,pria_mengisyaratkan_oke=🙆‍♂️,wanita_mengisyaratkan_oke=🙆‍♀,orang_menengadahkan_tangan=💁,pria_menengadahkan_tangan=💁‍♂️,wanita_menengadahkan_tangan=💁‍♀,orang_mengangkat_tangan=🙋,pria_mengangkat_tangan=🙋‍♂️,wanita_mengangkat_tangan=🙋‍♀,orang_tuli=🧏,pria_tuli=🧏‍♂,wanita_tuli=🧏‍♀,orang_membungkuk=🙇,pria_membungkuk=🙇‍♂,wanita_membungkuk=🙇‍♀️,orang_tepuk_jidat=🤦,pria_tepuk_jidat=🤦‍♂️,wanita_tepuk_jidat=🤦‍♀️,orang_mengangkat_bahu=🤷,pria_mengangkat_bahu=🤷‍♂️,wanita_mengangkat_bahu=🤷‍♀,petugas_kesehatan=🧑‍⚕,pekerja_kesehatan_pria=👨‍⚕️,pekerja_kesehatan_wanita=👩‍⚕️,murid=🧑‍🎓,sarjana_pria=👨‍🎓,sarjana_wanita=👩‍🎓,pengajar_pria=👨‍🏫,pengajar_wanita=👩‍🏫,hakim=🧑‍⚖,hakim_pria=👨‍⚖️,hakim_wanita=👩‍⚖️,petani_pria=👨‍🌾,petani_wanita=👩‍🌾,koki_pria=👨‍🍳,koki_wanita=👩‍🍳,mekanik=🧑‍🔧,montir_pria=👨‍🔧,montir_wanita=👩‍🔧,pekerja_pabrik=🧑‍🏭,pekerja_pabrik_pria=👨‍🏭,pekerja_pabrik_wanita=👩‍🏭,pekerja_kantoran=🧑‍💼,pekerja_kantor_pria=👨‍💼,pekerja_kantor_wanita=👩‍💼,ilmuwan=🧑‍🔬,ilmuwan_pria=👨‍🔬,ilmuwan_wanita=👩‍🔬,ahli_teknologi=🧑‍💻,ahli_teknologi_pria=👨‍💻,ahli_teknologi_wanita=👩‍💻,penyanyi=🧑‍🎤,penyanyi_pria=👨‍🎤,penyanyi_wanita=👩‍🎤,seniman=🧑‍🎨,seniman_pria=👨‍🎨,seniman_wanita=👩‍🎨,pilot=🧑‍✈,pilot_pria=👨‍✈️,pilot_wanita=👩‍✈️,astronaut=🧑‍🚀,antariksawan_pria=👨‍🚀,antariksawan_wanita=👩‍🚀,pemadam_kebakaran=🧑‍🚒,pemadam_kebakaran_pria=👨‍🚒,pemadam_kebakaran_wanita=👩‍🚒,polisi_pria=👮‍♂,polisi_wanita=👮‍♀️,detektif=🕵,detektif_pria=🕵‍♂,detektif_wanita=🕵️‍♀️,penjaga=💂,penjaga_pria=💂‍♂,penjaga_wanita=💂‍♀️,ninja=🥷,pekerja_konstruksi=👷,pekerja_konstruksi_pria=👷‍♂,pekerja_konstruksi_wanita=👷‍♀️,orang_mengenakan_mahkota=🫅,pangeran=🤴,putri=👸,orang_mengenakan_serban=👳,pria_mengenakan_serban=👳‍♂,wanita_mengenakan_serban=👳‍♀️,orang_dengan_topi_tionghoa=👲,wanita_dengan_kerudung=🧕,orang_bertuksedo=🤵,pria_dewasa_bertuksedo=🤵‍♂,wanita_bertuksedo=🤵‍♀,orang_berpenutup_kepala=👰,pria_berpenutup_kepala=👰‍♂,wanita_berpenutup_kepala=👰‍♀,wanita_hamil=🤰,pria_hamil=🫃,orang_hamil=🫄,menyusui=🤱,wanita_menyusui_bayi=👩‍🍼,pria_menyusui_bayi=👨‍🍼,orang_menyusui_bayi=🧑‍🍼,malaikat_bayi=👼,sinterklas=🎅,nyonya_sinterklas=🤶,manusia_sinterklas=🧑‍🎄,pahlawan_super=🦸,pahlawan_super_pria=🦸‍♂️,pahlawan_super_wanita=🦸‍♀️,penjahat_super=🦹,penjahat_super_pria=🦹‍♂️,penjahat_super_wanita=🦹‍♀️,magi=🧙,magi_pria=🧙‍♂️,magi_wanita=🧙‍♀️,peri=🧚,peri_pria=🧚‍♂️,peri_wanita=🧚‍♀️,vampir=🧛,vampir_pria=🧛‍♂️,vampir_wanita=🧛‍♀️,orang_duyung=🧜,pria_duyung=🧜‍♂️,putri_duyung=🧜‍♀️,kurcaci=🧝,kurcaci_pria=🧝‍♂️,kurcaci_wanita=🧝‍♀️,jin=🧞,jin_pria=🧞‍♂️,jin_wanita=🧞‍♀️,zombi=🧟,zombi_pria=🧟‍♂️,zombi_wanita=🧟‍♀️,raksasa=🧌,makhluk_berbulu=🫈,pria_dipijat=💆,pria_dipijat_kepalanya=💆‍♂️,wanita_dipijat=💆‍♀,orang_potong_rambut=💇,pria_potong_rambut=💇‍♂️,wanita_potong_rambut=💇‍♀,orang_berjalan_kaki=🚶,pria_berjalan_kaki=🚶‍♂,wanita_berjalan_kaki=🚶‍♀️,orang_berdiri=🧍,pria_berdiri=🧍‍♂,wanita_berdiri=🧍‍♀,orang_berlutut=🧎,pria_berlutut=🧎‍♂,wanita_berlutut=🧎‍♀,orang_dengan_tongkat=🧑‍🦯,pria_dengan_tongkat=👨‍🦯,wanita_dengan_tongkat=👩‍🦯,orang_dengan_kursi_roda_bermotor=🧑‍🦼,pria_dengan_kursi_roda_bermotor=👨‍🦼,wanita_dengan_kursi_roda_bermotor=👩‍🦼,orang_dengan_kursi_roda_manual=🧑‍🦽,pria_dengan_kursi_roda_manual=👨‍🦽,wanita_dengan_kursi_roda_manual=👩‍🦽,orang_berlari=🏃,pria_berlari=🏃‍♂,wanita_berlari=🏃‍♀️,penari_balet=🧑‍🩰,wanita_menari=💃,pria_menari=🕺,pria_melayang_mengenakan_jas=🕴,orang_dengan_telinga_kelinci=👯,pria_dengan_telinga_kelinci=👯‍♂️,wanita_dengan_telinga_kelinci=👯‍♀,orang_di_ruangan_beruap=🧖,pria_di_ruangan_beruap=🧖‍♂️,wanita_di_ruangan_beruap=🧖‍♀️,orang_memanjat=🧗,pria_memanjat=🧗‍♂️,wanita_memanjat=🧗‍♀️,orang_berolahraga_anggar=🤺,balap_kuda=🏇,pemain_ski=⛷,peselancar_salju=🏂,orang_bermain_golf=🏌,pria_bermain_golf=🏌‍♂,wanita_bermain_golf=🏌️‍♀️,orang_berselancar=🏄,pria_berselancar=🏄‍♂,wanita_berselancar=🏄‍♀️,orang_mendayung_perahu=🚣,pria_mendayung_perahu=🚣‍♂,wanita_mendayung_perahu=🚣‍♀️,orang_berenang=🏊,pria_berenang=🏊‍♂,wanita_berenang=🏊‍♀️,orang_memantulkan_bola=⛹,pria_memantulkan_bola=⛹‍♂,wanita_memantulkan_bola=⛹️‍♀️,orang_mengangkat_beban=🏋,pria_mengangkat_beban=🏋‍♂,wanita_mengangkat_beban=🏋️‍♀️,orang_bersepeda=🚴,pria_bersepeda=🚴‍♂,wanita_bersepeda=🚴‍♀️,orang_bersepeda_gunung=🚵,pria_bersepeda_gunung=🚵‍♂,wanita_bersepeda_gunung=🚵‍♀️,orang_melakukan_gerakan_meroda=🤸,pria_melakukan_gerakan_meroda=🤸‍♂️,wanita_melakukan_gerakan_meroda=🤸‍♀️,orang_bergulat=🤼,pria_bergulat=🤼‍♂️,wanita_bergulat=🤼‍♀️,orang_bermain_polo_air=🤽,pria_bermain_polo_air=🤽‍♂️,wanita_bermain_polo_air=🤽‍♀️,orang_bermain_bola_tangan=🤾,pria_bermain_bola_tangan=🤾‍♂️,wanita_bermain_bola_tangan=🤾‍♀️,orang_melempar=🤹,pria_melempar=🤹‍♂️,wanita_melempar=🤹‍♀️,orang_dalam_posisi_teratai=🧘,pria_dalam_posisi_teratai=🧘‍♂️,wanita_dalam_posisi_teratai=🧘‍♀️,orang_di_bak_mandi=🛀,orang_di_tempat_tidur=🛌,orang_bergandengan=🧑‍🤝‍🧑,dua_wanita_bergandengan=👭,pria_dan_wanita_bergandengan=👫,dua_pria_bergandengan=👬,berciuman=💏,pasangan_dengan_hati=💑,kepala_berbicara=🗣,siluet_foto_setengah_badan=👤,beberapa_siluet_foto_setengah_badan=👥,orang_berpelukan=🫂,keluarga_orang_dewasa_orang_dewasa_anak=🧑‍🧑‍🧒,keluarga_orang_dewasa_orang_dewasa_anak_anak=🧑‍🧑‍🧒‍🧒,keluarga_orang_dewasa_anak=🧑‍🧒,keluarga_orang_dewasa_anak_anak=🧑‍🧒‍🧒,jejak_kaki=👣,sidik_jari=🫆,rambut_merah=🦰,rambut_keriting=🦱,rambut_putih=🦳,gundul=🦲,wajah_monyet=🐵,monyet=🐒,gorila=🦍,orangutan=🦧,wajah_anjing=🐶,anjing_pemandu=🦮,anjing_pembimbing=🐕‍🦺,pudel=🐩,serigala=🐺,rubah=🦊,rakun=🦝,wajah_kucing=🐱,kucing_hitam=🐈‍⬛,singa=🦁,wajah_harimau=🐯,harimau=🐅,macan_tutul=🐆,wajah_kuda=🐴,rusa_besar=🫎,keledai=🫏,kuda=🐎,rusa=🦌,bison=🦬,wajah_sapi=🐮,lembu=🐂,kerbau=🐃,wajah_babi=🐷,babi=🐖,babi_hutan=🐗,hidung_babi=🐽,domba_jantan=🐏,domba_betina=🐑,kambing=🐐,unta=🐪,unta_berpunuk_dua=🐫,jerapah=🦒,gajah=🐘,mamut=🦣,badak=🦏,kuda_nil=🦛,wajah_tikus=🐭,tikus_putih=🐁,tikus=🐀,wajah_kelinci=🐰,kelinci=🐇,tupai=🐿,biwara=🦫,landak=🦔,kelelawar=🦇,beruang=🐻,beruang_kutub=🐻‍❄,panda=🐼,kungkang=🦥,berang_berang=🦦,sigung=🦨,kanguru=🦘,musang=🦡,jejak_kaki_hewan=🐾,kalkun=🦃,ayam_jago=🐓,itik_menetas=🐣,itik_bayi=🐤,itik_bayi_menghadap_ke_depan=🐥,pinguin=🐧,merpati=🕊,elang=🦅,bebek=🦆,angsa_leher_panjang=🦢,burung_hantu=🦉,dodo=🦤,bulu=🪶,flamingo=🦩,merak=🦚,nuri=🦜,sayap=🪽,burung_hitam=🐦‍⬛,angsa_leher_pendek=🪿,phoenix=🐦‍🔥,katak=🐸,buaya=🐊,kura_kura=🐢,kadal=🦎,ular=🐍,wajah_naga=🐲,naga=🐉,t_rex=🦖,ikan_paus_menyembur=🐳,ikan_paus=🐋,lumba_lumba=🐬,orca=🫍,anjing_laut=🦭,ikan_tropis=🐠,ikan_gembung=🐡,hiu=🦈,gurita=🐙,cangkang_spiral=🐚,terumbu_karang=🪸,ubur_ubur=🪼,kepiting=🦀,udang=🦐,cumi_cumi=🦑,tiram=🦪,siput=🐌,kupu_kupu=🦋,kupu_kupu_raja=🫌,serangga_kecil=🐛,semut=🐜,lebah_madu=🐝,kumbang=🪲,kumbang_betina=🐞,jangkrik=🦗,kecoak=🪳,laba_laba=🕷,jaring_laba_laba=🕸,kalajengking=🦂,nyamuk=🦟,lalat=🪰,cacing=🪱,mikroba=🦠,karangan_bunga=💐,sakura=🌸,bunga_putih=💮,teratai=🪷,hiasan_mawar=🏵,mawar=🌹,bunga_layu=🥀,kembang_sepatu=🌺,bunga_matahari=🌻,mekar=🌼,hyacinthus=🪻,semai=🌱,tanaman_pot=🪴,pohon_hijau_abadi=🌲,pohon_meranggas=🌳,pohon_palem=🌴,kaktus=🌵,seikat_padi=🌾,herba=🌿,semanggi=☘,empat_daun_semanggi=🍀,daun_maple=🍁,daun_berguguran=🍂,daun_tertiup_angin=🍃,sarang_burung_kosong=🪹,sarang_dengan_telur=🪺,jamur=🍄,pohon_tanpa_daun=🪾,anggur=🍇,semangka=🍉,buah_jeruk=🍊,jeruk_limau=🍋‍🟩,nanas=🍍,mangga=🥭,apel_merah=🍎,apel_hijau=🍏,pir=🍐,persik=🍑,ceri=🍒,stroberi=🍓,blueberry=🫐,buah_kiwi=🥝,tomat=🍅,zaitun=🫒,kelapa=🥥,alpukat=🥑,terung=🍆,kentang=🥔,wortel=🥕,bonggol_jagung=🌽,cabai_pedas=🌶,paprika=🫑,ketimun=🥒,acar_ketimun=🫝,selada_hijau=🥬,brokoli=🥦,bawang_putih=🧄,bawang_bombay=🧅,kacang_tanah=🥜,kacang_merah=🫘,kastanye=🌰,akar_jahe=🫚,kacang_polong=🫛,jamur_cokelat=🍄‍🟫,sayuran_umbi=🫜,roti_baguette=🥖,roti_pipih=🫓,panekuk=🥞,wafel=🧇,irisan_keju=🧀,daging_pada_tulang=🍖,kaki_ayam=🍗,potongan_daging=🥩,babi_asap=🥓,kentang_goreng=🍟,hot_dog=🌭,roti_lapis=🥪,tamale=🫔,roti_tawar_isi=🥙,falafel=🧆,telur=🥚,memasak=🍳,wajan_dangkal=🥘,panci_makanan=🍲,fondue=🫕,mangkuk_dengan_sendok=🥣,salad_hijau=🥗,mentega=🧈,garam=🧂,makanan_kaleng=🥫,kotak_bento=🍱,kerupuk_beras=🍘,nasi_kepal=🍙,nasi_matang=🍚,nasi_kari=🍛,mangkuk_mengepul=🍜,spageti=🍝,ubi_panggang=🍠,udang_goreng=🍤,kue_ikan_dengan_desain_pusaran=🍥,kue_bulan=🥮,kue_keberuntungan=🥠,kotak_makanan=🥡,es_krim_lembut=🍦,es_serut=🍧,es_krim=🍨,donat=🍩,biskuit=🍪,kue_ulang_tahun=🎂,kue_mangkuk=🧁,pai=🥧,sebatang_cokelat=🍫,permen=🍬,permen_lolipop=🍭,puding_susu=🍮,toples_madu=🍯,botol_bayi=🍼,gelas_susu=🥛,minuman_hangat=☕,teko=🫖,cangkir_teh_tanpa_gagang=🍵,botol_dengan_penyumbat_terlepas=🍾,gelas_anggur=🍷,gelas_cocktail=🍸,minuman_tropis=🍹,mug_bir=🍺,mug_bir_berdenting=🍻,mendentingkan_gelas=🥂,gelas_tumbler=🥃,menuang_cairan=🫗,cangkir_dengan_sedotan=🥤,teh_bubble=🧋,kotak_minuman=🧃,teh_mate=🧉,es_batu=🧊,sumpit=🥢,garpu_dan_pisau_dengan_piring=🍽,garpu_dan_pisau=🍴,sendok=🥄,pisau_dapur=🔪,toples=🫙,bola_dunia_eropa_afrika=🌍,bola_dunia_amerika=🌎,bola_dunia_asia_australia=🌏,bola_dunia_dengan_garis_meridian=🌐,peta_dunia=🗺,peta_jepang=🗾,kompas=🧭,gunung_dengan_puncak_bersalju=🏔,longsor=🛘,gunung_berapi=🌋,gunung_fuji=🗻,berkemah=🏕,pantai_dan_payung=🏖,gurun=🏜,pulau_terpencil=🏝,taman_nasional=🏞,stadion=🏟,bangunan_klasik=🏛,konstruksi_bangunan=🏗,batu_bata=🧱,batu=🪨,kayu=🪵,pondok=🛖,perumahan=🏘,rumah_terlantar=🏚,rumah_dengan_taman=🏡,gedung_perkantoran=🏢,kantor_pos_jepang=🏣,kantor_pos=🏤,hotel_cinta=🏩,minimarket=🏪,toserba=🏬,kastel_jepang=🏯,kastel=🏰,pernikahan=💒,menara_tokyo=🗼,patung_liberty=🗽,pura=🛕,sinagog=🕍,kuil_shinto=⛩,ka_bah=🕋,air_mancur=⛲,tenda=⛺,berkabut=🌁,malam_berbintang=🌃,panorama_kota=🏙,matahari_terbit_di_antara_gunung=🌄,matahari_terbit=🌅,panorama_kota_di_sore_hari=🌆,matahari_terbenam=🌇,jembatan_di_malam_hari=🌉,sumber_air_panas=♨️,komidi_putar=🎠,perosotan=🛝,kincir_ria=🎡,tanda_salon=💈,tenda_sirkus=🎪,lokomotif=🚂,gerbong=🚃,kereta_ekspres=🚄,kereta_ekspres_peluru=🚅,kereta_bawah_tanah=🚇,stasiun=🚉,trem=🚊,monorel=🚝,jalur_kereta_pegunungan=🚞,gerbong_trem=🚋,bus_datang=🚍,bus_listrik=🚎,ambulans=🚑,mobil_pemadam_kebakaran=🚒,mobil_polisi=🚓,mobil_polisi_datang=🚔,taksi=🚕,taksi_datang=🚖,mobil_datang=🚘,kendaraan_rekreasi=🚙,truk_pikap=🛻,truk_pengiriman=🚚,lori_gandeng=🚛,traktor=🚜,mobil_balap=🏎,sepeda_motor=🏍,motor_skuter=🛵,kursi_roda_manual=🦽,kursi_roda_bermotor=🦼,bajaj=🛺,otoped=🛴,papan_luncur=🛹,sepatu_roda=🛼,halte_bus=🚏,jalan_raya=🛣,rel_kereta=🛤,drum_minyak=🛢,pompa_bahan_bakar=⛽,roda=🛞,lampu_mobil_polisi=🚨,lampu_lalu_lintas_horizontal=🚥,lampu_lalu_lintas_vertikal=🚦,rambu_stop=🛑,konstruksi=🚧,mercusuar=🛙,jangkar=⚓,ban_pelampung=🛟,perahu_layar=⛵,kano=🛶,perahu_cepat=🚤,kapal_penumpang=🛳,kapal_feri=⛴,perahu_bermotor=🛥,pesawat_kecil=🛩,pesawat_lepas_landas=🛫,pesawat_mendarat=🛬,parasut=🪂,kursi=💺,helikopter=🚁,kereta_suspensi=🚟,kereta_gantung=🚠,trem_gantung=🚡,satelit=🛰,piring_terbang=🛸,bel_meja=🛎,koper=🧳,jam_pasir=⌛,jam_pasir_yang_bergerak=⏳,jam_tangan=⌚,jam_weker=⏰,penghitung_waktu=⏲,jam_perapian=🕰,jam_dua_belas_tepat=🕛,jam_setengah_satu=🕧,jam_satu_tepat=🕐,jam_setengah_dua=🕜,jam_dua_tepat=🕑,jam_setengah_tiga=🕝,jam_tiga_tepat=🕒,jam_setengah_empat=🕞,jam_empat_tepat=🕓,jam_setengah_lima=🕟,jam_lima_tepat=🕔,jam_setengah_enam=🕠,jam_enam_tepat=🕕,jam_setengah_tujuh=🕡,jam_tujuh_tepat=🕖,jam_setengah_delapan=🕢,jam_delapan_tepat=🕗,jam_setengah_sembilan=🕣,jam_sembilan_tepat=🕘,jam_setengah_sepuluh=🕤,jam_sepuluh_tepat=🕙,jam_setengah_sebelas=🕥,jam_sebelas_tepat=🕚,jam_setengah_dua_belas=🕦,bulan_baru=🌑,bulan_sabit_awal=🌒,bulan_perbani_awal=🌓,bulan_cembung_awal=🌔,bulan_purnama=🌕,bulan_cembung_akhir=🌖,bulan_perbani_akhir=🌗,bulan_sabit_akhir=🌘,bulan_sabit=🌙,wajah_bulan_baru=🌚,wajah_bulan_perbani_awal=🌛,wajah_bulan_perbani_akhir=🌜,termometer=🌡,wajah_bulan_purnama=🌝,wajah_matahari=🌞,planet_bercincin=🪐,bintang_medium_putih=⭐,bintang_bersinar=🌟,bintang_jatuh=🌠,bima_sakti=🌌,matahari_di_balik_awan=⛅,awan_dengan_petir_dan_hujan=⛈,matahari_di_balik_awan_kecil=🌤,matahari_di_balik_awan_besar=🌥,matahari_di_balik_awan_hujan=🌦,awan_hujan=🌧,awan_salju=🌨,awan_petir=🌩,kabut=🌫,wajah_tertiup_angin=🌬,topan=🌀,payung_tertutup=🌂,payung_dengan_tetesan_hujan=☔,payung_di_tanah=⛱,tegangan_tinggi=⚡,serpihan_salju=❄️,boneka_salju_dengan_hujan_salju=☃,boneka_salju_tanpa_salju=⛄,komet=☄,meteor=🪋,tetesan_air=💧,ombak=🌊,pohon_natal=🎄,kembang_api=🎆,kembang_api_batang=🎇,petasan=🧨,berkilau=✨,balon=🎈,party_popper=🎉,bola_konfeti=🎊,pohon_tanabata=🎋,dekorasi_pinus=🎍,boneka_jepang=🎎,bendera_ikan_koi=🎏,lonceng_angin=🎐,perayaan_bulan=🎑,amplop_merah=🧧,pita=🎀,kado=🎁,pita_pengingat=🎗,tiket_masuk=🎟,tiket=🎫,medali_militer=🎖,piala=🏆,medali_olahraga=🏅,medali_emas=🥇,medali_perak=🥈,medali_perunggu=🥉,bola_sepak=⚽,bisbol=⚾,sofbol=🥎,bola_basket=🏀,bola_voli=🏐,american_football=🏈,sepak_bola_rugbi=🏉,tenis=🎾,lempar_cakram=🥏,kriket=🏏,hoki_lapangan=🏑,hoki_es=🏒,bulu_tangkis=🏸,sarung_tinju=🥊,seragam_beladiri=🥋,gawang=🥅,bendera_di_lubang_golf=⛳,seluncur_es=⛸,tongkat_pancing=🎣,kacamata_selam=🤿,kaos_lari=🎽,kereta_luncur=🛷,batu_curling=🥌,yo_yo=🪀,layang_layang=🪁,pistol_air=🔫,biliar_8_bola=🎱,bola_kristal=🔮,tongkat_ajaib=🪄,mesin_slot=🎰,dadu=🎲,keping_puzzle=🧩,boneka_beruang=🧸,pinata=🪅,bola_disko=🪩,boneka_bersarang=🪆,waru=♠️,wajik=♦️,keriting=♣️,pion_catur=♟,joker=🃏,naga_merah_mahyong=🀄,kartu_bunga=🎴,seni_drama=🎭,bingkai_bergambar=🖼,palet_pelukis=🎨,benang=🧵,jarum_jahit=🪡,gulungan_benang=🧶,simpul=🪢,kacamata=👓,kacamata_hitam=🕶,kacamata_renang=🥽,jas_laboratorium=🥼,rompi_pengaman=🦺,dasi=👔,kaos=👕,celana_jeans=👖,syal=🧣,sarung_tangan=🧤,mantel=🧥,kaus_kaki=🧦,gaun=👗,sari=🥻,pakaian_renang_one_piece=🩱,celana_renang=🩲,celana_pendek=🩳,pakaian_wanita=👚,kipas_tangan_lipat=🪭,tas_jinjing=👜,kantung=👝,tas_belanja=🛍,tas_sekolah=🎒,sandal_jepit=🩴,sepatu_pria=👞,sepatu_lari=👟,sepatu_boot_untuk_mendaki=🥾,sepatu_flat=🥿,sepatu_hak_tinggi=👠,sandal_wanita=👡,sepatu_balet=🩰,sepatu_bot_wanita=👢,sisir_garpu=🪮,topi_wanita=👒,topi_tinggi=🎩,topi_wisuda=🎓,topi_berlidah=🧢,helm_tentara=🪖,helm_dengan_palang_putih=⛑,tasbih=📿,lipstik=💄,cincin=💍,batu_permata=💎,speaker_mati=🔇,volume_speaker_rendah=🔈,volume_speaker_medium=🔉,volume_speaker_tinggi=🔊,pengeras_suara=📢,megafon=📣,trompet_pos=📯,lonceng_dicoret=🔕,naskah_musik=🎼,not_musik=🎵,not_not_musik=🎶,mikrofon_studio=🎙,penggeser_tingkat=🎚,kenop_kontrol=🎛,headphone=🎧,saksofon=🎷,trompet=🎺,trombon=🪊,akordeon=🪗,gitar=🎸,keyboard_musik=🎹,biola=🎻,banjo=🪕,gendang=🪘,marakas=🪇,seruling=🪈,harpa=🪉,telepon_masuk=📲,gagang_telepon=📞,mesin_faks=📠,baterai=🔋,baterai_lemah=🪫,steker=🔌,komputer_laptop=💻,komputer_desktop=🖥,mouse_komputer=🖱,disk_komputer=💽,disket=💾,disk_optik=💿,sempoa=🧮,kamera_film=🎥,frame_film=🎞,proyektor_film=📽,papan_sutradara=🎬,televisi=📺,kamera_dengan_flash=📸,kamera_video=📹,kaset_video=📼,kaca_pembesar_arah_kiri=🔍,kaca_pembesar_arah_kanan=🔎,lilin=🕯,bohlam=💡,lampu_senter=🔦,lampion_merah=🏮,lampu_diya=🪔,buku_catatan_bersampul=📔,buku_tertutup=📕,buku_terbuka=📖,buku_hijau=📗,buku_biru=📘,buku_oranye=📙,buku_besar=📒,halaman_tergulung=📃,gulungan=📜,halaman_tampak_depan=📄,koran=📰,gulungan_koran=🗞,penanda_halaman_buku=📑,pembatas_buku=🔖,kantung_uang=💰,peti_harta_karun=🪎,uang_kertas_yen=💴,uang_kertas_dolar=💵,uang_kertas_euro=💶,uang_kertas_pound=💷,uang_bersayap=💸,kartu_kredit=💳,kuitansi=🧾,bagan_meningkat_dengan_yen=💹,amplop=✉️,amplop_datang=📨,amplop_dengan_panah=📩,baki_kotak_keluar=📤,baki_kotak_masuk=📥,paket=📦,kotak_surat_tertutup_dengan_bendera_terangkat=📫,kotak_surat_tertutup_dengan_bendera_turun=📪,kotak_surat_terbuka_dengan_bendera_terangkat=📬,kotak_surat_terbuka_dengan_bendera_turun=📭,kotak_pos=📮,kotak_dengan_surat_suara=🗳,ujung_pena=✒️,pena_tinta=🖋,pena=🖊,kuas=🖌,krayon=🖍,penghapus=🪌,tas_kantor=💼,folder_file=📁,folder_file_terbuka=📂,pembagi_indeks_kartu=🗂,kalender_sobek=📆,catatan_spiral=🗒,kalender_spiral=🗓,indeks_kartu=📇,bagan_meningkat=📈,bagan_menurun=📉,diagram_batang=📊,papan_klip=📋,paku_penanda=📌,paku_penanda_bulat=📍,klip_kertas=📎,klip_kertas_tertaut=🖇,penggaris_lurus=📏,penggaris_segitiga=📐,kotak_file_kartu=🗃,lemari_file=🗄,keranjang_sampah=🗑,gembok_terbuka=🔓,gembok_terkunci_dengan_pena=🔏,gembok_terkunci_dengan_kunci=🔐,kunci_antik=🗝,jaring_dengan_gagang=🪍,kapak=🪓,beliung=⛏,palu_dan_beliung=⚒,palu_dan_kunci_inggris=🛠,belati=🗡,pedang_bersilang=⚔,bom=💣,bumerang=🪃,busur_dan_panah=🏹,gergaji_kayu=🪚,kunci_inggris=🔧,obeng=🪛,mur_dan_baut=🔩,roda_gigi=⚙,klem=🗜,timbangan_gantung=⚖,tongkat_tunanetra=🦯,tautan=🔗,rantai_putus=⛓‍💥,rantai=⛓,kait=🪝,kotak_perkakas=🧰,tangga=🪜,sekop=🪏,tabung_uji=🧪,cawan_petri=🧫,mikroskop=🔬,teleskop=🔭,antena_satelit=📡,suntikan=💉,tetesan_darah=🩸,pil=💊,plester_luka=🩹,kruk=🩼,stetoskop=🩺,sinar_x=🩻,pintu=🚪,elevator=🛗,cermin=🪞,jendela=🪟,tempat_tidur=🛏,sofa_dan_lampu=🛋,bangku=🪑,penyedot_wc=🪠,perangkap_tikus=🪤,pisau_cukur=🪒,botol_losion=🧴,peniti=🧷,sapu=🧹,gulungan_kertas=🧻,ember=🪣,sabun=🧼,gelembung=🫧,sikat_gigi=🪥,spons=🧽,alat_pemadam_api_ringan=🧯,troli_belanja=🛒,rokok=🚬,peti_mati=⚰,batu_nisan=🪦,guci_abu=⚱,jimat_nazar=🧿,hamsa=🪬,moai=🗿,plakat=🪧,kartu_identitas=🪪,tanda_atm=🏧,tanda_membuang_sampah=🚮,air_dapat_diminum=🚰,simbol_kursi_roda=♿,toilet_pria=🚹,toilet_wanita=🚺,kamar_kecil=🚻,simbol_bayi=🚼,kloset_air=🚾,kontrol_paspor=🛂,bea_cukai=🛃,pengambilan_bagasi=🛄,koper_tertinggal=🛅,anak_anak_menyeberang=🚸,dilarang_masuk=⛔,dilarang=🚫,dilarang_bersepeda=🚳,dilarang_merokok=🚭,dilarang_membuang_sampah_sembarangan=🚯,air_tidak_dapat_diminum=🚱,pejalan_kaki_dilarang_masuk=🚷,dilarang_menggunakan_ponsel=📵,di_bawah_18_tahun_dilarang=🔞,radioaktif=☢,tanda_panah_atas=⬆️,tanda_panah_kanan_atas=↗️,tanda_panah_kanan=➡️,tanda_panah_kanan_bawah=↘️,tanda_panah_bawah=⬇️,tanda_panah_kiri_bawah=↙️,tanda_panah_kiri=⬅️,tanda_panah_kiri_atas=↖️,tanda_panah_atas_bawah=↕️,tanda_panah_kiri_kanan=↔️,panah_arah_kanan_kiri=↮,tanda_panah_kanan_melengkung_ke_kiri=↩️,tanda_panah_kanan_melengkung_ke_kanan=↪️,tanda_panah_kanan_melengkung_ke_atas=⤴️,tanda_panah_kanan_melengkung_ke_bawah=⤵️,tanda_panah_searah_jarum_jam=🔃,tanda_panah_berlawanan_arah_jarum_jam=🔄,tanda_panah_back=🔙,tanda_panah_end=🔚,tanda_panah_on=🔛,tanda_panah_soon=🔜,tanda_panah_top=🔝,tempat_ibadah=🛐,simbol_atom=⚛,bintang_daud=✡,roda_dharma=☸,salib_latin=✝,salib_ortodoks=☦,bintang_dan_bulan=☪,simbol_damai=☮,bintang_sudut_enam_bertitik=🔯,khanda=🪯,scorpio=♏,sagitarius=♐,tombol_acak_lagu=🔀,tombol_ulangi=🔁,tombol_ulangi_satu_lagu=🔂,tombol_putar=▶️,tombol_maju_cepat=⏩,tombol_lagu_berikutnya=⏭,tombol_putar_atau_jeda=⏯,tombol_mundur=◀️,tombol_mundur_cepat=⏪,tombol_lagu_terakhir=⏮,tombol_naik=🔼,tombol_naik_cepat=⏫,tombol_turun=🔽,tombol_turun_cepat=⏬,tombol_jeda=⏸,tombol_berhenti=⏹,tombol_rekam=⏺,tombol_keluarkan=⏏️,film=🎦,tombol_redupkan=🔅,tombol_cerahkan=🔆,batang_antena=📶,nirkabel=🛜,mode_getar=📳,ponsel_nonaktif=📴,simbol_wanita=♀,simbol_pria=♂,simbol_transgender=⚧,kali=✖️,tambah=➕,kurang=➖,bagi=➗,tanda_sama_dengan_tebal=🟰,tak_terhingga=♾,tanda_seru_ganda=‼️,tanda_seru_dan_tanya=⁉️,tanda_tanya_merah=❓,tanda_tanya_putih=❔,tanda_seru_putih=❕,tanda_seru_merah=❗,garis_bergelombang=〰️,kurs=💱,tanda_dolar_tebal=💲,simbol_kedokteran=⚕,simbol_daur_ulang=♻️,emblem_trisula=🔱,lencana_nama=📛,simbol_jepang_untuk_pemula=🔰,lingkaran_besar_tebal=⭕,tanda_centang_putih_tebal=✅,kotak_bercentang=☑️,tanda_centang_tebal=✔️,tanda_silang=❌,tombol_tanda_silang=❎,untaian_bergelombang=➰,untaian_bergelombang_ganda=➿,tanda_alternasi_bagian=〽️,bintang_berujung_lancip_delapan=✳️,bintang_berujung_delapan=✴️,kilauan=❇️,hak_cipta=©️,terdaftar=®️,merek_dagang=™️,percikan=🫟,masukan_huruf_kapital_latin=🔠,masukan_huruf_kecil_latin=🔡,masukan_angka=🔢,masukan_simbol=🔣,masukan_huruf_latin=🔤,tombol_a_golongan_darah=🅰️,tombol_ab_golongan_darah=🆎,tombol_b_golongan_darah=🅱️,tombol_cl=🆑,tombol_cool=🆒,tombol_free=🆓,informasi=ℹ️,tombol_id=🆔,huruf_m_dalam_lingkaran=Ⓜ️,tombol_new=🆕,tombol_ng=🆖,tombol_o_golongan_darah=🅾️,tombol_ok=🆗,tombol_p=🅿️,tombol_sos=🆘,tombol_up=🆙,tombol_vs=🆚,tombol_jepang_di_sini=🈁,tombol_jepang_biaya_layanan=🈂️,tombol_jepang_jumlah_bulanan=🈷️,tombol_jepang_tidak_gratis=🈶,tombol_jepang_sudah_dipesan=🈯,karakter_keunggulan_dalam_lingkaran=🉐,tombol_jepang_diskon=🈹,tombol_jepang_gratis=🈚,tombol_jepang_dilarang=🈲,tombol_jepang_dapat_diterima=🉑,tombol_jepang_lamaran_kerja=🈸,tombol_jepang_nilai_kelulusan=🈴,tombol_jepang_ada_lowongan=🈳,tombol_jepang_selamat=㊗️,tombol_jepang_rahasia=㊙️,tombol_jepang_siap_berbisnis=🈺,tombol_jepang_tidak_ada_lowongan=🈵,lingkaran_merah=🔴,lingkaran_oranye=🟠,lingkaran_kuning=🟡,lingkaran_hijau=🟢,lingkaran_biru=🔵,lingkaran_ungu=🟣,lingkaran_cokelat=🟤,lingkaran_hitam=⚫,lingkaran_putih=⚪,persegi_merah=🟥,persegi_oranye=🟧,persegi_kuning=🟨,persegi_hijau=🟩,persegi_biru=🟦,persegi_ungu=🟪,persegi_cokelat=🟫,persegi_besar_hitam=⬛,persegi_besar_putih=⬜,persegi_medium_hitam=◼️,persegi_medium_putih=◻️,persegi_kecil_medium_hitam=◾,persegi_kecil_medium_putih=◽,persegi_kecil_hitam=▪️,persegi_kecil_putih=▫️,wajik_oranye_besar=🔶,wajik_biru_besar=🔷,wajik_oranye_kecil=🔸,wajik_biru_kecil=🔹,segitiga_merah_mengarah_ke_atas=🔺,segitiga_merah_mengarah_ke_bawah=🔻,wajik_bertitik=💠,tombol_radio=🔘,tombol_persegi_putih=🔳,tombol_persegi_hitam=🔲,bendera_kotak_kotak=🏁,bendera_segitiga=🚩,bendera_menyilang=🎌,bendera_hitam=🏴,bendera_putih=🏳,bendera_pelangi=🏳️‍🌈,bendera_transgender=🏳‍⚧,bendera_bajak_laut=🏴‍☠️,sen=¢,cruzeiro=₢,franc_prancis=₣,lira=₤,mill=₥,won=₩,penny_jerman=₰,peso=₱,austral=₳,livre_tournois=₶,spesmilo=₷,rupee_india=₹,ruble=₽,bitcoin=₿,keycap_0=0️⃣,keycap_1=1️⃣,keycap_2=2️⃣,keycap_3=3️⃣,keycap_4=4️⃣,keycap_5=5️⃣,keycap_6=6️⃣,keycap_7=7️⃣,keycap_8=8️⃣,keycap_9=9️⃣,satu_superskrip=¹,dua_superskrip=²,tiga_superskrip=³,rupee=₨,tanda_mikro=µ,rial=﷼";
  const MI_PATHS = {"badge":"M240-240h240v-18q0-17-9.5-31.5T444-312q-20-9-40.5-13.5T360-330q-23 0-43.5 4.5T276-312q-17 8-26.5 22.5T240-258v18Zm350-60h100q13 0 21.5-8.5T720-330q0-13-8.5-21.5T690-360H590q-13 0-21.5 8.5T560-330q0 13 8.5 21.5T590-300Zm-230-60q25 0 42.5-17.5T420-420q0-25-17.5-42.5T360-480q-25 0-42.5 17.5T300-420q0 25 17.5 42.5T360-360Zm230-60h100q13 0 21.5-8.5T720-450q0-13-8.5-21.5T690-480H590q-13 0-21.5 8.5T560-450q0 13 8.5 21.5T590-420ZM160-80q-33 0-56.5-23.5T80-160v-440q0-33 23.5-56.5T160-680h200v-120q0-33 23.5-56.5T440-880h80q33 0 56.5 23.5T600-800v120h200q33 0 56.5 23.5T880-600v440q0 33-23.5 56.5T800-80H160Zm0-80h640v-440H600q0 33-23.5 56.5T520-520h-80q-33 0-56.5-23.5T360-600H160v440Zm280-440h80v-200h-80v200Zm40 220Z","data_usage":"M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-130 75-234t199-145q29-10 53.5 7t24.5 46q0 20-11.5 36.5T391-747q-86 27-138.5 100.5T200-480q0 117 81.5 198.5T480-200q52 0 100.5-18t86.5-52q15-14 36.5-14t36.5 14q23 21 24 47.5T742-176q-54 47-120.5 71.5T480-80Zm280-400q0-92-53-165.5T568-747q-18-6-29.5-22.5T527-806q0-29 24.5-46t53.5-7q125 42 200 146t75 233q0 18-1.5 36.5T873-403q-5 29-29.5 41.5T790-360q-19-7-29.5-25.5T754-424q3-17 4.5-30t1.5-26Z","done_all":"M70-438q-12-12-11.5-28T71-494q12-11 28-11.5t28 11.5l142 142 14 14 14 14q12 12 11.5 28T296-268q-12 11-28 11.5T240-268L70-438Zm424 85 340-340q12-12 28-11.5t28 12.5q11 12 11.5 28T890-636L522-268q-12 12-28 12t-28-12L296-438q-11-11-11-27.5t11-28.5q12-12 28.5-12t28.5 12l141 141Zm169-282L522-494q-11 11-27.5 11T466-494q-12-12-12-28.5t12-28.5l141-141q11-11 27.5-11t28.5 11q12 12 12 28.5T663-635Z","arrow_upward":"M440-647 244-451q-12 12-28 11.5T188-452q-11-12-11.5-28t11.5-28l264-264q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l264 264q11 11 11 27.5T772-452q-12 12-28.5 12T715-452L520-647v447q0 17-11.5 28.5T480-160q-17 0-28.5-11.5T440-200v-447Z","military_tech":"m480-174-74 56q-12 9-24 .5t-7-22.5l29-92-73-52q-12-8-7-22t19-14h89l28-92-142-84q-18-11-28-29t-10-41v-234q0-33 23.5-56.5T360-880h240q33 0 56.5 23.5T680-800v234q0 23-10 41t-28 29l-142 84 28 92h89q14 0 19 14t-7 22l-73 52 29 92q5 14-7 22.5t-24-.5l-74-56ZM360-800v234l80 48v-282h-80Zm240 0h-80v282l80-48v-234ZM480-647Zm-40-12Zm80 0Z","receipt":"M120-104v-752q0-7 6-9.5t11 2.5l29 29q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l29-29q5-5 11-2.5t6 9.5v752q0 7-6 9.5T823-97l-29-29q-6-6-14-6t-14 6l-32 32q-6 6-14 6t-14-6l-32-32q-6-6-14-6t-14 6l-32 32q-6 6-14 6t-14-6l-32-32q-6-6-14-6t-14 6l-32 32q-6 6-14 6t-14-6l-32-32q-6-6-14-6t-14 6l-32 32q-6 6-14 6t-14-6l-32-32q-6-6-14-6t-14 6l-32 32q-6 6-14 6t-14-6l-32-32q-6-6-14-6t-14 6l-29 29q-5 5-11 2.5t-6-9.5Zm160-176h400q17 0 28.5-11.5T720-320q0-17-11.5-28.5T680-360H280q-17 0-28.5 11.5T240-320q0 17 11.5 28.5T280-280Zm0-160h400q17 0 28.5-11.5T720-480q0-17-11.5-28.5T680-520H280q-17 0-28.5 11.5T240-480q0 17 11.5 28.5T280-440Zm0-160h400q17 0 28.5-11.5T720-640q0-17-11.5-28.5T680-680H280q-17 0-28.5 11.5T240-640q0 17 11.5 28.5T280-600Zm-80 404h560v-568H200v568Zm0-568v568-568Z","light_mode":"M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM80-440q-17 0-28.5-11.5T40-480q0-17 11.5-28.5T80-520h80q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440H80Zm720 0q-17 0-28.5-11.5T760-480q0-17 11.5-28.5T800-520h80q17 0 28.5 11.5T920-480q0 17-11.5 28.5T880-440h-80ZM480-760q-17 0-28.5-11.5T440-800v-80q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v80q0 17-11.5 28.5T480-760Zm0 720q-17 0-28.5-11.5T440-80v-80q0-17 11.5-28.5T480-200q17 0 28.5 11.5T520-160v80q0 17-11.5 28.5T480-40ZM226-678l-43-42q-12-11-11.5-28t11.5-29q12-12 29-12t28 12l42 43q11 12 11 28t-11 28q-11 12-27.5 11.5T226-678Zm494 495-42-43q-11-12-11-28.5t11-27.5q11-12 27.5-11.5T734-282l43 42q12 11 11.5 28T777-183q-12 12-29 12t-28-12Zm-42-495q-12-11-11.5-27.5T678-734l42-43q11-12 28-11.5t29 11.5q12 12 12 29t-12 28l-43 42q-12 11-28 11t-28-11ZM183-183q-12-12-12-29t12-28l43-42q12-11 28.5-11t27.5 11q12 11 11.5 27.5T282-226l-42 43q-11 12-28 11.5T183-183Zm297-297Z","campaign":"M840-440h-80q-17 0-28.5-11.5T720-480q0-17 11.5-28.5T760-520h80q17 0 28.5 11.5T880-480q0 17-11.5 28.5T840-440ZM664-288q10-14 26-16t30 8l64 48q14 10 16 26t-8 30q-10 14-26 16t-30-8l-64-48q-14-10-16-26t8-30Zm120-424-64 48q-14 10-30 8t-26-16q-10-14-8-30t16-26l64-48q14-10 30-8t26 16q10 14 8 30t-16 26ZM200-360h-40q-33 0-56.5-23.5T80-440v-80q0-33 23.5-56.5T160-600h160l139-84q20-12 40.5 0t20.5 35v338q0 23-20.5 35t-40.5 0l-139-84h-40v120q0 17-11.5 28.5T240-200q-17 0-28.5-11.5T200-240v-120Zm240-22v-196l-98 58H160v80h182l98 58Zm120 36v-268q27 24 43.5 58.5T620-480q0 41-16.5 75.5T560-346ZM300-480Z","person":"M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-240v-32q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v32q0 33-23.5 56.5T720-160H240q-33 0-56.5-23.5T160-240Zm80 0h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm0-80Zm0 400Z","redo":"M648-560H396q-63 0-109.5 40T240-420q0 60 46.5 100T396-280h244q17 0 28.5 11.5T680-240q0 17-11.5 28.5T640-200H396q-97 0-166.5-63T160-420q0-94 69.5-157T396-640h252l-76-76q-11-11-11-28t11-28q11-11 28-11t28 11l144 144q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L628-428q-11 11-28 11t-28-11q-11-11-11-28t11-28l76-76Z","category":"m297-581 149-243q6-10 15-14.5t19-4.5q10 0 19 4.5t15 14.5l149 243q6 10 6 21t-5 20q-5 9-14 14.5t-21 5.5H331q-12 0-21-5.5T296-540q-5-9-5-20t6-21ZM700-80q-75 0-127.5-52.5T520-260q0-75 52.5-127.5T700-440q75 0 127.5 52.5T880-260q0 75-52.5 127.5T700-80Zm-580-60v-240q0-17 11.5-28.5T160-420h240q17 0 28.5 11.5T440-380v240q0 17-11.5 28.5T400-100H160q-17 0-28.5-11.5T120-140Zm580-20q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Zm-500-20h160v-160H200v160Zm202-420h156l-78-126-78 126Zm78 0ZM360-340Zm340 80Z","volunteer_activism":"m558-144 238-74q-5-9-14.5-15.5T760-240H558q-27 0-43-2t-33-8l-57-19q-16-5-23-20t-2-31q5-16 19.5-23.5T450-346l42 14q17 5 38.5 8t58.5 4h11q0-11-6.5-21T578-354l-234-86h-64v220l278 76Zm-21 78-257-72q-8 26-31.5 42T200-80h-80q-33 0-56.5-23.5T40-160v-280q0-33 23.5-56.5T120-520h224q7 0 14 1.5t13 3.5l235 87q33 12 53.5 42t20.5 66h80q50 0 85 33t35 87q0 22-11.5 34.5T833-145L583-67q-11 4-23 4t-23-3Zm-417-94h80v-280h-80v280Zm520-312q-15 0-29.5-5.5T584-494L474-602q-31-30-52.5-66.5T400-748q0-55 38.5-93.5T532-880q32 0 60 13.5t48 36.5q20-23 48-36.5t60-13.5q55 0 93.5 38.5T880-748q0 43-21 79.5T807-602L696-494q-12 11-26.5 16.5T640-472Zm0-80 109-107q19-19 35-40.5t16-48.5q0-22-15-37t-37-15q-14 0-26.5 5.5T700-778l-29 35q-12 14-31 14t-31-14l-29-35q-9-11-21.5-16.5T532-800q-22 0-37 15t-15 37q0 27 16 48.5t35 40.5l109 107Zm0-154Z","key":"M280-400q-33 0-56.5-23.5T200-480q0-33 23.5-56.5T280-560q33 0 56.5 23.5T360-480q0 33-23.5 56.5T280-400Zm0 160q-100 0-170-70T40-480q0-100 70-170t170-70q67 0 121.5 33t86.5 87h335q8 0 15.5 3t13.5 9l80 80q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L805-325q-5 5-12 8t-14 4q-7 1-14-1t-13-7l-52-39-57 43q-5 4-11 6t-12 2q-6 0-12.5-2t-11.5-6l-61-43h-47q-32 54-86.5 87T280-240Zm0-80q56 0 98.5-34t56.5-86h125l58 41v.5-.5l82-61 71 55 75-75h-.5.5l-40-40v-.5.5H435q-14-52-56.5-86T280-640q-66 0-113 47t-47 113q0 66 47 113t113 47Z","description":"M360-240h240q17 0 28.5-11.5T640-280q0-17-11.5-28.5T600-320H360q-17 0-28.5 11.5T320-280q0 17 11.5 28.5T360-240Zm0-160h240q17 0 28.5-11.5T640-440q0-17-11.5-28.5T600-480H360q-17 0-28.5 11.5T320-440q0 17 11.5 28.5T360-400ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h287q16 0 30.5 6t25.5 17l194 194q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-440H560q-17 0-28.5-11.5T520-640ZM240-800v200-200 640-640Z","science":"M200-120q-51 0-72.5-45.5T138-250l222-270v-240h-40q-17 0-28.5-11.5T280-800q0-17 11.5-28.5T320-840h320q17 0 28.5 11.5T680-800q0 17-11.5 28.5T640-760h-40v240l222 270q32 39 10.5 84.5T760-120H200Zm0-80h560L520-492v-268h-80v268L200-200Zm280-280Z","database":"M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z","my_location":"M440-82v-40q-125-14-214.5-103.5T122-440H82q-17 0-28.5-11.5T42-480q0-17 11.5-28.5T82-520h40q14-125 103.5-214.5T440-838v-40q0-17 11.5-28.5T480-918q17 0 28.5 11.5T520-878v40q125 14 214.5 103.5T838-520h40q17 0 28.5 11.5T918-480q0 17-11.5 28.5T878-440h-40q-14 125-103.5 214.5T520-122v40q0 17-11.5 28.5T480-42q-17 0-28.5-11.5T440-82Zm40-118q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm0-80Z","edit":"M200-200h57l391-391-57-57-391 391v57Zm-40 80q-17 0-28.5-11.5T120-160v-97q0-16 6-30.5t17-25.5l505-504q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L313-143q-11 11-25.5 17t-30.5 6h-97Zm600-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z","logout":"M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240q17 0 28.5 11.5T480-800q0 17-11.5 28.5T440-760H200v560h240q17 0 28.5 11.5T480-160q0 17-11.5 28.5T440-120H200Zm487-320H400q-17 0-28.5-11.5T360-480q0-17 11.5-28.5T400-520h287l-75-75q-11-11-11-27t11-28q11-12 28-12.5t29 11.5l143 143q12 12 12 28t-12 28L669-309q-12 12-28.5 11.5T612-310q-11-12-10.5-28.5T613-366l74-74Z","local_cafe":"M200-120q-17 0-28.5-11.5T160-160q0-17 11.5-28.5T200-200h560q17 0 28.5 11.5T800-160q0 17-11.5 28.5T760-120H200Zm120-160q-66 0-113-47t-47-113v-320q0-33 23.5-56.5T240-840h560q33 0 56.5 23.5T880-760v120q0 33-23.5 56.5T800-560h-80v120q0 66-47 113t-113 47H320Zm0-80h240q33 0 56.5-23.5T640-440v-320H240v320q0 33 23.5 56.5T320-360Zm400-280h80v-120h-80v120ZM320-360h-80 400-320Z","apartment":"M200-120q-33 0-56.5-23.5T120-200v-400q0-33 23.5-56.5T200-680h80v-80q0-33 23.5-56.5T360-840h240q33 0 56.5 23.5T680-760v240h80q33 0 56.5 23.5T840-440v240q0 33-23.5 56.5T760-120H520v-160h-80v160H200Zm0-80h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 480h80v-80h-80v80Zm0-160h80v-80h-80v80Z","stop":"M240-320v-320q0-33 23.5-56.5T320-720h320q33 0 56.5 23.5T720-640v320q0 33-23.5 56.5T640-240H320q-33 0-56.5-23.5T240-320Zm80 0h320v-320H320v320Zm160-160Z","lightbulb":"M480-80q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM360-200q-17 0-28.5-11.5T320-240q0-17 11.5-28.5T360-280h240q17 0 28.5 11.5T640-240q0 17-11.5 28.5T600-200H360Zm-30-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z","refresh":"M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-70q0-17 11.5-28.5T760-800q17 0 28.5 11.5T800-760v200q0 17-11.5 28.5T760-520H560q-17 0-28.5-11.5T520-560q0-17 11.5-28.5T560-600h128q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q68 0 124.5-34.5T692-367q8-14 22.5-19.5t29.5-.5q16 5 23 21t-1 30q-41 80-117 128t-169 48Z","book":"M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h480q33 0 56.5 23.5T800-800v640q0 33-23.5 56.5T720-80H240Zm0-80h480v-640h-80v245q0 12-10 17.5t-20-.5l-49-30q-10-6-20.5-6t-20.5 6l-49 30q-10 6-20.5.5T440-555v-245H240v640Zm0 0v-640 640Zm200-395q0 12 10.5 17.5t20.5-.5l49-30q10-6 20.5-6t20.5 6l49 30q10 6 20 .5t10-17.5q0 12-10 17.5t-20-.5l-49-30q-10-6-20.5-6t-20.5 6l-49 30q-10 6-20.5.5T440-555Z","undo":"M320-200q-17 0-28.5-11.5T280-240q0-17 11.5-28.5T320-280h244q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l76 76q11 11 11 28t-11 28q-11 11-28 11t-28-11L188-572q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l144-144q11-11 28-11t28 11q11 11 11 28t-11 28l-76 76h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H320Z","lock":"M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm240-120q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z","close":"M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z","person_add":"M720-520h-80q-17 0-28.5-11.5T600-560q0-17 11.5-28.5T640-600h80v-80q0-17 11.5-28.5T760-720q17 0 28.5 11.5T800-680v80h80q17 0 28.5 11.5T920-560q0 17-11.5 28.5T880-520h-80v80q0 17-11.5 28.5T760-400q-17 0-28.5-11.5T720-440v-80Zm-360 40q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM40-240v-32q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v32q0 33-23.5 56.5T600-160H120q-33 0-56.5-23.5T40-240Zm80 0h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0-80Zm0 400Z","terminal":"M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm187-200-76-76q-12-12-11.5-28t12.5-28q12-11 28-11.5t28 11.5l104 104q12 12 12 28t-12 28L328-308q-11 11-27.5 11.5T272-308q-11-11-11-28t11-28l75-76Zm173 160q-17 0-28.5-11.5T480-320q0-17 11.5-28.5T520-360h160q17 0 28.5 11.5T720-320q0 17-11.5 28.5T680-280H520Z","trending_up":"M108-255q-12-12-11.5-28.5T108-311l211-214q23-23 57-23t57 23l103 104 208-206h-64q-17 0-28.5-11.5T640-667q0-17 11.5-28.5T680-707h160q17 0 28.5 11.5T880-667v160q0 17-11.5 28.5T840-467q-17 0-28.5-11.5T800-507v-64L593-364q-23 23-57 23t-57-23L376-467 164-255q-11 11-28 11t-28-11Z","expand_less":"M480-529 324-373q-11 11-28 11t-28-11q-11-11-11-28t11-28l184-184q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l184 184q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-529Z","school":"M242-249q-20-11-31-29.5T200-320v-192l-96-53q-11-6-16-15t-5-20q0-11 5-20t16-15l338-184q9-5 18.5-7.5T480-829q10 0 19.5 2.5T518-819l381 208q10 5 15.5 14.5T920-576v256q0 17-11.5 28.5T880-280q-17 0-28.5-11.5T840-320v-236l-80 44v192q0 23-11 41.5T718-249L518-141q-9 5-18.5 7.5T480-131q-10 0-19.5-2.5T442-141L242-249Zm238-203 274-148-274-148-274 148 274 148Zm0 241 200-108v-151l-161 89q-9 5-19 7.5t-20 2.5q-10 0-20-2.5t-19-7.5l-161-89v151l200 108Zm0-241Zm0 121Zm0 0Z","temple_hindu":"M80-160v-320q0-17 11.5-28.5T120-520q17 0 28.5 11.5T160-480v40h80l119-395v-45q0-17 11.5-28.5T399-920q17 0 28.5 11.5T439-880v40h81v-40q0-17 11.5-28.5T560-920q17 0 28.5 11.5T600-880v40l120 400h80v-40q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480v320q0 33-23.5 56.5T800-80H560q-17 0-28.5-11.5T520-120v-160h-80v160q0 17-11.5 28.5T400-80H160q-33 0-56.5-23.5T80-160Zm268-360h264l-24-80H372l-24 80Zm48-160h168l-24-80H420l-24 80ZM160-160h200v-120q0-33 23.5-56.5T440-360h80q33 0 56.5 23.5T600-280v120h200v-200h-80q-26 0-47.5-15.5T643-417l-7-23H324l-7 23q-8 26-29.5 41.5T240-360h-80v200Zm320-280Z","history":"M480-120q-126 0-223-76.5T131-392q-4-15 6-27.5t27-14.5q16-2 29 6t18 24q24 90 99 147t170 57q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h70q17 0 28.5 11.5T360-600q0 17-11.5 28.5T320-560H160q-17 0-28.5-11.5T120-600v-160q0-17 11.5-28.5T160-800q17 0 28.5 11.5T200-760v54q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm40-376 100 100q11 11 11 28t-11 28q-11 11-28 11t-28-11L452-452q-6-6-9-13.5t-3-15.5v-159q0-17 11.5-28.5T480-680q17 0 28.5 11.5T520-640v144Z","chevron_left":"m432-480 156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L348-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L432-480Z","pause":"M600-200q-33 0-56.5-23.5T520-280v-400q0-33 23.5-56.5T600-760h80q33 0 56.5 23.5T760-680v400q0 33-23.5 56.5T680-200h-80Zm-320 0q-33 0-56.5-23.5T200-280v-400q0-33 23.5-56.5T280-760h80q33 0 56.5 23.5T440-680v400q0 33-23.5 56.5T360-200h-80Zm320-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z","monitoring":"M160-120q-17 0-28.5-11.5T120-160v-40q0-17 11.5-28.5T160-240q17 0 28.5 11.5T200-200v40q0 17-11.5 28.5T160-120Zm160 0q-17 0-28.5-11.5T280-160v-220q0-17 11.5-28.5T320-420q17 0 28.5 11.5T360-380v220q0 17-11.5 28.5T320-120Zm160 0q-17 0-28.5-11.5T440-160v-140q0-17 11.5-28.5T480-340q17 0 28.5 11.5T520-300v140q0 17-11.5 28.5T480-120Zm160 0q-17 0-28.5-11.5T600-160v-200q0-17 11.5-28.5T640-400q17 0 28.5 11.5T680-360v200q0 17-11.5 28.5T640-120Zm160 0q-17 0-28.5-11.5T760-160v-360q0-17 11.5-28.5T800-560q17 0 28.5 11.5T840-520v360q0 17-11.5 28.5T800-120ZM560-481q-16 0-30.5-6T503-504L400-607 188-395q-12 12-28.5 11.5T131-396q-11-12-10.5-28.5T132-452l211-211q12-12 26.5-17.5T400-686q16 0 31 5.5t26 17.5l103 103 212-212q12-12 28.5-11.5T829-771q11 12 10.5 28.5T828-715L617-504q-11 11-26 17t-31 6Z","candlestick_chart":"M280-200v-40h-40q-17 0-28.5-11.5T200-280v-400q0-17 11.5-28.5T240-720h40v-40q0-17 11.5-28.5T320-800q17 0 28.5 11.5T360-760v40h40q17 0 28.5 11.5T440-680v400q0 17-11.5 28.5T400-240h-40v40q0 17-11.5 28.5T320-160q-17 0-28.5-11.5T280-200Zm0-120h80v-320h-80v320Zm320 120v-160h-40q-17 0-28.5-11.5T520-400v-200q0-17 11.5-28.5T560-640h40v-120q0-17 11.5-28.5T640-800q17 0 28.5 11.5T680-760v120h40q17 0 28.5 11.5T760-600v200q0 17-11.5 28.5T720-360h-40v160q0 17-11.5 28.5T640-160q-17 0-28.5-11.5T600-200Zm0-240h80v-120h-80v120Zm-280-40Zm320-20Z","fitness_center":"M282-622 168-508q-11 11-27.5 11.5T112-508q-11-11-11.5-27.5T111-564l29-30-28-28q-12-12-12-28t12-28l56-56-29-30q-11-11-11-27.5t12-28.5q11-11 27.5-11.5T196-821l30 29 56-56q12-12 28-12t28 12l28 28 30-29q11-11 27.5-11t28.5 12q11 11 11 28t-11 28L338-678l340 340 114-114q11-11 27.5-11.5T848-452q11 11 11.5 27.5T849-396l-29 30 28 28q12 12 12 28t-12 28l-56 56 29 30q11 11 11 27.5T820-140q-11 11-27.5 11.5T764-139l-30-29-56 56q-12 12-28 12t-28-12l-28-28-30 29q-11 11-27.5 11T508-112q-11-11-11-28t11-28l114-114-340-340Z","pie_chart":"M520-520h278q-15-110-91.5-186.5T520-798v278Zm-80 358v-636q-121 15-200.5 105.5T160-480q0 122 79.5 212.5T440-162Zm80 0q110-14 187-91t91-187H520v278Zm-40-318Zm0 400q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 155.5 31.5t127 86q54.5 54.5 86 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Z","play_arrow":"M320-273v-414q0-17 12-28.5t28-11.5q5 0 10.5 1.5T381-721l326 207q9 6 13.5 15t4.5 19q0 10-4.5 19T707-446L381-239q-5 3-10.5 4.5T360-233q-16 0-28-11.5T320-273Zm80-207Zm0 134 210-134-210-134v268Z","checklist":"m221-313 142-142q12-12 28-11.5t28 12.5q11 12 11 28t-11 28L250-228q-12 12-28 12t-28-12l-86-86q-11-11-11-28t11-28q11-11 28-11t28 11l57 57Zm0-320 142-142q12-12 28-11.5t28 12.5q11 12 11 28t-11 28L250-548q-12 12-28 12t-28-12l-86-86q-11-11-11-28t11-28q11-11 28-11t28 11l57 57Zm339 353q-17 0-28.5-11.5T520-320q0-17 11.5-28.5T560-360h280q17 0 28.5 11.5T880-320q0 17-11.5 28.5T840-280H560Zm0-320q-17 0-28.5-11.5T520-640q0-17 11.5-28.5T560-680h280q17 0 28.5 11.5T880-640q0 17-11.5 28.5T840-600H560Z","open_in_new":"M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240q17 0 28.5 11.5T480-800q0 17-11.5 28.5T440-760H200v560h560v-240q0-17 11.5-28.5T800-480q17 0 28.5 11.5T840-440v240q0 33-23.5 56.5T760-120H200Zm560-584L416-360q-11 11-28 11t-28-11q-11-11-11-28t11-28l344-344H600q-17 0-28.5-11.5T560-800q0-17 11.5-28.5T600-840h200q17 0 28.5 11.5T840-800v200q0 17-11.5 28.5T800-560q-17 0-28.5-11.5T760-600v-104Z","gavel":"M200-200h400q17 0 28.5 11.5T640-160q0 17-11.5 28.5T600-120H200q-17 0-28.5-11.5T160-160q0-17 11.5-28.5T200-200Zm129-171L216-484q-23-23-23.5-56.5T215-597l29-29 228 226-29 29q-23 23-57 23t-57-23Zm311-197L414-796l29-29q23-23 56.5-22.5T556-824l113 113q23 23 23 57t-23 57l-29 29Zm156 380L302-682l56-56 494 494q11 11 11 28t-11 28q-11 11-28 11t-28-11Z","error":"M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm0-160q17 0 28.5-11.5T520-480v-160q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v160q0 17 11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z","public":"M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-82v-78q-33 0-56.5-23.5T360-320v-40L168-552q-3 18-5.5 36t-2.5 36q0 121 79.5 212T440-162Zm276-102q20-22 36-47.5t26.5-53q10.5-27.5 16-56.5t5.5-59q0-98-54.5-179T600-776v16q0 33-23.5 56.5T520-680h-80v80q0 17-11.5 28.5T400-560h-80v80h240q17 0 28.5 11.5T600-440v120h40q26 0 47 15.5t29 40.5Z","contact_support":"M470-200h-10q-142 0-241-99t-99-241q0-142 99-241t241-99q71 0 132.5 26.5t108 73q46.5 46.5 73 108T800-540q0 134-75.5 249T534-111q-10 5-20 5.5t-18-4.5q-8-5-14-13t-7-19l-5-58Zm90-26q71-60 115.5-140.5T720-540q0-109-75.5-184.5T460-800q-109 0-184.5 75.5T200-540q0 109 75.5 184.5T460-280h100v54Zm-101-95q17 0 29-12t12-29q0-17-12-29t-29-12q-17 0-29 12t-12 29q0 17 12 29t29 12Zm-87-304q11 5 22 .5t18-14.5q9-12 21-18.5t27-6.5q24 0 39 13.5t15 34.5q0 13-7.5 26T480-558q-25 22-37 41.5T431-477q0 12 8.5 20.5T460-448q12 0 20-9t12-21q5-17 18-31t24-25q21-21 31.5-42t10.5-42q0-46-31.5-74T460-720q-32 0-59 15.5T357-662q-6 11-1.5 21.5T372-625Zm88 112Z","query_stats":"M70-258q-13-9-15.5-24.5T60-312l151-242q11-17 30.5-18.5T275-559l85 99 127-207q11-19 33.5-19t34.5 18l41 62q11 17 6.5 32.5T585-550q-13 8-28.5 6.5T530-562l-7-10-123 200q-11 17-31 19t-34-14l-85-99-122 197q-9 15-26.5 18.5T70-258Zm573 121q-75 0-127.5-52.5T463-317q0-75 52.5-127.5T643-497q75 0 127.5 52.5T823-317q0 26-7 50.5T795-221l96 96q12 12 12.5 28T892-69q-12 12-28.5 12T835-69l-97-96q-20 14-44.5 21t-50.5 7Zm0-80q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Zm49-331q-13-8-18-23t6-32l152-241q9-14 26-18t31 7q13 9 16 24.5t-5 29.5L747-561q-11 17-26.5 19t-28.5-6Z","medical_services":"M440-360v80q0 17 11.5 28.5T480-240q17 0 28.5-11.5T520-280v-80h80q17 0 28.5-11.5T640-400q0-17-11.5-28.5T600-440h-80v-80q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v80h-80q-17 0-28.5 11.5T320-400q0 17 11.5 28.5T360-360h80ZM160-80q-33 0-56.5-23.5T80-160v-480q0-33 23.5-56.5T160-720h160v-80q0-33 23.5-56.5T400-880h160q33 0 56.5 23.5T640-800v80h160q33 0 56.5 23.5T880-640v480q0 33-23.5 56.5T800-80H160Zm0-80h640v-480H160v480Zm240-560h160v-80H400v80ZM160-160v-480 480Z","scatter_plot":"M680-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T760-280q0-33-23.5-56.5T680-360q-33 0-56.5 23.5T600-280q0 33 23.5 56.5T680-200Zm-400-40q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T360-400q0-33-23.5-56.5T280-480q-33 0-56.5 23.5T200-400q0 33 23.5 56.5T280-320Zm160-240q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T520-720q0-33-23.5-56.5T440-800q-33 0-56.5 23.5T360-720q0 33 23.5 56.5T440-640Zm240 360ZM280-400Zm160-320Z","bug_report":"M480-120q-65 0-120.5-32T272-240h-72q-17 0-28.5-11.5T160-280q0-17 11.5-28.5T200-320h44q-3-20-3.5-40t-.5-40h-40q-17 0-28.5-11.5T160-440q0-17 11.5-28.5T200-480h40q0-20 .5-40t3.5-40h-44q-17 0-28.5-11.5T160-600q0-17 11.5-28.5T200-640h72q14-23 31.5-43t40.5-35l-37-38q-11-11-11-27.5t12-28.5q11-11 28-11t28 11l58 58q28-9 57-9t57 9l60-59q11-11 27.5-11t28.5 12q11 11 11 28t-11 28l-38 38q23 15 41.5 34.5T688-640h72q17 0 28.5 11.5T800-600q0 17-11.5 28.5T760-560h-44q3 20 3.5 40t.5 40h40q17 0 28.5 11.5T800-440q0 17-11.5 28.5T760-400h-40q0 20-.5 40t-3.5 40h44q17 0 28.5 11.5T800-280q0 17-11.5 28.5T760-240h-72q-32 56-87.5 88T480-120Zm0-80q66 0 113-47t47-113v-160q0-66-47-113t-113-47q-66 0-113 47t-47 113v160q0 66 47 113t113 47Zm-40-120h80q17 0 28.5-11.5T560-360q0-17-11.5-28.5T520-400h-80q-17 0-28.5 11.5T400-360q0 17 11.5 28.5T440-320Zm0-160h80q17 0 28.5-11.5T560-520q0-17-11.5-28.5T520-560h-80q-17 0-28.5 11.5T400-520q0 17 11.5 28.5T440-480Zm40 40Z","wifi":"M480-120q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm0-440q75 0 142.5 24T745-470q20 15 20.5 39.5T748-388q-17 17-42 17.5T661-384q-38-26-84-41t-97-15q-51 0-97 15t-84 41q-20 14-45 13t-42-18q-17-18-17-42.5t20-39.5q55-42 122.5-65.5T480-560Zm0-240q125 0 235.5 41T914-643q20 17 21 42t-17 43q-17 17-42 17.5T831-556q-72-59-161.5-91.5T480-680q-100 0-189.5 32.5T129-556q-20 16-45 15.5T42-558q-18-18-17-43t21-42q88-75 198.5-116T480-800Z","filter_list":"M440-240q-17 0-28.5-11.5T400-280q0-17 11.5-28.5T440-320h80q17 0 28.5 11.5T560-280q0 17-11.5 28.5T520-240h-80ZM280-440q-17 0-28.5-11.5T240-480q0-17 11.5-28.5T280-520h400q17 0 28.5 11.5T720-480q0 17-11.5 28.5T680-440H280ZM160-640q-17 0-28.5-11.5T120-680q0-17 11.5-28.5T160-720h640q17 0 28.5 11.5T840-680q0 17-11.5 28.5T800-640H160Z","female":"M440-200h-40q-17 0-28.5-11.5T360-240q0-17 11.5-28.5T400-280h40v-84q-79-14-129.5-75.5T260-582q0-91 64.5-154.5T480-800q91 0 155.5 63.5T700-582q0 81-50.5 142.5T520-364v84h40q17 0 28.5 11.5T600-240q0 17-11.5 28.5T560-200h-40v40q0 17-11.5 28.5T480-120q-17 0-28.5-11.5T440-160v-40Zm40-240q58 0 99-41t41-99q0-58-41-99t-99-41q-58 0-99 41t-41 99q0 58 41 99t99 41Z","qr_code":"M120-560v-240q0-17 11.5-28.5T160-840h240q17 0 28.5 11.5T440-800v240q0 17-11.5 28.5T400-520H160q-17 0-28.5-11.5T120-560Zm80-40h160v-160H200v160Zm-80 440v-240q0-17 11.5-28.5T160-440h240q17 0 28.5 11.5T440-400v240q0 17-11.5 28.5T400-120H160q-17 0-28.5-11.5T120-160Zm80-40h160v-160H200v160Zm320-360v-240q0-17 11.5-28.5T560-840h240q17 0 28.5 11.5T840-800v240q0 17-11.5 28.5T800-520H560q-17 0-28.5-11.5T520-560Zm80-40h160v-160H600v160Zm160 480v-80h80v80h-80ZM520-360v-80h80v80h-80Zm80 80v-80h80v80h-80Zm-80 80v-80h80v80h-80Zm80 80v-80h80v80h-80Zm80-80v-80h80v80h-80Zm0-160v-80h80v80h-80Zm80 80v-80h80v80h-80Z","eco":"M216-176q-45-45-70.5-104T120-402q0-63 24-124.5T222-642q60-60 169.5-91T675-759q26 1 48 11t39 27q17 17 27 39.5t11 48.5q2 82-4.5 151.5t-21 125.5q-14.5 56-37 99.5T684-182q-53 53-112.5 77.5T450-80q-65 0-127-25.5T216-176Zm112-16q29 17 59.5 24.5T450-160q46 0 91-18.5t86-59.5q18-18 36.5-50.5t32-85Q709-426 716-500.5t2-177.5q-49-2-110.5-1.5T485-670q-61 9-116 29t-90 55q-45 45-62 89t-17 85q0 59 22.5 103.5T262-246q42-80 111-153.5T534-520q-72 63-125.5 142.5T328-192Zm0 0Zm0 0Z","menu_book":"M260-320q47 0 91.5 10.5T440-278v-394q-41-24-87-36t-93-12q-36 0-71.5 7T120-692v396q35-12 69.5-18t70.5-6Zm260 42q44-21 88.5-31.5T700-320q36 0 70.5 6t69.5 18v-396q-33-14-68.5-21t-71.5-7q-47 0-93 12t-87 36v394Zm-40 97q-14 0-26.5-3.5T430-194q-39-23-82-34.5T260-240q-42 0-82.5 11T100-198q-21 11-40.5-1T40-234v-482q0-11 5.5-21T62-752q46-24 96-36t102-12q58 0 113.5 15T480-740q51-30 106.5-45T700-800q52 0 102 12t96 36q11 5 16.5 15t5.5 21v482q0 23-19.5 35t-40.5 1q-37-20-77.5-31T700-240q-45 0-88 11.5T530-194q-11 6-23.5 9.5T480-181ZM280-494Zm280-115q0-9 6.5-18.5T581-640q29-10 58-15t61-5q20 0 39.5 2.5T778-651q9 2 15.5 10t6.5 18q0 17-11 25t-28 4q-14-3-29.5-4.5T700-600q-26 0-51 5t-48 13q-18 7-29.5-1T560-609Zm0 220q0-9 6.5-18.5T581-420q29-10 58-15t61-5q20 0 39.5 2.5T778-431q9 2 15.5 10t6.5 18q0 17-11 25t-28 4q-14-3-29.5-4.5T700-380q-26 0-51 4.5T601-363q-18 7-29.5-.5T560-389Zm0-110q0-9 6.5-18.5T581-530q29-10 58-15t61-5q20 0 39.5 2.5T778-541q9 2 15.5 10t6.5 18q0 17-11 25t-28 4q-14-3-29.5-4.5T700-490q-26 0-51 5t-48 13q-18 7-29.5-1T560-499Z","tune":"M480-120q-17 0-28.5-11.5T440-160v-160q0-17 11.5-28.5T480-360q17 0 28.5 11.5T520-320v40h280q17 0 28.5 11.5T840-240q0 17-11.5 28.5T800-200H520v40q0 17-11.5 28.5T480-120Zm-320-80q-17 0-28.5-11.5T120-240q0-17 11.5-28.5T160-280h160q17 0 28.5 11.5T360-240q0 17-11.5 28.5T320-200H160Zm160-160q-17 0-28.5-11.5T280-400v-40H160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h120v-40q0-17 11.5-28.5T320-600q17 0 28.5 11.5T360-560v160q0 17-11.5 28.5T320-360Zm160-80q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520h320q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H480Zm160-160q-17 0-28.5-11.5T600-640v-160q0-17 11.5-28.5T640-840q17 0 28.5 11.5T680-800v40h120q17 0 28.5 11.5T840-720q0 17-11.5 28.5T800-680H680v40q0 17-11.5 28.5T640-600Zm-480-80q-17 0-28.5-11.5T120-720q0-17 11.5-28.5T160-760h320q17 0 28.5 11.5T520-720q0 17-11.5 28.5T480-680H160Z","palette":"M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 32.5-156t88-127Q256-817 330-848.5T488-880q80 0 151 27.5t124.5 76q53.5 48.5 85 115T880-518q0 115-70 176.5T640-280h-74q-9 0-12.5 5t-3.5 11q0 12 15 34.5t15 51.5q0 50-27.5 74T480-80Zm0-400Zm-220 40q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm120-160q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm200 0q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm120 160q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17ZM480-160q9 0 14.5-5t5.5-13q0-14-15-33t-15-57q0-42 29-67t71-25h70q66 0 113-38.5T800-518q0-121-92.5-201.5T488-800q-136 0-232 93t-96 227q0 133 93.5 226.5T480-160Z","ssid_chart":"M120-358q0-10 4.5-18.5T137-390l49-35q23-17 52-14.5t50 22.5l197 191 145-116q11-8 23.5-13t26.5-5h120q17 0 28.5 11.5T840-320q0 17-11.5 28.5T800-280H680L535-164q-23 19-53.5 17.5T429-169L232-360l-49 35q-20 14-41.5 3T120-358Zm0-241q0-10 4-18t12-14l122-89q24-17 53-15t50 23l127 127 289-209q20-14 41.5-3t21.5 36q0 10-4.5 18T823-729L535-520q-24 17-53 15t-50-23L305-655l-122 89q-20 14-41.5 3T120-599Z","shopping_cart":"M280-80q-33 0-56.5-23.5T200-160q0-33 23.5-56.5T280-240q33 0 56.5 23.5T360-160q0 33-23.5 56.5T280-80Zm400 0q-33 0-56.5-23.5T600-160q0-33 23.5-56.5T680-240q33 0 56.5 23.5T760-160q0 33-23.5 56.5T680-80ZM246-720l96 200h280l110-200H246Zm-38-80h590q23 0 35 20.5t1 41.5L692-482q-11 20-29.5 31T622-440H324l-44 80h440q17 0 28.5 11.5T760-320q0 17-11.5 28.5T720-280H280q-45 0-68-39.5t-2-78.5l54-98-144-304H80q-17 0-28.5-11.5T40-840q0-17 11.5-28.5T80-880h65q11 0 21 6t15 17l27 57Zm134 280h280-280Z","bubble_chart":"M580-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T620-240q0-17-11.5-28.5T580-280q-17 0-28.5 11.5T540-240q0 17 11.5 28.5T580-200Zm80-200q-92 0-156-64t-64-156q0-92 64-156t156-64q92 0 156 64t64 156q0 92-64 156t-156 64Zm0-80q59 0 99.5-40.5T800-620q0-59-40.5-99.5T660-760q-59 0-99.5 40.5T520-620q0 59 40.5 99.5T660-480ZM280-240q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T360-400q0-33-23.5-56.5T280-480q-33 0-56.5 23.5T200-400q0 33 23.5 56.5T280-320Zm300 80Zm80-380ZM280-400Z","verified":"m438-452-58-57q-11-11-27.5-11T324-508q-11 11-11 28t11 28l86 86q12 12 28 12t28-12l170-170q12-12 11.5-28T636-592q-12-12-28.5-12.5T579-593L438-452ZM326-90l-58-98-110-24q-15-3-24-15.5t-7-27.5l11-113-75-86q-10-11-10-26t10-26l75-86-11-113q-2-15 7-27.5t24-15.5l110-24 58-98q8-13 22-17.5t28 1.5l104 44 104-44q14-6 28-1.5t22 17.5l58 98 110 24q15 3 24 15.5t7 27.5l-11 113 75 86q10 11 10 26t-10 26l-75 86 11 113q2 15-7 27.5T802-212l-110 24-58 98q-8 13-22 17.5T584-74l-104-44-104 44q-14 6-28 1.5T326-90Zm52-72 102-44 104 44 56-96 110-26-10-112 74-84-74-86 10-112-110-24-58-96-102 44-104-44-56 96-110 24 10 112-74 86 74 84-10 114 110 24 58 96Zm102-318Z","grid_view":"M200-520q-33 0-56.5-23.5T120-600v-160q0-33 23.5-56.5T200-840h160q33 0 56.5 23.5T440-760v160q0 33-23.5 56.5T360-520H200Zm0 400q-33 0-56.5-23.5T120-200v-160q0-33 23.5-56.5T200-440h160q33 0 56.5 23.5T440-360v160q0 33-23.5 56.5T360-120H200Zm400-400q-33 0-56.5-23.5T520-600v-160q0-33 23.5-56.5T600-840h160q33 0 56.5 23.5T840-760v160q0 33-23.5 56.5T760-520H600Zm0 400q-33 0-56.5-23.5T520-200v-160q0-33 23.5-56.5T600-440h160q33 0 56.5 23.5T840-360v160q0 33-23.5 56.5T760-120H600ZM200-600h160v-160H200v160Zm400 0h160v-160H600v160Zm0 400h160v-160H600v160Zm-400 0h160v-160H200v160Zm400-400Zm0 240Zm-240 0Zm0-240Z","label":"M807-434 666-234q-11 16-28.5 25t-37.5 9H200q-33 0-56.5-23.5T120-280v-400q0-33 23.5-56.5T200-760h400q20 0 37.5 9t28.5 25l141 200q15 21 15 46t-15 46ZM600-280l142-200-142-200H200v400h400ZM200-680v400-400Z","directions_car":"M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z","cloud_upload":"m440-446-36 35q-11 11-27.5 11T348-412q-11-11-11-28t11-28l104-104q12-12 28-12t28 12l104 104q11 11 11.5 27.5T612-412q-11 11-27.5 11.5T556-411l-36-35v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h60q17 0 28.5 11.5T360-200q0 17-11.5 28.5T320-160h-60q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206Zm40 6Z","smartphone":"M280-40q-33 0-56.5-23.5T200-120v-720q0-33 23.5-56.5T280-920h400q33 0 56.5 23.5T760-840v720q0 33-23.5 56.5T680-40H280Zm0-120v40h400v-40H280Zm0-80h400v-480H280v480Zm0-560h400v-40H280v40Zm0 0v-40 40Zm0 640v40-40Z","two_wheeler":"M160-200q-66 0-113-47T0-360q0-57 36.5-101t93.5-55l-28-24H30q-13 0-21.5-8.5T0-570q0-13 8.5-21.5T30-600h150l100 60 146-55q7-2 14-3.5t15-1.5h111l-62-80h-64q-17 0-28.5-11.5T400-720q0-17 11.5-28.5T440-760h63q19 0 35.5 8.5T566-729l60 77 105-53q10-5 19.5 1t9.5 17v67q0 8-6 14t-14 6h-72l70 92q15-6 30.5-9t31.5-3q66 0 113 47t47 113q0 66-47 113t-113 47q-66 0-113-47t-47-113q0-27 9.5-52.5T676-460l-20-24-124 186q-5 8-14 13t-19 5h-84q-8 0-14.5-2.5T389-290l-69-60q-5 63-51 106.5T160-200Zm0-80q33 0 56.5-23.5T240-360q0-33-23.5-56.5T160-440q-33 0-56.5 23.5T80-360q0 33 23.5 56.5T160-280Zm294-240-144 54 144-54h130-130Zm346 240q33 0 56.5-23.5T880-360q0-33-23.5-56.5T800-440q-33 0-56.5 23.5T720-360q0 33 23.5 56.5T800-280Zm-322-80 106-160H454l-144 54 120 106h48Z","arrow_downward":"M440-313v-447q0-17 11.5-28.5T480-800q17 0 28.5 11.5T520-760v447l196-196q12-12 28-11.5t28 12.5q11 12 11.5 28T772-452L508-188q-6 6-13 8.5t-15 2.5q-8 0-15-2.5t-13-8.5L188-452q-11-11-11-27.5t11-28.5q12-12 28.5-12t28.5 12l195 195Z","share":"M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-672L356-508q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-640q17 0 28.5-11.5T760-760q0-17-11.5-28.5T720-800q-17 0-28.5 11.5T680-760q0 17 11.5 28.5T720-720ZM240-440q17 0 28.5-11.5T280-480q0-17-11.5-28.5T240-520q-17 0-28.5 11.5T200-480q0 17 11.5 28.5T240-440Zm480 280q17 0 28.5-11.5T760-200q0-17-11.5-28.5T720-240q-17 0-28.5 11.5T680-200q0 17 11.5 28.5T720-160Zm0-600ZM240-480Zm480 280Z","event":"M580-240q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-40q0-17 11.5-28.5T280-880q17 0 28.5 11.5T320-840v40h320v-40q0-17 11.5-28.5T680-880q17 0 28.5 11.5T720-840v40h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z","group":"M40-272q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v32q0 33-23.5 56.5T600-160H120q-33 0-56.5-23.5T40-240v-32Zm800 112H738q11-18 16.5-38.5T760-240v-40q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v40q0 33-23.5 56.5T840-160ZM360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm400-160q0 66-47 113t-113 47q-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113ZM120-240h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0 320Zm0-400Z","feedback":"M480-360q17 0 28.5-11.5T520-400q0-17-11.5-28.5T480-440q-17 0-28.5 11.5T440-400q0 17 11.5 28.5T480-360Zm0-160q17 0 28.5-11.5T520-560v-160q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720v160q0 17 11.5 28.5T480-520ZM240-240l-92 92q-19 19-43.5 8.5T80-177v-623q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240Zm-34-80h594v-480H160v525l46-45Zm-46 0v-480 480Z","rocket_launch":"M284-506q14-28 29-54t33-52l-56-11-84 84 78 33Zm482-275q-70 2-149.5 41T472-636q-42 42-75 90t-49 90l114 113q42-16 90-49t90-75q65-65 104-144t41-149q0-4-1.5-8t-4.5-7q-3-3-7-4.5t-8-1.5ZM546-541q-23-23-23-56.5t23-56.5q23-23 57-23t57 23q23 23 23 56.5T660-541q-23 23-57 23t-57-23Zm-34 262 33 79 84-84-11-56q-26 18-52 32.5T512-279Zm351-534q8 110-36 214.5T688-399l20 99q4 20-2 39t-20 33L560-102q-15 15-36 11.5T495-114l-61-143-171-171-143-61q-20-8-24-29t11-36l126-126q14-14 33.5-20t39.5-2l99 20q95-95 199.5-139T819-857q8 1 16 4.5t14 9.5q6 6 9.5 14t4.5 16ZM157-321q35-35 85.5-35.5T328-322q35 35 34.5 85.5T327-151q-48 48-113.5 57T82-76q9-66 18-131.5T157-321Zm57 56q-17 17-23.5 41T180-175q25-4 49-10t41-23q12-12 13-29t-11-29q-12-12-29-11.5T214-265Z","report":"M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm0-160q17 0 28.5-11.5T520-480v-160q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v160q0 17 11.5 28.5T480-440ZM363-120q-16 0-30.5-6T307-143L143-307q-11-11-17-25.5t-6-30.5v-234q0-16 6-30.5t17-25.5l164-164q11-11 25.5-17t30.5-6h234q16 0 30.5 6t25.5 17l164 164q11 11 17 25.5t6 30.5v234q0 16-6 30.5T817-307L653-143q-11 11-25.5 17t-30.5 6H363Zm1-80h232l164-164v-232L596-760H364L200-596v232l164 164Zm116-280Z","sort":"M160-240q-17 0-28.5-11.5T120-280q0-17 11.5-28.5T160-320h160q17 0 28.5 11.5T360-280q0 17-11.5 28.5T320-240H160Zm0-200q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h400q17 0 28.5 11.5T600-480q0 17-11.5 28.5T560-440H160Zm0-200q-17 0-28.5-11.5T120-680q0-17 11.5-28.5T160-720h640q17 0 28.5 11.5T840-680q0 17-11.5 28.5T800-640H160Z","park":"M402-240H195q-24 0-36-21t2-41l119-178h-3q-24 0-35.5-21.5T244-543l203-290q6-8 15-12.5t18-4.5q9 0 18 4.5t15 12.5l203 290q14 20 2.5 41.5T683-480h-3l119 178q14 20 2 41t-36 21H558v120q0 17-11.5 28.5T518-80h-76q-17 0-28.5-11.5T402-120v-120Zm-132-80h160-76 252-76 160-420Zm0 0h420L530-560h76L480-740 354-560h76L270-320Z","add":"M440-440H240q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h200v-200q0-17 11.5-28.5T480-760q17 0 28.5 11.5T520-720v200h200q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H520v200q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-200Z","fullscreen":"M200-200h80q17 0 28.5 11.5T320-160q0 17-11.5 28.5T280-120H160q-17 0-28.5-11.5T120-160v-120q0-17 11.5-28.5T160-320q17 0 28.5 11.5T200-280v80Zm560 0v-80q0-17 11.5-28.5T800-320q17 0 28.5 11.5T840-280v120q0 17-11.5 28.5T800-120H680q-17 0-28.5-11.5T640-160q0-17 11.5-28.5T680-200h80ZM200-760v80q0 17-11.5 28.5T160-640q-17 0-28.5-11.5T120-680v-120q0-17 11.5-28.5T160-840h120q17 0 28.5 11.5T320-800q0 17-11.5 28.5T280-760h-80Zm560 0h-80q-17 0-28.5-11.5T640-800q0-17 11.5-28.5T680-840h120q17 0 28.5 11.5T840-800v120q0 17-11.5 28.5T800-640q-17 0-28.5-11.5T760-680v-80Z","travel_explore":"M80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q127 0 226.5 70T851-629q7 17 .5 34T828-572q-16 5-30.5-3T777-599q-24-60-69-106t-108-71v16q0 33-23.5 56.5T520-680h-80v80q0 17-11.5 28.5T400-560h-80v80h40q17 0 28.5 11.5T400-440v80h-40L168-552q-3 18-5.5 36t-2.5 36q0 122 80.5 213T443-162q16 2 26.5 13.5T480-120q0 17-11.5 28.5T441-82Q288-97 184-210T80-480Zm736 352L716-228q-21 12-45 20t-51 8q-75 0-127.5-52.5T440-380q0-75 52.5-127.5T620-560q75 0 127.5 52.5T800-380q0 27-8 51t-20 45l100 100q11 11 11 28t-11 28q-11 11-28 11t-28-11ZM620-280q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Z","arrow_forward":"M647-440H200q-17 0-28.5-11.5T160-480q0-17 11.5-28.5T200-520h447L451-716q-12-12-11.5-28t12.5-28q12-11 28-11.5t28 11.5l264 264q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L508-188q-11 11-27.5 11T452-188q-12-12-12-28.5t12-28.5l195-195Z","health_and_safety":"M420-440v60q0 17 11.5 28.5T460-340h40q17 0 28.5-11.5T540-380v-60h60q17 0 28.5-11.5T640-480v-40q0-17-11.5-28.5T600-560h-60v-60q0-17-11.5-28.5T500-660h-40q-17 0-28.5 11.5T420-620v60h-60q-17 0-28.5 11.5T320-520v40q0 17 11.5 28.5T360-440h60Zm60 356q-7 0-13-1t-12-3q-135-45-215-166.5T160-516v-189q0-25 14.5-45t37.5-29l240-90q14-5 28-5t28 5l240 90q23 9 37.5 29t14.5 45v189q0 140-80 261.5T505-88q-6 2-12 3t-13 1Zm0-80q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z","mood":"M620-520q25 0 42.5-17.5T680-580q0-25-17.5-42.5T620-640q-25 0-42.5 17.5T560-580q0 25 17.5 42.5T620-520Zm-280 0q25 0 42.5-17.5T400-580q0-25-17.5-42.5T340-640q-25 0-42.5 17.5T280-580q0 25 17.5 42.5T340-520ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-100q58 0 107-28t79-76q6-12-1-24t-21-12H316q-14 0-21 12t-1 24q30 48 79.5 76T480-260Z","update":"M480-120q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q82 0 155.5 35T760-706v-54q0-17 11.5-28.5T800-800q17 0 28.5 11.5T840-760v160q0 17-11.5 28.5T800-560H640q-17 0-28.5-11.5T600-600q0-17 11.5-28.5T640-640h70q-41-56-101-88t-129-32q-117 0-198.5 81.5T200-480q0 117 81.5 198.5T480-200q95 0 170-57t99-147q5-16 18-24t29-6q17 2 27 14.5t6 27.5q-29 119-126 195.5T480-120Zm40-376 100 100q11 11 11 28t-11 28q-11 11-28 11t-28-11L452-452q-6-6-9-13.5t-3-15.5v-159q0-17 11.5-28.5T480-680q17 0 28.5 11.5T520-640v144Z","file_download":"M12 15.575q-.2 0-.375-.063-.175-.062-.325-.212l-3.6-3.6q-.275-.275-.275-.7 0-.425.275-.7.275-.275.712-.288.438-.012.713.263L11 12.15V5q0-.425.288-.713Q11.575 4 12 4t.713.287Q13 4.575 13 5v7.15l1.875-1.875q.275-.275.713-.263.437.013.712.288.275.275.275.7 0 .425-.275.7l-3.6 3.6q-.15.15-.325.212-.175.063-.375.063ZM6 20q-.825 0-1.412-.587Q4 18.825 4 18v-2q0-.425.287-.713Q4.575 15 5 15t.713.287Q6 15.575 6 16v2h12v-2q0-.425.288-.713Q18.575 15 19 15t.712.287Q20 15.575 20 16v2q0 .825-.587 1.413Q18.825 20 18 20Z","mail":"M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm640-480L501-453q-5 3-10.5 4.5T480-447q-5 0-10.5-1.5T459-453L160-640v400h640v-400ZM480-520l320-200H160l320 200ZM160-640v10-59 1-32 32-.5 58.5-10 400-400Z","code":"m193-479 155 155q11 11 11 28t-11 28q-11 11-28 11t-28-11L108-452q-6-6-8.5-13T97-480q0-8 2.5-15t8.5-13l184-184q12-12 28.5-12t28.5 12q12 12 12 28.5T349-635L193-479Zm574-2L612-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L668-268q-12 12-28 11.5T612-269q-12-12-12-28.5t12-28.5l155-155Z","cancel":"m480-424 116 116q11 11 28 11t28-11q11-11 11-28t-11-28L536-480l116-116q11-11 11-28t-11-28q-11-11-28-11t-28 11L480-536 364-652q-11-11-28-11t-28 11q-11 11-11 28t11 28l116 116-116 116q-11 11-11 28t11 28q11 11 28 11t28-11l116-116Zm0 344q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z","search":"M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z","content_copy":"M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-520q0-17 11.5-28.5T160-720q17 0 28.5 11.5T200-680v520h400q17 0 28.5 11.5T640-120q0 17-11.5 28.5T600-80H200Zm160-240v-480 480Z","restaurant":"M280-600v-240q0-17 11.5-28.5T320-880q17 0 28.5 11.5T360-840v240h40v-240q0-17 11.5-28.5T440-880q17 0 28.5 11.5T480-840v240q0 56-34.5 98T360-446v326q0 17-11.5 28.5T320-80q-17 0-28.5-11.5T280-120v-326q-51-14-85.5-56T160-600v-240q0-17 11.5-28.5T200-880q17 0 28.5 11.5T240-840v240h40Zm400 200h-80q-17 0-28.5-11.5T560-440v-240q0-70 51.5-135T718-880q18 0 30 14t12 33v713q0 17-11.5 28.5T720-80q-17 0-28.5-11.5T680-120v-280Z","alarm":"M520-456v-144q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600v159q0 8 3 15.5t9 13.5l112 112q11 11 28 11t28-11q11-11 11-28t-11-28L520-456ZM480-80q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-440q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-800q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-440q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-80Zm0-360ZM82-668q-11-11-11-28t11-28l114-114q11-11 28-11t28 11q11 11 11 28t-11 28L138-668q-11 11-28 11t-28-11Zm796 0q-11 11-28 11t-28-11L708-782q-11-11-11-28t11-28q11-11 28-11t28 11l114 114q11 11 11 28t-11 28ZM480-160q117 0 198.5-81.5T760-440q0-117-81.5-198.5T480-720q-117 0-198.5 81.5T200-440q0 117 81.5 198.5T480-160Z","image":"M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0 0v-560 560Zm80-80h400q12 0 18-11t-2-21L586-459q-6-8-16-8t-16 8L450-320l-74-99q-6-8-16-8t-16 8l-80 107q-8 10-2 21t18 11Z","photo_camera":"M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM160-120q-33 0-56.5-23.5T80-200v-480q0-33 23.5-56.5T160-760h126l50-54q11-12 26.5-19t32.5-7h170q17 0 32.5 7t26.5 19l50 54h126q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T800-120H160Zm0-80h640v-480H638l-73-80H395l-73 80H160v480Zm320-240Z","balance":"M120-120q-17 0-28.5-11.5T80-160q0-17 11.5-28.5T120-200h320v-447q-26-9-45-28t-28-45H240l110 258q5 11 6 22.5t-1 23.5q-9 46-49.5 71T220-320q-45 0-85.5-25T85-416q-2-12-1-23.5t6-22.5l110-258h-40q-17 0-28.5-11.5T120-760q0-17 11.5-28.5T160-800h207q12-35 43-57.5t70-22.5q39 0 70 22.5t43 57.5h207q17 0 28.5 11.5T840-760q0 17-11.5 28.5T800-720h-40l110 258q5 11 6 22.5t-1 23.5q-9 46-49.5 71T740-320q-45 0-85.5-25T605-416q-2-12-1-23.5t6-22.5l110-258H593q-9 26-28 45t-45 28v447h320q17 0 28.5 11.5T880-160q0 17-11.5 28.5T840-120H120Zm545-320h150l-75-174-75 174Zm-520 0h150l-75-174-75 174Zm335-280q17 0 28.5-11.5T520-760q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760q0 17 11.5 28.5T480-720Z","credit_card":"M880-720v480q0 33-23.5 56.5T800-160H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720Zm-720 80h640v-80H160v80Zm0 160v240h640v-240H160Zm0 240v-480 480Z","location_on":"M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z","translate":"m603-202-34 97q-4 11-14 18t-22 7q-20 0-32.5-16.5T496-133l152-402q5-11 15-18t22-7h30q12 0 22 7t15 18l152 403q8 19-4 35.5T868-80q-13 0-22.5-7T831-106l-34-96H603ZM362-401 188-228q-11 11-27.5 11.5T132-228q-11-11-11-28t11-28l174-174q-35-35-63.5-80T190-640h84q20 39 40 68t48 58q33-33 68.5-92.5T484-720H80q-17 0-28.5-11.5T40-760q0-17 11.5-28.5T80-800h240v-40q0-17 11.5-28.5T360-880q17 0 28.5 11.5T400-840v40h240q17 0 28.5 11.5T680-760q0 17-11.5 28.5T640-720h-76q-21 72-63 148t-83 116l96 98-30 82-122-125Zm266 129h144l-72-204-72 204Z","zoom_in":"M340-540h-40q-17 0-28.5-11.5T260-580q0-17 11.5-28.5T300-620h40v-40q0-17 11.5-28.5T380-700q17 0 28.5 11.5T420-660v40h40q17 0 28.5 11.5T500-580q0 17-11.5 28.5T460-540h-40v40q0 17-11.5 28.5T380-460q-17 0-28.5-11.5T340-500v-40Zm40 220q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z","quiz":"M560-360q17 0 29.5-12.5T602-402q0-17-12.5-29.5T560-444q-17 0-29.5 12.5T518-402q0 17 12.5 29.5T560-360Zm0-128q11 0 20.5-8t11.5-21q2-12 8.5-22t23.5-27q30-30 40-48.5t10-43.5q0-45-31.5-73.5T560-760q-33 0-60 15t-43 43q-6 10-1 21t17 16q11 5 21.5 1t17.5-14q9-13 21-19.5t27-6.5q24 0 39 13.5t15 36.5q0 14-8 26.5T578-596q-29 25-37 38.5T531-518q-1 12 7.5 21t21.5 9ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-520q0-17 11.5-28.5T120-720q17 0 28.5 11.5T160-680v520h520q17 0 28.5 11.5T720-120q0 17-11.5 28.5T680-80H160Zm160-720v480-480Z","emoji_events":"M440-200v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80q0-33 23.5-56.5T360-840h240q33 0 56.5 23.5T680-760h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h120q17 0 28.5 11.5T680-160q0 17-11.5 28.5T640-120H320q-17 0-28.5-11.5T280-160q0-17 11.5-28.5T320-200h120ZM280-528v-152h-80v40q0 38 22 68.5t58 43.5Zm200 128q50 0 85-35t35-85v-240H360v240q0 50 35 85t85 35Zm200-128q36-13 58-43.5t22-68.5v-40h-80v152Zm-200-52Z","battery_full":"M320-80q-17 0-28.5-11.5T280-120v-640q0-17 11.5-28.5T320-800h80v-40q0-17 11.5-28.5T440-880h80q17 0 28.5 11.5T560-840v40h80q17 0 28.5 11.5T680-760v640q0 17-11.5 28.5T640-80H320Z","privacy_tip":"M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 516q-7 0-13-1t-12-3q-135-45-215-166.5T160-516v-189q0-25 14.5-45t37.5-29l240-90q14-5 28-5t28 5l240 90q23 9 37.5 29t14.5 45v189q0 140-80 261.5T505-88q-6 2-12 3t-13 1Zm0-80q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z","timeline":"M120-240q-33 0-56.5-23.5T40-320q0-33 23.5-56.5T120-400h10.5q4.5 0 9.5 2l182-182q-2-5-2-9.5V-600q0-33 23.5-56.5T400-680q33 0 56.5 23.5T480-600q0 2-2 20l102 102q5-2 9.5-2h21q4.5 0 9.5 2l142-142q-2-5-2-9.5V-640q0-33 23.5-56.5T840-720q33 0 56.5 23.5T920-640q0 33-23.5 56.5T840-560h-10.5q-4.5 0-9.5-2L678-420q2 5 2 9.5v10.5q0 33-23.5 56.5T600-320q-33 0-56.5-23.5T520-400v-10.5q0-4.5 2-9.5L420-522q-5 2-9.5 2H400q-2 0-20-2L198-340q2 5 2 9.5v10.5q0 33-23.5 56.5T120-240Z","admin_panel_settings":"M680-280q25 0 42.5-17.5T740-340q0-25-17.5-42.5T680-400q-25 0-42.5 17.5T620-340q0 25 17.5 42.5T680-280Zm0 120q31 0 57-14.5t42-38.5q-22-13-47-20t-52-7q-27 0-52 7t-47 20q16 24 42 38.5t57 14.5ZM480-874q8 0 14.5 1t13.5 4l240 90q23 9 37.5 29t14.5 45v125q0 17-11.5 28.5T760-540q-17 0-28.5-11.5T720-580v-124l-240-90-240 90v188q0 50 14.5 100t40 95q25.5 45 62 81t79.5 59q15 8 21.5 23t.5 30q-7 16-22.5 22t-30.5-2q-113-56-179-169t-66-239v-189q0-25 14.5-45t37.5-29l240-90q7-3 14-4t14-1ZM680-80q-83 0-141.5-58.5T480-280q0-83 58.5-141.5T680-480q83 0 141.5 58.5T880-280q0 83-58.5 141.5T680-80ZM480-494Z","lock_open":"M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h360v-80q0-50-35-85t-85-35q-42 0-73.5 25.5T364-751q-4 14-16.5 22.5T320-720q-17 0-28.5-11t-8.5-26q14-69 69-116t128-47q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm240-120q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM240-160v-400 400Z","folder_open":"M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h360q17 0 28.5 11.5T880-680q0 17-11.5 28.5T840-640H447l-80-80H160v480l79-263q8-26 29.5-41.5T316-560h516q41 0 64.5 32.5T909-457l-72 240q-8 26-29.5 41.5T760-160H160Zm84-80h516l72-240H316l-72 240Zm-84-262v-218 218Zm84 262 72-240-72 240Z","article":"M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Zm120 480h200q17 0 28.5-11.5T560-320q0-17-11.5-28.5T520-360H320q-17 0-28.5 11.5T280-320q0 17 11.5 28.5T320-280Zm0-160h320q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520H320q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440Zm0-160h320q17 0 28.5-11.5T680-640q0-17-11.5-28.5T640-680H320q-17 0-28.5 11.5T280-640q0 17 11.5 28.5T320-600Z","local_hospital":"M420-420v80q0 25 17.5 42.5T480-280q25 0 42.5-17.5T540-340v-80h80q25 0 42.5-17.5T680-480q0-25-17.5-42.5T620-540h-80v-80q0-25-17.5-42.5T480-680q-25 0-42.5 17.5T420-620v80h-80q-25 0-42.5 17.5T280-480q0 25 17.5 42.5T340-420h80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z","percent":"M300-520q-58 0-99-41t-41-99q0-58 41-99t99-41q58 0 99 41t41 99q0 58-41 99t-99 41Zm0-80q25 0 42.5-17.5T360-660q0-25-17.5-42.5T300-720q-25 0-42.5 17.5T240-660q0 25 17.5 42.5T300-600Zm360 440q-58 0-99-41t-41-99q0-58 41-99t99-41q58 0 99 41t41 99q0 58-41 99t-99 41Zm0-80q25 0 42.5-17.5T720-300q0-25-17.5-42.5T660-360q-25 0-42.5 17.5T600-300q0 25 17.5 42.5T660-240Zm-472 52q-11-11-11-28t11-28l528-528q11-11 28-11t28 11q11 11 11 28t-11 28L244-188q-11 11-28 11t-28-11Z","area_chart":"m546-787 134 107h80q33 0 56.5 23.5T840-600v440H120v-440q0-25 22-36t42 4l96 72 151-211q20-28 54-33t61 17ZM200-520v144l120 96 160-220 280 218v-318H652L496-725 298-447l-98-73Z","upload":"M240-160q-33 0-56.5-23.5T160-240v-80q0-17 11.5-28.5T200-360q17 0 28.5 11.5T240-320v80h480v-80q0-17 11.5-28.5T760-360q17 0 28.5 11.5T800-320v80q0 33-23.5 56.5T720-160H240Zm200-486-75 75q-12 12-28.5 11.5T308-572q-11-12-11.5-28t11.5-28l144-144q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l144 144q12 12 11.5 28T652-572q-12 12-28.5 12.5T595-571l-75-75v286q0 17-11.5 28.5T480-320q-17 0-28.5-11.5T440-360v-286Z","wallet":"M240-160q-66 0-113-47T80-320v-320q0-66 47-113t113-47h480q66 0 113 47t47 113v320q0 66-47 113t-113 47H240Zm0-480h480q22 0 42 5t38 16v-21q0-33-23.5-56.5T720-720H240q-33 0-56.5 23.5T160-640v21q18-11 38-16t42-5Zm-74 130 445 108q9 2 18 0t17-8l139-116q-11-15-28-24.5t-37-9.5H240q-26 0-45.5 13.5T166-510Z","diversity_3":"M40-200v-120q0-34 23.5-57t56.5-23h131q20 0 38 10t29 27q29 39 71.5 61t90.5 22q49 0 91.5-22t70.5-61q13-17 30.5-27t36.5-10h131q34 0 57 23t23 57v120q0 17-11.5 28.5T880-160H680q-17 0-28.5-11.5T640-200v-51q-35 25-75.5 38T480-200q-43 0-84-13.5T320-252v52q0 17-11.5 28.5T280-160H80q-17 0-28.5-11.5T40-200Zm440-120q-38 0-72-17.5T351-386q-17-25-42.5-39.5T253-440q22-37 93-58.5T480-520q63 0 134 21.5t93 58.5q-29 0-55 14.5T609-386q-22 32-56 49t-73 17ZM160-440q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T280-560q0 50-34.5 85T160-440Zm640 0q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T920-560q0 50-34.5 85T800-440ZM480-560q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-680q0 50-34.5 85T480-560Z","forum":"M280-240q-17 0-28.5-11.5T240-280v-80h520v-360h80q17 0 28.5 11.5T880-680v503q0 27-24.5 37.5T812-148l-92-92H280Zm-40-200-92 92q-19 19-43.5 8.5T80-377v-463q0-17 11.5-28.5T120-880h520q17 0 28.5 11.5T680-840v360q0 17-11.5 28.5T640-440H240Zm360-80v-280H160v280h440Zm-440 0v-280 280Z","psychology":"m434-410 4 32q1 8 6.5 13t13.5 5h44q8 0 13.5-5t6.5-13l4-32q8-3 14.5-7t11.5-9l30 13q7 3 14 1t11-9l22-38q4-7 2.5-14t-7.5-12l-26-19q2-8 2-16t-2-16l26-19q6-5 7.5-12t-2.5-14l-22-38q-4-7-11-9t-14 1l-30 13q-5-5-11.5-9t-14.5-7l-4-32q-1-8-6.5-13t-13.5-5h-44q-8 0-13.5 5t-6.5 13l-4 32q-8 3-14.5 7t-11.5 9l-30-13q-7-3-14-1t-11 9l-22 38q-4 7-2.5 14t7.5 12l26 19q-2 8-2 16t2 16l-26 19q-6 5-7.5 12t2.5 14l22 38q4 7 11 9t14-1l30-13q5 5 11.5 9t14.5 7Zm46-50q-25 0-42.5-17.5T420-520q0-25 17.5-42.5T480-580q25 0 42.5 17.5T540-520q0 25-17.5 42.5T480-460ZM240-252q-57-52-88.5-121.5T120-520q0-150 105-255t255-105q125 0 221.5 73.5T827-615l52 205q5 19-7 34.5T840-360h-80v120q0 33-23.5 56.5T680-160h-80v40q0 17-11.5 28.5T560-80q-17 0-28.5-11.5T520-120v-80q0-17 11.5-28.5T560-240h120v-160q0-17 11.5-28.5T720-440h68l-38-155q-23-91-98-148t-172-57q-116 0-198 81t-82 197q0 60 24.5 114t69.5 96l26 24v168q0 17-11.5 28.5T280-80q-17 0-28.5-11.5T240-120v-132Zm254-188Z","child_care":"M580-490q-21 0-35.5-14.5T530-540q0-21 14.5-35.5T580-590q21 0 35.5 14.5T630-540q0 21-14.5 35.5T580-490Zm-200 0q-21 0-35.5-14.5T330-540q0-21 14.5-35.5T380-590q21 0 35.5 14.5T430-540q0 21-14.5 35.5T380-490Zm100 210q-60 0-108.5-33T300-400h360q-23 54-71.5 87T480-280Zm0 160q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm0-80q116 0 198-82t82-198q0-116-82-198t-198-82h-12q-6 0-12 2-6 6-8 13t-2 15q0 21 14.5 35.5T496-680q9 0 16.5-3t15.5-3q12 0 20 9t8 21q0 23-21.5 29.5T496-620q-45 0-77.5-32.5T386-730v-6q0-3 1-8-83 30-135 101t-52 163q0 116 82 198t198 82Zm0-280Z","shield":"M480-84q-7 0-13-1t-12-3q-135-45-215-166.5T160-516v-189q0-25 14.5-45t37.5-29l240-90q14-5 28-5t28 5l240 90q23 9 37.5 29t14.5 45v189q0 140-80 261.5T505-88q-6 2-12 3t-13 1Zm0-80q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z","chat":"m240-240-92 92q-19 19-43.5 8.5T80-177v-623q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240Zm-34-80h594v-480H160v525l46-45Zm-46 0v-480 480Zm120-80h240q17 0 28.5-11.5T560-440q0-17-11.5-28.5T520-480H280q-17 0-28.5 11.5T240-440q0 17 11.5 28.5T280-400Zm0-120h400q17 0 28.5-11.5T720-560q0-17-11.5-28.5T680-600H280q-17 0-28.5 11.5T240-560q0 17 11.5 28.5T280-520Zm0-120h400q17 0 28.5-11.5T720-680q0-17-11.5-28.5T680-720H280q-17 0-28.5 11.5T240-680q0 17 11.5 28.5T280-640Z","attach_file":"M720-330q0 104-73 177T470-80q-104 0-177-73t-73-177v-370q0-75 52.5-127.5T400-880q75 0 127.5 52.5T580-700v350q0 46-32 78t-78 32q-46 0-78-32t-32-78v-330q0-17 11.5-28.5T400-720q17 0 28.5 11.5T440-680v330q0 13 8.5 21.5T470-320q13 0 21.5-8.5T500-350v-350q-1-42-29.5-71T400-800q-42 0-71 29t-29 71v370q-1 71 49 120.5T470-160q70 0 119-49.5T640-330v-350q0-17 11.5-28.5T680-720q17 0 28.5 11.5T720-680v350Z","notifications":"M200-200q-17 0-28.5-11.5T160-240q0-17 11.5-28.5T200-280h40v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h40q17 0 28.5 11.5T800-240q0 17-11.5 28.5T760-200H200Zm280-300Zm0 420q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z","flag":"M280-400v240q0 17-11.5 28.5T240-120q-17 0-28.5-11.5T200-160v-600q0-17 11.5-28.5T240-800h287q14 0 25 9t14 23l10 48h184q17 0 28.5 11.5T800-680v320q0 17-11.5 28.5T760-320H553q-14 0-25-9t-14-23l-10-48H280Zm306 0h134v-240H543q-14 0-25-9t-14-23l-10-48H280v240h257q14 0 25 9t14 23l10 48Zm-86-160Z","male":"M800-760v160q0 17-11.5 28.5T760-560q-17 0-28.5-11.5T720-600v-63L561-505q19 28 29 59.5t10 65.5q0 92-64 156t-156 64q-92 0-156-64t-64-156q0-92 64-156t156-64q33 0 65 9.5t59 29.5l159-159h-63q-17 0-28.5-11.5T560-760q0-17 11.5-28.5T600-800h160q17 0 28.5 11.5T800-760ZM380-520q-58 0-99 41t-41 99q0 58 41 99t99 41q58 0 99-41t41-99q0-58-41-99t-99-41Z","pending":"M280-420q25 0 42.5-17.5T340-480q0-25-17.5-42.5T280-540q-25 0-42.5 17.5T220-480q0 25 17.5 42.5T280-420Zm200 0q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420Zm200 0q25 0 42.5-17.5T740-480q0-25-17.5-42.5T680-540q-25 0-42.5 17.5T620-480q0 25 17.5 42.5T680-420ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z","construction":"M714-162 537-339l84-84 177 177q17 17 17 42t-17 42q-17 17-42 17t-42-17Zm-552 0q-17-17-17-42t17-42l234-234-68-68q-11 11-28 11t-28-11l-23-23v90q0 14-12 19t-22-5L106-576q-10-10-5-22t19-12h90l-22-22q-12-12-12-28t12-28l114-114q20-20 43-29t47-9q20 0 37.5 6t34.5 18q8 5 8.5 14t-6.5 16l-76 76 22 22q11 11 11 28t-11 28l68 68 90-90q-4-11-6.5-23t-2.5-24q0-59 40.5-99.5T701-841q8 0 15 .5t14 2.5q9 3 11.5 12.5T737-809l-65 65q-6 6-6 14t6 14l44 44q6 6 14 6t14-6l65-65q7-7 16.5-5t12.5 12q2 7 2.5 14t.5 15q0 59-40.5 99.5T701-561q-12 0-24-2t-23-7L246-162q-17 17-42 17t-42-17Z","check_circle":"m424-408-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-408Zm56 328q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z","dark_mode":"M480-120q-151 0-255.5-104.5T120-480q0-138 90-239.5T440-838q13-2 23 3.5t16 14.5q6 9 6.5 21t-7.5 23q-17 26-25.5 55t-8.5 61q0 90 63 153t153 63q31 0 61.5-9t54.5-25q11-7 22.5-6.5T819-479q10 5 15.5 15t3.5 24q-14 138-117.5 229T480-120Zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 198t198 82Zm-10-270Z","settings":"M433-80q-27 0-46.5-18T363-142l-9-66q-13-5-24.5-12T307-235l-62 26q-25 11-50 2t-39-32l-47-82q-14-23-8-49t27-43l53-40q-1-7-1-13.5v-27q0-6.5 1-13.5l-53-40q-21-17-27-43t8-49l47-82q14-23 39-32t50 2l62 26q11-8 23-15t24-12l9-66q4-26 23.5-44t46.5-18h94q27 0 46.5 18t23.5 44l9 66q13 5 24.5 12t22.5 15l62-26q25-11 50-2t39 32l47 82q14 23 8 49t-27 43l-53 40q1 7 1 13.5v27q0 6.5-2 13.5l53 40q21 17 27 43t-8 49l-48 82q-14 23-39 32t-50-2l-60-26q-11 8-23 15t-24 12l-9 66q-4 26-23.5 44T527-80h-94Zm7-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z","picture_as_pdf":"M400-540h40q17 0 28.5-11.5T480-580v-40q0-17-11.5-28.5T440-660h-60q-8 0-14 6t-6 14v160q0 8 6 14t14 6q8 0 14-6t6-14v-60Zm0-40v-40h40v40h-40Zm200 120q17 0 28.5-11.5T640-500v-120q0-17-11.5-28.5T600-660h-60q-8 0-14 6t-6 14v160q0 8 6 14t14 6h60Zm-40-40v-120h40v120h-40Zm160-40h20q8 0 14-6t6-14q0-8-6-14t-14-6h-20v-40h20q8 0 14-6t6-14q0-8-6-14t-14-6h-40q-8 0-14 6t-6 14v160q0 8 6 14t14 6q8 0 14-6t6-14v-60ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-520q0-17 11.5-28.5T120-720q17 0 28.5 11.5T160-680v520h520q17 0 28.5 11.5T720-120q0 17-11.5 28.5T680-80H160Zm160-720v480-480Z","list":"M320-600q-17 0-28.5-11.5T280-640q0-17 11.5-28.5T320-680h480q17 0 28.5 11.5T840-640q0 17-11.5 28.5T800-600H320Zm0 160q-17 0-28.5-11.5T280-480q0-17 11.5-28.5T320-520h480q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H320Zm0 160q-17 0-28.5-11.5T280-320q0-17 11.5-28.5T320-360h480q17 0 28.5 11.5T840-320q0 17-11.5 28.5T800-280H320ZM160-600q-17 0-28.5-11.5T120-640q0-17 11.5-28.5T160-680q17 0 28.5 11.5T200-640q0 17-11.5 28.5T160-600Zm0 160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440Zm0 160q-17 0-28.5-11.5T120-320q0-17 11.5-28.5T160-360q17 0 28.5 11.5T200-320q0 17-11.5 28.5T160-280Z","local_shipping":"M240-160q-50 0-85-35t-35-85H80q-17 0-28.5-11.5T40-320v-400q0-33 23.5-56.5T120-800h480q33 0 56.5 23.5T680-720v80h80q19 0 36 8.5t28 23.5l88 117q4 5 6 11t2 13v147q0 17-11.5 28.5T880-280h-40q0 50-35 85t-85 35q-50 0-85-35t-35-85H360q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T280-280q0-17-11.5-28.5T240-320q-17 0-28.5 11.5T200-280q0 17 11.5 28.5T240-240ZM120-360h32q17-18 39-29t49-11q27 0 49 11t39 29h272v-360H120v360Zm600 120q17 0 28.5-11.5T760-280q0-17-11.5-28.5T720-320q-17 0-28.5 11.5T680-280q0 17 11.5 28.5T720-240Zm-40-200h170l-90-120h-80v120ZM360-540Z","volume_up":"M760-481q0-83-44-151.5T598-735q-15-7-22-21.5t-2-29.5q6-16 21.5-23t31.5 0q97 43 155 131.5T840-481q0 108-58 196.5T627-153q-16 7-31.5 0T574-176q-5-15 2-29.5t22-21.5q74-34 118-102.5T760-481ZM280-360H160q-17 0-28.5-11.5T120-400v-160q0-17 11.5-28.5T160-600h120l132-132q19-19 43.5-8.5T480-703v446q0 27-24.5 37.5T412-228L280-360Zm380-120q0 42-19 79.5T591-339q-10 6-20.5.5T560-356v-250q0-12 10.5-17.5t20.5.5q31 25 50 63t19 80ZM400-606l-86 86H200v80h114l86 86v-252ZM300-480Z","train":"M160-340v-380q0-53 27.5-84.5t72.5-48q45-16.5 102.5-22T480-880q66 0 124.5 5.5t102 22q43.5 16.5 68.5 48t25 84.5v380q0 59-40.5 99.5T660-200l20 20q17 17 8 38.5T655-120q-7 0-13.5-2.5T630-130l-70-70H400l-70 70q-5 5-11.5 7.5T305-120q-23 0-32.5-21.5T280-180l20-20q-59 0-99.5-40.5T160-340Zm320-460q-106 0-155 12.5T258-760h448q-15-17-64.5-28.5T480-800ZM240-560h200v-120H240v120Zm420 80H240h480-60Zm-140-80h200v-120H520v120ZM340-320q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm280 0q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm-320 40h360q26 0 43-17t17-43v-140H240v140q0 26 17 43t43 17Zm180-480h226-448 222Z","block":"M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z","accessible":"M400-80q-83 0-141.5-58.5T200-280q0-51 23-94t61-70q14-10 30-7t26 17q10 14 7.5 30T331-378q-23 17-37 42.5T280-280q0 50 35 85t85 35q30 0 55.5-14t42.5-37q10-14 26-16.5t30 7.5q14 10 17 26t-7 30q-27 38-70 61t-94 23Zm320 0q-17 0-28.5-11.5T680-120v-160H480q-33 0-56.5-23.5T400-360v-240q0-33 23.5-56.5T480-680q24 0 41.5 10.5T559-636q45 54 81.5 79t78.5 33q17 3 29 15t12 29q0 17-12.5 28t-28.5 8q-44-8-85.5-28T560-518v138h120q33 0 56.5 23.5T760-300v180q0 17-11.5 28.5T720-80ZM480-720q-33 0-56.5-23.5T400-800q0-33 23.5-56.5T480-880q33 0 56.5 23.5T560-800q0 33-23.5 56.5T480-720Z","menu":"M160-240q-17 0-28.5-11.5T120-280q0-17 11.5-28.5T160-320h640q17 0 28.5 11.5T840-280q0 17-11.5 28.5T800-240H160Zm0-200q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h640q17 0 28.5 11.5T840-480q0 17-11.5 28.5T800-440H160Zm0-200q-17 0-28.5-11.5T120-680q0-17 11.5-28.5T160-720h640q17 0 28.5 11.5T840-680q0 17-11.5 28.5T800-640H160Z","visibility":"M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-134 0-244.5-72T61-462q-5-9-7.5-18.5T51-500q0-10 2.5-19.5T61-538q64-118 174.5-190T480-800q134 0 244.5 72T899-538q5 9 7.5 18.5T909-500q0 10-2.5 19.5T899-462q-64 118-174.5 190T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z","brush":"M240-120q-45 0-89-22t-71-58q26 0 53-20.5t27-59.5q0-50 35-85t85-35q50 0 85 35t35 85q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T320-280q0-17-11.5-28.5T280-320q-17 0-28.5 11.5T240-280q0 23-5.5 42T220-202q5 2 10 2h10Zm230-160L360-470l358-358q11-11 27.5-11.5T774-828l54 54q12 12 12 28t-12 28L470-360Zm-190 80Z","support_agent":"M480-120q-17 0-28.5-11.5T440-160q0-17 11.5-28.5T480-200h280v-284q0-117-81.5-198.5T480-764q-117 0-198.5 81.5T200-484v204q0 17-11.5 28.5T160-240q-33 0-56.5-23.5T80-320v-80q0-21 10.5-39.5T120-469l3-53q8-68 39.5-126t79-101q47.5-43 109-67T480-840q68 0 129 24t109 66.5Q766-707 797-649t40 126l3 52q19 9 29.5 27t10.5 38v92q0 20-10.5 38T840-249v49q0 33-23.5 56.5T760-120H480ZM360-400q-17 0-28.5-11.5T320-440q0-17 11.5-28.5T360-480q17 0 28.5 11.5T400-440q0 17-11.5 28.5T360-400Zm240 0q-17 0-28.5-11.5T560-440q0-17 11.5-28.5T600-480q17 0 28.5 11.5T640-440q0 17-11.5 28.5T600-400Zm-359-62q-7-106 64-182t177-76q89 0 156.5 56.5T720-519q-91-1-167.5-49T435-698q-16 80-67.5 142.5T241-462Z","inventory":"m620-275 198-198q11-11 28-11t28 11q11 11 11 28t-11 28L648-191q-12 12-28 12t-28-12L478-305q-11-11-11-28t11-28q11-11 28-11t28 11l86 86ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h167q11-35 43-57.5t70-22.5q40 0 71.5 22.5T594-840h166q33 0 56.5 23.5T840-760v160q0 17-11.5 28.5T800-560q-17 0-28.5-11.5T760-600v-160h-80v80q0 17-11.5 28.5T640-640H320q-17 0-28.5-11.5T280-680v-80h-80v560h200q17 0 28.5 11.5T440-160q0 17-11.5 28.5T400-120H200Zm280-640q17 0 28.5-11.5T520-800q0-17-11.5-28.5T480-840q-17 0-28.5 11.5T440-800q0 17 11.5 28.5T480-760Z","storage":"M200-160q-33 0-56.5-23.5T120-240q0-33 23.5-56.5T200-320h560q33 0 56.5 23.5T840-240q0 33-23.5 56.5T760-160H200Zm0-480q-33 0-56.5-23.5T120-720q0-33 23.5-56.5T200-800h560q33 0 56.5 23.5T840-720q0 33-23.5 56.5T760-640H200Zm0 240q-33 0-56.5-23.5T120-480q0-33 23.5-56.5T200-560h560q33 0 56.5 23.5T840-480q0 33-23.5 56.5T760-400H200Zm40-280q17 0 28.5-11.5T280-720q0-17-11.5-28.5T240-760q-17 0-28.5 11.5T200-720q0 17 11.5 28.5T240-680Zm0 240q17 0 28.5-11.5T280-480q0-17-11.5-28.5T240-520q-17 0-28.5 11.5T200-480q0 17 11.5 28.5T240-440Zm0 240q17 0 28.5-11.5T280-240q0-17-11.5-28.5T240-280q-17 0-28.5 11.5T200-240q0 17 11.5 28.5T240-200Z","trending_down":"M744-320 536-526 433-423q-23 23-57 23t-57-23L108-636q-11-11-11.5-27.5T108-692q11-11 28-11t28 11l212 212 103-103q23-23 57-23t57 23l207 207v-64q0-17 11.5-28.5T840-480q17 0 28.5 11.5T880-440v160q0 17-11.5 28.5T840-240H680q-17 0-28.5-11.5T640-280q0-17 11.5-28.5T680-320h64Z","hourglass_empty":"M320-160h320v-120q0-66-47-113t-113-47q-66 0-113 47t-47 113v120Zm160-360q66 0 113-47t47-113v-120H320v120q0 66 47 113t113 47ZM200-80q-17 0-28.5-11.5T160-120q0-17 11.5-28.5T200-160h40v-120q0-61 28.5-114.5T348-480q-51-32-79.5-85.5T240-680v-120h-40q-17 0-28.5-11.5T160-840q0-17 11.5-28.5T200-880h560q17 0 28.5 11.5T800-840q0 17-11.5 28.5T760-800h-40v120q0 61-28.5 114.5T612-480q51 32 79.5 85.5T720-280v120h40q17 0 28.5 11.5T800-120q0 17-11.5 28.5T760-80H200Z","flight":"M480-120 377-91q-14 4-25.5-4.5T340-118q0-12 3-19.5t8-11.5l69-51v-220l-291 86q-19 5-34-6t-15-31q0-15 5-25t14-15l321-189v-220q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v220l321 189q9 5 14 15t5 25q0 20-15 31t-34 6l-291-86v220l69 51q5 4 8 11.5t3 19.5q0 14-11.5 22.5T583-91l-103-29Z","attach_money":"M481-120q-17 0-28.5-11.5T441-160v-46q-45-10-79-35t-55-70q-7-14-.5-29.5T330-363q14-6 29 .5t23 21.5q17 30 43 45.5t64 15.5q41 0 69.5-18.5T587-356q0-35-22-55.5T463-458q-86-27-118-64.5T313-614q0-65 42-101t86-41v-44q0-17 11.5-28.5T481-840q17 0 28.5 11.5T521-800v44q38 6 66 24.5t46 45.5q9 13 3.5 29T614-634q-14 6-29 .5T557-653q-13-14-30.5-21.5T483-682q-44 0-67 19.5T393-614q0 33 30 52t104 40q69 20 104.5 63.5T667-358q0 71-42 108t-104 46v44q0 17-11.5 28.5T481-120Z","thumb_down":"M120-320q-32 0-56-24t-24-56v-80q0-7 2-15t4-15l120-282q9-20 30-34t44-14h440v520L440-82q-15 15-35.5 17.5T365-72q-19-10-28-28t-4-37l45-183H120Zm480-34v-406H240L120-480v80h360l-54 220 174-174Zm200-486q33 0 56.5 23.5T880-760v360q0 33-23.5 56.5T800-320H680v-80h120v-360H680v-80h120Zm-200 80v406-406Z","videocam":"M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l126-126q10-10 22-5t12 19v344q0 14-12 19t-22-5L720-420v180q0 33-23.5 56.5T640-160H160Zm0-80h480v-480H160v480Zm0 0v-480 480Z","link":"M280-280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h120q17 0 28.5 11.5T440-640q0 17-11.5 28.5T400-600H280q-50 0-85 35t-35 85q0 50 35 85t85 35h120q17 0 28.5 11.5T440-320q0 17-11.5 28.5T400-280H280Zm80-160q-17 0-28.5-11.5T320-480q0-17 11.5-28.5T360-520h240q17 0 28.5 11.5T640-480q0 17-11.5 28.5T600-440H360Zm200 160q-17 0-28.5-11.5T520-320q0-17 11.5-28.5T560-360h120q50 0 85-35t35-85q0-50-35-85t-85-35H560q-17 0-28.5-11.5T520-640q0-17 11.5-28.5T560-680h120q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H560Z","note":"M6 22q-.825 0-1.412-.587Q4 20.825 4 20V4q0-.825.588-1.413Q5.175 2 6 2h7.175q.4 0 .763.15.362.15.637.425l4.85 4.85q.275.275.425.637.15.363.15.763V20q0 .825-.587 1.413Q18.825 22 18 22Zm7-14V4H6v16h12V9h-4q-.425 0-.712-.288Q13 8.425 13 8ZM6 4v5-5 16V4Z","visibility_off":"M607-627q29 29 42.5 66t9.5 76q0 15-11 25.5T622-449q-15 0-25.5-10.5T586-485q5-26-3-50t-25-41q-17-17-41-26t-51-4q-15 0-25.5-11T430-643q0-15 10.5-25.5T466-679q38-4 75 9.5t66 42.5Zm-127-93q-19 0-37 1.5t-36 5.5q-17 3-30.5-5T358-742q-5-16 3.5-31t24.5-18q23-5 46.5-7t47.5-2q137 0 250.5 72T904-534q4 8 6 16.5t2 17.5q0 9-1.5 17.5T905-466q-18 40-44.5 75T802-327q-12 11-28 9t-26-16q-10-14-8.5-30.5T753-392q24-23 44-50t35-58q-50-101-144.5-160.5T480-720Zm0 520q-134 0-245-72.5T60-463q-5-8-7.5-17.5T50-500q0-10 2-19t7-18q20-40 46.5-76.5T166-680l-83-84q-11-12-10.5-28.5T84-820q11-11 28-11t28 11l680 680q11 11 11.5 27.5T820-84q-11 11-28 11t-28-11L624-222q-35 11-71 16.5t-73 5.5ZM222-624q-29 26-53 57t-41 67q50 101 144.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z","directions_bus":"M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm162-560h224-448 224Zm158 280H240h480-80Zm-400-80h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320ZM258-760h448q-15-17-64.5-28.5T482-800q-107 0-156.5 12.5T258-760Zm62 480h320q33 0 56.5-23.5T720-360v-120H240v120q0 33 23.5 56.5T320-280Z","more_horiz":"M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z","work":"M160-120q-33 0-56.5-23.5T80-200v-440q0-33 23.5-56.5T160-720h160v-80q0-33 23.5-56.5T400-880h160q33 0 56.5 23.5T640-800v80h160q33 0 56.5 23.5T880-640v440q0 33-23.5 56.5T800-120H160Zm0-80h640v-440H160v440Zm240-520h160v-80H400v80ZM160-200v-440 440Z","bar_chart":"M680-160q-17 0-28.5-11.5T640-200v-200q0-17 11.5-28.5T680-440h80q17 0 28.5 11.5T800-400v200q0 17-11.5 28.5T760-160h-80Zm-240 0q-17 0-28.5-11.5T400-200v-560q0-17 11.5-28.5T440-800h80q17 0 28.5 11.5T560-760v560q0 17-11.5 28.5T520-160h-80Zm-240 0q-17 0-28.5-11.5T160-200v-360q0-17 11.5-28.5T200-600h80q17 0 28.5 11.5T320-560v360q0 17-11.5 28.5T280-160h-80Z","home":"M240-200h120v-200q0-17 11.5-28.5T400-440h160q17 0 28.5 11.5T600-400v200h120v-360L480-740 240-560v360Zm-80 0v-360q0-19 8.5-36t23.5-28l240-180q21-16 48-16t48 16l240 180q15 11 23.5 28t8.5 36v360q0 33-23.5 56.5T720-120H560q-17 0-28.5-11.5T520-160v-200h-80v200q0 17-11.5 28.5T400-120H240q-33 0-56.5-23.5T160-200Zm320-270Z","newspaper":"M160-120q-33 0-56.5-23.5T80-200v-616q0-7 6-9.5t11 2.5l50 50 52-53q6-6 14-6t14 6l53 53 53-53q6-6 14-6t14 6l52 53 53-53q6-6 14-6t14 6l53 53 52-53q6-6 14-6t14 6l53 53 53-53q6-6 14-6t14 6l52 53 50-50q5-5 11-2.5t6 9.5v616q0 33-23.5 56.5T800-120H160Zm0-80h280v-240H160v240Zm360 0h280v-80H520v80Zm0-160h280v-80H520v80ZM160-520h640v-120H160v120Z","near_me":"M402-402 143-507q-13-5-19-15.5t-6-21.5q0-11 6.5-21.5T144-581l614-228q12-5 23-2t19 11q8 8 11 19t-2 23L581-144q-5 13-15.5 19.5T544-118q-11 0-21.5-6T507-143L402-402Zm140 134 162-436-436 162 196 78 78 196Zm-78-196Z","expand_more":"M480-362q-8 0-15-2.5t-13-8.5L268-557q-11-11-11-28t11-28q11-11 28-11t28 11l156 156 156-156q11-11 28-11t28 11q11 11 11 28t-11 28L508-373q-6 6-13 8.5t-15 2.5Z","mosque":"M40-200v-411q-18-11-29-28.5T0-680q0-23 24-56t56-64q32 31 56 64t24 56q0 23-11 40.5T120-611v171h80v-80q0-25 16-48t46-30q-11-17-16.5-37t-5.5-41q0-40 19-74t51-56l125-84q20-14 45-14t45 14l125 84q32 22 51 56t19 74q0 21-5.5 41T698-598q30 7 46 30t16 48v80h80v-171q-18-11-29-28.5T800-680q0-23 24-56t56-64q32 31 56 64t24 56q0 23-11 40.5T920-611v411q0 33-23.5 56.5T840-120H560q-17 0-28.5-11.5T520-160v-120q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280v120q0 17-11.5 28.5T400-120H120q-33 0-56.5-23.5T40-200Zm356-400h168q32 0 54-22t22-54q0-20-9-36.5T606-740l-126-84-126 84q-16 11-25 27.5t-9 36.5q0 32 22 54t54 22ZM120-200h240v-80q0-50 35-85t85-35q50 0 85 35t35 85v80h240v-160h-80q-33 0-56.5-23.5T680-440v-80H280v80q0 33-23.5 56.5T200-360h-80v160Zm360-320Zm0-80Zm0 2Z","schedule":"M520-496v-144q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v159q0 8 3 15.5t9 13.5l132 132q11 11 28 11t28-11q11-11 11-28t-11-28L520-496ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z","upload_file":"M440-367v127q0 17 11.5 28.5T480-200q17 0 28.5-11.5T520-240v-127l36 36q6 6 13.5 9t15 2.5q7.5-.5 14.5-3.5t13-9q11-12 11.5-28T612-388L508-492q-6-6-13-8.5t-15-2.5q-8 0-15 2.5t-13 8.5L348-388q-12 12-11.5 28t12.5 28q12 11 28 11.5t28-11.5l35-35ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h287q16 0 30.5 6t25.5 17l194 194q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-440H560q-17 0-28.5-11.5T520-640ZM240-800v200-200 640-640Z","build":"M360-360q-100 0-170-70t-70-170q0-20 3-40t11-38q5-10 12.5-15t16.5-7q9-2 18.5.5T199-689l105 105 72-72-105-105q-8-8-10.5-17.5T260-797q2-9 7-16.5t15-12.5q18-8 38-11t40-3q100 0 170 70t70 170q0 23-4 43.5T584-516l202 200q29 29 29 71t-29 71q-29 29-71 29t-71-30L444-376q-20 8-40.5 12t-43.5 4Zm0-80q26 0 52-8t47-25l243 243q5 5 13.5 4.5T729-231q5-5 5-13.5t-5-13.5L486-500q18-20 26-46.5t8-53.5q0-60-38.5-104.5T386-758l74 74q12 12 12 28t-12 28L332-500q-12 12-28 12t-28-12l-74-74q9 57 53.5 95.5T360-440Zm109-51Z","map":"m574-129-214-75-186 72q-10 4-19.5 2.5T137-136q-8-5-12.5-13.5T120-169v-561q0-13 7.5-23t20.5-15l186-63q6-2 12.5-3t13.5-1q7 0 13.5 1t12.5 3l214 75 186-72q10-4 19.5-2.5T823-824q8 5 12.5 13.5T840-791v561q0 13-7.5 23T812-192l-186 63q-6 2-12.5 3t-13.5 1q-7 0-13.5-1t-12.5-3Zm-14-89v-468l-160-56v468l160 56Zm80 0 120-40v-474l-120 46v468Zm-440-10 120-46v-468l-120 40v474Zm440-458v468-468Zm-320-56v468-468Z","cloud_download":"M440-474v-242q-76 14-118 73.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-48-22-89.5T600-680v-93q74 35 117 103.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260q-91 0-155.5-63T40-377q0-78 47-139t123-78q17-72 85-137t145-65q33 0 56.5 23.5T520-716v242l36-35q11-11 27.5-11t28.5 12q11 11 11 28t-11 28L508-348q-12 12-28 12t-28-12L348-452q-11-11-11.5-27.5T348-508q11-11 27.5-11.5T404-509l36 35Zm40-44Z","computer":"M80-120q-17 0-28.5-11.5T40-160q0-17 11.5-28.5T80-200h800q17 0 28.5 11.5T920-160q0 17-11.5 28.5T880-120H80Zm80-120q-33 0-56.5-23.5T80-320v-440q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v440q0 33-23.5 56.5T800-240H160Zm0-80h640v-440H160v440Zm0 0v-440 440Z","call":"M798-120q-125 0-247-54.5T329-329Q229-429 174.5-551T120-798q0-18 12-30t30-12h162q14 0 25 9.5t13 22.5l26 140q2 16-1 27t-11 19l-97 98q20 37 47.5 71.5T387-386q31 31 65 57.5t72 48.5l94-94q9-9 23.5-13.5T670-390l138 28q14 4 23 14.5t9 23.5v162q0 18-12 30t-30 12ZM241-600l66-66-17-94h-89q5 41 14 81t26 79Zm358 358q39 17 79.5 27t81.5 13v-88l-94-19-67 67ZM241-600Zm358 358Z","login":"M520-120q-17 0-28.5-11.5T480-160q0-17 11.5-28.5T520-200h240v-560H520q-17 0-28.5-11.5T480-800q0-17 11.5-28.5T520-840h240q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H520Zm-73-320H160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h287l-75-75q-11-11-11-27t11-28q11-12 28-12.5t29 11.5l143 143q12 12 12 28t-12 28L429-309q-12 12-28.5 11.5T372-310q-11-12-10.5-28.5T373-366l74-74Z","thermostat":"M560-520q-17 0-28.5-11.5T520-560q0-17 11.5-28.5T560-600h120q17 0 28.5 11.5T720-560q0 17-11.5 28.5T680-520H560Zm0-160q-17 0-28.5-11.5T520-720q0-17 11.5-28.5T560-760h240q17 0 28.5 11.5T840-720q0 17-11.5 28.5T800-680H560ZM320-120q-83 0-141.5-58.5T120-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T320-120ZM200-320h240q0-29-12.5-54T392-416l-32-24v-280q0-17-11.5-28.5T320-760q-17 0-28.5 11.5T280-720v280l-32 24q-23 17-35.5 42T200-320Z","sync":"M240-478q0 45 17 87.5t53 78.5l10 10v-58q0-17 11.5-28.5T360-400q17 0 28.5 11.5T400-360v160q0 17-11.5 28.5T360-160H200q-17 0-28.5-11.5T160-200q0-17 11.5-28.5T200-240h70l-16-14q-52-46-73-105t-21-119q0-94 48-170.5T337-766q14-8 29.5-1t20.5 23q5 15-.5 30T367-691q-58 32-92.5 88.5T240-478Zm480-4q0-45-17-87.5T650-648l-10-10v58q0 17-11.5 28.5T600-560q-17 0-28.5-11.5T560-600v-160q0-17 11.5-28.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720h-70l16 14q49 49 71.5 106.5T800-482q0 94-48 170.5T623-194q-14 8-29.5 1T573-216q-5-15 .5-30t19.5-23q58-32 92.5-88.5T720-482Z","sentiment_satisfied":"M480-260q53 0 100.5-23t76.5-67q11-17 3-33.5T634-400q-8 0-14.5 3.5T609-386q-23 31-57 48.5T480-320q-38 0-72-17.5T351-386q-5-7-11.5-10.5T325-400q-18 0-26 16t3 32q29 45 76.5 68.5T480-260Zm140-260q25 0 42.5-17.5T680-580q0-25-17.5-42.5T620-640q-25 0-42.5 17.5T560-580q0 25 17.5 42.5T620-520Zm-280 0q25 0 42.5-17.5T400-580q0-25-17.5-42.5T340-640q-25 0-42.5 17.5T280-580q0 25 17.5 42.5T340-520ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z","wb_sunny":"M440-840v-40q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v40q0 17-11.5 28.5T480-800q-17 0-28.5-11.5T440-840Zm0 760v-40q0-17 11.5-28.5T480-160q17 0 28.5 11.5T520-120v40q0 17-11.5 28.5T480-40q-17 0-28.5-11.5T440-80Zm440-360h-40q-17 0-28.5-11.5T800-480q0-17 11.5-28.5T840-520h40q17 0 28.5 11.5T920-480q0 17-11.5 28.5T880-440Zm-760 0H80q-17 0-28.5-11.5T40-480q0-17 11.5-28.5T80-520h40q17 0 28.5 11.5T160-480q0 17-11.5 28.5T120-440Zm670-293-14 14q-11 11-27.5 11T720-720q-11-11-11.5-27.5T719-776l15-15q11-12 28-12t29 12q12 12 11.5 29T790-733ZM241-184l-15 15q-11 12-28 12t-29-12q-12-12-11.5-29t12.5-29l14-14q11-11 27.5-11t28.5 12q11 11 11.5 27.5T241-184Zm492 14-14-14q-11-11-11-27.5t12-28.5q11-11 27.5-11.5T776-241l15 15q12 11 12 28t-12 29q-12 12-29 11.5T733-170ZM184-719l-15-15q-12-11-12-28t12-29q12-12 29-11.5t29 12.5l14 14q11 11 11 27.5T240-720q-11 11-27.5 11.5T184-719Zm296 479q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Zm0-80q67 0 113.5-46.5T640-480q0-67-46.5-113.5T480-640q-67 0-113.5 46.5T320-480q0 67 46.5 113.5T480-320Zm0-160Z","agriculture":"M160-600q-17 0-28.5-11.5T120-640q0-17 11.5-28.5T160-680h120q33 0 56.5 23.5T360-600H160Zm80 360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm540 0q25 0 42.5-17.5T840-300q0-25-17.5-42.5T780-360q-25 0-42.5 17.5T720-300q0 25 17.5 42.5T780-240Zm-540-60q-25 0-42.5-17.5T180-360q0-25 17.5-42.5T240-420q25 0 42.5 17.5T300-360q0 25-17.5 42.5T240-300Zm560-139q26 5 43 13.5t37 27.5v-242q0-33-23.5-56.5T800-720H548l-42-44 56-56-28-28-142 142 30 28 56-56 42 42v92q0 33-23.5 56.5T440-520h-81q23 17 37 35t28 45h16q66 0 113-47t47-113v-40h200v201ZM641-320q6-27 14.5-43.5T682-400H436q4 23 4 40t-4 40h205Zm139 160q-58 0-99-41t-41-99q0-58 41-99t99-41q58 0 99 41t41 99q0 58-41 99t-99 41Zm-540 0q-83 0-141.5-58.5T40-360q0-83 58.5-141.5T240-560q83 0 141.5 58.5T440-360q0 83-58.5 141.5T240-160Zm393-360Z","table_chart":"M760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120ZM200-640h560v-120H200v120Zm100 80H200v360h100v-360Zm360 0v360h100v-360H660Zm-80 0H380v360h200v-360Z","store":"M200-800h560q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720H200q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800Zm0 640q-17 0-28.5-11.5T160-200v-200h-7q-19 0-31-14.5t-8-33.5l40-200q3-14 14-23t25-9h574q14 0 25 9t14 23l40 200q4 19-8 33.5T807-400h-7v200q0 17-11.5 28.5T760-160q-17 0-28.5-11.5T720-200v-200H560v200q0 17-11.5 28.5T520-160H200Zm40-80h240v-160H240v160Zm-38-240h556-556Zm0 0h556l-24-120H226l-24 120Z","umbrella":"m520-368 78-238-36 9-42-31v260Zm-80 0v-260l-42 32-37-10 79 238Zm40 288q-12 0-22.5-6.5T442-107L263-649q-8-23 8-39.5t39-11.5l70 17 60-46v-95q0-40 29-68t71-28q42 0 71 28t29 68q0 17-11.5 28.5T600-784q-17 0-28.5-11.5T560-824q0-8-6-13.5t-14-5.5q-8 0-14 5.5t-6 13.5v95l60 46 70-17q23-5 39 11.5t8 39.5L518-108q-5 14-15.5 21T480-80Z","calculate":"M320-320v50q0 13 8.5 21.5T350-240q13 0 21.5-8.5T380-270v-50h50q13 0 21.5-8.5T460-350q0-13-8.5-21.5T430-380h-50v-50q0-13-8.5-21.5T350-460q-13 0-21.5 8.5T320-430v50h-50q-13 0-21.5 8.5T240-350q0 13 8.5 21.5T270-320h50Zm230 50h140q13 0 21.5-8.5T720-300q0-13-8.5-21.5T690-330H550q-13 0-21.5 8.5T520-300q0 13 8.5 21.5T550-270Zm0-100h140q13 0 21.5-8.5T720-400q0-13-8.5-21.5T690-430H550q-13 0-21.5 8.5T520-400q0 13 8.5 21.5T550-370Zm70-208 35 35q9 9 21 9t21-9q8-8 8.5-20.5T698-585l-36-37 35-35q9-9 9-21t-9-21q-9-9-21-9t-21 9l-35 35-35-35q-9-9-21-9t-21 9q-9 9-9 21t9 21l35 35-36 37q-8 9-8 21t9 21q9 9 21 9t21-9l35-35Zm-340-14h140q13 0 21.5-8.5T450-622q0-13-8.5-21.5T420-652H280q-13 0-21.5 8.5T250-622q0 13 8.5 21.5T280-592Zm-80 472q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z","calendar_month":"M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-40q0-17 11.5-28.5T280-880q17 0 28.5 11.5T320-840v40h320v-40q0-17 11.5-28.5T680-880q17 0 28.5 11.5T720-840v40h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Zm280 240q-17 0-28.5-11.5T440-440q0-17 11.5-28.5T480-480q17 0 28.5 11.5T520-440q0 17-11.5 28.5T480-400Zm-160 0q-17 0-28.5-11.5T280-440q0-17 11.5-28.5T320-480q17 0 28.5 11.5T360-440q0 17-11.5 28.5T320-400Zm320 0q-17 0-28.5-11.5T600-440q0-17 11.5-28.5T640-480q17 0 28.5 11.5T680-440q0 17-11.5 28.5T640-400ZM480-240q-17 0-28.5-11.5T440-280q0-17 11.5-28.5T480-320q17 0 28.5 11.5T520-280q0 17-11.5 28.5T480-240Zm-160 0q-17 0-28.5-11.5T280-280q0-17 11.5-28.5T320-320q17 0 28.5 11.5T360-280q0 17-11.5 28.5T320-240Zm320 0q-17 0-28.5-11.5T600-280q0-17 11.5-28.5T640-320q17 0 28.5 11.5T680-280q0 17-11.5 28.5T640-240Z","favorite":"M480-147q-14 0-28.5-5T426-168l-69-63q-106-97-191.5-192.5T80-634q0-94 63-157t157-63q53 0 100 22.5t80 61.5q33-39 80-61.5T660-854q94 0 157 63t63 157q0 115-85 211T602-230l-68 62q-11 11-25.5 16t-28.5 5Zm-38-543q-29-41-62-62.5T300-774q-60 0-100 40t-40 100q0 52 37 110.5T285.5-410q51.5 55 106 103t88.5 79q34-31 88.5-79t106-103Q726-465 763-523.5T800-634q0-60-40-100t-100-40q-47 0-80 21.5T518-690q-7 10-17 15t-21 5q-11 0-21-5t-17-15Zm38 189Z","calendar_today":"M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-40q0-17 11.5-28.5T280-880q17 0 28.5 11.5T320-840v40h320v-40q0-17 11.5-28.5T680-880q17 0 28.5 11.5T720-840v40h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z","sell":"M856-390 570-104q-12 12-27 18t-30 6q-15 0-30-6t-27-18L103-457q-11-11-17-25.5T80-513v-287q0-33 23.5-56.5T160-880h287q16 0 31 6.5t26 17.5l352 353q12 12 17.5 27t5.5 30q0 15-5.5 29.5T856-390ZM513-160l286-286-353-354H160v286l353 354ZM260-640q25 0 42.5-17.5T320-700q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm220 160Z","explore":"M480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320ZM297-277l250-117q6-3 11-8t8-11l117-250q5-10-2.5-17.5T663-683L413-566q-6 3-11 8t-8 11L277-297q-5 10 2.5 17.5T297-277Z","stacked_bar_chart":"M200-160q-17 0-28.5-11.5T160-200v-360q0-17 11.5-28.5T200-600h80q17 0 28.5 11.5T320-560v360q0 17-11.5 28.5T280-160h-80Zm0-480q-17 0-28.5-11.5T160-680v-80q0-17 11.5-28.5T200-800h80q17 0 28.5 11.5T320-760v80q0 17-11.5 28.5T280-640h-80Zm240 480q-17 0-28.5-11.5T400-200v-240q0-17 11.5-28.5T440-480h80q17 0 28.5 11.5T560-440v240q0 17-11.5 28.5T520-160h-80Zm0-360q-17 0-28.5-11.5T400-560v-80q0-17 11.5-28.5T440-680h80q17 0 28.5 11.5T560-640v80q0 17-11.5 28.5T520-520h-80Zm240 360q-17 0-28.5-11.5T640-200v-120q0-17 11.5-28.5T680-360h80q17 0 28.5 11.5T800-320v120q0 17-11.5 28.5T760-160h-80Zm0-240q-17 0-28.5-11.5T640-440v-80q0-17 11.5-28.5T680-560h80q17 0 28.5 11.5T800-520v80q0 17-11.5 28.5T760-400h-80Z","handshake":"M475-160q4 0 8-2t6-4l328-328q12-12 17.5-27t5.5-30q0-16-5.5-30.5T817-607L647-777q-11-12-25.5-17.5T591-800q-15 0-30 5.5T534-777l-11 11 74 75q15 14 22 32t7 38q0 42-28.5 70.5T527-522q-20 0-38.5-7T456-550l-75-74-175 175q-3 3-4.5 6.5T200-435q0 8 6 14.5t14 6.5q4 0 8-2t6-4l108-108q11-11 27.5-11.5T398-528q11 11 11 28t-11 28L291-364q-3 3-4.5 6.5T285-350q0 8 6 14t14 6q4 0 8-2t6-4l108-107q11-11 27.5-11.5T483-443q11 11 11 28t-11 28L376-279q-3 2-4.5 6t-1.5 8q0 8 6 14t14 6q4 0 7.5-1.5t6.5-4.5l108-107q11-11 27.5-11.5T568-358q11 11 11 28t-11 28L460-194q-3 3-4.5 6.5T454-180q0 8 6.5 14t14.5 6Zm-1 80q-37 0-65.5-24.5T375-166q-34-5-57-28t-28-57q-34-5-56.5-28.5T206-336q-38-5-62-33t-24-66q0-20 7.5-38.5T149-506l175-175q23-23 56.5-23t56.5 23l75 75q2 3 6 4.5t8 1.5q9 0 15-5.5t6-14.5q0-4-1.5-8t-4.5-6L398-777q-11-12-25.5-17.5T342-800q-15 0-30 5.5T285-777L144-635q-14 14-20 33t-3 38q3 17-7 30t-27 15q-17 2-30-7.5T42-553q-6-38 5.5-74.5T87-692l141-141q24-23 53.5-35t60.5-12q31 0 60.5 12t52.5 35l11 11 11-11q24-23 53.5-35t60.5-12q31 0 60.5 12t52.5 35l169 169q23 23 35 53t12 61q0 31-12 60.5T873-437L545-110q-14 14-32.5 22T474-80Zm-98-560Z","folder":"M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z","apps":"M240-160q-33 0-56.5-23.5T160-240q0-33 23.5-56.5T240-320q33 0 56.5 23.5T320-240q0 33-23.5 56.5T240-160Zm240 0q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm240 0q-33 0-56.5-23.5T640-240q0-33 23.5-56.5T720-320q33 0 56.5 23.5T800-240q0 33-23.5 56.5T720-160ZM240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400ZM240-640q-33 0-56.5-23.5T160-720q0-33 23.5-56.5T240-800q33 0 56.5 23.5T320-720q0 33-23.5 56.5T240-640Zm240 0q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Zm240 0q-33 0-56.5-23.5T640-720q0-33 23.5-56.5T720-800q33 0 56.5 23.5T800-720q0 33-23.5 56.5T720-640Z","payments":"M560-440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM280-320q-33 0-56.5-23.5T200-400v-320q0-33 23.5-56.5T280-800h560q33 0 56.5 23.5T920-720v320q0 33-23.5 56.5T840-320H280Zm80-80h400q0-33 23.5-56.5T840-480v-160q-33 0-56.5-23.5T760-720H360q0 33-23.5 56.5T280-640v160q33 0 56.5 23.5T360-400Zm400 240H120q-33 0-56.5-23.5T40-240v-400q0-17 11.5-28.5T80-680q17 0 28.5 11.5T120-640v400h640q17 0 28.5 11.5T800-200q0 17-11.5 28.5T760-160ZM280-400v-320 320Z","help":"M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm2 160q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Zm4-172q25 0 43.5 16t18.5 40q0 22-13.5 39T502-525q-23 20-40.5 44T444-427q0 14 10.5 23.5T479-394q15 0 25.5-10t13.5-25q4-21 18-37.5t30-31.5q23-22 39.5-48t16.5-58q0-51-41.5-83.5T484-720q-38 0-72.5 16T359-655q-7 12-4.5 25.5T368-609q14 8 29 5t25-17q11-15 27.5-23t34.5-8Z","arrow_back":"m313-440 196 196q12 12 11.5 28T508-188q-12 11-28 11.5T452-188L188-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l264-264q11-11 27.5-11t28.5 11q12 12 12 28.5T508-715L313-520h447q17 0 28.5 11.5T800-480q0 17-11.5 28.5T760-440H313Z","music_note":"M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-382q0-17 11.5-28.5T520-840h160q17 0 28.5 11.5T720-800v80q0 17-11.5 28.5T680-680H560v400q0 66-47 113t-113 47Z","cloud":"M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Z","auto_awesome":"M19 8.3q-.125 0-.262-.075Q18.6 8.15 18.55 8l-.8-1.75-1.75-.8q-.15-.05-.225-.188Q15.7 5.125 15.7 5t.075-.263Q15.85 4.6 16 4.55l1.75-.8.8-1.75q.05-.15.188-.225.137-.075.262-.075t.263.075q.137.075.187.225l.8 1.75 1.75.8q.15.05.225.187.075.138.075.263t-.075.262Q22.15 5.4 22 5.45l-1.75.8-.8 1.75q-.05.15-.187.225-.138.075-.263.075Zm0 14q-.125 0-.262-.075-.138-.075-.188-.225l-.8-1.75-1.75-.8q-.15-.05-.225-.188-.075-.137-.075-.262t.075-.262q.075-.138.225-.188l1.75-.8.8-1.75q.05-.15.188-.225.137-.075.262-.075t.263.075q.137.075.187.225l.8 1.75 1.75.8q.15.05.225.188.075.137.075.262t-.075.262q-.075.138-.225.188l-1.75.8-.8 1.75q-.05.15-.187.225-.138.075-.263.075ZM9 18.575q-.275 0-.525-.15T8.1 18l-1.6-3.5L3 12.9q-.275-.125-.425-.375-.15-.25-.15-.525t.15-.525q.15-.25.425-.375l3.5-1.6L8.1 6q.125-.275.375-.425.25-.15.525-.15t.525.15q.25.15.375.425l1.6 3.5 3.5 1.6q.275.125.425.375.15.25.15.525t-.15.525q-.15.25-.425.375l-3.5 1.6L9.9 18q-.125.275-.375.425-.25.15-.525.15Zm0-3.425L10 13l2.15-1L10 11 9 8.85 8 11l-2.15 1L8 13ZM9 12Z","space_dashboard":"M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h240v-560H200v560Zm320 0h240v-280H520v280Zm0-360h240v-200H520v200Z","view_list":"M120-280v-400q0-33 23.5-56.5T200-760h560q33 0 56.5 23.5T840-680v400q0 33-23.5 56.5T760-200H200q-33 0-56.5-23.5T120-280Zm80-320h80v-80h-80v80Zm160 0h400v-80H360v80Zm0 160h400v-80H360v80Zm0 160h400v-80H360v80Zm-160 0h80v-80h-80v80Zm0-160h80v-80h-80v80Z","sentiment_dissatisfied":"M480-420q-54 0-101.5 23.5T302-328q-11 16-3 32t26 16q8 0 14.5-3.5T351-294q23-31 57-48.5t72-17.5q38 0 72 17.5t57 48.5q4 7 10.5 10.5T634-280q18 0 26-16.5t-3-33.5q-29-44-76.5-67T480-420Zm140-100q25 0 42.5-17.5T680-580q0-25-17.5-42.5T620-640q-25 0-42.5 17.5T560-580q0 25 17.5 42.5T620-520Zm-280 0q25 0 42.5-17.5T400-580q0-25-17.5-42.5T340-640q-25 0-42.5 17.5T280-580q0 25 17.5 42.5T340-520ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z","library_books":"M440-400h80q17 0 28.5-11.5T560-440q0-17-11.5-28.5T520-480h-80q-17 0-28.5 11.5T400-440q0 17 11.5 28.5T440-400Zm0-120h240q17 0 28.5-11.5T720-560q0-17-11.5-28.5T680-600H440q-17 0-28.5 11.5T400-560q0 17 11.5 28.5T440-520Zm0-120h240q17 0 28.5-11.5T720-680q0-17-11.5-28.5T680-720H440q-17 0-28.5 11.5T400-680q0 17 11.5 28.5T440-640ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-520q0-17 11.5-28.5T120-720q17 0 28.5 11.5T160-680v520h520q17 0 28.5 11.5T720-120q0 17-11.5 28.5T680-80H160Zm160-720v480-480Z","edit_note":"M200-400q-17 0-28.5-11.5T160-440q0-17 11.5-28.5T200-480h200q17 0 28.5 11.5T440-440q0 17-11.5 28.5T400-400H200Zm0-160q-17 0-28.5-11.5T160-600q0-17 11.5-28.5T200-640h360q17 0 28.5 11.5T600-600q0 17-11.5 28.5T560-560H200Zm0-160q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h360q17 0 28.5 11.5T600-760q0 17-11.5 28.5T560-720H200Zm320 520v-66q0-8 3-15.5t9-13.5l209-208q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q8 9 12.5 20t4.5 22q0 11-4 22.5T863-380L655-172q-6 6-13.5 9t-15.5 3h-66q-17 0-28.5-11.5T520-200Zm300-223-37-37 37 37ZM580-220h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19Z","functions":"M500-480 253-708q-6-6-9.5-13.5T240-737v-23q0-17 11.5-28.5T280-800h380q25 0 42.5 17.5T720-740q0 25-17.5 42.5T660-680H431l184 171q13 12 13 29t-13 29L431-280h229q25 0 42.5 17.5T720-220q0 25-17.5 42.5T660-160H269q-12 0-20.5-8.5T240-189v-38q0-6 2-11.5t7-10.5l251-231Z","delete":"M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM400-280q17 0 28.5-11.5T440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280Zm160 0q17 0 28.5-11.5T600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280ZM280-720v520-520Z","water_drop":"M480-80q-137 0-228.5-94T160-408q0-62 28-124t70-119q42-57 91-107t91-87q8-8 18.5-11.5T480-860q11 0 21.5 3.5T520-845q42 37 91 87t91 107q42 57 70 119t28 124q0 140-91.5 234T480-80Zm0-80q104 0 172-70.5T720-408q0-73-60.5-165T480-774Q361-665 300.5-573T240-408q0 107 68 177.5T480-160Zm0-320Zm11 280q12-1 20.5-9.5T520-230q0-14-9-22.5t-23-7.5q-41 3-87-22.5T343-375q-2-11-10.5-18t-19.5-7q-14 0-23 10.5t-6 24.5q17 91 80 130t127 35Z","table":"M120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80-400h560v-160H200v160Zm213 200h134v-120H413v120Zm0 200h134v-120H413v120ZM200-400h133v-120H200v120Zm427 0h133v-120H627v120ZM200-200h133v-120H200v120Zm427 0h133v-120H627v120Z","price_check":"m558-233 198-198q11-11 28-11t28 11q11 11 11 28t-11 28L586-149q-12 12-28 12t-28-12L416-263q-11-11-11-28t11-28q11-11 28-11t28 11l86 86ZM260-401h-60q-17 0-28.5-11.5T160-441q0-17 11.5-28.5T200-481h160v-80H200q-17 0-28.5-11.5T160-601v-160q0-17 11.5-28.5T200-801h60q0-17 11.5-28.5T300-841q17 0 28.5 11.5T340-801h60q17 0 28.5 11.5T440-761q0 17-11.5 28.5T400-721H240v80h160q17 0 28.5 11.5T440-601v160q0 17-11.5 28.5T400-401h-60q0 17-11.5 28.5T300-361q-17 0-28.5-11.5T260-401Z","inventory_2":"M200-80q-33 0-56.5-23.5T120-160v-451q-18-11-29-28.5T80-680v-120q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v120q0 23-11 40.5T840-611v451q0 33-23.5 56.5T760-80H200Zm0-520v440h560v-440H200Zm-40-80h640v-120H160v120Zm240 280h160q17 0 28.5-11.5T600-440q0-17-11.5-28.5T560-480H400q-17 0-28.5 11.5T360-440q0 17 11.5 28.5T400-400Zm80 20Z","download":"M480-337q-8 0-15-2.5t-13-8.5L308-492q-12-12-11.5-28t11.5-28q12-12 28.5-12.5T365-549l75 75v-286q0-17 11.5-28.5T480-800q17 0 28.5 11.5T520-760v286l75-75q12-12 28.5-11.5T652-548q11 12 11.5 28T652-492L508-348q-6 6-13 8.5t-15 2.5ZM240-160q-33 0-56.5-23.5T160-240v-80q0-17 11.5-28.5T200-360q17 0 28.5 11.5T240-320v80h480v-80q0-17 11.5-28.5T760-360q17 0 28.5 11.5T800-320v80q0 33-23.5 56.5T720-160H240Z","smart_toy":"M160-360q-50 0-85-35t-35-85q0-50 35-85t85-35v-80q0-33 23.5-56.5T240-760h120q0-50 35-85t85-35q50 0 85 35t35 85h120q33 0 56.5 23.5T800-680v80q50 0 85 35t35 85q0 50-35 85t-85 35v160q0 33-23.5 56.5T720-120H240q-33 0-56.5-23.5T160-200v-160Zm200-80q25 0 42.5-17.5T420-500q0-25-17.5-42.5T360-560q-25 0-42.5 17.5T300-500q0 25 17.5 42.5T360-440Zm240 0q25 0 42.5-17.5T660-500q0-25-17.5-42.5T600-560q-25 0-42.5 17.5T540-500q0 25 17.5 42.5T600-440ZM360-280h240q17 0 28.5-11.5T640-320q0-17-11.5-28.5T600-360H360q-17 0-28.5 11.5T320-320q0 17 11.5 28.5T360-280Zm-120 80h480v-480H240v480Zm240-240Z","dashboard":"M520-640v-160q0-17 11.5-28.5T560-840h240q17 0 28.5 11.5T840-800v160q0 17-11.5 28.5T800-600H560q-17 0-28.5-11.5T520-640ZM120-480v-320q0-17 11.5-28.5T160-840h240q17 0 28.5 11.5T440-800v320q0 17-11.5 28.5T400-440H160q-17 0-28.5-11.5T120-480Zm400 320v-320q0-17 11.5-28.5T560-520h240q17 0 28.5 11.5T840-480v320q0 17-11.5 28.5T800-120H560q-17 0-28.5-11.5T520-160Zm-400 0v-160q0-17 11.5-28.5T160-360h240q17 0 28.5 11.5T440-320v160q0 17-11.5 28.5T400-120H160q-17 0-28.5-11.5T120-160Zm80-360h160v-240H200v240Zm400 320h160v-240H600v240Zm0-480h160v-80H600v80ZM200-200h160v-80H200v80Zm160-320Zm240-160Zm0 240ZM360-280Z","warning":"M109-120q-11 0-20-5.5T75-140q-5-9-5.5-19.5T75-180l370-640q6-10 15.5-15t19.5-5q10 0 19.5 5t15.5 15l370 640q6 10 5.5 20.5T885-140q-5 9-14 14.5t-20 5.5H109Zm69-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm0-120q17 0 28.5-11.5T520-400v-120q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v120q0 17 11.5 28.5T480-360Zm0-100Z","more_vert":"M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z","timer":"M400-840q-17 0-28.5-11.5T360-880q0-17 11.5-28.5T400-920h160q17 0 28.5 11.5T600-880q0 17-11.5 28.5T560-840H400Zm80 440q17 0 28.5-11.5T520-440v-160q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600v160q0 17 11.5 28.5T480-400Zm0 320q-74 0-139.5-28.5T226-186q-49-49-77.5-114.5T120-440q0-74 28.5-139.5T226-694q49-49 114.5-77.5T480-800q62 0 119 20t107 58l28-28q11-11 28-11t28 11q11 11 11 28t-11 28l-28 28q38 50 58 107t20 119q0 74-28.5 139.5T734-186q-49 49-114.5 77.5T480-80Zm0-80q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-280Z","church":"M80-160v-188q0-24 13-43.5t35-29.5l112-50v-80q0-23 12-41.5t32-29.5l156-78v-60h-40q-17 0-28.5-11.5T360-800q0-17 11.5-28.5T400-840h40v-40q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v40h40q17 0 28.5 11.5T600-800q0 17-11.5 28.5T560-760h-40v60l156 78q20 11 32 29.5t12 41.5v80l112 50q22 10 35 29.5t13 43.5v188q0 33-23.5 56.5T800-80H560q-17 0-28.5-11.5T520-120v-120q0-17-11.5-28.5T480-280q-17 0-28.5 11.5T440-240v120q0 17-11.5 28.5T400-80H160q-33 0-56.5-23.5T80-160Zm80 0h200v-82q0-51 35-86.5t85-35.5q50 0 85 35.5t35 86.5v82h200v-192l-160-72v-134l-160-82-160 82v134l-160 72v192Zm320-260q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420Zm0 20Z","directions":"M400-480h140v52q0 14 12 19t22-5l78-78q12-12 12-28t-12-28l-78-78q-10-10-22-5t-12 19v52H360q-17 0-28.5 11.5T320-520v120q0 17 11.5 28.5T360-360q17 0 28.5-11.5T400-400v-80Zm80 400q-15 0-29.5-6T424-104L104-424q-12-12-18-26.5T80-480q0-15 6-29.5t18-26.5l320-320q12-12 26.5-18t29.5-6q15 0 29.5 6t26.5 18l320 320q12 12 18 26.5t6 29.5q0 15-6 29.5T856-424L536-104q-12 12-26.5 18T480-80ZM320-320l160 160 320-320-320-320-320 320 160 160Zm160-160Z","mic":"M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm0-240Zm-40 480v-83q-92-13-157.5-78T203-479q-2-17 9-29t28-12q17 0 28.5 11.5T284-480q14 70 69.5 115T480-320q72 0 127-45.5T676-480q4-17 15.5-28.5T720-520q17 0 28 12t9 29q-14 91-79 157t-158 79v83q0 17-11.5 28.5T480-120q-17 0-28.5-11.5T440-160Zm40-320q17 0 28.5-11.5T520-520v-240q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760v240q0 17 11.5 28.5T480-480Z","print":"M320-120q-33 0-56.5-23.5T240-200v-80h-80q-33 0-56.5-23.5T80-360v-160q0-51 35-85.5t85-34.5h560q51 0 85.5 34.5T880-520v160q0 33-23.5 56.5T800-280h-80v80q0 33-23.5 56.5T640-120H320ZM160-360h80q0-33 23.5-56.5T320-440h320q33 0 56.5 23.5T720-360h80v-160q0-17-11.5-28.5T760-560H200q-17 0-28.5 11.5T160-520v160Zm480-280v-120H320v120h-80v-120q0-33 23.5-56.5T320-840h320q33 0 56.5 23.5T720-760v120h-80Zm80 180q17 0 28.5-11.5T760-500q0-17-11.5-28.5T720-540q-17 0-28.5 11.5T680-500q0 17 11.5 28.5T720-460Zm-80 260v-160H320v160h320ZM160-560h640-640Z","show_chart":"M110-250q-13-13-13-30t13-30l213-213q23-23 57-23t57 23l103 103 256-289q11-13 28.5-13t29.5 12q11 11 11.5 26.5T855-656L596-364q-23 26-57 27.5T480-360L380-460 170-250q-13 13-30 13t-30-13Z","power_settings_new":"M440-480v-320q0-17 11.5-28.5T480-840q17 0 28.5 11.5T520-800v320q0 17-11.5 28.5T480-440q-17 0-28.5-11.5T440-480Zm40 360q-74 0-139.5-28.5T226-226q-49-49-77.5-114.5T120-480q0-69 25.5-132.5T217-726q11-12 28-12t29 12q11 11 10 27.5T272-669q-34 38-53 86.5T200-480q0 116 82 198t198 82q117 0 198.5-82T760-480q0-54-19-103.5T687-671q-11-12-11.5-28t10.5-27q12-12 29-12t28 12q47 50 72 113.5T840-480q0 74-28.5 139.5t-77 114.5q-48.5 49-114 77.5T480-120Z","groups":"M40-240q-17 0-28.5-11.5T0-280v-23q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H40Zm240 0q-17 0-28.5-11.5T240-280v-25q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v25q0 17-11.5 28.5T680-240H280Zm500 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v23q0 17-11.5 28.5T920-240H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z","save":"M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h447q16 0 30.5 6t25.5 17l114 114q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T760-120H200Zm560-526L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM280-560h280q17 0 28.5-11.5T600-600v-80q0-17-11.5-28.5T560-720H280q-17 0-28.5 11.5T240-680v80q0 17 11.5 28.5T280-560Zm-80-86v446-560 114Z","check":"m382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z","factory":"M160-80q-33 0-56.5-23.5T80-160v-348q0-24 13-44t36-30l175-74q20-8 38 3t18 33v20l145-58q20-8 37.5 4t17.5 33v61h320v400q0 33-23.5 56.5T800-80H160Zm0-80h640v-320H480v-82l-200 80v-78l-120 53v347Zm280-80h80v-160h-80v160Zm-160 0h80v-160h-80v160Zm320 0h80v-160h-80v160Zm280-320H680l36-285q2-15 13-25t26-10h50q15 0 26 10t13 25l36 285ZM160-160h640-640Z","savings":"M237-120q-23 0-44.5-16T164-175q-25-84-41-145.5t-25.5-108Q88-475 84-511t-4-69q0-92 64-156t156-64h200q27-36 68.5-58t91.5-22q25 0 42.5 17.5T720-820q0 6-1.5 12t-3.5 11q-4 11-7.5 22t-5.5 24l91 91h47q17 0 28.5 11.5T880-620v210q0 13-7.5 23T852-372l-85 28-50 167q-8 26-29 41.5T640-120h-80q-33 0-56.5-23.5T480-200h-80q0 33-23.5 56.5T320-120h-83Zm3-80h80v-80h240v80h80l62-206 98-33v-141h-40L620-720q0-20 2.5-39t7.5-37q-29 8-51 27.5T547-720H300q-58 0-99 41t-41 99q0 41 21 140.5T240-200Zm400-320q17 0 28.5-11.5T680-560q0-17-11.5-28.5T640-600q-17 0-28.5 11.5T600-560q0 17 11.5 28.5T640-520Zm-160-80q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680H360q-17 0-28.5 11.5T320-640q0 17 11.5 28.5T360-600h120Zm0 102Z","manage_accounts":"M400-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM80-240v-32q0-33 17-62t47-44q58-29 120-45.5T391-440q17 0 28.5 12t11.5 29q0 17-11.5 28.5T391-359q-56 0-108.5 14T180-306q-10 5-15 14t-5 20v32h231q17 0 28.5 11.5T431-200q0 17-11.5 28.5T391-160H160q-33 0-56.5-23.5T80-240Zm554 88-6-28q-12-5-22.5-10.5T584-204l-29 9q-13 4-25.5-1T510-212l-8-14q-7-12-5-26t13-23l22-19q-2-14-2-26t2-26l-22-19q-11-9-13-22.5t5-25.5l9-15q7-11 19-16t25-1l29 9q11-8 21.5-13.5T628-460l6-29q3-14 13.5-22.5T672-520h16q14 0 24.5 9t13.5 23l6 28q12 5 22.5 11t21.5 15l27-9q14-5 27 0t20 17l8 14q7 12 5 26t-13 23l-22 19q2 12 2 25t-2 25l22 19q11 9 13 22.5t-5 25.5l-9 15q-7 11-19 16t-25 1l-29-9q-11 8-21.5 13.5T732-180l-6 29q-3 14-13.5 22.5T688-120h-16q-14 0-24.5-9T634-152Zm46-88q33 0 56.5-23.5T760-320q0-33-23.5-56.5T680-400q-33 0-56.5 23.5T600-320q0 33 23.5 56.5T680-240ZM400-560q33 0 56.5-23.5T480-640q0-33-23.5-56.5T400-720q-33 0-56.5 23.5T320-640q0 33 23.5 56.5T400-560Zm0-80Zm12 400Z","request_quote":"M440-240v20q0 8 6 14t14 6h40q8 0 14-6t6-14v-20h40q17 0 28.5-11.5T600-280v-120q0-17-11.5-28.5T560-440H440v-40h120q17 0 28.5-11.5T600-520q0-17-11.5-28.5T560-560h-40v-20q0-8-6-14t-14-6h-40q-8 0-14 6t-6 14v20h-40q-17 0-28.5 11.5T360-520v120q0 17 11.5 28.5T400-360h120v40H400q-17 0-28.5 11.5T360-280q0 17 11.5 28.5T400-240h40ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h360l200 200v520q0 33-23.5 56.5T720-80H240Zm0-80h480v-480H600q-17 0-28.5-11.5T560-680v-120H240v640Zm0-640v160-160 640-640Z","account_balance":"M200-320v-200q0-17 11.5-28.5T240-560q17 0 28.5 11.5T280-520v200q0 17-11.5 28.5T240-280q-17 0-28.5-11.5T200-320Zm240 0v-200q0-17 11.5-28.5T480-560q17 0 28.5 11.5T520-520v200q0 17-11.5 28.5T480-280q-17 0-28.5-11.5T440-320ZM120-120q-17 0-28.5-11.5T80-160q0-17 11.5-28.5T120-200h720q17 0 28.5 11.5T880-160q0 17-11.5 28.5T840-120H120Zm560-200v-200q0-17 11.5-28.5T720-560q17 0 28.5 11.5T760-520v200q0 17-11.5 28.5T720-280q-17 0-28.5-11.5T680-320Zm160-320H116q-15 0-25.5-10.5T80-676v-22q0-11 5.5-19t14.5-13l344-172q17-8 36-8t36 8l342 171q11 5 16.5 15t5.5 21v15q0 17-11.5 28.5T840-640Zm-582-80h444-444Zm0 0h444L480-830 258-720Z","celebration":"m212-212 282-100-182-182-100 282Zm709-467q-9 9-21 9t-21-9l-3-3q-14-14-35-14t-35 14L603-479q-9 9-21 9t-21-9q-9-9-9-21t9-21l203-203q32-32 77-32t77 32l3 3q9 9 9 21t-9 21ZM399-799q9-9 21-9t21 9l5 5q32 32 32 76t-32 76l-3 3q-9 9-21 9t-21-9q-9-9-9-21t9-21l3-3q14-14 14-34t-14-34l-5-5q-9-9-9-21t9-21Zm162-80q9-9 21-9t21 9l43 43q32 32 32 77t-32 77L523-559q-9 9-21 9t-21-9q-9-9-9-21t9-21l123-123q14-14 14-35t-14-35l-43-43q-9-9-9-21t9-21Zm320 480q-9 9-21 9t-21-9l-43-43q-14-14-35-14t-35 14l-43 43q-9 9-21 9t-21-9q-9-9-9-21t9-21l43-43q32-32 77-32t77 32l43 43q9 9 9 21t-9 21ZM212-212Zm-104 52 151-420q5-13 15.5-20t22.5-7q8 0 15 3t13 9l270 270q6 6 9 13t3 15q0 12-7 22.5T580-259L160-108q-12 5-23 1.5T118-118q-8-8-11.5-19t1.5-23Z","elderly":"M540-740q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Zm160 350q-8 0-14-6t-6-14v-19q-54-23-84-51.5T543-557q-11 28-17.5 68.5T521-412l72 102q4 5 5.5 11t1.5 12v207q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-160l-71-102-8 130q0 4-8 22L344-72q-10 14-26 16t-30-8q-14-10-16-26t8-30l80-107v-213q0-31 5-67.5t15-67.5l-60 33v102q0 17-11.5 28.5T280-400q-17 0-28.5-11.5T240-440v-125q0-11 5-20.5t15-14.5l156-88q25-14 43.5-21.5T494-717q25 0 45.5 21.5T587-628q32 54 58 81t56 41q11-8 19-11t19-3q25 0 43 18t18 42v400q0 8-6 14t-14 6q-8 0-14-6t-6-14v-400q0-8-6-14t-14-6q-8 0-14 6t-6 14v50q0 8-6 14t-14 6Z","chevron_right":"M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z","pets":"M180-475q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm180-160q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm240 0q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm180 160q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM266-75q-45 0-75.5-34.5T160-191q0-52 35.5-91t70.5-77q29-31 50-67.5t50-68.5q22-26 51-43t63-17q34 0 63 16t51 42q28 32 49.5 69t50.5 69q35 38 70.5 77t35.5 91q0 47-30.5 81.5T694-75q-54 0-107-9t-107-9q-54 0-107 9t-107 9Z","insights":"M3 20q-.825 0-1.412-.587Q1 18.825 1 18q0-.825.588-1.413Q2.175 16 3 16h.263q.112 0 .237.05l4.55-4.55Q8 11.375 8 11.262V11q0-.825.588-1.413Q9.175 9 10 9t1.413.587Q12 10.175 12 11q0 .05-.05.5l2.55 2.55q.125-.05.238-.05h.524q.113 0 .238.05l3.55-3.55q-.05-.125-.05-.238V10q0-.825.587-1.413Q20.175 8 21 8q.825 0 1.413.587Q23 9.175 23 10q0 .825-.587 1.412Q21.825 12 21 12h-.262q-.113 0-.238-.05l-3.55 3.55q.05.125.05.238V16q0 .825-.587 1.413Q15.825 18 15 18q-.825 0-1.412-.587Q13 16.825 13 16v-.262q0-.113.05-.238l-2.55-2.55q-.125.05-.238.05H10q-.05 0-.5-.05L4.95 17.5q.05.125.05.238V18q0 .825-.588 1.413Q3.825 20 3 20ZM4 9.975l-.625-1.35L2.025 8l1.35-.625L4 6.025l.625 1.35L5.975 8l-1.35.625ZM15 9l-.95-2.05L12 6l2.05-.95L15 3l.95 2.05L18 6l-2.05.95Z","send":"M792-443 176-183q-20 8-38-3.5T120-220v-520q0-22 18-33.5t38-3.5l616 260q25 11 25 37t-25 37ZM200-280l474-200-474-200v140l240 60-240 60v140Zm0 0v-400 400Z","star":"m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143Zm126 18L314-169q-11 7-23 6t-21-8q-9-7-14-17.5t-2-23.5l44-189-147-127q-10-9-12.5-20.5T140-571q4-11 12-18t22-9l194-17 75-178q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l75 178 194 17q14 2 22 9t12 18q4 11 1.5 22.5T809-528L662-401l44 189q3 13-2 23.5T690-171q-9 7-21 8t-23-6L480-269Zm0-201Z","info":"M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z","content_paste":"M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h167q11-35 43-57.5t70-22.5q40 0 71.5 22.5T594-840h166q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560h-80v80q0 17-11.5 28.5T640-640H320q-17 0-28.5-11.5T280-680v-80h-80v560Zm280-560q17 0 28.5-11.5T520-800q0-17-11.5-28.5T480-840q-17 0-28.5 11.5T440-800q0 17 11.5 28.5T480-760Z","leaderboard":"M160-200h160v-320H160v320Zm240 0h160v-560H400v560Zm240 0h160v-240H640v240Zm-560 0v-320q0-33 23.5-56.5T160-600h160v-160q0-33 23.5-56.5T400-840h160q33 0 56.5 23.5T640-760v240h160q33 0 56.5 23.5T880-440v240q0 33-23.5 56.5T800-120H160q-33 0-56.5-23.5T80-200Z","language":"M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-155.5t86-127Q252-817 325-848.5T480-880q83 0 155.5 31.5t127 86q54.5 54.5 86 127T880-480q0 82-31.5 155t-86 127.5q-54.5 54.5-127 86T480-80Zm0-82q26-36 45-75t31-83H404q12 44 31 83t45 75Zm-104-16q-18-33-31.5-68.5T322-320H204q29 50 72.5 87t99.5 55Zm208 0q56-18 99.5-55t72.5-87H638q-9 38-22.5 73.5T584-178ZM170-400h136q-3-20-4.5-39.5T300-480q0-21 1.5-40.5T306-560H170q-5 20-7.5 39.5T160-480q0 21 2.5 40.5T170-400Zm216 0h188q3-20 4.5-39.5T580-480q0-21-1.5-40.5T574-560H386q-3 20-4.5 39.5T380-480q0 21 1.5 40.5T386-400Zm268 0h136q5-20 7.5-39.5T800-480q0-21-2.5-40.5T790-560H654q3 20 4.5 39.5T660-480q0 21-1.5 40.5T654-400Zm-16-240h118q-29-50-72.5-87T584-782q18 33 31.5 68.5T638-640Zm-234 0h152q-12-44-31-83t-45-75q-26 36-45 75t-31 83Zm-200 0h118q9-38 22.5-73.5T376-782q-56 18-99.5 55T204-640Z","task_alt":"M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q48 0 93.5 11t87.5 32q15 8 19.5 24t-5.5 30q-10 14-26.5 18t-32.5-4q-32-15-66.5-23t-69.5-8q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-8-.5-15.5T798-511q-2-17 6.5-32.5T830-564q16-5 30 3t16 24q2 14 3 28t1 29q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-56-328 372-373q11-11 27.5-11.5T852-781q11 11 11 28t-11 28L452-324q-12 12-28 12t-28-12L282-438q-11-11-11-28t11-28q11-11 28-11t28 11l86 86Z","security":"M480-164q97-30 162-118.5T718-480H480v-315l-240 90v207q0 7 2 18h238v316Zm0 80q-7 0-13-1t-12-3q-135-45-215-166.5T160-516v-189q0-25 14.5-45t37.5-29l240-90q14-5 28-5t28 5l240 90q23 9 37.5 29t14.5 45v189q0 140-80 261.5T505-88q-6 2-12 3t-13 1Z","analytics":"M320-480q-17 0-28.5 11.5T280-440v120q0 17 11.5 28.5T320-280q17 0 28.5-11.5T360-320v-120q0-17-11.5-28.5T320-480Zm320-200q-17 0-28.5 11.5T600-640v320q0 17 11.5 28.5T640-280q17 0 28.5-11.5T680-320v-320q0-17-11.5-28.5T640-680ZM480-400q-17 0-28.5 11.5T440-360v40q0 17 11.5 28.5T480-280q17 0 28.5-11.5T520-320v-40q0-17-11.5-28.5T480-400ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Zm280 280q17 0 28.5-11.5T520-520q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520q0 17 11.5 28.5T480-480Z","thumb_up":"M840-640q32 0 56 24t24 56v80q0 7-2 15t-4 15L794-168q-9 20-30 34t-44 14H280v-520l240-238q15-15 35.5-17.5T595-888q19 10 28 28t4 37l-45 183h258Zm-480 34v406h360l120-280v-80H480l54-220-174 174ZM160-120q-33 0-56.5-23.5T80-200v-360q0-33 23.5-56.5T160-640h120v80H160v360h120v80H160Zm200-80v-406 406Z","dataset":"M320-280h80q17 0 28.5-11.5T440-320v-80q0-17-11.5-28.5T400-440h-80q-17 0-28.5 11.5T280-400v80q0 17 11.5 28.5T320-280Zm240 0h80q17 0 28.5-11.5T680-320v-80q0-17-11.5-28.5T640-440h-80q-17 0-28.5 11.5T520-400v80q0 17 11.5 28.5T560-280ZM320-520h80q17 0 28.5-11.5T440-560v-80q0-17-11.5-28.5T400-680h-80q-17 0-28.5 11.5T280-640v80q0 17 11.5 28.5T320-520Zm240 0h80q17 0 28.5-11.5T680-560v-80q0-17-11.5-28.5T640-680h-80q-17 0-28.5 11.5T520-640v80q0 17 11.5 28.5T560-520ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z","sports_soccer":"M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm200-500 54-18 16-54q-32-48-77-82.5T574-786l-54 38v56l160 112Zm-400 0 160-112v-56l-54-38q-54 17-99 51.5T210-652l16 54 54 18Zm-42 308 46-4 30-54-58-174-56-20-40 30q0 65 18 118.5T238-272Zm242 112q26 0 51-4t49-12l28-60-26-44H378l-26 44 28 60q24 8 49 12t51 4Zm-90-200h180l56-160-146-102-144 102 54 160Zm332 88q42-50 60-103.5T800-494l-40-28-56 18-58 174 30 54 46 4Z","bolt":"m422-232 207-248H469l29-227-185 267h139l-30 208Zm-62-128H236q-24 0-35.5-21.5T203-423l299-430q10-14 26-19.5t33 .5q17 6 25 21t6 32l-32 259h155q26 0 36.5 23t-6.5 43L416-100q-11 13-27 17t-31-3q-15-7-23.5-21.5T328-139l32-221Zm111-110Z","donut_large":"M200-480q0 93 52.5 166.5T391-213q18 6 29.5 22.5T432-154q0 29-24.5 46t-53.5 7q-124-41-199-145T80-480q0-130 75-234t199-145q29-10 53.5 7t24.5 46q0 20-11.5 36.5T391-747q-86 27-138.5 100.5T200-480Zm562 282q-32 33-72.5 57.5T605-101q-29 10-53.5-7T527-154q0-20 11.5-36.5T568-213q31-10 59.5-27.5T679-281q23-24 40-51.5t28-59.5q6-18 22.5-29.5T806-433q29 0 46 24.5t7 53.5q-15 44-39.5 84T762-198Zm0-564q33 33 57.5 73t39.5 84q10 29-7 53.5T806-527q-20 0-36.5-11.5T747-568q-11-32-28-59.5T679-679q-23-23-51.5-40.5T568-747q-18-6-29.5-22.5T527-806q0-29 24.5-46t53.5-7q44 15 84.5 39.5T762-762Z","account_circle":"M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-164q-59 0-99.5-40.5T340-580q0-59 40.5-99.5T480-720q59 0 99.5 40.5T620-580q0 59-40.5 99.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q53 0 100-15.5t86-44.5q-39-29-86-44.5T480-280q-53 0-100 15.5T294-220q39 29 86 44.5T480-160Zm0-360q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm0-60Zm0 360Z","skip_next":"M660-280v-400q0-17 11.5-28.5T700-720q17 0 28.5 11.5T740-680v400q0 17-11.5 28.5T700-240q-17 0-28.5-11.5T660-280Zm-440-35v-330q0-18 12-29t28-11q5 0 11 1t11 5l248 166q9 6 13.5 14.5T548-480q0 10-4.5 18.5T530-447L282-281q-5 4-11 5t-11 1q-16 0-28-11t-12-29Zm80-165Zm0 90 136-90-136-90v180Z","remove":"M240-440q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h480q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H240Z","zoom_out":"M320-540q-17 0-28.5-11.5T280-580q0-17 11.5-28.5T320-620h120q17 0 28.5 11.5T480-580q0 17-11.5 28.5T440-540H320Zm60 220q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z","filter_alt":"M440-160q-17 0-28.5-11.5T400-200v-240L168-736q-15-20-4.5-42t36.5-22h560q26 0 36.5 22t-4.5 42L560-440v240q0 17-11.5 28.5T520-160h-80Zm40-308 198-252H282l198 252Zm0 0Z"};
  const MI_ALIAS = {"people":"group","phone":"call","place":"location_on","local_grocery_store":"shopping_cart","business":"apartment","laptop":"computer"};
  /*__EMOJI_DATA_END__*/
  let EMO = null;
  function emojiMap() {
    if (EMO) return EMO;
    EMO = new Map();
    for (const src of [EMOJI_ID, EMOJI_ALIAS, EMOJI_EN]) {   // urutan: yang belakangan menang (nama Streamlit paling kuat)
      for (const pair of src.split(',')) { const i = pair.indexOf('='); if (i > 0) EMO.set(pair.slice(0, i), pair.slice(i + 1)); }
    }
    return EMO;
  }
  /** Karakter emoji dari namanya (tanpa titik dua), atau null. */
  function emojiOf(name) { return emojiMap().get(String(name).replace(/^:|:$/g, '').toLowerCase()) || null; }
  const EMO_RE = /(\\?):([a-z0-9_+\-]{1,60}):/gi;
  /** Ganti semua ":nama:" yang dikenal di dalam teks biasa. "\\:nama:" ditulis apa adanya. */
  function emo(s) {
    if (s == null) return s;
    s = String(s);
    if (s.indexOf(':') < 0) return s;
    return s.replace(EMO_RE, (m, bs, n) => {
      if (bs) return m.slice(1);
      if (/^material\//i.test(n)) return m;
      const c = emojiOf(n);
      return c || m;
    });
  }
  function emojiSearch(q, o) {
    o = o || {};
    const words = String(q || '').toLowerCase().split(/[\s_]+/).filter(Boolean);
    const out = [], best = new Map();
    const score = n => {   // 0 = sama persis, 1 = kata utuh, 2 = awal kata, 3 = di tengah kata
      let t = 0;
      for (const w of words) {
        if (n === w) continue;
        const parts = n.split('_');
        if (parts.includes(w)) t = Math.max(t, 1);
        else if (parts.some(p => p.startsWith(w))) t = Math.max(t, 2);
        else if (n.includes(w)) t = Math.max(t, 3);
        else return -1;
      }
      return t;
    };
    for (const [n, c] of emojiMap()) {
      const sc = score(n);
      if (sc < 0) continue;
      const prev = best.get(c);
      if (!prev || sc < prev.sc || (sc === prev.sc && n.length < prev.nama.length)) best.set(c, { emoji: c, nama: n, kode: ':' + n + ':', sc });
    }
    for (const v of best.values()) out.push(v);
    out.sort((a, b) => a.sc - b.sc || a.nama.length - b.nama.length);
    out.forEach(x => delete x.sc);
    return out.slice(0, o.limit || 30);
  }
  /** sl.emoji("smile") → "😄"; sl.emoji.search("uang"); sl.emoji.names() */
  const emojiAPI = Object.assign(name => emojiOf(name), {
    search: emojiSearch,
    replace: s => emo(s),
    names: () => [...emojiMap().keys()],
    icons: () => Object.keys(MI_PATHS).concat(Object.keys(MI_ALIAS)).sort()
  });
  /** SVG ikon Material yang tersedia luring, atau null. */
  const MI_SMALL = new Set(['file_download', 'note', 'auto_awesome', 'insights']);
  function materialSVG(name, cls) {
    const n = MI_PATHS[name] ? name : MI_ALIAS[name];
    if (!n || !MI_PATHS[n]) return null;
    // sebagian kecil ikon memakai kisi 24 satuan (bukan 960): pilih viewBox yang sesuai
    const vb = MI_SMALL.has(n) ? '0 0 24 24' : '0 -960 960 960';
    return `<svg class="${cls || 'slak-mis slak-ic'}" viewBox="${vb}" width="1.15em" height="1.15em" fill="currentColor" aria-hidden="true"><path d="${MI_PATHS[n]}"/></svg>`;
  }
  /** Ikon: emoji apa adanya atau ":nama:", ":material/nama:" (luring untuk ~250 ikon umum, sisanya dari font
   *  Material Symbols saat online), "spinner" berputar. */
  function iconHTML(ic) {
    if (ic == null || ic === '') return '';
    const s = String(ic);
    if (s === 'spinner') return '<span class="slak-spin slak-ic"></span>';
    const m = s.match(/^:material\/([a-z0-9_]+):$/);
    if (m) {
      const svg = materialSVG(m[1]);
      if (svg) return svg;
      useIconFont(); return `<span class="slak-mi slak-ic" aria-hidden="true">${m[1]}</span>`;
    }
    return `<span class="slak-ic">${esc(emo(s))}</span>`;
  }

  /* ======================================================================
   * sl.crypto — hash, password, enkripsi, pelindung jawaban kuis (Slak 1.3.1)
   * Semua hash ditulis murni dalam JavaScript sehingga tetap jalan saat
   * halaman dibuka dengan klik dua kali. Enkripsi AES memakai Web Crypto.
   * ==================================================================== */

  const BF_INIT = 'JD9qiIWjCNMTGYouA3BzRKQJOCIpnzHQCC76mOxObIlFKCHmONATd75UZs806QxswKwpt8l8UN0/hNW1tUcJF5IW1dmJefsb0TELppjftawv/XLb0Brft7jhr+1qJn6WunyQRfEsf5kkoZlHs5Fs9wgB8uKFjvwWY2kg2HFXTmmkWP6j9JM9fg2VdI9yjrZYcYvNWIIVSu57VKQdwlpZtZww1Tkq8mATxdGwIyhghfDKQXkYuNs474553LBgOhgObJ4Oi7Aeij7XFXfBvTFLJ3ivL9pVYFxg5lUl86pVq5RXSJhiY+gUQFXKOWoqqxC2tMxcNBFB6M6hVIavfHLpk7PuFBFjb7wqK6nFXXQYMfbOXD4Wm4eTHq/WujNsJM9cejJTgSiVhnc7j0iYa0u5r8S/6BtmKCGTYdgJzPshqZFIfKxgXeyAMu+EXV3phXWx3CYjAutlG4gjiT6B05asxQ9tb/OD9EI5LgtEgqSEIARpyPBKnh+bXiHGaEL26WyaZwycYavTiPBqUaDS2FQvaJYPpyirUTOjbu8LbBN6O+S6O/BQfvsqmKHxZR05rwF2ZspZPoJDDoiM7oYZRW+ftH2EpcM7i16+4G912IXBIHNAGkSfVsFqpk7TqmI2P3cGG/7fckKbAj030Nck0AoSSNsP6tNJ8cCbB1NyyYCZG3sl1HnY9uje9+P+UBq2eUw7l2zgvQTABrrBqU+2QJ9gxF5cnsIZaiRjaPtvrz5sU7UTObLrO1Lsb238UR+bMJUszIFFRK9evQm+49AE3jNK/WYPKAcZLkuzwMuoV0XIdA/SC185udP721V5wL0aYDIK1qEAxkAscnlnnyX++x+jzI6l6fjbMiL4PHUW3/1haxUvUB7IrQVSqzI9tfr9I4dgUzF7SD4A34KeXFe7ym+MoBqHVi7fF2nb1UKo9ih+/8OsZzLGjE9Vc2lbJ7C7yljI4f+jXbjwEaAQ+j2Y/SGDuEr8tWwt0dNbmlPkebb4RWXSjkm8S/uXkOHd8tqky34zYvsTQc7kxujvIMraNndMAdB+nv4r8R+0ldvaTa6QkZjqrY5xa5PVoNCO0dCvxyXgjjxbL451lLeP9uL78hIrZIiIuBKQDfAcT61eoGiPwxzRz/GRs6jBrS8vIhi+Dhd36nUt/osCH6HloMwPtW906Bis89bOieKZtKhP4P0T4Ld8xDuB0q2o2RZfomaAlXcFk8xzFCEaFHfmrSBld7X6hsdUQvX7nTXP682vDHs+iaDWQRvTrh5+SQAlDi0gcbNeImgAu1e44K8kZDab8Am5HlVjkR1Z36aqeMFDidlaU38gfVuiAuW5xYMmA3Zilc+pEcgZaE5zSkGzRy3KexSpShtRAFKaUykV1g9XP7ybxuQrYKR2geZ0AAi6b7VXG+kf8pbsayoN2RW2Y2Uh57n5tv80BS7FhVZkU7AtXamfj6EIukeZboUHakt6cOm1sylE23UJLsQZJiOtbqawSafffZzuYLiP7bJm7KqMcWmaF/9WZFJswrGe4Rk2AqV1CUwpoFkTQOQYOj4/VJiaW0KdZWuP5NaZ9z/WodKcB+/oMPVNLTjm8CVdwUzdIIaEcOsmY4LpxgIezF4JaGs/PrrvyTyXGBRranChaH81hFKg4oa3nFMFqlAHNz4HhBx/3q5cjn1E7FcW8riwOto38FAMDfAcHwQCALP/rgz1Gjy1dLIlg3pY3AkhvdGRE/l8qS/2lDJHcyL1RwE65eWBN8La3Mi1djSa892nqURhRg/QAw7syMc+pHUeQeI4zZk76g4vMoC7oRg+szFOVIs4T225CG9CDQP2CgS/LLgSkCSXfHlWebByvK+Jr96adx/ZkwgQs4uuEtzPPy5VEnIfLmtxJFAa3eafhM2HelhHGHQI2he8n5q86Ut9jOx67DrbhR36YwlDZsRkw9LvHBhHMhXZCN1DOzckwroWEqFNQyplxFFQlAACEzrk3XHf+J4QMU5Vgax31l8RGZsENVbx16PHazwRGDtZJKUJ8o/m7Zfx+/qeur8sHhU8bobjRXDq6W+xhg5eClo+KrN3H+ccTj0G+ill3LmZ5x0PgD6J1lJmyCUuTMl4nBCzasYVDrqU4up4pfw8Ux4KLfTy906nNh0rPRk5Jg8ZwnlgUiOnCPcTErbrrf5u6sMfZuO8RZWme8iDsX830QGM/yjDMt3vvmxapWVYIYVoq5gC7s6lD9svlTsq732tW24vhBUhtigpB2Fw7N1HdWGfFRATzKgw62G9lgM0/h6qA2PPtXNckExwojnVnp4Ly6reFO7MhrxgYiynnKtcq7LzhG5kix6vGb3wyqAjabllWrtQQGhaMjwqtLMxnunVwCG495tUCxmHX6CZlfeZfmI9faj4N4ial+MtdxHtk18WaBKBDjWIKcfmH9aW3t+heFi6mVf1hKUbInJjm4PD/xrCRpbNswrrUy4wVI/ZSORtvDEoWOvy7zTG/+r+KO1h7nw8c11KFNnoZLfjQhBdFCA+E+BF7uK2o6qr6ttsTxX6y0/Qx0L0Qu9qu7VlTzsdQc0hBdgeeZ6GhU3H5EtHaj2BYlDPYqHyW40mRvyIg6DBx7ajfxUkw2nLdJJHhIoLVpKyhQlbvwCtGUidFGKxdCOCDgBYQo0qDFX16h2t9D4jP3BhM3Lwko2TfkHWX+zxbCI723zeN1nL7nRgQIXyp853Mm6mB4CEGfhQnujv2FVh2Zc1qWmnqsUMBsJaBKv8gAvK3J5Eei7DRTSE/dVnBQ4ensnbc9vTEFWIzWdf2nnjZ0NAxcQ0ZXE+ONg9KPie8W3/IBU+IeePsD1K5uOfK9uDrffpPVpolIFA9/ZMJhyUaSk0QRUg93YC1Pe89Gsu1KIAaNQIJHEzIPRqQ7fUt1AAYa8eOfYulyRFRhQhT3S/i4hATZX8HZa1ka9w9N3TZqAvRb+8CewDvZeFf6xt0DHLhQSW6yezVf05QdolR+arygqaKFB4JVMEKfQKLIba6bZt+2jcFGLXSGkAaA7ApCehje5PP/6i6IetjLWM4AZ69Na2qs4efNM3X+zOeKOZQGsqQiD+njXZ84W57jnXqzsSTosdyfr3S20YViajZjHq45eyOm76dN1bQzJoQef3yngg+/sK9U7Y/rOXRUBWrLpIlSdVUzo6IIONh/5rqbfQlpVLVahnvKEVmljMqSljmeHbM6YqSlY/MSX5XvR+HJApMXz9+OgCBCcvcIC7FVwFKCzjlcEVSOTGbSJIwRM/xw+G3Af5ye5BBB8PQEd5pF2IbhcyX1Hr1ZvA0fK8wY9BETVkJXt4NGAqnGDf+OijH2NsGw4StMIC4TKer2ZP0crRgRVrI5XgMz6S4TskC2LuvrkihbKiDua6DZnecgyMLaL3KNASeEWVt5T9ZH0IYufM9fBUSaNvh31I+sOd/SfzPo0eCkdjQZku/3Q6b26r9Pj9N6gS3GCh6934mRvhTNtuaw3Ge1UQbWcsNydl1Dvc0OgE8SkNx8wA/6O1OQ+SaQ/tC2Z7n/vO232coJHPC9kVXqO7Ey+IUVutJHuUeb92O9brNzkus8wRWXmAJuKX9C4xLWhCrafGais7EnVMzHgu8RxqEkI3t5JR5wahu+ZL+2NQGmsQGBHK7fo9Jb3Y4uHDyURCFlkKEhOG2QzsbtWr6ipkr2dO2oaoX76/6Yhk5MP+nbyAV/D3wIZgeHv4YANgTdH9g0b2OB+wd0WuBNc2/MyDQmsz8B6rcbCAQYc8AF5fd6BXvr3oriRVRkKZv1guYU5Y9I/y3f2i9HTvOIeJvcJTZvnDyLOOdLR18lVG/Nm5eusmYYsd34SEag55kV+V4kZuWY4gtFdwjNVVkckC3ky5C6zhu4IF0BGoYkh1dKmet38ZtuCp3AlmLQmhxDJGM+haHwIJ8L6MSpmgJR1u/hAauT0dC6Wk36GG8g8oaPFp3Lfag1c5Bv6h4s6bT81/UlARXgGnBoP6oAK1xA3m0Cea+Iwndz+GQcNgTAZhqAa18Bd6KMD1huAAYFiqMNx9YhHmntcjOOpjU8LdlMLCFjS7y+5WkLy23uv8faHOWR12bwXkCUt8AYg5cgo9fJJ8JIbjcl9yTZ25GsFbtNOeuPztVFV4CPyltdg9fNNNrQ/EHlDvXrFh5viihRTZbFETPG/Vx+dW4U7ENiq/zt3GyDfXmjI0kmOCEmcO+o5AYADgOjnON9P69c+rwnc3WsUtG1ywZ55PozdC04InQJm8m77VEY6dvw9zFdYtHH7HAMR7t4wbayGhkEWybrG+ajZutFdIqy+8lG55xqN20mVJwshTD/juRo3efdVzCh1M0E3GKTm726m6RlCslSbovl7jBKH61fBqLVGaY++M4pqG7iLAicK4QyQu9qUeA6qc8tCkg8Bhupvpak2P5RVQumRb1igmovmnOjrhS6mVhu9VYunHL+/T91L32j8Eb2l3+gpZgOSpFYewhgGbCeatOz7lk+mQ/VqeNNeXLPC32QIri1GW1aw6AX2mfdHPPtZ8fS0oH58lz63yuJta1rRyWoj1TOAprHHgGaXmR7Cs/e2T+pvo08SNKDtXzPjVZil5Ey4oeF8Bke11YFX3lg5E49NejBUFbdSI9G26A6FhJQVk8L3D654VPJBXopcnGuypOgcqGz9tmx5jIfX1nGb7JtzzGXUz2SixVf31A1Y0goq6PLsoUXcRwgrZ+KvMUWfMrZJfTegXUTgw3I43nVhikyD5kep6kML7PnvOUSHOZHdPvjKotuN+wyk9RkjeU2lkE+aAoq4IEN1tsiRphS39CQchZrOaRgpkRcDdWGzezxwgyK5bvvfdG1iNQMzSAX9rtOO73aJqfjpZ/0U+NQpEvLTN1XLqzqj6ZIS7jWYSrr88b0fSm+RjVC9dnq7Cdxv2TmNwdA4NjedbE1f4chZxr1N9XUBAywhOtOLMNNJGagEVr4ThsAQolZg6HQa4n7TObqBIbz87gjUgq4IBGh1LJ3In+GEVYLHnkz/cuzp5KzRFJb2giDnhUc55Sy8yybegH7rJ4BzIfrzH0fbPARHDoeiqxxqQh0nUT72a0Nrey9UK2jgDOcMqxpE2Z435MXzgsStP955Zt0P1uzry1Rn/J9lFnL+XIiwV5vwqD5H8cZuUFSX65ZNhzrac68KoZFkSuqjRtsEHXuMFagwQ0lBlywOkQuDsbg4WmNs7TJigvjJ46WSfH5Uy4NOS39OgNCuJcfIeGwp0QUujNIzFvnEgw3Yy2N81n42bmS8u5gtvRw/j8R3lTNpUHtrYkc5iec/NPn5vFhixZv0sHQWEj9LF9vsimfUj81emMnYjk6g1MVbMzQKs8IFiWnXrtW4WNpeI0nPM3pZikoG5SdBMUJAbccZWFObGx70yehQKReHQBsPye5rJqlP9YqgPALslv+I1vdL2cRJpBbIEAiK2y898zXacK1MRPsAWQOPTOKu9YCVHrfC6OCCc90bOdnevocUgdWBghcv+Torojdh6qvmwTPmqfhlIwlwC+4qMAcNq5Nbr4fmQ1PhpplzeoD8JJS3CCOaft05hMs534ltXj9/jOsNy5g==';
  const enc8 = s => new TextEncoder().encode(String(s));
  function toBytes(x) {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    if (x && x.bytes instanceof Uint8Array) return x.bytes;
    return enc8(x == null ? '' : x);
  }
  const hexOf = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  function b64Of(b, url) {
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    const r = btoa(s);
    return url ? r.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : r;
  }
  function fromB64(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
    while (s.length % 4) s += '=';
    const bin = atob(s), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function outAs(b, o) {
    const e = (o && (o.encoding || o.output)) || 'hex';
    return e === 'bytes' ? b : e === 'base64' ? b64Of(b) : e === 'base64url' ? b64Of(b, true) : hexOf(b);
  }

  /* ---------- MD5 ---------- */
  function md5Bytes(msg) {
    const K = new Int32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
    const n = msg.length, total = ((n + 8) >> 6) + 1 << 6;
    const buf = new Uint8Array(total);
    buf.set(msg); buf[n] = 0x80;
    const bits = n * 8;
    for (let i = 0; i < 8; i++) buf[total - 8 + i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
    let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    const M = new Int32Array(16);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) M[i] = buf[off + i * 4] | buf[off + i * 4 + 1] << 8 | buf[off + i * 4 + 2] << 16 | buf[off + i * 4 + 3] << 24;
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
        else { F = C ^ (B | ~D); g = (7 * i) & 15; }
        const s = S[(i >> 4) * 4 + (i & 3)];
        const t = (A + F + K[i] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + ((t << s) | (t >>> (32 - s)))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach((w, k) => { for (let i = 0; i < 4; i++) out[k * 4 + i] = (w >>> (8 * i)) & 255; });
    return out;
  }

  /* ---------- SHA-1 dan SHA-256 ---------- */
  function padBE(msg) {
    const n = msg.length, total = ((n + 8) >> 6) + 1 << 6;
    const buf = new Uint8Array(total);
    buf.set(msg); buf[n] = 0x80;
    const bits = n * 8;
    for (let i = 0; i < 8; i++) buf[total - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
    return buf;
  }
  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  function sha1Bytes(msg) {
    const buf = padBE(msg), W = new Int32Array(80);
    let h0 = 0x67452301, h1 = 0xefcdab89 | 0, h2 = 0x98badcfe | 0, h3 = 0x10325476, h4 = 0xc3d2e1f0 | 0;
    for (let off = 0; off < buf.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = buf[off + 4 * i] << 24 | buf[off + 4 * i + 1] << 16 | buf[off + 4 * i + 2] << 8 | buf[off + 4 * i + 3];
      for (let i = 16; i < 80; i++) W[i] = rotl(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
        const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc | 0 : 0xca62c1d6 | 0;
        const t = (rotl(a, 5) + f + e + k + W[i]) | 0;
        e = d; d = c; c = rotl(b, 30); b = a; a = t;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    const out = new Uint8Array(20);
    [h0, h1, h2, h3, h4].forEach((w, k) => { for (let i = 0; i < 4; i++) out[k * 4 + i] = (w >>> (24 - 8 * i)) & 255; });
    return out;
  }
  const K256 = new Int32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256Bytes(msg) {
    const buf = padBE(msg), W = new Int32Array(64);
    const H = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    for (let off = 0; off < buf.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = buf[off + 4 * i] << 24 | buf[off + 4 * i + 1] << 16 | buf[off + 4 * i + 2] << 8 | buf[off + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K256[i] + W[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += hh;
    }
    const out = new Uint8Array(32);
    H.forEach((w, k) => { for (let i = 0; i < 4; i++) out[k * 4 + i] = (w >>> (24 - 8 * i)) & 255; });
    return out;
  }

  /* ---------- SHA-384 dan SHA-512 (BigInt) ---------- */
  let K512 = null;
  function sha512Bytes(msg, is384) {
    if (!K512) {
      K512 = '428a2f98d728ae22 7137449123ef65cd b5c0fbcfec4d3b2f e9b5dba58189dbbc 3956c25bf348b538 59f111f1b605d019 923f82a4af194f9b ab1c5ed5da6d8118 d807aa98a3030242 12835b0145706fbe 243185be4ee4b28c 550c7dc3d5ffb4e2 72be5d74f27b896f 80deb1fe3b1696b1 9bdc06a725c71235 c19bf174cf692694 e49b69c19ef14ad2 efbe4786384f25e3 0fc19dc68b8cd5b5 240ca1cc77ac9c65 2de92c6f592b0275 4a7484aa6ea6e483 5cb0a9dcbd41fbd4 76f988da831153b5 983e5152ee66dfab a831c66d2db43210 b00327c898fb213f bf597fc7beef0ee4 c6e00bf33da88fc2 d5a79147930aa725 06ca6351e003826f 142929670a0e6e70 27b70a8546d22ffc 2e1b21385c26c926 4d2c6dfc5ac42aed 53380d139d95b3df 650a73548baf63de 766a0abb3c77b2a8 81c2c92e47edaee6 92722c851482353b a2bfe8a14cf10364 a81a664bbc423001 c24b8b70d0f89791 c76c51a30654be30 d192e819d6ef5218 d69906245565a910 f40e35855771202a 106aa07032bbd1b8 19a4c116b8d2d0c8 1e376c085141ab53 2748774cdf8eeb99 34b0bcb5e19b48a8 391c0cb3c5c95a63 4ed8aa4ae3418acb 5b9cca4f7763e373 682e6ff3d6b2b8a3 748f82ee5defb2fc 78a5636f43172f60 84c87814a1f0ab72 8cc702081a6439ec 90befffa23631e28 a4506cebde82bde9 bef9a3f7b2c67915 c67178f2e372532b ca273eceea26619c d186b8c721c0c207 eada7dd6cde0eb1e f57d4f7fee6ed178 06f067aa72176fba 0a637dc5a2c898a6 113f9804bef90dae 1b710b35131c471b 28db77f523047d84 32caab7b40c72493 3c9ebe0a15c9bebc 431d67c49c100d4c 4cc5d4becb3e42b6 597f299cfc657e2a 5fcb6fab3ad6faec 6c44198c4a475817'.split(' ').map(x => BigInt('0x' + x));
    }
    const M = (1n << 64n) - 1n;
    const rr = (x, n) => ((x >> BigInt(n)) | (x << BigInt(64 - n))) & M;
    const n = msg.length, total = ((n + 16) >> 7) + 1 << 7;
    const buf = new Uint8Array(total);
    buf.set(msg); buf[n] = 0x80;
    const bits = n * 8;
    for (let i = 0; i < 8; i++) buf[total - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
    let H = (is384
      ? 'cbbb9d5dc1059ed8 629a292a367cd507 9159015a3070dd17 152fecd8f70e5939 67332667ffc00b31 8eb44a8768581511 db0c2e0d64f98fa7 47b5481dbefa4fa4'
      : '6a09e667f3bcc908 bb67ae8584caa73b 3c6ef372fe94f82b a54ff53a5f1d36f1 510e527fade682d1 9b05688c2b3e6c1f 1f83d9abfb41bd6b 5be0cd19137e2179').split(' ').map(x => BigInt('0x' + x));
    const W = new Array(80);
    for (let off = 0; off < total; off += 128) {
      for (let i = 0; i < 16; i++) { let w = 0n; for (let k = 0; k < 8; k++) w = (w << 8n) | BigInt(buf[off + 8 * i + k]); W[i] = w; }
      for (let i = 16; i < 80; i++) {
        const s0 = rr(W[i - 15], 1) ^ rr(W[i - 15], 8) ^ (W[i - 15] >> 7n);
        const s1 = rr(W[i - 2], 19) ^ rr(W[i - 2], 61) ^ (W[i - 2] >> 6n);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) & M;
      }
      let [a, b, c, d, e, f, g, hh] = H;
      for (let i = 0; i < 80; i++) {
        const S1 = rr(e, 14) ^ rr(e, 18) ^ rr(e, 41);
        const t1 = (hh + S1 + ((e & f) ^ (~e & M & g)) + K512[i] + W[i]) & M;
        const S0 = rr(a, 28) ^ rr(a, 34) ^ rr(a, 39);
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) & M;
        hh = g; g = f; f = e; e = (d + t1) & M; d = c; c = b; b = a; a = (t1 + t2) & M;
      }
      H = H.map((x, i) => (x + [a, b, c, d, e, f, g, hh][i]) & M);
    }
    const out = new Uint8Array(is384 ? 48 : 64);
    for (let k = 0; k < out.length / 8; k++) for (let i = 0; i < 8; i++) out[k * 8 + i] = Number((H[k] >> BigInt(56 - 8 * i)) & 255n);
    return out;
  }

  const HASHES = { md5: [md5Bytes, 64], sha1: [sha1Bytes, 64], sha256: [sha256Bytes, 64], sha384: [m => sha512Bytes(m, true), 128], sha512: [m => sha512Bytes(m, false), 128] };
  function hashFn(name) {
    const k = String(name || 'sha256').toLowerCase().replace(/[-_]/g, '');
    if (!HASHES[k]) throw new Error(`Algoritma "${name}" tidak dikenal. Pilihan: md5, sha1, sha256, sha384, sha512.`);
    return HASHES[k];
  }
  function hmacBytes(algo, key, msg) {
    const [fn, block] = hashFn(algo);
    let k = toBytes(key);
    if (k.length > block) k = fn(k);
    const kp = new Uint8Array(block); kp.set(k);
    const ipad = kp.map(x => x ^ 0x36), opad = kp.map(x => x ^ 0x5c);
    const m = toBytes(msg);
    const inner = new Uint8Array(block + m.length); inner.set(ipad); inner.set(m, block);
    const ih = fn(inner);
    const outer = new Uint8Array(block + ih.length); outer.set(opad); outer.set(ih, block);
    return fn(outer);
  }

  /* ---------- bcrypt ($2y$, cocok dengan password_hash() di PHP) ---------- */
  const BC64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function bcB64(b, len) {
    let s = '', off = 0;
    while (off < len) {
      let c1 = b[off++] & 0xff;
      s += BC64[(c1 >> 2) & 0x3f];
      c1 = (c1 & 0x03) << 4;
      if (off >= len) { s += BC64[c1 & 0x3f]; break; }
      let c2 = b[off++] & 0xff;
      c1 |= (c2 >> 4) & 0x0f; s += BC64[c1 & 0x3f];
      c1 = (c2 & 0x0f) << 2;
      if (off >= len) { s += BC64[c1 & 0x3f]; break; }
      c2 = b[off++] & 0xff;
      c1 |= (c2 >> 6) & 0x03; s += BC64[c1 & 0x3f]; s += BC64[c2 & 0x3f];
    }
    return s;
  }
  function bcUnB64(s, len) {
    const out = [];
    const v = c => BC64.indexOf(c);
    let off = 0;
    while (off < s.length - 1 && out.length < len) {
      const c1 = v(s[off++]), c2 = v(s[off++]);
      if (c1 < 0 || c2 < 0) break;
      out.push(((c1 << 2) | ((c2 & 0x30) >> 4)) & 0xff);
      if (out.length >= len || off >= s.length) break;
      const c3 = v(s[off++]);
      if (c3 < 0) break;
      out.push((((c2 & 0x0f) << 4) | ((c3 & 0x3c) >> 2)) & 0xff);
      if (out.length >= len || off >= s.length) break;
      const c4 = v(s[off++]);
      out.push((((c3 & 0x03) << 6) | c4) & 0xff);
    }
    return new Uint8Array(out);
  }
  let BF = null;
  function bfInit() {
    if (!BF) {
      const b = fromB64(BF_INIT), w = new Int32Array(1042);
      for (let i = 0; i < 1042; i++) w[i] = b[4 * i] << 24 | b[4 * i + 1] << 16 | b[4 * i + 2] << 8 | b[4 * i + 3];
      BF = w;
    }
    return { P: BF.slice(0, 18), S: BF.slice(18) };
  }
  function bfEnc(lr, off, P, S) {
    let l = lr[off], r = lr[off + 1], n;
    l ^= P[0];
    for (let i = 1; i <= 16; i += 2) {
      n = S[l >>> 24]; n += S[0x100 | ((l >> 16) & 0xff)]; n ^= S[0x200 | ((l >> 8) & 0xff)]; n += S[0x300 | (l & 0xff)];
      r ^= n ^ P[i];
      n = S[r >>> 24]; n += S[0x100 | ((r >> 16) & 0xff)]; n ^= S[0x200 | ((r >> 8) & 0xff)]; n += S[0x300 | (r & 0xff)];
      l ^= n ^ P[i + 1];
    }
    lr[off] = r ^ P[17];
    lr[off + 1] = l;
  }
  function bfWord(data, st) {
    let w = 0;
    for (let i = 0; i < 4; i++) { w = (w << 8) | (data[st.p] & 0xff); st.p = (st.p + 1) % data.length; }
    return w;
  }
  function bfKey(key, P, S) {
    const st = { p: 0 }, lr = new Int32Array(2);
    for (let i = 0; i < 18; i++) P[i] ^= bfWord(key, st);
    for (let i = 0; i < 18; i += 2) { bfEnc(lr, 0, P, S); P[i] = lr[0]; P[i + 1] = lr[1]; }
    for (let i = 0; i < 1024; i += 2) { bfEnc(lr, 0, P, S); S[i] = lr[0]; S[i + 1] = lr[1]; }
  }
  function bfEksKey(salt, key, P, S) {
    const sk = { p: 0 }, ss = { p: 0 }, lr = new Int32Array(2);
    for (let i = 0; i < 18; i++) P[i] ^= bfWord(key, sk);
    for (let i = 0; i < 18; i += 2) { lr[0] ^= bfWord(salt, ss); lr[1] ^= bfWord(salt, ss); bfEnc(lr, 0, P, S); P[i] = lr[0]; P[i + 1] = lr[1]; }
    for (let i = 0; i < 1024; i += 2) { lr[0] ^= bfWord(salt, ss); lr[1] ^= bfWord(salt, ss); bfEnc(lr, 0, P, S); S[i] = lr[0]; S[i + 1] = lr[1]; }
  }
  async function bcryptRaw(password, salt, cost, variant) {
    const pw = enc8(password);
    let key = new Uint8Array(Math.min(72, pw.length + 1));
    key.set(pw.subarray(0, Math.min(72, pw.length)));
    if (!key.length) key = new Uint8Array([0]);
    const { P, S } = bfInit();
    bfEksKey(salt, key, P, S);
    const rounds = 1 << cost;
    const t0 = Date.now();
    for (let i = 0; i < rounds; i++) {
      bfKey(key, P, S); bfKey(salt, P, S);
      if (Date.now() - t0 > 40 && (i & 15) === 15) await new Promise(r => setTimeout(r, 0));
    }
    const ct = new Int32Array([0x4f727068, 0x65616e42, 0x65686f6c, 0x64657253, 0x63727944, 0x6f756274]);
    for (let i = 0; i < 64; i++) for (let j = 0; j < 6; j += 2) bfEnc(ct, j, P, S);
    const out = new Uint8Array(24);
    for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) out[i * 4 + k] = (ct[i] >>> (24 - 8 * k)) & 0xff;
    return '$' + variant + '$' + String(cost).padStart(2, '0') + '$' + bcB64(salt, 16) + bcB64(out, 23);
  }
  function randBytes(n) {
    const b = new Uint8Array(n);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(b);
    else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }

  /* ---------- AES-GCM dengan kata sandi (Web Crypto) ---------- */
  function subtle() {
    const s = global.crypto && global.crypto.subtle;
    if (!s) throw new Error('Enkripsi butuh Web Crypto, yang hanya tersedia di halaman https://, localhost, atau berkas yang dibuka dengan klik dua kali. Hash (md5, sha256, hash_password) tetap bisa dipakai.');
    return s;
  }
  async function aesKey(password, salt, iter) {
    const s = subtle();
    const base = await s.importKey('raw', enc8(password), 'PBKDF2', false, ['deriveKey']);
    return s.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /* ---------- Jawaban kuis ---------- */
  const quizNorm = s => String(s == null ? '' : s).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?。]+$/, '');
  function quizDigest(salt, ans, exact) {
    let h = enc8(salt + ':' + (exact ? String(ans) : quizNorm(ans)));
    for (let i = 0; i < 1000; i++) h = sha256Bytes(h);
    return b64Of(h.subarray(0, 18), true);
  }

  const CRYPTO = {
    md5: (x, o) => outAs(md5Bytes(toBytes(x)), o),
    sha1: (x, o) => outAs(sha1Bytes(toBytes(x)), o),
    sha256: (x, o) => outAs(sha256Bytes(toBytes(x)), o),
    sha384: (x, o) => outAs(sha512Bytes(toBytes(x), true), o),
    sha512: (x, o) => outAs(sha512Bytes(toBytes(x), false), o),
    hash: (x, algo, o) => outAs(hashFn(algo)[0](toBytes(x)), o),
    hmac: (key, msg, algo, o) => outAs(hmacBytes(algo || 'sha256', key, msg), isPlainObj(algo) ? algo : o),
    async hash_password(password, o) {
      o = o || {};
      const cost = Math.max(4, Math.min(15, o.cost != null ? o.cost : 10));
      return bcryptRaw(password, randBytes(16), cost, '2y');
    },
    async verify_password(password, hash) {
      const m = String(hash || '').match(/^\$(2[abxy])\$(\d{2})\$([./A-Za-z0-9]{53})$/);
      if (!m) return false;
      const salt = bcUnB64(m[3].slice(0, 22), 16);
      const again = await bcryptRaw(password, salt, +m[2], m[1]);
      let diff = again.length ^ hash.length;
      for (let i = 0; i < Math.min(again.length, hash.length); i++) diff |= again.charCodeAt(i) ^ hash.charCodeAt(i);
      return diff === 0;
    },
    async encrypt(text, password, o) {
      o = o || {};
      if (password == null || password === '') throw new Error('encrypt() butuh kata sandi, misalnya sl.crypto.encrypt("teks", "kata-sandi").');
      const salt = randBytes(16), iv = randBytes(12), iter = o.iterations || 150000;
      const key = await aesKey(password, salt, iter);
      const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, toBytes(typeof text === 'string' || text instanceof Uint8Array ? text : JSON.stringify(text))));
      const out = new Uint8Array(32 + ct.length);
      out.set(salt); out.set(iv, 16); new DataView(out.buffer).setUint32(28, iter); out.set(ct, 32);
      return 'slak1:' + b64Of(out);
    },
    async decrypt(data, password, o) {
      o = o || {};
      const s = String(data || '');
      if (!s.startsWith('slak1:')) throw new Error('Data ini bukan hasil sl.crypto.encrypt().');
      const b = fromB64(s.slice(6));
      const salt = b.subarray(0, 16), iv = b.subarray(16, 28), iter = new DataView(b.buffer, b.byteOffset).getUint32(28);
      const key = await aesKey(password, salt, iter);
      let pt;
      try { pt = await subtle().decrypt({ name: 'AES-GCM', iv }, key, b.subarray(32)); }
      catch (e) { throw new Error('Kata sandi salah atau data rusak.'); }
      const txt = new TextDecoder().decode(pt);
      if (o.json) return JSON.parse(txt);
      return txt;
    },
    random_token(n, o) {
      if (isPlainObj(n)) { o = n; n = null; }
      return outAs(randBytes(n || 16), o || { encoding: 'hex' });
    },
    uuid() {
      if (global.crypto && global.crypto.randomUUID) { try { return global.crypto.randomUUID(); } catch (e) { /* lanjut */ } }
      const b = randBytes(16); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
      const x = hexOf(b);
      return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
    },
    base64: (x, o) => b64Of(toBytes(x), o && o.url),
    from_base64: (s, o) => { const b = fromB64(s); return o && o.bytes ? b : new TextDecoder().decode(b); },
    /** Buat kode pelindung jawaban kuis. Bisa satu jawaban atau larik beberapa jawaban yang sama-sama benar. */
    quiz_hash(answers, o) {
      o = o || {};
      return [].concat(answers).map(a => {
        const salt = hexOf(randBytes(4));
        return (o.exact ? 'sqx$' : 'sq1$') + salt + '$' + quizDigest(salt, a, !!o.exact);
      }).join('|');
    },
    /** Periksa jawaban terhadap kode dari quiz_hash(). Huruf besar/kecil, spasi lebih, dan titik di akhir diabaikan. */
    quiz_check(answer, code) {
      if (answer == null || code == null) return false;
      return String(code).split('|').some(part => {
        const m = part.trim().match(/^(sq1|sqx)\$([0-9a-f]+)\$([\w-]+)$/);
        return !!m && quizDigest(m[2], answer, m[1] === 'sqx') === m[3];
      });
    }
  };

  /* ======================================================================
   * LaTeX → MathML (sl.latex dan $...$ di markdown) — tanpa pustaka (Slak 1.3.1)
   * MathML didukung langsung oleh Chrome, Edge, Firefox, dan Safari.
   * ==================================================================== */

  const TEX_SYM = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    infty: '∞', partial: '∂', nabla: '∇', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', emptyset: '∅', varnothing: '∅', degree: '°', prime: '′', angle: '∠', triangle: '△', square: '□'
  };
  const TEX_OP = {
    times: '×', cdot: '⋅', pm: '±', mp: '∓', div: '÷', ast: '∗', star: '⋆', circ: '∘', bullet: '∙', oplus: '⊕', otimes: '⊗',
    leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝', ll: '≪', gg: '≫',
    in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', cup: '∪', cap: '∩', setminus: '∖',
    forall: '∀', exists: '∃', nexists: '∄', neg: '¬', lnot: '¬', land: '∧', wedge: '∧', lor: '∨', vee: '∨', perp: '⊥', parallel: '∥', mid: '∣',
    to: '→', rightarrow: '→', leftarrow: '←', gets: '←', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', Leftrightarrow: '⇔', implies: '⟹', iff: '⟺', mapsto: '↦', uparrow: '↑', downarrow: '↓',
    ldots: '…', cdots: '⋯', dots: '…', vdots: '⋮', ddots: '⋱', colon: ':',
    langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', vert: '|', Vert: '‖', lbrace: '{', rbrace: '}'
  };
  const TEX_BIG = { sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮', bigcup: '⋃', bigcap: '⋂', bigoplus: '⨁', bigotimes: '⨂' };
  const TEX_FN = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'exp', 'det', 'dim', 'ker', 'arg', 'deg', 'gcd', 'hom', 'lim', 'liminf', 'limsup', 'max', 'min', 'sup', 'inf', 'Pr', 'mod']);
  const TEX_LIMFN = new Set(['lim', 'liminf', 'limsup', 'max', 'min', 'sup', 'inf', 'det', 'gcd', 'Pr']);
  const TEX_ACC = { hat: '^', widehat: '^', bar: '¯', overline: '‾', vec: '→', overrightarrow: '→', dot: '˙', ddot: '¨', tilde: '~', widetilde: '~', check: 'ˇ', breve: '˘', acute: '´', grave: '`' };
  const TEX_SPACE = { ',': '0.17em', ':': '0.22em', ';': '0.28em', '!': '-0.17em', ' ': '0.25em', quad: '1em', qquad: '2em', enspace: '0.5em', thinspace: '0.17em' };
  const BB = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ', H: 'ℍ', E: '𝔼', F: '𝔽' };
  const FENCE = { '(': '(', ')': ')', '[': '[', ']': ']', '|': '|', '.': '', '\\{': '{', '\\}': '}', '\\langle': '⟨', '\\rangle': '⟩', '\\lfloor': '⌊', '\\rfloor': '⌋', '\\lceil': '⌈', '\\rceil': '⌉', '\\|': '‖', '\\vert': '|', '\\Vert': '‖', '/': '/' };

  function texToMathML(src, display) {
    const s = String(src == null ? '' : src);
    let i = 0;
    const X = t => esc(t);
    const peek = () => s[i];
    const skipWs = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const readCmd = () => {
      i++;
      if (/[a-zA-Z]/.test(s[i] || '')) { let n = ''; while (/[a-zA-Z]/.test(s[i] || '')) n += s[i++]; return n; }
      return s[i++] || '';
    };
    const readArgRaw = () => {
      skipWs();
      if (s[i] !== '{') { const c = s[i++]; return c == null ? '' : c; }
      let depth = 0, start = ++i;
      for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { if (!depth) break; depth--; } }
      return s.slice(start, i++);
    };
    const readOpt = () => {
      skipWs();
      if (s[i] !== '[') return null;
      let depth = 0, start = ++i;
      for (; i < s.length; i++) { if (s[i] === '[') depth++; else if (s[i] === ']') { if (!depth) break; depth--; } }
      return s.slice(start, i++);
    };
    const sub = (t) => texToMathML(t, display).replace(/^<math[^>]*>|<\/math>$/g, '');
    const readFenceTok = () => {
      skipWs();
      if (s[i] === '\\') { const st = i; const c = readCmd(); return '\\' + c in FENCE ? FENCE['\\' + c] : (TEX_OP[c] || s.slice(st, i)); }
      const c = s[i++]; return FENCE[c] != null ? FENCE[c] : c;
    };

    function atom(stop) {
      skipWs();
      const c = s[i];
      if (c == null) return null;
      if (c === '{') { const inner = readArgRaw(); return { m: '<mrow>' + sub(inner) + '</mrow>' }; }
      if (/[0-9.]/.test(c)) { let n = ''; while (/[0-9.]/.test(s[i] || '')) n += s[i++]; return { m: `<mn>${X(n)}</mn>` }; }
      if (/[a-zA-Z]/.test(c)) { i++; return { m: `<mi>${X(c)}</mi>` }; }
      if (c === "'") { let p = ''; while (s[i] === "'") { p += '′'; i++; } return { m: `<mo>${p}</mo>`, prime: true }; }
      if (c === '\\') {
        const save = i;
        const cmd = readCmd();
        if (cmd === '\\') { i = save; return null; }
        if (cmd in TEX_SPACE) return { m: `<mspace width="${TEX_SPACE[cmd]}"/>` };
        if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac' || cmd === 'cfrac') { const a = readArgRaw(), b = readArgRaw(); return { m: `<mfrac${cmd === 'dfrac' ? ' displaystyle="true"' : ''}><mrow>${sub(a)}</mrow><mrow>${sub(b)}</mrow></mfrac>` }; }
        if (cmd === 'binom' || cmd === 'dbinom' || cmd === 'tbinom') { const a = readArgRaw(), b = readArgRaw(); return { m: `<mrow><mo>(</mo><mfrac linethickness="0"><mrow>${sub(a)}</mrow><mrow>${sub(b)}</mrow></mfrac><mo>)</mo></mrow>` }; }
        if (cmd === 'sqrt') { const n = readOpt(), a = readArgRaw(); return { m: n != null ? `<mroot><mrow>${sub(a)}</mrow><mrow>${sub(n)}</mrow></mroot>` : `<msqrt>${sub(a)}</msqrt>` }; }
        if (cmd === 'text' || cmd === 'textrm' || cmd === 'mbox' || cmd === 'textit' || cmd === 'textbf') {
          const t = readArgRaw();
          const st = cmd === 'textbf' ? ' style="font-weight:bold"' : cmd === 'textit' ? ' style="font-style:italic"' : '';
          return { m: `<mtext${st}>${X(t)}</mtext>` };
        }
        if (cmd === 'mathrm' || cmd === 'operatorname' || cmd === 'mathsf' || cmd === 'mathtt') { const t = readArgRaw(); return { m: `<mi mathvariant="normal">${X(t.replace(/\\,/g, ' '))}</mi>`, fn: cmd === 'operatorname' }; }
        if (cmd === 'mathbf' || cmd === 'boldsymbol' || cmd === 'bm') { const t = readArgRaw(); return { m: `<mrow style="font-weight:bold">${sub(t)}</mrow>` }; }
        if (cmd === 'mathit') { const t = readArgRaw(); return { m: `<mrow style="font-style:italic">${sub(t)}</mrow>` }; }
        if (cmd === 'mathbb') { const t = readArgRaw(); return { m: `<mi mathvariant="normal">${X([...t].map(ch => BB[ch] || ch).join(''))}</mi>` }; }
        if (cmd === 'mathcal' || cmd === 'mathscr') { const t = readArgRaw(); return { m: `<mi mathvariant="normal" style="font-family:cursive">${X(t)}</mi>` }; }
        if (cmd in TEX_ACC) { const t = readArgRaw(); return { m: `<mover accent="true"><mrow>${sub(t)}</mrow><mo stretchy="${/wide|over/.test(cmd)}">${TEX_ACC[cmd]}</mo></mover>` }; }
        if (cmd === 'underline') { const t = readArgRaw(); return { m: `<munder accentunder="true"><mrow>${sub(t)}</mrow><mo stretchy="true">_</mo></munder>` }; }
        if (cmd === 'overset' || cmd === 'stackrel') { const a = readArgRaw(), b = readArgRaw(); return { m: `<mover><mrow>${sub(b)}</mrow><mrow>${sub(a)}</mrow></mover>` }; }
        if (cmd === 'underset') { const a = readArgRaw(), b = readArgRaw(); return { m: `<munder><mrow>${sub(b)}</mrow><mrow>${sub(a)}</mrow></munder>` }; }
        if (cmd === 'overbrace' || cmd === 'underbrace') { const t = readArgRaw(); const tag = cmd === 'overbrace' ? 'mover' : 'munder'; return { m: `<${tag}><mrow>${sub(t)}</mrow><mo stretchy="true">${cmd === 'overbrace' ? '⏞' : '⏟'}</mo></${tag}>`, big: true }; }
        if (cmd === 'color' || cmd === 'textcolor') { const col = readArgRaw(), t = readArgRaw(); return { m: `<mrow style="color:${X(col)}">${sub(t)}</mrow>` }; }
        if (cmd === 'boxed') { const t = readArgRaw(); return { m: `<mrow style="border:1px solid currentColor;padding:2px 4px">${sub(t)}</mrow>` }; }
        if (cmd === 'left') {
          const open = readFenceTok();
          let depth = 0, start = i, end = -1;
          while (i < s.length) {
            if (s.startsWith('\\left', i) && !/[a-zA-Z]/.test(s[i + 5] || '')) { depth++; i += 5; continue; }
            if (s.startsWith('\\right', i) && !/[a-zA-Z]/.test(s[i + 6] || '')) { if (!depth) { end = i; break; } depth--; i += 6; continue; }
            i++;
          }
          const inner = s.slice(start, end < 0 ? s.length : end);
          if (end >= 0) i = end + 6;
          const close = end >= 0 ? readFenceTok() : '';
          return { m: `<mrow>${open ? `<mo fence="true" stretchy="true">${X(open)}</mo>` : ''}${sub(inner)}${close ? `<mo fence="true" stretchy="true">${X(close)}</mo>` : ''}</mrow>` };
        }
        if (cmd === 'big' || cmd === 'Big' || cmd === 'bigg' || cmd === 'Bigg' || cmd === 'bigl' || cmd === 'bigr' || cmd === 'Bigl' || cmd === 'Bigr') {
          const f = readFenceTok(); const sz = /gg/.test(cmd) ? '2.4em' : /B/.test(cmd) ? '1.8em' : '1.2em';
          return { m: `<mo stretchy="true" minsize="${sz}" maxsize="${sz}">${X(f)}</mo>` };
        }
        if (cmd === 'begin') { const env = readArgRaw(); return { m: texEnv(env) }; }
        if (cmd in TEX_BIG) return { m: `<mo largeop="true" movablelimits="${!display}">${TEX_BIG[cmd]}</mo>`, big: !/int$/.test(cmd) };
        if (TEX_FN.has(cmd)) return { m: `<mi mathvariant="normal">${cmd}</mi>`, fn: true, big: TEX_LIMFN.has(cmd) };
        if (cmd in TEX_SYM) return { m: /^[A-Z]/.test(cmd) || cmd.length > 7 || '∞∂∇ℏℓℜℑℵ∅°′∠△□'.includes(TEX_SYM[cmd]) ? `<mi mathvariant="normal">${TEX_SYM[cmd]}</mi>` : `<mi>${TEX_SYM[cmd]}</mi>` };
        if (cmd in TEX_OP) return { m: `<mo>${TEX_OP[cmd]}</mo>` };
        if (cmd === '{' || cmd === '}') return { m: `<mo>${cmd}</mo>` };
        if (cmd === '|') return { m: '<mo>‖</mo>' };
        if ('%$#&_'.includes(cmd)) return { m: `<mo>${X(cmd)}</mo>` };
        if (cmd === 'displaystyle' || cmd === 'limits' || cmd === 'nolimits' || cmd === 'textstyle') return { m: '' };
        return { m: `<mtext style="color:var(--err)">\\${X(cmd)}</mtext>` };
      }
      if (c === '&' || c === '}' || c === stop) return null;
      i++;
      if (c === '~') return { m: '<mspace width="0.33em"/>' };
      if ('()[]|'.includes(c)) return { m: `<mo stretchy="false">${X(c)}</mo>` };
      return { m: `<mo>${X(c)}</mo>` };
    }

    function texEnv(env) {
      const endTag = '\\end{' + env + '}';
      let depth = 0, start = i, j = i;
      while (j < s.length) {
        if (s.startsWith('\\begin{', j)) { depth++; j += 7; continue; }
        if (s.startsWith('\\end{', j)) { if (!depth && s.startsWith(endTag, j)) break; depth--; j += 5; continue; }
        j++;
      }
      let body = s.slice(start, j);
      i = j < s.length ? j + endTag.length : s.length;
      if (env === 'array') body = body.replace(/^\s*\{[^}]*\}/, '');
      const rows = body.split(/\\\\/).filter((r, k, a) => r.trim() || k < a.length - 1);
      const align = /align|aligned|split|cases/.test(env);
      const tr = rows.map(r => '<mtr>' + r.split('&').map((cell, k) => `<mtd${align ? ` style="text-align:${env === 'cases' ? 'left' : (k % 2 ? 'left' : 'right')};padding:0 ${k % 2 ? '1em 0 0' : '0'}"` : ''}>${sub(cell)}</mtd>`).join('') + '</mtr>').join('');
      const table = `<mtable${align ? ' columnspacing="0"' : ''}>${tr}</mtable>`;
      const F = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], Bmatrix: ['{', '}'], vmatrix: ['|', '|'], Vmatrix: ['‖', '‖'], cases: ['{', ''] }[env];
      return F ? `<mrow><mo fence="true" stretchy="true">${F[0]}</mo>${table}${F[1] ? `<mo fence="true" stretchy="true">${F[1]}</mo>` : ''}</mrow>` : table;
    }

    let out = '';
    while (i < s.length) {
      skipWs();
      if (i >= s.length) break;
      if (s[i] === '\\' && s[i + 1] === '\\') { i += 2; out += '<mspace linebreak="newline"/>'; continue; }
      if (s[i] === '&' || s[i] === '}') { i++; continue; }
      const a = atom();
      if (!a) { i++; continue; }
      let base = a.m, supv = null, subv = null;
      for (;;) {
        skipWs();
        if (s[i] === '^') { i++; const t = atom(); supv = t ? t.m : ''; continue; }
        if (s[i] === '_') { i++; const t = atom(); subv = t ? t.m : ''; continue; }
        if (s[i] === "'" ) { const t = atom(); supv = (supv || '') + t.m; continue; }
        break;
      }
      const under = a.big && display;
      if (supv != null && subv != null) base = under ? `<munderover>${base}<mrow>${subv}</mrow><mrow>${supv}</mrow></munderover>` : `<msubsup>${base}<mrow>${subv}</mrow><mrow>${supv}</mrow></msubsup>`;
      else if (supv != null) base = under ? `<mover>${base}<mrow>${supv}</mrow></mover>` : `<msup>${base}<mrow>${supv}</mrow></msup>`;
      else if (subv != null) base = under ? `<munder>${base}<mrow>${subv}</mrow></munder>` : `<msub>${base}<mrow>${subv}</mrow></msub>`;
      if (a.fn) base += '<mo>&#x2061;</mo>';
      out += base;
    }
    return `<math${display ? ' display="block"' : ''}>${out}</math>`;
  }

  /* ======================================================================
   * Elemen: setiap fungsi menerima konteks lalu argumen pengguna
   * ==================================================================== */

  const EL = {};

  function textEl(ctx, type, tag, cls, text, inlineMd, o) {
    o = o || {};
    const rec = place(ctx, type, '', r => { r.el = h(tag, { class: 'slak-el ' + cls }); });
    const s = String(text == null ? '' : text);
    const key = s + '|' + (o.divider || '');
    if (rec.s !== key) {
      rec.s = key;
      if (inlineMd) rec.el.innerHTML = inline(esc(s)); else rec.el.textContent = s;
      rec.el.classList.toggle('slak-divider-under', !!o.divider);
      if (o.divider) rec.el.style.setProperty('--slak-div', o.divider === true ? 'var(--accent)' : `var(--slak-${o.divider}, ${o.divider})`);
    }
    if (o.anchor !== false && (type === 'title' || type === 'header' || type === 'subheader')) {
      const id = o.anchor || s.toLowerCase().replace(/[^\wÀ-ɏ]+/g, '-').replace(/^-|-$/g, '');
      if (rec.el.id !== id) rec.el.id = id;
      if (!rec.el.querySelector('.slak-anchor')) {
        const a = h('a', { class: 'slak-anchor', href: '#', 'aria-label': 'Tautan ke bagian ini', text: '#' });
        a.addEventListener('click', e => { e.preventDefault(); rec.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        rec.el.append(a);
      }
    } else { const a = rec.el.querySelector('.slak-anchor'); if (a) a.remove(); }
    return rec;
  }

  EL.title = (ctx, text, o) => { textEl(ctx, 'title', 'h1', 'slak-title', text, true, o); };
  EL.header = (ctx, text, o) => { textEl(ctx, 'header', 'h2', 'slak-header', text, true, o); };
  EL.subheader = (ctx, text, o) => { textEl(ctx, 'subheader', 'h3', 'slak-subheader', text, true, o); };
  EL.caption = (ctx, text) => { textEl(ctx, 'caption', 'div', 'slak-caption', text, true); };
  EL.text = (ctx, text) => { textEl(ctx, 'text', 'div', 'slak-text', text, false); };

  EL.markdown = (ctx, text, o) => {
    o = o || {};
    const rec = place(ctx, 'markdown', '', r => { r.el = h('div', { class: 'slak-el slak-md' }); });
    const html = md(text, !!o.unsafe_allow_html);
    if (rec.html !== html) { rec.html = html; rec.el.innerHTML = html; }
  };

  EL.html = (ctx, s) => {
    const rec = place(ctx, 'html', '', r => { r.el = h('div', { class: 'slak-el slak-html' }); });
    const html = String(s == null ? '' : s);
    if (rec.html !== html) { rec.html = html; rec.el.innerHTML = html; }
  };

  EL.divider = ctx => { place(ctx, 'divider', '', r => { r.el = h('hr', { class: 'slak-el slak-hr' }); }); };

  EL.code = (ctx, code, o) => {
    o = typeof o === 'string' ? { language: o } : (o || {});
    const rec = place(ctx, 'code', '', r => {
      r.pre = h('pre', {}, r.codeEl = h('code'));
      r.lang = h('span', { class: 'slak-lang' });
      r.btn = h('button', {
        class: 'slak-copy', type: 'button', text: 'Salin',
        onclick: () => {
          const done = () => { r.btn.textContent = 'Tersalin ✓'; setTimeout(() => { r.btn.textContent = 'Salin'; }, 1400); };
          if (navigator.clipboard) navigator.clipboard.writeText(r.src).then(done, () => {}); else done();
        }
      });
      r.el = h('div', { class: 'slak-el slak-code' }, r.pre, r.lang, r.btn);
    });
    const src = String(code == null ? '' : code).replace(/^\n+|\s+$/g, '');
    if (rec.src !== src) { rec.src = src; rec.codeEl.textContent = src; }
    rec.lang.textContent = o.language || '';
    rec.pre.classList.toggle('wrap', !!o.wrap_lines);
  };

  EL.json = (ctx, v, o) => {
    o = o || {};
    const rec = place(ctx, 'json', '', r => { r.el = h('pre', { class: 'slak-el slak-json' }); });
    const html = jsonHTML(v);
    if (rec.html !== html) { rec.html = html; rec.el.innerHTML = html; }
  };

  function alertEl(kind, icon) {
    return (ctx, text, o) => {
      o = o || {};
      const rec = place(ctx, kind, '', r => {
        r.ic = h('span', { class: 'slak-alert-ic' });
        r.body = h('div', { class: 'slak-md' });
        r.el = h('div', { class: 'slak-el slak-alert slak-' + kind, role: kind === 'error' ? 'alert' : 'status' }, r.ic, r.body);
      });
      if (o.icon) rec.ic.innerHTML = iconHTML(o.icon); else rec.ic.textContent = icon;
      const html = md(text);
      if (rec.html !== html) { rec.html = html; rec.body.innerHTML = html; }
    };
  }
  EL.success = alertEl('success', '✓');
  EL.info = alertEl('info', 'i');
  EL.warning = alertEl('warning', '!');
  EL.error = alertEl('error', '✕');

  EL.exception = (ctx, err) => {
    const rec = place(ctx, 'exception', '', r => {
      r.head = h('div', { class: 'slak-exc-head' });
      r.stack = h('pre', { class: 'slak-exc-stack' });
      r.el = h('div', { class: 'slak-el slak-alert slak-error slak-exc', role: 'alert' },
        h('span', { class: 'slak-alert-ic', text: '✕' }),
        h('div', { class: 'slak-exc-body' }, r.head, h('details', {}, h('summary', { text: 'Detail' }), r.stack)));
    });
    const e = err instanceof Error ? err : new Error(String(err));
    if (ctx.app._errors) ctx.app._errors.push(e);
    const lvl = ctx.app.getOption('client.showErrorDetails');
    rec.head.innerHTML = lvl === 'none' || lvl === false ? 'Terjadi kesalahan saat menjalankan aplikasi.' : lvl === 'type' ? `<b>${esc(e.name)}</b>` : `<b>${esc(e.name)}</b>: ${esc(e.message)}`;
    rec.stack.textContent = e.stack || String(e);
    rec.stack.parentElement.hidden = lvl === 'none' || lvl === false || lvl === 'type';
  };

  EL.metric = (ctx, label, value, ...rest) => {
    const o = A(rest, ['delta', 'delta_color']);
    const rec = place(ctx, 'metric', '', r => {
      r.l = h('div', { class: 'slak-metric-l' });
      r.v = h('div', { class: 'slak-metric-v' });
      r.d = h('div', { class: 'slak-metric-d' });
      r.sp = h('div', { class: 'slak-metric-sp' });
      r.el = h('div', { class: 'slak-el slak-metric' }, r.l, r.v, r.d, r.sp);
    });
    const fmt = o.format != null ? makeFmt(o.format) : null;
    const lv = o.label_visibility || 'visible';
    rec.l.innerHTML = iconHTML(o.icon) + inline(esc(label == null ? '' : label)) + (o.help && lv === 'visible' ? ` <span class="slak-help" title="${esc(o.help)}">?</span>` : '');
    rec.l.style.display = lv === 'collapsed' ? 'none' : '';
    rec.l.style.visibility = lv === 'hidden' ? 'hidden' : '';
    rec.v.textContent = value == null ? '—' : isNum(value) ? (fmt ? fmt(value) : fmtNum(value)) : String(value);
    rec.el.classList.toggle('slak-bordered', !!o.border);
    setWidth(rec.el, o.width === 'stretch' ? null : o.width);
    if (isNum(o.height)) { rec.el.style.height = o.height + 'px'; rec.el.style.overflow = 'auto'; } else { rec.el.style.height = ''; rec.el.style.overflow = ''; }
    const mode = o.delta_color || 'normal';
    let colorCls = 'off', named = null;
    const hasDelta = !(o.delta == null || o.delta === '');
    const neg = hasDelta && (isNum(o.delta) ? o.delta < 0 : /^\s*-/.test(String(o.delta)));
    const zero = hasDelta && isNum(o.delta) && o.delta === 0;
    if (NAMED_COLORS.includes(mode)) named = mode === 'grey' ? 'gray' : mode;
    else if (mode !== 'off' && hasDelta && !zero) colorCls = (mode === 'inverse' ? neg : !neg) ? 'up' : 'down';
    if (!hasDelta) rec.d.style.display = 'none';
    else {
      rec.d.style.display = '';
      const dtxt = isNum(o.delta) ? (o.delta > 0 ? '+' : '') + (fmt ? fmt(o.delta) : fmtNum(o.delta)) : String(o.delta);
      const arrowMode = o.delta_arrow || 'auto';
      const arrow = arrowMode === 'off' || zero && arrowMode === 'auto' ? '' : (arrowMode === 'up' || (arrowMode === 'auto' && !neg)) ? '▲ ' : '▼ ';
      rec.d.innerHTML = esc(arrow + dtxt) + (o.delta_description ? ` <span class="slak-metric-dd">${esc(o.delta_description)}</span>` : '');
      rec.d.className = 'slak-metric-d ' + (named ? 'named' : colorCls);
      rec.d.style.color = named ? `var(--slak-${named === 'primary' ? 'c1' : named}, var(--accent))` : '';
    }
    if (o.chart_data != null) {
      const vals = numbersOf(o.chart_data).vals;
      const col = named ? `var(--slak-${named === 'primary' ? 'c1' : named})` : colorCls === 'up' ? 'var(--ok)' : colorCls === 'down' ? 'var(--err)' : 'var(--accent)';
      const html = sparkSVG(vals, o.chart_type || 'line', { width: 160, height: 36, color: col });
      if (rec.spHTML !== html) { rec.spHTML = html; rec.sp.innerHTML = html; }
      rec.sp.style.display = '';
    } else rec.sp.style.display = 'none';
  };

  EL.progress = (ctx, value, text) => {
    const rec = place(ctx, 'progress', '', r => {
      r.t = h('div', { class: 'slak-prog-t' });
      r.fill = h('div', { class: 'slak-prog-fill' });
      r.el = h('div', { class: 'slak-el slak-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' },
        r.t, h('div', { class: 'slak-prog-bar' }, r.fill));
      r.set = (v, t) => {
        const p = Math.max(0, Math.min(100, Number(v) || 0));
        r.fill.style.width = p + '%';
        r.el.setAttribute('aria-valuenow', String(p));
        r.el.setAttribute('aria-label', t == null || t === '' ? 'Kemajuan ' + p + '%' : String(t));
        r.t.textContent = t == null ? '' : String(t);
        r.t.style.display = t == null || t === '' ? 'none' : '';
      };
    });
    rec.set(value, text);
    return { progress: (v, t) => rec.set(v, t) };
  };

  EL.spinner = (ctx, text, fn) => {
    const rec = place(ctx, 'spinner', String(text), r => {
      r.el = h('div', { class: 'slak-el slak-spinner' }, h('span', { class: 'slak-spin' }), r.t = h('span'));
    });
    rec.t.textContent = text == null ? 'Memproses…' : String(text);
    const done = () => { if (rec.el.isConnected || ctx.map.has(rec.id)) unplace(ctx, rec); };
    if (typeof fn === 'function') {
      return (async () => { try { return await fn(); } finally { done(); } })();
    }
    return { done };
  };

  function mediaSrc(src) {
    if (src == null) return '';
    if (typeof src === 'string') return src;
    if (src.url) return src.url;
    if (src instanceof Blob) return URL.createObjectURL(src);
    return String(src);
  }

  EL.image = (ctx, src, o) => {
    o = o || {};
    const rec = place(ctx, 'image', '', r => {
      r.img = h('img', { alt: '' });
      r.cap = h('figcaption');
      r.el = h('figure', { class: 'slak-el slak-image' }, r.img, r.cap);
    });
    const s = mediaSrc(src);
    if (rec.img.getAttribute('src') !== s) rec.img.setAttribute('src', safeUrl(s, true));
    rec.img.alt = o.alt || o.caption || '';
    rec.img.style.width = o.width ? (isNum(o.width) ? o.width + 'px' : o.width) : '';
    rec.cap.textContent = o.caption || '';
    rec.cap.style.display = o.caption ? '' : 'none';
  };
  function parseTime(v) {
    if (v == null || v === '') return null;
    if (isNum(v)) return v;
    const ms = parseDuration(v);
    return ms == null ? null : ms / 1000;
  }
  function srtToVtt(t) {
    t = String(t).replace(/\r/g, '');
    if (/^WEBVTT/.test(t)) return t;
    return 'WEBVTT\n\n' + t.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  }
  function avEl(kind) {
    return (ctx, src, o) => {
      o = o || {};
      const rec = place(ctx, kind, '', r => {
        r.el = h(kind, { class: 'slak-el slak-media', controls: true, preload: 'metadata' });
        r.el.addEventListener('loadedmetadata', () => { if (r.start != null && r.el.currentTime < r.start) r.el.currentTime = r.start; });
        r.el.addEventListener('timeupdate', () => {
          if (r.end != null && r.el.currentTime >= r.end) {
            if (r.el.loop) r.el.currentTime = r.start || 0; else { r.el.pause(); r.el.currentTime = r.end; }
          }
        });
        r.dispose = () => { (r.tracks || []).forEach(u => URL.revokeObjectURL(u)); };
      });
      const s = mediaSrc(src);
      if (rec.src !== s) { rec.src = s; rec.el.src = safeUrl(s, true); }
      rec.el.loop = !!o.loop; rec.el.autoplay = !!o.autoplay; rec.el.muted = !!o.muted;
      rec.start = parseTime(o.start_time); rec.end = parseTime(o.end_time);
      if (kind === 'video') setWidth(rec.el, o.width === 'stretch' ? null : o.width);
      const subs = o.subtitles;
      const sig = stableKey(subs == null ? null : typeof subs === 'string' ? subs : Object.entries(subs).map(([k, v]) => [k, typeof v === 'string' ? v : 'blob']));
      if (kind === 'video' && rec.subSig !== sig) {
        rec.subSig = sig;
        rec.el.querySelectorAll('track').forEach(t => t.remove());
        (rec.tracks || []).forEach(u => URL.revokeObjectURL(u));
        rec.tracks = [];
        if (subs != null) {
          const list = typeof subs === 'string' || subs instanceof Blob || (subs && subs.bytes) ? { 'Subtitle': subs } : subs;
          Object.entries(list).forEach(([label, v], i) => {
            let url;
            if (typeof v === 'string' && /^(https?:|blob:|data:|\.{0,2}\/|[\w-]+\.(vtt|srt)$)/i.test(v.trim()) && !v.includes('\n')) url = v;
            else {
              const text = typeof v === 'string' ? v : v && v.text != null ? v.text : '';
              url = URL.createObjectURL(new Blob([srtToVtt(text)], { type: 'text/vtt' }));
              rec.tracks.push(url);
            }
            rec.el.append(h('track', { kind: 'subtitles', label, src: url, default: i === 0 ? true : null, srclang: 'id' }));
          });
        }
      }
    };
  }
  EL.audio = avEl('audio');
  EL.video = avEl('video');

  EL.link_button = (ctx, label, url, o) => {
    o = o || {};
    const rec = place(ctx, 'link_button', String(label), r => {
      r.a = h('a', { class: 'slak-btn', target: '_blank', rel: 'noopener noreferrer' });
      r.el = h('div', { class: 'slak-el slak-btnwrap' }, r.a);
    });
    rec.a.innerHTML = iconHTML(o.icon) + `<span>${inline(esc(label))}</span>`;
    rec.a.href = safeUrl(esc(url || '#')).replace(/&amp;/g, '&');
    rec.a.classList.toggle('primary', o.type === 'primary');
    rec.a.classList.toggle('tertiary', o.type === 'tertiary');
    rec.a.classList.toggle('full', !!o.use_container_width || o.width === 'stretch');
    rec.a.title = o.help || '';
    rec.el.classList.toggle('slak-disabled', !!o.disabled);
  };

  const SEL_MODES = ['single-row', 'multi-row', 'single-row-required', 'single-column', 'multi-column', 'single-cell', 'multi-cell'];
  function dfDownload(r) {
    const a = h('a', { href: URL.createObjectURL(new Blob([toCSV(r.t.rows)], { type: 'text/csv' })), download: (r.o.file_name || 'data') + '.csv' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function dfSelect(r, kind, val, additive) {
    const modes = r.modes;
    const cur = (r.shown && r.shown.selection) || { rows: [], columns: [], cells: [] };
    const sel = { rows: (cur.rows || []).slice(), columns: (cur.columns || []).slice(), cells: (cur.cells || []).map(x => x.slice()) };
    const toggle = (arr, v, single, eq) => {
      const k = arr.findIndex(x => eq ? eq(x, v) : x === v);
      if (k >= 0) { if (!(single === 'required' && arr.length === 1)) arr.splice(k, 1); return arr; }
      return single ? [v] : arr.concat([v]);
    };
    if (kind === 'row') sel.rows = toggle(sel.rows, val, modes.has('single-row-required') ? 'required' : modes.has('single-row'));
    else if (kind === 'col') sel.columns = toggle(sel.columns, val, modes.has('single-column') && !modes.has('multi-column'));
    else if (kind === 'cell') sel.cells = toggle(sel.cells, val, modes.has('single-cell') && !modes.has('multi-cell'), (a, b) => a[0] === b[0] && a[1] === b[1]);
    sel.rows.sort((a, b) => a - b);
    commit(r, { selection: sel });
    renderDF(r);
  }
  EL.dataframe = (ctx, data, o) => {
    o = o || {};
    const app = ctx.app;
    const rec = place(ctx, 'dataframe', o.key != null ? 'key:' + o.key : '', r => {
      r.interactive = true;
      r.box = h('div', { class: 'slak-df-box', tabindex: '0', role: 'region', 'aria-label': 'Tabel data' });
      r.note = h('span', { class: 'slak-df-note' });
      r.search = h('input', { type: 'search', class: 'slak-df-search', placeholder: 'Cari…', 'aria-label': 'Cari di tabel', hidden: true });
      r.sbtn = h('button', { class: 'slak-df-dl', type: 'button', text: '⌕ Cari', title: 'Cari di tabel' });
      r.dl = h('button', { class: 'slak-df-dl', type: 'button', text: '⤓ CSV', title: 'Unduh sebagai CSV', onclick: () => dfDownload(r) });
      r.el = h('div', { class: 'slak-el slak-df' }, r.box, h('div', { class: 'slak-df-foot' }, r.note, h('span', { class: 'slak-df-tools' }, r.search, r.sbtn, r.dl)));
      r.sbtn.addEventListener('click', () => { r.search.hidden = !r.search.hidden; if (!r.search.hidden) r.search.focus(); else if (r.query) { r.query = ''; r.search.value = ''; renderDF(r); } });
      r.search.addEventListener('input', () => { r.query = r.search.value.trim(); renderDF(r); });
      r.search.addEventListener('keydown', e => { if (e.key === 'Escape') { r.search.value = ''; r.query = ''; r.search.hidden = true; renderDF(r); } });
      r.box.addEventListener('click', e => {
        const btn = e.target.closest('button[data-btn]');
        if (btn) {
          const tr = btn.closest('tr[data-i]'), td = btn.closest('td[data-c]');
          if (tr && td && r.bound) trigger(r, { row: +tr.dataset.i, column: r.cols[+td.dataset.c] });
          return;
        }
        const cb = e.target.closest('input[data-row]');
        if (cb) { e.preventDefault(); if (r.bound) dfSelect(r, 'row', +cb.dataset.row); return; }
        const th = e.target.closest('th[data-c]');
        if (th) {
          const col = r.cols[+th.dataset.c];
          if (r.bound && (r.modes.has('single-column') || r.modes.has('multi-column'))) { dfSelect(r, 'col', col); return; }
          if (!r.sort || r.sort.col !== col) r.sort = { col, dir: 1 };
          else if (r.sort.dir === 1) r.sort.dir = -1;
          else r.sort = null;
          renderDF(r);
          return;
        }
        const td = e.target.closest('td[data-c]');
        if (td && r.bound && (r.modes.has('single-cell') || r.modes.has('multi-cell'))) {
          const tr = td.closest('tr[data-i]');
          dfSelect(r, 'cell', [+tr.dataset.i, r.cols[+td.dataset.c]]);
        } else if (td && r.bound && (r.modes.has('single-row') || r.modes.has('multi-row') || r.modes.has('single-row-required')) && e.target.closest('td.idx')) {
          dfSelect(r, 'row', +td.closest('tr[data-i]').dataset.i);
        }
      });
    });
    rec.t = toTable(data);
    rec.o = o;
    const sel = o.on_select != null && o.on_select !== 'ignore';
    const btnCols = Object.values(o.column_config || {}).some(x => x && x.type === 'button');
    rec.modes = new Set(sel ? [].concat(o.selection_mode || 'multi-row').filter(m => SEL_MODES.includes(m)) : []);
    rec.bound = sel || btnCols;
    if (rec.bound) {
      const d = o.selection_default ? (o.selection_default.selection || o.selection_default) : {};
      let def = { selection: { rows: (d.rows || []).slice(), columns: (d.columns || []).slice(), cells: [] } };
      if (rec.modes.has('single-row-required') && !def.selection.rows.length && rec.t.rows.length) def.selection.rows = [0];
      bindWidget(rec, ctx, Object.assign({}, o, { on_change: typeof o.on_select === 'function' ? o.on_select : null }), def);
      if (rec.modes.has('single-row-required') && rec.value && !(rec.value.selection.rows || []).length && rec.t.rows.length) fixValue(rec, { selection: Object.assign({}, rec.value.selection, { rows: [0] }) });
      const valid = (rec.value.selection.rows || []).filter(i => i < rec.t.rows.length);
      if (valid.length !== (rec.value.selection.rows || []).length) fixValue(rec, { selection: Object.assign({}, rec.value.selection, { rows: valid }) });
    } else rec.shown = null;
    const h0 = o.height;
    rec.box.style.maxHeight = h0 === 'content' || h0 === 'stretch' ? 'none' : (isNum(h0) ? h0 : 400) + 'px';
    setWidth(rec.el, o.width === 'stretch' ? null : o.width);
    const noExport = app.getOption('client.disableDataExport');
    rec.dl.hidden = !!noExport || o.download === false;
    rec.sbtn.hidden = o.search === false;
    renderDF(rec);
    if (!rec.bound) return;
    const out = { selection: JSON.parse(JSON.stringify(rec.value.selection)) };
    const hit = app.active.get(rec.wid);
    if (hit && typeof hit === 'object' && 'row' in hit) out.clicked = hit;
    return out;
  };

  EL.table = (ctx, data, o) => {
    o = o || {};
    const rec = place(ctx, 'table', '', r => {
      r.interactive = false;
      r.box = h('div', { class: 'slak-df-box', tabindex: '0', role: 'region', 'aria-label': 'Tabel data' });
      r.el = h('div', { class: 'slak-el slak-df slak-static' }, r.box);
    });
    rec.t = toTable(data);
    rec.o = o;
    rec.el.classList.toggle('slak-bordered-none', o.border === false);
    renderDF(rec);
  };

  /* ---------- Format angka untuk grafik dan tabel (Slak 1.2) ---------- */

  const FMT_CACHE = new Map();
  function makeFmt(f) {
    if (typeof f !== 'string') return makeFmt0(f);
    const k = (LOCALE || '') + '|' + f;
    let r = FMT_CACHE.get(k);
    if (!r) { r = makeFmt0(f); if (FMT_CACHE.size > 500) FMT_CACHE.clear(); FMT_CACHE.set(k, r); }
    return r;
  }
  function makeFmt0(f) {
    if (typeof f === 'function') return v => (v == null || (typeof v === 'number' && isNaN(v))) ? '—' : String(f(v));
    if (f == null || f === '') return v => isNum(v) ? fmtNum(v) : fmtCat(v);
    const s = String(f);
    const dec = m => m ? +m : null;
    if (/%[-+ 0,#']*\d*(?:\.\d+)?[dfieEgGsx]/.test(s)) return v => isNum(v) ? printf(s, v) : fmtCat(v);
    const pf = presetFmt(s);
    if (pf) return v => isNum(v) ? pf(v) : fmtCat(v);
    let m;
    if (/^(rp|rupiah|idr)$/i.test(s)) return v => isNum(v) ? 'Rp ' + nf({ maximumFractionDigits: 0 }, LOCALE || 'id-ID').format(v) : fmtCat(v);
    if ((m = s.match(/^(?:percent|persen|%)(?::(\d))?$/i))) return v => isNum(v) ? nf({ minimumFractionDigits: dec(m[1]) ?? 1, maximumFractionDigits: dec(m[1]) ?? 1 }).format(v * 100) + '%' : fmtCat(v);
    if ((m = s.match(/^(?:decimal|desimal|d)(?::(\d))?$/i))) return v => isNum(v) ? nf({ minimumFractionDigits: dec(m[1]) ?? 2, maximumFractionDigits: dec(m[1]) ?? 2 }).format(v) : fmtCat(v);
    if (/^(compact|ringkas)$/i.test(s)) return v => isNum(v) ? fmtTick(v) : fmtCat(v);
    if (/^(int|bulat)$/i.test(s)) return v => isNum(v) ? nf(null).format(Math.round(v)) : fmtCat(v);
    if ((m = s.match(/^(.*?)\{(?::?,?\.?(\d)?f?)?\}(.*)$/))) {
      const d = m[2] != null ? +m[2] : null;
      return v => isNum(v) ? m[1] + nf(d != null ? { minimumFractionDigits: d, maximumFractionDigits: d } : { maximumFractionDigits: 4 }).format(v) + m[3] : fmtCat(v);
    }
    return v => isNum(v) ? fmtNum(v) : fmtCat(v);
  }

  function dateFmt(ms) {
    const ds = ms.map(t => new Date(t));
    const allMonth = ds.every(d => d.getDate() === 1 && !d.getHours() && !d.getMinutes());
    const allYear = allMonth && ds.every(d => d.getMonth() === 0);
    const hasTime = ds.some(d => d.getHours() || d.getMinutes());
    if (allYear) return t => String(new Date(t).getFullYear());
    if (allMonth) return t => new Date(t).toLocaleDateString(LOCALE, { month: 'short', year: 'numeric' });
    if (hasTime) return t => new Date(t).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return t => new Date(t).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: '2-digit' });
  }

  /* ---------- Warna ---------- */

  function cssVar(el, name, fallback) {
    try { const v = getComputedStyle(el).getPropertyValue(name).trim(); return v || fallback; } catch (e) { return fallback; }
  }
  function hexRgb(c) {
    c = String(c).trim();
    let m = c.match(/^#([0-9a-f]{3})$/i);
    if (m) return m[1].split('').map(x => parseInt(x + x, 16));
    m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = c.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    return [128, 128, 128];
  }
  function mixRgb(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
  const rgbStr = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  function seriesColors(o, n) {
    const list = o.color && typeof o.color !== 'function' ? [].concat(o.color) : null;
    return Array.from({ length: n }, (_, i) => (list && list[i % list.length]) || `var(--slak-c${i % 8 + 1})`);
  }

  /* ---------- Wadah grafik: judul, legenda, tooltip, unduh ---------- */

  function chartBox(ctx, type, ident, draw) {
    const rec = place(ctx, type, ident || '', r => {
      r.title = h('div', { class: 'slak-chart-title' });
      r.legend = h('div', { class: 'slak-legend' });
      r.plot = h('div', { class: 'slak-plot' });
      r.tip = h('div', { class: 'slak-tip' });
      const btn = (t, k) => h('button', { type: 'button', text: t, title: 'Unduh grafik sebagai ' + t, onclick: () => exportChart(r, k) });
      r.tools = h('div', { class: 'slak-chart-tools' }, btn('PNG', 'png'), btn('SVG', 'svg'));
      r.el = h('div', { class: 'slak-el slak-chart', 'data-kind': type }, r.tools, r.title, r.legend, r.plot, r.tip);
      const redraw = () => { try { r.draw(r); } catch (e) { console.error(e); } };
      r.el.addEventListener('slak-theme', redraw);
      if (typeof ResizeObserver !== 'undefined') {
        r.ro = new ResizeObserver(() => { if (r.plot.clientWidth && r.plot.clientWidth !== r.lastW) redraw(); });
        r.ro.observe(r.plot);
        r.dispose = () => r.ro.disconnect();
      }
    });
    rec.draw = draw;
    return rec;
  }
  function bindChartSel(rec, ctx, o) {
    rec.selectable = o.on_select != null && o.on_select !== 'ignore';
    if (rec.selectable) bindWidget(rec, ctx, Object.assign({}, o, { on_change: typeof o.on_select === 'function' ? o.on_select : null, width: undefined }), { selection: { points: [], rows: [] } });
  }
  function chartPick(rec, i, s, ev) {
    if (!rec.selectable) return;
    const rows = rec.spec.t.rows;
    const cur = (rec.shown && rec.shown.selection) || { points: [], rows: [] };
    const multi = ev && (ev.shiftKey || ev.ctrlKey || ev.metaKey);
    let idx = cur.rows.slice();
    const k = idx.indexOf(i);
    if (k >= 0) idx.splice(k, 1); else idx = multi ? idx.concat([i]) : [i];
    idx.sort((a, b) => a - b);
    const sp = rec.spec;
    const pts = idx.map(j => {
      const r = rows[j], p = { row: j };
      if (sp.x != null) p.x = r[sp.x];
      if (s) { p.series = s.name; p.y = r[s.name]; } else sp.ys.forEach(y => { p[y] = r[y]; });
      return p;
    });
    commit(rec, { selection: { points: pts, rows: idx } });
    rec.draw(rec);
  }
  function paintSel(rec, svg) {
    if (!rec.selectable) return;
    const sel = new Set(((rec.shown && rec.shown.selection) || {}).rows || []);
    svg.classList.add('selectable');
    svg.classList.toggle('has-sel', sel.size > 0);
    svg.querySelectorAll('[data-i]').forEach(e => e.classList.toggle('on', sel.has(+e.dataset.i)));
    if (rec.bulkPts && rec.bulkPts.length) {   // sebar berjumlah besar: titik terpilih digambar ulang di atas path
      svg.querySelectorAll('circle.pt.on.extra').forEach(e => e.remove());
      const host = svg.tagName === 'svg' ? svg : svg.querySelector('svg');
      if (host && sel.size) {
        let add = '';
        for (const p of rec.bulkPts) if (sel.has(p.i)) add += `<circle class="pt on extra" style="--sc:${p.c}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r + 1}"/>`;
        host.insertAdjacentHTML('beforeend', add);
      }
    }
  }
  function finishBox(rec, o) {
    setWidth(rec.el, o.width === 'stretch' || o.width === 'content' ? null : o.width);
    rec.title.textContent = o.title || '';
    rec.title.style.display = o.title ? '' : 'none';
    rec.tools.style.display = o.download === false ? 'none' : '';
    rec.draw(rec);
  }
  function setLegend(rec, items) {
    rec.legendItems = items;
    rec.legend.innerHTML = items.map(s => `<span><i style="background:${s.color}${s.dash ? ';height:2px;border-radius:0' : ''}"></i>${esc(s.name)}</span>`).join('');
  }
  function emptyChart(rec, msg) {
    rec.plot.innerHTML = `<div class="slak-chart-empty">${esc(msg || 'Tidak ada data numerik untuk digambar.')}</div>`;
    setLegend(rec, []);
  }
  function tipShow(rec, e, html) {
    const tip = rec.tip;
    tip.innerHTML = html;
    tip.style.display = 'block';
    const wr = rec.el.getBoundingClientRect();
    let left = e.clientX - wr.left + 14;
    if (left + tip.offsetWidth > wr.width) left = e.clientX - wr.left - tip.offsetWidth - 14;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(0, e.clientY - wr.top - tip.offsetHeight - 10) + 'px';
  }
  const tipRow = (color, name, val) => `<div>${color ? `<i style="background:${color}"></i>` : ''}${esc(name)} <b>${esc(val)}</b></div>`;

  function downloadBlob(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function exportChart(rec, kind) {
    const src = rec.plot.querySelector('svg');
    if (!src) return;
    const W = +src.getAttribute('width'), H0 = +src.getAttribute('height');
    const clone = src.cloneNode(true);
    const a = [src, ...src.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
    const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'font-size', 'font-family', 'font-weight', 'display', 'stroke-linecap', 'stroke-linejoin'];
    a.forEach((el, i) => {
      const cs = getComputedStyle(el);
      b[i].setAttribute('style', props.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';'));
    });
    clone.querySelectorAll('.hit,.slak-guide').forEach(x => x.remove());
    const fg = cssVar(rec.el, '--fg', '#222'), bg = cssVar(rec.el, '--panel', '#fff'), muted = cssVar(rec.el, '--muted', '#666');
    const font = getComputedStyle(rec.el).fontFamily;
    const title = rec.title.style.display === 'none' ? '' : rec.title.textContent;
    const items = rec.legendItems || [];
    let head = 0, extra = '';
    if (title) { extra += `<text x="12" y="22" style="font:600 15px ${esc(font)};fill:${fg}">${esc(title)}</text>`; head = 32; }
    if (items.length) {
      let x = 12;
      const y = head + 16;
      for (const it of items) {
        const c = it.color.startsWith('var(') ? cssVar(rec.el, it.color.slice(4, -1), '#888') : it.color;
        extra += `<rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${c}"/><text x="${x + 15}" y="${y}" style="font:12px ${esc(font)};fill:${muted}">${esc(it.name)}</text>`;
        x += 30 + it.name.length * 7;
      }
      head += 26;
    }
    const H = H0 + head + 12;
    const inner = new XMLSerializer().serializeToString(clone).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 24}" height="${H}" viewBox="0 0 ${W + 24} ${H}"><rect width="100%" height="100%" fill="${bg}"/>${extra}<g transform="translate(12 ${head + 4})">${inner}</g></svg>`;
    const name = (rec.fileName || title || 'grafik').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
    if (kind === 'svg') { downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), name + '.svg'); return; }
    const img = new Image();
    img.onload = () => {
      const sc = 2, cv = document.createElement('canvas');
      cv.width = (W + 24) * sc; cv.height = H * sc;
      const g = cv.getContext('2d');
      g.scale(sc, sc); g.drawImage(img, 0, 0);
      cv.toBlob(bl => bl && downloadBlob(bl, name + '.png'), 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---------- Garis, area, batang, sebar, kombinasi ---------- */

  function chartSpec(kind, data, o) {
    let t = toTable(data);
    const x = o.x != null ? o.x : null;
    let ys = o.y != null ? [].concat(o.y) : null;
    const numCols = tt => tt.cols.filter(c => c !== x && c !== o.by && tt.rows.some(r => isNum(r[c])) && tt.rows.every(r => r[c] == null || isNum(r[c])));
    if (o.by != null) {
      if (x == null) throw new Error('Opsi `by` butuh opsi `x`, misalnya { x: "bulan", y: "omzet", by: "kota" }.');
      const yv = ys ? ys[0] : numCols(t)[0];
      const groups = [], gs = new Set();
      for (const r of t.rows) { const k = fmtCat(r[o.by]); if (!gs.has(k)) { gs.add(k); groups.push(k); } }
      if (kind === 'scatter') {
        t = { rows: t.rows.map(r => ({ [x]: r[x], [fmtCat(r[o.by])]: r[yv] })), cols: [x, ...groups] };
      } else {
        const map = new Map();
        for (const r of t.rows) {
          const xv = r[x], key = xv instanceof Date ? 'd' + xv.getTime() : typeof xv + ':' + xv;
          let row = map.get(key);
          if (!row) { row = { [x]: xv }; map.set(key, row); }
          const g = fmtCat(r[o.by]);
          if (isNum(r[yv])) row[g] = (row[g] || 0) + r[yv];
        }
        t = { rows: [...map.values()], cols: [x, ...groups] };
      }
      ys = groups;
    }
    if (!ys) ys = numCols(t);
    if (o.line) for (const c of [].concat(o.line)) if (!ys.includes(c)) ys.push(c);
    if (o.sort && kind === 'bar' && ys.length) {
      const k = ys[0], dir = o.sort === 'asc' ? 1 : -1;
      const v = r => isNum(r[k]) ? r[k] : -Infinity;
      t = { rows: t.rows.slice().sort((a, b) => (v(a) - v(b)) * dir), cols: t.cols };
    }
    return { kind, t, x, ys, opts: o };
  }

  function linFit(px, py) {
    const n = px.length;
    if (n < 2) return null;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += px[i]; sy += py[i]; }
    const mx = sx / n, my = sy / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = px[i] - mx, dy = py[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    if (!sxx) return null;
    const b = sxy / sxx, a = my - b * mx;
    return { a, b, r2: syy ? (sxy * sxy) / (sxx * syy) : 1 };
  }

  function drawChart(rec) {
    const sp = rec.spec, o = sp.opts, box = rec.plot, kind = sp.kind;
    const W = Math.max(240, Math.floor(box.clientWidth || 600));
    rec.lastW = box.clientWidth;
    const rows = sp.t.rows, n = rows.length;
    if (!n || !sp.ys.length) { emptyChart(rec); return; }
    if (kind === 'bar' && o.horizontal) { drawBarH(rec, W); return; }
    const H = o.height || 300;
    const fmtV = makeFmt(o.format);
    let xs = sp.x != null ? rows.map(r => r[sp.x]) : rows.map((_, i) => i);
    const xDate = kind !== 'bar' && xs.every(v => v instanceof Date && !isNaN(v));
    if (xDate) xs = xs.map(v => v.getTime());
    const xNum = kind !== 'bar' && xs.every(isNum);
    const fmtX = xDate ? dateFmt(xs) : null;
    const lineSet = new Set(kind === 'bar' && o.line ? [].concat(o.line) : []);
    const y2Set = new Set(o.y2 === true ? [...lineSet] : o.y2 ? [].concat(o.y2) : []);
    const stackMode = (kind === 'bar' || kind === 'area') ? (o.stack === true ? 'stack' : (o.stack === 'normalize' || o.stack === 'center' || o.stack === 'layered' ? o.stack : null)) : null;
    const stack = !!stackMode && stackMode !== 'layered';
    const layered = stackMode === 'layered';
    const colorFn = typeof o.color === 'function' ? o.color : null;
    const cols = seriesColors(o, sp.ys.length);
    const S = sp.ys.map((k, si) => ({
      name: k, color: cols[si],
      vals: rows.map(r => isNum(r[k]) ? r[k] : null),
      as: lineSet.has(k) ? 'line' : kind,
      axis: y2Set.has(k) ? 2 : 1
    }));
    const stackers = S.filter(s => stack && s.as === kind);
    if (stackMode === 'normalize') {
      for (let i = 0; i < n; i++) {
        const tot = stackers.reduce((a, s) => a + Math.abs(s.vals[i] || 0), 0) || 1;
        stackers.forEach(s => { if (s.vals[i] != null) s.vals[i] = s.vals[i] / tot; });
      }
    }
    {
      const pos = Array(n).fill(0), neg = Array(n).fill(0);
      for (const s of S) {
        if (stackers.includes(s)) {
          s.base = []; s.top = [];
          s.vals.forEach((v, i) => {
            v = v || 0;
            const b = v >= 0 ? pos[i] : neg[i];
            s.base[i] = b; s.top[i] = b + v;
            if (v >= 0) pos[i] += v; else neg[i] += v;
          });
        } else { s.base = s.vals.map(() => 0); s.top = s.vals; }
      }
      if (stackMode === 'center') for (let i = 0; i < n; i++) { const off = -(pos[i] + neg[i]) / 2; stackers.forEach(s => { s.base[i] += off; s.top[i] += off; }); }
    }
    const range = ax => {
      let lo = Infinity, hi = -Infinity, zero = false;
      for (const s of S) {
        if (s.axis !== ax) continue;
        if (s.as === 'bar' || s.as === 'area') zero = true;
        const useBase = s.as === 'bar' || s.as === 'area' || (s.as !== 'scatter' && o.zero !== false);
        s.top.forEach((v, i) => { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); if (useBase) { lo = Math.min(lo, s.base[i]); hi = Math.max(hi, s.base[i]); } } });
      }
      if (!isFinite(lo)) return null;
      if (zero || o.zero === true) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      if (o.y_min != null && ax === 1) lo = o.y_min;
      if (o.y_max != null && ax === 1) hi = o.y_max;
      return niceTicks(lo, hi, Math.max(3, Math.round(H / 60)));
    };
    const yt = range(1) || niceTicks(0, 1, 4), yt2 = range(2);
    const tickF = stackMode === 'normalize' ? (v => Math.round(v * 100) + '%') : fmtTick;
    const ylab = yt.ticks.map(tickF), ylab2 = yt2 ? yt2.ticks.map(fmtTick) : [];
    const ml = 12 + maxOf(ylab.map(s => s.length)) * 6.6 + (o.y_label ? 18 : 0);
    const mr = yt2 ? 16 + maxOf(ylab2.map(s => s.length)) * 6.6 : 14;
    const mt = o.labels ? 22 : 12, mb = 28 + (o.x_label ? 18 : 0);
    const pw = Math.max(40, W - ml - mr), ph = Math.max(40, H - mt - mb);
    const mkY = t => v => mt + ph - (v - t.lo) / (t.hi - t.lo) * ph;
    const Y1 = mkY(yt), Y2 = yt2 ? mkY(yt2) : Y1;
    const Yof = s => s.axis === 2 ? Y2 : Y1;

    let xp, band = 0, xticks = [], X = null, xmin = 0, xmax = 0;
    if (xNum) {
      xmin = minOf(xs); xmax = maxOf(xs);
      X = xmax === xmin ? () => ml + pw / 2 : v => ml + (v - xmin) / (xmax - xmin) * pw;
      xp = i => X(xs[i]);
      if (xDate) {
        const sorted = [...new Set(xs)].sort((a, b) => a - b);
        const want = Math.max(2, Math.round(pw / 110));
        const step = Math.max(1, Math.ceil(sorted.length / want));
        xticks = sorted.filter((_, i) => i % step === 0).map(v => ({ pos: X(v), label: fmtX(v) }));
      } else {
        // sumbu tahun (bilangan bulat 1800–2200): tampil "2010", bukan "2.01k"
        const yearX = xs.every(v => Number.isInteger(v) && v >= 1800 && v <= 2200);
        let tk = rangeTicks(xmin, xmax, Math.max(2, Math.round(pw / 90)));
        if (yearX) { tk = tk.filter(v => Number.isInteger(v)); if (tk.length < 2) tk = [xmin, xmax]; }
        xticks = tk.map(v => ({ pos: X(v), label: yearX ? String(v) : fmtTick(v) }));
      }
    } else {
      band = pw / n;
      xp = i => ml + band * (i + 0.5);
      const every = Math.max(1, Math.ceil(64 / band));
      const maxChars = Math.max(3, Math.floor(band * every / 6.5));
      const allDate = xs.every(v => v instanceof Date && !isNaN(v));
      const fx = allDate ? dateFmt(xs.map(v => v.getTime())) : null;
      xticks = xs.map((v, i) => {
        let s = fx ? fx(v.getTime()) : fmtCat(v);
        if (s.length > maxChars) s = s.slice(0, maxChars - 1) + '…';
        return { pos: xp(i), label: s };
      }).filter((_, i) => i % every === 0);
    }
    const order = [...Array(n).keys()];
    if (xNum) order.sort((a, b) => xs[a] - xs[b]);
    const xLabel = i => sp.x != null ? (xDate ? fmtX(xs[i]) : (Number.isInteger(xs[i]) && xs[i] >= 1800 && xs[i] <= 2200 ? String(xs[i]) : fmtCat(rows[i][sp.x]))) : (xNum ? fmtNum(xs[i]) : '#' + i);

    const f = v => v.toFixed(1);
    const bulk = S.filter(s => s.as === 'scatter').length * n > 3000, bulkPts = [];
    let bulkCv = null, bulkG = null;
    rec.bulkPts = bulkPts;
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(chartAlt(o, sp, n))}">`;
    yt.ticks.forEach((v, k) => {
      const y = Y1(v);
      svg += `<line class="g${v === 0 ? ' z' : ''}" x1="${f(ml)}" x2="${f(ml + pw)}" y1="${f(y)}" y2="${f(y)}"/>`;
      svg += `<text x="${f(ml - 8)}" y="${f(y + 4)}" text-anchor="end">${esc(ylab[k])}</text>`;
    });
    if (yt2) yt2.ticks.forEach((v, k) => { svg += `<text x="${f(ml + pw + 8)}" y="${f(Y2(v) + 4)}" text-anchor="start">${esc(ylab2[k])}</text>`; });
    for (const t of xticks) svg += `<text x="${f(t.pos)}" y="${f(mt + ph + 18)}" text-anchor="middle">${esc(t.label)}</text>`;
    if (o.x_label) svg += `<text class="al" x="${f(ml + pw / 2)}" y="${f(H - 4)}" text-anchor="middle">${esc(o.x_label)}</text>`;
    if (o.y_label) svg += `<text class="al" transform="translate(12 ${f(mt + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(o.y_label)}</text>`;

    const bars = S.filter(s => s.as === 'bar');
    const legend = S.map(s => ({ name: s.name + (s.axis === 2 ? ' (kanan)' : ''), color: s.color }));
    const drawOrder = [...S.filter(s => s.as !== 'line'), ...S.filter(s => s.as === 'line')];
    let labels = '';
    for (const s of drawOrder) {
      const st = `style="--sc:${s.color}"`, Y = Yof(s);
      if (s.as === 'bar') {
        const inner = band * 0.78;
        const w = stack || layered ? inner : inner / bars.length, bi = bars.indexOf(s);
        for (let i = 0; i < n; i++) {
          if (s.vals[i] == null && !stack) continue;
          const x0 = xp(i) - inner / 2 + (stack || layered ? 0 : bi * w);
          const y1 = Y(s.top[i]), y0 = Y(s.base[i]);
          const pc = colorFn ? colorFn(rows[i], i, s.name) : null;
          svg += `<rect class="bar${layered ? ' layer' : ''}" data-i="${i}" style="--sc:${pc || s.color}" x="${f(x0 + 0.5)}" y="${f(Math.min(y0, y1))}" width="${f(Math.max(1, w - 1))}" height="${f(Math.abs(y0 - y1))}" rx="2"/>`;
          if (o.labels && s.vals[i] != null && (!stack || s === stackers[stackers.length - 1])) {
            const v = stack ? s.top[i] : s.vals[i];
            labels += `<text class="vl" x="${f(x0 + w / 2)}" y="${f(Math.min(y0, y1) - 5)}" text-anchor="middle">${esc(fmtV(v))}</text>`;
          }
        }
      } else if (s.as === 'scatter') {
        const rr = o.size || (bulk ? 2.5 : 4);
        if (bulk) {
          /* Titik sangat banyak: digambar di kanvas lalu disematkan sebagai satu <image> di SVG.
             Satu elemen, bukan ratusan ribu, dan ekspor SVG/PNG tetap jalan. */
          if (!bulkCv) {
            const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
            bulkCv = document.createElement('canvas'); bulkCv.width = Math.round(W * dpr); bulkCv.height = Math.round(H * dpr);
            bulkG = bulkCv.getContext('2d'); bulkG.scale(dpr, dpr); bulkG.globalAlpha = 0.7;
          }
          const g = bulkG, col = c => /^var\(/.test(c) ? cssVar(rec.el, c.slice(4, -1).split(',')[0].trim(), '#0f766e') : c;
          let last = null;
          for (let i = 0; i < n; i++) {
            if (s.vals[i] == null) continue;
            const pc = (colorFn ? colorFn(rows[i], i, s.name) : null) || s.color;
            const x = xp(i), y = Y(s.vals[i]);
            if (pc !== last) { g.fillStyle = col(pc); last = pc; }
            if (rr <= 2) g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
            else { g.beginPath(); g.arc(x, y, rr, 0, 6.2832); g.fill(); }
            bulkPts.push({ i, x, y, c: pc, r: rr });
          }
        } else for (let i = 0; i < n; i++) {
          if (s.vals[i] == null) continue;
          const pc = colorFn ? colorFn(rows[i], i, s.name) : null;
          svg += `<circle class="pt" data-i="${i}" style="--sc:${pc || s.color}" cx="${f(xp(i))}" cy="${f(Y(s.vals[i]))}" r="${rr}"/>`;
        }
      } else {
        const pts = order.filter(i => stackers.includes(s) || s.vals[i] != null);
        if (s.as === 'area' && pts.length) {
          let d = 'M' + pts.map(i => f(xp(i)) + ',' + f(Y(s.top[i]))).join('L');
          d += 'L' + pts.slice().reverse().map(i => f(xp(i)) + ',' + f(Y(s.base[i]))).join('L') + 'Z';
          svg += `<path class="area" ${st} d="${d}"/>`;
        }
        let d = '', pen = false;
        for (const i of order) {
          if (s.vals[i] == null && !stackers.includes(s)) { pen = false; continue; }
          d += (pen ? 'L' : 'M') + f(xp(i)) + ',' + f(Y(s.top[i]));
          pen = true;
        }
        svg += `<path class="ln" ${st} d="${d}"/>`;
        if (s.as === 'line' && (n <= 40 || rec.selectable)) for (const i of pts) svg += `<circle class="dot" data-i="${i}" ${st} cx="${f(xp(i))}" cy="${f(Y(s.top[i]))}" r="2.6"/>`;
        if (o.labels && s.as === 'line') for (const i of pts) labels += `<text class="vl" x="${f(xp(i))}" y="${f(Y(s.top[i]) - 8)}" text-anchor="middle">${esc(fmtV(s.vals[i]))}</text>`;
      }
      if (o.trendline && xNum && s.as !== 'bar') {
        const px = [], py = [];
        s.vals.forEach((v, i) => { if (v != null) { px.push(xs[i]); py.push(v); } });
        const fit = linFit(px, py);
        if (fit) {
          const lo = minOf(px), hi = maxOf(px);
          svg += `<line class="trend" style="--sc:${s.color}" x1="${f(X(lo))}" x2="${f(X(hi))}" y1="${f(Y(fit.a + fit.b * lo))}" y2="${f(Y(fit.a + fit.b * hi))}"/>`;
          legend.push({ name: `Tren ${S.length > 1 ? s.name + ' ' : ''}(R² ${fit.r2.toLocaleString(LOCALE, { maximumFractionDigits: 3 })})`, color: s.color, dash: true });
          s.fit = fit;
        }
      }
    }
    if (bulkCv) svg += `<image class="pt-img" x="0" y="0" width="${W}" height="${H}" href="${bulkCv.toDataURL('image/png')}"/>`;
    svg += labels;
    svg += `<line class="slak-guide" x1="0" x2="0" y1="${f(mt)}" y2="${f(mt + ph)}" style="display:none"/>`;
    svg += `<rect class="hit" x="${f(ml)}" y="${f(mt)}" width="${f(pw)}" height="${f(ph)}"/></svg>`;
    box.innerHTML = svg;
    setLegend(rec, S.length > 1 || legend.length > S.length || o.legend ? legend : []);

    const el = box.querySelector('svg'), guide = el.querySelector('.slak-guide');
    paintSel(rec, el);
    const hitAt = e => {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (kind === 'scatter') {
        let best = null, bd = 24 * 24;
        S.forEach(s => s.vals.forEach((v, i) => { if (v == null) return; const dx = xp(i) - mx, dy = Yof(s)(v) - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { i, s }; } }));
        return best;
      }
      if (mx < ml - 4 || mx > ml + pw + 4) return null;
      let i;
      if (xNum) { let bd = Infinity; for (let k = 0; k < n; k++) { const d = Math.abs(xp(k) - mx); if (d < bd) { bd = d; i = k; } } }
      else i = Math.min(n - 1, Math.max(0, Math.floor((mx - ml) / band)));
      return { i, s: null };
    };
    if (rec.selectable) el.addEventListener('click', e => { const hh = hitAt(e); if (hh) chartPick(rec, hh.i, hh.s, e); });
    const show = (i, e, only) => {
      const list = (only ? [only] : S).map(s => tipRow(s.color, s.name, s.vals[i] == null ? '—' : fmtV(s.vals[i]))).join('');
      tipShow(rec, e, `<div class="t">${esc(xLabel(i))}</div>` + list + (o.tooltip ? [].concat(o.tooltip).map(c => tipRow('', c, fmtCat(rows[i][c]))).join('') : ''));
    };
    const hide = () => { rec.tip.style.display = 'none'; guide.style.display = 'none'; };
    el.addEventListener('mouseleave', hide);
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (kind === 'scatter') {
        let best = null, bd = 24 * 24;
        S.forEach(s => s.vals.forEach((v, i) => {
          if (v == null) return;
          const dx = xp(i) - mx, dy = Yof(s)(v) - my, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = { i, s }; }
        }));
        if (best) show(best.i, e, best.s); else hide();
        return;
      }
      if (mx < ml - 4 || mx > ml + pw + 4) { hide(); return; }
      let i;
      if (xNum) {
        let bd = Infinity;
        for (let k = 0; k < n; k++) { const d = Math.abs(xp(k) - mx); if (d < bd) { bd = d; i = k; } }
      } else i = Math.min(n - 1, Math.max(0, Math.floor((mx - ml) / band)));
      guide.setAttribute('x1', f(xp(i))); guide.setAttribute('x2', f(xp(i)));
      guide.style.display = '';
      show(i, e);
    });
  }

  function drawBarH(rec, W) {
    const sp = rec.spec, o = sp.opts, box = rec.plot, rows = sp.t.rows, n = rows.length;
    const fmtV = makeFmt(o.format);
    const stack = !!o.stack && o.stack !== 'layered';
    const colorFn = typeof o.color === 'function' ? o.color : null;
    const cols = seriesColors(o, sp.ys.length);
    const S = sp.ys.map((k, si) => ({ name: k, color: cols[si], vals: rows.map(r => isNum(r[k]) ? r[k] : null) }));
    if (o.stack === 'normalize') for (let i = 0; i < n; i++) { const tot = S.reduce((a, s) => a + Math.abs(s.vals[i] || 0), 0) || 1; S.forEach(s => { if (s.vals[i] != null) s.vals[i] /= tot; }); }
    const cats = rows.map((r, i) => sp.x != null ? (r[sp.x] instanceof Date ? fmtCat(r[sp.x]) : fmtCat(r[sp.x])) : '#' + i);
    const pos = Array(n).fill(0), neg = Array(n).fill(0);
    for (const s of S) {
      s.base = []; s.top = [];
      s.vals.forEach((v, i) => {
        if (!stack) { s.base[i] = 0; s.top[i] = v; return; }
        v = v || 0;
        const b = v >= 0 ? pos[i] : neg[i];
        s.base[i] = b; s.top[i] = b + v;
        if (v >= 0) pos[i] += v; else neg[i] += v;
      });
    }
    let lo = 0, hi = 0;
    for (const s of S) s.top.forEach((v, i) => { if (v != null) { lo = Math.min(lo, v, s.base[i]); hi = Math.max(hi, v, s.base[i]); } });
    const per = stack ? 26 : Math.max(22, 8 + S.length * 14);
    const mt = 8, mb = 26 + (o.x_label ? 18 : 0);
    const H = o.height || Math.min(1400, mt + mb + n * per);
    const ph = H - mt - mb, band = ph / n;
    const maxLab = Math.min(Math.floor(W * 0.38 / 6.6), maxOf(cats.map(c => c.length)));
    const ml = 14 + maxLab * 6.6, mr = o.labels ? 14 + 9 * 6.6 : 18;
    const pw = Math.max(40, W - ml - mr);
    if (o.stack === 'center') for (let i = 0; i < n; i++) { const off = -(pos[i] + neg[i]) / 2; S.forEach(s => { s.base[i] += off; s.top[i] += off; }); lo = Math.min(lo, minOf(S.map(s => Math.min(s.base[i], s.top[i] == null ? 0 : s.top[i])))); hi = Math.max(hi, maxOf(S.map(s => Math.max(s.base[i], s.top[i] == null ? 0 : s.top[i])))); }
    const xt = niceTicks(lo, hi, Math.max(2, Math.round(pw / 90)));
    const X = v => ml + (v - xt.lo) / (xt.hi - xt.lo) * pw;
    const f = v => v.toFixed(1);
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.alt || o.title || ('Grafik batang mendatar, ' + n + ' kategori'))}">`;
    for (const v of xt.ticks) {
      svg += `<line class="g${v === 0 ? ' z' : ''}" x1="${f(X(v))}" x2="${f(X(v))}" y1="${mt}" y2="${f(mt + ph)}"/>`;
      svg += `<text x="${f(X(v))}" y="${f(mt + ph + 17)}" text-anchor="middle">${esc(fmtTick(v))}</text>`;
    }
    cats.forEach((c, i) => {
      const s = c.length > maxLab ? c.slice(0, maxLab - 1) + '…' : c;
      svg += `<text x="${f(ml - 8)}" y="${f(mt + band * (i + 0.5) + 4)}" text-anchor="end">${esc(s)}</text>`;
    });
    if (o.x_label) svg += `<text class="al" x="${f(ml + pw / 2)}" y="${f(H - 4)}" text-anchor="middle">${esc(o.x_label)}</text>`;
    const inner = band * 0.74;
    S.forEach((s, si) => {
      const hgt = stack ? inner : inner / S.length;
      for (let i = 0; i < n; i++) {
        if (s.vals[i] == null) continue;
        const y0 = mt + band * (i + 0.5) - inner / 2 + (stack ? 0 : si * hgt);
        const a = X(s.base[i]), b = X(s.top[i]);
        const pc = colorFn ? colorFn(rows[i], i, s.name) : null;
        svg += `<rect class="bar" data-i="${i}" style="--sc:${pc || s.color}" x="${f(Math.min(a, b))}" y="${f(y0 + 0.5)}" width="${f(Math.max(1, Math.abs(b - a)))}" height="${f(Math.max(1, hgt - 1))}" rx="2"/>`;
        if (o.labels && (!stack || si === S.length - 1)) {
          const v = stack ? s.top[i] : s.vals[i];
          svg += `<text class="vl" x="${f(Math.max(a, b) + 5)}" y="${f(y0 + hgt / 2 + 4)}" text-anchor="start">${esc(fmtV(v))}</text>`;
        }
      }
    });
    svg += `<rect class="hit" x="${f(ml)}" y="${mt}" width="${f(pw)}" height="${f(ph)}"/></svg>`;
    box.innerHTML = svg;
    setLegend(rec, S.length > 1 ? S.map(s => ({ name: s.name, color: s.color })) : []);
    const el = box.querySelector('svg');
    paintSel(rec, el);
    if (rec.selectable) el.addEventListener('click', e => { const r = el.getBoundingClientRect(); const i = Math.floor((e.clientY - r.top - mt) / band); if (i >= 0 && i < n) chartPick(rec, i, null, e); });
    el.addEventListener('mouseleave', () => { rec.tip.style.display = 'none'; });
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect(), my = e.clientY - r.top;
      const i = Math.floor((my - mt) / band);
      if (i < 0 || i >= n) { rec.tip.style.display = 'none'; return; }
      tipShow(rec, e, `<div class="t">${esc(cats[i])}</div>` + S.map(s => tipRow(s.color, s.name, s.vals[i] == null ? '—' : fmtV(s.vals[i]))).join(''));
    });
  }

  /** Teks pengganti grafik untuk pembaca layar (Slak 1.9): jenis, sumbu, dan jumlah titik. */
  function chartAlt(o, sp, n) {
    if (o.alt || o.title) return o.alt || o.title;
    const yv = sp && sp.y != null ? sp.y : o.y, xv = sp && sp.x != null ? sp.x : o.x;
    const ys = yv != null ? [].concat(yv).map(v => typeof v === 'object' && v ? (v.name || v.col || '') : v).filter(Boolean).join(', ') : '';
    return 'Grafik' + (ys ? ' ' + ys : '') + (xv != null ? ' menurut ' + xv : '') + (n != null ? ', ' + n + ' titik' : '');
  }
  function chartEl(kind) {
    return (ctx, data, o) => {
      o = o || {};
      // seperti Streamlit: color berisi nama kolom berarti satu warna per kelompok (sama dengan by)
      if (o.by == null && typeof o.color === 'string' && !/^(#|var\(|rgb|hsl)/i.test(o.color)) {
        const t = toTable(data);
        if (t && t.cols && t.cols.includes(o.color)) o = Object.assign({}, o, { by: o.color, color: undefined });
      }
      const rec = chartBox(ctx, kind + '_chart', o.key, drawChart);
      bindChartSel(rec, ctx, o);
      rec.spec = chartSpec(kind, data, o);
      rec.fileName = o.file_name;
      finishBox(rec, o);
      return rec.selectable ? JSON.parse(JSON.stringify(rec.value)) : undefined;
    };
  }

  /* ---------- Kolom angka dari berbagai bentuk data ---------- */

  function numbersOf(data, col) {
    if (data == null) return { name: col || 'nilai', vals: [] };
    if (Array.isArray(data) && data.every(v => v == null || typeof v === 'number')) return { name: col || 'nilai', vals: data.filter(isNum) };
    if (data && typeof data.to_list === 'function' && data.values !== undefined && !data.columns) return { name: data.name || col || 'nilai', vals: data.to_list().filter(isNum) };
    const t = toTable(data);
    const c = col != null ? col : t.cols.find(k => t.rows.some(r => isNum(r[k])));
    if (c == null) return { name: 'nilai', vals: [] };
    return { name: c, vals: t.rows.map(r => r[c]).filter(isNum) };
  }

  function quantile(sorted, p) {
    if (!sorted.length) return NaN;
    const k = (sorted.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo);
  }

  /* ---------- Histogram ---------- */

  function histBins(vals, o) {
    const lo0 = o.range ? o.range[0] : minOf(vals), hi0 = o.range ? o.range[1] : maxOf(vals);
    if (Array.isArray(o.bins)) return o.bins.slice().sort((a, b) => a - b);
    let k = o.bins;
    if (!k) {
      const s = vals.slice().sort((a, b) => a - b);
      const iqr = quantile(s, 0.75) - quantile(s, 0.25);
      const fd = iqr > 0 ? Math.ceil((hi0 - lo0) / (2 * iqr / Math.cbrt(vals.length))) : 0;
      const sturges = Math.ceil(Math.log2(vals.length) + 1);
      k = Math.min(60, Math.max(5, fd ? Math.max(fd, sturges) : sturges));
    }
    if (hi0 === lo0) return [lo0 - 0.5, lo0 + 0.5];
    const st = (hi0 - lo0) / k;
    return Array.from({ length: k + 1 }, (_, i) => i === k ? hi0 : lo0 + st * i);
  }

  function drawHist(rec) {
    const o = rec.o, box = rec.plot, W = Math.max(240, Math.floor(box.clientWidth || 600));
    rec.lastW = box.clientWidth;
    const groups = rec.groups;
    const all = groups.flatMap(g => g.vals);
    if (!all.length) { emptyChart(rec); return; }
    const edges = histBins(all, o), nb = edges.length - 1;
    const cnt = groups.map(g => {
      const c = Array(nb).fill(0);
      for (const v of g.vals) {
        if (v < edges[0] || v > edges[nb]) continue;
        let i = 0, j = nb - 1;
        while (i < j) { const m = (i + j + 1) >> 1; if (v >= edges[m]) i = m; else j = m - 1; }
        c[i]++;
      }
      if (o.density) return c.map((x, i) => x / (g.vals.length * (edges[i + 1] - edges[i])));
      if (o.percent) return c.map(x => x / g.vals.length);
      return c;
    });
    rec.counts = cnt; rec.edges = edges;
    const H = o.height || 280, fmtV = o.percent ? makeFmt('percent') : v => fmtNum(+v.toPrecision(4));
    const ymax = Math.max(maxOf(cnt.flat()), 0);
    const yt = niceTicks(0, ymax || 1, Math.max(3, Math.round(H / 60)));
    const ylab = yt.ticks.map(v => o.percent ? Math.round(v * 100) + '%' : fmtTick(v));
    const ml = 12 + maxOf(ylab.map(s => s.length)) * 6.6 + 18, mr = 14, mt = 12, mb = 28 + 18;
    const pw = W - ml - mr, ph = H - mt - mb;
    const X = v => ml + (v - edges[0]) / (edges[nb] - edges[0]) * pw, Y = v => mt + ph - (v - yt.lo) / (yt.hi - yt.lo) * ph;
    const f = v => v.toFixed(1);
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'histogram')}">`;
    yt.ticks.forEach((v, k) => {
      svg += `<line class="g${v === 0 ? ' z' : ''}" x1="${f(ml)}" x2="${f(ml + pw)}" y1="${f(Y(v))}" y2="${f(Y(v))}"/>`;
      svg += `<text x="${f(ml - 8)}" y="${f(Y(v) + 4)}" text-anchor="end">${esc(ylab[k])}</text>`;
    });
    for (const v of rangeTicks(edges[0], edges[nb], Math.max(2, Math.round(pw / 90)))) svg += `<text x="${f(X(v))}" y="${f(mt + ph + 18)}" text-anchor="middle">${esc(fmtTick(v))}</text>`;
    svg += `<text class="al" x="${f(ml + pw / 2)}" y="${f(H - 4)}" text-anchor="middle">${esc(o.x_label || rec.name)}</text>`;
    svg += `<text class="al" transform="translate(12 ${f(mt + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(o.y_label || (o.density ? 'Kepadatan' : o.percent ? 'Persentase' : 'Frekuensi'))}</text>`;
    const multi = groups.length > 1;
    groups.forEach((g, gi) => {
      cnt[gi].forEach((c, i) => {
        if (!c) return;
        const x0 = X(edges[i]), x1 = X(edges[i + 1]);
        svg += `<rect class="bar${multi ? ' ov' : ''}" style="--sc:${g.color}" x="${f(x0 + 0.5)}" y="${f(Y(c))}" width="${f(Math.max(1, x1 - x0 - 1))}" height="${f(Y(0) - Y(c))}"/>`;
      });
    });
    if (o.mean !== false && !multi) {
      const m = all.reduce((a, b) => a + b, 0) / all.length;
      svg += `<line class="mline" x1="${f(X(m))}" x2="${f(X(m))}" y1="${mt}" y2="${f(mt + ph)}"/><text class="vl" x="${f(X(m) + 4)}" y="${mt + 10}">rata-rata ${esc(fmtNum(+m.toPrecision(4)))}</text>`;
    }
    svg += `<rect class="hit" x="${f(ml)}" y="${mt}" width="${f(pw)}" height="${f(ph)}"/></svg>`;
    box.innerHTML = svg;
    setLegend(rec, multi ? groups.map(g => ({ name: g.name, color: g.color })) : []);
    const el = box.querySelector('svg');
    el.addEventListener('mouseleave', () => { rec.tip.style.display = 'none'; });
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect(), mx = e.clientX - r.left;
      const v = edges[0] + (mx - ml) / pw * (edges[nb] - edges[0]);
      let i = edges.findIndex((x, k) => k < nb && v >= x && v <= edges[k + 1]);
      if (i < 0) { rec.tip.style.display = 'none'; return; }
      const t = fmtNum(+edges[i].toPrecision(5)) + ' – ' + fmtNum(+edges[i + 1].toPrecision(5));
      tipShow(rec, e, `<div class="t">${esc(t)}</div>` + groups.map((g, gi) => tipRow(g.color, g.name, fmtV(cnt[gi][i]))).join(''));
    });
  }

  EL.histogram = (ctx, data, o) => {
    if (typeof o === 'string') o = { x: o };
    o = o || {};
    const rec = chartBox(ctx, 'histogram', o.key, drawHist);
    const cols = seriesColors(o, 12);
    if (o.by != null) {
      const t = toTable(data), c = o.x != null ? o.x : t.cols.find(k => k !== o.by && t.rows.some(r => isNum(r[k])));
      const m = new Map();
      for (const r of t.rows) { if (!isNum(r[c])) continue; const k = fmtCat(r[o.by]); if (!m.has(k)) m.set(k, []); m.get(k).push(r[c]); }
      rec.groups = [...m].map(([name, vals], i) => ({ name, vals, color: cols[i % cols.length] }));
      rec.name = c;
    } else {
      const s = numbersOf(data, o.x);
      rec.groups = [{ name: s.name, vals: s.vals, color: cols[0] }];
      rec.name = s.name;
    }
    rec.o = o; rec.fileName = o.file_name;
    finishBox(rec, o);
  };

  /* ---------- Box plot ---------- */

  function boxStats(vals) {
    const s = vals.slice().sort((a, b) => a - b);
    const q1 = quantile(s, 0.25), med = quantile(s, 0.5), q3 = quantile(s, 0.75), iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    const inside = s.filter(v => v >= lo && v <= hi);
    return { n: s.length, min: s[0], max: s[s.length - 1], q1, med, q3, mean: s.reduce((a, b) => a + b, 0) / (s.length || 1), wlo: inside.length ? inside[0] : q1, whi: inside.length ? inside[inside.length - 1] : q3, out: s.filter(v => v < lo || v > hi) };
  }

  function drawBox(rec) {
    const o = rec.o, box = rec.plot, W = Math.max(240, Math.floor(box.clientWidth || 600));
    rec.lastW = box.clientWidth;
    const G = rec.groups.filter(g => g.vals.length);
    if (!G.length) { emptyChart(rec); return; }
    G.forEach(g => { g.st = boxStats(g.vals); });
    const lo = minOf(G.map(g => g.st.min)), hi = maxOf(G.map(g => g.st.max));
    const H = o.height || 300, fmtV = makeFmt(o.format);
    const yt = niceTicks(lo, hi, Math.max(3, Math.round(H / 60)));
    const ylab = yt.ticks.map(fmtTick);
    const ml = 12 + maxOf(ylab.map(s => s.length)) * 6.6 + (o.y_label ? 18 : 0), mr = 14, mt = 12, mb = 28 + (o.x_label ? 18 : 0);
    const pw = W - ml - mr, ph = H - mt - mb, band = pw / G.length;
    const Y = v => mt + ph - (v - yt.lo) / (yt.hi - yt.lo) * ph, f = v => v.toFixed(1);
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'box plot')}">`;
    yt.ticks.forEach((v, k) => {
      svg += `<line class="g" x1="${f(ml)}" x2="${f(ml + pw)}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text x="${f(ml - 8)}" y="${f(Y(v) + 4)}" text-anchor="end">${esc(ylab[k])}</text>`;
    });
    if (o.x_label) svg += `<text class="al" x="${f(ml + pw / 2)}" y="${f(H - 4)}" text-anchor="middle">${esc(o.x_label)}</text>`;
    if (o.y_label) svg += `<text class="al" transform="translate(12 ${f(mt + ph / 2)}) rotate(-90)" text-anchor="middle">${esc(o.y_label)}</text>`;
    const maxChars = Math.max(3, Math.floor(band / 6.8));
    G.forEach((g, i) => {
      const cx = ml + band * (i + 0.5), w = Math.min(70, band * 0.5), st = g.st, sc = `style="--sc:${g.color}"`;
      const nm = g.name.length > maxChars ? g.name.slice(0, maxChars - 1) + '…' : g.name;
      svg += `<text x="${f(cx)}" y="${f(mt + ph + 18)}" text-anchor="middle">${esc(nm)}</text>`;
      svg += `<line class="wh" ${sc} x1="${f(cx)}" x2="${f(cx)}" y1="${f(Y(st.whi))}" y2="${f(Y(st.q3))}"/><line class="wh" ${sc} x1="${f(cx)}" x2="${f(cx)}" y1="${f(Y(st.q1))}" y2="${f(Y(st.wlo))}"/>`;
      svg += `<line class="wh" ${sc} x1="${f(cx - w / 4)}" x2="${f(cx + w / 4)}" y1="${f(Y(st.whi))}" y2="${f(Y(st.whi))}"/><line class="wh" ${sc} x1="${f(cx - w / 4)}" x2="${f(cx + w / 4)}" y1="${f(Y(st.wlo))}" y2="${f(Y(st.wlo))}"/>`;
      svg += `<rect class="bx" ${sc} x="${f(cx - w / 2)}" y="${f(Y(st.q3))}" width="${f(w)}" height="${f(Math.max(1, Y(st.q1) - Y(st.q3)))}" rx="3"/>`;
      svg += `<line class="md" ${sc} x1="${f(cx - w / 2)}" x2="${f(cx + w / 2)}" y1="${f(Y(st.med))}" y2="${f(Y(st.med))}"/>`;
      if (o.show_mean !== false) svg += `<path class="mn" ${sc} d="M${f(cx)},${f(Y(st.mean) - 4)}l4,4l-4,4l-4,-4z"/>`;
      for (const v of st.out) svg += `<circle class="ol" ${sc} cx="${f(cx + (((v * 9301 + 49297) % 233280) / 233280 - 0.5) * w * 0.3)}" cy="${f(Y(v))}" r="2.8"/>`;
    });
    svg += `<rect class="hit" x="${f(ml)}" y="${mt}" width="${f(pw)}" height="${f(ph)}"/></svg>`;
    box.innerHTML = svg;
    setLegend(rec, []);
    const el = box.querySelector('svg');
    el.addEventListener('mouseleave', () => { rec.tip.style.display = 'none'; });
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - ml) / band);
      const g = G[i];
      if (!g) { rec.tip.style.display = 'none'; return; }
      const s = g.st;
      tipShow(rec, e, `<div class="t">${esc(g.name)}</div>` + [['Maks', s.max], ['Q3', s.q3], ['Median', s.med], ['Rata-rata', s.mean], ['Q1', s.q1], ['Min', s.min]].map(([k, v]) => tipRow('', k, fmtV(+v.toPrecision(6)))).join('') + tipRow('', 'Pencilan', String(s.out.length)) + tipRow('', 'n', String(s.n)));
    });
  }

  EL.box_plot = (ctx, data, o) => {
    if (typeof o === 'string') o = { y: o };
    o = o || {};
    const rec = chartBox(ctx, 'box_plot', o.key, drawBox);
    const cols = seriesColors(o, 12);
    let groups;
    if (Array.isArray(data) && data.every(v => v == null || typeof v === 'number')) groups = [{ name: o.name || 'nilai', vals: data.filter(isNum) }];
    else if (data && typeof data.to_list === 'function' && !data.columns) groups = [{ name: data.name || 'nilai', vals: data.to_list().filter(isNum) }];
    else {
      const t = toTable(data);
      if (o.by != null) {
        const c = o.y != null ? o.y : t.cols.find(k => k !== o.by && t.rows.some(r => isNum(r[k])));
        const m = new Map();
        for (const r of t.rows) { if (!isNum(r[c])) continue; const k = fmtCat(r[o.by]); if (!m.has(k)) m.set(k, []); m.get(k).push(r[c]); }
        groups = [...m].map(([name, vals]) => ({ name, vals }));
        if (!o.y_label) o = Object.assign({}, o, { y_label: c });
      } else {
        const ys = o.y != null ? [].concat(o.y) : t.cols.filter(c => t.rows.some(r => isNum(r[c])) && t.rows.every(r => r[c] == null || isNum(r[c])));
        groups = ys.map(c => ({ name: c, vals: t.rows.map(r => r[c]).filter(isNum) }));
      }
    }
    groups.forEach((g, i) => { g.color = o.by != null || groups.length > 1 ? cols[i % cols.length] : cols[0]; });
    rec.groups = groups; rec.o = o; rec.fileName = o.file_name;
    finishBox(rec, o);
  };

  /* ---------- Pie / donut ---------- */

  function drawPie(rec) {
    const o = rec.o, box = rec.plot, W = Math.max(240, Math.floor(box.clientWidth || 600));
    rec.lastW = box.clientWidth;
    const items = rec.items.filter(it => it.v > 0);
    const total = items.reduce((a, b) => a + b.v, 0);
    if (!total) { emptyChart(rec, 'Tidak ada nilai positif untuk digambar.'); return; }
    const fmtV = makeFmt(o.format);
    const H = o.height || 300, R = Math.min(H / 2 - 12, W / 2 - 12), cx = W / 2, cy = H / 2;
    const hole = o.hole != null ? o.hole : o.donut ? 0.58 : 0;
    const f = v => v.toFixed(2);
    let a0 = -Math.PI / 2, svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'diagram lingkaran')}">`;
    let labels = '';
    items.forEach((it, i) => {
      const frac = it.v / total, a1 = a0 + frac * Math.PI * 2;
      it.frac = frac;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R);
      let d;
      if (frac >= 0.9999) d = hole ? `M${f(cx - R)},${f(cy)}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0M${f(cx - R * hole)},${f(cy)}a${R * hole},${R * hole} 0 1,1 ${2 * R * hole},0a${R * hole},${R * hole} 0 1,1 ${-2 * R * hole},0` : `M${f(cx - R)},${f(cy)}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0`;
      else if (hole) {
        const [x2, y2] = p(a1, R * hole), [x3, y3] = p(a0, R * hole);
        d = `M${f(x0)},${f(y0)}A${R},${R} 0 ${large},1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${R * hole},${R * hole} 0 ${large},0 ${f(x3)},${f(y3)}Z`;
      } else d = `M${f(cx)},${f(cy)}L${f(x0)},${f(y0)}A${R},${R} 0 ${large},1 ${f(x1)},${f(y1)}Z`;
      svg += `<path class="sl" data-i="${i}" style="--sc:${it.color}" d="${d}" fill-rule="evenodd"/>`;
      if (frac >= 0.05) {
        const [lx, ly] = p((a0 + a1) / 2, R * (hole ? (1 + hole) / 2 : 0.64));
        labels += `<text class="pl" x="${f(lx)}" y="${f(ly + 4)}" text-anchor="middle">${Math.round(frac * 100)}%</text>`;
      }
      a0 = a1;
    });
    svg += labels;
    if (hole && o.center !== false) svg += `<text class="pc" x="${f(cx)}" y="${f(cy - 2)}" text-anchor="middle">${esc(o.center_label ? String(o.center_label) : fmtV(total))}</text><text x="${f(cx)}" y="${f(cy + 16)}" text-anchor="middle">${esc(o.center_caption || 'total')}</text>`;
    svg += '</svg>';
    box.innerHTML = svg;
    setLegend(rec, items.map(it => ({ name: `${it.name} · ${(it.frac * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`, color: it.color })));
    const el = box.querySelector('svg');
    el.addEventListener('mouseleave', () => { rec.tip.style.display = 'none'; });
    el.addEventListener('mousemove', e => {
      const t = e.target.closest('.sl');
      if (!t) { rec.tip.style.display = 'none'; return; }
      const it = items[+t.dataset.i];
      tipShow(rec, e, `<div class="t">${esc(it.name)}</div>` + tipRow(it.color, 'Nilai', fmtV(it.v)) + tipRow('', 'Porsi', (it.frac * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 }) + '%'));
    });
  }

  EL.pie_chart = (ctx, data, o) => {
    o = o || {};
    const rec = chartBox(ctx, 'pie_chart', o.key, drawPie);
    let items;
    if (isPlainObj(data) && Object.values(data).every(v => isNum(v) || v == null)) items = Object.entries(data).map(([name, v]) => ({ name, v: +v || 0 }));
    else {
      const t = toTable(data);
      const names = o.names != null ? o.names : t.cols.find(c => t.rows.some(r => !isNum(r[c]) && r[c] != null)) || t.cols[0];
      const values = o.values != null ? o.values : t.cols.find(c => c !== names && t.rows.some(r => isNum(r[c])));
      const m = new Map();
      for (const r of t.rows) { const k = fmtCat(r[names]); m.set(k, (m.get(k) || 0) + (isNum(r[values]) ? r[values] : values == null ? 1 : 0)); }
      items = [...m].map(([name, v]) => ({ name, v }));
    }
    if (o.sort !== false) items.sort((a, b) => b.v - a.v);
    const max = o.max_slices || 8;
    if (items.length > max) {
      const rest = items.slice(max - 1).reduce((a, b) => a + b.v, 0);
      items = items.slice(0, max - 1).concat([{ name: o.other_label || 'Lainnya', v: rest }]);
    }
    const cols = seriesColors(o, items.length);
    items.forEach((it, i) => { it.color = cols[i]; });
    rec.items = items; rec.o = o; rec.fileName = o.file_name;
    finishBox(rec, o);
  };

  /* ---------- Heatmap ---------- */

  function drawHeat(rec) {
    const o = rec.o, box = rec.plot, W = Math.max(240, Math.floor(box.clientWidth || 600));
    rec.lastW = box.clientWidth;
    const { xs, ys, z } = rec;
    if (!xs.length || !ys.length) { emptyChart(rec); return; }
    const vals = z.flat().filter(isNum);
    if (!vals.length) { emptyChart(rec); return; }
    const fmtV = makeFmt(o.format != null ? o.format : vals.every(Number.isInteger) ? null : 'decimal:2');
    let lo = o.min != null ? o.min : minOf(vals), hi = o.max != null ? o.max : maxOf(vals);
    const div = o.scale === 'diverging' || o.scale === 'div' || (o.scale == null && lo < 0 && hi > 0);
    if (div && o.min == null && o.max == null) { const m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; }
    const panel = hexRgb(cssVar(rec.el, '--panel', '#ffffff'));
    const cHi = hexRgb(o.color_high || cssVar(rec.el, div ? '--slak-blue' : '--accent', '#0f766e'));
    const cLo = hexRgb(o.color_low || cssVar(rec.el, '--slak-red', '#dc2626'));
    const colorOf = v => {
      if (!isNum(v)) return null;
      if (div) {
        const mid = (lo + hi) / 2;
        return v >= mid ? mixRgb(panel, cHi, Math.min(1, (v - mid) / ((hi - mid) || 1))) : mixRgb(panel, cLo, Math.min(1, (mid - v) / ((mid - lo) || 1)));
      }
      return mixRgb(panel, cHi, 0.06 + 0.94 * Math.max(0, Math.min(1, (v - lo) / ((hi - lo) || 1))));
    };
    const maxY = Math.min(Math.floor(W * 0.3 / 6.6), maxOf(ys.map(s => s.length)));
    const ml = 12 + maxY * 6.6, mr = 12, mt = 8;
    const pw = W - ml - mr, cw = pw / xs.length;
    const rot = xs.some(s => s.length * 6.4 > cw - 4);
    const maxX = maxOf(xs.map(s => s.length));
    const mb = rot ? 14 + Math.min(16, maxX) * 5.2 : 26;
    const ch = o.cell_height || Math.max(18, Math.min(44, cw * 0.8));
    const H = o.height || mt + mb + ch * ys.length + 30;
    const ph = H - mt - mb - 30, chh = ph / ys.length;
    const f = v => v.toFixed(1);
    const annot = o.annot != null ? o.annot : xs.length * ys.length <= 225 && cw > 34;
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'heatmap')}">`;
    ys.forEach((yv, j) => {
      const s = yv.length > maxY ? yv.slice(0, maxY - 1) + '…' : yv;
      svg += `<text x="${f(ml - 7)}" y="${f(mt + chh * (j + 0.5) + 4)}" text-anchor="end">${esc(s)}</text>`;
      xs.forEach((xv, i) => {
        const v = z[j][i], c = colorOf(v);
        svg += `<rect class="hc" data-i="${i}" data-j="${j}" x="${f(ml + cw * i + 0.5)}" y="${f(mt + chh * j + 0.5)}" width="${f(Math.max(1, cw - 1))}" height="${f(Math.max(1, chh - 1))}" rx="2" style="fill:${c ? rgbStr(c) : 'transparent'}"/>`;
        if (annot && c) svg += `<text class="ha" x="${f(ml + cw * (i + 0.5))}" y="${f(mt + chh * (j + 0.5) + 4)}" text-anchor="middle" style="fill:${lum(c) > 0.55 ? '#1c1e21' : '#ffffff'}">${esc(fmtV(v))}</text>`;
      });
    });
    xs.forEach((xv, i) => {
      const x = ml + cw * (i + 0.5), y = mt + ph + 14;
      const s = xv.length > 16 ? xv.slice(0, 15) + '…' : xv;
      svg += rot ? `<text transform="translate(${f(x + 3)} ${f(y - 6)}) rotate(-40)" text-anchor="end">${esc(s)}</text>` : `<text x="${f(x)}" y="${f(y + 2)}" text-anchor="middle">${esc(s)}</text>`;
    });
    const gy = H - 18, gw = Math.min(240, pw * 0.6), gx = ml + pw - gw;
    const stops = Array.from({ length: 9 }, (_, k) => `<stop offset="${k / 8}" stop-color="${rgbStr(colorOf(lo + (hi - lo) * k / 8))}"/>`).join('');
    svg += `<defs><linearGradient id="hg${rec.uid || (rec.uid = Math.random().toString(36).slice(2, 8))}">${stops}</linearGradient></defs>`;
    svg += `<rect x="${f(gx)}" y="${f(gy - 9)}" width="${f(gw)}" height="8" rx="3" fill="url(#hg${rec.uid})"/>`;
    svg += `<text x="${f(gx - 6)}" y="${f(gy)}" text-anchor="end">${esc(fmtV(lo))}</text><text x="${f(gx + gw + 4)}" y="${f(gy)}" text-anchor="start">${esc(fmtV(hi))}</text>`;
    svg += '</svg>';
    box.innerHTML = svg;
    setLegend(rec, []);
    const el = box.querySelector('svg');
    el.addEventListener('mouseleave', () => { rec.tip.style.display = 'none'; });
    el.addEventListener('mousemove', e => {
      const t = e.target.closest('.hc');
      if (!t) { rec.tip.style.display = 'none'; return; }
      const i = +t.dataset.i, j = +t.dataset.j;
      tipShow(rec, e, `<div class="t">${esc(ys[j])} · ${esc(xs[i])}</div>` + tipRow('', o.value_label || 'Nilai', isNum(z[j][i]) ? fmtV(z[j][i]) : '—'));
    });
  }

  EL.heatmap = (ctx, data, o) => {
    o = o || {};
    const rec = chartBox(ctx, 'heatmap', o.key, drawHeat);
    let xs = [], ys = [], z = [];
    if (Array.isArray(data) && data.every(Array.isArray) && data.every(r => r.every(v => v == null || isNum(v)))) {
      z = data.map(r => r.slice());
      xs = (o.x_labels || z[0].map((_, i) => String(i))).map(String);
      ys = (o.y_labels || z.map((_, i) => String(i))).map(String);
    } else {
      const t = toTable(data);
      if (o.x != null && o.y != null) {
        const vcol = o.value != null ? o.value : null;
        const xi = new Map(), yi = new Map(), acc = new Map();
        for (const r of t.rows) {
          const xk = fmtCat(r[o.x]), yk = fmtCat(r[o.y]);
          if (!xi.has(xk)) xi.set(xk, xi.size);
          if (!yi.has(yk)) yi.set(yk, yi.size);
          const k = xk + '\u0000' + yk, v = vcol == null ? 1 : r[vcol];
          if (isNum(v)) acc.set(k, (acc.get(k) || 0) + v);
        }
        xs = [...xi.keys()]; ys = [...yi.keys()];
        z = ys.map(yk => xs.map(xk => { const v = acc.get(xk + '\u0000' + yk); return v == null ? null : v; }));
      } else {
        const idx = o.index != null ? o.index : t.cols.find(c => t.rows.some(r => r[c] != null && !isNum(r[c])));
        const vc = t.cols.filter(c => c !== idx && t.rows.some(r => isNum(r[c])));
        xs = vc.map(String);
        ys = t.rows.map((r, i) => idx != null ? fmtCat(r[idx]) : String(i));
        z = t.rows.map(r => vc.map(c => isNum(r[c]) ? r[c] : null));
      }
    }
    rec.xs = xs; rec.ys = ys; rec.z = z; rec.o = o; rec.fileName = o.file_name;
    finishBox(rec, o);
  };

  /* ---------- Kombinasi batang + garis ---------- */

  EL.combo_chart = (ctx, data, o) => {
    o = Object.assign({}, o || {});
    const bars = o.bar != null ? [].concat(o.bar) : null, lines = o.line != null ? [].concat(o.line) : [];
    const rec = chartBox(ctx, 'combo_chart', o.key, drawChart);
    o.y = (bars || []).concat(lines.filter(l => !(bars || []).includes(l)));
    if (!bars) delete o.y;
    o.line = lines;
    if (o.y2 == null) o.y2 = lines.length ? true : false;
    rec.spec = chartSpec('bar', data, o);
    rec.fileName = o.file_name;
    finishBox(rec, o);
  };

  EL.line_chart = chartEl('line');
  EL.area_chart = chartEl('area');
  EL.bar_chart = chartEl('bar');
  EL.scatter_chart = chartEl('scatter');

  /* ---------- Widget input ---------- */

  EL.button = (ctx, label, o) => {
    o = o || {};
    if (ctx.form) throw new Error('Gunakan form_submit_button() untuk tombol di dalam form.');
    const rec = place(ctx, 'button', ident(label, o), r => {
      r.b = h('button', { class: 'slak-btn', type: 'button', onclick: () => trigger(r) });
      r.el = h('div', { class: 'slak-el slak-btnwrap' }, r.b);
    });
    bindWidget(rec, ctx, o, false);
    const bh = iconHTML(o.icon) + `<span>${inline(esc(label))}</span>`;
    if (rec.bh !== bh) { rec.bh = bh; rec.b.innerHTML = bh; }
    rec.b.title = o.help || '';
    rec.b.classList.toggle('primary', o.type === 'primary');
    rec.b.classList.toggle('tertiary', o.type === 'tertiary');
    rec.b.classList.toggle('full', !!o.use_container_width || o.width === 'stretch');
    setDisabled(rec, [rec.b], o);
    return !!ctx.app.active.get(rec.wid);
  };

  function checkLike(type) {
    return (ctx, label, ...rest) => {
      const o = A(rest, ['value']);
      const rec = place(ctx, type, ident(label, o), r => {
        r.inp = h('input', { type: 'checkbox', role: type === 'toggle' ? 'switch' : null, onchange: () => commit(r, r.inp.checked) });
        r.txt = h('span');
        r.el = h('div', { class: 'slak-el slak-check' + (type === 'toggle' ? ' slak-toggle' : '') }, h('label', {}, r.inp, r.txt));
      });
      const v = bindWidget(rec, ctx, o, !!o.value);
      rec.txt.innerHTML = esc(label) + (o.help ? ` <span class="slak-help" title="${esc(o.help)}">?</span>` : '');
      rec.inp.checked = !!rec.shown;
      setDisabled(rec, [rec.inp], o);
      return !!v;
    };
  }
  EL.checkbox = checkLike('checkbox');
  EL.toggle = checkLike('toggle');

  EL.radio = (ctx, label, options, o) => {
    o = o || {};
    options = toOptions(options);
    const index = 'index' in o ? o.index : 0;
    const def = index == null || !options.length ? null : options[index];
    const rec = place(ctx, 'radio', ident(label, o), r => {
      fieldShell(r, 'slak-radio');
      r.box = h('div', { class: 'slak-radio-opts', role: 'radiogroup' });
      r.name = 'slak-r' + Math.random().toString(36).slice(2);
      r.box.addEventListener('change', e => { if (e.target.checked) commit(r, r.options[+e.target.value]); });
      r.el.append(r.box);
    });
    let v = bindWidget(rec, ctx, o, def);
    if (v != null && optIndex(options, v) < 0) v = fixValue(rec, def);
    rec.options = options;
    setLabel(rec, label, o);
    const ff = o.format_func || fmtOpt;
    const caps = o.captions ? [].concat(o.captions) : null;
    const sig = options.map(ff).join('\u0001') + '|' + (caps ? caps.join('\u0001') : '');
    if (rec.sig !== sig) {
      rec.sig = sig;
      rec.box.innerHTML = '';
      rec.inputs = options.map((opt, i) => {
        const inp = h('input', { type: 'radio', name: rec.name, value: String(i) });
        const txt = h('span', { class: 'slak-radio-t', html: inline(esc(ff(opt))) });
        if (caps && caps[i] != null && caps[i] !== '') txt.append(h('span', { class: 'slak-radio-cap', html: inline(esc(caps[i])) }));
        rec.box.append(h('label', {}, inp, txt));
        return inp;
      });
    }
    rec.box.classList.toggle('horizontal', !!o.horizontal);
    const si = rec.shown == null ? -1 : optIndex(options, rec.shown);
    rec.inputs.forEach((inp, i) => { inp.checked = i === si; inp.disabled = !!o.disabled; });
    return v;
  };

  EL.selectbox = (ctx, label, options, o) => {
    o = o || {};
    options = toOptions(options);
    const index = 'index' in o ? o.index : 0;
    const def = index == null || !options.length ? null : options[index];
    const rec = place(ctx, 'selectbox', ident(label, o), r => {
      fieldShell(r, 'slak-select');
      r.sel = h('select', { class: 'slak-input', onchange: () => commit(r, r.sel.value === '' ? null : r.options[+r.sel.value]) });
      r.el.append(r.sel);
    });
    let v = bindWidget(rec, ctx, o, def);
    if (v != null && optIndex(options, v) < 0 && !o.accept_new_options) v = fixValue(rec, def);
    rec.options = options;
    setLabel(rec, label, o);
    const ff = o.format_func || fmtOpt;
    if (o.accept_new_options) {
      if (!rec.free) {
        rec.free = h('input', { class: 'slak-input', type: 'text', autocomplete: 'off' });
        rec.dl = h('datalist', { id: 'slak-dl-' + Math.random().toString(36).slice(2) });
        rec.free.setAttribute('list', rec.dl.id);
        rec.free.addEventListener('change', () => {
          const t = rec.free.value.trim();
          if (!t) { commit(rec, null); return; }
          const k = rec.options.findIndex(op => (rec.opts.format_func || fmtOpt)(op) === t);
          commit(rec, k >= 0 ? rec.options[k] : t);
        });
        rec.free.addEventListener('keydown', e => { if (e.key === 'Enter') rec.free.blur(); });
        rec.sel.replaceWith(rec.free); rec.el.append(rec.dl);
      }
      const dsig = options.map(ff).join('\u0001');
      if (rec.dsig !== dsig) { rec.dsig = dsig; rec.dl.innerHTML = options.map(op => `<option value="${esc(ff(op))}"></option>`).join(''); }
      rec.free.placeholder = o.placeholder || 'Pilih atau ketik…';
      const txt = rec.shown == null ? '' : optIndex(options, rec.shown) >= 0 ? ff(rec.shown) : String(rec.shown);
      if (canSync(rec, rec.free) && rec.free.value !== txt) rec.free.value = txt;
      setDisabled(rec, [rec.free], o);
      return v;
    }
    const sig = options.map(ff).join('\u0001') + '|' + (index == null) + '|' + (o.placeholder || '');
    if (rec.sig !== sig) {
      rec.sig = sig;
      rec.sel.innerHTML = '';
      if (index == null) rec.sel.append(h('option', { value: '', text: o.placeholder || 'Pilih opsi…' }));
      options.forEach((opt, i) => rec.sel.append(h('option', { value: String(i), text: ff(opt) })));
    }
    rec.sel.value = rec.shown == null ? '' : String(optIndex(options, rec.shown));
    setDisabled(rec, [rec.sel], o);
    return v;
  };

  EL.multiselect = (ctx, label, options, o) => {
    o = o || {};
    options = toOptions(options);
    const def = (o.default != null ? [].concat(o.default) : []).filter(x => optIndex(options, x) >= 0);
    const rec = place(ctx, 'multiselect', ident(label, o), r => {
      fieldShell(r, 'slak-multi');
      r.chips = h('div', { class: 'slak-chips' });
      r.sel = h('select', {
        class: 'slak-input',
        onchange: () => {
          if (r.sel.value === '') return;
          const add = r.options[+r.sel.value];
          r.sel.value = '';
          commit(r, (r.shown || []).concat([add]));
          renderMulti(r);
        }
      });
      r.chips.addEventListener('click', e => {
        const bx = e.target.closest('button[data-x]');
        if (bx && !r.opts.disabled) { commit(r, (r.shown || []).filter(x => String(x) !== bx.dataset.x)); renderMulti(r); return; }
        const b = e.target.closest('button[data-i]');
        if (!b || r.opts.disabled) return;
        const rm = r.options[+b.dataset.i];
        commit(r, (r.shown || []).filter(x => !sameVal(x, rm)));
        renderMulti(r);
      });
      r.add = h('input', { class: 'slak-input slak-multi-add', type: 'text', placeholder: 'Ketik opsi baru lalu Enter', hidden: true });
      r.add.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        const t = r.add.value.trim();
        if (!t) return;
        const cur = r.shown || [];
        const full = r.opts.max_selections && cur.length >= r.opts.max_selections;
        if (!full && optIndex(cur, t) < 0) commit(r, cur.concat([t]));
        r.add.value = '';
        renderMulti(r);
      });
      r.el.append(r.chips, r.sel, r.add);
    });
    let v = bindWidget(rec, ctx, o, def);
    rec.add.hidden = !o.accept_new_options;
    const clean = (v || []).filter(x => optIndex(options, x) >= 0 || (o.accept_new_options && typeof x === 'string'));
    if (clean.length !== (v || []).length) v = fixValue(rec, clean);
    rec.options = options;
    rec.ff = o.format_func || fmtOpt;
    setLabel(rec, label, o);
    renderMulti(rec);
    return (v || []).slice();
  };
  function renderMulti(r) {
    const chosen = (r.shown || []).map(x => optIndex(r.options, x)).filter(i => i >= 0);
    const extra = (r.shown || []).filter(x => optIndex(r.options, x) < 0);
    r.chips.innerHTML = chosen.map(i => `<span class="slak-chip">${esc(r.ff(r.options[i]))}<button type="button" data-i="${i}" aria-label="Hapus ${esc(r.ff(r.options[i]))}">×</button></span>`).join('') +
      extra.map(x => `<span class="slak-chip new">${esc(String(x))}<button type="button" data-x="${esc(String(x))}" aria-label="Hapus ${esc(String(x))}">×</button></span>`).join('');
    r.chips.style.display = chosen.length || extra.length ? '' : 'none';
    r.sel.innerHTML = '';
    const full = r.opts.max_selections && chosen.length >= r.opts.max_selections;
    r.sel.append(h('option', { value: '', text: full ? `Maksimal ${r.opts.max_selections} pilihan` : (r.opts.placeholder || 'Pilih opsi…') }));
    if (!full) r.options.forEach((opt, i) => { if (!chosen.includes(i)) r.sel.append(h('option', { value: String(i), text: r.ff(opt) })); });
    r.sel.value = '';
    r.sel.disabled = !!r.opts.disabled;
    r.el.classList.toggle('slak-disabled', !!r.opts.disabled);
  }

  function sliderFill(r) {
    const span = (r.max - r.min) || 1;
    if (r.dual) {
      const a = (Number(r.a.value) - r.min) / span, b = (Number(r.b.value) - r.min) / span;
      r.fill.style.left = `calc(9px + (100% - 18px) * ${Math.min(a, b)})`;
      r.fill.style.width = `calc((100% - 18px) * ${Math.abs(b - a)})`;
    } else {
      const p = (Number(r.a.value) - r.min) / span;
      r.fill.style.left = '0';
      r.fill.style.width = `calc(9px + (100% - 18px) * ${p})`;
    }
  }

  function buildSlider(r) {
    fieldShell(r, 'slak-slider');
    r.out = h('span', { class: 'slak-slider-out' });
    r.lab.after(r.out);
    r.head = h('div', { class: 'slak-slider-head' });
    r.el.insertBefore(r.head, r.lab);
    r.head.append(r.lab, r.out);
    r.fill = h('div', { class: 'slak-range-fill' });
    r.track = h('div', { class: 'slak-range' }, h('div', { class: 'slak-range-track' }), r.fill);
    r.ends = h('div', { class: 'slak-range-ends' }, r.minL = h('span'), r.maxL = h('span'));
    r.el.append(r.track, r.ends);
  }

  EL.slider = (ctx, label, ...rest) => {
    const o = A(rest, ['min', 'max', 'value', 'step']);
    const min = o.min != null ? o.min : 0;
    const max = o.max != null ? o.max : 100;
    const step = o.step != null ? o.step : ((Number.isInteger(min) && Number.isInteger(max)) ? 1 : 0.01);
    const def = o.value != null ? o.value : min;
    const dual = Array.isArray(def);
    const dec = decimalsOf(step);
    const yearish = [min, max].every(v => Number.isInteger(v) && v >= 1000 && v <= 2999) && Number.isInteger(step);
    const fmt = typeof o.format === 'function' ? o.format : o.format != null ? makeFmt(o.format) : (v => yearish ? String(v) : fmtNum(v));
    const rec = place(ctx, dual ? 'range_slider' : 'slider', ident(label, o), r => {
      buildSlider(r);
      r.dual = dual;
      const mk = () => h('input', { type: 'range' });
      r.a = mk();
      r.track.append(r.a);
      if (dual) { r.b = mk(); r.track.append(r.b); r.track.classList.add('dual'); }
      const read = () => {
        const a = +Number(r.a.value).toFixed(r.dec);
        if (!r.dual) return a;
        const b = +Number(r.b.value).toFixed(r.dec);
        return [Math.min(a, b), Math.max(a, b)];
      };
      const live = () => {
        const v = read();
        r.out.textContent = r.dual ? `${r.fmt(v[0])} – ${r.fmt(v[1])}` : r.fmt(v);
        sliderFill(r);
      };
      for (const inp of [r.a, r.b]) {
        if (!inp) continue;
        inp.addEventListener('input', live);
        inp.addEventListener('change', () => commit(r, read()));
      }
    });
    let v = bindWidget(rec, ctx, o, def);
    const clamp = x => Math.min(max, Math.max(min, Number(x)));
    if (dual) {
      if (!Array.isArray(v)) v = fixValue(rec, def);
      const c = [clamp(v[0]), clamp(v[1])];
      if (c[0] !== v[0] || c[1] !== v[1]) v = fixValue(rec, c);
    } else if (clamp(v) !== v) v = fixValue(rec, clamp(v));
    Object.assign(rec, { min, max, dec, fmt });
    setLabel(rec, label, o);
    for (const inp of [rec.a, rec.b]) {
      if (!inp) continue;
      inp.min = min; inp.max = max; inp.step = step;
      inp.setAttribute('aria-label', label);
    }
    const s = rec.shown;
    if (dual) { rec.a.value = s[0]; rec.b.value = s[1]; rec.out.textContent = `${fmt(s[0])} – ${fmt(s[1])}`; }
    else { rec.a.value = s; rec.out.textContent = fmt(s); }
    rec.minL.textContent = fmt(min); rec.maxL.textContent = fmt(max);
    sliderFill(rec);
    setDisabled(rec, [rec.a, rec.b], o);
    return dual ? v.slice() : v;
  };

  EL.select_slider = (ctx, label, options, o) => {
    if (isPlainObj(options) && !o) { o = options; options = o.options; }
    o = o || {};
    options = toOptions(options);
    const ff = o.format_func || fmtOpt;
    const def = o.value != null ? o.value : options[0];
    const dual = Array.isArray(def) && !options.some(x => Array.isArray(x));
    const rec = place(ctx, dual ? 'select_range' : 'select_slider', ident(label, o), r => {
      buildSlider(r);
      r.dual = dual;
      r.a = h('input', { type: 'range', min: '0', step: '1' });
      r.track.append(r.a);
      if (dual) { r.b = h('input', { type: 'range', min: '0', step: '1' }); r.track.append(r.b); r.track.classList.add('dual'); }
      const read = () => {
        const a = +r.a.value;
        if (!r.dual) return r.options[a];
        const b = +r.b.value;
        return [r.options[Math.min(a, b)], r.options[Math.max(a, b)]];
      };
      const live = () => {
        const v = read();
        r.out.textContent = r.dual ? `${r.ff(v[0])} – ${r.ff(v[1])}` : r.ff(v);
        sliderFill(r);
      };
      for (const inp of [r.a, r.b]) {
        if (!inp) continue;
        inp.addEventListener('input', live);
        inp.addEventListener('change', () => commit(r, read()));
      }
    });
    let v = bindWidget(rec, ctx, o, def);
    if (dual ? !(Array.isArray(v) && v.every(x => optIndex(options, x) >= 0)) : optIndex(options, v) < 0) v = fixValue(rec, def);
    Object.assign(rec, { options, ff, min: 0, max: Math.max(1, options.length - 1) });
    setLabel(rec, label, o);
    for (const inp of [rec.a, rec.b]) if (inp) { inp.max = String(Math.max(0, options.length - 1)); inp.setAttribute('aria-label', label); }
    if (dual) {
      rec.a.value = optIndex(options, rec.shown[0]); rec.b.value = optIndex(options, rec.shown[1]);
      rec.out.textContent = `${ff(rec.shown[0])} – ${ff(rec.shown[1])}`;
    } else {
      rec.a.value = optIndex(options, rec.shown);
      rec.out.textContent = ff(rec.shown);
    }
    rec.minL.textContent = options.length ? ff(options[0]) : '';
    rec.maxL.textContent = options.length ? ff(options[options.length - 1]) : '';
    sliderFill(rec);
    setDisabled(rec, [rec.a, rec.b], o);
    return dual ? v.slice() : v;
  };

  function submitFormOnEnter(r) {
    if (!r.form) return;
    const f = r.el.closest('form');
    const b = f && f.querySelector('.slak-submit');
    if (b) b.click();
  }

  EL.text_input = (ctx, label, ...rest) => {
    const o = A(rest, ['value']);
    const rec = place(ctx, 'text_input', ident(label, o), r => {
      fieldShell(r, 'slak-textin');
      r.inp = h('input', { class: 'slak-input', type: 'text' });
      r.inp.addEventListener('change', () => { if (r.inp.value !== r.shown) commit(r, r.inp.value); });
      r.inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing) {
          if (r.inp.value !== r.shown) commit(r, r.inp.value);
          submitFormOnEnter(r);
        }
      });
      r.inp.addEventListener('input', () => {
        if (!r.opts.live) return;
        clearTimeout(r.deb);
        r.deb = setTimeout(() => { if (r.inp.value !== r.shown) commit(r, r.inp.value); }, 250);
      });
      r.el.append(r.inp);
    });
    const v = bindWidget(rec, ctx, o, o.value != null ? String(o.value) : '');
    setLabel(rec, label, o);
    rec.inp.type = o.type === 'password' ? 'password' : 'text';
    rec.inp.placeholder = o.placeholder || '';
    if (o.max_chars) rec.inp.maxLength = o.max_chars; else rec.inp.removeAttribute('maxlength');
    if (canSync(rec, rec.inp) && rec.inp.value !== rec.shown) rec.inp.value = rec.shown;
    rec.inp.setAttribute('aria-label', label);
    setDisabled(rec, [rec.inp], o);
    return v;
  };

  EL.text_area = (ctx, label, ...rest) => {
    const o = A(rest, ['value']);
    const rec = place(ctx, 'text_area', ident(label, o), r => {
      fieldShell(r, 'slak-textarea');
      r.inp = h('textarea', { class: 'slak-input' });
      r.inp.addEventListener('change', () => { if (r.inp.value !== r.shown) commit(r, r.inp.value); });
      r.inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { if (r.inp.value !== r.shown) commit(r, r.inp.value); submitFormOnEnter(r); }
      });
      r.el.append(r.inp, h('div', { class: 'slak-hint', text: 'Ctrl + Enter untuk menerapkan' }));
    });
    const v = bindWidget(rec, ctx, o, o.value != null ? String(o.value) : '');
    setLabel(rec, label, o);
    rec.inp.placeholder = o.placeholder || '';
    rec.inp.style.height = (o.height || 110) + 'px';
    if (o.max_chars) rec.inp.maxLength = o.max_chars; else rec.inp.removeAttribute('maxlength');
    if (canSync(rec, rec.inp) && rec.inp.value !== rec.shown) rec.inp.value = rec.shown;
    rec.inp.setAttribute('aria-label', label);
    setDisabled(rec, [rec.inp], o);
    return v;
  };

  EL.number_input = (ctx, label, ...rest) => {
    const o = A(rest, ['min', 'max', 'value', 'step']);
    const step = o.step != null ? o.step : (o.value != null && !Number.isInteger(o.value) ? 0.01 : 1);
    const empty = o.value === null && rest.some(x => isPlainObj(x) && 'value' in x);   // value: null = kosong, seperti Streamlit (None)
    const def = o.value != null ? o.value : empty ? null : (o.min != null ? o.min : 0);
    const dec = decimalsOf(step);
    const clamp = x => {
      let v = Number(x);
      if (o.min != null) v = Math.max(o.min, v);
      if (o.max != null) v = Math.min(o.max, v);
      return +v.toFixed(dec);
    };
    const rec = place(ctx, 'number_input', ident(label, o), r => {
      fieldShell(r, 'slak-number');
      r.inp = h('input', { class: 'slak-input', type: 'number', inputmode: 'decimal' });
      const set = x => { if (!isNaN(x)) { const c = r.clamp(x); r.inp.value = c; if (c !== r.shown) commit(r, c); } else if (r.empty && r.inp.value === '') { if (r.shown !== null) commit(r, null); } else r.inp.value = r.shown == null ? '' : r.shown; };
      r.inp.addEventListener('change', () => set(parseFloat(r.inp.value)));
      r.inp.addEventListener('keydown', e => { if (e.key === 'Enter') { set(parseFloat(r.inp.value)); submitFormOnEnter(r); } });
      r.minus = h('button', { type: 'button', text: '−', 'aria-label': 'Kurangi', onclick: () => set(Number(r.shown || 0) - r.step) });
      r.plus = h('button', { type: 'button', text: '+', 'aria-label': 'Tambah', onclick: () => set(Number(r.shown || 0) + r.step) });
      r.el.append(h('div', { class: 'slak-num' }, r.inp, r.minus, r.plus));
    });
    Object.assign(rec, { clamp, step, empty });
    let v = bindWidget(rec, ctx, o, def);
    if (v === null && empty) { /* kosong sampai diisi */ }
    else if (!isNum(v)) v = fixValue(rec, clamp(def == null ? (o.min != null ? o.min : 0) : def));
    else if (clamp(v) !== v) v = fixValue(rec, clamp(v));
    setLabel(rec, label, o);
    rec.inp.step = step;
    if (o.min != null) rec.inp.min = o.min; else rec.inp.removeAttribute('min');
    if (o.max != null) rec.inp.max = o.max; else rec.inp.removeAttribute('max');
    if (canSync(rec, rec.inp)) rec.inp.value = rec.shown == null ? '' : rec.shown;
    if (o.placeholder) rec.inp.placeholder = o.placeholder;
    rec.inp.setAttribute('aria-label', label);
    setDisabled(rec, [rec.inp, rec.minus, rec.plus], o);
    return v;
  };

  function simpleInput(type, inputType, defFn) {
    return (ctx, label, ...rest) => {
      const o = A(rest, ['value']);
      const rec = place(ctx, type, ident(label, o), r => {
        fieldShell(r, 'slak-' + type);
        r.inp = h('input', { class: 'slak-input', type: inputType });
        r.inp.addEventListener('change', () => { if (r.inp.value !== '' && r.inp.value !== r.shown) commit(r, r.inp.value); });
        r.el.append(r.inp);
      });
      const v = bindWidget(rec, ctx, o, o.value != null ? o.value : defFn());
      setLabel(rec, label, o);
      if (o.min != null) rec.inp.min = o.min;
      if (o.max != null) rec.inp.max = o.max;
      if (canSync(rec, rec.inp) && rec.inp.value !== rec.shown) rec.inp.value = rec.shown == null ? '' : rec.shown;
      rec.inp.setAttribute('aria-label', label);
      setDisabled(rec, [rec.inp], o);
      return v;
    };
  }
  EL.date_input = simpleInput('date_input', 'date', todayISO);
  EL.time_input = simpleInput('time_input', 'time', nowHM);
  EL.color_picker = simpleInput('color_picker', 'color', () => '#0f766e');

  EL.file_uploader = (ctx, label, o) => {
    o = o || {};
    const types = o.type ? [].concat(o.type).map(t => t.startsWith('.') || t.includes('/') ? t : '.' + t) : null;
    const rec = place(ctx, 'file_uploader', ident(label, o), r => {
      fieldShell(r, 'slak-upload');
      r.file = h('input', { type: 'file', hidden: true });
      r.drop = h('div', { class: 'slak-drop', tabindex: '0', role: 'button' },
        h('div', { class: 'slak-drop-main', text: 'Seret & lepas berkas di sini, atau klik untuk memilih' }),
        r.limit = h('div', { class: 'slak-drop-sub' }));
      r.list = h('div', { class: 'slak-files' });
      const take = async files => {
        files = [...files];
        if (!files.length) return;
        r.drop.classList.add('busy');
        try {
          const items = await Promise.all(files.map(readUpload));
          commit(r, r.opts.accept_multiple_files ? (r.shown || []).concat(items) : items[0]);
        } finally { r.drop.classList.remove('busy'); }
      };
      r.file.addEventListener('change', () => { take(r.file.files); r.file.value = ''; });
      r.drop.addEventListener('click', () => { if (!r.opts.disabled) r.file.click(); });
      r.drop.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !r.opts.disabled) { e.preventDefault(); r.file.click(); } });
      r.drop.addEventListener('dragover', e => { e.preventDefault(); r.drop.classList.add('over'); });
      r.drop.addEventListener('dragleave', () => r.drop.classList.remove('over'));
      r.drop.addEventListener('drop', e => {
        e.preventDefault(); r.drop.classList.remove('over');
        if (r.opts.disabled) return;
        let files = [...e.dataTransfer.files];
        if (r.types) files = files.filter(f => r.types.some(t => t.startsWith('.') ? f.name.toLowerCase().endsWith(t.toLowerCase()) : f.type === t));
        if (!r.opts.accept_multiple_files) files = files.slice(0, 1);
        take(files);
      });
      r.list.addEventListener('click', e => {
        const b = e.target.closest('button[data-i]');
        if (!b) return;
        const cur = r.opts.accept_multiple_files ? (r.shown || []) : (r.shown ? [r.shown] : []);
        const gone = cur[+b.dataset.i];
        if (gone && gone.url) URL.revokeObjectURL(gone.url);
        const next = cur.filter((_, i) => i !== +b.dataset.i);
        commit(r, r.opts.accept_multiple_files ? next : null);
      });
      r.el.append(r.file, r.drop, r.list);
    });
    rec.types = types;
    const v = bindWidget(rec, ctx, o, o.accept_multiple_files ? [] : null);
    setLabel(rec, label, o);
    rec.file.multiple = !!o.accept_multiple_files;
    if (types) rec.file.accept = types.join(','); else rec.file.removeAttribute('accept');
    rec.limit.textContent = types ? 'Jenis: ' + types.join(', ') : 'Semua jenis berkas';
    const files = o.accept_multiple_files ? (rec.shown || []) : (rec.shown ? [rec.shown] : []);
    rec.list.innerHTML = files.map((f, i) => `<div class="slak-file"><span class="nm">${esc(f.name)}</span><span class="sz">${fmtSize(f.size)}</span><button type="button" data-i="${i}" aria-label="Hapus berkas">×</button></div>`).join('');
    rec.el.classList.toggle('slak-disabled', !!o.disabled);
    return v;
  };

  EL.download_button = (ctx, label, data, o) => {
    o = o || {};
    const rec = place(ctx, 'download_button', ident(label, o), r => {
      r.a = h('a', { class: 'slak-btn', href: '#' });
      r.a.addEventListener('click', e => {
        if (r.opts.disabled) { e.preventDefault(); return; }
        r.app.callback(r.opts.on_click, r.opts.args);
      });
      r.el = h('div', { class: 'slak-el slak-btnwrap' }, r.a);
      r.dispose = () => { if (r.url) URL.revokeObjectURL(r.url); };
    });
    rec.opts = o;
    rec.a.innerHTML = iconHTML(o.icon) + `<span>${inline(esc(label))}</span>`;
    rec.a.download = o.file_name || 'unduhan';
    rec.a.title = o.help || '';
    rec.a.classList.toggle('primary', o.type === 'primary');
    rec.a.classList.toggle('tertiary', o.type === 'tertiary');
    rec.a.classList.toggle('full', !!o.use_container_width || o.width === 'stretch');
    if (rec.data !== data || rec.mime !== o.mime) {
      rec.data = data; rec.mime = o.mime;
      if (rec.url) URL.revokeObjectURL(rec.url);
      let blob;
      const name = String(o.file_name || '');
      const ext = !(data instanceof Blob) && data != null && typeof data === 'object' && EXT.blob.reduce((b, f) => b || f(data, name, o), null);
      if (ext) blob = ext;
      else if (data instanceof Blob) blob = data;
      else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) blob = new Blob([data], { type: o.mime || 'application/octet-stream' });
      else if (typeof data === 'string') blob = new Blob([data], { type: o.mime || 'text/plain;charset=utf-8' });
      else if (o.mime === 'text/csv' || /\.csv$/i.test(name)) blob = new Blob([toCSV(data)], { type: 'text/csv;charset=utf-8' });
      else blob = new Blob([JSON.stringify(data, null, 2)], { type: o.mime || 'application/json' });
      rec.url = URL.createObjectURL(blob);
      rec.a.href = rec.url;
    }
    rec.el.classList.toggle('slak-disabled', !!o.disabled);
    return false;
  };

  /* ---------- Form ---------- */

  EL.form = (ctx, key, o, fn) => {
    if (typeof o === 'function') { fn = o; o = {}; }
    o = o || {};
    if (ctx.form) throw new Error('Form tidak boleh berada di dalam form lain.');
    const rec = place(ctx, 'form', String(key), r => {
      r.el = h('form', { class: 'slak-el slak-form slak-block', novalidate: true, onsubmit: e => e.preventDefault() });
      r.child = newCtx(r.app, r.el, ctx.path + '/form:' + key, { form: 'form:' + key, frag: ctx.frag });
    });
    rec.el.classList.toggle('slak-noborder', o.border === false);
    rec.app.formClear.set('form:' + key, !!o.clear_on_submit);
    touch(rec.child);
    const api = makeAPI(rec.child);
    if (fn) fn(api);
    return api;
  };

  EL.form_submit_button = (ctx, label, o) => {
    o = o || {};
    if (!ctx.form) throw new Error('form_submit_button() hanya bisa dipakai di dalam form.');
    label = label == null ? 'Kirim' : label;
    const rec = place(ctx, 'submit', ident(label, o), r => {
      r.b = h('button', {
        class: 'slak-btn slak-submit', type: 'button',
        onclick: () => {
          const app = r.app;
          const pend = app.pendingFor(r.form);
          for (const { rec: w, v } of pend.values()) { store(w, v); app.callback(w.opts.on_change, w.opts.args); }
          pend.clear();
          if (app.formClear.get(r.form)) app.clearNext.add(r.form);
          trigger(r);
        }
      });
      r.el = h('div', { class: 'slak-el slak-btnwrap' }, r.b);
    });
    bindWidget(rec, ctx, o, false);
    rec.b.innerHTML = iconHTML(o.icon) + `<span>${inline(esc(label))}</span>`;
    rec.b.classList.toggle('primary', o.type === 'primary');
    rec.b.classList.toggle('tertiary', o.type === 'tertiary');
    rec.b.classList.toggle('full', !!o.use_container_width || o.width === 'stretch');
    setDisabled(rec, [rec.b], o);
    return !!ctx.app.active.get(rec.wid);
  };
  /* ---------- Tata letak ---------- */

  EL.columns = (ctx, spec, o) => {
    o = o || {};
    const weights = typeof spec === 'number' ? Array(Math.max(1, spec | 0)).fill(1) : [].concat(spec);
    const rec = place(ctx, 'columns', String(weights.length), r => {
      r.el = h('div', { class: 'slak-el slak-cols' });
      r.cols = weights.map((_, i) => {
        const el = h('div', { class: 'slak-col slak-block' });
        r.el.append(el);
        return childCtx(r, el, 'c' + i, ctx);
      });
    });
    rec.el.style.gap = o.gap === null ? '0' : ({ small: '8px', medium: '18px', large: '36px' }[o.gap || 'medium'] || GAP[o.gap] || sizePx(o.gap));
    rec.el.style.alignItems = { top: 'flex-start', center: 'center', bottom: 'flex-end', distribute: 'stretch' }[o.vertical_alignment || 'top'];
    rec.cols.forEach((c, i) => { c.el.style.flex = `${weights[i]} 1 0`; c.el.classList.toggle('slak-bordered', !!o.border); c.el.style.justifyContent = o.vertical_alignment === 'distribute' ? 'space-between' : ''; touch(c); });
    return rec.cols.map(c => makeAPI(c));
  };

  EL.tabs = (ctx, labels) => {
    labels = [].concat(labels);
    const rec = place(ctx, 'tabs', labels.join('\u0001'), r => {
      r.nav = h('div', { class: 'slak-tabs-nav', role: 'tablist' });
      r.panels = h('div', { class: 'slak-tabs-panels' });
      r.el = h('div', { class: 'slak-el slak-tabs' }, r.nav, r.panels);
      r.active = 0;
      r.btns = []; r.ctxs = [];
      labels.forEach((lab, i) => {
        const b = h('button', { type: 'button', role: 'tab', html: inline(esc(lab)), onclick: () => { r.active = i; sel(); } });
        const p = h('div', { class: 'slak-tab slak-block', role: 'tabpanel' });
        r.nav.append(b); r.panels.append(p);
        r.btns.push(b); r.ctxs.push(childCtx(r, p, 't' + i, ctx));
      });
      const sel = () => r.btns.forEach((b, i) => {
        b.classList.toggle('on', i === r.active);
        b.setAttribute('aria-selected', String(i === r.active));
        r.ctxs[i].el.hidden = i !== r.active;
      });
      sel();
    });
    rec.ctxs.forEach(touch);
    return rec.ctxs.map(c => makeAPI(c));
  };

  EL.expander = (ctx, label, o, fn) => {
    if (typeof o === 'function') { fn = o; o = {}; }
    o = o || {};
    const rec = place(ctx, 'expander', String(label), r => {
      r.sum = h('summary');
      r.body = h('div', { class: 'slak-block slak-exp-body' });
      r.el = h('details', { class: 'slak-el slak-exp' }, r.sum, r.body);
      if (o.expanded) r.el.open = true;
      r.child = childCtx(r, r.body, '', ctx);
    });
    const sh = iconHTML(o.icon) + `<span>${inline(esc(label))}</span>`;
    if (rec.sh !== sh) { rec.sh = sh; rec.sum.innerHTML = sh; }
    setWidth(rec.el, o.width === 'stretch' ? null : o.width);
    touch(rec.child);
    const api = makeAPI(rec.child);
    if (fn) fn(api);
    return api;
  };

  EL.container = (ctx, o, fn) => {
    if (typeof o === 'function') { fn = o; o = {}; }
    o = o || {};
    const rec = place(ctx, 'container', o.key != null ? 'key:' + o.key : '', r => {
      r.el = h('div', { class: 'slak-el slak-box slak-block' });
      r.child = childCtx(r, r.el, '', ctx);
      r.mo = null;
    });
    const fixedH = isNum(o.height);
    rec.el.classList.toggle('slak-bordered', o.border === true || (o.border == null && fixedH));
    rec.el.style.height = fixedH ? o.height + 'px' : '';
    rec.el.style.maxHeight = '';
    rec.el.style.overflow = fixedH ? 'auto' : '';
    rec.el.classList.toggle('slak-stretch-h', o.height === 'stretch');
    const horiz = !!o.horizontal;
    if (o.wrap === false && !horiz) throw new Error('sl.container({ wrap: false }) hanya bisa dipakai bersama horizontal: true.');
    rec.el.classList.toggle('slak-horiz', horiz);
    rec.el.classList.toggle('slak-nowrap', horiz && o.wrap === false);
    const ha = { left: 'flex-start', center: 'center', right: 'flex-end', distribute: 'space-between' }[o.horizontal_alignment || 'left'];
    const va = { top: 'flex-start', center: 'center', bottom: 'flex-end', distribute: 'space-between' }[o.vertical_alignment || 'top'];
    rec.el.style.justifyContent = horiz ? ha : va;
    rec.el.style.alignItems = horiz ? (o.vertical_alignment ? va : 'flex-start') : (o.horizontal_alignment ? ha : '');
    rec.el.style.gap = o.gap === undefined ? '' : o.gap === null ? '0' : (GAP[o.gap] || sizePx(o.gap));
    setWidth(rec.el, o.width === 'stretch' ? null : o.width);
    const auto = o.autoscroll != null ? o.autoscroll : null;
    rec.autoscroll = fixedH && (auto === true || (auto == null && !!rec.el.querySelector('.slak-chatmsg')));
    if (rec.autoscroll && !rec.mo && typeof MutationObserver !== 'undefined') {
      rec.mo = new MutationObserver(() => { if (rec.autoscroll) rec.el.scrollTop = rec.el.scrollHeight; });
      rec.mo.observe(rec.el, { childList: true, subtree: true, characterData: true });
      rec.dispose = () => rec.mo && rec.mo.disconnect();
    }
    touch(rec.child);
    const api = makeAPI(rec.child);
    if (fn) fn(api);
    if (rec.autoscroll) requestAnimationFrame(() => { rec.el.scrollTop = rec.el.scrollHeight; });
    return api;
  };

  EL.empty = ctx => {
    const rec = place(ctx, 'empty', '', r => {
      r.el = h('div', { class: 'slak-el slak-empty slak-block' });
      r.child = childCtx(r, r.el, '', ctx, { single: true });
    });
    touch(rec.child);
    return makeAPI(rec.child);
  };

  /* ---------- Chat ---------- */

  EL.chat_message = (ctx, name, o, fn) => {
    if (typeof o === 'function') { fn = o; o = {}; }
    o = o || {};
    name = String(name || 'user');
    const rec = place(ctx, 'chat_message', '', r => {
      r.av = h('div', { class: 'slak-av' });
      r.body = h('div', { class: 'slak-block slak-chat-body' });
      r.el = h('div', { class: 'slak-el slak-chatmsg' }, r.av, r.body);
      r.child = childCtx(r, r.body, '', ctx);
    });
    const role = /^(user|human|pengguna)$/i.test(name) ? 'user' : /^(assistant|ai|bot|asisten)$/i.test(name) ? 'assistant' : 'other';
    rec.el.dataset.role = role;
    rec.av.textContent = o.avatar || (role === 'user' ? '🙂' : role === 'assistant' ? '✦' : name.slice(0, 1).toUpperCase());
    rec.av.title = name;
    touch(rec.child);
    const api = makeAPI(rec.child);
    if (fn) fn(api);
    return api;
  };

  EL.chat_input = (ctx, placeholder, o) => {
    if (isPlainObj(placeholder)) { o = placeholder; placeholder = o.placeholder; }
    o = o || {};
    const app = ctx.app;
    const host = ctx === app.mainCtx ? app.footCtx : ctx;
    const rec = place(host, 'chat_input', o.key != null ? 'key:' + o.key : '', r => {
      r.inp = h('textarea', { class: 'slak-chat-field', rows: '1', autocomplete: 'off' });
      r.send = h('button', { type: 'button', class: 'slak-chat-send', 'aria-label': 'Kirim', html: '&#10148;' });
      r.att = h('button', { type: 'button', class: 'slak-chat-tool', 'aria-label': 'Lampirkan berkas', title: 'Lampirkan berkas', html: '&#128206;' });
      r.mic = h('button', { type: 'button', class: 'slak-chat-tool', 'aria-label': 'Rekam suara', title: 'Rekam suara', html: '&#127908;' });
      r.file = h('input', { type: 'file', hidden: true });
      r.files = [];
      r.audio = null;
      r.chips = h('div', { class: 'slak-chat-chips' });
      r.err = h('div', { class: 'slak-chat-err' });
      r.el = h('div', { class: 'slak-el slak-chatin-wrap' }, r.chips, r.err, h('div', { class: 'slak-chatin' }, r.att, r.inp, r.mic, r.send), r.file);
      const fit = () => { r.inp.style.height = 'auto'; r.inp.style.height = Math.min(200, r.inp.scrollHeight) + 'px'; };
      const chips = () => {
        r.chips.innerHTML = r.files.map((f, i) => `<span class="slak-chip">📄 ${esc(f.name)}<button type="button" data-f="${i}" aria-label="Hapus">×</button></span>`).join('') +
          (r.audio ? `<span class="slak-chip">🎙 ${esc(r.audio.name)}<button type="button" data-a="1" aria-label="Hapus">×</button></span>` : '');
        r.chips.hidden = !r.files.length && !r.audio;
      };
      r.paint = chips;
      const go = () => {
        const v = r.inp.value.trim();
        const rich = r.opts.accept_file || r.opts.accept_audio;
        if (r.opts.disabled || (!v && !(rich && (r.files.length || r.audio)))) return;
        if (r.opts.max_chars && v.length > r.opts.max_chars) return;
        const out = rich ? { text: v, files: r.opts.accept_file ? r.files.slice() : undefined, audio: r.opts.accept_audio ? r.audio : undefined } : v;
        if (rich) { if (!r.opts.accept_file) delete out.files; if (!r.opts.accept_audio) delete out.audio; }
        r.inp.value = ''; r.files = []; r.audio = null; chips(); fit();
        trigger(r, { v: out });
      };
      r.inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(); } });
      r.inp.addEventListener('input', fit);
      r.send.addEventListener('click', go);
      r.att.addEventListener('click', () => { if (!r.opts.disabled) r.file.click(); });
      r.file.addEventListener('change', async () => {
        const list = [...r.file.files];
        r.file.value = '';
        const max = r.opts.max_upload_size ? r.opts.max_upload_size * 1048576 : Infinity;
        const big = list.filter(f => f.size > max);
        r.err.textContent = big.length ? `Berkas terlalu besar (maks. ${r.opts.max_upload_size} MB): ${big.map(f => f.name).join(', ')}` : '';
        const items = await Promise.all(list.filter(f => f.size <= max).map(readUpload));
        r.files = r.opts.accept_file === true ? items.slice(0, 1) : r.files.concat(items);
        chips();
      });
      r.chips.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.a) r.audio = null; else r.files.splice(+b.dataset.f, 1);
        chips();
      });
      r.rec = recorder(16000, f => { r.audio = f; r.mic.classList.remove('on'); chips(); }, msg => { r.err.textContent = msg; r.mic.classList.remove('on'); });
      r.mic.addEventListener('click', async () => {
        if (r.opts.disabled) return;
        if (r.rec.active) { r.rec.stop(); return; }
        r.err.textContent = '';
        if (await r.rec.start()) r.mic.classList.add('on');
      });
      r.dispose = () => r.rec.stop();
    });
    bindWidget(rec, host, o, null);
    rec.el.classList.toggle('inline', host !== app.footCtx);
    rec.inp.placeholder = placeholder || 'Ketik pesan…';
    rec.inp.setAttribute('aria-label', placeholder || 'Ketik pesan');
    if (o.max_chars) rec.inp.maxLength = o.max_chars; else rec.inp.removeAttribute('maxlength');
    rec.att.hidden = !o.accept_file;
    rec.mic.hidden = !o.accept_audio;
    rec.file.multiple = o.accept_file === 'multiple' || o.accept_file === 'directory';
    if (o.accept_file === 'directory') rec.file.setAttribute('webkitdirectory', ''); else rec.file.removeAttribute('webkitdirectory');
    const ft = o.file_type ? [].concat(o.file_type).map(t => /^(image|audio|video|text)$/.test(t) ? t + '/*' : t.startsWith('.') || t.includes('/') ? t : '.' + t) : null;
    if (ft) rec.file.accept = ft.join(','); else rec.file.removeAttribute('accept');
    if (isNum(o.height)) rec.inp.style.minHeight = o.height + 'px';
    setWidth(rec.el, o.width === 'stretch' ? null : o.width);
    setDisabled(rec, [rec.inp, rec.send, rec.att, rec.mic], o);
    const hit = app.active.get(rec.wid);
    if (!hit || typeof hit !== 'object' || !('v' in hit)) return null;
    return hit.v;
  };

  /* ======================================================================
   * Elemen baru Slak 1.3.1: padanan Streamlit yang belum ada
   * ==================================================================== */

  const NAMED_COLORS = ['red', 'orange', 'yellow', 'blue', 'green', 'violet', 'gray', 'grey', 'primary'];
  const GAP = { xxsmall: '0.25rem', xsmall: '0.5rem', small: '1rem', medium: '2rem', large: '4rem', xlarge: '6rem', xxlarge: '8rem' };
  const sizePx = v => v == null ? '' : isNum(v) ? v + 'px' : String(v);
  function parseDuration(v) {
    if (v == null || v === false) return null;
    if (isNum(v)) return v * 1000;
    const s = String(v).trim();
    let ms = 0, any = false;
    s.replace(/(\d+(?:\.\d+)?)\s*(ms|h|m|s|d)/g, (m, n, u) => { any = true; ms += +n * { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[u]; });
    return any ? ms : (isNaN(+s) ? null : +s * 1000);
  }
  function setWidth(el, w) {
    el.style.width = w == null ? '' : isNum(w) ? w + 'px' : w === 'content' ? 'fit-content' : w === 'stretch' ? '100%' : String(w);
    el.style.maxWidth = isNum(w) ? '100%' : '';
  }

  /* ---------- Teks ---------- */

  EL.badge = (ctx, label, o) => {
    o = o || {};
    const rec = place(ctx, 'badge', '', r => { r.b = h('span', { class: 'slak-badge' }); r.el = h('div', { class: 'slak-el slak-badge-wrap' }, r.b); });
    const color = NAMED_COLORS.includes(o.color) ? o.color : 'blue';
    rec.b.className = 'slak-badge slak-bc-' + (color === 'grey' ? 'gray' : color);
    const html = iconHTML(o.icon) + `<span>${inline(esc(label == null ? '' : label))}</span>`;
    if (rec.html !== html) { rec.html = html; rec.b.innerHTML = html; }
    if (o.help) rec.b.title = o.help;
  };

  EL.latex = (ctx, body, o) => {
    o = o || {};
    const rec = place(ctx, 'latex', '', r => { r.el = h('div', { class: 'slak-el slak-latex' }); });
    const src = String(body == null ? '' : body);
    if (rec.src !== src) { rec.src = src; rec.el.innerHTML = texToMathML(src, true); }
    rec.el.title = o.help || '';
  };

  function fnSource(fn) {
    let s = fn.toString();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (/^\s*(async\s*)?(\([^)]*\)|[\w$]+)\s*=>\s*[^{\s]/.test(s)) return s.replace(/^\s*(async\s*)?(\([^)]*\)|[\w$]+)\s*=>\s*/, '');
    if (a >= 0 && b > a) s = s.slice(a + 1, b);
    const lines = s.replace(/^\n+|\s+$/g, '').split('\n');
    const ind = minOf(lines.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length));
    return lines.map(l => l.slice(isFinite(ind) ? ind : 0)).join('\n');
  }
  EL.echo = (ctx, fn, o) => {
    o = typeof o === 'string' ? { code_location: o } : (o || {});
    if (typeof fn !== 'function') throw new Error('sl.echo() butuh fungsi, misalnya sl.echo(() => { sl.write("Halo") }).');
    const below = o.code_location === 'below';
    if (!below) EL.code(ctx, fnSource(fn), { language: 'javascript' });
    const r = fn(makeAPI(ctx));
    const after = () => { if (below) EL.code(ctx, fnSource(fn), { language: 'javascript' }); };
    if (r && typeof r.then === 'function') return r.then(v => { after(); return v; });
    after();
    return r;
  };

  function describeObj(v) {
    const t = v === null ? 'null' : Array.isArray(v) ? 'Array' : v instanceof Date ? 'Date' : typeof v === 'object' ? (v.constructor && v.constructor.name) || 'Object' : typeof v;
    const rows = [];
    if (v != null && (typeof v === 'object' || typeof v === 'function')) {
      const seen = new Set();
      let p = v, depth = 0;
      while (p && p !== Object.prototype && p !== Function.prototype && depth < 4) {
        for (const k of Object.getOwnPropertyNames(p)) {
          if (Array.isArray(v) && /^\d+$/.test(k)) continue;
          if (seen.has(k) || k === 'constructor' || k.startsWith('_') || /^(length|name|prototype|caller|arguments)$/.test(k) && typeof v === 'function') continue;
          seen.add(k);
          let d;
          try { d = Object.getOwnPropertyDescriptor(p, k); } catch (e) { continue; }
          if (!d) continue;
          let val, kind;
          if (d.get) { kind = 'properti'; try { val = v[k]; } catch (e) { val = undefined; } }
          else { val = d.value; kind = typeof val === 'function' ? 'fungsi' : 'nilai'; }
          const sig = typeof val === 'function' ? (val.toString().match(/^[^{=]*?\(([^)]*)\)/) || [, ''])[1].replace(/\s+/g, ' ').slice(0, 70) : '';
          rows.push({ nama: k, jenis: kind, keterangan: typeof val === 'function' ? `${k}(${sig})` : val === undefined ? '' : (typeof val === 'object' ? (Array.isArray(val) ? `Array(${val.length})` : (val && val.constructor && val.constructor.name) || 'Object') : String(val).slice(0, 70)) });
        }
        p = Object.getPrototypeOf(p); depth++;
      }
    }
    return { t, rows };
  }
  EL.help = (ctx, obj) => {
    const rec = place(ctx, 'help', '', r => { r.head = h('div', { class: 'slak-help-head' }); r.body = h('div', { class: 'slak-help-body' }); r.el = h('div', { class: 'slak-el slak-helpbox' }, r.head, r.body); });
    const { t, rows } = describeObj(obj);
    let head = `<b>${esc(t)}</b>`;
    if (typeof obj === 'function') {
      const sig = (obj.toString().match(/^[^{=]*?\(([^)]*)\)/) || [, ''])[1];
      head = `<b>fungsi</b> <code>${esc(obj.name || 'anonim')}(${esc(sig)})</code>`;
    } else if (obj != null && typeof obj !== 'object') head += ` <code>${esc(String(obj).slice(0, 200))}</code>`;
    else if (obj && typeof obj.toString === 'function' && obj.toString !== Object.prototype.toString) { try { head += ` <code>${esc(String(obj).slice(0, 200))}</code>`; } catch (e) { /* abaikan */ } }
    rec.head.innerHTML = head;
    const fns = rows.filter(r => r.jenis === 'fungsi'), props = rows.filter(r => r.jenis !== 'fungsi');
    rec.body.innerHTML = (props.length ? `<div class="slak-help-sec">Properti</div>` + props.map(r => `<div><code>${esc(r.nama)}</code> <span>${esc(r.keterangan)}</span></div>`).join('') : '') +
      (fns.length ? `<div class="slak-help-sec">Fungsi</div>` + fns.map(r => `<div><code>${esc(r.keterangan)}</code></div>`).join('') : '') +
      (!rows.length ? '<div class="slak-help-none">Tidak ada properti atau fungsi.</div>' : '');
  };

  function srcURL(src, mime) {
    if (src == null) return '';
    if (typeof src === 'string') return src;
    if (src.url && typeof src.url === 'string') return src.url;
    if (src instanceof Blob) return URL.createObjectURL(src);
    if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) return URL.createObjectURL(new Blob([src], { type: mime || 'application/octet-stream' }));
    if (src.bytes instanceof Uint8Array) return URL.createObjectURL(new Blob([src.bytes], { type: mime || src.type || 'application/octet-stream' }));
    return String(src);
  }
  EL.iframe = (ctx, src, o) => {
    o = o || {};
    const rec = place(ctx, 'iframe', '', r => { r.f = h('iframe', { class: 'slak-iframe', loading: 'lazy' }); r.el = h('div', { class: 'slak-el slak-iframe-wrap' }, r.f); });
    const s = typeof src === 'string' ? src : srcURL(src, 'text/html');
    const isHTML = typeof src === 'string' && /^\s*</.test(src);
    if (rec.src !== s) {
      rec.src = s;
      if (isHTML) { rec.f.removeAttribute('src'); rec.f.srcdoc = s; } else { rec.f.removeAttribute('srcdoc'); rec.f.src = safeUrl(s, true); }
    }
    rec.f.style.height = sizePx(o.height != null ? o.height : 400);
    setWidth(rec.el, o.width);
    rec.f.setAttribute('scrolling', o.scrolling === false ? 'no' : 'auto');
    rec.f.title = o.title || 'Konten tersemat';
  };
  EL.pdf = (ctx, src, o) => {
    o = o || {};
    const rec = place(ctx, 'pdf', '', r => { r.f = h('iframe', { class: 'slak-iframe slak-pdf', title: 'PDF' }); r.el = h('div', { class: 'slak-el slak-iframe-wrap' }, r.f); r.dispose = () => { if (r.own) URL.revokeObjectURL(r.own); }; });
    if (rec.raw !== src) {
      rec.raw = src;
      if (rec.own) URL.revokeObjectURL(rec.own);
      rec.own = null;
      let u;
      if (typeof src === 'string' && !/^(https?:|blob:|data:|\.|\/)/.test(src) && /^[A-Za-z0-9+/=\s]+$/.test(src) && src.length > 200) {
        const bin = atob(src.replace(/\s+/g, '')), b = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        u = rec.own = URL.createObjectURL(new Blob([b], { type: 'application/pdf' }));
      } else if (typeof src === 'string') u = src;
      else if (src && src.bytes instanceof Uint8Array) u = rec.own = URL.createObjectURL(new Blob([src.bytes], { type: 'application/pdf' }));
      else u = rec.own = srcURL(src instanceof Blob ? src : src, 'application/pdf');
      rec.f.src = u;
    }
    rec.f.style.height = sizePx(o.height != null ? o.height : 560);
  };

  EL.space = (ctx, size) => {
    const rec = place(ctx, 'space', '', r => { r.el = h('div', { class: 'slak-el slak-space', 'aria-hidden': 'true' }); });
    const v = size == null ? 'small' : size;
    rec.el.style.height = v === 'stretch' ? '' : (isNum(v) ? v + 'px' : { small: '8px', medium: '22px', large: '44px' }[v] || String(v));
    rec.el.style.flex = v === 'stretch' ? '1' : '';
  };

  EL.logo = (ctx, image, o) => {
    o = o || {};
    ctx.app.setLogo(image, o);
  };

  /* ---------- write_stream: tulisan mengalir seperti mesin ketik ---------- */

  EL.write_stream = async (ctx, src, o) => {
    o = o || {};
    const app = ctx.app;
    const rec = place(ctx, 'write_stream', '', r => { r.el = h('div', { class: 'slak-el slak-md slak-stream' }); });
    let text = '';
    let last = 0;
    const paint = force => {
      const now = Date.now();
      if (!force && now - last < 30) return;
      last = now;
      rec.el.innerHTML = md(text);
    };
    const chk = () => { if (app.abort) throw RERUN; };
    const piece = ch => {
      if (ch == null) return '';
      if (typeof ch === 'string') return ch;
      if (ch instanceof Uint8Array) return new TextDecoder().decode(ch);
      if (ch.choices && ch.choices[0]) return (ch.choices[0].delta && ch.choices[0].delta.content) || ch.choices[0].text || '';
      if (ch.delta && typeof ch.delta.text === 'string') return ch.delta.text;
      if (typeof ch.text === 'string') return ch.text;
      if (typeof ch.content === 'string') return ch.content;
      return typeof ch === 'object' ? JSON.stringify(ch) : String(ch);
    };
    if (typeof src === 'function' && !(src[Symbol.asyncIterator] || src[Symbol.iterator])) src = src();
    if (src && typeof src.then === 'function') src = await src;
    if (typeof Response !== 'undefined' && src instanceof Response) src = src.body;
    rec.el.classList.add('streaming');
    try {
      if (typeof src === 'string') {
        if (rec.full === src) { text = src; }
        else {
          const delay = o.delay != null ? o.delay : 14;
          const parts = src.match(/\S+\s*|\s+/g) || [];
          for (const p of parts) { text += p; paint(); chk(); if (delay) await new Promise(r => setTimeout(r, delay)); }
        }
      } else if (src && typeof src.getReader === 'function') {
        const reader = src.getReader(), dec = new TextDecoder();
        for (;;) { const { value, done } = await reader.read(); if (done) break; text += typeof value === 'string' ? value : dec.decode(value, { stream: true }); paint(); chk(); }
      } else if (src && src[Symbol.asyncIterator]) {
        for await (const ch of src) { text += piece(ch); paint(); chk(); }
      } else if (src && src[Symbol.iterator]) {
        for (const ch of src) { text += piece(ch); paint(); chk(); await new Promise(r => setTimeout(r, o.delay != null ? o.delay : 0)); }
      } else text = piece(src);
    } finally { rec.el.classList.remove('streaming'); }
    rec.full = text;
    paint(true);
    return text;
  };

  /* ---------- Wadah: popover, status, skeleton ---------- */

  let openPop = null;
  function closePops(e) {
    if (!openPop) return;
    if (e && openPop.el.contains(e.target)) return;
    openPop.panel.hidden = true; openPop.btn.setAttribute('aria-expanded', 'false'); openPop = null;
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', closePops, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePops(); });
  }
  EL.popover = (ctx, label, o, fn) => {
    if (typeof o === 'function') { fn = o; o = {}; }
    o = o || {};
    const rec = place(ctx, 'popover', o.key != null ? 'key:' + o.key : String(label), r => {
      r.btn = h('button', { type: 'button', class: 'slak-btn slak-pop-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
      r.panel = h('div', { class: 'slak-pop-panel slak-block', hidden: true, role: 'dialog' });
      r.el = h('div', { class: 'slak-el slak-pop' }, r.btn, r.panel);
      r.btn.addEventListener('click', () => {
        if (r.opts.disabled) return;
        const open = r.panel.hidden;
        closePops();
        r.panel.hidden = !open;
        r.btn.setAttribute('aria-expanded', String(open));
        if (open) {
          openPop = r;
          const box = r.el.getBoundingClientRect();
          r.panel.classList.toggle('right', box.left > window.innerWidth / 2);
        }
      });
      r.child = childCtx(r, r.panel, '', ctx);
    });
    rec.opts = o;
    rec.btn.innerHTML = iconHTML(o.icon) + `<span>${inline(esc(label))}</span><span class="slak-caret">▾</span>`;
    rec.btn.title = o.help || '';
    rec.btn.classList.toggle('primary', o.type === 'primary');
    rec.btn.classList.toggle('tertiary', o.type === 'tertiary');
    rec.btn.disabled = !!o.disabled;
    setWidth(rec.el, o.width);
    rec.btn.classList.toggle('full', o.width === 'stretch' || !!o.use_container_width);
    touch(rec.child);
    const api = makeAPI(rec.child);
    if (fn) fn(api);
    return api;
  };

  EL.status = (ctx, label, o, fn) => {
    if (typeof o === 'function') { fn = o; o = {}; }
    o = o || {};
    const rec = place(ctx, 'status', '', r => {
      r.ic = h('span', { class: 'slak-st-ic' });
      r.lab = h('span', { class: 'slak-st-lab' });
      r.sum = h('summary', {}, r.ic, r.lab);
      r.body = h('div', { class: 'slak-block slak-st-body' });
      r.el = h('details', { class: 'slak-el slak-statusbox' }, r.sum, r.body);
      r.child = childCtx(r, r.body, '', ctx);
      r.el.open = !!o.expanded;
      r.expSeen = !!o.expanded;
    });
    const apply = (lab, state, expanded) => {
      if (lab != null) rec.lab.innerHTML = inline(esc(lab));
      if (state) {
        rec.state = state;
        rec.el.dataset.state = state;
        rec.ic.innerHTML = state === 'running' ? '<span class="slak-spin"></span>' : state === 'error' ? '✕' : '✓';
      }
      if (expanded != null) rec.el.open = !!expanded;
    };
    if (!!o.expanded !== rec.expSeen) { rec.expSeen = !!o.expanded; rec.el.open = !!o.expanded; }
    apply(label, o.state || 'running');
    touch(rec.child);
    const api = makeAPI(rec.child);
    api.update = (u) => { u = u || {}; apply(u.label, u.state, u.expanded); };
    if (typeof fn === 'function') {
      let r;
      try { r = fn(api); } catch (e) { apply(null, 'error', true); throw e; }
      if (r && typeof r.then === 'function') return r.then(v => { if (rec.state === 'running') apply(null, 'complete', false); return v; }, e => { if (e !== RERUN) apply(null, 'error', true); throw e; });
      if (rec.state === 'running') apply(null, 'complete', o.expanded ? true : false);
      return r;
    }
    return api;
  };

  EL.skeleton = (ctx, o, fn) => {
    if (typeof o === 'function') { fn = o; o = {}; }
    o = isNum(o) ? { height: o } : (o || {});
    const rec = place(ctx, 'skeleton', '', r => {
      r.el = h('div', { class: 'slak-el slak-skel slak-block' });
      r.child = childCtx(r, r.el, '', ctx, { single: true });
    });
    rec.el.style.setProperty('--skh', o.height === 'stretch' ? '100%' : sizePx(o.height != null ? o.height : 40));
    setWidth(rec.el, o.width === 'stretch' ? null : o.width);
    if (typeof fn === 'function') {
      const done = () => { if (ctx.map.has(rec.id)) unplace(ctx, rec); };
      let r;
      try { r = fn(makeAPI(ctx)); } catch (e) { done(); throw e; }
      if (r && typeof r.then === 'function') return r.then(v => { done(); return v; }, e => { done(); throw e; });
      done();
      return r;
    }
    touch(rec.child);
    return makeAPI(rec.child);
  };

  /* ---------- Fragment dan dialog: jalan ulang sebagian ---------- */

  function fragSetup(r, ctx, fn, args) {
    r.fn = fn; r.args = args; r.isFrag = true;
    r.run = () => {
      touch(r.child);
      return r.fn(makeAPI(r.child), ...r.args);
    };
  }
  EL.fragment = (ctx, fn, o) => {
    if (typeof fn !== 'function') throw new Error('sl.fragment() butuh fungsi, misalnya const panel = sl.fragment((sl) => { ... }); panel();');
    o = o || {};
    const app = ctx.app;
    const id = o.key != null ? 'key:' + o.key : 'fn:' + CRYPTO.md5(fn.toString()).slice(0, 10);
    return (...args) => {
      const rec = place(ctx, 'fragment', id, r => {
        r.el = h('div', { class: 'slak-el slak-frag slak-block' });
        r.child = childCtx(r, r.el, '', ctx, { frag: r });
        r.dispose = () => { if (r.timer) clearInterval(r.timer); if (r.fkey != null && app.fragKeys.get(r.fkey) === r) app.fragKeys.delete(r.fkey); };
      });
      fragSetup(rec, ctx, fn, args);
      rec.fkey = o.key != null ? String(o.key) : null;
      if (rec.fkey != null) app.fragKeys.set(rec.fkey, rec);
      const ms = parseDuration(o.run_every);
      if (ms !== rec.every) {
        rec.every = ms;
        if (rec.timer) clearInterval(rec.timer);
        rec.timer = ms ? setInterval(() => { if (!app.destroyed && rec.ctx.map.has(rec.id)) app.rerunFragment(rec); }, Math.max(100, ms)) : null;
      }
      const r = rec.run();
      if (r && typeof r.then === 'function') app._pending.push(r);
      return r;
    };
  };

  EL.dialog = (ctx, title, fn, o) => {
    if (typeof title === 'function') { o = fn; fn = title; title = ''; }
    if (typeof fn !== 'function') throw new Error('sl.dialog() butuh judul dan fungsi, misalnya const edit = sl.dialog("Ubah data", (sl) => { ... }); if (sl.button("Ubah")) edit();');
    o = o || {};
    const app = ctx.app;
    return (...args) => {
      const dc = app.dialogCtx;
      const rec = place(dc, 'dialog', String(title), r => {
        r.title = title;
        r.head = h('div', { class: 'slak-dlg-title' });
        r.x = h('button', { type: 'button', class: 'slak-iconbtn slak-dlg-x', 'aria-label': 'Tutup', html: '&times;' });
        r.body = h('div', { class: 'slak-block slak-dlg-body' });
        r.panel = h('div', { class: 'slak-dlg', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'slak-dlg-top' }, r.head, r.x), r.body);
        r.el = h('div', { class: 'slak-dlg-back' }, r.panel);
        r.child = newCtx(app, r.body, 'dialog/' + title, { frag: r });
        const close = () => {
          if (!dc.map.has(r.id)) return;
          unplace(dc, r);
          app.root.classList.toggle('has-dialog', dc.map.size > 0);
          app.callback(r.opts.on_dismiss, r.opts.args);
          if (r.opts.on_dismiss === 'rerun' || typeof r.opts.on_dismiss === 'function') app.rerun();
        };
        r.close = close;
        r.x.addEventListener('click', close);
        r.el.addEventListener('mousedown', e => { if (e.target === r.el && r.opts.dismissible !== false) close(); });
        r.key = e => { if (e.key === 'Escape' && r.opts.dismissible !== false && dc.map.has(r.id)) close(); };
        document.addEventListener('keydown', r.key);
        r.dispose = () => document.removeEventListener('keydown', r.key);
      });
      for (const [k, other] of [...dc.map]) if (other !== rec) unplace(dc, other);
      rec.opts = o;
      rec.head.innerHTML = inline(esc(title));
      rec.x.hidden = o.dismissible === false;
      rec.panel.style.width = { small: '500px', medium: '750px', large: '1200px' }[o.width || 'small'] || sizePx(o.width);
      app.root.classList.add('has-dialog');
      fragSetup(rec, dc, fn, args);
      const r = rec.run();
      if (r && typeof r.then === 'function') app._pending.push(r);
      return r;
    };
  };

  /* ---------- Widget pilihan: pills, segmented_control, feedback, menu_button, pagination ---------- */

  function choiceGroup(kind) {
    return (ctx, label, options, o) => {
      o = o || {};
      options = toOptions(options);
      const multi = o.selection_mode === 'multi';
      let def = o.default !== undefined ? o.default : null;
      if (multi) def = def == null ? [] : [].concat(def);
      const rec = place(ctx, kind, ident(label, o), r => {
        fieldShell(r, 'slak-' + kind);
        r.box = h('div', { class: kind === 'pills' ? 'slak-pills' : 'slak-seg', role: 'group' });
        r.box.addEventListener('click', e => {
          const b = e.target.closest('button[data-i]');
          if (!b || r.opts.disabled) return;
          const opt = r.options[+b.dataset.i];
          if (r.multi) {
            const cur = (r.shown || []).slice();
            const k = optIndex(cur, opt);
            if (k >= 0) cur.splice(k, 1); else cur.push(opt);
            commit(r, r.options.filter(x => optIndex(cur, x) >= 0));
          } else commit(r, sameVal(r.shown, opt) && !r.opts.required ? null : opt);
          paintChoice(r);
        });
        r.el.append(r.box);
      });
      rec.multi = multi;
      let v = bindWidget(rec, ctx, o, def);
      if (multi) { const c = [].concat(v || []).filter(x => optIndex(options, x) >= 0); if (c.length !== [].concat(v || []).length) v = fixValue(rec, c); }
      else if (v != null && optIndex(options, v) < 0) v = fixValue(rec, def);
      rec.options = options;
      setLabel(rec, label, o);
      const ff = o.format_func || fmtOpt;
      const sig = options.map(x => ff(x)).join('\u0001');
      if (rec.sig !== sig) {
        rec.sig = sig;
        rec.box.innerHTML = options.map((op, i) => `<button type="button" data-i="${i}">${inline(esc(ff(op)))}</button>`).join('');
      }
      paintChoice(rec);
      rec.box.classList.toggle('slak-disabled', !!o.disabled);
      return multi ? (v || []).slice() : v;
    };
  }
  function paintChoice(r) {
    const cur = r.multi ? (r.shown || []) : (r.shown == null ? [] : [r.shown]);
    [...r.box.children].forEach((b, i) => {
      const on = optIndex(cur, r.options[i]) >= 0;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.disabled = !!r.opts.disabled;
    });
  }
  EL.pills = choiceGroup('pills');
  EL.segmented_control = choiceGroup('segmented_control');

  const FEEDBACK = {
    thumbs: { items: ['👍', '👎'], values: [1, 0] },
    faces: { items: ['😞', '🙁', '😐', '🙂', '😀'], values: [0, 1, 2, 3, 4] },
    stars: { items: ['★', '★', '★', '★', '★'], values: [0, 1, 2, 3, 4] }
  };
  EL.feedback = (ctx, options, o) => {
    if (isPlainObj(options)) { o = options; options = null; }
    o = o || {};
    const kind = FEEDBACK[options || 'thumbs'] ? (options || 'thumbs') : 'thumbs';
    const spec = FEEDBACK[kind];
    const rec = place(ctx, 'feedback', ident('feedback:' + kind, o), r => {
      r.box = h('div', { class: 'slak-feedback slak-fb-' + kind, role: 'group', 'aria-label': 'Umpan balik' });
      r.el = h('div', { class: 'slak-el slak-fb-wrap' }, r.box);
      r.box.innerHTML = spec.items.map((t, i) => `<button type="button" data-v="${spec.values[i]}" aria-label="${kind === 'stars' ? (i + 1) + ' bintang' : t}">${t}</button>`).join('');
      r.box.addEventListener('click', e => {
        const b = e.target.closest('button[data-v]');
        if (!b || r.opts.disabled) return;
        const v = +b.dataset.v;
        commit(r, r.shown === v ? null : v);
        paintFb(r);
      });
      if (kind === 'stars') {
        r.box.addEventListener('mouseover', e => { const b = e.target.closest('button[data-v]'); if (b) paintFb(r, +b.dataset.v); });
        r.box.addEventListener('mouseleave', () => paintFb(r));
      }
    });
    rec.kind = kind;
    const v = bindWidget(rec, ctx, o, o.default != null ? o.default : null);
    paintFb(rec);
    rec.box.classList.toggle('slak-disabled', !!o.disabled);
    return v;
  };
  function paintFb(r, hover) {
    const cur = hover != null ? hover : r.shown;
    [...r.box.children].forEach(b => {
      const v = +b.dataset.v;
      b.classList.toggle('on', r.kind === 'stars' ? cur != null && v <= cur : cur === v);
      b.disabled = !!r.opts.disabled;
    });
  }

  EL.menu_button = (ctx, label, options, o) => {
    o = o || {};
    options = toOptions(options);
    const rec = place(ctx, 'menu_button', ident(label, o), r => {
      r.b = h('button', { type: 'button', class: 'slak-btn slak-menu-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
      r.menu = h('div', { class: 'slak-menu', role: 'menu', hidden: true });
      r.el = h('div', { class: 'slak-el slak-btnwrap slak-menu-wrap' }, r.b, r.menu);
      r.panel = r.menu; r.btn = r.b;
      r.b.addEventListener('click', () => {
        if (r.opts.disabled) return;
        const open = r.menu.hidden;
        closePops();
        r.menu.hidden = !open;
        r.b.setAttribute('aria-expanded', String(open));
        if (open) openPop = r;
      });
      r.menu.addEventListener('click', e => {
        const it = e.target.closest('[data-i]');
        if (!it) return;
        closePops();
        trigger(r, { v: r.options[+it.dataset.i] });
      });
    });
    bindWidget(rec, ctx, o, null);
    rec.options = options;
    const ff = o.format_func || fmtOpt;
    rec.b.innerHTML = iconHTML(o.icon) + `<span>${inline(esc(label))}</span><span class="slak-caret">▾</span>`;
    rec.b.title = o.help || '';
    rec.b.classList.toggle('primary', o.type === 'primary');
    rec.b.classList.toggle('tertiary', o.type === 'tertiary');
    rec.b.disabled = !!o.disabled;
    rec.menu.innerHTML = options.map((op, i) => `<button type="button" role="menuitem" data-i="${i}">${inline(esc(ff(op)))}</button>`).join('');
    const hit = ctx.app.active.get(rec.wid);
    return hit && typeof hit === 'object' && 'v' in hit ? (isPlainObj(hit.v) ? Object.assign({}, hit.v) : Array.isArray(hit.v) ? hit.v.slice() : hit.v) : null;
  };

  EL.pagination = (ctx, num_pages, o) => {
    if (isPlainObj(num_pages)) { o = num_pages; num_pages = o.num_pages; }
    o = o || {};
    const n = Math.max(1, Math.floor(Number(num_pages) || 1));
    const rec = place(ctx, 'pagination', ident('pagination', o), r => {
      r.box = h('nav', { class: 'slak-pager', 'aria-label': 'Halaman' });
      r.el = h('div', { class: 'slak-el slak-pager-wrap' }, r.box);
      r.box.addEventListener('click', e => {
        const b = e.target.closest('button[data-p]');
        if (!b || b.disabled || r.opts.disabled) return;
        const p = +b.dataset.p;
        if (p !== r.shown) commit(r, p);
        paintPager(r);
      });
    });
    let v = bindWidget(rec, ctx, o, Math.min(n, Math.max(1, o.default || 1)));
    if (!isNum(v) || v < 1 || v > n) v = fixValue(rec, Math.min(n, Math.max(1, Number(v) || 1)));
    rec.n = n; rec.maxVis = o.max_visible_pages === undefined ? 7 : o.max_visible_pages;
    paintPager(rec);
    return v;
  };
  function paintPager(r) {
    const n = r.n, cur = r.shown, max = r.maxVis == null ? n : r.maxVis;
    let pages = [];
    if (max === 0) pages = [];
    else if (n <= max) pages = Array.from({ length: n }, (_, i) => i + 1);
    else {
      const side = Math.max(1, Math.floor((max - 3) / 2));
      let a = Math.max(2, cur - side), b = Math.min(n - 1, cur + side);
      if (cur - side <= 2) b = Math.min(n - 1, max - 2);
      if (cur + side >= n - 1) a = Math.max(2, n - max + 3);
      if (a === 3) a = 2;
      if (b === n - 2) b = n - 1;
      pages = [1, a > 2 ? '…' : null, ...Array.from({ length: b - a + 1 }, (_, i) => a + i), b < n - 1 ? '…' : null, n].filter(x => x != null);
    }
    const dis = !!r.opts.disabled;
    r.box.innerHTML = `<button type="button" data-p="${cur - 1}" aria-label="Sebelumnya"${cur <= 1 || dis ? ' disabled' : ''}>‹</button>` +
      pages.map(p => p === '…' ? '<span class="gap">…</span>' : `<button type="button" data-p="${p}"${p === cur ? ' class="on" aria-current="page"' : ''}${dis ? ' disabled' : ''}>${p}</button>`).join('') +
      `<button type="button" data-p="${cur + 1}" aria-label="Berikutnya"${cur >= n || dis ? ' disabled' : ''}>›</button>`;
  }

  EL.datetime_input = (ctx, label, ...rest) => {
    const o = A(rest, ['value']);
    const norm = v => {
      if (v == null || v === '') return null;
      if (v instanceof Date) { const p = n => String(n).padStart(2, '0'); return `${isoDay(v)} ${p(v.getHours())}:${p(v.getMinutes())}`; }
      return String(v).replace('T', ' ').slice(0, 16);
    };
    const now = () => norm(new Date());
    const rec = place(ctx, 'datetime_input', ident(label, o), r => {
      fieldShell(r, 'slak-datetime');
      r.inp = h('input', { class: 'slak-input', type: 'datetime-local' });
      r.inp.addEventListener('change', () => { const v = r.inp.value ? r.inp.value.replace('T', ' ') : null; if (v && v !== r.shown) commit(r, v); });
      r.el.append(r.inp);
    });
    const v = bindWidget(rec, ctx, o, o.value === null ? null : norm(o.value != null ? o.value : now()));
    setLabel(rec, label, o);
    if (o.min_value != null || o.min != null) rec.inp.min = norm(o.min_value != null ? o.min_value : o.min).replace(' ', 'T');
    if (o.max_value != null || o.max != null) rec.inp.max = norm(o.max_value != null ? o.max_value : o.max).replace(' ', 'T');
    if (o.step) rec.inp.step = o.step;
    const shown = rec.shown == null ? '' : String(rec.shown).replace(' ', 'T');
    if (canSync(rec, rec.inp) && rec.inp.value !== shown) rec.inp.value = shown;
    rec.inp.setAttribute('aria-label', label);
    setDisabled(rec, [rec.inp], o);
    return v;
  };

  /* ---------- Kamera dan mikrofon ---------- */

  async function blobToWav(blob, rate) {
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return blob;
    const ac = new AC();
    let buf;
    try { buf = await ac.decodeAudioData(await blob.arrayBuffer()); } catch (e) { ac.close && ac.close(); return blob; }
    ac.close && ac.close();
    const sr = rate || buf.sampleRate;
    let data;
    if (sr !== buf.sampleRate && global.OfflineAudioContext) {
      const off = new OfflineAudioContext(1, Math.ceil(buf.duration * sr), sr);
      const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start();
      data = (await off.startRendering()).getChannelData(0);
    } else {
      data = new Float32Array(buf.length);
      for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < ch.length; i++) data[i] += ch[i] / buf.numberOfChannels; }
    }
    const out = new DataView(new ArrayBuffer(44 + data.length * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + data.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, sr, true);
    out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, data.length * 2, true);
    for (let i = 0; i < data.length; i++) { const v = Math.max(-1, Math.min(1, data[i])); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
    return new Blob([out], { type: 'audio/wav' });
  }
  function mediaErr(e, what) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return `Izin ${what} ditolak. Izinkan akses ${what} di browser, lalu coba lagi.`;
    if (n === 'NotFoundError') return `Tidak ada ${what} yang terdeteksi.`;
    if (!navigator.mediaDevices) return `Browser ini tidak memberi akses ${what}. Gunakan halaman https:// atau localhost.`;
    return `${what[0].toUpperCase() + what.slice(1)} tidak bisa dipakai: ${e && e.message || e}`;
  }
  function recorder(rate, onDone, onErr) {
    let rec = null, stream = null, chunks = [];
    return {
      get active() { return !!rec; },
      async start() {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
        catch (e) { onErr(mediaErr(e, 'mikrofon')); return false; }
        chunks = [];
        rec = new MediaRecorder(stream);
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          rec = null;
          const wav = await blobToWav(blob, rate);
          const ext = wav.type === 'audio/wav' ? 'wav' : 'webm';
          onDone(await readUpload(new File([wav], 'rekaman.' + ext, { type: wav.type })));
        };
        rec.start();
        return true;
      },
      stop() { if (rec && rec.state !== 'inactive') rec.stop(); }
    };
  }

  EL.audio_input = (ctx, label, o) => {
    o = o || {};
    const rec = place(ctx, 'audio_input', ident(label, o), r => {
      fieldShell(r, 'slak-audioin');
      r.btn = h('button', { type: 'button', class: 'slak-rec-btn' });
      r.msg = h('span', { class: 'slak-rec-msg' });
      r.player = h('audio', { controls: true, class: 'slak-rec-play' });
      r.clear = h('button', { type: 'button', class: 'slak-rec-clear', text: 'Hapus', 'aria-label': 'Hapus rekaman' });
      r.el.append(h('div', { class: 'slak-rec' }, r.btn, r.msg, r.player, r.clear));
      r.mic = recorder(o.sample_rate === null ? null : (o.sample_rate || 16000), f => { r.recording = false; commit(r, f); paintRec(r); }, msg => { r.err = msg; r.recording = false; paintRec(r); });
      r.btn.addEventListener('click', async () => {
        if (r.opts.disabled) return;
        if (r.recording) { r.mic.stop(); r.btn.disabled = true; return; }
        r.err = null;
        if (await r.mic.start()) { r.recording = true; r.t0 = Date.now(); paintRec(r); r.tick = setInterval(() => paintRec(r), 500); }
      });
      r.clear.addEventListener('click', () => { commit(r, null); paintRec(r); });
      r.dispose = () => { r.mic.stop(); clearInterval(r.tick); };
    });
    bindWidget(rec, ctx, o, null);
    setLabel(rec, label, o);
    paintRec(rec);
    return rec.value;
  };
  function paintRec(r) {
    if (!r.recording) clearInterval(r.tick);
    r.btn.disabled = !!r.opts.disabled;
    r.btn.classList.toggle('on', !!r.recording);
    r.btn.innerHTML = r.recording ? '<i class="sq"></i> Berhenti' : '<i class="dot"></i> Rekam';
    const f = r.shown;
    r.msg.textContent = r.err ? r.err : r.recording ? `Merekam… ${Math.floor((Date.now() - r.t0) / 1000)} dtk` : f ? '' : 'Klik Rekam untuk mulai';
    r.msg.classList.toggle('err', !!r.err);
    r.player.hidden = !f || !!r.recording;
    r.clear.hidden = !f || !!r.recording;
    if (f && r.player.dataset.src !== f.url) { r.player.dataset.src = f.url; r.player.src = f.url; }
  }

  EL.camera_input = (ctx, label, o) => {
    o = o || {};
    const rec = place(ctx, 'camera_input', ident(label, o), r => {
      fieldShell(r, 'slak-camin');
      r.video = h('video', { autoplay: true, playsinline: true, muted: true });
      r.img = h('img', { alt: 'Foto' });
      r.msg = h('div', { class: 'slak-cam-msg' });
      r.shot = h('button', { type: 'button', class: 'slak-btn primary' });
      r.view = h('div', { class: 'slak-cam-view' }, r.video, r.img, r.msg);
      r.el.append(r.view, h('div', { class: 'slak-cam-bar' }, r.shot));
      const stopCam = () => { if (r.stream) { r.stream.getTracks().forEach(t => t.stop()); r.stream = null; } };
      r.dispose = stopCam;
      r.shot.addEventListener('click', async () => {
        if (r.opts.disabled) return;
        if (r.shown) { commit(r, null); paintCam(r); return; }
        if (!r.stream) {
          try { r.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); r.video.srcObject = r.stream; r.err = null; }
          catch (e) { r.err = mediaErr(e, 'kamera'); }
          paintCam(r);
          return;
        }
        const cv = document.createElement('canvas');
        cv.width = r.video.videoWidth || 640; cv.height = r.video.videoHeight || 480;
        cv.getContext('2d').drawImage(r.video, 0, 0, cv.width, cv.height);
        const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92));
        stopCam();
        commit(r, await readUpload(new File([blob], 'foto.jpg', { type: 'image/jpeg' })));
        paintCam(r);
      });
    });
    bindWidget(rec, ctx, o, null);
    setLabel(rec, label, o);
    paintCam(rec);
    return rec.value;
  };
  function paintCam(r) {
    const f = r.shown;
    r.img.hidden = !f;
    if (f && r.img.getAttribute('src') !== f.url) r.img.src = f.url;
    r.video.hidden = !!f || !r.stream;
    r.msg.hidden = !!f || !!r.stream;
    r.msg.textContent = r.err || 'Kamera belum aktif';
    r.msg.classList.toggle('err', !!r.err);
    r.shot.textContent = f ? 'Hapus foto' : r.stream ? 'Ambil foto' : 'Nyalakan kamera';
    r.shot.disabled = !!r.opts.disabled;
  }

  /* ---------- Grafik dari pustaka luar (dimuat saat dipakai) ---------- */

  function themeIsDark(app) {
    const t = app.root.dataset.theme;
    return t === 'dark' || (t === 'auto' && global.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function libChart(kind, lib, render) {
    return (ctx, spec, o) => {
      o = o || {};
      const app = ctx.app;
      const rec = place(ctx, kind, o.key != null ? 'key:' + o.key : '', r => {
        r.box = h('div', { class: 'slak-ext-box' });
        r.el = h('div', { class: 'slak-el slak-ext-chart', 'data-kind': kind }, r.box);
        r.el.addEventListener('slak-theme', () => { r.sig = null; r.redraw && r.redraw(); });
        r.dispose = () => { if (r.cleanup) r.cleanup(); };
      });
      const sel = o.on_select && o.on_select !== 'ignore';
      if (sel) bindWidget(rec, ctx, Object.assign({}, o, { on_change: typeof o.on_select === 'function' ? o.on_select : null }), { selection: { points: [], point_indices: [], box: [], lasso: [] } });
      rec.opts = o; rec.app = app; rec.selectable = sel;
      if (o.height) rec.box.style.height = sizePx(o.height);
      setWidth(rec.el, o.width === 'stretch' ? null : o.width);
      let sig;
      try { sig = stableKey([spec, o.height, o.theme]); } catch (e) { sig = Math.random(); }
      rec.redraw = () => {
        rec.box.classList.add('loading');
        if (!rec.box.firstChild || rec.failed) rec.box.innerHTML = `<div class="slak-ext-load"><span class="slak-spin"></span> Memuat ${LIB_NAME[lib]}…</div>`;
        rec.failed = false;
        loadLib(lib).then(L => Promise.resolve(render(rec, L, spec, o, themeIsDark(app)))).then(() => rec.box.classList.remove('loading'), e => {
          rec.failed = true;
          rec.box.classList.remove('loading');
          rec.box.innerHTML = `<div class="slak-ext-err">${esc(e && e.message || e)}</div>`;
        });
      };
      if (rec.sig !== sig) { rec.sig = sig; rec.redraw(); }
      return sel ? rec.value : undefined;
    };
  }
  const chartColors = el => Array.from({ length: 8 }, (_, i) => cssVar(el, `--slak-c${i + 1}`, '#888'));
  EL.plotly_chart = libChart('plotly_chart', 'plotly', (rec, Plotly, fig, o, dark) => {
    fig = fig || {};
    const el = rec.el, fg = cssVar(el, '--fg', '#222'), line = cssVar(el, '--line', '#ddd');
    const data = Array.isArray(fig) ? fig : (fig.data || []);
    const base = o.theme === null ? {} : {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { color: fg, family: getComputedStyle(el).fontFamily },
      colorway: chartColors(el), margin: { t: 40, r: 16, b: 40, l: 48 },
      xaxis: { gridcolor: line, zerolinecolor: line }, yaxis: { gridcolor: line, zerolinecolor: line }
    };
    const layout = Object.assign({}, base, fig.layout || {});
    if (o.height) layout.height = o.height;
    if (!rec.box.classList.contains('slak-plotly')) { rec.box.innerHTML = ''; rec.box.classList.add('slak-plotly'); }
    return Plotly.react(rec.box, data, layout, Object.assign({ responsive: true, displaylogo: false }, fig.config || o.config || {})).then(() => {
      if (rec.selectable && !rec.bound) {
        rec.bound = true;
        const send = (ev, kind) => {
          const pts = (ev && ev.points || []).map(p => ({ x: p.x, y: p.y, curve_number: p.curveNumber, point_index: p.pointIndex != null ? p.pointIndex : p.pointNumber, label: p.label, value: p.value }));
          commit(rec, { selection: { points: pts, point_indices: pts.map(p => p.point_index), box: kind === 'box' && ev.range ? [ev.range] : [], lasso: kind === 'lasso' && ev.lassoPoints ? [ev.lassoPoints] : [] } });
        };
        rec.box.on('plotly_selected', ev => send(ev, ev && ev.lassoPoints ? 'lasso' : 'box'));
        rec.box.on('plotly_click', ev => send(ev, 'click'));
      }
      rec.cleanup = () => { try { Plotly.purge(rec.box); } catch (e) { /* abaikan */ } };
    });
  });
  EL.echarts_chart = libChart('echarts_chart', 'echarts', (rec, echarts, option, o, dark) => {
    if (!rec.box.style.height) rec.box.style.height = '400px';
    if (rec.inst && rec.instDark !== dark) { rec.inst.dispose(); rec.inst = null; }
    if (!rec.inst) {
      rec.box.innerHTML = '';
      rec.inst = echarts.init(rec.box, o.theme === null ? null : (dark ? 'dark' : null), { renderer: o.renderer || 'canvas' });
      rec.instDark = dark;
      if (typeof ResizeObserver !== 'undefined') { rec.ro = new ResizeObserver(() => rec.inst && rec.inst.resize()); rec.ro.observe(rec.box); }
      rec.cleanup = () => { if (rec.ro) rec.ro.disconnect(); if (rec.inst) rec.inst.dispose(); };
      if (rec.selectable) rec.inst.on('click', p => commit(rec, { selection: { points: [{ name: p.name, value: p.value, series_name: p.seriesName, series_index: p.seriesIndex, data_index: p.dataIndex }], point_indices: [p.dataIndex], box: [], lasso: [] } }));
    }
    const opt = Object.assign({ color: chartColors(rec.el), backgroundColor: 'transparent' }, option || {});
    rec.inst.setOption(opt, true);
  });


  /* sl.secrets (1.7): padanan st.secrets. Halaman Slak dikirim utuh ke browser, jadi rahasia tidak boleh
     ditulis di sini; tempatnya di slak-bridge (password database, kunci API) yang tinggal di server. */
  const SECRETS = typeof Proxy === 'undefined' ? {} : new Proxy({}, {
    get(t, k) {
      if (typeof k === 'symbol' || k === 'toJSON' || k === 'then') return undefined;
      throw new Error(`sl.secrets["${String(k)}"] tidak tersedia: halaman Slak dikirim utuh ke browser pengunjung, jadi rahasia di dalamnya bisa dibaca siapa saja. Simpan password database dan kunci API di slak-bridge.php atau slak-bridge.js di server, lalu pakai sl.connection (Bab 33).`);
    },
    has() { return false; }, ownKeys() { return []; }
  });
  /* sl.pydeck_chart (1.7): spesifikasi deck.gl JSON, sama dengan pydeck.Deck(...).to_json().
     deck.gl dan @deck.gl/json (MIT) dimuat dari internet hanya saat dipakai. */
  let deckJSON = null;
  function loadDeck() {
    if (deckJSON) return deckJSON;
    deckJSON = loadLib('deckgl').then(D => new Promise((res, rej) => {
      // bundel @deck.gl/json menimpa window.deck, jadi simpan dulu lalu gabungkan
      const keep = global.deck;
      const s = document.createElement('script');
      s.src = (Slak.lib_urls && Slak.lib_urls.deckgl_json) || LIB_URLS.deckgl_json;
      s.onload = () => { const J = global.deck; global.deck = Object.assign(keep, { JSONConverter: J.JSONConverter, JSONConfiguration: J.JSONConfiguration }); res(global.deck); };
      s.onerror = () => { global.deck = keep; deckJSON = null; rej(new Error('deck.gl belum bisa dimuat. sl.pydeck_chart butuh internet saat pertama dipakai.')); };
      document.head.append(s);
    }));
    return deckJSON;
  }
  function deckData(v) {
    if (v && typeof v === 'object' && typeof v.to_records === 'function') return v.to_records();
    if (Array.isArray(v)) return v.map(x => x && typeof x === 'object' && !Array.isArray(x) ? deckData(x) : x);
    if (isPlainObj(v)) { const o = {}; for (const k in v) o[k] = k === 'data' || (v[k] && typeof v[k].to_records === 'function') ? deckData(v[k]) : (Array.isArray(v[k]) || isPlainObj(v[k]) ? deckData(v[k]) : v[k]); return o; }
    return v;
  }
  EL.pydeck_chart = (ctx, spec, o) => {
    o = o || {};
    const run = libChart('pydeck_chart', 'deckgl', async (rec, _D, sp, op, dark) => {
      const deck = await loadDeck();
      if (typeof sp === 'string') sp = JSON.parse(sp);
      sp = deckData(sp || {});
      const classes = {};
      for (const k in deck) if (/Layer$/.test(k) || /View$/.test(k)) classes[k] = deck[k];
      const conv = new deck.JSONConverter({ configuration: new deck.JSONConfiguration({ classes, enumerations: { COORDINATE_SYSTEM: deck.COORDINATE_SYSTEM } }) });
      const props = conv.convert(Object.assign({}, sp, { mapStyle: undefined, mapProvider: undefined, api_keys: undefined }));
      const layers = [].concat(props.layers || []);
      if (sp.map_style !== null && op.map_style !== null) {
        // peta dasar tanpa kunci (pydeck memakai Carto/Mapbox yang butuh kunci). deck.gl memuat ubin lewat fetch;
        // server OSM menolak fetch dari halaman klik dua kali (asal "null"), jadi di sana dipakai ubin Humanitarian OSM.
        const web = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
        rec.tileUrl = web ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
        layers.unshift(new deck.TileLayer({ id: 'slak-osm', data: rec.tileUrl, minZoom: 0, maxZoom: 19, tileSize: 256,
          renderSubLayers: p => { const b = p.tile.bbox; return new deck.BitmapLayer(p, { data: null, image: p.data, bounds: [b.west, b.south, b.east, b.north] }); } }));
      }
      if (!rec.box.style.height) rec.box.style.height = sizePx(op.height || 500);
      rec.box.style.position = 'relative';
      const vs = props.initialViewState || sp.initial_view_state || { longitude: 117, latitude: -2.5, zoom: 4 };
      const cfg = { initialViewState: vs, controller: true, layers, getTooltip: props.getTooltip || (sp.tooltip ? (({ object }) => object && (sp.tooltip.html ? { html: sp.tooltip.html.replace(/\{(\w+)\}/g, (_, k) => esc(object[k])) } : { text: sp.tooltip.text ? sp.tooltip.text.replace(/\{(\w+)\}/g, (_, k) => object[k]) : JSON.stringify(object) })) : null) };
      if (rec.inst) rec.inst.setProps(cfg);
      else {
        rec.box.innerHTML = '';
        rec.inst = new deck.Deck(Object.assign({ parent: rec.box, style: { position: 'absolute', inset: 0 } }, cfg));
        rec.cleanup = () => { try { rec.inst.finalize(); } catch (e) { /* abaikan */ } };
      }
      const at = h('div', { class: 'slak-map-attrib', html: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' + (rec.tileUrl && /hot/.test(rec.tileUrl) ? ', ubin Humanitarian OSM Team' : '') });
      at.style.cssText = 'position:absolute;right:4px;bottom:2px;font-size:11px;background:rgba(255,255,255,.75);padding:0 4px;border-radius:3px;z-index:2';
      rec.box.append(at);
    });
    return run(ctx, spec, o);
  };
  /* ======================================================================
   * Komponen kustom dua arah (Slak 1.7)
   *   sl.component(html, { args, key, default, height })
   *   const pilih = sl.components.declare_component("nama", { url: "komponen/build/index.html" })
   * Memakai protokol pesan yang sama dengan komponen Streamlit (streamlit:render,
   * streamlit:setComponentValue, streamlit:setFrameHeight), sehingga komponen Streamlit
   * yang sudah di-build (folder build/ berisi index.html) bisa dipakai langsung.
   * ==================================================================== */
  const COMP_SHIM = `<script>(function(){
var P=window.parent,args={},theme={},disabled=false,fns=[],ev=new EventTarget(),manual=false,lastH=-1;
function send(type,o){var m={isStreamlitMessage:true,type:type};for(var k in o)m[k]=o[k];P.postMessage(m,"*");}
function height(h,auto){if(h==null)h=Math.ceil(document.documentElement.getBoundingClientRect().height);if(h===lastH)return;lastH=h;send("streamlit:setFrameHeight",{height:h,auto:!!auto});}
var C={get args(){return args;},get theme(){return theme;},get disabled(){return disabled;},
 setValue:function(v){send("streamlit:setComponentValue",{value:v,dataType:v instanceof Uint8Array?"bytes":"json"});},
 setHeight:function(h){manual=true;height(h);},
 onRender:function(f){fns.push(f);if(C._ready)try{f(args,C);}catch(e){console.error(e);}}};
window.Slak=window.Slak||{};window.Slak.component=C;
window.Streamlit={RENDER_EVENT:"streamlit:render",events:ev,setComponentValue:C.setValue,setFrameHeight:function(h){manual=true;height(h);},setComponentReady:function(){send("streamlit:componentReady",{apiVersion:1});}};
window.addEventListener("message",function(e){var d=e.data;if(!d||d.type!=="streamlit:render")return;args=d.args||{};theme=d.theme||{};disabled=!!d.disabled;C._ready=true;
 if(theme.textColor){var s=document.documentElement.style;s.setProperty("--slak-fg",theme.textColor);s.setProperty("--slak-bg",theme.backgroundColor);s.setProperty("--slak-panel",theme.secondaryBackgroundColor);s.setProperty("--slak-accent",theme.primaryColor);s.setProperty("--slak-font",theme.font);s.colorScheme=theme.base;}
 fns.forEach(function(f){try{f(args,C);}catch(err){console.error(err);}});
 var x=new Event("streamlit:render");x.detail={args:args,disabled:disabled,theme:theme};ev.dispatchEvent(x);});
function auto(){if(!manual)height(null,true);}
if(window.ResizeObserver)new ResizeObserver(auto).observe(document.documentElement);
window.addEventListener("load",function(){auto();send("streamlit:componentReady",{apiVersion:1});});
})();<\/script><style>html{color-scheme:light dark}body{margin:0;font-family:var(--slak-font,system-ui,sans-serif);color:var(--slak-fg,inherit);background:transparent}</style>`;
  const compRecs = new Map();   // jendela iframe -> rec
  let compListen = false;
  function compListener() {
    if (compListen) return; compListen = true;
    global.addEventListener('message', e => {
      const d = e.data;
      if (!d || typeof d !== 'object' || !d.isStreamlitMessage) return;
      const rec = compRecs.get(e.source);
      if (!rec || rec.app.destroyed) return;
      if (d.type === 'streamlit:componentReady') { rec.ready = true; compRender(rec, true); }
      else if (d.type === 'streamlit:setFrameHeight') {
        if (rec.fixedH || !isNum(d.height)) return;
        rec.f.style.height = Math.max(0, d.height) + 'px';
      } else if (d.type === 'streamlit:setComponentValue') {
        let v = d.value;
        if (d.dataType === 'dataframe') { rec.app.toast('Komponen mengirim tabel Arrow, yang belum didukung Slak. Kirim sebagai daftar objek (JSON).', '!'); return; }
        if (d.dataType === 'bytes' && v && !(v instanceof Uint8Array)) v = new Uint8Array(v);
        let same = false; try { same = JSON.stringify(v) === JSON.stringify(rec.value); } catch (err) { /* abaikan */ }
        if (same && !(v instanceof Uint8Array)) return;
        commit(rec, v);
      }
    });
  }
  function compTheme(rec) {
    const el = rec.app.root;
    const bg = cssVar(el, '--bg', '#ffffff'), rgb = hexRgb(bg);
    const dark = rgb ? (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) < 128 : rec.app.root.dataset.theme === 'dark';
    return { base: dark ? 'dark' : 'light', primaryColor: cssVar(el, '--accent', '#0f766e'), backgroundColor: bg, secondaryBackgroundColor: cssVar(el, '--panel', '#f5f5f4'), textColor: cssVar(el, '--fg', '#1c1917'), font: cssVar(el, '--font', 'system-ui, sans-serif') };
  }
  function compRender(rec, force) {
    if (!rec.ready || !rec.f.contentWindow) return;
    let sig; try { sig = JSON.stringify([rec.args, rec.disabled]); } catch (e) { sig = Math.random(); }
    const th = compTheme(rec), tsig = JSON.stringify(th);
    if (!force && sig === rec.sentSig && tsig === rec.sentTheme) return;
    rec.sentSig = sig; rec.sentTheme = tsig;
    rec.f.style.colorScheme = rec.isHTML ? th.base : 'normal';   // sama dengan dokumen di dalamnya, supaya latarnya tetap transparan
    try { rec.f.contentWindow.postMessage({ type: 'streamlit:render', args: rec.args, dfs: [], disabled: rec.disabled, theme: th }, '*'); } catch (e) { /* abaikan */ }
  }
  const COMP_RESERVED = ['key', 'default', 'height', 'width', 'disabled', 'on_change', 'args', 'persist'];
  /* Galeri komponen siap pakai (Slak 1.7): slak-komponen.js mendaftarkan komponen bernama,
   * misalnya sl.component("rating", { max: 5 }). Komponen buatan sendiri juga bisa didaftarkan:
   * Slak.registerComponent("nama", { html: "<...>", default: args => nilai_awal, desc: "..." }) */
  const COMP_REG = Object.create(null);
  const GALLERY = ['rating', 'sketsa', 'rentang_tanggal', 'kalender_heatmap', 'kanban', 'titik_peta', 'editor_kode', 'pengatur_waktu', 'papan_skor', 'tombol_suara'];
  function registerComponent(name, def) {
    if (typeof name !== 'string' || !/^[a-z][\w-]*$/i.test(name)) throw new Error('Slak.registerComponent butuh nama sederhana, misalnya "rating".');
    if (!def || typeof def.html !== 'string') throw new Error(`Slak.registerComponent("${name}") butuh { html: "<...>" }.`);
    COMP_REG[name] = Object.assign({ name }, def);
    return COMP_REG[name];
  }
  function compSpec(src) {
    if (src && (typeof src === 'object' || typeof src === 'function') && src.__slakComponent) return src;
    if (typeof src === 'string' && COMP_REG[src]) { const d = COMP_REG[src]; return { html: d.html, cname: src, reg: d }; }
    if (typeof src === 'string' && GALLERY.includes(src)) throw new Error(`Komponen "${src}" ada di galeri komponen Slak. Muat slak-komponen.js sesudah slak.js: <script src="slak-komponen.js"></script> (di Slak Studio otomatis).`);
    if (typeof src === 'string') return /^\s*</.test(src) ? { html: src } : { url: src };
    if (isPlainObj(src) && (src.html || src.url || src.path)) return { html: src.html, url: src.url || src.path, cname: src.name };
    throw new Error('sl.component() butuh kode HTML (teks yang diawali <), alamat index.html komponen, atau hasil sl.components.declare_component().');
  }
  function compHTML(html) {
    const m = /<head[^>]*>/i.exec(html);
    if (m) return html.slice(0, m.index + m[0].length) + COMP_SHIM + html.slice(m.index + m[0].length);
    return '<!doctype html><meta charset="utf-8">' + COMP_SHIM + html;
  }
  EL.component = (ctx, src, o) => {
    o = o || {};
    const spec = compSpec(src);
    const name = spec.cname || (spec.url ? spec.url : 'html');
    const rec = place(ctx, 'component', o.key != null ? 'key:' + o.key : name, r => {
      r.f = h('iframe', { class: 'slak-iframe slak-component', title: spec.cname || 'Komponen', allow: 'clipboard-write; camera; microphone; geolocation; fullscreen' });
      r.f.style.border = '0'; r.f.style.width = '100%'; r.f.style.display = 'block';
      r.el = h('div', { class: 'slak-el slak-component-wrap' }, r.f);
      r.dispose = () => { if (r.win) compRecs.delete(r.win); };
    });
    compListener();
    const app = ctx.app;
    if (!app._compObs && global.MutationObserver) {
      // tema berganti (tombol tema, set_option, atau tema sistem): kirim ulang ke semua komponen
      const again = () => setTimeout(() => { for (const r of compRecs.values()) if (r.app === app) compRender(r, false); }, 30);
      app._compObs = new MutationObserver(again);
      app._compObs.observe(app.root, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
      try { global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', again); } catch (e) { /* abaikan */ }
    }
    let args = o.args;
    if (args === undefined) { args = {}; for (const k in o) if (!COMP_RESERVED.includes(k)) args[k] = o[k]; }
    let def0 = o.default !== undefined ? o.default : null;
    if (o.default === undefined && spec.reg && spec.reg.default !== undefined) def0 = typeof spec.reg.default === 'function' ? spec.reg.default(args || {}) : spec.reg.default;
    const v = bindWidget(rec, ctx, o, def0);
    rec.args = deckData(args || {});
    rec.disabled = !!o.disabled;
    rec.fixedH = o.height != null;
    const want = spec.html != null ? 'html:' + spec.html : 'url:' + spec.url;
    if (rec.loaded !== want) {
      rec.loaded = want; rec.ready = false; rec.sentSig = null; rec.isHTML = spec.html != null;
      if (rec.win) compRecs.delete(rec.win);
      if (spec.html != null) { rec.f.removeAttribute('src'); rec.f.srcdoc = compHTML(spec.html); }
      else {
        let u = String(spec.url);
        if (global.Slak && global.Slak.componentBase && !/^([a-z][\w+.-]*:|\/)/i.test(u)) u = global.Slak.componentBase + u.replace(/^\.\//, '');
        const full = /\.html?(\?|#|$)/i.test(u) ? u : u.replace(/\/?$/, '/index.html');
        rec.f.removeAttribute('srcdoc');
        const withQ = full + (full.includes('?') ? '&' : '?') + 'streamlitUrl=' + encodeURIComponent(String(location.href).split('#')[0]);
        const base = global.Slak && global.Slak.componentBase;
        rec.f.src = base && withQ.startsWith(base) ? withQ : safeUrl(withQ, true);
      }
      if (!rec.fixedH) rec.f.style.height = (spec.reg && spec.reg.height ? spec.reg.height : spec.html != null ? 150 : 100) + 'px';
    }
    // jendela iframe baru tersedia sesudah elemen masuk dokumen
    if (rec.f.contentWindow && rec.win !== rec.f.contentWindow) { if (rec.win) compRecs.delete(rec.win); rec.win = rec.f.contentWindow; compRecs.set(rec.win, rec); }
    if (rec.fixedH) rec.f.style.height = sizePx(o.height);
    setWidth(rec.el, o.width === 'stretch' ? null : o.width);
    compRender(rec, false);
    return v;
  };
  function declareComponent(name, o) {
    if (typeof name !== 'string' || !name) throw new Error('declare_component butuh nama, misalnya sl.components.declare_component("bintang", { url: "bintang/index.html" }).');
    o = isPlainObj(o) ? o : { url: o };
    if (!o.url && !o.path && !o.html) throw new Error(`declare_component("${name}") butuh { url: "folder/index.html" } atau { html: "<...>" }.`);
    return { __slakComponent: true, cname: name, url: o.url || o.path, html: o.html };
  }
  /* ======================================================================
   * sl.report (Slak 1.7): laporan Markdown dengan blok SQL yang dijalankan.
   *   await sl.report(`# Laporan
   *   Omzet total: **{{ ringkas.omzet | rp }}**
   *   ```sql name=ringkas
   *   SELECT SUM(total) AS omzet FROM penjualan
   *   ```
   *   ```sql chart=bar x=kota y=omzet
   *   SELECT kota, SUM(total) AS omzet FROM penjualan GROUP BY kota ORDER BY omzet DESC
   *   ````, { tables: { penjualan: sl.dataset("penjualan") } })
   * ==================================================================== */
  function reportParts(src) {
    const parts = [], re = /^([ \t]*)(```|~~~)[ \t]*sql\b([^\n]*)\n([\s\S]*?)\n[ \t]*\2[ \t]*$/gim;
    let last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) parts.push({ text: src.slice(last, m.index) });
      const opt = {};
      for (const t of m[3].match(/[\w-]+="[^"]*"|[\w-]+='[^']*'|[\w-]+=\S+|[\w-]+/g) || []) {
        const i = t.indexOf('=');
        if (i < 0) opt[t.toLowerCase()] = true;
        else opt[t.slice(0, i).toLowerCase()] = t.slice(i + 1).replace(/^(["'])(.*)\1$/, '$2');
      }
      parts.push({ sql: m[4], opt, line: src.slice(0, m.index).split('\n').length });
      last = m.index + m[0].length;
    }
    if (last < src.length) parts.push({ text: src.slice(last) });
    return parts;
  }
  function reportFmt(v, f) {
    if (v == null) return '—';
    f = (f || '').trim().toLowerCase();
    if (f === 'rp' || f === 'rupiah') return isNum(v) ? 'Rp' + Math.round(v).toLocaleString('id-ID') : String(v);
    if (f === 'persen' || f === '%') return isNum(v) ? (v * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%' : String(v);
    if (/^\d$/.test(f)) return isNum(v) ? v.toLocaleString('id-ID', { minimumFractionDigits: +f, maximumFractionDigits: +f }) : String(v);
    if (f === 'tanggal' && (v instanceof Date || typeof v === 'string')) { const d = v instanceof Date ? v : new Date(v); return isNaN(d) ? String(v) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
    if (f) { try { return makeFmt(f)(v); } catch (e) { /* format tidak dikenal */ } }
    return isNum(v) ? v.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : v instanceof Date ? v.toLocaleDateString('id-ID') : String(v);
  }
  function reportVal(results, expr) {
    const [path, f] = expr.split('|');
    const bits = path.trim().split('.');
    const r = results[bits[0]];
    if (!r) return `⟨${bits[0]}?⟩`;
    const t = toTable(r);
    if (bits.length === 1) return reportFmt(t.rows.length, f);
    if (bits[1] === 'length' || bits[1] === 'baris') return reportFmt(t.rows.length, f);
    const col = bits[1], row = bits[2] != null ? +bits[2] : 0;
    if (!t.cols.includes(col)) return `⟨${bits[0]}.${col}?⟩`;
    return reportFmt(t.rows[row] ? t.rows[row][col] : null, f);
  }
  async function reportRun(sqlText, o) {
    const db = o.db;
    const params = o.params;
    if (db && typeof db.query === 'function') return db.query(sqlText, params ? { params } : undefined);
    if (typeof db === 'function') return db(sqlText, o.tables || {});   // mis. sl.duckdb
    if (!EXT.api.sql) throw new Error('sl.report butuh slak-sql.js untuk menjalankan SQL atas tabel. Tambahkan <script src="slak-sql.js"></script>, atau isi { db: koneksi }.');
    return EXT.api.sql(sqlText, o.tables || o.data || {}, params ? { params } : undefined);
  }
  EL.report = async (ctx, src, o) => {
    o = o || {};
    if (typeof src !== 'string') throw new Error('sl.report butuh teks Markdown, atau nama berkas .md.');
    if (/^[^\n<`#]*\.(md|markdown|txt)$/i.test(src.trim())) src = new TextDecoder().decode(await loadFile(src.trim()));
    const parts = reportParts(src);
    const results = Object.assign({}, o.results || {});
    let n = 0;
    // 1. jalankan semua blok SQL lebih dulu, supaya {{ nama.kolom }} bisa dipakai di mana saja
    for (const p of parts) {
      if (!p.sql) continue;
      n++;
      const nm = p.opt.name || p.opt.nama || ('hasil' + n);
      try { p.res = await reportRun(p.sql, o); results[nm] = p.res; }
      catch (e) { p.err = String(e && e.message || e); }
    }
    // 2. tampilkan berurutan
    const api = makeAPI(ctx);
    const fill = t => t.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, x) => reportVal(results, x).replace(/[*_`[\]]/g, '\\$&'));
    for (const p of parts) {
      if (p.text != null) { if (p.text.trim()) api.markdown(fill(p.text)); continue; }
      const op = p.opt;
      const show = op.hide || op.sembunyi ? 'none' : (op.show || op.tampil || (op.chart || op.grafik ? 'chart' : 'table'));
      if (p.err) { api.error(`**Blok SQL baris ${p.line}:** ${p.err}`); if (op.code || op.kode || o.show_sql) api.code(p.sql.trim(), { language: 'sql' }); continue; }
      if (show === 'none') continue;
      const box = op.code || op.kode || o.show_sql ? api.container() : api;
      if (op.title || op.judul) box.markdown('**' + (op.title || op.judul) + '**');
      const isFrame = p.res && (typeof p.res.to_records === 'function' || Array.isArray(p.res));
      if (!isFrame) { box.caption(p.res && p.res.rowCount != null ? `${p.res.rowCount} baris berubah.` : 'Selesai.'); continue; }
      const kind = String(op.chart || op.grafik || '').toLowerCase();
      if (show === 'chart' || show === 'both' || show === 'keduanya') {
        const co = { x: op.x, y: op.y ? op.y.split(',') : undefined, by: op.by, color: op.color, format: op.format, horizontal: op.horizontal === true || op.horizontal === 'true', height: op.height ? +op.height : undefined };
        if (kind === 'pie') box.pie_chart(p.res, { names: op.x || op.names, values: op.y || op.values });
        else if (kind === 'line') box.line_chart(p.res, co);
        else if (kind === 'area') box.area_chart(p.res, co);
        else if (kind === 'scatter') box.scatter_chart(p.res, co);
        else box.bar_chart(p.res, co);
      }
      if (show === 'table' || show === 'both' || show === 'keduanya') box.dataframe(p.res, { hide_index: true, height: op.height && show === 'table' ? +op.height : undefined });
      if (op.code || op.kode || o.show_sql) box.expander('SQL', e => e.code(p.sql.trim(), { language: 'sql' }));
    }
    return results;
  };

  /* ======================================================================
   * sl.layout (Slak 1.7): kerangka halaman dasbor dengan area bernama.
   *   const area = sl.layout("kpi-atas")
   *   area.kpi.metric("Omzet", 120); area.grafik.bar_chart(df); area.tabel.dataframe(df)
   * ==================================================================== */
  const LAYOUTS = {
    'kpi-atas': { areas: ['kpi', 'grafik', 'tabel'], desc: 'baris angka utama di atas, grafik, lalu tabel' },
    'sidebar-filter': { areas: ['kpi', 'grafik', 'tabel'], side: 'filter', desc: 'filter di sidebar, angka utama, grafik, dan tabel' },
    'grid-2x2': { areas: ['kpi', 'kiri_atas', 'kanan_atas', 'kiri_bawah', 'kanan_bawah'], desc: 'angka utama di atas dan empat kotak grafik 2 × 2' },
    'laporan': { areas: ['judul', 'ringkasan', 'isi', 'catatan'], desc: 'laporan satu kolom yang nyaman dibaca' }
  };
  EL.layout = (ctx, name, o) => {
    if (isPlainObj(name)) { o = name; name = o.template; }
    o = o || {};
    name = String(name || 'kpi-atas');
    const T = LAYOUTS[name];
    if (!T) throw new Error(`sl.layout: templat "${name}" tidak dikenal. Pilih salah satu: ${Object.keys(LAYOUTS).map(k => '"' + k + '"').join(', ')}.`);
    if (o.title && !T.areas.includes('judul')) EL.title(ctx, o.title);
    if (o.caption && !T.areas.includes('judul')) EL.caption(ctx, o.caption);
    const rec = place(ctx, 'layout', name, r => {
      r.el = h('div', { class: 'slak-el slak-block slak-layout slak-layout-' + name });
      r.areas = {};
      for (const a of T.areas) {
        const el = h('div', { class: 'slak-layout-area slak-area-' + a + (a === 'kpi' ? ' slak-kpi-row' : '') });
        r.el.append(el);
        r.areas[a] = childCtx(r, el, a, ctx);
      }
    });
    const out = {};
    for (const a of T.areas) { touch(rec.areas[a]); out[a] = makeAPI(rec.areas[a]); }
    if (T.side) out[T.side] = makeAPI(ctx.app.sideCtx);
    if (o.title && out.judul) out.judul.title(o.title);
    if (o.caption && out.judul) out.judul.caption(o.caption);
    if (T.side && o.filter_title !== false) out[T.side].header(o.filter_title || 'Filter');
    return out;
  };
  EL.layout.templates = LAYOUTS;
  let mermaidN = 0;
  EL.mermaid_chart = libChart('mermaid_chart', 'mermaid', async (rec, mermaid, code, o, dark) => {
    mermaid.initialize({ startOnLoad: false, theme: o.theme || (dark ? 'dark' : 'default'), securityLevel: 'strict' });
    const { svg } = await mermaid.render('slak-mmd-' + (++mermaidN), String(code || ''));
    rec.box.innerHTML = svg;
  });
  EL.graphviz_chart = libChart('graphviz_chart', 'graphviz', async (rec, Viz, dot, o, dark) => {
    const viz = await Viz.instance();
    const svg = viz.renderSVGElement(String(dot || ''));
    svg.removeAttribute('width'); svg.style.maxWidth = '100%'; svg.style.height = 'auto';
    if (dark) svg.classList.add('slak-gv-dark');
    rec.box.innerHTML = ''; rec.box.append(svg);
  });

  /* ---------- Vega-Lite (subset) digambar dengan mesin grafik Slak, tanpa internet ---------- */

  function vlAgg(rows, by, field, agg) {
    const groups = new Map();
    for (const r of rows) {
      const key = by.map(b => fmtCat(r[b])).join('\u0000');
      let g = groups.get(key);
      if (!g) { g = { row: Object.fromEntries(by.map(b => [b, r[b]])), vals: [] }; groups.set(key, g); }
      if (agg === 'count') g.vals.push(1); else if (isNum(r[field])) g.vals.push(r[field]);
    }
    const f = {
      sum: v => v.reduce((a, b) => a + b, 0), count: v => v.length, mean: v => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null,
      average: v => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, min: v => v.length ? minOf(v) : null, max: v => v.length ? maxOf(v) : null,
      median: v => { if (!v.length) return null; const s = v.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; },
      distinct: v => new Set(v).size
    }[agg] || (v => v.reduce((a, b) => a + b, 0));
    return [...groups.values()].map(g => Object.assign(g.row, { [field || 'count']: f(g.vals) }));
  }
  EL.vega_lite_chart = (ctx, data, spec, o) => {
    if (spec === undefined || (isPlainObj(data) && (data.mark || data.encoding || data.$schema) && !isPlainObj(spec) || (isPlainObj(spec) && !spec.mark && !spec.encoding))) {
      if (isPlainObj(data) && (data.mark || data.encoding || data.$schema)) { o = spec; spec = data; data = null; }
    }
    spec = spec || {}; o = Object.assign({}, o || {});
    let rows = toTable(data != null ? data : (spec.data && (spec.data.values || spec.data))).rows;
    const mark = typeof spec.mark === 'string' ? spec.mark : (spec.mark && spec.mark.type) || 'bar';
    const enc = spec.encoding || {};
    const fld = e => e && (e.field || (e.aggregate === 'count' ? 'count' : null));
    const x = fld(enc.x), y = fld(enc.y), color = fld(enc.color), theta = fld(enc.theta);
    const title = typeof spec.title === 'string' ? spec.title : spec.title && spec.title.text;
    const base = Object.assign({ title, height: isNum(spec.height) ? spec.height : undefined, x_label: enc.x && enc.x.title, y_label: enc.y && enc.y.title }, o);
    const aggOf = e => e && e.aggregate;
    if (aggOf(enc.y) || aggOf(enc.x)) {
      const ag = aggOf(enc.y) ? enc.y : enc.x, dim = aggOf(enc.y) ? x : y;
      rows = vlAgg(rows, [dim, color].filter(Boolean), ag.field, ag.aggregate);
    }
    const horiz = enc.x && enc.x.type === 'quantitative' && enc.y && (enc.y.type === 'nominal' || enc.y.type === 'ordinal');
    if (mark === 'arc') return EL.pie_chart(ctx, rows, Object.assign(base, { names: color, values: theta, hole: spec.mark && spec.mark.innerRadius ? 0.55 : undefined }));
    if (mark === 'rect') return EL.heatmap(ctx, rows, Object.assign(base, { x, y, value: color }));
    const cat = horiz ? y : x, val = horiz ? x : y;
    const opts = Object.assign(base, { x: cat, y: val, by: color && color !== cat ? color : undefined });
    const st = enc.y && enc.y.stack !== undefined ? enc.y.stack : (enc.x && enc.x.stack);
    if (st !== undefined) opts.stack = st === 'zero' ? true : st;
    if (mark === 'bar') { if (horiz) opts.horizontal = true; if (opts.by && opts.stack === undefined) opts.stack = true; return EL.bar_chart(ctx, rows, opts); }
    if (mark === 'line' || mark === 'trail') return EL.line_chart(ctx, rows, opts);
    if (mark === 'area') return EL.area_chart(ctx, rows, opts);
    if (mark === 'point' || mark === 'circle' || mark === 'square' || mark === 'tick') return EL.scatter_chart(ctx, rows, opts);
    throw new Error(`Jenis mark "${mark}" belum didukung di sl.vega_lite_chart. Yang didukung: bar, line, area, point, circle, square, arc, rect.`);
  };
  EL.altair_chart = (ctx, chart, o) => {
    const spec = chart && typeof chart.to_dict === 'function' ? chart.to_dict() : chart;
    return EL.vega_lite_chart(ctx, null, spec, o);
  };

  /* ---------- write(): elemen serbaguna ---------- */

  EL.write = (ctx, ...vals) => {
    for (const v of vals) {
      if (v != null && typeof v === 'object' && EXT.write.some(f => f(ctx, v, EL))) continue;
      if (v == null) EL.markdown(ctx, '`' + String(v) + '`');
      else if (typeof v === 'string') EL.markdown(ctx, v);
      else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') EL.markdown(ctx, esc(isNum(v) ? fmtNum(v) : String(v)));
      else if (v instanceof Error) EL.exception(ctx, v);
      else if (v instanceof Date) EL.markdown(ctx, esc(v.toLocaleString(LOCALE)));
      else if (Array.isArray(v) && v.length && v.every(r => isPlainObj(r) || Array.isArray(r))) EL.dataframe(ctx, v);
      else if (isPlainObj(v) && Object.keys(v).length && Object.values(v).every(Array.isArray)) EL.dataframe(ctx, v);
      else EL.json(ctx, v);
    }
  };

  /* ======================================================================
   * API untuk pengguna: setiap konteks punya objek `sl` sendiri
   * ==================================================================== */

  /* ======================================================================
   * Penyimpanan lokal: sl.local_state (Slak 1.1)
   * ==================================================================== */

  const lsKey = id => 'slak:local:' + id;
  function loadLocal(id) {
    try {
      const raw = localStorage.getItem(lsKey(id));
      if (raw) {
        const v = JSON.parse(raw);
        if (isPlainObj(v) && isPlainObj(v.state)) return { state: v.state, widgets: isPlainObj(v.widgets) ? v.widgets : {} };
      }
    } catch (e) { /* penyimpanan tidak tersedia */ }
    return { state: {}, widgets: {} };
  }
  function defaultAppId() {
    try { return decodeURIComponent(location.pathname || '') || 'slak'; } catch (e) { return 'slak'; }
  }

  /* ======================================================================
   * Database: sl.db (IndexedDB) — Slak 1.1
   * ==================================================================== */

  const DBS = new Map();
  const RESERVED_DB = new Set(['name', 'schema', 'apps', 'table', 'tables', 'table_names', 'ready', 'export', 'import', 'delete', 'close', 'then']);

  function idbAvailable() {
    try { return typeof indexedDB !== 'undefined' && indexedDB !== null && typeof indexedDB.open === 'function'; } catch (e) { return false; }
  }
  function idxSpec(tok) {
    tok = String(tok).trim();
    const unique = tok.startsWith('&'), multi = tok.startsWith('*');
    return { name: tok.replace(/^[&*]/, ''), unique, multi };
  }
  function parseStoreSpec(spec) {
    if (spec == null || spec === true) return { key: 'id', auto: true, indexes: [] };
    if (typeof spec === 'string') {
      const toks = spec.split(',').map(s => s.trim());
      const first = toks.shift() || '++id';
      const auto = first.startsWith('++');
      const key = first.replace(/^\+\+/, '').replace(/^[&*]/, '') || 'id';
      if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(key)) throw new Error(`Nama kunci "${key}" tidak valid. Gunakan huruf, angka, dan garis bawah, misalnya "++id" atau "kode".`);
      return { key, auto, indexes: toks.filter(Boolean).map(idxSpec) };
    }
    if (isPlainObj(spec)) {
      const key = spec.key || 'id';
      const auto = spec.auto != null ? !!spec.auto : !spec.key || spec.key === 'id';
      const idx = [].concat(spec.index || spec.indexes || []).map(i => typeof i === 'string' ? idxSpec(i) : { name: i.name, unique: !!i.unique, multi: !!(i.multi || i.multiEntry) });
      return { key, auto, indexes: idx };
    }
    throw new Error('Skema tabel tidak dikenali. Contoh: { produk: "++id, kategori" }');
  }
  function reqP(r) {
    return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }
  function dbErr(e, store) {
    const n = e && e.name;
    const msg = {
      ConstraintError: `Data dengan kunci yang sama sudah ada di tabel "${store}".`,
      DataError: `Kunci atau nilai tidak valid untuk tabel "${store}". Kunci harus berupa angka, teks, atau tanggal.`,
      NotFoundError: `Tabel "${store}" tidak ada. Tambahkan ke skema, misalnya sl.db("nama", { ${store}: "++id" }).`,
      QuotaExceededError: 'Ruang penyimpanan browser penuh.',
      DataCloneError: 'Nilai tidak bisa disimpan ke database (fungsi atau objek khusus tidak didukung).',
      InvalidStateError: 'Koneksi database tertutup. Coba jalankan ulang aplikasi.'
    }[n];
    if (!msg) return e instanceof Error ? e : new Error(String(e && e.message || e));
    const err = new Error(msg);
    err.name = 'DatabaseError';
    err.cause = e;
    return err;
  }
  function needsUpgrade(db, schema) {
    if (!schema) return false;
    let tx;
    for (const name of Object.keys(schema)) {
      if (!db.objectStoreNames.contains(name)) return true;
    }
    try { tx = db.transaction(Object.keys(schema), 'readonly'); } catch (e) { return true; }
    for (const [name, sp] of Object.entries(schema)) {
      const os = tx.objectStore(name);
      const want = new Map(sp.indexes.map(i => [i.name, i]));
      const have = [...os.indexNames];
      if (have.length !== want.size) return true;
      for (const n of have) {
        const w = want.get(n);
        if (!w) return true;
        const ix = os.index(n);
        if (!!ix.unique !== !!w.unique || !!ix.multiEntry !== !!w.multi) return true;
      }
    }
    return false;
  }
  function openDb(name, version, schema) {
    return new Promise((res, rej) => {
      const r = version ? indexedDB.open(name, version) : indexedDB.open(name);
      r.onupgradeneeded = () => {
        if (!schema) return;
        const db = r.result, tx = r.transaction;
        for (const [store, sp] of Object.entries(schema)) {
          const os = db.objectStoreNames.contains(store) ? tx.objectStore(store)
            : db.createObjectStore(store, { keyPath: sp.key, autoIncrement: sp.auto });
          const want = new Map(sp.indexes.map(i => [i.name, i]));
          for (const n of [...os.indexNames]) {
            const w = want.get(n), ix = os.index(n);
            if (!w || !!ix.unique !== !!w.unique || !!ix.multiEntry !== !!w.multi) os.deleteIndex(n);
          }
          for (const w of want.values()) if (!os.indexNames.contains(w.name)) os.createIndex(w.name, w.name, { unique: w.unique, multiEntry: w.multi });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => console.warn(`Slak: database "${name}" sedang dibuka di tab lain; menunggu tab itu ditutup.`);
    });
  }

  class Database {
    constructor(name, schemaIn) {
      this.name = name;
      this.schema = schemaIn ? Object.fromEntries(Object.entries(schemaIn).map(([k, v]) => [k, parseStoreSpec(v)])) : null;
      this.apps = new Set();
      this._tables = {};
      if (this.schema) {
        for (const t of Object.keys(this.schema)) {
          const tb = this.table(t);
          if (!RESERVED_DB.has(t) && !(t in this)) this[t] = tb;
        }
      }
    }
    table(name) {
      if (!this._tables[name]) this._tables[name] = new Table(this, String(name));
      return this._tables[name];
    }
    ready() {
      if (!this._open) {
        this._open = (async () => {
          if (!idbAvailable()) throw new Error('Database tidak tersedia: browser atau mode halaman ini tidak mengizinkan IndexedDB.');
          let db = await openDb(this.name, 0, null);
          if (needsUpgrade(db, this.schema)) {
            const v = db.version + 1;
            db.close();
            try { db = await openDb(this.name, v, this.schema); }
            catch (e) {
              const err = new Error(`Gagal membuat atau memperbarui database "${this.name}": ${e && e.message || e}. Periksa penulisan skema.`);
              err.name = 'DatabaseError';
              throw err;
            }
          }
          db.onversionchange = () => { db.close(); this._open = null; };
          this._db = db;
          return db;
        })();
        this._open.catch(() => { this._open = null; });
      }
      return this._open;
    }
    async table_names() { const db = await this.ready(); return [...db.objectStoreNames]; }
    get tables() { return this.schema ? Object.keys(this.schema) : Object.keys(this._tables); }
    _tx(store, mode, fn) {
      const started = new Map([...this.apps].map(a => [a, a.running ? a.runId : -1]));
      if (mode === 'readonly') for (const a of this.apps) if (a.running) a._dbReadRun = a.runId;
      const readFirst = new Map([...this.apps].map(a => [a, a.running && a._dbReadRun === a.runId]));
      return this.ready().then(db => new Promise((resolve, reject) => {
        let tx;
        try { tx = db.transaction([store], mode); } catch (e) { reject(dbErr(e, store)); return; }
        let out;
        tx.oncomplete = () => {
          resolve(out);
          if (mode === 'readwrite') this._changed(started, readFirst);
        };
        tx.onerror = () => reject(dbErr(tx.error, store));
        tx.onabort = () => reject(dbErr(tx.error || new Error('Transaksi dibatalkan'), store));
        Promise.resolve().then(() => fn(tx.objectStore(store))).then(v => { out = v; }, e => {
          try { tx.abort(); } catch (_) { /* sudah selesai */ }
          reject(dbErr(e, store));
        });
      }));
    }
    _changed(started, readFirst) {
      for (const app of this.apps) {
        if (app.destroyed) { this.apps.delete(app); continue; }
        if (!app.running) app.rerun();
        else if (started.get(app) !== app.runId || readFirst.get(app)) app._rerunAfter = true;
      }
    }
    async export() {
      const out = {};
      for (const t of await this.table_names()) out[t] = await this.table(t).all();
      return out;
    }
    async import(data, o) {
      o = o || {};
      if (typeof data === 'string') data = JSON.parse(data);
      if (!isPlainObj(data)) throw new Error('Data impor harus berupa objek { tabel: [baris, ...] }.');
      let n = 0;
      for (const [t, rows] of Object.entries(data)) {
        if (!Array.isArray(rows)) continue;
        if (o.clear) await this.table(t).clear();
        await this.table(t).put(rows);
        n += rows.length;
      }
      return n;
    }
    close() { if (this._db) this._db.close(); this._open = null; this._db = null; }
    async delete() {
      this.close();
      for (const [k, v] of DBS) if (v === this || v.name === this.name) { v.close(); DBS.delete(k); }
      await reqP(indexedDB.deleteDatabase(this.name));
    }
  }

  function getField(r, f) { return r == null ? undefined : r[f]; }
  function keyVal(v) { return v instanceof Date ? v.getTime() : v; }

  class Table {
    constructor(db, name) { this.db = db; this.name = name; }
    get key() { const s = this.db.schema && this.db.schema[this.name]; return s ? s.key : 'id'; }
    get auto() { const s = this.db.schema && this.db.schema[this.name]; return s ? s.auto : true; }
    _tx(mode, fn) { return this.db._tx(this.name, mode, fn); }
    _clean(o, os) {
      if (!isPlainObj(o)) throw new Error(`Data untuk tabel "${this.name}" harus berupa objek, misalnya { nama: "Kopi" }.`);
      const kp = os.keyPath;
      if (os.autoIncrement && typeof kp === 'string' && o[kp] == null) { const c = Object.assign({}, o); delete c[kp]; return c; }
      return o;
    }
    insert(obj) {
      const many = Array.isArray(obj);
      return this._tx('readwrite', async os => {
        const keys = [];
        for (const o of many ? obj : [obj]) keys.push(await reqP(os.add(this._clean(o, os))));
        return many ? keys : keys[0];
      });
    }
    put(obj) {
      const many = Array.isArray(obj);
      return this._tx('readwrite', async os => {
        const keys = [];
        for (const o of many ? obj : [obj]) keys.push(await reqP(os.put(this._clean(o, os))));
        return many ? keys : keys[0];
      });
    }
    get(key) {
      if (isPlainObj(key)) return this.where(Object.keys(key)[0]).equals(Object.values(key)[0]).first();
      return this._tx('readonly', async os => { const v = await reqP(os.get(key)); return v === undefined ? null : v; });
    }
    update(key, changes) {
      return this._tx('readwrite', async os => {
        const cur = await reqP(os.get(key));
        if (cur === undefined) return null;
        const next = typeof changes === 'function' ? (changes(Object.assign({}, cur)) || cur) : Object.assign({}, cur, changes);
        if (typeof os.keyPath === 'string') next[os.keyPath] = cur[os.keyPath];
        await reqP(os.put(next));
        return next;
      });
    }
    delete(key) {
      const many = Array.isArray(key);
      return this._tx('readwrite', async os => {
        for (const k of many ? key : [key]) await reqP(os.delete(k));
        return many ? key.length : 1;
      });
    }
    clear() { return this._tx('readwrite', os => reqP(os.clear())); }
    count() { return this._tx('readonly', os => reqP(os.count())); }
    all() { return new Collection(this).all(); }
    first() { return new Collection(this).first(); }
    where(field) { return new Where(this, field); }
    filter(fn) { return new Collection(this).filter(fn); }
    orderBy(field, dir) { return new Collection(this).sortBy(field, dir); }
    sortBy(field, dir) { return this.orderBy(field, dir); }
    limit(n) { return new Collection(this).limit(n); }
    offset(n) { return new Collection(this).offset(n); }
    reverse() { return new Collection(this).reverse(); }
    export() { return this.all(); }
    async import(rows, o) {
      if (typeof rows === 'string') rows = /^\s*[[{]/.test(rows) ? JSON.parse(rows) : parseCSV(rows);
      if (o && o.clear) await this.clear();
      await this.put(rows);
      return rows.length;
    }
  }

  class Where {
    constructor(t, f) { this.t = t; this.f = f; }
    _c(range, pred) { return new Collection(this.t, { field: this.f, range, pred }); }
    equals(v) { return this._c(() => IDBKeyRange.only(v), r => sameVal(keyVal(getField(r, this.f)), keyVal(v))); }
    notEqual(v) { return this._c(null, r => !sameVal(keyVal(getField(r, this.f)), keyVal(v))); }
    above(v) { return this._c(() => IDBKeyRange.lowerBound(v, true), r => getField(r, this.f) != null && getField(r, this.f) > v); }
    aboveOrEqual(v) { return this._c(() => IDBKeyRange.lowerBound(v), r => getField(r, this.f) != null && getField(r, this.f) >= v); }
    below(v) { return this._c(() => IDBKeyRange.upperBound(v, true), r => getField(r, this.f) != null && getField(r, this.f) < v); }
    belowOrEqual(v) { return this._c(() => IDBKeyRange.upperBound(v), r => getField(r, this.f) != null && getField(r, this.f) <= v); }
    between(a, b, incLo, incHi) {
      const lo = incLo !== false, hi = !!incHi;
      return this._c(() => IDBKeyRange.bound(a, b, !lo, !hi), r => { const x = getField(r, this.f); return x != null && (lo ? x >= a : x > a) && (hi ? x <= b : x < b); });
    }
    startsWith(s) { return this._c(() => IDBKeyRange.bound(s, s + '￿'), r => typeof getField(r, this.f) === 'string' && getField(r, this.f).startsWith(s)); }
    startsWithIgnoreCase(s) { const l = String(s).toLowerCase(); return this._c(null, r => String(getField(r, this.f) || '').toLowerCase().startsWith(l)); }
    contains(s) { const l = String(s).toLowerCase(); return this._c(null, r => { const x = getField(r, this.f); return Array.isArray(x) ? x.some(y => sameVal(y, s)) : String(x == null ? '' : x).toLowerCase().includes(l); }); }
    anyOf(arr) { const a = [].concat(arr); return this._c(null, r => a.some(v => sameVal(keyVal(getField(r, this.f)), keyVal(v)))); }
    noneOf(arr) { const a = [].concat(arr); return this._c(null, r => !a.some(v => sameVal(keyVal(getField(r, this.f)), keyVal(v)))); }
  }

  class Collection {
    constructor(t, src) { this.t = t; this.src = src || null; this.preds = []; this.sorts = []; this._lim = Infinity; this._off = 0; this._rev = false; }
    filter(fn) { this.preds.push(fn); return this; }
    and(fn) { return this.filter(fn); }
    sortBy(field, dir) { this.sorts.push({ field, desc: dir === 'desc' || dir === -1 || dir === false }); return this; }
    orderBy(field, dir) { return this.sortBy(field, dir); }
    reverse() { this._rev = !this._rev; return this; }
    limit(n) { this._lim = Math.max(0, n | 0); return this; }
    offset(n) { this._off = Math.max(0, n | 0); return this; }
    _fetch() {
      const s = this.src;
      return this.t._tx('readonly', async os => {
        if (s && s.range && (s.field === os.keyPath || os.indexNames.contains(s.field))) {
          let range = null;
          try { range = s.range(); } catch (e) { range = null; }
          if (range) return reqP(s.field === os.keyPath ? os.getAll(range) : os.index(s.field).getAll(range));
        }
        return reqP(os.getAll());
      });
    }
    async all() {
      let rows = await this._fetch();
      if (this.src && this.src.pred) rows = rows.filter(this.src.pred);
      for (const p of this.preds) rows = rows.filter(p);
      if (this.sorts.length) {
        rows.sort((a, b) => {
          for (const s of this.sorts) { const c = cmp(getField(a, s.field), getField(b, s.field)); if (c) return s.desc ? -c : c; }
          return 0;
        });
      }
      if (this._rev) rows.reverse();
      return rows.slice(this._off, this._lim === Infinity ? undefined : this._off + this._lim);
    }
    async first() { const r = await this.limit(1).all(); return r.length ? r[0] : null; }
    async count() { return (await this.all()).length; }
    async keys() { const k = this.t.key; return (await this.all()).map(r => r[k]); }
    async delete() { const k = await this.keys(); if (k.length) await this.t.delete(k); return k.length; }
    async update(changes) { const k = await this.keys(); for (const key of k) await this.t.update(key, changes); return k.length; }
    then(res, rej) { return this.all().then(res, rej); }
  }

  function useDb(app, name, schema) {
    if (!name) throw new Error('Beri nama database, misalnya sl.db("toko", { produk: "++id, nama" }).');
    const sig = name + '\u0000' + stableKey(schema || null);
    let db = DBS.get(sig);
    if (!db) {
      for (const [k, v] of DBS) if (v.name === name) { v.close(); DBS.delete(k); }
      db = new Database(String(name), schema);
      DBS.set(sig, db);
    }
    if (app) { db.apps.add(app); app.dbNames.add(db.name); }
    return db;
  }
  async function dbList() {
    if (!idbAvailable() || !indexedDB.databases) return [];
    return (await indexedDB.databases()).map(d => d.name).filter(Boolean);
  }

  /* ======================================================================
   * Editor tabel: sl.data_editor (Slak 1.1)
   * ==================================================================== */

  function cssq(v) { return String(v).replace(/["\\]/g, '\\$&'); }
  /** Sampel merata (maks 5000 baris) untuk menebak jenis kolom tabel besar tanpa memindai semuanya. */
  function sampleRows(rows, k) {
    k = k || 5000;
    if (rows.length <= k) return rows;
    const out = new Array(k), st = rows.length / k;
    for (let i = 0; i < k; i++) out[i] = rows[Math.floor(i * st)];
    out[k - 1] = rows[rows.length - 1];
    return out;
  }
  function inferType(rows, c) {
    const vals = sampleRows(rows).map(r => r[c]).filter(v => v != null && v !== '');
    if (!vals.length) return 'text';
    if (vals.every(v => typeof v === 'boolean')) return 'checkbox';
    if (vals.every(isNum)) return 'number';
    if (vals.every(v => v instanceof Date)) return vals.some(v => v.getHours() || v.getMinutes() || v.getSeconds()) ? 'datetime' : 'date';
    if (vals.every(Array.isArray)) return 'list';
    if (vals.every(v => isPlainObj(v))) return 'json';
    if (vals.every(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))) return 'date';
    return 'text';
  }
  const EMPTY_ED = () => ({ edited_rows: {}, added_rows: [], deleted_rows: [] });
  /** Format perubahan ala Streamlit; format lama {e, a, d} (Slak 1.1/1.2) tetap dibaca. */
  function normEd(d) {
    if (!d) return EMPTY_ED();
    if (d.edited_rows || d.added_rows || d.deleted_rows) return { edited_rows: d.edited_rows || {}, added_rows: d.added_rows || [], deleted_rows: d.deleted_rows || [] };
    return { edited_rows: d.e || {}, added_rows: d.a || [], deleted_rows: d.d || [] };
  }
  function cloneEd(d) {
    d = normEd(d);
    const cp = v => v instanceof Date ? new Date(v.getTime()) : v;
    const er = {};
    for (const k in d.edited_rows) { er[k] = {}; for (const c in d.edited_rows[k]) er[k][c] = cp(d.edited_rows[k][c]); }
    return { edited_rows: er, added_rows: d.added_rows.map(r => { const o = {}; for (const c in r) o[c] = cp(r[c]); return o; }), deleted_rows: d.deleted_rows.slice() };
  }
  function applyDelta(base, d) {
    d = normEd(d);
    const out = [];
    base.forEach((r, i) => {
      if (d.deleted_rows.includes(i)) return;
      out.push(d.edited_rows[i] ? Object.assign({}, r, d.edited_rows[i]) : Object.assign({}, r));
    });
    for (const a of d.added_rows) out.push(Object.assign({}, a));
    return out;
  }
  function edCell(v, cf) {
    if (typeof cf === 'string') cf = { type: cf };
    if (cf.type === 'checkbox') return `<input type="checkbox" tabindex="-1"${v ? ' checked' : ''}>`;
    if (cf.type === 'date' && v instanceof Date && !cf.format) return esc(isoDay(v));
    return cellView(v, cf).html;
  }
  function isoDay(d) {
    if (!(d instanceof Date) || isNaN(d)) return '';
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  const ED_VIRT = 300;
  function edRange(rec) {
    const n = rec.view.rows.length, rh = rec.rowH || 34, vh = rec.box.clientHeight || 400;
    const st = Math.max(0, Math.floor(rec.box.scrollTop / rh) - 20);
    return [st, Math.min(n, st + Math.ceil(vh / rh) + 40)];
  }
  function edWindow(rec) {
    const n = rec.view.rows.length, rh = rec.rowH || 34, [a, b] = edRange(rec);
    const span = rec.view.cols.length + (rec.dynamic ? 1 : 0) + (rec.o.hide_index ? 0 : 1);
    let html = a > 0 ? `<tr class="vpad" aria-hidden="true"><td colspan="${span}" style="height:${a * rh}px;padding:0;border:0"></td></tr>` : '';
    for (let i = a; i < b; i++) html += rec.rowHtml(i);
    if (b < n) html += `<tr class="vpad" aria-hidden="true"><td colspan="${span}" style="height:${(n - b) * rh}px;padding:0;border:0"></td></tr>`;
    rec.vWin = [a, b];
    return html;
  }
  function edRepaint(rec, force) {
    const [a, b] = edRange(rec);
    if (!force && rec.vWin && a === rec.vWin[0] && b === rec.vWin[1]) return;
    const tb = rec.box.querySelector('tbody');
    if (!tb) return;
    tb.innerHTML = edWindow(rec);
    stickPinned(rec.box);
  }
  function edEnsureVisible(rec, k) {
    const rh = rec.rowH || 34, top = k * rh, vh = rec.box.clientHeight || 400;
    if (top < rec.box.scrollTop || top + rh > rec.box.scrollTop + vh - rh) rec.box.scrollTop = Math.max(0, top - vh / 2);
  }

  function renderEditor(rec) {
    const { cols, conf, rows, ids } = rec.view;
    const o = rec.o;
    const dyn = rec.dynamic;
    let html = '<table><thead><tr>' + (dyn ? '<th class="del"><span class="slak-sr">Hapus</span></th>' : '') + (o.hide_index ? '' : '<th class="idx"><span class="slak-sr">Indeks</span></th>') +
      cols.map(c => `<th class="${conf[c].type === 'number' ? 'n' : ''}${conf[c].pinned ? ' pin' : ''}" style="${colStyle(conf[c])}" title="${esc(conf[c].help || '')}">${esc(conf[c].label)}${conf[c].ro ? ' <span class="ro">🔒</span>' : ''}</th>`).join('') + '</tr></thead><tbody>';
    const rowHtml = i => {
      const r = rows[i];
      return `<tr data-r="${esc(ids[i])}">` + (dyn ? `<td class="del"><button type="button" data-del="${esc(ids[i])}" title="Hapus baris" aria-label="Hapus baris">×</button></td>` : '') +
        (o.hide_index ? '' : `<td class="idx">${esc(rec.dbMode ? r[rec.keyName] : i)}</td>`) +
        cols.map((c, j) => `<td data-c="${j}" style="${colStyle(conf[c])}" class="${conf[c].ro ? 'ro' : 'ed'}${conf[c].type === 'number' ? ' n' : ''}${conf[c].type === 'checkbox' ? ' cb' : ''}${conf[c].pinned ? ' pin' : ''}">${edCell(r[c], conf[c])}</td>`).join('') + '</tr>';
    };
    rec.rowHtml = rowHtml;
    /* Baris banyak: hanya baris yang terlihat yang digambar (virtual), sisanya diganti ruang kosong. */
    const virt = rows.length > ED_VIRT;
    rec.virt = virt;
    if (virt) {
      if (rec.nextEdit) { const k = ids.findIndex(x => String(x) === String(rec.nextEdit.r)); if (k >= 0) edEnsureVisible(rec, k); }
      html += edWindow(rec);
    } else for (let i = 0; i < rows.length; i++) html += rowHtml(i);
    if (!rows.length) html += `<tr><td class="empty" colspan="${cols.length + (dyn ? 1 : 0) + (o.hide_index ? 0 : 1)}">Belum ada data${dyn ? ' — klik "Tambah baris"' : ''}.</td></tr>`;
    html += '</tbody></table>';
    rec.box.innerHTML = html;
    if (!rec.virtBound) { rec.virtBound = true; rec.box.addEventListener('scroll', () => { if (!rec.virt || rec.editing || rec.vRaf) return; rec.vRaf = requestAnimationFrame(() => { rec.vRaf = 0; edRepaint(rec); }); }, { passive: true }); }
    if (virt && !rec.rowH) { const tr = rec.box.querySelector('tbody tr[data-r]'); if (tr && tr.offsetHeight) { rec.rowH = tr.offsetHeight; edRepaint(rec, true); } }
    stickPinned(rec.box);
    rec.note.textContent = `${rows.length} baris`;
    rec.add.style.display = dyn ? '' : 'none';
    if (rec.nextEdit) {
      const ne = rec.nextEdit;
      rec.nextEdit = null;
      const td = rec.box.querySelector(`tr[data-r="${cssq(ne.r)}"] td[data-c="${ne.c}"]`);
      if (td) startEdit(rec, td);
    }
  }

  function startEdit(rec, td) {
    if (rec.editing || rec.opts.disabled === true) return;
    const c = rec.view.cols[+td.dataset.c];
    const cf = rec.view.conf[c];
    if (cf.ro) return;
    const rid = td.parentElement.dataset.r;
    const i = rec.view.ids.findIndex(x => String(x) === rid);
    if (i < 0) return;
    const cur = rec.view.rows[i][c];
    if (cf.type === 'checkbox') { saveCell(rec, rid, c, !cur); return; }
    let inp;
    const pad2 = n => String(n).padStart(2, '0');
    if (cf.type === 'select') {
      inp = h('select', { class: 'slak-cell-in' }, h('option', { value: '', text: '—' }), ...(cf.options || []).map((op, k) => h('option', { value: String(k), text: cf.format_func ? cf.format_func(op) : fmtOpt(op) })));
      const k = optIndex(cf.options || [], cur);
      inp.value = k >= 0 ? String(k) : '';
    } else if (cf.type === 'multiselect') {
      inp = h('select', { class: 'slak-cell-in slak-cell-multi', multiple: true, size: String(Math.min(6, Math.max(2, (cf.options || []).length))) }, ...(cf.options || []).map((op, k) => h('option', { value: String(k), text: fmtOpt(op) })));
      const curA = Array.isArray(cur) ? cur : [];
      [...inp.options].forEach((op, k) => { op.selected = optIndex(curA, cf.options[k]) >= 0; });
    } else {
      const t = cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : cf.type === 'datetime' ? 'datetime-local' : cf.type === 'time' ? 'time' : 'text';
      inp = h('input', { class: 'slak-cell-in', type: t });
      if (cf.type === 'number') { if (cf.min != null) inp.min = cf.min; if (cf.max != null) inp.max = cf.max; inp.step = cf.step || 'any'; }
      if (cf.max_chars) inp.maxLength = cf.max_chars;
      const d = (cf.type === 'date' || cf.type === 'datetime' || cf.type === 'time') ? toDateAny(cur) : null;
      inp.value = cur == null ? ''
        : cf.type === 'date' ? (d ? isoDay(d) : String(cur))
        : cf.type === 'datetime' ? (d ? `${isoDay(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '')
        : cf.type === 'time' ? (d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : String(cur))
        : cf.type === 'list' ? (Array.isArray(cur) ? cur.join(', ') : String(cur))
        : (typeof cur === 'object' ? JSON.stringify(cur) : String(cur));
    }
    rec.editing = { td, rid, c };
    td.classList.add('editing');
    td.innerHTML = '';
    td.append(inp);
    inp.focus();
    try { if (inp.select && inp.type !== 'date') inp.select(); } catch (e) { /* abaikan */ }
    const read = () => {
      if (cf.type === 'select') return inp.value === '' ? null : cf.options[+inp.value];
      if (cf.type === 'multiselect') return [...inp.options].filter(op => op.selected).map(op => cf.options[+op.value]);
      if (cf.type === 'list') return inp.value.trim() === '' ? [] : inp.value.split(',').map(x => x.trim()).filter(Boolean).map(x => (/^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x));
      if (cf.type === 'json') { if (inp.value.trim() === '') return null; try { return JSON.parse(inp.value); } catch (e) { rec.app.toast('JSON tidak valid: ' + e.message, '!'); return cur; } }
      if (cf.type === 'datetime') { if (!inp.value) return null; const [dd, tt] = inp.value.split('T'); const [y, m, d] = dd.split('-').map(Number); const [hh, mi] = tt.split(':').map(Number); return cf.dateObj || cur instanceof Date ? new Date(y, m - 1, d, hh, mi) : `${dd} ${tt}`; }
      if (cf.type === 'time') return inp.value || null;
      if (cf.type === 'number') { if (inp.value === '') return null; const n = Number(inp.value); return isNaN(n) ? cur : n; }
      if (cf.type === 'date' && cf.dateObj) { if (!inp.value) return null; const [y, m, dd] = inp.value.split('-').map(Number); return new Date(y, m - 1, dd); }
      return inp.value;
    };
    let done = false;
    const finish = (save, move) => {
      if (done) return;
      done = true;
      rec.editing = null;
      if (move) {
        const cols = rec.view.cols;
        let ci = +td.dataset.c, ri = i;
        do { ci += move; if (ci >= cols.length) { ci = 0; ri++; } if (ci < 0) { ci = cols.length - 1; ri--; } }
        while (ri >= 0 && ri < rec.view.rows.length && rec.view.conf[cols[ci]].ro);
        if (ri >= 0 && ri < rec.view.rows.length) rec.nextEdit = { r: rec.view.ids[ri], c: ci };
      }
      const v = read();
      if (save && !sameVal(v, cur) && !(v === '' && cur == null)) saveCell(rec, rid, c, v);
      else {
        td.classList.remove('editing');
        td.innerHTML = edCell(cur, cf.type);
        if (rec.nextEdit) { const ne = rec.nextEdit; rec.nextEdit = null; const nx = rec.box.querySelector(`tr[data-r="${cssq(ne.r)}"] td[data-c="${ne.c}"]`); if (nx) startEdit(rec, nx); }
      }
    };
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true, 0); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false, 0); }
      else if (e.key === 'Tab') { e.preventDefault(); finish(true, e.shiftKey ? -1 : 1); }
    });
    inp.addEventListener('blur', () => finish(true, 0));
    if (cf.type === 'select') inp.addEventListener('change', () => finish(true, 0));
  }

  function saveCell(rec, rid, c, v) {
    const cf = rec.view.conf[c];
    if (cf.required && (v == null || v === '' || (Array.isArray(v) && !v.length))) { rec.app.toast(`Kolom "${cf.label}" wajib diisi.`, '!'); renderEditor(rec); return; }
    if (typeof v === 'string' && cf.max_chars && v.length > cf.max_chars) v = v.slice(0, cf.max_chars);
    if (typeof v === 'string' && v !== '' && cf.validate) {
      let ok = true;
      try { ok = new RegExp(cf.validate).test(v); } catch (e) { ok = true; }
      if (!ok) { rec.app.toast(`Isi kolom "${cf.label}" tidak sesuai format yang diminta.`, '!'); renderEditor(rec); return; }
    }
    if (isNum(v) && cf.type === 'number' && ((cf.min != null && v < cf.min) || (cf.max != null && v > cf.max))) { rec.app.toast(`Nilai kolom "${cf.label}" harus di antara ${cf.min != null ? cf.min : '−∞'} dan ${cf.max != null ? cf.max : '∞'}.`, '!'); renderEditor(rec); return; }
    if (rec.dbMode) {
      const key = rec.view.rows[rec.view.ids.findIndex(x => String(x) === rid)][rec.keyName];
      rec.table.update(key, { [c]: v }).then(() => rec.app.callback(rec.opts.on_change, rec.opts.args), e => rec.app.toast(e.message, '✕'));
      return;
    }
    const d = cloneEd(rec.shown);
    if (rid.startsWith('a')) d.added_rows[+rid.slice(1)][c] = v;
    else { const bi = +rid.slice(1); d.edited_rows[bi] = Object.assign(d.edited_rows[bi] || {}, { [c]: v }); }
    commit(rec, d);
  }

  function editorView(rec, rows, ids) {
    const o = rec.o;
    const t = toTable(rows);
    let cols = t.cols.slice();
    const cc = o.column_config || {};
    for (const c of Object.keys(cc)) if (!cols.includes(c) && cc[c] !== null) cols.push(c);
    if (rec.dbMode && !cols.includes(rec.keyName)) cols.unshift(rec.keyName);
    if (o.column_order) cols = o.column_order.filter(c => cols.includes(c));
    cols = cols.filter(c => cc[c] !== null && !(rec.dbMode && o.hide_index !== false && c === rec.keyName && !o.column_order));
    const dis = o.disabled === true ? cols : [].concat(o.disabled || []);
    const conf = {};
    cols = cols.filter(c => !(cc[c] && cc[c].hidden));
    for (const c of cols) {
      const x = colConf(cc, c, t.rows) || { type: 'text', label: c };
      conf[c] = Object.assign({}, x, {
        label: x.label || c, required: !!x.required,
        dateObj: t.rows.some(r => r[c] instanceof Date),
        ro: !!x.disabled || dis.includes(c) || (rec.dbMode && c === rec.keyName) || READONLY_TYPES.has(x.type)
      });
    }
    rec.view = { cols, conf, rows: t.rows.length ? t.rows : rows, ids };
  }

  EL.data_editor = (ctx, data, o) => {
    o = o || {};
    const dbMode = data instanceof Table;
    const rec = place(ctx, 'data_editor', o.key != null ? 'key:' + o.key : '', r => {
      r.box = h('div', { class: 'slak-df-box', tabindex: '0', role: 'region', 'aria-label': 'Tabel data' });
      r.note = h('span', { class: 'slak-df-note' });
      r.add = h('button', { class: 'slak-ed-add', type: 'button', text: '+ Tambah baris' });
      r.dl = h('button', { class: 'slak-df-dl', type: 'button', text: '⤓ CSV', title: 'Unduh sebagai CSV' });
      r.el = h('div', { class: 'slak-el slak-df slak-editor' }, r.box, h('div', { class: 'slak-df-foot' }, h('span', {}, r.note, ' ', r.add), r.dl));
      r.box.addEventListener('click', e => {
        const del = e.target.closest('button[data-del]');
        if (del) {
          if (r.opts.disabled === true) return;
          const rid = del.dataset.del;
          if (r.dbMode) {
            const row = r.view.rows[r.view.ids.findIndex(x => String(x) === rid)];
            r.table.delete(row[r.keyName]).catch(err => r.app.toast(err.message, '✕'));
            return;
          }
          const d = cloneEd(r.shown);
          if (rid.startsWith('a')) d.added_rows.splice(+rid.slice(1), 1); else d.deleted_rows.push(+rid.slice(1));
          commit(r, d);
          return;
        }
        const td = e.target.closest('td[data-c]');
        if (td) {
          if (e.target.matches('input[type=checkbox]')) e.preventDefault();
          startEdit(r, td);
        }
      });
      r.add.addEventListener('click', () => {
        if (r.opts.disabled === true) return;
        if (r.dbMode) {
          if (!r.table.auto) { r.app.toast('Tambah baris hanya untuk tabel dengan kunci otomatis (++id). Gunakan insert() untuk kunci manual.', '!'); return; }
          const blank = {};
          for (const c of r.view.cols) if (c !== r.keyName) { const cf = r.view.conf[c]; blank[c] = cf.default !== undefined ? cf.default : cf.type === 'checkbox' ? false : null; }
          r.table.insert(blank).catch(err => r.app.toast(err.message, '✕'));
          return;
        }
        const d = cloneEd(r.shown);
        const blank = {};
        for (const c of r.view.cols) { const cf = r.view.conf[c]; blank[c] = cf.default !== undefined ? cf.default : cf.type === 'checkbox' ? false : null; }
        d.added_rows.push(blank);
        const ce = r.view.cols.findIndex(c => !r.view.conf[c].ro);
        r.nextEdit = { r: 'a' + (d.added_rows.length - 1), c: Math.max(0, ce) };
        commit(r, d);
      });
      r.dl.addEventListener('click', () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([toCSV(r.view.rows)], { type: 'text/csv' })), download: (r.o.file_name || 'data') + '.csv' });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
    });
    rec.o = o;
    rec.dbMode = dbMode;
    rec.box.style.maxHeight = o.height === 'content' || o.height === 'stretch' ? 'none' : (isNum(o.height) ? o.height : 400) + 'px';
    setWidth(rec.el, o.width === 'stretch' ? null : o.width);
    rec.dl.hidden = !!ctx.app.getOption('client.disableDataExport');
    rec.el.classList.toggle('slak-disabled', o.disabled === true);
    if (dbMode) {
      rec.opts = o;
      rec.table = data;
      rec.keyName = data.key;
      rec.dynamic = o.num_rows !== 'fixed';
      ctx.app.dbNames.add(data.db.name);
      data.db.apps.add(ctx.app);
      if (!rec.view) { rec.view = { cols: [], conf: {}, rows: [], ids: [] }; rec.box.innerHTML = '<div class="slak-ed-loading">Memuat data…</div>'; }
      let q = data.orderBy(o.sort_by || data.key, o.sort_desc ? 'desc' : 'asc');
      return q.all().then(rows => {
        const sig = stableKey([rows, o.column_config || null, o.column_order || null, o.disabled || null, o.hide_index, o.num_rows]);
        editorView(rec, rows, rows.map(r => 'k' + String(r[rec.keyName])));
        if (sig !== rec.sig || !rec.editing) { rec.sig = sig; if (!rec.editing) renderEditor(rec); }
        return rows;
      }, e => { rec.box.innerHTML = `<div class="slak-ed-loading">${esc(e.message)}</div>`; throw e; });
    }
    rec.dynamic = o.num_rows === 'dynamic';
    const t0 = toTable(data);
    const base = t0.rows.map(r => Object.assign({}, r));
    bindWidget(rec, ctx, o, EMPTY_ED());
    const d = normEd(rec.shown);
    const ids = [];
    const shownRows = [];
    base.forEach((r, i) => { if (!d.deleted_rows.includes(i)) { ids.push('b' + i); shownRows.push(d.edited_rows[i] ? Object.assign({}, r, d.edited_rows[i]) : r); } });
    d.added_rows.forEach((r, i) => { ids.push('a' + i); shownRows.push(r); });
    editorView(rec, shownRows, ids);
    const sig = stableKey([shownRows, o.column_config || null, o.column_order || null, o.disabled || null, o.hide_index, o.num_rows]);
    if (sig !== rec.sig || rec.nextEdit) { rec.sig = sig; if (!rec.editing) renderEditor(rec); }
    const out = applyDelta(base, normEd(rec.value));
    // DataFrame masuk, DataFrame keluar (Slak 1.3); perubahan tersedia di .edits
    let res = out;
    for (const f of EXT.wrap) { const w = f(data, out, t0.cols); if (w) { res = w; break; } }
    Object.defineProperty(res, 'edits', { value: normEd(rec.value), enumerable: false, configurable: true });
    return res;
  };

  /* ======================================================================
   * Multi-halaman: sl.navigation, sl.page (Slak 1.1)
   * ==================================================================== */

  function slugify(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'halaman';
  }
  function makePage(title, fn, o) {
    if (typeof title === 'function') { o = fn; fn = title; title = (o && o.title) || fn.name || 'Halaman'; }
    o = o || {};
    if (typeof fn !== 'function') throw new Error(`Halaman "${title}" butuh fungsi, misalnya sl.page("${title}", (sl) => { ... }).`);
    return { kind: 'slak-page', title: emo(String(title)), fn, icon: emo(o.icon || ''), url: o.url != null ? String(o.url) : null, isDefault: !!o.default, roles: o.roles || null };
  }
  function currentHash() {
    try { const m = (location.hash || '').match(/^#\/?([^?]*)/); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
  }
  function pageHref(p) { return '#/' + encodeURIComponent(p.slug); }

  EL.page_link = (ctx, page, o) => {
    o = o || {};
    const app = ctx.app;
    const rec = place(ctx, 'page_link', typeof page === 'string' ? page : (page && page.title) || '', r => {
      r.a = h('a', { class: 'slak-pagelink' });
      r.el = h('div', { class: 'slak-el slak-pagelink-wrap' }, r.a);
    });
    let p = null;
    if (typeof page === 'string' && /^(https?:|mailto:)/i.test(page)) {
      rec.a.href = safeUrl(page); rec.a.target = '_blank'; rec.a.rel = 'noopener noreferrer';
      rec.a.innerHTML = (o.icon ? iconHTML(o.icon) + ' ' : '') + esc(emo(o.label || page));
      return;
    }
    p = app.findPage(page);
    if (!p) throw new Error(`Halaman "${typeof page === 'string' ? page : page && page.title}" tidak ditemukan. Panggil sl.navigation([...]) lebih dulu.`);
    rec.a.removeAttribute('target');
    rec.a.href = pageHref(p);
    rec.a.innerHTML = (o.icon || p.icon ? iconHTML(o.icon || p.icon) + ' ' : '') + esc(emo(o.label || p.title));
    rec.a.classList.toggle('on', app.nav && app.nav.current === p);
  };

  /* ======================================================================
   * Login lokal (Slak 1.4): sl.login, sl.user, sl.logout, peran pengguna.
   * Password disimpan sebagai hash bcrypt (sl.crypto.hash_password atau menu
   * Alat › Lindungi password di Slak Studio). Ini login di sisi browser:
   * cocok untuk memisahkan tampilan per pengguna dan peran, bukan untuk
   * melindungi data rahasia; itu butuh server (slak-bridge.php, Slak 1.6).
   * ==================================================================== */
  const LOGIN_KEY = app => 'slak-login|' + app.appId;
  const BCRYPT_RE = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;
  function normUsers(src) {
    let list = [];
    if (src == null) return list;
    if (typeof src === 'object' && typeof src.to_records === 'function') src = src.to_records();
    if (Array.isArray(src)) list = src.map(u => Object.assign({}, u));
    else if (isPlainObj(src)) list = Object.entries(src).map(([k, v]) => Object.assign({ username: k }, typeof v === 'string' ? { password: v } : v));
    return list.map(u => {
      const username = String(u.username != null ? u.username : u.user != null ? u.user : u.email != null ? u.email : u.nama_pengguna != null ? u.nama_pengguna : '').trim();
      const password = u.password != null ? String(u.password) : u.kata_sandi != null ? String(u.kata_sandi) : '';
      const role = u.role != null ? u.role : u.roles != null ? u.roles : u.peran != null ? u.peran : null;
      return Object.assign({}, u, { username, password, role, name: u.name != null ? u.name : u.nama != null ? u.nama : username });
    }).filter(u => u.username);
  }
  const rolesOf = u => !u || u.role == null ? [] : [].concat(u.role).map(r => String(r).toLowerCase());
  function userInfo(app) {
    const u = app.user;
    if (!u) return { is_logged_in: false, username: null, name: null, role: null, roles: [] };
    const out = { is_logged_in: true };
    for (const k in u) if (k !== 'password' && k !== 'kata_sandi') out[k] = u[k];
    out.roles = rolesOf(u);
    out.role = out.roles.length === 1 ? out.roles[0] : (out.roles.length ? out.roles : null);
    out.has_role = (...r) => r.flat().some(x => out.roles.includes(String(x).toLowerCase()));
    return out;
  }
  function hasRole(app, roles) {
    if (!roles || (Array.isArray(roles) && !roles.length)) return true;
    if (!app.user) return false;
    const mine = rolesOf(app.user);
    return [].concat(roles).some(r => r === '*' || mine.includes(String(r).toLowerCase()));
  }
  async function checkPassword(given, stored) {
    if (BCRYPT_RE.test(stored)) return CRYPTO.verify_password(given, stored);
    return given === stored;    // password polos: tetap jalan, tetapi ada peringatan
  }
  function sessionRead(app) {
    for (const st of [() => sessionStorage, () => localStorage]) {
      try { const v = st().getItem(LOGIN_KEY(app)); if (v) return JSON.parse(v); } catch (e) { /* abaikan */ }
    }
    return null;
  }
  function sessionWrite(app, data, remember) {
    try { sessionStorage.removeItem(LOGIN_KEY(app)); localStorage.removeItem(LOGIN_KEY(app)); } catch (e) { /* abaikan */ }
    if (!data) return;
    try { (remember ? localStorage : sessionStorage).setItem(LOGIN_KEY(app), JSON.stringify(data)); } catch (e) { /* abaikan */ }
  }
  const userSig = u => CRYPTO.sha256(u.username + '\u0000' + u.password + '\u0000' + JSON.stringify(rolesOf(u))).slice(0, 24);
  function localUsersKey(app) { return 'slak-pengguna|' + app.appId; }
  function localUsers(app) { try { return JSON.parse(localStorage.getItem(localUsersKey(app)) || '[]'); } catch (e) { return []; } }
  async function loginEl(ctx, o) {
    o = o || {};
    const app = ctx.app;
    if (o.bridge) return loginBridge(ctx, o);
    let src = o.users !== undefined ? o.users : o.pengguna;
    if (typeof src === 'function') src = await src();
    if (src && typeof src.then === 'function') src = await src;
    let users = normUsers(src);
    if (o.register) users = users.concat(normUsers(localUsers(app)).filter(u => !users.some(x => x.username === u.username)));
    if (!users.length && !o.register) throw new Error('sl.login() butuh daftar pengguna, misalnya sl.login({ users: { ani: { password: "$2y$10$...", role: "admin" } } }). Buat hash password dengan menu Alat › Lindungi password di Slak Studio atau await sl.crypto.hash_password("rahasia").');
    if (users.some(u => u.password && !BCRYPT_RE.test(u.password)) && !app._plainWarned) {
      app._plainWarned = true;
      console.warn('[Slak] sl.login: ada password yang ditulis polos. Siapa pun yang membuka kode halaman bisa membacanya. Ubah menjadi hash bcrypt dengan menu Alat › Lindungi password di Slak Studio, atau await sl.crypto.hash_password("...").');
    }
    // 1. sesi yang sudah ada
    const ses = sessionRead(app);
    if (ses && (!ses.exp || ses.exp > Date.now())) {
      const u = users.find(x => x.username === ses.u);
      if (u && ses.sig === userSig(u)) app.user = u; else app.user = null;
    } else app.user = null;
    if (app.user) {
      if (o.show_user !== false) loginChip(app, o);
      return userInfo(app);
    }
    // 2. formulir masuk
    const api = makeAPI(ctx);
    const cols = api.columns(o.width === 'stretch' ? [1] : [1, 2, 1]);
    const mid = cols.length === 3 ? cols[1] : cols[0];
    const box = mid.container({ border: true });
    if (o.logo) box.image(o.logo, { width: 72 });
    box.subheader(o.title != null ? o.title : ':lock: Masuk', { anchor: false });
    if (o.caption || o.subtitle) box.caption(o.caption || o.subtitle);
    let mode = 'masuk';
    if (o.register) mode = box.segmented_control('Mode', ['Masuk', 'Daftar'], { default: 'Masuk', label_visibility: 'collapsed', key: '__slak_login_mode' }) === 'Daftar' ? 'daftar' : 'masuk';
    const f = box.form('__slak_login_' + mode, { border: false, clear_on_submit: false });
    const un = f.text_input(o.username_label || 'Nama pengguna', { key: '__slak_login_u_' + mode, autocomplete: 'username' });
    const nm = mode === 'daftar' ? f.text_input('Nama lengkap', { key: '__slak_login_n' }) : null;
    const pw = f.text_input(o.password_label || 'Kata sandi', { type: 'password', key: '__slak_login_p_' + mode, autocomplete: mode === 'daftar' ? 'new-password' : 'current-password' });
    const pw2 = mode === 'daftar' ? f.text_input('Ulangi kata sandi', { type: 'password', key: '__slak_login_p2' }) : null;
    const rem = o.remember === false ? false : f.checkbox(o.remember_label || 'Ingat saya di perangkat ini', { key: '__slak_login_r', value: o.remember === 'always' });
    const go = f.form_submit_button(mode === 'daftar' ? 'Daftar' : (o.button_label || 'Masuk'), { type: 'primary', use_container_width: true });
    const err = app.ss.__slak_login_err;
    if (err) box.error(err);
    if (go) {
      const name = String(un || '').trim();
      const lock = app._loginLock || 0;
      if (Date.now() < lock) { app.ss.__slak_login_err = `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((lock - Date.now()) / 1000)} detik.`; api.rerun(); }
      if (mode === 'daftar') {
        let msg = null;
        if (!/^[\p{L}\p{N}._@-]{3,40}$/u.test(name)) msg = 'Nama pengguna 3–40 karakter (huruf, angka, titik, garis bawah, @).';
        else if (users.some(u => u.username === name)) msg = 'Nama pengguna itu sudah dipakai.';
        else if (String(pw || '').length < (o.min_password || 6)) msg = `Kata sandi minimal ${o.min_password || 6} karakter.`;
        else if (pw !== pw2) msg = 'Kedua kata sandi tidak sama.';
        if (msg) { app.ss.__slak_login_err = msg; api.rerun(); }
        const nu = { username: name, password: await CRYPTO.hash_password(pw, { cost: o.cost || 10 }), name: String(nm || '').trim() || name, role: o.default_role || 'pengguna', dibuat: new Date().toISOString() };
        if (typeof o.on_register === 'function') await o.on_register(Object.assign({}, nu));
        else { const L = localUsers(app); L.push(nu); try { localStorage.setItem(localUsersKey(app), JSON.stringify(L)); } catch (e) { /* abaikan */ } }
        users.push(nu);
        delete app.ss.__slak_login_err;
        sessionWrite(app, { u: nu.username, sig: userSig(nu), exp: Date.now() + (o.days || 7) * 864e5 }, !!rem);
        api.rerun();
      }
      const u = users.find(x => x.username === name || (x.email && String(x.email).toLowerCase() === name.toLowerCase()));
      const ok = u ? await checkPassword(String(pw || ''), u.password) : (await CRYPTO.verify_password(String(pw || ''), '$2y$10$abcdefghijklmnopqrstuuJ5S3zv2k4cR0yQ7aS0bQyT8lZ6xW9y'), false);
      if (!ok) {
        app._loginFail = (app._loginFail || 0) + 1;
        if (app._loginFail >= (o.max_attempts || 5)) { app._loginLock = Date.now() + 30000; app._loginFail = 0; }
        app.ss.__slak_login_err = 'Nama pengguna atau kata sandi salah.';
        if (typeof o.on_fail === 'function') o.on_fail(name);
        api.rerun();
      }
      app._loginFail = 0;
      delete app.ss.__slak_login_err;
      sessionWrite(app, { u: u.username, sig: userSig(u), exp: Date.now() + (o.days || 7) * 864e5 }, !!rem);
      if (typeof o.on_login === 'function') o.on_login(userInfo(Object.assign({}, app, { user: u })));
      api.rerun();
    }
    if (o.footer) box.caption(o.footer);
    throw STOP;
  }
  function loginChip(app, o) {
    const sapi = makeAPI(app.sideCtx);
    const u = userInfo(app);
    const c = sapi.container({ key: '__slak_user_chip' });
    c.caption(`:bust_in_silhouette: **${String(u.name).replace(/[*_`[\]]/g, '')}**${u.roles.length ? ' · ' + u.roles.join(', ') : ''}`);
    if (c.button(o.logout_label || 'Keluar', { key: '__slak_logout', icon: ':material/logout:', type: 'tertiary' })) logout(app);
  }
  /* sl.login({ bridge: db }) (Slak 1.7): akun dan password diperiksa di slak-bridge, bukan di halaman. */
  async function loginBridge(ctx, o) {
    const app = ctx.app, db = o.bridge;
    if (!db || typeof db.login !== 'function') throw new Error('sl.login({ bridge }) butuh koneksi slak-bridge, misalnya const db = sl.connection("sekolah", { type: "bridge", url: "slak-bridge.php" }).');
    app._bridgeLogin = db;
    const u = db.user;
    if (u) {
      app.user = Object.assign({}, u);
      if (o.show_user !== false) loginChip(app, o);
      return userInfo(app);
    }
    app.user = null;
    const api = makeAPI(ctx);
    const cols = api.columns(o.width === 'stretch' ? [1] : [1, 2, 1]);
    const mid = cols.length === 3 ? cols[1] : cols[0];
    const box = mid.container({ border: true });
    if (o.logo) box.image(o.logo, { width: 72 });
    box.subheader(o.title != null ? o.title : ':lock: Masuk', { anchor: false });
    if (o.caption || o.subtitle) box.caption(o.caption || o.subtitle);
    const f = box.form('__slak_login_bridge', { border: false, clear_on_submit: false });
    const un = f.text_input(o.username_label || 'Nama pengguna', { key: '__slak_login_bu', autocomplete: 'username' });
    const pw = f.text_input(o.password_label || 'Kata sandi', { type: 'password', key: '__slak_login_bp', autocomplete: 'current-password' });
    const rem = o.remember === false ? false : f.checkbox(o.remember_label || 'Ingat saya di perangkat ini', { key: '__slak_login_br', value: o.remember === 'always' });
    const go = f.form_submit_button(o.button_label || 'Masuk', { type: 'primary', use_container_width: true });
    const err = app.ss.__slak_login_err;
    if (err) box.error(err);
    if (go) {
      try {
        const user = await db.login(String(un || '').trim(), String(pw || ''), { remember: !!rem });
        delete app.ss.__slak_login_err;
        app.ss.__slak_login_bp = '';
        if (typeof o.on_login === 'function') o.on_login(Object.assign({ is_logged_in: true }, user));
      } catch (e) {
        app.ss.__slak_login_err = String(e.message).replace(/^slak-bridge: /, '');
        if (typeof o.on_fail === 'function') o.on_fail(String(un || ''));
      }
      api.rerun();
    }
    throw STOP;
  }
  function logout(app) {
    if (app._bridgeLogin) app._bridgeLogin.logout();
    sessionWrite(app, null);
    app.user = null;
    delete app.ss.__slak_login_err;
    if (app.running) { app.wantFull = true; throw RERUN; }
    app.rerun();
  }

  /** Nama metode DataFrame: bila ditulis dengan awalan sl., beri petunjuk yang jelas. */
  const DF_ONLY = ['groupby', 'query', 'sort_values', 'sort_index', 'head', 'tail', 'describe', 'value_counts', 'pivot_table', 'pivot', 'melt', 'assign', 'drop', 'rename', 'fillna', 'dropna', 'drop_duplicates', 'apply', 'agg', 'aggregate', 'loc', 'iloc', 'nlargest', 'nsmallest', 'set_index', 'reset_index', 'astype', 'unique', 'nunique', 'resample', 'rolling', 'shift', 'pct_change', 'cumsum', 'corr', 'isin', 'between', 'sample', 'to_excel', 'to_json', 'to_records', 'select_dtypes', 'info'];
  const OPT_DEFAULTS = { 'client.toolbarMode': 'auto', 'client.showSidebarNavigation': true, 'client.disableDataExport': false, 'client.showErrorDetails': 'full', 'client.showErrorLinks': false, 'runner.magicEnabled': false, 'sql.portable': false };
  const GLOBAL_OPTS = {};
  let CUR_APP = null;

  function makeAPI(ctx) {
    const api = {};
    for (const name in EL) {
      const fn = EL[name];
      const call = ctx.single
        ? (...a) => {
          beginSingle(ctx);
          try { return fn(ctx, ...a); } finally { if (!ctx.app.abort) prune(ctx); }
        }
        : (...a) => fn(ctx, ...a);
      // sl.testing: catat setiap elemen (urutan, argumen, nilai) hanya bila aplikasi sedang diuji
      const traced = (...a) => {
        const tr = ctx.app._trace;
        if (!tr) return call(...a);
        const foot = ctx.app.footCtx, f0 = foot && foot.used ? foot.used.length : 0;
        const n0 = ctx.used.length, ret = call(...a);
        const rec = ctx.used.length > n0 ? ctx.used[ctx.used.length - 1] : (foot && foot !== ctx && foot.used && foot.used.length > f0 ? foot.used[foot.used.length - 1] : null);
        tr.push({ type: name, args: a, ret, rec, ctx });
        return ret;
      };
      // mode sel (Slak 1.7): catat panggilan tingkat atas sebuah sel agar bisa diputar ulang tanpa menjalankan kodenya
      api[name] = (...a) => {
        const ap = ctx.app, cr = ap._cellRec;
        if (!cr) return traced(...a);
        if (!ap._cellDepth) cr.push({ path: ctx.path, type: name, args: a });
        ap._cellDepth = (ap._cellDepth | 0) + 1;
        try { return traced(...a); } finally { ap._cellDepth--; }
      };
    }
    Object.defineProperty(api, '__slakPath', { value: ctx.path });
    const app = ctx.app;
    Object.defineProperty(api, 'sidebar', { get: () => makeAPI(app.sideCtx), enumerable: true });
    Object.defineProperty(api, 'bottom', { get: () => makeAPI(app.footCtx), enumerable: true });
    api.session_state = app.ss;
    api.local_state = app.ls.state;
    api.clear_local_state = () => app.clearLocal();
    api.rerun = (o) => {
      const scope = typeof o === 'string' || Array.isArray(o) ? o : o && o.scope;
      if (scope === 'fragment') {
        const f = ctx.frag;
        if (!f) throw new Error('sl.rerun({ scope: "fragment" }) hanya bisa dipakai di dalam sl.fragment() atau sl.dialog().');
        if (app.running && app.curFrag) { app.fragQ.add(f); throw RERUN; }
        if (app.running) { app.wantFull = true; throw RERUN; }
        app.rerunFragment(f);
        return;
      }
      if (scope != null && scope !== 'app') {
        for (const k of [].concat(scope)) { const f = app.fragKeys.get(String(k)); if (f) app.rerunFragment(f); }
        if (app.running && app.curFrag) throw RERUN;
        return;
      }
      if (app.running) { app.wantFull = true; throw RERUN; }
      app.rerun();
    };
    api.stop = () => { throw STOP; };
    api.emoji = emojiAPI;
    api.login = (o) => loginEl(ctx, o);
    api.logout = () => logout(app);
    Object.defineProperty(api, 'user', { get: () => userInfo(app), enumerable: true });
    api.require_role = (...roles) => {
      roles = roles.flat();
      if (hasRole(app, roles)) return true;
      EL.error(ctx, app.user ? `Halaman ini hanya untuk peran: ${roles.join(', ')}.` : 'Silakan masuk lebih dulu.', { icon: ':material/lock:' });
      throw STOP;
    };
    api.sleep = ms => new Promise(r => setTimeout(r, ms)).then(() => { app.saveLocalSoon(); if (app.abort) throw RERUN; });
    api.page = (title, fn, o) => makePage(title, fn, o);
    api.navigation = (pages, o) => app.navigation(pages, o, makeAPI(app.mainCtx));
    api.switch_page = (p) => app.switchPage(p);
    api.db = (name, schema) => useDb(app, name, schema);
    api.db_list = dbList;
    api.cache_data = cacheData;
    api.cache_resource = cacheResource;
    api.context = app.context();
    api.get_option = k => app.getOption(k);
    api.set_option = (k, v) => app.setOption(k, v);
    api.column_config = column_config;
    api.crypto = CRYPTO;
    api.testing = testingAPI(ctx);
    api.secrets = SECRETS;
    api.worker = slWorker;
    api.components = {
      html: (x, o) => api.iframe(x, Object.assign({ height: 150 }, o || {})),
      iframe: (u, o) => api.iframe(u, o),
      declare_component: (n, o) => {
        // seperti Streamlit: key, default, dan on_change dipakai Slak; sisanya (termasuk height/width) dikirim ke komponen sebagai args
        const spec = declareComponent(n, o);
        const f = (props) => {
          props = props || {}; const args = {}, opt = {};
          for (const k in props) if (k === 'key' || k === 'default' || k === 'on_change' || k === 'persist') opt[k] = props[k]; else args[k] = props[k];
          if (props.disabled) opt.disabled = true;
          opt.args = args;
          return api.component(f, opt);
        };
        return Object.assign(f, spec);
      }
    };
    api.components.v1 = api.components;
    api.snow = () => app.snow();
    api.set_page_config = o => app.pageConfig(o);
    api.toast = (t, o) => { if (app._trace) app._trace.push({ type: 'toast', args: [t, o], ret: undefined, rec: null, ctx }); return app.toast(t, o); };
    api.balloons = () => app.balloons();
    api.query_params = queryParams;
    api.connection = connection;
    if (global.Slak && global.Slak.data) api.data = global.Slak.data;   // sl.data.limits, sl.data.version
    api.parse_csv = parseCSV;
    api.to_csv = toCSV;
    api.markdown_to_html = md;
    api.version = VERSION;
    for (const k in EXT.api) if (!(k in api)) api[k] = EXT.api[k];
    for (const k in NEEDS) if (!(k in api)) Object.defineProperty(api, k, { get() { throw new Error(`sl.${k} butuh berkas ${NEEDS[k]}. Tambahkan <script src="${NEEDS[k]}"></script> sesudah slak.js. (Di Slak Studio berkas ini sudah otomatis tersedia.)`); }, enumerable: false });
    for (const k of DF_ONLY) if (!(k in api)) Object.defineProperty(api, k, { get() { return () => { throw new Error(`sl.${k}() tidak ada. ${k} adalah perintah untuk tabel (DataFrame), jadi tulis dengan nama tabelmu, misalnya df.${k}(...). Awalan sl. dipakai untuk menampilkan sesuatu, membuat widget, atau memuat data.`); }; }, enumerable: false, configurable: true });
    // Nama lama (Slak 1.9): tetap bekerja, dengan peringatan sekali di konsol. Lihat KEBIJAKAN-VERSI.md.
    for (const [old, d] of Object.entries(OLD_NAMES)) if (!(old in api)) Object.defineProperty(api, old, { get() { oldName(old, d[0]); return d[1] ? d[1](api) : api[d[0]]; }, enumerable: false, configurable: true });
    return api;
  }
  /* Nama lama Streamlit yang sudah diganti: [nama baru, pembuat fungsi pengganti (opsional)] */
  const OLD_NAMES = {
    experimental_rerun: ['rerun'], experimental_dialog: ['dialog'], experimental_fragment: ['fragment'],
    experimental_get_query_params: ['query_params', (api) => () => api.query_params.to_dict()],
    experimental_set_query_params: ['query_params', (api) => (o) => api.query_params.from_dict(o || {})],
    cache: ['cache_data'], experimental_memo: ['cache_data'], experimental_singleton: ['cache_resource'],
    beta_columns: ['columns'], beta_expander: ['expander'], beta_container: ['container'], beta_tabs: ['tabs']
  };
  const oldWarned = new Set();
  function oldName(old, neu) {
    if (oldWarned.has(old)) return;
    oldWarned.add(old);
    try { console.warn(`[Slak] sl.${old} adalah nama lama; pakai sl.${neu}. Nama lama tetap bekerja sampai Slak 2.0.`); } catch (e) { /* abaikan */ }
  }

  /* ======================================================================
   * Aplikasi
   * ==================================================================== */

  const svgIcon = d => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON_RERUN = svgIcon('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>');
  const ICON_THEME = svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>');
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_NAME = { auto: 'Otomatis', light: 'Terang', dark: 'Gelap' };

  class App {
    constructor(script, o) {
      o = o || {};
      injectCSS();
      this.script = script;
      this.o = o;
      this.ss = isPlainObj(o.session_state) ? o.session_state : {};
      this.appId = String(o.app_id || defaultAppId());
      this.ls = loadLocal(this.appId);
      this.dbNames = new Set();
      this.nav = null;
      this._pending = [];
      this.vals = new Map();
      this.triggers = new Map();
      this.active = new Map();
      this.pend = new Map();
      this.formClear = new Map();
      this.clearNext = new Set();
      this.clearingNow = new Set();
      this.cbErrors = [];
      this.runId = 0;
      this.running = false;
      this.abort = false;
      this.again = false;
      this.scheduled = false;
      this.touched = new Set();
      this.seenKeys = new Set();
      this.seenWids = new Set();
      this.fragQ = new Set();
      this.fragKeys = new Map();
      this.curFrag = null;
      this.wantFull = false;
      this.opts = {};
      this._build(o);
      if (o.title || o.page_title || o.layout) this.pageConfig({ page_title: o.title || o.page_title, layout: o.layout });
      this.rerun();
    }

    _build(o) {
      let target = typeof o.target === 'string' ? document.querySelector(o.target) : o.target;
      if (!target) { target = h('div'); document.body.append(target); }
      this.target = target;
      target.innerHTML = '';
      let theme = o.theme;
      if (!theme) { try { theme = localStorage.getItem('slak-theme'); } catch (e) { /* abaikan */ } }
      if (!THEMES.includes(theme)) theme = 'auto';

      const ib = (txt, title, fn, cls) => h('button', { type: 'button', class: 'slak-iconbtn ' + (cls || ''), title, 'aria-label': title, html: txt, onclick: fn });
      this.sideBody = h('div', { class: 'slak-block slak-sb-body' });
      this.navSide = h('nav', { class: 'slak-nav', hidden: true, 'aria-label': 'Halaman' });
      this.navTop = h('nav', { class: 'slak-nav slak-nav-top', hidden: true, 'aria-label': 'Halaman' });
      const closeOnMobile = e => {
        if (e.target.closest('a') && global.matchMedia && matchMedia('(max-width: 900px)').matches) this.root.classList.remove('sb-toggled');
      };
      this.navSide.addEventListener('click', closeOnMobile);
      this.side = h('aside', { class: 'slak-sidebar' }, ib('&times;', 'Tutup sidebar', () => this.root.classList.toggle('sb-toggled'), 'slak-sb-close'), this.logoSide, this.navSide, this.sideBody);
      this.bodyEl = h('div', { class: 'slak-body slak-block' });
      this.footIn = h('div', { class: 'slak-foot-in slak-block' });
      this.foot = h('div', { class: 'slak-foot' }, this.footIn);
      this.status = h('span', { class: 'slak-status' }, h('i'), 'Berjalan…');
      this.logoTop = h('a', { class: 'slak-logo', hidden: true });
      this.logoSide = h('a', { class: 'slak-logo slak-logo-side', hidden: true });
      this.menuPanel = h('div', { class: 'slak-appmenu', hidden: true, role: 'menu' });
      this.btnMenu = ib('&#8942;', 'Menu', () => { this.menuPanel.hidden = !this.menuPanel.hidden; }, 'slak-menu-open');
      this.btnMenu.hidden = true;
      this.btnRerun = ib(ICON_RERUN, 'Jalankan ulang (R)', () => this.rerun());
      this.btnTheme = ib(ICON_THEME, 'Ganti tema', () => this.cycleTheme());
      const top = h('header', { class: 'slak-top' },
        ib('&#9776;<span class="slak-sb-lbl"></span>', 'Buka/tutup sidebar', () => this.root.classList.toggle('sb-toggled'), 'slak-sb-open'),
        this.logoTop,
        this.status,
        h('span', { class: 'slak-spacer' }),
        this.btnRerun, this.btnTheme, this.btnMenu, this.menuPanel);
      this.main = h('main', { class: 'slak-main' }, top, this.navTop, this.bodyEl, this.foot);
      this.toasts = h('div', { class: 'slak-toasts', 'aria-live': 'polite', role: 'status' });
      this.dlgLayer = h('div', { class: 'slak-dlg-layer' });
      this.root = h('div', { class: 'slak-app' + (o.embedded ? ' embedded' : ''), 'data-theme': theme }, this.side, this.main, this.toasts, this.dlgLayer);
      this._themeSaved = !!o.theme || (() => { try { return !!localStorage.getItem('slak-theme'); } catch (e) { return false; } })();
      target.append(this.root);
      document.addEventListener('mousedown', this._menuOut = e => { if (!this.menuPanel.hidden && !this.menuPanel.contains(e.target) && e.target !== this.btnMenu && !this.btnMenu.contains(e.target)) this.menuPanel.hidden = true; });

      this.mainCtx = newCtx(this, this.bodyEl, 'main');
      this.sideCtx = newCtx(this, this.sideBody, 'side');
      this.footCtx = newCtx(this, this.footIn, 'foot');
      this.dialogCtx = newCtx(this, this.dlgLayer, 'dialog');

      this._key = e => {
        if (e.key !== 'r' && e.key !== 'R') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (!this.root.isConnected) return;
        this.rerun();
      };
      if (o.hotkeys !== false) document.addEventListener('keydown', this._key);
      this._hash = () => { if (this.nav) this.rerun(); };
      this._hide = () => this.saveLocal();
      global.addEventListener('hashchange', this._hash);
      global.addEventListener('pagehide', this._hide);
    }

    /* ---------- local_state ---------- */
    saveLocalSoon() {
      if (this.destroyed) return;
      clearTimeout(this._lsT);
      this._lsT = setTimeout(() => this.saveLocal(), 150);
    }
    saveLocal() {
      clearTimeout(this._lsT);
      let s;
      try { s = JSON.stringify({ v: 1, state: this.ls.state, widgets: this.ls.widgets }); }
      catch (e) { if (!this._lsWarn) { this._lsWarn = true; console.warn('Slak: local_state hanya bisa menyimpan data JSON (teks, angka, larik, objek). ' + e.message); } return; }
      if (s === this._lsLast) return;
      try { localStorage.setItem(lsKey(this.appId), s); this._lsLast = s; }
      catch (e) { if (!this._lsWarn) { this._lsWarn = true; console.warn('Slak: local_state tidak bisa disimpan di halaman ini: ' + e.message); } }
    }
    clearLocal() {
      for (const k of Object.keys(this.ls.state)) delete this.ls.state[k];
      for (const k of Object.keys(this.ls.widgets)) delete this.ls.widgets[k];
      try { localStorage.removeItem(lsKey(this.appId)); } catch (e) { /* abaikan */ }
      this._lsLast = null;
    }

    /* ---------- multi-halaman ---------- */
    navigation(pages, o, api) {
      o = o || {};
      if (!this.running) throw new Error('sl.navigation() hanya bisa dipanggil di dalam skrip.');
      let sections;
      if (Array.isArray(pages)) sections = [{ name: null, pages }];
      else if (isPlainObj(pages)) sections = Object.entries(pages).map(([name, ps]) => ({ name, pages: [].concat(ps) }));
      else throw new Error('sl.navigation() butuh larik halaman, misalnya [sl.page("Beranda", beranda)].');
      const all = [];
      const used = new Set();
      for (const sec of sections) {
        sec.pages = sec.pages.map(p => {
          if (!p || p.kind !== 'slak-page') throw new Error('Isi sl.navigation() harus berupa sl.page(...).');
          let slug = p.url != null ? slugify(p.url) : slugify(p.title);
          let base = slug, n = 2;
          while (used.has(slug)) slug = base + '-' + n++;
          used.add(slug);
          const q = Object.assign({}, p, { slug });
          all.push(q);
          return q;
        });
      }
      for (const sec of sections) sec.pages = sec.pages.filter(p => hasRole(this, p.roles));
      sections = sections.filter(sec => sec.pages.length);
      all.splice(0, all.length, ...sections.flatMap(sec => sec.pages));
      if (!all.length) throw new Error(this.user ? 'Tidak ada halaman untuk peran pengguna ini. Periksa opsi roles di sl.page().' : 'sl.navigation() butuh minimal satu halaman. Halaman dengan opsi roles hanya tampil setelah sl.login().');
      const h0 = this._pageOverride != null ? this._pageOverride : currentHash();   // aplikasi uji (sl.testing) tidak memakai alamat halaman
      const current = all.find(p => p.slug === h0) || all.find(p => p.isDefault) || all[0];
      const position = o.position || 'sidebar';
      this.nav = { sections, all, current, position, run: this.runId };
      this.renderNav();
      if (this._titleRun !== this.runId && !this._testing) document.title = current.title;
      const app = this;
      return {
        title: current.title, icon: current.icon, url: current.slug, slug: current.slug,
        run() {
          const r = current.fn(api);
          if (r && typeof r.then === 'function') app._pending.push(r);
          return r;
        }
      };
    }
    findPage(p) {
      if (!this.nav) return null;
      if (p && p.kind === 'slak-page') return this.nav.all.find(x => x.fn === p.fn && x.title === p.title) || null;
      const s = String(p);
      return this.nav.all.find(x => x.title === s || x.slug === s || x.slug === slugify(s)) || null;
    }
    switchPage(p) {
      const t = this.findPage(p);
      if (!t) throw new Error(`Halaman "${p && p.title || p}" tidak ditemukan. Panggil sl.navigation([...]) lebih dulu.`);
      if (this._testing) this._pageOverride = t.slug;
      else if (currentHash() !== t.slug) {
        try { location.hash = pageHref(t); } catch (e) { /* abaikan */ }
      }
      if (this.running) { this.again = true; throw RERUN; }
      this.rerun();
    }
    renderNav() {
      const nav = this.nav;
      const html = nav.sections.map(sec =>
        (sec.name ? `<div class="slak-nav-sec">${esc(sec.name)}</div>` : '') +
        sec.pages.map(p => `<a href="${esc(pageHref(p))}" class="${p === nav.current ? 'on' : ''}"${p === nav.current ? ' aria-current="page"' : ''}>${p.icon ? `<span class="ic">${/^:material\//.test(p.icon) ? iconHTML(p.icon) : esc(p.icon)}</span>` : ''}<span>${esc(p.title)}</span></a>`).join('')
      ).join('');
      const side = nav.position === 'sidebar', topNav = nav.position === 'top';
      if (side && this.navSide.innerHTML !== html) this.navSide.innerHTML = html;
      if (topNav && this.navTop.innerHTML !== html) this.navTop.innerHTML = html;
      this.navSide.hidden = !side;
      this.navTop.hidden = !topNav;
      this.root.classList.toggle('has-nav', side);
      const lbl = this.root.querySelector('.slak-sb-lbl');
      if (lbl) lbl.textContent = side ? (nav.current.icon && !/^:material\//.test(nav.current.icon) ? nav.current.icon + ' ' : '') + nav.current.title : '';
    }

    pendingFor(form) {
      let m = this.pend.get(form);
      if (!m) { m = new Map(); this.pend.set(form, m); }
      return m;
    }

    callback(fn, args) {
      if (typeof fn !== 'function') return;
      try { fn(...(args || [])); } catch (e) { console.error(e); this.cbErrors.push(e); }
      this.saveLocalSoon();
    }

    rerun() {
      if (this.destroyed) return;
      this._autoReruns = 0;
      this.wantFull = true;
      if (this.running) { this.again = true; this.abort = true; return; }
      this._schedule();
    }
    _schedule() {
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => { this.scheduled = false; this._loop(); });
    }
    /** Jalankan ulang satu fragment (atau dialog) saja. */
    rerunFragment(f) {
      if (this.destroyed || !f) return;
      this.fragQ.add(f);
      if (this.running) { if (this.curFrag === f) this.abort = true; return; }
      this._schedule();
    }

    async _loop() {
      if (this.running) { this.again = true; this.abort = true; return; }
      this.running = true;
      global.Slak._activeApp = this;
      try {
        while (!this.destroyed && (this.wantFull || this.again || this.fragQ.size)) {
          if (this.wantFull || this.again) {
            this.wantFull = false;
            this.again = false;
            this.abort = false;
            this.fragQ.clear();
            await this._once();
            if (this._rerunAfter) {
              this._rerunAfter = false;
              if (this._autoReruns < 2) { this._autoReruns++; this.again = true; }
              else if (!this._loopWarned) { this._loopWarned = true; console.warn('Slak: skrip menulis ke database di setiap jalan, jadi jalan ulang otomatis dihentikan. Tulis data hanya di dalam if (tombol) atau callback.'); }
            }
          } else {
            const f = this.fragQ.values().next().value;
            this.fragQ.delete(f);
            this.abort = false;
            await this._fragOnce(f);
          }
        }
      } finally {
        this.running = false;
      }
    }

    async _fragOnce(f) {
      if (!f.ctx || !f.ctx.map.has(f.id) || !f.run) return;
      CUR_APP = this;
      this.runId++;
      this.active = this.triggers;
      this.triggers = new Map();
      this.clearingNow = this.clearNext;
      this.clearNext = new Set();
      this.touched = new Set();
      this.seenKeys = new Set();
      this.seenWids = new Set();
      this._pending = [];
      this.curFrag = f;
      let complete = true;
      try {
        await f.run();
        while (this._pending.length) await this._pending.shift();
      } catch (e) {
        if (e === RERUN) complete = false;
        else if (e === STOP) { /* berhenti */ }
        else {
          console.error(e);
          const ab = this.abort;
          this.abort = false;
          try { EL.exception(f.child, e); } catch (_) { /* abaikan */ }
          this.abort = ab;
        }
      } finally {
        this.curFrag = null;
      }
      if (complete) for (const c of this.touched) if (c.frag === f || c === f.child) prune(c);
      this.root.classList.toggle('has-dialog', this.dialogCtx.map.size > 0);
      this.saveLocalSoon();
    }

    async _once() {
      CUR_APP = this;
      this.runId++;
      if (this._trace) { this._trace = []; this._errors = []; }
      this.active = this.triggers;
      this.triggers = new Map();
      this.clearingNow = this.clearNext;
      this.clearNext = new Set();
      this.touched = new Set();
      this.seenKeys = new Set();
      this.seenWids = new Set();
      touch(this.mainCtx); touch(this.sideCtx); touch(this.footCtx); touch(this.dialogCtx);
      const api = makeAPI(this.mainCtx);
      const errs = this.cbErrors;
      this.cbErrors = [];
      let complete = true, error = null;
      const t0 = performance.now();
      const slow = setTimeout(() => this.root.classList.add('running'), 250);
      this._pending = [];
      if (this._autoReruns == null) this._autoReruns = 0;
      try {
        for (const e of errs) EL.exception(this.mainCtx, e);
        await this.script(api);
        while (this._pending.length) await this._pending.shift();
      } catch (e) {
        if (e === RERUN) { complete = false; this.again = true; }
        else if (e === STOP) { /* berhenti dengan sengaja */ }
        else {
          error = e;
          console.error(e);
          const ab = this.abort;
          this.abort = false;
          try { EL.exception(this.mainCtx, e); } catch (_) { /* abaikan */ }
          this.abort = ab;
        }
      } finally {
        clearTimeout(slow);
        this.root.classList.remove('running');
      }
      if (complete) {
        for (const c of this.touched) prune(c);
        for (const k of [...this.vals.keys()]) if (!this.seenWids.has(k)) this.vals.delete(k);
        if (this._logoRun !== this.runId) { this.logoTop.hidden = true; this.logoSide.hidden = true; this.root.classList.remove('has-logo'); }
      }
      if (complete && this.nav && this.nav.run !== this.runId) { this.nav = null; this.navSide.hidden = true; this.navTop.hidden = true; this.root.classList.remove('has-nav'); }
      this.root.classList.toggle('has-sidebar', this.sideCtx.used.length > 0 || !this.navSide.hidden);
      this.root.classList.toggle('has-foot', this.footCtx.used.length > 0);
      this.root.classList.toggle('has-dialog', this.dialogCtx.map.size > 0);
      this.saveLocalSoon();
      if (complete && !this.destroyed && typeof this.o.on_run === 'function') {
        try { this.o.on_run({ ms: performance.now() - t0, error, run: this.runId, app: this }); } catch (e) { console.error(e); }
      }
    }

    /* ---------- logo, menu, tema kustom, opsi (Slak 1.3.1) ---------- */
    setLogo(img, o) {
      this._logoRun = this.runId;
      const src = mediaSrc(img), icon = o.icon_image != null ? mediaSrc(o.icon_image) : src;
      for (const [el, s] of [[this.logoSide, src], [this.logoTop, icon]]) {
        el.hidden = false;
        const html = `<img src="${esc(safeUrl(s, true))}" alt="Logo">`;
        if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
        if (o.link) { el.href = safeUrl(String(o.link)); el.target = '_blank'; el.rel = 'noopener noreferrer'; } else el.removeAttribute('href');
        el.dataset.size = o.size || 'medium';
      }
      this.root.classList.add('has-logo');
    }
    setMenu(items) {
      const keys = Object.keys(items || {});
      this.btnMenu.hidden = !keys.length;
      const norm = k => k.toLowerCase().replace(/[\s_]+/g, ' ');
      this.menuPanel.innerHTML = '';
      for (const k of keys) {
        const v = items[k];
        if (v == null) continue;
        const n = norm(k);
        if (n === 'about' || n === 'tentang') {
          const b = h('button', { type: 'button', text: 'Tentang aplikasi', role: 'menuitem' });
          b.addEventListener('click', () => { this.menuPanel.hidden = true; this.showAbout(String(v)); });
          this.menuPanel.append(b);
        } else {
          const label = n === 'get help' ? 'Bantuan' : n === 'report a bug' ? 'Laporkan masalah' : k;
          this.menuPanel.append(h('a', { href: safeUrl(String(v)), target: '_blank', rel: 'noopener noreferrer', text: label, role: 'menuitem' }));
        }
      }
    }
    showAbout(text) {
      const back = h('div', { class: 'slak-dlg-back slak-about' });
      const close = () => back.remove();
      const panel = h('div', { class: 'slak-dlg', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'slak-dlg-top' }, h('div', { class: 'slak-dlg-title', text: 'Tentang' }), h('button', { type: 'button', class: 'slak-iconbtn slak-dlg-x', 'aria-label': 'Tutup', html: '&times;', onclick: close })),
        h('div', { class: 'slak-md slak-dlg-body', html: md(text) }));
      back.append(panel);
      back.addEventListener('mousedown', e => { if (e.target === back) close(); });
      this.root.append(back);
    }
    context() {
      const app = this;
      return {
        get locale() { try { return navigator.language || 'id-ID'; } catch (e) { return 'id-ID'; } },
        get timezone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return null; } },
        get timezone_offset() { return new Date().getTimezoneOffset(); },
        get url() { try { return location.href; } catch (e) { return ''; } },
        get is_embedded() { try { return global.self !== global.top; } catch (e) { return true; } },
        get theme() { return { type: themeIsDark(app) ? 'dark' : 'light' }; },
        get cookies() {
          const out = {};
          try { document.cookie.split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[decodeURIComponent(p.slice(0, i).trim())] = decodeURIComponent(p.slice(i + 1).trim()); }); } catch (e) { /* abaikan */ }
          return out;
        },
        get headers() { return {}; },
        get ip_address() { return null; }
      };
    }
    getOption(k) {
      k = String(k);
      if (k.startsWith('theme.')) {
        const path = k.slice(6).split('.');
        let v = this.themeObj || {};
        for (const p of path) v = v == null ? undefined : v[p];
        return v === undefined ? null : v;
      }
      if (k in this.opts) return this.opts[k];
      if (k in GLOBAL_OPTS) return GLOBAL_OPTS[k];
      return k in OPT_DEFAULTS ? OPT_DEFAULTS[k] : null;
    }
    setOption(k, v) {
      k = String(k);
      if (k.startsWith('theme.')) {
        const t = JSON.parse(JSON.stringify(this.themeObj || {}));
        const path = k.slice(6).split('.');
        let o = t;
        for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = Object.assign({}, o[path[i]] || {});
        o[path[path.length - 1]] = v;
        this.setTheme(t);
        return;
      }
      if (/^(sql|tiles)\./.test(k)) GLOBAL_OPTS[k] = v;
      this.opts[k] = v;
      this.applyOpts();
    }
    applyOpts() {
      const tb = this.getOption('client.toolbarMode');
      this.root.classList.toggle('tb-min', tb === 'minimal' || tb === 'viewer');
      this.root.classList.toggle('no-sbnav', this.getOption('client.showSidebarNavigation') === false);
    }
    setTheme(t) {
      t = t || {};
      this.themeObj = t;
      if (!this.uid) this.uid = 'a' + Math.random().toString(36).slice(2, 9);
      this.root.dataset.slakId = this.uid;
      if (!this.themeStyle) { this.themeStyle = h('style', { 'data-slak-theme': this.uid }); document.head.append(this.themeStyle); }
      this.themeStyle.textContent = themeCSS(t, this.uid);
      [t.font, t.headingFont, t.codeFont, t.sidebar && t.sidebar.font].forEach(loadFont);
      if (t.base && THEMES.includes(t.base) && !this._themeSaved) this.root.dataset.theme = t.base;
      this.root.querySelectorAll('.slak-chart,.slak-ext-chart,.slak-map').forEach(c => c.dispatchEvent(new Event('slak-theme')));
    }
    snow() {
      const reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { this.toast('❄️ Salju!'); return; }
      for (let i = 0; i < 46; i++) {
        const f = h('div', { class: 'slak-flake', text: '❄' });
        f.style.left = (Math.random() * 100) + 'vw';
        f.style.fontSize = (10 + Math.random() * 16) + 'px';
        f.style.animationDelay = (Math.random() * 2.2) + 's';
        f.style.animationDuration = (4 + Math.random() * 3) + 's';
        f.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
        this.root.append(f);
        setTimeout(() => f.remove(), 9800);
      }
    }

    pageConfig(o) {
      o = o || {};
      if (o.page_title) { document.title = o.page_title; this._titleRun = this.runId; }
      if (o.layout) this.root.classList.toggle('wide', o.layout === 'wide');
      if (o.initial_sidebar_state === 'collapsed' && !this._sbInit) { this._sbInit = true; this.root.classList.add('sb-toggled'); }
      if (o.initial_sidebar_state === 'expanded' && !this._sbInit) { this._sbInit = true; this.root.classList.remove('sb-toggled'); }
      if (o.menu_items !== undefined) this.setMenu(o.menu_items);
      if (isPlainObj(o.theme)) { const sig = stableKey(o.theme); if (sig !== this._themeSig) { this._themeSig = sig; this.setTheme(o.theme); } }
      else if (typeof o.theme === 'string' && THEMES.includes(o.theme) && !this._themeSaved && this.root.dataset.theme !== o.theme) this.root.dataset.theme = o.theme;
      if (o.page_icon) {
        let link = document.querySelector('link[rel="icon"]');
        if (!link) { link = h('link', { rel: 'icon' }); document.head.append(link); }
        const ic0 = String(o.page_icon), mm = ic0.match(/^:material\/([a-z0-9_]+):$/), ic = emo(ic0);
        const msvg = mm && materialSVG(mm[1]);
        link.href = msvg ? 'data:image/svg+xml,' + encodeURIComponent(msvg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('currentColor', '#0f766e'))
          : /^(https?:|data:|\.|\/)/.test(ic) ? ic
          : 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${esc(ic)}</text></svg>`);
      }
    }

    cycleTheme() {
      const cur = this.root.dataset.theme;
      const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      this.root.dataset.theme = next;
      this._themeSaved = true;
      this.root.querySelectorAll('.slak-chart,.slak-ext-chart,.slak-map').forEach(c => c.dispatchEvent(new Event('slak-theme')));
      try { localStorage.setItem('slak-theme', next); } catch (e) { /* abaikan */ }
      this.toast('Tema: ' + THEME_NAME[next]);
    }

    toast(text, o) {
      o = typeof o === 'string' ? { icon: o } : (o || {});
      const t = h('div', { class: 'slak-toast', role: 'status' },
        o.icon ? h('span', { class: 'slak-toast-ic', html: iconHTML(o.icon) }) : null,
        h('span', { html: inline(esc(text)) }));
      this.toasts.append(t);
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, o.duration || 3500);
    }

    balloons() {
      const reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { this.toast('Selamat! 🎉'); return; }
      for (let i = 0; i < 28; i++) {
        const b = h('div', { class: 'slak-balloon' });
        b.style.left = (Math.random() * 96) + 'vw';
        b.style.setProperty('--bc', `var(--slak-c${(i % 8) + 1})`);
        b.style.animationDelay = (Math.random() * 0.9) + 's';
        b.style.animationDuration = (2.6 + Math.random() * 1.6) + 's';
        this.root.append(b);
        setTimeout(() => b.remove(), 5000);
      }
    }

    destroy() {
      this.destroyed = true;
      if (this.running) this.abort = true;
      this.saveLocal();
      document.removeEventListener('keydown', this._key);
      document.removeEventListener('mousedown', this._menuOut);
      if (this.themeStyle) this.themeStyle.remove();
      for (const r of this.dialogCtx.map.values()) if (r.dispose) r.dispose();
      for (const c of [this.dialogCtx]) { c.used = []; prune(c); }
      global.removeEventListener('hashchange', this._hash);
      global.removeEventListener('pagehide', this._hide);
      for (const db of DBS.values()) db.apps.delete(this);
      for (const c of [this.mainCtx, this.sideCtx, this.footCtx]) { c.used = []; prune(c); }
      this.root.remove();
      this.script = () => {};
    }
  }

  /* ---------- Tema kustom (st.set_page_config theme / config.toml [theme]) ---------- */
  const GENERIC_FONT = {
    'sans-serif': 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    serif: 'Georgia,"Times New Roman",Cambria,serif',
    monospace: 'ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace'
  };
  const FONTS_ASKED = new Set();
  function fontName(f) { return String(f).split(/:(?=https?:)/)[0].trim(); }
  function fontStack(f, mono) {
    if (f == null) return null;
    const n = fontName(f);
    if (GENERIC_FONT[n]) return GENERIC_FONT[n];
    return `"${n.replace(/"/g, '')}",${mono ? GENERIC_FONT.monospace : GENERIC_FONT['sans-serif']}`;
  }
  function loadFont(f) {
    if (!f || typeof document === 'undefined') return;
    const s = String(f), n = fontName(s);
    if (GENERIC_FONT[n] || FONTS_ASKED.has(n)) return;
    FONTS_ASKED.add(n);
    const m = s.match(/:(https?:.*)$/);
    const href = m ? m[1] : `https://fonts.googleapis.com/css2?family=${encodeURIComponent(n).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
    document.head.append(h('link', { rel: 'stylesheet', href }));
  }
  function radiusScale(r) {
    if (r == null) return null;
    const named = { none: 0, small: 0.55, medium: 1, large: 1.5, full: 3 };
    if (String(r) in named) return named[r];
    const m = String(r).match(/^([\d.]+)\s*(px|rem)?$/);
    if (!m) return null;
    return m[2] === 'rem' ? (+m[1] * 16) / 9 : +m[1] / 9;
  }
  function themeVars(t) {
    const v = [];
    const P = t.primaryColor;
    if (P) v.push(`--accent:${P}`, `--accent-soft:color-mix(in srgb,${P} 14%,transparent)`, `--accent-ink:color-mix(in srgb,${P} 72%,var(--fg))`, `--accent-fg:${lum(hexRgb(P)) > 0.62 ? '#111' : '#fff'}`, `--slak-c1:${P}`);
    if (t.backgroundColor) v.push(`--bg:${t.backgroundColor}`, `--panel:${t.backgroundColor}`);
    if (t.secondaryBackgroundColor) v.push(`--bg2:${t.secondaryBackgroundColor}`, `--code-bg:${t.secondaryBackgroundColor}`);
    if (t.textColor) v.push(`--fg:${t.textColor}`, `--muted:color-mix(in srgb,${t.textColor} 62%,${t.backgroundColor || 'transparent'})`);
    if (t.borderColor) v.push(`--line:${t.borderColor}`, `--line2:color-mix(in srgb,${t.borderColor} 82%,currentColor)`);
    if (t.linkColor) v.push(`--link:${t.linkColor}`);
    if (t.codeBackgroundColor) v.push(`--code-bg:${t.codeBackgroundColor}`);
    if (t.codeTextColor) v.push(`--code-fg:${t.codeTextColor}`);
    if (t.font) v.push(`--font:${fontStack(t.font)}`);
    if (t.headingFont) v.push(`--head-font:${fontStack(t.headingFont)}`);
    if (t.codeFont) v.push(`--mono:${fontStack(t.codeFont, true)}`);
    const rs = radiusScale(t.baseRadius);
    if (rs != null) v.push(`--rs:${rs}`);
    if (t.buttonRadius != null) { const b = radiusScale(t.buttonRadius); if (b != null) v.push(`--rs-btn:${b}`); }
    if (Array.isArray(t.chartCategoricalColors)) t.chartCategoricalColors.slice(0, 8).forEach((c, i) => v.push(`--slak-c${i + 1}:${c}`));
    for (const c of ['red', 'orange', 'yellow', 'blue', 'green', 'violet', 'gray']) if (t[c + 'Color']) v.push(`--slak-${c}:${t[c + 'Color']}`);
    if (t.baseFontSize) v.push(`font-size:${isNum(t.baseFontSize) ? t.baseFontSize + 'px' : t.baseFontSize}`);
    if (t.showWidgetBorder === false) v.push('--wb:0');
    return v.join(';');
  }
  function themeCSS(t, uid) {
    const S = `.slak-app[data-slak-id="${uid}"]`;
    let css = `${S}{${themeVars(t)}}`;
    if (t.sidebar) css += `${S} .slak-sidebar{${themeVars(t.sidebar)};background:var(--bg2);color:var(--fg)}`;
    for (const mode of ['light', 'dark']) {
      const m = t[mode];
      if (!m) continue;
      const vars = themeVars(m);
      css += `${S}[data-theme=${mode}]{${vars}}@media (prefers-color-scheme:${mode}){${S}[data-theme=auto]{${vars}}}`;
      if (m.sidebar) { const sv = themeVars(m.sidebar); css += `${S}[data-theme=${mode}] .slak-sidebar{${sv}}@media (prefers-color-scheme:${mode}){${S}[data-theme=auto] .slak-sidebar{${sv}}}`; }
    }
    return css;
  }

  /* ======================================================================
   * Gaya (CSS) — disuntikkan sekali
   * ==================================================================== */

  const LIGHT = `--bg:#fbfaf7;--bg2:#f3f0e9;--panel:#ffffff;--fg:#1c1e21;--muted:#6a6e75;--line:#e2ded4;--line2:#d2cdc1;
--accent:#0f766e;--accent-fg:#ffffff;--accent-soft:rgba(15,118,110,.12);
--ok:#15803d;--ok-bg:#eaf6ee;--inf:#1d4ed8;--inf-bg:#eaf0fd;--warn:#a16207;--warn-bg:#fcf4de;--err:#b91c1c;--err-bg:#fdecec;
--code-bg:#f3f0e9;--shadow:0 1px 2px rgba(20,20,10,.05),0 6px 20px rgba(20,20,10,.06);
--slak-c1:#0f766e;--slak-c2:#ea580c;--slak-c3:#4f46e5;--slak-c4:#db2777;--slak-c5:#65a30d;--slak-c6:#0284c7;--slak-c7:#9333ea;--slak-c8:#ca8a04;
--slak-red:#c81e1e;--slak-green:#15803d;--slak-blue:#2563eb;--slak-orange:#c2410c;--slak-yellow:#a16207;--accent-ink:#0b5c56;--slak-violet:#7c3aed;--slak-gray:#6b7280;color-scheme:light;`;
  const DARK = `--bg:#121417;--bg2:#191c20;--panel:#1b1e23;--fg:#e8e6e1;--muted:#9aa0a8;--line:#2b2f35;--line2:#3a3f46;
--accent:#2dd4bf;--accent-fg:#052522;--accent-soft:rgba(45,212,191,.15);
--ok:#4ade80;--ok-bg:rgba(74,222,128,.09);--inf:#93b4ff;--inf-bg:rgba(147,180,255,.09);--warn:#fbbf24;--warn-bg:rgba(251,191,36,.09);--err:#f87171;--err-bg:rgba(248,113,113,.1);
--code-bg:#20242a;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35);
--slak-c1:#2dd4bf;--slak-c2:#fb923c;--slak-c3:#818cf8;--slak-c4:#f472b6;--slak-c5:#a3e635;--slak-c6:#38bdf8;--slak-c7:#c084fc;--slak-c8:#facc15;
--accent-ink:#2dd4bf;--slak-red:#f87171;--slak-green:#4ade80;--slak-blue:#60a5fa;--slak-orange:#fb923c;--slak-violet:#a78bfa;--slak-gray:#9ca3af;color-scheme:dark;`;

  const CSS = `
.slak-app{${LIGHT}--font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;
display:flex;height:100vh;height:100dvh;overflow:hidden;background:var(--bg);color:var(--fg);font:15px/1.6 var(--font);-webkit-font-smoothing:antialiased;position:relative}
.slak-app[data-theme=dark]{${DARK}}
@media (prefers-color-scheme:dark){.slak-app[data-theme=auto]{${DARK}}}
.slak-app.embedded{height:100%}
body:has(> .slak-app),body:has(> div > .slak-app:not(.embedded)){margin:0}
.slak-app *,.slak-app *::before,.slak-app *::after{box-sizing:border-box}
.slak-app [hidden]{display:none!important}
.slak-block{display:flex;flex-direction:column;gap:14px;min-width:0}
.slak-sidebar{display:none;width:288px;flex:none;height:100%;overflow:auto;background:var(--bg2);border-right:1px solid var(--line);padding:52px 20px 28px;position:relative}
.slak-app.has-sidebar .slak-sidebar{display:block}
.slak-app.has-sidebar.sb-toggled .slak-sidebar{display:none}
.slak-sb-close{position:absolute;top:10px;right:10px}
.slak-main{flex:1;min-width:0;overflow:auto;display:flex;flex-direction:column;scroll-behavior:smooth}
.slak-top{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:6px;height:46px;padding:0 10px;flex:none;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.slak-spacer{flex:1}
.slak-top .slak-sb-open{display:none}
.slak-app.has-sidebar .slak-top .slak-sb-open{display:inline-grid}
.slak-iconbtn{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:8px;border:0;background:none;color:var(--muted);cursor:pointer;font-size:17px;line-height:1}
.slak-iconbtn:hover{background:var(--bg2);color:var(--fg)}
.slak-iconbtn:focus-visible,.slak-btn:focus-visible,.slak-drop:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.slak-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.slak-app a:focus-visible,.slak-app button:focus-visible,.slak-app [tabindex]:focus-visible,.slak-app select:focus-visible,.slak-app input:focus-visible,.slak-app textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.slak-df-box:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.slak-status{display:none;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);padding:3px 10px;border-radius:99px;background:var(--bg2)}
.slak-status i{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:slak-pulse 1s ease-in-out infinite}
.slak-app.running .slak-status{display:inline-flex}
.slak-body{width:100%;max-width:780px;margin:0 auto;padding:6px 28px 72px;flex:1 0 auto}
.slak-app.wide .slak-body,.slak-app.wide .slak-foot-in{max-width:1280px}
.slak-foot{display:none;position:sticky;bottom:0;z-index:5;padding:14px 28px 18px;background:linear-gradient(to bottom,transparent,var(--bg) 40%)}
.slak-app.has-foot .slak-foot{display:block}
.slak-foot-in{max-width:780px;margin:0 auto}
@media (max-width:900px){
 .slak-app.has-sidebar .slak-sidebar{display:block;position:fixed;inset:0 auto 0 0;z-index:20;width:min(300px,86vw);transform:translateX(-102%);transition:transform .22s ease;box-shadow:var(--shadow)}
 .slak-app.has-sidebar.sb-toggled .slak-sidebar{display:block;transform:none}
 .slak-body{padding:4px 16px 64px}.slak-foot{padding:12px 16px 14px}
}
.slak-el{margin:0;min-width:0}
.slak-title{font-size:2.15rem;line-height:1.18;font-weight:760;letter-spacing:-.025em;padding-top:.35em}
.slak-header{font-size:1.55rem;line-height:1.25;font-weight:700;letter-spacing:-.015em;padding-top:.5em}
.slak-subheader{font-size:1.18rem;line-height:1.3;font-weight:650;padding-top:.3em}
.slak-divider-under{padding-bottom:.35em;border-bottom:3px solid var(--slak-div)}
.slak-caption{font-size:.84rem;color:var(--muted)}
.slak-text{font-family:var(--mono);font-size:.9rem;white-space:pre-wrap}
.slak-hr{border:0;border-top:1px solid var(--line);margin:4px 0}
.slak-md>:first-child{margin-top:0}.slak-md>:last-child{margin-bottom:0}
.slak-md p,.slak-md ul,.slak-md ol,.slak-md blockquote,.slak-md table,.slak-md pre{margin:0 0 .7em}
.slak-md h1,.slak-md h2,.slak-md h3,.slak-md h4,.slak-md h5,.slak-md h6{margin:.8em 0 .35em;line-height:1.25;letter-spacing:-.01em}
.slak-md h1{font-size:1.7rem}.slak-md h2{font-size:1.4rem}.slak-md h3{font-size:1.17rem}.slak-md h4,.slak-md h5,.slak-md h6{font-size:1rem}
.slak-md ul,.slak-md ol{padding-left:1.45em}.slak-md li{margin:.15em 0}
.slak-md li input{margin:0 .35em 0 -1.25em;vertical-align:-1px;accent-color:var(--accent)}
.slak-md code{font:.87em var(--mono);background:var(--code-bg);padding:.12em .38em;border-radius:5px}
.slak-md pre,.slak-pre{background:var(--code-bg);padding:12px 14px;border-radius:10px;overflow:auto}
.slak-md pre code{background:none;padding:0}
.slak-md a,.slak-alert a{color:var(--link,var(--accent));text-underline-offset:2px}
.slak-md blockquote{border-left:3px solid var(--line2);padding:2px 0 2px 14px;color:var(--muted)}
.slak-md hr{border:0;border-top:1px solid var(--line);margin:1em 0}
.slak-md img{max-width:100%;border-radius:8px}
.slak-md table{border-collapse:collapse;font-size:.92em;display:block;overflow:auto}
.slak-md th,.slak-md td{border:1px solid var(--line);padding:5px 10px}.slak-md th{background:var(--bg2)}
.slak-c-red{color:var(--slak-red)}.slak-c-green{color:var(--slak-green)}.slak-c-blue{color:var(--slak-blue)}.slak-c-orange{color:var(--slak-orange)}.slak-c-violet{color:var(--slak-violet)}.slak-c-gray,.slak-c-grey{color:var(--slak-gray)}
.slak-c-rainbow{background:linear-gradient(90deg,var(--slak-red),var(--slak-orange),var(--slak-green),var(--slak-blue),var(--slak-violet));-webkit-background-clip:text;background-clip:text;color:transparent}
.slak-code{position:relative}
.slak-code pre{margin:0;background:var(--code-bg);padding:14px 16px;border-radius:10px;overflow:auto;font:13px/1.6 var(--mono)}
.slak-code pre.wrap{white-space:pre-wrap;word-break:break-word}
.slak-lang{position:absolute;top:8px;right:66px;font:11px var(--mono);color:var(--muted);text-transform:lowercase;opacity:0;transition:opacity .15s}
.slak-copy{position:absolute;top:5px;right:6px;font:12px var(--font);padding:2px 8px;border-radius:6px;border:1px solid var(--line);background:var(--panel);color:var(--muted);cursor:pointer;opacity:0;transition:opacity .15s}
.slak-code:hover .slak-copy,.slak-code:hover .slak-lang,.slak-copy:focus-visible{opacity:1}
@media (hover:none){.slak-copy{opacity:1;top:auto;bottom:6px}}
.slak-json{background:var(--code-bg);padding:12px 14px;border-radius:10px;overflow:auto;font:12.5px/1.55 var(--mono);max-height:420px}
.slak-json .k{color:var(--slak-c3)}.slak-json .s{color:var(--slak-c1)}.slak-json .n{color:color-mix(in srgb,var(--slak-c2) 72%,var(--fg))}.slak-json .b{color:color-mix(in srgb,var(--slak-c4) 78%,var(--fg))}
.slak-alert{display:flex;gap:11px;align-items:flex-start;padding:11px 14px;border-radius:10px;background:var(--a-bg);border:1px solid color-mix(in srgb,var(--a) 22%,transparent)}
.slak-alert-ic{flex:none;display:grid;place-items:center;width:20px;height:20px;margin-top:1px;border-radius:50%;background:var(--a);color:var(--bg);font:700 12px/1 var(--font)}
.slak-alert .slak-md{flex:1;min-width:0}
.slak-success{--a:var(--ok);--a-bg:var(--ok-bg)}.slak-info{--a:var(--inf);--a-bg:var(--inf-bg)}.slak-warning{--a:var(--warn);--a-bg:var(--warn-bg)}.slak-error{--a:var(--err);--a-bg:var(--err-bg)}
.slak-exc-body{flex:1;min-width:0}.slak-exc-head{word-break:break-word}
.slak-exc details{margin-top:4px;font-size:.85rem}.slak-exc summary{cursor:pointer;color:var(--muted)}
.slak-exc-stack{margin:6px 0 0;font:12px/1.5 var(--mono);white-space:pre-wrap;color:var(--muted);max-height:220px;overflow:auto}
.slak-metric{container-type:inline-size}
.slak-metric-l{font-size:.86rem;color:var(--muted)}
.slak-metric-v{font-size:clamp(1.3rem,11cqi,2.05rem);line-height:1.15;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.slak-metric-d{display:inline-flex;margin-top:4px;padding:1px 9px;border-radius:99px;font-size:.82rem;font-weight:600;font-variant-numeric:tabular-nums}
.slak-metric-d.up{color:var(--ok);background:var(--ok-bg)}.slak-metric-d.down{color:var(--err);background:var(--err-bg)}.slak-metric-d.off{color:var(--muted);background:var(--bg2)}
.slak-bordered{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--panel)}
.slak-prog-t{font-size:.88rem;margin-bottom:6px}
.slak-prog-bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden}
.slak-prog-fill{height:100%;width:0;border-radius:99px;background:var(--accent);transition:width .25s ease}
.slak-spinner{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:.92rem}
.slak-spin{width:16px;height:16px;flex:none;border:2px solid var(--line2);border-top-color:var(--accent);border-radius:50%;animation:slak-rot .75s linear infinite}
.slak-image{margin:0}.slak-image img{display:block;max-width:100%;height:auto;border-radius:10px}
.slak-image figcaption{font-size:.84rem;color:var(--muted);text-align:center;margin-top:6px}
.slak-media{width:100%;border-radius:10px}
.slak-btnwrap{display:flex}
.slak-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:7px 16px;border-radius:9px;border:1px solid var(--line2);background:var(--panel);color:var(--fg);font:550 .94rem/1.2 var(--font);cursor:pointer;text-decoration:none;transition:border-color .15s,color .15s,background .15s,transform .05s;user-select:none}
.slak-btn:hover{border-color:var(--accent);color:var(--accent)}
.slak-btn:active{transform:translateY(1px)}
.slak-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.slak-btn.primary:hover{filter:brightness(1.08);color:var(--accent-fg)}
.slak-btn.full{width:100%}
.slak-btn:disabled,.slak-disabled .slak-btn{opacity:.5;cursor:not-allowed;pointer-events:none}
.slak-field{display:flex;flex-direction:column;gap:6px}
.slak-label{font-size:.9rem;font-weight:550;color:var(--fg)}
.slak-help{display:inline-grid;place-items:center;width:15px;height:15px;border-radius:50%;border:1px solid var(--line2);color:var(--muted);font:600 10px/1 var(--font);cursor:help;vertical-align:1px;margin-left:2px}
.slak-hint{font-size:.75rem;color:var(--muted);text-align:right;margin-top:-2px}
.slak-input{width:100%;min-height:40px;padding:8px 12px;border:1px solid var(--line2);border-radius:9px;background:var(--panel);color:var(--fg);font:inherit;font-size:.95rem;transition:border-color .15s,box-shadow .15s}
.slak-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.slak-input::placeholder{color:var(--muted);opacity:.8}
textarea.slak-input{resize:vertical;line-height:1.5}
select.slak-input{appearance:none;-webkit-appearance:none;padding-right:34px;cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 17px) 50%,calc(100% - 12px) 50%;background-size:5px 5px;background-repeat:no-repeat}
.slak-color_picker .slak-input{width:64px;padding:4px;height:40px;cursor:pointer}
.slak-disabled{opacity:.55}
.slak-disabled .slak-input,.slak-disabled input,.slak-disabled button{cursor:not-allowed}
.slak-num{display:flex}
.slak-num .slak-input{border-radius:9px 0 0 9px;-moz-appearance:textfield}
.slak-num .slak-input::-webkit-inner-spin-button,.slak-num .slak-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.slak-num button{width:40px;flex:none;border:1px solid var(--line2);border-left:0;background:var(--panel);color:var(--fg);font-size:1.1rem;cursor:pointer}
.slak-num button:last-child{border-radius:0 9px 9px 0}
.slak-num button:hover{color:var(--accent-ink,var(--accent));background:var(--accent-soft)}
.slak-check label{display:inline-flex;align-items:center;gap:9px;cursor:pointer;font-size:.95rem}
.slak-check input{width:17px;height:17px;margin:0;accent-color:var(--accent);cursor:pointer}
.slak-toggle input{appearance:none;-webkit-appearance:none;width:36px;height:20px;border-radius:99px;background:var(--line2);position:relative;transition:background .18s;flex:none}
.slak-toggle input::before{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .18s}
.slak-toggle input:checked{background:var(--accent)}
.slak-toggle input:checked::before{transform:translateX(16px)}
.slak-toggle input:focus-visible,.slak-check input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.slak-radio-opts{display:flex;flex-direction:column;gap:4px}
.slak-radio-opts.horizontal{flex-direction:row;flex-wrap:wrap;gap:4px 18px}
.slak-radio-opts label{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:.95rem}
.slak-radio-opts input{width:16px;height:16px;margin:0;accent-color:var(--accent);cursor:pointer}
.slak-chips{display:flex;flex-wrap:wrap;gap:6px}
.slak-chip{display:inline-flex;align-items:center;gap:2px;padding:2px 3px 2px 10px;border-radius:7px;background:var(--accent-soft);color:var(--accent-ink,var(--accent));font-size:.86rem;font-weight:550}
.slak-chip button{border:0;background:none;color:inherit;cursor:pointer;font-size:1.05rem;line-height:1;padding:0 5px;border-radius:5px}
.slak-chip button:hover{background:var(--accent-soft)}
.slak-slider-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.slak-slider-out{font:600 .9rem var(--mono);color:var(--accent);font-variant-numeric:tabular-nums}
.slak-range{position:relative;height:26px}
.slak-range-track,.slak-range-fill{position:absolute;top:11px;height:4px;border-radius:4px}
.slak-range-track{left:0;right:0;background:var(--line2)}
.slak-range-fill{background:var(--accent)}
.slak-range input{position:absolute;inset:0;width:100%;height:26px;margin:0;background:none;-webkit-appearance:none;appearance:none;cursor:pointer}
.slak-range.dual input{pointer-events:none}
.slak-range input::-webkit-slider-runnable-track{background:none;height:26px}
.slak-range input::-moz-range-track{background:none}
.slak-range input::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:18px;height:18px;margin-top:4px;border-radius:50%;background:var(--panel);border:2px solid var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:grab}
.slak-range input::-moz-range-thumb{pointer-events:auto;width:14px;height:14px;border-radius:50%;background:var(--panel);border:2px solid var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:grab}
.slak-range input:focus{outline:none}
.slak-range input:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 5px var(--accent-soft)}
.slak-range input:focus-visible::-moz-range-thumb{box-shadow:0 0 0 5px var(--accent-soft)}
.slak-range-ends{display:flex;justify-content:space-between;font-size:.75rem;color:var(--muted);margin-top:-4px;font-variant-numeric:tabular-nums}
.slak-drop{border:1.5px dashed var(--line2);border-radius:11px;padding:20px 16px;text-align:center;background:var(--panel);cursor:pointer;transition:border-color .15s,background .15s}
.slak-drop:hover,.slak-drop.over{border-color:var(--accent);background:var(--accent-soft)}
.slak-drop.busy{opacity:.6;pointer-events:none}
.slak-drop-main{font-size:.92rem}.slak-drop-sub{font-size:.78rem;color:var(--muted);margin-top:2px}
.slak-files{display:flex;flex-direction:column;gap:6px}
.slak-file{display:flex;align-items:center;gap:10px;padding:7px 8px 7px 12px;border:1px solid var(--line);border-radius:9px;background:var(--panel);font-size:.9rem}
.slak-file .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slak-file .sz{color:var(--muted);font-size:.8rem}
.slak-file button{border:0;background:none;color:var(--muted);font-size:1.1rem;cursor:pointer;border-radius:6px;padding:0 6px}
.slak-file button:hover{color:var(--err);background:var(--err-bg)}
.slak-df{position:relative}
.slak-df-box{border:1px solid var(--line);border-radius:10px;overflow:auto;background:var(--panel)}
.slak-df table{border-collapse:separate;border-spacing:0;width:100%;font-size:.87rem;font-variant-numeric:tabular-nums}
.slak-df th{position:sticky;top:0;z-index:1;background:var(--bg2);text-align:left;font-weight:600;padding:7px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
.slak-df:not(.slak-static) th[data-c]{cursor:pointer;user-select:none}
.slak-df:not(.slak-static) th[data-c]:hover{color:var(--accent)}
.slak-df td{padding:6px 12px;border-bottom:1px solid var(--line);white-space:nowrap;max-width:340px;overflow:hidden;text-overflow:ellipsis}
.slak-df tr:last-child td{border-bottom:0}
.slak-df tbody tr:hover td{background:var(--accent-soft)}
.slak-df .n{text-align:right}
.slak-df .idx{color:var(--muted);font-size:.8rem;text-align:right;width:1%}
.slak-df .nil{color:var(--muted)}
.slak-df .bool{text-align:center}
.slak-df .obj{font-family:var(--mono);font-size:.8rem}
.slak-df-foot{display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-size:.76rem;color:var(--muted)}
.slak-df-dl{border:0;background:none;color:var(--muted);font:inherit;cursor:pointer;padding:2px 6px;border-radius:6px}
.slak-df-dl:hover{color:var(--accent-ink,var(--accent));background:var(--accent-soft)}
.slak-chart{position:relative}
.slak-chart-title{font-weight:600;font-size:.95rem;margin-bottom:4px}
.slak-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.8rem;color:var(--muted);margin-bottom:4px}
.slak-legend:empty{display:none}
.slak-legend span{display:inline-flex;align-items:center;gap:6px}
.slak-legend i,.slak-tip i{display:inline-block;width:9px;height:9px;border-radius:3px}
.slak-plot{width:100%;min-height:40px}
.slak-plot svg{display:block;overflow:visible}
.slak-plot text{fill:var(--muted);font:11px var(--font)}
.slak-plot text.al{font-size:12px;fill:var(--fg)}
.slak-plot .g{stroke:var(--line);stroke-width:1}
.slak-plot .g.z{stroke:var(--line2)}
.slak-plot .ln{fill:none;stroke:var(--sc);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.slak-plot .area{fill:var(--sc);opacity:.18;stroke:none}
.slak-plot .dot{fill:var(--panel);stroke:var(--sc);stroke-width:1.6}
.slak-plot .bar{fill:var(--sc)}
.slak-plot .pt{fill:var(--sc);opacity:.75;stroke:var(--panel);stroke-width:1}
.slak-plot .pt-img{pointer-events:none}
.slak-mis{display:inline-block;vertical-align:-0.2em;flex:none}
.slak-pick-wrap{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.slak-pick{background:var(--panel,#fff);color:var(--fg,#1f2937);border-radius:14px;max-width:440px;width:100%;padding:22px 22px 16px;box-shadow:0 20px 50px rgba(0,0,0,.25);font:15px/1.5 var(--font,system-ui,sans-serif)}
.slak-pick-t{font-weight:700;font-size:17px;margin-bottom:6px}
.slak-pick p{margin:0 0 12px}
.slak-pick-row{display:flex;gap:8px;margin:14px 0}
.slak-pick-btn{flex:1;background:var(--accent,#0f766e);color:#fff;border:0;border-radius:9px;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer}
.slak-pick-no{background:transparent;color:inherit;border:1px solid var(--line,#d1d5db);border-radius:9px;padding:10px 14px;font:inherit;cursor:pointer}
.slak-pick-tip{font-size:12.5px;color:var(--muted,#6b7280)}
.slak-pick-chip{position:fixed;left:12px;bottom:12px;z-index:9000;background:var(--panel,#fff);border:1px solid var(--line,#e5e7eb);border-radius:999px;padding:5px 12px;font:12.5px/1.4 var(--font,system-ui,sans-serif);color:var(--muted,#6b7280);box-shadow:0 2px 8px rgba(0,0,0,.08)}
.slak-pick-chip button{background:none;border:0;color:var(--accent,#0f766e);cursor:pointer;font:inherit;text-decoration:underline;padding:0 2px}
.slak-chart svg.has-sel .pt-img{opacity:.28}
.slak-plot .hit{fill:transparent}
.slak-guide{stroke:var(--muted);stroke-dasharray:3 3;stroke-width:1}
.slak-plot .trend{stroke:var(--sc);stroke-width:2;stroke-dasharray:6 4;opacity:.9}
.slak-plot .mline{stroke:var(--fg);stroke-width:1.2;stroke-dasharray:4 3;opacity:.6}
.slak-plot text.vl{font-size:10.5px;fill:var(--fg);opacity:.8}
.slak-plot .bar.ov{opacity:.55}
.slak-plot .wh{stroke:var(--sc);stroke-width:1.5}
.slak-plot .bx{fill:color-mix(in srgb,var(--sc) 22%,var(--panel));stroke:var(--sc);stroke-width:1.5}
.slak-plot .md{stroke:var(--sc);stroke-width:2.5}
.slak-plot .mn{fill:var(--panel);stroke:var(--sc);stroke-width:1.4}
.slak-plot .ol{fill:none;stroke:var(--sc);stroke-width:1.3;opacity:.8}
.slak-plot .sl{fill:var(--sc);stroke:var(--panel);stroke-width:1.5}
.slak-plot .sl:hover{opacity:.85}
.slak-plot text.pl{fill:#fff;font-weight:600;font-size:11.5px;paint-order:stroke;stroke:rgba(0,0,0,.25);stroke-width:2px}
.slak-plot text.pc{fill:var(--fg);font-size:18px;font-weight:700}
.slak-plot .hc:hover{stroke:var(--fg);stroke-width:1.5}
.slak-plot text.ha{font-size:10.5px;font-variant-numeric:tabular-nums}
.slak-chart-tools{position:absolute;top:-2px;right:0;z-index:3;display:flex;gap:2px;opacity:0;transition:opacity .15s}
.slak-chart:hover .slak-chart-tools,.slak-chart-tools:focus-within{opacity:1}
.slak-chart-tools button{border:1px solid var(--line);background:var(--panel);color:var(--muted);font:600 10.5px var(--font);padding:2px 7px;border-radius:6px;cursor:pointer}
.slak-chart-tools button:hover{color:var(--accent);border-color:var(--accent)}
@media (hover:none){.slak-chart-tools{opacity:1}}
@media print{.slak-app{height:auto;overflow:visible;display:block}.slak-main{overflow:visible}.slak-top,.slak-sidebar,.slak-chart-tools,.slak-df-dl,.slak-toasts,.slak-foot{display:none!important}.slak-body{max-width:none;padding:0}.slak-df-box{max-height:none!important;overflow:visible}.slak-el{break-inside:avoid}}
.slak-chart-empty{padding:28px;text-align:center;color:var(--muted);border:1px dashed var(--line2);border-radius:10px;font-size:.9rem}
.slak-tip{position:absolute;z-index:4;display:none;pointer-events:none;background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:7px 11px;font-size:12px;line-height:1.55;box-shadow:var(--shadow);white-space:nowrap}
.slak-tip .t{font-weight:650;margin-bottom:2px}
.slak-tip div{display:flex;align-items:center;gap:6px}
.slak-tip b{margin-left:auto;padding-left:12px;font-variant-numeric:tabular-nums}
.slak-cols{display:flex;align-items:flex-start}
.slak-col{min-width:0}
@media (max-width:640px){.slak-cols{flex-direction:column;align-items:stretch!important}.slak-col{flex:none!important;width:100%}}
.slak-tabs-nav{display:flex;gap:2px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
.slak-tabs-nav button{flex:none;border:0;background:none;padding:9px 14px;margin-bottom:-1px;color:var(--muted);font:550 .92rem var(--font);cursor:pointer;border-bottom:2px solid transparent;border-radius:6px 6px 0 0}
.slak-tabs-nav button:hover{color:var(--fg);background:var(--bg2)}
.slak-tabs-nav button.on{color:var(--fg);border-bottom-color:var(--accent)}
.slak-tab{padding-top:14px}
.slak-exp{border:1px solid var(--line);border-radius:11px;background:var(--panel)}
.slak-exp summary{list-style:none;cursor:pointer;padding:11px 15px;font-weight:550;display:flex;align-items:center;gap:9px;border-radius:11px}
.slak-exp summary::-webkit-details-marker{display:none}
.slak-exp summary::before{content:"";width:7px;height:7px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(-45deg);transition:transform .15s;flex:none}
.slak-exp[open] summary::before{transform:rotate(45deg)}
.slak-exp summary:hover{color:var(--accent)}
.slak-exp-body{padding:2px 15px 15px}
.slak-form{border:1px solid var(--line);border-radius:12px;padding:16px;background:color-mix(in srgb,var(--panel) 60%,transparent)}
.slak-form.slak-noborder{border:0;padding:0;background:none}
.slak-empty:empty{display:none}
.slak-chatmsg{display:flex;gap:12px;align-items:flex-start;padding:4px 0}
.slak-chatmsg[data-role=user]{background:var(--bg2);padding:10px 12px;border-radius:12px}
.slak-av{width:30px;height:30px;flex:none;border-radius:9px;display:grid;place-items:center;background:var(--line);font-size:15px;font-weight:650}
.slak-chatmsg[data-role=assistant] .slak-av{background:var(--accent);color:var(--accent-fg)}
.slak-chat-body{flex:1;min-width:0;padding-top:3px;gap:10px}
.slak-chatin{display:flex;align-items:center;gap:6px;border:1px solid var(--line2);border-radius:14px;background:var(--panel);padding:5px 5px 5px 15px;box-shadow:var(--shadow);transition:border-color .15s}
.slak-chatin:focus-within{border-color:var(--accent)}
.slak-chat-field{flex:1;min-width:0;border:0;background:none;outline:none;color:var(--fg);font:inherit;padding:7px 0}
.slak-chat-send{width:36px;height:36px;border:0;border-radius:10px;background:var(--accent);color:var(--accent-fg);cursor:pointer;font-size:15px}
.slak-chat-send:disabled{opacity:.4}
.slak-toasts{position:fixed;right:16px;top:56px;z-index:60;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none}
.slak-toast{display:flex;gap:9px;align-items:center;max-width:360px;padding:10px 14px;border-radius:11px;background:var(--panel);color:var(--fg);border:1px solid var(--line);box-shadow:var(--shadow);font-size:.92rem;animation:slak-in .22s ease;pointer-events:auto}
.slak-toast.out{opacity:0;transform:translateY(6px);transition:all .25s}
.slak-toast-ic{font-size:1rem}
.slak-balloon{position:fixed;bottom:-70px;z-index:70;width:34px;height:42px;border-radius:50% 50% 47% 47%;background:var(--bc);opacity:.9;pointer-events:none;animation:slak-up 3s ease-in forwards}
.slak-balloon::after{content:"";position:absolute;left:50%;top:100%;width:1px;height:34px;background:var(--muted);opacity:.6}
.slak-sb-lbl{display:none}
@media (max-width:900px){.slak-app.has-nav .slak-top .slak-sb-open{width:auto;padding:0 10px;gap:8px;display:inline-flex;align-items:center;font-size:15px;color:var(--fg);border:1px solid var(--line)}.slak-app.has-nav .slak-sb-lbl{display:inline;font:550 .88rem var(--font);max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
.slak-nav{display:flex;flex-direction:column;gap:2px;margin:0 0 18px}
.slak-nav[hidden]{display:none}
.slak-nav a{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;color:var(--fg);text-decoration:none;font-size:.94rem}
.slak-nav a:hover{background:var(--accent-soft)}
.slak-nav a.on{background:var(--accent-soft);color:var(--accent-ink,var(--accent));font-weight:600}
.slak-nav a .ic{width:20px;text-align:center;flex:none}
.slak-nav-sec{font-size:.72rem;font-weight:650;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:12px 10px 4px}
.slak-nav-sec:first-child{margin-top:0}
.slak-nav-top{flex-direction:row;flex-wrap:wrap;gap:4px;width:100%;max-width:780px;margin:0 auto;padding:4px 28px 0;border-bottom:1px solid var(--line)}
.slak-app.wide .slak-nav-top{max-width:1280px}
.slak-nav-top a{border-radius:8px 8px 0 0;margin-bottom:-1px;border-bottom:2px solid transparent;padding:8px 12px}
.slak-nav-top a.on{background:none;border-bottom-color:var(--accent)}
.slak-nav-top .slak-nav-sec{display:none}
@media (max-width:900px){.slak-nav-top{padding:4px 16px 0}}
.slak-pagelink{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:8px;color:var(--accent);text-decoration:none;font-weight:550;border:1px solid transparent}
.slak-pagelink:hover{background:var(--accent-soft)}
.slak-pagelink.on{border-color:var(--accent-soft);background:var(--accent-soft)}
.slak-editor td.ed{cursor:text}
.slak-editor td.ed:hover{box-shadow:inset 0 0 0 1px var(--line2)}
.slak-editor td.ro{color:var(--muted);background:var(--bg2)}
.slak-editor td.cb{text-align:center}
.slak-editor td.cb input{accent-color:var(--accent);cursor:pointer;margin:0}
.slak-editor td.editing{padding:0;box-shadow:inset 0 0 0 2px var(--accent)}
.slak-editor .slak-cell-in{width:100%;min-width:90px;height:32px;border:0;padding:4px 12px;background:var(--panel);color:var(--fg);font:inherit;outline:none}
.slak-editor td.del,.slak-editor th.del{width:1%;padding:0 4px;text-align:center}
.slak-editor td.del button{border:0;background:none;color:var(--muted);cursor:pointer;font-size:1.05rem;border-radius:6px;padding:0 6px;line-height:1.6}
.slak-editor td.del button:hover{color:var(--err);background:var(--err-bg)}
.slak-editor th .ro{font-size:.75em;opacity:.6}
.slak-editor td.empty{text-align:center;color:var(--muted);padding:18px}
.slak-ed-add{border:0;background:none;color:var(--accent);font:inherit;font-weight:600;cursor:pointer;padding:2px 6px;border-radius:6px;margin-left:6px}
.slak-ed-add:hover{background:var(--accent-soft)}
.slak-ed-loading{padding:18px;color:var(--muted);text-align:center;font-size:.9rem}
@keyframes slak-rot{to{transform:rotate(360deg)}}
@keyframes slak-pulse{50%{opacity:.25}}
@keyframes slak-in{from{opacity:0;transform:translateY(8px)}}
@keyframes slak-up{to{transform:translateY(-118vh) translateX(18px) rotate(6deg)}}
@media (prefers-reduced-motion:reduce){.slak-app *{animation-duration:.01ms!important;transition:none!important}}
`;

  const CSS131 = `
/* ===== Slak 1.3.1 ===== */
.slak-title,.slak-header,.slak-subheader,.slak-md h1,.slak-md h2,.slak-md h3,.slak-md h4{font-family:var(--head-font,var(--font))}
.slak-code code,.slak-md code,.slak-json{color:var(--code-fg,inherit)}
.slak-ic{display:inline-flex;align-items:center;justify-content:center;line-height:1;flex:none}
.slak-mi{display:none}
html.slak-mi-ok .slak-mi{display:inline-flex}
.slak-mi{font-family:'Material Symbols Rounded';font-weight:normal;font-style:normal;font-size:1.15em;letter-spacing:normal;text-transform:none;white-space:nowrap;direction:ltr;-webkit-font-feature-settings:'liga';font-feature-settings:'liga';overflow:hidden;max-width:1.2em;vertical-align:-.2em}
.slak-ic.slak-spin{width:1em;height:1em;border-width:2px}
.slak-c-yellow{color:var(--slak-yellow,#a16207)}.slak-c-primary{color:var(--accent)}
.slak-bg{padding:.05em .35em;border-radius:5px}
.slak-bg-red{background:color-mix(in srgb,var(--slak-red) 16%,transparent)}.slak-bg-green{background:color-mix(in srgb,var(--slak-green) 16%,transparent)}.slak-bg-blue{background:color-mix(in srgb,var(--slak-blue) 16%,transparent)}.slak-bg-orange{background:color-mix(in srgb,var(--slak-orange) 18%,transparent)}.slak-bg-yellow{background:color-mix(in srgb,var(--slak-yellow,#ca8a04) 20%,transparent)}.slak-bg-violet{background:color-mix(in srgb,var(--slak-violet) 16%,transparent)}.slak-bg-gray,.slak-bg-grey{background:color-mix(in srgb,var(--slak-gray) 18%,transparent)}.slak-bg-primary{background:var(--accent-soft)}
.slak-badge{display:inline-flex;align-items:center;gap:.3em;padding:.12em .55em;border-radius:6px;font-size:.84em;font-weight:600;line-height:1.5;--bc:var(--slak-blue);color:var(--bc);background:color-mix(in srgb,var(--bc) 14%,transparent)}
.slak-bc-red{--bc:var(--slak-red)}.slak-bc-green{--bc:var(--slak-green)}.slak-bc-blue{--bc:var(--slak-blue)}.slak-bc-orange{--bc:var(--slak-orange)}.slak-bc-yellow{--bc:var(--slak-yellow,#ca8a04)}.slak-bc-violet{--bc:var(--slak-violet)}.slak-bc-gray,.slak-bc-grey{--bc:var(--slak-gray)}.slak-bc-primary{--bc:var(--accent)}
.slak-badge-wrap{display:flex}
.slak-latex,.slak-math{overflow-x:auto;padding:.2em 0;font-size:1.12em}
.slak-latex math,.slak-math math{font-family:'Latin Modern Math','STIX Two Math','Cambria Math',math}
.slak-md math{font-family:'Latin Modern Math','STIX Two Math','Cambria Math',math}
.slak-helpbox{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--panel);font-size:.9rem}
.slak-help-head{margin-bottom:6px}.slak-help-head code,.slak-help-body code{font:.86em var(--mono)}
.slak-help-body{display:flex;flex-direction:column;gap:2px;max-height:320px;overflow:auto}
.slak-help-body span{color:var(--muted);margin-left:6px}
.slak-help-sec{font-weight:650;margin-top:8px;color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
.slak-help-none{color:var(--muted)}
.slak-iframe-wrap{display:flex}
.slak-layout{display:flex;flex-direction:column;gap:18px}.slak-layout-area{display:flex;flex-direction:column;gap:14px;min-width:0}.slak-layout-area:empty{display:none}.slak-kpi-row{flex-direction:row!important;flex-wrap:wrap;gap:12px}.slak-kpi-row>.slak-el{flex:1 1 170px;min-width:0}.slak-kpi-row>.slak-metric{border:1px solid var(--line);border-radius:12px;padding:12px 16px;background:var(--panel)}.slak-layout-grid-2x2{display:grid;grid-template-columns:1fr 1fr;gap:18px}.slak-layout-grid-2x2>.slak-area-kpi{grid-column:1/-1}.slak-layout-laporan{max-width:760px;margin:0 auto;width:100%}.slak-layout-laporan .slak-area-ringkasan{border-left:3px solid var(--accent);padding-left:14px}.slak-layout-laporan .slak-area-catatan{color:var(--muted);font-size:.92em;border-top:1px solid var(--line);padding-top:10px}@media (max-width:760px){.slak-layout-grid-2x2{grid-template-columns:1fr}}
.slak-iframe{width:100%;border:1px solid var(--line);border-radius:10px;background:#fff}.slak-iframe.slak-component{border:0;border-radius:0;background:transparent}
.slak-space{flex:none}
.slak-stream.streaming::after{content:'▍';color:var(--accent);animation:slak-pulse 1s steps(2) infinite}
.slak-btn.tertiary{border-color:transparent;background:none;padding-left:8px;padding-right:8px}
.slak-btn.tertiary:hover{background:var(--bg2)}
.slak-btn .slak-ic{font-size:1.05em}
.slak-wstretch .slak-btn,.slak-wstretch > .slak-btn{width:100%}
.slak-caret{font-size:.75em;opacity:.7;margin-left:2px}
.slak-pop,.slak-menu-wrap{position:relative;align-self:flex-start}
.slak-pop.slak-wstretch,.slak-pop[style*="100%"]{align-self:stretch}
.slak-pop-panel,.slak-menu{position:absolute;z-index:30;top:calc(100% + 6px);left:0;min-width:240px;max-width:min(420px,90vw);background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:14px}
.slak-pop-panel.right{left:auto;right:0}
.slak-menu{padding:6px;display:flex;flex-direction:column;min-width:180px}
.slak-menu button{all:unset;padding:7px 10px;border-radius:7px;cursor:pointer;font-size:.92rem}
.slak-menu button:hover,.slak-menu button:focus-visible{background:var(--bg2)}
.slak-statusbox{border:1px solid var(--line);border-radius:10px;background:var(--panel)}
.slak-statusbox>summary{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;list-style:none;font-weight:550}
.slak-statusbox>summary::-webkit-details-marker{display:none}
.slak-statusbox>summary::after{content:'▾';margin-left:auto;color:var(--muted);transition:transform .15s}
.slak-statusbox[open]>summary::after{transform:rotate(180deg)}
.slak-st-ic{display:inline-grid;place-items:center;width:18px;height:18px;flex:none;font-weight:700}
.slak-statusbox[data-state=complete] .slak-st-ic{color:var(--ok)}
.slak-statusbox[data-state=error] .slak-st-ic{color:var(--err)}
.slak-statusbox[data-state=error]{border-color:color-mix(in srgb,var(--err) 40%,var(--line))}
.slak-st-body{padding:4px 14px 14px}
.slak-skel:empty{height:var(--skh,40px);border-radius:8px;background:linear-gradient(90deg,var(--bg2) 25%,color-mix(in srgb,var(--bg2) 60%,var(--panel)) 50%,var(--bg2) 75%);background-size:200% 100%;animation:slak-shimmer 1.3s ease-in-out infinite}
@keyframes slak-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.slak-dlg-layer{display:contents}
.slak-dlg-back{position:fixed;inset:0;z-index:60;background:rgba(10,12,16,.45);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px;overflow:auto;animation:slak-fade .15s ease}
.slak-dlg{background:var(--panel);color:var(--fg);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.35);max-width:100%;padding:18px 22px 22px;animation:slak-pop .18s ease}
.slak-dlg-top{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.slak-dlg-title{font-size:1.25rem;font-weight:700;flex:1}
@keyframes slak-fade{from{opacity:0}to{opacity:1}}
@keyframes slak-pop{from{transform:translateY(8px) scale(.98);opacity:0}to{transform:none;opacity:1}}
.slak-pills,.slak-seg{display:flex;flex-wrap:wrap;gap:8px}
.slak-pills button{border:1px solid var(--line2);background:var(--panel);color:var(--fg);border-radius:99px;padding:5px 14px;font:500 .9rem/1.3 var(--font);cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.slak-pills button:hover{border-color:var(--accent)}
.slak-pills button.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink,var(--accent))}
.slak-seg{gap:0;flex-wrap:nowrap;width:fit-content;max-width:100%;overflow-x:auto}
.slak-seg button{border:1px solid var(--line2);background:var(--panel);color:var(--fg);padding:6px 14px;font:500 .9rem/1.3 var(--font);cursor:pointer;margin-left:-1px;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.slak-seg button:first-child{border-radius:calc(9px*var(--rs,1)) 0 0 calc(9px*var(--rs,1));margin-left:0}
.slak-seg button:last-child{border-radius:0 calc(9px*var(--rs,1)) calc(9px*var(--rs,1)) 0}
.slak-seg button.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink,var(--accent));position:relative;z-index:1}
.slak-pills .slak-disabled button,.slak-pills.slak-disabled button,.slak-seg.slak-disabled button,.slak-feedback.slak-disabled button{opacity:.55;cursor:not-allowed}
.slak-fb-wrap{display:flex}
.slak-feedback{display:flex;gap:4px}
.slak-feedback button{border:0;background:none;font-size:1.35rem;line-height:1;padding:5px 6px;border-radius:8px;cursor:pointer;filter:grayscale(1);opacity:.55;transition:transform .1s,opacity .1s,filter .1s}
.slak-feedback button:hover{opacity:.9;filter:none;transform:scale(1.08)}
.slak-feedback button.on{filter:none;opacity:1}
.slak-fb-stars button{filter:none;color:var(--line2);opacity:1;font-size:1.5rem}
.slak-fb-stars button.on{color:#f5b301}
.slak-pager-wrap{display:flex}
.slak-pager{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.slak-pager button{min-width:34px;height:34px;padding:0 8px;border:1px solid transparent;background:none;color:var(--fg);border-radius:8px;font:500 .9rem var(--font);cursor:pointer}
.slak-pager button:hover:not(:disabled){background:var(--bg2)}
.slak-pager button.on{border-color:var(--accent);color:var(--accent-ink,var(--accent));background:var(--accent-soft)}
.slak-pager button:disabled{opacity:.35;cursor:default}
.slak-pager .gap{color:var(--muted);padding:0 4px}
.slak-rec{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px dashed var(--line2);border-radius:10px;padding:10px 12px;background:var(--panel)}
.slak-rec-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line2);background:var(--panel);color:var(--fg);border-radius:99px;padding:6px 14px;font:550 .9rem var(--font);cursor:pointer}
.slak-rec-btn i.dot{width:10px;height:10px;border-radius:50%;background:var(--err)}
.slak-rec-btn i.sq{width:10px;height:10px;border-radius:2px;background:var(--err)}
.slak-rec-btn.on{border-color:var(--err);color:var(--err);animation:slak-pulse 1.2s ease-in-out infinite}
.slak-rec-msg{color:var(--muted);font-size:.88rem}
.slak-rec-msg.err,.slak-cam-msg.err,.slak-chat-err{color:var(--err)}
.slak-rec-play{height:36px;max-width:100%}
.slak-rec-clear{border:0;background:none;color:var(--muted);cursor:pointer;font:.86rem var(--font);text-decoration:underline}
.slak-cam-view{max-width:480px;width:100%;margin:0 auto;position:relative;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg2);aspect-ratio:4/3;max-height:420px;display:grid;place-items:center}
.slak-cam-view video,.slak-cam-view img{width:100%;height:100%;object-fit:cover}
.slak-cam-msg{color:var(--muted);font-size:.9rem;padding:20px;text-align:center}
.slak-cam-bar{display:flex;justify-content:center;margin-top:8px;max-width:480px;width:100%;margin-left:auto;margin-right:auto}
.slak-ext-chart{position:relative}
.slak-ext-box{min-height:120px;width:100%}
.slak-ext-box svg{max-width:100%}
.slak-ext-load,.slak-ext-err{display:flex;align-items:center;justify-content:center;gap:10px;min-height:160px;color:var(--muted);font-size:.9rem;border:1px dashed var(--line2);border-radius:10px;padding:16px;text-align:center}
.slak-ext-err{color:var(--err);border-color:color-mix(in srgb,var(--err) 40%,var(--line))}
.slak-gv-dark{filter:invert(.92) hue-rotate(180deg)}
.slak-df-tools{display:inline-flex;align-items:center;gap:6px}
.slak-df-search{border:1px solid var(--line2);border-radius:7px;padding:3px 8px;font:.82rem var(--font);background:var(--panel);color:var(--fg);width:160px}
.slak-df th.sel,.slak-df td.sel{width:30px;text-align:center;padding-left:6px;padding-right:6px}
.slak-df td.sel input{accent-color:var(--accent);cursor:pointer}
.slak-df tr.on td{background:var(--accent-soft)}
.slak-df th.csel{cursor:pointer}
.slak-df th.on,.slak-df td.on{background:var(--accent-soft);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 50%,transparent)}
.slak-df-box.cellsel td[data-c]{cursor:cell}
.slak-df .stick{position:sticky;z-index:2;background:var(--panel)}
.slak-df thead .stick{z-index:3;background:var(--bg2)}
.slak-df td.empty{text-align:center;color:var(--muted);padding:16px}
.slak-cprog{display:inline-block;width:70px;height:7px;border-radius:99px;background:var(--bg2);overflow:hidden;vertical-align:middle;margin-right:7px}
.slak-cprog i{display:block;height:100%;background:var(--accent);border-radius:99px}
.slak-cprog-t{font-variant-numeric:tabular-nums;font-size:.86em;color:var(--muted)}
.slak-df td.img img{height:34px;max-width:120px;object-fit:contain;border-radius:4px;vertical-align:middle}
.slak-df td.media audio{height:30px;max-width:200px}
.slak-df td.media video{height:60px;max-width:140px}
.slak-df td.spark{padding-top:3px;padding-bottom:3px}
.slak-spark{display:block}
.slak-tag{display:inline-block;padding:0 7px;margin:1px 3px 1px 0;border-radius:99px;background:var(--bg2);border:1px solid var(--line);font-size:.84em;line-height:1.6}
.slak-cbtn{border:1px solid var(--line2);background:var(--panel);color:var(--fg);border-radius:7px;padding:2px 10px;font:500 .84rem var(--font);cursor:pointer}
.slak-cbtn:hover{border-color:var(--accent);color:var(--accent)}
.slak-df td.link a{color:var(--link,var(--accent))}
.slak-cell-multi{min-width:160px}
.slak-metric-sp{margin-top:4px}
.slak-metric-d.named{background:color-mix(in srgb,currentColor 12%,transparent)}
.slak-metric-dd{color:var(--muted);font-weight:400;margin-left:4px}
.slak-box.slak-horiz{flex-direction:row;flex-wrap:wrap;align-items:flex-start}
.slak-box.slak-horiz.slak-nowrap{flex-wrap:nowrap;overflow-x:auto}
.slak-box.slak-horiz > .slak-el{flex:0 1 auto;min-width:0}
.slak-box.slak-horiz > .slak-field,.slak-box.slak-horiz > .slak-df,.slak-box.slak-horiz > .slak-chart{flex:1 1 200px}
.slak-box.slak-stretch-h{flex:1}
.slak-cols > .slak-col.slak-bordered{border:1px solid var(--line);border-radius:10px;padding:14px}
.slak-chatin-wrap{display:flex;flex-direction:column;gap:6px}
.slak-chatin-wrap.inline{margin-top:4px}
.slak-chatin-wrap .slak-chatin{align-items:flex-end}
.slak-chat-field{resize:none;font:inherit;line-height:1.5;max-height:200px;overflow-y:auto}
.slak-chat-tool{border:0;background:none;color:var(--muted);font-size:1.15rem;cursor:pointer;width:34px;height:34px;border-radius:8px;flex:none}
.slak-chat-tool:hover{background:var(--bg2);color:var(--fg)}
.slak-chat-tool.on{color:var(--err);animation:slak-pulse 1.2s ease-in-out infinite}
.slak-chat-chips{display:flex;flex-wrap:wrap;gap:6px}
.slak-chat-chips[hidden]{display:none}
.slak-chat-err:empty{display:none}
.slak-chat-err{font-size:.85rem}
.slak-logo{display:inline-flex;align-items:center;flex:none;margin:0 4px}
.slak-logo img{height:26px;max-width:160px;object-fit:contain;display:block}
.slak-logo[data-size=small] img{height:20px}.slak-logo[data-size=large] img{height:34px}
.slak-logo-side{margin:0 0 18px}
.slak-logo-side img{height:32px;max-width:200px}
.slak-app.has-sidebar:not(.sb-toggled) .slak-top .slak-logo{display:none}
.slak-app.tb-min .slak-top .slak-iconbtn:not(.slak-sb-open):not(.slak-menu-open){display:none}
.slak-app.no-sbnav .slak-nav:not(.slak-nav-top){display:none!important}
.slak-appmenu{position:absolute;top:44px;right:10px;z-index:40;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:6px;display:flex;flex-direction:column;min-width:200px}
.slak-appmenu[hidden]{display:none}
.slak-appmenu a,.slak-appmenu button{all:unset;padding:8px 12px;border-radius:7px;cursor:pointer;font-size:.92rem;color:var(--fg)}
.slak-appmenu a:hover,.slak-appmenu button:hover{background:var(--bg2)}
.slak-flake{position:fixed;top:-30px;z-index:70;pointer-events:none;color:#cfe8ff;text-shadow:0 0 3px rgba(80,120,170,.6);animation:slak-snow linear forwards}
@keyframes slak-snow{to{transform:translate(var(--drift,0),110vh) rotate(260deg)}}
.slak-radio-t{display:inline-flex;flex-direction:column}
.slak-radio-cap{color:var(--muted);font-size:.84em;line-height:1.35}
.slak-chart svg.selectable .bar,.slak-chart svg.selectable .pt,.slak-chart svg.selectable .dot{cursor:pointer}
.slak-chart svg.selectable .hit{cursor:pointer}
.slak-chart svg.has-sel .bar:not(.on),.slak-chart svg.has-sel .pt:not(.on){opacity:.28}
.slak-chart svg.has-sel .dot.on{r:5;stroke-width:2}
.slak-chart .bar.layer{opacity:.62}
.slak-multi-add{margin-top:6px}
.slak-chip.new{border-style:dashed}
.slak-plotly{min-height:300px}
.slak-anchor{margin-left:.35em;color:var(--muted);text-decoration:none;font-weight:400;opacity:0;transition:opacity .15s;font-size:.7em;vertical-align:middle}
.slak-title:hover .slak-anchor,.slak-header:hover .slak-anchor,.slak-subheader:hover .slak-anchor,.slak-anchor:focus-visible{opacity:.8}
`;

  let cssDone = false;
  function injectCSS() {
    if (cssDone || typeof document === 'undefined') return;
    cssDone = true;
    const s = document.createElement('style');
    s.id = 'slak-style';
    s.textContent = CSS.replace(/border-radius:(\d+(?:\.\d+)?)px/g, (m, n) => +n >= 50 ? m : `border-radius:calc(${n}px*var(--rs,1))`) + CSS131;
    document.head.append(s);
  }

  /* ======================================================================
   * Ekspor & mode <script type="text/slak">
   * ==================================================================== */

  function compile(code) {
    try { return new AsyncFunction('sl', code); }
    catch (e) { return () => { throw e; }; }
  }

  const Slak = {
    version: VERSION,
    /** Jalankan aplikasi. `script` adalah fungsi (sl) => {...} atau teks kode. */
    run(script, o) {
      const fn = typeof script === 'string' ? compile(script) : script;
      return new App(fn, o);
    },
    compile,
    emoji: emojiAPI,
    files: {},
    load_file: loadFile,
    ask_file: askFile,
    pick_cache: { get: pickGet, put: pickPut },
    wrap_file: wrapFile,
    /** Tambahkan kemampuan baru: { api: {nama: fn}, elements: {nama: (ctx, ...a) => ...}, table: fn, write: fn, blob: fn } */
    extend(x) {
      x = x || {};
      Object.assign(EXT.api, x.api || {});
      for (const k in (x.elements || {})) EL[k] = x.elements[k];
      if (x.table) EXT.table.push(x.table);
      if (x.write) EXT.write.push(x.write);
      if (x.blob) EXT.blob.push(x.blob);
      if (x.wrap) EXT.wrap.push(x.wrap);
      for (const k in (x.api || {})) if (!(k in Slak)) Slak[k] = x.api[k];
      return Slak;
    },
    /** Alat internal untuk ekstensi resmi (jangan diandalkan oleh aplikasi). */
    internals: () => ({ colConf, cellView, iconHTML, loadLib, sparkSVG, texToMathML, CRYPTO, makeAPI, touch, prune, unplace, setWidth, parseDuration, mediaSrc, readUpload, trigger, setLabel, fieldShell, setDisabled, themeIsDark, h, esc, place, toTable, parseCSV, toCSV, fmtNum, fmtCat, isNum, isPlainObj, md, inline, newCtx, childCtx, EL, EXT, chartBox, niceTicks, cellHTML, renderDF, downloadBlob, bindWidget, commit, fixValue, ident, tipShow, tipRow, cssVar, setLegend, finishBox, seriesColors, RERUN, makeFmt, fmtTick }),
    db: (name, schema) => useDb(null, name, schema),
    db_list: dbList,
    clear_local_state: (id) => { try { localStorage.removeItem(lsKey(id || defaultAppId())); } catch (e) { /* abaikan */ } },
    cache_data: cacheData,
    cache_resource: cacheResource,
    crypto: CRYPTO,
    column_config,
    latex: texToMathML,
    lib_urls: {},
    get_option: k => (k in GLOBAL_OPTS ? GLOBAL_OPTS[k] : k in OPT_DEFAULTS ? OPT_DEFAULTS[k] : null),
    set_option: (k, v) => { GLOBAL_OPTS[k] = v; },
    toast: (t, o) => { if (CUR_APP && !CUR_APP.destroyed) CUR_APP.toast(t, o); },
    parse_csv: parseCSV,
    to_csv: toCSV,
    markdown: md,
    set locale(v) { LOCALE = v; },
    get locale() { return LOCALE; }
  };

  function autoRun() {
    const scripts = document.querySelectorAll('script[type="text/slak"]');
    scripts.forEach(s => {
      if (s.dataset.slakDone) return;
      s.dataset.slakDone = '1';
      let target = s.dataset.target ? document.querySelector(s.dataset.target) : null;
      if (!target) {
        target = document.createElement('div');
        if (s.closest('head') || !s.parentNode) (document.body || document.documentElement).append(target); else s.after(target);
      }
      Slak.run(s.textContent, {
        target,
        theme: s.dataset.theme,
        layout: s.dataset.layout,
        title: s.dataset.title,
        app_id: s.dataset.app,
        embedded: s.dataset.embedded != null
      });
    });
  }


  /* ======================================================================
   * sl.connection ke database di server (Slak 1.6): slak-bridge (PHP/Node) dan libSQL/Turso.
   * Tipe "sql"/"sqlite" (SQLite di browser) tetap ditangani slak-sql.js.
   * ==================================================================== */
  const REMOTE_TYPES = { bridge: 'bridge', jembatan: 'bridge', mysql: 'bridge', mariadb: 'bridge', postgresql: 'bridge', postgres: 'bridge', pgsql: 'bridge', libsql: 'libsql', turso: 'libsql' };
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/, DATE_TIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
  function remoteFrame(cols, rows, o) {
    o = o || {};
    const D = global.Slak && global.Slak.data;
    const toD = v => D ? D.toDate(v) : new Date(String(v).replace(' ', 'T'));
    const seen = {};
    const names = cols.map(c => { const n = c.name; if (seen[n]) { seen[n]++; return n + '_' + seen[n]; } seen[n] = 1; return n; });
    const conv = cols.map((c, j) => o.parse_dates !== false && (c.type === 'date' || c.type === 'datetime' || (rows.some(r => r[j] != null) && rows.every(r => r[j] == null || (typeof r[j] === 'string' && (DATE_ONLY.test(r[j]) || DATE_TIME.test(r[j])))))));
    const fix = (v, j) => v == null ? null : conv[j] && typeof v === 'string' ? toD(v) : v;
    if (D) { const d = {}; names.forEach((n, j) => { d[n] = rows.map(r => fix(r[j], j)); }); return D.DataFrame._make ? D.DataFrame._make(names, d, rows.length) : new D.DataFrame(d); }
    return rows.map(r => Object.fromEntries(names.map((n, j) => [n, fix(r[j], j)])));
  }
  function libsqlArg(v) {
    if (v == null) return { type: 'null' };
    if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
    if (typeof v === 'bigint') return { type: 'integer', value: String(v) };
    if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
    if (v instanceof Date) return { type: 'text', value: v.toISOString() };
    return { type: 'text', value: String(v) };
  }
  function libsqlVal(x) {
    if (!x || x.type === 'null') return null;
    if (x.type === 'integer') { const n = Number(x.value); return Number.isSafeInteger(n) ? n : x.value; }
    if (x.type === 'float') return Number(x.value);
    if (x.type === 'blob') return `[blob ${Math.floor(String(x.base64 || '').length * 3 / 4)} byte]`;
    return x.value;
  }
  const declType = t => { t = String(t || '').toLowerCase(); return /int/.test(t) ? 'int' : /real|floa|doub|num|dec/.test(t) ? 'number' : /^date$/.test(t) ? 'date' : /datetime|timestamp/.test(t) ? 'datetime' : /bool/.test(t) ? 'bool' : 'text'; };

  class RemoteConnection {
    constructor(name, kind, o) {
      this.name = name; this.type = kind; this.o = o; this._cache = new Map();
      let url = o.url || o.host || null;
      if (!url) throw new Error(kind === 'libsql'
        ? `sl.connection("${name}"): sebutkan url database libSQL/Turso, misalnya { type: "turso", url: "libsql://nama-db-akun.turso.io", token: "..." }.`
        : `sl.connection("${name}"): sebutkan alamat jembatan, misalnya { type: "bridge", url: "slak-bridge.php" }. Database MySQL/PostgreSQL di server dibaca lewat slak-bridge.php (cPanel) atau slak-bridge.js (Node.js).`);
      url = String(url);
      if (kind === 'libsql') url = url.replace(/^libsql:\/\//i, 'https://').replace(/^wss?:\/\//i, m => m.toLowerCase() === 'ws://' ? 'http://' : 'https://').replace(/\/+$/, '');
      else if (!/^[a-z][\w+.-]*:/i.test(url) && typeof location !== 'undefined' && /^(file|slak-preview):$/.test(location.protocol) && o.dev_url) url = String(o.dev_url);
      else if (!/^[a-z][\w+.-]*:/i.test(url) && typeof location !== 'undefined' && /^(file|slak-preview):$/.test(location.protocol))
        throw new Error(`${location.protocol === 'file:' ? 'Halaman ini dibuka dengan klik dua kali' : 'Di pratinjau Slak Studio'}, alamat jembatan harus lengkap, misalnya "https://situsmu.com/${url.replace(/^\.?\//, '')}" atau "http://localhost:8787" (slak-bridge.js). Alamat pendek "${url}" baru berlaku setelah halaman diunggah ke hosting yang sama; untuk mencoba sebelum diunggah, tambahkan dev_url: "https://situsmu.com/${url.replace(/^\.?\//, '')}".`);
      this.url = url;
      // token masuk dari slak-bridge (Slak 1.7): disimpan per alamat jembatan
      this._tokKey = 'slak-bridge-token|' + url;
      this._tok = null;
      if (kind === 'bridge') for (const st of [() => sessionStorage, () => localStorage]) { try { const v = st().getItem(this._tokKey); if (v) { const t = JSON.parse(v); if (t.exp * 1000 > Date.now()) this._tok = t; } } catch (e) { /* abaikan */ } }
    }
    /** Pengguna yang sedang masuk lewat jembatan ini, atau null. */
    get user() { return this._tok && this._tok.exp * 1000 > Date.now() ? Object.assign({}, this._tok.user) : null; }
    _saveTok(t, remember) {
      this._tok = t;
      try { sessionStorage.removeItem(this._tokKey); localStorage.removeItem(this._tokKey); } catch (e) { /* abaikan */ }
      if (t) try { (remember ? localStorage : sessionStorage).setItem(this._tokKey, JSON.stringify(t)); } catch (e) { /* abaikan */ }
    }
    async _bridge(body) {
      body = Object.assign({ database: this.o.database, key: this.o.key }, body);
      if (this._tok && body.op !== 'login') body.token = this._tok.token;
      const { status, j } = await this._post(this.url, body);
      if (!j.ok) {
        if (status === 401 && this._tok && /Sesi/.test(j.error)) { this._saveTok(null); if (global.Slak._activeApp) global.Slak._activeApp.rerun(); }
        const e = new Error('slak-bridge: ' + j.error); e.status = status; throw e;
      }
      return j;
    }
    /** Masuk dengan akun yang diatur di slak-bridge (users / users_query). */
    async login(username, password, o) {
      if (this.type !== 'bridge') throw new Error('Login hanya tersedia lewat slak-bridge.');
      const j = await this._bridge({ op: 'login', username: String(username || ''), password: String(password || '') });
      this._saveTok({ token: j.token, exp: j.expires, user: j.user }, !!(o && o.remember));
      this._cache.clear();
      return Object.assign({}, j.user);
    }
    logout() { this._saveTok(null); this._cache.clear(); }
    /** Periksa jawaban kuis dengan kunci jawaban yang disimpan di slak-bridge. */
    async check_quiz(name, answers, o) {
      if (this.type !== 'bridge') throw new Error('check_quiz hanya tersedia lewat slak-bridge.');
      if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('check_quiz butuh jawaban berupa objek, misalnya { s1: "B", s2: "42" }.');
      const j = await this._bridge(Object.assign({ op: 'quiz', quiz: name, answers }, o && o.name ? { name: o.name } : {}));
      delete j.ok;
      return j;
    }
    async _post(target, body, headers) {
      let res;
      try { res = await fetch(target, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body) }); }
      catch (e) { throw new Error(global.Slak._remoteHint ? global.Slak._remoteHint(target, '') : `Tidak bisa menghubungi ${target}.`); }
      const text = await res.text();
      let j; try { j = JSON.parse(text); } catch (e) {
        if (this.type === 'bridge' && /<\?php/.test(text)) throw new Error('Server mengirim isi slak-bridge.php apa adanya: PHP tidak berjalan di sana. Unggah ke hosting yang mendukung PHP (cPanel), atau pakai slak-bridge.js dengan Node.js.');
        throw new Error(`Jawaban dari ${target} bukan JSON (HTTP ${res.status}). Periksa alamatnya.`);
      }
      return { status: res.status, j };
    }
    async _exec(sql, params, named) {
      if (this.type === 'bridge') {
        const body = {};
        if (named) body.query = named; else body.sql = sql;
        if (params != null) body.params = params;
        const j = await this._bridge(body);
        if (j.truncated) console.warn(`[Slak] Hasil kueri dipotong di ${j.rowCount} baris (max_rows di slak-bridge).`);
        return j;
      }
      // libSQL / Turso: HTTP API "Hrana" v2
      const stmt = { sql };
      if (Array.isArray(params)) stmt.args = params.map(libsqlArg);
      else if (params && typeof params === 'object') stmt.named_args = Object.entries(params).map(([k, v]) => ({ name: /^[:@$]/.test(k) ? k : ':' + k, value: libsqlArg(v) }));
      const tok = this.o.token || this.o.auth_token || this.o.authToken;
      const { status, j } = await this._post(this.url + '/v2/pipeline', { requests: [{ type: 'execute', stmt }, { type: 'close' }] }, tok ? { Authorization: 'Bearer ' + tok } : null);
      if (status === 401 || status === 403) throw new Error('libSQL/Turso menolak token. Buat token baru (turso db tokens create nama-db), sebaiknya hanya-baca: --read-only.');
      const r = j.results && j.results[0];
      if (!r) throw new Error('libSQL: ' + (j.error && j.error.message || j.message || 'jawaban tidak dikenal'));
      if (r.type === 'error') throw new Error('libSQL: ' + (r.error && r.error.message));
      const res = r.response.result;
      return { columns: res.cols.map(c => ({ name: c.name, type: declType(c.decltype) })), rows: res.rows.map(row => row.map(libsqlVal)), rowCount: res.cols.length ? res.rows.length : res.affected_row_count, lastInsertId: res.last_insert_rowid != null ? String(res.last_insert_rowid) : null };
    }
    async query(sql, o) {
      o = Array.isArray(o) ? { params: o } : (o || {});
      const ttl = typeof o.ttl === 'number' ? o.ttl * 1000 : null;
      const key = JSON.stringify([sql, o.params || null, o.named || null, this._tok ? this._tok.user.username : null]);
      const hit = this._cache.get(key);
      if (hit && ttl && Date.now() - hit.t < ttl) return hit.v.copy ? hit.v.copy() : hit.v;
      const r = await this._exec(sql, o.params, o.named);
      const v = r.columns && r.columns.length ? remoteFrame(r.columns, r.rows, o) : { rowCount: r.rowCount, lastInsertId: r.lastInsertId };
      if (ttl) this._cache.set(key, { v, t: Date.now() });
      return v;
    }
    async execute(sql, params) { const r = await this._exec(sql, params); this._cache.clear(); return { rowCount: r.rowCount, lastInsertId: r.lastInsertId }; }
    async run(name, params, o) { if (this.type !== 'bridge') throw new Error('Kueri bernama hanya ada di slak-bridge.'); return this.query(null, Object.assign({}, o, { params, named: name })); }
    async tables() {
      if (this.type === 'bridge') { const j = await this._bridge({ op: 'tables' }); return remoteFrame(j.columns, j.rows); }
      return this.query("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' ORDER BY name");
    }
    async table(name, o) { const q = this.type === 'libsql' ? '"' + String(name).replace(/"/g, '""') + '"' : String(name).replace(/[^\w.]/g, ''); return this.query(`SELECT * FROM ${q}`, o); }
    reset() { this._cache.clear(); }
  }
  const REMOTE_CONNS = new Map();
  function connection(name, o) {
    if (typeof o === 'string') o = /^(https?|libsql|wss?):\/\//i.test(o) || /\.(php|js)$/i.test(o) ? { url: o } : { type: o };
    o = Object.assign({}, o || {});
    if (!o.type) o.type = o.url ? (/^libsql:|turso\.io/i.test(o.url) ? 'libsql' : 'bridge') : 'sql';
    const kind = REMOTE_TYPES[String(o.type).toLowerCase()];
    if (!kind) {
      if (EXT.api.connection) return EXT.api.connection(name, o);
      throw new Error(`sl.connection type "${o.type}" butuh slak-sql.js (SQLite di browser). Tambahkan <script src="slak-sql.js"></script>, atau pakai type "bridge" / "turso" untuk database di server.`);
    }
    const key = [name, kind, o.url, o.database || ''].join('|');
    if (!REMOTE_CONNS.has(key)) REMOTE_CONNS.set(key, new RemoteConnection(name, kind, o));
    return REMOTE_CONNS.get(key);
  }


  /* ======================================================================
   * sl.testing (Slak 1.7): menguji aplikasi tanpa membuka browser sungguhan,
   * padanan streamlit.testing.v1.AppTest.
   *   const at = await sl.testing.run(kode)
   *   await at.text_input("Nama").set_value("Ani").run()
   *   sl.testing.expect(at.markdown[0].value).toContain("Ani")
   * ==================================================================== */
  const T_TEXT = { title: 0, header: 0, subheader: 0, markdown: 0, caption: 0, text: 0, code: 0, latex: 0, success: 0, info: 0, warning: 0, error: 0, toast: 0, badge: 0 };
  const T_INPUT = new Set(['component', 'text_input', 'text_area', 'number_input', 'slider', 'select_slider', 'selectbox', 'multiselect', 'radio', 'checkbox', 'toggle', 'date_input', 'time_input', 'datetime_input', 'color_picker', 'pills', 'segmented_control', 'feedback', 'chat_input', 'data_editor', 'file_uploader', 'camera_input', 'audio_input', 'pagination']);
  const T_BUTTON = new Set(['button', 'form_submit_button', 'download_button', 'link_button', 'page_link', 'menu_button']);
  const T_HIDE = new Set(['columns', 'container', 'expander', 'tabs', 'form', 'popover', 'empty', 'sidebar', 'fragment', 'dialog', 'status', 'spinner', 'html', 'echo', 'set_page_config', 'logo', 'navigation', 'page']);
  function tLabel(e) {
    if (e.type === 'component') return e.rec ? e.rec.f.title : '';
    if (e.type === 'page_link' && e.args[0] && typeof e.args[0] === 'object') return String((isPlainObj(e.args[1]) && e.args[1].label) || e.args[0].title || '');   // 1.9.1: tautan ke objek halaman
    if (T_INPUT.has(e.type) || T_BUTTON.has(e.type) || e.type === 'metric') return typeof e.args[0] === 'string' ? e.args[0] : '';
    return '';
  }
  function tKey(e) { const o = e.args.find(x => isPlainObj(x) && 'key' in x); return o ? o.key : (e.rec && e.rec.key != null ? e.rec.key : null); }
  class TestElement {
    constructor(at, e) {
      this._at = at; this._e = e;
      this.type = e.type; this.label = tLabel(e); this.key = tKey(e); this.args = e.args;
    }
    /** Nilai elemen: isi teks untuk elemen teks, nilai widget untuk widget, data untuk tabel/grafik. */
    get value() {
      const e = this._e, t = e.type;
      if (t in T_TEXT) return e.args[0] == null ? '' : String(e.args[0]);
      if (t === 'write') return e.args.length === 1 ? e.args[0] : e.args;
      if (t === 'metric') return e.args[1];
      if (T_INPUT.has(t)) return e.rec ? e.rec.value : e.ret;
      if (T_BUTTON.has(t)) return e.ret;
      return e.args[0];
    }
    get delta() { return this.type === 'metric' ? (isPlainObj(this.args[2]) ? this.args[2].delta : this.args[2]) : undefined; }
    get disabled() { const o = this.args.find(isPlainObj); return !!(o && o.disabled); }
    get options() { const o = this.args[1]; return Array.isArray(o) ? o : o && o.options; }
    /** Isi nilai widget seperti pengguna mengetiknya; jalankan ulang dengan .run(). */
    set_value(v) {
      const rec = this._e.rec;
      if (!rec || !T_INPUT.has(this.type)) throw new Error(`sl.testing: ${this.type} bukan widget isian, jadi tidak punya set_value().`);
      if (this.type === 'number_input' || this.type === 'slider') { if (typeof v === 'string' && v.trim() !== '' && !isNaN(+v)) v = +v; }
      if (this.type === 'chat_input') { trigger(rec, { v }); return this; }   // pesan obrolan: sekali kirim, seperti menekan Enter
      if (rec.form) rec.app.pendingFor(rec.form).set(rec.wid, { rec, v }); else store(rec, v);
      rec.shown = v; rec.force = true;
      return this;
    }
    input(v) { return this.set_value(v); }
    select(v) { return this.set_value(v); }
    check() { return this.set_value(true); }
    uncheck() { return this.set_value(false); }
    /** Tekan tombol (button, form_submit_button). */
    click() {
      const rec = this._e.rec;
      if (!rec || !T_BUTTON.has(this.type)) throw new Error(`sl.testing: ${this.type} bukan tombol, jadi tidak bisa di-click().`);
      // tekan tombol sungguhan di halaman uji, supaya perilakunya sama persis (form, callback, jalan ulang)
      if (this.type === 'page_link') {
        // tautan halaman: pindah halaman di aplikasi uji saja (alamat halaman induk tidak berubah)
        const target = this._e.args[0];
        if (typeof target === 'string' && /^(https?:|mailto:)/i.test(target)) return this;
        try { rec.app.switchPage(target); } catch (e) { if (e !== RERUN) throw e; }
        return this;
      }
      const b = rec.b || (rec.el && rec.el.querySelector('button, a'));
      if (b && b.tagName === 'BUTTON') { if (b.disabled) throw new Error(`sl.testing: tombol "${this.label}" sedang nonaktif.`); b.click(); }
      else { rec.app.triggers.set(rec.wid, true); rec.app.rerun(); }
      return this;
    }
    run(o) { return this._at.run(o); }
    toString() { return `${this.type}${this.label ? ' "' + this.label + '"' : ''}`; }
  }
  /** Daftar elemen satu jenis: bisa diindeks (at.button[0]) dan dipanggil dengan label/key (at.button("Kirim")). */
  function tList(at, items, type) {
    const f = (q) => {
      if (typeof q === 'number') { const x = items[q < 0 ? items.length + q : q]; if (!x) throw new Error(`sl.testing: ${type}[${q}] tidak ada (hanya ${items.length}).`); return x; }
      const x = items.find(i => i.label === q || i.key === q) || items.find(i => typeof i.value === 'string' && i.value.includes(q));
      if (!x) throw new Error(`sl.testing: ${type} "${q}" tidak ditemukan. Yang ada: ${items.map(i => i.label || i.key || JSON.stringify(i.value)).join(', ') || '(tidak ada)'}.`);
      return x;
    };
    items.forEach((x, i) => { f[i] = x; });
    Object.defineProperty(f, 'length', { value: items.length });
    f.values = items.map(x => x.value);
    f.all = items;
    f[Symbol.iterator] = () => items[Symbol.iterator]();
    f.map = fn => items.map(fn); f.filter = fn => items.filter(fn); f.find = fn => items.find(fn);
    return f;
  }
  class AppTest {
    constructor(fn, o) {
      this.o = o || {};
      this._box = h('div', { class: 'slak-testing-box', 'aria-hidden': 'true' });
      this._box.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:700px;overflow:hidden;visibility:hidden;pointer-events:none';
      document.body.append(this._box);
      const prevActive = global.Slak._activeApp;
      this.app = new App(fn, { target: this._box, app_id: 'slak-uji-' + Math.random().toString(36).slice(2), theme: 'light', session_state: this.o.session_state ? Object.assign({}, this.o.session_state) : undefined });
      global.Slak._activeApp = prevActive;
      this.app._trace = [];
      this.app._errors = [];
      this.app._testing = true;
    }
    /** Tunggu sampai aplikasi selesai berjalan. */
    async run(o) {
      o = o || {};
      const app = this.app, t0 = Date.now(), limit = o.timeout || this.o.timeout || 10000;
      if (!app.running && !app.scheduled) app.rerun();
      await new Promise(r => setTimeout(r, 0));
      while (app.running || app.scheduled || app.again || app.wantFull || app.fragQ.size) {
        if (Date.now() - t0 > limit) throw new Error(`sl.testing: aplikasi belum selesai setelah ${limit / 1000} detik (perulangan tanpa akhir atau menunggu jaringan?).`);
        await new Promise(r => setTimeout(r, 10));
      }
      if (global.Slak._activeApp === app) global.Slak._activeApp = null;
      return this;
    }
    get elements() { return (this.app._trace || []).filter(e => !T_HIDE.has(e.type) && e.type !== 'exception').map(e => new TestElement(this, e)); }
    get(type) { return tList(this, this.elements.filter(x => x.type === type), type); }
    get session_state() { return this.app.ss; }
    get exception() { return (this.app._errors || []).map(e => ({ type: 'exception', value: e.message, message: e.message, name: e.name, error: e })); }
    get text_content() { return this._box.textContent; }
    switch_page(p) { if (!this.app.nav) throw new Error('sl.testing: aplikasi ini tidak memakai sl.navigation.'); try { this.app.switchPage(p); } catch (e) { if (e !== RERUN) throw e; } return this; }
    close() { try { this.app.destroy ? this.app.destroy() : (this.app.destroyed = true); } catch (e) { /* abaikan */ } this._box.remove(); }
  }
  for (const t of ['title', 'header', 'subheader', 'markdown', 'caption', 'text', 'code', 'latex', 'json', 'write', 'success', 'info', 'warning', 'error', 'toast', 'metric', 'dataframe', 'table', 'data_editor', 'line_chart', 'bar_chart', 'area_chart', 'scatter_chart', 'map', 'badge', 'divider', 'image', 'progress',
    'write_stream', 'vega_lite_chart', 'altair_chart', 'plotly_chart', 'echarts_chart', 'graphviz_chart', 'pydeck_chart', 'audio', 'video', 'pdf', 'iframe', 'chat_message', 'help', 'space',
    ...T_INPUT, ...T_BUTTON]) {
    if (!(t in AppTest.prototype)) Object.defineProperty(AppTest.prototype, t, { get() { return this.get(t); } });
  }
  /** Pernyataan sederhana: expect(x).toBe(y), .toEqual, .toContain, .toBeGreaterThan, .toBeCloseTo, .toHaveLength, .toBeTruthy, .not.… */
  function expect(actual) {
    const show = v => { try { return typeof v === 'string' ? JSON.stringify(v) : v instanceof Date ? v.toISOString() : JSON.stringify(v) ?? String(v); } catch (e) { return String(v); } };
    const deq = (a, b) => { if (a === b) return true; if (a instanceof Date && b instanceof Date) return +a === +b; if (a && b && typeof a === 'object' && typeof b === 'object') { if (a.to_records) a = a.to_records(); if (b.to_records) b = b.to_records(); const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => deq(a[k], b[k])); } return Number.isNaN(a) && Number.isNaN(b); };
    const make = (neg) => {
      const chk = (ok, msg) => { if (ok === neg) throw new Error((neg ? 'Diharapkan TIDAK: ' : 'Diharapkan: ') + msg + ' — nilai sebenarnya: ' + show(actual)); return true; };
      return {
        toBe: v => chk(Object.is(actual, v), 'sama persis dengan ' + show(v)),
        toEqual: v => chk(deq(actual, v), 'setara dengan ' + show(v)),
        toContain: v => chk(actual != null && (typeof actual === 'string' ? actual.includes(v) : Array.from(actual).some(x => deq(x, v))), 'memuat ' + show(v)),
        toMatch: re => chk(re instanceof RegExp ? re.test(String(actual)) : String(actual).includes(re), 'cocok dengan ' + String(re)),
        toBeGreaterThan: v => chk(actual > v, 'lebih besar dari ' + show(v)),
        toBeGreaterThanOrEqual: v => chk(actual >= v, 'lebih besar atau sama dengan ' + show(v)),
        toBeLessThan: v => chk(actual < v, 'lebih kecil dari ' + show(v)),
        toBeLessThanOrEqual: v => chk(actual <= v, 'lebih kecil atau sama dengan ' + show(v)),
        toBeCloseTo: (v, d = 2) => chk(Math.abs(actual - v) < Math.pow(10, -d) / 2, `mendekati ${show(v)} (${d} desimal)`),
        toHaveLength: n => chk(actual != null && actual.length === n, 'panjangnya ' + n),
        toBeTruthy: () => chk(!!actual, 'bernilai benar'),
        toBeFalsy: () => chk(!actual, 'bernilai salah'),
        toBeNull: () => chk(actual == null, 'kosong (null)'),
        toThrow: m => { let err = null; try { actual(); } catch (e) { err = e; } return chk(!!err && (!m || String(err.message).includes(m)), 'melempar galat' + (m ? ' berisi ' + show(m) : '')); }
      };
    };
    const r = make(false); r.not = make(true); return r;
  }
  async function testingRun(src, o) {
    let fn = src;
    if (typeof src === 'string' && /\.(slak|js)$/i.test(src.trim()) && !/[\n;(]/.test(src)) {
      const b = await loadFile(src.trim()); src = new TextDecoder().decode(b);
    }
    if (typeof src === 'string') fn = compile(src);
    if (typeof fn !== 'function') throw new Error('sl.testing.run butuh kode (teks), nama berkas .slak, atau fungsi (sl) => { ... }.');
    const at = new AppTest(fn, o);
    await at.run(o);
    return at;
  }
  /** Uji bernama yang hasilnya tampil di aplikasi: await sl.testing.test("judul", async () => { ... }). */
  /* Gaya AppTest Streamlit: AppTest.from_string(kode), from_function(fn), from_file("app.slak"); lalu await at.run(). */
  const fromString = (src, o) => { if (typeof src !== 'string') throw new Error('sl.testing.from_string butuh kode berupa teks.'); return new AppTest(compile(src), o); };
  const fromFunction = (fn, o) => { if (typeof fn !== 'function') throw new Error('sl.testing.from_function butuh fungsi (sl) => { ... }.'); return new AppTest(fn, o); };
  const fromFile = (name, o) => {
    // seperti AppTest.from_file: langsung mengembalikan objek uji; berkasnya dibaca saat at.run() pertama
    let fnP = null;
    const load = () => fnP || (fnP = loadFile(String(name)).then(b => compile(new TextDecoder().decode(b))));
    return new AppTest(async (sl) => (await load())(sl), o);
  };
  function testingAPI(ctx) {
    const res = [];
    return {
      run: testingRun, expect, AppTest, from_string: fromString, from_function: fromFunction, from_file: fromFile,
      async test(name, fn) {
        const t0 = performance.now();
        let err = null;
        try { await fn(); } catch (e) { err = e; }
        const ms = Math.round(performance.now() - t0);
        const row = { name, ok: !err, ms, error: err && err.message };
        res.push(row);
        if (global.Slak) (global.Slak._testLog = global.Slak._testLog || []).push(row);   // dibaca panel Uji di Slak Studio dan slak-test.html
        if (ctx) { if (err) EL.error(ctx, `**${name}** — ${err.message}`); else EL.success(ctx, `${name} (${ms} md)`); }
        return !err;
      },
      summary() {
        const ok = res.filter(r => r.ok).length;
        if (ctx) (ok === res.length ? EL.success : EL.error)(ctx, `**${ok} dari ${res.length} uji lulus.**`);
        return { lulus: ok, gagal: res.length - ok, total: res.length, hasil: res.slice() };
      },
      get results() { return res.slice(); }
    };
  }


  /* ======================================================================
   * Mode sel (Slak 1.7, dipakai Slak Studio)
   * Baris "// %%" membagi kode menjadi sel. Sel yang tidak berubah (dan semua sel
   * di atasnya juga tidak berubah) tidak dijalankan lagi: variabelnya dipulihkan dan
   * elemennya digambar ulang dari catatan. Sel yang diubah, dan semua sel di bawahnya,
   * dijalankan ulang. Sel berisi widget, session_state, atau hal acak selalu dijalankan.
   * Aplikasi yang diekspor tidak memakai mode ini.
   * ==================================================================== */
  const CELL_CACHE = new Map();
  const CELL_MARK = /^\s*\/\/\s*%%/;
  const CELL_NOCACHE_CALL = new RegExp('\\.(' + [...T_INPUT, ...T_BUTTON, 'form', 'fragment', 'dialog', 'login', 'logout', 'navigation', 'switch_page', 'ml_demo', 'report', 'pyplot', 'python', 'status', 'spinner', 'write_stream', 'sleep', 'toast', 'balloons', 'snow', 'db', 'sqlite', 'connection', 'rerun', 'stop', 'empty', 'popover', 'set_page_config', 'cache_data', 'cache_resource'].join('|') + ')\\s*\\(');
  const CELL_NOCACHE_WORD = /\b(session_state|local_state|query_params|Math\.random|Date\.now|new\s+Date\s*\(\s*\)|sl\.testing|sl\.user|setTimeout|setInterval)\b/;
  function cellIds(text) {
    // identifier di dalam pola destrukturisasi [a, b] / { a, b: c, ...d }
    const out = [];
    const parts = []; let depth = 0, cur = '';
    for (const ch of text) {
      if ('[{('.includes(ch)) depth++;
      if (')}]'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    for (let p of parts) {
      p = p.trim().replace(/^\.\.\./, '');
      if (!p) continue;
      const eq = (() => { let d = 0; for (let i = 0; i < p.length; i++) { const c = p[i]; if ('[{('.includes(c)) d++; else if (')}]'.includes(c)) d--; else if (c === '=' && d === 0 && p[i + 1] !== '>') return i; } return -1; })();
      if (eq >= 0) p = p.slice(0, eq).trim();
      const colon = (() => { let d = 0; for (let i = 0; i < p.length; i++) { const c = p[i]; if ('[{('.includes(c)) d++; else if (')}]'.includes(c)) d--; else if (c === ':' && d === 0) return i; } return -1; })();
      if (colon >= 0) p = p.slice(colon + 1).trim();
      if (/^[\[{]/.test(p)) out.push(...cellIds(p.slice(1, -1)));
      else if (/^[A-Za-z_$][\w$]*$/.test(p)) out.push(p);
    }
    return out;
  }
  /** Nama yang dideklarasikan di tingkat atas sebuah sel (const/let/var/function/class). */
  function cellNames(src) {
    const names = new Set();
    let i = 0, depth = 0;
    const n = src.length, tpl = [];
    const isId = c => /[\w$]/.test(c || '');
    while (i < n) {
      const c = src[i], d2 = src.slice(i, i + 2);
      if (d2 === '//') { const j = src.indexOf('\n', i); i = j < 0 ? n : j; continue; }
      if (d2 === '/*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
      if (c === '"' || c === "'") { i++; while (i < n && src[i] !== c) { if (src[i] === '\\') i++; i++; } i++; continue; }
      if (c === '`') {
        i++;
        while (i < n && src[i] !== '`') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '$' && src[i + 1] === '{') { let d = 1; i += 2; while (i < n && d) { if (src[i] === '{') d++; else if (src[i] === '}') d--; i++; } continue; }
          i++;
        }
        i++; continue;
      }
      if ('{[('.includes(c)) { depth++; i++; continue; }
      if ('}])'.includes(c)) { depth--; i++; continue; }
      if (depth === 0 && !isId(src[i - 1]) && /[a-z]/.test(c)) {
        const rest = src.slice(i, i + 200);
        let m;
        if ((m = /^(?:const|let|var)\s+/.exec(rest))) {
          let j = i + m[0].length;
          const open = src[j];
          if (open === '[' || open === '{') {
            const close = open === '[' ? ']' : '}';
            let d = 0, k = j;
            for (; k < n; k++) { if (src[k] === open) d++; else if (src[k] === close) { d--; if (!d) break; } }
            cellIds(src.slice(j + 1, k)).forEach(x => names.add(x));
            i = k + 1; continue;
          }
          const id = /^[A-Za-z_$][\w$]*/.exec(src.slice(j));
          if (id) names.add(id[0]);
          i = j + (id ? id[0].length : 0); continue;
        }
        if ((m = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(rest)) || (m = /^class\s+([A-Za-z_$][\w$]*)/.exec(rest))) { names.add(m[1]); i += m[0].length; continue; }
      }
      i++;
    }
    return [...names];
  }
  const cellHash = t => CRYPTO.md5(t);
  function cellsTransform(code, key) {
    const lines = String(code).split('\n');
    const starts = [0];
    lines.forEach((l, i) => { if (i > 0 && CELL_MARK.test(l)) starts.push(i); });
    if (starts.length < 2 && !CELL_MARK.test(lines[0] || '')) return null;
    const cells = starts.map((s, k) => {
      const src = lines.slice(s, k + 1 < starts.length ? starts[k + 1] : lines.length).join('\n');
      return { s, src, names: cellNames(src), cache: !CELL_NOCACHE_CALL.test(src) && !CELL_NOCACHE_WORD.test(src) };
    });
    const meta = cells.map(c => ({ h: cellHash(c.src), c: c.cache }));
    const out = lines.slice();
    const seen = [];
    cells.forEach((c, k) => {
      const prev = [...new Set(seen)];
      const all = [...new Set(seen.concat(c.names))];
      const head = (k === 0 ? `const __C = Slak.cells.begin(sl, ${JSON.stringify(String(key || 'slak'))}, ${JSON.stringify(meta)}); ` : '')
        + `if (await __C.enter(${k})) { ${prev.length ? `let { ${prev.join(', ')} } = __C.S; ` : ''}{ `;
      const tail = `;__C.keep(${k}, { ${all.join(', ')} }) } } `;
      c.head = head; c.tail = tail;
      seen.push(...c.names);
    });
    cells.forEach((c, k) => { out[c.s] = (k ? cells[k - 1].tail : '') + c.head + lines[c.s]; });
    out.push(cells[cells.length - 1].tail);
    return out.join('\n');
  }
  function cellRemap(app, v) {
    const one = x => x && typeof x === 'object' && x.__slakPath != null && app._ctxPath && app._ctxPath.get(x.__slakPath) ? makeAPI(app._ctxPath.get(x.__slakPath)) : x;
    if (Array.isArray(v) && v.some(x => x && x.__slakPath != null)) return v.map(one);
    return one(v);
  }
  function cellsBegin(sl, key, meta) {
    const app = CUR_APP;
    let store = CELL_CACHE.get(key);
    if (!store) CELL_CACHE.set(key, store = []);
    store.length = Math.min(store.length, meta.length);
    let fresh = false;
    const S = {};
    app._cellRec = null; app._cellDepth = 0;
    app._cellStats = { replayed: 0, ran: 0, total: meta.length };
    return {
      S,
      async enter(i) {
        const m = meta[i], old = store[i];
        if (!fresh && m.c && old && old.h === m.h) {
          try {
            for (const e of old.calls) {
              const ctx = app._ctxPath && app._ctxPath.get(e.path);
              if (!ctx) throw new Error('wadah ' + e.path + ' belum ada');
              const r = makeAPI(ctx)[e.type](...e.args);
              if (r instanceof Promise) await r;
            }
            for (const k in old.snap) S[k] = cellRemap(app, old.snap[k]);
            app._cellStats.replayed++;
            return false;
          } catch (e) { if (e === RERUN || e === STOP) throw e; /* catatan tidak cocok: jalankan sel ini */ }
        }
        fresh = true;
        store[i] = null;
        app._cellRec = [];
        app._cellDepth = 0;
        app._cellStats.ran++;
        return true;
      },
      keep(i, vars) {
        Object.assign(S, vars);
        store[i] = { h: meta[i].h, snap: Object.assign({}, vars), calls: app._cellRec || [] };
        app._cellRec = null;
      }
    };
  }
  Slak.connection = connection;
  Slak.registerComponent = registerComponent;
  Slak.worker = slWorker;
  Slak.old_names = Object.fromEntries(Object.entries(OLD_NAMES).map(([k, v]) => [k, v[0]]));
  Slak._runWorker = runWorker;
  Slak._csvRowsSrc = csvRows.toString();
  Slak.components = { list: () => Object.keys(COMP_REG).map(k => ({ name: k, desc: COMP_REG[k].desc || '', args: COMP_REG[k].args || '', example: COMP_REG[k].example || '' })), get: n => COMP_REG[n] || null, gallery: GALLERY.slice() };
  Slak.cells = { transform: cellsTransform, begin: cellsBegin, names: cellNames, clear: (key) => key == null ? CELL_CACHE.clear() : CELL_CACHE.delete(key) };
  /* Tautan berbagi (Slak 1.7): kode dimampatkan ke bagian # alamat, jadi tidak pernah dikirim ke server.
   *   const link = await Slak.share.link(kode, "https://situsmu.com/playground/")   // ...#kode=...
   *   const kode = await Slak.share.read(location.hash)                                  // null bila tidak ada */
  const b64u = {
    enc: (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec: (t) => { t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const s = atob(t), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  };
  async function streamBytes(bytes, T) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(T)).arrayBuffer()); }
  Slak.share = {
    /** Alamat playground resmi (Slak 1.9.1). Salinan resmi dengan format tautan yang sama: https://slakstudio.github.io/playground/ */
    official: 'https://slak.studio/playground/',
    /** Teks kode -> potongan alamat "kode=..." (dimampatkan bila browser mendukung). */
    async encode(code) {
      const raw = new TextEncoder().encode(String(code));
      if (typeof CompressionStream === 'function') {
        try { return 'kode=' + b64u.enc(await streamBytes(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* jatuh ke teks biasa */ }
      }
      return 'teks=' + b64u.enc(raw);
    },
    /** Potongan alamat (#kode=... / #teks=... / alamat lengkap) -> teks kode, atau null. */
    async read(hash) {
      const m = /[#&?](kode|teks)=([A-Za-z0-9_-]+)/.exec('#' + String(hash || '').replace(/^[^#]*#/, ''));
      if (!m) return null;
      const bytes = b64u.dec(m[2]);
      if (m[1] === 'teks') return new TextDecoder().decode(bytes);
      if (typeof DecompressionStream !== 'function') throw new Error('Browser ini terlalu lama untuk membuka tautan berbagi Slak. Perbarui Chrome, Edge, Firefox, atau Safari.');
      return new TextDecoder().decode(await streamBytes(bytes, new DecompressionStream('deflate-raw')));
    },
    /** Tautan lengkap ke playground. base: alamat playground. Bawaan: halaman ini bila dibuka lewat http(s)
     *  (sehingga salinan mana pun membuat tautan ke dirinya sendiri), selain itu playground resmi. */
    async link(code, base) {
      const here = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? location.href : '';
      base = String(base || here || Slak.share.official || (typeof location !== 'undefined' ? location.href : '')).split('#')[0];
      return base + '#' + await Slak.share.encode(code);
    }
  };
  Slak.testing = Object.assign(testingAPI(null), { run: testingRun, expect, AppTest, from_string: fromString, from_function: fromFunction, from_file: fromFile });
  /** Peringatan ringan dari lapisan data (misalnya data terlalu besar): tampil sekali per aplikasi sebagai toast + konsol. */
  Slak._dataWarn = (msg, key) => {
    try { console.warn('[Slak] ' + msg); } catch (e) { /* abaikan */ }
    const a = Slak._activeApp;
    if (!a || a.destroyed || typeof a.toast !== 'function') return;
    a._warned = a._warned || new Set();
    if (a._warned.has(key || msg)) return;
    a._warned.add(key || msg);
    a.toast(msg, { icon: '⚠️', duration: 12000 });
  };

  global.Slak = Slak;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoRun);
    else queueMicrotask(autoRun);
  }
})(typeof window !== 'undefined' ? window : globalThis);
