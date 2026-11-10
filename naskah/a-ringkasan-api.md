# Lampiran A · Ringkasan API Slak di Buku Ini

Daftar ini merangkum setiap fungsi Slak yang dikenalkan di buku, beserta bab tempat ia pertama dijelaskan. Semua nama `sl.*` dan `Slak.*` di sini tercantum di daftar API stabil Slak 1.9 (API-STABIL.md) dan dijamin tetap ada sampai Slak 2.0, kecuali yang ditandai berasal dari berkas tambahan.

| Berkas | Isi | Dimuat oleh playground |
|---|---|---|
| `slak.js` | Inti: teks, widget, tata letak, grafik, state, form, navigasi, login, `sl.testing`, `sl.crypto` | ✓ |
| `slak-data.js` | Slak Data: DataFrame, statistik, ML, deret waktu, analisis bisnis, dataset | ✓ |
| `slak-sql.js` | SQLite: `sl.sql`, `sl.sqlite` | ✓ |
| `slak-peta.js` (+ `slak-peta-kab.js`) | Peta: `sl.map`, `sl.choropleth`, `sl.geo` | ✓ |
| `slak-komponen.js` | Galeri 10 komponen untuk `sl.component` | ✓ |
| `slak-duckdb.js` | DuckDB: `sl.duckdb`, `sl.read_parquet` (mesin diunduh saat pertama dipakai) | ✗ |
| `slak-docs.js` | `Slak.docs` untuk situs dokumentasi (versi 0.1, eksperimental) | ✗ |

## Bab 1

| Fungsi | Kegunaan |
|---|---|
| `sl.title(teks)` | Menampilkan judul besar di bagian atas. |
| `sl.write(nilai)` | Menampilkan apa saja: teks, angka, tabel, atau objek. Teks boleh memakai Markdown, misalnya `**tebal**`. |
| `sl.set_page_config({ page_title, page_icon, layout })` | Mengatur judul tab, ikon, dan tata letak. `layout: "wide"` membuat konten lebih lebar. |
| `Slak.share.link(kode, alamat)` | Membuat tautan playground yang berisi kode. Perhatikan awalannya `Slak.`, bukan `sl.`: ini fungsi milik Slak sebagai alat, bukan perintah untuk menampilkan sesuatu. |
| `sl.code(teks)` | Menampilkan teks sebagai kode. |

## Bab 2

| Fungsi | Kegunaan |
|---|---|
| `sl.markdown(teks)` | Menampilkan teks berformat Markdown: tebal, miring, daftar, tabel, tautan, dan warna `:green[...]`, `:red[...]`, `:blue[...]`, `:orange[...]`, `:violet[...]`, `:gray[...]`. |
| `sl.text(teks)` | Menampilkan teks persis seperti ditulis. |

## Bab 3

| Fungsi | Kegunaan |
|---|---|
| `sl.success(teks)`, `sl.info(teks)`, `sl.warning(teks)`, `sl.error(teks)` | Menampilkan kotak pesan hijau, biru, kuning, dan merah. |
| `sl.text_input(label, nilaiAwal)` | Mengembalikan teks. Nilainya dipakai setelah kamu menekan Enter atau pindah ke kotak lain. |
| `sl.number_input(label, { min, max, value, step })` | Mengembalikan angka. |
| `sl.button(label)` | Mengembalikan `true` pada satu jalan ulang setelah diklik, lalu `false` lagi. |

## Bab 4

| Fungsi | Kegunaan |
|---|---|
| `sl.slider(label, min, max, nilaiAwal, langkah)` | Mengembalikan angka yang dipilih. Urutan argumennya: label, nilai terkecil, nilai terbesar, nilai awal, lalu langkah (boleh dilewati). |

## Bab 5

| Fungsi | Kegunaan |
|---|---|
| `sl.selectbox(label, pilihan)` | Menampilkan daftar pilihan dan mengembalikan pilihan yang dipilih. |
| `sl.columns(n)` | Membagi baris menjadi `n` kolom dan mengembalikan larik kolom. Setiap kolom punya semua fungsi tampilan, misalnya `kiri.write(...)`. |
| `sl.metric(label, nilai)` | Menampilkan angka besar dengan label. Kamu akan sering memakainya untuk dasbor. |

## Bab 6

| Fungsi | Kegunaan |
|---|---|
| `sl.multiselect(label, pilihan, { default })` | Mengembalikan **larik** berisi pilihan yang dipilih. |

## Bab 7

| Fungsi | Kegunaan |
|---|---|
| `sl.table(data)` | Menampilkan tabel statis. |
| `sl.dataframe(data)` | Menampilkan tabel interaktif: kolomnya bisa diurutkan dengan mengeklik judul, dan ada tombol unduh CSV. |
| `sl.metric(label, nilai, delta)` | Menampilkan angka besar. Argumen ketiga (opsional) adalah perubahan, misalnya `"+12%"`, yang tampil hijau atau merah. |
| `sl.dataset(nama)` | Mengembalikan dataset contoh sebagai DataFrame, yaitu tabel milik Slak Data (Bab 14). |
| `sl.checkbox(label)` | Mengembalikan `true` atau `false`. |

## Bab 8

| Fungsi | Kegunaan |
|---|---|
| `sl.date_input(label, nilaiAwal)` | Mengembalikan tanggal sebagai **teks** `"YYYY-MM-DD"`. Ubah dengan `new Date(tgl)` bila ingin menghitung. |
| `sl.strftime(tanggal, pola)` | Memformat tanggal dengan pola seperti `%d`, `%B`, `%Y`, `%A`. |

## Bab 9

| Fungsi | Kegunaan |
|---|---|
| `sl.warning(teks)` | Menampilkan kotak peringatan kuning. |
| `sl.exception(galat)` | Menampilkan galat lengkap dengan tombol **Detail** berisi stack trace, tanpa menghentikan aplikasi. |
| `sl.testing.expect(nilai)` | Membuat pernyataan yang diperiksa, misalnya `.toBe(...)`. |

## Bab 10

| Fungsi | Kegunaan |
|---|---|
| `sl.session_state` | Menyimpan nilai selama halaman terbuka. Isinya hilang bila halaman dimuat ulang. |
| `sl.local_state` | Seperti `session_state`, tetapi permanen. Data disimpan per browser dan hanya cocok untuk data JSON: angka, teks, boolean, larik, dan objek biasa. |
| `sl.clear_local_state()` | Mengosongkannya. |
| `sl.form(key, { clear_on_submit })` | Membuat formulir. Widget di dalamnya ditulis dengan awalan formulir, misalnya `f.text_input(...)`, dan tidak memicu jalan ulang sampai tombol kirim ditekan. |
| `sl.crypto.quiz_hash(jawaban)` | Membuat kode pelindung. Bisa juga larik beberapa jawaban yang sama-sama benar. |
| `sl.crypto.quiz_check(jawaban, kode)` | Mengembalikan `true` bila jawaban cocok. |

## Bab 11

| Fungsi | Kegunaan |
|---|---|
| `sl.json(objek)` | Menampilkan objek atau larik dengan rapi dan bisa dilipat. |
| `sl.file_uploader(label, { type })` | Mengembalikan objek berkas (`name`, `size`, `text`, `bytes`) atau `null` bila belum ada berkas. Berkasnya tidak pernah dikirim ke server mana pun; semuanya diproses di browser. |

## Bab 12

| Fungsi | Kegunaan |
|---|---|
| `sl.open_data(id)`, `sl.open_data.list()`, `sl.github(jalur)`, `sl.worldbank(indikator, { negara, tahun })`, `sl.huggingface(dataset, { file })`, `sl.kaggle(dataset, { file })` | Mengambil dataset terbuka sebagai DataFrame. Semuanya ada di `slak-data.js`. |
| `sl.datasets()` | Menampilkan daftar dataset bawaan. |
| `sl.line_chart(data, { x, y, title })` | Menggambar grafik garis. Grafik dibahas di Bab 16. |
| `sl.progress(nilai, teks)` | Menampilkan bilah kemajuan berskala 0–100. Perbarui dengan `.progress(nilai, teks)`. |

## Bab 13

| Fungsi | Kegunaan |
|---|---|
| `sl.data_editor(data, { num_rows })` | Menampilkan tabel yang bisa diedit, lalu mengembalikan larik hasil editan. `num_rows: "dynamic"` mengizinkan pengguna menambah dan menghapus baris. |

## Bab 14

| Fungsi | Kegunaan |
|---|---|
| `sl.DataFrame(larikObjek)` | Membuat DataFrame dari larik objek. Kebalikannya: `df.to_records()`. |
| `sl.radio(label, pilihan, { horizontal })` | Menampilkan pilihan tunggal. |
| `sl.download_button(label, data, { file_name })` | Mengunduh data. Akhiran nama berkas menentukan formatnya: `.csv`, `.xlsx`, `.json`, atau `.md`. |

## Bab 15

| Fungsi | Kegunaan |
|---|---|
| `sl.dataframe(df, { format })` | Merapikan angka per kolom: `"rupiah"`, `"percent"`, `"compact"`, `"decimal:2"`. |
| `sl.crosstab(series1, series2, { normalize })` | Membuat tabel silang. |
| `sl.subheader(teks)` | Menampilkan judul kecil. |

## Bab 16

| Fungsi | Kegunaan |
|---|---|
| `sl.line_chart`, `sl.bar_chart`, `sl.area_chart`, `sl.scatter_chart` | `sl.line_chart`, `sl.bar_chart`, `sl.area_chart`, `sl.scatter_chart(data, { x, y, color, title, x_label, y_label, format })`. |
| `sl.histogram(data, { x, bins })` | Dan `sl.pie_chart(data, { names, values, donut })`. |

## Bab 17

| Fungsi | Kegunaan |
|---|---|
| `sl.sidebar.namaFungsi(...)` | Menaruh apa saja di sidebar. |
| `sl.tabs(["A", "B"])` | Mengembalikan larik tab; setiap tab punya semua fungsi tampilan. |
| `sl.layout(nama, { title })` | Membuat kerangka tata letak dan mengembalikan objek berisi area-areanya. |

## Bab 18

| Fungsi | Kegunaan |
|---|---|
| `sl.merge(kiri, kanan, opsi)` | Adalah bentuk lain yang sama. |
| `sl.concat([df1, df2])` | Menyambung tabel ke bawah. |
| `sl.melt(df, { id_vars, var_name, value_name })` | Lebar ke panjang. |

## Bab 19

| Fungsi | Kegunaan |
|---|---|
| `sl.stats.describe(x)` | Meringkas satu kolom: banyak data, rata-rata, simpangan baku, minimum, kuartil, dan maksimum. |
| `sl.stats.var`, `sl.stats.std`, `sl.stats.mean`, `sl.stats.median` | `sl.stats.var(x)`, `sl.stats.std(x)`, `sl.stats.mean(x)`, `sl.stats.median(x)`, juga tersedia sebagai metode Series: `df.total.std()`. |
| `sl.box_plot(data, { y, by })` | Menggambar box plot, satu kotak per kelompok. |
| `sl.heatmap(data)` | Menggambar tabel angka sebagai kotak berwarna. |
| `sl.stats.pearsonr(x, y)` | Dan `sl.stats.spearmanr(x, y)` menguji korelasi, lengkap dengan kesimpulan berbahasa Indonesia. |
| `sl.stats.ttest_ind(df, { value, group })` | Membandingkan rata-rata dua kelompok. |
| `sl.stats.ab_test(df, { group, metric, control })` | Menganalisis uji A/B. Metrik 0/1 diuji sebagai proporsi, metrik lain sebagai rata-rata. |
| `sl.write` | Setiap hasil uji punya `statistic`, `p_value`, `significant`, `conclusion`, dan bisa ditampilkan langsung dengan `sl.write`. |

## Bab 20

| Fungsi | Kegunaan |
|---|---|
| `sl.to_datetime(nilai)` | Mengubah teks atau larik teks menjadi tanggal; `df.to_datetime(kolom)` mengubah satu kolom DataFrame. |
| `sl.date_range(awal, { end, periods, freq })` | Membuat deretan tanggal. `freq`: `"D"` hari, `"W"` minggu, `"MS"` awal bulan, `"ME"` akhir bulan, `"QS"` awal kuartal, `"YS"` awal tahun. |
| `sl.segmented_control(label, pilihan, { default })` | Menampilkan tombol pilihan yang berdampingan. |
| `sl.analysis.growth(df, { date, value })` | Menghasilkan kolom `periode`, `pertumbuhan` (MoM), `pertumbuhan_yoy`, dan `kumulatif`. |
| `sl.ts.decompose(df, { period })` | Menghasilkan kolom `nilai`, `tren`, `musiman`, dan `residu`. `period: 12` untuk data bulanan dengan pola tahunan, `7` untuk data harian dengan pola mingguan. |

## Bab 21

| Fungsi | Kegunaan |
|---|---|
| `sl.sql.check(kueri)` | Mendaftar sintaks khusus SQLite beserta penggantinya yang portabel. |
| Opsi `{ portable: true }` | Pada `sl.sql` memberi peringatan langsung saat kueri memakai sintaks khusus SQLite. |
| `sl.db(nama, skema)` | Membuka database IndexedDB dengan tabel dan perintah `insert`, `update`, `delete`, `where`, `all`, `count`. |
| `await sl.db_list()` | Mendaftar database `sl.db` yang ada di browser ini. |

## Bab 22

| Fungsi | Kegunaan |
|---|---|
| `sl.stats.linregress(x, y)` | Menghasilkan `slope`, `intercept`, `rvalue`, `rsquared`, dan `pvalue`. |
| `sl.stats.ols(df, "y ~ x1 + x2 + C(kategori)")` | Membuat regresi berganda lengkap dengan tabel koefisien, R², dan diagnostik. |
| `sl.ts.forecast(df, { periods, method })` | Meramal deret waktu. Hasilnya bisa ditampilkan dengan `sl.write`, dan tabelnya ada di `.forecast` (kolom `prediksi`, `batas_bawah`, `batas_atas`). |
| `sl.analysis.pareto`, `sl.analysis.rfm`, `sl.analysis.cohort`, `sl.analysis.funnel` | `sl.analysis.pareto(df, { category, value })`, `sl.analysis.rfm(df, { customer, date, amount })`, `sl.analysis.cohort(df, { customer, date, period })`, `sl.analysis.funnel(tahap)`. |
| `sl.combo_chart(df, { x, bar, line })` | Menggambar batang dan garis sekaligus. |
| `sl.ml.train_test_split(df, { test_size, stratify, random_state })` | Membagi data latih dan uji. |
| Model: `sl.ml.LinearRegression()`, `sl.ml.DecisionTreeClassifier({ max_depth })`, `sl.ml.KMeans({ n_clusters })`, dan lainnya. Semuanya memakai `.fit(df, "target")` | Dan `.predict(df)`. |
| `sl.ml.accuracy_score`, `sl.ml.confusion_matrix`, `sl.ml.r`, `sl.ml.mae`, `sl.ml.rmse` | Ukuran: `sl.ml.accuracy_score`, `sl.ml.confusion_matrix`, `sl.ml.r2_score`, `sl.ml.mae`, `sl.ml.rmse`. |
| `sl.ml.StandardScaler().fit_transform(df)` | Menyamakan skala kolom. |
| `sl.ml_demo(model, df, { target, labels })` | Membuat formulir coba model. Model yang belum dilatih dilatih otomatis. |

## Bab 23

| Fungsi | Kegunaan |
|---|---|
| `sl.map(df, { lat, lon, size, color, label })` | Menggambar titik atau gelembung. |
| `sl.map(df, { region: "kolom" })` | Mencari lokasi dari nama wilayah. |
| `sl.choropleth(df, { region, value, labels, level, bins })` | Mewarnai wilayah. `level: "kabkota"` untuk kabupaten/kota. |
| `sl.geo.match(nama)` | Mencocokkan satu nama wilayah dan mengembalikan nama baku, provinsi, dan koordinatnya. |
| `sl.geo.geocode(df, kolom)` | Menambah kolom `wilayah_baku`, `lat`, dan `lon`. |
| `sl.geo.distance([lat1, lon1], [lat2, lon2])` | Menghitung jarak dalam km. |
| `sl.geo.province_of(lat, lon)` | Dan `sl.geo.kabkota_of(lat, lon)` menebak wilayah dari koordinat. |

## Bab 24

| Fungsi | Kegunaan |
|---|---|
| `sl.testing.from_string(kode)`, `from_file("app.slak")`, dan `from_function(fn)` | Membuat objek uji tanpa langsung menjalankannya. |

## Bab 25

| Fungsi | Kegunaan |
|---|---|
| `sl.navigation(daftarHalaman, { position })` | Dan `sl.page(judul, fungsi, { icon, url, default })` membuat aplikasi multi-halaman. `position`: `"sidebar"` (bawaan), `"top"`, atau `"hidden"`. |
| `sl.switch_page(judul)` | Dan `sl.page_link(judul)` berpindah halaman. |
| `sl.require_role`, `sl.user`, `sl.logout` | `await sl.login({ users, title })`, `sl.require_role(peran)`, `sl.user`, `sl.logout()`. |

## Bab 26

| Fungsi | Kegunaan |
|---|---|
| `Slak.docs.site(sl, { judul, bab })` *(berkas tambahan)* | Membuat situs dokumentasi lengkap. |
| `Slak.docs.markdown(sl, teks)` *(berkas tambahan)* | Menampilkan satu bab Markdown dengan contoh yang dijalankan. |
| Perhatikan awalannya: `Slak.docs`, bukan `sl.docs`, dan `sl` *(berkas tambahan)* | Dikirim sebagai argumen pertama. `slak-docs.js` tidak menambah nama apa pun ke `sl`. |

Daftar lengkap 938 nama API stabil ada di berkas `API-STABIL.md` di paket Slak 1.9.1, dan setiap fungsinya punya contoh di panel **Referensi** Slak Studio (tekan **F1**).
