# Bab 23 · Peta dan Data Wilayah

> **Tujuan belajar**
> - Mengenal data berbasis lokasi: kota, provinsi, dan koordinat.
> - Menggambar peta titik, peta gelembung, dan rute.
> - Membuat peta warna wilayah (choropleth) untuk 38 provinsi dan 514 kabupaten/kota, tanpa internet.
> - Mencocokkan nama wilayah yang ditulis berbeda-beda, dan menghitung jarak antartitik.

Indonesia membentang lebih dari 5.000 km dari Sabang sampai Merauke. Bagi Toko Nusantara yang cabangnya tersebar dari Jakarta sampai Jayapura, peta bukan hiasan: peta memperlihatkan pola yang tidak terlihat di tabel.

## 23.1 Memasang peta

Peta ada di berkas tambahan:

```html
<script src="slak.js"></script>
<script src="slak-data.js"></script>
<script src="slak-peta.js"></script>      <!-- batas 38 provinsi dan titik 514 kab/kota -->
<script src="slak-peta-kab.js"></script>  <!-- batas poligon kab/kota (opsional) -->
```

Batas 38 provinsi, termasuk pemekaran Papua tahun 2022, sudah ada di dalam `slak-peta.js`. Peta bekerja **tanpa internet**. Playground, Slak Studio, dan halaman buku ini sudah memuatnya.

## 23.2 Tiga cara menyebut lokasi

| Cara | Contoh | Ketelitian |
|---|---|---|
| Koordinat | `lat: -2.5337, lon: 140.7181` | Paling tepat |
| Nama kota atau kabupaten | `"Jayapura"`, `"Kab. Mimika"` | Titik tengah wilayah |
| Nama provinsi | `"Papua Barat Daya"` | Untuk peta warna wilayah |

**Lintang** (*latitude*, `lat`) adalah posisi utara-selatan: negatif di selatan khatulistiwa. **Bujur** (*longitude*, `lon`) adalah posisi barat-timur: Indonesia berada sekitar 95 sampai 141 derajat bujur timur.

## 23.3 Peta titik dan gelembung

`cabang.csv` menyimpan koordinat setiap cabang. Gabungkan dengan omzet (Bab 18), lalu gambar:

```slak
const [trx, cabang] = await Promise.all([sl.read_csv("toko-nusantara.csv"), sl.read_csv("cabang.csv")])
const perCabang = trx.groupby("cabang").agg({ omzet: ["total", "sum"] }).merge(cabang, { on: "cabang" })

sl.map(perCabang, { lat: "lat", lon: "lon", size: "omzet", label: "kota" })
```

Ukuran gelembung sebanding dengan omzet. Arahkan kursor ke gelembung untuk melihat nilainya; gulir atau tekan **+** dan **−** untuk memperbesar.

Bila datamu tidak punya koordinat, sebut saja nama wilayahnya:

```slak
const trx = await sl.read_csv("toko-nusantara.csv")
const perKota = trx.groupby("kota").agg({ omzet: ["total", "sum"], transaksi: ["id_transaksi", "nunique"] })
sl.map(perKota, { region: "kota", size: "omzet", color: "transaksi", label: "kota" })
```

Slak mencari titik tengah setiap kota dari daftar 514 kabupaten/kota yang dibawanya.

Perhatikan catatan di bawah peta: **1 wilayah tidak dikenali: Jakarta**. Bukan salah Slak. Jakarta adalah provinsi yang terdiri dari lima kota administrasi (Jakarta Pusat, Jakarta Utara, dan seterusnya), jadi "Jakarta" tidak bisa dicocokkan dengan satu kota. Perbaikannya: tulis nama kotanya, misalnya "Jakarta Pusat", atau pakai koordinat seperti contoh sebelumnya. Inilah alasan analis lebih suka menyimpan koordinat atau kode wilayah daripada nama.

> **API Slak baru**
> - `sl.map(df, { lat, lon, size, color, label })` menggambar titik atau gelembung.
> - `sl.map(df, { region: "kolom" })` mencari lokasi dari nama wilayah.
> - Opsi lain: `heatmap: true` (peta kepadatan), `cluster: true` (titik yang berdekatan dikumpulkan), `route: { arrows: true }` (garis sesuai urutan baris), `tiles: "osm"` (latar OpenStreetMap, **butuh internet**).

## 23.4 Rute

Bayangkan rute pengiriman barang dari gudang di Surabaya ke cabang-cabang di timur. Baris data digambar berurutan sebagai garis:

```slak
const cabang = await sl.read_csv("cabang.csv")
const urutan = ["Surabaya", "Denpasar", "Kupang", "Makassar", "Ambon", "Sorong", "Manokwari", "Jayapura"]
const rute = urutan.map(k => cabang.filter(r => r.kota === k).to_records()[0])
sl.map(rute, { lat: "lat", lon: "lon", label: "kota", route: { arrows: true } })
```

## 23.5 Peta warna wilayah (choropleth)

**Choropleth** mewarnai setiap wilayah sesuai nilainya. Cocok untuk membandingkan provinsi.

```slak
const trx = await sl.read_csv("toko-nusantara.csv")
const perProvinsi = trx.groupby("provinsi").agg({ omzet: ["total", "sum"] })
sl.choropleth(perProvinsi, { region: "provinsi", value: "omzet", labels: true, title: "Omzet per provinsi, 2023–2024" })
```

Provinsi tanpa cabang tampil abu-abu. Peta seperti ini langsung menjawab pertanyaan strategis: provinsi mana yang belum terjangkau?

Untuk tingkat kabupaten/kota, tambahkan `level: "kabkota"`. Batas poligonnya dimuat otomatis dari `slak-peta-kab.js`:

```slak
const contoh = sl.DataFrame([
  { wilayah: "Kota Jayapura", pelanggan: 88 }, { wilayah: "Kab. Jayapura", pelanggan: 31 },
  { wilayah: "Kab. Keerom", pelanggan: 12 }, { wilayah: "Kab. Sarmi", pelanggan: 6 }
])
sl.choropleth(contoh, { region: "wilayah", value: "pelanggan", level: "kabkota", labels: true })
```

> **API Slak baru**
> - `sl.choropleth(df, { region, value, labels, level, bins })` mewarnai wilayah. `level: "kabkota"` untuk kabupaten/kota.

> **Peta dan kejujuran.** Wilayah yang luas, seperti provinsi-provinsi di Papua, tampak dominan di peta walau penduduknya sedikit. Untuk data seperti omzet atau jumlah pelanggan, pertimbangkan nilai **per penduduk** atau tampilkan juga grafik batang di sampingnya.

## 23.6 Nama wilayah yang berantakan

Nama wilayah di data nyata jarang seragam: "Jaypura", "Kab. Mimika", "Timika", "Jabar". Slak mengenalinya dengan toleran: singkatan, awalan (Prov., Kab., Kota), nama lama, ibu kota kabupaten, dan salah ketik ringan.

```slak
for (const nama of ["Jaypura", "Timika", "Jabar", "Kota Sorong", "Manokwari"]) {
  const m = sl.geo.match(nama)
  sl.write(`${nama} → ${m ? `${m.nama} (${m.provinsi || "provinsi"})` : "tidak dikenali"}`)
}
```

Perhatikan "Timika" dikenali sebagai Kabupaten Mimika (Timika adalah ibu kotanya), dan "Manokwari" sebagai Kabupaten Manokwari. Selalu periksa hasil pencocokan untuk nama yang bisa berarti dua wilayah, misalnya kota dan kabupaten bernama sama. Wilayah yang tidak dikenali dilaporkan di bawah peta.

Untuk satu kolom sekaligus, `sl.geo.geocode` menambahkan nama baku dan koordinatnya:

```slak
const alamat = sl.DataFrame([{ kota: "Manokwari" }, { kota: "Ambon" }, { kota: "Kupang" }])
sl.dataframe(sl.geo.geocode(alamat, "kota"))
```

## 23.7 Jarak

```slak
const cabang = (await sl.read_csv("cabang.csv")).to_records()
const jyp = cabang.find(c => c.kota === "Jayapura")
const jarak = cabang
  .filter(c => c.kota !== "Jayapura")
  .map(c => ({ kota: c.kota, km: Math.round(sl.geo.distance([jyp.lat, jyp.lon], [c.lat, c.lon])) }))
  .sort((a, b) => a.km - b.km)
sl.bar_chart(jarak, { x: "kota", y: "km", horizontal: true, labels: true, title: "Jarak garis lurus dari Jayapura (km)" })
```

`sl.geo.distance` menghitung jarak garis lurus di permukaan bumi (rumus *haversine*), bukan jarak tempuh jalan atau laut.

> **API Slak baru**
> - `sl.geo.match(nama)` mencocokkan satu nama wilayah dan mengembalikan nama baku, provinsi, dan koordinatnya.
> - `sl.geo.geocode(df, kolom)` menambah kolom `wilayah_baku`, `lat`, dan `lon`.
> - `sl.geo.distance([lat1, lon1], [lat2, lon2])` menghitung jarak dalam km.
> - `sl.geo.province_of(lat, lon)` dan `sl.geo.kabkota_of(lat, lon)` menebak wilayah dari koordinat.

### Peta tiga dimensi

Untuk peta data besar dan tampilan tiga dimensi, Slak menyediakan `sl.pydeck_chart`, yang memakai pustaka deck.gl dengan spesifikasi yang sama seperti pydeck di Python. Pustakanya diunduh saat dipakai, jadi fitur ini **butuh internet**.

> **Coba di playground**
> Di contoh 23.3, tambahkan `tiles: "osm"` ke opsi peta (butuh internet). Bandingkan dengan peta luring bawaan.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Titik muncul di laut atau di luar negeri | `lat` dan `lon` tertukar | Lintang Indonesia sekitar −11 sampai 6, bujur 95 sampai 141 |
| Ada wilayah tidak dikenali di bawah peta | Ejaan terlalu jauh dari nama baku | Perbaiki dengan kamus (Bab 13) atau `sl.geo.match` |
| Peta kosong | `slak-peta.js` belum dimuat | Tambahkan `<script src="slak-peta.js">` |
| Provinsi baru Papua tidak berwarna | Data memakai nama sebelum 2022 | Pakai nama 38 provinsi terbaru, misalnya Papua Barat Daya |

## Latihan

**Latihan 23.1 (mudah).** Buat `perProvinsi` berisi banyak transaksi per provinsi dengan kolom `provinsi` dan `transaksi`, lalu gambar choropleth-nya.

```slak latihan
const trx = await sl.read_csv("toko-nusantara.csv")
const perProvinsi = sl.DataFrame([])   // ganti

sl.choropleth(perProvinsi, { region: "provinsi", value: "transaksi" })
await sl.testing.test("10 provinsi", () => sl.testing.expect(perProvinsi.shape[0]).toBe(10))
await sl.testing.test("jumlahnya benar", () => sl.testing.expect(perProvinsi.transaksi.sum()).toBe(trx.shape[0]))
```

**Latihan 23.2 (sedang).** Cari cabang yang **paling jauh** dari cabang Jakarta. Simpan nama kotanya di `terjauh`.

```slak latihan
const cabang = (await sl.read_csv("cabang.csv")).to_records()
const terjauh = ""   // ganti

sl.write(terjauh)
await sl.testing.test("terjauh dari Jakarta", () => sl.testing.expect(terjauh).toBe("Jayapura"))
```

**Latihan 23.3 (tantangan).** Lengkapi `bakukan(daftar)` yang mengubah larik nama kota berantakan menjadi nama baku dari `sl.geo.match`, atau `null` bila tidak dikenali.

```slak latihan
function bakukan(daftar) {
  return daftar
}

const h = bakukan(["Jaypura", "Timika", "Kota Sorong", "Planet Mars"])
await sl.testing.test("Jaypura dibakukan", () => sl.testing.expect(h[0]).toBe("Kota Jayapura"))
await sl.testing.test("Timika → Kab. Mimika", () => sl.testing.expect(h[1]).toBe("Kab. Mimika"))
await sl.testing.test("tidak dikenali → null", () => sl.testing.expect(h[3]).toBeNull())
```

## Mini-proyek: peta penjualan Toko Nusantara

```slak
sl.title("Peta Penjualan Toko Nusantara :world_map:")

const [trx, cabang] = await Promise.all([sl.read_csv("toko-nusantara.csv"), sl.read_csv("cabang.csv")])
const ukuran = sl.segmented_control("Ukuran", ["Omzet", "Transaksi", "Pelanggan"], { default: "Omzet" })
const kategori = sl.selectbox("Kategori", ["Semua", ...trx.kategori.unique().sort()])

const data = kategori === "Semua" ? trx : trx.filter(r => r.kategori === kategori)
const kolom = { Omzet: "omzet", Transaksi: "transaksi", Pelanggan: "pelanggan" }[ukuran]

const perCabang = data.groupby("cabang").agg({
  omzet: ["total", "sum"], transaksi: ["id_transaksi", "nunique"], pelanggan: ["pelanggan_id", "nunique"]
}).merge(cabang, { on: "cabang" })

const [kiri, kanan] = sl.columns([3, 2])
kiri.map(perCabang, { lat: "lat", lon: "lon", size: kolom, label: "kota" })
kanan.bar_chart(perCabang, { x: "kota", y: kolom, horizontal: true, sort: true, format: "compact", height: 380 })

const perProv = data.groupby("provinsi").agg({ nilai: [kolom === "omzet" ? "total" : kolom === "transaksi" ? "id_transaksi" : "pelanggan_id", kolom === "omzet" ? "sum" : "nunique"] })
sl.choropleth(perProv, { region: "provinsi", value: "nilai", labels: true, title: `${ukuran} per provinsi${kategori === "Semua" ? "" : " · " + kategori}` })

const teratas = perCabang.sort_values(kolom, { ascending: false }).to_records()[0]
sl.info(`${ukuran} ${kategori === "Semua" ? "" : kategori.toLowerCase() + " "}tertinggi ada di **${teratas.kota}**, ${teratas.provinsi}.`)
```

`sl.columns([3, 2])` membagi baris dengan perbandingan lebar 3 : 2. Peta di kiri dan grafik batang di kanan saling melengkapi: peta memperlihatkan **di mana**, grafik memperlihatkan **berapa** dengan tepat.
