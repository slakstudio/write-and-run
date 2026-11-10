/*! slak-docs.js 0.2.0 - berkas tambahan Slak 1.9.1 untuk situs dokumentasi. Lisensi MIT.
 *
 * Muat sesudah slak.js. Semua fungsi ada di Slak.docs dan menerima `sl` sebagai argumen pertama;
 * berkas ini tidak menambah nama apa pun ke `sl`, jadi janji API stabil Slak 1.9 tetap terjaga.
 *
 *   Slak.docs.site(sl, { judul, bab })   satu panggilan untuk seluruh situs: menu berkelompok,
 *                                        alamat per halaman, Sebelumnya/Berikutnya, daftar isi, pencarian
 *   Slak.docs.markdown(sl, teks)         isi bab; blok ```slak dijalankan dan hasilnya tampil di bawahnya
 *   Slak.docs.toc(sl)                    daftar isi "Di halaman ini" dari judul bab
 *   Slak.docs.search(sl, halaman)        pencarian (Ctrl+K) untuk seluruh situs
 *   Slak.docs.meta({ deskripsi, gambar, kanonik })   deskripsi, gambar pratinjau, dan alamat kanonik
 *
 * 0.2: tampilan: "jernih" (kepala situs, daftar isi di kanan, kotak kode dengan Salin dan Playground,
 * kartu Sebelumnya/Berikutnya), bab dari berkas .md yang juga terbaca saat klik dua kali bila berkas
 * pembungkusnya (bab.md.js dari Bungkus data) ada di folder yang sama, dan indeks pencarian
 * yang disimpan di browser.
 *
 * Isi bab bisa juga ditulis di halaman dalam blok <script type="text/markdown" id="bab-1">, lalu { elemen: "bab-1" }.
 * Di dalam blok itu, tulis <\/script> bila isi bab memuat tag penutup script.
 */
(function (global) {
  'use strict';
  const Slak = global.Slak;
  if (!Slak) throw new Error('slak-docs.js harus dimuat sesudah slak.js.');
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  const S = { kanonik: 'https://slak.studio', site: null, headings: [], pages: [], index: null, texts: new Map(), codes: [], goto: null, jernih: false, idxKey: '' };
  const hasDoc = typeof document !== 'undefined';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bagian';
  const isSl = sl => sl && typeof sl.write === 'function' && typeof sl.markdown === 'function';
  const need = (sl, fn) => { if (!isSl(sl)) throw new Error(`Slak.docs.${fn} butuh sl sebagai argumen pertama, misalnya Slak.docs.${fn}(sl, ...).`); };
  const plain = s => String(s).replace(/`/g, '').replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|[\s(])[*_](\S(?:.*?\S)?)[*_](?=[\s).,:;]|$)/g, '$1$2');
  const appRoot = () => hasDoc ? (document.querySelector('.slak-app:not(.embedded)') || document.querySelector('.slak-app')) : null;

  /* ---------- gaya ---------- */
  const J_LIGHT = '--bg:#ffffff;--bg2:#f6f7f9;--panel:#ffffff;--fg:#16181d;--muted:#5a6170;--line:#e3e6eb;--line2:#d5d9e0;--accent:#0f7a70;--accent-ink:#0b5f57;--accent-soft:#e6f4f1;--accent-fg:#ffffff;--code-bg:#fbfbfc;--sd-text:#2a2f38;--sd-lead:#3f4652;--sd-note:#0b3b36;color-scheme:light;';
  const J_DARK = '--bg:#0f1115;--bg2:#171a1f;--panel:#171a1f;--fg:#e8eaed;--muted:#9aa1ac;--line:#262a31;--line2:#343941;--accent:#2db8a8;--accent-ink:#5eead4;--accent-soft:rgba(45,184,168,.14);--accent-fg:#04201d;--code-bg:#14171c;--sd-text:#d5d9df;--sd-lead:#b4bac4;--sd-note:#c9f2ec;color-scheme:dark;';
  function css() {
    if (!hasDoc || document.getElementById('slak-docs-css')) return;
    const st = document.createElement('style'); st.id = 'slak-docs-css';
    st.textContent = `.sd-toc{font-size:13.5px;line-height:1.45;margin:6px 0 2px}.sd-toc b{display:block;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px}
.sd-toc a{display:block;padding:4px 0 4px 12px;border-left:2px solid var(--line);color:var(--muted);text-decoration:none}.sd-toc a.lv3{padding-left:24px}
.sd-toc a:hover{color:var(--fg)}.sd-toc a.on{border-left-color:var(--accent);color:var(--accent-ink,var(--accent));font-weight:600}
.sd-toc a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.sd-hit-s{font-size:13px;color:var(--muted);margin:-4px 0 10px}.sd-hit-s mark,.sd-cari mark{background:color-mix(in srgb,var(--accent) 22%,transparent);color:inherit;border-radius:3px}
.sd-out{font-size:12px;color:var(--muted);margin:-6px 0 4px}
.slak-html:has(> .sd-mark){display:none}
.slak-box:has(> .slak-html > .sd-bar){border:1px solid var(--line);border-radius:10px;overflow:hidden;gap:0;padding:0}
.sd-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 14px;background:var(--bg2);border-bottom:1px solid var(--line)}
.sd-bar span{font:12px var(--mono);color:var(--muted)}.sd-bar div{display:flex;gap:8px}
.sd-bar button,.sd-bar a{font:inherit;font-size:12px;line-height:1.4;border-radius:6px;padding:4px 10px;cursor:pointer;text-decoration:none}
.sd-bar button{color:var(--sd-lead,var(--fg));border:1px solid var(--line2);background:var(--panel)}
.sd-bar a{font-weight:600;color:var(--accent-fg,#fff);background:var(--accent);border:1px solid var(--accent)}.sd-bar a:hover{filter:brightness(.92)}
.slak-box:has(> .slak-html > .sd-bar) > .slak-code pre{border-radius:0;background:var(--code-bg);padding:16px 18px;font-size:13.5px;line-height:1.7}
.slak-box:has(> .slak-html > .sd-bar) > .slak-code .slak-copy,.slak-box:has(> .slak-html > .sd-bar) > .slak-code .slak-lang{display:none}
.slak-box:has(> .slak-html > .sd-hasil){border-top:1px dashed var(--line2);padding:14px 18px 16px;gap:12px}
.sd-hasil{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.sd-crumb{font-size:13px;color:var(--muted)}.sd-crumb a{color:var(--accent-ink)}
.slak-html:has(> .sd-lead-m) + .slak-md{font-size:19px;line-height:1.6;color:var(--sd-lead,var(--muted))}
.sd-pn{display:flex;flex-wrap:wrap;gap:16px;margin-top:24px;padding-top:24px;border-top:1px solid var(--line)}
.sd-pn a{flex:1 1 220px;display:flex;flex-direction:column;gap:2px;padding:14px 16px;border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--fg)}
.sd-pn a:hover{border-color:var(--accent);text-decoration:none}.sd-pn a.nx{align-items:flex-end;text-align:right}
.sd-pn small{font-size:12px;color:var(--muted)}.sd-pn b{font-size:15px;font-weight:600;color:var(--accent-ink)}
.sd-src{font-size:13px}.sd-foot{margin-top:28px;padding-top:18px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.sd-tocin{border:1px solid var(--line);border-radius:8px;padding:8px 14px;font-size:14px}.sd-tocin summary{cursor:pointer;font-weight:600;color:var(--sd-lead,var(--fg))}.sd-tocin .sd-toc{margin:10px 0 4px}
.sd-cari{position:fixed;inset:0;z-index:80;background:rgba(10,12,16,.45);display:flex;justify-content:center;align-items:flex-start;padding:8vh 16px}
.sd-cari[hidden]{display:none}
.sd-cari>div{width:min(640px,100%);max-height:80vh;display:flex;flex-direction:column;background:var(--panel);color:var(--fg);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;font:15px/1.5 var(--font)}
.sd-cari input{border:0;border-bottom:1px solid var(--line);padding:16px 18px;font:inherit;font-size:16px;background:transparent;color:inherit;outline:none}
.sd-cari ul{list-style:none;margin:0;padding:6px;overflow:auto}.sd-cari li a{display:block;padding:9px 12px;border-radius:8px;color:inherit;text-decoration:none}
.sd-cari li a b{display:block;font-size:14px;font-weight:600}.sd-cari li a span{display:block;font-size:13px;color:var(--muted)}
.sd-cari li a.on,.sd-cari li a:hover{background:var(--accent-soft)}.sd-cari p{margin:0;padding:14px 18px;color:var(--muted);font-size:14px}
.slak-app.sd-jernih{${J_LIGHT}--font:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
display:grid;grid-template-columns:272px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);font-size:16px;line-height:1.7}
.slak-app.sd-jernih[data-theme=dark]{${J_DARK}}
@media (prefers-color-scheme:dark){.slak-app.sd-jernih[data-theme=auto]{${J_DARK}}}
.sd-jernih #sd-head{grid-column:1/-1;grid-row:1}
.sd-jernih .slak-sidebar{grid-column:1;grid-row:2;width:auto;height:auto;min-height:0;background:var(--bg);padding:16px 16px 40px}
.sd-jernih .slak-main{grid-column:2;grid-row:2;min-height:0}
.sd-jernih.has-sidebar.sb-toggled{grid-template-columns:0 minmax(0,1fr)}
.sd-jernih .slak-top{display:none}
.sd-jernih .slak-body{max-width:820px;padding:36px 30px 64px}
.sd-jernih .slak-nav a{font-size:14px;line-height:20px;padding:6px 10px;border-radius:6px;color:var(--sd-lead,var(--fg))}
.sd-jernih .slak-nav a:hover{background:var(--bg2);color:var(--fg)}
.sd-jernih .slak-nav a.on{background:var(--accent-soft);color:var(--accent-ink)}
.sd-jernih .slak-nav-sec{font-size:12px;font-weight:600;letter-spacing:.06em;color:var(--muted);margin:20px 10px 6px}
.sd-jernih .slak-sb-close{display:none}
.sd-jernih .slak-body h1{font-size:40px;line-height:1.15;letter-spacing:-.02em}
.sd-jernih .slak-body h2{font-size:24px;letter-spacing:-.01em;margin-top:18px}
.sd-jernih .slak-md p,.sd-jernih .slak-md li{color:var(--sd-text,var(--fg))}
.sd-jernih .slak-md a,.sd-jernih .sd-src a,.sd-jernih .sd-foot a{color:var(--accent-ink);text-decoration:none}.sd-jernih .slak-md a:hover{text-decoration:underline}
.sd-jernih .slak-md :not(pre)>code{font-size:.88em;background:var(--bg2);padding:1px 5px;border-radius:4px}
.sd-jernih .slak-md blockquote{margin:0;border:0;padding:14px 16px;border-radius:8px;background:var(--accent-soft);color:var(--sd-note,var(--fg))}
.sd-jernih .slak-md blockquote p{color:inherit}
.sd-jernih .slak-md img{max-width:100%;height:auto;border:1px solid var(--line);border-radius:8px}
#sd-head{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;padding:12px 28px;border-bottom:1px solid var(--line);background:var(--bg);color:var(--fg);font:15px/1.4 var(--font);position:relative;z-index:7}
#sd-head a{color:var(--fg);text-decoration:none}
#sd-head .sd-logo{display:flex;align-items:center;gap:10px;font-size:19px;font-weight:700}
#sd-head .sd-ver{font-size:12px;font-weight:600;color:var(--sd-lead,var(--muted));border:1px solid var(--line);border-radius:999px;padding:3px 9px}
#sd-head label{flex:1 1 220px;max-width:420px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:7px 12px;background:var(--bg2);cursor:text}
#sd-head input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-size:14px;color:var(--fg);outline:none}
#sd-head kbd{font:11px var(--mono);color:var(--muted);border:1px solid var(--line2);border-radius:4px;padding:1px 5px;background:var(--panel)}
#sd-head nav{display:flex;flex-wrap:wrap;align-items:center;gap:6px 20px;margin-left:auto}
#sd-head nav a{font-size:14px;font-weight:500}#sd-head nav a:hover,#sd-head nav a.on{color:var(--accent-ink)}
#sd-head button{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--fg);cursor:pointer;font-size:17px;padding:0}
#sd-head button:hover{border-color:var(--accent)}
#sd-head .sd-menu{display:none}
#sd-head :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#sd-tocx{display:none}
@media (min-width:1240px){
 .sd-jernih.sd-has-toc .slak-main{padding-right:calc(var(--sd-r) + 264px)}
 .sd-jernih.sd-has-toc .slak-body{margin-right:0}
 .sd-jernih{--sd-r:max(24px,calc((100vw - 272px - 1100px) / 2))}
 .sd-jernih.sd-has-toc #sd-tocx{display:block;position:fixed;top:120px;right:var(--sd-r);width:240px;max-height:calc(100vh - 150px);overflow:auto}
 .sd-jernih.sd-has-toc .sd-tocin{display:none}
}
@media (max-width:900px){
 .slak-app.sd-jernih{grid-template-columns:minmax(0,1fr)}
 .sd-jernih .slak-main{grid-column:1}
 .sd-jernih .slak-sidebar{padding-top:56px}
 .sd-jernih .slak-sb-close{display:inline-grid}
 .sd-jernih .slak-body{padding:24px 18px 56px}
 .sd-jernih .slak-body h1{font-size:32px}
 #sd-head{padding:10px 16px;gap:10px 14px}
 #sd-head .sd-menu{display:grid}
 #sd-head label{order:5;flex-basis:100%;max-width:none}
 #sd-head nav{order:6;flex-basis:100%;margin:0;flex-wrap:nowrap;overflow-x:auto;gap:18px;padding-bottom:2px}
 #sd-head nav a{white-space:nowrap}
 #sd-head kbd{display:none}
}`;
    document.head.append(st);
  }

  /* ---------- bab: Markdown dengan blok yang dijalankan ---------- */
  function parse(teks) {
    const out = [], lines = String(teks || '').replace(/\r\n?/g, '\n').split('\n'), used = new Map();
    let buf = [];
    const flush = () => { const t = buf.join('\n').trim(); if (t) out.push({ t: 'md', text: t }); buf = []; };
    const uid = s => { const b = slug(s); const n = (used.get(b) || 0) + 1; used.set(b, n); return n > 1 ? b + '-' + n : b; };
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i], f = /^(`{3,}|~{3,})\s*([\w-]*)\s*(.*)$/.exec(L);
      if (f) {
        flush();
        const code = []; i++;
        while (i < lines.length && !(lines[i].startsWith(f[1]) && lines[i].trim().replace(/^[`~]+/, '') === '')) code.push(lines[i++]);
        const lang = (f[2] || '').toLowerCase(), src = code.join('\n');
        if (lang === 'slak') out.push({ t: /tanpa-jalan|norun/.test(f[3]) ? 'code' : 'run', code: src, lang: 'javascript', slak: true });
        else out.push({ t: 'code', code: src, lang: lang || 'text' });
        continue;
      }
      const h = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(L);
      if (h) { flush(); out.push({ t: 'h', level: h[1].length, text: h[2], id: uid(plain(h[2])) }); continue; }
      buf.push(L);
    }
    flush();
    return out;
  }
  const headsOf = teks => parse(teks).filter(b => b.t === 'h').map(b => ({ level: b.level, text: plain(b.text), id: b.id }));
  function playgroundBase(o) {
    return (o && o.playground) || (S.site && S.site.playground) || Slak.share.official || undefined;
  }
  function codeId(code) {
    let i = S.codes.indexOf(code);
    if (i < 0) { i = S.codes.length; S.codes.push(code); }
    return i;
  }
  async function markdown(sl, teks, o) {
    need(sl, 'markdown'); css(); wireCopy(); o = o || {};
    const jernih = o.tampilan ? o.tampilan === 'jernih' : S.jernih;
    const blocks = parse(teks), heads = [];
    let lead = !!o.lead;
    for (const b of blocks) {
      if (b.t === 'h') {
        heads.push({ level: b.level, text: plain(b.text), id: b.id });
        (b.level === 1 ? sl.title : b.level === 2 ? sl.header : sl.subheader)(b.text, { anchor: b.id });
        if (b.level > 1) lead = false;
        continue;
      }
      if (b.t === 'md') {
        if (lead && jernih && !/^\s*([-*+>|]|\d+\.)/.test(b.text) && !/\n\s*\n/.test(b.text)) sl.html('<span class="sd-mark sd-lead-m"></span>');
        lead = false;
        sl.markdown(b.text);
        continue;
      }
      lead = false;
      if (b.t === 'code' && !b.slak) { sl.code(b.code, { language: b.lang }); continue; }
      if (b.t === 'run') await ensureExt(b.code);
      let url = '';
      if (o.playground !== false) { try { url = await Slak.share.link(b.code, playgroundBase(o)); } catch (e) { /* abaikan */ } }
      const box = jernih ? sl.container() : sl;
      if (jernih) box.html(`<div class="sd-bar"><span>slak</span><div><button type="button" data-sd-copy="${codeId(b.code)}">Salin</button>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">Buka di Playground</a>` : ''}</div></div>`);
      box.code(b.code, { language: 'javascript' });
      if (b.t === 'run') {
        const res = jernih ? box.container() : sl.container({ border: true });
        if (jernih) res.html('<span class="sd-hasil">Hasil</span>');
        try { await new AF('sl', b.code)(res); }
        catch (e) { res.error('Contoh ini gagal dijalankan: ' + (e && e.message || e)); }
      }
      if (!jernih && url) sl.html(`<p class="sd-out"><a href="${esc(url)}" target="_blank" rel="noopener">Buka di Playground ↗</a></p>`);
    }
    S.headings = heads;
    return heads;
  }
  /* Tambahan Slak dimuat saat contoh memakainya (hanya bila slak.js dimuat lewat <script src>). */
  const EXT = [[/\bsl\.(DataFrame|read_csv|read_excel|read_json|concat|merge|pivot_table|stats|ml|forecast|date_range|Series)\b/, 'slak-data.js', 'DataFrame'],
    [/\bsl\.(sql|sqlite)\b/, 'slak-sql.js', 'sqlite'], [/\bsl\.(map|choropleth|geo)\b|\bsl\.peta\b/, 'slak-peta.js', 'choropleth'], [/\bsl\.duckdb\b/, 'slak-duckdb.js', 'duckdb']];
  const extLoad = new Map();
  function ensureExt(code) {
    if (!hasDoc) return Promise.resolve();
    const tag = document.querySelector('script[src$="slak.js"]');
    if (!tag) return Promise.resolve();
    const base = tag.src.replace(/slak\.js(\?.*)?$/, '');
    return Promise.all(EXT.filter(([re, f, n]) => re.test(code) && typeof Slak[n] === 'undefined' && !document.querySelector(`script[src$="${f}"]`)).map(([, f]) => {
      if (!extLoad.has(f)) extLoad.set(f, new Promise(ok => { const s = document.createElement('script'); s.src = base + f; s.onload = ok; s.onerror = ok; document.head.append(s); }));
      return extLoad.get(f);
    }));
  }
  let copyWired = false;
  function wireCopy() {
    if (copyWired || !hasDoc) return; copyWired = true;
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-sd-copy]');
      if (!b) return;
      const code = S.codes[+b.getAttribute('data-sd-copy')] || '';
      const done = () => { b.textContent = 'Tersalin'; setTimeout(() => { b.textContent = 'Salin'; }, 1500); };
      try { navigator.clipboard.writeText(code).then(done, () => fallback()); } catch (err) { fallback(); }
      function fallback() { const t = document.createElement('textarea'); t.value = code; document.body.append(t); t.select(); try { document.execCommand('copy'); done(); } catch (x) { /* abaikan */ } t.remove(); }
    });
  }

  /* ---------- daftar isi ---------- */
  let tocWired = false;
  function scrollToId(id) {
    const el = hasDoc && document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
    return true;
  }
  function wireToc() {
    if (tocWired || !hasDoc) return; tocWired = true;
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[data-sd-toc]');
      if (!a) return;
      e.preventDefault();
      scrollToId(a.getAttribute('data-sd-toc'));
    });
    let raf = 0;
    const mark = () => {
      raf = 0;
      const box = document.getElementById('sd-tocx'), vis = box && box.offsetParent ? box : null;
      const links = (vis || document).querySelectorAll('a[data-sd-toc]'); if (!links.length) return;
      let cur = null;
      for (const a of links) { const el = document.getElementById(a.getAttribute('data-sd-toc')); if (el && el.getBoundingClientRect().top < 140) cur = a; }
      for (const a of document.querySelectorAll('a[data-sd-toc]')) { const on = a.getAttribute('data-sd-toc') === (cur || links[0]).getAttribute('data-sd-toc'); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }
    };
    document.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(mark); }, true);
    setInterval(mark, 1500);
  }
  const tocHTML = (hs, label) => `<nav class="sd-toc" aria-label="${esc(label)}"><b>${esc(label)}</b>${hs.map(h => `<a href="#${esc(h.id)}" data-sd-toc="${esc(h.id)}" class="lv${h.level}">${esc(h.text)}</a>`).join('')}</nav>`;
  function toc(sl, o) {
    need(sl, 'toc'); css(); wireToc(); o = o || {};
    const hs = (o.headings || S.headings).filter(h => h.level >= 2 && h.level <= 3), label = o.label || 'Di halaman ini';
    const root = S.jernih && !o.where ? appRoot() : null;
    if (root) {
      let box = document.getElementById('sd-tocx');
      if (!box) { box = document.createElement('aside'); box.id = 'sd-tocx'; root.append(box); }
      const ok = hs.length >= (o.min || 2);
      box.innerHTML = ok ? tocHTML(hs, label) : '';
      root.classList.toggle('sd-has-toc', ok);
      return ok ? box : null;
    }
    if (hs.length < (o.min || 2)) return null;
    return (o.where || sl.sidebar).html(tocHTML(hs, label));
  }

  /* ---------- pencarian ---------- */
  function buildIndex(pages) {
    const idx = [];
    for (const p of pages) {
      const text = p.teks || '';
      let cur = { bagian: '', id: '', teks: [] };
      const push = () => { const t = cur.teks.join(' ').replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`>|[\]()]/g, ' ').replace(/\s+/g, ' ').trim(); if (t || cur.bagian) idx.push({ page: p, judul: p.judul, bagian: cur.bagian, id: cur.id, teks: t, low: (p.judul + ' ' + cur.bagian + ' ' + t).toLowerCase() }); };
      for (const b of parse(text)) {
        if (b.t === 'h' && b.level >= 2) { push(); cur = { bagian: plain(b.text), id: b.id, teks: [] }; }
        else if (b.t === 'md' || b.t === 'code' || b.t === 'run') cur.teks.push(b.text || b.code);
      }
      push();
    }
    return idx;
  }
  function find(q, idx, max) {
    const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const hits = [];
    for (const e of idx) {
      if (!terms.every(t => e.low.includes(t))) continue;
      let score = 0;
      for (const t of terms) { if (e.judul.toLowerCase().includes(t)) score += 5; if (e.bagian.toLowerCase().includes(t)) score += 3; score += Math.min(3, e.low.split(t).length - 1); }
      hits.push({ e, score });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, max || 12).map(h => h.e);
  }
  function snippet(e, q) {
    const t = e.teks, low = t.toLowerCase(), term = String(q).toLowerCase().split(/\s+/).filter(Boolean)[0] || '';
    const i = Math.max(0, low.indexOf(term) - 50), s = (i > 0 ? '…' : '') + t.slice(i, i + 150) + (t.length > i + 150 ? '…' : '');
    return esc(s).replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), m => `<mark>${m}</mark>`);
  }
  let keyWired = false;
  function wireKey(open) {
    if (keyWired || !hasDoc) return; keyWired = true;
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        if (S.jernih) { e.preventDefault(); openCari(); return; }
        const b = [...document.querySelectorAll('button')].find(x => /Cari\s+\(Ctrl\+K\)/.test(x.textContent));
        if (b) { e.preventDefault(); b.click(); }
      }
    });
  }
  function search(sl, halaman, o) {
    need(sl, 'search'); css(); o = o || {};
    const pages = (halaman || S.pages).map(p => Object.assign({}, p, { teks: p.teks != null ? p.teks : S.texts.get(keyOf(p)) || '' }));
    const idx = buildIndex(pages);
    S.index = idx;
    wireKey();
    if (S.jernih && !o.where) return { find: q => find(q, idx, o.max), size: idx.length };
    const where = o.where || sl.sidebar;
    const open = sl.dialog(o.label || 'Cari di situs', (d) => {
      const q = d.text_input('Kata yang dicari', { key: 'slak-docs-q', placeholder: 'misalnya: read_csv, grafik, login' });
      const hits = find(q, idx, o.max);
      if (q && !hits.length) d.caption('Tidak ada yang cocok. Coba kata lain.');
      for (const e of hits) {
        if (e.page.halaman) d.page_link(e.page.halaman, { label: e.bagian ? `${e.judul} › ${e.bagian}` : e.judul });
        else d.markdown(`**${e.judul}${e.bagian ? ' › ' + e.bagian : ''}**`);
        d.html(`<p class="sd-hit-s">${snippet(e, q)}</p>`);
      }
    });
    if (where.button('🔍 Cari  (Ctrl+K)', { key: 'slak-docs-cari', use_container_width: true })) open();
    return { find: q => find(q, idx, o.max), size: idx.length };
  }

  /* --- pencarian tampilan jernih: kotak di atas halaman, indeks dimuat saat pertama dibuka --- */
  const IDB = 'slak-docs';
  function idb(mode, key, val) {
    return new Promise(res => {
      try {
        const r = indexedDB.open(IDB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('t');
        r.onerror = () => res(null);
        r.onsuccess = () => {
          try {
            const tx = r.result.transaction('t', mode === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('t');
            const q = mode === 'get' ? st.get(key) : st.put(val, key);
            q.onsuccess = () => res(mode === 'get' ? q.result || null : true); q.onerror = () => res(null);
          } catch (e) { res(null); }
        };
      } catch (e) { res(null); }
    });
  }
  async function loadIndex() {
    if (S.index && S.idxKey === S.sig) return S.index;
    const key = 'indeks|' + (hasDoc ? location.pathname : '') + '|' + S.sig;
    let texts = await idb('get', key);
    if (!texts) {
      texts = {};
      await Promise.all(S.pages.filter(p => typeof p.fungsi !== 'function' || p.teks_cari != null).map(p => (p.teks_cari != null ? Promise.resolve(p.teks_cari) : textOf(p)).then(t => { texts[keyOf(p)] = t; }, () => {})));
      if (S.pages.every(p => texts[keyOf(p)] != null || typeof p.fungsi === 'function')) idb('put', key, texts);
    }
    S.index = buildIndex(S.pages.map(p => Object.assign({}, p, { teks: texts[keyOf(p)] || '' })));
    S.idxKey = S.sig;
    return S.index;
  }
  let cariEl = null;
  function openCari(q) {
    if (!hasDoc) return;
    if (!cariEl) {
      cariEl = document.createElement('div'); cariEl.className = 'sd-cari'; cariEl.hidden = true;
      cariEl.innerHTML = '<div role="dialog" aria-modal="true" aria-label="Cari di situs"><input type="search" placeholder="Cari di dokumentasi, misalnya: read_csv, grafik, login" aria-label="Kata yang dicari"><ul></ul><p></p></div>';
      (appRoot() || document.body).append(cariEl);
      const inp = cariEl.querySelector('input'), ul = cariEl.querySelector('ul'), info = cariEl.querySelector('p');
      let sel = 0, hits = [];
      const draw = async () => {
        const v = inp.value.trim();
        if (!v) { ul.innerHTML = ''; info.textContent = 'Ketik kata yang dicari. Enter membuka hasil teratas, Esc menutup.'; return; }
        if (!S.index || S.idxKey !== S.sig) info.textContent = 'Memuat indeks…';
        const idx = await loadIndex();
        if (inp.value.trim() !== v) return;
        hits = find(v, idx, 20); sel = 0;
        ul.innerHTML = hits.map((e, i) => `<li><a href="#/${esc(e.page.url)}" data-sd-go="${esc(e.id)}" class="${i ? '' : 'on'}"><b>${esc(e.judul)}${e.bagian ? ' › ' + esc(e.bagian) : ''}</b><span>${snippet(e, v)}</span></a></li>`).join('');
        info.textContent = hits.length ? '' : 'Tidak ada yang cocok. Coba kata lain.';
        info.hidden = !!hits.length;
      };
      const close = () => { cariEl.hidden = true; };
      inp.addEventListener('input', draw);
      inp.addEventListener('keydown', e => {
        const as = ul.querySelectorAll('a');
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!as.length) return; sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + as.length) % as.length; as.forEach((a, i) => a.classList.toggle('on', i === sel)); as[sel].scrollIntoView({ block: 'nearest' }); }
        if (e.key === 'Enter' && as[sel]) { e.preventDefault(); as[sel].click(); }
      });
      cariEl.addEventListener('click', e => {
        if (e.target === cariEl) { close(); return; }
        const a = e.target.closest('a[data-sd-go]'); if (!a) return;
        S.goto = a.getAttribute('data-sd-go') || null;
        close();
        if (a.getAttribute('href') === location.hash) { e.preventDefault(); if (S.goto) { scrollToId(S.goto); S.goto = null; } }
      });
      cariEl._draw = draw;
    }
    cariEl.hidden = false;
    const inp = cariEl.querySelector('input');
    if (q != null) inp.value = q;
    inp.focus(); inp.select();
    cariEl._draw();
  }

  /* ---------- kepala situs (tampilan jernih) ---------- */
  const LOGO = '<svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true"><rect x="2" y="2" width="96" height="96" rx="24" fill="#0F7A70"/><text x="46" y="67" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="50" letter-spacing="-2" fill="#FFFAF0">Sl</text><circle cx="76" cy="63" r="6" fill="#FFD699"/></svg>';
  function head(o, first) {
    const root = appRoot(); if (!root) return;
    root.classList.add('sd-jernih');
    let hd = document.getElementById('sd-head');
    if (hd && hd.parentNode === root) return;
    if (hd) hd.remove();
    const logo = o.logo || {};
    const menu = (o.menu || []).map(m => `<a href="${esc(m.href)}"${/^https?:/.test(m.href) ? ' target="_blank" rel="noopener"' : ''}${m.aktif ? ' class="on" aria-current="page"' : ''}>${esc(m.label)}</a>`).join('');
    hd = document.createElement('header'); hd.id = 'sd-head';
    hd.innerHTML = `<button type="button" class="sd-menu" aria-label="Buka daftar bab">☰</button>
<a class="sd-logo" href="${esc(logo.href || '#/' + (first ? first.url : ''))}" aria-label="${esc(logo.teks || o.judul || 'Beranda')}, beranda">${logo.svg != null ? logo.svg : LOGO}<span>${esc(logo.teks || o.judul || '')}</span></a>
${o.versi !== false ? `<span class="sd-ver">${esc(o.versi || Slak.version || '')}</span>` : ''}
${o.cari !== false ? `<label><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" aria-label="Cari dokumentasi" placeholder="${esc(o.cari_label || 'Cari dokumentasi')}"><kbd>Ctrl K</kbd></label>` : ''}
<nav aria-label="Utama">${menu}<button type="button" class="sd-tema" aria-label="Ganti tema terang atau gelap"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></nav>`;
    root.prepend(hd);
    const inp = hd.querySelector('input');
    if (inp) {
      const go = () => { const v = inp.value; inp.value = ''; inp.blur(); openCari(v); };
      inp.addEventListener('focus', go); inp.addEventListener('input', go);
    }
    hd.querySelector('.sd-tema').addEventListener('click', () => {
      // Terang <-> gelap langsung (tanpa langkah "otomatis"), disimpan seperti tombol tema Slak.
      const cur = root.dataset.theme, gelap = cur === 'dark' || (cur !== 'light' && global.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
      const next = gelap ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('slak-theme', next); } catch (e) { /* abaikan */ }
      root.querySelectorAll('.slak-chart,.slak-ext-chart,.slak-map').forEach(c => c.dispatchEvent(new Event('slak-theme')));
    });
    hd.querySelector('.sd-menu').addEventListener('click', () => { const b = root.querySelector('.slak-sb-open'); if (b) b.click(); });
  }

  /* ---------- meta halaman ---------- */
  function setMeta(attr, key, val) {
    let m = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (val == null || val === '') { if (m) m.remove(); return; }
    if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); document.head.append(m); }
    m.setAttribute('content', String(val));
  }
  function meta(o) {
    o = o || {};
    if (!hasDoc) return null;
    const judul = o.judul || document.title;
    setMeta('name', 'description', o.deskripsi);
    setMeta('property', 'og:title', judul);
    setMeta('property', 'og:description', o.deskripsi);
    const abs = u => { try { return new URL(u, location.href).href; } catch (e) { return u; } };
    setMeta('property', 'og:image', o.gambar ? abs(o.gambar) : null);
    setMeta('name', 'twitter:card', o.gambar ? 'summary_large_image' : 'summary');
    let href = null;
    if (o.kanonik === false) href = null;
    else if (typeof o.kanonik === 'string' && /^https?:/.test(o.kanonik)) href = o.kanonik;
    else if (/^https?:$/.test(location.protocol)) href = String(typeof o.kanonik === 'string' ? o.kanonik : S.kanonik).replace(/\/$/, '') + location.pathname;
    let link = document.head.querySelector('link[rel="canonical"]');
    if (href) { if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.append(link); } link.href = href; }
    return { judul, deskripsi: o.deskripsi || '', gambar: o.gambar || '', kanonik: href || (link && link.href) || '' };
  }

  /* ---------- seluruh situs ---------- */
  const keyOf = p => p.berkas || (p.elemen ? '#' + p.elemen : '') || p.url || p.judul;
  async function textOf(p) {
    if (p.isi != null) return String(p.isi);
    if (p.elemen) { const el = hasDoc && document.getElementById(p.elemen); if (!el) throw new Error(`Elemen #${p.elemen} untuk bab "${p.judul}" tidak ditemukan.`); return (el.value != null ? el.value : el.textContent).replace(/<\\\/script/gi, '<' + '/script'); }
    if (p.berkas) {
      const k = keyOf(p);
      if (S.texts.has(k)) return S.texts.get(k);
      try {
        const b = await Slak.load_file(p.berkas, { pick: false });
        const t = new TextDecoder('utf-8').decode(b).replace(/^﻿/, '');
        S.texts.set(k, t); return t;
      } catch (e) {
        const lokal = hasDoc && location.protocol === 'file:';
        throw new Error(`Bab "${p.judul}" tidak bisa dibaca dari ${p.berkas}` + (lokal ? `. Saat dibuka dengan klik dua kali, taruh ${p.berkas}.js (hasil Bungkus data di Slak Studio) di sebelah ${p.berkas}, atau buka situs lewat server.` : ` (${e.message}).`));
      }
    }
    return '';
  }
  async function site(sl, o) {
    need(sl, 'site'); o = o || {};
    S.jernih = o.tampilan === 'jernih';
    css(); wireCopy();
    S.site = o;
    if (o.kanonik != null && o.kanonik !== false) S.kanonik = String(o.kanonik);
    const groups = Array.isArray(o.bab) ? { '': o.bab } : (o.bab || {});
    const flat = [], sections = {};
    let first = true;
    for (const [g, list] of Object.entries(groups)) {
      sections[g] = [];
      for (const p of [].concat(list)) {
        const rec = Object.assign({ grup: g }, p);
        rec.url = rec.url || slug(rec.judul);
        rec.halaman = sl.page(rec.judul, (s) => halaman(s, rec, flat, o), { icon: rec.ikon, url: rec.url, default: first });
        first = false;
        flat.push(rec); sections[g].push(rec.halaman);
      }
    }
    S.pages = flat;
    S.sig = (o.versi_isi || Slak.version || '') + '|' + flat.map(keyOf).join(',');
    if (S.jernih) head(o, flat[0]);
    const nav = sl.navigation(Object.keys(sections).length === 1 && sections[''] ? sections[''] : sections, { position: 'sidebar' });
    if (o.cari !== false) {
      if (S.jernih) wireKey();
      else {
        const web = hasDoc && /^https?:$/.test(location.protocol);
        await Promise.all(flat.filter(p => !S.texts.has(keyOf(p)) && (p.isi != null || p.elemen || (p.berkas && web)))
          .map(p => textOf(p).then(t => S.texts.set(keyOf(p), t), () => {})));
        search(sl, flat.map(p => Object.assign({}, p, { teks: S.texts.get(keyOf(p)) || '' })));
      }
    }
    return nav.run();
  }
  async function halaman(s, rec, flat, o) {
    if (hasDoc && o.judul) document.title = rec.polos ? (o.judul_beranda || o.judul) : rec.judul + ' · ' + o.judul;
    meta({ judul: rec.judul + (o.judul ? ' · ' + o.judul : ''), deskripsi: rec.deskripsi || o.deskripsi, gambar: rec.gambar || o.gambar, kanonik: o.kanonik });
    const J = S.jernih, fn = typeof rec.fungsi === 'function';
    if (fn) { S.headings = []; await rec.fungsi(s); }
    else {
      let t = '';
      try { t = await textOf(rec); } catch (e) { s.error(e.message); }
      const own = /^\s*#\s/.test(t);
      if (J) {
        if (rec.grup) s.html(`<nav class="sd-crumb" aria-label="Jejak">${esc(rec.grup)} <span aria-hidden="true">›</span> ${esc(rec.judul)}</nav>`);
        if (!own) s.title(rec.judul);
        if (rec.ringkas) { s.html('<span class="sd-mark sd-lead-m"></span>'); s.markdown(rec.ringkas); }
        const hs = headsOf(t).filter(h => h.level >= 2 && h.level <= 3);
        if (o.toc !== false && hs.length >= 2) s.html(`<details class="sd-tocin"><summary>Di halaman ini</summary>${tocHTML(hs, 'Di halaman ini')}</details>`);
      }
      await markdown(s, t, Object.assign({}, o, { lead: J && !rec.ringkas }));
    }
    const list = flat.filter(p => typeof p.fungsi !== 'function' || p.urut), i = list.indexOf(rec), prev = i >= 0 ? list[i - 1] : null, next = i >= 0 ? list[i + 1] : null;
    if (J) {
      if (!rec.polos && (prev || next)) s.html(`<nav class="sd-pn" aria-label="Halaman sebelum dan sesudah">${prev ? `<a href="#/${esc(prev.url)}"><small>Sebelumnya</small><b>${esc(prev.judul)}</b></a>` : '<span></span>'}${next ? `<a class="nx" href="#/${esc(next.url)}"><small>Berikutnya</small><b>${esc(next.judul)}</b></a>` : ''}</nav>`);
      const src = rec.sumber || (rec.berkas ? (typeof o.sumber === 'function' ? o.sumber(rec) : (o.sumber || '') + rec.berkas) : '');
      if (src && !rec.polos) s.html(`<p class="sd-src"><a href="${esc(src)}" target="_blank" rel="noopener">${esc(o.sumber_label || 'Lihat kode halaman ini')}</a></p>`);
      if (o.kaki) s.html(`<footer class="sd-foot">${/</.test(o.kaki) ? o.kaki : esc(o.kaki)}</footer>`);
    } else {
      if (prev || next) {
        s.divider();
        const [a, b] = s.columns(2);
        if (prev) a.page_link(prev.halaman, { label: '← ' + prev.judul });
        if (next) b.page_link(next.halaman, { label: next.judul + ' →' });
      }
      if (o.kaki) s.caption(o.kaki);
    }
    if (o.toc !== false) toc(s);
    if (S.goto && hasDoc) { const id = S.goto; S.goto = null; setTimeout(() => scrollToId(id), 60); }
  }

  Slak.docs = { version: '0.2.0', site, markdown, toc, search, meta, _parse: parse, _find: find, _index: buildIndex };
})(typeof window !== 'undefined' ? window : globalThis);
