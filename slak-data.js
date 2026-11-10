/*!
 * Slak Data 1.2 — alat analisis data untuk Slak.
 * Kode Slak berlisensi MIT, (c) 2026 Para pengembang Slak. Lihat berkas LICENSE.
 * Pasang sesudah slak.js:
 *   <script src="slak.js"></script>
 *   <script src="slak-data.js"></script>
 *
 * Filosofi: WRITE AND RUN — tanpa build, tanpa compile, tanpa npm install.
 * Satu berkas, tanpa dependensi, berjalan saat dibuka dengan klik dua kali.
 * Ditulis dari nol untuk Slak. Nama fungsi dibuat mirip pandas, scipy, dan
 * scikit-learn agar mudah berpindah ke Python di kemudian hari.
 */
(function (global) {
  'use strict';
  /* Pengganti Math.max(...larik): spread gagal ("Maximum call stack") di atas ~120 ribu nilai. */
  function maxOf(a) { let m = -Infinity; for (const v of a) m = Math.max(m, v); return m; }
  function minOf(a) { let m = Infinity; for (const v of a) m = Math.min(m, v); return m; }
  function pushAll(t, a) { for (const v of a) t.push(v); return t.length; }

  const Slak = global.Slak;
  if (!Slak || typeof Slak.extend !== 'function') {
    console.error('Slak Data butuh slak.js versi 1.2 atau lebih baru. Pasang <script src="slak.js"></script> lebih dulu.');
    return;
  }
  const I = Slak.internals();
  const { h, esc, isNum, fmtNum, fmtCat, parseCSV } = I;

  /* ======================================================================
   * Utilitas
   * ==================================================================== */

  const isNA = v => v == null || (typeof v === 'number' && isNaN(v)) || (v instanceof Date && isNaN(v));
  const isDate = v => v instanceof Date && !isNaN(v);
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const keyOf = v => v instanceof Date ? 'd:' + v.getTime() : (typeof v) + ':' + String(v);
  const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
  const fail = msg => { throw new Error(msg); };
  const round = (v, d) => { const p = Math.pow(10, d == null ? 0 : d); return Math.round(v * p) / p; };

  // Collator disimpan sekali: localeCompare dengan opsi membuat collator baru di setiap panggilan (sangat lambat)
  const COLL = typeof Intl !== 'undefined' ? new Intl.Collator(undefined, { numeric: true }) : null;
  function cmpVal(a, b) {
    const na = isNA(a), nb = isNA(b);
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (a instanceof Date && b instanceof Date) return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
    if (a === b) return 0;
    return COLL ? COLL.compare(String(a), String(b)) : String(a).localeCompare(String(b), undefined, { numeric: true });
  }

  function rng(seed) {
    let s = (seed == null ? Math.floor(Math.random() * 2147483646) : Math.floor(Math.abs(seed))) % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function shuffleIdx(n, rand) {
    const a = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function suggest(name, list) {
    const n = String(name).toLowerCase();
    let best = null, bd = Infinity;
    for (const c of list) {
      const d = lev(n, String(c).toLowerCase());
      if (d < bd) { bd = d; best = c; }
    }
    return best != null && bd <= Math.max(2, n.length / 3) ? best : null;
  }
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  /* ---------- Angka & tanggal dari teks (ramah format Indonesia) ---------- */

  function toNumber(v, o) {
    o = o || {};
    if (isNA(v)) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.getTime();
    let s = String(v).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    const rupiah = /^(rp\.?|idr)\s*|\s*(rp|idr)$/i.test(s);
    s = s.replace(/^(rp\.?|idr|usd|\$|€|£)\s*/i, '').replace(/\s*(rp|idr|%)$/i, '').replace(/[\s ]/g, '');
    if (/^-/.test(s)) { neg = !neg; s = s.slice(1); }
    if (/^\+/.test(s)) s = s.slice(1);
    let dec = o.decimal;
    if (!dec) {
      const hasDot = s.includes('.'), hasComma = s.includes(',');
      if (hasDot && hasComma) dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
      else if (hasComma) dec = (s.match(/,/g).length > 1 || /^\d{1,3},\d{3}$/.test(s)) ? '.' : ',';
      else if (hasDot) dec = s.match(/\./g).length > 1 || (rupiah && /^\d{1,3}\.\d{3}$/.test(s)) ? ',' : '.';   // "Rp 12.500" = dua belas ribu lima ratus
      else dec = '.';
    }
    const th = dec === ',' ? '.' : ',';
    s = s.split(th).join('');
    if (dec === ',') s = s.replace(',', '.');
    if (!/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) {
      if (o.errors === 'raise') fail(`"${v}" bukan angka.`);
      return null;
    }
    const n = Number(s);
    return neg ? -n : n;
  }

  const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const MONTH = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const NAMA_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  function monthIndex(t) {
    t = t.toLowerCase().replace(/\.$/, '');
    if (t === 'agt' || t === 'ags') return 7;
    if (t === 'okt') return 9;
    if (t === 'des') return 11;
    if (t === 'mei') return 4;
    for (let i = 0; i < 12; i++) if (BULAN[i].startsWith(t) || MONTH[i].startsWith(t)) return t.length >= 3 ? i : -1;
    return -1;
  }
  function mkDate(y, m, d, H, M, S) {
    if (y < 100) y += y < 70 ? 2000 : 1900;
    const dt = new Date(y, m, d, H || 0, M || 0, S || 0);
    if (dt.getMonth() !== ((m % 12) + 12) % 12 && d <= 31) return null;
    return dt;
  }

  function parseWithFormat(s, fmt) {
    const parts = { y: 1970, m: 0, d: 1, H: 0, M: 0, S: 0 };
    let re = '';
    const order = [];
    for (let i = 0; i < fmt.length; i++) {
      const c = fmt[i];
      if (c === '%' && i + 1 < fmt.length) {
        const k = fmt[++i];
        const map = { Y: '(\\d{4})', y: '(\\d{2})', m: '(\\d{1,2})', d: '(\\d{1,2})', H: '(\\d{1,2})', M: '(\\d{1,2})', S: '(\\d{1,2})', b: '([A-Za-z]+\\.?)', B: '([A-Za-z]+)' };
        if (!map[k]) { re += k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
        re += map[k]; order.push(k);
      } else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const m = String(s).trim().match(new RegExp('^' + re + '$'));
    if (!m) return null;
    order.forEach((k, i) => {
      const v = m[i + 1];
      if (k === 'Y') parts.y = +v; else if (k === 'y') parts.y = +v + (+v < 70 ? 2000 : 1900);
      else if (k === 'm') parts.m = +v - 1; else if (k === 'd') parts.d = +v;
      else if (k === 'H') parts.H = +v; else if (k === 'M') parts.M = +v; else if (k === 'S') parts.S = +v;
      else parts.m = monthIndex(v);
    });
    if (parts.m < 0) return null;
    return mkDate(parts.y, parts.m, parts.d, parts.H, parts.M, parts.S);
  }

  function toDate(v, o) {
    o = o || {};
    if (isNA(v)) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === 'number') {
      if (o.unit === 'excel' || o.origin === 'excel') return excelDate(v);
      if (o.unit === 's') return new Date(v * 1000);
      if (o.unit === 'D' || o.unit === 'days') return new Date(v * 86400000);
      if (v > 1000 && v < 3000 && Number.isInteger(v) && !o.unit) return new Date(v, 0, 1);
      return new Date(v);
    }
    const s = String(v).trim();
    if (!s) return null;
    if (o.format) return parseWithFormat(s, o.format);
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/))) return mkDate(+m[1], +m[2] - 1, +m[3], +m[4] || 0, +m[5] || 0, +m[6] || 0);
    if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) { const d = new Date(s); return isNaN(d) ? null : d; }
    if ((m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/))) return mkDate(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T](\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?$/))) {
      const dayfirst = o.dayfirst !== false;
      const a = +m[1], b = +m[2];
      const [d, mo] = dayfirst ? (b > 12 && a <= 12 ? [b, a] : [a, b]) : (a > 12 && b <= 12 ? [a, b] : [b, a]);
      return mkDate(+m[3], mo - 1, d, +m[4] || 0, +m[5] || 0, +m[6] || 0);
    }
    if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) return mkDate(+m[1], +m[2] - 1, 1);
    if ((m = s.match(/^(\d{4})$/))) return mkDate(+m[1], 0, 1);
    if ((m = s.match(/^(?:[A-Za-z]+,?\s+)?(\d{1,2})\s+([A-Za-z]+\.?)\s+(\d{2,4})(?:\s+(\d{1,2})[:.](\d{2}))?$/))) {
      const mi = monthIndex(m[2]); if (mi >= 0) return mkDate(+m[3], mi, +m[1], +m[4] || 0, +m[5] || 0);
    }
    if ((m = s.match(/^([A-Za-z]+\.?)\s+(\d{1,2}),?\s+(\d{4})$/))) { const mi = monthIndex(m[1]); if (mi >= 0) return mkDate(+m[3], mi, +m[2]); }
    if ((m = s.match(/^([A-Za-z]+\.?)[\s-]+(\d{4})$/))) { const mi = monthIndex(m[1]); if (mi >= 0) return mkDate(+m[2], mi, 1); }
    if ((m = s.match(/^(\d{4})[- ]?Q([1-4])$/i))) return mkDate(+m[1], (+m[2] - 1) * 3, 1);
    if (o.errors === 'raise') fail(`"${s}" tidak dikenali sebagai tanggal. Coba beri format, misalnya { format: "%d/%m/%Y" }.`);
    return null;
  }

  function excelDate(serial) {
    if (!isNum(serial)) return null;
    const ms = Math.round(serial * 86400000);
    const u = new Date(Date.UTC(1899, 11, 30) + ms);
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
  }
  function toExcelSerial(d) {
    const u = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
    return (u - Date.UTC(1899, 11, 30)) / 86400000;
  }

  const pad2 = n => String(n).padStart(2, '0');
  function strftime(d, fmt) {
    if (!isDate(d)) return null;
    return fmt.replace(/%([YymdHMSbBaAjqUV%])/g, (_, k) => {
      switch (k) {
        case 'Y': return String(d.getFullYear());
        case 'y': return pad2(d.getFullYear() % 100);
        case 'm': return pad2(d.getMonth() + 1);
        case 'd': return pad2(d.getDate());
        case 'H': return pad2(d.getHours());
        case 'M': return pad2(d.getMinutes());
        case 'S': return pad2(d.getSeconds());
        case 'b': return NAMA_BULAN[d.getMonth()].slice(0, 3);
        case 'B': return NAMA_BULAN[d.getMonth()];
        case 'a': return NAMA_HARI[(d.getDay() + 6) % 7].slice(0, 3);
        case 'A': return NAMA_HARI[(d.getDay() + 6) % 7];
        case 'j': return String(dayOfYear(d)).padStart(3, '0');
        case 'q': return String(Math.floor(d.getMonth() / 3) + 1);
        case 'U': case 'V': return pad2(isoWeek(d).week);
        default: return '%';
      }
    });
  }
  function dayOfYear(d) { return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1; }
  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }

  /* Awal periode: D, W (minggu mulai Senin), M, Q, Y, H (jam) */
  function freqOf(f) {
    const s = String(f || 'M').toUpperCase().replace(/^(MS|ME)$/, 'M').replace(/^(QS|QE)$/, 'Q').replace(/^(YS|YE|AS|A)$/, 'Y');
    const map = { HARI: 'D', HARIAN: 'D', MINGGU: 'W', MINGGUAN: 'W', BULAN: 'M', BULANAN: 'M', KUARTAL: 'Q', TRIWULAN: 'Q', TAHUN: 'Y', TAHUNAN: 'Y', JAM: 'H', DAY: 'D', WEEK: 'W', MONTH: 'M', QUARTER: 'Q', YEAR: 'Y', HOUR: 'H' };
    const k = map[s] || s.replace(/^W-.*$/, 'W');
    if (!/^[DWMQYH]$/.test(k)) fail(`Frekuensi "${f}" tidak dikenal. Gunakan "D" (hari), "W" (minggu), "M" (bulan), "Q" (kuartal), atau "Y" (tahun).`);
    return k;
  }
  function periodStart(d, f) {
    if (!isDate(d)) return null;
    switch (f) {
      case 'H': return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours());
      case 'D': return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      case 'W': { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
      case 'M': return new Date(d.getFullYear(), d.getMonth(), 1);
      case 'Q': return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
      case 'Y': return new Date(d.getFullYear(), 0, 1);
    }
    return d;
  }
  function addPeriod(d, f, k) {
    const x = new Date(d);
    switch (f) {
      case 'H': x.setHours(x.getHours() + k); break;
      case 'D': x.setDate(x.getDate() + k); break;
      case 'W': x.setDate(x.getDate() + 7 * k); break;
      case 'M': case 'Q': case 'Y': {
        // seperti pandas DateOffset: 31 Jan + 1 bulan = 29 Feb (bukan 2 Maret)
        const m = x.getMonth() + (f === 'M' ? k : f === 'Q' ? 3 * k : 12 * k), day = x.getDate();
        x.setDate(1); x.setMonth(m);
        x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
        break;
      }
    }
    return x;
  }
  function periodDiff(a, b, f) {
    if (f === 'M') return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
    if (f === 'Q') return (b.getFullYear() - a.getFullYear()) * 4 + Math.floor(b.getMonth() / 3) - Math.floor(a.getMonth() / 3);
    if (f === 'Y') return b.getFullYear() - a.getFullYear();
    const ms = { D: 86400000, W: 604800000, H: 3600000 }[f];
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate(), b.getHours()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate(), a.getHours())) / ms);
  }
  function periodLabel(d, f) {
    if (!isDate(d)) return null;
    if (f === 'M') return strftime(d, '%Y-%m');
    if (f === 'Q') return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
    if (f === 'Y') return String(d.getFullYear());
    if (f === 'W') { const w = isoWeek(d); return w.year + '-W' + pad2(w.week); }
    if (f === 'H') return strftime(d, '%Y-%m-%d %H:00');
    return strftime(d, '%Y-%m-%d');
  }

  /* ---------- Statistik dasar untuk larik (mengabaikan nilai kosong) ---------- */

  const numsOf = a => { const o = []; for (const v of a) if (typeof v === 'number' && isFinite(v)) o.push(v); else if (typeof v === 'boolean') o.push(+v); return o; };
  const A = {
    sum: a => { let s = 0; for (const v of a) if (typeof v === 'number' && isFinite(v)) s += v; else if (typeof v === 'boolean') s += +v; return s; },
    count: a => { let c = 0; for (const v of a) if (!isNA(v)) c++; return c; },
    size: a => a.length,
    mean: a => { let s = 0, c = 0; for (const v of a) if (typeof v === 'number' && isFinite(v)) { s += v; c++; } else if (typeof v === 'boolean') { s += +v; c++; } return c ? s / c : null; },
    min: a => { let m = null; for (const v of a) if (!isNA(v) && (m === null || cmpVal(v, m) < 0)) m = v; return m; },
    max: a => { let m = null; for (const v of a) if (!isNA(v) && (m === null || cmpVal(v, m) > 0)) m = v; return m; },
    median: a => quant(numsOf(a).sort((x, y) => x - y), 0.5),
    var: (a, ddof = 1) => { const x = numsOf(a), n = x.length; if (n - ddof <= 0) return null; const m = x.reduce((p, q) => p + q, 0) / n; let s = 0; for (const v of x) s += (v - m) * (v - m); return s / (n - ddof); },
    std: (a, ddof = 1) => { const v = A.var(a, ddof); return v == null ? null : Math.sqrt(v); },
    sem: a => { const x = numsOf(a); const s = A.std(x); return s == null ? null : s / Math.sqrt(x.length); },
    nunique: a => { const s = new Set(); for (const v of a) if (!isNA(v)) s.add(keyOf(v)); return s.size; },
    first: a => { for (const v of a) if (!isNA(v)) return v; return null; },
    last: a => { for (let i = a.length - 1; i >= 0; i--) if (!isNA(a[i])) return a[i]; return null; },
    prod: a => { let p = 1; for (const v of a) if (typeof v === 'number' && isFinite(v)) p *= v; return p; },
    mode: a => { const m = new Map(); let best = null, bc = 0; for (const v of a) { if (isNA(v)) continue; const k = keyOf(v); const c = (m.get(k) || 0) + 1; m.set(k, c); if (c > bc || (c === bc && cmpVal(v, best) < 0)) { bc = c; best = v; } } return best; },
    range: a => { const x = numsOf(a); return x.length ? maxOf(x) - minOf(x) : null; },
    skew: a => { const x = numsOf(a), n = x.length; if (n < 3) return null; const m = x.reduce((p, q) => p + q, 0) / n; let m2 = 0, m3 = 0; for (const v of x) { const d = v - m; m2 += d * d; m3 += d * d * d; } m2 /= n; m3 /= n; if (!m2) return 0; return Math.sqrt(n * (n - 1)) / (n - 2) * m3 / Math.pow(m2, 1.5); },
    kurt: a => { const x = numsOf(a), n = x.length; if (n < 4) return null; const m = x.reduce((p, q) => p + q, 0) / n; let m2 = 0, m4 = 0; for (const v of x) { const d = v - m; m2 += d * d; m4 += d * d * d * d; } m2 /= n; m4 /= n; if (!m2) return 0; const g2 = m4 / (m2 * m2) - 3; return ((n + 1) * g2 + 6) * (n - 1) / ((n - 2) * (n - 3)); },
    unique: a => { const s = new Set(), o = []; for (const v of a) { const k = keyOf(v); if (!isNA(v) && !s.has(k)) { s.add(k); o.push(v); } } return o; },
    list: a => a.slice(),
    cv: a => { const m = A.mean(a), s = A.std(a); return m ? s / m : null; },
    any: a => a.some(v => !!v && !isNA(v)),
    all: a => a.every(v => !!v || isNA(v))
  };
  function quant(sorted, p) {
    if (!sorted.length) return null;
    const k = (sorted.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo);
  }
  const AGG_ALIAS = { average: 'mean', avg: 'mean', 'rata-rata': 'mean', rata: 'mean', jumlah: 'sum', total: 'sum', banyak: 'count', terkecil: 'min', terbesar: 'max', nilai_tengah: 'median', median: 'median', stdev: 'std', variance: 'var', distinct: 'nunique', count_distinct: 'nunique', len: 'size' };
  function aggFn(f) {
    if (typeof f === 'function') return a => f(new Series(a));
    const name = AGG_ALIAS[String(f).toLowerCase()] || String(f).toLowerCase();
    let m;
    if ((m = name.match(/^(?:p|q|persentil_?)(\d{1,2})$/))) { const p = +m[1] / 100; return a => quant(numsOf(a).sort((x, y) => x - y), p); }
    if (!A[name]) fail(`Fungsi agregasi "${f}" tidak dikenal. Pilih salah satu: sum, mean, median, min, max, count, size, std, var, nunique, first, last, mode, p90, dan lainnya.`);
    return A[name];
  }
  const aggName = f => typeof f === 'function' ? (f.name || 'fungsi') : (AGG_ALIAS[String(f).toLowerCase()] || String(f).toLowerCase());

  /* ======================================================================
   * Series: satu kolom data
   * ==================================================================== */

  function valsOf(x, n) {
    if (x instanceof Series) return x.values;
    if (Array.isArray(x)) return x;
    return null;
  }

  class Series {
    constructor(values, name, index) {
      this.values = values instanceof Series ? values.values.slice() : Array.isArray(values) ? values : Array.from(values || []);
      this.name = name != null ? name : (values instanceof Series ? values.name : null);
      this.index = index || null;
    }
    get length() { return this.values.length; }
    get size() { return this.values.length; }
    get dtype() { return inferType(this.values); }
    get str() { return new StrAccessor(this); }
    get dt() { return new DtAccessor(this); }
    [Symbol.iterator]() { return this.values[Symbol.iterator](); }
    toJSON() { return this.index ? Object.fromEntries(this.index.map((k, i) => [String(k), this.values[i]])) : this.values; }
    toString() { return `Series(${this.name || ''}, ${this.length} nilai)`; }
    _new(values, name) { return new Series(values, name === undefined ? this.name : name, this.index && values.length === this.values.length ? this.index : null); }

    to_list() { return this.values.slice(); }
    to_array() { return this.values.slice(); }
    tolist() { return this.values.slice(); }
    to_frame(name) { return new DataFrame({ [name || this.name || 'nilai']: this.values.slice() }); }
    to_dict() { return this.toJSON(); }
    copy() { return new Series(this.values.slice(), this.name, this.index && this.index.slice()); }
    rename(n) { return new Series(this.values, n, this.index); }
    get(i) { if (this.index && !isNum(i)) { const k = this.index.indexOf(i); return k < 0 ? undefined : this.values[k]; } return this.values[i < 0 ? this.values.length + i : i]; }
    at(i) { return this.get(i); }
    iloc(i) { return this.values[i < 0 ? this.values.length + i : i]; }
    head(n = 5) { return this._new(this.values.slice(0, n)); }
    tail(n = 5) { return this._new(this.values.slice(Math.max(0, this.values.length - n))); }
    labels() { return this.index ? this.index.slice() : this.values.map((_, i) => i); }
    items() { return this.labels().map((k, i) => [k, this.values[i]]); }

    /* agregasi */
    sum() { return A.sum(this.values); }
    mean() { return A.mean(this.values); }
    median() { return A.median(this.values); }
    min() { return A.min(this.values); }
    max() { return A.max(this.values); }
    count() { return A.count(this.values); }
    std(ddof = 1) { return A.std(this.values, ddofOf(ddof)); }
    var(ddof = 1) { return A.var(this.values, ddofOf(ddof)); }
    sem() { return A.sem(this.values); }
    prod() { return A.prod(this.values); }
    skew() { return A.skew(this.values); }
    kurt() { return A.kurt(this.values); }
    kurtosis() { return this.kurt(); }
    mode() { return A.mode(this.values); }
    nunique() { return A.nunique(this.values); }
    unique() { return A.unique(this.values); }
    quantile(q = 0.5) {
      const s = numsOf(this.values).sort((a, b) => a - b);
      return Array.isArray(q) ? q.map(p => quant(s, p)) : quant(s, q);
    }
    percentile(p) { return Array.isArray(p) ? this.quantile(p.map(x => x / 100)) : this.quantile(p / 100); }
    any() { return A.any(this.values); }
    all() { return A.all(this.values); }
    idxmax() { let b = -1; this.values.forEach((v, i) => { if (!isNA(v) && (b < 0 || cmpVal(v, this.values[b]) > 0)) b = i; }); return b < 0 ? null : this.index ? this.index[b] : b; }
    idxmin() { let b = -1; this.values.forEach((v, i) => { if (!isNA(v) && (b < 0 || cmpVal(v, this.values[b]) < 0)) b = i; }); return b < 0 ? null : this.index ? this.index[b] : b; }
    agg(f) { return Array.isArray(f) ? Object.fromEntries(f.map(g => [aggName(g), aggFn(g)(this.values)])) : aggFn(f)(this.values); }
    aggregate(f) { return this.agg(f); }
    describe() {
      const x = this.values;
      if (!/int|number/.test(inferType(x))) {
        const vc = this.value_counts();
        return new Series([A.count(x), A.nunique(x), vc.length ? vc.get(this.name || 'nilai').values[0] : null, vc.length ? vc.get('jumlah').values[0] : null],
          this.name, ['count', 'unique', 'top', 'freq']);
      }
      const s = numsOf(x).sort((a, b) => a - b);
      return new Series([s.length, A.mean(s), A.std(s), s[0] ?? null, quant(s, 0.25), quant(s, 0.5), quant(s, 0.75), s[s.length - 1] ?? null],
        this.name, ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']);
    }
    value_counts(o) {
      o = o || {};
      const m = new Map();
      for (const v of this.values) {
        if (isNA(v) && o.dropna !== false) continue;
        const k = isNA(v) ? 'na' : keyOf(v);
        const e = m.get(k);
        if (e) e[1]++; else m.set(k, [isNA(v) ? null : v, 1]);
      }
      let rows = [...m.values()];
      if (o.sort !== false) rows.sort((a, b) => o.ascending ? a[1] - b[1] : b[1] - a[1]);
      const tot = rows.reduce((a, b) => a + b[1], 0);
      const name = this.name != null ? String(this.name) : 'nilai';
      const d = { [name]: rows.map(r => r[0]), jumlah: rows.map(r => r[1]) };
      if (o.normalize) d.proporsi = rows.map(r => tot ? r[1] / tot : null);
      if (o.normalize === 'only') { d.jumlah = d.proporsi; delete d.proporsi; }
      return new DataFrame(d);
    }

    /* nilai kosong */
    isna() { return this._new(this.values.map(isNA), this.name); }
    isnull() { return this.isna(); }
    notna() { return this._new(this.values.map(v => !isNA(v)), this.name); }
    notnull() { return this.notna(); }
    dropna() { return new Series(this.values.filter(v => !isNA(v)), this.name); }
    fillna(v, o) {
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && (v.method || v.value !== undefined)) { o = v; v = o.value; }
      const x = this.values;
      if (v === 'ffill' || v === 'pad' || (o && o.method === 'ffill')) { let last = null; return this._new(x.map(a => isNA(a) ? last : (last = a))); }
      if (v === 'bfill' || v === 'backfill' || (o && o.method === 'bfill')) { const out = x.slice(); let nxt = null; for (let i = out.length - 1; i >= 0; i--) { if (isNA(out[i])) out[i] = nxt; else nxt = out[i]; } return this._new(out); }
      if (v === 'mean' || v === 'median' || v === 'mode') { const f = this[v](); return this._new(x.map(a => isNA(a) ? f : a)); }
      if (v === 'interpolate' || v === 'linear') return this.interpolate();
      return this._new(x.map(a => isNA(a) ? (typeof v === 'function' ? v(a) : v) : a));
    }
    interpolate() {
      const x = this.values.slice(), n = x.length;
      let i = 0;
      while (i < n) {
        if (!isNA(x[i])) { i++; continue; }
        let j = i; while (j < n && isNA(x[j])) j++;
        const a = i - 1, b = j;
        if (a >= 0 && b < n && isNum(x[a]) && isNum(x[b])) for (let k = i; k < j; k++) x[k] = x[a] + (x[b] - x[a]) * (k - a) / (b - a);
        i = j;
      }
      return this._new(x);
    }

    /* transformasi */
    map(f) {
      if (typeof f === 'function') return this._new(this.values.map((v, i) => f(v, i)), this.name);
      if (f instanceof Map) return this._new(this.values.map(v => f.has(v) ? f.get(v) : null));
      return this._new(this.values.map(v => Object.prototype.hasOwnProperty.call(f, v) ? f[v] : null));
    }
    apply(f) { return this.map(f); }
    replace(a, b) {
      if (a && typeof a === 'object' && !Array.isArray(a)) return this._new(this.values.map(v => Object.prototype.hasOwnProperty.call(a, v) ? a[v] : v));
      const set = new Set(arr(a).map(keyOf));
      return this._new(this.values.map(v => set.has(keyOf(v)) ? b : v));
    }
    astype(t) { return this._new(castArray(this.values, t)); }
    to_numeric(o) { return this._new(this.values.map(v => toNumber(v, o))); }
    to_datetime(o) { return this._new(this.values.map(v => toDate(v, o))); }
    round(d = 0) { return this._new(this.values.map(v => isNum(v) ? round(v, d) : v)); }
    abs() { return this._new(this.values.map(v => isNum(v) ? Math.abs(v) : v)); }
    clip(lo, hi) { return this._new(this.values.map(v => isNum(v) ? Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, v)) : v)); }
    log() { return this._new(this.values.map(v => isNum(v) && v > 0 ? Math.log(v) : null)); }
    log1p() { return this._new(this.values.map(v => isNum(v) && v > -1 ? Math.log1p(v) : null)); }
    sqrt() { return this._new(this.values.map(v => isNum(v) && v >= 0 ? Math.sqrt(v) : null)); }
    exp() { return this._new(this.values.map(v => isNum(v) ? Math.exp(v) : null)); }
    between(a, b, inclusive = 'both') {
      return this._new(this.values.map(v => {
        if (isNA(v)) return false;
        const lo = inclusive === 'both' || inclusive === 'left' ? cmpVal(v, a) >= 0 : cmpVal(v, a) > 0;
        const hi = inclusive === 'both' || inclusive === 'right' ? cmpVal(v, b) <= 0 : cmpVal(v, b) < 0;
        return lo && hi;
      }));
    }
    isin(list) { const s = new Set(arr(list).map(keyOf)); return this._new(this.values.map(v => s.has(keyOf(v)))); }
    where(cond, other = null) { const c = valsOf(cond) || this.values.map(cond); return this._new(this.values.map((v, i) => c[i] ? v : other)); }
    mask(cond, other = null) { const c = valsOf(cond) || this.values.map(cond); return this._new(this.values.map((v, i) => c[i] ? other : v)); }
    zscore() { const m = this.mean(), s = this.std(); return this._new(this.values.map(v => isNum(v) && s ? (v - m) / s : null)); }
    normalize() { const lo = this.min(), hi = this.max(); return this._new(this.values.map(v => isNum(v) && hi > lo ? (v - lo) / (hi - lo) : null)); }

    /* deret */
    cumsum() { let s = 0; return this._new(this.values.map(v => isNum(v) ? (s += v) : null)); }
    cumprod() { let s = 1; return this._new(this.values.map(v => isNum(v) ? (s *= v) : null)); }
    cummax() { let s = null; return this._new(this.values.map(v => isNA(v) ? null : (s = s === null || cmpVal(v, s) > 0 ? v : s))); }
    cummin() { let s = null; return this._new(this.values.map(v => isNA(v) ? null : (s = s === null || cmpVal(v, s) < 0 ? v : s))); }
    cumcount() { return this._new(this.values.map((_, i) => i)); }
    shift(k = 1, fill = null) { const x = this.values, n = x.length; return this._new(x.map((_, i) => { const j = i - k; return j >= 0 && j < n ? x[j] : fill; })); }
    diff(k = 1) { const x = this.values; return this._new(x.map((v, i) => i - k >= 0 && i - k < x.length && isNum(v) && isNum(x[i - k]) ? v - x[i - k] : null)); }
    pct_change(k = 1) { const x = this.values; return this._new(x.map((v, i) => i - k >= 0 && isNum(v) && isNum(x[i - k]) && x[i - k] !== 0 ? v / x[i - k] - 1 : null)); }
    rolling(w, o) { return new Rolling(this, w, o); }
    expanding(o) { return new Rolling(this, Infinity, Object.assign({ min_periods: 1 }, o)); }
    ewm(o) { return new EWM(this, o); }
    rank(o) {
      o = o || {};
      const x = this.values, idx = x.map((v, i) => i).filter(i => !isNA(x[i]));
      const asc = o.ascending !== false;
      idx.sort((a, b) => (asc ? cmpVal(x[a], x[b]) : cmpVal(x[b], x[a])) || a - b);
      const r = Array(x.length).fill(null);
      const method = o.method || 'average';
      let dense = 0;
      for (let i = 0; i < idx.length;) {
        let j = i;
        while (j + 1 < idx.length && cmpVal(x[idx[j + 1]], x[idx[i]]) === 0) j++;
        dense++;
        for (let k = i; k <= j; k++) {
          r[idx[k]] = method === 'min' ? i + 1 : method === 'max' ? j + 1 : method === 'dense' ? dense : method === 'first' ? k + 1 : (i + j) / 2 + 1;
        }
        i = j + 1;
      }
      const n = idx.length;
      return this._new(o.pct ? r.map(v => v == null ? null : v / (method === 'dense' ? dense : n)) : r);
    }
    sort_values(o) {
      o = typeof o === 'boolean' ? { ascending: o } : (o || {});
      const asc = o.ascending !== false;
      const idx = this.values.map((_, i) => i).sort((a, b) => {
        const va = this.values[a], vb = this.values[b];
        if (isNA(va) || isNA(vb)) return cmpVal(va, vb);
        return (asc ? cmpVal(va, vb) : cmpVal(vb, va)) || a - b;
      });
      return new Series(idx.map(i => this.values[i]), this.name, this.index ? idx.map(i => this.index[i]) : null);
    }
    nlargest(n = 5) { return this.sort_values({ ascending: false }).head(n); }
    nsmallest(n = 5) { return this.sort_values().head(n); }
    sample(n, o) { o = o || {}; const r = rng(o.seed ?? o.random_state); const id = shuffleIdx(this.length, r).slice(0, n); return new Series(id.map(i => this.values[i]), this.name); }
    corr(other, method = 'pearson') { return Stats.corr(this.values, valsOf(other) || other, method).r; }
    cov(other) { return Stats.cov(this.values, valsOf(other) || other); }
    autocorr(lag = 1) { return this.corr(this.shift(lag)); }
    duplicated(o) { o = o || {}; const seen = new Set(); const x = this.values; const out = x.map(() => false); const order = o.keep === 'last' ? [...x.keys()].reverse() : [...x.keys()]; for (const i of order) { const k = keyOf(x[i]); if (seen.has(k)) out[i] = true; else seen.add(k); } return this._new(out); }
    drop_duplicates() { const d = this.duplicated(); return new Series(this.values.filter((_, i) => !d.values[i]), this.name); }
    filter(f) { const c = valsOf(f) || this.values.map(f); return new Series(this.values.filter((_, i) => c[i]), this.name); }
    outliers(o) { return outlierMask(this.values, o); }
    cut(bins, o) { return cut(this, bins, o); }
    qcut(q, o) { return qcut(this, q, o); }
  }

  /* operator aritmetika & perbandingan */
  const BIN = {
    add: (a, b) => (isNum(a) && isNum(b)) ? a + b : (typeof a === 'string' || typeof b === 'string') && !isNA(a) && !isNA(b) ? String(a) + String(b) : null,
    sub: (a, b) => isNum(a) && isNum(b) ? a - b : (a instanceof Date && b instanceof Date) ? (a - b) / 86400000 : null,
    mul: (a, b) => isNum(a) && isNum(b) ? a * b : null,
    div: (a, b) => isNum(a) && isNum(b) && b !== 0 ? a / b : null,
    floordiv: (a, b) => isNum(a) && isNum(b) && b !== 0 ? Math.floor(a / b) : null,
    mod: (a, b) => isNum(a) && isNum(b) && b !== 0 ? ((a % b) + b) % b : null,
    pow: (a, b) => isNum(a) && isNum(b) ? Math.pow(a, b) : null,
    eq: (a, b) => !isNA(a) && cmpLoose(a, b) === 0,
    ne: (a, b) => isNA(a) || cmpLoose(a, b) !== 0,
    gt: (a, b) => !isNA(a) && !isNA(b) && cmpLoose(a, b) > 0,
    ge: (a, b) => !isNA(a) && !isNA(b) && cmpLoose(a, b) >= 0,
    lt: (a, b) => !isNA(a) && !isNA(b) && cmpLoose(a, b) < 0,
    le: (a, b) => !isNA(a) && !isNA(b) && cmpLoose(a, b) <= 0,
    and: (a, b) => !!a && !!b,
    or: (a, b) => !!a || !!b
  };
  /** ddof boleh angka (std(0)) atau objek seperti pandas (std({ ddof: 0 })). */
  function ddofOf(d) { return d && typeof d === 'object' ? (d.ddof ?? 1) : (d ?? 1); }
  function cmpLoose(a, b) {
    if (a instanceof Date && typeof b === 'string') { const d = toDate(b); if (d) b = d; }
    if (b instanceof Date && typeof a === 'string') { const d = toDate(a); if (d) a = d; }
    if (isNA(b)) return isNA(a) ? 0 : 1;
    if (typeof a === 'number' && typeof b === 'string' && b.trim() !== '' && !isNaN(+b)) b = +b;
    if (typeof a === 'boolean' && typeof b === 'number') a = a ? 1 : 0;
    if (typeof a !== typeof b && !(a instanceof Date && b instanceof Date)) return String(a) === String(b) ? 0 : String(a) < String(b) ? -1 : 1;
    return cmpVal(a, b);
  }
  for (const k in BIN) {
    Series.prototype[k] = function (other) {
      const o = valsOf(other);
      return this._new(this.values.map((v, i) => BIN[k](v, o ? o[i] : other)), ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'and', 'or'].includes(k) ? this.name : this.name);
    };
  }
  Series.prototype.truediv = Series.prototype.div;
  Series.prototype.not = function () { return this._new(this.values.map(v => !v)); };
  Series.prototype.neg = function () { return this._new(this.values.map(v => isNum(v) ? -v : null)); };

  class Rolling {
    constructor(s, w, o) { this.s = s; this.w = w; this.o = o || {}; }
    _run(f) {
      const x = this.s.values, w = this.w, mp = this.o.min_periods ?? (isFinite(w) ? w : 1), center = !!this.o.center;
      const out = x.map((_, i) => {
        let a, b;
        if (!isFinite(w)) { a = 0; b = i; }
        else if (center) { a = i - Math.floor((w - 1) / 2); b = a + w - 1; }
        else { a = i - w + 1; b = i; }
        if (a < 0 || b >= x.length) { if (!isFinite(w) || !center) a = Math.max(0, a); else return null; }
        const win = x.slice(a, b + 1);
        if (numsOf(win).length < mp) return null;
        return f(win);
      });
      return this.s._new(out);
    }
    mean() { return this._run(A.mean); }
    sum() { return this._run(A.sum); }
    min() { return this._run(A.min); }
    max() { return this._run(A.max); }
    median() { return this._run(A.median); }
    std() { return this._run(a => A.std(a)); }
    var() { return this._run(a => A.var(a)); }
    count() { return this._run(A.count); }
    apply(f) { return this._run(a => f(a)); }
    agg(f) { return this._run(aggFn(f)); }
  }
  class EWM {
    constructor(s, o) {
      o = typeof o === 'number' ? { span: o } : (o || {});
      this.s = s;
      this.alpha = o.alpha != null ? o.alpha : o.span != null ? 2 / (o.span + 1) : o.halflife != null ? 1 - Math.exp(-Math.LN2 / o.halflife) : o.com != null ? 1 / (1 + o.com) : fail('ewm butuh salah satu: span, alpha, halflife, atau com.');
      this.adjust = o.adjust !== false;
    }
    mean() {
      const a = this.alpha; let num = 0, den = 0, prev = null;
      return this.s._new(this.s.values.map(v => {
        if (!isNum(v)) return prev;
        if (this.adjust) { num = v + (1 - a) * num; den = 1 + (1 - a) * den; prev = num / den; }
        else prev = prev == null ? v : a * v + (1 - a) * prev;
        return prev;
      }));
    }
  }

  class StrAccessor {
    constructor(s) { this.s = s; }
    _m(f) { return this.s._new(this.s.values.map(v => isNA(v) ? null : f(String(v)))); }
    lower() { return this._m(v => v.toLowerCase()); }
    upper() { return this._m(v => v.toUpperCase()); }
    title() { return this._m(v => v.toLowerCase().replace(/(^|[\s\-_'(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())); }
    capitalize() { return this._m(v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()); }
    strip(c) { return this._m(v => c ? v.replace(new RegExp(`^[${escRe(c)}]+|[${escRe(c)}]+$`, 'g'), '') : v.trim()); }
    lstrip() { return this._m(v => v.replace(/^\s+/, '')); }
    rstrip() { return this._m(v => v.replace(/\s+$/, '')); }
    len() { return this._m(v => v.length); }
    contains(p, o) {
      o = o || {};
      const re = p instanceof RegExp ? p : o.regex ? new RegExp(p, o.case === false ? 'i' : '') : null;
      const pp = o.case === false && !re ? String(p).toLowerCase() : String(p);
      return this.s._new(this.s.values.map(v => isNA(v) ? false : re ? re.test(String(v)) : (o.case === false ? String(v).toLowerCase() : String(v)).includes(pp)));
    }
    startswith(p) { return this.s._new(this.s.values.map(v => !isNA(v) && String(v).startsWith(p))); }
    endswith(p) { return this.s._new(this.s.values.map(v => !isNA(v) && String(v).endsWith(p))); }
    match(p) { const re = p instanceof RegExp ? p : new RegExp('^(?:' + p + ')'); return this.s._new(this.s.values.map(v => !isNA(v) && re.test(String(v)))); }
    replace(p, r, o) {
      o = o || {};
      const re = p instanceof RegExp ? new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g') : o.regex ? new RegExp(p, 'g' + (o.case === false ? 'i' : '')) : null;
      return this._m(v => re ? v.replace(re, r) : v.split(p).join(r));
    }
    split(sep, o) { o = o || {}; return this._m(v => { const p = sep == null ? v.trim().split(/\s+/) : v.split(sep); return o.n != null ? p.slice(0, o.n) : p; }); }
    get(i) { return this.s._new(this.s.values.map(v => isNA(v) ? null : (Array.isArray(v) ? v : String(v))[i < 0 ? (Array.isArray(v) ? v : String(v)).length + i : i] ?? null)); }
    slice(a, b) { return this._m(v => v.slice(a, b)); }
    zfill(n) { return this._m(v => v.padStart(n, '0')); }
    pad(n, o) { o = o || {}; return this._m(v => o.side === 'right' ? v.padEnd(n, o.fillchar || ' ') : v.padStart(n, o.fillchar || ' ')); }
    count(p) { const re = p instanceof RegExp ? new RegExp(p.source, 'g') : new RegExp(escRe(p), 'g'); return this._m(v => (v.match(re) || []).length); }
    extract(p, group = 1) { const re = p instanceof RegExp ? p : new RegExp(p); return this._m(v => { const m = v.match(re); return m ? (m[group] ?? m[0]) : null; }); }
    isnumeric() { return this.s._new(this.s.values.map(v => !isNA(v) && /^\d+$/.test(String(v)))); }
    isdigit() { return this.isnumeric(); }
    cat(sep = '') { if (sep && typeof sep === 'object') sep = sep.sep ?? ''; return this.s.values.filter(v => !isNA(v)).join(sep); }
    join(sep = ',') { return this._m(v => v); }
    to_numeric(o) { return this.s.to_numeric(o); }
    normalize_space() { return this._m(v => v.replace(/\s+/g, ' ').trim()); }
  }
  const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  class DtAccessor {
    constructor(s) { this.s = s; }
    _m(f) { return this.s._new(this.s.values.map(v => { const d = v instanceof Date ? v : toDate(v); return isDate(d) ? f(d) : null; })); }
    get year() { return this._m(d => d.getFullYear()); }
    get month() { return this._m(d => d.getMonth() + 1); }
    get day() { return this._m(d => d.getDate()); }
    get hour() { return this._m(d => d.getHours()); }
    get minute() { return this._m(d => d.getMinutes()); }
    get second() { return this._m(d => d.getSeconds()); }
    get weekday() { return this._m(d => (d.getDay() + 6) % 7); }
    get dayofweek() { return this.weekday; }
    get dayofyear() { return this._m(dayOfYear); }
    get quarter() { return this._m(d => Math.floor(d.getMonth() / 3) + 1); }
    get week() { return this._m(d => isoWeek(d).week); }
    get is_weekend() { return this._m(d => d.getDay() === 0 || d.getDay() === 6); }
    get is_month_start() { return this._m(d => d.getDate() === 1); }
    get is_month_end() { return this._m(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getDate() === 1); }
    get days_in_month() { return this._m(d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()); }
    get date() { return this._m(d => new Date(d.getFullYear(), d.getMonth(), d.getDate())); }
    month_name() { return this._m(d => NAMA_BULAN[d.getMonth()]); }
    day_name() { return this._m(d => NAMA_HARI[(d.getDay() + 6) % 7]); }
    strftime(f) { return this._m(d => strftime(d, f)); }
    format(f) { return this.strftime(f); }
    floor(f) { const k = freqOf(f); return this._m(d => periodStart(d, k)); }
    to_period(f) { const k = freqOf(f); return this._m(d => periodLabel(periodStart(d, k), k)); }
    normalize() { return this.date; }
    diff_days(other) { const o = valsOf(other); return this.s._new(this.s.values.map((v, i) => { const a = toDate(v), b = toDate(o ? o[i] : other); return isDate(a) && isDate(b) ? (a - b) / 86400000 : null; })); }
    days_until(other) { return this.diff_days(other).neg(); }
  }

  function inferType(x) {
    let n = 0, s = 0, d = 0, b = 0, o = 0, t = 0;
    for (const v of x) {
      if (isNA(v)) continue;
      t++;
      if (typeof v === 'number') n++;
      else if (typeof v === 'string') s++;
      else if (v instanceof Date) d++;
      else if (typeof v === 'boolean') b++;
      else o++;
    }
    if (!t) return 'kosong';
    if (n === t) return Number.isInteger(x.find(v => isNum(v))) && x.every(v => isNA(v) || Number.isInteger(v)) ? 'int' : 'number';
    if (s === t) return 'string';
    if (d === t) return 'date';
    if (b === t) return 'boolean';
    return 'campuran';
  }

  function castArray(x, t) {
    const k = String(t).toLowerCase();
    if (/^(number|float|float64|num|angka|desimal)$/.test(k)) return x.map(v => toNumber(v));
    if (/^(int|int64|integer|bulat)$/.test(k)) return x.map(v => { const n = toNumber(v); return n == null ? null : Math.trunc(n); });
    if (/^(string|str|text|teks|object|category|kategori)$/.test(k)) return x.map(v => isNA(v) ? null : v instanceof Date ? strftime(v, v.getHours() || v.getMinutes() ? '%Y-%m-%d %H:%M' : '%Y-%m-%d') : String(v));
    if (/^(date|datetime|datetime64|tanggal)$/.test(k)) return x.map(v => toDate(v));
    if (/^(bool|boolean)$/.test(k)) return x.map(v => {
      if (isNA(v)) return null;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      const s = String(v).trim().toLowerCase();
      if (/^(true|ya|y|yes|1|benar|aktif|t)$/.test(s)) return true;
      if (/^(false|tidak|tdk|n|no|0|salah|nonaktif|f)$/.test(s)) return false;
      return null;
    });
    fail(`Tipe "${t}" tidak dikenal. Pilih: "number", "int", "string", "date", atau "boolean".`);
  }

  function outlierMask(x, o) {
    o = o || {};
    const method = o.method || 'iqr';
    const s = numsOf(x).sort((a, b) => a - b);
    let lo, hi;
    if (method === 'iqr') { const q1 = quant(s, 0.25), q3 = quant(s, 0.75), k = o.k ?? 1.5; lo = q1 - k * (q3 - q1); hi = q3 + k * (q3 - q1); }
    else if (method === 'z' || method === 'zscore') { const m = A.mean(s), sd = A.std(s), k = o.k ?? o.threshold ?? 3; lo = m - k * sd; hi = m + k * sd; }
    else if (method === 'percentile') { lo = quant(s, (o.lower ?? 1) / 100); hi = quant(s, (o.upper ?? 99) / 100); }
    else fail('Metode pencilan: "iqr", "z", atau "percentile".');
    const r = new Series(x.map(v => isNum(v) && (v < lo || v > hi)), 'pencilan');
    r.bounds = [lo, hi];
    return r;
  }

  function cut(s, bins, o) {
    o = o || {};
    const x = s instanceof Series ? s.values : s;
    let edges;
    if (isNum(bins)) {
      const v = numsOf(x), lo = minOf(v), hi = maxOf(v), st = (hi - lo) / bins || 1;
      edges = Array.from({ length: bins + 1 }, (_, i) => lo + st * i);
      edges[0] = lo - (hi - lo) * 0.001; edges[bins] = hi;
    } else edges = bins.slice();
    const right = o.right !== false;
    const fmtE = v => isFinite(v) ? fmtNum(+(+v).toPrecision(6)) : (v > 0 ? '∞' : '-∞');
    const labels = o.labels === false ? null : o.labels || edges.slice(1).map((e, i) => right ? `(${fmtE(edges[i])}, ${fmtE(e)}]` : `[${fmtE(edges[i])}, ${fmtE(e)})`);
    const incl = o.include_lowest;
    const out = x.map(v => {
      if (!isNum(v)) return null;
      for (let i = 0; i < edges.length - 1; i++) {
        const a = edges[i], b = edges[i + 1];
        const inside = right ? ((v > a || (incl && i === 0 && v === a)) && v <= b) : (v >= a && (v < b || (incl && i === edges.length - 2 && v === b)));
        if (inside) return labels ? labels[i] : i;
      }
      return null;
    });
    return new Series(out, s.name || 'kelompok');
  }
  function qcut(s, q, o) {
    o = o || {};
    const x = s instanceof Series ? s.values : s;
    const v = numsOf(x).sort((a, b) => a - b);
    const qs = isNum(q) ? Array.from({ length: q + 1 }, (_, i) => i / q) : q;
    const edges = [...new Set(qs.map(p => quant(v, p)))];
    if (edges.length < 2) fail('qcut: data terlalu seragam untuk dibagi.');
    return cut(x instanceof Series ? x : new Series(x, s.name), edges, Object.assign({ include_lowest: true }, o, { labels: o.labels || (isNum(q) && edges.length === q + 1 ? null : undefined) }));
  }

  /* ======================================================================
   * DataFrame: tabel berkolom
   * ==================================================================== */

  /** Nama fungsi sl.* yang sering salah ditulis sebagai df.*; diisi dari daftar elemen Slak. */
  const SL_ONLY = new Set(['write', 'dataframe', 'table', 'data_editor', 'line_chart', 'bar_chart', 'area_chart', 'scatter_chart', 'histogram', 'box_plot', 'pie_chart', 'heatmap', 'combo_chart', 'map', 'choropleth', 'metric', 'json', 'markdown', 'title', 'header', 'subheader', 'caption', 'text', 'download_button', 'plotly_chart', 'echarts_chart', 'vega_lite_chart', 'sql', 'read_csv', 'read_excel', 'dataset', 'selectbox', 'multiselect', 'slider']);
  const DF_PROXY = {
    get(t, p, r) {
      if (typeof p === 'string' && !(p in t) && Object.prototype.hasOwnProperty.call(t._d, p)) return t.col(p);
      if (typeof p === 'string' && !(p in t) && SL_ONLY.has(p)) {
        return () => { throw new Error(`df.${p}() tidak ada. ${p} adalah perintah Slak, bukan milik tabel. Tulis sl.${p}(df${/chart|map|choropleth|histogram|box_plot|heatmap/.test(p) ? ', { ... }' : ''}) dengan nama tabelmu di dalam kurung.`); };
      }
      return Reflect.get(t, p, r);
    },
    set(t, p, v) {
      if (typeof p === 'string' && !(p in t) && !p.startsWith('_')) { t.set(p, v); return true; }
      t[p] = v; return true;
    },
    has(t, p) { return p in t || (typeof p === 'string' && Object.prototype.hasOwnProperty.call(t._d, p)); }
  };

  function fromAny(data, o) {
    o = o || {};
    if (data instanceof DataFrame) return { c: data._c.slice(), d: Object.fromEntries(data._c.map(k => [k, data._d[k].slice()])), n: data._n };
    if (data instanceof Series) { const k = data.name != null ? String(data.name) : 'nilai'; if (data.index) return { c: ['label', k], d: { label: data.index.slice(), [k]: data.values.slice() }, n: data.length }; return { c: [k], d: { [k]: data.values.slice() }, n: data.length }; }
    if (data == null) return { c: [], d: {}, n: 0 };
    if (Array.isArray(data)) {
      if (!data.length) { const c = arr(o.columns); return { c, d: Object.fromEntries(c.map(k => [k, []])), n: 0 }; }
      if (data.every(Array.isArray)) {
        const w = maxOf(data.map(r => r.length));
        const c = o.columns ? arr(o.columns).map(String) : Array.from({ length: w }, (_, i) => String(i));
        return { c, d: Object.fromEntries(c.map((k, j) => [k, data.map(r => r[j] === undefined ? null : r[j])])), n: data.length };
      }
      if (data.every(r => r !== null && typeof r === 'object' && !(r instanceof Date))) {
        const c = [], seen = new Set();
        for (const r of data) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); c.push(k); }
        const cols = o.columns ? arr(o.columns) : c;
        return { c: cols, d: Object.fromEntries(cols.map(k => [k, data.map(r => r[k] === undefined ? null : r[k])])), n: data.length };
      }
      const k = o.columns ? arr(o.columns)[0] : 'nilai';
      return { c: [k], d: { [k]: data.slice() }, n: data.length };
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length && keys.every(k => Array.isArray(data[k]) || data[k] instanceof Series)) {
        const d = {}; let n = 0;
        for (const k of keys) { d[k] = data[k] instanceof Series ? data[k].values.slice() : data[k].slice(); n = Math.max(n, d[k].length); }
        for (const k of keys) while (d[k].length < n) d[k].push(null);
        return { c: keys, d, n };
      }
      return { c: ['kunci', 'nilai'], d: { kunci: keys, nilai: keys.map(k => data[k]) }, n: keys.length };
    }
    fail('Data tidak bisa diubah menjadi DataFrame.');
  }

  class DataFrame {
    constructor(data, o) {
      const x = fromAny(data, o);
      this._c = x.c.map(String);
      this._d = {};
      x.c.forEach((k, i) => { this._d[this._c[i]] = x.d[k]; });
      this._n = x.n;
      return new Proxy(this, DF_PROXY);
    }
    static _make(c, d, n) {
      const df = Object.create(DataFrame.prototype);
      df._c = c; df._d = d; df._n = n != null ? n : (c.length ? d[c[0]].length : 0);
      return new Proxy(df, DF_PROXY);
    }
    _take(idx) { return DataFrame._make(this._c.slice(), Object.fromEntries(this._c.map(k => { const s = this._d[k]; return [k, idx.map(i => s[i])]; })), idx.length); }
    _need(c) {
      for (const k of arr(c)) if (!Object.prototype.hasOwnProperty.call(this._d, k)) {
        const s = suggest(k, this._c);
        fail(`Kolom "${k}" tidak ada.${s ? ` Mungkin maksudmu "${s}"?` : ''} Kolom yang tersedia: ${this._c.join(', ') || '(kosong)'}.`);
      }
    }
    [Symbol.iterator]() { let i = 0; const self = this; return { next: () => i < self._n ? { value: self.row(i++), done: false } : { value: undefined, done: true }, [Symbol.iterator]() { return this; } }; }
    toJSON() { return this.to_records(); }
    toString() { return `DataFrame(${this._n} baris × ${this._c.length} kolom)`; }

    /* bentuk */
    get columns() { return this._c.slice(); }
    get shape() { return [this._n, this._c.length]; }
    get length() { return this._n; }
    get size() { return this._n * this._c.length; }
    get empty() { return this._n === 0 || !this._c.length; }
    get dtypes() { return Object.fromEntries(this._c.map(k => [k, inferType(this._d[k])])); }
    get T() { return this.transpose(); }
    col(name) { this._need(name); return new Series(this._d[name], name); }
    get(name) { return Array.isArray(name) ? this.select(name) : this.col(name); }
    has(name) { return Object.prototype.hasOwnProperty.call(this._d, name); }
    set(name, v) {
      let vals;
      if (v instanceof Series) vals = v.values.slice();
      else if (Array.isArray(v)) vals = v.slice();
      else if (typeof v === 'function') vals = Array.from({ length: this._n }, (_, i) => v(this.row(i), i));
      else vals = Array(this._n).fill(v);
      if (!this._c.length && !this._n) this._n = vals.length;
      if (vals.length !== this._n) fail(`Panjang kolom "${name}" (${vals.length}) tidak sama dengan jumlah baris (${this._n}).`);
      if (!this.has(name)) this._c.push(String(name));
      this._d[name] = vals;
      return this;
    }
    row(i) { const r = {}; for (const k of this._c) r[k] = this._d[k][i]; return r; }
    iloc(i, j) {
      if (Array.isArray(i)) return this._take(i);
      if (i < 0) i += this._n;
      if (j != null) return this._d[this._c[j]][i];
      return this.row(i);
    }
    at(i, c) { return this._d[c][i]; }
    copy() { return new DataFrame(this); }
    head(n = 5) { return this.slice(0, n); }
    tail(n = 5) { return this.slice(Math.max(0, this._n - n)); }
    slice(a, b) { const s = a == null ? 0 : a < 0 ? Math.max(0, this._n + a) : a; const e = b == null ? this._n : b < 0 ? this._n + b : Math.min(b, this._n); return this._take(Array.from({ length: Math.max(0, e - s) }, (_, i) => s + i)); }
    sample(n, o) {
      if (typeof n === 'object' && n) { o = n; n = null; }
      o = o || {};
      const k = o.frac != null ? Math.round(this._n * o.frac) : Math.min(n == null ? 5 : n, o.replace ? Infinity : this._n);
      const r = rng(o.seed ?? o.random_state);
      if (o.replace) return this._take(Array.from({ length: k }, () => Math.floor(r() * this._n)));
      return this._take(shuffleIdx(this._n, r).slice(0, k));
    }
    to_records() { return Array.from({ length: this._n }, (_, i) => this.row(i)); }
    to_dict(orient = 'records') {
      if (orient === 'list' || orient === 'kolom') return Object.fromEntries(this._c.map(k => [k, this._d[k].slice()]));
      return this.to_records();
    }
    to_array() { return Array.from({ length: this._n }, (_, i) => this._c.map(k => this._d[k][i])); }
    values() { return this.to_array(); }
    to_csv(o) {
      o = o || {};
      const sep = o.sep || o.delimiter || ',';
      const dec = o.decimal || '.';
      const q = v => {
        if (isNA(v)) return o.na_rep || '';
        let s = v instanceof Date ? strftime(v, v.getHours() || v.getMinutes() || v.getSeconds() ? '%Y-%m-%d %H:%M:%S' : '%Y-%m-%d') : typeof v === 'object' ? JSON.stringify(v) : String(v);
        if (typeof v === 'number' && dec !== '.') s = s.replace('.', dec);
        return s.includes(sep) || /["\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const lines = [];
      if (o.header !== false) lines.push(this._c.map(q).join(sep));
      for (let i = 0; i < this._n; i++) lines.push(this._c.map(k => q(this._d[k][i])).join(sep));
      return (o.bom ? '﻿' : '') + lines.join('\n');
    }
    to_json(o) { o = o || {}; return JSON.stringify(o.orient === 'columns' || o.orient === 'list' ? this.to_dict('list') : this.to_records(), null, o.indent ?? 0); }
    to_excel(sheet) { return toExcel({ [sheet || 'Data']: this }); }
    to_markdown(o) {
      o = o || {};
      const n = Math.min(this._n, o.max_rows || 50);
      const f = v => isNA(v) ? '' : v instanceof Date ? fmtCat(v) : isNum(v) ? fmtNum(+v.toPrecision(8)) : String(v).replace(/\|/g, '\\|');
      return ['| ' + this._c.join(' | ') + ' |', '|' + this._c.map(k => inferType(this._d[k]).match(/int|number/) ? ' ---: ' : ' --- ').join('|') + '|',
        ...Array.from({ length: n }, (_, i) => '| ' + this._c.map(k => f(this._d[k][i])).join(' | ') + ' |')].join('\n');
    }

    /* ringkasan */
    info() {
      return new DataFrame({
        kolom: this._c.slice(),
        tipe: this._c.map(k => inferType(this._d[k])),
        terisi: this._c.map(k => A.count(this._d[k])),
        kosong: this._c.map(k => this._n - A.count(this._d[k])),
        unik: this._c.map(k => A.nunique(this._d[k])),
        contoh: this._c.map(k => { const v = A.first(this._d[k]); return v == null ? null : v instanceof Date ? fmtCat(v) : String(v).slice(0, 40); })
      });
    }
    describe(o) {
      o = o || {};
      const nc = this._c.filter(k => /int|number/.test(inferType(this._d[k])));
      const cc = this._c.filter(k => !nc.includes(k));
      const include = o.include || (nc.length ? 'number' : 'all');
      if (include === 'number' || include === 'angka') {
        const stats = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'];
        const d = { statistik: stats };
        for (const k of nc) d[k] = new Series(this._d[k], k).describe().values;
        return new DataFrame(d);
      }
      const cols = include === 'all' || include === 'semua' ? this._c : cc;
      const stats = ['count', 'unique', 'top', 'freq', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'];
      const d = { statistik: stats };
      for (const k of cols) {
        const s = new Series(this._d[k], k);
        if (nc.includes(k)) { const v = s.describe().values; d[k] = [v[0], null, null, null, ...v.slice(1)]; }
        else { const v = s.describe().values; d[k] = [v[0], v[1], v[2], v[3], null, null, null, null, null, null, null]; }
      }
      return new DataFrame(d);
    }
    missing() {
      return new DataFrame({
        kolom: this._c.slice(),
        kosong: this._c.map(k => this._n - A.count(this._d[k])),
        persen: this._c.map(k => this._n ? (this._n - A.count(this._d[k])) / this._n : 0)
      }).sort_values('kosong', { ascending: false });
    }
    _reduce(f, numeric) {
      const cols = numeric ? this._c.filter(k => /int|number|boolean/.test(inferType(this._d[k]))) : this._c;
      return new Series(cols.map(k => f(this._d[k].map(v => typeof v === 'boolean' ? +v : v))), null, cols);
    }
    sum() { return this._reduce(A.sum, true); }
    mean() { return this._reduce(A.mean, true); }
    median() { return this._reduce(A.median, true); }
    std(d) { const dd = ddofOf(d); return this._reduce(a => A.std(a, dd), true); }
    var(d) { const dd = ddofOf(d); return this._reduce(a => A.var(a, dd), true); }
    min() { return this._reduce(A.min, false); }
    max() { return this._reduce(A.max, false); }
    count() { return this._reduce(A.count, false); }
    nunique() { return this._reduce(A.nunique, false); }
    agg(spec) {
      const fs = arr(spec);
      const nc = this._c.filter(k => /int|number/.test(inferType(this._d[k])));
      if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
        const d = { statistik: [] }, all = new Set();
        for (const k in spec) for (const f of arr(spec[k])) all.add(aggName(f));
        d.statistik = [...all];
        for (const k in spec) { this._need(k); const m = Object.fromEntries(arr(spec[k]).map(f => [aggName(f), aggFn(f)(this._d[k])])); d[k] = d.statistik.map(s => m[s] ?? null); }
        return new DataFrame(d);
      }
      const d = { statistik: fs.map(aggName) };
      for (const k of nc) d[k] = fs.map(f => aggFn(f)(this._d[k]));
      return new DataFrame(d);
    }
    isna() { return DataFrame._make(this._c.slice(), Object.fromEntries(this._c.map(k => [k, this._d[k].map(isNA)])), this._n); }
    isnull() { return this.isna(); }
    notna() { return DataFrame._make(this._c.slice(), Object.fromEntries(this._c.map(k => [k, this._d[k].map(v => !isNA(v))])), this._n); }
    value_counts(cols, o) {
      if (cols && typeof cols === 'object' && !Array.isArray(cols)) { o = cols; cols = null; }
      o = o || {};
      cols = cols == null ? this._c : arr(cols);
      this._need(cols);
      if (cols.length === 1) return new Series(this._d[cols[0]], cols[0]).value_counts(o);
      const g = this.groupby(cols, { dropna: o.dropna !== false }).size();
      const out = g.sort_values('jumlah', { ascending: !!o.ascending });
      if (o.normalize) { const t = A.sum(out._d.jumlah); out.set('proporsi', out._d.jumlah.map(v => v / t)); }
      return out;
    }
    unique(c) { this._need(c); return A.unique(this._d[c]); }
    corr(o) {
      o = typeof o === 'string' ? { method: o } : (o || {});
      const cols = o.columns || this._c.filter(k => /int|number|boolean/.test(inferType(this._d[k])));
      const d = { kolom: cols.slice() };
      for (const b of cols) d[b] = cols.map(a => a === b ? 1 : Stats.corr(this._d[a].map(v => typeof v === 'boolean' ? +v : v), this._d[b].map(v => typeof v === 'boolean' ? +v : v), o.method || 'pearson').r);
      return new DataFrame(d);
    }
    cov() {
      const cols = this._c.filter(k => /int|number/.test(inferType(this._d[k])));
      const d = { kolom: cols.slice() };
      for (const b of cols) d[b] = cols.map(a => Stats.cov(this._d[a], this._d[b]));
      return new DataFrame(d);
    }

    /* memilih & membentuk ulang kolom */
    select(cols) {
      if (typeof cols === 'function' || cols instanceof RegExp) cols = this._c.filter(k => cols instanceof RegExp ? cols.test(k) : cols(k, inferType(this._d[k])));
      cols = arr(cols); this._need(cols);
      return DataFrame._make(cols.slice(), Object.fromEntries(cols.map(k => [k, this._d[k]])), this._n);
    }
    select_dtypes(o) {
      o = typeof o === 'string' || Array.isArray(o) ? { include: o } : (o || {});
      const want = t => arr(o.include).some(x => x === t || (x === 'number' && t === 'int') || (x === 'angka' && /int|number/.test(t)));
      const no = t => arr(o.exclude).some(x => x === t || (x === 'number' && t === 'int'));
      return this.select(this._c.filter(k => { const t = inferType(this._d[k]); return (!o.include || want(t)) && !no(t); }));
    }
    drop(cols, o) {
      if (cols && typeof cols === 'object' && !Array.isArray(cols)) { o = cols; cols = o.columns; }
      if (o && o.index != null) { const s = new Set(arr(o.index)); return this._take([...Array(this._n).keys()].filter(i => !s.has(i))); }
      const s = new Set(arr(cols));
      if (!(o && o.errors === 'ignore')) this._need([...s]);
      return this.select(this._c.filter(k => !s.has(k)));
    }
    rename(map) {
      if (map && map.columns) map = map.columns;
      const f = typeof map === 'function' ? map : k => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : k);
      const c = this._c.map(k => String(f(k)));
      return DataFrame._make(c, Object.fromEntries(this._c.map((k, i) => [c[i], this._d[k]])), this._n);
    }
    clean_names() {
      return this.rename(k => String(k).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'kolom');
    }
    reorder(cols) { const first = arr(cols); this._need(first); return this.select([...first, ...this._c.filter(k => !first.includes(k))]); }
    assign(spec) {
      const out = this.copy();
      for (const k in spec) {
        const v = spec[k];
        if (typeof v === 'function') {
          const r = v.length === 0 ? v() : null;
          if (r instanceof Series || Array.isArray(r)) { out.set(k, r); continue; }
          const rows = out.to_records();
          out.set(k, rows.map((row, i) => v(row, i)));
        } else out.set(k, v);
      }
      return out;
    }
    with_column(name, v) { return this.assign({ [name]: v }); }
    insert(pos, name, v) { const out = this.assign({ [name]: v }); const c = out._c.filter(k => k !== name); c.splice(pos, 0, name); return out.select(c); }
    astype(spec) {
      const out = this.copy();
      if (typeof spec === 'string') { for (const k of out._c) out._d[k] = castArray(out._d[k], spec); return out; }
      for (const k in spec) { this._need(k); out._d[k] = castArray(out._d[k], spec[k]); }
      return out;
    }
    to_numeric(cols, o) { const out = this.copy(); for (const k of arr(cols)) { this._need(k); out._d[k] = out._d[k].map(v => toNumber(v, o)); } return out; }
    to_datetime(cols, o) { const out = this.copy(); for (const k of arr(cols)) { this._need(k); out._d[k] = out._d[k].map(v => toDate(v, o)); } return out; }
    apply(f, o) {
      o = o || {};
      if (o.axis === 0 || o.axis === 'columns' || o.axis === 'kolom') return new Series(this._c.map(k => f(new Series(this._d[k], k))), null, this._c.slice());
      return new Series(Array.from({ length: this._n }, (_, i) => f(this.row(i), i)), o.name || null);
    }
    map_column(c, f) { this._need(c); const out = this.copy(); out._d[c] = out._d[c].map((v, i) => f(v, i)); return out; }
    applymap(f) { const out = this.copy(); for (const k of out._c) out._d[k] = out._d[k].map(f); return out; }
    round(d = 0) { const out = this.copy(); for (const k of out._c) out._d[k] = out._d[k].map(v => isNum(v) ? round(v, d) : v); return out; }
    abs() { const out = this.copy(); for (const k of out._c) out._d[k] = out._d[k].map(v => isNum(v) ? Math.abs(v) : v); return out; }
    clip(lo, hi, cols) { const out = this.copy(); for (const k of cols ? arr(cols) : out._c) out._d[k] = out._d[k].map(v => isNum(v) ? Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, v)) : v); return out; }
    replace(a, b, cols) { const out = this.copy(); for (const k of cols ? arr(cols) : out._c) out._d[k] = new Series(out._d[k]).replace(a, b).values; return out; }
    transpose() {
      const lab = this._c.find(k => inferType(this._d[k]) === 'string' && A.nunique(this._d[k]) === this._n);
      const rest = this._c.filter(k => k !== lab);
      const names = Array.from({ length: this._n }, (_, i) => lab ? String(this._d[lab][i]) : String(i));
      // _make menjaga urutan kolom; objek biasa menaruh kunci berupa angka ("0", "2023") di depan
      const d = { kolom: rest.slice() }, seen = {};
      const cols = ['kolom', ...names.map(nm => { let x = nm; while (x in d || x in seen) x += '_'; seen[x] = 1; return x; })];
      cols.slice(1).forEach((nm, i) => { d[nm] = rest.map(k => this._d[k][i]); });
      return DataFrame._make(cols, d, rest.length);
    }

    /* menyaring & mengurutkan */
    filter(cond) {
      let m;
      if (cond instanceof Series) m = cond.values;
      else if (Array.isArray(cond)) m = cond;
      else if (typeof cond === 'function') m = Array.from({ length: this._n }, (_, i) => cond(this.row(i), i));
      else if (typeof cond === 'string') return this.query(cond);
      else if (cond && typeof cond === 'object') {
        const ks = Object.keys(cond); this._need(ks);
        m = Array.from({ length: this._n }, (_, i) => ks.every(k => Array.isArray(cond[k]) ? cond[k].some(v => cmpLoose(this._d[k][i], v) === 0) : cmpLoose(this._d[k][i], cond[k]) === 0));
      } else fail('filter() butuh fungsi, Series bernilai benar/salah, atau objek kondisi.');
      if (m.length !== this._n) fail(`Panjang penyaring (${m.length}) tidak sama dengan jumlah baris (${this._n}).`);
      const idx = []; for (let i = 0; i < this._n; i++) if (m[i]) idx.push(i);
      return this._take(idx);
    }
    where(c) { return this.filter(c); }
    loc(cond, cols) { const r = cond == null ? this : this.filter(cond); return cols ? r.select(cols) : r; }
    query(expr, o) {
      const f = compileExpr(String(expr), this, (o && o.vars) || o || {});
      const idx = []; for (let i = 0; i < this._n; i++) if (f(i)) idx.push(i);
      return this._take(idx);
    }
    eval(expr, o) { const f = compileExpr(String(expr), this, (o && o.vars) || o || {}); return new Series(Array.from({ length: this._n }, (_, i) => f(i)), String(expr)); }
    sort_values(by, o) {
      if (by && typeof by === 'object' && !Array.isArray(by)) { o = by; by = o.by; }
      o = typeof o === 'boolean' ? { ascending: o } : (o || {});
      const keys = arr(by); this._need(keys);
      const asc = Array.isArray(o.ascending) ? o.ascending : keys.map(() => o.ascending !== false);
      // Ubah setiap kunci menjadi angka peringkat sekali saja (NaN = kosong, selalu di akhir), lalu urutkan indeks dengan angka.
      // Jauh lebih cepat daripada membandingkan nilai asli (teks/tanggal) di setiap langkah pengurutan.
      const R = keys.map(k => sortKeys(this._d[k]));
      const idx = [...Array(this._n).keys()];
      idx.sort((a, b) => {
        for (let j = 0; j < R.length; j++) {
          const x = R[j][a], y = R[j][b];
          if (x !== x || y !== y) { if (x !== x && y !== y) continue; return x !== x ? 1 : -1; }
          if (x !== y) return asc[j] ? x - y : y - x;
        }
        return a - b;
      });
      return this._take(idx);
    }
    sort(by, o) { return this.sort_values(by, o); }
    nlargest(n, c) { return this.sort_values(c, { ascending: false }).head(n); }
    nsmallest(n, c) { return this.sort_values(c).head(n); }
    reverse() { return this._take([...Array(this._n).keys()].reverse()); }
    reset_index() { return this; }

    /* membersihkan */
    dropna(o) {
      o = typeof o === 'string' || Array.isArray(o) ? { subset: o } : (o || {});
      if (o.axis === 1 || o.axis === 'columns') return this.select(this._c.filter(k => o.how === 'all' ? A.count(this._d[k]) > 0 : A.count(this._d[k]) === this._n));
      const cols = o.subset ? arr(o.subset) : this._c; this._need(cols);
      const idx = [];
      for (let i = 0; i < this._n; i++) {
        const na = cols.filter(k => isNA(this._d[k][i])).length;
        const ok = o.thresh != null ? cols.length - na >= o.thresh : o.how === 'all' ? na < cols.length : na === 0;
        if (ok) idx.push(i);
      }
      return this._take(idx);
    }
    fillna(v, o) {
      const out = this.copy();
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && v.method && !this.has('method')) { o = v; v = undefined; }
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        for (const k in v) { this._need(k); out._d[k] = new Series(out._d[k], k).fillna(v[k]).values; }
        return out;
      }
      const cols = o && o.subset ? arr(o.subset) : out._c;
      for (const k of cols) {
        const t = inferType(out._d[k]);
        if ((v === 'mean' || v === 'median') && !/int|number/.test(t)) continue;
        out._d[k] = new Series(out._d[k], k).fillna(v, o).values;
      }
      return out;
    }
    interpolate(cols) { const out = this.copy(); for (const k of cols ? arr(cols) : out._c) if (/int|number|kosong/.test(inferType(out._d[k]))) out._d[k] = new Series(out._d[k]).interpolate().values; return out; }
    duplicated(o) {
      o = typeof o === 'string' || Array.isArray(o) ? { subset: o } : (o || {});
      const cols = o.subset ? arr(o.subset) : this._c; this._need(cols);
      const keys = Array.from({ length: this._n }, (_, i) => cols.map(k => keyOf(this._d[k][i])).join('\u0001'));
      if (o.keep === false) { const c = new Map(); keys.forEach(k => c.set(k, (c.get(k) || 0) + 1)); return new Series(keys.map(k => c.get(k) > 1), 'duplikat'); }
      return new Series(keys, 'duplikat').duplicated({ keep: o.keep }).rename('duplikat');
    }
    drop_duplicates(o) { const d = this.duplicated(o).values; return this.filter(d.map(x => !x)); }
    outliers(c, o) { this._need(c); return outlierMask(this._d[c], o); }
    remove_outliers(c, o) { const m = this.outliers(c, o).values; return this.filter(m.map(x => !x)); }
    cap_outliers(c, o) { this._need(c); const b = outlierMask(this._d[c], o).bounds; const out = this.copy(); out._d[c] = out._d[c].map(v => isNum(v) ? Math.min(b[1], Math.max(b[0], v)) : v); return out; }
    strip_strings() { const out = this.copy(); for (const k of out._c) out._d[k] = out._d[k].map(v => typeof v === 'string' ? (v.trim() === '' ? null : v.trim().replace(/\s+/g, ' ')) : v); return out; }

    /* mengelompokkan & membentuk ulang */
    groupby(keys, o) {
      if (typeof keys === 'function') return new GroupBy(this.assign({ __kunci: keys }), ['__kunci'], o);
      return new GroupBy(this, arr(keys), o);
    }
    resample(dateCol, freq, o) {
      this._need(dateCol);
      const f = freqOf(freq);
      const start = this._d[dateCol].map(v => periodStart(toDate(v), f));
      const by = o && o.by ? arr(o.by) : [];
      const t = DataFrame._make([dateCol, ...by, ...this._c.filter(k => k !== dateCol && !by.includes(k))],
        Object.assign({}, this._d, { [dateCol]: start }), this._n);
      return new GroupBy(t, [dateCol, ...by], { fill_periods: !by.length ? f : null, sort: true });
    }
    pivot_table(o) {
      o = o || {};
      const idx = arr(o.index), colk = o.columns != null ? arr(o.columns) : [], vals = o.values != null ? arr(o.values) : this._c.filter(k => !idx.includes(k) && !colk.includes(k) && /int|number/.test(inferType(this._d[k])));
      this._need([...idx, ...colk, ...vals]);
      const fs = arr(o.aggfunc || 'mean');
      const multiF = fs.length > 1;
      const rowKeys = new Map(), colKeys = new Map(), cells = new Map();
      for (let i = 0; i < this._n; i++) {
        const rv = idx.map(k => this._d[k][i]), cv = colk.map(k => this._d[k][i]);
        if (o.dropna !== false && (rv.some(isNA) || cv.some(isNA))) continue;
        const rk = rv.map(keyOf).join('\u0001'), ck = cv.map(keyOf).join('\u0001');
        if (!rowKeys.has(rk)) rowKeys.set(rk, rv);
        if (!colKeys.has(ck)) colKeys.set(ck, cv);
        const ek = rk + '\u0002' + ck;
        let e = cells.get(ek); if (!e) { e = []; cells.set(ek, e); }
        e.push(i);
      }
      const sortE = m => [...m.entries()].sort((a, b) => { for (let j = 0; j < a[1].length; j++) { const c = cmpVal(a[1][j], b[1][j]); if (c) return c; } return 0; });
      const rows = o.sort === false ? [...rowKeys.entries()] : sortE(rowKeys), cols = o.sort === false ? [...colKeys.entries()] : sortE(colKeys);
      const d = {}, out = [...idx];
      idx.forEach((k, j) => { d[k] = rows.map(r => r[1][j]); });
      const label = (v, cv, f) => {
        const parts = [];
        if (vals.length > 1 || !colk.length) parts.push(v);
        if (colk.length) parts.push(cv.map(x => fmtCat(x)).join(' / '));
        if (multiF) parts.push(aggName(f));
        return parts.join('_');
      };
      const fill = o.fill_value !== undefined ? o.fill_value : null;
      for (const v of vals) for (const f of fs) {
        const fn = aggFn(f);
        for (const [ck, cv] of cols) {
          const name = label(v, cv, f); out.push(name);
          d[name] = rows.map(([rk]) => { const e = cells.get(rk + '\u0002' + ck); if (!e) return fill; const r = fn(e.map(i => this._d[v][i])); return isNA(r) ? fill : r; });
        }
        if (o.margins && colk.length) {
          const name = label(v, [o.margins_name || 'Total'], f); out.push(name);
          d[name] = rows.map(([rk]) => { const all = []; for (const [ck] of cols) { const e = cells.get(rk + '\u0002' + ck); if (e) for (const i of e) all.push(this._d[v][i]); } return fn(all); });
        }
      }
      let res = DataFrame._make(out, d, rows.length);
      if (o.margins) {
        const tot = {};
        idx.forEach((k, j) => { tot[k] = j === 0 ? (o.margins_name || 'Total') : null; });
        for (const v of vals) for (const f of fs) {
          const fn = aggFn(f);
          for (const [ck, cv] of cols) { const all = []; for (const [rk] of rows) { const e = cells.get(rk + '\u0002' + ck); if (e) for (const i of e) all.push(this._d[v][i]); } tot[label(v, cv, f)] = fn(all); }
          if (colk.length) tot[label(v, [o.margins_name || 'Total'], f)] = fn(this._d[v]);
        }
        res = concat([res, new DataFrame([tot])]);
      }
      return res;
    }
    pivot(o) {
      o = o || {};
      return this.pivot_table({ index: o.index, columns: o.columns, values: o.values, aggfunc: 'first', sort: o.sort });
    }
    melt(o) {
      o = o || {};
      const ids = arr(o.id_vars), vv = o.value_vars ? arr(o.value_vars) : this._c.filter(k => !ids.includes(k));
      this._need([...ids, ...vv]);
      const vn = o.var_name || 'variabel', valn = o.value_name || 'nilai';
      const d = {}; for (const k of ids) d[k] = []; d[vn] = []; d[valn] = [];
      for (const v of vv) for (let i = 0; i < this._n; i++) { for (const k of ids) d[k].push(this._d[k][i]); d[vn].push(v); d[valn].push(this._d[v][i]); }
      return DataFrame._make([...ids, vn, valn], d);
    }
    explode(c) {
      this._need(c);
      const idx = [], vals = [];
      for (let i = 0; i < this._n; i++) { const v = this._d[c][i]; if (Array.isArray(v) && v.length) for (const x of v) { idx.push(i); vals.push(x); } else { idx.push(i); vals.push(Array.isArray(v) ? null : v); } }
      const out = this._take(idx); out._d[c] = vals; return out;
    }
    merge(right, o) {
      o = typeof o === 'string' || Array.isArray(o) ? { on: o } : (o || {});
      if (!(right instanceof DataFrame)) right = new DataFrame(right);
      let lk = arr(o.left_on || o.on), rk = arr(o.right_on || o.on);
      if (!lk.length) { lk = rk = this._c.filter(k => right.has(k)); if (!lk.length) fail('merge: tidak ada kolom yang sama. Tentukan { on: "kolom" } atau { left_on, right_on }.'); }
      this._need(lk); right._need(rk);
      const how = o.how || 'inner', suf = o.suffixes || ['_x', '_y'];
      const same = o.on || (!o.left_on && !o.right_on);
      const idxR = new Map();
      for (let j = 0; j < right._n; j++) { const k = rk.map(c => keyOf(right._d[c][j])).join('\u0001'); if (rk.some(c => isNA(right._d[c][j]))) continue; let e = idxR.get(k); if (!e) idxR.set(k, e = []); e.push(j); }
      const pairs = [], usedR = new Set();
      for (let i = 0; i < this._n; i++) {
        const k = lk.map(c => keyOf(this._d[c][i])).join('\u0001');
        const m = lk.some(c => isNA(this._d[c][i])) ? null : idxR.get(k);
        if (m) for (const j of m) { pairs.push([i, j]); usedR.add(j); }
        else if (how === 'left' || how === 'outer') pairs.push([i, null]);
      }
      if (how === 'right' || how === 'outer') for (let j = 0; j < right._n; j++) if (!usedR.has(j)) pairs.push([null, j]);
      if (how === 'right') pairs.sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
      const lcols = this._c, rcols = right._c.filter(k => !(same && rk.includes(k)));
      const clash = new Set(lcols.filter(k => rcols.includes(k) && !(same && lk.includes(k))));
      const d = {}, cols = [];
      for (const k of lcols) {
        const name = clash.has(k) ? k + suf[0] : k; cols.push(name);
        const keyPos = same ? lk.indexOf(k) : -1;
        d[name] = pairs.map(([i, j]) => i != null ? this._d[k][i] : keyPos >= 0 ? right._d[rk[keyPos]][j] : null);
      }
      for (const k of rcols) { const name = clash.has(k) ? k + suf[1] : k; cols.push(name); d[name] = pairs.map(([, j]) => j != null ? right._d[k][j] : null); }
      if (o.indicator) { cols.push('_merge'); d._merge = pairs.map(([i, j]) => i != null && j != null ? 'both' : i != null ? 'left_only' : 'right_only'); }
      return DataFrame._make(cols, d, pairs.length);
    }
    join(right, o) { return this.merge(right, Object.assign({ how: 'left' }, o)); }
    concat(others, o) { return concat([this, ...arr(others)], o); }
    append(rows) { return concat([this, rows instanceof DataFrame ? rows : new DataFrame(arr(rows))]); }
    cumsum(cols) { const out = this.copy(); for (const k of cols ? arr(cols) : out._c.filter(c => /int|number/.test(inferType(out._d[c])))) out._d[k] = new Series(out._d[k]).cumsum().values; return out; }
    pct_change(cols) { const out = this.copy(); for (const k of cols ? arr(cols) : out._c.filter(c => /int|number/.test(inferType(out._d[c])))) out._d[k] = new Series(out._d[k]).pct_change().values; return out; }
    diff(cols) { const out = this.copy(); for (const k of cols ? arr(cols) : out._c.filter(c => /int|number/.test(inferType(out._d[c])))) out._d[k] = new Series(out._d[k]).diff().values; return out; }
    get_dummies(cols, o) { return getDummies(this, cols, o); }
    crosstab(a, b, o) { return crosstab(this.col(a), this.col(b), o); }
  }

  function concat(dfs, o) {
    o = o || {};
    dfs = arr(dfs).filter(x => x != null).map(x => x instanceof DataFrame ? x : new DataFrame(x));
    if (!dfs.length) return new DataFrame([]);
    if (o.axis === 1 || o.axis === 'columns') {
      const n = maxOf(dfs.map(d => d._n)), c = [], d = {};
      dfs.forEach((df, j) => df._c.forEach(k => { let name = k; while (d[name]) name = name + '_' + (j + 1); c.push(name); d[name] = Array.from({ length: n }, (_, i) => i < df._n ? df._d[k][i] : null); }));
      return DataFrame._make(c, d, n);
    }
    const cols = [];
    for (const df of dfs) for (const k of df._c) if (!cols.includes(k)) cols.push(k);
    const use = o.join === 'inner' ? cols.filter(k => dfs.every(df => df.has(k))) : cols;
    const d = Object.fromEntries(use.map(k => [k, []]));
    for (const df of dfs) for (const k of use) { const s = df._d[k]; if (s) for (let i = 0; i < df._n; i++) d[k].push(s[i]); else for (let i = 0; i < df._n; i++) d[k].push(null); }
    if (o.keys) { const lab = []; dfs.forEach((df, j) => { for (let i = 0; i < df._n; i++) lab.push(o.keys[j]); }); use.unshift(o.key_name || 'sumber'); d[use[0]] = lab; }
    return DataFrame._make(use, d);
  }

  function getDummies(df, cols, o) {
    if (cols && typeof cols === 'object' && !Array.isArray(cols)) { o = cols; cols = o.columns; }
    o = o || {};
    if (!(df instanceof DataFrame)) df = new DataFrame(df);
    cols = cols ? arr(cols) : df._c.filter(k => /string|boolean/.test(inferType(df._d[k])));
    df._need(cols);
    let out = df.drop(cols);
    for (const c of cols) {
      let cats = A.unique(df._d[c]).sort(cmpVal);
      if (o.categories && o.categories[c]) cats = o.categories[c];
      if (o.drop_first) cats = cats.slice(1);
      for (const v of cats) out.set(`${o.prefix === false ? '' : c + (o.prefix_sep ?? '_')}${fmtCat(v)}`, df._d[c].map(x => isNA(x) ? (o.dummy_na ? null : 0) : keyOf(x) === keyOf(v) ? 1 : 0));
    }
    return out;
  }

  function crosstab(a, b, o) {
    o = o || {};
    const an = a.name || 'baris', bn = b.name || 'kolom';
    const df = DataFrame._make([an, bn, '__n'], { [an]: a.values, [bn]: b.values, __n: a.values.map(() => 1) }, a.length);
    let t = df.pivot_table({ index: an, columns: bn, values: '__n', aggfunc: 'sum', fill_value: 0, margins: o.margins });
    const vc = t._c.filter(k => k !== an);
    if (o.normalize) {
      const out = t.copy();
      if (o.normalize === 'index' || o.normalize === 'baris') for (let i = 0; i < out._n; i++) { const s = vc.reduce((p, k) => p + (out._d[k][i] || 0), 0) / (o.margins ? 2 : 1); vc.forEach(k => { out._d[k][i] = s ? out._d[k][i] / s : 0; }); }
      else if (o.normalize === 'columns' || o.normalize === 'kolom') for (const k of vc) { const s = A.sum(out._d[k]) / (o.margins ? 2 : 1); out._d[k] = out._d[k].map(v => s ? v / s : 0); }
      else { const s = vc.reduce((p, k) => p + A.sum(out._d[k]), 0) / (o.margins ? 4 : 1); for (const k of vc) out._d[k] = out._d[k].map(v => s ? v / s : 0); }
      t = out;
    }
    return t;
  }

  function dateRange(start, o) {
    o = typeof o === 'number' ? { periods: o } : (o || {});
    const f = freqOf(o.freq || 'D');
    let s = toDate(start); if (!s) fail('date_range: tanggal awal tidak valid.');
    // "ME"/"QE"/"YE": akhir periode, "MS"/"QS"/"YS": awal periode (seperti pandas); "M" melangkah dari tanggal awal
    const anchor = String(o.freq || '').toUpperCase();
    if (/^(ME|QE|YE|BM)$/.test(anchor)) {
      const st0 = periodStart(s, f);
      const ends = i => { const n = addPeriod(st0, f, i + 1); return new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1, s.getHours(), s.getMinutes(), s.getSeconds()); };
      const out = []; const e = o.end != null ? toDate(o.end) : null;
      if (o.periods == null && !e) fail('date_range butuh { periods } atau { end }.');
      for (let i = 0; i < 1e6; i++) { const d = ends(i); if (o.periods != null ? i >= o.periods : d > e) break; out.push(d); }
      return new Series(out, o.name || 'tanggal');
    }
    if (/^(MS|QS|YS|AS)$/.test(anchor)) { const p0 = periodStart(s, f); if (p0 < new Date(s.getFullYear(), s.getMonth(), s.getDate())) s = addPeriod(p0, f, 1); }
    const out = [];
    if (o.periods != null) for (let i = 0; i < o.periods; i++) out.push(addPeriod(s, f, i));
    else { const e = toDate(o.end); if (!e) fail('date_range butuh { periods } atau { end }.'); for (let d = s, i = 0; d <= e && i < 1e6; d = addPeriod(s, f, ++i)) out.push(d); }
    return new Series(out, o.name || 'tanggal');
  }

  /* ======================================================================
   * GroupBy
   * ==================================================================== */

  class GroupBy {
    constructor(df, keys, o) {
      df._need(keys);
      this.df = df; this.keys = keys; this.o = o || {};
      const m = new Map();
      for (let i = 0; i < df._n; i++) {
        const kv = keys.map(k => df._d[k][i]);
        if (this.o.dropna !== false && kv.some(isNA)) continue;
        const k = kv.map(keyOf).join('\u0001');
        let e = m.get(k); if (!e) { e = { kv, idx: [] }; m.set(k, e); }
        e.idx.push(i);
      }
      let g = [...m.values()];
      if (this.o.sort !== false) g.sort((a, b) => { for (let j = 0; j < keys.length; j++) { const c = cmpVal(a.kv[j], b.kv[j]); if (c) return c; } return 0; });
      if (this.o.fill_periods && g.length > 1) {
        const f = this.o.fill_periods, full = [];
        let d = g[0].kv[0];
        const end = g[g.length - 1].kv[0], have = new Map(g.map(e => [e.kv[0].getTime(), e]));
        for (let i = 0; d <= end && i < 1e6; i++, d = addPeriod(g[0].kv[0], f, i)) full.push(have.get(d.getTime()) || { kv: [d], idx: [] });
        g = full;
      }
      this.groups = g;
    }
    get ngroups() { return this.groups.length; }
    [Symbol.iterator]() { return this.groups.map(e => [this.keys.length === 1 ? e.kv[0] : e.kv, this.df._take(e.idx)])[Symbol.iterator](); }
    get_group(k) { const kk = arr(k).map(keyOf).join('\u0001'); const e = this.groups.find(g => g.kv.map(keyOf).join('\u0001') === kk); if (!e) fail(`Kelompok "${k}" tidak ada.`); return this.df._take(e.idx); }
    _keysDF() { const d = {}; this.keys.forEach((k, j) => { d[k] = this.groups.map(e => e.kv[j]); }); return d; }
    _valueCols() { return this.df._c.filter(k => !this.keys.includes(k) && k !== '__kunci'); }
    agg(spec, o) {
      const d = this._keysDF(), cols = [...this.keys];
      const add = (name, col, f) => { this.df._need(col); const fn = aggFn(f); cols.push(name); d[name] = this.groups.map(e => fn(e.idx.map(i => this.df._d[col][i]))); };
      if (typeof spec === 'string' || typeof spec === 'function' || Array.isArray(spec)) {
        const fs = arr(spec);
        const vc = this._valueCols().filter(k => fs.every(f => ['count', 'size', 'nunique', 'first', 'last', 'min', 'max', 'mode', 'unique', 'list'].includes(aggName(f))) || /int|number|boolean/.test(inferType(this.df._d[k])));
        for (const c of vc) for (const f of fs) add(fs.length > 1 ? `${c}_${aggName(f)}` : c, c, f);
      } else {
        for (const name in spec) {
          const v = spec[name];
          if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && this.df.has(v[0]) && (typeof v[1] === 'function' || !this.df.has(v[1]))) add(name, v[0], v[1]);
          else if (v && typeof v === 'object' && !Array.isArray(v) && v.column) add(name, v.column, v.aggfunc || v.agg || 'sum');
          else { const fs = arr(v); for (const f of fs) add(fs.length > 1 ? `${name}_${aggName(f)}` : name, name, f); }
        }
      }
      return DataFrame._make(cols.filter(k => k !== '__kunci' || true).map(k => k === '__kunci' ? 'kelompok' : k), Object.fromEntries(cols.map(k => [k === '__kunci' ? 'kelompok' : k, d[k]])), this.groups.length);
    }
    aggregate(spec) { return this.agg(spec); }
    sum() { return this.agg('sum'); }
    mean() { return this.agg('mean'); }
    median() { return this.agg('median'); }
    min() { return this.agg('min'); }
    max() { return this.agg('max'); }
    std() { return this.agg('std'); }
    var() { return this.agg('var'); }
    first() { return this.agg('first'); }
    last() { return this.agg('last'); }
    nunique() { return this.agg('nunique'); }
    count() { return this.agg('count'); }
    size(name = 'jumlah') { const d = this._keysDF(); d[name] = this.groups.map(e => e.idx.length); return DataFrame._make([...this.keys, name].map(k => k === '__kunci' ? 'kelompok' : k), Object.fromEntries(Object.entries(d).map(([k, v]) => [k === '__kunci' ? 'kelompok' : k, v])), this.groups.length); }
    describe(col) {
      const c = col || this._valueCols().find(k => /int|number/.test(inferType(this.df._d[k])));
      return this.agg({ count: [c, 'count'], mean: [c, 'mean'], std: [c, 'std'], min: [c, 'min'], '25%': [c, 'p25'], '50%': [c, 'median'], '75%': [c, 'p75'], max: [c, 'max'] });
    }
    apply(f) {
      const parts = this.groups.map(e => {
        const sub = this.df._take(e.idx);
        const r = f(sub, this.keys.length === 1 ? e.kv[0] : e.kv);
        const kd = Object.fromEntries(this.keys.map((k, j) => [k, e.kv[j]]));
        if (r instanceof DataFrame) return r.assign(Object.fromEntries(this.keys.filter(k => !r.has(k)).map(k => [k, kd[k]]))).reorder(this.keys.filter(k => true));
        if (r && typeof r === 'object' && !(r instanceof Series)) return new DataFrame([Object.assign(kd, r)]);
        return new DataFrame([Object.assign(kd, { nilai: r instanceof Series ? r.values : r })]);
      });
      return concat(parts);
    }
    filter(f) {
      const keep = [];
      for (const e of this.groups) if (f(this.df._take(e.idx), this.keys.length === 1 ? e.kv[0] : e.kv)) pushAll(keep, e.idx);
      keep.sort((a, b) => a - b);
      return this.df._take(keep);
    }
    transform(col, f) {
      this.df._need(col);
      const out = Array(this.df._n).fill(null);
      const name = typeof f === 'string' ? f : null;
      for (const e of this.groups) {
        const s = new Series(e.idx.map(i => this.df._d[col][i]), col);
        let r;
        if (name && ['cumsum', 'cumprod', 'cummax', 'cummin', 'cumcount', 'pct_change', 'diff', 'shift', 'rank', 'zscore', 'normalize'].includes(name)) r = s[name]().values;
        else if (name === 'share' || name === 'proporsi') { const t = s.sum(); r = s.values.map(v => isNum(v) && t ? v / t : null); }
        else if (typeof f === 'function') { const x = f(s); r = x instanceof Series ? x.values : Array.isArray(x) ? x : e.idx.map(() => x); }
        else { const v = aggFn(f)(s.values); r = e.idx.map(() => v); }
        e.idx.forEach((i, k) => { out[i] = r[k]; });
      }
      return new Series(out, col);
    }
    rolling(col, w) { return { mean: () => this.transform(col, s => s.rolling(w).mean()), sum: () => this.transform(col, s => s.rolling(w).sum()) }; }
    cumsum(col) { return this.transform(col, 'cumsum'); }
    rank(col, o) { return this.transform(col, s => s.rank(o)); }
    head(n = 5) { const keep = []; for (const e of this.groups) pushAll(keep, e.idx.slice(0, n)); keep.sort((a, b) => a - b); return this.df._take(keep); }
    value_counts(col, o) { return this.df.groupby([...this.keys, col]).size().sort_values(['jumlah'], { ascending: !!(o && o.ascending) }); }
  }

  /* ======================================================================
   * Ekspresi query: "harga > 50000 and kota == 'Jayapura'"
   * ==================================================================== */

  function tokenize(s) {
    const t = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '`') { const j = s.indexOf('`', i + 1); if (j < 0) fail('Tanda ` tidak ditutup.'); t.push({ k: 'id', v: s.slice(i + 1, j) }); i = j + 1; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1, v = '';
        while (j < s.length && s[j] !== c) { if (s[j] === '\\' && j + 1 < s.length) { v += s[j + 1]; j += 2; } else v += s[j++]; }
        if (j >= s.length) fail('Tanda kutip tidak ditutup.');
        t.push({ k: 'str', v }); i = j + 1; continue;
      }
      let m = s.slice(i).match(/^(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)/i);
      if (m) { t.push({ k: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
      m = s.slice(i).match(/^(==|!=|<=|>=|&&|\|\||\*\*|\/\/|[<>=+\-*/%(),\[\]!&|~.])/);
      if (m) { t.push({ k: 'op', v: m[0] }); i += m[0].length; continue; }
      m = s.slice(i).match(/^@?[\p{L}_][\p{L}\p{N}_]*/u);
      if (m) { t.push({ k: 'id', v: m[0] }); i += m[0].length; continue; }
      fail(`Karakter "${c}" tidak dikenali dalam ekspresi.`);
    }
    return t;
  }

  const QFN = {
    abs: Math.abs, round: (v, d) => round(v, d || 0), floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, log: Math.log, exp: Math.exp, min: Math.min, max: Math.max,
    len: v => isNA(v) ? null : String(v).length, lower: v => isNA(v) ? null : String(v).toLowerCase(), upper: v => isNA(v) ? null : String(v).toUpperCase(),
    contains: (v, p) => !isNA(v) && String(v).toLowerCase().includes(String(p).toLowerCase()), startswith: (v, p) => !isNA(v) && String(v).startsWith(p), endswith: (v, p) => !isNA(v) && String(v).endsWith(p),
    isna: isNA, isnull: isNA, notna: v => !isNA(v), notnull: v => !isNA(v),
    year: v => { const d = toDate(v); return d ? d.getFullYear() : null; }, month: v => { const d = toDate(v); return d ? d.getMonth() + 1 : null; }, day: v => { const d = toDate(v); return d ? d.getDate() : null; },
    weekday: v => { const d = toDate(v); return d ? (d.getDay() + 6) % 7 : null; }, quarter: v => { const d = toDate(v); return d ? Math.floor(d.getMonth() / 3) + 1 : null; },
    date: v => toDate(v), str: v => isNA(v) ? null : String(v), num: v => toNumber(v), between: (v, a, b) => !isNA(v) && cmpLoose(v, a) >= 0 && cmpLoose(v, b) <= 0
  };

  /** Kunci urut numerik untuk satu kolom: angka/tanggal/boolean apa adanya, teks memakai peringkat hasil cmpVal. */
  function sortKeys(col) {
    const n = col.length, r = new Float64Array(n);
    let simple = true;
    for (let i = 0; i < n; i++) {
      const v = col[i];
      if (isNA(v)) r[i] = NaN;
      else if (typeof v === 'number') r[i] = v;
      else if (v instanceof Date) r[i] = v.getTime();
      else if (typeof v === 'boolean') r[i] = v ? 1 : 0;
      else { simple = false; break; }
    }
    if (simple) return r;
    const uniq = [...new Set(col.filter(v => !isNA(v)))].sort(cmpVal), rank = new Map(uniq.map((v, i) => [v, i]));
    for (let i = 0; i < n; i++) { const v = col[i]; r[i] = isNA(v) ? NaN : rank.get(v); }
    return r;
  }
  function compileExpr(src, df, vars) {
    const t = tokenize(src);
    let p = 0;
    const peek = () => t[p], next = () => t[p++];
    const isOp = (v) => t[p] && t[p].k === 'op' && t[p].v === v;
    const isKw = (v) => t[p] && t[p].k === 'id' && t[p].v.toLowerCase() === v;
    const expect = v => { if (!isOp(v)) fail(`Ekspresi "${src}": diharapkan "${v}".`); p++; };
    function primary() {
      const tk = next();
      if (!tk) fail(`Ekspresi "${src}" tidak lengkap.`);
      if (tk.k === 'num') return () => tk.v;
      if (tk.k === 'str') return () => tk.v;
      if (tk.k === 'op' && tk.v === '(') { const e = orE(); expect(')'); return e; }
      if (tk.k === 'op' && tk.v === '[') {
        const items = [];
        if (!isOp(']')) { do { items.push(orE()); } while (isOp(',') && ++p); }
        expect(']');
        return i => items.map(f => f(i));
      }
      if (tk.k === 'id') {
        const low = tk.v.toLowerCase();
        if (low === 'true' || low === 'benar') return () => true;
        if (low === 'false' || low === 'salah') return () => false;
        if (low === 'null' || low === 'none' || low === 'nan') return () => null;
        if (tk.v.startsWith('@')) { const k = tk.v.slice(1); if (!(k in vars)) fail(`Variabel @${k} tidak diberikan. Kirim lewat df.query(teks, { ${k}: nilai }).`); return () => vars[k]; }
        if (isOp('(') && !df.has(tk.v)) {
          const fn = QFN[low]; if (!fn) fail(`Fungsi "${tk.v}" tidak dikenal di query. Yang tersedia: ${Object.keys(QFN).join(', ')}.`);
          p++; const args = [];
          if (!isOp(')')) { do { args.push(orE()); } while (isOp(',') && ++p); }
          expect(')');
          return i => fn(...args.map(a => a(i)));
        }
        let colName = tk.v;
        if (!df.has(colName)) {
          if (Object.prototype.hasOwnProperty.call(vars, colName)) { const v = vars[colName]; return () => v; }
          df._need(colName);
        }
        const col = df._d[colName];
        let f = i => col[i];
        while (isOp('.')) {
          p++;
          const acc = next().v;
          if (acc === 'str' || acc === 'dt') { if (isOp('.')) continue; }
          const m = acc.toLowerCase();
          const prev = f;
          if (isOp('(')) {
            p++; const args = [];
            if (!isOp(')')) { do { args.push(orE()); } while (isOp(',') && ++p); }
            expect(')');
            const fn = QFN[m] || (m === 'isin' ? (v, l) => arr(l).some(x => cmpLoose(v, x) === 0) : null);
            if (!fn) fail(`Metode ".${acc}()" tidak dikenal di query.`);
            f = i => fn(prev(i), ...args.map(a => a(i)));
          } else {
            const fn = QFN[m]; if (!fn) fail(`Properti ".${acc}" tidak dikenal di query.`);
            f = i => fn(prev(i));
          }
        }
        return f;
      }
      fail(`Ekspresi "${src}": "${tk.v}" tidak terduga.`);
    }
    function unary() {
      if (isOp('-')) { p++; const e = unary(); return i => { const v = e(i); return isNum(v) ? -v : null; }; }
      if (isOp('!') || isOp('~') || isKw('not') || isKw('tidak')) { p++; const e = unary(); return i => !e(i); }
      return power();
    }
    function power() { const a = primary(); if (isOp('**')) { p++; const b = unary(); return i => BIN.pow(a(i), b(i)); } return a; }
    function mul() {
      let a = unary();
      while (isOp('*') || isOp('/') || isOp('%') || isOp('//')) {
        const op = next().v, b = unary(), l = a;
        a = op === '*' ? i => BIN.mul(l(i), b(i)) : op === '/' ? i => BIN.div(l(i), b(i)) : op === '//' ? i => BIN.floordiv(l(i), b(i)) : i => BIN.mod(l(i), b(i));
      }
      return a;
    }
    function add() {
      let a = mul();
      while (isOp('+') || isOp('-')) { const op = next().v, b = mul(), l = a; a = op === '+' ? i => BIN.add(l(i), b(i)) : i => BIN.sub(l(i), b(i)); }
      return a;
    }
    function cmp() {
      const a = add();
      const ops = ['==', '!=', '<=', '>=', '<', '>', '='];
      if (t[p] && t[p].k === 'op' && ops.includes(t[p].v)) {
        let op = next().v; if (op === '=') op = '==';
        const b = add();
        const f = { '==': BIN.eq, '!=': BIN.ne, '<': BIN.lt, '<=': BIN.le, '>': BIN.gt, '>=': BIN.ge }[op];
        return i => f(a(i), b(i));
      }
      if (isKw('in') || (isKw('not') && t[p + 1] && t[p + 1].k === 'id' && t[p + 1].v.toLowerCase() === 'in')) {
        const neg = isKw('not'); p += neg ? 2 : 1;
        const b = add();
        return i => { const l = b(i), v = a(i); const r = arr(l).some(x => cmpLoose(v, x) === 0); return neg ? !r : r; };
      }
      if (isKw('between')) { p++; const lo = add(); if (!isKw('and')) fail('between butuh "and".'); p++; const hi = add(); return i => QFN.between(a(i), lo(i), hi(i)); }
      if (isKw('is')) { p++; const neg = isKw('not'); if (neg) p++; const b = add(); return i => { const r = isNA(b(i)) ? isNA(a(i)) : cmpLoose(a(i), b(i)) === 0; return neg ? !r : r; }; }
      return a;
    }
    function andE() { let a = cmp(); while (isKw('and') || isKw('dan') || isOp('&&') || isOp('&')) { p++; const b = cmp(), l = a; a = i => !!l(i) && !!b(i); } return a; }
    function orE() { let a = andE(); while (isKw('or') || isKw('atau') || isOp('||') || isOp('|')) { p++; const b = andE(), l = a; a = i => !!l(i) || !!b(i); } return a; }
    const f = orE();
    if (p < t.length) fail(`Ekspresi "${src}": ada sisa "${t[p].v}" yang tidak dimengerti.`);
    return f;
  }

  /* ======================================================================
   * Membaca berkas: CSV, JSON, Excel, Google Sheets
   * ==================================================================== */

  const IO_CACHE = new Map();
  const UP_CACHE = new WeakMap();

  function looksLikeText(s) { return /[\n\r]/.test(s) || /^\s*[[{]/.test(s) || (s.includes(',') && !/\.(csv|tsv|txt|json|xlsx?)$/i.test(s) && !/^https?:/i.test(s) && s.length > 60); }

  function embedded(name) {
    if (typeof document === 'undefined') return null;
    const base = String(name).split(/[?#]/)[0];
    const short = base.split('/').pop();
    const list = document.querySelectorAll('script[data-file],script[data-name]');
    for (const el of list) {
      const n = el.getAttribute('data-file') || el.getAttribute('data-name');
      if (n === base || n === short) return el;
    }
    return null;
  }
  function b64bytes(b64) {
    const bin = atob(b64.replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  const fileError = (name, why) => {
    const local = typeof location !== 'undefined' && location.protocol === 'file:';
    if (/^https?:/i.test(name)) return new Error(remoteHint(name, why, local));
    return new Error(`Berkas "${name}" tidak bisa dibaca${why ? ' (' + why + ')' : ''}. ` + (local
      ? 'Saat halaman dibuka dengan klik dua kali, browser melarang membaca berkas lain di komputer. Pilihan: (1) bungkus data menjadi berkas .js (Slak Studio: Alat → Bungkus data, atau bungkus.html), (2) unggah lewat sl.file_uploader, (3) buka lewat Slak Studio, yang otomatis menyematkan data saat ekspor, atau (4) unggah halaman dan berkas data ke hosting.'
      : 'Pastikan nama dan letak berkas benar (huruf besar/kecil berpengaruh di hosting).'));
  };
  Slak._remoteHint = (url, why) => remoteHint(url, why, typeof location !== 'undefined' && location.protocol === 'file:');
  /** Pesan untuk alamat internet yang gagal dibaca: offline, HTTP galat, atau diblokir CORS. */
  function remoteHint(url, why, local) {
    const host = String(url).split('/')[2] || url;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return `Tidak bisa membaca ${host}: perangkat sedang offline. Sambungkan ke internet lalu jalankan ulang.`;
    if (/^HTTP 404/.test(why || '')) return `Alamat ${url} tidak ditemukan (HTTP 404). Periksa kembali alamatnya.`;
    if (/^HTTP 40[13]/.test(why || '')) return `${host} menolak akses (${why}). Data ini mungkin privat atau butuh login.`;
    if (/^HTTP/.test(why || '')) return `${host} sedang bermasalah (${why}). Coba lagi nanti.`;
    return `Data dari ${host} tidak bisa dibaca. Kemungkinan server itu tidak mengizinkan datanya dibaca langsung oleh halaman web ` +
      (local ? 'yang dibuka dengan klik dua kali (aturan CORS browser), atau server itu sedang tidak bisa dihubungi. ' : 'dari situs lain (aturan CORS browser), atau sedang tidak bisa dihubungi. ') +
      'Pilihan: (1) jalankan di Slak Studio, yang mengunduh tanpa batasan ini' + (local ? ', (2) unggah halaman ke hosting (GitHub Pages atau cPanel); sebagian server mengizinkan alamat web tetapi tidak halaman klik dua kali, (3)' : ', (2)') +
      ' unduh berkasnya, taruh di folder halaman, lalu baca dengan nama berkasnya.';
  }

  /** Ambil isi sumber sebagai Uint8Array. */
  async function getBytes(src) {
    if (src == null) fail('Sumber data kosong.');
    if (src instanceof Uint8Array) return src;
    if (src instanceof ArrayBuffer) return new Uint8Array(src);
    if (typeof Blob !== 'undefined' && src instanceof Blob) return new Uint8Array(await src.arrayBuffer());
    if (typeof src === 'object' && src.bytes instanceof Uint8Array) return src.bytes;
    if (Array.isArray(src)) fail('Berikan satu berkas. Untuk banyak berkas, baca satu per satu dalam perulangan.');
    const name = String(src);
    if (typeof Slak.load_file === 'function') return Slak.load_file(name, { error: fileError });
    const el = embedded(name);
    if (el) {
      if ((el.getAttribute('data-encoding') || '').toLowerCase() === 'base64') return b64bytes(el.textContent);
      return new TextEncoder().encode(el.textContent.replace(/^\n/, ''));
    }
    let res;
    try { res = await fetch(name); }
    catch (e) { throw fileError(name, e.message); }
    if (!res.ok) throw fileError(name, 'HTTP ' + res.status);
    return new Uint8Array(await res.arrayBuffer());
  }
  function decodeText(bytes, enc) {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    try { return new TextDecoder(enc || 'utf-8', { fatal: !enc }).decode(bytes); }
    catch (e) { return new TextDecoder('windows-1252').decode(bytes); }
  }
  async function getText(src, o) {
    if (typeof src === 'string' && looksLikeText(src)) return src;
    if (src && typeof src === 'object' && typeof src.text === 'string' && !src.bytes) return src.text;
    return decodeText(await getBytes(src), o && o.encoding);
  }
  async function cached(src, o, kind, load) {
    if (o && o.cache === false) return load();
    if (src && typeof src === 'object') {
      let m = UP_CACHE.get(src); if (!m) UP_CACHE.set(src, m = new Map());
      const k = kind + JSON.stringify(o || {});
      if (!m.has(k)) m.set(k, load().catch(e => { m.delete(k); throw e; }));
      return (await m.get(k)).copy();
    }
    const k = kind + '\u0000' + String(src) + '\u0000' + JSON.stringify(o || {});
    if (!IO_CACHE.has(k)) IO_CACHE.set(k, load().catch(e => { IO_CACHE.delete(k); throw e; }));
    return (await IO_CACHE.get(k)).copy();
  }


  /* ---------- batas ukuran data (diukur di Slak 1.6; lihat buku Bab 32) ---------- */
  const LIMITS = { nyaman: 100000, berat: 1000000 };   // jumlah baris; ubah lewat Slak.data.limits
  function sizeCheck(df) {
    const n = df._n;
    if (!(n >= LIMITS.nyaman) || typeof Slak._dataWarn !== 'function') return df;
    const f = x => x.toLocaleString('id-ID');
    Slak._dataWarn(n >= LIMITS.berat
      ? `Data ${f(n)} baris melewati batas berat Slak (${f(LIMITS.berat)} baris). Halaman bisa terasa lambat atau kehabisan memori di HP. Ringkas dulu dengan sl.duckdb("SELECT ... GROUP BY ...", { data: df }) atau baca berkasnya langsung dengan DuckDB, lalu tampilkan hasil ringkasnya saja.`
      : `Data ${f(n)} baris sudah di atas batas nyaman Slak (${f(LIMITS.nyaman)} baris). Masih bisa dipakai, tetapi di laptop/HP biasa tiap perubahan widget bisa terasa beberapa detik. Untuk data sebesar ini, ringkas dengan sl.duckdb atau sl.sql lalu tampilkan hasil ringkasnya.`,
      'ukuran-data:' + (n >= LIMITS.berat ? 'berat' : 'nyaman'));
    return df;
  }

  /* ---------- CSV ---------- */

  function detectDelim(text) {
    const lines = text.slice(0, 65536).split(/\r?\n/).filter(l => l.trim()).slice(0, 10);
    let best = ',', bs = -1;
    for (const d of [',', ';', '\t', '|']) {
      const c = lines.map(l => splitCount(l, d));
      const ok = c.length && c.every(x => x === c[0]) ? c[0] : minOf(c);
      if (ok > bs) { bs = ok; best = d; }
    }
    return best;
  }
  function splitCount(l, d) { let n = 0, q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === d && !q) n++; } return n; }

  function fromCSV(text, o, pre) {
    o = o || {};
    let sep, rows;
    if (pre) { sep = pre.sep; rows = pre.rows; }
    else {
      text = String(text).replace(/^﻿/, '');
      sep = o.sep || o.delimiter || detectDelim(text);
      rows = parseCSV(text, { delimiter: sep, header: false, numbers: false });
    }
    let skip = o.skiprows || 0;
    while (skip-- > 0) rows.shift();
    let head;
    if (o.header === false || o.header === null) head = o.names || rows[0].map((_, i) => 'kolom_' + (i + 1));
    else { head = (rows.shift() || []).map((x, i) => String(x).trim() || 'kolom_' + (i + 1)); if (o.names) head = o.names; }
    const seen = {};
    head = head.map(hd => { if (seen[hd]) { seen[hd]++; return hd + '_' + seen[hd]; } seen[hd] = 1; return hd; });
    const n = o.nrows != null ? Math.min(o.nrows, rows.length) : rows.length;
    const na = new Set(['', 'NA', 'N/A', 'NaN', 'nan', 'null', 'NULL', 'None', '#N/A', '-', ...(o.na_values || [])]);
    let naMax = 0; for (const x of na) naMax = Math.max(naMax, String(x).length);
    const d = {};
    const dec = o.decimal || (sep === ';' ? ',' : '.');
    // satu lintasan baris demi baris (urut di memori) untuk mengisi semua kolom sekaligus
    const ncol = head.length, cols = head.map(() => new Array(n));
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      for (let j = 0; j < ncol; j++) {
        const v = r[j];
        if (v == null || v === '') { cols[j][i] = null; continue; }
        // nilai panjang tanpa spasi di tepi pasti bukan penanda kosong: lewati trim + pencarian
        if (v.length > naMax && v.charCodeAt(0) > 32 && v.charCodeAt(v.length - 1) > 32) { cols[j][i] = v; continue; }
        cols[j][i] = na.has(String(v).trim()) ? null : v;
      }
    }
    head.forEach((hd, j) => {
      let col = cols[j];
      const forced = o.dtype && o.dtype[hd];
      if (forced) col = castArray(col, forced);
      else if (o.numbers !== false) col = inferColumn(col, dec, o);
      d[hd] = col;
    });
    let df = DataFrame._make(head, d, n);
    if (o.usecols) df = df.select(o.usecols);
    if (o.parse_dates && o.parse_dates !== true) df = df.to_datetime(o.parse_dates, { dayfirst: o.dayfirst, format: o.date_format });
    return sizeCheck(df);
  }

  function inferColumn(col, dec, o) {
    let numOk = true, dateOk = o.parse_dates !== false, boolOk = true, any = false;
    const numRe = dec === ',' ? /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/ : /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
    const plainRe = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
    const dateRe = /^(\d{4}-\d{1,2}-\d{1,2}([T ]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?)?|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}([ T]\d{1,2}[:.]\d{2}([:.]\d{2})?)?)$/;
    for (const v of col) {
      if (v == null) continue;
      any = true;
      const s = String(v).trim();
      if (numOk && !numRe.test(s) && !plainRe.test(s)) numOk = false;
      if (dateOk && !dateRe.test(s)) dateOk = false;
      if (boolOk && !/^(true|false|TRUE|FALSE|True|False)$/.test(s)) boolOk = false;
      if (!numOk && !dateOk && !boolOk) break;
    }
    if (!any) return col;
    if (numOk && dec === '.') { const DN = { decimal: dec }; return col.map(v => v == null ? null : plainRe.test(v) ? +v : toNumber(v, DN)); }
    if (numOk) return col.map(v => v == null ? null : (plainRe.test(String(v).trim()) && !(dec === ',' && /\./.test(v) && /^-?\d{1,3}(\.\d{3})+$/.test(String(v).trim())) ? Number(v) : toNumber(v, { decimal: dec })));
    if (boolOk) return col.map(v => v == null ? null : /^true$/i.test(String(v).trim()));
    if (dateOk) return col.map(v => toDate(v, { dayfirst: o.dayfirst }));
    return col;
  }

  /* CSV besar (Slak 1.9): pemotongan teks, penanda kosong, dan penebakan angka/ya-tidak dikerjakan di
   * Web Worker supaya halaman tidak membeku. Kolom angka dikirim balik sebagai Float64Array (tanpa salin).
   * Hasilnya sama persis dengan jalur biasa; tanggal tetap ditebak di halaman. */
  const CSV_WORKER_MIN = 5 * 1024 * 1024;
  const CSV_WORKER_FN = function (text, sep, csvSrc, naList, numOn, dateOn) {
    const csvRows = (0, eval)('(' + csvSrc + ')');
    const rows = csvRows(text, sep);
    const head = rows.shift() || [];
    const n = rows.length, ncol = head.length, na = new Set(naList);
    let naMax = 0; for (const x of na) naMax = Math.max(naMax, String(x).length);
    const numRe = /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/, plainRe = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/, boolRe = /^(true|false|TRUE|FALSE|True|False)$/;
    const cols = [], transfer = [];
    for (let j = 0; j < ncol; j++) {
      const c = new Array(n);
      for (let i = 0; i < n; i++) {
        const v = rows[i][j];
        if (v == null || v === '') { c[i] = null; continue; }
        if (v.length > naMax && v.charCodeAt(0) > 32 && v.charCodeAt(v.length - 1) > 32) { c[i] = v; continue; }
        c[i] = na.has(String(v).trim()) ? null : v;
      }
      let numOk = numOn, boolOk = numOn, any = false;
      for (let i = 0; i < n && (numOk || boolOk); i++) {
        const v = c[i]; if (v == null) continue; any = true;
        const t = String(v).trim();
        if (numOk && !numRe.test(t) && !plainRe.test(t)) numOk = false;
        if (boolOk && !boolRe.test(t)) boolOk = false;
      }
      if (any && numOk) {
        const data = new Float64Array(n), nul = new Uint8Array(n);
        for (let i = 0; i < n; i++) { const v = c[i]; if (v == null) nul[i] = 1; else data[i] = +String(v).trim(); }
        cols.push({ k: 'num', data, nul }); transfer.push(data.buffer, nul.buffer);
      } else if (any && boolOk) {
        const data = new Uint8Array(n);
        for (let i = 0; i < n; i++) { const v = c[i]; data[i] = v == null ? 2 : /^true$/i.test(String(v).trim()) ? 1 : 0; }
        cols.push({ k: 'bool', data }); transfer.push(data.buffer);
      } else if (any && dateOn) {
        // tanggal ISO (YYYY-MM-DD, boleh dengan jam): diurai di sini dengan aturan yang sama dengan toDate (waktu lokal)
        const isoRe = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;
        let ok = true;
        const ms = new Float64Array(n), nul = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          const v = c[i]; if (v == null) { nul[i] = 1; continue; }
          const m = String(v).trim().match(isoRe);
          if (!m) { ok = false; break; }
          let y = +m[1]; if (y < 100) y += y < 70 ? 2000 : 1900;
          const mo = +m[2] - 1, d = +m[3];
          const dt = new Date(y, mo, d, +m[4] || 0, +m[5] || 0, +m[6] || 0);
          if (dt.getMonth() !== ((mo % 12) + 12) % 12 && d <= 31) nul[i] = 1; else ms[i] = dt.getTime();
        }
        if (ok) { cols.push({ k: 'date', data: ms, nul }); transfer.push(ms.buffer, nul.buffer); }
        else cols.push({ k: 'str', data: c });
      } else cols.push({ k: 'str', data: c });
    }
    return { head, n, cols };
  };
  async function fromCSVAsync(text, o) {
    o = o || {};
    text = String(text).replace(/^﻿/, '');
    const simple = !o.skiprows && o.header !== false && o.header !== null && !o.names && o.nrows == null && !o.na_values && !o.dtype && o.numbers !== false;
    if (!simple || o.worker === false || text.length < (o.worker === true ? 0 : CSV_WORKER_MIN) || !Slak._runWorker || !Slak._csvRowsSrc) return fromCSV(text, o);
    const sep = o.sep || o.delimiter || detectDelim(text);
    const dec = o.decimal || (sep === ';' ? ',' : '.');
    const NA = ['', 'NA', 'N/A', 'NaN', 'nan', 'null', 'NULL', 'None', '#N/A', '-'];
    let r;
    try { r = await Slak._runWorker(CSV_WORKER_FN.toString(), [text, sep, Slak._csvRowsSrc, NA, dec === '.', o.parse_dates !== false]); }
    catch (e) { return fromCSV(text, o); }
    let head = r.head.map((x, i) => String(x).trim() || 'kolom_' + (i + 1));
    const seen = {};
    head = head.map(hd => { if (seen[hd]) { seen[hd]++; return hd + '_' + seen[hd]; } seen[hd] = 1; return hd; });
    const d = {}, n = r.n;
    head.forEach((hd, j) => {
      const c = r.cols[j] || { k: 'str', data: new Array(n).fill(null) };
      let col;
      if (c.k === 'num') { col = new Array(n); for (let i = 0; i < n; i++) col[i] = c.nul[i] ? null : c.data[i]; }
      else if (c.k === 'date') { col = new Array(n); for (let i = 0; i < n; i++) col[i] = c.nul[i] ? null : new Date(c.data[i]); }
      else if (c.k === 'bool') { col = new Array(n); for (let i = 0; i < n; i++) col[i] = c.data[i] === 2 ? null : c.data[i] === 1; }
      else col = inferColumn(c.data, dec, o);
      d[hd] = col;
    });
    let df = DataFrame._make(head, d, n);
    if (o.usecols) df = df.select(o.usecols);
    if (o.parse_dates && o.parse_dates !== true) df = df.to_datetime(o.parse_dates, { dayfirst: o.dayfirst, format: o.date_format });
    return sizeCheck(df);
  }
  async function readCSV(src, o) {
    o = o || {};
    return cached(src, o, 'csv', async () => fromCSVAsync(await getText(src, o), o));
  }

  /* ---------- JSON ---------- */

  function fromJSON(v, o) {
    o = o || {};
    if (typeof v === 'string') v = JSON.parse(v);
    if (o.path) for (const k of String(o.path).split('.')) v = v == null ? v : v[k];
    if (v && !Array.isArray(v) && typeof v === 'object' && !Object.values(v).every(Array.isArray)) {
      const arrKey = Object.keys(v).find(k => Array.isArray(v[k]) && v[k].length && typeof v[k][0] === 'object');
      if (arrKey) v = v[arrKey];
    }
    let df = new DataFrame(Array.isArray(v) ? v.map(r => o.flatten === false ? r : flatten(r)) : v);
    if (o.parse_dates !== false) for (const k of df._c) {
      const c = df._d[k];
      if (c.length && c.every(x => x == null || (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(x))) && c.some(x => x != null)) df._d[k] = c.map(x => toDate(x));
    }
    return sizeCheck(df);
  }
  function flatten(r, pre, out) {
    out = out || {};
    if (r === null || typeof r !== 'object' || r instanceof Date) { out[pre || 'nilai'] = r; return out; }
    for (const k of Object.keys(r)) {
      const v = r[k], key = pre ? pre + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) flatten(v, key, out);
      else out[key] = v;
    }
    return out;
  }
  async function readJSON(src, o) {
    if (src && typeof src === 'object' && !(src instanceof Blob) && !(src instanceof Uint8Array) && !src.bytes && typeof src.text !== 'string') return fromJSON(src, o);
    return cached(src, o, 'json', async () => fromJSON(await getText(src, o), o));
  }

  /* ---------- ZIP (untuk xlsx), memakai DecompressionStream bawaan browser ---------- */

  const u16 = (b, i) => b[i] | (b[i + 1] << 8);
  const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  async function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') fail('Browser ini terlalu lama untuk membaca Excel. Gunakan Chrome, Edge, Firefox, atau Safari versi terbaru, atau simpan berkas sebagai CSV.');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function unzipIndex(b) {
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
    if (e < 0) fail('Berkas bukan Excel (.xlsx) yang valid. Jika berkasnya .xls lama, simpan ulang sebagai .xlsx atau CSV.');
    const count = u16(b, e + 10), off = u32(b, e + 16);
    const files = new Map();
    let p = off;
    for (let k = 0; k < count; k++) {
      if (u32(b, p) !== 0x02014b50) break;
      const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), lho = u32(b, p + 42);
      const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
      const ds = lho + 30 + u16(b, lho + 26) + u16(b, lho + 28);
      files.set(name, { method, data: b.subarray(ds, ds + csize) });
      p += 46 + nlen + xlen + clen;
    }
    return {
      has: n => files.has(n),
      names: () => [...files.keys()],
      async text(n) {
        const f = files.get(n) || files.get(n.replace(/^\//, ''));
        if (!f) return null;
        const raw = f.method === 0 ? f.data : f.method === 8 ? await inflateRaw(f.data) : fail('Metode kompresi Excel tidak didukung.');
        return new TextDecoder().decode(raw);
      }
    };
  }

  /* ---------- Excel (.xlsx) ---------- */

  function xmlDoc(s) {
    const d = new DOMParser().parseFromString(s, 'application/xml');
    return d;
  }
  const tags = (node, name) => node ? [...node.getElementsByTagNameNS('*', name)] : [];
  const kids = (node, name) => node ? [...node.childNodes].filter(c => c.nodeType === 1 && c.localName === name) : [];
  function colIndex(ref) { let n = 0; for (const ch of ref) { const c = ch.charCodeAt(0); if (c < 65 || c > 90) break; n = n * 26 + c - 64; } return n - 1; }
  function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function isDateFormat(code) {
    if (!code) return false;
    const c = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    return /[dmyhs]/i.test(c) && !/^general$/i.test(c);
  }

  async function workbook(src) {
    const z = unzipIndex(await getBytes(src));
    const wb = xmlDoc(await z.text('xl/workbook.xml') || fail('Isi Excel tidak lengkap (workbook.xml tidak ada).'));
    const rels = xmlDoc(await z.text('xl/_rels/workbook.xml.rels') || '<Relationships/>');
    const relMap = new Map(tags(rels, 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
    const date1904 = tags(wb, 'workbookPr').some(n => /^(1|true)$/.test(n.getAttribute('date1904') || ''));
    const sheets = tags(wb, 'sheet').map(s => {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let t = relMap.get(rid) || '';
      t = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
      return { name: s.getAttribute('name'), path: t };
    });
    const sstX = await z.text('xl/sharedStrings.xml');
    const sst = sstX ? tags(xmlDoc(sstX), 'si').map(si => tags(si, 't').filter(t => !t.parentNode || t.parentNode.localName !== 'rPh').map(t => t.textContent).join('')) : [];
    const stX = await z.text('xl/styles.xml');
    let dateStyle = [];
    if (stX) {
      const st = xmlDoc(stX);
      const custom = new Map(tags(st, 'numFmt').map(f => [+f.getAttribute('numFmtId'), f.getAttribute('formatCode')]));
      const xfs = kids(tags(st, 'cellXfs')[0], 'xf');
      dateStyle = xfs.map(x => {
        const id = +x.getAttribute('numFmtId');
        return (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58) || isDateFormat(custom.get(id));
      });
    }
    return { z, sheets, sst, dateStyle, date1904 };
  }

  async function readSheetRows(wb, sheet) {
    let sh;
    if (sheet == null || sheet === 0) sh = wb.sheets[0];
    else if (isNum(sheet)) sh = wb.sheets[sheet];
    else sh = wb.sheets.find(s => s.name === sheet) || wb.sheets.find(s => s.name.toLowerCase() === String(sheet).toLowerCase());
    if (!sh) fail(`Sheet "${sheet}" tidak ada. Sheet yang tersedia: ${wb.sheets.map(s => s.name).join(', ')}.`);
    const x = xmlDoc(await wb.z.text(sh.path) || fail('Sheet kosong atau rusak.'));
    const rows = [];
    for (const r of tags(x, 'row')) {
      const ri = (+r.getAttribute('r') || rows.length + 1) - 1;
      const row = rows[ri] || (rows[ri] = []);
      let ci = 0;
      for (const c of kids(r, 'c')) {
        const ref = c.getAttribute('r');
        if (ref) ci = colIndex(ref);
        const t = c.getAttribute('t'), s = +(c.getAttribute('s') || 0);
        const vEl = kids(c, 'v')[0];
        let v = vEl ? vEl.textContent : null;
        if (t === 's') v = v == null ? null : wb.sst[+v];
        else if (t === 'inlineStr') v = tags(c, 't').map(n => n.textContent).join('');
        else if (t === 'b') v = v === '1';
        else if (t === 'e') v = null;
        else if (t === 'str') v = v;
        else if (t === 'd') v = v ? toDate(v) : null;
        else if (v != null && v !== '') {
          v = Number(v);
          if (wb.dateStyle[s]) v = excelDate(v + (wb.date1904 ? 1462 : 0));
        } else v = null;
        row[ci] = v;
        ci++;
      }
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    return { rows, name: sh.name };
  }

  async function readExcel(src, o) {
    o = typeof o === 'string' || isNum(o) ? { sheet: o } : (o || {});
    return cached(src, o, 'xlsx', async () => {
      const wb = await workbook(src);
      const { rows } = await readSheetRows(wb, o.sheet ?? o.sheet_name);
      let start = o.skiprows || 0;
      if (o.header !== false && o.skiprows == null) while (start < rows.length && !rows[start].some(v => v != null && v !== '')) start++;
      const body = rows.slice(start);
      const w = Math.max(0, maxOf(body.map(r => r.length)));
      let head;
      if (o.header === false) head = o.names || Array.from({ length: w }, (_, i) => colName(i));
      else { const hr = body.shift() || []; head = Array.from({ length: w }, (_, i) => hr[i] != null && String(hr[i]).trim() !== '' ? (hr[i] instanceof Date ? fmtCat(hr[i]) : String(hr[i]).trim()) : 'kolom_' + (i + 1)); }
      const seen = {};
      head = head.map(hd => { if (seen[hd]) { seen[hd]++; return hd + '_' + seen[hd]; } seen[hd] = 1; return hd; });
      let data = body;
      while (data.length && !data[data.length - 1].some(v => v != null && v !== '')) data.pop();
      if (o.nrows != null) data = data.slice(0, o.nrows);
      const d = {};
      head.forEach((hd, j) => { d[hd] = data.map(r => r[j] === undefined || r[j] === '' ? null : r[j]); });
      let df = DataFrame._make(head, d, data.length);
      if (o.usecols) df = df.select(o.usecols);
      return sizeCheck(df);
    });
  }
  async function excelSheets(src) { const wb = await workbook(src); return wb.sheets.map(s => s.name); }

  /* ---------- Menulis Excel (.xlsx) tanpa dependensi ---------- */

  let CRC_T;
  function crc32(b) {
    if (!CRC_T) { CRC_T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const w16 = v => [v & 255, (v >> 8) & 255], w32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
    for (const [name, content] of files) {
      const nb = enc.encode(name), data = typeof content === 'string' ? enc.encode(content) : content, crc = crc32(data);
      const head = new Uint8Array([...w32(0x04034b50), ...w16(20), ...w16(0x0800), ...w16(0), ...w16(0), ...w16(0x21), ...w32(crc), ...w32(data.length), ...w32(data.length), ...w16(nb.length), ...w16(0)]);
      parts.push(head, nb, data);
      central.push(new Uint8Array([...w32(0x02014b50), ...w16(20), ...w16(20), ...w16(0x0800), ...w16(0), ...w16(0), ...w16(0x21), ...w32(crc), ...w32(data.length), ...w32(data.length), ...w16(nb.length), ...w16(0), ...w16(0), ...w16(0), ...w16(0), ...w32(0), ...w32(off)]), nb);
      off += head.length + nb.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new Uint8Array([...w32(0x06054b50), ...w16(0), ...w16(0), ...w16(files.length), ...w16(files.length), ...w32(csize), ...w32(off), ...w16(0)]);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }
  const xesc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

  function toExcel(sheets) {
    if (sheets instanceof DataFrame || Array.isArray(sheets)) sheets = { Data: sheets };
    const names = Object.keys(sheets);
    if (!names.length) fail('to_excel butuh minimal satu tabel.');
    const files = [];
    const sheetXml = df => {
      if (!(df instanceof DataFrame)) df = new DataFrame(df);
      const cols = df._c;
      const width = cols.map(k => Math.min(60, Math.max(8, String(k).length + 2, maxOf(df._d[k].slice(0, 200).map(v => isNA(v) ? 0 : v instanceof Date ? 11 : String(isNum(v) ? fmtNum(v) : v).length + 1)))));
      let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
        width.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols><sheetData>';
      x += '<row r="1">' + cols.map((k, j) => `<c r="${colName(j)}1" t="inlineStr" s="1"><is><t>${xesc(k)}</t></is></c>`).join('') + '</row>';
      for (let i = 0; i < df._n; i++) {
        x += `<row r="${i + 2}">`;
        cols.forEach((k, j) => {
          const v = df._d[k][i], ref = colName(j) + (i + 2);
          if (isNA(v)) return;
          if (typeof v === 'number') x += `<c r="${ref}"><v>${v}</v></c>`;
          else if (typeof v === 'boolean') x += `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
          else if (v instanceof Date) x += `<c r="${ref}" s="${v.getHours() || v.getMinutes() || v.getSeconds() ? 3 : 2}"><v>${toExcelSerial(v)}</v></c>`;
          else x += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xesc(typeof v === 'object' ? JSON.stringify(v) : v)}</t></is></c>`;
        });
        x += '</row>';
      }
      x += `</sheetData><autoFilter ref="A1:${colName(Math.max(0, cols.length - 1))}${df._n + 1}"/></worksheet>`;
      return x;
    };
    const safe = names.map((n, i) => String(n).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet' + (i + 1));
    files.push(['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      safe.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>']);
    files.push(['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
    files.push(['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      safe.map((n, i) => `<sheet name="${xesc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>']);
    files.push(['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      safe.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${safe.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
    files.push(['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F2F0"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/></cellXfs></styleSheet>']);
    names.forEach((n, i) => files.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sheets[n])]));
    return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- Google Sheets ---------- */

  async function readSheets(url, o) {
    o = typeof o === 'string' ? { sheet: o } : (o || {});
    const m = String(url).match(/\/spreadsheets\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
    if (!m) fail('Alamat Google Sheets tidak dikenali. Salin alamat dari address bar, misalnya https://docs.google.com/spreadsheets/d/ID/edit');
    let csvUrl;
    if (/\/d\/e\//.test(url)) {
      const gid = (String(url).match(/gid=(\d+)/) || [])[1];
      csvUrl = `https://docs.google.com/spreadsheets/d/e/${m[1]}/pub?output=csv${gid ? '&gid=' + gid : ''}`;
    } else {
      const gid = o.gid ?? (String(url).match(/gid=(\d+)/) || [])[1];
      csvUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv` + (o.sheet ? '&sheet=' + encodeURIComponent(o.sheet) : gid ? '&gid=' + gid : '');
    }
    const pub = /\/d\/e\//.test(url);
    const HINT = 'Pastikan sheet dibagikan "Siapa saja yang memiliki link" (Viewer) dan perangkat sedang online.';
    // Halaman klik dua kali (file://): Google menolak fetch dari asal "null", jadi langsung pakai JSONP.
    const local = typeof location !== 'undefined' && location.protocol === 'file:';
    if (!local) {
      try { return await readCSV(csvUrl, o); }
      catch (e) {
        if (pub || typeof document === 'undefined') throw new Error('Google Sheets tidak bisa dibaca. ' + HINT + ' ' + e.message);
      }
    }
    if (pub) fail('Link "Publikasikan ke web" (…/d/e/…) tidak bisa dibaca dari halaman yang dibuka dengan klik dua kali. Pakai link bagikan biasa, misalnya https://docs.google.com/spreadsheets/d/ID/edit, dengan akses "Siapa saja yang memiliki link".');
    const gid = o.gid ?? (String(url).match(/gid=(\d+)/) || [])[1];
    const q = (o.sheet ? '&sheet=' + encodeURIComponent(o.sheet) : gid ? '&gid=' + gid : '');
    return cached('gviz:' + m[1] + q, o, 'sheets', async () => fromCSV(gvizToCSV(await gvizJSONP(m[1], q, HINT)), Object.assign({}, o, { sep: ',' })));
  }

  /* JSONP: tag <script> tidak terkena aturan CORS. Hanya ke docs.google.com. */
  let gvizSeq = 0;
  function gvizJSONP(id, q, hint) {
    return new Promise((resolve, reject) => {
      const cb = '__slakGviz' + (++gvizSeq) + '_' + Date.now().toString(36);
      const s = document.createElement('script');
      let done = false;
      const end = (err, v) => {
        if (done) return; done = true;
        clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        s.remove();
        err ? reject(err) : resolve(v);
      };
      window[cb] = (res) => {
        if (!res || res.status === 'error') {
          const why = res && res.errors && res.errors.map(x => x.detailed_message || x.message).join('; ');
          return end(new Error('Google Sheets menolak permintaan' + (why ? ': ' + why : '') + '. ' + hint));
        }
        end(null, res.table);
      };
      // sheet privat: Google membalas halaman login (bukan skrip), jadi onerror atau callback tidak pernah terpanggil
      s.onerror = () => end(new Error('Google Sheets tidak bisa dibaca. ' + hint));
      const timer = setTimeout(() => end(new Error('Google Sheets tidak menjawab dalam 30 detik. ' + hint)), 30000);
      s.src = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?tqx=out:json;responseHandler:${cb}${q}`;
      (document.head || document.documentElement).appendChild(s);
    });
  }
  /* Ubah tabel gviz menjadi CSV yang sama dengan keluaran tqx=out:csv, supaya penebakan tipe tetap seragam. */
  function gvizToCSV(t) {
    const pad = (n, w) => String(n).padStart(w || 2, '0');
    const cell = (c, type) => {
      if (!c || c.v == null) return '';
      let v = c.v;
      if (typeof v === 'string' && /^Date\(/.test(v)) {
        const p = v.slice(5, -1).split(',').map(Number);
        const d = `${p[0]}-${pad(p[1] + 1)}-${pad(p[2])}`;
        v = p.length > 3 ? `${d} ${pad(p[3] || 0)}:${pad(p[4] || 0)}:${pad(p[5] || 0)}` : d;
      } else if (type === 'timeofday' && Array.isArray(v)) v = `${pad(v[0])}:${pad(v[1])}:${pad(v[2])}`;
      else if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
      v = String(v);
      return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const cols = t.cols || [], lines = [];
    if (cols.some(c => c.label)) lines.push(cols.map(c => cell({ v: c.label })).join(','));
    for (const r of t.rows || []) lines.push(cols.map((c, j) => cell(r.c && r.c[j], c.type)).join(','));
    return lines.join('\n');
  }

  /* ======================================================================
   * Statistik: distribusi, uji hipotesis, regresi
   * ==================================================================== */

  /* ---------- Fungsi khusus ---------- */

  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = LANCZOS[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function gammaP(a, x) {
    if (x <= 0) return 0;
    if (x < a + 1) {
      let sum = 1 / a, del = sum, ap = a;
      for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
      return Math.min(1, sum * Math.exp(-x + a * Math.log(x) - lgamma(a)));
    }
    return 1 - gammaQcf(a, x);
  }
  function gammaQ(a, x) { if (x <= 0) return 1; return x < a + 1 ? 1 - gammaP(a, x) : gammaQcf(a, x); }
  function gammaQcf(a, x) {
    const FP = 1e-300;
    let b = x + 1 - a, c = 1 / FP, d = 1 / b, hh = d;
    for (let i = 1; i < 1000; i++) {
      const an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < FP) d = FP;
      c = b + an / c; if (Math.abs(c) < FP) c = FP;
      d = 1 / d; const del = d * c; hh *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * hh;
  }
  function betacf(a, b, x) {
    const FP = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FP) d = FP;
    d = 1 / d; let hh = d;
    for (let m = 1; m <= 3000; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FP) d = FP;
      c = 1 + aa / c; if (Math.abs(c) < FP) c = FP;
      d = 1 / d; hh *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FP) d = FP;
      c = 1 + aa / c; if (Math.abs(c) < FP) c = FP;
      d = 1 / d; const del = d * c; hh *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return hh;
  }
  function betaI(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log1p(-x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function erfc(x) {
    if (x < 0) return 2 - erfc(-x);
    return gammaQ(0.5, x * x);
  }

  function normPpf(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    let x;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p <= 1 - pl) { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    else { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const e = Dist.norm.cdf(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
  }
  function invert(cdf, p, lo, hi) {
    if (p <= 0) return lo;
    if (p >= 1) return hi;
    let a = lo, b = hi;
    if (!isFinite(a)) { a = -1; while (cdf(a) > p) a *= 2; }
    if (!isFinite(b)) { b = 1; while (cdf(b) < p) b *= 2; }
    for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (cdf(m) < p) a = m; else b = m; if (b - a < 1e-13 * Math.max(1, Math.abs(m))) break; }
    return (a + b) / 2;
  }

  const Dist = {
    norm: {
      pdf: (x, mu = 0, s = 1) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)),
      cdf: (x, mu = 0, s = 1) => 0.5 * erfc(-(x - mu) / (s * Math.SQRT2)),
      sf: (x, mu = 0, s = 1) => 0.5 * erfc((x - mu) / (s * Math.SQRT2)),
      ppf: (p, mu = 0, s = 1) => mu + s * normPpf(p)
    },
    t: {
      pdf: (x, df) => Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log1p(x * x / df)),
      cdf: (x, df) => { if (!isFinite(df)) return Dist.norm.cdf(x); const p = 0.5 * betaI(df / (df + x * x), df / 2, 0.5); return x > 0 ? 1 - p : p; },
      sf: (x, df) => { if (!isFinite(df)) return Dist.norm.sf(x); const p = 0.5 * betaI(df / (df + x * x), df / 2, 0.5); return x > 0 ? p : 1 - p; },
      ppf: null
    },
    chi2: {
      pdf: (x, k) => x <= 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2)),
      cdf: (x, k) => gammaP(k / 2, x / 2),
      sf: (x, k) => gammaQ(k / 2, x / 2),
      ppf: (p, k) => invert(x => gammaP(k / 2, x / 2), p, 0, Infinity)
    },
    f: {
      cdf: (x, d1, d2) => x <= 0 ? 0 : betaI(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2),
      sf: (x, d1, d2) => x <= 0 ? 1 : betaI(d2 / (d2 + d1 * x), d2 / 2, d1 / 2),
      ppf: (p, d1, d2) => invert(x => Dist.f.cdf(x, d1, d2), p, 0, Infinity)
    },
    binom: {
      pmf: (k, n, p) => k < 0 || k > n ? 0 : Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log1p(-p)),
      cdf: (k, n, p) => k < 0 ? 0 : k >= n ? 1 : betaI(1 - p, n - Math.floor(k), Math.floor(k) + 1),
      sf: (k, n, p) => 1 - Dist.binom.cdf(k, n, p)
    }
  };
  // t.ppf untuk p < 0.5 memakai simetri
  Dist.t.ppf = (p, df) => { if (!isFinite(df)) return normPpf(p); if (p === 0.5) return 0; if (p < 0.5) return -Dist.t.ppf(1 - p, df); return invert(x => Dist.t.cdf(x, df), p, 0, Infinity); };

  /* ---------- Hasil uji ---------- */

  const fmtP = p => p == null || isNaN(p) ? '—' : p < 0.0001 ? '< 0,0001' : p.toLocaleString('id-ID', { maximumFractionDigits: 4, minimumFractionDigits: 4 });
  const fmtN = (v, d = 3) => v == null || (typeof v === 'number' && isNaN(v)) ? '—' : isNum(v) ? (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2).replace('.', ',') : v.toLocaleString('id-ID', { maximumFractionDigits: d })) : String(v);

  class TestResult {
    constructor(o) { Object.assign(this, { alpha: 0.05 }, o); }
    get significant() { return this.p_value != null && this.p_value < this.alpha; }
    get signifikan() { return this.significant; }
    get pvalue() { return this.p_value; }
    get conclusion() {
      if (this.p_value == null || isNaN(this.p_value)) return 'Uji tidak bisa dihitung (data kurang atau tidak bervariasi).';
      const a = fmtN(this.alpha, 3);
      return this.significant
        ? `p = ${fmtP(this.p_value)} < ${a}, jadi H₀ ditolak. ${this.h1 || ''}`.trim()
        : `p = ${fmtP(this.p_value)} ≥ ${a}, jadi H₀ tidak ditolak. ${this.h0 || ''}`.trim();
    }
    get kesimpulan() { return this.conclusion; }
    toJSON() { const o = {}; for (const k of Object.keys(this)) if (typeof this[k] !== 'function') o[k] = this[k]; o.significant = this.significant; o.conclusion = this.conclusion; return o; }
    summary() {
      const rows = [['Uji', this.test], [this.statistic_name || 'Statistik', this.statistic]];
      if (this.df != null) rows.push(['Derajat bebas', Array.isArray(this.df) ? this.df.map(v => fmtN(v, 2)).join(', ') : this.df]);
      rows.push(['p-value', this.p_value]);
      if (this.ci) rows.push([`Interval kepercayaan ${Math.round((this.confidence || 0.95) * 100)}%`, `${fmtN(this.ci[0], 4)} sampai ${fmtN(this.ci[1], 4)}`]);
      if (this.effect) rows.push([this.effect.name, this.effect.value]);
      for (const k in (this.details || {})) rows.push([k, this.details[k]]);
      rows.push(['Kesimpulan', this.conclusion]);
      return new DataFrame(rows, { columns: ['ukuran', 'nilai'] });
    }
  }

  const altP = (stat, sf, cdf, alt) => alt === 'greater' || alt === 'lebih' ? sf(stat) : alt === 'less' || alt === 'kurang' ? cdf(stat) : Math.min(1, 2 * Math.min(sf(stat), cdf(stat)));
  const altText = alt => alt === 'greater' ? 'lebih besar' : alt === 'less' ? 'lebih kecil' : 'berbeda';

  function vals(x) {
    if (x instanceof Series) return numsOf(x.values);
    if (Array.isArray(x)) return numsOf(x);
    fail('Data harus berupa larik angka atau Series (kolom DataFrame).');
  }
  /* (a, b) | (df, {value, group}) | (df, "nilai", "grup") */
  function splitGroups(args, need) {
    const [x, y, z] = args;
    if (x instanceof DataFrame) {
      const o = typeof y === 'string' ? { value: y, group: z } : (y || {});
      const value = o.value || o.y || o.column, group = o.group || o.by;
      if (!value || !group) fail('Sebutkan kolom nilai dan kolom kelompok, misalnya (df, { value: "nilai", group: "kelas" }).');
      x._need([value, group]);
      const g = new Map();
      x._d[group].forEach((k, i) => { if (isNA(k)) return; const kk = fmtCat(k); if (!g.has(kk)) g.set(kk, []); if (isNum(x._d[value][i])) g.get(kk).push(x._d[value][i]); });
      let names = [...g.keys()];
      if (o.order) names = arr(o.order).map(String);
      else if (o.control != null) names = [String(o.control), ...names.filter(n => n !== String(o.control))];
      if (need === 2 && names.length !== 2) fail(`Kolom "${group}" harus berisi tepat 2 kelompok, tetapi ada ${names.length}: ${names.join(', ')}.`);
      return { groups: names.map(n => g.get(n) || []), names, o };
    }
    const list = args.filter(a => a instanceof Series || Array.isArray(a));
    const o = args.find(a => a && !(a instanceof Series) && !Array.isArray(a) && typeof a === 'object') || {};
    return { groups: list.map(vals), names: list.map((a, i) => a instanceof Series && a.name ? String(a.name) : 'kelompok ' + (i + 1)), o };
  }

  /* ---------- Uji & ukuran ---------- */

  function cohenD(a, b) {
    const na = a.length, nb = b.length;
    const sp = Math.sqrt(((na - 1) * A.var(a) + (nb - 1) * A.var(b)) / (na + nb - 2));
    return sp ? (A.mean(a) - A.mean(b)) / sp : null;
  }
  const dLabel = d => { const x = Math.abs(d); return x < 0.2 ? 'sangat kecil' : x < 0.5 ? 'kecil' : x < 0.8 ? 'sedang' : 'besar'; };
  const rLabel = r => { const x = Math.abs(r); return x < 0.1 ? 'sangat lemah' : x < 0.3 ? 'lemah' : x < 0.5 ? 'sedang' : x < 0.7 ? 'kuat' : 'sangat kuat'; };

  function rankArr(x) {
    const idx = x.map((v, i) => i).sort((a, b) => x[a] - x[b]);
    const r = Array(x.length);
    const ties = [];
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
      for (let k = i; k <= j; k++) r[idx[k]] = (i + j) / 2 + 1;
      if (j > i) ties.push(j - i + 1);
      i = j + 1;
    }
    return { r, ties };
  }

  function pairs(x, y) {
    const a = x instanceof Series ? x.values : x, b = y instanceof Series ? y.values : y;
    if (!Array.isArray(a) || !Array.isArray(b)) fail('Butuh dua larik atau dua kolom.');
    if (a.length !== b.length) fail(`Panjang data berbeda (${a.length} dan ${b.length}).`);
    const px = [], py = [];
    for (let i = 0; i < a.length; i++) { const u = typeof a[i] === 'boolean' ? +a[i] : a[i], v = typeof b[i] === 'boolean' ? +b[i] : b[i]; if (isNum(u) && isNum(v)) { px.push(u); py.push(v); } }
    return [px, py];
  }

  const Stats = {
    dist: Dist,
    norm: Dist.norm, t: Dist.t, chi2: Dist.chi2, f: Dist.f, binom: Dist.binom,
    lgamma, betainc: (a, b, x) => betaI(x, a, b), gammainc: gammaP,   // urutan argumen sama dengan scipy.special
    TestResult,

    describe(x) { return new Series(x instanceof Series ? x.values : x, x && x.name).describe(); },
    mean: x => A.mean(vals(x)), median: x => A.median(vals(x)), std: (x, ddof = 1) => A.std(vals(x), ddof), var: (x, ddof = 1) => A.var(vals(x), ddof),
    sem: x => A.sem(vals(x)), skew: x => A.skew(vals(x)), kurtosis: x => A.kurt(vals(x)), mode: x => A.mode(x instanceof Series ? x.values : x),
    percentile: (x, p) => new Series(vals(x)).percentile(p), quantile: (x, q) => new Series(vals(x)).quantile(q),
    iqr: x => { const s = vals(x).sort((a, b) => a - b); return quant(s, 0.75) - quant(s, 0.25); },
    zscore: x => new Series(x instanceof Series ? x.values : x, x && x.name).zscore(),
    cohen_d: (a, b) => cohenD(vals(a), vals(b)),

    cov(x, y) { const [a, b] = pairs(x, y); const n = a.length; if (n < 2) return null; const ma = A.mean(a), mb = A.mean(b); let s = 0; for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb); return s / (n - 1); },

    corr(x, y, method = 'pearson', o) {
      if (x instanceof DataFrame) { const r = x.corr({ method: typeof y === 'string' ? y : method }); return r; }
      if (method && typeof method === 'object') { o = method; method = o.method || 'pearson'; }
      o = o || {};
      let [a, b] = pairs(x, y);
      const n = a.length;
      const res = new TestResult({ test: '', statistic_name: 'r', n, alternative: o.alternative || 'two-sided', alpha: o.alpha || 0.05 });
      if (n < 3) { res.r = null; res.statistic = null; res.p_value = null; return res; }
      let r;
      if (method === 'kendall') {
        let c = 0, d = 0, tx = 0, ty = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const sx = Math.sign(a[i] - a[j]), sy = Math.sign(b[i] - b[j]);
          if (sx === 0 && sy === 0) continue;
          if (sx === 0) tx++; else if (sy === 0) ty++; else if (sx === sy) c++; else d++;
        }
        r = (c - d) / Math.sqrt((c + d + tx) * (c + d + ty));
        const tieStats = v => { const m = new Map(); for (const x of v) m.set(x, (m.get(x) || 0) + 1); let t = 0, t0 = 0, t1 = 0; for (const k of m.values()) if (k > 1) { t += k * (k - 1) / 2; t0 += k * (k - 1) * (k - 2); t1 += k * (k - 1) * (2 * k + 5); } return [t, t0, t1]; };
        const [xt, x0, x1] = tieStats(a), [yt, y0, y1] = tieStats(b);
        const tot = n * (n - 1) / 2;
        if (!xt && !yt && n <= 33 && o.method !== 'asymptotic') {
          res.method = 'exact';
          const cc = Math.min(c, tot - c);
          let row = new Float64Array(cc + 1); row[0] = 1; if (cc >= 1) row[1] = 1;
          for (let j = 3; j <= n; j++) {
            const nr = new Float64Array(cc + 1); let run = 0;
            for (let k = 0; k <= cc; k++) { run += row[k]; if (k - j >= 0) run -= row[k - j]; nr[k] = run; }
            row = nr;
          }
          let fact = 1; for (let k = 2; k <= n; k++) fact *= k;
          const cdfC = row.reduce((s2, v) => s2 + v, 0) / fact;
          const inRight = c >= tot - c, mass = row[cc] / fact;
          const alt = res.alternative;
          if (alt === 'two-sided') res.p_value = Math.min(1, 2 * cdfC);
          else if ((alt === 'greater') === inRight) res.p_value = cdfC;
          else res.p_value = 1 - cdfC + mass;
        } else {
          const m = n * (n - 1);
          const v = (m * (2 * n + 5) - x1 - y1) / 18 + 2 * xt * yt / m + x0 * y0 / (9 * m * (n - 2));
          res.p_value = altP((c - d) / Math.sqrt(v), Dist.norm.sf, Dist.norm.cdf, res.alternative);
        }
        res.test = 'Korelasi Kendall (tau-b)';
        res.statistic_name = 'τ';
      } else {
        if (method === 'spearman') { a = rankArr(a).r; b = rankArr(b).r; }
        const ma = A.mean(a), mb = A.mean(b);
        let sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < n; i++) { const dx = a[i] - ma, dy = b[i] - mb; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
        r = sxx && syy ? Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy))) : null;
        if (r == null) { res.r = null; res.statistic = null; res.p_value = null; res.test = 'Korelasi'; return res; }
        const df = n - 2;
        const t = Math.abs(r) >= 1 ? Infinity * Math.sign(r) : r * Math.sqrt(df / (1 - r * r));
        res.p_value = isFinite(t) ? altP(t, v => Dist.t.sf(v, df), v => Dist.t.cdf(v, df), res.alternative) : 0;
        res.df = df;
        res.test = method === 'spearman' ? 'Korelasi Spearman' : 'Korelasi Pearson';
        res.statistic_name = method === 'spearman' ? 'ρ' : 'r';
        if (method !== 'spearman' && n > 3 && Math.abs(r) < 1) {
          const zc = normPpf(1 - (1 - (o.confidence || 0.95)) / 2), z = Math.atanh(r), se = 1 / Math.sqrt(n - 3);
          res.ci = [Math.tanh(z - zc * se), Math.tanh(z + zc * se)]; res.confidence = o.confidence || 0.95;
        }
      }
      res.r = r; res.statistic = r;
      res.effect = { name: 'Kekuatan hubungan', value: `${rLabel(r)} ${r > 0 ? 'positif' : r < 0 ? 'negatif' : ''}`.trim() };
      res.h0 = 'Tidak ada bukti hubungan antara kedua variabel.';
      res.h1 = `Ada hubungan ${r > 0 ? 'positif' : 'negatif'} yang signifikan (${rLabel(r)}).`;
      return res;
    },
    pearsonr(x, y, o) { return Stats.corr(x, y, 'pearson', o); },
    spearmanr(x, y, o) { return Stats.corr(x, y, 'spearman', o); },
    kendalltau(x, y, o) { return Stats.corr(x, y, 'kendall', o); },

    ci_mean(x, o) {
      o = typeof o === 'number' ? { confidence: o } : (o || {});
      const v = vals(x), n = v.length, conf = o.confidence || 0.95;
      const m = A.mean(v), se = A.std(v) / Math.sqrt(n), tc = Dist.t.ppf(1 - (1 - conf) / 2, n - 1);
      return { mean: m, lower: m - tc * se, upper: m + tc * se, se, n, confidence: conf, margin: tc * se };
    },
    ci_proportion(k, n, o) {
      o = typeof o === 'number' ? { confidence: o } : (o || {});
      const conf = o.confidence || 0.95, z = normPpf(1 - (1 - conf) / 2), p = k / n;
      if (o.method === 'wald') { const se = Math.sqrt(p * (1 - p) / n); return { proportion: p, lower: p - z * se, upper: p + z * se, n, confidence: conf }; }
      const den = 1 + z * z / n, c = (p + z * z / (2 * n)) / den, hw = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
      return { proportion: p, lower: c - hw, upper: c + hw, n, confidence: conf, method: 'wilson' };
    },

    ttest_1samp(x, mu = 0, o) {
      o = o || {};
      const v = vals(x), n = v.length, m = A.mean(v), sd = A.std(v), se = sd / Math.sqrt(n), df = n - 1;
      const t = (m - mu) / se, alt = o.alternative || 'two-sided', conf = o.confidence || 0.95;
      const tc = Dist.t.ppf(1 - (1 - conf) / 2, df);
      return new TestResult({
        test: 'Uji-t satu sampel', statistic_name: 't', statistic: t, df, alternative: alt, alpha: o.alpha || 0.05,
        p_value: altP(t, z => Dist.t.sf(z, df), z => Dist.t.cdf(z, df), alt),
        ci: [m - tc * se, m + tc * se], confidence: conf, mean: m, n,
        effect: { name: "Cohen's d", value: sd ? (m - mu) / sd : null, label: sd ? dLabel((m - mu) / sd) : null },
        details: { 'Rata-rata sampel': m, 'Nilai pembanding (μ₀)': mu, n },
        h0: `Rata-rata tidak terbukti ${altText(alt)} dari ${fmtN(mu)}.`,
        h1: `Rata-rata (${fmtN(m)}) ${altText(alt)} secara signifikan dari ${fmtN(mu)}.`
      });
    },

    ttest_ind(...args) {
      const { groups, names, o } = splitGroups(args, 2);
      const [a, b] = groups, na = a.length, nb = b.length;
      const ma = A.mean(a), mb = A.mean(b), va = A.var(a), vb = A.var(b);
      const welch = o.equal_var !== true;
      let se, df;
      if (welch) { se = Math.sqrt(va / na + vb / nb); df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1)); }
      else { const sp2 = ((na - 1) * va + (nb - 1) * vb) / (na + nb - 2); se = Math.sqrt(sp2 * (1 / na + 1 / nb)); df = na + nb - 2; }
      const t = (ma - mb) / se, alt = o.alternative || 'two-sided', conf = o.confidence || 0.95, tc = Dist.t.ppf(1 - (1 - conf) / 2, df);
      const d = cohenD(a, b);
      return new TestResult({
        test: welch ? 'Uji-t dua sampel independen (Welch)' : 'Uji-t dua sampel independen (varians sama)', statistic_name: 't', statistic: t, df, alternative: alt, alpha: o.alpha || 0.05,
        p_value: altP(t, z => Dist.t.sf(z, df), z => Dist.t.cdf(z, df), alt),
        ci: [ma - mb - tc * se, ma - mb + tc * se], confidence: conf, difference: ma - mb,
        effect: { name: "Cohen's d", value: d, label: d == null ? null : dLabel(d) },
        details: { [`Rata-rata ${names[0]}`]: ma, [`Rata-rata ${names[1]}`]: mb, 'Selisih': ma - mb, [`n ${names[0]}`]: na, [`n ${names[1]}`]: nb },
        groups: names,
        h0: `Tidak ada bukti rata-rata ${names[0]} ${altText(alt)} dari ${names[1]}.`,
        h1: `Rata-rata ${names[0]} (${fmtN(ma)}) ${altText(alt)} secara signifikan dari ${names[1]} (${fmtN(mb)}).`
      });
    },

    ttest_rel(x, y, o) {
      o = o || {};
      const [a, b] = pairs(x, y);
      const d = a.map((v, i) => v - b[i]);
      const r = Stats.ttest_1samp(d, 0, o);
      r.test = 'Uji-t berpasangan';
      r.details = { 'Rata-rata sebelum/pertama': A.mean(a), 'Rata-rata sesudah/kedua': A.mean(b), 'Rata-rata selisih': A.mean(d), 'Jumlah pasangan': d.length };
      r.h0 = 'Tidak ada bukti perubahan yang signifikan antara kedua pengukuran.';
      r.h1 = `Ada perubahan yang signifikan (rata-rata selisih ${fmtN(A.mean(d))}).`;
      return r;
    },

    mannwhitneyu(...args) {
      const { groups, names, o } = splitGroups(args, 2);
      const [a, b] = groups, n1 = a.length, n2 = b.length;
      const { r, ties } = rankArr([...a, ...b]);
      const R1 = r.slice(0, n1).reduce((p, q) => p + q, 0);
      const U1 = R1 - n1 * (n1 + 1) / 2, U2 = n1 * n2 - U1;
      const alt = o.alternative || 'two-sided';
      let p, method;
      if (!ties.length && n1 <= 8 && n2 <= 8 && o.method !== 'asymptotic') {
        method = 'exact';
        const cnt = uDist(n1, n2), tot = cnt.reduce((s, v) => s + v, 0);
        const cdf = u => { let s = 0; for (let k = 0; k <= Math.floor(u); k++) s += cnt[k] || 0; return s / tot; };
        const sf = u => 1 - cdf(Math.ceil(u) - 1);
        p = alt === 'greater' ? sf(U1) : alt === 'less' ? cdf(U1) : Math.min(1, 2 * Math.min(sf(Math.max(U1, U2)), 1));
      } else {
        method = 'asymptotic';
        const N = n1 + n2, mu = n1 * n2 / 2;
        const tc = ties.reduce((s, t) => s + t * t * t - t, 0);
        const sd = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tc / (N * (N - 1))));
        const cc = o.use_continuity === false ? 0 : 0.5;
        if (alt === 'greater') p = Dist.norm.sf((U1 - mu - cc) / sd);
        else if (alt === 'less') p = Dist.norm.cdf((U1 - mu + cc) / sd);
        else p = Math.min(1, 2 * Dist.norm.sf((Math.max(U1, U2) - mu - cc) / sd));
      }
      const rbc = 1 - 2 * U2 / (n1 * n2);
      return new TestResult({
        test: 'Uji Mann-Whitney U', statistic_name: 'U', statistic: U1, p_value: p, alternative: alt, alpha: o.alpha || 0.05, method,
        effect: { name: 'Korelasi rank-biserial', value: -rbc, label: rLabel(rbc) },
        details: { [`Median ${names[0]}`]: A.median(a), [`Median ${names[1]}`]: A.median(b), [`n ${names[0]}`]: n1, [`n ${names[1]}`]: n2 },
        groups: names,
        h0: `Tidak ada bukti distribusi ${names[0]} ${altText(alt)} dari ${names[1]}.`,
        h1: `Distribusi ${names[0]} ${altText(alt)} secara signifikan dari ${names[1]}.`
      });
    },

    wilcoxon(x, y, o) {
      if (y && !Array.isArray(y) && !(y instanceof Series)) { o = y; y = null; }
      o = o || {};
      let d;
      if (y != null) { const [a, b] = pairs(x, y); d = a.map((v, i) => v - b[i]); } else d = vals(x);
      d = d.filter(v => v !== 0);
      const n = d.length;
      const { r, ties } = rankArr(d.map(Math.abs));
      let Wp = 0, Wm = 0;
      d.forEach((v, i) => { if (v > 0) Wp += r[i]; else Wm += r[i]; });
      const alt = o.alternative || 'two-sided';
      let p, method, stat = alt === 'two-sided' ? Math.min(Wp, Wm) : Wp;
      if (ties.length && n <= 13 && o.method !== 'approx') {
        method = 'permutation';
        let le = 0, ge = 0; const tot = 1 << n, eps = 1e-9 * Math.max(1, Wp);
        for (let mask = 0; mask < tot; mask++) { let s2 = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) s2 += r[i]; if (s2 <= Wp + eps) le++; if (s2 >= Wp - eps) ge++; }
        p = alt === 'greater' ? ge / tot : alt === 'less' ? le / tot : Math.min(1, 2 * Math.min(le, ge) / tot);
      } else if (!ties.length && n <= 400 && o.method !== 'approx') {
        method = 'exact';
        const max = n * (n + 1) / 2, c = new Float64Array(max + 1); c[0] = 1;
        for (let k = 1; k <= n; k++) for (let s = max; s >= k; s--) c[s] += c[s - k];
        const tot = Math.pow(2, n);
        const cdf = w => { let s = 0; for (let k = 0; k <= Math.floor(w); k++) s += c[k]; return s / tot; };
        const sf = w => { let s = 0; for (let k = Math.ceil(w); k <= max; k++) s += c[k]; return s / tot; };
        p = alt === 'greater' ? sf(Wp) : alt === 'less' ? cdf(Wp) : Math.min(1, 2 * cdf(Math.min(Wp, Wm)));
      } else {
        method = 'approx';
        const mu = n * (n + 1) / 4, sd = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - ties.reduce((s, t) => s + t * t * t - t, 0) / 48);
        const z = (Wp - mu) / sd;
        p = altP(z, Dist.norm.sf, Dist.norm.cdf, alt);
      }
      return new TestResult({
        test: 'Uji peringkat bertanda Wilcoxon', statistic_name: 'W', statistic: stat, p_value: p, alternative: alt, alpha: o.alpha || 0.05, method, n,
        details: { 'Median selisih': A.median(d), 'Jumlah pasangan (tanpa selisih nol)': n },
        h0: 'Tidak ada bukti perubahan yang signifikan.', h1: 'Ada perubahan yang signifikan antara kedua pengukuran.'
      });
    },

    chi2_contingency(table, a, b, o) {
      if (a && typeof a === 'object' && !Array.isArray(a)) { o = a; a = null; }
      o = o || {};
      let M, rn, cn;
      if (table instanceof DataFrame && a != null && b != null) {
        const ct = crosstab(table.col(a), table.col(b));
        rn = ct._d[a].map(fmtCat); cn = ct._c.filter(k => k !== a);
        M = ct._d[a].map((_, i) => cn.map(k => ct._d[k][i] || 0));
      } else if (table instanceof DataFrame) {
        const lab = table._c.find(k => /string|campuran/.test(inferType(table._d[k])));
        cn = table._c.filter(k => k !== lab && /int|number/.test(inferType(table._d[k])) && !/^total$/i.test(k));
        rn = lab ? table._d[lab].map(fmtCat) : table._d[cn[0]].map((_, i) => String(i));
        M = rn.map((_, i) => cn.map(k => table._d[k][i] || 0));
        if (lab) { const keep = rn.map(r => !/^total$/i.test(r)); M = M.filter((_, i) => keep[i]); rn = rn.filter((_, i) => keep[i]); }
      } else { M = table.map(r => r.slice()); rn = M.map((_, i) => 'baris ' + (i + 1)); cn = M[0].map((_, j) => 'kolom ' + (j + 1)); }
      const R = M.length, C = M[0].length;
      const rs = M.map(r => r.reduce((p, q) => p + q, 0)), cs = M[0].map((_, j) => M.reduce((p, r) => p + r[j], 0)), N = rs.reduce((p, q) => p + q, 0);
      const E = M.map((_, i) => M[0].map((_, j) => rs[i] * cs[j] / N));
      const dof = (R - 1) * (C - 1);
      const yates = o.correction !== false && dof === 1;
      let chi = 0;
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
        let d = Math.abs(M[i][j] - E[i][j]);
        if (yates) d = Math.max(0, d - 0.5);
        chi += E[i][j] ? d * d / E[i][j] : 0;
      }
      const v = Math.sqrt(chi / (N * Math.max(1, Math.min(R - 1, C - 1))));
      const lowE = E.flat().filter(e => e < 5).length;
      const res = new TestResult({
        test: 'Uji chi-kuadrat independensi' + (yates ? ' (koreksi Yates)' : ''), statistic_name: 'χ²', statistic: chi, df: dof, alpha: o.alpha || 0.05,
        p_value: dof ? Dist.chi2.sf(chi, dof) : 1,
        expected: new DataFrame(Object.assign({ baris: rn }, Object.fromEntries(cn.map((c, j) => [String(c), E.map(r => r[j])])))),
        effect: { name: "Cramér's V", value: v, label: v < 0.1 ? 'sangat lemah' : v < 0.3 ? 'lemah' : v < 0.5 ? 'sedang' : 'kuat' },
        details: { 'Total pengamatan': N, 'Sel dengan frekuensi harapan < 5': lowE },
        h0: 'Tidak ada bukti hubungan antara kedua variabel kategori.', h1: 'Ada hubungan yang signifikan antara kedua variabel kategori.'
      });
      if (lowE / (R * C) > 0.2) res.warning = 'Lebih dari 20% sel punya frekuensi harapan < 5, jadi hasil uji chi-kuadrat kurang andal.';
      return res;
    },

    chisquare(observed, expected, o) {
      o = o || {};
      const ob = vals(observed), N = ob.reduce((p, q) => p + q, 0);
      let ex = expected ? vals(expected) : ob.map(() => N / ob.length);
      const se = ex.reduce((p, q) => p + q, 0); ex = ex.map(e => e * N / se);
      const chi = ob.reduce((s, v, i) => s + (v - ex[i]) ** 2 / ex[i], 0), df = ob.length - 1 - (o.ddof || 0);
      return new TestResult({ test: 'Uji chi-kuadrat kesesuaian (goodness of fit)', statistic_name: 'χ²', statistic: chi, df, p_value: Dist.chi2.sf(chi, df), alpha: o.alpha || 0.05,
        h0: 'Distribusi yang diamati sesuai dengan yang diharapkan.', h1: 'Distribusi yang diamati berbeda secara signifikan dari yang diharapkan.' });
    },

    anova(...args) { return Stats.f_oneway(...args); },
    f_oneway(...args) {
      const { groups, names, o } = splitGroups(args);
      const g = groups.filter(x => x.length);
      const k = g.length, N = g.reduce((s, x) => s + x.length, 0);
      const all = g.flat(), gm = A.mean(all);
      const ssb = g.reduce((s, x) => s + x.length * (A.mean(x) - gm) ** 2, 0);
      const ssw = g.reduce((s, x) => { const m = A.mean(x); return s + x.reduce((t, v) => t + (v - m) ** 2, 0); }, 0);
      const dfb = k - 1, dfw = N - k, F = (ssb / dfb) / (ssw / dfw);
      const eta = ssb / (ssb + ssw);
      return new TestResult({
        test: 'ANOVA satu arah', statistic_name: 'F', statistic: F, df: [dfb, dfw], p_value: Dist.f.sf(F, dfb, dfw), alpha: o.alpha || 0.05,
        effect: { name: 'Eta kuadrat (η²)', value: eta, label: eta < 0.01 ? 'sangat kecil' : eta < 0.06 ? 'kecil' : eta < 0.14 ? 'sedang' : 'besar' },
        table: new DataFrame({ sumber: ['Antar kelompok', 'Dalam kelompok', 'Total'], JK: [ssb, ssw, ssb + ssw], db: [dfb, dfw, N - 1], RK: [ssb / dfb, ssw / dfw, null], F: [F, null, null] }),
        group_stats: new DataFrame({ kelompok: names, n: g.map(x => x.length), rata_rata: g.map(A.mean), simpangan_baku: g.map(x => A.std(x)) }),
        groups: names,
        h0: 'Tidak ada bukti perbedaan rata-rata antar kelompok.', h1: 'Minimal ada satu kelompok yang rata-ratanya berbeda secara signifikan. Lanjutkan dengan stats.pairwise_ttests untuk melihat pasangan mana.'
      });
    },

    kruskal(...args) {
      const { groups, names, o } = splitGroups(args);
      const g = groups.filter(x => x.length);
      const all = g.flat(), N = all.length;
      const { r, ties } = rankArr(all);
      let off = 0, Hs = 0;
      for (const x of g) { const R = r.slice(off, off + x.length).reduce((s, v) => s + v, 0); Hs += R * R / x.length; off += x.length; }
      let H = 12 / (N * (N + 1)) * Hs - 3 * (N + 1);
      const tc = 1 - ties.reduce((s, t) => s + t * t * t - t, 0) / (N * N * N - N);
      if (tc > 0) H /= tc;
      const df = g.length - 1;
      return new TestResult({ test: 'Uji Kruskal-Wallis', statistic_name: 'H', statistic: H, df, p_value: Dist.chi2.sf(H, df), alpha: o.alpha || 0.05, groups: names,
        details: Object.fromEntries(names.map((n, i) => ['Median ' + n, A.median(g[i])])),
        h0: 'Tidak ada bukti perbedaan distribusi antar kelompok.', h1: 'Minimal ada satu kelompok yang distribusinya berbeda secara signifikan.' });
    },

    levene(...args) {
      const { groups, names, o } = splitGroups(args);
      const center = o.center || 'median';
      const z = groups.map(x => { const c = center === 'mean' ? A.mean(x) : A.median(x); return x.map(v => Math.abs(v - c)); });
      const r = Stats.f_oneway(...z);
      return new TestResult({ test: `Uji Levene (pusat: ${center === 'mean' ? 'rata-rata' : 'median'})`, statistic_name: 'W', statistic: r.statistic, df: r.df, p_value: r.p_value, alpha: o.alpha || 0.05, groups: names,
        h0: 'Varians antar kelompok dapat dianggap sama.', h1: 'Varians antar kelompok berbeda secara signifikan (gunakan uji-t Welch).' });
    },

    shapiro(x, o) {
      o = o || {};
      const v = vals(x).sort((a, b) => a - b), n = v.length;
      if (n < 3) fail('Uji Shapiro-Wilk butuh minimal 3 data.');
      if (n > 5000) fail('Uji Shapiro-Wilk mendukung maksimal 5000 data. Ambil sampel atau gunakan stats.jarque_bera.');
      const { w, p } = swilk(v);
      return new TestResult({ test: 'Uji normalitas Shapiro-Wilk', statistic_name: 'W', statistic: w, p_value: p, alpha: o.alpha || 0.05, n,
        h0: 'Data tidak menyimpang secara signifikan dari distribusi normal.', h1: 'Data tidak berdistribusi normal (pertimbangkan uji nonparametrik).' });
    },
    jarque_bera(x, o) {
      o = o || {};
      const v = vals(x), n = v.length, m = A.mean(v);
      let m2 = 0, m3 = 0, m4 = 0; for (const a of v) { const d = a - m; m2 += d * d; m3 += d ** 3; m4 += d ** 4; }
      m2 /= n; m3 /= n; m4 /= n;
      const S = m3 / m2 ** 1.5, K = m4 / (m2 * m2);
      const JB = n / 6 * (S * S + (K - 3) ** 2 / 4);
      return new TestResult({ test: 'Uji normalitas Jarque-Bera', statistic_name: 'JB', statistic: JB, df: 2, p_value: Dist.chi2.sf(JB, 2), alpha: o.alpha || 0.05, details: { Kemencengan: S, Kurtosis: K },
        h0: 'Data tidak menyimpang secara signifikan dari distribusi normal.', h1: 'Data tidak berdistribusi normal.' });
    },

    proportions_ztest(count, nobs, o) {
      o = o || {};
      const c = arr(count instanceof Series ? count.values : count), n = arr(nobs instanceof Series ? nobs.values : nobs);
      const alt = o.alternative || 'two-sided';
      let z, est;
      if (c.length === 1) {
        const p0 = o.value ?? 0.5, p = c[0] / n[0];
        z = (p - p0) / Math.sqrt(p * (1 - p) / n[0]);
        est = { 'Proporsi sampel': p, 'Proporsi pembanding': p0 };
      } else {
        const p1 = c[0] / n[0], p2 = c[1] / n[1], pp = (c[0] + c[1]) / (n[0] + n[1]);
        z = (p1 - p2 - (o.value || 0)) / Math.sqrt(pp * (1 - pp) * (1 / n[0] + 1 / n[1]));
        est = { 'Proporsi 1': p1, 'Proporsi 2': p2, 'Selisih': p1 - p2 };
      }
      return new TestResult({ test: c.length === 1 ? 'Uji-z proporsi satu sampel' : 'Uji-z dua proporsi', statistic_name: 'z', statistic: z, p_value: altP(z, Dist.norm.sf, Dist.norm.cdf, alt), alternative: alt, alpha: o.alpha || 0.05, details: est,
        h0: 'Tidak ada bukti perbedaan proporsi.', h1: 'Proporsi berbeda secara signifikan.' });
    },

    ab_test(data, o) {
      o = o || {};
      let A0, B0, metricType;
      if (data instanceof DataFrame) {
        const g = o.group || o.grup || 'grup', m = o.metric || o.metrik;
        data._need([g, m]);
        const lv = A.unique(data._d[g]).map(String).sort();
        const ctrl = String(o.control ?? lv[0]), trt = String(o.treatment ?? lv.find(x => x !== ctrl));
        const pick = k => data._d[m].filter((v, i) => String(data._d[g][i]) === k && (isNum(v) || typeof v === 'boolean')).map(v => +v);
        A0 = { name: ctrl, values: pick(ctrl) }; B0 = { name: trt, values: pick(trt) };
        metricType = o.type || (A0.values.concat(B0.values).every(v => v === 0 || v === 1) ? 'proportion' : 'mean');
      } else {
        const ks = Object.keys(data);
        A0 = Object.assign({ name: ks[0] }, data[ks[0]]); B0 = Object.assign({ name: ks[1] }, data[ks[1]]);
        metricType = A0.values ? (o.type || 'mean') : 'proportion';
      }
      const alpha = o.alpha || 0.05, conf = 1 - alpha, z = normPpf(1 - alpha / 2);
      let res;
      if (metricType === 'proportion') {
        const nA = A0.n ?? A0.values.length, cA = A0.conversions ?? A0.konversi ?? A0.values.reduce((s, v) => s + v, 0);
        const nB = B0.n ?? B0.values.length, cB = B0.conversions ?? B0.konversi ?? B0.values.reduce((s, v) => s + v, 0);
        const pA = cA / nA, pB = cB / nB;
        res = Stats.proportions_ztest([cB, cA], [nB, nA], { alpha, alternative: o.alternative });
        const se = Math.sqrt(pA * (1 - pA) / nA + pB * (1 - pB) / nB);
        res.ci = [pB - pA - z * se, pB - pA + z * se]; res.confidence = conf;
        res.details = { [`Konversi ${A0.name} (kontrol)`]: pA, [`Konversi ${B0.name}`]: pB, 'Selisih (poin persentase)': (pB - pA) * 100, 'Kenaikan relatif (lift)': pA ? (pB - pA) / pA : null, [`n ${A0.name}`]: nA, [`n ${B0.name}`]: nB };
        res.lift = pA ? (pB - pA) / pA : null; res.rate_a = pA; res.rate_b = pB;
        res.power = Stats.power_proportion(pA, pB, Math.min(nA, nB), { alpha });
      } else {
        res = Stats.ttest_ind(B0.values, A0.values, { alpha, alternative: o.alternative });
        const mA = A.mean(A0.values), mB = A.mean(B0.values);
        res.details = { [`Rata-rata ${A0.name} (kontrol)`]: mA, [`Rata-rata ${B0.name}`]: mB, 'Selisih': mB - mA, 'Kenaikan relatif (lift)': mA ? (mB - mA) / mA : null, [`n ${A0.name}`]: A0.values.length, [`n ${B0.name}`]: B0.values.length };
        res.lift = mA ? (mB - mA) / mA : null;
      }
      res.test = 'Uji A/B: ' + res.test;
      res.h0 = `Tidak ada bukti ${B0.name} berbeda dari ${A0.name}. Jangan ambil keputusan berdasarkan selisih ini.`;
      res.h1 = `${B0.name} ${res.lift > 0 ? 'lebih baik' : 'lebih buruk'} daripada ${A0.name} (lift ${res.lift == null ? '—' : (res.lift * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'}).`;
      if (res.power != null && res.power < 0.8 && !res.significant) res.warning = `Daya uji hanya sekitar ${Math.round(res.power * 100)}%. Sampel mungkin terlalu kecil untuk mendeteksi selisih sebesar ini; lihat stats.sample_size_proportion.`;
      return res;
    },

    power_proportion(p1, p2, n, o) {
      o = o || {};
      const alpha = o.alpha || 0.05, z = normPpf(1 - alpha / 2);
      const se = Math.sqrt(p1 * (1 - p1) / n + p2 * (1 - p2) / n), pp = (p1 + p2) / 2, se0 = Math.sqrt(2 * pp * (1 - pp) / n);
      return Dist.norm.cdf((Math.abs(p2 - p1) - z * se0) / se);
    },
    sample_size_proportion(p1, mde, o) {
      o = o || {};
      const alpha = o.alpha || 0.05, power = o.power || 0.8;
      const p2 = o.relative ? p1 * (1 + mde) : p1 + mde;
      const za = normPpf(1 - alpha / 2), zb = normPpf(power), pp = (p1 + p2) / 2;
      const n = Math.pow(za * Math.sqrt(2 * pp * (1 - pp)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) / Math.pow(p2 - p1, 2);
      return { per_group: Math.ceil(n), total: Math.ceil(n) * 2, p1, p2, alpha, power };
    },
    sample_size_mean(sd, mde, o) {
      o = o || {};
      const alpha = o.alpha || 0.05, power = o.power || 0.8;
      const n = 2 * Math.pow((normPpf(1 - alpha / 2) + normPpf(power)) * sd / mde, 2);
      return { per_group: Math.ceil(n), total: Math.ceil(n) * 2, sd, mde, alpha, power };
    },

    bootstrap_ci(x, stat = 'mean', o) {
      if (stat && typeof stat === 'object') { o = stat; stat = o.stat || 'mean'; }
      o = o || {};
      const v = vals(x), n = v.length, B = o.n_boot || o.n_resamples || 2000, conf = o.confidence || 0.95, r = rng(o.seed ?? 42);
      const f = typeof stat === 'function' ? stat : aggFn(stat);
      const est = f(v), out = new Float64Array(B), s = new Array(n);
      for (let b = 0; b < B; b++) { for (let i = 0; i < n; i++) s[i] = v[Math.floor(r() * n)]; out[b] = f(s); }
      const sorted = Array.from(out).sort((a, c) => a - c);
      return { estimate: est, lower: quant(sorted, (1 - conf) / 2), upper: quant(sorted, 1 - (1 - conf) / 2), confidence: conf, n_boot: B, se: A.std(sorted) };
    },

    multipletests(pvals, method = 'holm') {
      const p = vals(pvals), m = p.length, idx = p.map((_, i) => i).sort((a, b) => p[a] - p[b]), adj = Array(m);
      if (method === 'bonferroni') p.forEach((v, i) => { adj[i] = Math.min(1, v * m); });
      else if (method === 'holm') { let mx = 0; idx.forEach((i, k) => { mx = Math.max(mx, Math.min(1, (m - k) * p[i])); adj[i] = mx; }); }
      else if (method === 'fdr_bh' || method === 'bh') { let mn = 1; for (let k = m - 1; k >= 0; k--) { const i = idx[k]; mn = Math.min(mn, p[i] * m / (k + 1)); adj[i] = Math.min(1, mn); } }
      else fail('Metode koreksi: "bonferroni", "holm", atau "fdr_bh".');
      return adj;
    },
    pairwise_ttests(...args) {
      const { groups, names, o } = splitGroups(args);
      const rows = [];
      for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
        const r = Stats.ttest_ind(groups[i], groups[j], { equal_var: o.equal_var });
        rows.push({ kelompok_a: names[i], kelompok_b: names[j], selisih: A.mean(groups[i]) - A.mean(groups[j]), t: r.statistic, p_value: r.p_value });
      }
      const adj = Stats.multipletests(rows.map(r => r.p_value), o.correction || 'holm');
      rows.forEach((r, k) => { r.p_terkoreksi = adj[k]; r.signifikan = adj[k] < (o.alpha || 0.05); });
      return new DataFrame(rows);
    }
  };

  function uDist(m, n) {
    const memo = new Map();
    const f = (m, n) => {
      const key = m + ',' + n;
      if (memo.has(key)) return memo.get(key);
      let r;
      if (m === 0 || n === 0) r = [1];
      else {
        const a = f(m - 1, n), b = f(m, n - 1);
        r = Array(m * n + 1).fill(0);
        a.forEach((v, u) => { r[u + n] += v; });
        b.forEach((v, u) => { r[u] += v; });
      }
      memo.set(key, r); return r;
    };
    return f(m, n);
  }

  /* Shapiro-Wilk menurut algoritma Royston (AS R94) */
  function swilk(x) {
    const n = x.length, nn2 = Math.floor(n / 2);
    const poly = (c, v) => { let r = c[c.length - 1]; for (let i = c.length - 2; i >= 0; i--) r = r * v + c[i]; return r; };
    const a = new Array(nn2 + 1).fill(0);
    if (n === 3) a[1] = Math.SQRT1_2;
    else {
      const an25 = n + 0.25, m = [0];
      let summ2 = 0;
      for (let i = 1; i <= nn2; i++) { m[i] = normPpf((i - 0.375) / an25); summ2 += m[i] * m[i]; }
      summ2 *= 2;
      const ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(n);
      const a1 = poly([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) - m[1] / ssumm2;
      let i1, fac;
      if (n > 5) {
        i1 = 3;
        const a2 = -m[2] / ssumm2 + poly([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn);
        fac = Math.sqrt((summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2 * a1 * a1 - 2 * a2 * a2));
        a[2] = a2;
      } else {
        i1 = 2;
        fac = Math.sqrt((summ2 - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1));
      }
      a[1] = a1;
      for (let i = i1; i <= nn2; i++) a[i] = -m[i] / fac;
    }
    const mean = A.mean(x);
    let ssq = 0; for (const v of x) ssq += (v - mean) ** 2;
    let sa = 0; for (let i = 1; i <= nn2; i++) sa += a[i] * (x[n - i] - x[i - 1]);
    let w = ssq ? sa * sa / ssq : 1;
    if (w > 1) w = 1;
    let p;
    if (n === 3) { p = Math.max(0, 6 / Math.PI * (Math.asin(Math.sqrt(w)) - Math.PI / 3)); return { w, p }; }
    const w1 = Math.log(1 - w), xx = Math.log(n);
    let y, mm, s;
    if (n <= 11) {
      const gamma = poly([-2.273, 0.459], n);
      if (w1 >= gamma) return { w, p: 1e-99 };
      y = -Math.log(gamma - w1);
      mm = poly([0.544, -0.39978, 0.025054, -6.714e-4], n);
      s = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
    } else {
      mm = poly([-1.5861, -0.31082, -0.083751, 0.0038915], xx);
      s = Math.exp(poly([-0.4803, -0.082676, 0.0030302], xx));
      y = w1;
    }
    p = Dist.norm.sf((y - mm) / s);
    return { w, p };
  }

  /* ======================================================================
   * Aljabar matriks kecil
   * ==================================================================== */

  const Mat = {
    zeros: (r, c) => Array.from({ length: r }, () => new Float64Array(c)),
    xtx(X, w) {
      const n = X.length, p = X[0].length, M = Mat.zeros(p, p);
      for (let i = 0; i < n; i++) { const r = X[i], wi = w ? w[i] : 1; for (let a = 0; a < p; a++) { const va = r[a] * wi; if (!va) continue; for (let b = a; b < p; b++) M[a][b] += va * r[b]; } }
      for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) M[a][b] = M[b][a];
      return M;
    },
    xty(X, y, w) { const p = X[0].length, v = new Float64Array(p); for (let i = 0; i < X.length; i++) { const wi = w ? w[i] : 1; for (let a = 0; a < p; a++) v[a] += X[i][a] * y[i] * wi; } return v; },
    inv(M0) {
      // Penskalaan diagonal (D·M·D) agar kolom berskala sangat berbeda tetap stabil.
      const n = M0.length, dg = M0.map((r, i) => { const v = Math.abs(r[i]); return v > 0 ? 1 / Math.sqrt(v) : 1; });
      const M = M0.map((r, i) => Array.from(r, (v, j) => v * dg[i] * dg[j]));
      const R = Mat._inv(M);
      return R ? R.map((r, i) => r.map((v, j) => v * dg[i] * dg[j])) : null;
    },
    _inv(M) {
      const n = M.length, Aug = M.map((r, i) => { const o = new Float64Array(2 * n); o.set(r); o[n + i] = 1; return o; });
      const scale = Math.max(maxOf(M.map((r, i) => Math.abs(r[i]))), 1e-300);
      for (let c = 0; c < n; c++) {
        let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(Aug[r][c]) > Math.abs(Aug[piv][c])) piv = r;
        if (Math.abs(Aug[piv][c]) < 1e-11 * scale) return null;
        [Aug[c], Aug[piv]] = [Aug[piv], Aug[c]];
        const d = Aug[c][c];
        for (let k = 0; k < 2 * n; k++) Aug[c][k] /= d;
        for (let r = 0; r < n; r++) if (r !== c) { const f = Aug[r][c]; if (f) for (let k = 0; k < 2 * n; k++) Aug[r][k] -= f * Aug[c][k]; }
      }
      return Aug.map(r => Array.from(r.slice(n)));
    },
    mv(M, v) { return M.map(r => r.reduce((s, x, j) => s + x * v[j], 0)); }
  };

  /* ======================================================================
   * Matriks desain dari rumus: "y ~ x1 + x2 + C(kota) + I(x1**2) + log(x3)"
   * ==================================================================== */

  function splitTop(s, sep) {
    const out = []; let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') depth++; if (ch === ')') depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map(t => t.trim()).filter(Boolean);
  }

  function parseFormula(formula, df) {
    if (typeof formula === 'object') {
      const y = formula.y || formula.target, xs = arr(formula.x || formula.features || df._c.filter(k => k !== y));
      return { y, terms: xs.map(c => ({ src: c, col: c })), intercept: formula.intercept !== false };
    }
    const [lhs, rhs] = String(formula).split('~');
    if (rhs == null) fail('Rumus harus berbentuk "y ~ x1 + x2".');
    let terms = splitTop(rhs, '+');
    let intercept = true;
    const out = [];
    for (let t of terms) {
      if (t === '1') continue;
      if (/^-\s*1$/.test(t) || t === '0') { intercept = false; continue; }
      const t2 = t.replace(/\s*-\s*1\s*$/, '');
      if (t2 !== t) { intercept = false; t = t2; }
      if (t === '.') { for (const c of df._c) if (c !== lhs.trim() && !out.some(o => o.col === c)) out.push({ src: c, col: c }); continue; }
      if (t.includes('*') && !/^I\(/.test(t)) {
        const [a, b] = splitTop(t, '*');
        out.push({ src: a, col: a }, { src: b, col: b }, { src: `${a}:${b}`, inter: [a, b] });
        continue;
      }
      if (t.includes(':') && !/^I\(/.test(t)) { out.push({ src: t, inter: splitTop(t, ':') }); continue; }
      let m;
      if ((m = t.match(/^C\((.+?)(?:,\s*(?:ref|Treatment)\s*=\s*["']?(.+?)["']?)?\)$/))) out.push({ src: t, col: m[1].trim(), cat: true, ref: m[2] });
      else if ((m = t.match(/^(log|np\.log|log1p|sqrt|np\.sqrt|exp)\((.+)\)$/))) out.push({ src: t, col: m[2].trim(), fn: m[1].replace('np.', '') });
      else if ((m = t.match(/^I\((.+)\)$/))) out.push({ src: t, expr: m[1].replace(/\^/g, '**') });
      else out.push({ src: t, col: t.replace(/^`|`$/g, '') });
    }
    return { y: lhs.trim().replace(/^`|`$/g, ''), terms: out, intercept };
  }

  function buildDesign(df, spec, frozen) {
    const cols = [], getters = [], info = frozen || { terms: [] };
    if (spec.intercept) { cols.push('Intercept'); getters.push(() => 1); }
    spec.terms.forEach((t, ti) => {
      const fz = frozen && frozen.terms[ti];
      if (t.expr) { const f = compileExpr(t.expr, df, {}); cols.push(t.src); getters.push(i => num(f(i))); if (!frozen) info.terms.push({}); return; }
      if (t.inter) {
        const parts = t.inter.map(c => { df._need(c); return df._d[c]; });
        cols.push(t.src); getters.push(i => parts.reduce((p, c) => p == null || !isNum(c[i]) ? null : p * c[i], 1));
        if (!frozen) info.terms.push({}); return;
      }
      df._need(t.col);
      const c = df._d[t.col];
      const type = inferType(c);
      const isCat = t.cat || type === 'string' || type === 'boolean' || type === 'campuran';
      if (isCat) {
        let levels = fz ? fz.levels : A.unique(c).map(v => keyOf(v)).sort((a, b) => cmpVal(a.slice(a.indexOf(':') + 1), b.slice(b.indexOf(':') + 1)));
        const show = fz ? fz.show : levels.map(k => k.slice(k.indexOf(':') + 1));
        let ref = fz ? fz.ref : t.ref != null ? levels.find(k => k.endsWith(':' + t.ref)) : levels[0];
        if (!ref) ref = levels[0];
        if (!frozen) info.terms.push({ levels, show, ref });
        levels.forEach((lv, k) => {
          if (lv === ref && spec.intercept) return;
          cols.push(`${t.col}[${show[k]}]`);
          getters.push(i => isNA(c[i]) ? null : keyOf(c[i]) === lv ? 1 : 0);
        });
        return;
      }
      const f = t.fn === 'log' ? v => v > 0 ? Math.log(v) : null : t.fn === 'log1p' ? v => v > -1 ? Math.log1p(v) : null : t.fn === 'sqrt' ? v => v >= 0 ? Math.sqrt(v) : null : t.fn === 'exp' ? Math.exp : v => v;
      cols.push(t.src); getters.push(i => isNum(c[i]) ? f(c[i]) : null);
      if (!frozen) info.terms.push({});
    });
    const X = [], rows = [];
    for (let i = 0; i < df._n; i++) {
      const r = new Float64Array(cols.length); let ok = true;
      for (let j = 0; j < cols.length; j++) { const v = getters[j](i); if (v == null || !isFinite(v)) { ok = false; break; } r[j] = v; }
      if (ok) { X.push(r); rows.push(i); }
    }
    return { X, cols, rows, info };
  }

  /* ---------- Regresi linear (OLS) ---------- */

  class RegressionResult {
    constructor(o) { Object.assign(this, o); }
    get coef() { return this.params; }
    get r2() { return this.rsquared; }
    conf_int(alpha = 0.05) { const tc = this.kind === 'logit' ? normPpf(1 - alpha / 2) : Dist.t.ppf(1 - alpha / 2, this.df_resid); return this.names.map((n, i) => [this.params[n] - tc * this.bse[n], this.params[n] + tc * this.bse[n]]); }
    summary() {
      const ci = this.conf_int(this.alpha || 0.05);
      const d = { variabel: this.names.slice(), koefisien: this.names.map(n => this.params[n]), std_error: this.names.map(n => this.bse[n]) };
      d[this.kind === 'logit' ? 'z' : 't'] = this.names.map(n => this.tvalues[n]);
      d.p_value = this.names.map(n => this.pvalues[n]);
      d.batas_bawah = ci.map(c => c[0]); d.batas_atas = ci.map(c => c[1]);
      if (this.kind === 'logit') d.odds_ratio = this.names.map(n => Math.exp(this.params[n]));
      d.signifikan = this.names.map(n => this.pvalues[n] < (this.alpha || 0.05));
      return new DataFrame(d);
    }
    stats() {
      if (this.kind === 'logit') return { 'Jumlah data': this.nobs, 'Pseudo R² (McFadden)': this.prsquared, 'Log-likelihood': this.llf, 'Uji rasio likelihood (p)': this.llr_pvalue, AIC: this.aic, BIC: this.bic, Konvergen: this.converged };
      return { 'Jumlah data': this.nobs, 'R²': this.rsquared, 'R² terkoreksi': this.rsquared_adj, 'F': this.fvalue, 'p-value F': this.f_pvalue, 'RMSE': Math.sqrt(this.mse_resid), AIC: this.aic, BIC: this.bic, 'Durbin-Watson': this.durbin_watson };
    }
    predict(df) {
      if (!df) return this.fittedvalues.slice();
      if (!(df instanceof DataFrame)) df = new DataFrame(Array.isArray(df) ? df : [df]);
      const spec = Object.assign({}, this.spec);
      const des = buildDesign(df, spec, this.design_info);
      const out = Array(df._n).fill(null);
      des.rows.forEach((ri, k) => {
        let z = 0; des.cols.forEach((c, j) => { z += (this.params[c] ?? 0) * des.X[k][j]; });
        out[ri] = this.kind === 'logit' ? 1 / (1 + Math.exp(-z)) : z;
      });
      return new Series(out, this.kind === 'logit' ? 'probabilitas' : 'prediksi');
    }
    predict_proba(df) { return this.predict(df); }
    vif() {
      const names = this.names.filter(n => n !== 'Intercept');
      if (names.length < 2) return new DataFrame({ variabel: names, vif: names.map(() => 1) });
      const idx = names.map(n => this.names.indexOf(n));
      const X = this._X;
      const out = idx.map(j => {
        const y = X.map(r => r[j]);
        const others = idx.filter(k => k !== j);
        const Z = X.map(r => Float64Array.from([1, ...others.map(k => r[k])]));
        const inv = Mat.inv(Mat.xtx(Z)); if (!inv) return Infinity;
        const b = Mat.mv(inv, Mat.xty(Z, y));
        const my = A.mean(y); let sse = 0, sst = 0;
        Z.forEach((r, i) => { const f = r.reduce((s, v, k) => s + v * b[k], 0); sse += (y[i] - f) ** 2; sst += (y[i] - my) ** 2; });
        const r2 = sst ? 1 - sse / sst : 0;
        return r2 >= 1 ? Infinity : 1 / (1 - r2);
      });
      return new DataFrame({ variabel: names, vif: out, keterangan: out.map(v => v < 5 ? 'aman' : v < 10 ? 'perlu diperhatikan' : 'multikolinearitas tinggi') });
    }
    toJSON() { return { kind: this.kind, formula: this.formula, params: this.params, pvalues: this.pvalues, stats: this.stats() }; }
  }

  function ols(df, formula, o) {
    o = o || {};
    if (!(df instanceof DataFrame)) df = new DataFrame(df);
    const spec = parseFormula(formula, df);
    df._need(spec.y);
    const des = buildDesign(df, spec);
    const yAll = df._d[spec.y].map(v => typeof v === 'boolean' ? +v : v);
    const keep = des.rows.map((ri, k) => isNum(yAll[ri]) ? k : -1).filter(k => k >= 0);
    const X = keep.map(k => des.X[k]), y = keep.map(k => yAll[des.rows[k]]), rows = keep.map(k => des.rows[k]);
    const n = X.length, p = des.cols.length;
    if (n <= p) fail(`Data terlalu sedikit (${n} baris lengkap) untuk ${p} koefisien.`);
    const XtX = Mat.xtx(X), inv = Mat.inv(XtX);
    if (!inv) fail('Regresi tidak bisa dihitung: ada variabel yang identik atau merupakan kombinasi dari variabel lain (multikolinearitas sempurna). Hapus salah satunya.');
    const b = Mat.mv(inv, Mat.xty(X, y));
    const fitted = X.map(r => r.reduce((s, v, j) => s + v * b[j], 0));
    const resid = y.map((v, i) => v - fitted[i]);
    const sse = resid.reduce((s, v) => s + v * v, 0), my = A.mean(y);
    const sst = spec.intercept ? y.reduce((s, v) => s + (v - my) ** 2, 0) : y.reduce((s, v) => s + v * v, 0);
    const dfr = n - p, dfm = p - (spec.intercept ? 1 : 0), mse = sse / dfr;
    const se = inv.map((r, i) => Math.sqrt(Math.max(0, r[i] * mse)));
    const tv = b.map((v, i) => v / se[i]);
    const pv = tv.map(t => 2 * Dist.t.sf(Math.abs(t), dfr));
    const r2 = sst ? 1 - sse / sst : 0;
    const F = dfm ? ((sst - sse) / dfm) / mse : null;
    const llf = -n / 2 * (Math.log(2 * Math.PI) + Math.log(sse / n) + 1);
    let dw = 0; for (let i = 1; i < n; i++) dw += (resid[i] - resid[i - 1]) ** 2;
    const named = arr2 => Object.fromEntries(des.cols.map((c, i) => [c, arr2[i]]));
    const full = Array(df._n).fill(null), fullR = Array(df._n).fill(null);
    rows.forEach((ri, k) => { full[ri] = fitted[k]; fullR[ri] = resid[k]; });
    return new RegressionResult({
      kind: 'ols', formula: typeof formula === 'string' ? formula : `${spec.y} ~ ${spec.terms.map(t => t.src).join(' + ')}`, spec, design_info: des.info, alpha: o.alpha || 0.05,
      names: des.cols, params: named(b), bse: named(se), tvalues: named(tv), pvalues: named(pv),
      nobs: n, df_model: dfm, df_resid: dfr, rsquared: r2, rsquared_adj: 1 - (1 - r2) * (n - (spec.intercept ? 1 : 0)) / dfr,
      fvalue: F, f_pvalue: F == null ? null : Dist.f.sf(F, dfm, dfr), mse_resid: mse, ssr: sse, llf,
      aic: -2 * llf + 2 * p, bic: -2 * llf + Math.log(n) * p, durbin_watson: sse ? dw / sse : null,
      fittedvalues: fitted, resid, y, rows, fitted_full: full, resid_full: fullR, _X: X, ylabel: spec.y, dropped: df._n - n
    });
  }

  function logit(df, formula, o) {
    o = o || {};
    if (!(df instanceof DataFrame)) df = new DataFrame(df);
    const spec = parseFormula(formula, df);
    df._need(spec.y);
    const des = buildDesign(df, spec);
    const yRaw = df._d[spec.y];
    let pos = o.positive;
    const yv = v => {
      if (isNA(v)) return null;
      if (typeof v === 'boolean') return +v;
      if (isNum(v)) return v === 0 || v === 1 ? v : null;
      if (pos != null) return String(v) === String(pos) ? 1 : 0;
      return castArray([v], 'boolean')[0] == null ? null : +castArray([v], 'boolean')[0];
    };
    if (pos == null && inferType(yRaw) === 'string') {
      const lv = A.unique(yRaw).map(String).sort();
      if (lv.length !== 2) fail(`Kolom target "${spec.y}" harus punya dua nilai (misalnya 0/1, ya/tidak). Ditemukan: ${lv.join(', ')}.`);
      if (castArray(lv, 'boolean').some(v => v == null)) pos = lv[1];
    }
    const keep = des.rows.map((ri, k) => yv(yRaw[ri]) != null ? k : -1).filter(k => k >= 0);
    const X = keep.map(k => des.X[k]), y = keep.map(k => yv(yRaw[des.rows[k]])), n = X.length, p = des.cols.length;
    if (n <= p) fail('Data terlalu sedikit untuk regresi logistik.');
    let b = new Float64Array(p), converged = false, inv = null, iter = 0, llf = 0;
    const ll = beta => { let s = 0; for (let i = 0; i < n; i++) { const z = X[i].reduce((t, v, j) => t + v * beta[j], 0); s += y[i] * z - (z > 0 ? z + Math.log1p(Math.exp(-z)) : Math.log1p(Math.exp(z))); } return s; };
    for (iter = 0; iter < (o.maxiter || 100); iter++) {
      const pr = X.map(r => 1 / (1 + Math.exp(-r.reduce((s, v, j) => s + v * b[j], 0))));
      const w = pr.map(q => Math.max(q * (1 - q), 1e-12));
      const H = Mat.xtx(X, w);
      if (o.l2) for (let j = 0; j < p; j++) if (des.cols[j] !== 'Intercept') H[j][j] += o.l2;
      inv = Mat.inv(H);
      if (!inv) fail('Regresi logistik tidak bisa dihitung (multikolinearitas). Hapus variabel yang mirip.');
      const g = new Float64Array(p);
      for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) g[j] += X[i][j] * (y[i] - pr[i]);
      if (o.l2) for (let j = 0; j < p; j++) if (des.cols[j] !== 'Intercept') g[j] -= o.l2 * b[j];
      const step = Mat.mv(inv, g);
      let t = 1, nb, l0 = ll(b);
      for (let h = 0; h < 30; h++) { nb = b.map((v, j) => v + t * step[j]); if (ll(nb) >= l0 - 1e-12) break; t /= 2; }
      const delta = maxOf(step.map(Math.abs)) * t;
      b = nb;
      if (delta < 1e-9) { converged = true; break; }
    }
    llf = ll(b);
    const ybar = A.mean(y), llnull = n * (ybar * Math.log(ybar) + (1 - ybar) * Math.log(1 - ybar));
    const se = inv.map((r, i) => Math.sqrt(Math.max(0, r[i])));
    const zv = Array.from(b, (v, i) => v / se[i]), pv = zv.map(z => 2 * Dist.norm.sf(Math.abs(z)));
    const fitted = X.map(r => 1 / (1 + Math.exp(-r.reduce((s, v, j) => s + v * b[j], 0))));
    const named = a => Object.fromEntries(des.cols.map((c, i) => [c, a[i]]));
    const llr = 2 * (llf - llnull), dfm = p - (spec.intercept ? 1 : 0);
    const res = new RegressionResult({
      kind: 'logit', formula: typeof formula === 'string' ? formula : `${spec.y} ~ ${spec.terms.map(t => t.src).join(' + ')}`, spec, design_info: des.info, alpha: o.alpha || 0.05, positive: pos,
      names: des.cols, params: named(Array.from(b)), bse: named(se), tvalues: named(zv), pvalues: named(pv),
      nobs: n, df_model: dfm, df_resid: n - p, llf, llnull, prsquared: 1 - llf / llnull, llr, llr_pvalue: Dist.chi2.sf(llr, dfm),
      aic: -2 * llf + 2 * p, bic: -2 * llf + Math.log(n) * p, converged, iterations: iter + 1,
      fittedvalues: fitted, y, resid: y.map((v, i) => v - fitted[i]), rows: keep.map(k => des.rows[k]), _X: X, ylabel: spec.y, dropped: df._n - n
    });
    if (!converged) res.warning = 'Regresi logistik belum konvergen. Kemungkinan ada variabel yang memisahkan kelas secara sempurna; coba hapus variabel tersebut atau beri opsi { l2: 1 }.';
    if (maxOf(se.filter(isFinite)) > 1e3) res.warning = 'Ada koefisien dengan galat baku sangat besar, kemungkinan karena pemisahan sempurna (perfect separation).';
    return res;
  }

  Stats.ols = ols;
  Stats.logit = logit;
  Stats.RegressionResult = RegressionResult;
  Stats.linregress = (x, y) => {
    const [a, b] = pairs(x, y);
    const r = ols(new DataFrame({ x: a, y: b }), 'y ~ x');
    return { slope: r.params.x, intercept: r.params.Intercept, rvalue: Math.sign(r.params.x) * Math.sqrt(r.rsquared), pvalue: r.pvalues.x, stderr: r.bse.x, intercept_stderr: r.bse.Intercept, rsquared: r.rsquared };
  };

  /* ======================================================================
   * Machine learning (gaya scikit-learn)
   * ==================================================================== */

  /* Mengubah X (DataFrame / larik 2D) menjadi matriks angka, dengan
   * pengodean one-hot otomatis untuk kolom teks. */
  function featurize(X, frozen) {
    if (X instanceof Series) X = X.to_frame();
    if (!(X instanceof DataFrame)) {
      if (Array.isArray(X) && X.length && !Array.isArray(X[0]) && typeof X[0] !== 'object') X = X.map(v => [v]);
      X = new DataFrame(X);
    }
    const plan = frozen || { cols: [], names: [] };
    if (!frozen) {
      for (const c of X._c) {
        const t = inferType(X._d[c]);
        if (t === 'int' || t === 'number') { plan.cols.push({ c, kind: 'num' }); plan.names.push(c); }
        else if (t === 'boolean') { plan.cols.push({ c, kind: 'bool' }); plan.names.push(c); }
        else if (t === 'date') { plan.cols.push({ c, kind: 'date' }); plan.names.push(c); }
        else if (t === 'kosong') continue;
        else {
          const lv = A.unique(X._d[c]).map(v => keyOf(v)).sort();
          if (lv.length > 100) fail(`Kolom "${c}" punya ${lv.length} kategori berbeda; terlalu banyak untuk model. Kelompokkan dulu atau buang kolom ini.`);
          plan.cols.push({ c, kind: 'cat', levels: lv });
          for (const k of lv) plan.names.push(`${c}_${k.slice(k.indexOf(':') + 1)}`);
        }
      }
    }
    const n = X._n, M = [];
    for (let i = 0; i < n; i++) {
      const r = [];
      for (const p of plan.cols) {
        const col = X._d[p.c];
        if (!col) fail(`Kolom "${p.c}" yang dipakai saat melatih model tidak ada di data ini.`);
        const v = col[i];
        if (p.kind === 'cat') { const k = keyOf(v); for (const lv of p.levels) r.push(k === lv ? 1 : 0); continue; }
        if (isNA(v)) fail(`Kolom "${p.c}" baris ${i} kosong. Model tidak bisa memakai nilai kosong; isi dulu dengan df.fillna(...) atau buang dengan df.dropna().`);
        r.push(p.kind === 'bool' ? +v : p.kind === 'date' ? v.getTime() / 86400000 : v);
      }
      M.push(r);
    }
    return { M, plan };
  }
  function targetOf(y, X) {
    if (typeof y === 'string' && X instanceof DataFrame) { X._need(y); return { y: X._d[y].slice(), name: y, X: X.drop(y) }; }
    if (y instanceof Series) return { y: y.values.slice(), name: y.name, X };
    if (Array.isArray(y)) return { y: y.slice(), name: 'target', X };
    fail('Target (y) harus berupa nama kolom, Series, atau larik.');
  }

  class Model {
    constructor(params, defaults) { this.params = Object.assign({}, defaults, params || {}); }
    clone() { return new this.constructor(Object.assign({}, this.params)); }
    get_params() { return Object.assign({}, this.params); }
    _fitXY(X, y) {
      const t = targetOf(y, X);
      const f = featurize(t.X);
      if (t.y.some(isNA)) fail('Target (y) berisi nilai kosong. Buang barisnya dulu dengan df.dropna({ subset: "nama_target" }).');
      this.plan = f.plan; this.feature_names_in_ = f.plan.names.slice(); this.target_name = t.name;
      return { M: f.M, y: t.y };
    }
    _X(X) { return featurize(X, this.plan).M; }
    score(X, y) {
      const t = targetOf(y, X), p = this.predict(t.X).values;
      return this._type === 'clf' ? Metrics.accuracy_score(t.y, p) : Metrics.r2_score(t.y, p);
    }
    toJSON() { return { model: this.constructor.name, params: this.params }; }
  }

  /* ---------- Klasifikasi: label ---------- */
  function encodeLabels(y) {
    const classes = A.unique(y).sort(cmpVal);
    const map = new Map(classes.map((c, i) => [keyOf(c), i]));
    return { classes, idx: y.map(v => map.get(keyOf(v))) };
  }

  /* ---------- Regresi linear & ridge ---------- */
  class LinearRegression extends Model {
    constructor(p) { super(p, { fit_intercept: true, alpha: 0 }); this._type = 'reg'; }
    fit(X, y) {
      const { M, y: yy } = this._fitXY(X, y);
      const p = M[0] ? M[0].length : 0, fi = this.params.fit_intercept;
      let Z = M, ym = 0, xm = Array(p).fill(0);
      if (fi) { ym = A.mean(yy); xm = Array.from({ length: p }, (_, j) => A.mean(M.map(r => r[j]))); Z = M.map(r => r.map((v, j) => v - xm[j])); }
      const XtX = Mat.xtx(Z.map(r => Float64Array.from(r)));
      for (let j = 0; j < p; j++) XtX[j][j] += this.params.alpha || 0;
      let inv = Mat.inv(XtX);
      if (!inv) { for (let j = 0; j < p; j++) XtX[j][j] += 1e-8 * (XtX[j][j] || 1); inv = Mat.inv(XtX); }
      if (!inv) fail('Model tidak bisa dihitung karena ada fitur yang identik. Hapus salah satunya atau gunakan Ridge.');
      const b = Mat.mv(inv, Mat.xty(Z, yy.map(v => v - ym)));
      this.coef_ = b; this.intercept_ = fi ? ym - b.reduce((s, v, j) => s + v * xm[j], 0) : 0;
      return this;
    }
    predict(X) { return new Series(this._X(X).map(r => this.intercept_ + r.reduce((s, v, j) => s + v * this.coef_[j], 0)), 'prediksi'); }
    coefficients() { return new DataFrame({ fitur: this.feature_names_in_, koefisien: this.coef_ }); }
  }
  class Ridge extends LinearRegression { constructor(p) { super(Object.assign({ alpha: 1 }, p)); } }

  /* ---------- Regresi logistik (biner, multikelas satu-lawan-semua) ---------- */
  class LogisticRegression extends Model {
    constructor(p) { super(p, { C: 1, max_iter: 100, fit_intercept: true }); this._type = 'clf'; }
    fit(X, y) {
      const { M, y: yy } = this._fitXY(X, y);
      const { classes, idx } = encodeLabels(yy);
      if (classes.length < 2) fail('Target hanya punya satu kelas; model klasifikasi butuh minimal dua.');
      this.classes_ = classes;
      const p = M[0].length;
      this.mu = Array.from({ length: p }, (_, j) => A.mean(M.map(r => r[j])));
      this.sd = Array.from({ length: p }, (_, j) => A.std(M.map(r => r[j]), 0) || 1);
      const Z = M.map(r => Float64Array.from([1, ...r.map((v, j) => (v - this.mu[j]) / this.sd[j])]));
      const lam = 1 / this.params.C;
      const fitOne = t => {
        let b = new Float64Array(p + 1);
        for (let it = 0; it < this.params.max_iter; it++) {
          const pr = Z.map(r => 1 / (1 + Math.exp(-r.reduce((s, v, j) => s + v * b[j], 0))));
          const H = Mat.xtx(Z, pr.map(q => Math.max(q * (1 - q), 1e-10)));
          const g = new Float64Array(p + 1);
          for (let i = 0; i < Z.length; i++) for (let j = 0; j <= p; j++) g[j] += Z[i][j] * (t[i] - pr[i]);
          for (let j = 1; j <= p; j++) { H[j][j] += lam / 1; g[j] -= lam * b[j]; }
          const inv = Mat.inv(H); if (!inv) break;
          const st = Mat.mv(inv, g);
          b = b.map((v, j) => v + st[j]);
          if (maxOf(st.map(Math.abs)) < 1e-8) break;
        }
        return b;
      };
      this._w = classes.length === 2 ? [fitOne(idx.map(v => v === 1 ? 1 : 0))] : classes.map((_, k) => fitOne(idx.map(v => v === k ? 1 : 0)));
      // koefisien pada skala asli
      this.coef_ = this._w.map(w => Array.from(w.slice(1), (v, j) => v / this.sd[j]));
      this.intercept_ = this._w.map(w => w[0] - w.slice(1).reduce((s, v, j) => s + v * this.mu[j] / this.sd[j], 0));
      return this;
    }
    _scores(X) { return this._X(X).map(r => { const z = [1, ...r.map((v, j) => (v - this.mu[j]) / this.sd[j])]; return this._w.map(w => 1 / (1 + Math.exp(-z.reduce((s, v, j) => s + v * w[j], 0)))); }); }
    predict_proba(X) {
      const S = this._scores(X);
      if (this.classes_.length === 2) return new DataFrame(Object.fromEntries(this.classes_.map((c, k) => [String(c), S.map(s => k ? s[0] : 1 - s[0])])));
      return new DataFrame(Object.fromEntries(this.classes_.map((c, k) => [String(c), S.map(s => s[k] / s.reduce((a, b) => a + b, 0))])));
    }
    decision_function(X) { return new Series(this._scores(X).map(s => s[0]), 'skor'); }
    predict(X) {
      const S = this._scores(X);
      return new Series(S.map(s => this.classes_.length === 2 ? this.classes_[s[0] >= 0.5 ? 1 : 0] : this.classes_[s.indexOf(maxOf(s))]), 'prediksi');
    }
    coefficients() { return new DataFrame({ fitur: this.feature_names_in_, koefisien: this.coef_[0], odds_ratio: this.coef_[0].map(Math.exp) }); }
  }

  /* ---------- Pohon keputusan (CART) ---------- */
  function impurity(counts, n, crit) {
    if (crit === 'entropy') { let s = 0; for (const c of counts) if (c) { const p = c / n; s -= p * Math.log2(p); } return s; }
    let s = 1; for (const c of counts) s -= (c / n) ** 2; return s;
  }
  function buildTree(M, y, idx, o, depth, rand, K, imp) {
    const n = idx.length;
    let node;
    if (K) { const cnt = new Array(K).fill(0); for (const i of idx) cnt[y[i]]++; node = { leaf: true, value: cnt.map(c => c / n), n, imp: impurity(cnt, n, o.criterion) }; }
    else { let s = 0, ss = 0; for (const i of idx) { s += y[i]; ss += y[i] * y[i]; } const m = s / n; node = { leaf: true, value: m, n, imp: ss / n - m * m }; }
    if ((o.max_depth != null && depth >= o.max_depth) || n < o.min_samples_split || n < 2 * o.min_samples_leaf || node.imp <= 1e-12) return node;
    const p = M[0].length;
    let feats = [...Array(p).keys()];
    if (o.mf < p) { for (let i = p - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [feats[i], feats[j]] = [feats[j], feats[i]]; } feats = feats.slice(0, o.mf); }
    let best = null;
    for (const f of feats) {
      const ord = idx.slice().sort((a, b) => M[a][f] - M[b][f]);
      if (M[ord[0]][f] === M[ord[n - 1]][f]) continue;
      if (K) {
        const L = new Array(K).fill(0), R = new Array(K).fill(0);
        for (const i of ord) R[y[i]]++;
        for (let k = 0; k < n - 1; k++) {
          const c = y[ord[k]]; L[c]++; R[c]--;
          const nl = k + 1, nr = n - nl;
          if (M[ord[k]][f] === M[ord[k + 1]][f] || nl < o.min_samples_leaf || nr < o.min_samples_leaf) continue;
          const g = (nl * impurity(L, nl, o.criterion) + nr * impurity(R, nr, o.criterion)) / n;
          if (!best || g < best.g - 1e-12) best = { g, f, t: (M[ord[k]][f] + M[ord[k + 1]][f]) / 2 };
        }
      } else {
        let ls = 0, lss = 0, rs = 0, rss = 0;
        for (const i of ord) { rs += y[i]; rss += y[i] * y[i]; }
        for (let k = 0; k < n - 1; k++) {
          const v = y[ord[k]]; ls += v; lss += v * v; rs -= v; rss -= v * v;
          const nl = k + 1, nr = n - nl;
          if (M[ord[k]][f] === M[ord[k + 1]][f] || nl < o.min_samples_leaf || nr < o.min_samples_leaf) continue;
          const g = (lss - ls * ls / nl + rss - rs * rs / nr) / n;
          if (!best || g < best.g - 1e-12) best = { g, f, t: (M[ord[k]][f] + M[ord[k + 1]][f]) / 2 };
        }
      }
    }
    if (!best || node.imp - best.g <= 1e-12) return node;
    const li = [], ri = [];
    for (const i of idx) (M[i][best.f] <= best.t ? li : ri).push(i);
    imp[best.f] += n * node.imp - (li.length * 0 + ri.length * 0) - n * best.g;
    return { leaf: false, f: best.f, t: best.t, n, value: node.value, left: buildTree(M, y, li, o, depth + 1, rand, K, imp), right: buildTree(M, y, ri, o, depth + 1, rand, K, imp) };
  }
  function treeLeaf(node, r) { while (!node.leaf) node = r[node.f] <= node.t ? node.left : node.right; return node.value; }
  function treeDepth(t) { return t.leaf ? 0 : 1 + Math.max(treeDepth(t.left), treeDepth(t.right)); }

  class DecisionTree extends Model {
    constructor(p, type) { super(p, { max_depth: null, min_samples_split: 2, min_samples_leaf: 1, criterion: type === 'clf' ? 'gini' : 'squared_error', max_features: null, seed: 42 }); this._type = type; }
    fit(X, y, _rand) {
      const { M, y: yy } = this._fitXY(X, y);
      let yi = yy, K = 0;
      if (this._type === 'clf') { const e = encodeLabels(yy); this.classes_ = e.classes; yi = e.idx; K = e.classes.length; }
      else if (yy.some(v => !isNum(v))) fail('Target regresi harus berupa angka.');
      const p = M[0].length;
      const mfp = this.params.max_features;
      const mf = mfp == null ? p : mfp === 'sqrt' ? Math.max(1, Math.floor(Math.sqrt(p))) : mfp === 'log2' ? Math.max(1, Math.floor(Math.log2(p))) : mfp <= 1 ? Math.max(1, Math.floor(mfp * p)) : Math.min(p, mfp);
      const imp = new Array(p).fill(0);
      const idx = this._bootIdx || [...yi.keys()];
      this.tree_ = buildTree(M, yi, idx, Object.assign({}, this.params, { mf }), 0, _rand || rng(this.params.seed), K, imp);
      const tot = imp.reduce((a, b) => a + b, 0);
      this._rawImp = imp;
      this.feature_importances_ = imp.map(v => tot ? v / tot : 0);
      return this;
    }
    get depth() { return treeDepth(this.tree_); }
    _raw(M) { return M.map(r => treeLeaf(this.tree_, r)); }
    predict(X) {
      const v = this._raw(this._X(X));
      return new Series(this._type === 'clf' ? v.map(p => this.classes_[p.indexOf(maxOf(p))]) : v, 'prediksi');
    }
    predict_proba(X) { const v = this._raw(this._X(X)); return new DataFrame(Object.fromEntries(this.classes_.map((c, k) => [String(c), v.map(p => p[k])]))); }
    importances() { return new DataFrame({ fitur: this.feature_names_in_, kepentingan: this.feature_importances_ }).sort_values('kepentingan', { ascending: false }); }
    rules(o) {
      o = o || {};
      const names = this.feature_names_in_, out = [];
      const fv = v => this._type === 'clf' ? `${fmtCat(this.classes_[v.indexOf(maxOf(v))])} (${Math.round(maxOf(v) * 100)}%)` : fmtNum(+v.toPrecision(5));
      const walk = (t, pad, d) => {
        if (t.leaf || (o.max_depth != null && d >= o.max_depth)) { out.push(`${pad}→ ${fv(t.value)}  [n=${t.n}]`); return; }
        out.push(`${pad}jika ${names[t.f]} ≤ ${fmtNum(+t.t.toPrecision(5))}:`); walk(t.left, pad + '   ', d + 1);
        out.push(`${pad}selain itu:`); walk(t.right, pad + '   ', d + 1);
      };
      walk(this.tree_, '', 0);
      return out.join('\n');
    }
  }
  class DecisionTreeClassifier extends DecisionTree { constructor(p) { super(p, 'clf'); } }
  class DecisionTreeRegressor extends DecisionTree { constructor(p) { super(p, 'reg'); } }

  class RandomForest extends Model {
    constructor(p, type) { super(p, { n_estimators: 100, max_depth: null, min_samples_split: 2, min_samples_leaf: 1, max_features: type === 'clf' ? 'sqrt' : 1.0, bootstrap: true, seed: 42, criterion: type === 'clf' ? 'gini' : 'squared_error' }); this._type = type; }
    fit(X, y) {
      const { M, y: yy } = this._fitXY(X, y);
      const rand = rng(this.params.seed);
      if (this._type === 'clf') this.classes_ = encodeLabels(yy).classes;
      const n = M.length;
      const df = DataFrame._make(this.feature_names_in_.map((_, j) => '__f' + j), Object.fromEntries(this.feature_names_in_.map((_, j) => ['__f' + j, M.map(r => r[j])])), n);
      this.estimators_ = [];
      const imp = new Array(M[0].length).fill(0);
      for (let k = 0; k < this.params.n_estimators; k++) {
        const t = new DecisionTree(Object.assign({}, this.params), this._type);
        t._bootIdx = this.params.bootstrap ? Array.from({ length: n }, () => Math.floor(rand() * n)) : null;
        t.fit(df, yy, rand);
        if (this._type === 'clf' && t.classes_.length !== this.classes_.length) t._map = t.classes_.map(c => this.classes_.findIndex(x => keyOf(x) === keyOf(c)));
        this.estimators_.push(t);
        const s = t._rawImp.reduce((a, b) => a + b, 0);
        t._rawImp.forEach((v, j) => { imp[j] += s ? v / s : 0; });
      }
      const tot = imp.reduce((a, b) => a + b, 0);
      this.feature_importances_ = imp.map(v => tot ? v / tot : 0);
      return this;
    }
    _avg(M) {
      const K = this._type === 'clf' ? this.classes_.length : 0;
      return M.map(r => {
        if (!K) return this.estimators_.reduce((s, t) => s + treeLeaf(t.tree_, r), 0) / this.estimators_.length;
        const acc = new Array(K).fill(0);
        for (const t of this.estimators_) { const v = treeLeaf(t.tree_, r); v.forEach((p, k) => { acc[t._map ? t._map[k] : k] += p; }); }
        return acc.map(v => v / this.estimators_.length);
      });
    }
    predict(X) { const v = this._avg(this._X(X)); return new Series(this._type === 'clf' ? v.map(p => this.classes_[p.indexOf(maxOf(p))]) : v, 'prediksi'); }
    predict_proba(X) { const v = this._avg(this._X(X)); return new DataFrame(Object.fromEntries(this.classes_.map((c, k) => [String(c), v.map(p => p[k])]))); }
    importances() { return new DataFrame({ fitur: this.feature_names_in_, kepentingan: this.feature_importances_ }).sort_values('kepentingan', { ascending: false }); }
  }
  class RandomForestClassifier extends RandomForest { constructor(p) { super(p, 'clf'); } }
  class RandomForestRegressor extends RandomForest { constructor(p) { super(p, 'reg'); } }

  /* ---------- KNN ---------- */
  class KNN extends Model {
    constructor(p, type) { super(p, { n_neighbors: 5, weights: 'uniform', scale: true }); this._type = type; }
    fit(X, y) {
      const { M, y: yy } = this._fitXY(X, y);
      const p = M[0].length;
      this.mu = Array.from({ length: p }, (_, j) => this.params.scale ? A.mean(M.map(r => r[j])) : 0);
      this.sd = Array.from({ length: p }, (_, j) => this.params.scale ? (A.std(M.map(r => r[j]), 0) || 1) : 1);
      this._M = M.map(r => r.map((v, j) => (v - this.mu[j]) / this.sd[j]));
      this._y = yy;
      if (this._type === 'clf') this.classes_ = encodeLabels(yy).classes;
      return this;
    }
    _nb(r) {
      const z = r.map((v, j) => (v - this.mu[j]) / this.sd[j]);
      const d = this._M.map((m, i) => [m.reduce((s, v, j) => s + (v - z[j]) ** 2, 0), i]);
      d.sort((a, b) => a[0] - b[0]);
      return d.slice(0, this.params.n_neighbors).map(([dd, i]) => ({ i, w: this.params.weights === 'distance' ? 1 / (Math.sqrt(dd) || 1e-12) : 1 }));
    }
    predict(X) {
      return new Series(this._X(X).map(r => {
        const nb = this._nb(r);
        if (this._type === 'reg') { const ws = nb.reduce((s, x) => s + x.w, 0); return nb.reduce((s, x) => s + this._y[x.i] * x.w, 0) / ws; }
        const m = new Map(); for (const x of nb) { const k = keyOf(this._y[x.i]); m.set(k, (m.get(k) || 0) + x.w); }
        let best = null, bw = -1; for (const c of this.classes_) { const w = m.get(keyOf(c)) || 0; if (w > bw) { bw = w; best = c; } }
        return best;
      }), 'prediksi');
    }
    predict_proba(X) {
      const rows = this._X(X).map(r => { const nb = this._nb(r), ws = nb.reduce((s, x) => s + x.w, 0); return this.classes_.map(c => nb.filter(x => keyOf(this._y[x.i]) === keyOf(c)).reduce((s, x) => s + x.w, 0) / ws); });
      return new DataFrame(Object.fromEntries(this.classes_.map((c, k) => [String(c), rows.map(p => p[k])])));
    }
  }
  class KNeighborsClassifier extends KNN { constructor(p) { super(p, 'clf'); } }
  class KNeighborsRegressor extends KNN { constructor(p) { super(p, 'reg'); } }

  /* ---------- Naive Bayes Gaussian ---------- */
  class GaussianNB extends Model {
    constructor(p) { super(p, { var_smoothing: 1e-9 }); this._type = 'clf'; }
    fit(X, y) {
      const { M, y: yy } = this._fitXY(X, y);
      const { classes, idx } = encodeLabels(yy);
      this.classes_ = classes;
      const p = M[0].length;
      const eps = this.params.var_smoothing * maxOf(Array.from({ length: p }, (_, j) => A.var(M.map(r => r[j]), 0)));
      this.stats = classes.map((_, k) => {
        const rows = M.filter((_, i) => idx[i] === k);
        return { prior: rows.length / M.length, mu: Array.from({ length: p }, (_, j) => A.mean(rows.map(r => r[j]))), v: Array.from({ length: p }, (_, j) => A.var(rows.map(r => r[j]), 0) + eps) };
      });
      return this;
    }
    _ll(r) { return this.stats.map(s => Math.log(s.prior) + r.reduce((t, x, j) => t - 0.5 * Math.log(2 * Math.PI * s.v[j]) - (x - s.mu[j]) ** 2 / (2 * s.v[j]), 0)); }
    predict(X) { return new Series(this._X(X).map(r => { const l = this._ll(r); return this.classes_[l.indexOf(maxOf(l))]; }), 'prediksi'); }
    predict_proba(X) {
      const rows = this._X(X).map(r => { const l = this._ll(r), m = maxOf(l), e = l.map(v => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); });
      return new DataFrame(Object.fromEntries(this.classes_.map((c, k) => [String(c), rows.map(p => p[k])])));
    }
  }

  /* ---------- K-Means ---------- */
  class KMeans extends Model {
    constructor(p) { super(p, { n_clusters: 3, n_init: 10, max_iter: 300, seed: 42, tol: 1e-6 }); }
    fit(X) {
      const f = featurize(X); this.plan = f.plan; this.feature_names_in_ = f.plan.names;
      const M = f.M, n = M.length, K = this.params.n_clusters, r = rng(this.params.seed);
      if (n < K) fail(`Data (${n} baris) lebih sedikit daripada jumlah klaster (${K}).`);
      const d2 = (a, b) => { let s = 0; for (let j = 0; j < a.length; j++) s += (a[j] - b[j]) ** 2; return s; };
      let best = null;
      for (let run = 0; run < this.params.n_init; run++) {
        const C = [M[Math.floor(r() * n)].slice()];
        while (C.length < K) {
          const D = M.map(x => minOf(C.map(c => d2(x, c))));
          const tot = D.reduce((a, b) => a + b, 0);
          let t = r() * tot, i = 0;
          while (i < n - 1 && (t -= D[i]) > 0) i++;
          C.push(M[i].slice());
        }
        let lab = new Array(n).fill(0), inertia = 0;
        for (let it = 0; it < this.params.max_iter; it++) {
          inertia = 0;
          for (let i = 0; i < n; i++) { let bk = 0, bd = Infinity; for (let k = 0; k < K; k++) { const d = d2(M[i], C[k]); if (d < bd) { bd = d; bk = k; } } lab[i] = bk; inertia += bd; }
          let shift = 0;
          for (let k = 0; k < K; k++) {
            const pts = M.filter((_, i) => lab[i] === k);
            if (!pts.length) continue;
            const nc = pts[0].map((_, j) => pts.reduce((s, p) => s + p[j], 0) / pts.length);
            shift += d2(nc, C[k]); C[k] = nc;
          }
          if (shift < this.params.tol) break;
        }
        inertia = M.reduce((s, x, i) => s + d2(x, C[lab[i]]), 0);
        if (!best || inertia < best.inertia) best = { C, lab: lab.slice(), inertia };
      }
      this.cluster_centers_ = best.C; this.labels_ = best.lab; this.inertia_ = best.inertia;
      return this;
    }
    fit_predict(X) { return new Series(this.fit(X).labels_, 'klaster'); }
    predict(X) { return new Series(this._X(X).map(x => { let bk = 0, bd = Infinity; this.cluster_centers_.forEach((c, k) => { const d = c.reduce((s, v, j) => s + (v - x[j]) ** 2, 0); if (d < bd) { bd = d; bk = k; } }); return bk; }), 'klaster'); }
    centers() { return new DataFrame(Object.assign({ klaster: this.cluster_centers_.map((_, k) => k) }, Object.fromEntries(this.feature_names_in_.map((nm, j) => [nm, this.cluster_centers_.map(c => c[j])])))); }
  }

  /* ---------- PCA (dekomposisi eigen Jacobi) ---------- */
  function jacobiEig(S) {
    const n = S.length, a = S.map(r => Array.from(r)), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
      if (off < 1e-20) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const vals = a.map((r, i) => r[i]);
    const ord = vals.map((_, i) => i).sort((i, j) => vals[j] - vals[i]);
    return { values: ord.map(i => vals[i]), vectors: ord.map(i => V.map(r => r[i])) };
  }
  class PCA extends Model {
    constructor(p) { super(p, { n_components: 2, scale: true }); }
    fit(X) {
      const f = featurize(X); this.plan = f.plan; this.feature_names_in_ = f.plan.names;
      const M = f.M, n = M.length, p = M[0].length;
      this.mu = Array.from({ length: p }, (_, j) => A.mean(M.map(r => r[j])));
      this.sd = Array.from({ length: p }, (_, j) => this.params.scale ? (A.std(M.map(r => r[j])) || 1) : 1);
      const Z = M.map(r => r.map((v, j) => (v - this.mu[j]) / this.sd[j]));
      const S = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => Z.reduce((s, r) => s + r[a] * r[b], 0) / (n - 1)));
      const e = jacobiEig(S), k = Math.min(this.params.n_components, p);
      const tot = e.values.reduce((s, v) => s + Math.max(0, v), 0);
      this.components_ = e.vectors.slice(0, k).map(v => { const i = v.reduce((bi, x, j) => Math.abs(x) > Math.abs(v[bi]) ? j : bi, 0); return v[i] < 0 ? v.map(x => -x) : v; });
      this.explained_variance_ = e.values.slice(0, k);
      this.explained_variance_ratio_ = this.explained_variance_.map(v => v / tot);
      return this;
    }
    transform(X) { const M = this._X(X); return new DataFrame(Object.fromEntries(this.components_.map((c, k) => ['PC' + (k + 1), M.map(r => r.reduce((s, v, j) => s + (v - this.mu[j]) / this.sd[j] * c[j], 0))]))); }
    fit_transform(X) { return this.fit(X).transform(X); }
    loadings() { return new DataFrame(Object.assign({ fitur: this.feature_names_in_ }, Object.fromEntries(this.components_.map((c, k) => ['PC' + (k + 1), c])))); }
  }

  /* ---------- Praproses ---------- */
  class Scaler extends Model {
    constructor(p, kind) { super(p, {}); this.kind = kind; }
    fit(X) {
      if (!(X instanceof DataFrame)) X = new DataFrame(X);
      this.columns = this.params.columns ? arr(this.params.columns) : X._c.filter(k => /int|number/.test(inferType(X._d[k])));
      this.stats = Object.fromEntries(this.columns.map(c => [c, this.kind === 'std' ? [A.mean(X._d[c]), A.std(X._d[c], 0) || 1] : this.kind === 'robust' ? (() => { const s = numsOf(X._d[c]).sort((a, b) => a - b); return [quant(s, 0.5), (quant(s, 0.75) - quant(s, 0.25)) || 1]; })() : [A.min(X._d[c]), (A.max(X._d[c]) - A.min(X._d[c])) || 1]]));
      return this;
    }
    transform(X) { if (!(X instanceof DataFrame)) X = new DataFrame(X); const out = X.copy(); for (const c of this.columns) { const [a, b] = this.stats[c]; out._d[c] = out._d[c].map(v => isNum(v) ? (v - a) / b : v); } return out; }
    fit_transform(X) { return this.fit(X).transform(X); }
    inverse_transform(X) { const out = X.copy(); for (const c of this.columns) if (out.has(c)) { const [a, b] = this.stats[c]; out._d[c] = out._d[c].map(v => isNum(v) ? v * b + a : v); } return out; }
  }
  class StandardScaler extends Scaler { constructor(p) { super(p, 'std'); } }
  class MinMaxScaler extends Scaler { constructor(p) { super(p, 'minmax'); } }
  class RobustScaler extends Scaler { constructor(p) { super(p, 'robust'); } }
  class SimpleImputer extends Model {
    constructor(p) { super(p, { strategy: 'mean', fill_value: null }); }
    fit(X) { this.fill = Object.fromEntries(X._c.map(c => { const t = inferType(X._d[c]); const s = this.params.strategy; return [c, s === 'constant' ? this.params.fill_value : /int|number/.test(t) && s !== 'most_frequent' ? (s === 'median' ? A.median(X._d[c]) : A.mean(X._d[c])) : A.mode(X._d[c])]; })); return this; }
    transform(X) { return X.fillna(Object.fromEntries(Object.entries(this.fill).filter(([c]) => X.has(c)))); }
    fit_transform(X) { return this.fit(X).transform(X); }
  }
  class LabelEncoder {
    fit(y) { this.classes_ = A.unique(y instanceof Series ? y.values : y).sort(cmpVal); return this; }
    transform(y) { const m = new Map(this.classes_.map((c, i) => [keyOf(c), i])); return new Series((y instanceof Series ? y.values : y).map(v => m.has(keyOf(v)) ? m.get(keyOf(v)) : null), 'kode'); }
    fit_transform(y) { return this.fit(y).transform(y); }
    inverse_transform(y) { return new Series((y instanceof Series ? y.values : y).map(i => this.classes_[i] ?? null)); }
  }

  /* ---------- Metrik ---------- */
  const yv = y => y instanceof Series ? y.values : Array.isArray(y) ? y : fail('Butuh larik atau Series.');
  const Metrics = {
    accuracy_score(t, p) { t = yv(t); p = yv(p); return t.filter((v, i) => keyOf(v) === keyOf(p[i])).length / t.length; },
    confusion_matrix(t, p, o) {
      t = yv(t); p = yv(p); o = o || {};
      const labels = o.labels || A.unique([...t, ...p]).sort(cmpVal);
      const idx = new Map(labels.map((l, i) => [keyOf(l), i]));
      const M = labels.map(() => labels.map(() => 0));
      t.forEach((v, i) => { const a = idx.get(keyOf(v)), b = idx.get(keyOf(p[i])); if (a != null && b != null) M[a][b]++; });
      return new DataFrame(Object.assign({ aktual: labels.map(fmtCat) }, Object.fromEntries(labels.map((l, j) => ['prediksi_' + fmtCat(l), M.map(r => r[j])]))));
    },
    _prf(t, p, o) {
      t = yv(t); p = yv(p); o = o || {};
      const labels = A.unique([...t, ...p]).sort(cmpVal);
      const per = labels.map(l => {
        const k = keyOf(l);
        let tp = 0, fp = 0, fn = 0;
        t.forEach((v, i) => { const a = keyOf(v) === k, b = keyOf(p[i]) === k; if (a && b) tp++; else if (b) fp++; else if (a) fn++; });
        const pr = tp + fp ? tp / (tp + fp) : 0, rc = tp + fn ? tp / (tp + fn) : 0;
        return { label: l, precision: pr, recall: rc, f1: pr + rc ? 2 * pr * rc / (pr + rc) : 0, support: tp + fn };
      });
      return { labels, per };
    },
    _avg(t, p, o, key) {
      o = o || {};
      const { labels, per } = Metrics._prf(t, p, o);
      const avg = o.average || (labels.length <= 2 ? 'binary' : 'macro');
      if (avg === 'binary') {
        const pos = o.pos_label != null ? o.pos_label : labels.find(l => l === 1 || l === true || /^(1|ya|yes|true)$/i.test(String(l))) ?? labels[labels.length - 1];
        const e = per.find(x => keyOf(x.label) === keyOf(pos)); return e ? e[key] : 0;
      }
      if (avg === 'weighted') { const s = per.reduce((a, b) => a + b.support, 0); return per.reduce((a, b) => a + b[key] * b.support, 0) / s; }
      return per.reduce((a, b) => a + b[key], 0) / per.length;
    },
    precision_score(t, p, o) { return Metrics._avg(t, p, o, 'precision'); },
    recall_score(t, p, o) { return Metrics._avg(t, p, o, 'recall'); },
    f1_score(t, p, o) { return Metrics._avg(t, p, o, 'f1'); },
    classification_report(t, p) {
      const { per } = Metrics._prf(t, p), n = per.reduce((a, b) => a + b.support, 0);
      const rows = per.map(x => ({ kelas: fmtCat(x.label), precision: x.precision, recall: x.recall, f1: x.f1, support: x.support }));
      const mac = k => per.reduce((a, b) => a + b[k], 0) / per.length, w = k => per.reduce((a, b) => a + b[k] * b.support, 0) / n;
      rows.push({ kelas: 'akurasi', precision: null, recall: null, f1: Metrics.accuracy_score(t, p), support: n });
      rows.push({ kelas: 'rata-rata makro', precision: mac('precision'), recall: mac('recall'), f1: mac('f1'), support: n });
      rows.push({ kelas: 'rata-rata tertimbang', precision: w('precision'), recall: w('recall'), f1: w('f1'), support: n });
      return new DataFrame(rows);
    },
    roc_curve(t, s, o) {
      if (s instanceof DataFrame) s = s.col(s._c[s._c.length - 1]);
      t = yv(t); s = yv(s); o = o || {};
      const pos = o.pos_label != null ? o.pos_label : 1;
      const y = t.map(v => keyOf(v) === keyOf(pos) || v === true ? 1 : 0);
      const idx = s.map((_, i) => i).sort((a, b) => s[b] - s[a]);
      const P = y.reduce((a, b) => a + b, 0), N = y.length - P;
      const fpr = [0], tpr = [0], th = [Infinity];
      let tp = 0, fp = 0;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k]; if (y[i]) tp++; else fp++;
        if (k === idx.length - 1 || s[idx[k + 1]] !== s[i]) { fpr.push(N ? fp / N : 0); tpr.push(P ? tp / P : 0); th.push(s[i]); }
      }
      return new DataFrame({ fpr, tpr, ambang: th });
    },
    roc_auc_score(t, s, o) {
      if (s instanceof DataFrame) s = s.col(s._c[s._c.length - 1]);
      const r = Metrics.roc_curve(t, s, o); let a = 0;
      for (let i = 1; i < r._n; i++) a += (r._d.fpr[i] - r._d.fpr[i - 1]) * (r._d.tpr[i] + r._d.tpr[i - 1]) / 2;
      return a;
    },
    log_loss(t, prob) { t = yv(t); prob = yv(prob); const e = 1e-15; return -t.reduce((s, v, i) => s + (+v ? Math.log(Math.max(e, prob[i])) : Math.log(Math.max(e, 1 - prob[i]))), 0) / t.length; },
    r2_score(t, p) { t = yv(t); p = yv(p); const m = A.mean(t); let a = 0, b = 0; t.forEach((v, i) => { a += (v - p[i]) ** 2; b += (v - m) ** 2; }); return b ? 1 - a / b : 0; },
    mean_absolute_error(t, p) { t = yv(t); p = yv(p); return t.reduce((s, v, i) => s + Math.abs(v - p[i]), 0) / t.length; },
    mean_squared_error(t, p) { t = yv(t); p = yv(p); return t.reduce((s, v, i) => s + (v - p[i]) ** 2, 0) / t.length; },
    root_mean_squared_error(t, p) { return Math.sqrt(Metrics.mean_squared_error(t, p)); },
    mean_absolute_percentage_error(t, p) { t = yv(t); p = yv(p); const k = t.map((v, i) => [v, p[i]]).filter(([v]) => v !== 0); return k.reduce((s, [v, q]) => s + Math.abs((v - q) / v), 0) / k.length; },
    silhouette_score(X, labels) {
      const M = featurize(X).M, lab = yv(labels), n = M.length;
      const d = (a, b) => Math.sqrt(a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0));
      const ks = A.unique(lab);
      let tot = 0;
      for (let i = 0; i < n; i++) {
        const same = [], other = new Map();
        for (let j = 0; j < n; j++) { if (i === j) continue; const dd = d(M[i], M[j]); if (lab[j] === lab[i]) same.push(dd); else { if (!other.has(lab[j])) other.set(lab[j], []); other.get(lab[j]).push(dd); } }
        if (!same.length) continue;
        const a = A.mean(same), b = minOf([...other.values()].map(A.mean));
        tot += ks.length > 1 ? (b - a) / Math.max(a, b) : 0;
      }
      return tot / n;
    }
  };
  Metrics.rmse = Metrics.root_mean_squared_error; Metrics.mae = Metrics.mean_absolute_error; Metrics.mape = Metrics.mean_absolute_percentage_error; Metrics.mse = Metrics.mean_squared_error; Metrics.r2 = Metrics.r2_score; Metrics.accuracy = Metrics.accuracy_score;

  /* ---------- Pembagian data & validasi silang ---------- */
  function trainTestSplit(X, y, o) {
    if (y && typeof y === 'object' && !(y instanceof Series) && !Array.isArray(y)) { o = y; y = null; }
    o = o || {};
    const n = X instanceof DataFrame ? X._n : X.length;
    const nt = o.test_size != null ? (o.test_size < 1 ? Math.round(n * o.test_size) : o.test_size) : o.train_size != null ? n - (o.train_size < 1 ? Math.round(n * o.train_size) : o.train_size) : Math.ceil(n * 0.25);
    const r = rng(o.seed ?? o.random_state ?? 42);
    let test = [], train = [];
    if (o.stratify != null) {
      const s = typeof o.stratify === 'string' ? X._d[o.stratify] : yv(o.stratify);
      const g = new Map(); s.forEach((v, i) => { const k = keyOf(v); if (!g.has(k)) g.set(k, []); g.get(k).push(i); });
      for (const ids of g.values()) { const sh = shuffleIdx(ids.length, r).map(k => ids[k]), m = Math.round(ids.length * nt / n); pushAll(test, sh.slice(0, m)); pushAll(train, sh.slice(m)); }
    } else if (o.shuffle === false) { train = [...Array(n - nt).keys()]; test = Array.from({ length: nt }, (_, i) => n - nt + i); }
    else { const sh = shuffleIdx(n, r); test = sh.slice(0, nt); train = sh.slice(nt); }
    if (o.shuffle !== false) { train.sort((a, b) => a - b); test.sort((a, b) => a - b); }
    const take = (d, idx) => d instanceof DataFrame ? d._take(idx) : d instanceof Series ? new Series(idx.map(i => d.values[i]), d.name) : idx.map(i => d[i]);
    if (y == null) return [take(X, train), take(X, test)];
    return [take(X, train), take(X, test), take(y, train), take(y, test)];
  }

  function kfoldIdx(n, k, o, y) {
    const r = rng(o.seed ?? 42), folds = Array.from({ length: k }, () => []);
    if (y && o.stratified !== false) {
      const g = new Map(); y.forEach((v, i) => { const kk = keyOf(v); if (!g.has(kk)) g.set(kk, []); g.get(kk).push(i); });
      let c = 0; for (const ids of g.values()) { const sh = o.shuffle === false ? ids : shuffleIdx(ids.length, r).map(j => ids[j]); for (const i of sh) folds[c++ % k].push(i); }
    } else { const sh = o.shuffle ? shuffleIdx(n, r) : [...Array(n).keys()]; sh.forEach((i, j) => folds[Math.floor(j * k / n)].push(i)); }
    return folds;
  }
  function crossValidate(model, X, y, o) {
    o = typeof o === 'number' ? { cv: o } : (o || {});
    const t = targetOf(y, X), Xd = t.X instanceof DataFrame ? t.X : new DataFrame(t.X);
    const k = o.cv || 5, n = Xd._n;
    const isClf = model._type === 'clf';
    const folds = kfoldIdx(n, k, Object.assign({ shuffle: true }, o), isClf ? t.y : null);
    const scoring = o.scoring || (isClf ? 'accuracy' : 'r2');
    const sc = { accuracy: Metrics.accuracy_score, r2: Metrics.r2_score, f1: (a, b) => Metrics.f1_score(a, b), precision: Metrics.precision_score, recall: Metrics.recall_score, neg_mean_absolute_error: (a, b) => -Metrics.mean_absolute_error(a, b), neg_root_mean_squared_error: (a, b) => -Metrics.root_mean_squared_error(a, b), mae: Metrics.mean_absolute_error, rmse: Metrics.root_mean_squared_error, roc_auc: null }[scoring];
    const scores = folds.map(test => {
      const ts = new Set(test), train = [...Array(n).keys()].filter(i => !ts.has(i));
      const m = model.clone().fit(Xd._take(train), new Series(train.map(i => t.y[i])));
      if (scoring === 'roc_auc') { const pr = m.predict_proba(Xd._take(test)); return Metrics.roc_auc_score(test.map(i => t.y[i]), pr.col(pr._c[pr._c.length - 1]), { pos_label: m.classes_[m.classes_.length - 1] }); }
      if (!sc) fail(`Skor "${scoring}" tidak dikenal.`);
      return sc(test.map(i => t.y[i]), m.predict(Xd._take(test)).values);
    });
    return { scores, mean: A.mean(scores), std: A.std(scores, 0), scoring, cv: k };
  }

  function elbow(X, o) {
    o = o || {};
    const ks = [], inertia = [], sil = [];
    for (let k = o.k_min || 1; k <= (o.k_max || 8); k++) {
      const m = new KMeans({ n_clusters: k, seed: o.seed ?? 42, n_init: o.n_init || 5 }).fit(X);
      ks.push(k); inertia.push(m.inertia_);
      sil.push(k > 1 && o.silhouette !== false && (X._n || X.length) <= 3000 ? Metrics.silhouette_score(X, m.labels_) : null);
    }
    return new DataFrame({ k: ks, inertia, silhouette: sil });
  }

  const ML = {
    LinearRegression, Ridge, LogisticRegression, DecisionTreeClassifier, DecisionTreeRegressor, RandomForestClassifier, RandomForestRegressor,
    KNeighborsClassifier, KNeighborsRegressor, GaussianNB, KMeans, PCA, StandardScaler, MinMaxScaler, RobustScaler, SimpleImputer, LabelEncoder,
    train_test_split: trainTestSplit, cross_val_score: (m, X, y, o) => crossValidate(m, X, y, o).scores, cross_validate: crossValidate, elbow,
    metrics: Metrics, get_dummies: getDummies
  };
  Object.assign(ML, Metrics);
  delete ML._prf; delete ML._avg;

  /* ======================================================================
   * Deret waktu: dekomposisi, peramalan, autokorelasi
   * ==================================================================== */

  function seriesFrom(data, o) {
    o = o || {};
    if (data instanceof Series) return { y: data.values.slice(), dates: null, name: data.name || 'nilai' };
    if (Array.isArray(data) && data.every(v => v == null || typeof v === 'number')) return { y: data.slice(), dates: null, name: 'nilai' };
    const df = data instanceof DataFrame ? data : new DataFrame(data);
    const dc = o.date || o.x || df._c.find(k => inferType(df._d[k]) === 'date');
    const vc = o.value || o.y || df._c.find(k => k !== dc && /int|number/.test(inferType(df._d[k])));
    df._need(vc);
    let rows = [...Array(df._n).keys()];
    if (dc) rows.sort((a, b) => cmpVal(df._d[dc][a], df._d[dc][b]));
    return { y: rows.map(i => df._d[vc][i]), dates: dc ? rows.map(i => toDate(df._d[dc][i])) : null, name: vc, dateName: dc };
  }
  function guessFreq(dates) {
    if (!dates || dates.length < 3) return null;
    const d = [];
    for (let i = 1; i < Math.min(dates.length, 40); i++) d.push((dates[i] - dates[i - 1]) / 86400000);
    const m = A.median(d);
    return m < 0.5 ? 'H' : m < 1.5 ? 'D' : m < 8 ? 'W' : m < 40 ? 'M' : m < 100 ? 'Q' : 'Y';
  }
  const SEASON = { H: 24, D: 7, W: 52, M: 12, Q: 4, Y: 1 };

  function decompose(data, o) {
    if (typeof o === 'number') o = { period: o };
    o = o || {};
    const s = seriesFrom(data, o), y = s.y, n = y.length;
    const freq = guessFreq(s.dates);
    const m = o.period || (freq ? SEASON[freq] : null) || fail('Sebutkan periode musiman, misalnya { period: 12 } untuk data bulanan.');
    if (n < 2 * m) fail(`Dekomposisi butuh minimal 2 siklus (${2 * m} titik); data hanya ${n} titik.`);
    if (y.some(v => !isNum(v))) fail('Deret berisi nilai kosong. Isi dulu dengan .interpolate() atau .fillna(...).');
    const mult = o.model === 'multiplicative' || o.model === 'multiplikatif';
    const trend = Array(n).fill(null);
    const h = Math.floor(m / 2);
    for (let i = h; i < n - h; i++) {
      if (m % 2 === 0) { let s2 = y[i - h] / 2 + y[i + h] / 2; for (let k = i - h + 1; k < i + h; k++) s2 += y[k]; trend[i] = s2 / m; }
      else { let s2 = 0; for (let k = i - h; k <= i + h; k++) s2 += y[k]; trend[i] = s2 / m; }
    }
    const det = y.map((v, i) => trend[i] == null ? null : mult ? v / trend[i] : v - trend[i]);
    const per = Array.from({ length: m }, (_, k) => A.mean(det.filter((v, i) => i % m === k && v != null)));
    const adj = mult ? A.mean(per) : A.mean(per);
    const seas = per.map(v => mult ? v / adj : v - adj);
    const seasonal = y.map((_, i) => seas[i % m]);
    const resid = y.map((v, i) => trend[i] == null ? null : mult ? v / (trend[i] * seasonal[i]) : v - trend[i] - seasonal[i]);
    const d = {};
    if (s.dates) d[s.dateName || 'tanggal'] = s.dates;
    else d.t = y.map((_, i) => i);
    Object.assign(d, { nilai: y, tren: trend, musiman: seasonal, residu: resid });
    const out = new DataFrame(d);
    const vr = A.var(resid.filter(v => v != null)), vt = A.var(resid.map((v, i) => v == null ? null : mult ? null : v + seasonal[i]).filter(v => v != null));
    out._seasonal_strength = vt ? Math.max(0, 1 - vr / vt) : null;
    return out;
  }

  function acf(data, nlags = 20) {
    const y = numsOf(data instanceof Series ? data.values : data), n = y.length, m = A.mean(y);
    const c0 = y.reduce((s, v) => s + (v - m) ** 2, 0) / n;
    const lags = [], r = [];
    for (let k = 0; k <= Math.min(nlags, n - 1); k++) { let s = 0; for (let i = k; i < n; i++) s += (y[i] - m) * (y[i - k] - m); lags.push(k); r.push(s / n / c0); }
    const conf = 1.96 / Math.sqrt(n);
    return new DataFrame({ lag: lags, acf: r, batas_atas: lags.map(() => conf), batas_bawah: lags.map(() => -conf) });
  }

  function nelderMead(f, x0, o) {
    o = o || {};
    const n = x0.length;
    let S = [x0.slice()];
    for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += x[i] ? 0.25 * Math.abs(x[i]) + 0.5 : 0.5; S.push(x); }
    let F = S.map(f);
    for (let it = 0; it < (o.maxiter || 400 * n); it++) {
      const ord = F.map((_, i) => i).sort((a, b) => F[a] - F[b]); S = ord.map(i => S[i]); F = ord.map(i => F[i]);
      if (Math.abs(F[n] - F[0]) < 1e-10 * (Math.abs(F[0]) + 1e-12)) break;
      const c = Array.from({ length: n }, (_, j) => S.slice(0, n).reduce((s, x) => s + x[j], 0) / n);
      const xr = c.map((v, j) => v + (v - S[n][j])), fr = f(xr);
      if (fr < F[0]) { const xe = c.map((v, j) => v + 2 * (v - S[n][j])), fe = f(xe); if (fe < fr) { S[n] = xe; F[n] = fe; } else { S[n] = xr; F[n] = fr; } }
      else if (fr < F[n - 1]) { S[n] = xr; F[n] = fr; }
      else {
        const xc = c.map((v, j) => v + 0.5 * (S[n][j] - v)), fc = f(xc);
        if (fc < F[n]) { S[n] = xc; F[n] = fc; }
        else for (let i = 1; i <= n; i++) { S[i] = S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j])); F[i] = f(S[i]); }
      }
    }
    const b = F.indexOf(minOf(F));
    return { x: S[b], f: F[b] };
  }
  const sig = x => 1 / (1 + Math.exp(-x)), logit_ = p => Math.log(p / (1 - p));

  function holtWinters(y, o) {
    const m = o.m || 1, trend = o.trend, seasonal = o.seasonal && m > 1 ? o.seasonal : null, mult = seasonal === 'mul';
    const n = y.length;
    // keadaan awal (level, tren, musiman) dari heuristik klasik; tahap 2 di bawah ikut mengoptimalkannya (seperti statsmodels "estimated")
    const init0 = (() => {
      if (seasonal) {
        const s1 = A.mean(y.slice(0, m)), s2 = n >= 2 * m ? A.mean(y.slice(m, 2 * m)) : s1;
        return { l: s1, b: trend ? (s2 - s1) / m : 0, s: y.slice(0, m).map(v => mult ? v / s1 : v - s1) };
      }
      return { l: y[0], b: trend ? (n > 1 ? y[1] - y[0] : 0) : 0, s: Array(m).fill(mult ? 1 : 0) };
    })();
    let init = init0;
    const run = (al, be, ga, keep, st) => {
      st = st || init;
      let l = st.l, b = st.b, s = st.s.slice();
      const fit = [];
      let sse = 0;
      for (let t = 0; t < n; t++) {
        const si = s[t % m];
        const f = seasonal ? (mult ? (l + b) * si : l + b + si) : l + b;
        fit.push(f);
        const e = y[t] - f; sse += e * e;
        const lp = l;
        l = seasonal ? al * (mult ? y[t] / si : y[t] - si) + (1 - al) * (l + b) : al * y[t] + (1 - al) * (l + b);
        if (trend) b = be * (l - lp) + (1 - be) * b;
        if (seasonal) s[t % m] = mult ? ga * y[t] / l + (1 - ga) * si : ga * (y[t] - l) + (1 - ga) * si;
      }
      return keep ? { fit, l, b, s, sse } : sse;
    };
    const k = 1 + (trend ? 1 : 0) + (seasonal ? 1 : 0);
    const par = x => [sig(x[0]), trend ? sig(x[1]) : 0, seasonal ? sig(x[trend ? 2 : 1]) : 0];
    // tahap 1: parameter penghalusan saja, beberapa titik awal
    let opt = null;
    for (const p0 of [0.3, 0.1, 0.6]) { const r = nelderMead(x => run(...par(x)), Array(k).fill(logit_(p0))); if (!opt || r.f < opt.f) opt = r; }
    // tahap 2: penghalusan + keadaan awal bersama-sama (skala data dinormalkan agar Nelder-Mead stabil)
    const sc = A.std(y) || 1;
    const nS = seasonal ? m : 0, pack = st => [st.l / sc, st.b / sc, ...st.s.slice(0, nS).map(v => mult ? v : v / sc)];
    const unpack = z => ({ l: z[0] * sc, b: trend ? z[1] * sc : 0, s: seasonal ? z.slice(2, 2 + m).map(v => mult ? v : v * sc) : init0.s });
    if (n >= k + 2 + nS) {
      const f2 = z => run(...par(z.slice(0, k)), false, unpack(z.slice(k)));
      const r2 = nelderMead(f2, [...opt.x, ...pack(init0)], { maxiter: 3000 });
      if (r2.f < opt.f) { opt = { x: r2.x.slice(0, k), f: r2.f }; init = unpack(r2.x.slice(k)); }
    }
    const [al, be, ga] = par(opt.x);
    const r = run(al, be, ga, true);
    const fc = h => Array.from({ length: h }, (_, i) => { const si = r.s[(n + i) % m]; const base = r.l + (i + 1) * r.b; return seasonal ? (mult ? base * si : base + si) : base; });
    return { fit: r.fit, forecast: fc, params: { alpha: al, beta: trend ? be : null, gamma: seasonal ? ga : null }, sse: r.sse, k: k + (trend ? 2 : 1) + (seasonal ? m : 0) };
  }

  class ForecastResult {
    constructor(o) { Object.assign(this, o); }
    get chart_data() { return this.combined; }
    toJSON() { return { method: this.method, params: this.params, metrics: this.metrics, forecast: this.forecast.to_records() }; }
  }

  function forecast(data, o) {
    if (typeof o === 'number') o = { periods: o };
    o = o || {};
    const s = seriesFrom(data, o), y = s.y;
    if (y.some(v => !isNum(v))) fail('Deret berisi nilai kosong. Isi dulu dengan .interpolate() atau .fillna(...).');
    const n = y.length, H = o.periods || o.horizon || 12;
    if (n < 4) fail('Peramalan butuh minimal 4 titik data.');
    const freq = o.freq ? freqOf(o.freq) : guessFreq(s.dates);
    const m = o.season_length || o.period || (freq ? SEASON[freq] : 1) || 1;
    let method = (o.method || 'auto').toLowerCase();
    const cands = [];
    const tryHW = (name, opt) => { try { const r = holtWinters(y, opt); const aic = n * Math.log(r.sse / n) + 2 * r.k; cands.push({ name, r, aic }); } catch (e) { /* lewati */ } };
    const seasonalOk = m > 1 && n >= 2 * m;
    if (method === 'auto') {
      tryHW('ses', { m: 1 });
      tryHW('holt', { m: 1, trend: true });
      if (seasonalOk) { tryHW('holt_winters', { m, trend: true, seasonal: 'add' }); if (y.every(v => v > 0)) tryHW('holt_winters_mul', { m, trend: true, seasonal: 'mul' }); }
      cands.sort((a, b) => a.aic - b.aic);
    } else if (method === 'ses' || method === 'eksponensial') tryHW('ses', { m: 1 });
    else if (method === 'holt') tryHW('holt', { m: 1, trend: true });
    else if (method === 'holt_winters' || method === 'hw') { if (!seasonalOk) fail(`Holt-Winters butuh minimal 2 siklus musim (${2 * m} titik).`); tryHW('holt_winters', { m, trend: true, seasonal: o.seasonal === 'mul' ? 'mul' : 'add' }); }
    let fit, fc, params = {}, name = method;
    if (cands.length) { const c = cands[0]; name = c.name; fit = c.r.fit; fc = c.r.forecast(H); params = c.r.params; }
    else if (method === 'linear' || method === 'tren') {
      const x = y.map((_, i) => i), f = linFitXY(x, y); fit = x.map(i => f.a + f.b * i); fc = Array.from({ length: H }, (_, i) => f.a + f.b * (n + i)); params = { intercept: f.a, slope: f.b };
    } else if (method === 'naive') { fit = [y[0], ...y.slice(0, -1)]; fc = Array(H).fill(y[n - 1]); }
    else if (method === 'seasonal_naive') { fit = y.map((v, i) => i >= m ? y[i - m] : y[i]); fc = Array.from({ length: H }, (_, i) => y[n - m + (i % m)]); }
    else if (method === 'ma' || method === 'moving_average') { const w = o.window || Math.min(n, m > 1 ? m : 3); fit = y.map((_, i) => i >= w ? A.mean(y.slice(i - w, i)) : y[i]); fc = Array(H).fill(A.mean(y.slice(n - w))); params = { window: w }; }
    else fail(`Metode "${o.method}" tidak dikenal. Pilih: auto, ses, holt, holt_winters, linear, naive, seasonal_naive, atau ma.`);
    const res = y.map((v, i) => v - fit[i]);
    const sd = Math.sqrt(res.slice(Math.min(m, n - 1)).reduce((a, b) => a + b * b, 0) / Math.max(1, n - Math.min(m, n - 1)));
    const z = normPpf(1 - (1 - (o.confidence || 0.95)) / 2);
    const lo = fc.map((v, i) => v - z * sd * Math.sqrt(i + 1)), hi = fc.map((v, i) => v + z * sd * Math.sqrt(i + 1));
    const fdates = s.dates && freq ? Array.from({ length: H }, (_, i) => addPeriod(periodStart(s.dates[n - 1], freq), freq, i + 1)) : null;
    const xName = s.dates ? (s.dateName || 'tanggal') : 't';
    const fdf = new DataFrame({ [xName]: fdates || fc.map((_, i) => n + i), prediksi: fc, batas_bawah: lo, batas_atas: hi });
    const comb = new DataFrame({
      [xName]: [...(s.dates || y.map((_, i) => i)), ...(fdates || fc.map((_, i) => n + i))],
      aktual: [...y, ...fc.map(() => null)],
      prediksi: [...fit.map(() => null).slice(0, n - 1), y[n - 1], ...fc],
      batas_bawah: [...y.map(() => null), ...lo], batas_atas: [...y.map(() => null), ...hi]
    });
    const k0 = Math.min(m, n - 1);
    return new ForecastResult({
      method: name, params, periods: H, season_length: m, freq, forecast: fdf, combined: comb, fitted: fit, residuals: res, name: s.name, x: xName,
      metrics: { MAE: A.mean(res.slice(k0).map(Math.abs)), RMSE: Math.sqrt(A.mean(res.slice(k0).map(v => v * v))), MAPE: A.mean(y.slice(k0).map((v, i) => v ? Math.abs(res[i + k0] / v) : null).filter(v => v != null)) },
      candidates: cands.map(c => ({ metode: c.name, AIC: c.aic }))
    });
  }
  function linFitXY(x, y) { const mx = A.mean(x), my = A.mean(y); let a = 0, b = 0; x.forEach((v, i) => { a += (v - mx) * (y[i] - my); b += (v - mx) ** 2; }); const sl = b ? a / b : 0; return { a: my - sl * mx, b: sl }; }

  const TS = { decompose, forecast, acf, seasonal_decompose: decompose, ForecastResult };

  /* ======================================================================
   * Analisis bisnis siap pakai
   * ==================================================================== */

  const PERIOD_WORD = { D: 'hari', W: 'minggu', M: 'bulan', Q: 'kuartal', Y: 'tahun', H: 'jam' };

  const Analysis = {
    cohort(df, o) {
      o = o || {};
      const cu = o.customer || o.pelanggan, dc = o.date || o.tanggal, vc = o.value || o.nilai;
      df._need([cu, dc].concat(vc ? [vc] : []));
      const f = freqOf(o.period || o.freq || 'M');
      const first = new Map();
      for (let i = 0; i < df._n; i++) { const c = df._d[cu][i], d = toDate(df._d[dc][i]); if (isNA(c) || !d) continue; const k = keyOf(c), p = periodStart(d, f); if (!first.has(k) || p < first.get(k)) first.set(k, p); }
      const cells = new Map(), size = new Map();
      let maxK = 0;
      for (let i = 0; i < df._n; i++) {
        const c = df._d[cu][i], d = toDate(df._d[dc][i]); if (isNA(c) || !d) continue;
        const k = keyOf(c), c0 = first.get(k), age = periodDiff(c0, periodStart(d, f), f);
        maxK = Math.max(maxK, age);
        const key = c0.getTime() + '|' + age;
        let e = cells.get(key); if (!e) cells.set(key, e = { users: new Set(), value: 0 });
        e.users.add(k); if (vc && isNum(df._d[vc][i])) e.value += df._d[vc][i];
      }
      for (const [k, c0] of first) { const t = c0.getTime(); size.set(t, (size.get(t) || 0) + 1); }
      const cohorts = [...size.keys()].sort((a, b) => a - b);
      const lim = o.max_periods != null ? Math.min(maxK, o.max_periods) : maxK;
      const word = PERIOD_WORD[f];
      let maxT = 0;
      for (const v of df._d[dc]) { const x = toDate(v); if (x && x.getTime() > maxT) maxT = x.getTime(); }
      const endP = periodStart(new Date(maxT), f);
      const metric = o.metric || 'retention';
      const d = { kohort: cohorts.map(t => periodLabel(new Date(t), f)), ukuran: cohorts.map(t => size.get(t)) };
      for (let a = 0; a <= lim; a++) {
        d[`${word}_${a}`] = cohorts.map(t => {
          const e = cells.get(t + '|' + a);
          const last = periodDiff(new Date(t), endP, f);
          if (a > last) return null;
          if (!e) return metric === 'count' || metric === 'revenue' ? 0 : 0;
          return metric === 'count' ? e.users.size : metric === 'revenue' ? e.value : e.users.size / size.get(t);
        });
      }
      return new DataFrame(d);
    },

    rfm(df, o) {
      o = o || {};
      const cu = o.customer || o.pelanggan, dc = o.date || o.tanggal, am = o.amount || o.nilai || o.monetary;
      df._need([cu, dc, am]);
      const m = new Map();
      let maxD = null;
      for (let i = 0; i < df._n; i++) {
        const c = df._d[cu][i], d = toDate(df._d[dc][i]), v = df._d[am][i];
        if (isNA(c) || !d) continue;
        if (!maxD || d > maxD) maxD = d;
        const k = keyOf(c);
        let e = m.get(k); if (!e) m.set(k, e = { c, last: d, n: 0, sum: 0, orders: new Set() });
        if (d > e.last) e.last = d;
        e.orders.add(o.order ? keyOf(df._d[o.order][i]) : i); e.sum += isNum(v) ? v : 0;
      }
      const now = o.now ? toDate(o.now) : new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate() + 1);
      const rows = [...m.values()];
      const rec = rows.map(e => Math.floor((now - new Date(e.last.getFullYear(), e.last.getMonth(), e.last.getDate())) / 86400000));
      const fr = rows.map(e => e.orders.size), mon = rows.map(e => e.sum);
      const q = o.bins || 5;
      const score = (vals, rev) => { const r = new Series(vals).rank({ method: 'first' }).values, n = vals.length; return r.map(x => { const s = Math.min(q, Math.floor((x - 1) * q / n) + 1); return rev ? q + 1 - s : s; }); };
      const R = score(rec, true), F = score(fr), M = score(mon);
      const seg = (r, f) => {
        if (q !== 5) return null;
        const k = `${r}${f}`;
        if (/^[1-2][1-2]$/.test(k)) return 'Tertidur';
        if (/^[1-2][3-4]$/.test(k)) return 'Berisiko';
        if (/^[1-2]5$/.test(k)) return 'Jangan Sampai Hilang';
        if (/^3[1-2]$/.test(k)) return 'Hampir Tertidur';
        if (k === '33') return 'Perlu Perhatian';
        if (/^[3-4][4-5]$/.test(k)) return 'Pelanggan Setia';
        if (k === '41') return 'Menjanjikan';
        if (k === '51') return 'Pelanggan Baru';
        if (/^[4-5][2-3]$/.test(k)) return 'Calon Setia';
        if (/^5[4-5]$/.test(k)) return 'Juara';
        return 'Lainnya';
      };
      return new DataFrame({
        [cu]: rows.map(e => e.c), recency: rec, frequency: fr, monetary: mon, R, F, M,
        skor_rfm: R.map((r, i) => `${r}${F[i]}${M[i]}`), segmen: R.map((r, i) => seg(r, F[i]))
      }).sort_values('monetary', { ascending: false });
    },

    funnel(data, o) {
      o = o || {};
      let steps, counts;
      if (data instanceof DataFrame) {
        const st = o.step || o.tahap, us = o.user || o.pengguna;
        if (us) {
          data._need([st, us]);
          steps = o.order ? arr(o.order) : A.unique(data._d[st]);
          const sets = steps.map(s => new Set(data._d[us].filter((u, i) => keyOf(data._d[st][i]) === keyOf(s)).map(keyOf)));
          if (o.strict !== false) for (let k = 1; k < sets.length; k++) sets[k] = new Set([...sets[k]].filter(u => sets[k - 1].has(u)));
          counts = sets.map(s => s.size);
        } else {
          const cc = o.count || o.jumlah || data._c.find(k => /int|number/.test(inferType(data._d[k])));
          steps = data._d[st].slice(); counts = data._d[cc].slice();
        }
      } else if (Array.isArray(data)) { steps = data.map((_, i) => 'Tahap ' + (i + 1)); counts = data.slice(); }
      else { steps = Object.keys(data); counts = Object.values(data); }
      return new DataFrame({
        tahap: steps.map(fmtCat), jumlah: counts,
        konversi_dari_awal: counts.map(c => counts[0] ? c / counts[0] : null),
        konversi_dari_sebelumnya: counts.map((c, i) => i ? (counts[i - 1] ? c / counts[i - 1] : null) : 1),
        hilang: counts.map((c, i) => i ? counts[i - 1] - c : 0)
      });
    },

    pareto(df, o) {
      o = o || {};
      const cat = o.category || o.kategori, val = o.value || o.nilai;
      df._need([cat, val]);
      const g = df.groupby(cat).agg({ [val]: [val, 'sum'] }).sort_values(val, { ascending: false });
      const tot = A.sum(g._d[val]);
      let cum = 0;
      const a = o.a || 0.8, b = o.b || 0.95;
      g.set('persen', g._d[val].map(v => tot ? v / tot : 0));
      g.set('persen_kumulatif', g._d.persen.map(p => (cum += p)));
      g.set('kelas', g._d.persen_kumulatif.map((c, i) => { const prev = i ? g._d.persen_kumulatif[i - 1] : 0; return prev < a ? 'A' : prev < b ? 'B' : 'C'; }));
      return g;
    },

    growth(df, o) {
      o = o || {};
      const dc = o.date || o.tanggal, vc = o.value || o.nilai, f = freqOf(o.period || o.freq || 'M');
      df._need([dc, vc]);
      const r = df.resample(dc, f).agg({ [vc]: [vc, o.agg || 'sum'] });
      const v = r._d[vc];
      const lagY = { D: 365, W: 52, M: 12, Q: 4, Y: 1, H: 24 * 365 }[f];
      r.set('periode', r._d[dc].map(d => periodLabel(d, f)));
      r.set('pertumbuhan', new Series(v).pct_change().values);
      if (f !== 'Y') r.set('pertumbuhan_yoy', new Series(v).pct_change(lagY).values);
      r.set('kumulatif', new Series(v).cumsum().values);
      return r.reorder(['periode']);
    },

    abc: null
  };
  Analysis.abc = Analysis.pareto;

  /* ======================================================================
   * Dataset contoh (sintetis, kecuali iris)
   * ==================================================================== */

  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const pick = (r, a, w) => { if (!w) return a[Math.floor(r() * a.length)]; let t = r() * w.reduce((s, x) => s + x, 0); for (let i = 0; i < a.length; i++) if ((t -= w[i]) <= 0) return a[i]; return a[a.length - 1]; };
  const day = (y, m, d) => new Date(y, m, d);

  const DATASETS = {
    penjualan: {
      desc: 'Transaksi toko di Papua 2023–2024: tanggal, pelanggan, kota, kanal, kategori, produk, jumlah, harga, total. Cocok untuk EDA, groupby, deret waktu, kohort, dan RFM.',
      make() {
        const r = rng(2024);
        const kota = ['Jayapura', 'Sorong', 'Merauke', 'Manokwari', 'Timika', 'Biak'], wk = [32, 20, 14, 13, 12, 9];
        const produk = [['Minuman', 'Kopi Papua 250g', 65000], ['Minuman', 'Teh Hijau', 28000], ['Minuman', 'Air Mineral 12x', 42000], ['Makanan', 'Sagu Lempeng', 25000], ['Makanan', 'Abon Ikan', 55000], ['Makanan', 'Keripik Keladi', 18000], ['Snack', 'Kacang Mete', 48000], ['Snack', 'Cokelat Batang', 22000], ['Rumah Tangga', 'Sabun Cuci', 35000], ['Rumah Tangga', 'Minyak Goreng 2L', 38000], ['Pakaian', 'Kaos Noken', 120000], ['Pakaian', 'Topi Rimba', 85000]];
        const pw = [14, 9, 10, 9, 6, 9, 5, 8, 7, 9, 3, 3];
        const rows = [];
        const start = day(2023, 0, 1), end = day(2024, 11, 31), span = (end - start) / 86400000;
        let id = 1;
        for (let c = 1; c <= 320; c++) {
          const cid = 'P' + String(c).padStart(3, '0'), k = pick(r, kota, wk), online = r() < (k === 'Jayapura' ? 0.55 : 0.35);
          let t = Math.floor(Math.pow(r(), 1.3) * span);
          const loyal = r(), mean = 20 + 70 * (1 - loyal), churn = 0.07 + 0.25 * (1 - loyal);
          const spend = Math.exp(gauss(r) * 0.35);
          while (t <= span) {
            const d = new Date(start.getTime() + t * 86400000);
            const mo = d.getMonth();
            const boost = mo === 11 ? 1.6 : (mo === 3 && d.getFullYear() === 2023) || (mo === 2 && d.getFullYear() === 2024) ? 1.5 : 1;
            const items = 1 + Math.floor(r() * 3 * boost);
            for (let it = 0; it < items; it++) {
              const pi = pick(r, [...produk.keys()], pw), p = produk[pi];
              const qty = Math.max(1, Math.round(1 + Math.abs(gauss(r)) * 2 * spend));
              rows.push({ id_transaksi: 'T' + String(id).padStart(5, '0'), tanggal: d, pelanggan_id: cid, kota: k, kanal: online ? (r() < 0.85 ? 'Online' : 'Toko') : (r() < 0.9 ? 'Toko' : 'Online'), kategori: p[0], produk: p[1], jumlah: qty, harga: p[2], total: qty * p[2] });
            }
            id++;
            if (r() < churn) break;
            t += Math.max(1, Math.round(-Math.log(1 - r()) * mean / boost));
          }
        }
        rows.sort((a, b) => a.tanggal - b.tanggal || (a.id_transaksi < b.id_transaksi ? -1 : 1));
        return new DataFrame(rows);
      }
    },
    penjualan_bulanan: {
      desc: 'Omzet bulanan 2019–2024 dengan tren naik dan pola musiman (puncak Desember). Cocok untuk dekomposisi dan peramalan.',
      make() {
        const r = rng(7), rows = [];
        const sea = [0.92, 0.88, 1.0, 1.08, 1.02, 0.97, 1.05, 1.01, 0.95, 0.98, 1.06, 1.32];
        for (let y = 2019; y <= 2024; y++) for (let m = 0; m < 12; m++) {
          const t = (y - 2019) * 12 + m;
          const covid = y === 2020 && m >= 3 && m <= 8 ? 0.78 : 1;
          rows.push({ bulan: day(y, m, 1), omzet_juta: Math.round((180 + t * 2.4) * sea[m] * covid * (1 + gauss(r) * 0.03) * 10) / 10 });
        }
        return new DataFrame(rows);
      }
    },
    kunjungan_harian: {
      desc: 'Kunjungan harian situs web selama dua tahun dengan pola mingguan. Cocok untuk rolling, resample, dan peramalan harian.',
      make() {
        const r = rng(11), rows = [];
        const wd = [1.08, 1.05, 1.04, 1.02, 0.98, 0.86, 0.8];
        for (let i = 0; i < 730; i++) {
          const d = day(2023, 0, 1 + i), w = (d.getDay() + 6) % 7;
          const v = (900 + i * 0.9) * wd[w] * (1 + 0.08 * Math.sin(2 * Math.PI * i / 365)) * (1 + gauss(r) * 0.06) + (r() < 0.01 ? 900 : 0);
          rows.push({ tanggal: d, pengunjung: Math.round(v), daftar: Math.round(v * (0.03 + gauss(r) * 0.004)) });
        }
        return new DataFrame(rows);
      }
    },
    pelanggan: {
      desc: 'Data 1.000 pelanggan layanan internet dan apakah mereka berhenti (churn). Cocok untuk klasifikasi dan regresi logistik.',
      make() {
        const r = rng(99), rows = [];
        for (let i = 1; i <= 1000; i++) {
          const paket = pick(r, ['Dasar', 'Plus', 'Premium'], [5, 3, 2]), lama = Math.max(1, Math.round(Math.abs(gauss(r)) * 20 + r() * 12));
          const umur = Math.round(Math.min(70, Math.max(18, 34 + gauss(r) * 10)));
          const tagihan = Math.round(({ Dasar: 180, Plus: 280, Premium: 420 })[paket] * (1 + gauss(r) * 0.08)) * 1000;
          const keluhan = Math.min(8, Math.floor(-Math.log(1 - r()) * 1.1));
          const app = r() < 0.55;
          const z = 1.6 - 0.13 * lama + 1.2 * keluhan - 1.8 * app + (paket === 'Premium' ? -0.5 : paket === 'Plus' ? -0.2 : 0) + 0.004 * (tagihan / 1000 - 250) - 0.01 * (umur - 34);
          rows.push({ pelanggan_id: 'C' + String(i).padStart(4, '0'), umur, kota: pick(r, ['Jayapura', 'Sorong', 'Merauke', 'Manokwari'], [4, 3, 2, 2]), paket, lama_berlangganan: lama, tagihan_bulanan: tagihan, jumlah_keluhan: keluhan, pakai_aplikasi: app, churn: r() < 1 / (1 + Math.exp(-z)) ? 1 : 0 });
        }
        return new DataFrame(rows);
      }
    },
    ab_test: {
      desc: 'Eksperimen A/B halaman checkout dengan 4.000 pengunjung: grup, perangkat, beli (0/1), nilai belanja. Cocok untuk uji A/B dan uji proporsi.',
      make() {
        const r = rng(12), rows = [];
        for (let i = 1; i <= 4000; i++) {
          const g = i % 2 ? 'A' : 'B', dev = r() < 0.68 ? 'Mobile' : 'Desktop';
          const p = (g === 'A' ? 0.10 : 0.128) * (dev === 'Desktop' ? 1.25 : 0.9);
          const buy = r() < p ? 1 : 0;
          rows.push({ user_id: 'U' + String(i).padStart(5, '0'), grup: g, perangkat: dev, klik: buy || r() < 0.35 ? 1 : 0, beli: buy, nilai_belanja: buy ? Math.round(Math.exp(11.9 + gauss(r) * 0.45 + (g === 'B' ? 0.03 : 0)) / 1000) * 1000 : 0 });
        }
        return new DataFrame(rows);
      }
    },
    karyawan: {
      desc: 'Data 300 karyawan: pengalaman, pendidikan, departemen, jam pelatihan, nilai kinerja, dan gaji. Cocok untuk regresi berganda dan ANOVA.',
      make() {
        const r = rng(31), rows = [];
        const pend = ['SMA', 'D3', 'S1', 'S2'], dep = ['Keuangan', 'Pemasaran', 'TI', 'Operasional'];
        for (let i = 1; i <= 300; i++) {
          const pe = pick(r, pend, [3, 2, 5, 2]), dp = pick(r, dep), exp = Math.max(0, Math.round(Math.abs(gauss(r)) * 7 + r() * 3));
          const lat = Math.max(0, Math.round(20 + gauss(r) * 10));
          const kin = Math.round(Math.min(100, Math.max(40, 68 + 0.4 * lat + 0.6 * exp + gauss(r) * 8)));
          const gaji = 4.2 + 0.45 * exp + ({ SMA: 0, D3: 0.8, S1: 2.1, S2: 4 })[pe] + ({ Keuangan: 0.6, Pemasaran: 0.2, TI: 1.4, Operasional: 0 })[dp] + 0.02 * (kin - 70) + gauss(r) * 0.9;
          rows.push({ karyawan_id: 'K' + String(i).padStart(3, '0'), pengalaman_tahun: exp, pendidikan: pe, departemen: dp, jam_pelatihan: lat, nilai_kinerja: kin, gaji_juta: Math.round(gaji * 100) / 100 });
        }
        return new DataFrame(rows);
      }
    },
    nilai_ujian: {
      desc: 'Nilai 90 siswa sebelum dan sesudah program belajar, dari tiga metode berbeda. Cocok untuk uji-t berpasangan dan ANOVA.',
      make() {
        const r = rng(3), rows = [];
        const m = ['Ceramah', 'Diskusi', 'Proyek'], g = { Ceramah: 3, Diskusi: 6, Proyek: 9 };
        for (let i = 1; i <= 90; i++) {
          const mt = m[(i - 1) % 3], pre = Math.round(Math.min(98, Math.max(30, 62 + gauss(r) * 10)));
          rows.push({ siswa: 'S' + String(i).padStart(2, '0'), metode: mt, kelas: i % 2 ? 'X-A' : 'X-B', nilai_sebelum: pre, nilai_sesudah: Math.round(Math.min(100, Math.max(30, pre + g[mt] + gauss(r) * 6))) });
        }
        return new DataFrame(rows);
      }
    },
    data_kotor: {
      desc: 'Data pesanan yang sengaja berantakan: spasi berlebih, huruf besar-kecil campur, harga sebagai teks "Rp", format tanggal campur, nilai kosong, duplikat, dan pencilan. Untuk latihan pembersihan data.',
      make() {
        const r = rng(13), rows = [];
        const kota = [' jayapura', 'Jayapura', 'JAYAPURA ', 'Sorong', 'sorong', 'Merauke', 'merauke  ', null];
        const nama = ['ani lestari', 'BUDI santoso', ' Citra Dewi', 'dedi  kurniawan', 'Eka Putri', 'fajar NUGROHO'];
        for (let i = 1; i <= 60; i++) {
          const d = day(2024, Math.floor(r() * 6), 1 + Math.floor(r() * 28));
          const fmts = [strftime(d, '%Y-%m-%d'), strftime(d, '%d/%m/%Y'), strftime(d, '%d-%m-%Y'), `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`];
          const harga = Math.round((50 + r() * 450)) * 1000;
          rows.push({ id_pesanan: 'ORD-' + (100 + i), pelanggan: pick(r, nama), kota: pick(r, kota), tanggal: pick(r, fmts), harga: r() < 0.5 ? 'Rp ' + harga.toLocaleString('id-ID') : String(harga), jumlah: r() < 0.08 ? null : 1 + Math.floor(r() * 5), status: pick(r, ['Selesai', 'selesai', 'SELESAI', 'Batal', 'Proses']) });
        }
        rows[7].harga = 'Rp 25.000.000'; rows[21].jumlah = 250; rows.push(Object.assign({}, rows[3]), Object.assign({}, rows[10]));
        rows[15].harga = null; rows[30].tanggal = null;
        return new DataFrame(rows);
      }
    },
    iris: {
      desc: 'Data bunga iris klasik (Fisher, 1936): 150 bunga, 4 ukuran, 3 spesies. Data asli, domain publik. Cocok untuk klasifikasi dan klaster.',
      make() {
        const sp = ['setosa', 'versicolor', 'virginica'];
        const raw = '5.1,3.5,1.4,0.2,0;4.9,3,1.4,0.2,0;4.7,3.2,1.3,0.2,0;4.6,3.1,1.5,0.2,0;5,3.6,1.4,0.2,0;5.4,3.9,1.7,0.4,0;4.6,3.4,1.4,0.3,0;5,3.4,1.5,0.2,0;4.4,2.9,1.4,0.2,0;4.9,3.1,1.5,0.1,0;5.4,3.7,1.5,0.2,0;4.8,3.4,1.6,0.2,0;4.8,3,1.4,0.1,0;4.3,3,1.1,0.1,0;5.8,4,1.2,0.2,0;5.7,4.4,1.5,0.4,0;5.4,3.9,1.3,0.4,0;5.1,3.5,1.4,0.3,0;5.7,3.8,1.7,0.3,0;5.1,3.8,1.5,0.3,0;5.4,3.4,1.7,0.2,0;5.1,3.7,1.5,0.4,0;4.6,3.6,1,0.2,0;5.1,3.3,1.7,0.5,0;4.8,3.4,1.9,0.2,0;5,3,1.6,0.2,0;5,3.4,1.6,0.4,0;5.2,3.5,1.5,0.2,0;5.2,3.4,1.4,0.2,0;4.7,3.2,1.6,0.2,0;4.8,3.1,1.6,0.2,0;5.4,3.4,1.5,0.4,0;5.2,4.1,1.5,0.1,0;5.5,4.2,1.4,0.2,0;4.9,3.1,1.5,0.2,0;5,3.2,1.2,0.2,0;5.5,3.5,1.3,0.2,0;4.9,3.6,1.4,0.1,0;4.4,3,1.3,0.2,0;5.1,3.4,1.5,0.2,0;5,3.5,1.3,0.3,0;4.5,2.3,1.3,0.3,0;4.4,3.2,1.3,0.2,0;5,3.5,1.6,0.6,0;5.1,3.8,1.9,0.4,0;4.8,3,1.4,0.3,0;5.1,3.8,1.6,0.2,0;4.6,3.2,1.4,0.2,0;5.3,3.7,1.5,0.2,0;5,3.3,1.4,0.2,0;7,3.2,4.7,1.4,1;6.4,3.2,4.5,1.5,1;6.9,3.1,4.9,1.5,1;5.5,2.3,4,1.3,1;6.5,2.8,4.6,1.5,1;5.7,2.8,4.5,1.3,1;6.3,3.3,4.7,1.6,1;4.9,2.4,3.3,1,1;6.6,2.9,4.6,1.3,1;5.2,2.7,3.9,1.4,1;5,2,3.5,1,1;5.9,3,4.2,1.5,1;6,2.2,4,1,1;6.1,2.9,4.7,1.4,1;5.6,2.9,3.6,1.3,1;6.7,3.1,4.4,1.4,1;5.6,3,4.5,1.5,1;5.8,2.7,4.1,1,1;6.2,2.2,4.5,1.5,1;5.6,2.5,3.9,1.1,1;5.9,3.2,4.8,1.8,1;6.1,2.8,4,1.3,1;6.3,2.5,4.9,1.5,1;6.1,2.8,4.7,1.2,1;6.4,2.9,4.3,1.3,1;6.6,3,4.4,1.4,1;6.8,2.8,4.8,1.4,1;6.7,3,5,1.7,1;6,2.9,4.5,1.5,1;5.7,2.6,3.5,1,1;5.5,2.4,3.8,1.1,1;5.5,2.4,3.7,1,1;5.8,2.7,3.9,1.2,1;6,2.7,5.1,1.6,1;5.4,3,4.5,1.5,1;6,3.4,4.5,1.6,1;6.7,3.1,4.7,1.5,1;6.3,2.3,4.4,1.3,1;5.6,3,4.1,1.3,1;5.5,2.5,4,1.3,1;5.5,2.6,4.4,1.2,1;6.1,3,4.6,1.4,1;5.8,2.6,4,1.2,1;5,2.3,3.3,1,1;5.6,2.7,4.2,1.3,1;5.7,3,4.2,1.2,1;5.7,2.9,4.2,1.3,1;6.2,2.9,4.3,1.3,1;5.1,2.5,3,1.1,1;5.7,2.8,4.1,1.3,1;6.3,3.3,6,2.5,2;5.8,2.7,5.1,1.9,2;7.1,3,5.9,2.1,2;6.3,2.9,5.6,1.8,2;6.5,3,5.8,2.2,2;7.6,3,6.6,2.1,2;4.9,2.5,4.5,1.7,2;7.3,2.9,6.3,1.8,2;6.7,2.5,5.8,1.8,2;7.2,3.6,6.1,2.5,2;6.5,3.2,5.1,2,2;6.4,2.7,5.3,1.9,2;6.8,3,5.5,2.1,2;5.7,2.5,5,2,2;5.8,2.8,5.1,2.4,2;6.4,3.2,5.3,2.3,2;6.5,3,5.5,1.8,2;7.7,3.8,6.7,2.2,2;7.7,2.6,6.9,2.3,2;6,2.2,5,1.5,2;6.9,3.2,5.7,2.3,2;5.6,2.8,4.9,2,2;7.7,2.8,6.7,2,2;6.3,2.7,4.9,1.8,2;6.7,3.3,5.7,2.1,2;7.2,3.2,6,1.8,2;6.2,2.8,4.8,1.8,2;6.1,3,4.9,1.8,2;6.4,2.8,5.6,2.1,2;7.2,3,5.8,1.6,2;7.4,2.8,6.1,1.9,2;7.9,3.8,6.4,2,2;6.4,2.8,5.6,2.2,2;6.3,2.8,5.1,1.5,2;6.1,2.6,5.6,1.4,2;7.7,3,6.1,2.3,2;6.3,3.4,5.6,2.4,2;6.4,3.1,5.5,1.8,2;6,3,4.8,1.8,2;6.9,3.1,5.4,2.1,2;6.7,3.1,5.6,2.4,2;6.9,3.1,5.1,2.3,2;5.8,2.7,5.1,1.9,2;6.8,3.2,5.9,2.3,2;6.7,3.3,5.7,2.5,2;6.7,3,5.2,2.3,2;6.3,2.5,5,1.9,2;6.5,3,5.2,2,2;6.2,3.4,5.4,2.3,2;5.9,3,5.1,1.8,2';
        return new DataFrame(raw.split(';').map(r => { const v = r.split(',').map(Number); return { panjang_kelopak: v[0], lebar_kelopak: v[1], panjang_mahkota: v[2], lebar_mahkota: v[3], spesies: sp[v[4]] }; }));
      }
    }
  };
  const DS_CACHE = new Map();
  function dataset(name) {
    const k = String(name || '').toLowerCase().replace(/[\s-]+/g, '_');
    const d = DATASETS[k];
    if (!d) fail(`Dataset "${name}" tidak ada. Pilih salah satu: ${Object.keys(DATASETS).join(', ')}.`);
    if (!DS_CACHE.has(k)) DS_CACHE.set(k, d.make());
    return DS_CACHE.get(k).copy();
  }
  function datasets() { return new DataFrame(Object.entries(DATASETS).map(([k, d]) => ({ nama: k, keterangan: d.desc, baris: (DS_CACHE.get(k) || (DS_CACHE.set(k, d.make()), DS_CACHE.get(k)))._n }))); }

  /* ======================================================================
   * Python lewat Pyodide (opsional, dimuat hanya saat dipanggil)
   * ==================================================================== */

  const PYODIDE_VERSION = '0.29.5';
  let PY = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src));
      document.head.append(s);
    });
  }
  function pyodide(o) {
    o = o || {};
    if (PY) return PY;
    const base = (o.index_url || Slak.pyodide_url || `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`).replace(/\/?$/, '/');
    PY = (async () => {
      if (typeof location !== 'undefined' && location.protocol === 'file:' && !/^https?:/.test(base))
        fail('Python (Pyodide) tidak bisa dimuat dari berkas lokal saat halaman dibuka dengan klik dua kali.');
      if (!global.loadPyodide) {
        try { await loadScript(base + 'pyodide.js'); }
        catch (e) { throw new Error('Python belum bisa dimuat. sl.python() butuh koneksi internet saat pertama kali dipakai (sekitar 10–30 MB). Periksa koneksi lalu jalankan ulang.'); }
      }
      return global.loadPyodide({ indexURL: base });
    })();
    PY.catch(() => { PY = null; });
    return PY;
  }

  const PY_PRELUDE = `
import json as _slak_json
def _slak_df(js, dates):
    d = _slak_json.loads(js)
    try:
        import pandas as _pd
    except ImportError:
        return d
    df = _pd.DataFrame(d)
    for c in dates:
        df[c] = _pd.to_datetime(df[c])
    return df
def _slak_out(v):
    try:
        import pandas as _pd
        if isinstance(v, _pd.Series):
            v = v.reset_index() if v.index.name is not None or not isinstance(v.index, _pd.RangeIndex) else v.to_frame()
        if isinstance(v, _pd.DataFrame):
            if not isinstance(v.index, _pd.RangeIndex):
                v = v.reset_index()
            v.columns = [" / ".join(map(str, c)) if isinstance(c, tuple) else str(c) for c in v.columns]
            return "df", v.to_json(orient="split", date_format="iso", default_handler=str)
    except ImportError:
        pass
    try:
        import numpy as _np
        if isinstance(v, _np.ndarray):
            return "json", _slak_json.dumps(v.tolist())
        if isinstance(v, _np.generic):
            return "json", _slak_json.dumps(v.item())
    except ImportError:
        pass
    try:
        return "json", _slak_json.dumps(v, default=str)
    except Exception:
        return "text", repr(v)
def _slak_figs():
    import sys
    if "matplotlib" not in sys.modules:
        return []
    import io, base64
    import matplotlib.pyplot as _plt
    out = []
    for n in _plt.get_fignums():
        f = _plt.figure(n)
        b = io.BytesIO()
        f.savefig(b, format="png", dpi=110, bbox_inches="tight")
        out.append(base64.b64encode(b.getvalue()).decode())
    _plt.close("all")
    return out
`;

  class PythonResult {
    constructor(o) { Object.assign(this, o); }
    toJSON() { return { value: this.value, stdout: this.stdout }; }
  }

  async function python(code, o) {
    o = o || {};
    const py = await pyodide(o);
    if (!py._slakPrelude) { await py.runPythonAsync(PY_PRELUDE); py._slakPrelude = true; }
    const pk = arr(o.packages);
    if (pk.length) await py.loadPackage(pk);
    await py.loadPackagesFromImports(code);
    if (/matplotlib/.test(code)) { try { await py.runPythonAsync('import matplotlib\nmatplotlib.use("Agg")'); } catch (e) { /* abaikan */ } }
    const KNOWN = new Set(['data', 'vars', 'packages', 'globals', 'index_url']);
    const data = Object.assign({}, o.data || o.vars || {});
    for (const k in o) if (!KNOWN.has(k)) data[k] = o[k];
    // DataFrame dikirim sebagai pandas.DataFrame: pastikan pandas sudah dimuat walau kode tidak menulis "import pandas".
    if (Object.values(data).some(v => v instanceof DataFrame) && !py._slakPandas) { await py.loadPackage('pandas'); py._slakPandas = true; }
    for (const k in data) {
      const v = data[k];
      if (v instanceof DataFrame) {
        const dates = v._c.filter(c => inferType(v._d[c]) === 'date');
        const cols = {};
        for (const c of v._c) cols[c] = dates.includes(c) ? v._d[c].map(x => isDate(x) ? strftime(x, '%Y-%m-%dT%H:%M:%S') : null) : v._d[c];
        py.globals.set('_slak_tmp', JSON.stringify(cols));
        py.globals.set('_slak_dates', py.toPy(dates));
        await py.runPythonAsync(`${k} = _slak_df(_slak_tmp, _slak_dates)`);
      } else if (v instanceof Series) py.globals.set(k, py.toPy(v.values));
      else py.globals.set(k, py.toPy(v));
    }
    const out = [];
    py.setStdout({ batched: s => out.push(s) });
    py.setStderr({ batched: s => out.push(s) });
    let r;
    try { r = await py.runPythonAsync(code); }
    catch (e) {
      const msg = String(e.message || e).split('\n').filter(Boolean);
      const last = msg.slice(-1)[0] || 'Galat Python';
      const err = new Error('Python: ' + last);
      err.stack = msg.join('\n');
      throw err;
    } finally { py.setStdout(); py.setStderr(); }
    let value = null;
    if (r !== undefined && r !== null) {
      py.globals.set('_slak_tmp', r);
      const pair = py.runPython('_slak_out(_slak_tmp)').toJs();
      if (r && typeof r.destroy === 'function') r.destroy();
      const [kind, s] = pair;
      if (kind === 'df') {
        const j = JSON.parse(s);
        const df = new DataFrame(j.data, { columns: j.columns.map(String) });
        for (const c of df._c) { const col = df._d[c]; if (col.length && col.every(x => x == null || (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(x)))) df._d[c] = col.map(x => x == null ? null : toDate(x.replace(/\.\d+.*$|Z$/, '').replace('T', ' '))); }
        value = df;
      } else if (kind === 'json') value = JSON.parse(s);
      else value = s;
    }
    let images = [];
    try { const f = py.runPython('_slak_figs()'); images = f.toJs(); f.destroy && f.destroy(); } catch (e) { /* abaikan */ }
    const ret = o.globals ? Object.fromEntries(arr(o.globals).map(k => { const v = py.globals.get(k); return [k, v && v.toJs ? v.toJs({ dict_converter: Object.fromEntries }) : v]; })) : null;
    return new PythonResult({ value, stdout: out.join('\n'), images: images.map(b => 'data:image/png;base64,' + b), globals: ret });
  }

  /* ======================================================================
   * Tampilan hasil di aplikasi (sl.write)
   * ==================================================================== */

  const P = (v, d) => v == null || (typeof v === 'number' && isNaN(v)) ? '—' : isNum(v) ? fmtN(v, d) : String(v);
  function renderTest(ctx, r, EL) {
    const sig = r.significant;
    EL.container(ctx, { border: true }, c => {
      c.markdown(`**${esc(r.test)}**`);
      const cols = c.columns(r.effect ? 3 : 2);
      cols[0].metric(r.statistic_name || 'Statistik', P(r.statistic, 4));
      cols[1].metric('p-value', fmtP(r.p_value));
      if (r.effect) cols[2].metric(r.effect.name, P(r.effect.value, 3), r.effect.label || null, { delta_color: 'off' });
      (sig ? c.success : c.info)(r.conclusion);
      if (r.warning) c.warning(r.warning);
      const rows = [];
      if (r.df != null) rows.push(['Derajat bebas', Array.isArray(r.df) ? r.df.map(v => P(v, 2)).join(' dan ') : P(r.df, 2)]);
      if (r.ci) rows.push([`Interval kepercayaan ${Math.round((r.confidence || 0.95) * 100)}%`, `${P(r.ci[0], 4)} sampai ${P(r.ci[1], 4)}`]);
      for (const k in (r.details || {})) rows.push([k, P(r.details[k], 4)]);
      if (rows.length) c.expander('Rincian', e => {
        e.table(rows.map(([a, b]) => ({ ukuran: a, nilai: b })), { hide_index: true });
        if (r.table) e.table(r.table, { hide_index: true });
        if (r.group_stats) e.table(r.group_stats, { hide_index: true });
        if (r.expected) { e.caption('Frekuensi harapan'); e.table(r.expected, { hide_index: true }); }
      });
    });
  }
  function renderRegression(ctx, m, EL) {
    EL.container(ctx, { border: true }, c => {
      c.markdown(`**${m.kind === 'logit' ? 'Regresi logistik' : 'Regresi linear (OLS)'}**: \`${esc(m.formula)}\``);
      const cols = c.columns(4);
      if (m.kind === 'logit') {
        cols[0].metric('Data', fmtNum(m.nobs)); cols[1].metric('Pseudo R²', P(m.prsquared, 3)); cols[2].metric('p (uji model)', fmtP(m.llr_pvalue)); cols[3].metric('AIC', P(m.aic, 1));
      } else {
        cols[0].metric('Data', fmtNum(m.nobs)); cols[1].metric('R²', P(m.rsquared, 3)); cols[2].metric('R² terkoreksi', P(m.rsquared_adj, 3)); cols[3].metric('p (uji F)', fmtP(m.f_pvalue));
      }
      if (m.warning) c.warning(m.warning);
      if (m.dropped) c.caption(`${m.dropped} baris dengan nilai kosong tidak dipakai.`);
      c.dataframe(m.summary(), { hide_index: true, format: { koefisien: 'decimal:4', std_error: 'decimal:4', t: 'decimal:3', z: 'decimal:3', batas_bawah: 'decimal:4', batas_atas: 'decimal:4', odds_ratio: 'decimal:3', p_value: fmtP } });
      const sigs = m.names.filter(n => n !== 'Intercept' && m.pvalues[n] < (m.alpha || 0.05));
      c.caption(sigs.length ? `Variabel yang berpengaruh signifikan (α = ${m.alpha || 0.05}): ${sigs.join(', ')}.` : 'Tidak ada variabel yang berpengaruh signifikan.');
      if (m.kind === 'ols') c.expander('Diagnostik model', e => {
        e.scatter_chart(m.fittedvalues.map((f, i) => ({ prediksi: f, residu: m.resid[i] })), { x: 'prediksi', y: 'residu', height: 220, title: 'Residu vs prediksi (pola acak = baik)' });
        const sw = m.nobs >= 3 && m.nobs <= 5000 ? Stats.shapiro(m.resid) : null;
        e.table([{ ukuran: 'Durbin-Watson (≈2 berarti residu tidak berautokorelasi)', nilai: P(m.durbin_watson, 3) }, { ukuran: 'Normalitas residu (Shapiro-Wilk p)', nilai: sw ? fmtP(sw.p_value) : '—' }, { ukuran: 'RMSE', nilai: P(Math.sqrt(m.mse_resid), 4) }], { hide_index: true });
        if (m.names.filter(n => n !== 'Intercept').length > 1) e.table(m.vif().round(2), { hide_index: true });
      });
    });
  }
  function renderForecast(ctx, f, EL) {
    EL.container(ctx, { border: true }, c => {
      const names = { ses: 'pemulusan eksponensial sederhana', holt: 'Holt (tren)', holt_winters: 'Holt-Winters (tren + musiman aditif)', holt_winters_mul: 'Holt-Winters (tren + musiman multiplikatif)', linear: 'tren linear', naive: 'naif', seasonal_naive: 'naif musiman', ma: 'rata-rata bergerak' };
      c.markdown(`**Peramalan ${esc(f.name)}** · metode ${names[f.method] || f.method} · ${f.periods} periode ke depan`);
      c.line_chart(f.combined, { x: f.x, y: ['aktual', 'prediksi', 'batas_bawah', 'batas_atas'], color: ['var(--slak-c1)', 'var(--slak-c2)', 'var(--slak-gray)', 'var(--slak-gray)'], height: 280 });
      const cols = c.columns(3);
      cols[0].metric('MAE', P(f.metrics.MAE, 2)); cols[1].metric('RMSE', P(f.metrics.RMSE, 2)); cols[2].metric('MAPE', f.metrics.MAPE == null ? '—' : (f.metrics.MAPE * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%');
      c.caption('Batas bawah/atas adalah perkiraan interval 95%. Galat dihitung dari data historis (in-sample).');
      c.expander('Tabel ramalan', e => e.dataframe(f.forecast.round(2), { hide_index: true }));
    });
  }
  function renderModel(ctx, m, EL) {
    EL.container(ctx, { border: true }, c => {
      c.markdown(`**${m.constructor.name}**`);
      const fitted = m.feature_names_in_ != null;
      c.caption(fitted ? `Sudah dilatih dengan ${m.feature_names_in_.length} fitur.` : 'Belum dilatih. Panggil .fit(X, y).');
      c.json(m.params);
      if (fitted && m.feature_importances_) c.bar_chart(m.importances().head(15), { x: 'fitur', y: 'kepentingan', horizontal: true, title: 'Kepentingan fitur' });
      else if (fitted && m.coefficients) c.dataframe(m.coefficients(), { hide_index: true });
    });
  }
  function renderPython(ctx, r, EL) {
    if (r.stdout) EL.code(ctx, r.stdout, { language: 'text' });
    for (const im of r.images || []) EL.image(ctx, im);
    if (r.value != null) EL.write(ctx, r.value);
  }


  /** sl.ml_demo(model, df, { target, features, title, key, explain }) — formulir coba-model:
   *  pengguna mengisi nilai fitur, Slak menampilkan prediksi (dan peluang tiap kelas). */
  const demoNum = v => typeof v === 'number' ? v.toLocaleString('id-ID', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 }) : String(v);
  function niceStep(span) {
    if (!(span > 0)) return 1;
    const raw = span / 100, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 2 ? 1 : m < 5 ? 2 : 5) * p;
  }
  function mlDemoEl(ctx, model, df, o) {
    o = o || {};
    if (!(model instanceof Model)) fail('sl.ml_demo butuh model dari sl.ml, misalnya sl.ml.RandomForestClassifier().');
    if (!(df instanceof DataFrame)) df = new DataFrame(df);
    const target = o.target || model.target_name;
    if (!model.plan) {
      if (!target) fail('Model belum dilatih. Isi { target: "nama_kolom" } agar sl.ml_demo melatihnya dengan data ini, atau panggil model.fit(X, y) dulu.');
      const sig = df._n + '|' + df._c.join(',') + '|' + target + '|' + (o.features || []).join(',');
      if (model._demoSig !== sig) {
        let d = o.features ? df.loc(null, [...o.features, target]) : df;
        d = d.dropna();
        if (!d._n) fail('Setelah baris kosong dibuang, tidak ada data tersisa untuk melatih model.');
        model.fit(d.drop(target), d.col(target));
        model._demoSig = sig;
      }
    }
    const plan = model.plan;
    const feats = plan.cols.map(p => p.c).filter(c => !o.features || o.features.includes(c));
    const base = 'ml_demo:' + (o.key != null ? o.key : (target || 'model'));
    const isClf = model._type === 'clf';
    let out = null;
    EL_ui(ctx).container({ border: true, key: base }, box => {
      box.subheader(o.title || (target ? `Coba model: tebak ${target}` : 'Coba model'));
      box.caption(o.caption || 'Ubah nilai di bawah. Prediksi dihitung ulang langsung di browser.');
      const k = Math.min(o.columns || 3, Math.max(1, feats.length));
      const cols = box.columns(k);
      const row = {};
      plan.cols.forEach((p, i) => {
        const c = p.c, vals = df._d[c] ? df._d[c].filter(v => !isNA(v)) : [];
        const shown = feats.includes(c);
        const w = cols[feats.indexOf(c) % k];
        if (p.kind === 'cat') {
          const opts = A.unique(vals).sort((a, b) => cmpVal(a, b));
          const cnt = new Map(); for (const v of vals) cnt.set(keyOf(v), (cnt.get(keyOf(v)) || 0) + 1);
          const mode = opts.reduce((m, v) => (cnt.get(keyOf(v)) || 0) > (cnt.get(keyOf(m)) || 0) ? v : m, opts[0]);
          row[c] = shown ? w.selectbox(c, opts, { index: Math.max(0, opts.indexOf(mode)), key: base + ':' + c }) : mode;
        } else if (p.kind === 'bool') {
          const yes = vals.filter(Boolean).length;
          row[c] = shown ? w.checkbox(c, { value: yes * 2 > vals.length, key: base + ':' + c }) : yes * 2 > vals.length;
        } else if (p.kind === 'date') {
          const ds = vals.map(v => toDate(v)).filter(Boolean).sort((a, b) => a - b), mid = ds[ds.length >> 1] || new Date();
          const iso = d => d.toISOString().slice(0, 10);
          row[c] = shown ? toDate(w.date_input(c, { value: iso(mid), min: ds.length ? iso(ds[0]) : undefined, max: ds.length ? iso(ds[ds.length - 1]) : undefined, key: base + ':' + c })) : mid;
        } else {
          const nums = vals.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
          const lo = nums.length ? nums[0] : 0, hi = nums.length ? nums[nums.length - 1] : 1, med = nums.length ? nums[nums.length >> 1] : 0;
          const isInt = nums.every(Number.isInteger);
          const step = isInt ? Math.max(1, Math.round(niceStep(hi - lo))) : niceStep(hi - lo);
          const dec = Math.max(0, -Math.floor(Math.log10(step)));
          const fix = v => +(+v).toFixed(dec);
          if (!shown) row[c] = med;
          else if (hi > lo) row[c] = w.slider(c, fix(lo), fix(hi), fix(Math.round(med / step) * step), step, { key: base + ':' + c });
          else row[c] = w.number_input(c, { value: med, key: base + ':' + c });
        }
      });
      const X = DataFrame._make(plan.cols.map(p => p.c), Object.fromEntries(plan.cols.map(p => [p.c, [row[p.c]]])), 1);
      const pred = model.predict(X).values[0];
      let proba = null;
      if (isClf && typeof model.predict_proba === 'function') {
        const P = model.predict_proba(X);
        proba = Object.fromEntries(P._c.map(cn => [cn, P._d[cn][0]]));
      }
      box.divider();
      const label = target ? `Prediksi ${target}` : 'Prediksi';
      const nm = v => o.labels && o.labels[v] != null ? String(o.labels[v]) : String(v);   // { labels: { 0: "Bertahan", 1: "Berhenti" } }
      if (proba) {
        const best = Math.max(...Object.values(proba));
        const r = box.columns([1, 2]);
        r[0].metric(label, nm(pred), { help: 'Kelas dengan peluang tertinggi' });
        r[0].caption(`Keyakinan model: ${Math.round(best * 100)}%`);
        const kelas = Object.keys(proba);
        r[1].bar_chart({ kelas: kelas.map(nm), 'peluang (%)': kelas.map(x => +(proba[x] * 100).toFixed(1)) }, { x: 'kelas', y: 'peluang (%)', horizontal: true, height: Math.max(120, 36 * kelas.length + 40) });
      } else {
        box.metric(label, o.labels ? nm(pred) : typeof pred === 'number' ? demoNum(pred) : String(pred));
        const tv = target && df._d[target] ? df._d[target].filter(v => typeof v === 'number') : [];
        if (tv.length) box.caption(`Di data latih, ${target} berkisar ${demoNum(Math.min(...tv))} sampai ${demoNum(Math.max(...tv))}.`);
      }
      if (o.explain !== false && (model.feature_importances_ || model.coefficients)) {
        box.expander('Fitur mana yang paling berpengaruh?', e => {
          if (model.feature_importances_) e.bar_chart(model.importances().head(10), { x: 'fitur', y: 'kepentingan', horizontal: true });
          else { const cf = model.coefficients(); e.dataframe(cf, { hide_index: true }); e.caption('Koefisien dihitung pada skala asli tiap kolom, jadi besar-kecilnya belum tentu sebanding antar-kolom.'); }
        });
      }
      out = { input: Object.assign({}, row), prediction: pred, proba };
    });
    return out;
  }
  const EL_ui = ctx => Slak.internals().makeAPI(ctx);

  /* ======================================================================
   * Pendaftaran ke Slak
   * ==================================================================== */

  const callable = C => { const f = function (...a) { return new C(...a); }; f.prototype = C.prototype; Object.defineProperty(f, 'name', { value: C.name }); return f; };
  for (const k of Object.keys(ML)) if (/^[A-Z]/.test(k)) ML[k] = callable(ML[k]);

  const api = {
    DataFrame: callable(DataFrame), Series: callable(Series),
    read_csv: readCSV, load_csv: readCSV, read_json: readJSON, read_excel: readExcel, excel_sheets: excelSheets, read_sheets: readSheets,
    from_csv: fromCSV, from_json: fromJSON, to_excel: toExcel,
    concat, merge: (a, b, o) => (a instanceof DataFrame ? a : new DataFrame(a)).merge(b, o), cut, qcut, get_dummies: getDummies, crosstab: (a, b, o) => crosstab(a instanceof Series ? a : new Series(a, 'baris'), b instanceof Series ? b : new Series(b, 'kolom'), o),
    pivot_table: (df, o) => df.pivot_table(o), melt: (df, o) => df.melt(o), date_range: dateRange,
    to_datetime: (v, o) => v instanceof Series ? v.to_datetime(o) : Array.isArray(v) ? v.map(x => toDate(x, o)) : toDate(v, o),
    to_numeric: (v, o) => v instanceof Series ? v.to_numeric(o) : Array.isArray(v) ? v.map(x => toNumber(x, o)) : toNumber(v, o),
    isna: isNA, dataset, datasets, stats: Stats, ml: ML, ts: TS, analysis: Analysis, python, pyodide, strftime
  };

  /** sl.pyplot(kode, { df: tabel }) — jalankan kode matplotlib lalu tampilkan grafiknya. */
  async function pyplotEl(ctx, code, o) {
    const I = Slak.internals();
    o = o || {};
    if (code && typeof code === 'object' && code.images) { for (const src of code.images) I.EL.image(ctx, src, { caption: o.caption }); return code; }
    const rec = I.place(ctx, 'pyplot', '', r => { r.el = I.h('div', { class: 'slak-el slak-pyplot slak-block' }); r.child = I.childCtx(r, r.el, '', ctx, { single: false }); });
    I.touch(rec.child);
    if (!rec.el.firstChild) rec.el.innerHTML = '<div class="slak-ext-load"><span class="slak-spin"></span> Menjalankan Python…</div>';
    const src = /matplotlib/.test(code) ? code : 'import matplotlib.pyplot as plt\n' + code;
    let res;
    try { res = await python(src, o); }
    catch (e) { rec.el.innerHTML = ''; throw e; }
    const loading = rec.el.querySelector('.slak-ext-load');
    if (loading) loading.remove();
    const api = I.makeAPI(rec.child);
    if (!res.images.length) api.caption('Kode Python tidak menghasilkan grafik. Pastikan memakai plt.plot(...) atau fungsi gambar matplotlib lainnya.');
    for (const img of res.images) api.image(img, { caption: o.caption });
    if (res.stdout && o.show_output) api.code(res.stdout, { language: 'text' });
    return res;
  }

  Slak.extend({
    api,
    elements: { pyplot: pyplotEl, ml_demo: mlDemoEl },
    wrap(src, rows) {
      // sl.data_editor: DataFrame masuk, DataFrame keluar
      if (!(src instanceof DataFrame)) return null;
      const c = src._c.slice();
      for (const r of rows) for (const k in r) if (!c.includes(k)) c.push(k);
      return DataFrame._make(c, Object.fromEntries(c.map(k => [k, rows.map(r => r[k] === undefined ? null : r[k])])), rows.length);
    },
    table(v) {
      if (v instanceof DataFrame) {
        const n = v._n, c = v._c, rows = new Array(n);
        for (let i = 0; i < n; i++) { const r = {}; for (const k of c) r[k] = v._d[k][i]; rows[i] = r; }
        return { rows, cols: c.slice() };
      }
      if (v instanceof Series) {
        const name = v.name != null ? String(v.name) : 'nilai';
        if (v.index) return { rows: v.index.map((k, i) => ({ label: k, [name]: v.values[i] })), cols: ['label', name] };
        return { rows: v.values.map(x => ({ [name]: x })), cols: [name] };
      }
      return null;
    },
    write(ctx, v, EL) {
      if (v instanceof DataFrame) { EL.dataframe(ctx, v); return true; }
      if (v instanceof Series) { EL.dataframe(ctx, v); return true; }
      if (v instanceof TestResult) { renderTest(ctx, v, EL); return true; }
      if (v instanceof RegressionResult) { renderRegression(ctx, v, EL); return true; }
      if (v instanceof ForecastResult) { renderForecast(ctx, v, EL); return true; }
      if (v instanceof PythonResult) { renderPython(ctx, v, EL); return true; }
      if (v instanceof Model) { renderModel(ctx, v, EL); return true; }
      return false;
    },
    blob(v, name) {
      const df = v instanceof DataFrame ? v : v instanceof Series ? v.to_frame() : null;
      if (/\.xlsx$/i.test(name)) {
        if (df) return toExcel({ Data: df });
        if (v && typeof v === 'object' && Object.values(v).every(x => x instanceof DataFrame || Array.isArray(x))) return toExcel(v);
        return null;
      }
      if (!df) return null;
      if (/\.json$/i.test(name)) return new Blob([df.to_json({ indent: 2 })], { type: 'application/json' });
      if (/\.(csv|txt)$/i.test(name) || !name) return new Blob([df.to_csv({ bom: true })], { type: 'text/csv;charset=utf-8' });
      if (/\.md$/i.test(name)) return new Blob([df.to_markdown()], { type: 'text/markdown' });
      return new Blob([df.to_csv({ bom: true })], { type: 'text/csv;charset=utf-8' });
    }
  });

  Slak.data = Object.assign({ version: '1.9.1', limits: LIMITS, DataFrame, Series, toDate, toNumber, TestResult, RegressionResult, ForecastResult }, api);
})(typeof window !== 'undefined' ? window : globalThis);

/* ======================================================================
 * Slak Data 1.4 — dataset online
 *   sl.read_url(url)                     berkas apa saja dari internet (CSV, TSV, JSON, Excel, zip)
 *   sl.github("pemilik/repo/jalur.csv")  berkas di GitHub
 *   sl.huggingface("org/dataset")        dataset Hugging Face
 *   sl.worldbank("NY.GDP.PCAP.CD")       indikator Bank Dunia
 *   sl.kaggle("pemilik/dataset")         dataset Kaggle (penuh di Slak Studio)
 *   sl.open_data("penguins")             katalog dataset terbuka pilihan
 * Setiap unduhan disimpan di browser, jadi aplikasi tetap jalan saat luring.
 * Dengan sl.offline_button() datanya bisa dibungkus menjadi berkas .js.
 * ==================================================================== */
(function (global) {
  'use strict';
  const Slak = global.Slak;
  if (!Slak || !Slak.data) return;
  const D = Slak.data;
  const fail = m => { throw new Error(m); };

  /* ---------- simpanan unduhan (IndexedDB) ---------- */
  const DBN = 'slak-unduhan';
  let dbp = null;
  function cdb() {
    if (!dbp) dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DBN, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('f');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  async function cacheGet(k) {
    try { const d = await cdb(); return await new Promise(res => { const r = d.transaction('f').objectStore('f').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); }
    catch (e) { return null; }
  }
  async function cachePut(k, v) {
    try { const d = await cdb(); await new Promise(res => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(v, k); t.oncomplete = res; t.onerror = res; }); }
    catch (e) { /* penyimpanan ditolak: tetap jalan tanpa simpanan */ }
  }
  async function cacheDel(k) {
    try { const d = await cdb(); await new Promise(res => { const t = d.transaction('f', 'readwrite'); k == null ? t.objectStore('f').clear() : t.objectStore('f').delete(k); t.oncomplete = res; t.onerror = res; }); }
    catch (e) { /* abaikan */ }
  }
  function ttlMs(t) {
    if (t == null) return 7 * 864e5;
    if (t === false || t === Infinity) return Infinity;
    if (typeof t === 'number') return t * 1000;
    const m = String(t).trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d|w|detik|menit|jam|hari|minggu)?$/i);
    if (!m) fail(`ttl "${t}" tidak dikenali. Contoh: 3600 (detik), "12h", "7d".`);
    const u = { s: 1, detik: 1, m: 60, menit: 60, h: 3600, jam: 3600, d: 86400, hari: 86400, w: 604800, minggu: 604800 }[(m[2] || 's').toLowerCase()];
    return +m[1] * u * 1000;
  }

  /* ---------- unduh: lewat Slak Studio (tanpa batasan CORS) atau fetch biasa ---------- */
  class NetError extends Error {}
  async function download(url, o) {
    if (typeof Slak.fetch_remote === 'function') {
      const r = await Slak.fetch_remote(url, { kaggle: !!o.kaggle });
      if (r && r.error) throw new NetError(r.error);
      if (r && r.bytes) return new Uint8Array(r.bytes);
    }
    let res;
    try { res = await fetch(url, o.headers ? { headers: o.headers } : undefined); }
    catch (e) { const er = new NetError('tidak bisa terhubung atau situs menolak permintaan dari halaman web (CORS)'); er.cors = true; throw er; }
    if (!res.ok) { const er = new NetError('HTTP ' + res.status); er.status = res.status; throw er; }
    return new Uint8Array(await res.arrayBuffer());
  }

  /* ---------- zip tanpa pustaka (DecompressionStream bawaan browser) ---------- */
  async function inflateRaw(b) {
    if (typeof DecompressionStream === 'undefined') fail('Browser ini belum bisa membuka zip. Perbarui browser, atau ekstrak zip-nya lalu baca berkas di dalamnya.');
    const ds = new DecompressionStream('deflate-raw');
    const out = new Response(new Blob([b]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
  }
  function zipEntries(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let e = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) fail('Berkas zip rusak atau bukan zip.');
    let n = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    // ZIP64 (dipakai Kaggle): direktori pusat ditunjuk oleh catatan akhir ZIP64.
    if ((n === 0xffff || p === 0xffffffff) && e >= 20 && dv.getUint32(e - 20, true) === 0x07064b50) {
      const z = Number(dv.getBigUint64(e - 12, true));
      if (dv.getUint32(z, true) === 0x06064b50) { n = Number(dv.getBigUint64(z + 32, true)); p = Number(dv.getBigUint64(z + 48, true)); }
    }
    const out = [], td = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      let csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      let off = dv.getUint32(p + 42, true);
      const name = td.decode(bytes.subarray(p + 46, p + 46 + nl));
      // Medan tambahan ZIP64 (id 0x0001) berisi ukuran/offset asli bila nilainya 0xFFFFFFFF.
      if (size === 0xffffffff || csize === 0xffffffff || off === 0xffffffff) {
        let x = p + 46 + nl;
        const xe = x + xl;
        while (x + 4 <= xe) {
          const id = dv.getUint16(x, true), ln = dv.getUint16(x + 2, true);
          if (id === 1) {
            let q = x + 4;
            if (size === 0xffffffff) { size = Number(dv.getBigUint64(q, true)); q += 8; }
            if (csize === 0xffffffff) { csize = Number(dv.getBigUint64(q, true)); q += 8; }
            if (off === 0xffffffff) { off = Number(dv.getBigUint64(q, true)); }
            break;
          }
          x += 4 + ln;
        }
      }
      p += 46 + nl + xl + cl;
      if (name.endsWith('/')) continue;
      out.push({
        name, size,
        async bytes() {
          const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true), st = off + 30 + lnl + lxl;
          const raw = bytes.subarray(st, st + csize);
          if (method === 0) return raw;
          if (method === 8) return inflateRaw(raw);
          fail(`Isi zip "${name}" memakai kompresi yang belum didukung (metode ${method}).`);
        }
      });
    }
    return out;
  }
  const DATA_EXT = /\.(csv|tsv|txt|json|jsonl|ndjson|xlsx|xls|geojson)$/i;
  async function fromZip(bytes, o, label) {
    const ents = zipEntries(bytes);
    const data = ents.filter(x => DATA_EXT.test(x.name) && !/(^|\/)(__MACOSX|\.)/.test(x.name));
    let pick = null;
    if (o.file) {
      const want = String(o.file).toLowerCase();
      pick = data.find(x => x.name.toLowerCase() === want) || data.find(x => x.name.toLowerCase().split('/').pop() === want);
      if (!pick) fail(`Berkas "${o.file}" tidak ada di ${label}. Isinya: ${data.map(x => x.name).join(', ') || '(tidak ada berkas data)'}.`);
    } else {
      pick = data.find(x => /\.csv$/i.test(x.name)) || data[0];
      if (!pick) fail(`${label} tidak berisi berkas data (CSV, JSON, Excel). Isinya: ${ents.map(x => x.name).slice(0, 10).join(', ')}.`);
      if (data.length > 1 && !o.quiet) console.info(`[Slak] ${label} berisi ${data.length} berkas data; yang dibaca: ${pick.name}. Pilih yang lain dengan { file: "nama.csv" }. Semua: ${data.map(x => x.name).join(', ')}`);
    }
    return { name: pick.name.split('/').pop(), bytes: await pick.bytes(), files: data.map(x => x.name) };
  }

  /* ---------- ubah isi berkas menjadi DataFrame ---------- */
  async function toFrame(bytes, name, o) {
    if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4) {
      const z = await fromZip(bytes, o, `zip "${name}"`);
      bytes = z.bytes; name = z.name;
    }
    const low = String(name).toLowerCase();
    const parse = o.parse || {};
    if (/\.(xlsx|xls)$/.test(low)) return D.read_excel(bytes, Object.assign({ cache: false }, parse));
    const text = new TextDecoder().decode(bytes).replace(/^﻿/, '');
    if (/\.(jsonl|ndjson)$/.test(low)) return D.from_json(text.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l)), parse);
    if (/\.(json|geojson)$/.test(low) || /^\s*[[{]/.test(text.slice(0, 200)) && !/\.(csv|tsv|txt)$/.test(low)) return D.from_json(text, parse);
    return D.from_csv(text, Object.assign(/\.tsv$/.test(low) ? { sep: '\t' } : {}, parse));
  }

  /* ---------- inti: cari di berkas lokal → simpanan → internet → simpanan lama ---------- */
  const FETCHED = new Map();   // sumber yang dimuat di sesi ini, untuk sl.offline_button()
  function wrappedName(name) { return String(name).split(/[?#]/)[0].split('/').pop(); }
  async function getBytes(key, urls, o) {
    o = o || {};
    const name = o.name || wrappedName(Array.isArray(urls) ? urls[0] : urls);
    // 1. berkas lokal: data.csv.js hasil "Bungkus data", <script data-file>, folder Slak Studio
    if (typeof Slak.load_file === 'function' && o.local !== false) {
      for (const n of [key, name]) {
        const b = await Slak.load_file(n, { local_only: true }).catch(() => null);
        if (b) { FETCHED.set(key, { name, bytes: b }); return { bytes: b, name, from: 'lokal' }; }
      }
    }
    // 2. simpanan di browser
    const c = await cacheGet(key);
    if (c && !o.refresh && Date.now() - c.t < ttlMs(o.ttl)) { FETCHED.set(key, { name: c.name || name, bytes: c.bytes }); return { bytes: c.bytes, name: c.name || name, from: 'simpanan' }; }
    // 3. internet
    let lastErr = null;
    for (const u of [].concat(urls)) {
      try {
        const b = await download(u, o);
        await cachePut(key, { bytes: b, name, t: Date.now(), url: u });
        FETCHED.set(key, { name, bytes: b });
        return { bytes: b, name, from: 'internet' };
      } catch (e) { lastErr = e; if (e && e.status === 404) break; }
    }
    // 4. simpanan lama (luring)
    if (c) {
      console.warn(`[Slak] Tidak bisa mengunduh ${key} (${lastErr && lastErr.message}); memakai simpanan dari ${new Date(c.t).toLocaleString()}.`);
      FETCHED.set(key, { name: c.name || name, bytes: c.bytes });
      return { bytes: c.bytes, name: c.name || name, from: 'simpanan lama' };
    }
    const lastUrl = [].concat(urls).pop();
    const er = new Error(o.errorText ? o.errorText(lastErr) : lastErr && (lastErr.cors || lastErr.status) && Slak._remoteHint ? Slak._remoteHint(lastUrl, lastErr.status ? 'HTTP ' + lastErr.status : '') : `Tidak bisa mengunduh ${key}: ${lastErr ? lastErr.message : 'galat tidak dikenal'}. Periksa koneksi internet dan nama sumbernya.`);
    er.cause = lastErr;
    throw er;
  }
  async function loadFrame(key, urls, o) {
    const r = await getBytes(key, urls, o);
    const df = await toFrame(r.bytes, r.name, o);
    return df;
  }

  /* ---------- sl.read_url ---------- */
  async function readURL(url, o) {
    o = o || {};
    if (!/^https?:\/\//i.test(String(url))) fail('read_url butuh alamat lengkap yang diawali https://. Untuk berkas di folder sendiri, pakai sl.read_csv("nama.csv").');
    return loadFrame(String(url), String(url), o);
  }

  /* ---------- sl.github ---------- */
  function ghParse(spec, o) {
    let s = String(spec).trim();
    let m = s.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/i);
    if (m) return { owner: m[1], repo: m[2], ref: m[3], path: m[4] };
    m = s.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i);
    if (m) return { owner: m[1], repo: m[2], ref: m[3], path: m[4] };
    m = s.match(/^([\w.-]+)\/([\w.-]+?)(?:@([\w./-]+?))?\/(.+)$/);
    if (!m) fail(`Format sl.github belum tepat: "${spec}". Contoh: sl.github("plotly/datasets/2014_usa_states.csv") atau alamat https://github.com/.../blob/.../berkas.csv.`);
    return { owner: m[1], repo: m[2], ref: m[3] || o.ref || o.branch || 'HEAD', path: m[4] };
  }
  async function github(spec, o) {
    o = o || {};
    const g = ghParse(spec, o);
    const path = g.path.split('/').map(encodeURIComponent).join('/');
    const urls = [`https://raw.githubusercontent.com/${g.owner}/${g.repo}/${g.ref}/${path}`];
    if (g.ref !== 'HEAD') urls.push(`https://cdn.jsdelivr.net/gh/${g.owner}/${g.repo}@${g.ref}/${path}`);
    return loadFrame(`github:${g.owner}/${g.repo}@${g.ref}/${g.path}`, urls, Object.assign({ name: g.path.split('/').pop() }, o));
  }

  /* ---------- sl.huggingface ---------- */
  async function huggingface(repo, o) {
    o = o || {};
    const r = String(repo).replace(/^https?:\/\/huggingface\.co\/datasets\//, '').replace(/\/+$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(r)) fail(`Nama dataset Hugging Face belum tepat: "${repo}". Contoh: sl.huggingface("scikit-learn/iris", { file: "Iris.csv" }).`);
    const rev = o.revision || 'main';
    let file = o.file;
    if (!file) {
      const meta = await getBytes(`huggingface-meta:${r}`, `https://huggingface.co/api/datasets/${r}`, { ttl: o.ttl, refresh: o.refresh, name: r.replace('/', '_') + '.meta.json', local: false });
      let info;
      try { info = JSON.parse(new TextDecoder().decode(meta.bytes)); } catch (e) { fail(`Daftar berkas dataset ${r} tidak terbaca.`); }
      const files = (info.siblings || []).map(x => x.rfilename).filter(f => /\.(csv|tsv|json|jsonl|xlsx)$/i.test(f));
      file = files.find(f => !f.includes('/')) || files[0];
      if (!file) fail(`Dataset ${r} tidak punya berkas CSV/JSON/Excel yang bisa dibaca langsung (mungkin hanya Parquet). Pilih berkas dengan { file: "..." }.`);
    }
    const url = `https://huggingface.co/datasets/${r}/resolve/${encodeURIComponent(rev)}/${String(file).split('/').map(encodeURIComponent).join('/')}`;
    return loadFrame(`huggingface:${r}@${rev}/${file}`, url, Object.assign({ name: String(file).split('/').pop() }, o));
  }

  /* ---------- sl.worldbank ---------- */
  async function worldbank(indicator, o) {
    o = o || {};
    const inds = [].concat(indicator).map(String);
    const neg = [].concat(o.negara || o.country || o.countries || 'IDN').map(x => String(x).toUpperCase()).join(';');
    const th = o.tahun || o.years || o.date;
    const date = Array.isArray(th) ? `${th[0]}:${th[1]}` : th != null ? String(th) : '';
    const frames = [];
    // Satu permintaan per negara: alamat dengan beberapa negara (IDN;MYS) ditolak sebagian browser/proxy.
    const one = async (ind, cc) => {
      const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(cc)}/indicator/${encodeURIComponent(ind)}?format=json&per_page=20000${date ? '&date=' + date : ''}`;
      const r = await getBytes(`worldbank:${ind}:${cc}:${date}`, url, Object.assign({}, o, { name: `worldbank_${ind}_${cc}.json`, local: o.local }));
      let j;
      try { j = JSON.parse(new TextDecoder().decode(r.bytes)); } catch (e) { fail('Jawaban Bank Dunia tidak terbaca.'); }
      if (!Array.isArray(j) || !Array.isArray(j[1])) {
        const msg = j && j[0] && j[0].message && j[0].message[0] ? j[0].message[0].value : 'tidak ada data';
        fail(`Bank Dunia: ${msg}. Periksa kode indikator "${ind}" (contoh: NY.GDP.PCAP.CD) dan kode negara "${cc}" (ISO-3, contoh: IDN, MYS).`);
      }
      return j[1].map(x => ({ negara: x.country && x.country.value, kode: x.countryiso3code || (x.country && x.country.id), tahun: +x.date, indikator: x.indicator && x.indicator.id, nama_indikator: x.indicator && x.indicator.value, nilai: x.value }));
    };
    for (const ind of inds) for (const part of await Promise.all(neg.split(';').map(cc => one(ind, cc)))) frames.push(...part);
    let df = D.DataFrame(frames.length ? frames : { negara: [], kode: [], tahun: [], indikator: [], nama_indikator: [], nilai: [] });
    if (df.length) df = df.sort_values(['kode', 'indikator', 'tahun']);
    if (o.wide && inds.length > 1) df = df.pivot_table({ index: ['negara', 'kode', 'tahun'], columns: 'indikator', values: 'nilai', aggfunc: 'first' }).reset_index();
    return df;
  }

  /* ---------- sl.kaggle ---------- */
  async function kaggle(spec, o) {
    o = o || {};
    const s = String(spec).replace(/^https?:\/\/(www\.)?kaggle\.com\/datasets\//, '').replace(/\/+$/, '');
    const m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (!m) fail(`Nama dataset Kaggle belum tepat: "${spec}". Tulis "pemilik/nama-dataset", seperti di alamat kaggle.com/datasets/pemilik/nama-dataset.`);
    const key = `kaggle:${m[1]}/${m[2]}`;
    const zipName = `${m[1]}_${m[2]}.zip`;
    const page = `https://www.kaggle.com/datasets/${m[1]}/${m[2]}`;
    let r;
    try {
      r = await getBytes(key, `https://www.kaggle.com/api/v1/datasets/download/${m[1]}/${m[2]}`, Object.assign({}, o, { name: zipName, kaggle: true }));
    } catch (e) {
      // browser biasa: Kaggle tidak mengizinkan unduhan langsung dari halaman web → minta berkas zip hasil unduhan manual
      if (typeof Slak.ask_file !== 'function' || typeof document === 'undefined') throw e;
      let b = Slak.pick_cache ? await Slak.pick_cache.get(zipName) : null;
      b = b && b.bytes ? new Uint8Array(b.bytes) : null;
      if (!b) {
        try {
          b = await Slak.ask_file(zipName, {
            title: 'Dataset Kaggle',
            message: `Kaggle tidak mengizinkan halaman web mengunduh dataset secara langsung. Buka <a href="${page}" target="_blank" rel="noopener">${m[1]}/${m[2]}</a> di Kaggle, tekan <b>Download</b>, lalu pilih berkas zip (atau CSV) hasil unduhannya di sini. Slak akan mengingatnya di browser ini.`,
            tip: 'Di Slak Studio, sl.kaggle() mengunduh sendiri tanpa langkah ini.',
            accept: '.zip,.csv,.json,.xlsx', button: '📂 Pilih berkas dari Kaggle'
          });
        } catch (er) { throw new Error(`Dataset Kaggle ${m[1]}/${m[2]} belum tersedia. Unduh dari ${page} lalu pilih berkasnya, atau jalankan di Slak Studio.`); }
      }
      FETCHED.set(key, { name: zipName, bytes: b });
      await cachePut(key, { bytes: b, name: zipName, t: Date.now(), url: page });
      r = { bytes: b, name: zipName };
    }
    return toFrame(r.bytes, r.name, o);
  }

  /* ---------- katalog sl.open_data ---------- */
  const GH = (repo, ref, path) => ({ repo, ref, path });
  const CATALOG = [
    { id: 'penguins', judul: 'Penguin Palmer', isi: '344 penguin dari 3 spesies: panjang paruh, sirip, berat, pulau', baris: 344, topik: 'biologi, klasifikasi', lisensi: 'CC0 (domain publik)', sumber: GH('allisonhorst/palmerpenguins', 'main', 'inst/extdata/penguins.csv') },
    { id: 'co2', judul: 'Emisi CO₂ dunia (Our World in Data)', isi: 'Emisi CO₂, gas rumah kaca, energi, dan penduduk per negara per tahun', baris: 50000, topik: 'lingkungan, ekonomi, deret waktu', lisensi: 'CC BY 4.0 (sebutkan Our World in Data)', ukuran: '14 MB', sumber: GH('owid/co2-data', 'master', 'owid-co2-data.csv') },
    { id: 'gapminder', judul: 'Gapminder', isi: 'Harapan hidup, PDB per kapita, dan penduduk 142 negara, 1952–2007', baris: 1704, topik: 'ekonomi, kesehatan', lisensi: 'CC BY 4.0 (sebutkan Gapminder)', sumber: GH('plotly/datasets', 'master', 'gapminderDataFiveYear.csv') },
    { id: 'iris', judul: 'Iris', isi: '150 bunga iris dari 3 spesies (dataset klasik)', baris: 150, topik: 'klasifikasi', lisensi: 'CC BY 4.0 (UCI Machine Learning Repository)', sumber: GH('mwaskom/seaborn-data', 'master', 'iris.csv') },
    { id: 'tips', judul: 'Tip restoran', isi: 'Tagihan, tip, hari, waktu, dan jumlah tamu di sebuah restoran', baris: 244, topik: 'statistik dasar', lisensi: 'Dataset klasik pendidikan; lisensi tidak dinyatakan di sumber', sumber: GH('mwaskom/seaborn-data', 'master', 'tips.csv') },
    { id: 'titanic', judul: 'Penumpang Titanic', isi: 'Kelas, usia, tarif, dan keselamatan 891 penumpang', baris: 891, topik: 'klasifikasi', lisensi: 'Dataset klasik pendidikan; lisensi tidak dinyatakan di sumber', sumber: GH('mwaskom/seaborn-data', 'master', 'titanic.csv') },
    { id: 'flights', judul: 'Penumpang pesawat bulanan', isi: 'Jumlah penumpang maskapai per bulan, 1949–1960', baris: 144, topik: 'deret waktu, peramalan', lisensi: 'Dataset klasik pendidikan; lisensi tidak dinyatakan di sumber', sumber: GH('mwaskom/seaborn-data', 'master', 'flights.csv') },
    { id: 'mpg', judul: 'Efisiensi bahan bakar mobil', isi: 'Mil per galon, silinder, tenaga, berat, asal 398 mobil', baris: 398, topik: 'regresi', lisensi: 'CC BY 4.0 (UCI Machine Learning Repository)', sumber: GH('mwaskom/seaborn-data', 'master', 'mpg.csv') },
    { id: 'diamonds', judul: 'Harga berlian', isi: 'Karat, potongan, warna, kejernihan, dan harga 53.940 berlian', baris: 53940, topik: 'regresi, data besar', lisensi: 'Dataset contoh ggplot2; lisensi tidak dinyatakan di sumber', ukuran: '2,7 MB', sumber: GH('mwaskom/seaborn-data', 'master', 'diamonds.csv') },
    { id: 'taxis', judul: 'Taksi New York', isi: 'Perjalanan taksi: waktu, jarak, tarif, tip, zona', baris: 6433, topik: 'transportasi, peta', lisensi: 'Data terbuka Kota New York (NYC TLC)', sumber: GH('mwaskom/seaborn-data', 'master', 'taxis.csv') },
    { id: 'saham_apple', rename: { AAPL_x: 'tanggal', AAPL_y: 'harga' }, judul: 'Saham Apple 2014', isi: 'Harga saham Apple harian tahun 2014', baris: 240, topik: 'keuangan, deret waktu', lisensi: 'Data contoh Plotly', sumber: GH('plotly/datasets', 'master', '2014_apple_stock.csv') },
    { id: 'negara_bagian_as', judul: 'Penduduk negara bagian AS 2014', isi: 'Penduduk 50 negara bagian AS', baris: 50, topik: 'peta', lisensi: 'Data contoh Plotly (sumber: Sensus AS)', sumber: GH('plotly/datasets', 'master', '2014_usa_states.csv') },
    { id: 'supermarket', judul: 'Penjualan supermarket', isi: '1.000 transaksi supermarket: cabang, kategori produk, harga, rating', baris: 1000, topik: 'bisnis, penjualan', lisensi: 'Data contoh Plotly', sumber: GH('plotly/datasets', 'master', 'supermarket_Sales.csv') },
    { id: 'gempa', judul: 'Gempa bumi dunia', isi: '23 ribu gempa: waktu, lokasi, kedalaman, magnitudo', baris: 23412, topik: 'peta, sains', lisensi: 'Data contoh Plotly (sumber: USGS, domain publik)', ukuran: '0,8 MB', sumber: GH('plotly/datasets', 'master', 'earthquakes-23k.csv') },
    { id: 'minuman_iowa', judul: 'Penjualan minuman Iowa 2021', isi: '50 ribu transaksi grosir minuman: toko, kota, kategori, nilai', baris: 50000, topik: 'bisnis, peta, data besar', lisensi: 'Data terbuka Negara Bagian Iowa', ukuran: '12 MB', sumber: GH('plotly/datasets', 'master', 'liquor_iowa_2021.csv') }
  ];
  async function openData(id, o) {
    o = o || {};
    const e = CATALOG.find(x => x.id === String(id).toLowerCase());
    if (!e) fail(`Dataset "${id}" tidak ada di katalog. Lihat daftarnya dengan sl.open_data.list(), atau cari dengan sl.open_data.search("kata").`);
    const s = e.sumber;
    const df = await github(`${s.repo}@${s.ref}/${s.path}`, Object.assign({ name: e.id + '.csv' }, o));
    return e.rename ? df.rename(e.rename) : df;
  }
  openData.list = () => D.DataFrame(CATALOG.map(e => ({ id: e.id, judul: e.judul, isi: e.isi, baris: e.baris, topik: e.topik, lisensi: e.lisensi, sumber: `github.com/${e.sumber.repo}` })));
  openData.search = q => {
    const w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return D.DataFrame(CATALOG.filter(e => w.every(x => (e.id + ' ' + e.judul + ' ' + e.isi + ' ' + e.topik).toLowerCase().includes(x)))
      .map(e => ({ id: e.id, judul: e.judul, isi: e.isi, lisensi: e.lisensi })));
  };
  openData.info = id => { const e = CATALOG.find(x => x.id === id); return e ? Object.assign({}, e) : null; };
  openData.catalog = CATALOG;
  openData.clear_cache = k => cacheDel(k == null ? null : k);
  openData.fetched = () => [...FETCHED.entries()].map(([k, v]) => ({ sumber: k, berkas: v.name, ukuran: v.bytes.length }));

  /* ---------- sl.offline_button(): bungkus semua dataset online menjadi berkas .js ---------- */
  function offlineButton(ctx, o, EL) {
    o = o || {};
    const items = [...FETCHED.entries()];
    if (!items.length) { EL.caption(ctx, 'Belum ada dataset online yang dimuat.'); return; }
    for (const [key, v] of items) {
      const nm = wrappedName(v.name);
      let js = Slak.wrap_file(nm, v.bytes);
      js += `(self.SLAK_FILES = self.SLAK_FILES || {})[${JSON.stringify(key)}] = self.SLAK_FILES[${JSON.stringify(nm)}];\n`;
      EL.download_button(ctx, (o.label || '⤓ Simpan untuk luring') + ': ' + nm + '.js', js, { file_name: nm + '.js', mime: 'text/javascript', key: '__off_' + key, help: 'Taruh berkas ini di folder yang sama dengan halaman. Aplikasi tetap jalan tanpa internet dan saat dibuka dengan klik dua kali.' });
    }
  }

  Slak.extend({
    api: { read_url: readURL, github, huggingface, worldbank, kaggle, open_data: openData },
    elements: { offline_button: (ctx, o) => offlineButton(ctx, o, Slak.internals().EL) }
  });
  Object.assign(Slak.data, { read_url: readURL, github, huggingface, worldbank, kaggle, open_data: openData, _zipEntries: zipEntries });
})(typeof window !== 'undefined' ? window : globalThis);
