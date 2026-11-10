# Bab 2 · Nilai, Variabel, dan Tipe Data

> **Tujuan belajar**
> - Menyimpan nilai di variabel dengan `let` dan `const`.
> - Mengenal tiga tipe data dasar: angka, teks, dan boolean.
> - Memahami nilai kosong `null`, `undefined`, dan `NaN`, yang sering muncul di data nyata.
> - Memeriksa dan mengubah tipe data.
> - Mempercantik teks dengan Markdown, warna, dan emoji.

## 2.1 Variabel adalah kotak berlabel

Bayangkan sebuah kotak dengan label di luarnya. Kamu menaruh sesuatu di dalamnya, lalu memanggilnya lewat labelnya. Itulah **variabel**.

```slak
const namaToko = "Toko Nusantara"
let jumlahCabang = 10

sl.write(namaToko)
sl.write(jumlahCabang)
```

Ada dua cara membuat variabel:

| Kata kunci | Arti | Kapan dipakai |
|---|---|---|
| `const` | Isinya tidak boleh diganti | Pilihan utama. Pakai ini kecuali kamu memang perlu mengganti isinya |
| `let` | Isinya boleh diganti | Untuk nilai yang berubah, misalnya penghitung |

```slak
let stok = 50
stok = stok - 3      // terjual 3
stok = stok + 20     // datang barang baru
sl.write("Stok sekarang: " + stok)
```

Tanda `=` di JavaScript berarti **mengisi**, bukan "sama dengan". Baris `stok = stok - 3` artinya "ambil isi `stok`, kurangi 3, lalu masukkan hasilnya kembali ke `stok`".

Teks setelah `//` adalah **komentar**. Komentar diabaikan komputer dan hanya ditulis untuk manusia yang membaca kode.

### Aturan memberi nama

- Boleh huruf, angka, `_`, dan `$`, tetapi tidak boleh diawali angka: `harga2` boleh, `2harga` tidak.
- Tidak boleh ada spasi. Untuk nama dari beberapa kata, tulis kata berikutnya diawali huruf besar: `hargaSatuan`, `jumlahCabang`. Gaya ini disebut *camelCase*.
- Huruf besar dan kecil dibedakan: `stok` dan `Stok` adalah dua variabel berbeda.
- Pilih nama yang menjelaskan isinya. `totalBelanja` jauh lebih jelas daripada `x`.

## 2.2 Tiga tipe data dasar

Setiap nilai punya **tipe**. Tipe menentukan apa yang bisa dilakukan terhadap nilai itu.

| Tipe | Contoh | Keterangan |
|---|---|---|
| number (angka) | `25000`, `3.5`, `-7` | Desimal memakai titik, bukan koma |
| string (teks) | `"Jayapura"`, `'kopi'` | Diapit tanda kutip ganda atau tunggal |
| boolean | `true`, `false` | Hanya dua nilai: benar atau salah |

```slak
const harga = 85000          // number
const produk = "Kopi Wamena" // string
const tersedia = true        // boolean

sl.write(typeof harga)
sl.write(typeof produk)
sl.write(typeof tersedia)
```

`typeof` memberi tahu tipe sebuah nilai. Gunakan saat kamu ragu.

### Angka

```slak
const a = 10
const b = 3
sl.write(a + b)   // tambah
sl.write(a - b)   // kurang
sl.write(a * b)   // kali
sl.write(a / b)   // bagi
sl.write(a % b)   // sisa bagi: 10 dibagi 3 sisanya 1
sl.write(a ** 2)  // pangkat
```

Saat menampilkan angka, `sl.write` memakai gaya Indonesia: titik untuk ribuan dan koma untuk desimal. Jadi `10 / 3` tampil `3,3333` (dibulatkan empat desimal), dan `25000` tampil `25.000`. Nilainya sendiri tidak berubah; hanya tampilannya yang diatur. Angka yang disambung ke dalam teks, misalnya `"Total: " + 25000`, tampil apa adanya.

Satu keanehan yang perlu kamu tahu sejak awal:

```slak
sl.write(String(0.1 + 0.2))
sl.write(0.1 + 0.2 === 0.3)
```

`String(...)` mengubah angka menjadi teks supaya tampil apa adanya, tanpa pembulatan tampilan. Hasilnya `0.30000000000000004`, bukan `0.3`, sehingga perbandingan di baris kedua bernilai `false`. Komputer menyimpan pecahan dalam bentuk biner, sehingga beberapa pecahan tidak bisa disimpan tepat. Untuk uang, hitung dalam rupiah bulat. Untuk menampilkan, bulatkan (Bab 8).

### Teks

Teks bisa disambung dengan `+`:

```slak
const kota = "Jayapura"
sl.write("Cabang " + kota + " buka pukul 08.00")
```

Cara yang lebih rapi adalah **template literal**: teks diapit tanda backtick `` ` `` dan nilai disisipkan dengan `${...}`.

```slak
const kotaCabang = "Sorong"
const jam = 8
sl.write(`Cabang ${kotaCabang} buka pukul ${jam}.00`)
```

Di dalam `${...}` boleh ada perhitungan, misalnya `` `Total: ${3 * 25000}` ``.

## 2.3 Nilai kosong: null, undefined, dan NaN

Data nyata hampir selalu punya lubang: sel yang lupa diisi, harga yang ditulis sebagai teks, kolom yang hilang. JavaScript punya tiga cara menyatakan "tidak ada":

| Nilai | Arti | Contoh muncul |
|---|---|---|
| `undefined` | Belum pernah diisi | Variabel dibuat tanpa nilai: `let x` |
| `null` | Sengaja dikosongkan | Sel kosong di CSV sering dibaca menjadi `null` |
| `NaN` | *Not a Number*, hasil hitungan yang gagal | `Number("Rp 5.000")` |

```slak
let belumDiisi
const sengajaKosong = null
const gagal = Number("Rp 5.000")

sl.write(belumDiisi)
sl.write(sengajaKosong)
sl.write(gagal)
sl.write(gagal + 1000)   // NaN menular ke hitungan berikutnya
```

Perhatikan baris terakhir: sekali sebuah nilai menjadi `NaN`, semua hitungan yang memakainya ikut menjadi `NaN`. Inilah sebabnya analis data selalu memeriksa nilai kosong lebih dulu. Kamu akan membersihkannya di Bab 13.

Untuk memeriksa `NaN`, gunakan `Number.isNaN(x)`. Membandingkan `x === NaN` selalu menghasilkan `false`, bahkan bila `x` memang `NaN`.

## 2.4 Mengubah tipe

```slak
const dariTeks = Number("1250")
const keTeks = String(1250)
const desimal = parseFloat("3.75 kg")
const bulat = parseInt("12 buah")

sl.write(dariTeks + 50)    // 1300: angka ditambah angka
sl.write(keTeks + 50)      // "125050": teks disambung teks
sl.write(desimal)
sl.write(bulat)
```

`Number()` menolak teks yang tidak murni angka dan memberi `NaN`. `parseFloat()` dan `parseInt()` membaca angka di awal teks lalu berhenti di huruf pertama.

Baris kedua menunjukkan jebakan yang sering terjadi: `+` antara teks dan angka **menyambung**, bukan menjumlah. Bila hasil penjumlahanmu tampak aneh, periksa dulu apakah salah satu nilainya teks.

## 2.5 sl.write atau console.log?

| | `sl.write(x)` | `console.log(x)` |
|---|---|---|
| Tampil di | Halaman aplikasi | Konsol (Slak Studio) atau DevTools browser (F12) |
| Untuk | Pengguna aplikasimu | Kamu sendiri, saat memeriksa isi variabel |

Gunakan `sl.write` untuk hasil yang ingin dilihat pengguna, dan `console.log` untuk mengintip isi variabel saat mencari kesalahan (Bab 9).

## 2.6 Mempercantik teks

```slak
sl.markdown("Teks **tebal**, *miring*, dan `kode`.")
sl.markdown("Omzet naik :green[12%], biaya naik :red[3%].")
sl.markdown("Laporan bulanan :bar_chart: dari cabang Jayapura :jempol:")
sl.text("sl.text menampilkan teks apa adanya, **tanpa** Markdown.")
```

> **API Slak baru**
> - `sl.markdown(teks)` menampilkan teks berformat Markdown: tebal, miring, daftar, tabel, tautan, dan warna `:green[...]`, `:red[...]`, `:blue[...]`, `:orange[...]`, `:violet[...]`, `:gray[...]`.
> - `sl.text(teks)` menampilkan teks persis seperti ditulis.
> - Nama emoji ditulis di antara titik dua. Slak mengenal semua nama emoji Streamlit, misalnya `:bar_chart:` dan `:rocket:`, ditambah nama berbahasa Indonesia seperti `:jempol:`, `:senyum:`, dan `:kantung_uang:`.

Mau mencari nama emoji? `sl.emoji.search("uang")` mengembalikan daftar nama yang cocok.

```slak
sl.write(sl.emoji.search("uang").slice(0, 5))
```

> **Coba di playground**
> Ubah `:green[12%]` menjadi `:orange[12%]`, lalu coba emoji `:rocket:` dan `:senyum:`.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `Assignment to constant variable` | Mengganti isi variabel `const` | Pakai `let` bila isinya memang berubah |
| `stok is not defined` | Salah ketik nama, atau beda huruf besar-kecil | Samakan persis dengan nama saat dibuat |
| Hasil `"10050"` padahal ingin `150` | Salah satu nilai berupa teks | Ubah dengan `Number(...)` |
| Hasil `NaN` | Teks seperti `"Rp 5.000"` diubah ke angka | Buang dulu `Rp` dan titiknya (Bab 8) |

## Latihan

**Latihan 2.1 (mudah).** Buat variabel `const` bernama `produk` berisi `"Sagu Lempeng 1kg"` dan variabel `harga` berisi `30000`. Tampilkan kalimat `Sagu Lempeng 1kg harganya 30000` dengan template literal.

```slak latihan
// buat variabel produk dan harga di sini

const kalimat = ""   // ganti dengan template literal
sl.write(kalimat)

await sl.testing.test("kalimat benar", () => sl.testing.expect(kalimat).toBe("Sagu Lempeng 1kg harganya 30000"))
```

**Latihan 2.2 (sedang).** Data dari formulir selalu berupa teks. Ubah `jumlahTeks` dan `hargaTeks` menjadi angka, lalu hitung `total`.

```slak latihan
const jumlahTeks = "4"
const hargaTeks = "22000"
const total = jumlahTeks * hargaTeks + ""   // perbaiki baris ini

sl.write(total)
await sl.testing.test("total berupa angka", () => sl.testing.expect(typeof total).toBe("number"))
await sl.testing.test("total = 88000", () => sl.testing.expect(total).toBe(88000))
```

**Latihan 2.3 (tantangan).** Variabel `isian` berisi teks dari pengguna. Buat variabel `sah` yang bernilai `true` bila `isian` bisa diubah menjadi angka, dan `false` bila tidak. Petunjuk: `Number.isNaN`.

```slak latihan
const isian = "12a"
const sah = true   // ganti dengan pemeriksaan yang benar

sl.write(sah)
await sl.testing.test('"12a" bukan angka', () => sl.testing.expect(sah).toBe(false))
```

## Mini-proyek: kartu data diri

Kumpulkan data dirimu di variabel, lalu tampilkan sebagai kartu yang rapi.

```slak
const nama = "Rina Wenda"
const kotaAsal = "Jayapura"
const tahunLahir = 2004
const sedangBelajar = true
const tahunSekarang = 2026

sl.title(`:wave: ${nama}`)
sl.markdown(`**Kota asal:** ${kotaAsal}`)
sl.markdown(`**Umur:** sekitar ${tahunSekarang - tahunLahir} tahun`)
sl.markdown(`**Sedang belajar JavaScript:** ${sedangBelajar ? ":green[ya]" : ":red[belum]"}`)
sl.markdown("Cita-cita: menjadi analis data :bar_chart:")
```

Tanda `? :` pada baris keempat memilih salah satu dari dua nilai. Kamu akan mempelajarinya di bab berikutnya.
