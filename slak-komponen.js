/*! slak-komponen.js 1.9.1 - galeri 10 komponen siap pakai untuk Slak. Lisensi MIT. Sumber per komponen: folder komponen/. */
(function (Slak) {
if (!Slak || !Slak.registerComponent) { console.error('slak-komponen.js harus dimuat sesudah slak.js versi 1.7 atau lebih baru.'); return; }
/* Galeri komponen Slak 1.7 (lisensi MIT, sama dengan Slak).
 * Berkas ini memuat gaya dasar bersama. Setiap komponen di folder ini mendaftarkan diri dengan
 * Slak.registerComponent(nama, { html, default, desc, example }) dan dipakai dengan
 * sl.component("nama", { ...args, key }). Semua berkas digabung menjadi slak-komponen.js. */
(function (S) {
  if (!S || !S.registerComponent) { console.error('slak-komponen.js harus dimuat sesudah slak.js'); return; }
  S._kompCss = '<style>' +
    ':root{--fg:var(--slak-fg,#1c1e21);--ac:var(--slak-accent,#0f766e);--pn:var(--slak-panel,#f5f5f4);--bg:var(--slak-bg,#ffffff);--ln:color-mix(in srgb,var(--fg) 18%,transparent);--mu:color-mix(in srgb,var(--fg) 60%,transparent)}' +
    '*{box-sizing:border-box}body{font:14px/1.45 var(--slak-font,system-ui,sans-serif);padding:2px 1px 4px;margin:0}' +
    '.lbl{font-size:14px;margin:0 0 6px}.mu{color:var(--mu);font-size:12.5px}' +
    'button{font:inherit;color:inherit;background:var(--pn);border:1px solid var(--ln);border-radius:8px;padding:5px 12px;cursor:pointer}' +
    'button:hover{border-color:var(--ac)}button.pri{background:var(--ac);border-color:var(--ac);color:#fff}button:disabled{opacity:.5;cursor:default}' +
    'input,select,textarea{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--ln);border-radius:8px;padding:5px 8px}' +
    '.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
    '</style>';
})(window.Slak);

/* Komponen rating bintang (Slak 1.7, MIT). Nilai: angka 0..max. */
Slak.registerComponent('rating', {
  desc: 'Rating bintang. Klik bintang untuk memberi nilai; klik bintang yang sama lagi untuk menghapus.',
  args: 'label, max=5, value, icon="★", size=28',
  example: 'const nilai = sl.component("rating", { label: "Nilai pelayanan", max: 5, key: "nilai" })',
  default: a => a.value != null ? a.value : 0,
  height: 64,
  html: Slak._kompCss + `<style>
.st{display:inline-flex;gap:2px;user-select:none}.st span{cursor:pointer;line-height:1;color:var(--ln);transition:transform .1s}
.st span.on{color:#f5a524}.st span:hover{transform:scale(1.15)}.st.dis span{cursor:default;transform:none}
.v{margin-left:8px;color:var(--mu)}
</style><div class="lbl" id="l" hidden></div><div class="row"><div class="st" id="s" role="slider" tabindex="0"></div><span class="v" id="v"></span></div>
<script>
var C = Slak.component, val = null, hov = 0, A = {}, init = false;
function draw() {
  var s = document.getElementById('s'), n = A.max || 5, show = hov || val || 0;
  if (s.children.length !== n) { s.innerHTML = ''; for (var i = 1; i <= n; i++) { var e = document.createElement('span'); e.textContent = A.icon || '★'; e.dataset.i = i; s.appendChild(e); } }
  for (var j = 0; j < n; j++) { s.children[j].className = j < show ? 'on' : ''; s.children[j].style.fontSize = (A.size || 28) + 'px'; }
  s.className = 'st' + (C.disabled ? ' dis' : '');
  s.setAttribute('aria-valuenow', val || 0);
  document.getElementById('v').textContent = (val || 0) + ' / ' + n;
}
C.onRender(function (a) {
  A = a; var l = document.getElementById('l'); l.hidden = !a.label; l.textContent = a.label || '';
  if (!init) { val = a.value != null ? a.value : 0; init = true; }
  draw();
});
var s = document.getElementById('s');
s.addEventListener('mousemove', function (e) { if (!C.disabled && e.target.dataset.i) { hov = +e.target.dataset.i; draw(); } });
s.addEventListener('mouseleave', function () { hov = 0; draw(); });
s.addEventListener('click', function (e) { if (C.disabled || !e.target.dataset.i) return; var i = +e.target.dataset.i; val = val === i ? 0 : i; hov = 0; draw(); C.setValue(val); });
s.addEventListener('keydown', function (e) { if (C.disabled) return; var n = A.max || 5; if (e.key === 'ArrowRight' || e.key === 'ArrowUp') val = Math.min(n, (val || 0) + 1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') val = Math.max(0, (val || 0) - 1); else return; e.preventDefault(); draw(); C.setValue(val); });
<\/script>`
});

/* Komponen sketsa dan tanda tangan (Slak 1.7, MIT). Nilai: gambar PNG sebagai data URL, atau null bila kosong. */
Slak.registerComponent('sketsa', {
  desc: 'Kanvas untuk tanda tangan atau sketsa dengan mouse, pena, atau jari. Nilainya gambar PNG (data URL) yang bisa ditampilkan dengan sl.image atau diunduh.',
  args: 'label, canvas_height=200, stroke_width=3, color, background="#ffffff" | "transparent"',
  example: 'const ttd = sl.component("sketsa", { label: "Tanda tangan", canvas_height: 160, key: "ttd" })\nif (ttd) sl.image(ttd, { caption: "Hasil tanda tangan", width: 240 })',
  default: null,
  height: 250,
  html: Slak._kompCss + `<style>
.wrap{position:relative;border:1px dashed var(--ln);border-radius:10px;overflow:hidden;touch-action:none}
canvas{display:block;width:100%;cursor:crosshair}.hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9aa0a8;pointer-events:none;font-size:13px}
.bar{margin-top:6px}
</style><div class="lbl" id="l" hidden></div><div class="wrap" id="w"><canvas id="c"></canvas><div class="hint" id="h">Gambar di sini</div></div>
<div class="row bar"><button id="undo">↶ Urungkan</button><button id="clr">Hapus</button><span class="mu" id="info"></span></div>
<script>
var C = Slak.component, A = {}, strokes = [], cur = null, cv = document.getElementById('c'), g = cv.getContext('2d'), H = 200, sendT = 0;
function bg() { return A.background === 'transparent' ? null : (A.background || '#ffffff'); }
function ink() { return A.color || (bg() ? '#1c1e21' : getComputedStyle(document.body).color); }
function size() {
  var w = document.getElementById('w').clientWidth || 300, d = window.devicePixelRatio || 1;
  cv.width = Math.round(w * d); cv.height = Math.round(H * d); cv.style.height = H + 'px';
  g.setTransform(d, 0, 0, d, 0, 0); redraw();
}
function redraw() {
  g.clearRect(0, 0, cv.width, cv.height);
  if (bg()) { g.fillStyle = bg(); g.fillRect(0, 0, cv.width, cv.height); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  strokes.forEach(function (s) { g.strokeStyle = s.c; g.lineWidth = s.w; g.beginPath(); s.p.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); if (s.p.length === 1) g.lineTo(s.p[0][0] + 0.1, s.p[0][1]); g.stroke(); });
  document.getElementById('h').style.display = strokes.length ? 'none' : 'flex';
  document.getElementById('info').textContent = strokes.length ? strokes.length + ' goresan' : '';
}
function send() { clearTimeout(sendT); sendT = setTimeout(function () { C.setValue(strokes.length ? cv.toDataURL('image/png') : null); }, 150); }
function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('pointerdown', function (e) { if (C.disabled) return; cv.setPointerCapture(e.pointerId); cur = { c: ink(), w: A.stroke_width || 3, p: [pos(e)] }; strokes.push(cur); redraw(); });
cv.addEventListener('pointermove', function (e) { if (!cur) return; cur.p.push(pos(e)); redraw(); });
function up() { if (cur) { cur = null; send(); } }
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
document.getElementById('undo').onclick = function () { strokes.pop(); redraw(); send(); };
document.getElementById('clr').onclick = function () { strokes = []; redraw(); send(); };
C.onRender(function (a) {
  var first = A.canvas_height === undefined && !A._r; A = a; A._r = 1;
  var l = document.getElementById('l'); l.hidden = !a.label; l.textContent = a.label || '';
  if (first || (a.canvas_height || 200) !== H) { H = a.canvas_height || 200; size(); } else redraw();
  document.getElementById('undo').disabled = document.getElementById('clr').disabled = C.disabled;
});
new ResizeObserver(function () { size(); }).observe(document.getElementById('w'));
<\/script>`
});

/* Komponen rentang tanggal dengan pilihan cepat (Slak 1.7, MIT). Nilai: ["YYYY-MM-DD", "YYYY-MM-DD"]. */
Slak.registerComponent('rentang_tanggal', {
  desc: 'Memilih tanggal awal dan akhir, dengan tombol cepat 7 hari, 30 hari, bulan ini, tahun ini, dan semua. Nilainya [awal, akhir] sebagai teks "YYYY-MM-DD".',
  args: 'label, start, end, min, max, today, presets=true',
  example: 'const [awal, akhir] = sl.component("rentang_tanggal", { label: "Periode", min: "2023-01-01", max: "2024-12-31", start: "2024-12-01", end: "2024-12-31", key: "periode" })\nsl.write(`Dari ${awal} sampai ${akhir}`)',
  default: a => [a.start || a.min || null, a.end || a.max || null],
  height: 110,
  html: Slak._kompCss + `<style>.ps button{padding:3px 10px;font-size:13px;border-radius:99px}.ps button.on{background:var(--ac);border-color:var(--ac);color:#fff}.dt{margin-bottom:8px}</style>
<div class="lbl" id="l" hidden></div>
<div class="row dt"><input type="date" id="a"><span class="mu">sampai</span><input type="date" id="b"><span class="mu" id="n"></span></div>
<div class="row ps" id="ps"></div>
<script>
var C = Slak.component, A = {}, init = false, a = document.getElementById('a'), b = document.getElementById('b');
function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function ref() { var t = A.today || A.max; return t ? new Date(t + 'T00:00:00') : new Date(); }
function add(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function clamp(s) { if (A.min && s < A.min) return A.min; if (A.max && s > A.max) return A.max; return s; }
var P = [
  ['7 hari terakhir', function () { var t = ref(); return [iso(add(t, -6)), iso(t)]; }],
  ['30 hari terakhir', function () { var t = ref(); return [iso(add(t, -29)), iso(t)]; }],
  ['Bulan ini', function () { var t = ref(); return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(new Date(t.getFullYear(), t.getMonth() + 1, 0))]; }],
  ['Tahun ini', function () { var t = ref(); return [t.getFullYear() + '-01-01', t.getFullYear() + '-12-31']; }],
  ['Semua', function () { return [A.min, A.max]; }]
];
function info() {
  var n = document.getElementById('n');
  if (a.value && b.value) { var d = Math.round((new Date(b.value) - new Date(a.value)) / 864e5) + 1; n.textContent = d > 0 ? d + ' hari' : 'awal sesudah akhir'; } else n.textContent = '';
  [].forEach.call(document.querySelectorAll('#ps button'), function (x, i) { var r = P[i][1](); x.className = r[0] && clamp(r[0]) === a.value && clamp(r[1]) === b.value ? 'on' : ''; });
}
function set(r, send) { a.value = r[0] ? clamp(r[0]) : ''; b.value = r[1] ? clamp(r[1]) : ''; info(); if (send) C.setValue([a.value || null, b.value || null]); }
a.onchange = b.onchange = function () { if (a.value && b.value && a.value > b.value) { var t = a.value; a.value = b.value; b.value = t; } set([a.value, b.value], true); };
C.onRender(function (x) {
  A = x; var l = document.getElementById('l'); l.hidden = !x.label; l.textContent = x.label || '';
  a.min = b.min = x.min || ''; a.max = b.max = x.max || ''; a.disabled = b.disabled = C.disabled;
  var ps = document.getElementById('ps');
  if (!ps.children.length && x.presets !== false) P.forEach(function (p) { if (p[0] === 'Semua' && !(x.min && x.max)) return; var e = document.createElement('button'); e.textContent = p[0]; e.onclick = function () { set(p[1](), true); }; ps.appendChild(e); });
  if (x.presets === false) P = P.slice(0, 0);
  if (!init) { init = true; set([x.start || x.min || '', x.end || x.max || ''], false); } else info();
});
<\/script>`
});

/* Komponen kalender heatmap ala GitHub (Slak 1.7, MIT). Nilai: { tanggal, nilai } hari yang diklik, atau null. */
Slak.registerComponent('kalender_heatmap', {
  desc: 'Kalender setahun berisi kotak harian yang warnanya mengikuti besar nilai, seperti grafik kontribusi GitHub. Data berupa DataFrame atau daftar objek; nilai pada tanggal yang sama dijumlahkan. Klik sebuah hari untuk memilihnya.',
  args: 'data, date="tanggal", value="nilai", year, label, color',
  example: 'const df = sl.dataset("penjualan")\nconst hari = sl.component("kalender_heatmap", { data: df, date: "tanggal", value: "total", year: 2024, label: "Omzet harian 2024", key: "kal" })\nif (hari) sl.write(`${hari.tanggal}: Rp${hari.nilai.toLocaleString("id-ID")}`)',
  default: null,
  height: 190,
  html: Slak._kompCss + `<style>
.sc{overflow-x:auto;padding-bottom:4px}svg{display:block}rect.d{cursor:pointer;rx:2px}rect.d:hover{stroke:var(--fg);stroke-width:1}rect.sel{stroke:var(--fg);stroke-width:2}
text{fill:var(--mu);font-size:10px}.lg{display:flex;align-items:center;gap:3px;justify-content:flex-end;margin-top:4px}.lg i{width:11px;height:11px;border-radius:2px;display:inline-block}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
</style><div class="top"><div class="lbl" id="l"></div><span class="mu" id="sum"></span></div><div class="sc"><svg id="g"></svg></div>
<div class="lg mu"><span id="pick" style="margin-right:auto"></span>Sedikit<span id="lg"></span>Banyak</div>
<script>
var C = Slak.component, A = {}, sel = null, NS = 'http://www.w3.org/2000/svg';
var BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function key(v) { if (v == null) return null; if (v instanceof Date) return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2); var s = String(v); return /^\\d{4}-\\d{2}-\\d{2}/.test(s) ? s.slice(0, 10) : null; }
function el(n, at, txt) { var e = document.createElementNS(NS, n); for (var k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; return e; }
function fmt(x) { return (Math.round(x * 100) / 100).toLocaleString('id-ID'); }
function draw() {
  var dk = A.date || 'tanggal', vk = A.value || 'nilai', rows = Array.isArray(A.data) ? A.data : [], M = {}, yrs = {};
  rows.forEach(function (r) { var k = key(r[dk]); if (!k) return; var v = vk in r ? +r[vk] : 1; if (isNaN(v)) return; M[k] = (M[k] || 0) + v; yrs[k.slice(0, 4)] = 1; });
  var Y = A.year || Object.keys(yrs).sort().pop() || new Date().getFullYear(), max = 0, tot = 0, cnt = 0;
  for (var k in M) if (k.slice(0, 4) == Y) { max = Math.max(max, M[k]); tot += M[k]; cnt++; }
  var l = document.getElementById('l'); l.textContent = A.label || ('Tahun ' + Y);
  document.getElementById('sum').textContent = cnt + ' hari berisi data · total ' + fmt(tot);
  var ac = getComputedStyle(document.documentElement).getPropertyValue('--slak-accent').trim() || '#0f766e', base = A.color || ac;
  function col(v) { if (!v) return 'color-mix(in srgb, var(--fg) 8%, transparent)'; var t = max ? v / max : 0, p = t > .75 ? 100 : t > .5 ? 78 : t > .25 ? 55 : 32; return 'color-mix(in srgb, ' + base + ' ' + p + '%, transparent)'; }
  var g = document.getElementById('g'), S = 12, G = 2, L = 26, T = 16;
  g.innerHTML = '';
  var d0 = new Date(Y, 0, 1), off = (d0.getDay() + 6) % 7, days = (new Date(Y, 11, 31) - d0) / 864e5 + 1, weeks = Math.ceil((days + off) / 7);
  var VW = L + weeks * (S + G), VH = T + 7 * (S + G); g.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH); g.setAttribute('width', '100%'); g.style.minWidth = Math.round(VW * 0.75) + 'px'; g.style.maxWidth = Math.round(VW * 1.6) + 'px';
  ['Sen', '', 'Rab', '', 'Jum', '', ''].forEach(function (t, i) { if (t) g.appendChild(el('text', { x: 0, y: T + i * (S + G) + 9 }, t)); });
  for (var i = 0; i < days; i++) {
    var d = new Date(Y, 0, 1 + i), w = Math.floor((i + off) / 7), wd = (d.getDay() + 6) % 7, k = key(d), v = M[k] || 0;
    if (d.getDate() === 1) g.appendChild(el('text', { x: L + (wd > 3 ? w + 1 : w) * (S + G), y: 10 }, BULAN[d.getMonth()]));
    var r = el('rect', { class: 'd' + (sel === k ? ' sel' : ''), x: L + w * (S + G), y: T + wd * (S + G), width: S, height: S, rx: 2, fill: col(v), 'data-k': k, 'data-v': v });
    r.appendChild(el('title', {}, d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + Y + ': ' + fmt(v)));
    g.appendChild(r);
  }
  var lg = document.getElementById('lg'); lg.innerHTML = '';
  [0, .2, .4, .6, .9].forEach(function (t) { var i2 = document.createElement('i'); i2.style.background = col(t * max); lg.appendChild(i2); });
  document.getElementById('pick').textContent = sel ? 'Dipilih: ' + sel + ' (' + fmt(M[sel] || 0) + ')' : '';
}
document.getElementById('g').addEventListener('click', function (e) {
  var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (!k || C.disabled) return;
  if (sel === k) { sel = null; C.setValue(null); } else { sel = k; C.setValue({ tanggal: k, nilai: +e.target.getAttribute('data-v') }); }
  draw();
});
C.onRender(function (a) { A = a; draw(); });
<\/script>`
});

/* Komponen papan kanban (Slak 1.7, MIT). Nilai: daftar kartu { id, judul, kolom } sesudah dipindah. */
Slak.registerComponent('kanban', {
  desc: 'Papan kanban: seret kartu antarkolom (atau pakai tombol panah di kartu). Nilainya daftar kartu terbaru, jadi bisa disimpan ke session_state atau database.',
  args: 'columns, items: [{id, judul, kolom, catatan}], allow_add, label',
  example: 'const tugas = sl.component("kanban", {\n  columns: ["Rencana", "Dikerjakan", "Selesai"],\n  items: [\n    { id: 1, judul: "Bersihkan data", kolom: "Selesai" },\n    { id: 2, judul: "Buat grafik", kolom: "Dikerjakan" },\n    { id: 3, judul: "Tulis laporan", kolom: "Rencana" }\n  ],\n  key: "papan"\n})\nsl.write(`Selesai: ${tugas.filter(t => t.kolom === "Selesai").length} dari ${tugas.length}`)',
  default: a => (a.items || []).map(x => Object.assign({}, x, { kolom: x.kolom || (a.columns || ['Rencana'])[0] })),
  height: 260,
  html: Slak._kompCss + `<style>
.bd{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(150px,1fr);gap:10px;overflow-x:auto}
.col{background:var(--pn);border:1px solid var(--ln);border-radius:10px;padding:8px;min-height:120px;display:flex;flex-direction:column;gap:6px}
.col.over{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 10%,var(--pn))}
.hd{font-weight:600;font-size:13px;display:flex;justify-content:space-between}.hd span{color:var(--mu);font-weight:400}
.cd{background:var(--bg);border:1px solid var(--ln);border-radius:8px;padding:7px 8px;cursor:grab;display:flex;gap:4px;align-items:flex-start}
.cd.drag{opacity:.4}.cd .t{flex:1;word-break:break-word}.cd .t small{display:block;color:var(--mu)}.cd button{padding:0 5px;font-size:12px;border-radius:5px;line-height:18px}
.add{display:flex;gap:4px}.add input{flex:1;min-width:0;padding:3px 6px;font-size:13px}.add button{padding:2px 8px}
</style><div class="lbl" id="l" hidden></div><div class="bd" id="bd"></div>
<script>
var C = Slak.component, A = {}, items = null, drag = null, nextId = 1;
function cols() { return A.columns && A.columns.length ? A.columns : ['Rencana', 'Dikerjakan', 'Selesai']; }
function send() { C.setValue(items.map(function (x) { return Object.assign({}, x); })); }
function move(id, col, before) {
  var i = items.findIndex(function (x) { return String(x.id) === String(id); }); if (i < 0) return;
  var it = items.splice(i, 1)[0]; it.kolom = col;
  var j = before != null ? items.findIndex(function (x) { return String(x.id) === String(before); }) : -1;
  if (j < 0) items.push(it); else items.splice(j, 0, it);
  draw(); send();
}
function draw() {
  var bd = document.getElementById('bd'), cs = cols(); bd.innerHTML = '';
  cs.forEach(function (c, ci) {
    var col = document.createElement('div'); col.className = 'col'; col.dataset.c = c;
    var mine = items.filter(function (x) { return x.kolom === c; });
    var hd = document.createElement('div'); hd.className = 'hd'; hd.textContent = c; var n = document.createElement('span'); n.textContent = mine.length; hd.appendChild(n); col.appendChild(hd);
    mine.forEach(function (x) {
      var cd = document.createElement('div'); cd.className = 'cd'; cd.draggable = !C.disabled; cd.dataset.id = x.id;
      var t = document.createElement('div'); t.className = 't'; t.textContent = x.judul != null ? x.judul : (x.title != null ? x.title : x.id);
      if (x.catatan) { var sm = document.createElement('small'); sm.textContent = x.catatan; t.appendChild(sm); }
      cd.appendChild(t);
      if (!C.disabled) {
        if (ci > 0) { var bl = document.createElement('button'); bl.textContent = '‹'; bl.title = 'Pindah ke ' + cs[ci - 1]; bl.onclick = function () { move(x.id, cs[ci - 1]); }; cd.insertBefore(bl, t); }
        if (ci < cs.length - 1) { var br = document.createElement('button'); br.textContent = '›'; br.title = 'Pindah ke ' + cs[ci + 1]; br.onclick = function () { move(x.id, cs[ci + 1]); }; cd.appendChild(br); }
      }
      cd.addEventListener('dragstart', function (e) { drag = x.id; cd.classList.add('drag'); e.dataTransfer.setData('text/plain', String(x.id)); });
      cd.addEventListener('dragend', function () { cd.classList.remove('drag'); });
      col.appendChild(cd);
    });
    if (A.allow_add && !C.disabled) {
      var ad = document.createElement('div'); ad.className = 'add'; var inp = document.createElement('input'); inp.placeholder = 'Kartu baru'; var b = document.createElement('button'); b.textContent = '+';
      var go = function () { var v = inp.value.trim(); if (!v) return; while (items.some(function (y) { return String(y.id) === String(nextId); })) nextId++; items.push({ id: nextId++, judul: v, kolom: c }); draw(); send(); };
      b.onclick = go; inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
      ad.appendChild(inp); ad.appendChild(b); col.appendChild(ad);
    }
    col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', function () { col.classList.remove('over'); });
    col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('over'); var tgt = e.target.closest('.cd'); move(drag, c, tgt && String(tgt.dataset.id) !== String(drag) ? tgt.dataset.id : null); drag = null; });
    bd.appendChild(col);
  });
}
C.onRender(function (a) {
  var sig = JSON.stringify([a.items, a.columns]);
  if (items === null || sig !== A._sig) { items = (a.items || []).map(function (x) { return Object.assign({}, x, { kolom: x.kolom || (a.columns || ['Rencana'])[0] }); }); }
  A = a; A._sig = sig;
  var l = document.getElementById('l'); l.hidden = !a.label; l.textContent = a.label || '';
  draw();
});
<\/script>`
});

/* Komponen memilih titik di peta (Slak 1.7, MIT). Nilai: { lat, lon } titik yang diklik, atau null. Ubin peta OpenStreetMap dimuat dari internet. */
Slak.registerComponent('titik_peta', {
  desc: 'Peta OpenStreetMap yang bisa digeser dan diperbesar. Klik peta untuk menaruh titik; nilainya { lat, lon }. Titik lain bisa ditampilkan lewat points: [{ lat, lon, label }]. Butuh internet untuk gambar peta.',
  args: 'label, center: [lat, lon], zoom, points: [{lat, lon, label}], value, map_height=300',
  example: 'const titik = sl.component("titik_peta", {\n  label: "Klik lokasi toko baru",\n  center: [-2.55, 140.7], zoom: 11,\n  points: [{ lat: -2.533, lon: 140.717, label: "Toko Jayapura" }],\n  key: "lokasi"\n})\nif (titik) sl.write(`Lintang ${titik.lat.toFixed(5)}, bujur ${titik.lon.toFixed(5)}`)',
  default: a => a.value || null,
  height: 360,
  html: Slak._kompCss + `<style>
.mp{position:relative;overflow:hidden;border:1px solid var(--ln);border-radius:10px;background:#dfe7ea;cursor:grab;touch-action:none;user-select:none}
.mp.drag{cursor:grabbing}.mp img.t{position:absolute;width:256px;height:256px;max-width:none;pointer-events:none}
.pin{position:absolute;transform:translate(-50%,-100%);pointer-events:auto;font-size:26px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))}
.pin.o{font-size:20px;opacity:.9}.pin span{position:absolute;left:50%;top:-4px;transform:translate(-50%,-100%);background:rgba(255,255,255,.92);color:#1c1e21;font-size:11px;padding:1px 5px;border-radius:4px;white-space:nowrap}
.zm{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:4px;z-index:3}.zm button{width:30px;height:30px;padding:0;background:#fff;color:#1c1e21;font-size:17px}
.at{position:absolute;right:0;bottom:0;font-size:10.5px;background:rgba(255,255,255,.8);color:#333;padding:0 4px;z-index:3}.at a{color:#333}
.inf{margin-top:5px}
</style><div class="lbl" id="l" hidden></div>
<div class="mp" id="m"><div id="tl"></div><div id="pn"></div><div class="zm"><button id="zi">+</button><button id="zo">−</button></div><div class="at">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div></div>
<div class="row inf"><span class="mu" id="inf">Klik peta untuk menaruh titik.</span><button id="clr" hidden>Hapus titik</button></div>
<script>
var C = Slak.component, A = {}, init = false, lat = -2.5, lon = 118, z = 4, pt = null, m = document.getElementById('m');
var WEB = /^https?:/.test(document.baseURI || ''), URL0 = WEB ? 'https://tile.openstreetmap.org/' : 'https://a.tile.openstreetmap.fr/hot/';
function px(la, lo, zz) { var n = 256 * Math.pow(2, zz), s = Math.sin(la * Math.PI / 180); return [(lo + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; }
function ll(x, y, zz) { var n = 256 * Math.pow(2, zz), lo = x / n * 360 - 180, k = Math.PI - 2 * Math.PI * y / n; return [180 / Math.PI * Math.atan(0.5 * (Math.exp(k) - Math.exp(-k))), lo]; }
function draw() {
  var W = m.clientWidth, H = m.clientHeight, c = px(lat, lon, z), x0 = c[0] - W / 2, y0 = c[1] - H / 2, N = Math.pow(2, z), tl = document.getElementById('tl'), keep = {};
  for (var tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + W) / 256); tx++) for (var ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + H) / 256); ty++) {
    if (ty < 0 || ty >= N) continue;
    var wx = ((tx % N) + N) % N, id = z + '/' + wx + '/' + ty + '@' + tx, im = tl.querySelector('[data-id="' + id + '"]');
    if (!im) { im = document.createElement('img'); im.className = 't'; im.dataset.id = id; im.alt = ''; im.src = URL0 + z + '/' + wx + '/' + ty + '.png'; tl.appendChild(im); }
    im.style.left = (tx * 256 - x0) + 'px'; im.style.top = (ty * 256 - y0) + 'px'; keep[id] = 1;
  }
  [].slice.call(tl.children).forEach(function (im) { if (!keep[im.dataset.id]) im.remove(); });
  var pn = document.getElementById('pn'); pn.innerHTML = '';
  function pin(p, cls, ic) { var q = px(p.lat, p.lon, z), d = document.createElement('div'); d.className = 'pin ' + cls; d.textContent = ic; d.style.left = (q[0] - x0) + 'px'; d.style.top = (q[1] - y0) + 'px'; if (p.label) { var s = document.createElement('span'); s.textContent = p.label; d.appendChild(s); d.title = p.label; } pn.appendChild(d); }
  (A.points || []).forEach(function (p) { if (p && isFinite(p.lat) && isFinite(p.lon)) pin(p, 'o', p.icon || '🔵'); });
  if (pt) pin(pt, '', '📍');
  document.getElementById('inf').textContent = pt ? 'Titik: ' + pt.lat.toFixed(5) + ', ' + pt.lon.toFixed(5) : (C.disabled ? '' : 'Klik peta untuk menaruh titik.');
  document.getElementById('clr').hidden = !pt || C.disabled;
}
function zoom(d, cx, cy) {
  var nz = Math.max(2, Math.min(18, z + d)); if (nz === z) return;
  var W = m.clientWidth, H = m.clientHeight; if (cx == null) { cx = W / 2; cy = H / 2; }
  var c = px(lat, lon, z), g = ll(c[0] - W / 2 + cx, c[1] - H / 2 + cy, z), q = px(g[0], g[1], nz), r = ll(q[0] - cx + W / 2, q[1] - cy + H / 2, nz);
  z = nz; lat = r[0]; lon = r[1]; document.getElementById('tl').innerHTML = ''; draw();
}
var st = null;
m.addEventListener('pointerdown', function (e) { if (e.target.closest('.zm,.at')) return; st = { x: e.clientX, y: e.clientY, c: px(lat, lon, z), moved: false }; m.setPointerCapture(e.pointerId); });
m.addEventListener('pointermove', function (e) { if (!st) return; var dx = e.clientX - st.x, dy = e.clientY - st.y; if (Math.abs(dx) + Math.abs(dy) > 4) { st.moved = true; m.classList.add('drag'); } if (st.moved) { var r = ll(st.c[0] - dx, st.c[1] - dy, z); lat = Math.max(-85, Math.min(85, r[0])); lon = r[1]; draw(); } });
m.addEventListener('pointerup', function (e) {
  if (!st) return; var moved = st.moved; st = null; m.classList.remove('drag'); if (moved || C.disabled) return;
  var b = m.getBoundingClientRect(), c = px(lat, lon, z), g = ll(c[0] - b.width / 2 + e.clientX - b.left, c[1] - b.height / 2 + e.clientY - b.top, z);
  pt = { lat: Math.round(g[0] * 1e6) / 1e6, lon: Math.round((((g[1] + 540) % 360) - 180) * 1e6) / 1e6 }; draw(); C.setValue(pt);
});
m.addEventListener('wheel', function (e) { e.preventDefault(); var b = m.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1 : -1, e.clientX - b.left, e.clientY - b.top); }, { passive: false });
m.addEventListener('dblclick', function (e) { var b = m.getBoundingClientRect(); zoom(1, e.clientX - b.left, e.clientY - b.top); });
document.getElementById('zi').onclick = function () { zoom(1); };
document.getElementById('zo').onclick = function () { zoom(-1); };
document.getElementById('clr').onclick = function () { pt = null; draw(); C.setValue(null); };
C.onRender(function (a) {
  A = a; var l = document.getElementById('l'); l.hidden = !a.label; l.textContent = a.label || '';
  m.style.height = (a.map_height || 300) + 'px';
  if (!init) {
    init = true; if (a.value) pt = a.value;
    var c = a.center || (pt ? [pt.lat, pt.lon] : (a.points && a.points[0] ? [a.points[0].lat, a.points[0].lon] : null));
    if (c) { lat = +c[0]; lon = +c[1]; z = a.zoom || 11; } else z = a.zoom || 4;
  }
  draw();
});
new ResizeObserver(function () { draw(); }).observe(m);
<\/script>`
});

/* Komponen editor kode mini (Slak 1.7, MIT). Nilai: teks kode, dikirim saat Ctrl+Enter, tombol Jalankan, atau saat editor ditinggalkan. */
Slak.registerComponent('editor_kode', {
  desc: 'Editor kode kecil dengan nomor baris, pewarnaan sintaks sederhana (sql, js, python), dan tombol Tab. Nilai dikirim saat menekan Ctrl+Enter, tombol Jalankan, atau saat editor ditinggalkan.',
  args: 'value, language="sql" | "js" | "python", editor_height=160, placeholder, label',
  example: 'const sql = sl.component("editor_kode", { language: "sql", value: "SELECT kota, SUM(total) AS omzet\\nFROM penjualan\\nGROUP BY kota", key: "q" })\nsl.code(sql, { language: "sql" })',
  default: a => a.value != null ? String(a.value) : '',
  height: 230,
  html: Slak._kompCss + `<style>
.ed{position:relative;display:flex;border:1px solid var(--ln);border-radius:10px;overflow:hidden;background:var(--pn);font:13px/1.5 ui-monospace,Menlo,Consolas,monospace}
.ed:focus-within{border-color:var(--ac)}.gut{padding:8px 6px 8px 8px;text-align:right;color:var(--mu);user-select:none;white-space:pre;min-width:34px;border-right:1px solid var(--ln)}
.ar{position:relative;flex:1;overflow:auto}pre,textarea{margin:0;padding:8px 10px;font:inherit;white-space:pre;tab-size:2;border:0;min-height:100%}
pre{pointer-events:none;color:var(--fg)}textarea{position:absolute;inset:0;width:100%;height:100%;resize:none;background:transparent;color:transparent;caret-color:var(--fg);outline:none;border-radius:0;overflow:hidden}
.k{color:#a626a4;font-weight:600}.s{color:#50a14f}.c{color:#9aa0a8;font-style:italic}.n{color:#c18401}
@media (prefers-color-scheme:dark){.k{color:#c678dd}.s{color:#98c379}.n{color:#d19a66}}
.bar{margin-top:6px;justify-content:space-between}
</style><div class="lbl" id="l" hidden></div>
<div class="ed"><div class="gut" id="g">1</div><div class="ar" id="ar"><pre id="p"></pre><textarea id="t" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div></div>
<div class="row bar"><span class="mu" id="st"></span><button class="pri" id="go">▶ Jalankan <span class="mu" style="color:inherit;opacity:.8">Ctrl+Enter</span></button></div>
<script>
var C = Slak.component, A = {}, init = false, t = document.getElementById('t'), sent = null;
var KW = {
  sql: 'select from where group by order having join left right inner outer on as and or not in is null like between limit offset distinct count sum avg min max case when then else end with union all insert into values update set delete create table desc asc over partition',
  js: 'const let var function return if else for while of in new await async true false null undefined this class import export from try catch throw typeof break continue switch case default',
  python: 'def return if elif else for while in not and or is None True False import from as class try except finally with lambda yield pass break continue print'
};
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function hl(src) {
  var lang = (A.language || 'sql').toLowerCase(); if (lang === 'javascript' || lang === 'slak') lang = 'js'; if (lang === 'py') lang = 'python';
  var kw = KW[lang]; if (!kw) return esc(src) + '\\n';
  var set = {}; kw.split(' ').forEach(function (w) { set[w] = 1; });
  var cm = lang === 'sql' ? '--' : lang === 'python' ? '#' : '//', out = '', i = 0, n = src.length, NL = String.fromCharCode(10), BS = String.fromCharCode(92);
  function isW(c) { return c && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || (c >= '0' && c <= '9')); }
  while (i < n) {
    var c = src[i], j;
    if (src.substr(i, cm.length) === cm) { j = src.indexOf(NL, i); if (j < 0) j = n; out += '<span class="c">' + esc(src.slice(i, j)) + '</span>'; i = j; }
    else if (c === '"' || c === "'" || c === String.fromCharCode(96)) { j = i + 1; while (j < n && src[j] !== c && (src[j] !== NL || c === String.fromCharCode(96))) { if (src[j] === BS) j++; j++; } j = Math.min(n, j + 1); out += '<span class="s">' + esc(src.slice(i, j)) + '</span>'; i = j; }
    else if (c >= '0' && c <= '9' && !isW(src[i - 1])) { j = i; while (j < n && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j++; out += '<span class="n">' + src.slice(i, j) + '</span>'; i = j; }
    else if (isW(c)) { j = i; while (j < n && isW(src[j])) j++; var w = src.slice(i, j); out += set[lang === 'sql' ? w.toLowerCase() : w] ? '<span class="k">' + w + '</span>' : esc(w); i = j; }
    else { out += esc(c); i++; }
  }
  return out + '\\n';
}
function upd() {
  document.getElementById('p').innerHTML = hl(t.value);
  var n = t.value.split('\\n').length, g = []; for (var i = 1; i <= n; i++) g.push(i); document.getElementById('g').textContent = g.join('\\n');
  var p = document.getElementById('p'), ar = document.getElementById('ar'); t.style.height = Math.max(p.scrollHeight, ar.clientHeight) + 'px'; t.style.width = Math.max(p.scrollWidth, ar.clientWidth) + 'px';
  document.getElementById('st').textContent = t.value === sent ? '' : 'belum dijalankan';
}
function send() { sent = t.value; upd(); C.setValue(t.value); }
t.addEventListener('input', upd);
t.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); return; }
  if (e.key === 'Tab') { e.preventDefault(); var s = t.selectionStart, en = t.selectionEnd; t.value = t.value.slice(0, s) + '  ' + t.value.slice(en); t.selectionStart = t.selectionEnd = s + 2; upd(); }
});
t.addEventListener('blur', function () { if (t.value !== sent) send(); });
document.getElementById('go').onclick = send;
C.onRender(function (a) {
  A = a; var l = document.getElementById('l'); l.hidden = !a.label; l.textContent = a.label || '';
  document.getElementById('ar').style.height = (a.editor_height || 160) + 'px';
  t.readOnly = C.disabled; t.placeholder = a.placeholder || '';
  if (!init) { init = true; t.value = a.value != null ? String(a.value) : ''; sent = t.value; }
  upd();
});
<\/script>`
});

/* Komponen pengatur waktu: stopwatch atau hitung mundur (Slak 1.7, MIT). Nilai: { detik, berjalan, selesai }. */
Slak.registerComponent('pengatur_waktu', {
  desc: 'Stopwatch atau hitung mundur yang berjalan di dalam komponen, tanpa menjalankan ulang aplikasi setiap detik. Aplikasi hanya dijalankan ulang saat Mulai, Jeda, Atur ulang, atau saat hitung mundur selesai. Nilainya { detik, berjalan, selesai }.',
  args: 'mode="stopwatch" | "mundur", seconds=60, autostart, label',
  example: 'const w = sl.component("pengatur_waktu", { mode: "mundur", seconds: 60, label: "Waktu kuis", key: "waktu" })\nif (w.selesai) sl.warning("Waktu habis!")',
  default: a => ({ detik: a.mode === 'mundur' ? (a.seconds || 60) : 0, berjalan: false, selesai: false }),
  height: 120,
  html: Slak._kompCss + `<style>
.tm{font:600 40px/1.1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:1px;margin:2px 0 8px;font-variant-numeric:tabular-nums}
.tm.end{color:#dc2626}.pb{height:4px;border-radius:9px;background:var(--ln);overflow:hidden;margin:-4px 0 8px}.pb i{display:block;height:100%;background:var(--ac);transition:width .25s linear}
</style><div class="lbl" id="l" hidden></div><div class="tm" id="tm">00:00</div><div class="pb" id="pb" hidden><i id="pi"></i></div>
<div class="row"><button class="pri" id="go">▶ Mulai</button><button id="rs">↺ Atur ulang</button><span class="mu" id="st"></span></div>
<script>
var C = Slak.component, A = {}, init = false, run = false, acc = 0, t0 = 0, tick = 0, done = false;
function total() { return A.seconds || 60; }
function el() { return acc + (run ? (Date.now() - t0) / 1000 : 0); }
function shown() { return A.mode === 'mundur' ? Math.max(0, total() - el()) : el(); }
function f(s) { s = A.mode === 'mundur' ? Math.ceil(s) : Math.floor(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), d = s % 60; return (h ? h + ':' : '') + ('0' + m).slice(-2) + ':' + ('0' + d).slice(-2); }
function val() { var s = shown(); return { detik: Math.round((A.mode === 'mundur' ? Math.ceil(s) : Math.floor(s))), berjalan: run, selesai: done }; }
function draw() {
  var tm = document.getElementById('tm'); tm.textContent = f(shown()); tm.className = 'tm' + (done ? ' end' : '');
  var pb = document.getElementById('pb'); pb.hidden = A.mode !== 'mundur'; document.getElementById('pi').style.width = (100 * shown() / total()) + '%';
  document.getElementById('go').textContent = run ? '⏸ Jeda' : (el() > 0 && !done ? '▶ Lanjut' : '▶ Mulai');
  document.getElementById('go').disabled = C.disabled || done; document.getElementById('rs').disabled = C.disabled;
  document.getElementById('st').textContent = done ? 'Waktu habis' : run ? 'berjalan' : '';
}
function loop() { clearInterval(tick); if (run) tick = setInterval(function () { if (A.mode === 'mundur' && el() >= total()) { acc = total(); run = false; done = true; clearInterval(tick); draw(); C.setValue(val()); return; } draw(); }, 200); }
document.getElementById('go').onclick = function () { if (run) { acc = el(); run = false; } else { t0 = Date.now(); run = true; } loop(); draw(); C.setValue(val()); };
document.getElementById('rs').onclick = function () { run = false; acc = 0; done = false; loop(); draw(); C.setValue(val()); };
C.onRender(function (a) {
  A = a; var l = document.getElementById('l'); l.hidden = !a.label; l.textContent = a.label || '';
  if (!init) { init = true; if (a.autostart) { t0 = Date.now(); run = true; loop(); } }
  draw();
});
<\/script>`
});

/* Komponen papan skor (Slak 1.7, MIT). Nilai: objek { nama_tim: skor }. */
Slak.registerComponent('papan_skor', {
  desc: 'Papan skor untuk lomba, kuis kelas, atau permainan: tombol tambah dan kurang per tim, langkah poin yang bisa diatur, dan penanda pemimpin. Nilainya objek { tim: skor }.',
  args: 'teams, scores, step=1 | [1, 5], min_score, label',
  example: 'const skor = sl.component("papan_skor", { teams: ["Merah", "Biru", "Hijau"], step: [1, 5], label: "Cerdas cermat", key: "skor" })\nconst juara = Object.entries(skor).sort((a, b) => b[1] - a[1])[0]\nsl.write(`Sementara memimpin: ${juara[0]} (${juara[1]} poin)`)',
  default: a => { const o = {}; (a.teams || ['Tim A', 'Tim B']).forEach((t, i) => { o[t] = a.scores && a.scores[t] != null ? a.scores[t] : (Array.isArray(a.scores) ? a.scores[i] || 0 : 0); }); return o; },
  height: 190,
  html: Slak._kompCss + `<style>
.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.tm{border:1px solid var(--ln);border-radius:12px;padding:10px;text-align:center;background:var(--pn);position:relative}
.tm.lead{border-color:#f5a524;box-shadow:0 0 0 1px #f5a524 inset}.tm .cr{position:absolute;top:6px;right:8px;font-size:15px}
.nm{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc{font:700 38px/1.15 ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;margin:2px 0 6px}
.bt{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}.bt button{padding:2px 9px;font-size:13px}
.ft{margin-top:8px}
</style><div class="lbl" id="l" hidden></div><div class="gr" id="gr"></div><div class="row ft"><button id="rs">↺ Nol semua</button><button id="un" disabled>↶ Urungkan</button></div>
<script>
var C = Slak.component, A = {}, S = null, hist = [];
function teams() { return A.teams && A.teams.length ? A.teams : ['Tim A', 'Tim B']; }
function steps() { var s = A.step == null ? [1] : A.step; return Array.isArray(s) ? s : [s]; }
function send() { var o = {}; teams().forEach(function (t) { o[t] = S[t] || 0; }); C.setValue(o); document.getElementById('un').disabled = !hist.length || C.disabled; }
function change(t, d) { hist.push(JSON.stringify(S)); S[t] = (S[t] || 0) + d; if (A.min_score != null) S[t] = Math.max(A.min_score, S[t]); draw(); send(); }
function draw() {
  var gr = document.getElementById('gr'); gr.innerHTML = '';
  var best = Math.max.apply(null, teams().map(function (t) { return S[t] || 0; })), nBest = teams().filter(function (t) { return (S[t] || 0) === best; }).length;
  teams().forEach(function (t) {
    var d = document.createElement('div'), lead = best > 0 && (S[t] || 0) === best && nBest === 1; d.className = 'tm' + (lead ? ' lead' : '');
    d.innerHTML = (lead ? '<span class="cr">👑</span>' : '') + '<div class="nm"></div><div class="sc"></div><div class="bt"></div>';
    d.querySelector('.nm').textContent = t; d.querySelector('.sc').textContent = S[t] || 0;
    var bt = d.querySelector('.bt');
    steps().forEach(function (s) { [-s, s].forEach(function (v) { var b = document.createElement('button'); b.textContent = (v > 0 ? '+' : '−') + Math.abs(v); b.disabled = C.disabled; b.onclick = function () { change(t, v); }; if (v > 0) bt.appendChild(b); else bt.insertBefore(b, bt.firstChild); }); });
    gr.appendChild(d);
  });
  document.getElementById('rs').disabled = C.disabled;
}
document.getElementById('rs').onclick = function () { hist.push(JSON.stringify(S)); teams().forEach(function (t) { S[t] = 0; }); draw(); send(); };
document.getElementById('un').onclick = function () { if (!hist.length) return; S = JSON.parse(hist.pop()); draw(); send(); };
C.onRender(function (a) {
  A = a; var l = document.getElementById('l'); l.hidden = !a.label; l.textContent = a.label || '';
  if (!S) { S = {}; teams().forEach(function (t, i) { S[t] = a.scores && !Array.isArray(a.scores) && a.scores[t] != null ? a.scores[t] : (Array.isArray(a.scores) ? a.scores[i] || 0 : 0); }); }
  draw();
});
<\/script>`
});

/* Komponen tombol suara: ucapan menjadi teks dengan Web Speech API (Slak 1.7, MIT). Nilai: teks hasil, atau "" bila belum ada. */
Slak.registerComponent('tombol_suara', {
  desc: 'Tombol mikrofon yang mengubah ucapan menjadi teks dengan Web Speech API browser (bahasa Indonesia secara bawaan). Tersedia di Chrome dan Edge yang tersambung internet; di browser lain tampil pesan dan kotak ketik sebagai gantinya.',
  args: 'label, lang="id-ID", continuous, value',
  example: 'const ucapan = sl.component("tombol_suara", { label: "Ucapkan nama produk", lang: "id-ID", key: "suara" })\nif (ucapan) sl.write("Kamu mengucapkan:", ucapan)',
  default: a => a.value || '',
  height: 110,
  html: Slak._kompCss + `<style>
.mic{width:46px;height:46px;border-radius:50%;font-size:21px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.mic.on{background:#dc2626;border-color:#dc2626;color:#fff;animation:p 1.2s infinite}@keyframes p{0%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}100%{box-shadow:0 0 0 12px rgba(220,38,38,0)}}
.tx{flex:1;min-width:160px;min-height:46px;border:1px solid var(--ln);border-radius:10px;padding:6px 10px;display:flex;align-items:center}.tx i{color:var(--mu)}
.fb{display:flex;gap:6px;flex:1}.fb input{flex:1}
</style><div class="lbl" id="l" hidden></div>
<div class="row"><button class="mic" id="mic" title="Mulai bicara">🎤</button><div class="tx" id="tx"><i>Klik mikrofon lalu bicara.</i></div></div>
<div class="mu" id="st" style="margin-top:4px"></div>
<script>
var C = Slak.component, A = {}, R = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, on = false, txt = '', init = false;
function show(t, temp) { var x = document.getElementById('tx'); x.innerHTML = ''; if (!t) { var i = document.createElement('i'); i.textContent = temp || 'Klik mikrofon lalu bicara.'; x.appendChild(i); } else x.textContent = t; }
function stat(s) { document.getElementById('st').textContent = s || ''; }
function fallback(why) {
  document.getElementById('mic').disabled = true; stat(why + ' Ketik saja di kotak ini.');
  var x = document.getElementById('tx'); x.innerHTML = '<div class="fb"><input id="in" placeholder="Ketik di sini"><button id="ok">Kirim</button></div>';
  var inp = document.getElementById('in'); inp.value = txt; var go = function () { txt = inp.value; C.setValue(txt); };
  document.getElementById('ok').onclick = go; inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
}
function start() {
  rec = new R(); rec.lang = A.lang || 'id-ID'; rec.interimResults = true; rec.continuous = !!A.continuous; var fin = A.continuous ? txt : '';
  rec.onresult = function (e) { var temp = ''; for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) fin += (fin ? ' ' : '') + e.results[i][0].transcript.trim(); else temp += e.results[i][0].transcript; } show(fin + (temp ? ' ' + temp : '')); };
  rec.onerror = function (e) { var m = { 'not-allowed': 'Izin mikrofon ditolak.', 'service-not-allowed': 'Layanan suara tidak diizinkan di halaman ini.', 'network': 'Layanan suara butuh internet.', 'no-speech': 'Tidak terdengar suara. Coba lagi.', 'audio-capture': 'Mikrofon tidak ditemukan.' }[e.error] || ('Galat: ' + e.error); stat(m); if (e.error === 'not-allowed' || e.error === 'service-not-allowed') fallback(m); };
  rec.onend = function () { on = false; document.getElementById('mic').className = 'mic'; if (fin && fin !== txt) { txt = fin; show(txt); C.setValue(txt); stat(''); } else if (!fin) show(txt); };
  try { rec.start(); on = true; document.getElementById('mic').className = 'mic on'; stat('Mendengarkan… klik lagi untuk berhenti.'); show('', 'Silakan bicara…'); } catch (err) { stat('Tidak bisa memulai: ' + err.message); }
}
document.getElementById('mic').onclick = function () { if (C.disabled) return; if (on && rec) rec.stop(); else start(); };
C.onRender(function (a) {
  A = a; var l = document.getElementById('l'); l.hidden = !a.label; l.textContent = a.label || '';
  if (!init) { init = true; txt = a.value || ''; if (!R) fallback('Browser ini belum mendukung pengenalan suara (pakai Chrome atau Edge).'); else show(txt); }
  document.getElementById('mic').disabled = C.disabled || !R;
});
<\/script>`
});
})(window.Slak);
