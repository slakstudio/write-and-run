# Lampiran C · Cheat Sheet SQL

Semua kueri di lampiran ini memakai gaya yang jalan di SQLite (`sl.sql`, `sl.sqlite`), DuckDB (`sl.duckdb`), dan PostgreSQL.

## Kerangka kueri

```sql
SELECT kolom, FUNGSI(kolom) AS nama_baru     -- 5. pilih kolom
FROM tabel                                   -- 1. ambil tabel
WHERE syarat_baris                           -- 2. saring baris
GROUP BY kolom                               -- 3. kelompokkan
HAVING syarat_kelompok                       -- 4. saring kelompok
ORDER BY nama_baru DESC                      -- 6. urutkan
LIMIT 10                                     -- 7. batasi
```

## Menyaring

```sql
WHERE kota = 'Ambon'                         -- teks memakai kutip tunggal
WHERE total BETWEEN 100000 AND 500000
WHERE kota IN ('Jayapura', 'Sorong')
WHERE produk LIKE 'Kopi%'                    -- diawali "Kopi"
WHERE kanal IS NULL
WHERE tanggal >= '2024-01-01'
WHERE kota = :kota                           -- parameter dari widget (Bab 21.3)
```

## Fungsi ringkasan

`COUNT(*)`, `COUNT(DISTINCT pelanggan_id)`, `SUM(total)`, `AVG(total)`, `MIN(...)`, `MAX(...)`, `ROUND(x, 0)`.

## Tanggal (portabel)

```sql
EXTRACT(YEAR FROM tanggal)        -- tahun
EXTRACT(MONTH FROM tanggal)       -- bulan 1–12
EXTRACT(DOW FROM tanggal)         -- hari: 0 Minggu … 6 Sabtu
to_char(tanggal, 'YYYY-MM')       -- teks bulan
date_trunc('month', tanggal)      -- awal bulan
```

## Kondisi

```sql
CASE WHEN total >= 500000 THEN 'besar'
     WHEN total >= 100000 THEN 'sedang'
     ELSE 'kecil' END AS ukuran
COALESCE(kanal, 'Tidak diketahui')
SUM(CASE WHEN kanal = 'Online' THEN total ELSE 0 END)   -- jumlah bersyarat
```

## JOIN

```sql
SELECT t.produk, p.pemasok, t.total - t.jumlah * p.harga_pokok AS laba
FROM jual AS t
LEFT JOIN produk AS p ON p.produk = t.produk
```

| Jenis | Hasil |
|---|---|
| `JOIN` / `INNER JOIN` | Hanya yang cocok di kedua tabel |
| `LEFT JOIN` | Semua baris kiri |
| `RIGHT JOIN` | Semua baris kanan |
| `FULL OUTER JOIN` | Semua baris dari keduanya |

## CTE

```sql
WITH bulanan AS (
  SELECT to_char(tanggal, 'YYYY-MM') AS bulan, SUM(total) AS omzet
  FROM jual GROUP BY 1
)
SELECT * FROM bulanan WHERE omzet > 10000000
```

## Window function

```sql
RANK()       OVER (PARTITION BY kota ORDER BY omzet DESC)   -- peringkat per kota
ROW_NUMBER() OVER (ORDER BY tanggal)                         -- nomor urut
LAG(omzet)   OVER (PARTITION BY kota ORDER BY bulan)         -- nilai sebelumnya
LEAD(omzet)  OVER (PARTITION BY kota ORDER BY bulan)         -- nilai sesudahnya
SUM(omzet)   OVER (PARTITION BY kota ORDER BY bulan)         -- total berjalan
AVG(omzet)   OVER (ORDER BY bulan ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)  -- rata-rata 3 bulan
```

## Khusus SQLite yang sebaiknya dihindari

| Hindari | Pakai |
|---|---|
| `strftime('%Y-%m', t)` | `to_char(t, 'YYYY-MM')` |
| `strftime('%Y', t)` | `EXTRACT(YEAR FROM t)` |
| `IFNULL(x, 0)` | `COALESCE(x, 0)` |
| `GROUP_CONCAT(x)` | `string_agg(x, ', ')` |

Periksa kuerimu dengan `sl.sql.check(kueri)`.

## Di Slak

```js
await sl.sql(kueri, { jual: df }, { params: { kota } })     // SQLite atas DataFrame
const db = await sl.sqlite({ name: "tokoku" }); db.query(kueri, [nilai])   // SQLite tersimpan
await sl.duckdb(kueri, { jual: df })                        // DuckDB (slak-duckdb.js)
await sl.duckdb("SELECT ... FROM 'berkas.parquet'")         // DuckDB membaca berkas
await sl.report(teksMarkdownDenganSQL, { tables: { jual: df } })
```
