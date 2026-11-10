# Bab 21 · SQL di Browser

> **Tujuan belajar**
> - Memahami mengapa analis data wajib bisa SQL.
> - Menulis `SELECT`, `WHERE`, `GROUP BY`, `ORDER BY`, dan `JOIN`.
> - Memakai CTE (`WITH`) dan window function untuk peringkat dan total berjalan.
> - Menulis SQL yang juga jalan di PostgreSQL.
> - Mengolah data besar dan berkas Parquet dengan DuckDB.
> - Menyimpan data di browser dengan `sl.sqlite` dan `sl.db`.
> - Membuat laporan dari SQL dengan `sl.report`.

## 21.1 Mengapa SQL?

**SQL** (*Structured Query Language*) adalah bahasa untuk bertanya kepada database. Hampir setiap lowongan analis data mencantumkan SQL, karena data perusahaan tersimpan di database seperti PostgreSQL, MySQL, atau BigQuery. Kabar baiknya: SQL jauh lebih sederhana daripada JavaScript, dan cara berpikirnya sudah kamu kuasai di Bab 14–18.

| Yang sudah kamu pelajari | Di SQL |
|---|---|
| `select([...])` | `SELECT kolom1, kolom2` |
| `filter(...)` / `query(...)` | `WHERE syarat` |
| `groupby(...).agg(...)` | `GROUP BY ...` dengan `SUM`, `COUNT`, `AVG` |
| `sort_values(...)` | `ORDER BY ... DESC` |
| `head(10)` | `LIMIT 10` |
| `merge(...)` | `JOIN ... ON ...` |

Slak menyertakan **SQLite** sungguhan, database yang sama yang ada di setiap ponsel Android dan iPhone. Mesinnya ada di dalam `slak-sql.js`, sehingga SQL tetap jalan tanpa server dan tanpa internet.

```html
<script src="slak.js"></script>
<script src="slak-data.js"></script>
<script src="slak-sql.js"></script>
```

## 21.2 Kueri pertama

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = await sl.sql(`
  SELECT kota, COUNT(*) AS transaksi, SUM(total) AS omzet
  FROM jual
  GROUP BY kota
  ORDER BY omzet DESC
`, { jual: df })
sl.dataframe(hasil, { format: { omzet: "rupiah" } })
```

- Argumen kedua memberi **nama tabel** untuk setiap DataFrame: `{ jual: df }` membuat tabel bernama `jual`.
- Hasilnya DataFrame, jadi bisa langsung ditampilkan, digambar, atau diolah lagi.
- Kueri ditulis di antara backtick supaya boleh beberapa baris.

> **API Slak baru**
> - `await sl.sql(kueri, { nama: df }, { params })` menjalankan SQL atas DataFrame atau larik objek. Butuh `slak-sql.js`.

### Bagian-bagian SELECT

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = await sl.sql(`
  SELECT produk,
         SUM(jumlah)           AS terjual,
         SUM(total)            AS omzet,
         ROUND(AVG(total), 0)  AS rata_transaksi
  FROM jual
  WHERE kategori = 'Minuman'
    AND tanggal >= '2024-01-01'
  GROUP BY produk
  HAVING SUM(jumlah) > 50
  ORDER BY omzet DESC
`, { jual: df })
sl.dataframe(hasil)
```

Urutan **penulisan**: `SELECT` → `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `ORDER BY` → `LIMIT`.

Urutan **pengerjaannya** berbeda: ambil tabel (`FROM`), saring baris (`WHERE`), kelompokkan (`GROUP BY`), saring kelompok (`HAVING`), pilih kolom (`SELECT`), lalu urutkan (`ORDER BY`). Karena itu `WHERE` tidak bisa memakai hasil `SUM`; untuk menyaring hasil ringkasan, pakai `HAVING`.

Teks di SQL diapit **tanda kutip tunggal**: `'Minuman'`. Tanggal dikirim ke SQLite sebagai teks `YYYY-MM-DD`, sehingga perbandingan `tanggal >= '2024-01-01'` langsung bekerja.

## 21.3 Parameter dari widget

Jangan pernah menyambung isian pengguna langsung ke teks SQL. Pakai **parameter**:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const kota = sl.selectbox("Kota", df.kota.unique().sort())
const hasil = await sl.sql(
  "SELECT kategori, SUM(total) AS omzet FROM jual WHERE kota = :kota GROUP BY kategori ORDER BY omzet DESC",
  { jual: df }, { params: { kota } })
sl.bar_chart(hasil, { x: "kategori", y: "omzet", format: "compact" })
```

`:kota` di kueri diisi dari `params`. Parameter mencegah kesalahan kutip (misalnya nama "Jum'at") dan serangan yang disebut *SQL injection*. Kebiasaan ini wajib di tempat kerja.

## 21.4 JOIN

```slak
const [trx, produk] = await Promise.all([sl.read_csv("toko-nusantara.csv"), sl.read_csv("produk.csv")])
const hasil = await sl.sql(`
  SELECT p.pemasok,
         SUM(t.total)                          AS omzet,
         SUM(t.total - t.jumlah * p.harga_pokok) AS laba
  FROM jual AS t
  LEFT JOIN produk AS p ON p.produk = t.produk
  GROUP BY p.pemasok
  ORDER BY laba DESC
`, { jual: trx, produk })
sl.dataframe(hasil, { format: { omzet: "rupiah", laba: "rupiah" } })
```

Hasilnya sama dengan `merge` di Bab 18.3. `AS t` dan `AS p` memberi nama pendek (alias) untuk tabel, supaya kolom bisa ditulis `t.total` dan `p.harga_pokok` tanpa tertukar.

## 21.5 CTE dan window function

**CTE** (*Common Table Expression*) memecah kueri panjang menjadi langkah-langkah bernama dengan `WITH`. Mirip menyimpan hasil antara di variabel.

**Window function** menghitung sesuatu **di sekitar setiap baris** tanpa meringkasnya menjadi satu: peringkat, total berjalan, nilai bulan sebelumnya.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = await sl.sql(`
  WITH bulanan AS (
    SELECT to_char(tanggal, 'YYYY-MM') AS bulan, kota, SUM(total) AS omzet
    FROM jual
    GROUP BY 1, 2
  )
  SELECT bulan, kota, omzet,
         RANK() OVER (PARTITION BY bulan ORDER BY omzet DESC)           AS peringkat,
         omzet - LAG(omzet) OVER (PARTITION BY kota ORDER BY bulan)       AS selisih,
         SUM(omzet) OVER (PARTITION BY kota ORDER BY bulan)               AS kumulatif
  FROM bulanan
  WHERE kota IN ('Jayapura', 'Sorong')
  ORDER BY kota, bulan
`, { jual: df })
sl.dataframe(hasil.head(8), { format: { omzet: "rupiah", selisih: "rupiah", kumulatif: "rupiah" } })
```

| Fungsi jendela | Arti |
|---|---|
| `RANK() OVER (PARTITION BY a ORDER BY b DESC)` | Peringkat `b` di dalam setiap kelompok `a` |
| `LAG(x) OVER (PARTITION BY a ORDER BY t)` | Nilai `x` pada baris sebelumnya di kelompok yang sama |
| `SUM(x) OVER (PARTITION BY a ORDER BY t)` | Total berjalan |
| `ROW_NUMBER()`, `LEAD(x)`, `AVG(x) OVER (...)` | Nomor urut, nilai sesudahnya, rata-rata bergerak |

`PARTITION BY` membagi baris ke dalam jendela-jendela (mirip `groupby`), dan `ORDER BY` di dalam `OVER` menentukan urutan di setiap jendela.

## 21.6 SQL yang juga jalan di PostgreSQL

Setiap database punya logat SQL sendiri. Kueri di bab ini sengaja ditulis dengan gaya yang jalan di **SQLite dan PostgreSQL** sekaligus, karena PostgreSQL paling sering dipakai di tempat kerja.

| Hindari (khusus SQLite) | Pakai (jalan di keduanya) |
|---|---|
| `strftime('%Y-%m', tanggal)` | `to_char(tanggal, 'YYYY-MM')` |
| `strftime('%Y', tanggal)` | `EXTRACT(YEAR FROM tanggal)` |
| | `date_trunc('month', tanggal)` |
| `IFNULL(x, 0)` | `COALESCE(x, 0)` |
| `GROUP_CONCAT(x)` | `string_agg(x, ', ')` |

Slak bisa memeriksanya untukmu:

```slak
sl.dataframe(sl.sql.check("SELECT strftime('%Y', tanggal), IFNULL(kanal, '-') FROM jual"))
```

> **API Slak baru**
> - `sl.sql.check(kueri)` mendaftar sintaks khusus SQLite beserta penggantinya yang portabel.
> - Opsi `{ portable: true }` pada `sl.sql` memberi peringatan langsung saat kueri memakai sintaks khusus SQLite.

## 21.7 Data besar dengan DuckDB

SQLite cocok untuk data harian. Untuk ratusan ribu sampai jutaan baris, atau berkas **Parquet**, Slak menyediakan **DuckDB**, database analitik yang dirancang untuk meringkas data besar dengan cepat. DuckDB ada di berkas tambahan:

```html
<script src="slak.js"></script>
<script src="slak-data.js"></script>
<script src="slak-duckdb.js"></script>
```

> **Butuh internet:** mesin DuckDB (sekitar 35 MB) diunduh sekali saat pertama dipakai, lalu disimpan browser. Di Slak Studio, DuckDB tersedia tanpa internet. Playground tidak memuat `slak-duckdb.js`, jadi contoh DuckDB dijalankan di halaman buku ini atau di Slak Studio.

```slak
if (sl.button("Rangkum 250 ribu transaksi dengan DuckDB")) {
  const t0 = performance.now()
  const hasil = await sl.spinner("DuckDB bekerja…", () => sl.duckdb(`
    SELECT kanal, EXTRACT(YEAR FROM CAST(tanggal AS DATE)) AS tahun,
           COUNT(*) AS transaksi, SUM(total) AS omzet
    FROM 'toko-nusantara-besar.csv'
    GROUP BY 1, 2
    ORDER BY 2, 1
  `))
  sl.success(`Selesai dalam ${((performance.now() - t0) / 1000).toFixed(1)} detik`)
  sl.dataframe(hasil, { format: { omzet: "compact" } })
}
```

DuckDB bisa membaca berkas CSV dan Parquet langsung dari kueri, cukup dengan menyebut namanya dalam tanda kutip tunggal. Berkasnya tidak perlu dimuat ke DataFrame lebih dulu, sehingga data yang terlalu besar untuk Slak Data pun masih bisa diringkas.

DuckDB juga menerima DataFrame, sama seperti `sl.sql`:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const r = await sl.duckdb("SELECT kota, SUM(total) AS omzet FROM jual GROUP BY kota ORDER BY omzet DESC LIMIT 5", { jual: df })
sl.dataframe(r)
```

### Parquet

**Parquet** menyimpan data per kolom dan terkompresi, biasanya 5 sampai 10 kali lebih kecil daripada CSV dan jauh lebih cepat dibaca. Banyak dataset terbuka kini tersedia dalam Parquet.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const pq = await sl.duckdb.to_file("SELECT * FROM jual", "toko-nusantara.parquet", { jual: df })
sl.download_button("Unduh sebagai Parquet", pq, { file_name: "toko-nusantara.parquet" })
```

Berkas Parquet dibaca kembali dengan `await sl.read_parquet("toko-nusantara.parquet")`.

> **API Slak baru** (dari `slak-duckdb.js`)
> - `await sl.duckdb(kueri, { nama: df })` menjalankan SQL dengan DuckDB.
> - `await sl.read_parquet(nama)` membaca berkas Parquet menjadi DataFrame.
> - `await sl.duckdb.to_file(kueri, namaBerkas, tabel)` menyimpan hasil kueri sebagai Parquet untuk diunduh.

### Kapan SQLite, kapan DuckDB?

| | `sl.sql` / `sl.sqlite` (SQLite) | `sl.duckdb` (DuckDB) |
|---|---|---|
| Cocok untuk | Data kecil sampai menengah, tabel yang sering diubah | Analisis data besar, berkas Parquet |
| Tanpa internet | Selalu | Di Slak Studio; di halaman lain diunduh sekali |
| Gaya SQL | SQLite ditambah sebagian gaya PostgreSQL | Sangat mirip PostgreSQL |

Aturan sederhananya: **mulai dengan SQLite.** Pindah ke DuckDB bila data lebih dari sekitar 500 ribu baris, bila kamu memakai Parquet, atau bila ringkasan terasa lambat.

## 21.8 Menyimpan data di browser

Sejauh ini SQL hanya membaca DataFrame. Untuk data yang ditambah dan diubah pengguna, misalnya catatan stok, simpan di database yang tinggal di browser.

**SQLite yang tersimpan:**

```slak
const db = await sl.sqlite({ name: "stok-toko" })
db.query("CREATE TABLE IF NOT EXISTS stok (produk TEXT PRIMARY KEY, jumlah INTEGER)")

const f = sl.form("tambah-stok", { clear_on_submit: true })
const produk = f.text_input("Produk")
const jumlah = f.number_input("Jumlah", { min: 0, value: 1 })
if (f.form_submit_button("Simpan") && produk) {
  db.query("INSERT INTO stok (produk, jumlah) VALUES (?, ?) ON CONFLICT(produk) DO UPDATE SET jumlah = excluded.jumlah", [produk, jumlah])
}
sl.dataframe(db.query("SELECT * FROM stok ORDER BY produk"))
```

**IndexedDB lewat `sl.db`**, tanpa SQL sama sekali:

```slak
const db = sl.db("buku-kunjungan", { kunjungan: "++id, kota" })
if (sl.button("Catat kunjungan dari Ambon")) await db.kunjungan.insert({ kota: "Ambon", waktu: new Date().toISOString() })
sl.metric("Kunjungan dari Ambon", await db.kunjungan.where("kota").equals("Ambon").count())
sl.write(await sl.db_list())
```

> **API Slak baru**
> - `await sl.sqlite({ name })` membuka database SQLite yang tersimpan permanen di browser. `db.query(sql, params)` menjalankan SQL; `SELECT` mengembalikan DataFrame.
> - `sl.db(nama, skema)` membuka database IndexedDB dengan tabel dan perintah `insert`, `update`, `delete`, `where`, `all`, `count`.
> - `await sl.db_list()` mendaftar database `sl.db` yang ada di browser ini.

Seperti `local_state` (Bab 10), kedua database ini tinggal **di browser setiap pengunjung**, tidak dibagi antar-pengunjung.

## 21.9 Laporan dari SQL

`sl.report` menulis laporan dalam Markdown dengan blok SQL di dalamnya. Blok SQL dijalankan lebih dulu, lalu hasilnya disisipkan ke teks atau digambar sebagai grafik.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
await sl.report(`
# Laporan Singkat Toko Nusantara

Selama 2023–2024, omzet mencapai **{{ ringkas.omzet | rp }}** dari {{ ringkas.transaksi }} transaksi.
Cabang teratas adalah **{{ teratas.kota }}**.

\`\`\`sql name=ringkas hide
SELECT SUM(total) AS omzet, COUNT(*) AS transaksi FROM jual
\`\`\`

\`\`\`sql name=teratas hide
SELECT kota FROM jual GROUP BY kota ORDER BY SUM(total) DESC LIMIT 1
\`\`\`

\`\`\`sql chart=bar x=kota y=omzet format=rp title="Omzet per kota"
SELECT kota, SUM(total) AS omzet FROM jual GROUP BY kota ORDER BY omzet DESC
\`\`\`
`, { tables: { jual: df } })
```

| Opsi blok `sql` | Fungsi |
|---|---|
| `name=nama` | Memberi nama hasil, supaya bisa dipakai di teks dengan `{{ nama.kolom }}` |
| `hide` | Tidak menampilkan tabelnya |
| `chart=bar` (`line`, `area`, `scatter`, `pie`) | Menggambar grafik |
| `x=`, `y=`, `format=`, `title=` | Opsi grafik |

Di dalam teks, `{{ nama.kolom | rp }}` diisi nilai baris pertama hasil kueri `nama`, dengan format `rp`, `persen`, angka desimal `0`–`9`, atau `tanggal`.

> **API Slak baru**
> - `await sl.report(teks, { tables, db, params })` membuat laporan dari Markdown dan SQL.

> **Coba di playground**
> Di contoh 21.5, ganti `RANK()` dengan `ROW_NUMBER()`. Apa bedanya bila dua kota punya omzet yang sama?

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `no such column: Minuman` | Teks ditulis dengan kutip ganda | Teks memakai kutip tunggal: `'Minuman'` |
| `misuse of aggregate` | Memakai `SUM` di `WHERE` | Pindahkan ke `HAVING` |
| `no such table` | Nama tabel di kueri tidak sama dengan kunci objek kedua | `FROM jual` butuh `{ jual: df }` |
| Kueri lambat pada tabel lebar | `SELECT *` memuat semua kolom | Sebutkan kolom yang dibutuhkan saja |
| `sl.duckdb is not a function` | `slak-duckdb.js` belum dimuat | Tambahkan `<script src="slak-duckdb.js">` |

## Latihan

**Latihan 21.1 (mudah).** Tulis kueri yang menghitung omzet per kanal, dengan kolom `kanal` dan `omzet`, diurutkan dari terbesar.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = await sl.sql(`SELECT 1 AS ganti_saya`, { jual: df })

sl.dataframe(hasil)
const r = hasil.to_records()
await sl.testing.test("dua kanal", () => sl.testing.expect(r).toHaveLength(2))
await sl.testing.test("Toko teratas", () => sl.testing.expect(r[0].kanal).toBe("Toko"))
await sl.testing.test("omzet benar", () => sl.testing.expect(r[0].omzet + r[1].omzet).toBe(df.total.sum()))
```

**Latihan 21.2 (sedang).** Cari produk terlaris (berdasarkan jumlah terjual) di setiap kota. Hasilnya satu baris per kota dengan kolom `kota`, `produk`, dan `terjual`. Petunjuk: CTE dan `RANK()`.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = await sl.sql(`SELECT 1 AS ganti_saya`, { jual: df })

sl.dataframe(hasil)
await sl.testing.test("sepuluh kota", () => sl.testing.expect(hasil.shape[0]).toBe(10))
await sl.testing.test("kolom benar", () => sl.testing.expect(hasil.columns).toEqual(["kota", "produk", "terjual"]))
```

**Latihan 21.3 (tantangan).** Hitung omzet bulanan 2024 beserta total berjalannya (`kumulatif`). Kueri harus portabel: `sl.sql.check` tidak boleh menemukan masalah.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const kueri = `SELECT 1 AS ganti_saya`
const hasil = await sl.sql(kueri, { jual: df })

sl.dataframe(hasil)
const r = hasil.to_records()
await sl.testing.test("12 bulan", () => sl.testing.expect(r).toHaveLength(12))
await sl.testing.test("kumulatif akhir = omzet 2024", () =>
  sl.testing.expect(r.at(-1).kumulatif).toBe(df.filter(x => x.tanggal.getFullYear() === 2024).total.sum()))
await sl.testing.test("portabel", () => sl.testing.expect(sl.sql.check(kueri)).toHaveLength(0))
```

## Mini-proyek: sepuluh pertanyaan bisnis

Jawab sepuluh pertanyaan bisnis Toko Nusantara hanya dengan SQL. Pengguna memilih pertanyaan, aplikasi menampilkan kueri dan jawabannya.

```slak
sl.title("Sepuluh Pertanyaan untuk Toko Nusantara :question:")

const [jual, produk, cabang] = await Promise.all([
  sl.read_csv("toko-nusantara.csv"), sl.read_csv("produk.csv"), sl.read_csv("cabang.csv")])

const SOAL = {
  "1. Berapa omzet setiap tahun?":
    "SELECT EXTRACT(YEAR FROM tanggal) AS tahun, SUM(total) AS omzet FROM jual GROUP BY 1 ORDER BY 1",
  "2. Lima produk dengan omzet terbesar?":
    "SELECT produk, SUM(total) AS omzet FROM jual GROUP BY produk ORDER BY omzet DESC LIMIT 5",
  "3. Berapa porsi kanal Online per tahun?":
    "SELECT EXTRACT(YEAR FROM tanggal) AS tahun, SUM(CASE WHEN kanal = 'Online' THEN total ELSE 0 END) * 1.0 / SUM(total) AS porsi_online FROM jual GROUP BY 1 ORDER BY 1",
  "4. Pemasok mana yang paling menguntungkan?":
    "SELECT p.pemasok, SUM(j.total - j.jumlah * p.harga_pokok) AS laba FROM jual j JOIN produk p ON p.produk = j.produk GROUP BY 1 ORDER BY 2 DESC",
  "5. Provinsi mana dengan omzet terbesar?":
    "SELECT c.provinsi, SUM(j.total) AS omzet FROM jual j JOIN cabang c ON c.cabang = j.cabang GROUP BY 1 ORDER BY 2 DESC",
  "6. Hari apa yang paling ramai?":
    "SELECT EXTRACT(DOW FROM tanggal) AS hari_ke, COUNT(*) AS transaksi FROM jual GROUP BY 1 ORDER BY 2 DESC",
  "7. Berapa pelanggan yang belanja lebih dari 5 kali?":
    "WITH p AS (SELECT pelanggan_id, COUNT(*) AS n FROM jual GROUP BY 1) SELECT COUNT(*) AS pelanggan FROM p WHERE n > 5",
  "8. Siapa 5 pelanggan dengan belanja terbesar?":
    "SELECT pelanggan_id, COUNT(*) AS transaksi, SUM(total) AS belanja FROM jual GROUP BY 1 ORDER BY 3 DESC LIMIT 5",
  "9. Kategori apa yang tumbuh paling cepat dari 2023 ke 2024?":
    "WITH t AS (SELECT kategori, SUM(CASE WHEN EXTRACT(YEAR FROM tanggal) = 2023 THEN total END) AS t23, SUM(CASE WHEN EXTRACT(YEAR FROM tanggal) = 2024 THEN total END) AS t24 FROM jual GROUP BY 1) SELECT kategori, t23, t24, t24 * 1.0 / t23 - 1 AS tumbuh FROM t ORDER BY tumbuh DESC",
  "10. Berapa rata-rata nilai transaksi saat diskon Lebaran dibanding tanpa diskon?":
    "SELECT CASE WHEN diskon_persen > 0 THEN 'Diskon' ELSE 'Tanpa diskon' END AS jenis, COUNT(*) AS transaksi, ROUND(AVG(total), 0) AS rata FROM jual GROUP BY 1"
}

const soal = sl.selectbox("Pertanyaan", Object.keys(SOAL))
sl.code(SOAL[soal], { language: "sql" })
const hasil = await sl.sql(SOAL[soal], { jual, produk, cabang })
sl.dataframe(hasil)

const masalah = sl.sql.check(SOAL[soal])
if (masalah.length === 0) sl.caption("Kueri ini portabel: jalan juga di PostgreSQL.")
```

`EXTRACT(DOW FROM tanggal)` memberi nomor hari: 0 Minggu sampai 6 Sabtu. Coba ubah pertanyaan 6 agar menampilkan nama hari dengan `CASE`.
