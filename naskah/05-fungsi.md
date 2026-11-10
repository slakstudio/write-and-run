# Bab 5 · Fungsi

> **Tujuan belajar**
> - Membuat dan memanggil fungsi, serta mengembalikan nilai dengan `return`.
> - Menulis fungsi panah (arrow function) dan parameter bawaan.
> - Memahami scope: variabel di dalam dan di luar fungsi.
> - Membuat fungsi statistik sendiri: `jumlah`, `rataRata`, `median`, dan `modus`.

## 5.1 Fungsi adalah resep yang diberi nama

Kalau sebuah hitungan dipakai berkali-kali, bungkus menjadi **fungsi**. Kamu menulisnya sekali, lalu memanggilnya kapan saja.

```slak
function hargaSetelahDiskon(harga, persen) {
  const potongan = harga * persen / 100
  return harga - potongan
}

sl.write(hargaSetelahDiskon(85000, 10))
sl.write(hargaSetelahDiskon(120000, 25))
```

| Bagian | Contoh | Arti |
|---|---|---|
| Nama | `hargaSetelahDiskon` | Dipakai saat memanggil |
| Parameter | `harga, persen` | Nilai yang diterima fungsi, seperti bahan resep |
| Isi | di antara `{ }` | Langkah-langkahnya |
| `return` | `return harga - potongan` | Hasil yang dikirim kembali ke pemanggil |

Saat dipanggil dengan `hargaSetelahDiskon(85000, 10)`, nilai `85000` masuk ke `harga` dan `10` masuk ke `persen`. Nilai yang dikirim saat memanggil disebut **argumen**.

`return` juga menghentikan fungsi. Baris setelah `return` tidak dijalankan. Fungsi tanpa `return` mengembalikan `undefined`.

## 5.2 Parameter bawaan

Parameter boleh diberi nilai bawaan, yang dipakai bila argumennya tidak dikirim.

```slak
function hargaJual(hargaPokok, margin = 30) {
  return Math.round(hargaPokok * (1 + margin / 100))
}
sl.write(hargaJual(50000))       // memakai margin 30
sl.write(hargaJual(50000, 45))   // memakai margin 45
```

## 5.3 Fungsi panah

JavaScript modern punya cara menulis fungsi yang lebih ringkas, yaitu **fungsi panah** (arrow function):

```slak
const pajak = (harga) => harga * 0.11
const keRibuan = (x) => Math.round(x / 1000) + " rb"

sl.write(pajak(200000))
sl.write(keRibuan(1250000))
```

Bila isinya hanya satu ekspresi, tidak perlu `{ }` dan `return`. Bila isinya beberapa baris, tulis lengkap:

```slak
const ongkir = (beratKg, kota) => {
  const tarif = kota === "Jayapura" ? 8000 : 15000
  return Math.ceil(beratKg) * tarif
}
sl.write(ongkir(2.3, "Sorong"))
```

`Math.ceil` membulatkan ke atas: 2,3 kg dihitung 3 kg. Pasangannya `Math.floor` membulatkan ke bawah.

Kedua bentuk fungsi sama-sama benar. Buku ini memakai `function` untuk fungsi yang panjang dan penting, dan fungsi panah untuk fungsi pendek, terutama di Bab 6 saat fungsi dikirim ke fungsi lain.

## 5.4 Scope: variabel punya wilayah

Variabel yang dibuat di dalam fungsi hanya hidup di dalam fungsi itu.

```slak
const kotaUtama = "Jayapura"   // di luar: bisa dibaca di mana saja

function sapa(nama) {
  const salam = "Selamat datang"   // di dalam: hanya ada di sini
  return `${salam}, ${nama}, di cabang ${kotaUtama}`
}

sl.write(sapa("Yohanes"))
sl.write(typeof salam)   // "undefined": salam tidak dikenal di luar fungsi
```

Aturan ini melindungi kodemu. Dua fungsi boleh sama-sama punya variabel bernama `total` tanpa saling mengganggu.

## 5.5 Fungsi statistik buatan sendiri

Analis data bekerja dengan ringkasan: jumlah, rata-rata, nilai tengah, nilai yang paling sering muncul. Mari menulisnya sendiri dengan JavaScript murni, supaya nanti kamu paham apa yang dikerjakan Slak Data di balik layar.

```slak
function jumlah(data) {
  let total = 0
  for (const x of data) total += x
  return total
}

function rataRata(data) {
  if (data.length === 0) return null
  return jumlah(data) / data.length
}

function median(data) {
  if (data.length === 0) return null
  const urut = [...data].sort((a, b) => a - b)
  const tengah = Math.floor(urut.length / 2)
  if (urut.length % 2 === 1) return urut[tengah]
  return (urut[tengah - 1] + urut[tengah]) / 2
}

function modus(data) {
  let terbaik = null
  let frekTerbaik = 0
  for (const x of data) {
    let frek = 0
    for (const y of data) if (y === x) frek++
    if (frek > frekTerbaik) {
      frekTerbaik = frek
      terbaik = x
    }
  }
  return terbaik
}

const jumlahBeli = [1, 2, 1, 3, 1, 5, 2, 1, 4, 2]
sl.write(`Jumlah: ${jumlah(jumlahBeli)}`)
sl.write(`Rata-rata: ${rataRata(jumlahBeli)}`)
sl.write(`Median: ${median(jumlahBeli)}`)
sl.write(`Modus: ${modus(jumlahBeli)}`)
```

Beberapa hal baru di `median`:

- `[...data]` membuat salinan larik, supaya larik aslinya tidak ikut berubah urutannya.
- `.sort((a, b) => a - b)` mengurutkan angka dari kecil ke besar. Fungsi panah di dalamnya memberi tahu cara membandingkan dua angka. Bab 6 menjelaskannya.

Perhatikan juga bahwa `rataRata` memanggil `jumlah`. Fungsi kecil yang benar bisa dirangkai menjadi fungsi yang lebih besar.

**Mengapa median penting?** Rata-rata mudah tertarik oleh nilai ekstrem. Bila sembilan pelanggan belanja Rp 50.000 dan satu pelanggan belanja Rp 5.000.000, rata-ratanya Rp 545.000, padahal hampir semua pelanggan belanja jauh lebih sedikit. Mediannya tetap Rp 50.000. Untuk data uang, analis hampir selalu melihat keduanya.

## 5.6 Fungsi dan widget

```slak
const satuan = sl.selectbox("Ubah ke", ["gram", "ons", "kilogram"])
const kg = sl.number_input("Berat (kg)", { min: 0, value: 1.5, step: 0.5 })

function dariKg(nilai, ke) {
  if (ke === "gram") return nilai * 1000
  if (ke === "ons") return nilai * 10
  return nilai
}

const [kiri, kanan] = sl.columns(2)
kiri.metric("Kilogram", kg)
kanan.metric(satuan, dariKg(kg, satuan))
```

> **API Slak baru**
> - `sl.selectbox(label, pilihan)` menampilkan daftar pilihan dan mengembalikan pilihan yang dipilih.
> - `sl.columns(n)` membagi baris menjadi `n` kolom dan mengembalikan larik kolom. Setiap kolom punya semua fungsi tampilan, misalnya `kiri.write(...)`.
> - `sl.metric(label, nilai)` menampilkan angka besar dengan label. Kamu akan sering memakainya untuk dasbor.

Baris `const [kiri, kanan] = sl.columns(2)` mengambil dua isi larik sekaligus ke dua variabel. Cara ini disebut *destructuring* dan dibahas di Bab 7.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Hasil fungsi `undefined` | Lupa `return` | Tambahkan `return hasil` |
| `hitung is not a function` | Memanggil sesuatu yang bukan fungsi, atau salah nama | Periksa nama fungsi dan tanda kurungnya |
| Fungsi panah multi-baris memberi `undefined` | Memakai `{ }` tetapi lupa `return` | Tambahkan `return`, atau buang `{ }` untuk satu ekspresi |
| Larik asli ikut berubah urutan | `data.sort(...)` mengurutkan di tempat | Salin dulu: `[...data].sort(...)` |

## Latihan

**Latihan 5.1 (mudah).** Lengkapi fungsi `luasPersegiPanjang(p, l)`.

```slak latihan
function luasPersegiPanjang(p, l) {

}

await sl.testing.test("4 × 5 = 20", () => sl.testing.expect(luasPersegiPanjang(4, 5)).toBe(20))
await sl.testing.test("2,5 × 2 = 5", () => sl.testing.expect(luasPersegiPanjang(2.5, 2)).toBe(5))
```

**Latihan 5.2 (sedang).** Tulis fungsi panah `rentang` yang mengembalikan selisih nilai terbesar dan terkecil sebuah larik. Petunjuk: `Math.max(...data)` dan `Math.min(...data)`.

```slak latihan
const rentang = (data) => 0

await sl.testing.test("rentang [3, 9, 4] = 6", () => sl.testing.expect(rentang([3, 9, 4])).toBe(6))
await sl.testing.test("rentang [5] = 0", () => sl.testing.expect(rentang([5])).toBe(0))
```

**Latihan 5.3 (tantangan).** Tulis fungsi `rataRataTerpangkas(data)` yang membuang satu nilai terbesar dan satu nilai terkecil, lalu menghitung rata-rata sisanya. Cara ini dipakai juri lomba agar satu nilai ekstrem tidak menentukan hasil.

```slak latihan
function rataRataTerpangkas(data) {
  return 0
}

await sl.testing.test("[7, 8, 9, 10, 2] → 8", () => sl.testing.expect(rataRataTerpangkas([7, 8, 9, 10, 2])).toBe(8))
await sl.testing.test("data asli tidak berubah", () => {
  const d = [5, 1, 9]
  rataRataTerpangkas(d)
  sl.testing.expect(d).toEqual([5, 1, 9])
})
```

## Mini-proyek: konverter satuan

```slak
sl.title("Konverter Satuan :straight_ruler:")

const jenis = sl.selectbox("Jenis", ["Suhu", "Panjang", "Mata uang"])

function celsiusKe(c, ke) {
  if (ke === "Fahrenheit") return c * 9 / 5 + 32
  if (ke === "Kelvin") return c + 273.15
  return c
}

function meterKe(m, ke) {
  const faktor = { Sentimeter: 100, Kilometer: 0.001, Kaki: 3.28084 }
  return m * faktor[ke]
}

function rupiahKe(rp, ke, kurs) {
  return rp / kurs[ke]
}

const [kiri, kanan] = sl.columns(2)

if (jenis === "Suhu") {
  const c = kiri.number_input("Celsius", { value: 30 })
  const ke = kanan.selectbox("Ke", ["Fahrenheit", "Kelvin"], { key: "ke_suhu" })
  sl.metric(ke, celsiusKe(c, ke).toFixed(1))
} else if (jenis === "Panjang") {
  const m = kiri.number_input("Meter", { value: 1500 })
  const ke = kanan.selectbox("Ke", ["Kilometer", "Sentimeter", "Kaki"], { key: "ke_panjang" })
  sl.metric(ke, meterKe(m, ke).toFixed(2))
} else {
  const kurs = { USD: 16200, SGD: 12100, AUD: 10500 }   // contoh kurs, bukan kurs hari ini
  const rp = kiri.number_input("Rupiah", { value: 1000000, step: 50000 })
  const ke = kanan.selectbox("Ke", Object.keys(kurs), { key: "ke_uang" })
  sl.metric(ke, rupiahKe(rp, ke, kurs).toFixed(2))
  sl.caption("Kurs contoh, bukan kurs hari ini.")
}
```

Tiga kotak pilihan "Ke" punya isi berbeda, jadi masing-masing diberi `key` sendiri. Slak mengenali widget dari jenis dan labelnya; `key` memberi identitas tetap sehingga pilihan di satu jenis tidak terbawa ke jenis lain. Bab 10 membahas `key` lebih jauh.

`faktor[ke]` dan `kurs[ke]` mengambil nilai dari objek berdasarkan nama. Objek dibahas di Bab 7.
