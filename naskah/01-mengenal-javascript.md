# Bab 1 · Mengenal JavaScript lewat Slak

> **Tujuan belajar**
> - Memahami apa itu program dan apa itu JavaScript.
> - Menjalankan kode pertamamu di playground, di Slak Studio, atau di satu berkas HTML.
> - Membedakan pekerjaan JavaScript dan pekerjaan Slak.
> - Membagikan kodemu lewat tautan.

## 1.1 Program itu resep

Program adalah daftar perintah yang dikerjakan komputer satu per satu, dari atas ke bawah, persis seperti resep masakan. Bahasa pemrograman adalah bahasa yang dipakai untuk menulis resep itu.

**JavaScript** adalah bahasa pemrograman yang dipahami setiap browser: Chrome, Edge, Firefox, dan Safari. Artinya, untuk belajar JavaScript kamu tidak perlu memasang apa pun. Browser di laptop atau ponselmu sudah cukup.

Biasanya, membuat tampilan di browser dengan JavaScript cukup rumit: kamu harus mengurus HTML, CSS, dan cara tombol bereaksi saat diklik. **Slak** mengurus semua itu untukmu. Kamu cukup menulis perintah seperti "tampilkan judul" atau "buat penggeser angka", dan Slak menggambarnya.

```slak
sl.title("Halo, dunia!")
sl.write("Ini program JavaScript pertamaku.")
```

Dua baris itu adalah program lengkap. Baris pertama menampilkan judul besar, baris kedua menampilkan kalimat biasa.

> **API Slak baru**
> - `sl.title(teks)` menampilkan judul besar di bagian atas.
> - `sl.write(nilai)` menampilkan apa saja: teks, angka, tabel, atau objek. Teks boleh memakai Markdown, misalnya `**tebal**`.

## 1.2 Write and Run

Filosofi Slak adalah **Write and Run**: tulis kode, jalankan, langsung lihat hasilnya. Tidak ada build, tidak ada `npm install`, tidak ada server. Inilah cara web dibuat pada masa awalnya, dan inilah cara kamu belajar di buku ini.

Ada tiga tempat untuk menjalankan kode Slak. Pilih yang paling mudah untukmu.

### Cara 1: playground (tanpa memasang apa pun)

Buka **https://slak.studio/playground/** di browser. Layarnya terbagi dua:

- **Kiri**: editor, tempat kamu menulis kode.
- **Kanan**: pratinjau, tempat hasilnya tampil.

Saat kotak **Jalankan otomatis** dicentang, hasil diperbarui setiap kali kamu berhenti mengetik. Kamu juga bisa menekan **Ctrl+Enter** atau tombol **Jalankan**. Daftar di kiri atas berisi contoh siap pakai. Kodemu disimpan otomatis di browser, jadi tidak hilang saat halaman ditutup.

Inilah cara tercepat untuk memulai. Semua contoh Tahap 1 bisa kamu coba di sini.

### Cara 2: Slak Studio (aplikasi desktop Windows)

Slak Studio adalah editor lengkap untuk Slak. Memasangnya cukup mengekstrak satu berkas zip:

1. Unduh `SlakStudio-1.9.1-Windows-x64.zip`.
2. Klik kanan berkas zip, pilih **Extract All…** (Ekstrak Semua), lalu pilih lokasi tetap, misalnya `Documents\Slak Studio`. Jangan menjalankan aplikasi dari dalam zip.
3. Buka folder hasil ekstrak, lalu klik dua kali **Slak Studio.exe**.
4. Jika muncul layar biru **Windows protected your PC**, klik **More info** (Info selengkapnya), lalu **Run anyway** (Tetap jalankan). Peringatan ini muncul karena aplikasinya belum bertanda tangan digital, dan hanya muncul pada pembukaan pertama.
5. Slak Studio terbuka dengan berkas `selamat-datang.slak` dan panel **Belajar** di kiri.

Kebutuhannya: Windows 10 atau 11 (64-bit), sekitar 370 MB ruang disk, dan 4 GB RAM atau lebih.

### Cara 3: satu berkas HTML

Tanpa playground dan tanpa Slak Studio pun Slak tetap jalan. Simpan `slak.js` (dari paket Slak 1.9.1) dan berkas berikut di satu folder:

```html
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Aplikasiku</title>
<script src="slak.js"></script>
</head>
<body>
<script type="text/slak">
sl.title("Halo, dunia!")
sl.write("Ini program JavaScript pertamaku.")
</script>
</body>
</html>
```

Beri nama `index.html`, lalu klik dua kali. Browser terbuka dan aplikasinya langsung jalan. Kode JavaScript-mu ditulis di dalam tag `<script type="text/slak">`.

## 1.3 Berkeliling Slak Studio

Kalau kamu memakai Slak Studio, kenali empat bagian ini dulu:

| Bagian | Fungsi |
|---|---|
| Editor | Tempat menulis kode, lengkap dengan nomor baris, pewarnaan, dan saran fungsi |
| Pratinjau | Aplikasimu yang sedang berjalan; bisa diklik dan diisi seperti aplikasi sungguhan |
| Konsol | Keluaran `console.log()`, galat, dan penjelasan galat dalam bahasa Indonesia |
| Panel samping | Berkas, **Belajar** (49 pelajaran), **Contoh**, **Referensi** (tekan **F1**), dan Pintasan |

Beberapa pintasan yang langsung berguna:

- **Ctrl+N**: berkas baru. **Ctrl+S**: simpan sebagai berkas `.slak`.
- **Ctrl+Enter**: jalankan. **Ctrl+Shift+Enter**: jalankan dari awal.
- **Ctrl+E**: ekspor menjadi satu berkas `.html` yang bisa dikirim ke siapa saja.

Slak Studio juga punya **mode sel**. Baris komentar `// %%` membagi kode menjadi beberapa sel. Saat kamu mengubah sel di bawah, sel di atasnya tidak dijalankan ulang, jadi mencoba kode sepotong demi sepotong terasa cepat. Tekan **Shift+Enter** untuk menjalankan sampai akhir sel tempat kursor berada. Di luar Slak Studio, baris `// %%` hanya dianggap komentar biasa.

```slak
// %% Judul
sl.title("Mode sel")

// %% Isi
sl.write("Sel ini bisa diubah tanpa menjalankan ulang sel di atasnya.")
```

## 1.4 Apa yang dikerjakan JavaScript, apa yang dikerjakan Slak

Setiap baris di buku ini adalah JavaScript asli. Bedanya, perintah yang diawali `sl.` adalah fungsi Slak.

| Dikerjakan JavaScript | Dikerjakan Slak |
|---|---|
| Menyimpan nilai di variabel | Menampilkan teks, tabel, dan grafik |
| Menghitung, membandingkan, mengulang | Membuat tombol, penggeser, kotak isian |
| Mengolah teks, tanggal, dan larik | Menjalankan ulang program saat pengguna berinteraksi |
| Memutuskan jalan mana yang diambil | Menyimpan data di browser, membaca berkas CSV |

```slak
const harga = 25000
const jumlah = 3
const total = harga * jumlah
sl.write("Total belanja: " + total)
```

Tiga baris pertama murni JavaScript: menyimpan dua angka, lalu mengalikannya. Baris terakhir memakai Slak untuk menampilkan hasilnya. Sepanjang buku, kamu akan belajar JavaScript lewat pola seperti ini: **hitung dengan JavaScript, tampilkan dengan Slak**.

## 1.5 Mengatur halaman

Judul tab browser dan ikon halaman diatur dengan `sl.set_page_config`. Panggil di baris paling atas.

```slak tanpa-jalan
sl.set_page_config({ page_title: "Perkenalan", page_icon: "👋" })
sl.title("Perkenalan")
```

> **API Slak baru**
> - `sl.set_page_config({ page_title, page_icon, layout })` mengatur judul tab, ikon, dan tata letak. `layout: "wide"` membuat konten lebih lebar.

Contoh ini ditandai *tidak dijalankan di halaman buku* karena akan mengganti judul halaman buku itu sendiri. Coba di playground.

## 1.6 Membagikan kodemu

Di playground, tombol **🔗 Bagikan** menyalin tautan yang berisi kodemu, misalnya `https://slak.studio/playground/#kode=K87R…`. Kodenya dimampatkan ke bagian setelah tanda `#`, jadi tidak dikirim ke server mana pun. Siapa pun yang membuka tautan itu melihat kode dan hasilnya. Di Slak Studio, pilih menu **Berkas › Salin tautan berbagi**.

Tautan yang sama bisa dibuat dari kode dengan `Slak.share.link`:

```slak
const kode = 'sl.title("Halo dari temanmu")'
const tautan = await Slak.share.link(kode, "https://slak.studio/playground/")
sl.write("Tautan berbagi:")
sl.code(tautan)
```

> **API Slak baru**
> - `Slak.share.link(kode, alamat)` membuat tautan playground yang berisi kode. Perhatikan awalannya `Slak.`, bukan `sl.`: ini fungsi milik Slak sebagai alat, bukan perintah untuk menampilkan sesuatu.
> - `sl.code(teks)` menampilkan teks sebagai kode.

Kata `await` di depan `Slak.share.link` artinya "tunggu sampai hasilnya siap". Kamu akan memahaminya di Bab 12.

> **Coba di playground**
> Ganti teks di dalam `sl.write` pada contoh 1.4, lalu ubah angka `harga` dan `jumlah`. Perhatikan totalnya berubah sendiri.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `sl is not defined` | Kode ditulis di `<script>` biasa, bukan `<script type="text/slak">` | Pakai `type="text/slak"` |
| Halaman kosong | `slak.js` tidak ada di folder yang sama | Salin `slak.js` ke folder halaman |
| `Unexpected string` | Tanda kutip tidak berpasangan, misalnya `"Halo` | Tutup dengan `"` |
| Fungsi sl.Title tidak ada | Huruf besar dan kecil berbeda di JavaScript | Tulis `sl.title`, huruf kecil semua |

## Latihan

**Latihan 1.1 (mudah).** Tampilkan judul berisi namamu dan satu kalimat tentang hobimu.

```slak latihan
sl.title("Ganti dengan namamu")
// Tulis satu kalimat tentang hobimu di bawah ini

```

**Latihan 1.2 (sedang).** Sebuah toko menjual buku seharga 45000 dan pena seharga 7500. Hitung total belanja 2 buku dan 3 pena di variabel `total`, lalu tampilkan. Uji di bawah memeriksa nilainya.

```slak latihan
const hargaBuku = 45000
const hargaPena = 7500
const total = 0   // ganti 0 dengan rumus yang benar
sl.write("Total: " + total)

await sl.testing.test("total belanja benar", () => sl.testing.expect(total).toBe(112500))
```

**Latihan 1.3 (tantangan).** Buat tautan playground untuk kode `sl.title("Kuis Ibu Kota")`, simpan di variabel `tautan`, lalu tampilkan dengan `sl.code`.

```slak latihan
let tautan = ""
// isi variabel tautan dengan Slak.share.link(...)

sl.code(tautan)
await sl.testing.test("tautan mengarah ke playground resmi", () => sl.testing.expect(tautan).toMatch("https://slak.studio/playground/#"))
```

## Mini-proyek: halaman perkenalan diri

Buat halaman perkenalan diri, lalu bagikan lewat tombol **Bagikan** di playground.

```slak
sl.title("Halo, saya Rina 👋")
sl.write("Saya sedang belajar **JavaScript** untuk menjadi analis data.")
sl.write("Kota asal: Jayapura")
sl.write("Hobi: membaca, bersepeda, dan mencoba resep baru.")

const tahunLahir = 2004
const tahunIni = 2026
sl.write("Umur saya sekitar " + (tahunIni - tahunLahir) + " tahun.")
```

Ganti isinya dengan dirimu sendiri. Setelah Bab 2, kamu bisa mempercantiknya dengan warna dan emoji.
