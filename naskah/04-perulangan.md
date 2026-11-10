# Bab 4 · Perulangan

> **Tujuan belajar**
> - Mengulang perintah dengan `for`, `while`, dan `for...of`.
> - Menghentikan atau melewati putaran dengan `break` dan `continue`.
> - Menghitung total, rata-rata, nilai terbesar, dan nilai terkecil secara manual.
> - Menghindari perulangan tanpa akhir.

## 4.1 Mengapa perlu perulangan

Bayangkan kamu harus menjumlahkan omzet 365 hari. Menulis 365 baris penjumlahan jelas tidak masuk akal. Perulangan membuat komputer mengerjakan hal yang sama berulang kali untukmu. Inilah inti analisis data: mengerjakan satu langkah yang sama pada ribuan baris.

## 4.2 for

```slak
for (let i = 1; i <= 5; i++) {
  sl.write(`Putaran ke-${i}`)
}
```

Bagian di dalam kurung `for` terdiri dari tiga potong yang dipisah titik koma:

| Bagian | Contoh | Arti |
|---|---|---|
| Awal | `let i = 1` | Buat penghitung `i`, mulai dari 1 |
| Syarat | `i <= 5` | Ulangi selama syarat ini benar |
| Langkah | `i++` | Setelah setiap putaran, tambah `i` dengan 1 |

`i++` adalah cara singkat menulis `i = i + 1`. Ada juga `i--` (kurangi 1) dan `i += 5` (tambah 5).

```slak
// hitung mundur dari 10, lompat 2
for (let i = 10; i > 0; i -= 2) {
  sl.write(i)
}
```

## 4.3 for...of: mengunjungi setiap isi daftar

Daftar nilai disebut **larik** (array), ditulis di antara kurung siku. Bab 6 membahasnya lengkap; untuk sekarang cukup tahu cara mengunjungi setiap isinya.

```slak
const kota = ["Jayapura", "Sorong", "Manokwari"]
for (const k of kota) {
  sl.write(`Cabang ${k}`)
}
```

`for...of` membaca "untuk setiap `k` di dalam `kota`". Kamu tidak perlu mengurus penghitung sama sekali.

## 4.4 Pola akumulator: total, rata-rata, terbesar, terkecil

Hampir semua ringkasan data dibuat dengan pola yang sama: siapkan sebuah variabel penampung, lalu perbarui isinya di setiap putaran.

```slak
const omzetHarian = [1250000, 980000, 1430000, 1100000, 1675000, 2010000, 1890000]

let total = 0
let terbesar = omzetHarian[0]
let terkecil = omzetHarian[0]

for (const x of omzetHarian) {
  total += x
  if (x > terbesar) terbesar = x
  if (x < terkecil) terkecil = x
}

const rataRata = total / omzetHarian.length

sl.write(`Total seminggu: ${total}`)
sl.write(`Rata-rata per hari: ${rataRata}`)
sl.write(`Tertinggi: ${terbesar}, terendah: ${terkecil}`)
```

- `omzetHarian[0]` adalah isi pertama larik. Penghitungan posisi di JavaScript dimulai dari 0.
- `omzetHarian.length` adalah banyaknya isi larik.
- `total += x` sama dengan `total = total + x`.

Pola ini akan kamu temui terus. Di Bab 6 kamu belajar cara yang lebih singkat, dan di Bab 14 Slak Data mengerjakannya dalam satu perintah. Tetapi di baliknya, semuanya bekerja seperti kode di atas.

## 4.5 while

`while` mengulang selama syaratnya benar. Pakai bila kamu tidak tahu sejak awal berapa kali harus mengulang.

```slak
// Berapa bulan sampai tabungan mencapai 5 juta bila setiap bulan menabung 400 ribu
// dan saldo bertambah 0,5% per bulan?
let saldo = 0
let bulan = 0
while (saldo < 5000000) {
  saldo = saldo * 1.005 + 400000
  bulan++
}
sl.write(`Butuh ${bulan} bulan, saldo akhir ${Math.round(saldo)}`)
```

`Math.round` membulatkan angka ke bilangan bulat terdekat.

## 4.6 break dan continue

- `break` menghentikan perulangan seketika.
- `continue` melewati sisa putaran ini dan lanjut ke putaran berikutnya.

```slak
const stokGudang = [12, 0, 7, 0, 3, 25]
for (let i = 0; i < stokGudang.length; i++) {
  if (stokGudang[i] === 0) continue          // lewati rak kosong
  if (stokGudang[i] > 20) {
    sl.write(`Rak ${i} penuh, berhenti memeriksa.`)
    break
  }
  sl.write(`Rak ${i}: ${stokGudang[i]} barang`)
}
```

## 4.7 Perulangan tanpa akhir

Bila syarat perulangan tidak pernah menjadi salah, program berputar selamanya:

```slak tanpa-jalan lewati
let n = 0
while (n < 10) {
  sl.write(n)
  // lupa n++, jadi n selalu 0
}
```

Slak Studio menyisipkan pengaman ke setiap perulangan. Bila satu perulangan berjalan lebih dari 2,5 detik tanpa jeda, perulangan itu dihentikan dengan pesan yang menunjuk barisnya. Di browser biasa tidak ada pengaman seperti ini, jadi selalu periksa: **apakah ada baris yang membuat syaratnya suatu saat salah?**

## 4.8 Penggeser angka

Perulangan menjadi lebih menarik bila banyaknya putaran dipilih pengguna.

```slak
const n = sl.slider("Berapa bintang?", 1, 10, 3)
let bintang = ""
for (let i = 0; i < n; i++) bintang += "⭐"
sl.write(bintang)
```

> **API Slak baru**
> - `sl.slider(label, min, max, nilaiAwal, langkah)` mengembalikan angka yang dipilih. Urutan argumennya: label, nilai terkecil, nilai terbesar, nilai awal, lalu langkah (boleh dilewati).

> **Coba di playground**
> Ganti `"⭐"` dengan `":rocket: "`, lalu ubah batas slider menjadi 1 sampai 20.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Aplikasi membeku atau Studio menghentikan perulangan | Syarat tidak pernah salah | Pastikan penghitung berubah setiap putaran |
| Satu isi terakhir tidak ikut dihitung | Syarat `i < panjang - 1` | Pakai `i < larik.length` |
| `undefined` di akhir | Syarat `i <= larik.length` | Posisi terakhir adalah `length - 1`, jadi pakai `<` |
| Total selalu 0 | Variabel `total` dibuat di dalam perulangan | Buat penampung di luar perulangan |

## Latihan

**Latihan 4.1 (mudah).** Hitung jumlah semua bilangan dari 1 sampai 100 dengan `for`, simpan di `jumlah`.

```slak latihan
let jumlah = 0
// tulis perulangan di sini

sl.write(jumlah)
await sl.testing.test("1 + 2 + ... + 100 = 5050", () => sl.testing.expect(jumlah).toBe(5050))
```

**Latihan 4.2 (sedang).** Hitung berapa hari omzet di atas 1,5 juta, simpan di `hariRamai`.

```slak latihan
const omzet = [1250000, 980000, 1430000, 1100000, 1675000, 2010000, 1890000]
let hariRamai = 0
// tulis perulangan di sini

sl.write(hariRamai)
await sl.testing.test("ada 3 hari ramai", () => sl.testing.expect(hariRamai).toBe(3))
```

**Latihan 4.3 (tantangan).** Cari posisi (indeks) hari dengan omzet terendah, simpan di `posisiTerendah`.

```slak latihan
const omzet2 = [1250000, 980000, 1430000, 1100000, 1675000, 2010000, 1890000]
let posisiTerendah = -1
// tulis perulangan di sini

sl.write(posisiTerendah)
await sl.testing.test("hari terendah ada di indeks 1", () => sl.testing.expect(posisiTerendah).toBe(1))
```

## Mini-proyek: tabel perkalian

Ukuran tabel dipilih dengan slider. Tabelnya disusun sebagai teks Markdown dengan perulangan bersarang: satu perulangan untuk baris, satu lagi untuk kolom.

```slak
sl.title("Tabel Perkalian :abacus:")
const ukuran = sl.slider("Ukuran tabel", 2, 12, 5)

let kepala = "| × |"
let garis = "|---|"
for (let k = 1; k <= ukuran; k++) {
  kepala += ` ${k} |`
  garis += "---|"
}

let isi = ""
for (let b = 1; b <= ukuran; b++) {
  let baris = `| **${b}** |`
  for (let k = 1; k <= ukuran; k++) {
    baris += ` ${b * k} |`
  }
  isi += baris + "\n"
}

sl.markdown(kepala + "\n" + garis + "\n" + isi)
```

`"\n"` adalah tanda ganti baris di dalam teks. Markdown membutuhkan setiap baris tabel di baris tersendiri.
