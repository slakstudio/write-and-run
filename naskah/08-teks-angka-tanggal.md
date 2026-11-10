# Bab 8 · Teks, Angka, dan Tanggal

> **Tujuan belajar**
> - Mengolah teks: `trim`, `toLowerCase`, `split`, `replace`, `includes`, `padStart`.
> - Membulatkan angka dan menampilkan Rupiah dengan format Indonesia.
> - Membuat, membaca, dan menghitung selisih tanggal dengan `Date`.
> - Menampilkan tanggal berbahasa Indonesia.

## 8.1 Metode teks yang paling sering dipakai

Teks (string) punya banyak metode bawaan. Semuanya **mengembalikan teks baru**; teks aslinya tidak berubah.

```slak
const mentah = "  Kopi Arabika WAMENA  "
sl.write(`[${mentah.trim()}]`)          // buang spasi di awal dan akhir
sl.write(mentah.trim().toLowerCase())    // huruf kecil semua
sl.write(mentah.trim().toUpperCase())    // huruf besar semua
sl.write(mentah.includes("Arabika"))     // memuat kata?
sl.write(mentah.trim().length)           // panjang teks
```

```slak
const baris = "TN000123;2024-03-01;Jayapura;85000"
const bagian = baris.split(";")          // pecah menjadi larik
sl.write(bagian)
sl.write(bagian[2])

const kode = "7"
sl.write(kode.padStart(4, "0"))          // "0007"
sl.write("Kopi Wamena".replace("Wamena", "Toraja"))
sl.write("a-b-c".replaceAll("-", "/"))
```

`split` sangat penting untuk analis data. Berkas CSV pada dasarnya adalah teks yang dipecah per baris, lalu per koma. Di Bab 11 kamu akan membaca CSV dengan `split` sebelum memakai pembaca CSV milik Slak.

### Membersihkan teks dengan pola

Kadang yang ingin dibuang bukan satu kata, tetapi "semua yang bukan angka". Untuk itu ada **ekspresi reguler** (regex), pola yang ditulis di antara garis miring. Kamu cukup mengenal satu pola ini:

```slak
const hargaTeks = "Rp 1.250.000"
const hanyaAngka = hargaTeks.replace(/[^0-9]/g, "")
sl.write(hanyaAngka)
sl.write(Number(hanyaAngka) + 50000)
```

`/[^0-9]/g` artinya "setiap karakter yang bukan 0 sampai 9, di seluruh teks". Menggantinya dengan `""` menyisakan angkanya saja.

## 8.2 Membulatkan angka

```slak
const x = 1234.5678
sl.write(Math.round(x))        // 1235
sl.write(Math.floor(x))        // 1234
sl.write(Math.ceil(x))         // 1235
sl.write(x.toFixed(2))         // "1234.57" (teks!)
sl.write(Math.round(x * 100) / 100)  // 1234.57 (angka)
```

Perhatikan hasilnya di layar: `sl.write` menampilkan **angka** dengan gaya Indonesia (`1.235` dan `1.234,57`), sedangkan **teks** hasil `toFixed` tampil apa adanya (`1234.57`).

`toFixed` mengembalikan **teks**. Pakai untuk menampilkan, bukan untuk dihitung lagi.

## 8.3 Format Rupiah dan angka Indonesia

Orang Indonesia menulis ribuan dengan titik dan desimal dengan koma: `1.250.000,50`. JavaScript menyediakan `Intl.NumberFormat` untuk menulis angka sesuai kebiasaan negara mana pun.

```slak
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
const angkaID = new Intl.NumberFormat("id-ID")
const persen = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 })

sl.write(rupiah.format(1250000))
sl.write(angkaID.format(3278.5))
sl.write(persen.format(0.1234))
sl.write((1250000).toLocaleString("id-ID"))   // cara singkat
```

Buat formatnya sekali di variabel, lalu pakai berulang. Membuatnya ulang di setiap baris memperlambat program saat datanya ribuan.

`sl.metric` juga bisa memformat sendiri. Opsi `format: "rp"` menampilkan Rupiah:

```slak
sl.metric("Omzet Maret", 48250000, "+8%", { format: "rp" })
```

## 8.4 Tanggal dengan Date

```slak
const hariIni = new Date()
const tanggalTetap = new Date("2024-04-10")      // dari teks ISO: tahun-bulan-hari
const dariAngka = new Date(2024, 3, 10)          // bulan dihitung dari 0: 3 = April!

sl.write(`Tahun ini: ${hariIni.getFullYear()}`)
sl.write(`Bulan: ${tanggalTetap.getMonth() + 1}`)   // tambah 1 agar menjadi 1–12
sl.write(`Tanggal: ${dariAngka.getDate()}`)
sl.write(`Hari ke: ${dariAngka.getDay()}`)          // 0 = Minggu, 1 = Senin, ...
```

Dua jebakan yang paling sering:

1. **Bulan dihitung dari 0.** Januari adalah 0, Desember adalah 11. Selalu tambah 1 saat menampilkan.
2. **Teks tanggal sebaiknya berformat ISO** `"2024-04-10"`. Format lain seperti `"10/04/2024"` dibaca berbeda-beda oleh tiap browser. Slak Data membaca format Indonesia dengan benar (Bab 11), tetapi `new Date` biasa tidak.

### Selisih hari

Di balik layar, tanggal disimpan sebagai jumlah milidetik sejak 1 Januari 1970. Selisih dua tanggal adalah selisih milidetiknya.

```slak
const MS_SEHARI = 24 * 60 * 60 * 1000
const awal = new Date("2024-01-01")
const lebaran = new Date("2024-04-10")
const selisih = Math.round((lebaran - awal) / MS_SEHARI)
sl.write(`${selisih} hari dari awal tahun sampai Lebaran 2024`)
```

### Tanggal berbahasa Indonesia

```slak
const t = new Date("2024-04-10")
const panjang = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
const pendek = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" })
sl.write(panjang.format(t))
sl.write(pendek.format(t))
sl.write(t.toISOString().slice(0, 10))   // kembali ke format ISO
```

Slak juga punya `sl.strftime` bila kamu terbiasa dengan format gaya Python:

```slak
sl.write(sl.strftime(new Date("2024-04-10"), "%A, %d %B %Y"))
```

## 8.5 Memilih tanggal

```slak
const tgl = sl.date_input("Tanggal transaksi", "2024-04-10")
sl.write(typeof tgl)
sl.write(tgl)
```

> **API Slak baru**
> - `sl.date_input(label, nilaiAwal)` mengembalikan tanggal sebagai **teks** `"YYYY-MM-DD"`. Ubah dengan `new Date(tgl)` bila ingin menghitung.
> - `sl.strftime(tanggal, pola)` memformat tanggal dengan pola seperti `%d`, `%B`, `%Y`, `%A`.

> **Coba di playground**
> Ganti `weekday: "long"` menjadi `weekday: "short"`, dan `month: "long"` menjadi `month: "2-digit"`. Lihat bedanya.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Tanggal mundur satu bulan | Lupa bulan dihitung dari 0 | `getMonth() + 1`, atau `new Date(2024, 3, 10)` untuk April |
| `Invalid Date` | Format teks tidak dikenali, misalnya `"10-04-2024"` | Pakai ISO `"2024-04-10"` |
| `toFixed is not a function` | Memanggilnya pada teks, bukan angka | Ubah dulu dengan `Number(...)` |
| Rupiah tampil `1250000` tanpa titik | Angka ditampilkan apa adanya | Pakai `Intl.NumberFormat("id-ID")` |

## Latihan

**Latihan 8.1 (mudah).** Ubah teks `"  makassar "` menjadi `"Makassar"`: tanpa spasi berlebih, huruf pertama besar.

```slak latihan
const mentah = "  makassar "
const rapi = mentah   // ganti

sl.write(`[${rapi}]`)
await sl.testing.test("menjadi Makassar", () => sl.testing.expect(rapi).toBe("Makassar"))
```

**Latihan 8.2 (sedang).** Lengkapi `keAngka(teks)` yang mengubah teks harga seperti `"Rp 42.000"` atau `"42000"` menjadi angka `42000`.

```slak latihan
function keAngka(teks) {
  return teks
}

await sl.testing.test('"Rp 42.000" → 42000', () => sl.testing.expect(keAngka("Rp 42.000")).toBe(42000))
await sl.testing.test('"42000" → 42000', () => sl.testing.expect(keAngka("42000")).toBe(42000))
await sl.testing.test('"Rp 1.250.000" → 1250000', () => sl.testing.expect(keAngka("Rp 1.250.000")).toBe(1250000))
```

**Latihan 8.3 (tantangan).** Lengkapi `selisihHari(a, b)` untuk dua teks tanggal ISO, lalu `namaHari(teks)` yang mengembalikan nama hari berbahasa Indonesia.

```slak latihan
function selisihHari(a, b) {
  return 0
}
function namaHari(teks) {
  return ""
}

await sl.testing.test("1 Jan → 10 Apr 2024 = 100 hari", () => sl.testing.expect(selisihHari("2024-01-01", "2024-04-10")).toBe(100))
await sl.testing.test("17 Agustus 1945 hari Jumat", () => sl.testing.expect(namaHari("1945-08-17")).toBe("Jumat"))
```

## Mini-proyek: kalkulator umur dan hitung mundur

```slak
sl.title("Kalkulator Umur dan Hitung Mundur :calendar:")

const MS_HARI = 24 * 60 * 60 * 1000
const fmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

const lahir = new Date(sl.date_input("Tanggal lahir", "2004-05-21"))
const acara = new Date(sl.date_input("Tanggal acara", "2026-12-25"))
const hari = new Date(sl.date_input("Anggap hari ini", "2026-11-09"))

let umur = hari.getFullYear() - lahir.getFullYear()
const sudahUlangTahun =
  hari.getMonth() > lahir.getMonth() ||
  (hari.getMonth() === lahir.getMonth() && hari.getDate() >= lahir.getDate())
if (!sudahUlangTahun) umur--

const sisa = Math.ceil((acara - hari) / MS_HARI)

const [a, b] = sl.columns(2)
a.metric("Umur", `${umur} tahun`)
b.metric("Menuju acara", sisa >= 0 ? `${sisa} hari` : "sudah lewat")

sl.write(`Kamu lahir pada hari **${fmt.format(lahir).split(",")[0]}**.`)
sl.write(`Acara jatuh pada ${fmt.format(acara)}.`)
```

"Anggap hari ini" sengaja dibuat bisa diubah, supaya kamu bisa menguji perhitungannya. Dalam aplikasi sungguhan, ganti dengan `new Date()`.
