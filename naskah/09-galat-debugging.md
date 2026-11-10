# Bab 9 · Galat dan Debugging

> **Tujuan belajar**
> - Mengenali tiga jenis galat: sintaks, referensi, dan tipe.
> - Membaca pesan galat di playground, Slak Studio, dan DevTools browser.
> - Menangani galat dengan `try`, `catch`, `finally`, dan `throw`.
> - Mencari kesalahan dengan teknik yang teratur.
> - Menguji fungsi secara otomatis dengan `sl.testing`.

## 9.1 Galat itu teman

Setiap pemrogram, dari pemula sampai yang berpengalaman puluhan tahun, membuat kesalahan setiap hari. Bedanya hanya satu: yang berpengalaman tahu cara membaca pesan galat. Pesan galat bukan hukuman. Ia petunjuk yang menunjuk ke baris yang perlu kamu perbaiki.

## 9.2 Tiga jenis galat

| Jenis | Kapan terjadi | Contoh pesan | Penyebab umum |
|---|---|---|---|
| **SyntaxError** | Sebelum program jalan | `Unexpected token`, `missing ) after argument list` | Kurung, kutip, atau kurawal tidak berpasangan |
| **ReferenceError** | Saat program jalan | `total is not defined` | Salah ketik nama variabel, atau variabel dipakai di luar wilayahnya |
| **TypeError** | Saat program jalan | `Cannot read properties of undefined`, `x.map is not a function` | Memakai nilai dengan cara yang tidak cocok dengan tipenya |

Galat sintaks menghentikan program sebelum satu baris pun dijalankan. Dua jenis lainnya menghentikan program di baris tempat galat terjadi; baris di atasnya tetap sudah jalan.

## 9.3 Membaca galat di Slak

Saat kode salah, Slak menampilkan kotak galat merah di pratinjau, lengkap dengan tombol **Detail** untuk melihat urutan pemanggilannya (*stack trace*).

Slak Studio menunjukkan masalah yang sama di empat tempat sekaligus:

1. Baris yang bermasalah diberi latar merah muda di editor.
2. Pratinjau menampilkan kotak galat.
3. Konsol mencatat galat dalam bahasa aslinya, lalu menambahkan baris 💡 berisi penjelasan dalam bahasa Indonesia.
4. Bilah status menampilkan nomor baris dan penjelasannya. Klik untuk melompat ke baris itu.

Untuk salah ketik nama fungsi, Slak Studio bahkan menebak maksudmu, misalnya "Fungsi sl.metrik tidak ada. Maksudmu sl.metric?". Saat kamu mengetik `sl.`, editor menampilkan saran fungsi lengkap dengan urutan argumennya, dan panel **Referensi** (tekan **F1**) berisi semua fungsi Slak beserta contohnya.

Di playground atau browser biasa, buka **DevTools** dengan **F12**, lalu pilih tab **Console**. Pesan dari `console.log` dan galat muncul di sana.

## 9.4 Dua kesalahan klasik pemula

**Satu `=` yang seharusnya tiga.**

```slak tanpa-jalan lewati
const status = "lunas"
if (status = "belum") {          // salah: mengisi, bukan membandingkan
  sl.warning("Tagih pembayaran")
}
```

Karena `status` dibuat dengan `const`, JavaScript menolak mengisinya dan muncul galat **Assignment to constant variable**. Pesan itu adalah petunjuk: kamu menulis `=` padahal maksudnya `===`. Bila variabelnya dibuat dengan `let`, tidak ada galat sama sekali. Kondisinya diam-diam selalu benar, dan kesalahan seperti ini jauh lebih sulit ditemukan. Satu alasan lagi untuk memilih `const`.

**Membaca properti dari sesuatu yang tidak ada.**

```slak
const produk = [{ nama: "Kopi Wamena", harga: 85000 }]
const dicari = produk.find(p => p.nama === "Kopi Toraja")   // tidak ketemu: undefined

try {
  sl.write(dicari.harga)
} catch (e) {
  sl.error(e.message)
}

sl.write(dicari?.harga)          // aman: undefined, tanpa galat
sl.write(dicari?.harga ?? 0)     // aman, dengan nilai cadangan 0
```

- `?.` (*optional chaining*) berhenti dengan tenang bila nilai di kirinya `undefined` atau `null`.
- `??` memberi nilai cadangan bila nilai di kirinya `undefined` atau `null`.

Kedua operator ini sangat berguna untuk data nyata yang penuh lubang.

## 9.5 try, catch, finally

Bungkus kode yang mungkin gagal dengan `try`. Bila terjadi galat, program tidak berhenti, melainkan lompat ke `catch`.

```slak
const teksJson = '{"kota": "Ambon", "omzet": 1800000'   // kurung tutup hilang

try {
  const data = JSON.parse(teksJson)
  sl.write(data)
} catch (e) {
  sl.warning("Data tidak bisa dibaca: " + e.message)
} finally {
  sl.caption("Pemeriksaan selesai.")   // selalu dijalankan, ada galat atau tidak
}
```

`JSON.parse` mengubah teks JSON menjadi objek. Bab 11 membahasnya.

Kamu juga bisa **melempar** galat sendiri dengan `throw`, misalnya saat masukan tidak masuk akal:

```slak galat-sengaja
function hargaSatuan(total, jumlah) {
  if (jumlah <= 0) throw new Error("Jumlah harus lebih dari 0")
  return total / jumlah
}

try {
  sl.write(hargaSatuan(170000, 2))
  sl.write(hargaSatuan(170000, 0))
} catch (e) {
  sl.exception(e)
}
```

> **API Slak baru**
> - `sl.warning(teks)` menampilkan kotak peringatan kuning.
> - `sl.exception(galat)` menampilkan galat lengkap dengan tombol **Detail** berisi stack trace, tanpa menghentikan aplikasi.

## 9.6 Teknik mencari kesalahan

Saat hasil program salah tetapi tidak ada pesan galat, gunakan langkah-langkah ini:

1. **Baca pesannya sampai habis.** Nomor baris dan nama variabel biasanya sudah menjawab.
2. **Intip isi variabel.** Tulis `console.log(x)` atau `sl.write(x)` sebelum baris yang dicurigai. Apakah isinya seperti dugaanmu? Apakah tipenya benar?
3. **Perkecil masalahnya.** Jadikan baris yang dicurigai komentar (**Ctrl+/** di Slak Studio) satu per satu, sampai galatnya hilang.
4. **Coba dengan data kecil.** Lebih mudah memeriksa 3 baris daripada 3.000 baris.
5. **Jelaskan kodenya keras-keras**, baris demi baris, seolah kepada teman. Sering kali kesalahannya terlihat saat dijelaskan.

Di DevTools browser, kamu juga bisa memasang **breakpoint**: klik nomor baris di tab **Sources**, dan program berhenti di sana supaya isi setiap variabel bisa diperiksa. Cara yang lebih cepat: tulis `debugger` di baris mana pun, dan program berhenti di situ selama DevTools terbuka.

## 9.7 Menguji kode secara otomatis

Memeriksa hasil dengan mata melelahkan dan mudah terlewat. Slak punya `sl.testing`, alat uji yang sama yang dipakai latihan di buku ini.

```slak
function diskonAnggota(total) {
  return total >= 500000 ? total * 0.1 : 0
}

const { test, expect } = sl.testing

await test("600 ribu dapat diskon 60 ribu", () => expect(diskonAnggota(600000)).toBe(60000))
await test("tepat 500 ribu dapat diskon", () => expect(diskonAnggota(500000)).toBe(50000))
await test("200 ribu tidak dapat diskon", () => expect(diskonAnggota(200000)).toBe(0))
```

Setiap `test` menampilkan kotak hijau bila lulus, atau merah beserta nilai yang diharapkan dan nilai sebenarnya bila gagal.

| Pernyataan | Lulus bila |
|---|---|
| `expect(x).toBe(y)` | `x` sama persis dengan `y` (angka, teks, boolean) |
| `expect(x).toEqual(y)` | Isi larik atau objek `x` sama dengan `y` |
| `expect(x).toBeCloseTo(y, 2)` | `x` mendekati `y` sampai 2 desimal (untuk pecahan) |
| `expect(x).toBeGreaterThan(y)` | `x > y` |
| `expect(x).toContain(y)` | Larik atau teks `x` memuat `y` |
| `expect(x).toHaveLength(n)` | Panjang `x` adalah `n` |
| `expect(fn).toThrow()` | Memanggil `fn` melempar galat |
| `expect(x).not.toBe(y)` | Kebalikan dari pernyataan sesudahnya |

> **API Slak baru**
> - `await sl.testing.test(judul, fungsi)` menjalankan satu uji dan menampilkan hasilnya.
> - `sl.testing.expect(nilai)` membuat pernyataan yang diperiksa, misalnya `.toBe(...)`.

Mengapa `toBeCloseTo` perlu? Ingat Bab 2: `0.1 + 0.2` tidak tepat sama dengan `0.3`.

```slak
await sl.testing.test("0,1 + 0,2 mendekati 0,3", () => sl.testing.expect(0.1 + 0.2).toBeCloseTo(0.3, 10))
```

Kebiasaan menulis uji untuk setiap fungsi penting akan sangat berguna di Bab 24, saat kodemu tumbuh besar.

> **Coba di playground**
> Ubah fungsi `diskonAnggota` menjadi `total > 500000` (tanpa `=`). Uji mana yang menjadi merah?

## Kesalahan umum

| Pesan | Arti | Perbaikan |
|---|---|---|
| `x is not defined` | Variabel `x` belum dibuat atau salah ketik | Periksa ejaan dan huruf besar-kecil |
| `Cannot read properties of undefined (reading 'y')` | Kamu menulis `sesuatu.y`, padahal `sesuatu` kosong | Periksa asal `sesuatu`; pakai `?.` bila memang bisa kosong |
| `x.map is not a function` | `x` bukan larik | Lihat isi `x` dengan `sl.write(x)` |
| `Unexpected end of input` | Kurung kurawal atau kurung biasa belum ditutup | Hitung pasangan `{ }` dan `( )` |
| `Assignment to constant variable` | Mengisi ulang variabel `const`, sering karena `=` yang seharusnya `===` | Ganti `===`, atau pakai `let` bila memang perlu diganti |

## Latihan

**Latihan 9.1 (mudah).** Fungsi ini seharusnya mengembalikan nama hari, tetapi ada satu kesalahan. Temukan dan perbaiki.

```slak latihan
function namaHari(nomor) {
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
  return hari[nomor + 1]
}

await sl.testing.test("0 = Minggu", () => sl.testing.expect(namaHari(0)).toBe("Minggu"))
await sl.testing.test("5 = Jumat", () => sl.testing.expect(namaHari(5)).toBe("Jumat"))
```

**Latihan 9.2 (sedang).** Lengkapi `bacaHarga(teks)` agar mengembalikan objek hasil `JSON.parse` bila teksnya JSON yang sah, dan `null` bila tidak, tanpa menghentikan program.

```slak latihan
function bacaHarga(teks) {
  return JSON.parse(teks)
}

await sl.testing.test("JSON sah terbaca", () => sl.testing.expect(bacaHarga('{"harga": 5000}')).toEqual({ harga: 5000 }))
await sl.testing.test("JSON rusak menjadi null", () => sl.testing.expect(bacaHarga('{"harga": ')).toBeNull())
```

**Latihan 9.3 (tantangan).** Tulis fungsi `persen(bagian, keseluruhan)` yang mengembalikan persentase dibulatkan satu desimal, dan **melempar galat** bila `keseluruhan` bernilai 0.

```slak latihan
function persen(bagian, keseluruhan) {
  return 0
}

await sl.testing.test("25 dari 200 = 12.5", () => sl.testing.expect(persen(25, 200)).toBe(12.5))
await sl.testing.test("1 dari 3 = 33.3", () => sl.testing.expect(persen(1, 3)).toBe(33.3))
await sl.testing.test("pembagi 0 melempar galat", () => sl.testing.expect(() => persen(5, 0)).toThrow())
```

## Mini-proyek: perbaiki aplikasi kasir

Aplikasi kasir kecil ini berisi **lima bug**. Programnya tetap jalan, tetapi hasilnya salah. Lima uji di bagian bawah menunjukkan apa yang seharusnya terjadi. Temukan dan perbaiki semua bug sampai kelima uji lulus. Jawabannya ada di Lampiran D.

```slak latihan
sl.title("Kasir Toko Nusantara :convenience_store:")

const keranjang = [
  { produk: "Kopi Arabika Wamena 250g", harga: 85000, jumlah: 2 },
  { produk: "Keripik Keladi 200g", harga: 22000, jumlah: 3 },
  { produk: "Gelang Manik Papua", harga: "40000", jumlah: 1 }
]

// Bug ada di fungsi-fungsi berikut
function subtotal(item) {
  return item.harga + item.jumlah
}

function totalBelanja(daftar) {
  let total = 0
  for (let i = 1; i < daftar.length; i++) total += subtotal(daftar[i])
  return total
}

function diskon(total) {
  if (total > 250000) return total * 0.05
  return 0
}

function ppn(setelahDiskon) {
  return setelahDiskon * 11
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
