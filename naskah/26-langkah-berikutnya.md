# Bab 26 · Langkah Berikutnya

> **Tujuan belajar**
> - Memahami apa yang dikerjakan Slak untukmu, dan apa batas JavaScript untuk analisis data.
> - Mengenal jembatan ke Python di browser dengan `sl.python`.
> - Mengetahui cara terhubung ke database server.
> - Mengenal komponen kustom dan dokumentasi proyek dengan `Slak.docs`.
> - Menyusun peta jalan belajar dan portofolio berikutnya.

## 26.1 Apa yang dikerjakan Slak untukmu

Di Bab 10 kamu melihat penghitung klik dengan JavaScript biasa. Kini bandingkan sesuatu yang lebih besar: penggeser angka yang mengubah grafik batang.

Dengan Slak:

```slak
const n = sl.slider("Banyak bulan", 1, 12, 6)
sl.bar_chart(Array.from({ length: n }, (_, i) => ({ bulan: i + 1, omzet: (i + 1) * 10 })), { x: "bulan", y: "omzet" })
```

Dengan JavaScript biasa, tanpa pustaka apa pun:

```html
<label for="n">Banyak bulan: <span id="nilai">6</span></label>
<input id="n" type="range" min="1" max="12" value="6">
<svg id="grafik" width="400" height="200"></svg>
<script>
  const masukan = document.getElementById("n")
  const nilai = document.getElementById("nilai")
  const svg = document.getElementById("grafik")

  function gambar() {
    const n = Number(masukan.value)
    nilai.textContent = n
    const data = Array.from({ length: n }, (_, i) => (i + 1) * 10)
    const maks = Math.max(...data)
    const lebar = 400 / n
    svg.innerHTML = ""
    data.forEach((v, i) => {
      const tinggi = v / maks * 180
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect")
      r.setAttribute("x", i * lebar + 4)
      r.setAttribute("y", 200 - tinggi)
      r.setAttribute("width", lebar - 8)
      r.setAttribute("height", tinggi)
      r.setAttribute("fill", "teal")
      svg.append(r)
    })
  }
  masukan.addEventListener("input", gambar)
  gambar()
</script>
```

Versi kedua masih belum punya sumbu, label, warna tema gelap, tooltip, tombol unduh PNG, teks untuk pembaca layar, atau tampilan ponsel. Semua itu dikerjakan Slak di balik `sl.bar_chart`. Kini kamu bisa **membaca** kode seperti ini: `document.getElementById` mencari elemen halaman, `addEventListener` memasang fungsi yang menunggu kejadian, dan `createElementNS` membuat elemen gambar. Semuanya JavaScript yang sudah kamu pelajari, ditambah sedikit pengetahuan tentang **DOM**, struktur halaman web.

Kamu tidak terkunci pada Slak. Bila suatu hari kamu ingin membuat situs web biasa, JavaScript yang kamu kuasai tetap berlaku sepenuhnya. Langkah berikutnya untuk jalur itu adalah mempelajari HTML, CSS, dan DOM.

## 26.2 Batas JavaScript untuk analisis data

Slak Data membawa JavaScript sangat jauh. Tetapi ada hal yang memang lebih baik dikerjakan di tempat lain:

| Kebutuhan | Di Slak | Bila melewati batas |
|---|---|---|
| Data di atas 1 juta baris | DuckDB (Bab 21) | Database server, BigQuery |
| Data puluhan GB | Di luar kemampuan browser | Python di komputer, database server |
| Gradient boosting, deep learning, pengolahan teks | Tidak tersedia | Python: scikit-learn, XGBoost, PyTorch |
| Model statistik lanjut (model campuran, ARIMA lengkap) | Sebagian lewat `sl.python` | Python atau R |
| Laporan terjadwal yang dikirim otomatis | Tidak ada server | Penjadwal di server |
| Login sungguhan dan data pribadi banyak pengguna | Login di browser saja | slak-bridge di hosting |

Batas ini bukan kekurangan yang memalukan, melainkan keputusan desain: Slak memilih **tanpa server, tanpa instalasi, tanpa build**. Untuk portofolio, laporan internal, alat bantu kecil, dan belajar, pilihan itu tepat. Untuk data perusahaan besar, analis memakai alat lain, dan kamu kini punya dasar untuk mempelajarinya.

## 26.3 Python di browser

Slak menyediakan jembatan ke **Python** lewat Pyodide, Python yang berjalan di dalam browser. Kamu mengirim DataFrame Slak, menulis kode pandas, dan menerima hasilnya kembali.

> **Butuh internet:** Python (puluhan MB) diunduh saat pertama dipakai. Python tidak tersedia di halaman yang dibuka dengan klik dua kali; jalankan lewat Slak Studio, playground, atau hosting.

```slak
const df = await sl.read_csv("toko-nusantara.csv")
try {
  const hasil = await sl.spinner("Memuat Python…", () => sl.python(`
import pandas as pd
df.groupby("kategori")["total"].sum().sort_values(ascending=False)
`, { data: { df } }))
  sl.write(hasil)
} catch (e) {
  sl.warning("Python belum bisa dimuat: " + e.message)
}
```

- `{ data: { df } }` mengirim DataFrame Slak ke Python dengan nama `df`, sebagai DataFrame pandas.
- Nilai baris terakhir kode Python dikembalikan ke Slak. DataFrame pandas kembali sebagai DataFrame Slak.
- Hasil `print()` dan grafik matplotlib ikut tampil.

Bandingkan kode pandas di atas dengan versi Slak Data dari Bab 15:

| pandas (Python) | Slak Data (JavaScript) |
|---|---|
| `df.groupby("kategori")["total"].sum()` | `df.groupby("kategori").agg({ omzet: ["total", "sum"] })` |
| `df[df.total > 100000]` | `df.query("total > 100000")` |
| `df.sort_values("total", ascending=False)` | `df.sort_values("total", { ascending: false })` |
| `pd.merge(a, b, on="k", how="left")` | `a.merge(b, { on: "k", how: "left" })` |

Karena nama-namanya dibuat sama, beralih ke Python terasa seperti belajar logat baru dari bahasa yang sudah kamu kuasai.

> **API Slak baru**
> - `await sl.python(kode, { data })` menjalankan Python di browser. `await sl.pyplot(kode, { df })` khusus untuk grafik matplotlib.

## 26.4 Database server

Data perusahaan tinggal di database server: PostgreSQL, MySQL, MariaDB, SQL Server, libSQL/Turso, atau Google BigQuery. Slak menyediakan dua jalan:

**1. Jendela Database di Slak Studio.** Tekan **Ctrl+Shift+D** (atau menu **Alat › Database**). Dari sana kamu bisa terhubung ke SQLite, IndexedDB, PostgreSQL (termasuk Supabase dan Neon), MySQL, MariaDB, SQL Server, DuckDB, libSQL/Turso, dan BigQuery; menjalankan SQL dengan saran nama kolom; melihat diagram relasi tabel; mengimpor dan mengekspor data; dan mengambil salinan data untuk aplikasimu. Password koneksi disimpan terenkripsi oleh sistem operasi.

**2. slak-bridge untuk aplikasi yang diterbitkan.** Aplikasi di browser tidak boleh menyimpan password database, karena kodenya bisa dibaca siapa saja. Karena itu, password tinggal di server dalam berkas `slak-bridge.php` (untuk hosting cPanel) atau `slak-bridge.js` (untuk Node.js), dan aplikasimu bertanya lewat jembatan itu:

```slak tanpa-jalan lewati
const db = sl.connection("toko", { type: "bridge", url: "slak-bridge.php" })
const df = await db.query("SELECT kota, SUM(total) AS omzet FROM penjualan WHERE tahun = ? GROUP BY kota", { params: [2024] })
sl.dataframe(df)
```

Bawaannya jembatan **hanya membaca**, dan perintah berbahaya seperti `DROP` selalu ditolak. Jembatan yang sama juga bisa memeriksa login dan jawaban kuis di server, sehingga kunci jawaban dan password benar-benar tersembunyi. Berkas jembatannya bisa dibuat langsung dari jendela Database: klik kanan koneksi › **Pakai di kode Slak** › **Buat slak-bridge.php**.

Kueri SQL yang kamu tulis di Bab 21 dengan gaya portabel langsung berlaku di PostgreSQL. Itulah sebabnya buku ini menekankan `to_char`, `EXTRACT`, dan `COALESCE`.

## 26.5 Komponen kustom

Bila Slak belum punya widget yang kamu butuhkan, kamu bisa membuatnya sendiri dari HTML dan JavaScript. Slak juga membawa galeri 10 komponen siap pakai di `slak-komponen.js`: rating bintang, sketsa tanda tangan, rentang tanggal, kalender heatmap, kanban, titik di peta, editor kode, pengatur waktu, papan skor, dan tombol suara.

```slak
const nilai = sl.component("rating", { label: "Nilai pelayanan cabang", max: 5, key: "rating-cabang" })
sl.write(nilai ? `Terima kasih atas nilai ${nilai} bintang!` : "Beri nilai dengan mengeklik bintang.")
```

Komponen buatan sendiri dibuat dengan `sl.component(html, { args, key, default })`, dan komponen yang sudah jadi di sebuah folder dipakai dengan `sl.components.declare_component(nama, { url })`. Slak memakai protokol yang sama dengan Streamlit, jadi banyak komponen Streamlit bisa dipakai langsung.

## 26.6 Mendokumentasikan proyekmu dengan Slak.docs

Proyek yang baik punya dokumentasi. Berkas tambahan `slak-docs.js` membuat situs dokumentasi dari Markdown, dengan Slak sendiri. Edisi web buku yang sedang kamu baca dibuat dengan cara ini.

~~~html
<script src="slak.js"></script>
<script src="slak-docs.js"></script>

<script type="text/markdown" id="bab-1">
# Proyek Analisis Toko Nusantara

Penjelasan proyekmu, lengkap dengan contoh yang langsung dijalankan:

```slak
sl.write("Hasil contoh tampil di sini")
```
</script>

<script type="text/slak">
await Slak.docs.site(sl, {
  judul: "Dokumentasi Proyekku",
  bab: { "Pengantar": [{ judul: "Tentang proyek", elemen: "bab-1" }] }
})
</script>
~~~

`Slak.docs.site` membuat menu bab, alamat per halaman, tombol Sebelumnya/Berikutnya, daftar isi, dan pencarian dengan **Ctrl+K**. Blok kode berbahasa `slak` dijalankan dan hasilnya tampil di bawahnya, lengkap dengan tautan **Buka di Playground**. Blok yang ditandai `slak tanpa-jalan` hanya ditampilkan.

> **API Slak baru** (dari `slak-docs.js`, versi 0.1, berlabel eksperimental)
> - `Slak.docs.site(sl, { judul, bab })` membuat situs dokumentasi lengkap.
> - `Slak.docs.markdown(sl, teks)` menampilkan satu bab Markdown dengan contoh yang dijalankan.
> - Perhatikan awalannya: `Slak.docs`, bukan `sl.docs`, dan `sl` dikirim sebagai argumen pertama. `slak-docs.js` tidak menambah nama apa pun ke `sl`.

## 26.7 Peta jalan belajar

Kamu kini **analis data tingkat menengah** dengan JavaScript. Berikut arah yang bisa kamu tempuh:

| Arah | Yang dipelajari berikutnya | Kenapa |
|---|---|---|
| **Analis data lanjut** | Python (pandas, scikit-learn), statistik inferensial lebih dalam | Standar industri untuk analisis dan machine learning |
| **Analis bisnis / BI** | SQL lanjutan, PostgreSQL atau BigQuery, desain dasbor | Data perusahaan tinggal di database |
| **Pengembang web** | HTML, CSS, DOM, lalu kerangka kerja web | JavaScript-mu langsung terpakai |
| **Insinyur data** | Database, pipeline data, penjadwalan | Menyiapkan data untuk para analis |

Apa pun arahnya, tiga kebiasaan dari buku ini tetap berlaku: **mulai dari pertanyaan**, **bersihkan dan periksa datanya**, dan **uji hasilmu**.

## 26.8 Membangun portofolio

Satu dasbor sudah bagus. Tiga sampai lima proyek yang beragam jauh lebih meyakinkan. Ide proyek berikutnya, semuanya bisa dibuat dengan yang sudah kamu pelajari:

1. **Data terbuka Indonesia.** Ambil data dari Bank Dunia (Bab 12) atau portal data pemerintah, lalu ceritakan perkembangan satu indikator di beberapa provinsi.
2. **Analisis uji A/B.** Pakai dataset bawaan `ab_test` (Bab 19): rancang laporan keputusan "luncurkan versi B atau tidak?".
3. **Prediksi churn.** Pakai dataset `pelanggan` (Bab 22): bandingkan beberapa model dan buat demo dengan `sl.ml_demo`.
4. **Data milik komunitasmu.** Koperasi, sekolah, gereja, masjid, atau UMKM di sekitarmu pasti punya data yang belum dianalisis. Ini proyek paling berharga, asal datanya dianonimkan dan pemiliknya setuju.

Untuk setiap proyek, tulis di halaman *Tentang* atau README: **pertanyaan**, **data dan sumbernya**, **cara membersihkan**, **temuan**, dan **rekomendasi**. Perekrut membaca cara berpikirmu, bukan hanya grafiknya.

Terakhir: **bagikan karyamu.** Terbitkan, tulis satu unggahan singkat tentang temuanmu, dan minta masukan. Setiap pemrogram dan analis yang hebat pernah memulai dari aplikasi kecil yang diperlihatkan kepada orang lain.

Selamat menulis dan menjalankan. **Write and Run.**
