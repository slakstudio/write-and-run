# Bab 3 · Operator dan Percabangan

> **Tujuan belajar**
> - Membandingkan nilai dengan `===`, `!==`, `<`, `>`, `<=`, `>=`.
> - Menggabungkan syarat dengan `&&`, `||`, dan `!`.
> - Membuat program memilih jalan dengan `if`, `else if`, `else`, `switch`, dan operator ternary.
> - Menerima masukan pengguna lewat widget Slak.

## 3.1 Perbandingan menghasilkan boolean

Setiap perbandingan menghasilkan `true` atau `false`.

```slak
const nilai = 78
sl.write(nilai > 75)     // lebih besar
sl.write(nilai <= 60)    // lebih kecil atau sama dengan
sl.write(nilai === 78)   // sama persis
sl.write(nilai !== 100)  // tidak sama
```

### Mengapa tiga tanda sama dengan?

JavaScript punya dua cara membandingkan:

```slak
sl.write(5 == "5")    // true: tipenya diam-diam diubah dulu
sl.write(5 === "5")   // false: angka dan teks tidak sama
sl.write(0 == "")     // true, mengejutkan
sl.write(0 === "")    // false
```

`==` mengubah tipe data sebelum membandingkan, sehingga hasilnya sering mengejutkan. `===` baru bernilai `true` bila nilai **dan** tipenya sama persis. **Selalu pakai `===` dan `!==`.**

Ingat juga: `=` (satu) berarti *mengisi*, sedangkan `===` (tiga) berarti *membandingkan*.

## 3.2 Menggabungkan syarat

| Operator | Arti | Contoh | Hasil |
|---|---|---|---|
| `&&` | dan: keduanya harus benar | `nilai >= 75 && hadir >= 80` | `true` bila kedua syarat terpenuhi |
| `\|\|` | atau: salah satu cukup | `kota === "Sorong" \|\| kota === "Manokwari"` | `true` bila salah satu cocok |
| `!` | bukan | `!lunas` | kebalikan dari `lunas` |

```slak
const nilaiUjian = 82
const kehadiran = 76
sl.write(nilaiUjian >= 75 && kehadiran >= 80)   // false: kehadiran kurang
sl.write(nilaiUjian >= 75 || kehadiran >= 80)   // true: nilainya cukup
```

## 3.3 if, else if, else

`if` menjalankan sebuah blok kode hanya bila syaratnya benar.

```slak
const saldo = 120000
const harga = 150000

if (saldo >= harga) {
  sl.success("Pembayaran berhasil")
} else {
  sl.error(`Saldo kurang Rp ${harga - saldo}`)
}
```

Untuk lebih dari dua kemungkinan, sambung dengan `else if`. Syarat diperiksa dari atas ke bawah, dan yang pertama benar yang dijalankan.

```slak
const suhu = 31
if (suhu >= 35) {
  sl.error("Sangat panas")
} else if (suhu >= 30) {
  sl.warning("Panas")
} else if (suhu >= 20) {
  sl.info("Sejuk")
} else {
  sl.info("Dingin")
}
```

> **API Slak baru**
> - `sl.success(teks)`, `sl.info(teks)`, `sl.warning(teks)`, `sl.error(teks)` menampilkan kotak pesan hijau, biru, kuning, dan merah.

## 3.4 Menerima masukan pengguna

Sejauh ini nilai ditulis langsung di kode. Aplikasi sungguhan meminta nilai dari pengguna. Di Slak, **widget mengembalikan nilainya** seperti fungsi biasa:

```slak
const namaPembeli = sl.text_input("Nama pembeli")
const jumlahBeli = sl.number_input("Jumlah barang", { min: 0, value: 1, step: 1 })

if (namaPembeli === "") {
  sl.info("Isi nama pembeli dulu.")
} else {
  sl.write(`${namaPembeli} membeli ${jumlahBeli} barang.`)
}
```

Ketik nama, tekan Enter, lalu ubah jumlahnya. Setiap kali kamu mengubah widget, **seluruh program dijalankan ulang dari atas** dengan nilai baru. Itulah cara Slak bekerja, dan kamu akan memahaminya lebih dalam di Bab 10.

Tombol bekerja dengan cara yang sama: `sl.button` bernilai `true` hanya sekali, tepat setelah diklik.

```slak
if (sl.button("Sapa aku")) {
  sl.success("Halo! Semangat belajar :senyum:")
}
```

> **API Slak baru**
> - `sl.text_input(label, nilaiAwal)` mengembalikan teks. Nilainya dipakai setelah kamu menekan Enter atau pindah ke kotak lain.
> - `sl.number_input(label, { min, max, value, step })` mengembalikan angka.
> - `sl.button(label)` mengembalikan `true` pada satu jalan ulang setelah diklik, lalu `false` lagi.

## 3.5 switch

Bila kamu membandingkan satu nilai dengan banyak pilihan pasti, `switch` lebih rapi daripada deretan `else if`.

```slak
const kodeCabang = "SOQ"
let namaKota
switch (kodeCabang) {
  case "JYP": namaKota = "Jayapura"; break
  case "SOQ": namaKota = "Sorong"; break
  case "MKW": namaKota = "Manokwari"; break
  default: namaKota = "Tidak dikenal"
}
sl.write(namaKota)
```

Jangan lupa `break` di setiap `case`. Tanpa `break`, program terus menjalankan `case` berikutnya. Di sini titik koma dipakai karena dua perintah ditulis di satu baris.

## 3.6 Operator ternary

Untuk memilih satu dari dua nilai, ada bentuk singkat `syarat ? nilaiBilaBenar : nilaiBilaSalah`.

```slak
const totalBelanja = 260000
const ongkir = totalBelanja >= 250000 ? 0 : 15000
sl.write(`Ongkos kirim: Rp ${ongkir}`)
```

Pakai ternary hanya untuk pilihan sederhana. Bila logikanya panjang, `if` lebih mudah dibaca.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Syarat selalu benar | Menulis `if (x = 5)` | Pakai `===` untuk membandingkan |
| `Assignment to constant variable` di dalam `if` | `=` yang seharusnya `===` pada variabel `const` | Ganti dengan `===` |
| Semua cabang `switch` ikut jalan | Lupa `break` | Tambahkan `break` di setiap `case` |
| `else if` yang benar tidak pernah jalan | Syarat yang lebih luas ditulis lebih dulu | Urutkan dari syarat paling sempit atau paling tinggi |

## Latihan

**Latihan 3.1 (mudah).** Lengkapi fungsi `lulus(nilai)` agar mengembalikan `"Lulus"` bila nilai 75 ke atas dan `"Belum lulus"` bila kurang dari 75. Fungsi dibahas di Bab 5; untuk sekarang cukup isi bagian `if`.

```slak latihan
function lulus(nilai) {
  // tulis if di sini
  return ""
}

await sl.testing.test("80 lulus", () => sl.testing.expect(lulus(80)).toBe("Lulus"))
await sl.testing.test("75 lulus", () => sl.testing.expect(lulus(75)).toBe("Lulus"))
await sl.testing.test("74 belum lulus", () => sl.testing.expect(lulus(74)).toBe("Belum lulus"))
```

**Latihan 3.2 (sedang).** Toko Nusantara memberi diskon 10% untuk belanja minimal Rp 500.000 **atau** bila pembeli adalah anggota. Lengkapi `diskon(total, anggota)` agar mengembalikan besar diskon dalam rupiah.

```slak latihan
function diskon(total, anggota) {
  return 0
}

await sl.testing.test("600 ribu, bukan anggota", () => sl.testing.expect(diskon(600000, false)).toBe(60000))
await sl.testing.test("200 ribu, anggota", () => sl.testing.expect(diskon(200000, true)).toBe(20000))
await sl.testing.test("200 ribu, bukan anggota", () => sl.testing.expect(diskon(200000, false)).toBe(0))
```

**Latihan 3.3 (tantangan).** Tahun kabisat habis dibagi 4, kecuali tahun yang habis dibagi 100; tahun yang habis dibagi 400 tetap kabisat. Lengkapi `kabisat(tahun)`. Petunjuk: operator sisa bagi `%`.

```slak latihan
function kabisat(tahun) {
  return false
}

await sl.testing.test("2024 kabisat", () => sl.testing.expect(kabisat(2024)).toBe(true))
await sl.testing.test("2023 bukan", () => sl.testing.expect(kabisat(2023)).toBe(false))
await sl.testing.test("1900 bukan", () => sl.testing.expect(kabisat(1900)).toBe(false))
await sl.testing.test("2000 kabisat", () => sl.testing.expect(kabisat(2000)).toBe(true))
```

## Mini-proyek: kalkulator nilai rapor

Pengguna mengisi tiga nilai. Program menghitung rata-rata, lalu menentukan predikat A sampai E.

```slak
sl.title("Kalkulator Nilai Rapor :memo:")

const tugas = sl.number_input("Nilai tugas", { min: 0, max: 100, value: 80 })
const uts = sl.number_input("Nilai UTS", { min: 0, max: 100, value: 75 })
const uas = sl.number_input("Nilai UAS", { min: 0, max: 100, value: 70 })

const rata = (tugas + uts + uas) / 3

let predikat
if (rata >= 85) predikat = "A"
else if (rata >= 75) predikat = "B"
else if (rata >= 65) predikat = "C"
else if (rata >= 50) predikat = "D"
else predikat = "E"

sl.write(`Rata-rata: **${rata.toFixed(1)}**, predikat **${predikat}**`)

if (predikat === "A" || predikat === "B") {
  sl.success("Hebat, pertahankan!")
} else if (predikat === "C") {
  sl.info("Sudah cukup, masih bisa ditingkatkan.")
} else {
  sl.warning("Ayo belajar lebih giat lagi.")
}
```

Bila isi `if` hanya satu baris, kurung kurawal boleh ditiadakan seperti pada bagian predikat. `rata.toFixed(1)` membulatkan angka menjadi satu desimal untuk ditampilkan.
