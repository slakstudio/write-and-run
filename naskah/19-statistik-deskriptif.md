# Bab 19 · Statistik Deskriptif Lanjutan

> **Tujuan belajar**
> - Mengukur sebaran data: rentang, varians, dan simpangan baku.
> - Memakai persentil, kuartil, dan box plot.
> - Mendeteksi pencilan dengan metode IQR, dan memutuskan apa yang harus dilakukan terhadapnya.
> - Mengukur hubungan dua variabel dengan korelasi, dan memahami bedanya dengan sebab-akibat.
> - Membandingkan dua kelompok dengan uji t dan uji A/B.

Rata-rata saja tidak cukup. Dua cabang bisa punya rata-rata transaksi yang sama, tetapi yang satu stabil dan yang lain naik turun tak menentu. Bab ini memberimu alat untuk melihat **bentuk** data, bukan hanya pusatnya.

## 19.1 Sebaran: seberapa jauh nilai-nilai menyebar

Mari mulai dengan JavaScript murni, seperti di Bab 5:

```slak
const nilaiA = [100, 102, 98, 101, 99]     // stabil
const nilaiB = [60, 140, 80, 130, 90]      // naik turun

function rata(x) { return x.reduce((a, b) => a + b, 0) / x.length }
function varians(x) {
  const m = rata(x)
  return x.reduce((a, v) => a + (v - m) ** 2, 0) / (x.length - 1)
}
const simpangan = x => Math.sqrt(varians(x))

sl.write(`A: rata-rata ${rata(nilaiA)}, simpangan baku ${simpangan(nilaiA).toFixed(1)}`)
sl.write(`B: rata-rata ${rata(nilaiB)}, simpangan baku ${simpangan(nilaiB).toFixed(1)}`)
```

Rata-ratanya sama-sama 100, tetapi simpangan bakunya sangat berbeda.

- **Varians** adalah rata-rata kuadrat jarak setiap nilai ke rata-ratanya. Kuadrat dipakai supaya jarak ke bawah dan ke atas tidak saling meniadakan.
- **Simpangan baku** (*standard deviation*) adalah akar varians, sehingga satuannya kembali sama dengan data. Kira-kira: "biasanya nilai menyimpang sejauh ini dari rata-rata".
- Pembagi `x.length - 1` dipakai untuk **sampel**. Ini juga bawaan pandas dan Excel `STDEV.S`.

Dengan Slak Data:

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const t = df.total
sl.json(sl.stats.describe(t))
```

> **API Slak baru**
> - `sl.stats.describe(x)` meringkas satu kolom: banyak data, rata-rata, simpangan baku, minimum, kuartil, dan maksimum.
> - `sl.stats.var(x)`, `sl.stats.std(x)`, `sl.stats.mean(x)`, `sl.stats.median(x)`, juga tersedia sebagai metode Series: `df.total.std()`.

## 19.2 Persentil dan kuartil

**Persentil ke-90** adalah nilai yang di bawahnya terdapat 90% data. **Kuartil** adalah persentil ke-25, 50, dan 75: tiga titik yang membagi data menjadi empat bagian sama banyak.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const t = df.total
const [q1, q2, q3] = sl.stats.quantile(t, [0.25, 0.5, 0.75])

const rp = new Intl.NumberFormat("id-ID")
sl.markdown(`
- 25% transaksi bernilai di bawah **Rp ${rp.format(q1)}** (kuartil 1)
- separuh transaksi di bawah **Rp ${rp.format(q2)}** (median)
- 75% transaksi di bawah **Rp ${rp.format(q3)}** (kuartil 3)
- 10% transaksi teratas di atas **Rp ${rp.format(sl.stats.percentile(t, 90))}** (persentil 90)
`)
```

Kalimat seperti ini jauh lebih mudah dipahami manajer daripada "simpangan baku 149 ribu".

**Rentang antarkuartil** (IQR) adalah `Q3 − Q1`, lebar separuh data yang di tengah. IQR tidak terpengaruh nilai ekstrem, sehingga lebih bisa diandalkan daripada rentang `max − min`.

## 19.3 Box plot

Box plot menggambar lima angka sekaligus: minimum, Q1, median, Q3, dan maksimum, ditambah titik-titik pencilan.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
sl.box_plot(df, { y: "total", by: "kategori", title: "Nilai transaksi per kategori" })
```

Cara membacanya:

- **Kotak** membentang dari Q1 sampai Q3; garis di dalamnya adalah median.
- **Kumis** memanjang sampai nilai terjauh yang masih dalam 1,5 × IQR dari kotak.
- **Titik** di luar kumis adalah pencilan.

Satu grafik ini memperlihatkan bahwa transaksi Kerajinan jauh lebih besar dan lebih beragam daripada kategori lain.

> **API Slak baru**
> - `sl.box_plot(data, { y, by })` menggambar box plot, satu kotak per kelompok.

## 19.4 Pencilan: buang, potong, atau biarkan?

Metode IQR menganggap nilai sebagai pencilan bila berada di bawah `Q1 − 1,5 × IQR` atau di atas `Q3 + 1,5 × IQR`.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const masker = df.outliers("total")
sl.write(`Batas normal: ${masker.bounds.map(x => x.toLocaleString("id-ID")).join(" sampai ")}`)
sl.write(`${masker.values.filter(Boolean).length} transaksi di luar batas`)

const pencilan = df.filter(masker)
sl.dataframe(pencilan.value_counts("kategori"))
```

Ada 235 transaksi "pencilan", hampir semuanya Kerajinan. Apakah mereka salah? **Tidak.** Tenun ikat dan ukiran Asmat memang mahal. Inilah pelajaran terpenting bagian ini:

> **Pencilan bukan berarti salah.** Sebelum membuang, tanyakan: apakah nilai ini mungkin terjadi? Di Bab 13, jumlah 250 barang dalam satu transaksi oleh-oleh hampir pasti salah ketik, jadi dibuang. Di sini, transaksi 1,8 juta untuk tenun ikat adalah penjualan sungguhan. Membuangnya berarti menghilangkan pelanggan terbaikmu.

Tiga pilihan yang tersedia:

| Pilihan | Perintah | Kapan |
|---|---|---|
| Buang | `df.remove_outliers("total")` | Nilainya pasti salah |
| Potong ke batas | `df.cap_outliers("total")` | Nilainya benar, tetapi mengganggu model atau rata-rata |
| Biarkan, pakai median | `df.total.median()` | Nilainya benar dan penting; laporkan median di samping rata-rata |

## 19.5 Korelasi

**Korelasi** mengukur seberapa kuat dua variabel bergerak bersama, dari −1 sampai +1:

| Nilai | Arti |
|---|---|
| mendekati +1 | Bila satu naik, yang lain cenderung naik |
| sekitar 0 | Tidak ada hubungan garis lurus |
| mendekati −1 | Bila satu naik, yang lain cenderung turun |

```slak
const kar = sl.dataset("karyawan")
const angka = kar.select_dtypes("number")
sl.heatmap(angka.corr(), { title: "Korelasi antarvariabel karyawan" })

const r = sl.stats.pearsonr(kar.pengalaman_tahun, kar.gaji_juta)
sl.write(`Korelasi pengalaman dan gaji: ${r.statistic.toFixed(2)}`)
sl.write(r.conclusion)
```

Dataset bawaan `karyawan` berisi 300 karyawan fiktif. Pengalaman dan gaji berkorelasi 0,74: kuat dan positif.

> **API Slak baru**
> - `df.corr()` menghitung korelasi semua pasangan kolom angka. `df.select_dtypes("number")` memilih kolom angka saja.
> - `sl.heatmap(data)` menggambar tabel angka sebagai kotak berwarna.
> - `sl.stats.pearsonr(x, y)` dan `sl.stats.spearmanr(x, y)` menguji korelasi, lengkap dengan kesimpulan berbahasa Indonesia.

### Korelasi bukan sebab-akibat

Penjualan es krim dan kasus tenggelam berkorelasi positif. Apakah es krim menyebabkan orang tenggelam? Tentu tidak. Keduanya naik di musim panas, saat orang lebih banyak berenang. Variabel ketiga seperti "musim" disebut **variabel pengganggu**.

Saat menemukan korelasi, tuliskan "berhubungan dengan", bukan "menyebabkan". Membuktikan sebab-akibat butuh eksperimen, seperti uji A/B di bagian berikut.

## 19.6 Uji hipotesis: apakah perbedaannya nyata?

Rata-rata transaksi kanal Toko sedikit lebih besar daripada Online. Apakah perbedaan itu nyata, atau kebetulan saja?

**Uji hipotesis** menjawabnya dengan cara berikut:

1. Anggap dulu **tidak ada perbedaan** (hipotesis nol, H₀).
2. Hitung **p-value**: peluang melihat perbedaan sebesar ini bila H₀ benar.
3. Bila p-value lebih kecil dari 0,05, perbedaannya dianggap **signifikan**: terlalu besar untuk dianggap kebetulan.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = sl.stats.ttest_ind(df, { value: "total", group: "kanal" })
sl.write(hasil)
```

Kesimpulannya: tidak ada bukti bahwa rata-rata transaksi kedua kanal berbeda. Perbedaan kecil yang terlihat bisa saja kebetulan.

`sl.stats.ttest_ind` menampilkan statistik uji, p-value, ukuran efek, dan kesimpulan dalam bahasa Indonesia. Uji t ini memakai versi Welch, yang tidak menganggap kedua kelompok punya sebaran sama.

### Uji A/B

**Uji A/B** adalah eksperimen: pengunjung dibagi acak ke dua versi (A dan B), lalu hasilnya dibandingkan. Karena pembagiannya acak, perbedaan hasil bisa dianggap **disebabkan** oleh versinya. Dataset bawaan `ab_test` berisi 4.000 pengunjung halaman checkout.

```slak
const ab = sl.dataset("ab_test")
const uji = sl.stats.ab_test(ab, { group: "grup", metric: "beli", control: "A" })
sl.write(uji)
```

Versi B meningkatkan pembelian sekitar 21%, dan p-value-nya di bawah 0,05. Kini kita boleh mengatakan versi B **menyebabkan** lebih banyak pembelian.

> **API Slak baru**
> - `sl.stats.ttest_ind(df, { value, group })` membandingkan rata-rata dua kelompok.
> - `sl.stats.ab_test(df, { group, metric, control })` menganalisis uji A/B. Metrik 0/1 diuji sebagai proporsi, metrik lain sebagai rata-rata.
> - Setiap hasil uji punya `statistic`, `p_value`, `significant`, `conclusion`, dan bisa ditampilkan langsung dengan `sl.write`.

Hasil uji statistik Slak sudah dicocokkan dengan scipy dan statsmodels, pustaka statistik baku di Python.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Simpangan baku berbeda sedikit dengan kalkulator | Pembagi `n` dan `n − 1` | Slak dan pandas memakai `n − 1` untuk sampel |
| Membuang ratusan "pencilan" yang sebenarnya pelanggan terbaik | Menganggap pencilan pasti salah | Periksa dulu apakah nilainya mungkin terjadi |
| Menulis "X menyebabkan Y" dari korelasi | Lupa variabel pengganggu | Tulis "berhubungan dengan" |
| "Tidak signifikan" dibaca "tidak ada perbedaan" | Salah tafsir | Artinya "tidak ada bukti cukup", bukan "pasti sama" |

## Latihan

**Latihan 19.1 (mudah).** Hitung `iqr` kolom `total` dengan `sl.stats.quantile`, tanpa memakai `sl.stats.iqr`.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const iqr = 0   // ganti

sl.write(iqr)
await sl.testing.test("IQR benar", () => sl.testing.expect(iqr).toBe(sl.stats.iqr(df.total)))
```

**Latihan 19.2 (sedang).** Lengkapi fungsi `batasPencilan(x)` dengan JavaScript murni (boleh memakai `sl.stats.quantile`), yang mengembalikan larik `[bawah, atas]` menurut metode IQR.

```slak latihan
function batasPencilan(x) {
  return [0, 0]
}

const df = await sl.read_csv("toko-nusantara.csv")
await sl.testing.test("batas sama dengan Slak", () => sl.testing.expect(batasPencilan(df.total)).toEqual(df.outliers("total").bounds))
```

**Latihan 19.3 (tantangan).** Apakah rata-rata transaksi di cabang **Jayapura** berbeda nyata dengan **Jakarta**? Simpan hasil `ttest_ind` di `hasil`, dan simpan jawaban `true` atau `false` di `berbeda`.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = null       // ganti
const berbeda = null     // ganti: true bila signifikan

sl.write(hasil)
await sl.testing.test("hasil uji ada", () => sl.testing.expect(hasil && typeof hasil.p_value).toBe("number"))
await sl.testing.test("kesimpulan sesuai p-value", () => sl.testing.expect(berbeda).toBe(hasil.p_value < 0.05))
```

## Mini-proyek: profil statistik otomatis

Aplikasi ini membuat profil statistik untuk kolom angka mana pun dari berkas CSV apa pun.

```slak
sl.title("Profil Statistik :mag:")

const unggah = sl.file_uploader("CSV (kosongkan untuk contoh)", { type: ["csv"] })
const df = unggah ? await sl.read_csv(unggah) : await sl.read_csv("toko-nusantara.csv")
const kolomAngka = df.select_dtypes("number").columns
const kolomTeks = df.select_dtypes("string").columns

const [a, b] = sl.columns(2)
const pilih = a.selectbox("Kolom angka", kolomAngka, { index: kolomAngka.indexOf("total") >= 0 ? kolomAngka.indexOf("total") : 0 })
const kelompok = b.selectbox("Bandingkan menurut", ["(tidak ada)", ...kolomTeks])

const x = df[pilih].dropna()
const [q1, med, q3] = sl.stats.quantile(x, [0.25, 0.5, 0.75])
const rata = x.mean()
const m = df.outliers(pilih)

const [k1, k2, k3, k4] = sl.columns(4)
k1.metric("Rata-rata", Math.round(rata))
k2.metric("Median", med)
k3.metric("Simpangan baku", Math.round(x.std()))
k4.metric("Pencilan", m.values.filter(Boolean).length)

sl.histogram(df, { x: pilih, bins: 30 })
if (kelompok !== "(tidak ada)") sl.box_plot(df, { y: pilih, by: kelompok })

const condong = rata > med * 1.2 ? "condong ke kanan: ada sebagian kecil nilai yang sangat besar"
  : rata < med * 0.8 ? "condong ke kiri" : "cukup simetris"
sl.info(`Sebaran **${pilih}** ${condong}. Separuh data berada antara ${q1.toLocaleString("id-ID")} dan ${q3.toLocaleString("id-ID")}.`)
```

Kalimat di akhir ditulis otomatis dari angka-angkanya. Aplikasi yang **menjelaskan** temuannya sendiri jauh lebih berguna daripada tabel angka saja.
