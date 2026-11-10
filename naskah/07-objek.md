# Bab 7 · Objek dan Larik Objek

> **Tujuan belajar**
> - Membuat objek dan membaca propertinya dengan titik dan kurung siku.
> - Memakai destructuring dan spread.
> - Memahami bahwa satu baris data adalah satu objek, dan satu tabel adalah larik objek.
> - Menampilkan larik objek sebagai tabel dengan Slak.

## 7.1 Objek: satu benda, banyak keterangan

Di Bab 6, nama dan nilai siswa disimpan di dua larik terpisah. Repot dan mudah tertukar. **Objek** menyimpan beberapa keterangan tentang satu benda di satu tempat, masing-masing diberi nama.

```slak
const produk = {
  nama: "Kopi Arabika Wamena 250g",
  kategori: "Minuman",
  harga: 85000,
  stok: 24,
  tersedia: true
}

sl.write(produk.nama)
sl.write(produk["harga"])
sl.write(produk)
```

- Isi objek ditulis sebagai pasangan `nama: nilai`, dipisah koma, di antara kurung kurawal.
- Setiap pasangan disebut **properti**.
- Baca properti dengan titik (`produk.nama`) atau kurung siku (`produk["harga"]`).

Kurung siku wajib dipakai bila nama propertinya disimpan di variabel:

```slak
const barang = { nama: "Sagu Lempeng", harga: 30000, stok: 40 }
const kolom = sl.selectbox("Tampilkan kolom", ["nama", "harga", "stok"])
sl.write(barang[kolom])
```

## 7.2 Mengubah dan menambah properti

```slak
const item = { nama: "Sambal Roa 200g", harga: 45000 }
item.harga = 47000          // ubah
item.stok = 30              // tambah properti baru
delete item.stok            // hapus
sl.write(item)
sl.write("stok" in item)    // apakah properti ada?
```

`Object.keys`, `Object.values`, dan `Object.entries` mengubah objek menjadi larik, sehingga semua metode Bab 6 bisa dipakai:

```slak
const omzetKota = { Jayapura: 4200000, Sorong: 3100000, Manokwari: 1800000 }
sl.write(Object.keys(omzetKota))
sl.write(Object.values(omzetKota).reduce((a, b) => a + b, 0))
for (const [kota, omzet] of Object.entries(omzetKota)) {
  sl.write(`${kota}: ${omzet}`)
}
```

## 7.3 Destructuring dan spread

**Destructuring** mengambil beberapa properti sekaligus ke variabel:

```slak
const trx = { id: "TN000123", kota: "Ambon", total: 170000, kanal: "Online" }
const { kota, total } = trx
sl.write(`${kota}: ${total}`)

const [pertama, kedua] = ["Jayapura", "Sorong", "Manokwari"]
sl.write(pertama + " dan " + kedua)
```

**Spread** (`...`) menyalin isi objek atau larik ke tempat baru:

```slak
const dasar = { kategori: "Minuman", pemasok: "Koperasi Baliem" }
const kopi = { ...dasar, nama: "Kopi Wamena", harga: 85000 }
const kopiPromo = { ...kopi, harga: 76500 }   // salinan dengan harga berbeda
sl.write(kopi)
sl.write(kopiPromo)
```

Salinan dengan spread tidak mengubah objek asli. Kebiasaan ini membuat kode analisis aman: data mentah tetap utuh, hasil olahan disimpan di variabel baru.

## 7.4 Larik objek adalah tabel

Inilah gagasan terpenting bab ini: **satu baris data = satu objek, satu tabel = larik objek.**

```slak
const penjualan = [
  { tanggal: "2024-03-01", kota: "Jayapura", produk: "Kopi Wamena", jumlah: 2, harga: 85000 },
  { tanggal: "2024-03-01", kota: "Sorong", produk: "Sagu Lempeng", jumlah: 5, harga: 30000 },
  { tanggal: "2024-03-02", kota: "Jayapura", produk: "Sambal Roa", jumlah: 3, harga: 45000 },
  { tanggal: "2024-03-02", kota: "Manokwari", produk: "Kopi Wamena", jumlah: 1, harga: 85000 }
]

sl.table(penjualan)
```

Setiap objek menjadi satu baris, dan setiap nama properti menjadi judul kolom. Semua yang kamu pelajari di Bab 6 langsung berlaku:

```slak
const jual = [
  { kota: "Jayapura", produk: "Kopi Wamena", jumlah: 2, harga: 85000 },
  { kota: "Sorong", produk: "Sagu Lempeng", jumlah: 5, harga: 30000 },
  { kota: "Jayapura", produk: "Sambal Roa", jumlah: 3, harga: 45000 },
  { kota: "Manokwari", produk: "Kopi Wamena", jumlah: 1, harga: 85000 }
]

// tambah kolom total
const denganTotal = jual.map(r => ({ ...r, total: r.jumlah * r.harga }))

// saring Jayapura
const jayapura = denganTotal.filter(r => r.kota === "Jayapura")

// ringkas
const omzetJayapura = jayapura.reduce((a, r) => a + r.total, 0)

sl.dataframe(denganTotal)
sl.metric("Omzet Jayapura", omzetJayapura)
```

Perhatikan `r => ({ ...r, total: ... })`. Objek yang dikembalikan fungsi panah harus diapit kurung biasa, supaya JavaScript tidak mengira `{` sebagai awal blok kode.

> **API Slak baru**
> - `sl.table(data)` menampilkan tabel statis.
> - `sl.dataframe(data)` menampilkan tabel interaktif: kolomnya bisa diurutkan dengan mengeklik judul, dan ada tombol unduh CSV.
> - `sl.metric(label, nilai, delta)` menampilkan angka besar. Argumen ketiga (opsional) adalah perubahan, misalnya `"+12%"`, yang tampil hijau atau merah.

## 7.5 Dataset bawaan Slak

Slak Data menyediakan beberapa dataset contoh yang selalu tersedia, tanpa berkas apa pun. Salah satunya `penjualan`: 3.278 transaksi toko di Papua tahun 2023–2024.

```html
<script src="slak.js"></script>
<script src="slak-data.js"></script>
```

Dataset bawaan butuh `slak-data.js`. Playground, Slak Studio, dan halaman buku ini sudah memuatnya.

```slak
const df = sl.dataset("penjualan")
const baris = df.to_records()     // ubah menjadi larik objek biasa

sl.write(`Banyak baris: ${baris.length}`)
sl.write(baris[0])
sl.dataframe(baris.slice(0, 5))
```

> **API Slak baru**
> - `sl.dataset(nama)` mengembalikan dataset contoh sebagai DataFrame, yaitu tabel milik Slak Data (Bab 14).
> - `df.to_records()` mengubah DataFrame menjadi larik objek biasa, supaya bisa kamu olah dengan JavaScript murni.

Sampai Bab 13, kamu mengolah data dengan JavaScript murni: `filter`, `map`, `reduce`. Itu disengaja. Setelah paham caranya, Slak Data akan terasa wajar, bukan sihir.

```slak
const rows = sl.dataset("penjualan").to_records()
const online = rows.filter(r => r.kanal === "Online")
const omzetOnline = online.reduce((a, r) => a + r.total, 0)
const omzetSemua = rows.reduce((a, r) => a + r.total, 0)

const [k1, k2] = sl.columns(2)
k1.metric("Omzet online", omzetOnline)
k2.metric("Porsi online", (omzetOnline / omzetSemua * 100).toFixed(1) + "%")
```

> **Coba di playground**
> Ganti `"Online"` dengan `"Toko"`, lalu coba saring berdasarkan kota, misalnya `r.kota === "Sorong"`.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `Cannot read properties of undefined (reading 'harga')` | Objeknya tidak ada, misalnya `find` tidak menemukan apa-apa | Periksa dulu: `if (p) { ... }` atau pakai `p?.harga` |
| Properti bernilai `undefined` | Salah ketik nama properti, atau beda huruf besar-kecil | Lihat isi objek dengan `sl.write(obj)` |
| `map` mengembalikan `undefined` saat membuat objek | Menulis `r => { ...r }` | Apit dengan kurung: `r => ({ ...r })` |
| Data asli ikut berubah | Mengubah `r.total = ...` di dalam `map` | Buat salinan: `({ ...r, total: ... })` |

## Latihan

**Latihan 7.1 (mudah).** Buat objek `cabang` dengan properti `kota` bernilai `"Ambon"` dan `buka` bernilai `2021`.

```slak latihan
const cabang = {}

sl.write(cabang)
await sl.testing.test("kota Ambon", () => sl.testing.expect(cabang.kota).toBe("Ambon"))
await sl.testing.test("buka 2021", () => sl.testing.expect(cabang.buka).toBe(2021))
```

**Latihan 7.2 (sedang).** Dari dataset `penjualan`, hitung omzet (jumlah kolom `total`) untuk kategori `"Pakaian"`.

```slak latihan
const rows = sl.dataset("penjualan").to_records()
const omzetPakaian = 0   // ganti

sl.metric("Omzet pakaian", omzetPakaian)
await sl.testing.test("omzet pakaian benar", () => sl.testing.expect(omzetPakaian).toBe(
  rows.filter(r => r.kategori === "Pakaian").reduce((a, r) => a + r.total, 0)))
await sl.testing.test("tidak nol", () => sl.testing.expect(omzetPakaian).toBeGreaterThan(0))
```

**Latihan 7.3 (tantangan).** Buat objek `omzetPerKota` yang berisi omzet setiap kota, misalnya `{ Jayapura: ..., Sorong: ... }`. Petunjuk: mulai dari objek kosong, lalu tambahkan dengan `obj[kota] = (obj[kota] || 0) + r.total`.

```slak latihan
const data = sl.dataset("penjualan").to_records()
const omzetPerKota = {}
// isi dengan perulangan

sl.write(omzetPerKota)
await sl.testing.test("semua kota ada", () => sl.testing.expect(Object.keys(omzetPerKota).length).toBe(new Set(data.map(r => r.kota)).size))
await sl.testing.test("jumlahnya sama dengan total omzet", () =>
  sl.testing.expect(Object.values(omzetPerKota).reduce((a, b) => a + b, 0)).toBe(data.reduce((a, r) => a + r.total, 0)))
```

Pola di latihan 7.3 disebut **mengelompokkan** (group by). Di Bab 15 Slak Data melakukannya dengan satu perintah `groupby`.

## Mini-proyek: katalog produk dengan pencarian

```slak
sl.title("Katalog Toko Nusantara :shopping:")

const katalog = [
  { produk: "Kopi Arabika Wamena 250g", kategori: "Minuman", harga: 85000, stok: 24 },
  { produk: "Teh Kayu Manis 100g", kategori: "Minuman", harga: 35000, stok: 0 },
  { produk: "Keripik Keladi 200g", kategori: "Makanan", harga: 22000, stok: 80 },
  { produk: "Abon Ikan Cakalang 250g", kategori: "Makanan", harga: 55000, stok: 15 },
  { produk: "Noken Anyaman Kecil", kategori: "Kerajinan", harga: 150000, stok: 6 },
  { produk: "Gelang Manik Papua", kategori: "Kerajinan", harga: 40000, stok: 32 },
  { produk: "Minyak Kayu Putih 60ml", kategori: "Kebutuhan Rumah", harga: 38000, stok: 50 }
]

const cari = sl.text_input("Cari produk", "")
const kategoriDipilih = sl.multiselect("Kategori", ["Minuman", "Makanan", "Kerajinan", "Kebutuhan Rumah"])
const hanyaAda = sl.checkbox("Hanya yang tersedia")

const hasil = katalog
  .filter(p => p.produk.toLowerCase().includes(cari.toLowerCase()))
  .filter(p => kategoriDipilih.length === 0 || kategoriDipilih.includes(p.kategori))
  .filter(p => !hanyaAda || p.stok > 0)

sl.caption(`${hasil.length} dari ${katalog.length} produk`)
sl.dataframe(hasil)

if (hasil.length > 0) {
  const termurah = hasil.reduce((a, p) => p.harga < a.harga ? p : a)
  sl.info(`Termurah: ${termurah.produk} (${termurah.harga})`)
}
```

> **API Slak baru**
> - `sl.checkbox(label)` mengembalikan `true` atau `false`.

`toLowerCase()` mengubah teks menjadi huruf kecil, sehingga pencarian "kopi" tetap menemukan "Kopi". Teks dibahas di bab berikutnya.
