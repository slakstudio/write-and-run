# Bab 24 · Merapikan dan Menguji Kode

> **Tujuan belajar**
> - Memahami mengapa satu berkas besar menyulitkan, dan cara merapikannya.
> - Memisahkan fungsi pembersihan, analisis, dan tampilan.
> - Memakai berkas JavaScript tambahan, dan mengenal `import`/`export` ES Modules, tanpa build.
> - Membuat class sederhana untuk membungkus logika yang dipakai ulang.
> - Menguji aplikasi dengan `sl.testing` supaya angka laporan tetap benar setiap kali kode diubah.
> - Menulis komentar dan nama yang membantu dirimu sendiri enam bulan lagi.

Laporan di Bab 17 sekitar 50 baris. Dasbor di Bab 25 akan jauh lebih panjang. Kode yang panjang tanpa susunan seperti gudang tanpa rak: semuanya ada, tetapi tidak ada yang bisa ditemukan. Bab ini tentang menyusun rak.

## 24.1 Tanda-tanda kode perlu dirapikan

- Kamu menyalin-tempel potongan kode yang sama di dua tempat.
- Kamu takut mengubah satu baris karena tidak tahu apa lagi yang ikut rusak.
- Kamu harus menggulir jauh untuk menemukan sesuatu.
- Nama variabel seperti `x2`, `data3`, atau `tmp` bertebaran.

Obatnya satu prinsip: **satu bagian, satu tugas.** Pisahkan kode yang **menyiapkan data**, yang **menghitung**, dan yang **menampilkan**.

## 24.2 Rapi di dalam satu berkas

Langkah pertama tidak butuh berkas baru. Kelompokkan fungsi ke dalam objek bernama, sehingga jelas fungsi mana untuk apa:

```slak
// ---------- Data ----------
const Data = {
  async muat() {
    const df = await sl.read_csv("toko-nusantara.csv")
    return df.assign({ tahun: () => df.tanggal.dt.year })
  }
}

// ---------- Analisis ----------
const Analisis = {
  ringkas(df) {
    return { omzet: df.total.sum(), transaksi: df.shape[0], pelanggan: df.pelanggan_id.nunique() }
  },
  perKategori(df) {
    return df.groupby("kategori").agg({ omzet: ["total", "sum"] }).sort_values("omzet", { ascending: false })
  }
}

// ---------- Tampilan ----------
const Tampilan = {
  kartu(ring) {
    const [a, b, c] = sl.columns(3)
    a.metric("Omzet", ring.omzet, null, { format: "rp" })
    b.metric("Transaksi", ring.transaksi)
    c.metric("Pelanggan", ring.pelanggan)
  }
}

// ---------- Aplikasi ----------
const df = await Data.muat()
const tahun = sl.segmented_control("Tahun", [2023, 2024], { default: 2024 })
const terpilih = df.filter(r => r.tahun === tahun)
Tampilan.kartu(Analisis.ringkas(terpilih))
sl.bar_chart(Analisis.perKategori(terpilih), { x: "kategori", y: "omzet", format: "compact" })
```

Bagian **Aplikasi** di bawah kini hanya lima baris dan bisa dibaca seperti kalimat. Kalau angka omzet salah, kamu tahu harus mencari di `Analisis`. Kalau tampilan kartu kurang bagus, cari di `Tampilan`.

Di Slak Studio, ganti garis pemisah `// ----------` dengan `// %% Data`, `// %% Analisis`, dan seterusnya. Kode yang sama sekaligus menjadi sel-sel di **mode sel** (Bab 1): data cukup dimuat sekali, lalu bagian tampilan bisa diubah berkali-kali dengan cepat.

## 24.3 Berkas JavaScript tambahan

Fungsi yang dipakai di beberapa aplikasi sebaiknya tinggal di berkas sendiri. Cara paling sederhana, dan yang paling setia pada **Write and Run**, adalah berkas JavaScript biasa yang dimuat dengan tag `<script>`:

```js
// toko-analisis.js
window.TokoAnalisis = {
  saring(df, { tahun, cabang = [], kanal = "Semua" } = {}) {
    return df
      .filter(r => tahun == null || r.tanggal.getFullYear() === tahun)
      .filter(r => cabang.length === 0 || cabang.includes(r.cabang))
      .filter(r => kanal === "Semua" || r.kanal === kanal)
  },
  ringkas(df) {
    return { omzet: df.total.sum(), transaksi: df.shape[0], pelanggan: df.pelanggan_id.nunique(),
             rata: df.shape[0] ? df.total.sum() / df.shape[0] : 0 }
  },
  banding(a, b) {
    if (!a) return null
    return new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1, signDisplay: "always" }).format(b / a - 1)
  }
}
```

```html
<script src="slak.js"></script>
<script src="slak-data.js"></script>
<script src="toko-analisis.js"></script>
<script type="text/slak">
  const df = await sl.read_csv("toko-nusantara.csv")
  const r = TokoAnalisis.ringkas(TokoAnalisis.saring(df, { tahun: 2024 }))
  sl.metric("Omzet 2024", r.omzet, null, { format: "rp" })
</script>
```

- Semua fungsi dikumpulkan di **satu objek** `TokoAnalisis`, supaya namanya tidak bertabrakan dengan nama lain.
- `window.TokoAnalisis = ...` membuat objek itu bisa dipakai di mana saja di halaman.
- Cara ini jalan di semua tempat: klik dua kali, Slak Studio, dan hosting.
- Parameter `{ tahun, cabang = [], kanal = "Semua" } = {}` adalah destructuring dengan nilai bawaan (Bab 5 dan 7): fungsi boleh dipanggil hanya dengan sebagian pilihan.

`toko-analisis.js` ada di folder bahan buku, dan halaman buku ini sudah memuatnya, jadi contoh berikut bisa dijalankan di sini:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const ini = TokoAnalisis.ringkas(TokoAnalisis.saring(df, { tahun: 2024, kanal: "Online" }))
const lalu = TokoAnalisis.ringkas(TokoAnalisis.saring(df, { tahun: 2023, kanal: "Online" }))
sl.metric("Omzet online 2024", ini.omzet, TokoAnalisis.banding(lalu.omzet, ini.omzet), { format: "rp" })
```

## 24.4 ES Modules: import dan export

JavaScript modern punya cara resmi untuk berbagi kode antarberkas: **ES Modules**. Sebuah berkas menandai apa yang dibagikan dengan `export`, dan berkas lain mengambilnya dengan `import`. Tidak perlu build: browser memahaminya langsung.

```js
// toko-analisis.mjs
export function ringkas(df) {
  return { omzet: df.total.sum(), transaksi: df.shape[0], pelanggan: df.pelanggan_id.nunique() }
}
export const rupiah = (x) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(x)
```

Di skrip Slak, ambil modul dengan `await import(...)`:

```slak
try {
  const { ringkas, rupiah } = await import(new URL("toko-analisis.mjs", location.href))
  const df = await sl.read_csv("toko-nusantara.csv")
  sl.write(`Omzet seluruhnya: ${rupiah(ringkas(df).omzet)}`)
} catch (e) {
  sl.warning("Modul tidak bisa dimuat. ES Modules hanya jalan lewat hosting atau server lokal, tidak saat halaman dibuka dengan klik dua kali. " + e.message)
}
```

- `new URL("toko-analisis.mjs", location.href)` membuat alamat lengkap berkas modul di folder halaman. Skrip Slak dijalankan dari dalam Slak, jadi alamat relatif saja tidak cukup.
- `const { ringkas, rupiah } = ...` mengambil dua fungsi yang di-`export` sekaligus.

**Batasnya:** browser tidak mengizinkan modul dimuat dari halaman yang dibuka dengan klik dua kali (alamat `file://`). Karena itu buku ini menganjurkan:

| Cara | Klik dua kali | Hosting | Kapan dipakai |
|---|---|---|---|
| Objek di berkas yang sama | ✓ | ✓ | Aplikasi kecil sampai menengah |
| Berkas `.js` biasa dengan `<script src>` | ✓ | ✓ | Fungsi yang dipakai di beberapa aplikasi |
| ES Modules `import`/`export` | ✗ | ✓ | Proyek yang pasti diterbitkan ke hosting, atau saat bekerja dengan pustaka modern |

Mengenal `import` dan `export` tetap penting: hampir semua kode JavaScript modern di internet ditulis dengan cara ini, dan kamu akan sering membacanya.

## 24.5 Class

Kadang data dan fungsi yang mengolahnya selalu berpasangan. **Class** membungkus keduanya menjadi satu "cetakan" yang bisa dibuat berkali-kali.

```slak
class Cabang {
  constructor(nama, df) {
    this.nama = nama
    this.data = df.filter(r => r.cabang === nama)
  }
  get omzet() { return this.data.total.sum() }
  omzetTahun(t) { return this.data.filter(r => r.tanggal.getFullYear() === t).total.sum() }
  pertumbuhan() { return this.omzetTahun(2024) / this.omzetTahun(2023) - 1 }
  toString() { return `${this.nama}: tumbuh ${(this.pertumbuhan() * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` }
}

const df = await sl.read_csv("toko-nusantara.csv")
const semua = df.cabang.unique().map(n => new Cabang(n, df))
const tercepat = semua.reduce((a, c) => c.pertumbuhan() > a.pertumbuhan() ? c : a)
sl.write(`Tumbuh paling cepat: ${tercepat}`)
sl.dataframe(semua.map(c => ({ cabang: c.nama, omzet: c.omzet, tumbuh: c.pertumbuhan() })), { format: { omzet: "rupiah", tumbuh: "percent" } })
```

| Bagian | Arti |
|---|---|
| `class Cabang { ... }` | Cetakan bernama `Cabang` |
| `constructor(...)` | Dijalankan saat objek dibuat dengan `new Cabang(...)` |
| `this.nama` | Properti milik objek ini |
| `get omzet()` | Properti yang dihitung; dibaca tanpa kurung: `c.omzet` |
| `omzetTahun(t)` | Metode: fungsi milik objek |

Kamu sudah memakai class sejak Bab 14: `sl.DataFrame` dan `sl.ml.KMeans` adalah class. Untuk aplikasi analisis, fungsi dan objek biasa sering sudah cukup; pakai class bila kamu membuat **banyak objek sejenis** yang masing-masing punya data dan perilaku.

## 24.6 Menguji aplikasi

Di Bab 9 kamu menguji fungsi. Kini uji **aplikasinya**: jalankan aplikasi di balik layar, ubah widgetnya dari kode, lalu periksa apa yang tampil.

```slak
const aplikasi = `
const df = await sl.read_csv("toko-nusantara.csv")
const tahun = Number(sl.selectbox("Tahun", ["2024", "2023"]))
const kanal = sl.radio("Kanal", ["Semua", "Toko", "Online"])
const data = df.filter(r => r.tanggal.getFullYear() === tahun && (kanal === "Semua" || r.kanal === kanal))
sl.metric("Omzet", data.total.sum())
sl.metric("Transaksi", data.shape[0])
`

const { test, expect } = sl.testing
const df = await sl.read_csv("toko-nusantara.csv")

await test("bawaan menampilkan 2024", async () => {
  const at = await sl.testing.run(aplikasi)
  expect(at.metric("Transaksi").value).toBe(df.filter(r => r.tanggal.getFullYear() === 2024).shape[0])
})

await test("filter Online 2023 benar", async () => {
  const at = await sl.testing.run(aplikasi)
  await at.selectbox("Tahun").set_value("2023").run()
  await at.radio("Kanal").set_value("Online").run()
  const harapan = df.filter(r => r.tanggal.getFullYear() === 2023 && r.kanal === "Online").total.sum()
  expect(at.metric("Omzet").value).toBe(harapan)
})

await test("Toko + Online = Semua", async () => {
  const at = await sl.testing.run(aplikasi)
  const semua = at.metric("Omzet").value
  await at.radio("Kanal").set_value("Toko").run()
  const toko = at.metric("Omzet").value
  await at.radio("Kanal").set_value("Online").run()
  expect(toko + at.metric("Omzet").value).toBe(semua)
})
```

Uji ketiga menarik: ia tidak tahu angka pastinya, tetapi tahu **hubungan** yang harus selalu benar. Uji seperti ini menangkap kesalahan filter yang paling sering terjadi.

> **API Slak baru**
> - `await sl.testing.run(kode)` menjalankan aplikasi tersembunyi dan mengembalikan objek uji `at`.
> - `at.selectbox("Label").set_value(...)`, `at.button("Label").click()`, lalu `await ... .run()` untuk menjalankan ulang.
> - `at.metric("Label").value`, `at.dataframe[0].value`, `at.exception` untuk memeriksa hasil.
> - `sl.testing.from_string(kode)`, `from_file("app.slak")`, dan `from_function(fn)` membuat objek uji tanpa langsung menjalankannya.

### Berkas uji di Slak Studio

Di Slak Studio, simpan uji di berkas `nama.uji.slak` di samping aplikasinya, misalnya `laporan.uji.slak` untuk `laporan.slak`:

```slak tanpa-jalan lewati
const { test, expect } = sl.testing

await test("laporan jalan tanpa galat", async () => {
  const at = await sl.testing.run("laporan.slak")
  expect(at.exception).toHaveLength(0)
})
```

Panel **Uji** di bilah kiri Slak Studio menjalankan semua berkas uji di folder itu. **Uji cepat** memastikan berkas yang sedang dibuka jalan tanpa galat, dan **Buat berkas uji** membuat kerangkanya. Di luar Slak Studio, buka `slak-test.html` dari paket Slak.

Jalankan uji setiap kali selesai mengubah kode. Bila semuanya hijau, kamu boleh yakin perubahanmu tidak merusak yang lama.

## 24.7 Komentar dan nama untuk dirimu enam bulan lagi

Kode dibaca jauh lebih sering daripada ditulis, dan pembaca yang paling sering adalah dirimu sendiri, beberapa bulan kemudian, yang sudah lupa semuanya.

**Nama yang baik menjelaskan isinya:**

| Kurang jelas | Lebih jelas |
|---|---|
| `d`, `data2`, `tmp` | `transaksi2024`, `omzetPerKota` |
| `hitung()` | `hitungMarginKotor()` |
| `f` (boolean) | `sudahLunas`, `adaStok` |
| `x > 35000000` | `omzet >= TARGET_OMZET_BULANAN` |

**Komentar menjelaskan mengapa, bukan apa.** Kode sudah mengatakan *apa* yang dikerjakan.

```js
// Kurang berguna: mengulang yang sudah jelas dari kode
// kurangi 1 dari umur
umur--

// Berguna: menjelaskan alasan yang tidak terlihat dari kode
// Belum berulang tahun tahun ini, jadi umurnya belum bertambah
if (!sudahUlangTahun) umur--
```

Tulis juga satu komentar di atas setiap fungsi penting: apa yang diterima, apa yang dikembalikan. Lihat lagi `toko-analisis.js` di bahan buku sebagai contoh.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `TokoAnalisis is not defined` | Berkas `.js` belum dimuat, atau dimuat sesudah skrip Slak | `<script src>` di `<head>`, sebelum `<script type="text/slak">` |
| `Failed to fetch dynamically imported module` | Modul dimuat dari halaman klik dua kali | Pakai berkas `.js` biasa, atau buka lewat hosting |
| `Failed to resolve module specifier` | Alamat modul relatif | `import(new URL("x.mjs", location.href))` |
| Lupa `new` saat membuat objek class | `Cabang("x", df)` | `new Cabang("x", df)` |
| Uji lulus padahal aplikasi salah | Uji hanya memeriksa ada tidaknya, bukan nilainya | Periksa nilai, atau hubungan antarnilai |

## Latihan

**Latihan 24.1 (mudah).** Lengkapi objek `Format` dengan fungsi `rupiah(x)` dan `persen(x)` bergaya Indonesia.

```slak latihan
const Format = {
  rupiah(x) { return "" },
  persen(x) { return "" }
}

await sl.testing.test("rupiah", () => sl.testing.expect(Format.rupiah(1250000)).toBe(new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(1250000)))
await sl.testing.test("persen", () => sl.testing.expect(Format.persen(0.125)).toBe("12,5%"))
```

**Latihan 24.2 (sedang).** Lengkapi class `Produk` dengan getter `margin` (persen laba kotor dari harga jual) dan metode `laku(n)` yang mengembalikan laba kotor bila terjual `n` buah.

```slak latihan
class Produk {
  constructor(nama, hargaJual, hargaPokok) {
    this.nama = nama
    this.hargaJual = hargaJual
    this.hargaPokok = hargaPokok
  }
  // tambahkan get margin() dan laku(n)
}

const kopi = new Produk("Kopi Wamena", 85000, 52000)
await sl.testing.test("margin kopi", () => sl.testing.expect(kopi.margin).toBeCloseTo(0.388, 3))
await sl.testing.test("laba 10 buah", () => sl.testing.expect(kopi.laku(10)).toBe(330000))
```

**Latihan 24.3 (tantangan).** Tulis uji aplikasi yang memastikan aplikasi `kalkulator` di bawah menghitung dengan benar saat diskon diubah menjadi 25.

```slak latihan
const kalkulator = `
const harga = sl.number_input("Harga", { value: 100000 })
const diskon = sl.slider("Diskon (%)", 0, 90, 10)
sl.metric("Bayar", harga * (1 - diskon / 100))
`

await sl.testing.test("diskon 25% dari 100 ribu = 75 ribu", async () => {
  const at = await sl.testing.run(kalkulator)
  // ubah slider, jalankan ulang, lalu periksa metric "Bayar"
  sl.testing.expect(true).toBe(false)
})
```

## Mini-proyek: laporan Bab 17 yang rapi dan teruji

Laporan Bab 17 disusun ulang: logika di `toko-analisis.js`, tampilan di aplikasi, dan uji yang memastikan angkanya benar.

```slak
// %% Data
const df = await sl.read_csv("toko-nusantara.csv")

// %% Pilihan
const [f1, f2] = sl.columns(2)
const tahun = Number(f1.selectbox("Tahun", ["2024", "2023"], { key: "rapi-tahun" }))
const kanal = f2.radio("Kanal", ["Semua", "Toko", "Online"], { horizontal: true, key: "rapi-kanal" })

// %% Hitung
const ini = TokoAnalisis.saring(df, { tahun, kanal })
const lalu = TokoAnalisis.saring(df, { tahun: tahun - 1, kanal })
const r = TokoAnalisis.ringkas(ini), r0 = TokoAnalisis.ringkas(lalu)

// %% Tampilkan
const [k1, k2, k3] = sl.columns(3)
k1.metric("Omzet", r.omzet, TokoAnalisis.banding(r0.omzet, r.omzet), { format: "rp" })
k2.metric("Transaksi", r.transaksi, TokoAnalisis.banding(r0.transaksi, r.transaksi))
k3.metric("Pelanggan", r.pelanggan, TokoAnalisis.banding(r0.pelanggan, r.pelanggan))

// %% Uji
const { test, expect } = sl.testing
await test("ringkas() menjumlah dengan benar", () => {
  const kecil = sl.DataFrame([{ total: 10, pelanggan_id: "A" }, { total: 30, pelanggan_id: "A" }])
  expect(TokoAnalisis.ringkas(kecil)).toEqual({ omzet: 40, transaksi: 2, pelanggan: 1, rata: 20 })
})
await test("Toko + Online = Semua", () => {
  const s = TokoAnalisis.ringkas(TokoAnalisis.saring(df, { tahun })).omzet
  const t = TokoAnalisis.ringkas(TokoAnalisis.saring(df, { tahun, kanal: "Toko" })).omzet
  const o = TokoAnalisis.ringkas(TokoAnalisis.saring(df, { tahun, kanal: "Online" })).omzet
  expect(t + o).toBe(s)
})
await test("tanpa data tahun lalu, banding() kosong", () => expect(TokoAnalisis.banding(0, 100)).toBeNull())
```

Bagian **Uji** bisa dipindah ke `laporan.uji.slak` supaya tidak tampil di laporan. Contoh ini memakai `toko-analisis.js`, jadi jalankan di halaman buku ini atau di Slak Studio dengan berkas itu di folder yang sama.
