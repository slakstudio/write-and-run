# Sebelum Mulai

Buku ini mengajarkan bahasa pemrograman JavaScript kepada orang yang belum pernah memprogram, lalu memakainya untuk menganalisis data sampai tingkat menengah. Semua contoh berjalan di browser dengan **Slak 1.9.1**, tanpa memasang server dan tanpa langkah build.

## Untuk siapa buku ini

- Kamu yang belum pernah menulis program sama sekali.
- Kamu yang ingin menjadi analis data dan butuh portofolio yang bisa dibuka siapa saja lewat tautan.
- Guru dan mahasiswa yang mencari bahan belajar pemrograman berbahasa Indonesia dengan hasil yang langsung terlihat.

Kamu tidak perlu menguasai matematika lanjut. Cukup penjumlahan, persen, dan rata-rata. Konsep statistik dijelaskan saat dipakai.

## Tiga tahap perjalanan

| Tahap | Bab | Setelah selesai kamu bisa |
|---|---|---|
| 1 · JavaScript Pemula | 1–10 | Menulis program kecil: variabel, percabangan, perulangan, fungsi, larik, objek, menangani galat, dan membuat aplikasi interaktif |
| 2 · Analis Data Pemula | 11–17 | Membaca, membersihkan, meringkas, dan menggambar data, lalu menerbitkan laporan interaktif pertamamu |
| 3 · Analis Data Menengah | 18–26 | Menggabungkan tabel, statistik, deret waktu, SQL, prakiraan, peta, merapikan kode, dan dasbor portofolio multi-halaman |

Baca berurutan. Setiap bab memakai yang sudah dipelajari di bab sebelumnya.

## Judul buku ini

**Write and Run** adalah filosofi resmi Slak: tulis kode, jalankan, langsung lihat hasilnya. Tidak ada terminal, tidak ada menunggu kompilasi. Begitulah kamu akan belajar di setiap halaman buku ini.

## Cara membaca setiap bab

Setiap bab punya susunan yang sama:

1. **Tujuan belajar**: kemampuan yang kamu kuasai setelah bab selesai.
2. **Penjelasan konsep**: singkat, dengan contoh sehari-hari.
3. **Kode dan hasilnya**: di edisi web, setiap contoh langsung dijalankan dan hasilnya tampil tepat di bawah kodenya.
4. **Kotak "API Slak baru"**: muncul saat sebuah fungsi Slak dipakai pertama kali.
5. **Kotak "Coba di playground"**: eksperimen kecil untuk kamu ubah sendiri.
6. **Kesalahan umum**: galat yang sering muncul dan cara membacanya.
7. **Latihan**: tiga tingkat, yaitu mudah, sedang, dan tantangan.
8. **Mini-proyek**: aplikasi kecil yang menggabungkan isi bab.

> **Kotak "Fitur eksperimental"** hanya dipakai untuk fungsi yang di daftar API stabil Slak 1.9 masih berlabel eksperimental. Saat ini hanya satu: `sl.worker` (Bab 12). Cara pakainya boleh berubah sebelum Slak 2.0.

## Latihan yang memeriksa dirinya sendiri

Kode awal setiap latihan sudah berisi uji otomatis dengan `sl.testing`, fitur bawaan Slak 1.9.1. Saat kamu menjalankannya, setiap uji tampil sebagai kotak hijau (lulus) atau merah (belum lulus) beserta alasannya. Tugasmu: ubah kodenya sampai semua kotak hijau.

Di edisi web, setiap contoh dan latihan punya tautan **Buka di Playground**. Tautan itu membuka kodenya di playground resmi `https://slak.studio/playground/`, siap kamu ubah. Jawaban latihan ada di Lampiran D.

## Bahan buku

Folder bahan buku berisi dataset fiktif **Toko Nusantara**, jaringan toko oleh-oleh dengan sepuluh cabang dari Jayapura sampai Jakarta. Dataset ini dipakai mulai Tahap 2. Isinya dijelaskan di Lampiran E.

| Berkas | Isi |
|---|---|
| `toko-nusantara.csv` | 2.929 transaksi 2023–2024 yang sudah bersih |
| `toko-nusantara-kotor.csv` | 394 transaksi yang sengaja berantakan, untuk Bab 13 |
| `produk.csv` | 20 produk beserta harga pokok dan pemasok |
| `cabang.csv` | 10 cabang beserta kota, provinsi, dan koordinat |
| `target.csv` | Target omzet bulanan setiap cabang |
| `toko-nusantara-besar.csv` | Sekitar 250 ribu transaksi (29 MB), diunduh terpisah untuk Bab 12 dan Bab 21 |

Setiap berkas `.csv` punya pasangan `.csv.js` (data yang sudah dibungkus). Pasangan itu membuat contoh tetap jalan saat halaman buku dibuka dengan klik dua kali, tanpa internet.

## Konvensi penulisan

- Kode ditulis tanpa titik koma di akhir baris, dengan tanda kutip ganda, sama seperti Buku Panduan Slak.
- Istilah yang dipakai: **larik** (array), **objek**, **galat** (error), **jalan ulang** (rerun), **pratinjau** (preview).
- Nama fungsi Slak selalu memakai awalan `sl.` dan sesuai daftar API stabil Slak 1.9.1.
- Fungsi yang butuh berkas di luar `slak.js` selalu disertai baris `<script>` yang perlu dimuat. Fungsi yang butuh internet diberi tanda **butuh internet**.
