# Daftar Lisensi Slak 1.9.1

Aturan Slak: setiap komponen harus terbuka, bebas diubah, dan boleh dipakai untuk tujuan komersial tanpa membayar. Semua komponen di bawah sudah diperiksa terhadap aturan itu. Teks lisensi lengkap ada di folder `Lisensi/`.

## Ikut di dalam berkas Slak

| Komponen | Dipakai untuk | Lisensi | Komersial gratis | Catatan |
|---|---|---|---|---|
| Slak (`slak*.js`, Slak Studio, slak-bridge) | seluruh kerangka | MIT (lihat `LICENSE`) | ya | ditulis dari nol, tanpa kode Streamlit; termasuk galeri komponen `slak-komponen.js`, folder `komponen/`, dan `slak-docs.js` |
| sql.js 1.x | SQLite di browser (`slak-sql.js`) | MIT | ya | |
| SQLite | mesin database di sql.js | domain publik | ya | |
| duckdb-wasm 1.32 / DuckDB 1.4 | `slak-duckdb.js`, jendela Database | MIT | ya | mesin wasm diunduh dari jsDelivr, kecuali di Slak Studio |
| Apache Arrow (JS) | pertukaran data DuckDB | Apache-2.0 | ya | |
| Material Symbols (±250 ikon luring) | `:material/nama:` | Apache-2.0 | ya | ikon lain dari Google Fonts saat online |
| emojilib 2.4 | nama emoji bahasa Inggris | MIT | ya | |
| Unicode CLDR (anotasi id) | nama emoji bahasa Indonesia | Unicode License v3 | ya | |
| geoBoundaries IDN ADM2 (BPS, WFP, OCHA) | batas kabupaten/kota, dan provinsi hasil penggabungannya | CC BY 3.0 IGO | ya | sebutkan sumber (sudah tampil di peta) |
| geoBoundaries IDN ADM1 (OpenStreetMap) | hanya dipakai di alat pembangun untuk mencocokkan kabupaten ke provinsinya; tidak ikut di berkas Slak | ODbL 1.0 | ya | |
| Natural Earth | batas negara dunia | domain publik | ya | |
| Inter ExtraBold (Rasmus Andersson) | bentuk huruf "Sl" pada ikon Slak (1.9.1), sudah diubah menjadi garis; fonta tidak ikut | SIL Open Font License 1.1 (`Lisensi/Inter-OFL.txt`) | ya | OFL mengizinkan huruf dipakai di logo |

## Ikut di Slak Studio

| Komponen | Dipakai untuk | Lisensi | Komersial gratis |
|---|---|---|---|
| Electron (Chromium, Node.js) | aplikasi desktop | MIT (Chromium: BSD-3 dan lisensi terbuka lain di `LICENSES.chromium.html`) | ya |
| CodeMirror 5 | editor kode | MIT | ya |
| basic-ftp 6.2 | Terbitkan lewat FTP/FTPS (Slak 1.8, folder `terbit/basic-ftp`) | MIT | ya |
| mysql2 3.x (+ dependensinya) | koneksi MySQL/MariaDB | MIT (dependensi: MIT, ISC, Apache-2.0, BSD) | ya |
| tedious 20.x (+ dependensinya) | koneksi SQL Server | MIT (dependensi: MIT, BSD-3, ISC, 0BSD) | ya |

## Dimuat dari internet hanya saat dipakai

| Komponen | Dipakai untuk | Lisensi | Komersial gratis |
|---|---|---|---|
| Plotly.js 2.35 | `sl.plotly_chart` | MIT | ya |
| deck.gl 9.1 dan @deck.gl/json | `sl.pydeck_chart` | MIT | ya |
| Apache ECharts 5.5 | `sl.echarts_chart` | Apache-2.0 | ya |
| Mermaid 11 | `sl.mermaid_chart` | MIT | ya |
| viz.js 3 (Graphviz) | `sl.graphviz_chart` | MIT (Graphviz: EPL-1.0) | ya |
| Pyodide (+ pandas, NumPy, matplotlib) | `sl.python` | MPL-2.0 (paket: BSD-3, PSF) | ya |
| Material Symbols (font) | ikon di luar set luring | Apache-2.0 | ya |
| jsDelivr | CDN | layanan gratis | ya |

## Dipasang sendiri oleh pemakai slak-bridge.js (Node.js, opsional)

| Komponen | Dipakai untuk | Lisensi | Komersial gratis |
|---|---|---|---|
| mysql2 | MySQL/MariaDB di slak-bridge.js | MIT | ya |
| pg | PostgreSQL di slak-bridge.js | MIT | ya |
| bcryptjs | login lewat slak-bridge.js (Slak 1.7) | MIT | ya |

slak-bridge.php tidak butuh pustaka tambahan: login memakai `password_verify` bawaan PHP.

## Layanan pihak ketiga (opsional, tidak ikut di Slak)

| Layanan | Dipakai untuk | Syarat |
|---|---|---|
| Ubin OpenStreetMap (`tiles: "osm"`, juga cadangan `"carto"` tanpa kunci) | latar peta daring | gratis dengan atribusi; situs dengan lalu lintas sangat besar diminta memakai penyedia sendiri |
| OpenTopoMap (`tiles: "topo"`) | peta topografi | CC BY-SA, gratis dengan atribusi |
| CARTO (`tiles: "carto"` dengan kunci) | latar peta terang/gelap | sejak September 2026 wajib kunci; gratis untuk pemakaian kecil, berbayar untuk komersial besar. Tanpa kunci, Slak otomatis memakai OpenStreetMap |
| Google Sheets | `sl.read_sheets` | sheet milik pengguna |
| GitHub REST API dan GitHub Pages | Terbitkan › GitHub Pages (Slak 1.8) | akun GitHub milik pengguna; Pages gratis untuk repositori publik |
| Netlify API | Terbitkan › Netlify (Slak 1.8) | akun Netlify milik pengguna; ada paket gratis |
| Google BigQuery dan Google OAuth | koneksi BigQuery di Slak Studio dan slak-bridge (Slak 1.8) | akun Google Cloud milik pengguna; ditagih per byte yang diproses, BigQuery Sandbox gratis 1 TB kueri per bulan |
| Ubin OpenStreetMap dan Humanitarian OSM | komponen `titik_peta` di slak-komponen.js | gratis dengan atribusi (tertulis di pojok peta) |
| Web Speech API browser (Chrome/Edge memakai layanan Google) | komponen `tombol_suara` | bawaan browser, tanpa biaya; suara dikirim ke layanan pengenalan suara browser |
| Turso | `sl.connection` tipe turso | paket gratis tersedia; Slak hanya memakai protokol HTTP libSQL (MIT) |
| Bank Dunia, GitHub, Hugging Face, Kaggle | dataset online | lisensi tiap dataset (World Bank: CC BY 4.0); ditampilkan di `sl.open_data` |

Bila menambah komponen baru, tambahkan barisnya di sini dan teks lisensinya di `Lisensi/` (lihat `KONTRIBUSI.md`).

## Alat pengembang saja (tidak ikut paket)

| Komponen | Dipakai untuk | Lisensi | Komersial gratis |
|---|---|---|---|
| axe-core 4.10 | pemeriksaan aksesibilitas otomatis (Slak 1.9) | MPL-2.0 | ya |
| Playwright | uji otomatis di browser dan Slak Studio | Apache-2.0 | ya |
| pyftpdlib | server FTP tiruan untuk uji Terbitkan (Slak 1.8) | MIT | ya |
| @fontsource/inter 5.1 | sumber huruf saat membuat ikon Sl (`alat-pengembang/ikon/buat.py`) | SIL OFL 1.1 | ya |
| fontTools | mengubah huruf menjadi garis SVG untuk ikon | MIT | ya |
