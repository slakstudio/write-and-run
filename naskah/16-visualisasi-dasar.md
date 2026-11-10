# Bab 16 · Visualisasi Dasar

> **Tujuan belajar**
> - Memilih grafik yang tepat untuk pertanyaan yang tepat.
> - Menyiapkan data agar siap digambar.
> - Memberi judul, label, teks pengganti, dan warna yang jujur.
> - Mengenali grafik yang menyesatkan.

## 16.1 Mulai dari pertanyaan, bukan dari grafik

Grafik yang baik menjawab satu pertanyaan dengan sekali lihat. Sebelum memilih grafik, tulis dulu pertanyaannya.

| Pertanyaan | Grafik | Perintah |
|---|---|---|
| Bagaimana perubahannya dari waktu ke waktu? | Garis | `sl.line_chart` |
| Kategori mana yang paling besar? | Batang, diurutkan | `sl.bar_chart` |
| Bagaimana total menumpuk dari beberapa bagian sepanjang waktu? | Area | `sl.area_chart` |
| Apakah X berhubungan dengan Y? | Sebar | `sl.scatter_chart` |
| Bagaimana sebaran nilainya? | Histogram | `sl.histogram` |
| Berapa porsi setiap bagian (sedikit bagian)? | Donat | `sl.pie_chart` |

Semua grafik Slak digambar di browser tanpa internet, bisa diarahkan kursor untuk melihat nilainya, dan bisa diunduh sebagai PNG atau SVG lewat tombol di pojok kanan atas.

## 16.2 Menyiapkan data

Grafik membutuhkan data yang **sudah diringkas**. Menggambar 2.929 transaksi mentah sebagai garis hanya menghasilkan benang kusut. Kelompokkan dulu:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const bulanan = df.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
sl.dataframe(bulanan.head(4))
sl.line_chart(bulanan, { x: "tanggal", y: "omzet", title: "Omzet bulanan Toko Nusantara" })
```

`resample("tanggal", "M")` mengelompokkan per bulan. Bab 20 membahasnya lebih jauh. Karena kolom `x` berisi tanggal, sumbu mendatar otomatis menjadi sumbu waktu.

Garis ini sudah bercerita: omzet naik dari 2023 ke 2024, dengan lonjakan menjelang Lebaran dan akhir tahun.

## 16.3 Batang: membandingkan kategori

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const perKota = df.groupby("kota").agg({ omzet: ["total", "sum"] })
sl.bar_chart(perKota, {
  x: "kota", y: "omzet",
  horizontal: true, sort: true, labels: true, format: "compact",
  title: "Omzet per kota, 2023–2024"
})
```

Tiga kebiasaan untuk grafik batang:

1. **Urutkan** (`sort: true`). Pembaca langsung melihat juara dan yang tertinggal.
2. **Mendatar** (`horizontal: true`) bila nama kategorinya panjang, supaya label tidak miring.
3. **Tampilkan nilainya** (`labels: true`) bila batangnya sedikit, supaya pembaca tidak menebak.

Grafik batang selalu dimulai dari nol. Panjang batang adalah nilainya; memotong sumbu membuat selisih kecil tampak besar.

### Beberapa seri sekaligus

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const kk = df.groupby(["kategori", "kanal"]).agg({ omzet: ["total", "sum"] })
sl.bar_chart(kk, { x: "kategori", y: "omzet", color: "kanal", format: "compact", title: "Omzet per kategori dan kanal" })
```

`color: "kanal"` memberi satu warna untuk setiap nilai kolom `kanal`. Tambahkan `stack: true` untuk menumpuk batangnya.

## 16.4 Area: total dan bagiannya

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const bulanKanal = df.assign({ bulan: () => df.tanggal.dt.strftime("%Y-%m") })
  .groupby(["bulan", "kanal"]).agg({ omzet: ["total", "sum"] })
sl.area_chart(bulanKanal, { x: "bulan", y: "omzet", color: "kanal", stack: true, format: "compact", title: "Omzet bulanan menurut kanal" })
```

Grafik area bertumpuk menunjukkan total (tinggi seluruhnya) sekaligus bagiannya. Terlihat porsi kanal Online semakin tebal di 2024.

## 16.5 Sebar: mencari hubungan

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const perPelanggan = df.groupby("pelanggan_id").agg({
  kunjungan: ["id_transaksi", "nunique"],
  belanja: ["total", "sum"]
})
sl.scatter_chart(perPelanggan, {
  x: "kunjungan", y: "belanja", trendline: true, format: "compact",
  x_label: "Banyak transaksi", y_label: "Total belanja", title: "Pelanggan yang sering datang belanja lebih banyak"
})
```

Setiap titik adalah satu pelanggan. `trendline: true` menambahkan garis tren beserta nilai R² di legenda, yang mengukur seberapa rapat titik mengikuti garis. Bab 19 dan 22 membahasnya.

Perhatikan judulnya: bukan "Kunjungan vs belanja", melainkan **temuannya**. Judul yang menyatakan temuan membuat pembaca langsung paham maksud grafik.

## 16.6 Histogram: melihat sebaran

```slak
const df = await sl.read_csv("toko-nusantara.csv")
sl.histogram(df, { x: "total", bins: 30, title: "Kebanyakan transaksi di bawah 200 ribu" })
sl.write(`Rata-rata ${Math.round(df.total.mean()).toLocaleString("id-ID")}, median ${df.total.median().toLocaleString("id-ID")}`)
```

Histogram membagi rentang nilai ke dalam beberapa "keranjang" (`bins`) dan menghitung isi setiap keranjang. Sebaran transaksi kita **condong ke kanan**: banyak transaksi kecil, sedikit transaksi besar. Itulah sebabnya rata-ratanya lebih besar dari mediannya (ingat Bab 5).

## 16.7 Donat: porsi

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const perKanal = df.groupby("kanal").agg({ omzet: ["total", "sum"] })
sl.pie_chart(perKanal, { names: "kanal", values: "omzet", donut: true, title: "Porsi omzet menurut kanal" })
```

Pakai donat hanya bila bagiannya **sedikit** (dua sampai lima) dan jumlahnya 100%. Mata manusia sulit membandingkan sudut; untuk lebih dari lima bagian, grafik batang yang diurutkan hampir selalu lebih jelas.

> **API Slak baru**
> - `sl.line_chart`, `sl.bar_chart`, `sl.area_chart`, `sl.scatter_chart(data, { x, y, color, title, x_label, y_label, format })`.
> - Opsi khusus: `horizontal`, `sort`, `labels`, `stack` (batang dan area), `trendline` (sebar).
> - `sl.histogram(data, { x, bins })` dan `sl.pie_chart(data, { names, values, donut })`.
> - `format`: `"rupiah"`, `"percent"`, `"compact"` (ditulis singkat: rb, jt, M), `"decimal:2"`.

## 16.8 Grafik yang jujur dan ramah semua orang

**Hindari grafik yang menyesatkan:**

| Jebakan | Akibat | Perbaikan |
|---|---|---|
| Sumbu batang tidak dimulai dari nol | Selisih 2% tampak dua kali lipat | Batang selalu dari nol (bawaan Slak) |
| Donat dengan sepuluh potong | Tidak ada yang bisa dibandingkan | Batang yang diurutkan |
| Garis untuk kategori yang tidak berurutan | Tersirat ada "tren" antar-kota | Batang |
| Warna pelangi tanpa arti | Pembaca mencari makna yang tidak ada | Satu warna, sorot yang penting saja |
| Membandingkan bulan tidak lengkap | Desember yang baru berjalan seminggu tampak anjlok | Beri catatan, atau buang periode yang belum selesai |

**Warna yang bermakna.** Sorot hanya yang penting, misalnya cabang di atas target:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const perCabang = df.groupby("kota").agg({ omzet: ["total", "sum"] })
const target = 35000000
sl.bar_chart(perCabang, {
  x: "kota", y: "omzet", horizontal: true, sort: true, format: "compact",
  color: r => r.omzet >= target ? "var(--slak-green)" : "var(--slak-gray)",
  title: "Empat kota melampaui 35 juta"
})
```

Warna `var(--slak-green)`, `var(--slak-red)`, `var(--slak-gray)`, dan `var(--slak-c1)` sampai `var(--slak-c8)` otomatis menyesuaikan tema terang dan gelap.

**Teks pengganti.** Pembaca layar membacakan grafik untuk pengguna tunanetra. Slak membuat teks penggantinya otomatis, misalnya "Grafik omzet menurut kota, 10 titik". Opsi `alt` memberi teks yang lebih bermakna:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const perKategori = df.groupby("kategori").agg({ omzet: ["total", "sum"] })
sl.bar_chart(perKategori, { x: "kategori", y: "omzet", sort: true, alt: "Kerajinan menyumbang omzet terbesar, diikuti Minuman dan Makanan" })
```

> **Coba di playground**
> Di contoh 16.3, ganti `y: "omzet"` menjadi rata-rata nilai transaksi dengan `rata: ["total", "mean"]` di `agg`. Apakah urutan kotanya berubah?

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Grafik garis kusut berisi ribuan titik | Data belum diringkas | `groupby` atau `resample` dulu |
| Sumbu waktu tidak urut | Kolom tanggal masih berupa teks | `to_datetime`, atau urutkan dulu |
| `Kolom "omzet" tidak ada` | Nama `y` tidak sesuai nama kolom hasil `agg` | Samakan namanya |
| Angka sumbu terlalu panjang | Format bawaan | `format: "compact"` |

## Latihan

**Latihan 16.1 (mudah).** Siapkan `perKategori` berisi kolom `kategori` dan `omzet`, lalu gambar sebagai batang yang diurutkan.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const perKategori = sl.DataFrame([])   // ganti dengan groupby + agg

sl.bar_chart(perKategori, { x: "kategori", y: "omzet", sort: true })
await sl.testing.test("lima kategori", () => sl.testing.expect(perKategori.shape[0]).toBe(5))
await sl.testing.test("kolom omzet ada", () => sl.testing.expect(perKategori.columns).toContain("omzet"))
```

**Latihan 16.2 (sedang).** Siapkan `perHari` berisi rata-rata omzet harian menurut nama hari (`Senin` sampai `Minggu`). Petunjuk: kelompokkan per tanggal dulu, lalu tambahkan nama hari dengan `.dt.day_name()`, lalu kelompokkan lagi.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const perHari = sl.DataFrame([])   // ganti

sl.bar_chart(perHari, { x: "hari", y: "rata_omzet" })
await sl.testing.test("tujuh hari", () => sl.testing.expect(perHari.shape[0]).toBe(7))
await sl.testing.test("Sabtu lebih ramai dari Selasa", () => {
  const r = Object.fromEntries(perHari.to_records().map(x => [x.hari, x.rata_omzet]))
  sl.testing.expect(r.Sabtu).toBeGreaterThan(r.Selasa)
})
```

**Latihan 16.3 (tantangan).** Gambar grafik garis omzet bulanan dengan satu garis per tahun, sehingga 2023 dan 2024 bisa dibandingkan bulan demi bulan. Siapkan `perBulanTahun` dengan kolom `bulan` (1–12), `tahun` (teks), dan `omzet`.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const perBulanTahun = sl.DataFrame([])   // ganti

sl.line_chart(perBulanTahun, { x: "bulan", y: "omzet", color: "tahun" })
await sl.testing.test("24 baris", () => sl.testing.expect(perBulanTahun.shape[0]).toBe(24))
await sl.testing.test("tahun berupa teks", () => sl.testing.expect(typeof perBulanTahun.to_records()[0].tahun).toBe("string"))
```

Tahun dijadikan teks agar Slak memperlakukannya sebagai kategori, bukan angka.

## Mini-proyek: empat grafik utama Toko Nusantara

```slak
sl.title("Toko Nusantara dalam Empat Grafik :chart_with_upwards_trend:")

const df = await sl.read_csv("toko-nusantara.csv")
const [kiri, kanan] = sl.columns(2)

const bulanan = df.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
kiri.line_chart(bulanan, { x: "tanggal", y: "omzet", format: "compact", height: 260,
  title: "Omzet naik, dengan puncak Lebaran dan Desember" })

const perKota = df.groupby("kota").agg({ omzet: ["total", "sum"] })
kanan.bar_chart(perKota, { x: "kota", y: "omzet", horizontal: true, sort: true, format: "compact", height: 260,
  title: "Surabaya dan Jayapura memimpin" })

const [kiri2, kanan2] = sl.columns(2)
const perKategori = df.groupby("kategori").agg({ omzet: ["total", "sum"] })
kiri2.bar_chart(perKategori, { x: "kategori", y: "omzet", sort: true, format: "compact", height: 260,
  title: "Kerajinan menyumbang omzet terbesar" })

kanan2.histogram(df, { x: "total", bins: 25, height: 260, title: "Kebanyakan transaksi di bawah 200 ribu" })

sl.caption("Sumber: data fiktif Toko Nusantara 2023–2024.")
```

Empat grafik, empat temuan, masing-masing ditulis sebagai judul. Itulah laporan visual yang baik: pembaca tidak perlu menebak apa yang harus dilihat.
