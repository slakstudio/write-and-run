# Bab 25 · Proyek Akhir: Dasbor Portofolio Multi-Halaman

> **Tujuan belajar**
> - Merancang dasbor dari pertanyaan bisnis.
> - Menyusun aplikasi multi-halaman dengan `sl.navigation` dan `sl.page`.
> - Membuat filter global yang berlaku di semua halaman.
> - Melindungi satu halaman dengan login dan peran.
> - Menambahkan halaman "Tentang Saya" untuk portofolio.
> - Menerbitkan dasbor sebagai aplikasi yang bisa dipasang di ponsel.

Inilah puncak perjalananmu. Dasbor ini menggabungkan hampir semua yang kamu pelajari: membaca dan menggabungkan empat tabel (Bab 11, 18), meringkas (Bab 15), grafik (Bab 16), deret waktu (Bab 20), Pareto dan prakiraan (Bab 22), peta (Bab 23), dan kode yang rapi (Bab 24). Hasilnya adalah karya portofolio yang bisa kamu lampirkan saat melamar kerja.

## 25.1 Dari pertanyaan ke halaman

Tulis pertanyaan bisnisnya dulu, lalu jadikan setiap kelompok pertanyaan satu halaman:

| Halaman | Pertanyaan yang dijawab | Bab rujukan |
|---|---|---|
| Ringkasan | Bagaimana kinerja tahun ini dibanding tahun lalu? Apa tiga temuan utamanya? | 15, 17 |
| Penjualan | Cabang, kategori, dan hari apa yang paling ramai? | 15, 16 |
| Produk | Produk mana yang paling penting dan paling menguntungkan? | 18, 22 |
| Wilayah | Di mana penjualan terkonsentrasi? | 23 |
| Prakiraan | Berapa omzet beberapa bulan ke depan? | 20, 22 |
| Target | Cabang mana yang mencapai target? (khusus manajer) | 18 |
| Tentang Saya | Siapa pembuatnya, apa keahliannya, dan metode apa yang dipakai? | |

## 25.2 Aplikasi multi-halaman

Setiap halaman ditulis sebagai **fungsi** yang menerima `sl`. `sl.page` mendaftarkannya, dan `sl.navigation` membuat menunya:

```slak tanpa-jalan
const beranda = (sl) => { sl.title("Beranda"); sl.write("Selamat datang!") }
const data = (sl) => { sl.title("Data"); sl.dataframe([{ kota: "Jayapura", omzet: 41 }]) }

await sl.navigation([
  sl.page("Beranda", beranda, { icon: "🏠" }),
  sl.page("Data", data, { icon: "📊" })
]).run()
```

- `sl.navigation([...])` menampilkan menu di sidebar dan memilih halaman yang sedang dibuka; `.run()` menjalankan fungsinya.
- Setiap halaman punya alamat sendiri, misalnya `#/data`, sehingga tombol Back browser bekerja dan halaman bisa dibagikan langsung.
- Menu bisa dikelompokkan: `sl.navigation({ "Analisis": [...], "Profil": [...] })`.
- Berpindah halaman dari kode: `sl.switch_page("Data")`. Tautan ke halaman lain: `sl.page_link("Data")`.

Contoh di bab ini tidak dijalankan di halaman buku, karena halaman buku sendiri sudah memakai navigasi untuk daftar bab. Jalankan di playground atau Slak Studio.

> **API Slak baru**
> - `sl.navigation(daftarHalaman, { position })` dan `sl.page(judul, fungsi, { icon, url, default })` membuat aplikasi multi-halaman. `position`: `"sidebar"` (bawaan), `"top"`, atau `"hidden"`.
> - `sl.switch_page(judul)` dan `sl.page_link(judul)` berpindah halaman.

## 25.3 Filter global

Kode di luar fungsi halaman berjalan di **semua** halaman. Itulah tempat yang tepat untuk membaca data sekali dan menaruh filter yang berlaku di mana-mana:

```js
sl.sidebar.header("Filter")
const tahun = Number(sl.sidebar.selectbox("Tahun", ["2024", "2023"], { key: "f_tahun" }))
const kanal = sl.sidebar.radio("Kanal", ["Semua", "Toko", "Online"], { key: "f_kanal" })

const saring = (df) => df.filter(r => kanal === "Semua" || r.kanal === kanal)
const ini = saring(semua.filter(r => r.tahun === tahun))
```

Variabel `ini` lalu dipakai oleh setiap fungsi halaman. Karena filter ditulis sebelum `sl.navigation`, ia tampil di sidebar semua halaman, dan `key` menjaga pilihannya saat pengguna berpindah halaman.

## 25.4 Satu halaman khusus manajer

Halaman **Target** berisi angka internal yang tidak untuk semua orang. `sl.login` di dalam fungsi halaman itu menampilkan formulir masuk hanya saat halaman itu dibuka; halaman lain tetap terbuka untuk umum.

```js
async function halTarget(sl) {
  await sl.login({
    users: {
      manajer: { password: "$2y$10$h9g8XzzwmQwTu8Biy2kxzur5ioPnQbi.AzHsPpTxCIVMQ7GQN65T6", name: "Manajer Wilayah", role: "manajer" },
      staf: { password: "$2y$10$dIcMwFfIEjs3i5STBTCIO.k88fjSkemiaIxaT1b20blp4rYaqmeKK", name: "Staf Toko", role: "staf" }
    },
    title: "Halaman ini khusus manajer"
  })
  sl.require_role("manajer")
  sl.title("Capaian Target")
  sl.caption(`Masuk sebagai ${sl.user.name}`)
  // ...
}
```

- Password tidak pernah ditulis apa adanya, melainkan sebagai **hash bcrypt**. Buat hash-nya dengan `await sl.crypto.hash_password("passwordmu")`, atau di Slak Studio lewat **Alat › Lindungi password untuk sl.login**. Di contoh ini, password `manajer` adalah `manajer123` dan password `staf` adalah `staf123`.
- `sl.require_role("manajer")` menghentikan halaman dengan pesan bila pengguna yang masuk bukan manajer. Coba masuk sebagai `staf`.
- `sl.user` berisi `name`, `role`, dan `has_role()`. `sl.logout()` keluar.

> **API Slak baru**
> - `await sl.login({ users, title })`, `sl.require_role(peran)`, `sl.user`, `sl.logout()`.

> **Batas login di browser.** Login ini berjalan sepenuhnya di browser. Ia cocok untuk memisahkan tampilan manajer dan staf, tetapi **tidak menyembunyikan data** dari orang yang membuka kode halaman: data target tetap ikut terkirim ke browser pengunjung. Untuk data yang benar-benar rahasia dibutuhkan server, misalnya `slak-bridge.php` (Bab 26). Di portofolio, pakai data fiktif atau yang sudah dianonimkan.

## 25.5 Halaman Tentang Saya

Dasbor portofolio harus menjawab pertanyaan perekrut: **siapa kamu, apa yang bisa kamu lakukan, dan bagaimana kamu bekerja?** Halaman *Tentang Saya* berisi nama, peran yang dituju, keahlian, data yang dipakai, metode, dan tautan ke GitHub atau LinkedIn. Ganti teksnya dengan dirimu sendiri.

Tips menulis halaman ini:

- Sebut **pertanyaan bisnis** dan **temuanmu**, bukan hanya alat yang dipakai.
- Jujur tentang data: sebutkan bahwa Toko Nusantara adalah data fiktif.
- Sebut **metode**: pembersihan, penggabungan tabel, Pareto, Holt-Winters.

## 25.6 Kode lengkap

Kode lengkap dasbor ada di bawah, dan juga di folder bahan buku sebagai `proyek-akhir/dasbor.slak` (untuk Slak Studio) dan `proyek-akhir/index.html` (langsung dibuka dengan klik dua kali). Bacalah per bagian; semuanya sudah kamu pelajari.

```slak tanpa-jalan
// Dasbor Portofolio Toko Nusantara · proyek akhir buku Write and Run
// Slak 1.9.1 · butuh slak-data.js dan slak-peta.js · data: toko-nusantara.csv, produk.csv, cabang.csv, target.csv

sl.set_page_config({ page_title: "Dasbor Toko Nusantara", page_icon: "📊", layout: "wide" })

// ======================================================================
// 1. Data: dibaca sekali, dipakai semua halaman
// ======================================================================
const [trx, produk, cabang, target] = await Promise.all([
  sl.read_csv("toko-nusantara.csv"), sl.read_csv("produk.csv"), sl.read_csv("cabang.csv"), sl.read_csv("target.csv")
])
const semua = trx
  .merge(produk.select(["produk", "harga_pokok"]), { on: "produk", how: "left" })
  .assign({
    laba: r => r.total - r.jumlah * r.harga_pokok,
    tahun: r => r.tanggal.getFullYear(),
    bulan: r => sl.strftime(r.tanggal, "%Y-%m")
  })

// ======================================================================
// 2. Alat bantu: hitungan dan format yang dipakai berulang
// ======================================================================
const persen = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1, signDisplay: "always" })
const banding = (a, b) => a ? persen.format(b / a - 1) : null
const ringkas = (df) => ({
  omzet: df.total.sum(), laba: df.laba.sum(),
  transaksi: df.shape[0], pelanggan: df.pelanggan_id.nunique()
})

// ======================================================================
// 3. Filter global di sidebar: berlaku di semua halaman
// ======================================================================
sl.sidebar.header("Filter")
const tahun = Number(sl.sidebar.selectbox("Tahun", ["2024", "2023"], { key: "f_tahun" }))
const kanal = sl.sidebar.radio("Kanal", ["Semua", "Toko", "Online"], { key: "f_kanal" })
const pilihCabang = sl.sidebar.multiselect("Cabang", semua.cabang.unique().sort(), { key: "f_cabang", placeholder: "Semua cabang" })

const saring = (df) => df
  .filter(r => kanal === "Semua" || r.kanal === kanal)
  .filter(r => pilihCabang.length === 0 || pilihCabang.includes(r.cabang))
const ini = saring(semua.filter(r => r.tahun === tahun))
const lalu = saring(semua.filter(r => r.tahun === tahun - 1))
const keterangan = `${tahun} · ${pilihCabang.length ? pilihCabang.length + " cabang" : "semua cabang"} · kanal ${kanal.toLowerCase()}`

// ======================================================================
// 4. Halaman
// ======================================================================
function halRingkasan(sl) {
  sl.title("Ringkasan")
  sl.caption(keterangan)
  const r = ringkas(ini), r0 = ringkas(lalu)
  const [a, b, c, d] = sl.columns(4)
  a.metric("Omzet", r.omzet, banding(r0.omzet, r.omzet), { format: "rp" })
  b.metric("Laba kotor", r.laba, banding(r0.laba, r.laba), { format: "rp" })
  c.metric("Transaksi", r.transaksi, banding(r0.transaksi, r.transaksi))
  d.metric("Pelanggan", r.pelanggan, banding(r0.pelanggan, r.pelanggan))

  const bulanan = ini.resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
  sl.line_chart(bulanan, { x: "tanggal", y: "omzet", format: "compact", title: "Omzet bulanan" })

  sl.subheader("Temuan utama")
  const kat = ini.groupby("kategori").agg({ omzet: ["total", "sum"] }).sort_values("omzet", { ascending: false }).to_records()
  const cab = ini.groupby("cabang").agg({ omzet: ["total", "sum"] }).sort_values("omzet", { ascending: false }).to_records()
  const online = ini.filter(x => x.kanal === "Online").total.sum() / (r.omzet || 1)
  sl.markdown(`
1. Omzet ${tahun} ${r0.omzet ? (r.omzet >= r0.omzet ? "naik" : "turun") + " " + banding(r0.omzet, r.omzet).replace(/^[+-]/, "") + " dibanding " + (tahun - 1) : "tercatat"} menjadi **Rp ${r.omzet.toLocaleString("id-ID")}**.
2. Kategori **${kat[0] ? kat[0].kategori : "-"}** menyumbang omzet terbesar, dan cabang **${cab[0] ? cab[0].cabang : "-"}** memimpin.
3. Kanal online menyumbang **${(online * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%** omzet.
`)
}

function halPenjualan(sl) {
  sl.title("Penjualan")
  sl.caption(keterangan)
  const [t1, t2, t3] = sl.tabs(["Per cabang", "Per kategori", "Per hari"])
  t1.bar_chart(ini.groupby("cabang").agg({ omzet: ["total", "sum"] }), { x: "cabang", y: "omzet", horizontal: true, sort: true, format: "compact" })
  t2.bar_chart(ini.groupby(["kategori", "kanal"]).agg({ omzet: ["total", "sum"] }), { x: "kategori", y: "omzet", color: "kanal", format: "compact" })
  const harian = ini.resample("tanggal", "D").agg({ omzet: ["total", "sum"] })
  const perHari = harian.assign({ hari: () => harian.tanggal.dt.day_name(), urut: () => harian.tanggal.dt.weekday })
    .groupby(["urut", "hari"]).agg({ rata: ["omzet", "mean"] })
  t3.bar_chart(perHari, { x: "hari", y: "rata", format: "compact", title: "Rata-rata omzet per hari" })
}

function halProduk(sl) {
  sl.title("Produk")
  sl.caption(keterangan)
  const per = ini.groupby("produk").agg({ terjual: ["jumlah", "sum"], omzet: ["total", "sum"], laba: ["laba", "sum"] })
    .assign({ margin: r => r.laba / r.omzet }).sort_values("omzet", { ascending: false })
  const par = sl.analysis.pareto(ini, { category: "produk", value: "total" })
  sl.combo_chart(par, { x: "produk", bar: "total", line: "persen_kumulatif" })
  sl.dataframe(per, { format: { omzet: "rupiah", laba: "rupiah", margin: "percent" }, gradient: ["laba"] })
  sl.download_button("Unduh tabel produk (Excel)", { Produk: per }, { file_name: `produk-${tahun}.xlsx` })
}

function halWilayah(sl) {
  sl.title("Wilayah")
  sl.caption(keterangan)
  const per = ini.groupby("cabang").agg({ omzet: ["total", "sum"], pelanggan: ["pelanggan_id", "nunique"] }).merge(cabang, { on: "cabang" })
  sl.map(per, { lat: "lat", lon: "lon", size: "omzet", color: "pelanggan", label: "kota" })
  sl.choropleth(ini.groupby("provinsi").agg({ omzet: ["total", "sum"] }), { region: "provinsi", value: "omzet", labels: true })
}

function halPrakiraan(sl) {
  sl.title("Prakiraan")
  sl.caption("Berdasarkan seluruh data 2023–2024 dengan filter kanal dan cabang yang dipilih")
  const n = sl.slider("Bulan ke depan", 3, 12, 6)
  const bulanan = saring(semua).resample("tanggal", "M").agg({ omzet: ["total", "sum"] })
  sl.write(sl.ts.forecast(bulanan, { periods: n }))
  sl.info("Ramalan memakai dua tahun data. Laporkan selalu rentangnya, bukan hanya satu angka.")
}

async function halTarget(sl) {
  await sl.login({
    users: {
      manajer: { password: "$2y$10$h9g8XzzwmQwTu8Biy2kxzur5ioPnQbi.AzHsPpTxCIVMQ7GQN65T6", name: "Manajer Wilayah", role: "manajer" },
      staf: { password: "$2y$10$dIcMwFfIEjs3i5STBTCIO.k88fjSkemiaIxaT1b20blp4rYaqmeKK", name: "Staf Toko", role: "staf" }
    },
    title: "Halaman ini khusus manajer"
  })
  sl.require_role("manajer")
  sl.title("Capaian Target")
  sl.caption(`Masuk sebagai ${sl.user.name}`)
  const perBulan = ini.groupby(["cabang", "bulan"]).agg({ omzet: ["total", "sum"] })
    .merge(target, { on: ["cabang", "bulan"], how: "left" })
    .assign({ capaian: r => r.omzet / r.target })
  const perCab = perBulan.groupby("cabang").agg({ omzet: ["omzet", "sum"], target: ["target", "sum"], bulan_tercapai: ["capaian", x => x.filter(v => v >= 1).length] })
    .assign({ capaian: r => r.omzet / r.target }).sort_values("capaian", { ascending: false })
  sl.dataframe(perCab, { format: { omzet: "rupiah", target: "rupiah", capaian: "percent" }, gradient: ["capaian"] })
  sl.bar_chart(perCab, { x: "cabang", y: "capaian", horizontal: true, format: "percent",
    color: r => r.capaian >= 1 ? "var(--slak-green)" : "var(--slak-red)" })
  sl.button("Keluar", { on_click: () => sl.logout() })
}

function halTentang(sl) {
  sl.title("Tentang Saya")
  sl.markdown(`
**Nama Kamu** · Calon Analis Data · Jayapura

Saya membangun dasbor ini sebagai proyek akhir buku *Write and Run: Belajar JavaScript untuk Analisis Data dengan Slak*.

**Keahlian:** JavaScript, Slak, SQL (SQLite, DuckDB, gaya PostgreSQL), statistik deskriptif, uji hipotesis, deret waktu, visualisasi, dan peta.

**Data:** Toko Nusantara adalah data fiktif 2.929 transaksi dari sepuluh cabang, 2023–2024.

**Metode:** pembersihan data, penggabungan empat tabel, analisis Pareto, prakiraan Holt-Winters, dan capaian target per cabang.
`)
  const [a, b] = sl.columns(2)
  a.link_button("GitHub", "https://github.com/")
  b.link_button("LinkedIn", "https://www.linkedin.com/")
}

// ======================================================================
// 5. Navigasi
// ======================================================================
await sl.navigation({
  "Analisis": [
    sl.page("Ringkasan", halRingkasan, { icon: "📊", default: true }),
    sl.page("Penjualan", halPenjualan, { icon: "🧾" }),
    sl.page("Produk", halProduk, { icon: "📦" }),
    sl.page("Wilayah", halWilayah, { icon: "🗺️" }),
    sl.page("Prakiraan", halPrakiraan, { icon: "🔮" })
  ],
  "Internal": [sl.page("Target", halTarget, { icon: "🎯" })],
  "Profil": [sl.page("Tentang Saya", halTentang, { icon: "👋" })]
}).run()
```

Hal-hal yang patut diperhatikan:

1. **Data dibaca sekali** di bagian 1 dengan `Promise.all`, lalu digabung dengan harga pokok dan diberi kolom `laba`, `tahun`, dan `bulan`. Semua halaman memakai hasil yang sama.
2. **Alat bantu** di bagian 2 (`banding`, `ringkas`) mencegah kode yang sama ditulis berulang di setiap halaman.
3. **Temuan utama** di halaman Ringkasan ditulis otomatis dari angka. Saat filter diubah, kalimatnya ikut berubah dan tetap benar.
4. **Halaman Prakiraan** sengaja memakai seluruh data dua tahun, bukan hanya tahun terpilih, karena ramalan butuh data sepanjang mungkin.
5. **Halaman Target** memakai fungsi agregasi buatan sendiri untuk menghitung bulan yang tercapai (Bab 18.4).

## 25.7 Menguji dasbor

Dasbor sebesar ini wajib diuji. Uji berikut membuka setiap halaman dan memastikan tidak ada galat. Simpan sebagai `dasbor.uji.slak` di samping `dasbor.slak`, lalu jalankan dari panel **Uji** di Slak Studio:

```slak tanpa-jalan lewati
const { test, expect } = sl.testing
for (const hal of ["Ringkasan", "Penjualan", "Produk", "Wilayah", "Prakiraan", "Target", "Tentang Saya"]) {
  await test(`halaman ${hal} tanpa galat`, async () => {
    const at = await sl.testing.run("dasbor.slak", { timeout: 20000 })
    if (hal !== "Ringkasan") { at.switch_page(hal); await at.run({ timeout: 20000 }) }
    expect(at.exception).toHaveLength(0)
  })
}
await test("filter 2023 Online tanpa galat", async () => {
  const at = await sl.testing.run("dasbor.slak", { timeout: 20000 })
  await at.selectbox("Tahun").set_value("2023").run()
  await at.radio("Kanal").set_value("Online").run()
  expect(at.exception).toHaveLength(0)
})
```

## 25.8 Menerbitkan sebagai aplikasi

Terbitkan dasbormu dengan cara di Bab 17.6. Dua hal tambahan untuk proyek akhir:

1. **Bisa dipasang dan jalan tanpa internet.** Di jendela **Terbitkan** Slak Studio, centang **Bisa dipasang dan jalan offline (PWA)**. Setelah diterbitkan di alamat https, Chrome dan Edge menampilkan tombol **Pasang**, dan di ponsel Android ada pilihan **Tambahkan ke layar utama**. Ikon aplikasinya diambil dari `page_icon` di `sl.set_page_config`. Setelah dibuka sekali, dasbor tetap terbuka tanpa internet.
2. **Bagikan tautannya** di CV, profil LinkedIn, dan README GitHub-mu. Tuliskan satu kalimat temuan di samping tautan, misalnya: "Dasbor penjualan 10 cabang: omzet 2024 naik 27,6%, dengan kerajinan sebagai penyumbang terbesar."

## Latihan

**Latihan 25.1 (mudah).** Tambahkan halaman **Pelanggan** yang menampilkan segmen RFM (Bab 22.4) untuk data terpilih, lalu daftarkan di kelompok "Analisis".

**Latihan 25.2 (sedang).** Tambahkan pilihan **"Bandingkan dengan"** di sidebar berisi "Tahun lalu" dan "Target", lalu ubah metrik Omzet di halaman Ringkasan agar perubahannya dihitung terhadap pilihan itu.

**Latihan 25.3 (tantangan).** Tambahkan ke `dasbor.uji.slak` satu uji yang memastikan **jumlah omzet semua cabang di halaman Penjualan sama dengan metrik Omzet di halaman Ringkasan**, untuk setiap kombinasi tahun dan kanal.

Ketiga latihan ini sengaja tidak punya satu jawaban benar. Contoh solusinya ada di Lampiran D, tetapi dasbormu boleh berbeda. Justru di situlah nilainya sebagai karya portofolio: dasbormu menunjukkan caramu berpikir.

## Selamat!

Kamu memulai buku ini dengan `sl.title("Halo, dunia!")`. Kini kamu punya dasbor multi-halaman yang membaca empat tabel, menggabungkan, meringkas, menggambar, meramal, memetakan, melindungi satu halaman dengan login, dan teruji otomatis. Semuanya ditulis dengan JavaScript, berjalan di browser, tanpa build.
