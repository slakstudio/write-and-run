# Bab 6 · Larik (Array)

> **Tujuan belajar**
> - Membuat, membaca, dan mengubah larik.
> - Memakai `push`, `pop`, `slice`, `includes`, dan `indexOf`.
> - Menguasai lima metode terpenting analis data: `map`, `filter`, `reduce`, `sort`, dan `find`.
> - Merangkai beberapa metode dalam satu baris.

Bab ini adalah bab terpenting di Tahap 1. Hampir semua pekerjaan analis data adalah mengubah, menyaring, dan meringkas daftar nilai. Bacalah pelan-pelan dan coba setiap contohnya.

## 6.1 Membuat dan membaca larik

**Larik** (array) adalah daftar nilai berurutan, ditulis di antara kurung siku dan dipisah koma.

```slak
const kota = ["Jayapura", "Sorong", "Manokwari", "Makassar"]

sl.write(kota[0])             // isi pertama
sl.write(kota[2])             // isi ketiga
sl.write(kota.length)         // banyaknya isi
sl.write(kota[kota.length - 1])  // isi terakhir
sl.write(kota[10])            // tidak ada: undefined
```

Posisi isi disebut **indeks** dan dimulai dari **0**. Jadi larik berisi 4 kota punya indeks 0, 1, 2, dan 3.

## 6.2 Mengubah larik

```slak
const keranjang = ["kopi", "sagu"]
keranjang.push("abon")          // tambah di akhir
sl.write(keranjang)
const keluar = keranjang.pop()  // ambil dan buang yang terakhir
sl.write(`Dikeluarkan: ${keluar}`)
keranjang[0] = "kopi robusta"   // ganti isi indeks 0
sl.write(keranjang)
```

Larik yang dibuat dengan `const` tetap boleh diubah isinya. Yang dilarang `const` hanyalah mengganti larik itu dengan larik lain.

## 6.3 Mencari di dalam larik

```slak
const produk = ["Kopi Wamena", "Sagu Lempeng", "Abon Cakalang", "Sambal Roa"]
sl.write(produk.includes("Sambal Roa"))   // ada atau tidak
sl.write(produk.indexOf("Abon Cakalang")) // di indeks berapa
sl.write(produk.indexOf("Teh"))           // -1 berarti tidak ada
sl.write(produk.slice(1, 3))              // potong dari indeks 1 sampai sebelum 3
```

`slice` tidak mengubah larik asli; ia membuat larik baru.

## 6.4 map: ubah setiap isi

`map` menjalankan sebuah fungsi untuk setiap isi larik dan mengumpulkan hasilnya menjadi larik baru yang sama panjang.

```slak
const harga = [85000, 72000, 35000, 48000]
const hargaBaru = harga.map(h => h * 1.05)        // naik 5%
const dalamRibu = harga.map(h => `${h / 1000} rb`)
sl.write(hargaBaru)
sl.write(dalamRibu)
```

Fungsi panah `h => h * 1.05` dipanggil empat kali, sekali untuk setiap harga. `h` berisi harga yang sedang diproses.

Bila kamu juga butuh indeksnya, terima parameter kedua: `harga.map((h, i) => ...)`.

## 6.5 filter: ambil yang memenuhi syarat

`filter` menyimpan isi yang membuat fungsinya bernilai `true`, dan membuang sisanya.

```slak
const omzet = [1250000, 980000, 1430000, 1100000, 1675000, 2010000, 1890000]
const hariRamai = omzet.filter(x => x > 1500000)
sl.write(hariRamai)
sl.write(`${hariRamai.length} dari ${omzet.length} hari ramai`)
```

Bandingkan dengan Latihan 4.2: pekerjaan yang dulu butuh lima baris perulangan kini cukup satu baris.

## 6.6 reduce: ringkas menjadi satu nilai

`reduce` adalah pola akumulator dari Bab 4 dalam bentuk fungsi.

```slak
const omzetMinggu = [1250000, 980000, 1430000, 1100000, 1675000, 2010000, 1890000]
const total = omzetMinggu.reduce((acc, x) => acc + x, 0)
const tertinggi = omzetMinggu.reduce((acc, x) => x > acc ? x : acc, omzetMinggu[0])
sl.write(`Total: ${total}`)
sl.write(`Tertinggi: ${tertinggi}`)
```

Cara membacanya:

- `acc` (akumulator) adalah penampung. Isi awalnya argumen kedua `reduce`, yaitu `0`.
- Untuk setiap `x`, fungsi mengembalikan nilai `acc` yang baru.
- Setelah semua isi diproses, `reduce` mengembalikan `acc` terakhir.

| Putaran | `acc` sebelum | `x` | `acc` sesudah |
|---|---|---|---|
| 1 | 0 | 1.250.000 | 1.250.000 |
| 2 | 1.250.000 | 980.000 | 2.230.000 |
| 3 | 2.230.000 | 1.430.000 | 3.660.000 |
| … | … | … | … |

## 6.7 sort: mengurutkan

```slak
const angka = [10, 9, 100, 25]
sl.write([...angka].sort())                  // salah untuk angka!
sl.write([...angka].sort((a, b) => a - b))   // kecil ke besar
sl.write([...angka].sort((a, b) => b - a))   // besar ke kecil
```

Tanpa fungsi pembanding, `sort` mengurutkan sebagai **teks**, sehingga `100` dianggap lebih kecil dari `25` (karena `"1"` lebih awal daripada `"2"`). Untuk angka, selalu beri pembanding:

- `(a, b) => a - b` mengurutkan naik.
- `(a, b) => b - a` mengurutkan turun.

`sort` mengubah larik aslinya. Karena itu contoh di atas menyalin larik dulu dengan `[...angka]`.

Untuk teks berbahasa Indonesia, pakai `localeCompare`:

```slak
const nama = ["yosef", "Agus", "ani", "Benny"]
sl.write([...nama].sort((a, b) => a.localeCompare(b, "id")))
```

## 6.8 find dan some

```slak
const stok = [12, 0, 7, 0, 3, 25]
sl.write(stok.find(x => x > 10))        // isi pertama yang cocok
sl.write(stok.findIndex(x => x === 0))  // indeks pertama yang cocok
sl.write(stok.some(x => x === 0))       // adakah yang kosong?
sl.write(stok.every(x => x >= 0))       // semuanya tidak negatif?
```

## 6.9 Merangkai metode

Karena `map` dan `filter` mengembalikan larik baru, metode bisa dirangkai. Bacalah dari kiri ke kanan seperti kalimat.

```slak
const transaksi = [120000, 45000, 310000, 89000, 560000, 22000, 410000]

const totalBesarSetelahPajak = transaksi
  .filter(t => t >= 100000)     // ambil transaksi besar
  .map(t => t * 1.11)           // tambahkan PPN 11%
  .reduce((a, t) => a + t, 0)   // jumlahkan

sl.write(Math.round(totalBesarSetelahPajak))
```

"Ambil transaksi minimal 100 ribu, tambahkan pajak, lalu jumlahkan." Pola **saring → ubah → ringkas** ini adalah inti analisis data. Di Tahap 2, Slak Data memberi nama lain untuk langkah yang sama: `filter`, `assign`, dan `agg`.

## 6.10 Memilih banyak sekaligus

```slak
const semuaKota = ["Jayapura", "Sorong", "Manokwari", "Makassar", "Ambon"]
const dipilih = sl.multiselect("Pilih cabang", semuaKota, { default: ["Jayapura", "Sorong"] })
sl.write(`Kamu memilih ${dipilih.length} cabang: ${dipilih.join(", ")}`)
```

> **API Slak baru**
> - `sl.multiselect(label, pilihan, { default })` mengembalikan **larik** berisi pilihan yang dipilih.

`join(", ")` menyambung isi larik menjadi satu teks dengan pemisah koma.

> **Coba di playground**
> Pada contoh 6.9, ganti batas 100000 menjadi 300000, lalu ganti `.reduce(...)` dengan `.length` untuk menghitung banyaknya transaksi besar.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Urutan angka aneh, misalnya 10, 100, 25, 9 | `sort()` tanpa pembanding | `sort((a, b) => a - b)` |
| `map` menghasilkan larik berisi `undefined` | Fungsi panah memakai `{ }` tanpa `return` | Hapus `{ }` atau tambahkan `return` |
| `reduce of empty array with no initial value` | Lupa nilai awal pada larik kosong | Selalu beri argumen kedua, misalnya `0` |
| `Cannot read properties of undefined` | Indeks di luar batas | Ingat indeks terakhir adalah `length - 1` |

## Latihan

**Latihan 6.1 (mudah).** Dari daftar harga, buat larik `hargaPromo` berisi harga yang dipotong 20%.

```slak latihan
const harga = [50000, 80000, 125000]
const hargaPromo = harga   // ganti dengan map

sl.write(hargaPromo)
await sl.testing.test("dipotong 20%", () => sl.testing.expect(hargaPromo).toEqual([40000, 64000, 100000]))
```

**Latihan 6.2 (sedang).** Hitung rata-rata nilai siswa yang **lulus** (nilai minimal 75) dengan `filter` dan `reduce`.

```slak latihan
const nilai = [80, 62, 91, 75, 58, 88]
const rataLulus = 0   // ganti

sl.write(rataLulus)
await sl.testing.test("rata-rata yang lulus = 83.5", () => sl.testing.expect(rataLulus).toBe(83.5))
```

**Latihan 6.3 (tantangan).** Buat larik `tigaTerbesar` berisi tiga omzet tertinggi, urut dari yang terbesar, tanpa mengubah larik `omzet`.

```slak latihan
const omzet = [1250000, 980000, 1430000, 1100000, 1675000, 2010000, 1890000]
const tigaTerbesar = []   // ganti

sl.write(tigaTerbesar)
await sl.testing.test("tiga terbesar", () => sl.testing.expect(tigaTerbesar).toEqual([2010000, 1890000, 1675000]))
await sl.testing.test("omzet asli tidak berubah", () => sl.testing.expect(omzet[0]).toBe(1250000))
```

## Mini-proyek: daftar nilai siswa

```slak
sl.title("Daftar Nilai Siswa :books:")

const nama = ["Agus", "Benny", "Citra", "Dewi", "Elsa", "Frans", "Gita", "Hana"]
const nilaiSiswa = [78, 65, 92, 88, 71, 55, 83, 95]

const batas = sl.slider("Nilai minimum", 0, 100, 70)
const urutan = sl.selectbox("Urutkan", ["Nilai tertinggi", "Nilai terendah", "Nama A–Z"])

// gabungkan nama dan nilai menjadi pasangan [nama, nilai]
let daftar = nama.map((n, i) => [n, nilaiSiswa[i]])

daftar = daftar.filter(p => p[1] >= batas)

if (urutan === "Nilai tertinggi") daftar.sort((a, b) => b[1] - a[1])
else if (urutan === "Nilai terendah") daftar.sort((a, b) => a[1] - b[1])
else daftar.sort((a, b) => a[0].localeCompare(b[0], "id"))

const rata = daftar.length ? daftar.reduce((s, p) => s + p[1], 0) / daftar.length : 0
sl.write(`**${daftar.length} siswa**, rata-rata ${rata.toFixed(1)}`)

for (const [n, v] of daftar) {
  sl.markdown(`- ${n}: ${v >= 75 ? `:green[${v}]` : `:orange[${v}]`}`)
}
```

Menyimpan nama dan nilai dalam dua larik terpisah lalu memasangkannya terasa repot. Di Bab 7 kamu belajar cara yang jauh lebih rapi: satu larik berisi objek.
