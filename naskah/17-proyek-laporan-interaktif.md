# Bab 17 · Proyek: Laporan Interaktif Pertama

> **Tujuan belajar**
> - Merancang laporan dari pertanyaan bisnis.
> - Menyusun tata letak: sidebar berisi filter, angka utama, grafik, dan tabel.
> - Memakai tab dan templat tata letak `sl.layout`.
> - Membuat laporan yang ramah untuk semua pembaca, termasuk pengguna pembaca layar.
> - Menerbitkan laporan supaya bisa dibuka siapa saja lewat tautan.

Inilah penutup Tahap 2. Semua yang kamu pelajari sejak Bab 1 dipakai di sini untuk membuat satu karya utuh: laporan penjualan interaktif Toko Nusantara yang bisa kamu tunjukkan kepada siapa saja.

## 17.1 Merancang sebelum menulis kode

Laporan yang baik dimulai dengan **pertanyaan**, bukan dengan grafik. Bayangkan kamu diminta manajer wilayah Toko Nusantara. Tuliskan pertanyaannya:

1. Berapa omzet, transaksi, dan pelanggan pada periode yang dipilih, dan bagaimana dibanding periode sebelumnya?
2. Bagaimana tren omzet bulanannya?
3. Cabang dan kategori mana yang memimpin?
4. Produk apa saja yang paling laku?

Lalu tentukan **filter** yang dibutuhkan manajer: tahun, cabang, dan kanal. Setiap pertanyaan menjadi satu bagian laporan:

| Bagian | Isi | Fungsi Slak |
|---|---|---|
| Filter | Tahun, cabang, kanal | `sl.sidebar`, `selectbox`, `multiselect`, `radio` |
| Angka utama | Omzet, transaksi, pelanggan, beserta perubahannya | `sl.metric` dalam `sl.columns` |
| Tren | Omzet bulanan | `sl.line_chart` |
| Perbandingan | Cabang dan kategori | `sl.bar_chart` dalam `sl.tabs` |
| Rincian | Produk terlaris dan unduhan | `sl.dataframe`, `sl.download_button` |

## 17.2 Sidebar dan tab

Filter ditaruh di **sidebar**, panel di sisi kiri, supaya tidak menghalangi isi laporan. Semua fungsi Slak bisa dipakai di sidebar dengan awalan `sl.sidebar.`.

```slak tanpa-jalan
const tahun = sl.sidebar.selectbox("Tahun", ["2024", "2023"])
sl.write(`Laporan tahun ${tahun}`)
```

Contoh ini ditandai *tidak dijalankan di halaman buku*, karena halaman buku sendiri memakai sidebar untuk daftar bab. Coba di playground.

**Tab** memisahkan isi ke beberapa halaman kecil yang bisa dipilih pengguna:

```slak
const [tGrafik, tTabel] = sl.tabs(["Grafik", "Tabel"])
tGrafik.bar_chart([{ kota: "Jayapura", omzet: 41 }, { kota: "Sorong", omzet: 25 }], { x: "kota", y: "omzet" })
tTabel.table([{ kota: "Jayapura", omzet: 41 }, { kota: "Sorong", omzet: 25 }])
```

> **API Slak baru**
> - `sl.sidebar.namaFungsi(...)` menaruh apa saja di sidebar.
> - `sl.tabs(["A", "B"])` mengembalikan larik tab; setiap tab punya semua fungsi tampilan.

## 17.3 Templat tata letak

Menyusun kolom dan sidebar sendiri tidak sulit, tetapi Slak menyediakan empat kerangka siap pakai lewat `sl.layout`:

| Kerangka | Area yang tersedia |
|---|---|
| `"kpi-atas"` | `kpi`, `grafik`, `tabel` |
| `"sidebar-filter"` | `filter` (di sidebar), `kpi`, `grafik`, `tabel` |
| `"grid-2x2"` | `kpi`, `kiri_atas`, `kanan_atas`, `kiri_bawah`, `kanan_bawah` |
| `"laporan"` | `judul`, `ringkasan`, `isi`, `catatan`, satu kolom yang nyaman dicetak |

```slak
const df = await sl.read_csv("toko-nusantara.csv")
const area = sl.layout("kpi-atas", { title: "Ringkasan Toko Nusantara" })
area.kpi.metric("Omzet", df.total.sum(), null, { format: "rp" })
area.kpi.metric("Transaksi", df.shape[0])
area.kpi.metric("Pelanggan", df.pelanggan_id.nunique())
area.grafik.bar_chart(df.groupby("kategori").agg({ omzet: ["total", "sum"] }), { x: "kategori", y: "omzet", sort: true, format: "compact" })
area.tabel.dataframe(df.head(5))
```

Metrik yang ditulis di area `kpi` otomatis tampil sebagai kartu yang sejajar. Di layar sempit seperti ponsel, kerangka ini menyesuaikan diri menjadi satu kolom.

> **API Slak baru**
> - `sl.layout(nama, { title })` membuat kerangka tata letak dan mengembalikan objek berisi area-areanya.

## 17.4 Laporan untuk semua orang

Laporanmu mungkin dibaca orang yang memakai pembaca layar, hanya memakai papan ketik, atau membuka di ponsel dengan layar kecil. Slak 1.9 sudah mengurus banyak hal secara otomatis:

- Setiap widget punya nama untuk pembaca layar, diambil dari labelnya.
- Semua kontrol bisa dicapai dengan tombol **Tab** dan punya garis fokus yang terlihat.
- Grafik punya teks pengganti otomatis.
- Warna teks dan menu memenuhi standar kontras WCAG AA, di tema terang maupun gelap.

Bagianmu sebagai penulis laporan:

1. **Beri label yang jelas** pada setiap widget, juga saat labelnya disembunyikan dengan `label_visibility: "collapsed"`. Pembaca layar tetap membacakannya.
2. **Tulis temuan sebagai teks**, bukan hanya sebagai grafik. Kalimat "Omzet 2024 naik 27,6%" bisa dibaca semua orang.
3. **Beri teks pengganti** yang bermakna pada grafik penting dengan opsi `alt`.
4. **Jangan mengandalkan warna saja.** Tambahkan tanda atau teks, misalnya ▲ dan ▼ yang sudah dipakai `sl.metric`.
5. **Periksa di layar ponsel.** Di Slak Studio, bilah pratinjau punya tombol lebar layar ponsel (390 px).

## 17.5 Laporan lengkap

Inilah laporan utuhnya. Kode ini memakai sidebar, jadi bacalah di sini dan jalankan di playground atau Slak Studio.

```slak tanpa-jalan
sl.set_page_config({ page_title: "Laporan Toko Nusantara", page_icon: "📊", layout: "wide" })

const semua = await sl.read_csv("toko-nusantara.csv")
const data = semua.assign({ tahun: () => semua.tanggal.dt.year })

// ---------- Filter ----------
sl.sidebar.header("Filter")
const tahun = Number(sl.sidebar.selectbox("Tahun", ["2024", "2023"]))
const daftarCabang = data.cabang.unique().sort()
const cabang = sl.sidebar.multiselect("Cabang", daftarCabang, { placeholder: "Semua cabang" })
const kanal = sl.sidebar.radio("Kanal", ["Semua", "Toko", "Online"])

const saring = (df) => df
  .filter(r => cabang.length === 0 || cabang.includes(r.cabang))
  .filter(r => kanal === "Semua" || r.kanal === kanal)

const ini = saring(data.filter(r => r.tahun === tahun))
const lalu = saring(data.filter(r => r.tahun === tahun - 1))

// ---------- Judul ----------
sl.title(`Laporan Penjualan ${tahun}`)
sl.caption(`${cabang.length ? cabang.join(", ") : "Semua cabang"} · kanal ${kanal.toLowerCase()}`)

// ---------- Angka utama ----------
const persen = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1, signDisplay: "always" })
const banding = (a, b) => lalu.shape[0] ? persen.format(a / b - 1) : null

const [k1, k2, k3, k4] = sl.columns(4)
k1.metric("Omzet", ini.total.sum(), banding(ini.total.sum(), lalu.total.sum()), { format: "rp" })
k2.metric("Transaksi", ini.shape[0], banding(ini.shape[0], lalu.shape[0]))
k3.metric("Pelanggan", ini.pelanggan_id.nunique(), banding(ini.pelanggan_id.nunique(), lalu.pelanggan_id.nunique()))
k4.metric("Rata-rata transaksi", Math.round(ini.total.mean()), banding(ini.total.mean(), lalu.total.mean()), { format: "rp" })

// ---------- Tren ----------
const bulanan = ini.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
const puncak = bulanan.nlargest(1, "omzet").to_records()[0]
const namaBulan = new Intl.DateTimeFormat("id-ID", { month: "long" })
sl.subheader("Tren omzet bulanan")
sl.line_chart(bulanan, { x: "tanggal", y: "omzet", format: "compact",
  alt: `Omzet bulanan ${tahun}, tertinggi di bulan ${namaBulan.format(puncak.tanggal)}` })
sl.write(`Omzet tertinggi terjadi di bulan **${namaBulan.format(puncak.tanggal)}**.`)

// ---------- Perbandingan ----------
const [tCabang, tKategori] = sl.tabs(["Per cabang", "Per kategori"])
tCabang.bar_chart(ini.groupby("cabang").agg({ omzet: ["total", "sum"] }),
  { x: "cabang", y: "omzet", horizontal: true, sort: true, format: "compact" })
tKategori.bar_chart(ini.groupby("kategori").agg({ omzet: ["total", "sum"] }),
  { x: "kategori", y: "omzet", sort: true, labels: true, format: "compact" })

// ---------- Rincian ----------
sl.subheader("Produk terlaris")
const produk = ini.groupby("produk").agg({ terjual: ["jumlah", "sum"], omzet: ["total", "sum"] })
  .sort_values("omzet", { ascending: false })
sl.dataframe(produk.head(10), { format: { omzet: "rupiah" }, gradient: ["omzet"] })
sl.download_button("Unduh data terpilih (Excel)", { Transaksi: ini, Produk: produk }, { file_name: `toko-nusantara-${tahun}.xlsx` })
```

Beberapa hal yang patut diperhatikan:

- **Fungsi `saring`** dipakai dua kali, untuk tahun ini dan tahun lalu, sehingga perbandingan selalu adil: filternya sama persis.
- **`banding`** mengembalikan `null` bila tidak ada data tahun lalu (misalnya untuk 2023), sehingga perubahannya tidak ditampilkan.
- **Temuan ditulis sebagai teks** di bawah grafik tren, dan dipakai juga sebagai teks pengganti grafiknya.
- **Unduhan Excel** berisi dua lembar sekaligus: objek `{ Transaksi: ..., Produk: ... }` menjadi dua lembar bernama sama.

Berikut bagian intinya yang bisa dijalankan langsung di halaman ini, dengan filter di atas, bukan di sidebar:

```slak
const semua = await sl.read_csv("toko-nusantara.csv")
const data = semua.assign({ tahun: () => semua.tanggal.dt.year })
const [f1, f2] = sl.columns(2)
const tahun = Number(f1.selectbox("Tahun laporan", ["2024", "2023"]))
const kanal = f2.radio("Kanal laporan", ["Semua", "Toko", "Online"], { horizontal: true })

const saring = (df) => df.filter(r => kanal === "Semua" || r.kanal === kanal)
const ini = saring(data.filter(r => r.tahun === tahun))
const lalu = saring(data.filter(r => r.tahun === tahun - 1))
const persen = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1, signDisplay: "always" })
const banding = (a, b) => lalu.shape[0] ? persen.format(a / b - 1) : null

const [k1, k2, k3] = sl.columns(3)
k1.metric("Omzet", ini.total.sum(), banding(ini.total.sum(), lalu.total.sum()), { format: "rp" })
k2.metric("Transaksi", ini.shape[0], banding(ini.shape[0], lalu.shape[0]))
k3.metric("Pelanggan", ini.pelanggan_id.nunique(), banding(ini.pelanggan_id.nunique(), lalu.pelanggan_id.nunique()))
sl.line_chart(ini.resample("tanggal", "M").agg({ omzet: ["total", "sum"] }), { x: "tanggal", y: "omzet", format: "compact" })
```

## 17.6 Menerbitkan

Laporan yang hanya ada di laptopmu belum bisa dipakai orang lain. Ada empat cara membagikannya, dari yang paling sederhana:

### Satu berkas HTML

Di Slak Studio, tekan **Ctrl+E** (Ekspor ke HTML). Hasilnya satu berkas `.html` yang berisi `slak.js`, kodemu, dan data CSV yang dibaca dengan nama berkas. Berkas ini bisa dikirim lewat email atau WhatsApp dan dibuka dengan klik dua kali, tanpa internet.

### Folder situs

Pilih **Berkas › Ekspor folder situs** (**Ctrl+Shift+E**). Hasilnya folder berisi `index.html`, `slak.js`, berkas tambahan yang dipakai (misalnya `slak-data.js`), dan `PANDUAN-UNGGAH.txt`. Folder ini siap diunggah ke hosting apa pun.

### Unggah sendiri

| Tempat | Langkah | Alamat hasilnya |
|---|---|---|
| cPanel | File Manager › `public_html` (atau subfolder) › Upload semua berkas | `https://domainmu.com/` |
| GitHub Pages | Repositori baru › Add file › Upload files › Settings › Pages › Deploy from a branch | `https://namamu.github.io/nama-repo/` |
| Netlify | Buka `app.netlify.com/drop`, seret folder situs | Alamat acak yang bisa diganti |

### Terbit sekali klik

Pilih **Berkas › Terbitkan…** (**Ctrl+Shift+U**), lalu pilih tujuannya:

| Tujuan | Yang perlu disiapkan |
|---|---|
| GitHub Pages | Akun GitHub dan token akses pribadi dengan izin Contents dan Pages |
| Netlify | Akun Netlify dan token akses pribadi |
| FTP (cPanel) | Server FTP, nama pengguna, dan password dari menu FTP Accounts di cPanel |

Tekan **Terbitkan**, dan tautan situsmu muncul setelah prosesnya selesai. Untuk FTP, Slak Studio mencoba FTPS (terenkripsi) lebih dulu, dan hanya mengunggah berkas yang berubah sejak terbit terakhir.

Token dan password disimpan terenkripsi oleh sistem operasi di komputermu dan **tidak pernah ikut ke situs**. Bila token ditemukan di kodemu, terbit dibatalkan. Centang **Bisa dipasang dan jalan offline (PWA)** agar pengunjung bisa memasang laporanmu seperti aplikasi dan membukanya tanpa internet setelah kunjungan pertama.

### Yang perlu diingat saat online

- Setiap pengunjung menjalankan laporan **di browsernya sendiri**, jadi hosting termurah pun cukup.
- Data yang disematkan bisa dilihat siapa saja lewat "View source". **Jangan menerbitkan data pribadi atau rahasia**; pakai data fiktif seperti Toko Nusantara, atau data yang sudah dianonimkan.

> **Coba di playground**
> Salin laporan lengkap 17.5 ke playground, lalu tekan **Bagikan**. Kirim tautannya ke temanmu. Ingat, data CSV tidak ikut di tautan. Supaya laporan langsung jalan di komputer temanmu, baca datanya dari alamat lengkap `https://slak.studio/write-and-run/toko-nusantara.csv` (lihat catatan di Bab 11), atau terbitkan lewat Slak Studio supaya datanya ikut.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Halaman hasil unggah kosong | `slak.js` tidak ikut diunggah | Unggah seluruh isi folder situs |
| Data tidak terbaca di hosting | Nama berkas CSV beda huruf besar-kecil | Hosting Linux membedakan `Data.csv` dan `data.csv` |
| Perbandingan tahun lalu aneh | Filter tahun lalu berbeda dengan tahun ini | Pakai satu fungsi `saring` untuk keduanya |
| Tampilan sempit di ponsel | Terlalu banyak kolom berdampingan | Pakai `sl.layout`, atau kurangi kolom |

## Latihan

**Latihan 17.1 (mudah).** Lengkapi fungsi `saring(df, kanal)` agar mengembalikan semua baris bila `kanal` bernilai `"Semua"`, dan hanya kanal itu bila tidak.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
function saring(data, kanal) {
  return data
}

await sl.testing.test("Semua tidak menyaring", () => sl.testing.expect(saring(df, "Semua").shape[0]).toBe(df.shape[0]))
await sl.testing.test("Online saja", () => sl.testing.expect(saring(df, "Online").kanal.unique()).toEqual(["Online"]))
```

**Latihan 17.2 (sedang).** Uji di bawah menjalankan aplikasi kecil lalu memilih tahun 2023. Lengkapi kode aplikasinya agar metrik "Omzet" menampilkan omzet tahun yang dipilih.

```slak latihan
const aplikasi = `
const df = await sl.read_csv("toko-nusantara.csv")
const tahun = Number(sl.selectbox("Tahun", ["2024", "2023"]))
const data = df   // saring berdasarkan tahun
sl.metric("Omzet", data.total.sum())
`
sl.code(aplikasi)

const df = await sl.read_csv("toko-nusantara.csv")
await sl.testing.test("pilih 2023", async () => {
  const at = await sl.testing.run(aplikasi)
  await at.selectbox("Tahun").set_value("2023").run()
  sl.testing.expect(at.metric("Omzet").value).toBe(df.filter(r => r.tanggal.getFullYear() === 2023).total.sum())
})
```

**Latihan 17.3 (tantangan).** Lengkapi `temuan(df)` yang mengembalikan satu kalimat berisi cabang dengan omzet tertinggi dan porsinya, misalnya `"Nusantara Surabaya memimpin dengan 13,4% omzet."`, dengan persen bergaya Indonesia satu desimal.

```slak latihan
const df = await sl.read_csv("toko-nusantara.csv")
function temuan(data) {
  return ""
}

sl.write(temuan(df))
await sl.testing.test("kalimat temuan benar", () => sl.testing.expect(temuan(df)).toBe("Nusantara Surabaya memimpin dengan 13,4% omzet."))
await sl.testing.test("berlaku untuk data lain", () =>
  sl.testing.expect(temuan(df.filter(r => r.kategori === "Pakaian"))).toMatch(/^Nusantara .+ memimpin dengan \d+,\d% omzet\.$/))
```

## Mini-proyek: terbitkan laporanmu

Tugas penutup Tahap 2:

1. Salin laporan lengkap 17.5 ke Slak Studio dan simpan sebagai `laporan.slak` di folder yang sama dengan `toko-nusantara.csv`.
2. Tambahkan satu bagian baru yang menjawab pertanyaanmu sendiri, misalnya "Hari apa toko paling ramai?" (Latihan 16.2).
3. Tulis tiga temuan utamamu sebagai teks dengan `sl.markdown` di akhir laporan.
4. Periksa tampilannya di lebar ponsel.
5. Terbitkan ke GitHub Pages atau Netlify, lalu bagikan tautannya.

Selamat! Kamu baru saja menerbitkan karya analisis data pertamamu. Di Tahap 3, laporan ini akan tumbuh menjadi dasbor portofolio multi-halaman.
