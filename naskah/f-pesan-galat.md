# Lampiran F · Daftar Pesan Galat Umum

Pesan galat JavaScript ditulis dalam bahasa Inggris. Slak Studio menambahkan penjelasan berbahasa Indonesia di konsol (baris 💡). Tabel ini mengumpulkan galat yang paling sering ditemui pembaca buku ini.

## Galat JavaScript

| Pesan | Artinya | Biasanya karena | Bab |
|---|---|---|---|
| `x is not defined` | Variabel `x` tidak dikenal | Salah ketik, beda huruf besar-kecil, atau dipakai di luar fungsinya | 2, 5, 9 |
| `Assignment to constant variable` | Mengisi ulang variabel `const` | Perlu `let`, atau `=` yang seharusnya `===` | 2, 3, 9 |
| `Cannot read properties of undefined (reading 'y')` | Membaca `sesuatu.y`, padahal `sesuatu` kosong | `find` tidak menemukan apa-apa, indeks di luar batas | 6, 7, 9 |
| `x.map is not a function` | `x` bukan larik | Data berupa objek, teks, atau DataFrame | 6, 9 |
| `x is not a function` | Memanggil sesuatu yang bukan fungsi | Salah nama, atau lupa tanda kurung | 5 |
| `Unexpected token` | Penulisan tidak sah | Kurung, kutip, atau koma tidak berpasangan | 1, 9 |
| `Unexpected end of input` | Kode berhenti di tengah | `{` atau `(` belum ditutup | 9 |
| `missing ) after argument list` | Kurung tutup hilang | Kurang `)` di pemanggilan fungsi | 9 |
| `Invalid Date` | Tanggal tidak terbaca | Format bukan ISO `YYYY-MM-DD` | 8 |
| `NaN` (bukan galat, tetapi hasil) | Hitungan gagal | Teks seperti `"Rp 5.000"` diubah ke angka | 2, 8, 13 |
| `Unexpected token ... in JSON` | Teks bukan JSON sah | Kutip tunggal, koma di akhir | 9, 11 |
| `await is only valid in async functions` | `await` di fungsi biasa | Tandai fungsinya `async` | 12 |
| `[object Promise]` di layar | Nilai belum ditunggu | Lupa `await` | 12 |
| `Failed to fetch` | Pengambilan data gagal | Tidak ada internet, alamat salah, atau CORS | 12 |
| `reduce of empty array with no initial value` | `reduce` pada larik kosong | Lupa nilai awal | 6 |

## Galat dan pesan Slak

| Pesan | Artinya | Perbaikan | Bab |
|---|---|---|---|
| `sl is not defined` | Kode tidak dijalankan Slak | Tulis di `<script type="text/slak">`, dan muat `slak.js` lebih dulu | 1 |
| `Fungsi sl.metrik tidak ada. Maksudmu sl.metric?` | Salah ketik nama fungsi | Ikuti saran Slak Studio | 9 |
| `Key widget dipakai lebih dari sekali` | Dua widget dengan `key` sama | Buat setiap `key` unik | 10 |
| `Kolom "x" tidak ada. Kolom yang tersedia: …` | Nama kolom salah | Lihat `df.columns` | 14 |
| `sl.groupby is not a function` | Awalan tertukar | Mengolah tabel memakai nama tabel: `df.groupby(...)` | 14 |
| Peringatan "Data … baris sudah di atas batas nyaman" | Data di atas 100 ribu baris | Pertimbangkan DuckDB atau ringkas dulu | 11, 12 |
| Permintaan memilih berkas | Halaman dibuka dengan klik dua kali dan tidak ada `.csv.js` | Bungkus data, atau buka lewat hosting | 11 |
| `no such column`, `no such table` (SQL) | Nama kolom atau tabel salah | Teks memakai kutip tunggal; nama tabel sesuai objek kedua `sl.sql` | 21 |
| `misuse of aggregate` (SQL) | `SUM` di `WHERE` | Pindahkan ke `HAVING` | 21 |
| `sl.duckdb is not a function` | `slak-duckdb.js` belum dimuat | Tambahkan `<script src="slak-duckdb.js">` | 21 |
| "1 wilayah tidak dikenali: …" di bawah peta | Nama wilayah tidak cocok | Perbaiki ejaan, atau pakai koordinat | 23 |
| `Failed to fetch dynamically imported module` | ES Module dari halaman klik dua kali | Pakai berkas `.js` biasa, atau buka lewat hosting | 24 |
| `sl.testing: … tidak ditemukan. Yang ada: …` | Label widget di uji tidak sama | Samakan dengan label di aplikasi | 24 |

## Langkah umum saat bingung

1. Baca pesan sampai habis, termasuk nomor barisnya.
2. Intip isi variabel dengan `sl.write(x)` atau `console.log(x)`.
3. Jadikan baris yang dicurigai komentar satu per satu.
4. Coba dengan data kecil.
5. Jelaskan kodenya baris demi baris, keras-keras.
