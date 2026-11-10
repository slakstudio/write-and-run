# Bab 20 · Data Deret Waktu

> **Tujuan belajar**
> - Mengubah teks menjadi tanggal dan memformatnya.
> - Mengelompokkan per hari, minggu, bulan, kuartal, dan tahun dengan `resample`.
> - Menghitung pertumbuhan bulan ke bulan dan tahun ke tahun.
> - Menghaluskan data dengan rata-rata bergerak.
> - Menguraikan tren dan pola musiman.

**Deret waktu** adalah data yang diurutkan menurut waktu: omzet harian, pengunjung mingguan, harga bulanan. Hampir semua laporan bisnis memuat deret waktu, karena pertanyaan terpenting manajer adalah "**bagaimana perkembangannya?**"

## 20.1 Tanggal di Slak Data

`sl.read_csv` mengubah kolom tanggal ISO menjadi `Date` secara otomatis. Untuk format lain, termasuk format Indonesia, pakai `to_datetime`:

```slak
const tgl = sl.to_datetime(["2024-04-10", "10/04/2024", "10 April 2024"])
sl.write(tgl.map(d => sl.strftime(d, "%A, %d %B %Y")))
```

Ketiga format menghasilkan tanggal yang sama: Rabu, 10 April 2024.

Membuat deretan tanggal, misalnya untuk memastikan setiap bulan ada:

```slak
const bulan = sl.date_range("2024-01-01", { end: "2024-06-01", freq: "MS" })
sl.write(bulan.to_list().map(d => sl.strftime(d, "%B %Y")))
```

> **API Slak baru**
> - `sl.to_datetime(nilai)` mengubah teks atau larik teks menjadi tanggal; `df.to_datetime(kolom)` mengubah satu kolom DataFrame.
> - `sl.date_range(awal, { end, periods, freq })` membuat deretan tanggal. `freq`: `"D"` hari, `"W"` minggu, `"MS"` awal bulan, `"ME"` akhir bulan, `"QS"` awal kuartal, `"YS"` awal tahun.

## 20.2 resample: mengelompokkan menurut waktu

`resample` adalah `groupby` khusus tanggal. Ia juga memastikan periode tanpa data tetap muncul, sehingga grafik tidak melompat.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const freq = sl.segmented_control("Periode", ["D", "W", "M", "Q"], { default: "M" })
const per = df.resample("tanggal", freq).agg({ omzet: ["total", "sum"], transaksi: ["id_transaksi", "nunique"] })
sl.write(`${per.shape[0]} periode`)
sl.line_chart(per, { x: "tanggal", y: "omzet", format: "compact" })
```

Geser pilihan dari hari (`D`) ke kuartal (`Q`). Data harian penuh gerigi; data bulanan dan kuartalan memperlihatkan polanya.

| Kode | Periode |
|---|---|
| `"D"` | Hari |
| `"W"` | Minggu (mulai Senin) |
| `"M"` | Bulan |
| `"Q"` | Kuartal |
| `"Y"` | Tahun |

> **API Slak baru**
> - `df.resample(kolomTanggal, freq).agg({...})` meringkas per periode.
> - `sl.segmented_control(label, pilihan, { default })` menampilkan tombol pilihan yang berdampingan.

## 20.3 Pertumbuhan

Dua ukuran pertumbuhan yang paling sering diminta:

- **MoM** (*month over month*): dibanding bulan sebelumnya.
- **YoY** (*year over year*): dibanding bulan yang sama tahun lalu.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const bulanan = df.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
const tumbuh = bulanan.assign({
  mom: () => bulanan.omzet.pct_change(),
  yoy: () => bulanan.omzet.pct_change(12)
})
sl.dataframe(tumbuh.tail(6), { format: { omzet: "rupiah", mom: "percent", yoy: "percent" } })
```

`pct_change()` membandingkan setiap baris dengan satu baris sebelumnya; `pct_change(12)` dengan dua belas baris sebelumnya, yaitu bulan yang sama tahun lalu. Tahun pertama tidak punya YoY, sehingga kolomnya kosong.

**Mengapa YoY penting?** Omzet Desember naik tajam dibanding November setiap tahun karena musim liburan. MoM Desember yang tinggi bukan prestasi, melainkan musim. YoY membandingkan Desember dengan Desember, sehingga pengaruh musim hilang.

Pintasan untuk laporan pertumbuhan:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const g = sl.analysis.growth(df, { date: "tanggal", value: "total" })
sl.dataframe(g.tail(4), { format: { total: "rupiah", pertumbuhan: "percent", pertumbuhan_yoy: "percent", kumulatif: "rupiah" } })
```

> **API Slak baru**
> - `series.pct_change(n)` menghitung persen perubahan dibanding `n` baris sebelumnya.
> - `sl.analysis.growth(df, { date, value })` menghasilkan kolom `periode`, `pertumbuhan` (MoM), `pertumbuhan_yoy`, dan `kumulatif`.

## 20.4 Rata-rata bergerak

Data harian naik turun karena banyak hal kecil: hujan, hari libur, pembeli rombongan. **Rata-rata bergerak** menghaluskannya dengan merata-ratakan beberapa periode terakhir.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const harian = df.resample("tanggal", "D").agg({ omzet: ["total", "sum"] })
const halus = harian.assign({
  rata7: () => harian.omzet.rolling(7).mean(),
  rata30: () => harian.omzet.rolling(30).mean()
})
sl.line_chart(halus, { x: "tanggal", y: ["omzet", "rata7", "rata30"], format: "compact", title: "Omzet harian dan rata-rata bergerak" })
```

- `rolling(7).mean()` merata-ratakan 7 hari terakhir: pola mingguan hilang.
- `rolling(30).mean()` merata-ratakan 30 hari: hanya tren besarnya yang tersisa.

Mengirim larik ke opsi `y` menggambar beberapa garis sekaligus.

Cara kerjanya bisa kamu tulis sendiri dengan JavaScript murni:

```slak
function rataBergerak(x, n) {
  return x.map((_, i) => {
    if (i < n - 1) return null
    const jendela = x.slice(i - n + 1, i + 1)
    return jendela.reduce((a, b) => a + b, 0) / n
  })
}
sl.write(rataBergerak([10, 20, 30, 40, 50], 3))
```

> **API Slak baru**
> - `series.rolling(n).mean()` (juga `.sum()`, `.max()`) menghitung nilai bergerak.
> - `series.cumsum()` menjumlahkan terus-menerus; `series.shift(n)` menggeser nilai `n` baris; `series.diff()` selisih dengan baris sebelumnya.

## 20.5 Musim: Lebaran dan akhir tahun

Toko oleh-oleh punya dua musim ramai: menjelang **Lebaran** dan **akhir tahun**. Lebaran bergeser sekitar 11 hari lebih awal setiap tahun (22 April 2023, 10 April 2024), jadi puncaknya pun bergeser.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const t = df.assign({ tahun: () => df.tanggal.dt.year.astype("str"), bulan: () => df.tanggal.dt.month })
const perBulan = t.groupby(["tahun", "bulan"]).agg({ omzet: ["total", "sum"] })
sl.bar_chart(perBulan, { x: "bulan", y: "omzet", color: "tahun", format: "compact", title: "Dua puncak setiap tahun: Lebaran dan Desember" })
```

Menempatkan dua tahun berdampingan per bulan memperlihatkan pola yang berulang.

### Menguraikan tren dan musim

**Dekomposisi** memisahkan deret waktu menjadi tiga bagian: **tren** (arah jangka panjang), **musiman** (pola yang berulang setiap periode), dan **residu** (sisa yang tidak bisa dijelaskan). Butuh beberapa tahun data supaya polanya terlihat jelas. Dataset bawaan `penjualan_bulanan` berisi omzet bulanan selama enam tahun:

```slak
const pb = sl.dataset("penjualan_bulanan")
const d = sl.ts.decompose(pb, { period: 12 })
sl.line_chart(d, { x: "bulan", y: ["nilai", "tren"], title: "Omzet dan trennya" })
sl.bar_chart(d.head(12), { x: "bulan", y: "musiman", title: "Pola musiman: puncak di bulan Desember" })
```

> **API Slak baru**
> - `sl.ts.decompose(df, { period })` menghasilkan kolom `nilai`, `tren`, `musiman`, dan `residu`. `period: 12` untuk data bulanan dengan pola tahunan, `7` untuk data harian dengan pola mingguan.

> **Coba di playground**
> Ganti `rolling(30)` menjadi `rolling(90)`. Apa yang terjadi pada garisnya, dan berapa hari pertama yang kosong?

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Grafik waktu melompat-lompat | Data belum diurutkan atau ada periode kosong | Pakai `resample`, yang mengurutkan dan mengisi periode kosong |
| Pertumbuhan Desember selalu tampak luar biasa | Membandingkan dengan November (MoM) | Lihat juga YoY |
| Bulan terakhir tampak anjlok | Bulannya belum selesai | Buang periode yang belum lengkap, atau beri catatan |
| `rolling` menghasilkan kosong di awal | Belum cukup periode untuk jendela | Wajar; jendela 7 butuh 7 data |

## Latihan

**Latihan 20.1 (mudah).** Buat `kuartalan`: omzet per kuartal, dengan kolom `omzet`.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const kuartalan = sl.DataFrame([])   // ganti

sl.dataframe(kuartalan)
await sl.testing.test("8 kuartal", () => sl.testing.expect(kuartalan.shape[0]).toBe(8))
await sl.testing.test("jumlahnya sama dengan total omzet", () => sl.testing.expect(kuartalan.omzet.sum()).toBe(df.total.sum()))
```

**Latihan 20.2 (sedang).** Lengkapi `pertumbuhan(x)` dengan JavaScript murni: untuk larik angka `x`, kembalikan larik persen perubahan dibanding nilai sebelumnya (angka 0 sampai 1), dengan isi pertama `null`.

```slak latihan
function pertumbuhan(x) {
  return []
}

await sl.testing.test("[100, 110, 99]", () => {
  const p = pertumbuhan([100, 110, 99])
  sl.testing.expect(p[0]).toBeNull()
  sl.testing.expect(p[1]).toBeCloseTo(0.1, 6)
  sl.testing.expect(p[2]).toBeCloseTo(-0.1, 6)
})
```

**Latihan 20.3 (tantangan).** Cari bulan dengan omzet tertinggi di setiap tahun. Simpan sebagai objek `puncak`, misalnya `{ 2023: 12, 2024: 12 }`, dengan bulan berupa angka 1–12.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const puncak = {}   // isi

sl.json(puncak)
await sl.testing.test("ada dua tahun", () => sl.testing.expect(Object.keys(puncak).length).toBe(2))
await sl.testing.test("puncak 2024 benar", () => {
  const b = df.filter(r => r.tanggal.getFullYear() === 2024).resample("tanggal", "M").agg({ omzet: ["total", "sum"] }).to_records()
  const maks = b.reduce((a, r) => r.omzet > a.omzet ? r : a)
  sl.testing.expect(puncak[2024]).toBe(maks.tanggal.getMonth() + 1)
})
```

## Mini-proyek: tren penjualan per cabang

```slak
sl.title("Tren Penjualan Cabang :calendar:")

const df = await sl.read_csv("toko-nusantara.csv")
const cabang = sl.selectbox("Cabang", ["Semua", ...df.cabang.unique().sort()])
const data = cabang === "Semua" ? df : df.filter(r => r.cabang === cabang)

const bulanan = data.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
const lengkap = bulanan.assign({
  tren: () => bulanan.omzet.rolling(3).mean(),
  yoy: () => bulanan.omzet.pct_change(12)
})

const akhir = lengkap.to_records().at(-1)
const persen = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1, signDisplay: "always" })
const [a, b] = sl.columns(2)
a.metric("Omzet Desember 2024", akhir.omzet, akhir.yoy != null ? persen.format(akhir.yoy) + " YoY" : null, { format: "rp" })
const tahunan = data.assign({ th: () => data.tanggal.dt.year }).groupby("th").agg({ omzet: ["total", "sum"] }).to_records()
b.metric("Pertumbuhan 2024", persen.format(tahunan[1].omzet / tahunan[0].omzet - 1))

sl.line_chart(lengkap, { x: "tanggal", y: ["omzet", "tren"], format: "compact" })

const yoy = lengkap.filter(r => r.yoy != null)
const turun = yoy.filter(r => r.yoy < 0).shape[0]
sl.write(`Pada 2024, **${12 - turun} dari 12 bulan** lebih tinggi daripada bulan yang sama di 2023.`)
```

`larik.at(-1)` mengambil isi terakhir larik; lebih ringkas daripada `larik[larik.length - 1]`.
