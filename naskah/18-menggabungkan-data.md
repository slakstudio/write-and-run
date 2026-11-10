# Bab 18 · Menggabungkan dan Membentuk Ulang Data

> **Tujuan belajar**
> - Memahami inner, left, dan outer join.
> - Menggabungkan tabel dengan `Map` di JavaScript murni, lalu dengan `merge`.
> - Menyambung tabel dengan `sl.concat`.
> - Mengubah bentuk tabel dari panjang ke lebar dengan `pivot`, dan sebaliknya dengan `sl.melt`.

Selamat datang di Tahap 3. Data di dunia kerja jarang tersimpan dalam satu tabel. Transaksi ada di sistem kasir, harga pokok ada di bagian pembelian, target ada di berkas Excel manajer. Analis data menggabungkannya.

Bahan buku menyediakan tiga tabel pendamping transaksi:

| Berkas | Kunci | Isi |
|---|---|---|
| `produk.csv` | `produk` | Kategori, harga jual, **harga pokok**, pemasok |
| `cabang.csv` | `cabang` | Kode, kota, provinsi, **koordinat**, tanggal buka |
| `target.csv` | `cabang` + `bulan` | **Target omzet** bulanan setiap cabang |

## 18.1 Kunci dan jenis join

Dua tabel digabung lewat **kunci**: kolom yang isinya sama di kedua tabel. Transaksi punya kolom `produk`, dan `produk.csv` juga punya kolom `produk`. Dengan kunci itu, setiap transaksi bisa diberi harga pokoknya.

Pertanyaannya: bagaimana dengan baris yang kuncinya hanya ada di salah satu tabel?

| Jenis | Hasil | Mirip di Excel |
|---|---|---|
| **inner** (bawaan) | Hanya baris yang kuncinya ada di kedua tabel | |
| **left** | Semua baris tabel kiri; kolom kanan kosong bila tidak cocok | VLOOKUP |
| **right** | Semua baris tabel kanan | |
| **outer** | Semua baris dari kedua tabel | |

```
     inner               left                outer
   ┌───┬───┐          ┌───┬───┐           ┌───┬───┐
   │ A │▓B │          │▓A │▓B │           │▓A │▓B │
   │   │▓▓ │          │▓▓▓│▓▓ │           │▓▓▓│▓▓▓│
   └───┴───┘          └───┴───┘           └───┴───┘
  irisan saja       semua kiri         semuanya
```

Untuk analisis transaksi, **left join** paling sering dipakai: kita ingin semua transaksi tetap ada, apa pun yang terjadi di tabel pendamping.

## 18.2 Join dengan JavaScript murni

Cara paling sederhana adalah mencari dengan `find` untuk setiap transaksi. Tetapi untuk 3.000 transaksi dan banyak produk, itu berarti jutaan perbandingan. Cara yang benar: buat **`Map`**, kamus yang mencari dalam sekejap.

```slak
const trx = (await sl.read_csv("toko-nusantara.csv")).to_records()
const produk = (await sl.read_csv("produk.csv")).to_records()

const kamusProduk = new Map(produk.map(p => [p.produk, p]))   // produk → baris produk

const gabung = trx.map(t => {
  const p = kamusProduk.get(t.produk)
  return { ...t, harga_pokok: p ? p.harga_pokok : null, pemasok: p ? p.pemasok : null }
})

sl.write(`Transaksi tanpa pasangan: ${gabung.filter(r => r.harga_pokok == null).length}`)
sl.dataframe(gabung.slice(0, 5).map(r => ({ produk: r.produk, harga: r.harga, harga_pokok: r.harga_pokok, pemasok: r.pemasok })))
```

> **`Map` di JavaScript**
> - `new Map(larikPasangan)` membuat kamus dari larik `[kunci, nilai]`.
> - `peta.get(kunci)` mengambil nilai, `peta.has(kunci)` memeriksa ada tidaknya, `peta.set(kunci, nilai)` menambah.
> - Bedanya dengan objek biasa: kunci `Map` boleh bertipe apa saja, dan urutan penambahannya terjaga.

Ini **left join**: semua transaksi dipertahankan, dan yang tidak punya pasangan diberi `null`.

## 18.3 merge

Slak Data melakukan hal yang sama dalam satu baris:

```slak
const trx = await sl.read_csv("toko-nusantara.csv")
const produk = await sl.read_csv("produk.csv")

const lengkap = trx.merge(produk.select(["produk", "harga_pokok", "pemasok"]), { on: "produk", how: "left" })
  .assign({ laba_kotor: r => r.total - r.jumlah * r.harga_pokok })

const perPemasok = lengkap.groupby("pemasok").agg({
  omzet: ["total", "sum"],
  laba: ["laba_kotor", "sum"]
}).assign({ margin: r => r.laba / r.omzet }).sort_values("laba", { ascending: false })

sl.dataframe(perPemasok, { format: { omzet: "rupiah", laba: "rupiah", margin: "percent" } })
```

Kini kita bisa menjawab pertanyaan yang tidak mungkin dijawab dari satu tabel: **pemasok mana yang paling menguntungkan?**

> **API Slak baru**
> - `df.merge(lain, { on, how })` menggabungkan dua DataFrame. `how`: `"inner"`, `"left"`, `"right"`, `"outer"`. Bila nama kuncinya berbeda: `{ left_on: "nama_produk", right_on: "produk" }`.
> - `sl.merge(kiri, kanan, opsi)` adalah bentuk lain yang sama.
> - `df.join(lain, { on })` adalah singkatan untuk left join.

### Memeriksa hasil join

Join adalah sumber kesalahan analisis yang paling licin. Dua pemeriksaan wajib:

```slak
const trx = await sl.read_csv("toko-nusantara.csv")
const cabang = await sl.read_csv("cabang.csv")
const hasil = trx.merge(cabang.select(["cabang", "kode", "tanggal_buka"]), { on: "cabang", how: "left", indicator: true })

sl.write(`Baris sebelum: ${trx.shape[0]}, sesudah: ${hasil.shape[0]}`)
sl.dataframe(hasil.value_counts("_merge"))
```

1. **Banyak baris tidak boleh bertambah** pada left join. Bila bertambah, berarti kunci di tabel kanan ada yang ganda, dan transaksi ikut tergandakan. Omzetmu akan terhitung lebih besar dari kenyataan.
2. **Periksa baris tanpa pasangan.** `indicator: true` menambahkan kolom `_merge` berisi `both`, `left_only`, atau `right_only`.

## 18.4 Join dua kunci: omzet dibanding target

Target disimpan per cabang **per bulan**. Kuncinya dua kolom sekaligus.

```slak
const trx = await sl.read_csv("toko-nusantara.csv")
const target = await sl.read_csv("target.csv")

const omzetBulanan = trx
  .assign({ bulan: () => trx.tanggal.dt.strftime("%Y-%m") })
  .groupby(["cabang", "bulan"]).agg({ omzet: ["total", "sum"] })

const capaian = omzetBulanan.merge(target, { on: ["cabang", "bulan"], how: "left" })
  .assign({ capai: r => r.omzet / r.target })

const ringkas = capaian.groupby("cabang").agg({
  bulan_tercapai: ["capai", x => x.filter(v => v >= 1).length],
  rata_capaian: ["capai", "mean"]
}).sort_values("rata_capaian", { ascending: false })

sl.dataframe(ringkas, { format: { rata_capaian: "percent" } })
```

Perhatikan `["capai", x => x.filter(v => v >= 1).length]`. Fungsi agregasi boleh berupa fungsi buatanmu sendiri; ia menerima larik nilai setiap kelompok.

## 18.5 Menyambung tabel

Kadang datanya datang terpisah per periode atau per cabang, dengan kolom yang sama. `sl.concat` menumpuknya menjadi satu.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const data2023 = df.filter(r => r.tanggal.getFullYear() === 2023)
const data2024 = df.filter(r => r.tanggal.getFullYear() === 2024)
sl.write(`${data2023.shape[0]} + ${data2024.shape[0]} baris`)

const satu = sl.concat([data2023, data2024])
sl.write(`Disambung: ${satu.shape[0]} baris`)
```

## 18.6 Panjang dan lebar

Tabel yang sama bisa disusun dua cara:

| Bentuk panjang | | | | Bentuk lebar | | |
|---|---|---|---|---|---|---|
| **kategori** | **tahun** | **omzet** | | **kategori** | **2023** | **2024** |
| Minuman | 2023 | 36,4 jt | | Minuman | 36,4 jt | 47,5 jt |
| Minuman | 2024 | 47,5 jt | | Makanan | 35,3 jt | 47,5 jt |
| Makanan | 2023 | 35,3 jt | | | | |

Bentuk **lebar** enak dibaca manusia. Bentuk **panjang** disukai komputer dan grafik, karena setiap baris satu pengamatan.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const panjang = df.assign({ tahun: () => df.tanggal.dt.year.astype("str") })
  .groupby(["kategori", "tahun"]).agg({ omzet: ["total", "sum"] })

const lebar = panjang.pivot({ index: "kategori", columns: "tahun", values: "omzet" })
sl.dataframe(lebar, { format: "compact" })

const kembali = sl.melt(lebar, { id_vars: ["kategori"], var_name: "tahun", value_name: "omzet" })
sl.dataframe(kembali.head(4), { format: "compact" })
```

- `pivot` mengubah panjang menjadi lebar: nilai kolom `tahun` menjadi nama kolom.
- `sl.melt` mengubah lebar menjadi panjang: nama kolom kembali menjadi nilai.

Kapan butuh `melt`? Saat datamu datang dalam bentuk lebar dari Excel, misalnya satu kolom per bulan, dan kamu ingin menggambarnya dengan `color: "bulan"` atau mengelompokkannya.

> **API Slak baru**
> - `sl.concat([df1, df2])` menyambung tabel ke bawah.
> - `df.pivot({ index, columns, values })` panjang ke lebar; `pivot_table` (Bab 15) melakukan hal yang sama sambil meringkas.
> - `sl.melt(df, { id_vars, var_name, value_name })` lebar ke panjang.

> **Coba di playground**
> Di contoh 18.3, ganti `"pemasok"` dengan `"kategori"`. Kategori mana yang marginnya paling tipis?

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Omzet setelah join lebih besar dari sebelumnya | Kunci ganda di tabel kanan | Periksa `drop_duplicates` pada tabel kanan dan banyak baris sebelum-sesudah |
| Banyak nilai kosong setelah left join | Ejaan kunci berbeda, misalnya spasi atau huruf besar | Bersihkan kunci di kedua tabel (Bab 13–14) |
| Kolom `harga_x` dan `harga_y` muncul | Kolom bernama sama di kedua tabel | Pilih kolom dengan `select` sebelum `merge`, atau beri `suffixes` |
| Baris hilang setelah join | Memakai inner join padahal butuh left | `how: "left"` |

## Latihan

**Latihan 18.1 (mudah).** Gabungkan `cabang.csv` ke transaksi dengan left join agar setiap transaksi punya kolom `kode`. Pastikan banyak barisnya tidak berubah.

```slak latihan
const trx = await sl.read_csv("toko-nusantara.csv")
const cabang = await sl.read_csv("cabang.csv")
const hasil = trx   // ganti

await sl.testing.test("banyak baris tetap", () => sl.testing.expect(hasil.shape[0]).toBe(trx.shape[0]))
await sl.testing.test("kolom kode ada", () => sl.testing.expect(hasil.columns).toContain("kode"))
await sl.testing.test("tidak ada kode kosong", () => sl.testing.expect(hasil.kode.isna().sum()).toBe(0))
```

**Latihan 18.2 (sedang).** Dengan JavaScript murni dan `Map`, lengkapi `tambahKategori(trx, produk)` yang menambahkan kolom `kategori_produk` dari `produk.csv` ke setiap transaksi.

```slak latihan
function tambahKategori(trx, produk) {
  return trx
}

const trx = [{ produk: "Topi Rotan", total: 85000 }, { produk: "Sambal Roa 200g", total: 45000 }, { produk: "Tidak Ada", total: 1 }]
const produk = (await sl.read_csv("produk.csv")).to_records()
const h = tambahKategori(trx, produk)
await sl.testing.test("Topi Rotan → Pakaian", () => sl.testing.expect(h[0].kategori_produk).toBe("Pakaian"))
await sl.testing.test("produk tidak dikenal → null", () => sl.testing.expect(h[2].kategori_produk).toBeNull())
await sl.testing.test("data asli tidak berubah", () => sl.testing.expect("kategori_produk" in trx[0]).toBe(false))
```

**Latihan 18.3 (tantangan).** Hitung `persenTercapai`: persentase pasangan cabang-bulan yang omzetnya mencapai atau melampaui target, sebagai angka 0 sampai 1.

```slak latihan
const trx = await sl.read_csv("toko-nusantara.csv")
const target = await sl.read_csv("target.csv")
const persenTercapai = 0   // ganti

sl.metric("Bulan yang tercapai", (persenTercapai * 100).toFixed(1) + "%")
await sl.testing.test("antara 0 dan 1", () => { sl.testing.expect(persenTercapai).toBeGreaterThan(0); sl.testing.expect(persenTercapai).toBeLessThan(1) })
await sl.testing.test("nilai benar", () => {
  const ob = trx.assign({ bulan: () => trx.tanggal.dt.strftime("%Y-%m") }).groupby(["cabang", "bulan"]).agg({ omzet: ["total", "sum"] })
  const g = ob.merge(target, { on: ["cabang", "bulan"] }).to_records()
  sl.testing.expect(persenTercapai).toBeCloseTo(g.filter(r => r.omzet >= r.target).length / g.length, 6)
})
```

## Mini-proyek: laba per cabang dan capaian target

```slak
sl.title("Laba dan Target per Cabang :dart:")

const [trx, produk, cabang, target] = await Promise.all([
  sl.read_csv("toko-nusantara.csv"), sl.read_csv("produk.csv"), sl.read_csv("cabang.csv"), sl.read_csv("target.csv")
])

const tahun = sl.radio("Tahun", [2023, 2024], { horizontal: true, index: 1 })

const lengkap = trx
  .filter(r => r.tanggal.getFullYear() === tahun)
  .merge(produk.select(["produk", "harga_pokok"]), { on: "produk", how: "left" })
  .assign({ laba: r => r.total - r.jumlah * r.harga_pokok, bulan: r => sl.strftime(r.tanggal, "%Y-%m") })

const perCabang = lengkap.groupby("cabang").agg({ omzet: ["total", "sum"], laba: ["laba", "sum"] })
const targetTahun = target.filter(r => r.bulan.startsWith(String(tahun))).groupby("cabang").agg({ target: ["target", "sum"] })

const hasil = perCabang
  .merge(targetTahun, { on: "cabang", how: "left" })
  .merge(cabang.select(["cabang", "provinsi"]), { on: "cabang", how: "left" })
  .assign({ capaian: r => r.omzet / r.target, margin: r => r.laba / r.omzet })
  .sort_values("capaian", { ascending: false })

sl.dataframe(hasil.select(["cabang", "provinsi", "omzet", "target", "capaian", "laba", "margin"]),
  { format: { omzet: "rupiah", target: "rupiah", laba: "rupiah", capaian: "percent", margin: "percent" }, gradient: ["capaian"] })

const lewat = hasil.filter(r => r.capaian >= 1).shape[0]
sl.write(`**${lewat} dari ${hasil.shape[0]} cabang** mencapai target ${tahun}.`)
```

Empat tabel, satu jawaban. `Promise.all` (Bab 12) membaca keempat berkas bersamaan.
