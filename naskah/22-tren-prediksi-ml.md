# Bab 22 · Tren, Prediksi, dan Machine Learning Dasar

> **Tujuan belajar**
> - Membuat garis tren dengan regresi linear sederhana, dan memahami rumusnya.
> - Membaca hasil regresi: kemiringan, R², dan batas kepercayaan sebuah prediksi.
> - Meramal penjualan beberapa bulan ke depan.
> - Memakai analisis bisnis siap pakai: Pareto, RFM, kohort, dan funnel.
> - Mengenal alur machine learning: data latih dan uji, model, dan ukuran kebaikan model.
> - Membuat demo model interaktif yang bisa dicoba orang lain.

Sejauh ini kamu menjawab pertanyaan **"apa yang sudah terjadi?"**. Bab ini melangkah ke pertanyaan **"apa yang mungkin terjadi?"** dan **"siapa pelanggan kita?"**.

## 22.1 Garis tren dengan JavaScript murni

**Regresi linear sederhana** mencari garis lurus `y = a + b × x` yang paling dekat dengan semua titik data. `b` adalah **kemiringan** (berapa `y` bertambah setiap `x` naik satu), dan `a` adalah **titik potong** (nilai `y` saat `x` nol).

Rumusnya bisa ditulis dengan JavaScript yang sudah kamu kuasai:

```slak
function regresi(x, y) {
  const n = x.length
  const rx = x.reduce((a, v) => a + v, 0) / n
  const ry = y.reduce((a, v) => a + v, 0) / n
  let atas = 0, bawah = 0
  for (let i = 0; i < n; i++) {
    atas += (x[i] - rx) * (y[i] - ry)
    bawah += (x[i] - rx) ** 2
  }
  const b = atas / bawah
  return { a: ry - b * rx, b }
}

const df = await sl.read_csv("toko-nusantara.csv")
const bulanan = df.resample("tanggal", "M").agg({ omzet: ["total", "sum"] }).to_records()
const x = bulanan.map((_, i) => i + 1)          // bulan ke-1, ke-2, ...
const y = bulanan.map(r => r.omzet)

const { a, b } = regresi(x, y)
sl.write(`Garis tren: omzet = ${Math.round(a).toLocaleString("id-ID")} + ${Math.round(b).toLocaleString("id-ID")} × bulan`)
sl.write(`Artinya omzet cenderung naik sekitar Rp ${Math.round(b).toLocaleString("id-ID")} setiap bulan.`)
```

Ini disebut metode **kuadrat terkecil**: garis yang dipilih adalah garis dengan jumlah kuadrat jarak titik ke garis paling kecil.

## 22.2 Regresi dengan Slak Data

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const b = df.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
const data = b.assign({ bulan_ke: () => sl.Series(b.omzet.to_list().map((_, i) => i + 1)) })

const lr = sl.stats.linregress(data.bulan_ke, data.omzet)
sl.write(`Kemiringan: ${Math.round(lr.slope).toLocaleString("id-ID")} per bulan`)
sl.write(`R²: ${lr.rsquared.toLocaleString("id-ID", { maximumFractionDigits: 2 })}, p-value: ${lr.pvalue.toLocaleString("id-ID", { maximumFractionDigits: 4 })}`)
sl.scatter_chart(data, { x: "bulan_ke", y: "omzet", trendline: true, format: "compact" })
```

Angkanya sama dengan hasil fungsi buatanmu. Dua angka baru:

- **R²** (0 sampai 1) mengukur berapa bagian naik-turunnya omzet yang dijelaskan garis tren. R² 0,33 artinya garis lurus menjelaskan sekitar sepertiganya; sisanya karena musim dan hal lain.
- **p-value** di bawah 0,05 artinya kecenderungan naik itu nyata, bukan kebetulan.

Untuk **beberapa** variabel penjelas sekaligus, pakai `sl.stats.ols` dengan rumus gaya statsmodels:

```slak
const model = sl.stats.ols(sl.dataset("karyawan"), "gaji_juta ~ pengalaman_tahun + C(pendidikan)")
sl.write(model)
```

`C(pendidikan)` memberi tahu bahwa `pendidikan` adalah kategori. Tabel koefisien menjawab: dengan pendidikan yang sama, setiap tahun pengalaman menambah gaji sekian juta.

> **API Slak baru**
> - `sl.stats.linregress(x, y)` menghasilkan `slope`, `intercept`, `rvalue`, `rsquared`, dan `pvalue`.
> - `sl.stats.ols(df, "y ~ x1 + x2 + C(kategori)")` membuat regresi berganda lengkap dengan tabel koefisien, R², dan diagnostik.

## 22.3 Meramal penjualan

Garis lurus mengabaikan musim. Untuk meramal, Slak menyediakan `sl.ts.forecast`, yang mencoba beberapa metode (termasuk **Holt-Winters**, yang memperhitungkan tren dan musim sekaligus) lalu memilih yang paling cocok dengan data.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const bulanan = df.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
const n = sl.slider("Ramal berapa bulan ke depan?", 3, 12, 6)
const ramalan = sl.ts.forecast(bulanan, { periods: n })
sl.write(ramalan)
```

Hasilnya mencakup grafik, tabel ramalan, dan ukuran kesalahan. Yang terpenting adalah **batas bawah dan batas atas**: rentang yang kemungkinan besar (sekitar 95%) memuat nilai sebenarnya.

> **Ramalan bukan janji.** Selalu laporkan rentangnya, bukan hanya satu angka. "Omzet Januari diperkirakan 10–18 juta, paling mungkin 14 juta" jauh lebih jujur daripada "omzet Januari 14 juta". Dua tahun data juga terbilang pendek untuk meramal musim; semakin panjang datanya, semakin bisa diandalkan ramalannya.

| Ukuran | Arti |
|---|---|
| MAE | Rata-rata selisih ramalan dengan kenyataan, dalam rupiah |
| RMSE | Mirip MAE, tetapi menghukum selisih besar lebih berat |
| MAPE | Rata-rata selisih dalam persen |

> **API Slak baru**
> - `sl.ts.forecast(df, { periods, method })` meramal deret waktu. Hasilnya bisa ditampilkan dengan `sl.write`, dan tabelnya ada di `.forecast` (kolom `prediksi`, `batas_bawah`, `batas_atas`).

## 22.4 Analisis bisnis siap pakai

Beberapa analisis begitu sering diminta sehingga Slak menyediakannya dalam satu perintah.

### Pareto: produk mana yang paling penting?

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const par = sl.analysis.pareto(df, { category: "produk", value: "total" })
sl.combo_chart(par, { x: "produk", bar: "total", line: "persen_kumulatif" })
const a = par.filter(r => r.kelas === "A")
sl.write(`${a.shape[0]} dari ${par.shape[0]} produk (kelas A) bersama-sama menyumbang sekitar 80% omzet.`)
```

Analisis Pareto mengurutkan produk dari omzet terbesar dan menjumlahkan porsinya. Produk yang bersama-sama mencapai 80% omzet masuk kelas **A**: wajib selalu tersedia di rak. Di banyak toko, kelas A hanya sekitar 20% produk (inilah "aturan 80/20"). Di Toko Nusantara omzetnya lebih merata, sehingga kelas A lebih banyak; temuan seperti ini pun berharga, karena artinya toko tidak bergantung pada segelintir produk.

### RFM: mengenal pelanggan

**RFM** menilai setiap pelanggan dari tiga sisi: **R**ecency (kapan terakhir belanja), **F**requency (seberapa sering), dan **M**onetary (berapa banyak). Pelanggan lalu dikelompokkan ke segmen berbahasa Indonesia seperti *Juara*, *Pelanggan Setia*, *Berisiko*, dan *Tertidur*.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const rfm = sl.analysis.rfm(df, { customer: "pelanggan_id", date: "tanggal", amount: "total" })
sl.bar_chart(rfm.value_counts("segmen"), { x: "segmen", y: "jumlah", horizontal: true, sort: true })
sl.dataframe(rfm.sort_values("skor_rfm", { ascending: false }).head(5))
```

Segmen *Berisiko* dan *Jangan Sampai Hilang* adalah pelanggan bernilai tinggi yang lama tidak datang: sasaran utama untuk ditawari promo.

### Kohort dan funnel

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const ko = sl.analysis.cohort(df, { customer: "pelanggan_id", date: "tanggal", period: "Q" })
sl.heatmap(ko.drop("ukuran"), { format: "percent:0", title: "Berapa persen pelanggan kembali di kuartal berikutnya?" })

sl.dataframe(sl.analysis.funnel({ "Lihat produk": 10000, "Masuk keranjang": 1200, "Bayar": 300 }), { format: { konversi_dari_awal: "percent", konversi_dari_sebelumnya: "percent" } })
```

**Kohort** mengelompokkan pelanggan menurut kapan mereka pertama datang, lalu melacak berapa persen yang kembali. **Funnel** menghitung berapa yang lolos di setiap tahap, sehingga tahap yang paling banyak "bocor" terlihat.

> **API Slak baru**
> - `sl.analysis.pareto(df, { category, value })`, `sl.analysis.rfm(df, { customer, date, amount })`, `sl.analysis.cohort(df, { customer, date, period })`, `sl.analysis.funnel(tahap)`.
> - `sl.combo_chart(df, { x, bar, line })` menggambar batang dan garis sekaligus.

## 22.5 Machine learning: belajar dari contoh

**Machine learning** adalah cara membuat program yang belajar aturan sendiri dari contoh-contoh, bukan dari aturan yang kita tulis dengan `if`. Ada tiga jenis tugas yang paling sering:

| Tugas | Pertanyaan | Contoh |
|---|---|---|
| **Regresi** | Berapa nilainya? | Berapa gaji yang wajar untuk pengalaman 5 tahun? |
| **Klasifikasi** | Masuk kelompok mana? | Apakah pelanggan ini akan berhenti berlangganan? |
| **Pengelompokan** (klaster) | Kelompok apa saja yang ada? | Pelanggan kita terbagi ke tipe apa saja? |

### Data latih dan data uji

Aturan emas machine learning: **jangan menilai model dengan data yang dipakai untuk melatihnya.** Itu seperti murid yang dinilai dengan soal latihan yang sudah ia hafal. Bagi datanya dua: sebagian untuk **latih**, sebagian lagi disimpan untuk **uji**.

```slak
const kar = sl.dataset("karyawan")
const [latih, uji] = sl.ml.train_test_split(kar, { test_size: 0.25, random_state: 7 })
sl.write(`${latih.shape[0]} baris latih, ${uji.shape[0]} baris uji`)

const model = sl.ml.LinearRegression().fit(latih.select(["pengalaman_tahun", "jam_pelatihan", "gaji_juta"]), "gaji_juta")
const tebakan = model.predict(uji.select(["pengalaman_tahun", "jam_pelatihan"]))

const [a, b] = sl.columns(2)
a.metric("R² pada data uji", Math.round(sl.ml.r2_score(uji.gaji_juta, tebakan) * 100) / 100)
b.metric("Rata-rata meleset", `${sl.ml.mae(uji.gaji_juta, tebakan).toLocaleString("id-ID", { maximumFractionDigits: 1 })} juta`)
```

Alurnya selalu sama, apa pun modelnya: **bagi → latih (`fit`) → tebak (`predict`) → ukur**. Nama-namanya sengaja dibuat sama dengan scikit-learn, pustaka machine learning paling terkenal di Python.

### Klasifikasi: siapa yang akan berhenti?

Dataset bawaan `pelanggan` berisi 1.000 pelanggan layanan internet fiktif dan kolom `churn` (1 = berhenti berlangganan).

```slak
const data = sl.dataset("pelanggan").drop("pelanggan_id")
const [latih, uji] = sl.ml.train_test_split(data, { test_size: 0.25, stratify: "churn", random_state: 42 })

const pohon = sl.ml.DecisionTreeClassifier({ max_depth: 4 }).fit(latih, "churn")
const tebak = pohon.predict(uji.drop("churn"))

sl.metric("Akurasi pada data uji", sl.ml.accuracy_score(uji.churn, tebak), null, { format: "percent" })
sl.dataframe(sl.ml.confusion_matrix(uji.churn, tebak))
sl.code(pohon.rules())
```

- **Akurasi** adalah persentase tebakan yang benar.
- **Matriks kebingungan** (*confusion matrix*) memperlihatkan jenis kesalahannya: berapa pelanggan yang sebenarnya berhenti tetapi ditebak bertahan, dan sebaliknya. Untuk churn, kesalahan jenis pertama biasanya lebih mahal.
- **Pohon keputusan** bisa dibaca sebagai aturan "jika … maka …" lewat `rules()`. Ini sangat berguna untuk menjelaskan model kepada orang bisnis.

### Pengelompokan: tipe-tipe pelanggan

**KMeans** membagi data ke `k` kelompok sehingga anggota satu kelompok saling mirip. Tidak ada jawaban benar yang diberikan; model menemukan kelompoknya sendiri.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const pel = df.groupby("pelanggan_id").agg({ transaksi: ["id_transaksi", "nunique"], belanja: ["total", "sum"] })

const X = sl.ml.StandardScaler().fit_transform(pel.select(["transaksi", "belanja"]))
const km = sl.ml.KMeans({ n_clusters: 3, random_state: 1 }).fit(X)
const dikelompokkan = pel.assign({ klaster: () => km.predict(X) })

const profil = dikelompokkan.groupby("klaster").agg({
  pelanggan: ["pelanggan_id", "size"], rata_transaksi: ["transaksi", "mean"], rata_belanja: ["belanja", "mean"]
}).sort_values("rata_belanja")
sl.dataframe(profil, { format: { rata_transaksi: "decimal:1", rata_belanja: "rupiah" } })
sl.scatter_chart(dikelompokkan.assign({ klaster: r => `Kelompok ${r.klaster}` }), { x: "transaksi", y: "belanja", color: "klaster", format: "compact" })
```

`StandardScaler` menyamakan skala kolom lebih dulu. Tanpanya, kolom `belanja` (jutaan) akan mendominasi kolom `transaksi` (satuan), dan pengelompokan hanya melihat belanja.

Hasilnya biasanya tiga tipe yang mudah diberi nama: **pembeli sesekali** (sebagian besar), **pelanggan tetap**, dan **pelanggan setia** yang sedikit jumlahnya tetapi besar belanjanya.

> **API Slak baru**
> - `sl.ml.train_test_split(df, { test_size, stratify, random_state })` membagi data latih dan uji.
> - Model: `sl.ml.LinearRegression()`, `sl.ml.DecisionTreeClassifier({ max_depth })`, `sl.ml.KMeans({ n_clusters })`, dan lainnya. Semuanya memakai `.fit(df, "target")` dan `.predict(df)`.
> - Ukuran: `sl.ml.accuracy_score`, `sl.ml.confusion_matrix`, `sl.ml.r2_score`, `sl.ml.mae`, `sl.ml.rmse`.
> - `sl.ml.StandardScaler().fit_transform(df)` menyamakan skala kolom.

## 22.6 Demo model untuk orang lain

Model yang hanya kamu pahami sendiri belum berguna. `sl.ml_demo` membuat formulir interaktif: setiap kolom mendapat widget yang sesuai, dan tebakan model tampil seketika.

```slak
sl.ml_demo(
  sl.ml.DecisionTreeClassifier({ max_depth: 4 }),
  sl.dataset("pelanggan").drop("pelanggan_id"),
  { target: "churn", labels: { 0: "Bertahan", 1: "Berhenti" } }
)
```

Ubah jumlah keluhan atau lama berlangganan, lalu perhatikan tebakan dan keyakinan model berubah. Bagian "Fitur mana yang paling berpengaruh?" menunjukkan apa yang paling diperhatikan model.

> **API Slak baru**
> - `sl.ml_demo(model, df, { target, labels })` membuat formulir coba model. Model yang belum dilatih dilatih otomatis.

Hasil model Slak sudah dicocokkan dengan scikit-learn. Untuk model yang lebih rumit, seperti gradient boosting atau deep learning, analis biasanya beralih ke Python (Bab 26).

> **Coba di playground**
> Di contoh klasifikasi, ganti `max_depth: 4` menjadi `max_depth: 2` lalu `max_depth: 12`. Apa yang terjadi pada akurasi data uji? Pohon yang terlalu dalam menghafal data latih, sehingga justru buruk pada data baru. Gejala ini disebut *overfitting*.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Akurasi 100% | Dinilai dengan data latih, atau target ikut sebagai fitur | Nilai dengan data uji; buang kolom target dari fitur |
| Akurasi tinggi, tetapi semua ditebak "bertahan" | Kelas tidak seimbang | Lihat matriks kebingungan, bukan akurasi saja |
| Ramalan meyakinkan padahal datanya sedikit | Satu angka tanpa rentang | Laporkan batas bawah dan atas |
| Klaster hanya mengikuti satu kolom | Skala kolom berbeda jauh | Pakai `StandardScaler` |
| Galat nilai kosong saat `fit` | Model butuh data lengkap | `dropna` atau `fillna` dulu |

## Latihan

**Latihan 22.1 (mudah).** Pakai fungsi `regresi` buatanmu untuk data kecil di bawah. Hasil `b` (kemiringan) harus 2 dan `a` harus 1.

```slak latihan
function regresi(x, y) {
  // salin dan lengkapi dari 22.1
  return { a: 0, b: 0 }
}

const hasil = regresi([1, 2, 3, 4], [3, 5, 7, 9])
await sl.testing.test("kemiringan 2", () => sl.testing.expect(hasil.b).toBeCloseTo(2, 6))
await sl.testing.test("titik potong 1", () => sl.testing.expect(hasil.a).toBeCloseTo(1, 6))
```

**Latihan 22.2 (sedang).** Hitung `porsiBerisiko`: proporsi pelanggan Toko Nusantara yang masuk segmen RFM "Berisiko" atau "Jangan Sampai Hilang".

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const porsiBerisiko = 0   // ganti

sl.metric("Pelanggan berisiko", (porsiBerisiko * 100).toFixed(1) + "%")
const rfm = sl.analysis.rfm(df, { customer: "pelanggan_id", date: "tanggal", amount: "total" })
await sl.testing.test("porsi benar", () => sl.testing.expect(porsiBerisiko).toBeCloseTo(
  rfm.filter(r => ["Berisiko", "Jangan Sampai Hilang"].includes(r.segmen)).shape[0] / rfm.shape[0], 6))
```

**Latihan 22.3 (tantangan).** Latih `RandomForestClassifier` untuk memprediksi churn, lalu simpan akurasinya pada data uji di `akurasi`. Akurasinya harus lebih baik daripada menebak "bertahan" untuk semua orang.

```slak latihan
const data = sl.dataset("pelanggan").drop("pelanggan_id")
const [latih, uji] = sl.ml.train_test_split(data, { test_size: 0.25, stratify: "churn", random_state: 42 })
const akurasi = 0   // ganti

sl.metric("Akurasi", (akurasi * 100).toFixed(1) + "%")
const tebakBertahan = uji.churn.to_list().filter(v => v === 0).length / uji.shape[0]
await sl.testing.test("lebih baik dari tebakan sederhana", () => sl.testing.expect(akurasi).toBeGreaterThan(tebakBertahan))
```

## Mini-proyek: prakiraan dan segmen pelanggan

```slak
sl.title("Prakiraan dan Pelanggan Toko Nusantara :crystal_ball:")

const df = await sl.read_csv("toko-nusantara.csv")
const [tRamal, tSegmen] = sl.tabs(["Prakiraan omzet", "Segmen pelanggan"])

// ---------- Prakiraan ----------
const bulanan = df.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
const fc = sl.ts.forecast(bulanan, { periods: 6 })
const tabel = fc.forecast.to_records()
const total6 = tabel.reduce((a, r) => a + r.prediksi, 0)
const bawah6 = tabel.reduce((a, r) => a + r.batas_bawah, 0)
const atas6 = tabel.reduce((a, r) => a + r.batas_atas, 0)
const jt = x => (x / 1e6).toFixed(0) + " jt"
tRamal.metric("Perkiraan omzet 6 bulan ke depan", jt(total6))
tRamal.caption(`Rentang yang mungkin: ${jt(bawah6)} sampai ${jt(atas6)}`)
tRamal.write(fc)

// ---------- Segmen ----------
const rfm = sl.analysis.rfm(df, { customer: "pelanggan_id", date: "tanggal", amount: "total" })
const perSegmen = rfm.groupby("segmen").agg({ pelanggan: ["pelanggan_id", "size"], belanja: ["monetary", "sum"] })
  .sort_values("belanja", { ascending: false })
tSegmen.bar_chart(perSegmen, { x: "segmen", y: "belanja", horizontal: true, format: "compact" })
const juara = perSegmen.filter(r => r.segmen === "Juara").to_records()[0]
if (juara) tSegmen.success(`${juara.pelanggan} pelanggan "Juara" menyumbang ${(juara.belanja / rfm.monetary.sum() * 100).toFixed(0)}% omzet. Jaga mereka baik-baik.`)
tSegmen.dataframe(rfm.filter(r => r.segmen === "Berisiko").sort_values("monetary", { ascending: false }).head(10))
```

Daftar pelanggan *Berisiko* di bawahnya adalah hasil kerja yang bisa langsung dipakai tim pemasaran: siapa yang perlu dihubungi minggu ini.
