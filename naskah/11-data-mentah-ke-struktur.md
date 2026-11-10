# Bab 11 · Dari Data Mentah ke Struktur

> **Tujuan belajar**
> - Mengenal format data yang paling sering ditemui analis: CSV, JSON, dan spreadsheet.
> - Membaca CSV secara manual dengan `split`, lalu mengubah teks menjadi angka.
> - Membaca dan menulis JSON dengan `JSON.parse` dan `JSON.stringify`.
> - Membaca berkas dengan `sl.read_csv` dan berkas unggahan pengguna.
> - Memahami cara Slak membaca berkas saat halaman dibuka dengan klik dua kali, dan batas ukuran data di browser.

Selamat datang di Tahap 2. Mulai bab ini, kamu bekerja dengan data Toko Nusantara: 2.929 transaksi dari sepuluh cabang selama 2023–2024.

## 11.1 Tiga format data

| Format | Bentuk | Contoh pemakaian |
|---|---|---|
| **CSV** | Teks; setiap baris satu rekaman, kolom dipisah koma atau titik koma | Ekspor dari Excel, sistem kasir, portal data pemerintah |
| **JSON** | Teks dengan bentuk persis seperti objek dan larik JavaScript | Data dari API di internet, berkas pengaturan |
| **Excel (.xlsx)** | Berkas biner berisi beberapa lembar | Laporan kantor sehari-hari |

CSV adalah format yang paling sering dipakai analis karena sederhana dan bisa dibuka program apa pun. Inilah lima baris pertama `cabang.csv` dari bahan buku:

```
kode,cabang,kota,provinsi,lat,lon,tanggal_buka
JYP,Nusantara Jayapura,Jayapura,Papua,-2.5337,140.7181,2019-03-01
SOQ,Nusantara Sorong,Sorong,Papua Barat Daya,-0.8762,131.2558,2020-07-15
MKW,Nusantara Manokwari,Manokwari,Papua Barat,-0.8615,134.062,2021-02-01
MKS,Nusantara Makassar,Makassar,Sulawesi Selatan,-5.1477,119.4327,2019-09-10
```

Baris pertama adalah **kepala** (nama kolom). Baris berikutnya adalah data.

## 11.2 Membaca CSV dengan tangan

Sebelum memakai alat jadi, mari membaca CSV dengan JavaScript murni. Semua yang dibutuhkan sudah kamu pelajari: `split`, `map`, dan objek.

```slak
const teksCsv = `kode,kota,omzet,buka
JYP,Jayapura,4200000,2019-03-01
SOQ,Sorong,3100000,2020-07-15
MKW,Manokwari,1800000,2021-02-01`

const baris = teksCsv.trim().split("\n")       // pecah per baris
const kepala = baris[0].split(",")             // nama kolom
const data = baris.slice(1).map(b => {
  const sel = b.split(",")
  const obj = {}
  kepala.forEach((k, i) => { obj[k] = sel[i] })
  return obj
})

sl.write(data)
sl.write(typeof data[0].omzet)
```

Hasilnya larik objek, persis seperti di Bab 7. Tetapi perhatikan baris terakhir: `omzet` masih **teks**. CSV tidak menyimpan tipe data; semua isinya teks. Tugas pertama analis adalah mengubah setiap kolom ke tipe yang benar.

```slak
const mentah = [
  { kode: "JYP", kota: "Jayapura", omzet: "4200000", buka: "2019-03-01" },
  { kode: "SOQ", kota: "Sorong", omzet: "3100000", buka: "2020-07-15" }
]

const rapi = mentah.map(r => ({
  ...r,
  omzet: Number(r.omzet),
  buka: new Date(r.buka)
}))

sl.write(rapi[0].omzet + rapi[1].omzet)
sl.write(rapi[0].buka.getFullYear() < rapi[1].buka.getFullYear())
```

Cara manual ini cukup untuk CSV sederhana. Sayangnya CSV dunia nyata jarang sederhana:

- Teks berisi koma diapit tanda kutip: `"Kopi, Teh, dan Gula"`. `split(",")` akan memotongnya di tempat yang salah.
- Berkas dari Excel Indonesia memakai titik koma dan desimal koma: `1.250.000,50`.
- Sel kosong, tanda `-`, atau tulisan `NA` berarti "tidak ada data".

Karena itu, untuk berkas sungguhan kita memakai pembaca CSV milik Slak.

## 11.3 sl.read_csv

```slak
const df = await sl.read_csv("toko-nusantara.csv")
sl.write(df.shape)            // [banyak baris, banyak kolom]
sl.dataframe(df.head(5))
```

> **API Slak baru**
> - `await sl.read_csv(nama)` membaca berkas CSV atau TSV dan mengembalikan **DataFrame**, tabel milik Slak Data. Butuh `slak-data.js`.
> - `df.head(n)` mengambil `n` baris pertama. `df.shape` berisi `[banyak baris, banyak kolom]`.

Kata `await` wajib di depannya karena membaca berkas butuh waktu. Bab 12 menjelaskannya.

`read_csv` mengerjakan semua yang tadi kita lakukan dengan tangan, dan lebih banyak lagi:

- Mengenali pemisah koma, titik koma, atau tab.
- Mengubah kolom angka menjadi angka dan kolom tanggal ISO menjadi tanggal.
- Mengenali format Indonesia `1.250.000,50` dan tanggal `31/12/2024` atau `5 Januari 2024`.
- Menganggap sel kosong, `NA`, `-`, dan `null` sebagai nilai kosong.

```slak
const toko = await sl.read_csv("toko-nusantara.csv")
sl.write(toko.dtypes)    // tipe setiap kolom
```

Kamu belum perlu memahami DataFrame. Sampai Bab 13 kita mengubahnya menjadi larik objek biasa dengan `to_records()`, lalu mengolahnya dengan JavaScript murni:

```slak
const rows = (await sl.read_csv("toko-nusantara.csv")).to_records()
const total = rows.reduce((a, r) => a + r.total, 0)
sl.metric("Omzet 2023–2024", total, null, { format: "rp" })
sl.write(rows[0].tanggal instanceof Date)
```

Baris terakhir menunjukkan bahwa kolom `tanggal` sudah menjadi objek `Date`, siap dihitung.

### Opsi yang sering dipakai

```slak
const sebagian = await sl.read_csv("toko-nusantara.csv", { usecols: ["tanggal", "kota", "total"], nrows: 100 })
sl.write(sebagian.shape)
```

| Opsi | Fungsi |
|---|---|
| `sep` | Pemisah kolom, misalnya `";"` |
| `decimal` | Tanda desimal, misalnya `","` |
| `usecols` | Hanya membaca kolom tertentu |
| `nrows` | Hanya membaca sejumlah baris pertama |
| `dtype` | Memaksa tipe kolom, misalnya `{ kode: "str" }` |
| `parse_dates` | Kolom yang harus dibaca sebagai tanggal |

## 11.4 Di mana Slak mencari berkas

Browser melarang halaman yang dibuka dengan klik dua kali membaca berkas lain di komputer. Slak mengakalinya tanpa kamu mengubah kode. Saat kamu menulis `sl.read_csv("toko-nusantara.csv")`, Slak mencari berurutan:

1. **Berkas yang dibungkus**: `toko-nusantara.csv.js` di folder yang sama. Buat lewat Slak Studio (**Alat › Bungkus data**) atau `bungkus.html` dari paket Slak.
2. **Data di dalam halaman**, misalnya `<script type="text/csv" id="toko-nusantara.csv">`. Ekspor HTML Slak Studio memakai cara ini.
3. **Folder proyek**, saat kodemu dijalankan di Slak Studio.
4. **Hosting** atau server lokal, dengan cara biasa.
5. **Tombol pilih berkas.** Bila semua gagal, Slak meminta pengguna memilih berkasnya sekali dan mengingatnya di browser itu.

Folder bahan buku sudah berisi berkas `.csv.js` yang dibungkus, jadi semua contoh buku tetap jalan saat halaman buku dibuka dengan klik dua kali.

> **Catatan untuk pengguna playground**
> Playground tidak punya folder proyek. Saat contoh yang membaca `toko-nusantara.csv` dibuka di playground, Slak akan memintamu memilih berkasnya (bila playground dibuka dari komputer), atau kamu bisa mengunggahnya dengan `sl.file_uploader` seperti di 11.6. Cara paling nyaman untuk Tahap 2 dan 3 adalah halaman buku ini sendiri atau Slak Studio dengan folder bahan buku.

## 11.5 JSON

JSON (*JavaScript Object Notation*) adalah teks yang bentuknya persis seperti objek dan larik JavaScript. Karena itu JSON adalah format bawaan internet: hampir semua layanan data mengirim JSON.

```slak
const teks = '{"kota": "Ambon", "omzet": 1800000, "produk": ["Kopi", "Pala"]}'
const obj = JSON.parse(teks)          // teks → objek
sl.write(obj.produk[1])

const kembali = JSON.stringify({ kota: "Kupang", omzet: 950000 })   // objek → teks
sl.write(kembali)
sl.json(obj)
```

> **API Slak baru**
> - `sl.json(objek)` menampilkan objek atau larik dengan rapi dan bisa dilipat.
> - `await sl.read_json(nama)` membaca berkas JSON menjadi DataFrame.

Perbedaan JSON dengan objek JavaScript: nama properti **wajib** diapit tanda kutip ganda, dan tidak boleh ada fungsi, `undefined`, atau koma di akhir.

## 11.6 Berkas dari pengguna

Aplikasi analisis yang baik membiarkan pengguna memakai datanya sendiri.

```slak
const berkas = sl.file_uploader("Unggah CSV", { type: ["csv"] })
if (berkas) {
  const data = await sl.read_csv(berkas)
  sl.success(`${berkas.name}: ${data.shape[0]} baris, ${data.shape[1]} kolom`)
  sl.dataframe(data.head(10))
} else {
  sl.info("Pilih sebuah berkas CSV, misalnya cabang.csv dari bahan buku.")
}
```

> **API Slak baru**
> - `sl.file_uploader(label, { type })` mengembalikan objek berkas (`name`, `size`, `text`, `bytes`) atau `null` bila belum ada berkas. Berkasnya tidak pernah dikirim ke server mana pun; semuanya diproses di browser.

## 11.7 Seberapa besar data yang sanggup diolah browser?

Slak berjalan di browser, jadi memori yang tersedia adalah memori komputer atau ponsel pengunjung. Slak Data menetapkan batas resmi:

| Banyak baris | Rasanya |
|---|---|
| Sampai 100.000 baris (sekitar 5 MB CSV) | Nyaman, juga di laptop murah dan ponsel |
| 100.000 sampai 1.000.000 baris | Berat; Slak menampilkan peringatan dan menyarankan DuckDB atau SQL |
| Di atas 1.000.000 baris | Ringkas dulu dengan DuckDB (Bab 21), atau di luar Slak |

Data Toko Nusantara yang kita pakai jauh di bawah batas nyaman. Versi besarnya (250 ribu baris) dipakai di Bab 12 dan Bab 21 untuk merasakan bedanya.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `await is only valid in async functions` | `await` dipakai di dalam fungsi biasa | Tambah `async` di depan fungsinya (Bab 12) |
| Muncul permintaan memilih berkas | Halaman dibuka dengan klik dua kali dan tidak ada `.csv.js` | Bungkus datanya, atau buka lewat Slak Studio atau hosting |
| Semua angka terbaca sebagai teks di cara manual | CSV tidak menyimpan tipe | Ubah dengan `Number(...)`, atau pakai `sl.read_csv` |
| `Unexpected token` di `JSON.parse` | Teks bukan JSON yang sah, misalnya kutip tunggal | Periksa kutip ganda dan koma |

## Latihan

**Latihan 11.1 (mudah).** Ubah teks CSV berikut menjadi larik objek `produk`, dengan kolom `harga` berupa angka.

```slak latihan
const csv = `nama,harga
Kopi Wamena,85000
Sagu Lempeng,30000
Sambal Roa,45000`

const produk = []   // ganti

sl.write(produk)
await sl.testing.test("ada 3 produk", () => sl.testing.expect(produk).toHaveLength(3))
await sl.testing.test("harga berupa angka", () => sl.testing.expect(produk[1]).toEqual({ nama: "Sagu Lempeng", harga: 30000 }))
```

**Latihan 11.2 (sedang).** Baca `cabang.csv`, lalu buat larik `kotaPapua` berisi nama kota cabang yang provinsinya diawali kata "Papua".

```slak latihan
const cabang = (await sl.read_csv("cabang.csv")).to_records()
const kotaPapua = []   // ganti

sl.write(kotaPapua)
await sl.testing.test("tiga kota di tanah Papua", () => sl.testing.expect(kotaPapua).toEqual(["Jayapura", "Sorong", "Manokwari"]))
```

**Latihan 11.3 (tantangan).** Simpan objek `laporan` sebagai teks JSON di `teks`, lalu baca kembali ke `salinan`. Pastikan `salinan` setara dengan aslinya tetapi bukan objek yang sama.

```slak latihan
const laporan = { bulan: "2024-04", omzet: 48250000, cabang: ["Jayapura", "Sorong"] }
const teks = ""
const salinan = null

await sl.testing.test("teks adalah JSON", () => sl.testing.expect(teks.startsWith("{")).toBe(true))
await sl.testing.test("isi salinan sama", () => sl.testing.expect(salinan).toEqual(laporan))
await sl.testing.test("bukan objek yang sama", () => sl.testing.expect(salinan === laporan).toBe(false))
```

`JSON.parse(JSON.stringify(x))` adalah cara singkat menyalin objek sampai ke isi terdalamnya.

## Mini-proyek: penampil CSV apa pun

```slak
sl.title("Penampil CSV :page_facing_up:")

const unggahan = sl.file_uploader("Pilih berkas CSV", { type: ["csv", "tsv", "txt"] })
const contoh = sl.checkbox("Pakai contoh: toko-nusantara.csv", { value: !unggahan })

let df = null
if (unggahan) df = await sl.read_csv(unggahan)
else if (contoh) df = await sl.read_csv("toko-nusantara.csv")

if (!df) {
  sl.info("Unggah berkas, atau centang contoh di atas.")
} else {
  const rows = df.to_records()
  const kolom = df.columns

  const [a, b, c] = sl.columns(3)
  a.metric("Baris", rows.length)
  b.metric("Kolom", kolom.length)
  c.metric("Sel kosong", rows.reduce((n, r) => n + kolom.filter(k => r[k] == null).length, 0))

  const dipilih = sl.multiselect("Kolom yang ditampilkan", kolom, { default: kolom.slice(0, 6) })
  const banyak = sl.slider("Banyak baris", 5, 100, 20, 5)
  sl.dataframe(rows.slice(0, banyak).map(r => Object.fromEntries(dipilih.map(k => [k, r[k]]))))
}
```

`df.columns` berisi larik nama kolom. `Object.fromEntries` adalah kebalikan dari `Object.entries`: larik pasangan `[nama, nilai]` menjadi objek.
