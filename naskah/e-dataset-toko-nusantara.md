# Lampiran E · Dataset Toko Nusantara

**Toko Nusantara** adalah jaringan toko oleh-oleh **fiktif** dengan sepuluh cabang dari Jakarta sampai Jayapura. Semua datanya dibuat dengan program, dengan pola yang mirip data nyata: omzet tumbuh dari tahun ke tahun, ramai menjelang Lebaran dan akhir tahun, lebih ramai di akhir pekan, dan kanal online yang porsinya terus naik. Nama pelanggan tidak ada; setiap pelanggan hanya punya kode. Dataset ini bebas dipakai untuk belajar dan untuk portofolio, asalkan disebut sebagai data fiktif.

## Berkas

| Berkas | Baris | Dipakai di |
|---|---|---|
| `toko-nusantara.csv` | 2.929 | Bab 11–25 |
| `toko-nusantara-kotor.csv` | 394 | Bab 13–14 |
| `produk.csv` | 20 | Bab 18, 21, 25 |
| `cabang.csv` | 10 | Bab 11, 18, 23, 25 |
| `target.csv` | 240 | Bab 18, 25 |
| `toko-nusantara-besar.csv` | 250.006 (29 MB) | Bab 12, 21 (diunduh terpisah) |

Setiap berkas kecil punya pasangan `.csv.js` (data yang dibungkus), supaya `sl.read_csv` tetap jalan saat halaman dibuka dengan klik dua kali. Bila kamu menyalin datanya ke proyekmu sendiri, salin kedua berkasnya ke folder yang sama dengan halamanmu.

## toko-nusantara.csv

Satu baris adalah satu transaksi, 1 Januari 2023 sampai 31 Desember 2024, dari 631 pelanggan.

| Kolom | Tipe | Contoh | Keterangan |
|---|---|---|---|
| `id_transaksi` | teks | `TN000001` | Unik untuk setiap baris |
| `tanggal` | tanggal | `2023-01-01` | Format ISO |
| `pelanggan_id` | teks | `P0039` | Pelanggan bisa belanja di beberapa cabang |
| `cabang` | teks | `Nusantara Surabaya` | Sepuluh cabang |
| `kota` | teks | `Surabaya` | |
| `provinsi` | teks | `Jawa Timur` | Nama 38 provinsi terbaru |
| `kanal` | teks | `Toko` / `Online` | |
| `kategori` | teks | `Minuman` | Minuman, Makanan, Kerajinan, Kebutuhan Rumah, Pakaian |
| `produk` | teks | `Kopi Arabika Wamena 250g` | 20 produk |
| `jumlah` | bilangan bulat | `2` | Banyak barang |
| `harga` | bilangan bulat | `85000` | Harga satuan; naik sekitar 5% di 2024 |
| `diskon_persen` | bilangan bulat | `0` / `10` | Diskon 10% di sebagian transaksi menjelang Lebaran |
| `total` | bilangan bulat | `170000` | `jumlah × harga` setelah diskon |

## toko-nusantara-kotor.csv

Sebagian transaksi tahun 2024 dari Jayapura, Makassar, dan Surabaya, yang sengaja dibuat berantakan seperti data dari banyak kasir:

| Masalah | Contoh |
|---|---|
| Tanggal tiga format | `2024-02-14`, `14/02/2024`, `14 Februari 2024` |
| Nama kota tidak seragam | `jayapura`, ` JAYAPURA`, `Jayapra`, `Makasar`, `Surabya` |
| Harga sebagian berupa teks | `Rp 42.000` |
| Spasi dan huruf besar-kecil | `  GELANG MANIK PAPUA`, `sabun sereh wangi ` |
| Nilai kosong | Kolom `jumlah` dan `kanal` |
| Transaksi ganda | 14 `id_transaksi` muncul dua kali |
| Pencilan salah ketik | `jumlah` 250 |

Kolomnya: `id_transaksi`, `tanggal`, `kota`, `kanal`, `kategori`, `produk`, `jumlah`, `harga`.

## produk.csv

| Kolom | Keterangan |
|---|---|
| `produk` | Nama produk; kunci untuk digabung dengan transaksi |
| `kategori` | Kategori produk |
| `harga_jual` | Harga jual 2023 |
| `harga_pokok` | Harga beli dari pemasok |
| `pemasok` | Sembilan pemasok, misalnya Koperasi Baliem dan Sanggar Noken Abepura |

## cabang.csv

| Kolom | Keterangan |
|---|---|
| `kode` | Kode tiga huruf, misalnya `JYP` |
| `cabang` | Nama cabang; kunci untuk digabung dengan transaksi |
| `kota`, `provinsi` | Lokasi |
| `lat`, `lon` | Koordinat kota |
| `tanggal_buka` | Tanggal cabang mulai beroperasi |

## target.csv

Target omzet bulanan setiap cabang, 2023–2024. Kuncinya dua kolom: `cabang` dan `bulan` (teks `YYYY-MM`). Kolom `target` dalam rupiah.

## toko-nusantara-besar.csv

Kolom sama dengan `toko-nusantara.csv`, tetapi berisi sekitar 250 ribu transaksi dari 20.000 pelanggan. Dipakai untuk merasakan pembaca CSV di Web Worker (Bab 12) dan DuckDB (Bab 21). Berkas ini tidak dibungkus menjadi `.csv.js` karena terlalu besar; buka lewat Slak Studio, hosting, atau pilih berkasnya saat diminta.

## Dataset bawaan Slak yang dipakai

Selain Toko Nusantara, buku ini memakai dataset bawaan `slak-data.js` (selalu tersedia tanpa berkas):

| Nama | Isi | Dipakai di |
|---|---|---|
| `penjualan` | 3.278 transaksi toko di Papua 2023–2024 | Bab 7, 12 |
| `penjualan_bulanan` | Omzet bulanan 2019–2024 | Bab 20 |
| `karyawan` | 300 karyawan dan gajinya | Bab 19, 22 |
| `ab_test` | Eksperimen checkout, 4.000 pengunjung | Bab 19 |
| `pelanggan` | 1.000 pelanggan dan status churn | Bab 22 |

## Cara membuat ulang

Dataset dibuat dengan skrip `buat_data.py` di folder bahan buku, dengan benih acak tetap, sehingga angkanya selalu sama dengan yang tertulis di buku.
