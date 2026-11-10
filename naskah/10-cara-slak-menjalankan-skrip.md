# Bab 10 · Cara Slak Menjalankan Skrip

> **Tujuan belajar**
> - Memahami jalan ulang: setiap interaksi menjalankan ulang seluruh skrip dari atas.
> - Menyimpan nilai antar-interaksi dengan `sl.session_state` dan `key`.
> - Menyimpan data permanen di browser dengan `sl.local_state`.
> - Mengumpulkan beberapa isian sekaligus dengan `sl.form`.
> - Membandingkan cara Slak dengan event listener JavaScript biasa.
> - Menyembunyikan kunci jawaban kuis dengan `sl.crypto`.

## 10.1 Jalan ulang

Sejak Bab 3 kamu sudah merasakannya: setiap kali widget diubah, hasil di layar ikut berubah. Di balik itu, Slak melakukan satu hal sederhana: **menjalankan ulang seluruh skrip dari baris pertama**, kali ini dengan nilai widget yang baru. Lalu Slak membandingkan hasil baru dengan tampilan lama dan hanya mengubah bagian yang berbeda, sehingga posisi gulir dan kursor tetap terjaga.

Akibatnya, kode Slak bisa dibaca seperti resep dari atas ke bawah. Tetapi ada satu akibat yang sering mengejutkan pemula:

```slak
let klik = 0
if (sl.button("Tambah")) klik++
sl.write(`Klik: ${klik}`)
```

Klik tombolnya beberapa kali. Angkanya tidak pernah lebih dari 1. Mengapa? Setiap kali tombol diklik, skrip dijalankan ulang dari atas, dan baris pertama mengembalikan `klik` ke 0. Variabel biasa **lupa** setiap jalan ulang.

## 10.2 session_state: ingatan selama halaman terbuka

`sl.session_state` adalah objek yang isinya **bertahan antar-jalan ulang** selama halaman terbuka.

```slak
const ss = sl.session_state
if (!("skor" in ss)) ss.skor = 0     // isi nilai awal hanya bila belum ada

if (sl.button("Tambah skor")) ss.skor++
if (sl.button("Reset skor")) ss.skor = 0
sl.metric("Skor", ss.skor)
```

Pola `if (!("skor" in ss)) ss.skor = 0` sangat penting. Tanpa `if`, nilai awal akan menimpa skor di setiap jalan ulang, dan kamu kembali ke masalah 10.1.

> **API Slak baru**
> - `sl.session_state` menyimpan nilai selama halaman terbuka. Isinya hilang bila halaman dimuat ulang.

### key: widget yang ikut tersimpan

Widget yang diberi `key` otomatis menyimpan nilainya di `session_state` dengan nama itu:

```slak
sl.text_input("Nama pelanggan", { key: "pelanggan" })
sl.write(`Halo, ${sl.session_state.pelanggan || "pelanggan"}!`)
```

`key` juga memberi widget identitas tetap. Tanpa `key`, Slak mengenali widget dari jenis dan labelnya, jadi mengganti label membuat widget dianggap baru dan nilainya kembali ke awal. Setiap `key` harus unik; memakai `key` yang sama dua kali menghasilkan galat "Key widget dipakai lebih dari sekali".

### Callback: on_click

Tombol bisa diberi fungsi yang dipanggil **sebelum** skrip dijalankan ulang. Cara ini membuat perubahan langsung terlihat di jalan ulang yang sama.

```slak
const s = sl.session_state
if (!s.keranjang) s.keranjang = []

const tambah = (nama) => { s.keranjang.push(nama) }
const kosongkan = () => { s.keranjang = [] }

const [k1, k2, k3] = sl.columns(3)
k1.button("+ Kopi", { on_click: tambah, args: ["Kopi"] })
k2.button("+ Sagu", { on_click: tambah, args: ["Sagu"] })
k3.button("Kosongkan", { on_click: kosongkan })

sl.write(`Keranjang (${s.keranjang.length}): ${s.keranjang.join(", ") || "kosong"}`)
```

`args` adalah larik argumen yang dikirim ke fungsi callback.

## 10.3 local_state: ingatan permanen di browser

`session_state` hilang saat halaman dimuat ulang. Untuk data yang harus bertahan, misalnya catatan atau pengaturan, pakai `sl.local_state`. Cara pakainya sama, tetapi isinya disimpan di browser dan tetap ada besok.

```slak
const ls = sl.local_state
if (!("kunjungan" in ls)) ls.kunjungan = 0
if (sl.button("Catat kunjungan")) ls.kunjungan++
sl.metric("Kunjungan tercatat", ls.kunjungan)
sl.caption("Muat ulang halaman: angkanya tetap.")
```

> **API Slak baru**
> - `sl.local_state` seperti `session_state`, tetapi permanen. Data disimpan per browser dan hanya cocok untuk data JSON: angka, teks, boolean, larik, dan objek biasa.
> - `sl.clear_local_state()` mengosongkannya.

Dua hal yang perlu kamu tahu:

- Data tersimpan **di browser pengguna**, bukan di server. Pengguna lain tidak melihatnya, dan data hilang bila pengguna menghapus data situs.
- Jangan menyimpan password atau data rahasia di sana. Siapa pun yang memakai komputer itu bisa membacanya.

## 10.4 Form: kirim sekaligus

Setiap perubahan widget memicu jalan ulang. Untuk formulir dengan banyak isian, itu tidak perlu: kita ingin semua isian diproses sekali saat tombol **Kirim** ditekan. Gunakan `sl.form`.

```slak
const f = sl.form("tamu", { clear_on_submit: true })
const namaTamu = f.text_input("Nama tamu")
const asal = f.selectbox("Asal", ["Jayapura", "Sorong", "Manokwari", "Lainnya"])
const kirim = f.form_submit_button("Kirim")

if (kirim) {
  if (!namaTamu) sl.error("Nama wajib diisi.")
  else sl.success(`Terima kasih, ${namaTamu} dari ${asal}!`)
}
```

> **API Slak baru**
> - `sl.form(key, { clear_on_submit })` membuat formulir. Widget di dalamnya ditulis dengan awalan formulir, misalnya `f.text_input(...)`, dan tidak memicu jalan ulang sampai tombol kirim ditekan.
> - `f.form_submit_button(label)` bernilai `true` sekali setelah ditekan. `clear_on_submit: true` mengosongkan isian setelah dikirim.

## 10.5 Bandingkan dengan JavaScript biasa

Bagaimana cara membuat penghitung klik tanpa Slak? Dengan JavaScript biasa di browser, kamu bekerja dengan **DOM** (struktur halaman) dan **event listener** (fungsi yang menunggu kejadian):

```html
<button id="tombol">Tambah</button>
<p id="hasil">Klik: 0</p>
<script>
  let klik = 0
  const tombol = document.getElementById("tombol")
  const hasil = document.getElementById("hasil")
  tombol.addEventListener("click", () => {
    klik++
    hasil.textContent = "Klik: " + klik
  })
</script>
```

| | JavaScript biasa | Slak |
|---|---|---|
| Alur | Pasang fungsi yang menunggu kejadian | Skrip dijalankan ulang dari atas |
| Variabel bertahan? | Ya, skrip hanya jalan sekali | Tidak; pakai `session_state` |
| Mengubah tampilan | Kamu sendiri yang mengubah DOM | Slak menggambar ulang yang berubah |
| Cocok untuk | Situs dan aplikasi web umum | Aplikasi data, dasbor, alat kecil |

Keduanya JavaScript yang sama. Slak hanya memilih gaya yang lebih mudah untuk aplikasi data: kamu memikirkan **apa yang ditampilkan**, bukan **kapan harus mengubah tampilan**. Di Bab 26 kamu akan melihat seberapa banyak yang dikerjakan Slak untukmu.

## 10.6 Menyembunyikan kunci jawaban kuis

Kode aplikasi Slak bisa dibaca siapa saja yang membuka halamannya. Bila kunci jawaban kuis ditulis apa adanya, peserta bisa mengintipnya. `sl.crypto.quiz_hash` mengubah jawaban menjadi kode yang tidak bisa dibaca, dan `sl.crypto.quiz_check` memeriksa jawaban peserta terhadap kode itu.

Langkah pertama, buat kodenya sekali (di playground atau Slak Studio):

```slak
sl.code(sl.crypto.quiz_hash("Jayapura"))
```

Setiap kali dijalankan, kodenya berbeda karena ada bumbu acak, tetapi semuanya sama-sama cocok dengan "Jayapura". Salin hasilnya ke aplikasi kuis:

```slak
const KUNCI = "sq1$1dfd355a$dEQmiN6xy_-AgzCbOolSOwc5"   // jawaban asli tidak tertulis di kode
const jawab = sl.text_input("Ibu kota Provinsi Papua?")
if (jawab) {
  if (sl.crypto.quiz_check(jawab, KUNCI)) sl.success("Benar!")
  else sl.error("Belum tepat, coba lagi.")
}
```

`quiz_check` mengabaikan huruf besar-kecil, spasi berlebih, dan titik di akhir, jadi "jayapura" dan "Jayapura." juga benar.

> **API Slak baru**
> - `sl.crypto.quiz_hash(jawaban)` membuat kode pelindung. Bisa juga larik beberapa jawaban yang sama-sama benar.
> - `sl.crypto.quiz_check(jawaban, kode)` mengembalikan `true` bila jawaban cocok.

Hash menyembunyikan jawaban dari mata, bukan dari tebakan. Untuk pilihan ganda dengan empat opsi, peserta tetap bisa mencoba semuanya. Pakai untuk isian singkat.

> **Coba di playground**
> Buat kode untuk dua jawaban yang sama-sama benar: `sl.crypto.quiz_hash(["Jakarta", "DKI Jakarta"])`. Lalu periksa keduanya dengan `quiz_check`.

## Kesalahan umum

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Penghitung tidak pernah lebih dari 1 | Memakai variabel biasa | Simpan di `sl.session_state` |
| Nilai kembali ke awal setiap klik | Menulis `ss.skor = 0` tanpa `if` | `if (!("skor" in ss)) ss.skor = 0` |
| Isian widget hilang setelah label diubah | Widget dianggap baru | Beri `key` yang tetap |
| `Key widget dipakai lebih dari sekali` | Dua widget memakai `key` sama | Buat setiap `key` unik |
| Data `local_state` berupa tanggal berubah menjadi teks | `local_state` hanya menyimpan JSON | Simpan tanggal sebagai teks ISO |

## Latihan

**Latihan 10.1 (mudah).** Lengkapi agar `ss.hitung` bertambah 1 setiap tombol diklik dan tidak kembali ke 0. Uji di bawah menjalankan aplikasimu di balik layar, mengeklik tombolnya tiga kali, lalu memeriksa angkanya.

```slak latihan
const kode = `
const ss = sl.session_state
ss.hitung = 0
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

Perbaiki teks di dalam `kode`. Contoh ini sekaligus memperkenalkan `sl.testing.run(kode)`: menjalankan aplikasi tersembunyi, lalu mengeklik tombol dari kode uji.

**Latihan 10.2 (sedang).** Lengkapi fungsi callback `hapusTerakhir` agar membuang isi terakhir `daftar`.

```slak latihan
const kode2 = `
const s = sl.session_state
if (!s.daftar) s.daftar = ["kopi", "sagu", "abon"]
const hapusTerakhir = () => { }
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

**Latihan 10.3 (tantangan).** Ganti `KUNCI` agar kuis menerima "Manokwari" sebagai jawaban benar, tanpa menulis kata "Manokwari" di dalam `KUNCI`.

```slak latihan
const KUNCI = ""   // isi dengan hasil sl.crypto.quiz_hash("Manokwari")

await sl.testing.test("Manokwari benar", () => sl.testing.expect(sl.crypto.quiz_check("Manokwari", KUNCI)).toBe(true))
await sl.testing.test("Sorong salah", () => sl.testing.expect(sl.crypto.quiz_check("Sorong", KUNCI)).toBe(false))
await sl.testing.test("kunci tidak memuat jawabannya", () => sl.testing.expect(KUNCI.toLowerCase().includes("manokwari")).toBe(false))
```

## Mini-proyek 1: daftar tugas yang tidak hilang

```slak
sl.title("Daftar Tugas :white_check_mark:")

const ls = sl.local_state
if (!ls.tugas) ls.tugas = []

const f = sl.form("tugas-baru", { clear_on_submit: true })
const judul = f.text_input("Tugas baru")
if (f.form_submit_button("Tambah") && judul.trim()) {
  ls.tugas = [...ls.tugas, { judul: judul.trim(), selesai: false }]
}

const ubah = (i) => {
  ls.tugas = ls.tugas.map((t, j) => j === i ? { ...t, selesai: !t.selesai } : t)
}
const hapusSelesai = () => { ls.tugas = ls.tugas.filter(t => !t.selesai) }

ls.tugas.forEach((t, i) => {
  sl.checkbox(t.judul, { value: t.selesai, key: "tugas-" + i, on_change: ubah, args: [i] })
})

const sisa = ls.tugas.filter(t => !t.selesai).length
sl.caption(`${sisa} tugas belum selesai`)
sl.button("Hapus yang sudah selesai", { on_click: hapusSelesai })
```

Tutup halamannya, buka lagi besok: tugasmu masih ada.

Perhatikan bahwa `ls.tugas` selalu diganti dengan larik baru (`[...ls.tugas, ...]`, `map`, `filter`), bukan diubah di tempat. Mengganti nilainya memastikan Slak menyimpan perubahan ke browser.

## Mini-proyek 2: kuis ibu kota

```slak
sl.title("Kuis Ibu Kota Provinsi :round_pushpin:")

const SOAL = [
  { tanya: "Papua", kunci: "sq1$1dfd355a$dEQmiN6xy_-AgzCbOolSOwc5" },
  { tanya: "Papua Barat", kunci: "sq1$d3b9602d$w8Z83V5uRJtt1rylukrGlCYb" },
  { tanya: "Maluku", kunci: "sq1$7545a5b7$1yKypXkI2LzXuP6012Wgl2KS" }
]

const f = sl.form("kuis")
const jawaban = SOAL.map((s, i) => f.text_input(`${i + 1}. Ibu kota ${s.tanya}?`, { key: "jawab-" + i }))
const periksa = f.form_submit_button("Periksa jawaban")

if (periksa) {
  let skor = 0
  SOAL.forEach((s, i) => {
    if (sl.crypto.quiz_check(jawaban[i], s.kunci)) skor++
  })
  sl.metric("Skor", `${skor} / ${SOAL.length}`)
  if (skor === SOAL.length) sl.balloons()
}
```

`sl.balloons()` menerbangkan balon di layar. Pantas untuk jawaban sempurna.
