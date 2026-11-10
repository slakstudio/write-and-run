# Lampiran D · Kunci Jawaban Latihan

Lampiran ini berisi jawaban lengkap untuk latihan tingkat **mudah** dan **sedang**, jawaban mini-proyek Bab 9, dan **petunjuk** untuk latihan tingkat **tantangan**. Latihan tantangan sengaja tidak diberi jawaban lengkap: uji otomatis di setiap latihan sudah memberi tahu apakah jawabanmu benar.

Setiap jawaban di bawah memuat ujinya, jadi saat dijalankan semua kotaknya hijau. Jawabanmu tidak harus sama persis; yang penting ujinya lulus.

## Bab 1

**Latihan 1.1.** Jawaban bebas, misalnya:

```slak solusi-bebas
sl.title("Rina Wenda")
sl.write("Hobi saya membaca novel dan bersepeda di tepi Danau Sentani.")
```

**Latihan 1.2.**

```slak solusi
const hargaBuku = 45000
const hargaPena = 7500
const total = 2 * hargaBuku + 3 * hargaPena
sl.write("Total: " + total)

await sl.testing.test("total belanja benar", () => sl.testing.expect(total).toBe(112500))
```

**Latihan 1.3 (petunjuk).** `let tautan = await Slak.share.link('sl.title("Kuis Ibu Kota")', "https://slak.studio/playground/")`. Jangan lupa `await`.

## Bab 2

**Latihan 2.1.**

```slak solusi
const produk = "Sagu Lempeng 1kg"
const harga = 30000
const kalimat = `${produk} harganya ${harga}`
sl.write(kalimat)

await sl.testing.test("kalimat benar", () => sl.testing.expect(kalimat).toBe("Sagu Lempeng 1kg harganya 30000"))
```

**Latihan 2.2.**

```slak solusi
const jumlahTeks = "4"
const hargaTeks = "22000"
const total = Number(jumlahTeks) * Number(hargaTeks)

sl.write(total)
await sl.testing.test("total berupa angka", () => sl.testing.expect(typeof total).toBe("number"))
await sl.testing.test("total = 88000", () => sl.testing.expect(total).toBe(88000))
```

**Latihan 2.3 (petunjuk).** `Number(isian)` menghasilkan `NaN` bila isian bukan angka. `Number.isNaN(...)` bernilai `true` untuk `NaN`, jadi `sah` adalah kebalikannya: pakai `!`.

## Bab 3

**Latihan 3.1.**

```slak solusi
function lulus(nilai) {
  if (nilai >= 75) return "Lulus"
  return "Belum lulus"
}

await sl.testing.test("80 lulus", () => sl.testing.expect(lulus(80)).toBe("Lulus"))
await sl.testing.test("75 lulus", () => sl.testing.expect(lulus(75)).toBe("Lulus"))
await sl.testing.test("74 belum lulus", () => sl.testing.expect(lulus(74)).toBe("Belum lulus"))
```

**Latihan 3.2.**

```slak solusi
function diskon(total, anggota) {
  if (total >= 500000 || anggota) return total * 0.1
  return 0
}

await sl.testing.test("600 ribu, bukan anggota", () => sl.testing.expect(diskon(600000, false)).toBe(60000))
await sl.testing.test("200 ribu, anggota", () => sl.testing.expect(diskon(200000, true)).toBe(20000))
await sl.testing.test("200 ribu, bukan anggota", () => sl.testing.expect(diskon(200000, false)).toBe(0))
```

**Latihan 3.3 (petunjuk).** Periksa dari syarat yang paling khusus: habis dibagi 400 → kabisat; habis dibagi 100 → bukan; habis dibagi 4 → kabisat; selain itu bukan. "Habis dibagi 4" ditulis `tahun % 4 === 0`.

## Bab 4

**Latihan 4.1.**

```slak solusi
let jumlah = 0
for (let i = 1; i <= 100; i++) jumlah += i

sl.write(jumlah)
await sl.testing.test("1 + 2 + ... + 100 = 5050", () => sl.testing.expect(jumlah).toBe(5050))
```

**Latihan 4.2.**

```slak solusi
const omzet = [1250000, 980000, 1430000, 1100000, 1675000, 2010000, 1890000]
let hariRamai = 0
for (const x of omzet) {
  if (x > 1500000) hariRamai++
}

sl.write(hariRamai)
await sl.testing.test("ada 3 hari ramai", () => sl.testing.expect(hariRamai).toBe(3))
```

**Latihan 4.3 (petunjuk).** Simpan dua hal di luar perulangan: nilai terendah sejauh ini dan posisinya. Pakai `for (let i = 0; i < omzet2.length; i++)` supaya kamu punya indeks `i`.

## Bab 5

**Latihan 5.1.**

```slak solusi
function luasPersegiPanjang(p, l) {
  return p * l
}

await sl.testing.test("4 × 5 = 20", () => sl.testing.expect(luasPersegiPanjang(4, 5)).toBe(20))
await sl.testing.test("2,5 × 2 = 5", () => sl.testing.expect(luasPersegiPanjang(2.5, 2)).toBe(5))
```

**Latihan 5.2.**

```slak solusi
const rentang = (data) => Math.max(...data) - Math.min(...data)

await sl.testing.test("rentang [3, 9, 4] = 6", () => sl.testing.expect(rentang([3, 9, 4])).toBe(6))
await sl.testing.test("rentang [5] = 0", () => sl.testing.expect(rentang([5])).toBe(0))
```

**Latihan 5.3 (petunjuk).** Salin dulu dengan `[...data]`, urutkan dengan `sort((a, b) => a - b)`, lalu buang ujung-ujungnya dengan `slice(1, -1)`. Rata-ratakan sisanya.

## Bab 6

**Latihan 6.1.**

```slak solusi
const harga = [50000, 80000, 125000]
const hargaPromo = harga.map(h => h * 0.8)

sl.write(hargaPromo)
await sl.testing.test("dipotong 20%", () => sl.testing.expect(hargaPromo).toEqual([40000, 64000, 100000]))
```

**Latihan 6.2.**

```slak solusi
const nilai = [80, 62, 91, 75, 58, 88]
const lulus = nilai.filter(n => n >= 75)
const rataLulus = lulus.reduce((a, n) => a + n, 0) / lulus.length

sl.write(rataLulus)
await sl.testing.test("rata-rata yang lulus = 83.5", () => sl.testing.expect(rataLulus).toBe(83.5))
```

**Latihan 6.3 (petunjuk).** `[...omzet].sort((a, b) => b - a).slice(0, 3)`. Salinan `[...omzet]` menjaga larik aslinya.

## Bab 7

**Latihan 7.1.**

```slak solusi
const cabang = { kota: "Ambon", buka: 2021 }

sl.write(cabang)
await sl.testing.test("kota Ambon", () => sl.testing.expect(cabang.kota).toBe("Ambon"))
await sl.testing.test("buka 2021", () => sl.testing.expect(cabang.buka).toBe(2021))
```

**Latihan 7.2.**

```slak solusi
const rows = sl.dataset("penjualan").to_records()
const omzetPakaian = rows.filter(r => r.kategori === "Pakaian").reduce((a, r) => a + r.total, 0)

sl.metric("Omzet pakaian", omzetPakaian)
await sl.testing.test("omzet pakaian benar", () => sl.testing.expect(omzetPakaian).toBe(
  rows.filter(r => r.kategori === "Pakaian").reduce((a, r) => a + r.total, 0)))
await sl.testing.test("tidak nol", () => sl.testing.expect(omzetPakaian).toBeGreaterThan(0))
```

**Latihan 7.3 (petunjuk).** `for (const r of data) omzetPerKota[r.kota] = (omzetPerKota[r.kota] || 0) + r.total`.

## Bab 8

**Latihan 8.1.**

```slak solusi
const mentah = "  makassar "
const t = mentah.trim()
const rapi = t.charAt(0).toUpperCase() + t.slice(1)

sl.write(`[${rapi}]`)
await sl.testing.test("menjadi Makassar", () => sl.testing.expect(rapi).toBe("Makassar"))
```

**Latihan 8.2.**

```slak solusi
function keAngka(teks) {
  return Number(String(teks).replace(/[^0-9]/g, ""))
}

await sl.testing.test('"Rp 42.000" → 42000', () => sl.testing.expect(keAngka("Rp 42.000")).toBe(42000))
await sl.testing.test('"42000" → 42000', () => sl.testing.expect(keAngka("42000")).toBe(42000))
await sl.testing.test('"Rp 1.250.000" → 1250000', () => sl.testing.expect(keAngka("Rp 1.250.000")).toBe(1250000))
```

**Latihan 8.3 (petunjuk).** Selisih hari: `Math.round((new Date(b) - new Date(a)) / (24 * 60 * 60 * 1000))`. Nama hari: `new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(new Date(teks))`.

## Bab 9

**Latihan 9.1.**

```slak solusi
function namaHari(nomor) {
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
  return hari[nomor]
}

await sl.testing.test("0 = Minggu", () => sl.testing.expect(namaHari(0)).toBe("Minggu"))
await sl.testing.test("5 = Jumat", () => sl.testing.expect(namaHari(5)).toBe("Jumat"))
```

**Latihan 9.2.**

```slak solusi
function bacaHarga(teks) {
  try {
    return JSON.parse(teks)
  } catch (e) {
    return null
  }
}

await sl.testing.test("JSON sah terbaca", () => sl.testing.expect(bacaHarga('{"harga": 5000}')).toEqual({ harga: 5000 }))
await sl.testing.test("JSON rusak menjadi null", () => sl.testing.expect(bacaHarga('{"harga": ')).toBeNull())
```

**Latihan 9.3 (petunjuk).** Lempar galat lebih dulu: `if (keseluruhan === 0) throw new Error("...")`. Untuk membulatkan satu desimal: `Math.round(x * 10) / 10`.

**Mini-proyek Bab 9: kelima bug kasir.**

1. `subtotal` menjumlah, padahal seharusnya mengalikan: `item.harga * item.jumlah`.
2. Harga gelang tersimpan sebagai teks `"40000"`: ubah dengan `Number(item.harga)`.
3. Perulangan di `totalBelanja` mulai dari `i = 1`, sehingga barang pertama terlewat: mulai dari `0`.
4. Diskon seharusnya berlaku **mulai tepat** 250.000: pakai `>=`, bukan `>`.
5. PPN 11% adalah `× 0,11`, bukan `× 11`.

```slak solusi
sl.title("Kasir Toko Nusantara :convenience_store:")

const keranjang = [
  { produk: "Kopi Arabika Wamena 250g", harga: 85000, jumlah: 2 },
  { produk: "Keripik Keladi 200g", harga: 22000, jumlah: 3 },
  { produk: "Gelang Manik Papua", harga: "40000", jumlah: 1 }
]

function subtotal(item) {
  return Number(item.harga) * item.jumlah
}

function totalBelanja(daftar) {
  let total = 0
  for (let i = 0; i < daftar.length; i++) total += subtotal(daftar[i])
  return total
}

function diskon(total) {
  if (total >= 250000) return total * 0.05
  return 0
}

function ppn(setelahDiskon) {
  return setelahDiskon * 0.11
}

const total = totalBelanja(keranjang)
const pot = diskon(total)
const pajak = ppn(total - pot)

sl.dataframe(keranjang)
sl.metric("Total", total, null, { format: "rp" })
sl.metric("Bayar", total - pot + pajak, null, { format: "rp" })

const { test, expect } = sl.testing
await test("subtotal kopi = 170000", () => expect(subtotal(keranjang[0])).toBe(170000))
await test("subtotal gelang = 40000", () => expect(subtotal(keranjang[2])).toBe(40000))
await test("total belanja = 276000", () => expect(totalBelanja(keranjang)).toBe(276000))
await test("diskon 5% mulai tepat 250000", () => expect(diskon(250000)).toBe(12500))
await test("PPN 11% dari 100000 = 11000", () => expect(ppn(100000)).toBe(11000))
```

## Bab 10

**Latihan 10.1.** Baris `ss.hitung = 0` harus dijalankan hanya bila `hitung` belum ada.

```slak solusi
const kode = `
const ss = sl.session_state
if (!("hitung" in ss)) ss.hitung = 0
if (sl.button("Tambah")) ss.hitung++
sl.metric("Hitungan", ss.hitung)
`
sl.code(kode)

await sl.testing.test("tiga klik menjadi 3", async () => {
  const at = await sl.testing.run(kode)
  for (let i = 0; i < 3; i++) await at.button("Tambah").click().run()
  sl.testing.expect(at.metric("Hitungan").value).toBe(3)
})
```

**Latihan 10.2.**

```slak solusi
const kode2 = `
const s = sl.session_state
if (!s.daftar) s.daftar = ["kopi", "sagu", "abon"]
const hapusTerakhir = () => { s.daftar = s.daftar.slice(0, -1) }
sl.button("Hapus terakhir", { on_click: hapusTerakhir })
sl.write(s.daftar.length + " barang")
`
sl.code(kode2)

await sl.testing.test("satu kali hapus menyisakan 2 barang", async () => {
  const at = await sl.testing.run(kode2)
  await at.button("Hapus terakhir").click().run()
  sl.testing.expect(at.session_state.daftar).toEqual(["kopi", "sagu"])
})
```

**Latihan 10.3 (petunjuk).** Jalankan `sl.code(sl.crypto.quiz_hash("Manokwari"))` di playground, salin hasilnya (diawali `sq1$`), lalu tempelkan sebagai isi `KUNCI`.

## Bab 11

**Latihan 11.1.**

```slak solusi
const csv = `nama,harga
Kopi Wamena,85000
Sagu Lempeng,30000
Sambal Roa,45000`

const baris = csv.trim().split("\n").slice(1)
const produk = baris.map(b => {
  const [nama, harga] = b.split(",")
  return { nama, harga: Number(harga) }
})

sl.write(produk)
await sl.testing.test("ada 3 produk", () => sl.testing.expect(produk).toHaveLength(3))
await sl.testing.test("harga berupa angka", () => sl.testing.expect(produk[1]).toEqual({ nama: "Sagu Lempeng", harga: 30000 }))
```

**Latihan 11.2.**

```slak solusi
const cabang = (await sl.read_csv("cabang.csv")).to_records()
const kotaPapua = cabang.filter(c => c.provinsi.startsWith("Papua")).map(c => c.kota)

sl.write(kotaPapua)
await sl.testing.test("tiga kota di tanah Papua", () => sl.testing.expect(kotaPapua).toEqual(["Jayapura", "Sorong", "Manokwari"]))
```

**Latihan 11.3 (petunjuk).** `const teks = JSON.stringify(laporan)` lalu `const salinan = JSON.parse(teks)`.

## Bab 12

**Latihan 12.1.**

```slak solusi
async function ambilStok() {
  await sl.sleep(100)
  return 24
}
const stok = await ambilStok()

sl.write(stok)
await sl.testing.test("stok = 24", () => sl.testing.expect(stok).toBe(24))
```

**Latihan 12.2.**

```slak solusi
const omzetCabang = async (n) => { await sl.sleep(300); return n }
const t0 = performance.now()

const hasil = await Promise.all([omzetCabang(100), omzetCabang(200), omzetCabang(300)])
const total = hasil.reduce((a, b) => a + b, 0)

const lama = performance.now() - t0
await sl.testing.test("total = 600", () => sl.testing.expect(total).toBe(600))
await sl.testing.test("berjalan bersamaan", () => sl.testing.expect(lama).toBeLessThan(500))
```

**Latihan 12.3 (petunjuk).** Bungkus `return await fn()` dengan `try { ... } catch (e) { return null }`. `await` di dalam `try` penting: tanpanya, galat dari Promise tidak tertangkap.

## Bab 13

**Latihan 13.1.**

```slak solusi
function bersihkanKanal(k) {
  if (k == null || String(k).trim() === "") return "Tidak diketahui"
  const t = String(k).trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const { test, expect } = sl.testing
await test('" online " → Online', () => expect(bersihkanKanal(" online ")).toBe("Online"))
await test('"TOKO" → Toko', () => expect(bersihkanKanal("TOKO")).toBe("Toko"))
await test("null → Tidak diketahui", () => expect(bersihkanKanal(null)).toBe("Tidak diketahui"))
await test('"" → Tidak diketahui', () => expect(bersihkanKanal("")).toBe("Tidak diketahui"))
```

**Latihan 13.2.** Telusuri dari belakang, atau pakai `Map` yang selalu ditimpa dengan baris terbaru.

```slak solusi
function buangGanda(data) {
  const terakhir = new Map()
  for (const r of data) terakhir.set(r.id, r)
  return [...terakhir.values()]
}

const d = [{ id: 1, v: "lama" }, { id: 2, v: "x" }, { id: 1, v: "baru" }]
await sl.testing.test("tersisa 2 baris", () => sl.testing.expect(buangGanda(d)).toHaveLength(2))
await sl.testing.test("id 1 berisi yang baru", () => sl.testing.expect(buangGanda(d).find(r => r.id === 1).v).toBe("baru"))
```

**Latihan 13.3 (petunjuk).** Tambahkan pola `/^(\d{4})\.(\d{2})\.(\d{2})$/`. Titik di dalam pola harus ditulis `\.`, karena titik tanpa garis miring berarti "karakter apa saja".

## Bab 14

**Latihan 14.1.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const nOnline = df.query("kanal == 'Online'").shape[0]

sl.metric("Transaksi online", nOnline)
await sl.testing.test("banyak transaksi online benar", () =>
  sl.testing.expect(nOnline).toBe(df.to_records().filter(r => r.kanal === "Online").length))
```

**Latihan 14.2.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const murah = df
  .filter(r => r.kategori === "Makanan" && r.harga < 40000)
  .select(["produk", "harga"])
  .sort_values("harga")

sl.dataframe(murah.head())
await sl.testing.test("dua kolom", () => sl.testing.expect(murah.columns).toEqual(["produk", "harga"]))
await sl.testing.test("semua di bawah 40 ribu", () => sl.testing.expect(murah.harga.max()).toBeLessThan(40000))
await sl.testing.test("urut naik", () => sl.testing.expect(murah.harga.to_list()[0]).toBe(murah.harga.min()))
```

**Latihan 14.3 (petunjuk).** `df.assign({ margin: r => r.total * 0.4 })`, lalu saring kanal Toko dan ambil `.margin.mean()`.

## Bab 15

**Latihan 15.1.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const nPelanggan = df.pelanggan_id.nunique()

sl.metric("Pelanggan", nPelanggan)
await sl.testing.test("banyak pelanggan benar", () => sl.testing.expect(nPelanggan).toBe(new Set(df.pelanggan_id.to_list()).size))
```

**Latihan 15.2.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const perCabang = df.groupby("cabang").agg({
  omzet: ["total", "sum"],
  pelanggan: ["pelanggan_id", "nunique"]
}).sort_values("omzet", { ascending: false })

sl.dataframe(perCabang)
await sl.testing.test("10 cabang", () => sl.testing.expect(perCabang.shape[0]).toBe(10))
await sl.testing.test("kolom benar", () => sl.testing.expect(perCabang.columns).toEqual(["cabang", "omzet", "pelanggan"]))
await sl.testing.test("teratas Surabaya", () => sl.testing.expect(perCabang.to_records()[0].cabang).toBe("Nusantara Surabaya"))
```

**Latihan 15.3 (petunjuk).** Saring kategori Minuman dulu ke variabel `m`, lalu bagi omzet online `m` dengan omzet seluruh `m`.

## Bab 16

**Latihan 16.1.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const perKategori = df.groupby("kategori").agg({ omzet: ["total", "sum"] })

sl.bar_chart(perKategori, { x: "kategori", y: "omzet", sort: true })
await sl.testing.test("lima kategori", () => sl.testing.expect(perKategori.shape[0]).toBe(5))
await sl.testing.test("kolom omzet ada", () => sl.testing.expect(perKategori.columns).toContain("omzet"))
```

**Latihan 16.2.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const harian = df.resample("tanggal", "D").agg({ omzet: ["total", "sum"] })
const perHari = harian
  .assign({ hari: () => harian.tanggal.dt.day_name() })
  .groupby("hari").agg({ rata_omzet: ["omzet", "mean"] })

sl.bar_chart(perHari, { x: "hari", y: "rata_omzet" })
await sl.testing.test("tujuh hari", () => sl.testing.expect(perHari.shape[0]).toBe(7))
await sl.testing.test("Sabtu lebih ramai dari Selasa", () => {
  const r = Object.fromEntries(perHari.to_records().map(x => [x.hari, x.rata_omzet]))
  sl.testing.expect(r.Sabtu).toBeGreaterThan(r.Selasa)
})
```

**Latihan 16.3 (petunjuk).** `df.assign({ bulan: () => df.tanggal.dt.month, tahun: () => df.tanggal.dt.year.astype("str") })`, lalu `groupby(["tahun", "bulan"])`.

## Bab 17

**Latihan 17.1.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
function saring(data, kanal) {
  if (kanal === "Semua") return data
  return data.filter(r => r.kanal === kanal)
}

await sl.testing.test("Semua tidak menyaring", () => sl.testing.expect(saring(df, "Semua").shape[0]).toBe(df.shape[0]))
await sl.testing.test("Online saja", () => sl.testing.expect(saring(df, "Online").kanal.unique()).toEqual(["Online"]))
```

**Latihan 17.2.**

```slak solusi
const aplikasi = `
const df = await sl.read_csv("toko-nusantara.csv")
const tahun = Number(sl.selectbox("Tahun", ["2024", "2023"]))
const data = df.filter(r => r.tanggal.getFullYear() === tahun)
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

**Latihan 17.3 (petunjuk).** Kelompokkan per cabang, ambil yang teratas, lalu format porsinya dengan `(porsi * 100).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })`.

## Bab 18

**Latihan 18.1.**

```slak solusi
const trx = await sl.read_csv("toko-nusantara.csv")
const cabang = await sl.read_csv("cabang.csv")
const hasil = trx.merge(cabang.select(["cabang", "kode"]), { on: "cabang", how: "left" })

await sl.testing.test("banyak baris tetap", () => sl.testing.expect(hasil.shape[0]).toBe(trx.shape[0]))
await sl.testing.test("kolom kode ada", () => sl.testing.expect(hasil.columns).toContain("kode"))
await sl.testing.test("tidak ada kode kosong", () => sl.testing.expect(hasil.kode.isna().sum()).toBe(0))
```

**Latihan 18.2.**

```slak solusi
function tambahKategori(trx, produk) {
  const kamus = new Map(produk.map(p => [p.produk, p.kategori]))
  return trx.map(t => ({ ...t, kategori_produk: kamus.get(t.produk) ?? null }))
}

const trx = [{ produk: "Topi Rotan", total: 85000 }, { produk: "Sambal Roa 200g", total: 45000 }, { produk: "Tidak Ada", total: 1 }]
const produk = (await sl.read_csv("produk.csv")).to_records()
const h = tambahKategori(trx, produk)
await sl.testing.test("Topi Rotan → Pakaian", () => sl.testing.expect(h[0].kategori_produk).toBe("Pakaian"))
await sl.testing.test("produk tidak dikenal → null", () => sl.testing.expect(h[2].kategori_produk).toBeNull())
await sl.testing.test("data asli tidak berubah", () => sl.testing.expect("kategori_produk" in trx[0]).toBe(false))
```

**Latihan 18.3 (petunjuk).** Tiru contoh 18.4: kelompokkan omzet per `["cabang", "bulan"]`, gabungkan dengan `target` memakai dua kunci, lalu hitung baris dengan `omzet >= target` dibagi seluruh baris.

## Bab 19

**Latihan 19.1.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const [q1, q3] = sl.stats.quantile(df.total, [0.25, 0.75])
const iqr = q3 - q1

sl.write(iqr)
await sl.testing.test("IQR benar", () => sl.testing.expect(iqr).toBe(sl.stats.iqr(df.total)))
```

**Latihan 19.2.**

```slak solusi
function batasPencilan(x) {
  const [q1, q3] = sl.stats.quantile(x, [0.25, 0.75])
  const iqr = q3 - q1
  return [q1 - 1.5 * iqr, q3 + 1.5 * iqr]
}

const df = await sl.read_csv("toko-nusantara.csv")
await sl.testing.test("batas sama dengan Slak", () => sl.testing.expect(batasPencilan(df.total)).toEqual(df.outliers("total").bounds))
```

**Latihan 19.3 (petunjuk).** Saring dua cabang dulu: `df.filter(r => r.kota === "Jayapura" || r.kota === "Jakarta")`, lalu `sl.stats.ttest_ind(data, { value: "total", group: "kota" })`. `berbeda` adalah `hasil.p_value < 0.05`.

## Bab 20

**Latihan 20.1.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const kuartalan = df.resample("tanggal", "Q").agg({ omzet: ["total", "sum"] })

sl.dataframe(kuartalan)
await sl.testing.test("8 kuartal", () => sl.testing.expect(kuartalan.shape[0]).toBe(8))
await sl.testing.test("jumlahnya sama dengan total omzet", () => sl.testing.expect(kuartalan.omzet.sum()).toBe(df.total.sum()))
```

**Latihan 20.2.**

```slak solusi
function pertumbuhan(x) {
  return x.map((v, i) => i === 0 ? null : v / x[i - 1] - 1)
}

await sl.testing.test("[100, 110, 99]", () => {
  const p = pertumbuhan([100, 110, 99])
  sl.testing.expect(p[0]).toBeNull()
  sl.testing.expect(p[1]).toBeCloseTo(0.1, 6)
  sl.testing.expect(p[2]).toBeCloseTo(-0.1, 6)
})
```

**Latihan 20.3 (petunjuk).** Untuk setiap tahun, `resample` per bulan, cari baris dengan omzet terbesar dengan `reduce`, lalu simpan `tanggal.getMonth() + 1`.

## Bab 21

**Latihan 21.1.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = await sl.sql(`
  SELECT kanal, SUM(total) AS omzet
  FROM jual
  GROUP BY kanal
  ORDER BY omzet DESC
`, { jual: df })

sl.dataframe(hasil)
const r = hasil.to_records()
await sl.testing.test("dua kanal", () => sl.testing.expect(r).toHaveLength(2))
await sl.testing.test("Toko teratas", () => sl.testing.expect(r[0].kanal).toBe("Toko"))
await sl.testing.test("omzet benar", () => sl.testing.expect(r[0].omzet + r[1].omzet).toBe(df.total.sum()))
```

**Latihan 21.2.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const hasil = await sl.sql(`
  WITH per_produk AS (
    SELECT kota, produk, SUM(jumlah) AS terjual,
           RANK() OVER (PARTITION BY kota ORDER BY SUM(jumlah) DESC) AS peringkat
    FROM jual
    GROUP BY kota, produk
  )
  SELECT kota, produk, terjual
  FROM per_produk
  WHERE peringkat = 1
  GROUP BY kota
  ORDER BY kota
`, { jual: df })

sl.dataframe(hasil)
await sl.testing.test("sepuluh kota", () => sl.testing.expect(hasil.shape[0]).toBe(10))
await sl.testing.test("kolom benar", () => sl.testing.expect(hasil.columns).toEqual(["kota", "produk", "terjual"]))
```

`GROUP BY kota` di bagian akhir memastikan satu baris per kota walau ada dua produk yang terjual sama banyak.

**Latihan 21.3 (petunjuk).** CTE berisi `to_char(tanggal, 'YYYY-MM') AS bulan` dan `SUM(total) AS omzet` dengan `WHERE EXTRACT(YEAR FROM tanggal) = 2024`, lalu `SUM(omzet) OVER (ORDER BY bulan) AS kumulatif`.

## Bab 22

**Latihan 22.1.**

```slak solusi
function regresi(x, y) {
  const n = x.length
  const rx = x.reduce((a, v) => a + v, 0) / n
  const ry = y.reduce((a, v) => a + v, 0) / n
  let atas = 0, bawah = 0
  for (let i = 0; i < n; i++) {
    atas += (x[i] - rx) * (y[i] - ry)
    bawah += (x[i] - rx) ** 2
  }
  const b = atas / bawah
  return { a: ry - b * rx, b }
}

const hasil = regresi([1, 2, 3, 4], [3, 5, 7, 9])
await sl.testing.test("kemiringan 2", () => sl.testing.expect(hasil.b).toBeCloseTo(2, 6))
await sl.testing.test("titik potong 1", () => sl.testing.expect(hasil.a).toBeCloseTo(1, 6))
```

**Latihan 22.2.**

```slak solusi
const df = await sl.read_csv("toko-nusantara.csv")
const rfmKu = sl.analysis.rfm(df, { customer: "pelanggan_id", date: "tanggal", amount: "total" })
const porsiBerisiko = rfmKu.filter(r => r.segmen === "Berisiko" || r.segmen === "Jangan Sampai Hilang").shape[0] / rfmKu.shape[0]

sl.metric("Pelanggan berisiko", (porsiBerisiko * 100).toFixed(1) + "%")
const rfm = sl.analysis.rfm(df, { customer: "pelanggan_id", date: "tanggal", amount: "total" })
await sl.testing.test("porsi benar", () => sl.testing.expect(porsiBerisiko).toBeCloseTo(
  rfm.filter(r => ["Berisiko", "Jangan Sampai Hilang"].includes(r.segmen)).shape[0] / rfm.shape[0], 6))
```

**Latihan 22.3 (petunjuk).** Tiru contoh pohon keputusan di 22.5, ganti dengan `sl.ml.RandomForestClassifier({ n_estimators: 100, max_depth: 8 })`, lalu `sl.ml.accuracy_score(uji.churn, tebakan)`.

## Bab 23

**Latihan 23.1.**

```slak solusi
const trx = await sl.read_csv("toko-nusantara.csv")
const perProvinsi = trx.groupby("provinsi").agg({ transaksi: ["id_transaksi", "nunique"] })

sl.choropleth(perProvinsi, { region: "provinsi", value: "transaksi" })
await sl.testing.test("10 provinsi", () => sl.testing.expect(perProvinsi.shape[0]).toBe(10))
await sl.testing.test("jumlahnya benar", () => sl.testing.expect(perProvinsi.transaksi.sum()).toBe(trx.shape[0]))
```

**Latihan 23.2.**

```slak solusi
const cabang = (await sl.read_csv("cabang.csv")).to_records()
const jkt = cabang.find(c => c.kota === "Jakarta")
const terjauh = cabang
  .map(c => ({ kota: c.kota, km: sl.geo.distance([jkt.lat, jkt.lon], [c.lat, c.lon]) }))
  .reduce((a, c) => c.km > a.km ? c : a).kota

sl.write(terjauh)
await sl.testing.test("terjauh dari Jakarta", () => sl.testing.expect(terjauh).toBe("Jayapura"))
```

**Latihan 23.3 (petunjuk).** `daftar.map(n => { const m = sl.geo.match(n); return m ? m.nama : null })`.

## Bab 24

**Latihan 24.1.**

```slak solusi
const Format = {
  rupiah(x) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(x) },
  persen(x) { return new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 }).format(x) }
}

await sl.testing.test("rupiah", () => sl.testing.expect(Format.rupiah(1250000)).toBe(new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(1250000)))
await sl.testing.test("persen", () => sl.testing.expect(Format.persen(0.125)).toBe("12,5%"))
```

**Latihan 24.2.**

```slak solusi
class Produk {
  constructor(nama, hargaJual, hargaPokok) {
    this.nama = nama
    this.hargaJual = hargaJual
    this.hargaPokok = hargaPokok
  }
  get margin() { return (this.hargaJual - this.hargaPokok) / this.hargaJual }
  laku(n) { return (this.hargaJual - this.hargaPokok) * n }
}

const kopi = new Produk("Kopi Wamena", 85000, 52000)
await sl.testing.test("margin kopi", () => sl.testing.expect(kopi.margin).toBeCloseTo(0.388, 3))
await sl.testing.test("laba 10 buah", () => sl.testing.expect(kopi.laku(10)).toBe(330000))
```

**Latihan 24.3 (petunjuk).** `await at.slider("Diskon (%)").set_value(25).run()`, lalu `sl.testing.expect(at.metric("Bayar").value).toBe(75000)`.

## Bab 25

Latihan Bab 25 terbuka. Contoh arah penyelesaiannya:

**Latihan 25.1.** Tambahkan fungsi halaman berikut, lalu daftarkan `sl.page("Pelanggan", halPelanggan, { icon: "👥" })` di kelompok "Analisis".

```slak tanpa-jalan lewati
function halPelanggan(sl) {
  sl.title("Pelanggan")
  sl.caption(keterangan)
  const rfm = sl.analysis.rfm(ini, { customer: "pelanggan_id", date: "tanggal", amount: "total" })
  sl.bar_chart(rfm.value_counts("segmen"), { x: "segmen", y: "jumlah", horizontal: true, sort: true })
  sl.dataframe(rfm.filter(r => r.segmen === "Berisiko").sort_values("monetary", { ascending: false }).head(10))
}
```

**Latihan 25.2.** Tambahkan `const pembanding = sl.sidebar.radio("Bandingkan dengan", ["Tahun lalu", "Target"], { key: "f_banding" })` di bagian filter. Di halaman Ringkasan, hitung total target tahun terpilih dari `target.csv` (saring `bulan` yang diawali tahun itu, dan cabang terpilih), lalu pakai sebagai `a` di `banding(a, r.omzet)` bila pembandingnya "Target".

**Latihan 25.3.** Di dalam uji, ulangi untuk setiap kombinasi `["2024", "2023"]` × `["Semua", "Toko", "Online"]`. Untuk setiap kombinasi, set widgetnya, baca `at.metric("Omzet").value` di halaman Ringkasan, pindah ke halaman Penjualan dengan `at.switch_page("Penjualan")`, lalu bandingkan dengan jumlah kolom `omzet` grafik per cabang: `at.bar_chart[0].value`. Bila datanya berupa DataFrame, jumlahkan dengan `.omzet.sum()`.
