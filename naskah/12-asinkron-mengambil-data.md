# Bab 12 · Asinkron dan Mengambil Data

> **Tujuan belajar**
> - Memahami mengapa sebagian pekerjaan tidak selesai seketika.
> - Memakai Promise, `async`, dan `await`.
> - Mengambil data dari internet dengan `fetch` dan `sl.read_url`.
> - Memakai dataset bawaan Slak dan dataset terbuka: GitHub, Kaggle, Hugging Face, Bank Dunia, dan katalog data terbuka.
> - Membaca Google Sheets dan berkas Excel.
> - Menampilkan proses yang lama dengan `sl.spinner` dan `sl.progress`, serta mengenal `sl.worker`.

## 12.1 Memesan makanan

Bayangkan kamu memesan kopi di kedai. Kasir tidak menyuruhmu berdiri diam di depan mesin sampai kopinya jadi. Kamu diberi **nomor antrean**, lalu bebas duduk. Saat kopinya siap, nomormu dipanggil.

Mengambil data dari internet atau membaca berkas besar bekerja dengan cara yang sama. Pekerjaannya butuh waktu, dan JavaScript tidak mau seluruh halaman membeku selama menunggu. Maka fungsi seperti `fetch` tidak langsung mengembalikan data. Ia mengembalikan **Promise**, semacam nomor antrean: janji bahwa hasilnya akan datang nanti.

```slak
const janji = sl.sleep(500)   // menunggu setengah detik, mengembalikan Promise
sl.write(janji instanceof Promise)
```

## 12.2 await: tunggu sampai siap

`await` berarti "tunggu janji ini terpenuhi, lalu berikan hasilnya".

```slak
sl.write("Memesan kopi…")
await sl.sleep(1000)
sl.write("Kopi siap :coffee:")
```

Tanpa `await`, baris ketiga langsung jalan tanpa menunggu.

Di skrip Slak, `await` boleh langsung dipakai di tingkat atas. Di dalam fungsi, fungsinya harus ditandai `async`:

```slak
async function hargaKopi() {
  await sl.sleep(300)          // pura-pura bertanya ke server
  return 85000
}

const harga = await hargaKopi()
sl.write(`Harga kopi: ${harga}`)
```

Fungsi `async` **selalu** mengembalikan Promise, jadi pemanggilnya juga perlu `await`.

### Menunggu beberapa hal sekaligus

Bila tiga pesanan tidak saling bergantung, jangan tunggu satu per satu. `Promise.all` menunggu semuanya bersamaan:

```slak
const t0 = performance.now()
const [a, b, c] = await Promise.all([sl.sleep(400), sl.sleep(400), sl.sleep(400)])
sl.write(`Selesai dalam ${Math.round(performance.now() - t0)} md, bukan 1200 md`)
```

## 12.3 fetch: mengambil dari internet

`fetch` adalah fungsi bawaan browser untuk mengambil apa pun dari internet. Contoh berikut **butuh internet**: ia mengambil jumlah penduduk Indonesia dari API Bank Dunia.

```slak
try {
  const url = "https://api.worldbank.org/v2/country/IDN/indicator/SP.POP.TOTL?format=json&date=2019:2023"
  const respons = await fetch(url)
  const json = await respons.json()      // dua kali menunggu: header, lalu isi
  const baris = json[1].map(r => ({ tahun: r.date, penduduk: r.value }))
  sl.table(baris)
} catch (e) {
  sl.warning("Tidak bisa mengambil data: " + e.message)
}
```

Perhatikan dua `await`: pertama menunggu jawaban server datang, kedua menunggu isinya selesai dibaca. Bungkus selalu dengan `try...catch`, karena internet bisa putus kapan saja.

Untuk CSV, JSON, Excel, atau zip di alamat mana pun, `sl.read_url` lebih praktis karena langsung menghasilkan DataFrame:

```slak
try {
  const df = await sl.read_url("https://raw.githubusercontent.com/plotly/datasets/master/2014_usa_states.csv")
  sl.write(`${df.shape[0]} baris`)
  sl.dataframe(df.head(5))
} catch (e) {
  sl.warning(e.message)
}
```

> **API Slak baru**
> - `await sl.read_url(alamat)` membaca CSV, TSV, JSON, Excel, atau zip dari alamat web dan mengembalikan DataFrame.

Beberapa server menolak dibaca dari halaman web lain (aturan keamanan browser bernama CORS). Bila itu terjadi, Slak menampilkan pesan yang menjelaskannya.

## 12.4 Dataset bawaan dan dataset terbuka

Slak menyediakan dua jenis sumber data siap pakai.

**Dataset bawaan** ada di dalam `slak-data.js`, selalu tersedia tanpa internet:

```slak
sl.dataframe(sl.datasets())
```

**Dataset terbuka** diunduh dari sumbernya saat dipakai, lalu disimpan di browser selama 7 hari sehingga tetap jalan saat internet putus:

| Fungsi | Sumber | Contoh |
|---|---|---|
| `sl.open_data` | Katalog 15 dataset pilihan beserta lisensinya | `await sl.open_data("penguins")` |
| `sl.github` | Berkas di GitHub | `await sl.github("plotly/datasets/2014_usa_states.csv")` |
| `sl.worldbank` | Indikator Bank Dunia | `await sl.worldbank("SP.POP.TOTL", { negara: ["IDN"] })` |
| `sl.huggingface` | Dataset Hugging Face | `await sl.huggingface("scikit-learn/iris", { file: "Iris.csv" })` |
| `sl.kaggle` | Dataset Kaggle | `await sl.kaggle("uciml/iris", { file: "Iris.csv" })` |

```slak
try {
  const katalog = sl.open_data.list()
  sl.dataframe(katalog.select(["id", "judul", "baris", "lisensi"]))
} catch (e) {
  sl.warning(e.message)
}
```

Selalu periksa kolom **lisensi** sebelum memakai data untuk tujuan komersial atau portofolio. Beberapa dataset klasik tidak menyatakan lisensi di sumbernya.

Kaggle tidak mengizinkan browser mengunduh langsung. Di Slak Studio, unduhan berjalan biasa. Di browser biasa, Slak memintamu memilih berkas zip yang kamu unduh sendiri dari situs Kaggle, lalu mengingatnya.

### Bank Dunia untuk Indonesia

```slak
try {
  const wb = await sl.worldbank("NY.GDP.PCAP.CD", { negara: ["IDN"], tahun: [2010, 2023] })
  const rows = wb.to_records().filter(r => r.nilai != null)
  sl.line_chart(rows, { x: "tahun", y: "nilai", title: "PDB per kapita Indonesia (US$)" })
} catch (e) {
  sl.warning("Butuh internet: " + e.message)
}
```

> **API Slak baru**
> - `sl.open_data(id)`, `sl.open_data.list()`, `sl.github(jalur)`, `sl.worldbank(indikator, { negara, tahun })`, `sl.huggingface(dataset, { file })`, `sl.kaggle(dataset, { file })` mengambil dataset terbuka sebagai DataFrame. Semuanya ada di `slak-data.js`.
> - `sl.datasets()` menampilkan daftar dataset bawaan.
> - `sl.line_chart(data, { x, y, title })` menggambar grafik garis. Grafik dibahas di Bab 16.

Supaya aplikasi tetap jalan di komputer mana pun tanpa internet, tambahkan `sl.offline_button()`. Tombol itu mengunduh data sebagai berkas `.csv.js`; taruh di folder halaman, dan data dibaca dari sana.

## 12.5 Google Sheets dan Excel

Banyak data kantor tinggal di Google Sheets. Bagikan lembarnya sebagai **Siapa saja yang memiliki link dapat melihat**, lalu:

```slak tanpa-jalan lewati
const df = await sl.read_sheets("https://docs.google.com/spreadsheets/d/ID-LEMBAR-KAMU/edit")
sl.dataframe(df)
```

`sl.read_sheets` tetap jalan saat halaman dibuka dengan klik dua kali, asalkan ada internet.

Berkas Excel dibaca tanpa pustaka tambahan:

```slak tanpa-jalan lewati
const laporan = await sl.read_excel("laporan.xlsx", { sheet: "Penjualan" })
const lembar = await sl.excel_sheets("laporan.xlsx")   // daftar nama lembar
```

## 12.6 Memberi tahu pengguna bahwa kamu sedang bekerja

Pengguna yang melihat layar diam akan mengira aplikasimu rusak. Tunjukkan bahwa sesuatu sedang dikerjakan.

```slak
const angka = await sl.spinner("Menghitung omzet…", async () => {
  await sl.sleep(800)
  return 48250000
})
sl.metric("Omzet", angka, null, { format: "rp" })
```

```slak
if (sl.button("Proses data")) {
  const bar = sl.progress(0, "Mulai…")
  const langkah = ["Membaca", "Membersihkan", "Meringkas", "Menggambar"]
  for (let i = 0; i < langkah.length; i++) {
    await sl.sleep(400)
    bar.progress((i + 1) * 25, langkah[i])
  }
  sl.success("Selesai")
}
```

> **API Slak baru**
> - `await sl.spinner(teks, fungsiAsync)` menampilkan putaran selama fungsi bekerja, lalu mengembalikan hasilnya.
> - `sl.progress(nilai, teks)` menampilkan bilah kemajuan berskala 0–100. Perbarui dengan `.progress(nilai, teks)`.

## 12.7 Pekerjaan berat di latar belakang

JavaScript di halaman bekerja di satu jalur. Saat ada hitungan berat, misalnya memproses ratusan ribu baris, halaman ikut membeku: tombol tidak bisa diklik, penggeser tidak bisa digeser.

Kabar baiknya, `sl.read_csv` sudah menangani ini sendiri. Untuk berkas di atas 5 MB, pekerjaan mengurai teks, angka, dan tanggal otomatis dipindah ke **Web Worker**, jalur kedua di belakang layar. Hasilnya sama persis, dan halaman hanya membeku sesaat.

```slak
if (sl.button("Muat 250 ribu transaksi")) {
  const t0 = performance.now()
  const besar = await sl.spinner("Membaca toko-nusantara-besar.csv…", () => sl.read_csv("toko-nusantara-besar.csv"))
  sl.success(`${besar.shape[0].toLocaleString("id-ID")} baris dibaca dalam ${((performance.now() - t0) / 1000).toFixed(1)} detik`)
}
```

Contoh ini butuh `toko-nusantara-besar.csv` (29 MB) dari bahan buku di folder yang sama. Berkas itu tidak dibungkus menjadi `.csv.js` karena terlalu besar; buka halaman buku lewat Slak Studio atau hosting, atau pilih berkasnya saat diminta.

> **Fitur eksperimental: `sl.worker`**
> Untuk hitunganmu sendiri, Slak 1.9 menyediakan `sl.worker(fungsi, ...data)`. Di daftar API stabil, fungsi ini berlabel **eksperimental**: cara pakainya boleh berubah sebelum Slak 2.0. Pakai bila memang butuh, dan periksa catatan rilis saat memperbarui Slak.
>
> Aturannya: fungsi dikirim ke worker sebagai teks, jadi ia **tidak boleh memakai variabel dari luar fungsi**, termasuk `sl`. Semua yang dibutuhkan dikirim sebagai argumen. DataFrame dikirim sebagai larik objek. Bila browser menolak worker, fungsinya dijalankan biasa.

```slak
const df = sl.dataset("penjualan")
const besarSekali = await sl.worker((rows, batas) => rows.filter(r => r.total > batas), df, 500000)
sl.write(`${besarSekali.length} transaksi di atas 500 ribu`)
sl.dataframe(sl.DataFrame(besarSekali).head(5))
```

> **Coba di playground**
> Ganti `penguins` di contoh katalog dengan `id` lain dari daftar `sl.open_data.list()`, lalu lihat kolom-kolomnya.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Muncul `[object Promise]` | Lupa `await` | Tulis `await` di depan pemanggilan |
| `await is only valid in async functions` | `await` di dalam fungsi biasa | Tandai fungsinya `async` |
| `Failed to fetch` | Tidak ada internet, alamat salah, atau server menolak (CORS) | Periksa alamat; bungkus dengan `try...catch` |
| `sl.worker`: `x is not defined` | Fungsi worker memakai variabel dari luar | Kirim semua yang dibutuhkan sebagai argumen |

## Latihan

**Latihan 12.1 (mudah).** Fungsi `ambilStok` mengembalikan Promise. Ambil hasilnya ke `stok`.

```slak latihan
async function ambilStok() {
  await sl.sleep(100)
  return 24
}
const stok = ambilStok()   // perbaiki

sl.write(stok)
await sl.testing.test("stok = 24", () => sl.testing.expect(stok).toBe(24))
```

**Latihan 12.2 (sedang).** Jalankan ketiga fungsi bersamaan dengan `Promise.all`, lalu jumlahkan hasilnya ke `total`. Uji kedua memeriksa bahwa waktunya kurang dari 500 md.

```slak latihan
const omzetCabang = async (n) => { await sl.sleep(300); return n }
const t0 = performance.now()

const total = 0   // ganti: tunggu omzetCabang(100), omzetCabang(200), omzetCabang(300) bersamaan

const lama = performance.now() - t0
await sl.testing.test("total = 600", () => sl.testing.expect(total).toBe(600))
await sl.testing.test("berjalan bersamaan", () => sl.testing.expect(lama).toBeLessThan(500))
```

**Latihan 12.3 (tantangan).** Lengkapi `ambilAman(fn)` yang menjalankan fungsi async `fn` dan mengembalikan hasilnya, atau `null` bila `fn` melempar galat.

```slak latihan
async function ambilAman(fn) {
  return await fn()
}

const berhasil = async () => "data"
const gagal = async () => { throw new Error("internet putus") }

await sl.testing.test("berhasil → data", async () => sl.testing.expect(await ambilAman(berhasil)).toBe("data"))
await sl.testing.test("gagal → null", async () => sl.testing.expect(await ambilAman(gagal)).toBeNull())
```

## Mini-proyek: Indonesia dalam angka

Aplikasi ini **butuh internet**. Ia mengambil tiga indikator Bank Dunia sekaligus, lalu menampilkan perkembangan Indonesia dibanding negara tetangga.

```slak
sl.title("Indonesia dalam Angka :earth_asia:")

const INDIKATOR = {
  "PDB per kapita (US$)": "NY.GDP.PCAP.CD",
  "Penduduk": "SP.POP.TOTL",
  "Pengguna internet (% penduduk)": "IT.NET.USER.ZS"
}

const pilih = sl.selectbox("Indikator", Object.keys(INDIKATOR))
const negara = sl.multiselect("Bandingkan dengan", ["MYS", "PHL", "THA", "VNM"], { default: ["MYS", "VNM"] })

try {
  const df = await sl.spinner("Mengambil data Bank Dunia…", () =>
    sl.worldbank(INDIKATOR[pilih], { negara: ["IDN", ...negara], tahun: [2005, 2023] }))
  const rows = df.to_records().filter(r => r.nilai != null)

  const idn = rows.filter(r => r.kode === "IDN").sort((a, b) => a.tahun - b.tahun)
  const awal = idn[0], akhir = idn[idn.length - 1]
  sl.metric(`${pilih}, ${akhir.tahun}`, Math.round(akhir.nilai * 10) / 10,
    `${((akhir.nilai / awal.nilai - 1) * 100).toFixed(0)}% sejak ${awal.tahun}`)

  sl.line_chart(rows, { x: "tahun", y: "nilai", color: "negara" })
  sl.caption("Sumber: Bank Dunia, World Development Indicators.")
} catch (e) {
  sl.warning("Data tidak bisa diambil. Periksa koneksi internet. " + e.message)
}
```

Kode negara yang dipakai Bank Dunia: IDN Indonesia, MYS Malaysia, PHL Filipina, THA Thailand, VNM Vietnam.
