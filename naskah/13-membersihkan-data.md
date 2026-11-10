# Bab 13 · Membersihkan Data dengan JavaScript Murni

> **Tujuan belajar**
> - Memeriksa kualitas data: nilai kosong, duplikat, format campur, salah ketik, dan pencilan.
> - Menulis fungsi pembersih yang bisa dipakai ulang dengan JavaScript murni.
> - Menyeragamkan teks, angka, dan tanggal.
> - Memperbaiki sel secara manual dengan tabel yang bisa diedit.

Kata orang, 80% pekerjaan analis data adalah membersihkan data. Angka itu tidak berlebihan. Data dari kasir, formulir, atau gabungan beberapa cabang hampir selalu berantakan, dan analisis dari data kotor menghasilkan kesimpulan yang salah.

Di bab ini kamu membersihkan `toko-nusantara-kotor.csv` dengan JavaScript murni: `map`, `filter`, objek, dan teks. Di bab berikutnya kamu mengulang semua langkah ini dengan Slak Data, dalam jauh lebih sedikit baris.

## 13.1 Kenali dulu kotorannya

```slak
const mentah = (await sl.read_csv("toko-nusantara-kotor.csv")).to_records()
sl.write(`${mentah.length} baris`)
sl.code(JSON.stringify(mentah.slice(0, 6), null, 1))
```

`JSON.stringify(x, null, 1)` menampilkan isi data **apa adanya**, termasuk spasi dan tanda kutip, sehingga kotorannya terlihat jelas. Tabel `sl.dataframe` sengaja merapikan tampilan, jadi untuk memeriksa data mentah, lihat teksnya.

Mari menghitung masalahnya satu per satu:

```slak
const data = (await sl.read_csv("toko-nusantara-kotor.csv")).to_records()
const kolom = Object.keys(data[0])

const kosong = {}
for (const k of kolom) kosong[k] = data.filter(r => r[k] == null || r[k] === "").length
sl.write("Nilai kosong per kolom:")
sl.json(kosong)

const id = data.map(r => r.id_transaksi)
sl.write(`ID ganda: ${id.length - new Set(id).size}`)

const ejaanKota = [...new Set(data.map(r => r.kota))]
sl.write(`Ejaan kota yang berbeda: ${ejaanKota.length}`)
sl.code(JSON.stringify(ejaanKota))

const contohHarga = [...new Set(data.map(r => typeof r.harga))]
sl.write(`Tipe kolom harga: ${contohHarga.join(", ")}`)
```

- `new Set(larik)` membuat himpunan: nilai yang sama hanya disimpan sekali. `set.size` adalah banyaknya nilai unik.
- `[...new Set(larik)]` mengubahnya kembali menjadi larik berisi nilai-nilai unik.

Hanya tiga kota, tetapi ejaannya lebih dari sepuluh. Ada transaksi ganda, nilai kosong, dan harga yang sebagian berupa teks `"Rp 42.000"`. Daftar pekerjaan kita:

1. Rapikan teks: spasi berlebih dan huruf besar-kecil.
2. Seragamkan nama kota, termasuk salah ketik.
3. Ubah harga menjadi angka.
4. Ubah tanggal menjadi `Date`, dari tiga format berbeda.
5. Tangani nilai kosong.
6. Buang transaksi ganda.
7. Tangani pencilan.

## 13.2 Fungsi pembersih teks

```slak
function rapikan(teks) {
  if (teks == null) return null
  return String(teks).trim().replace(/\s+/g, " ")
}

function hurufJudul(teks) {
  if (teks == null) return null
  return rapikan(teks).toLowerCase().split(" ")
    .map(kata => kata.charAt(0).toUpperCase() + kata.slice(1))
    .join(" ")
}

sl.write(`[${rapikan("  Kopi   Wamena ")}]`)
sl.write(hurufJudul("  GELANG manik papua "))
```

`/\s+/g` adalah pola untuk "satu atau lebih spasi". Menggantinya dengan satu spasi merapikan spasi ganda di tengah teks.

## 13.3 Menyeragamkan nama kota

Setelah huruf judul, sisa masalahnya adalah salah ketik. Untuk itu, buat **kamus perbaikan**: objek yang memetakan ejaan salah ke ejaan benar.

```slak
const PERBAIKAN_KOTA = { Jayapra: "Jayapura", Makasar: "Makassar", Surabya: "Surabaya" }

function normalKota(teks) {
  if (teks == null) return null
  const t = teks.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase())
  return PERBAIKAN_KOTA[t] || t
}

for (const k of ["jayapura", " Jayapura", "JAYAPURA", "Jayapra", "makassar ", "Makasar", " SURABAYA "]) {
  sl.write(`"${k}" → ${normalKota(k)}`)
}
```

`PERBAIKAN_KOTA[t] || t` berarti "ambil perbaikannya bila ada, bila tidak pakai `t` itu sendiri". Kamus seperti ini lebih mudah dirawat daripada deretan `if`: menambah perbaikan baru cukup menambah satu pasangan.

## 13.4 Angka dari teks

Kamu sudah menulis fungsi ini di Latihan 8.2. Kini tambahkan penanganan nilai kosong:

```slak
function keAngka(x) {
  if (x == null || x === "") return null
  if (typeof x === "number") return x
  const bersih = String(x).replace(/[^0-9,-]/g, "").replace(",", ".")
  const n = Number(bersih)
  return Number.isNaN(n) ? null : n
}

sl.write(keAngka("Rp 42.000"))
sl.write(keAngka(31500))
sl.write(keAngka("Rp 1.250.000,50"))
sl.write(keAngka(""))
```

Titik ribuan dibuang, dan koma desimal diganti titik supaya dipahami JavaScript.

## 13.5 Tanggal dari tiga format

Kolom `tanggal` berisi tiga gaya: `2024-02-14`, `14/02/2024`, dan `14 Februari 2024`. Fungsi berikut mengenali ketiganya dan selalu mengembalikan `Date`.

```slak
const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli",
               "agustus", "september", "oktober", "november", "desember"]

function keTanggal(teks) {
  if (teks == null || teks === "") return null
  const t = String(teks).trim()
  let m
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3])
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return new Date(+m[3], +m[2] - 1, +m[1])
  if ((m = t.match(/^(\d{1,2}) (\w+) (\d{4})$/))) {
    const b = BULAN.indexOf(m[2].toLowerCase())
    if (b >= 0) return new Date(+m[3], b, +m[1])
  }
  return null
}

const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" })
for (const x of ["2024-02-14", "14/02/2024", "14 Februari 2024", "kemarin"]) {
  const d = keTanggal(x)
  sl.write(`${x} → ${d ? fmt.format(d) : "tidak dikenali"}`)
}
```

Hal baru di sini:

- `t.match(pola)` mencocokkan teks dengan pola dan mengembalikan bagian-bagiannya. `\d{4}` berarti empat angka, dan bagian dalam kurung biasa ditangkap ke `m[1]`, `m[2]`, dan seterusnya.
- `+m[1]` adalah cara singkat mengubah teks menjadi angka, sama dengan `Number(m[1])`.
- `new Date(tahun, bulan, tanggal)` membuat tanggal di zona waktu setempat. Ingat, bulannya dihitung dari 0.

Fungsi yang tidak mengenali format mengembalikan `null`, bukan menebak. Lebih baik jujur "tidak tahu" daripada diam-diam salah.

## 13.6 Nilai kosong, duplikat, dan pencilan

Untuk nilai kosong, tidak ada satu jawaban yang selalu benar. Pilih sesuai arti kolomnya:

| Kolom | Keputusan | Alasan |
|---|---|---|
| `kanal` kosong | Isi `"Tidak diketahui"` | Transaksinya tetap sah; kanalnya saja yang tidak tercatat |
| `jumlah` kosong | Buang barisnya | Tanpa jumlah, omzetnya tidak bisa dihitung |
| `harga` tidak terbaca | Buang barisnya | Sama seperti di atas |

Transaksi ganda dikenali dari `id_transaksi`. Simpan yang pertama, buang sisanya:

```slak
function buangGanda(data, kunci) {
  const sudah = new Set()
  return data.filter(r => {
    if (sudah.has(r[kunci])) return false
    sudah.add(r[kunci])
    return true
  })
}

const contoh = [{ id: "A", n: 1 }, { id: "B", n: 2 }, { id: "A", n: 1 }]
sl.write(buangGanda(contoh, "id"))
```

**Pencilan** (outlier) adalah nilai yang jauh berbeda dari kebanyakan data. Di data kita ada beberapa transaksi dengan `jumlah` 250, padahal pembeli biasanya membeli 1 sampai 5 barang. Kemungkinan besar salah ketik. Untuk sekarang kita pakai aturan sederhana: jumlah di atas 50 dianggap salah dan dibuang. Bab 19 mengajarkan cara menentukan batasnya secara statistik dengan metode IQR.

Selalu **catat** keputusan pembersihanmu. Orang yang membaca laporanmu berhak tahu berapa baris yang dibuang dan mengapa.

## 13.7 Menyatukan semuanya

```slak
const BLN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"]
const KOTA = { Jayapra: "Jayapura", Makasar: "Makassar", Surabya: "Surabaya" }

const rapi = t => t == null ? null : String(t).trim().replace(/\s+/g, " ")
const judul = t => t == null ? null : rapi(t).toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
const kota = t => { const j = judul(t); return KOTA[j] || j }
const angka = x => {
  if (x == null || x === "") return null
  if (typeof x === "number") return x
  const n = Number(String(x).replace(/[^0-9,-]/g, "").replace(",", "."))
  return Number.isNaN(n) ? null : n
}
const tanggal = t => {
  if (t == null) return null
  const s = String(t).trim(); let m
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3])
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return new Date(+m[3], +m[2] - 1, +m[1])
  if ((m = s.match(/^(\d{1,2}) (\w+) (\d{4})$/)) && BLN.includes(m[2].toLowerCase())) return new Date(+m[3], BLN.indexOf(m[2].toLowerCase()), +m[1])
  return null
}

function bersihkan(data) {
  const catatan = []
  let hasil = data.map(r => ({
    id_transaksi: rapi(r.id_transaksi),
    tanggal: tanggal(r.tanggal),
    kota: kota(r.kota),
    kanal: rapi(r.kanal) || "Tidak diketahui",
    kategori: rapi(r.kategori),
    produk: judul(r.produk),
    jumlah: angka(r.jumlah),
    harga: angka(r.harga)
  }))

  const n0 = hasil.length
  hasil = hasil.filter(r => r.jumlah != null && r.harga != null && r.tanggal != null)
  catatan.push(`${n0 - hasil.length} baris dibuang karena jumlah, harga, atau tanggal kosong`)

  const n1 = hasil.length
  const sudah = new Set()
  hasil = hasil.filter(r => !sudah.has(r.id_transaksi) && sudah.add(r.id_transaksi))
  catatan.push(`${n1 - hasil.length} transaksi ganda dibuang`)

  const n2 = hasil.length
  hasil = hasil.filter(r => r.jumlah <= 50)
  catatan.push(`${n2 - hasil.length} pencilan jumlah (> 50) dibuang`)

  hasil = hasil.map(r => ({ ...r, total: r.jumlah * r.harga }))
  return { hasil, catatan }
}

const mentah = (await sl.read_csv("toko-nusantara-kotor.csv")).to_records()
const { hasil, catatan } = bersihkan(mentah)

sl.write(`Dari ${mentah.length} baris menjadi ${hasil.length} baris bersih.`)
for (const c of catatan) sl.markdown(`- ${c}`)
sl.write(`Kota: ${[...new Set(hasil.map(r => r.kota))].join(", ")}`)
sl.dataframe(hasil.slice(0, 8))
```

Dua trik di dalam `bersihkan`:

- `.replace(/(^|\s)\S/g, c => c.toUpperCase())` membesarkan huruf pertama setiap kata dalam satu langkah.
- `!sudah.has(id) && sudah.add(id)` memeriksa sekaligus mencatat. `add` mengembalikan himpunannya sendiri, yang selalu dianggap benar.

Fungsi `bersihkan` bisa dipakai ulang untuk data bulan depan dengan format yang sama. Itulah gunanya menulis pembersihan sebagai fungsi, bukan langkah sekali jalan.

## 13.8 Memperbaiki dengan tangan

Kadang perbaikan paling cepat adalah mengedit beberapa sel langsung, seperti di Excel. `sl.data_editor` menampilkan tabel yang bisa diedit dan mengembalikan data hasil editan.

```slak
const stokAwal = [
  { produk: "Kopi Arabika Wamena 250g", stok: 24, rak: "A1" },
  { produk: "Keripik keladi", stok: null, rak: "B3" },
  { produk: "Sabun Sereh Wangi", stok: 50, rak: "" }
]

const diedit = sl.data_editor(stokAwal, { num_rows: "dynamic", key: "edit-stok" })
const belumLengkap = diedit.filter(r => r.stok == null || !r.rak).length
sl.caption(belumLengkap ? `${belumLengkap} baris belum lengkap` : "Semua baris lengkap")
```

> **API Slak baru**
> - `sl.data_editor(data, { num_rows })` menampilkan tabel yang bisa diedit, lalu mengembalikan larik hasil editan. `num_rows: "dynamic"` mengizinkan pengguna menambah dan menghapus baris.

Klik dua kali sel kosong, isi nilainya, lalu tekan Enter. Keterangan di bawahnya langsung berubah.

> **Coba di playground**
> Tambahkan `"Surabya": "Surabaya"` yang sudah ada di kamus dengan ejaan salah baru, misalnya `"Jaya Pura": "Jayapura"`. Ingat bahwa kuncinya harus ditulis dalam bentuk setelah `hurufJudul`.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Kota yang sama terhitung dua kali | Beda spasi atau huruf besar-kecil | Rapikan dan seragamkan sebelum mengelompokkan |
| Hasil penjumlahan menjadi `NaN` | Ada satu harga yang tidak terbaca | Ubah dengan fungsi yang mengembalikan `null`, lalu saring |
| Tanggal 03/04 terbaca 4 Maret | Format bulan-hari ala Amerika | Tentukan sendiri urutannya, seperti di `keTanggal` |
| Baris hilang terlalu banyak | Aturan pembersihan terlalu ketat | Hitung dan catat yang dibuang di setiap langkah |

## Latihan

**Latihan 13.1 (mudah).** Lengkapi `bersihkanKanal(k)`: rapikan spasi dan huruf, dan isi `"Tidak diketahui"` bila kosong.

```slak latihan
function bersihkanKanal(k) {
  return k
}

const { test, expect } = sl.testing
await test('" online " → Online', () => expect(bersihkanKanal(" online ")).toBe("Online"))
await test('"TOKO" → Toko', () => expect(bersihkanKanal("TOKO")).toBe("Toko"))
await test("null → Tidak diketahui", () => expect(bersihkanKanal(null)).toBe("Tidak diketahui"))
await test('"" → Tidak diketahui', () => expect(bersihkanKanal("")).toBe("Tidak diketahui"))
```

**Latihan 13.2 (sedang).** Lengkapi `buangGanda(data)` yang membuang baris dengan `id` ganda, **menyimpan yang terakhir**, bukan yang pertama. Urutan hasil boleh mengikuti kemunculan terakhir.

```slak latihan
function buangGanda(data) {
  return data
}

const d = [{ id: 1, v: "lama" }, { id: 2, v: "x" }, { id: 1, v: "baru" }]
await sl.testing.test("tersisa 2 baris", () => sl.testing.expect(buangGanda(d)).toHaveLength(2))
await sl.testing.test("id 1 berisi yang baru", () => sl.testing.expect(buangGanda(d).find(r => r.id === 1).v).toBe("baru"))
```

**Latihan 13.3 (tantangan).** Tambahkan format keempat ke `keTanggal`: `"2024.02.14"` (titik). Fungsi harus tetap mengenali format ISO.

```slak latihan
function keTanggal(t) {
  let m
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3])
  return null
}

const iso = d => d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null
await sl.testing.test("ISO tetap jalan", () => sl.testing.expect(iso(keTanggal("2024-02-14"))).toBe("2024-2-14"))
await sl.testing.test("format titik dikenali", () => sl.testing.expect(iso(keTanggal("2024.02.14"))).toBe("2024-2-14"))
```

## Mini-proyek: laporan sebelum dan sesudah

Buat laporan yang menunjukkan kualitas data sebelum dan sesudah dibersihkan, lengkap dengan dampaknya pada angka omzet. Laporan seperti ini membuat atasan atau klien percaya pada analisismu.

```slak
sl.title("Laporan Kebersihan Data :broom:")

const KAMUS = { Jayapra: "Jayapura", Makasar: "Makassar", Surabya: "Surabaya" }
const judul = t => t == null ? null : String(t).trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
const angka = x => x == null || x === "" ? null : typeof x === "number" ? x : Number(String(x).replace(/[^0-9]/g, ""))

const mentah = (await sl.read_csv("toko-nusantara-kotor.csv")).to_records()

const sudah = new Set()
const bersih = mentah
  .map(r => ({ id: r.id_transaksi, kota: KAMUS[judul(r.kota)] || judul(r.kota), jumlah: angka(r.jumlah), harga: angka(r.harga) }))
  .filter(r => r.jumlah != null && r.harga != null)
  .filter(r => !sudah.has(r.id) && sudah.add(r.id))
  .filter(r => r.jumlah <= 50)
  .map(r => ({ ...r, total: r.jumlah * r.harga }))

const omzetMentah = mentah.reduce((a, r) => a + (Number(r.jumlah) || 0) * (angka(r.harga) || 0), 0)
const omzetBersih = bersih.reduce((a, r) => a + r.total, 0)

const [a, b, c] = sl.columns(3)
a.metric("Baris", bersih.length, `${bersih.length - mentah.length} dari mentah`)
b.metric("Ejaan kota", new Set(bersih.map(r => r.kota)).size, `${new Set(bersih.map(r => r.kota)).size - new Set(mentah.map(r => r.kota)).size}`)
c.metric("Omzet", omzetBersih, null, { format: "rp" })

sl.warning(`Bila data tidak dibersihkan, omzet terhitung ${Math.round((omzetMentah / omzetBersih - 1) * 100)}% lebih tinggi dari sebenarnya, karena transaksi ganda dan salah ketik jumlah.`)

const perKota = {}
for (const r of bersih) perKota[r.kota] = (perKota[r.kota] || 0) + r.total
sl.table(Object.entries(perKota).map(([kota, omzet]) => ({ kota, omzet })))
```

Kalimat peringatan di laporan ini adalah temuan yang sesungguhnya. Data kotor tidak hanya jelek dilihat; ia membuat angka keputusan menjadi salah.
