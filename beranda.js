/* Beranda buku Write and Run. Ditulis dengan sl.* dan Slak.docs; contoh di tengah halaman berjalan langsung. */
(function () {
  const H = window.BUKU_HALAMAN = window.BUKU_HALAMAN || {};
  const css = `.wr-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:40px;align-items:center;padding:8px 0 4px}
.wr-eyebrow{display:inline-flex;gap:8px;align-items:center;font-size:13px;font-weight:600;letter-spacing:.04em;color:var(--accent-ink);background:var(--accent-soft);padding:6px 12px;border-radius:999px}
.wr-hero h1{margin:16px 0 0;font-size:56px;line-height:1.02;letter-spacing:-.035em}
.wr-hero h1 i{font-style:normal;color:#F28C38}
.wr-sub{margin:12px 0 0;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-.01em;color:var(--fg)}
.wr-hero p.wr-lead{margin:16px 0 0;font-size:18px;line-height:1.6;color:var(--sd-lead)}
.wr-btns{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:24px}
.wr-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none!important;border:1px solid var(--line2);color:var(--fg)!important;background:var(--panel)}
.wr-btn.utama{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)!important}
.wr-btn:hover{border-color:var(--accent)}
.wr-link{font-weight:600;color:var(--accent-ink)!important;text-decoration:none}
.wr-sampul{position:relative;justify-self:center;width:100%;max-width:300px}
.wr-sampul::before{content:"";position:absolute;inset:8% -10% -6% 12%;border-radius:24px;background:linear-gradient(160deg,var(--accent-soft),transparent 70%);z-index:0}
.wr-sampul img{position:relative;z-index:1;display:block;width:100%;height:auto;border-radius:6px 12px 12px 6px;transform:rotate(2.5deg);
  box-shadow:-6px 0 0 rgba(0,0,0,.18) inset,0 2px 4px rgba(0,0,0,.12),0 22px 50px rgba(6,47,43,.35)}
.wr-angka{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:8px}
.wr-angka div{padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
.wr-angka b{display:block;font-size:26px;letter-spacing:-.02em;color:var(--accent-ink)}
.wr-angka span{font-size:13px;color:var(--muted)}
.wr-h2{margin:34px 0 0;font-size:28px;letter-spacing:-.015em}
.wr-p{margin:0;font-size:16px;line-height:1.6;color:var(--sd-lead)}
.wr-tangga{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:end}
.wr-tahap{display:flex;flex-direction:column;gap:8px;padding:18px 18px 16px;border:1px solid var(--line);border-top:5px solid var(--accent);border-radius:10px;background:var(--panel);color:var(--fg)!important;text-decoration:none!important}
.wr-tahap:hover{border-color:var(--accent)}
.wr-tahap.t1{min-height:190px}.wr-tahap.t2{min-height:220px}.wr-tahap.t3{min-height:250px;border-top-color:#F28C38}
.wr-tahap small{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.wr-tahap b{font-size:19px;letter-spacing:-.01em}
.wr-tahap span{font-size:14px;line-height:1.55;color:var(--sd-lead)}
.wr-tahap em{margin-top:auto;font-style:normal;font-size:14px;font-weight:600;color:var(--accent-ink)}
.wr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.wr-kartu{display:flex;flex-direction:column;gap:6px;padding:16px 18px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--fg)!important;text-decoration:none!important}
a.wr-kartu:hover{border-color:var(--accent)}
.wr-kartu i{font-style:normal;font-size:26px;line-height:1}
.wr-kartu b{font-size:16px}.wr-kartu span{font-size:14px;line-height:1.55;color:var(--sd-lead)}
.wr-kartu small{font-size:12px;font-weight:600;color:var(--muted)}
.wr-panel{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;padding:24px 26px;border-radius:12px;color:#FFFAF0;
  background:radial-gradient(500px 260px at 90% 0%,rgba(15,122,112,.55),transparent 60%),linear-gradient(160deg,#0d5f57,#062f2b)}
.wr-panel h2{margin:0;font-size:24px;color:#FFFAF0}.wr-panel p{margin:8px 0 0;line-height:1.6;color:rgba(255,250,240,.88)}
.wr-panel .wr-btn{background:#FFFAF0;border-color:#FFFAF0;color:#0a4f49!important}
.wr-pil{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.wr-pil span{font-size:12.5px;font-weight:600;padding:5px 10px;border-radius:8px;background:rgba(0,0,0,.25);border:1px solid rgba(255,250,240,.18)}
@media (max-width:900px){.wr-hero{grid-template-columns:1fr;gap:28px}.wr-sampul{max-width:240px;order:-1}.wr-hero h1{font-size:42px}.wr-sub{font-size:20px}
  .wr-angka{grid-template-columns:repeat(2,minmax(0,1fr))}.wr-tangga,.wr-grid{grid-template-columns:1fr}.wr-tahap.t1,.wr-tahap.t2,.wr-tahap.t3{min-height:0}.wr-panel{grid-template-columns:1fr}}`;
  function gaya() {
    if (document.getElementById('buku-beranda-css')) return;
    const st = document.createElement('style'); st.id = 'buku-beranda-css'; st.textContent = css; document.head.append(st);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const DEMO = '```slak\n' + [
    'const df = await sl.read_csv("toko-nusantara.csv")',
    'const kota = sl.selectbox("Cabang", ["Semua", ...df.kota.unique()])',
    'const data = kota === "Semua" ? df : df.filter(r => r.kota === kota)',
    '',
    'const [a, b] = sl.columns(2)',
    'a.metric("Omzet 2023–2024", data.total.sum(), null, { format: "rp" })',
    'b.metric("Transaksi", data.shape[0])',
    '',
    'const perKategori = data.groupby("kategori").agg({ omzet: ["total", "sum"] })',
    'sl.bar_chart(perKategori.sort_values("omzet", { ascending: false }),',
    '  { x: "kategori", y: "omzet", horizontal: true, format: "compact" })'
  ].join('\n') + '\n```';

  const TAHAP = [
    ['t1', 'Tahap 1 · Bab 1–10', 'JavaScript Pemula', 'Variabel, percabangan, perulangan, fungsi, larik, objek, menangani galat, dan aplikasi interaktif pertamamu.', 'bab-1-mengenal-javascript-lewat-slak'],
    ['t2', 'Tahap 2 · Bab 11–17', 'Analis Data Pemula', 'Membaca CSV dan JSON, membersihkan data, meringkas dengan DataFrame, membuat grafik, dan laporan interaktif.', 'bab-11-dari-data-mentah-ke-struktur'],
    ['t3', 'Tahap 3 · Bab 18–26', 'Analis Data Menengah', 'Join dan pivot, statistik, deret waktu, SQL, machine learning dasar, peta, pengujian, dan dasbor portofolio.', 'bab-18-menggabungkan-dan-membentuk-ulang-data']
  ];
  const PROYEK = [
    ['🧾', 'Kasir dan kalkulator', 'Aplikasi kecil pertama: menghitung belanja, diskon, dan PPN, lalu memperbaikinya dengan uji otomatis.', 'Tahap 1', 'bab-9-galat-dan-debugging'],
    ['📊', 'Laporan interaktif', 'Laporan penjualan dengan filter, ringkasan angka, grafik, dan tombol unduh.', 'Bab 17', 'bab-17-proyek-laporan-interaktif-pertama'],
    ['🗺️', 'Peta omzet cabang', 'Titik cabang, rute, dan peta provinsi berwarna dari data penjualan.', 'Bab 23', 'bab-23-peta-dan-data-wilayah'],
    ['🔮', 'Tren dan prediksi', 'Garis tren, prakiraan omzet, segmentasi pelanggan, dan model churn.', 'Bab 22', 'bab-22-tren-prediksi-dan-machine-learning-dasar']
  ];
  const ISI = [
    ['🎯', 'Tujuan belajar', 'Setiap bab dibuka dengan kemampuan yang akan kamu kuasai.'],
    ['▶️', 'Kode yang berjalan', 'Hasil setiap contoh tampil tepat di bawah kodenya, langsung di halaman ini.'],
    ['✅', 'Latihan yang memeriksa dirinya', 'Uji sl.testing menandai jawabanmu hijau atau merah, lengkap dengan kunci jawaban.'],
    ['🧪', 'Coba di playground', 'Satu klik membuka contoh di playground resmi Slak untuk kamu ubah sendiri.']
  ];

  H.beranda = async (sl) => {
    gaya();
    const B = window.BUKU || {};
    sl.html(`<section class="wr-hero">
<div>
<span class="wr-eyebrow">📘 Buku belajar pemrograman · Sesuai Slak 1.9.1</span>
<h1>Write and Run<i>.</i></h1>
<p class="wr-sub">Belajar JavaScript untuk Analisis Data dengan Slak</p>
<p class="wr-lead">Dari baris kode pertama hingga dasbor portofolio, langsung di browser. Tanpa instalasi, tanpa server, tanpa build. Tulis kodenya, jalankan, dan lihat hasilnya saat itu juga.</p>
<div class="wr-btns"><a class="wr-btn utama" href="#/sebelum-mulai">Mulai membaca</a><a class="wr-btn" href="Write-and-Run.pdf">Unduh PDF</a><a class="wr-link" href="${esc(B.playground || 'https://slak.studio/playground/')}" target="_blank" rel="noopener">Coba di Playground →</a></div>
</div>
<a class="wr-sampul" href="#/sebelum-mulai" aria-label="Mulai membaca Write and Run"><img src="sampul/sampul-web.png" alt="Sampul buku Write and Run: Belajar JavaScript untuk Analisis Data dengan Slak" width="827" height="1169"></a>
</section>
<div class="wr-angka">
<div><b>26</b><span>bab dalam 3 tahap</span></div>
<div><b>${esc(B.blok || '300+')}</b><span>contoh kode yang berjalan</span></div>
<div><b>3</b><span>tingkat latihan teruji</span></div>
<div><b>0</b><span>instalasi yang diperlukan</span></div>
</div>`);

    sl.html(`<h2 class="wr-h2">Coba sekarang</h2><p class="wr-p">Semua contoh di buku ini benar-benar dijalankan oleh Slak, termasuk yang di bawah ini. Pilih cabang lain, dan angka serta grafiknya ikut berubah. Kodenya kamu pelajari di Bab 14 sampai 16.</p>`);
    await Slak.docs.markdown(sl, DEMO, { tampilan: 'jernih', playground: B.playground });

    sl.html(`<h2 class="wr-h2">Tiga tahap, satu tangga</h2>
<p class="wr-p">Mulailah dari Tahap 1 walaupun kamu belum pernah memprogram. Setiap tahap hanya memakai yang sudah dipelajari di tahap sebelumnya.</p>
<div class="wr-tangga">${TAHAP.map(t => `<a class="wr-tahap ${t[0]}" href="#/${t[4]}"><small>${esc(t[1])}</small><b>${esc(t[2])}</b><span>${esc(t[3])}</span><em>Mulai tahap ini →</em></a>`).join('')}</div>`);

    sl.html(`<h2 class="wr-h2">Yang akan kamu buat</h2>
<div class="wr-grid">${PROYEK.map(p => `<a class="wr-kartu" href="#/${p[4]}"><i>${p[0]}</i><b>${esc(p[1])}</b><span>${esc(p[2])}</span><small>${esc(p[3])}</small></a>`).join('')}</div>`);

    sl.html(`<section class="wr-panel"><div>
<h2>Proyek akhir: Dasbor Toko Nusantara</h2>
<p>Dasbor multi-halaman yang kamu bangun di Bab 25: ringkasan, penjualan, produk, peta wilayah, prakiraan, dan halaman target yang dilindungi login. Siap kamu pajang sebagai portofolio.</p>
<div class="wr-pil"><span>7 halaman</span><span>Filter global</span><span>Login peran</span><span>Uji otomatis</span></div>
</div><a class="wr-btn" href="proyek-akhir/index.html">Buka dasbornya →</a></section>`);

    sl.html(`<h2 class="wr-h2">Yang ada di setiap bab</h2>
<div class="wr-grid">${ISI.map(p => `<div class="wr-kartu"><i>${p[0]}</i><b>${esc(p[1])}</b><span>${esc(p[2])}</span></div>`).join('')}</div>`);

    sl.html(`<h2 class="wr-h2">Belajar dengan data yang terasa nyata</h2>
<p class="wr-p">Mulai Tahap 2, kamu menganalisis <b>Toko Nusantara</b>, jaringan toko oleh-oleh fiktif dengan 10 cabang dari Jayapura sampai Jakarta: 2.929 transaksi selama 2023–2024, lengkap dengan musim Lebaran, akhir tahun, dan data kotor untuk dibersihkan. <a class="wr-link" href="#/dataset-toko-nusantara">Kenali datasetnya →</a></p>
<div class="wr-btns"><a class="wr-btn utama" href="#/sebelum-mulai">Mulai dari Sebelum Mulai</a><a class="wr-btn" href="#/bab-1-mengenal-javascript-lewat-slak">Langsung ke Bab 1</a></div>`);
  };
  H.cari = Object.assign(H.cari || {}, { beranda: 'Write and Run buku belajar JavaScript analisis data Slak pemula menengah sampul unduh PDF proyek akhir dasbor Toko Nusantara' });
})();
