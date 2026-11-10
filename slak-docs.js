/*! slak-docs.js 0.1.0 - berkas tambahan Slak 1.9.1 untuk situs dokumentasi. Lisensi MIT.
 *
 * Muat sesudah slak.js. Semua fungsi ada di Slak.docs dan menerima `sl` sebagai argumen pertama;
 * berkas ini tidak menambah nama apa pun ke `sl`, jadi janji API stabil Slak 1.9 tetap terjaga.
 *
 *   Slak.docs.site(sl, { judul, bab })   satu panggilan untuk seluruh situs: menu berkelompok,
 *                                        alamat per halaman, Sebelumnya/Berikutnya, daftar isi, pencarian
 *   Slak.docs.markdown(sl, teks)         isi bab; blok ```slak dijalankan dan hasilnya tampil di bawahnya
 *   Slak.docs.toc(sl)                    daftar isi "Di halaman ini" dari judul bab
 *   Slak.docs.search(sl, halaman)        tombol Cari (Ctrl+K) untuk seluruh situs
 *   Slak.docs.meta({ deskripsi, gambar, kanonik })   deskripsi, gambar pratinjau, dan alamat kanonik
 *
 * Isi bab bisa ditulis di halaman dalam blok <script type="text/markdown" id="bab-1">, lalu { elemen: "bab-1" }.
 * Di dalam blok itu, tulis <\/script> bila isi bab memuat tag penutup script. Cara ini juga jalan saat halaman dibuka dengan klik dua kali.
 */
(function (global) {
  'use strict';
  const Slak = global.Slak;
  if (!Slak) throw new Error('slak-docs.js harus dimuat sesudah slak.js.');
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  const S = { kanonik: 'https://slak.studio', site: null, headings: [], pages: [], index: null, texts: new Map() };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bagian';
  const isSl = sl => sl && typeof sl.write === 'function' && typeof sl.markdown === 'function';
  const need = (sl, fn) => { if (!isSl(sl)) throw new Error(`Slak.docs.${fn} butuh sl sebagai argumen pertama, misalnya Slak.docs.${fn}(sl, ...).`); };

  /* ---------- gaya ---------- */
  function css() {
    if (typeof document === 'undefined' || document.getElementById('slak-docs-css')) return;
    const st = document.createElement('style'); st.id = 'slak-docs-css';
    st.textContent = `.sd-toc{font-size:13.5px;line-height:1.45;margin:6px 0 2px}.sd-toc b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px}
.sd-toc a{display:block;padding:3px 0 3px 10px;border-left:2px solid var(--line);color:var(--muted);text-decoration:none}.sd-toc a.lv3{padding-left:22px}
.sd-toc a:hover{color:var(--text)}.sd-toc a.on{border-left-color:var(--accent);color:var(--accent-ink,var(--accent));font-weight:600}
.sd-toc a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.sd-hit-s{font-size:13px;color:var(--muted);margin:-4px 0 10px}.sd-hit-s mark{background:color-mix(in srgb,var(--accent) 22%,transparent);color:inherit;border-radius:3px}
.sd-out{font-size:12px;color:var(--muted);margin:-6px 0 4px}`;
    document.head.append(st);
  }

  /* ---------- bab: Markdown dengan blok yang dijalankan ---------- */
  function parse(teks) {
    const out = [], lines = String(teks || '').replace(/\r\n?/g, '\n').split('\n'), used = new Map();
    let buf = [];
    const flush = () => { const t = buf.join('\n').trim(); if (t) out.push({ t: 'md', text: t }); buf = []; };
    const uid = s => { const b = slug(s); const n = (used.get(b) || 0) + 1; used.set(b, n); return n > 1 ? b + '-' + n : b; };
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i], f = /^(```|~~~)\s*([\w-]*)\s*(.*)$/.exec(L);
      if (f) {
        flush();
        const code = []; i++;
        while (i < lines.length && !lines[i].startsWith(f[1])) code.push(lines[i++]);
        const lang = (f[2] || '').toLowerCase(), src = code.join('\n');
        if (lang === 'slak') out.push({ t: /tanpa-jalan|norun/.test(f[3]) ? 'code' : 'run', code: src, lang: 'javascript' });
        else out.push({ t: 'code', code: src, lang: lang || 'text' });
        continue;
      }
      const h = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(L);
      if (h) { flush(); out.push({ t: 'h', level: h[1].length, text: h[2], id: uid(h[2].replace(/[`*_]/g, '')) }); continue; }
      buf.push(L);
    }
    flush();
    return out;
  }
  function playgroundBase(o) {
    return (o && o.playground) || (S.site && S.site.playground) || Slak.share.official || undefined;
  }
  async function markdown(sl, teks, o) {
    need(sl, 'markdown'); css(); o = o || {};
    const blocks = parse(teks), heads = [];
    for (const b of blocks) {
      if (b.t === 'h') {
        const plain = b.text.replace(/[`*_]/g, '');
        heads.push({ level: b.level, text: plain, id: b.id });
        (b.level === 1 ? sl.title : b.level === 2 ? sl.header : sl.subheader)(b.text, { anchor: b.id });
      } else if (b.t === 'md') sl.markdown(b.text);
      else if (b.t === 'code') sl.code(b.code, { language: b.lang });
      else {
        sl.code(b.code, { language: 'javascript' });
        const box = sl.container({ border: true });
        try { await new AF('sl', b.code)(box); }
        catch (e) { box.error('Contoh ini gagal dijalankan: ' + (e && e.message || e)); }
        if (o.playground !== false) {
          let url = '';
          try { url = await Slak.share.link(b.code, playgroundBase(o)); } catch (e) { /* abaikan */ }
          if (url) sl.html(`<p class="sd-out"><a href="${esc(url)}" target="_blank" rel="noopener">Buka di Playground ↗</a></p>`);
        }
      }
    }
    S.headings = heads;
    return heads;
  }

  /* ---------- daftar isi ---------- */
  let tocWired = false;
  function wireToc() {
    if (tocWired || typeof document === 'undefined') return; tocWired = true;
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[data-sd-toc]');
      if (!a) return;
      e.preventDefault();
      const el = document.getElementById(a.getAttribute('data-sd-toc'));
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
    });
    let raf = 0;
    const mark = () => {
      raf = 0;
      const links = document.querySelectorAll('a[data-sd-toc]'); if (!links.length) return;
      let cur = null;
      for (const a of links) { const el = document.getElementById(a.getAttribute('data-sd-toc')); if (el && el.getBoundingClientRect().top < 120) cur = a; }
      for (const a of links) { a.classList.toggle('on', a === (cur || links[0])); if (a === (cur || links[0])) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }
    };
    document.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(mark); }, true);
    setInterval(mark, 1500);
  }
  function toc(sl, o) {
    need(sl, 'toc'); css(); wireToc(); o = o || {};
    const hs = (o.headings || S.headings).filter(h => h.level >= 2 && h.level <= 3);
    if (hs.length < (o.min || 2)) return null;
    const where = o.where || sl.sidebar;
    return where.html(`<nav class="sd-toc" aria-label="Di halaman ini"><b>${esc(o.label || 'Di halaman ini')}</b>${hs.map(h => `<a href="#${esc(h.id)}" data-sd-toc="${esc(h.id)}" class="lv${h.level}">${esc(h.text)}</a>`).join('')}</nav>`);
  }

  /* ---------- pencarian ---------- */
  function buildIndex(pages) {
    const idx = [];
    for (const p of pages) {
      const text = p.teks || '';
      let cur = { bagian: '', id: '', teks: [] };
      const push = () => { const t = cur.teks.join(' ').replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`>|[\]()]/g, ' ').replace(/\s+/g, ' ').trim(); if (t || cur.bagian) idx.push({ page: p, judul: p.judul, bagian: cur.bagian, id: cur.id, teks: t, low: (p.judul + ' ' + cur.bagian + ' ' + t).toLowerCase() }); };
      for (const b of parse(text)) {
        if (b.t === 'h' && b.level >= 2) { push(); cur = { bagian: b.text.replace(/[`*_]/g, ''), id: b.id, teks: [] }; }
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
  function search(sl, halaman, o) {
    need(sl, 'search'); css(); o = o || {};
    const pages = (halaman || S.pages).map(p => Object.assign({}, p, { teks: p.teks != null ? p.teks : S.texts.get(p) || '' }));
    const idx = buildIndex(pages);
    S.index = idx;
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
    if (!keyWired && typeof document !== 'undefined') {
      keyWired = true;
      document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
          const b = [...document.querySelectorAll('button')].find(x => /Cari\s+\(Ctrl\+K\)/.test(x.textContent));
          if (b) { e.preventDefault(); b.click(); }
        }
      });
    }
    return { find: q => find(q, idx, o.max), size: idx.length };
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
    if (typeof document === 'undefined') return null;
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
  async function textOf(p) {
    if (p.isi != null) return String(p.isi);
    if (p.elemen) { const el = typeof document !== 'undefined' && document.getElementById(p.elemen); if (!el) throw new Error(`Elemen #${p.elemen} untuk bab "${p.judul}" tidak ditemukan.`); return (el.value != null ? el.value : el.textContent).replace(/<\\\/script/gi, '<' + '/script'); }
    if (p.berkas) {
      if (S.texts.has(p)) return S.texts.get(p);
      try { const r = await fetch(p.berkas); if (!r.ok) throw new Error('HTTP ' + r.status); const t = await r.text(); S.texts.set(p, t); return t; }
      catch (e) {
        const lokal = typeof location !== 'undefined' && location.protocol === 'file:';
        throw new Error(`Bab "${p.judul}" tidak bisa dibaca dari ${p.berkas}` + (lokal ? '. Halaman yang dibuka dengan klik dua kali tidak boleh membaca berkas lain; taruh isi bab di <script type="text/markdown" id="..."> lalu pakai { elemen: "..." }, atau buka situs lewat server.' : ` (${e.message}).`));
      }
    }
    return '';
  }
  async function site(sl, o) {
    need(sl, 'site'); css(); o = o || {};
    S.site = o;
    if (o.kanonik != null && o.kanonik !== false) S.kanonik = String(o.kanonik);
    const groups = Array.isArray(o.bab) ? { '': o.bab } : (o.bab || {});
    const flat = [], sections = {};
    let first = true;
    for (const [g, list] of Object.entries(groups)) {
      sections[g] = [];
      for (const p of [].concat(list)) {
        const rec = Object.assign({}, p);
        rec.halaman = sl.page(rec.judul, async (s) => {
          meta({ judul: rec.judul + (o.judul ? ' · ' + o.judul : ''), deskripsi: rec.deskripsi || o.deskripsi, gambar: rec.gambar || o.gambar, kanonik: o.kanonik });
          if (typeof rec.fungsi === 'function') { S.headings = []; await rec.fungsi(s); }
          else { let t = ''; try { t = await textOf(rec); } catch (e) { s.error(e.message); } await markdown(s, t, o); }
          const i = flat.indexOf(rec), prev = flat[i - 1], next = flat[i + 1];
          if (prev || next) {
            s.divider();
            const [a, b] = s.columns(2);
            if (prev) a.page_link(prev.halaman, { label: '← ' + prev.judul });
            if (next) b.page_link(next.halaman, { label: next.judul + ' →' });
          }
          if (o.kaki) s.caption(o.kaki);
          if (o.toc !== false) toc(s);
        }, { icon: rec.ikon, url: rec.url || slug(rec.judul), default: first });
        first = false;
        flat.push(rec); sections[g].push(rec.halaman);
      }
    }
    S.pages = flat;
    const nav = sl.navigation(Object.keys(sections).length === 1 && sections[''] ? sections[''] : sections, { position: 'sidebar' });
    if (o.cari !== false) {
      const web = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
      await Promise.all(flat.filter(p => !S.texts.has(p) && (p.isi != null || p.elemen || (p.berkas && web)))
        .map(p => textOf(p).then(t => S.texts.set(p, t), () => {})));
      search(sl, flat.map(p => Object.assign({}, p, { teks: S.texts.get(p) || '' })));
    }
    return nav.run();
  }

  Slak.docs = { version: '0.1.0', site, markdown, toc, search, meta, _parse: parse, _find: find, _index: buildIndex };
})(typeof window !== 'undefined' ? window : globalThis);
