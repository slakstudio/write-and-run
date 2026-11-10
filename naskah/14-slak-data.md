# Bab 14 · Dari JavaScript Murni ke Slak Data

> **Tujuan belajar**
> - Mengenal `sl.DataFrame` dan `sl.Series`, tabel dan kolom gaya pandas.
> - Mengulang semua langkah Bab 13 dengan Slak Data.
> - Memilih kolom, menyaring, mengurutkan, dan menambah kolom.
> - Melihat isi dan ringkasan data dengan `head`, `info`, `describe`, dan `shape`.
> - Menimbang kapan memakai JavaScript murni dan kapan memakai Slak Data.

## 14.1 DataFrame dan Series

Sejak Bab 11, `sl.read_csv` mengembalikan **DataFrame** dan kita langsung mengubahnya menjadi larik objek dengan `to_records()`. Kini saatnya mengenal DataFrame itu sendiri.

- **DataFrame** adalah tabel: setiap kolom punya nama dan tipe.
- **Series** adalah satu kolom: deretan nilai bertipe sama.

Namanya sengaja dibuat sama dengan **pandas**, pustaka analisis data paling terkenal di Python. Bila suatu hari kamu belajar Python, sebagian besar yang kamu pelajari di sini langsung berlaku.

```slak
const df = sl.DataFrame([
  { kota: "Jayapura", omzet: 4200000, cabang: 1 },
  { kota: "Sorong", omzet: 3100000, cabang: 1 },
  { kota: "Manokwari", omzet: 1800000, cabang: 1 }
])

sl.write(df.shape)            // [baris, kolom]
sl.write(df.columns)          // nama kolom
sl.write(df.omzet.sum())      // satu kolom adalah Series
sl.write(df.omzet.mean())
sl.dataframe(df)
```

> **API Slak baru**
> - `sl.DataFrame(larikObjek)` membuat DataFrame dari larik objek. Kebalikannya: `df.to_records()`.
> - `df.namaKolom` atau `df["nama kolom"]` mengambil satu kolom sebagai Series.
> - Series punya ringkasan siap pakai: `sum()`, `mean()`, `median()`, `min()`, `max()`, `std()`, `nunique()`, `quantile(0.9)`.

### sl. atau nama tabel?

Satu aturan yang perlu kamu ingat sepanjang Tahap 2 dan 3:

- Awalan **`sl.`** dipakai untuk menyuruh Slak **menampilkan** sesuatu, **membuat widget**, atau **memuat data**: `sl.dataframe(df)`, `sl.slider(...)`, `sl.read_csv(...)`.
- **Nama tabel** dipakai untuk **mengolah** tabel itu: `df.groupby(...)`, `df.query(...)`.

Nama `df` hanyalah kebiasaan; tabelmu boleh bernama `penjualan`. Bila awalannya tertukar, misalnya `sl.groupby(...)`, Slak memberi pesan yang menunjuk tulisan yang benar.

## 14.2 Mengenal data dalam empat perintah

```slak
const toko = await sl.read_csv("toko-nusantara.csv")
sl.dataframe(toko.head())     // 5 baris pertama
sl.dataframe(toko.info())     // tipe, terisi, kosong, unik per kolom
sl.dataframe(toko.describe()) // statistik ringkas kolom angka
sl.dataframe(toko.value_counts("kota"))
```

Empat baris ini adalah langkah pertama setiap analisis. Dalam semenit kamu tahu banyaknya baris, tipe setiap kolom, ada tidaknya nilai kosong, dan sebaran angkanya. Bandingkan dengan Bab 13.1, yang butuh beberapa perulangan untuk sebagian kecil informasi ini.

## 14.3 Bab 13 dalam beberapa baris

Inilah pembersihan Bab 13, langkah demi langkah, berdampingan dengan versi JavaScript murninya:

| Langkah | JavaScript murni (Bab 13) | Slak Data |
|---|---|---|
| Rapikan spasi | `map` + `trim` + regex | `df.strip_strings()` |
| Huruf judul | `split` + `map` + `join` | `df.kota.str.title()` |
| Salah ketik | kamus + `KAMUS[t] \|\| t` | `.replace({ Jayapra: "Jayapura", ... })` |
| Harga dari teks | fungsi `keAngka` dengan regex | `df.to_numeric("harga")` |
| Tanggal tiga format | fungsi `keTanggal` dengan `match` | `df.to_datetime("tanggal")` |
| Isi nilai kosong | `r.kanal \|\| "Tidak diketahui"` | `df.fillna({ kanal: "Tidak diketahui" })` |
| Buang baris kosong | `filter(r => r.jumlah != null)` | `df.dropna({ subset: ["jumlah"] })` |
| Buang ganda | `Set` + `filter` | `df.drop_duplicates({ subset: ["id_transaksi"] })` |
| Tambah kolom | `map(r => ({ ...r, total }))` | `df.assign({ total: r => r.jumlah * r.harga })` |

```slak
const SALAH_KETIK = { Jayapra: "Jayapura", Makasar: "Makassar", Surabya: "Surabaya" }

let df = await sl.read_csv("toko-nusantara-kotor.csv")
df = df.strip_strings()
df = df.assign({
  kota: () => df.kota.str.title().replace(SALAH_KETIK),
  produk: () => df.produk.str.title()
})
df = df.to_numeric("harga").to_datetime("tanggal")
df = df.fillna({ kanal: "Tidak diketahui" }).dropna({ subset: ["jumlah", "harga", "tanggal"] })
df = df.drop_duplicates({ subset: ["id_transaksi"] })
df = df.filter(df.jumlah.le(50))
df = df.assign({ total: r => r.jumlah * r.harga })

sl.write(`${df.shape[0]} baris bersih, omzet ${df.total.sum().toLocaleString("id-ID")}`)
sl.write(df.kota.unique())
sl.dataframe(df.head(8))
```

Hasilnya sama persis dengan Bab 13: 362 baris dengan omzet yang sama. Bedanya, kode ini bisa dibaca seperti daftar langkah, dan setiap langkahnya sudah teruji.

Hal-hal yang perlu diperhatikan:

- **Setiap perintah menghasilkan DataFrame baru.** Data asli tidak berubah. Karena itu hasilnya selalu disimpan lagi: `df = df.strip_strings()`.
- Di `assign`, fungsi tanpa parameter `() => df.kota...` mengembalikan **Series** untuk seluruh kolom, sedangkan fungsi dengan parameter `r => r.jumlah * r.harga` dipanggil **per baris**, seperti `map`.
- `df.jumlah.le(50)` menghasilkan Series benar/salah: *le* artinya *less or equal*, kurang dari atau sama dengan. Ada juga `lt`, `gt`, `ge`, `eq`, dan `ne`.

> **API Slak baru**
> - Membersihkan: `strip_strings()`, `clean_names()` (merapikan nama kolom), `to_numeric(kolom)`, `to_datetime(kolom)`, `fillna({ kolom: nilai })`, `dropna({ subset })`, `drop_duplicates({ subset })`, `missing()` (nilai kosong per kolom).
> - Teks per kolom lewat `.str`: `.str.title()`, `.str.lower()`, `.str.upper()`, `.str.contains()`, `.str.replace()`.
> - `series.replace({ lama: baru })` mengganti nilai lewat kamus.

## 14.4 Memilih, menyaring, mengurutkan

```slak
const t = await sl.read_csv("toko-nusantara.csv")

const kecil = t.select(["tanggal", "kota", "produk", "total"])   // pilih kolom
const papua = kecil.filter(r => ["Jayapura", "Sorong", "Manokwari"].includes(r.kota))
const besar = papua.query("total >= 300000")
const urut = besar.sort_values("total", { ascending: false })

sl.write(`${urut.shape[0]} transaksi besar di tanah Papua`)
sl.dataframe(urut.head(10))
```

Ada tiga cara menyaring, pilih yang paling mudah dibaca untukmu:

| Cara | Contoh | Cocok untuk |
|---|---|---|
| Fungsi per baris | `df.filter(r => r.kanal === "Online")` | Logika apa pun, gaya JavaScript |
| Series benar/salah | `df.filter(df.total.gt(100000))` | Syarat sederhana pada satu kolom |
| Ekspresi teks | `df.query("total > 100000 and kota in ['Ambon', 'Kupang']")` | Syarat panjang, gaya pandas |

`query` bisa memakai nilai dari variabel atau widget dengan awalan `@`:

```slak
const t2 = await sl.read_csv("toko-nusantara.csv")
const minimal = sl.number_input("Total minimal", { value: 500000, step: 50000 })
const hasil = t2.query("total >= @minimal", { minimal })
sl.write(`${hasil.shape[0]} transaksi`)
```

> **API Slak baru**
> - `select([kolom])`, `filter(syarat)`, `query("ekspresi")`, `sort_values(kolom, { ascending })`, `head(n)`, `tail(n)`, `sample(n)`.
> - Ekspresi `query` mendukung `and`, `or`, `not`, `in [...]`, `between ... and ...`, `is null`, serta fungsi `contains`, `startswith`, `lower`, `year`, `month`, `quarter`, `isna`, dan `len`.

## 14.5 Menambah kolom

```slak
const tk = await sl.read_csv("toko-nusantara.csv")
const lengkap = tk.assign({
  pajak: r => Math.round(r.total * 0.11),
  bulan: () => tk.tanggal.dt.month,
  hari: () => tk.tanggal.dt.day_name(),
  ukuran: () => sl.cut(tk.total, [0, 50000, 200000, Infinity], { labels: ["kecil", "sedang", "besar"] })
})
sl.dataframe(lengkap.select(["tanggal", "hari", "bulan", "total", "pajak", "ukuran"]).head(8))
```

- `.dt` memberi akses ke bagian tanggal: `year`, `month`, `day`, `quarter`, `weekday` (0 = Senin), `day_name()` ("Senin"), `month_name()` ("Januari"), dan `strftime("%Y-%m")`.
- `sl.cut(series, batas, { labels })` memasukkan angka ke dalam kelompok.

## 14.6 Bisakah hasilnya dipercaya?

Pertanyaan wajar: Slak Data ditulis dalam JavaScript, bukan pandas. Apakah angkanya benar?

Slak Data diuji akurasinya terhadap pustaka Python yang dipakai di seluruh dunia: **pandas, scipy, statsmodels, dan scikit-learn**. Pengujiannya mencakup 150 kasus, dan hasilnya cocok, kecuali dua perbedaan yang memang disengaja: pembulatan 1,25 menjadi 1,3 seperti Excel, dan `str.title()` yang tidak membesarkan huruf setelah angka.

Kamu juga bisa memeriksanya sendiri. Ingat, kamu sudah menulis fungsi `rataRata` dan `median` di Bab 5:

```slak
const tc = await sl.read_csv("toko-nusantara.csv")
const nilai = tc.total.to_list()

const rataManual = nilai.reduce((a, b) => a + b, 0) / nilai.length
const urut = [...nilai].sort((a, b) => a - b)
const tengah = Math.floor(urut.length / 2)
const medianManual = urut.length % 2 ? urut[tengah] : (urut[tengah - 1] + urut[tengah]) / 2

const { test, expect } = sl.testing
await test("rata-rata sama", () => expect(tc.total.mean()).toBeCloseTo(rataManual, 6))
await test("median sama", () => expect(tc.total.median()).toBe(medianManual))
```

## 14.7 Kapan JavaScript murni, kapan Slak Data?

| Pakai JavaScript murni bila | Pakai Slak Data bila |
|---|---|
| Datanya kecil dan logikanya unik | Langkahnya umum: bersihkan, saring, kelompokkan, gabungkan |
| Kamu butuh kendali penuh atas setiap langkah | Kamu ingin kode yang singkat dan mudah dibaca orang lain |
| Membangun fungsi yang dipakai ulang di tempat lain | Butuh statistik, deret waktu, atau machine learning |

Keduanya bisa dicampur bebas. `df.to_records()` mengubah DataFrame menjadi larik objek, dan `sl.DataFrame(larik)` mengembalikannya. `df.filter(r => ...)` bahkan menerima fungsi JavaScript biasa.

> **Coba di playground**
> Pada contoh 14.4, ganti `"total >= 300000"` dengan `"month(tanggal) == 12"`. Transaksi bulan apa saja yang tersisa?

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Pembersihan seolah tidak berpengaruh | Hasil tidak disimpan | `df = df.dropna()`, bukan hanya `df.dropna()` |
| `sl.groupby is not a function` | Awalan tertukar | Mengolah tabel memakai nama tabel: `df.groupby(...)` |
| `Kolom "Kota" tidak ada` | Nama kolom beda huruf besar-kecil atau ada spasi | Lihat `df.columns`, atau rapikan dengan `clean_names()` |
| Kolom angka terbaca teks | Ada sel berisi huruf | `df.to_numeric("kolom")`; sel yang gagal menjadi kosong |

## Latihan

**Latihan 14.1 (mudah).** Dari `toko-nusantara.csv`, hitung banyaknya transaksi kanal Online di variabel `nOnline`.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const nOnline = 0   // ganti

sl.metric("Transaksi online", nOnline)
await sl.testing.test("banyak transaksi online benar", () =>
  sl.testing.expect(nOnline).toBe(df.to_records().filter(r => r.kanal === "Online").length))
```

**Latihan 14.2 (sedang).** Buat DataFrame `murah` berisi transaksi kategori Makanan dengan harga di bawah 40.000, hanya kolom `produk` dan `harga`, diurutkan dari harga termurah.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const murah = df   // ganti

sl.dataframe(murah.head())
await sl.testing.test("dua kolom", () => sl.testing.expect(murah.columns).toEqual(["produk", "harga"]))
await sl.testing.test("semua di bawah 40 ribu", () => sl.testing.expect(murah.harga.max()).toBeLessThan(40000))
await sl.testing.test("urut naik", () => sl.testing.expect(murah.harga.to_list()[0]).toBe(murah.harga.min()))
```

**Latihan 14.3 (tantangan).** Tambahkan kolom `margin` ke data bersih, yaitu `total` dikurangi 60% dari `total`, lalu hitung `marginRata` sebagai rata-rata margin transaksi kanal Toko.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const marginRata = 0   // ganti

sl.metric("Rata-rata margin kanal Toko", marginRata, null, { format: "rp" })
const harapan = df.filter(r => r.kanal === "Toko").total.mean() * 0.4
await sl.testing.test("margin rata-rata benar", () => sl.testing.expect(marginRata).toBeCloseTo(harapan, 2))
```

## Mini-proyek: pembersih data serba guna

Pembersih ini menerima berkas CSV apa pun, menampilkan laporan kualitasnya, membersihkan dengan pilihan pengguna, lalu menawarkan hasilnya untuk diunduh.

```slak
sl.title("Pembersih Data :sparkles:")

const unggah = sl.file_uploader("CSV kotor", { type: ["csv"] })
let df = unggah ? await sl.read_csv(unggah) : await sl.read_csv("toko-nusantara-kotor.csv")
if (!unggah) sl.caption("Memakai contoh toko-nusantara-kotor.csv")

sl.subheader("Sebelum")
sl.dataframe(df.missing())

const rapikanTeks = sl.checkbox("Rapikan spasi dan nama kolom", { value: true })
const buangGanda = sl.checkbox("Buang baris ganda", { value: true })
const kosong = sl.radio("Baris dengan nilai kosong", ["Biarkan", "Buang"], { horizontal: true })

const n0 = df.shape[0]
if (rapikanTeks) df = df.strip_strings().clean_names()
if (buangGanda) df = df.drop_duplicates()
if (kosong === "Buang") df = df.dropna()

sl.subheader("Sesudah")
sl.write(`${n0} → ${df.shape[0]} baris`)
sl.dataframe(df.head(10))
sl.download_button("Unduh CSV bersih", df, { file_name: "bersih.csv" })
```

> **API Slak baru**
> - `sl.radio(label, pilihan, { horizontal })` menampilkan pilihan tunggal.
> - `sl.download_button(label, data, { file_name })` mengunduh data. Akhiran nama berkas menentukan formatnya: `.csv`, `.xlsx`, `.json`, atau `.md`.
