# Bab 15 · Meringkas Data

> **Tujuan belajar**
> - Mengelompokkan data dengan `groupby` dan meringkasnya dengan `agg`.
> - Menghitung frekuensi dengan `value_counts` dan tabel silang dengan `sl.crosstab`.
> - Membuat tabel pivot.
> - Menghitung porsi dan kontribusi terhadap total.
> - Menyusun peringkat dengan `nlargest` dan `nsmallest`.
> - Menampilkan angka utama dengan perubahan naik atau turun.

Data mentah berisi ribuan baris. Manajer tidak membaca ribuan baris; ia ingin tahu **cabang mana yang paling laku**, **produk apa yang menyumbang omzet terbesar**, dan **apakah bulan ini lebih baik dari bulan lalu**. Meringkas adalah jembatan dari data ke jawaban.

## 15.1 Group by: dari Bab 7 ke satu perintah

Di Latihan 7.3 kamu menghitung omzet per kota dengan perulangan dan objek. Itulah *group by*: membagi baris ke dalam kelompok, lalu meringkas setiap kelompok.

```slak
const rows = (await sl.read_csv("toko-nusantara.csv")).to_records()

// cara Bab 7: JavaScript murni
const perKotaManual = {}
for (const r of rows) perKotaManual[r.kota] = (perKotaManual[r.kota] || 0) + r.total
sl.json(perKotaManual)
```

Dengan Slak Data:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const perKota = df.groupby("kota").agg({
  omzet: ["total", "sum"],
  transaksi: ["id_transaksi", "nunique"],
  rata_rata: ["total", "mean"]
}).sort_values("omzet", { ascending: false })

sl.dataframe(perKota, { format: { omzet: "rupiah", rata_rata: "rupiah" } })
```

Cara membaca `agg`: setiap kolom hasil ditulis sebagai `nama_baru: [kolom_asal, fungsi]`. Jadi `omzet: ["total", "sum"]` artinya "kolom baru `omzet` berisi jumlah kolom `total` per kelompok".

| Fungsi agregasi | Arti |
|---|---|
| `sum`, `mean`, `median` | Jumlah, rata-rata, nilai tengah |
| `min`, `max` | Terkecil, terbesar |
| `count` | Banyak nilai yang terisi |
| `size` | Banyak baris |
| `nunique` | Banyak nilai unik, misalnya pelanggan berbeda |
| `std`, `var` | Simpangan baku, varians |
| `p10` … `p99` | Persentil, misalnya `p90` |

Mengelompokkan berdasarkan dua kolom sekaligus:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const kotaKanal = df.groupby(["kota", "kanal"]).agg({ omzet: ["total", "sum"] })
sl.dataframe(kotaKanal.head(10))
```

> **API Slak baru**
> - `df.groupby(kolom)` mengelompokkan; lanjutkan dengan `.agg({ nama: [kolom, fungsi] })`. Pintasan: `.sum()`, `.mean()`, `.size()`.
> - `sl.dataframe(df, { format })` merapikan angka per kolom: `"rupiah"`, `"percent"`, `"compact"`, `"decimal:2"`.

## 15.2 Frekuensi

Sering kali yang ditanyakan bukan "berapa jumlahnya" tetapi "berapa kali muncul".

```slak
const df = await sl.read_csv("toko-nusantara.csv")
sl.dataframe(df.value_counts("kategori"))
sl.dataframe(df.value_counts("kanal", { normalize: true }))
```

`normalize: true` mengubah hitungan menjadi proporsi.

**Tabel silang** menghitung frekuensi dua kolom sekaligus:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
sl.dataframe(sl.crosstab(df.kategori, df.kanal))
sl.dataframe(sl.crosstab(df.kategori, df.kanal, { normalize: "index" }), { format: { Online: "percent", Toko: "percent" } })
```

Tabel kedua menjawab pertanyaan menarik: kategori mana yang paling banyak dibeli secara online?

## 15.3 Tabel pivot

Tabel pivot adalah ringkasan dua arah, persis seperti PivotTable di Excel: satu kolom menjadi baris, satu kolom menjadi kolom, dan sel berisi ringkasan.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const pivot = df
  .assign({ tahun: () => df.tanggal.dt.year })
  .pivot_table({ index: "kategori", columns: "tahun", values: "total", aggfunc: "sum", margins: true })
sl.dataframe(pivot, { format: "compact" })
```

`margins: true` menambah baris dan kolom total.

> **API Slak baru**
> - `df.value_counts(kolom, { normalize })` menghitung frekuensi.
> - `sl.crosstab(series1, series2, { normalize })` membuat tabel silang.
> - `df.pivot_table({ index, columns, values, aggfunc, margins })` membuat tabel pivot.

## 15.4 Porsi dan kontribusi

Angka mutlak tanpa pembanding sulit dinilai. "Omzet Ambon 20 juta" belum berarti apa-apa sampai kamu tahu itu 6% dari total.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const perKategori = df.groupby("kategori").agg({ omzet: ["total", "sum"] })
const total = perKategori.omzet.sum()

const urut = perKategori
  .assign({ porsi: r => r.omzet / total })
  .sort_values("porsi", { ascending: false })
const kontribusi = urut.assign({ kumulatif: () => urut.porsi.cumsum() })

sl.dataframe(kontribusi, { format: { omzet: "rupiah", porsi: "percent", kumulatif: "percent" } })
```

Kolom `kumulatif` menjumlahkan porsi dari atas ke bawah. Dua kategori teratas menyumbang lebih dari separuh omzet. Pola "sebagian kecil menyumbang sebagian besar" ini sering ditemukan, dan Bab 22 membahasnya sebagai analisis Pareto.

Perhatikan bahwa `kumulatif` dihitung dari `urut`, DataFrame yang sudah diurutkan. Urutan penting: jumlah kumulatif selalu dihitung dari atas ke bawah.

## 15.5 Peringkat

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const perProduk = df.groupby("produk").agg({ terjual: ["jumlah", "sum"], omzet: ["total", "sum"] })

const [kiri, kanan] = sl.columns(2)
kiri.subheader("5 terlaris")
kiri.dataframe(perProduk.nlargest(5, "terjual"))
kanan.subheader("5 paling sepi")
kanan.dataframe(perProduk.nsmallest(5, "terjual"))
```

> **API Slak baru**
> - `df.nlargest(n, kolom)` dan `df.nsmallest(n, kolom)` mengambil `n` baris dengan nilai terbesar atau terkecil.
> - `sl.subheader(teks)` menampilkan judul kecil.

## 15.6 Angka utama dan perubahannya

Dasbor yang baik dibuka dengan beberapa angka utama, masing-masing dibandingkan dengan periode sebelumnya.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const thn = df.assign({ tahun: () => df.tanggal.dt.year })
const t23 = thn.query("tahun == 2023"), t24 = thn.query("tahun == 2024")

const persen = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1, signDisplay: "always" })
const ubah = (a, b) => persen.format(b / a - 1)

const [a, b, c] = sl.columns(3)
a.metric("Omzet 2024", t24.total.sum(), ubah(t23.total.sum(), t24.total.sum()), { format: "rp" })
b.metric("Transaksi 2024", t24.shape[0], ubah(t23.shape[0], t24.shape[0]))
c.metric("Rata-rata per transaksi", Math.round(t24.total.mean()), ubah(t23.total.mean(), t24.total.mean()), { format: "rp" })
```

Argumen ketiga `sl.metric` adalah perubahannya. Slak mewarnainya hijau bila naik dan merah bila turun. Untuk angka yang lebih baik bila turun, misalnya biaya atau keluhan, tambahkan `delta_color: "inverse"`.

> **Coba di playground**
> Ganti `"kategori"` di contoh 15.4 dengan `"kota"`. Berapa kota yang menyumbang separuh omzet?

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `Kolom "omzet" tidak ada` setelah `groupby` | Lupa memberi nama kolom hasil di `agg` | Tulis `omzet: ["total", "sum"]` |
| Banyak pelanggan terlalu besar | Memakai `count` | Pakai `nunique` untuk menghitung yang berbeda |
| Porsi berjumlah lebih dari 100% | Pembagi diambil dari data yang sudah disaring | Hitung total dari data yang sama |
| Tahun tampil `2.023` | Angka tahun diformat ribuan | Ubah ke teks, misalnya `String(tahun)` |

## Latihan

**Latihan 15.1 (mudah).** Hitung `nPelanggan`, banyaknya pelanggan berbeda di seluruh data.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const nPelanggan = 0   // ganti

sl.metric("Pelanggan", nPelanggan)
await sl.testing.test("banyak pelanggan benar", () => sl.testing.expect(nPelanggan).toBe(new Set(df.pelanggan_id.to_list()).size))
```

**Latihan 15.2 (sedang).** Buat `perCabang` berisi kolom `cabang`, `omzet` (jumlah total), dan `pelanggan` (banyak pelanggan berbeda), diurutkan dari omzet terbesar.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const perCabang = sl.DataFrame([])   // ganti: groupby + agg + sort_values

sl.dataframe(perCabang)
await sl.testing.test("10 cabang", () => sl.testing.expect(perCabang.shape[0]).toBe(10))
await sl.testing.test("kolom benar", () => sl.testing.expect(perCabang.columns).toEqual(["cabang", "omzet", "pelanggan"]))
await sl.testing.test("teratas Surabaya", () => sl.testing.expect(perCabang.to_records()[0].cabang).toBe("Nusantara Surabaya"))
```

**Latihan 15.3 (tantangan).** Berapa persen omzet kategori Minuman yang berasal dari kanal Online? Simpan sebagai angka 0 sampai 1 di `porsiOnline`.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const porsiOnline = 0   // ganti

sl.metric("Porsi online kategori Minuman", (porsiOnline * 100).toFixed(1) + "%")
const m = df.filter(r => r.kategori === "Minuman")
await sl.testing.test("porsi benar", () => sl.testing.expect(porsiOnline).toBeCloseTo(m.filter(r => r.kanal === "Online").total.sum() / m.total.sum(), 6))
```

## Mini-proyek: ringkasan penjualan per cabang dan kategori

```slak
sl.title("Ringkasan Penjualan :bar_chart:")

const df = await sl.read_csv("toko-nusantara.csv")
const tahun = sl.radio("Tahun", ["2023", "2024", "Semua"], { horizontal: true, index: 1 })
const data = tahun === "Semua" ? df : df.filter(r => r.tanggal.getFullYear() === Number(tahun))

const [a, b, c] = sl.columns(3)
a.metric("Omzet", data.total.sum(), null, { format: "rp" })
b.metric("Transaksi", data.shape[0])
c.metric("Pelanggan", data.pelanggan_id.nunique())

const dimensi = sl.selectbox("Ringkas menurut", ["cabang", "kategori", "kanal", "produk"])
const ringkas = data.groupby(dimensi).agg({
  omzet: ["total", "sum"],
  transaksi: ["id_transaksi", "nunique"],
  pelanggan: ["pelanggan_id", "nunique"]
}).sort_values("omzet", { ascending: false })

const total = ringkas.omzet.sum()
sl.dataframe(ringkas.assign({ porsi: r => r.omzet / total }),
  { format: { omzet: "rupiah", porsi: "percent" }, gradient: ["omzet"] })

const juara = ringkas.to_records()[0]
sl.success(`Teratas: **${juara[dimensi]}**, ${(juara.omzet / total * 100).toFixed(1)}% dari omzet.`)
```

Opsi `gradient` mewarnai sel dari muda ke tua sesuai nilainya, sehingga yang terbesar langsung terlihat.
