# Lampiran B · Cheat Sheet JavaScript untuk Data

Ringkasan JavaScript yang dipakai di buku ini, dalam urutan yang sama dengan Tahap 1.

## Variabel dan tipe

```js
const nama = "Kopi Wamena"   // tidak bisa diganti
let stok = 24                // bisa diganti
typeof 25000                 // "number"   (juga "string", "boolean", "object", "undefined")
Number("1250")  String(1250)  parseFloat("3.75 kg")  parseInt("12 buah")
Number.isNaN(x)              // memeriksa NaN
null  undefined  NaN         // "sengaja kosong", "belum diisi", "hitungan gagal"
```

## Operator

| Jenis | Operator |
|---|---|
| Aritmetika | `+ - * / % **` |
| Penugasan | `= += -= *= /= ++ --` |
| Perbandingan | `=== !== < > <= >=` (hindari `==`) |
| Logika | `&& \|\| !` |
| Pilihan singkat | `syarat ? a : b` |
| Aman untuk nilai kosong | `obj?.prop`, `nilai ?? cadangan` |

## Percabangan dan perulangan

```js
if (a) { ... } else if (b) { ... } else { ... }
switch (kode) { case "JYP": ...; break; default: ... }

for (let i = 0; i < n; i++) { ... }
for (const x of larik) { ... }
while (syarat) { ... }
break    continue
```

## Fungsi

```js
function luas(p, l = 1) { return p * l }
const pajak = harga => harga * 0.11
const ongkir = (kg, kota) => { const t = 8000; return Math.ceil(kg) * t }
async function ambil() { const r = await fetch(url); return r.json() }
```

## Larik

| Metode | Hasil | Contoh |
|---|---|---|
| `push`, `pop` | Tambah/ambil di akhir (mengubah larik) | `a.push(5)` |
| `slice(a, b)` | Potongan baru | `a.slice(0, 3)` |
| `includes`, `indexOf` | Ada? Di mana? | `a.includes("Ambon")` |
| `map(fn)` | Larik baru, setiap isi diubah | `a.map(x => x * 2)` |
| `filter(fn)` | Larik baru, yang memenuhi syarat | `a.filter(x => x > 10)` |
| `reduce(fn, awal)` | Satu nilai ringkasan | `a.reduce((s, x) => s + x, 0)` |
| `sort(fn)` | Urut (mengubah larik) | `[...a].sort((x, y) => x - y)` |
| `find`, `findIndex` | Isi/indeks pertama yang cocok | `a.find(x => x.id === 3)` |
| `some`, `every` | Ada yang / semua memenuhi? | `a.some(x => x === 0)` |
| `join(sep)` | Teks | `a.join(", ")` |
| `at(-1)` | Isi terakhir | `a.at(-1)` |
| `[...new Set(a)]` | Nilai unik | |
| `Math.max(...a)` | Terbesar | |

## Objek

```js
const p = { nama: "Sagu", harga: 30000 }
p.nama   p["harga"]   p.stok = 40   delete p.stok   "stok" in p
Object.keys(p)   Object.values(p)   Object.entries(p)   Object.fromEntries(pasangan)
const { nama, harga } = p              // destructuring
const salinan = { ...p, harga: 32000 } // spread
const peta = new Map([["JYP", "Jayapura"]]); peta.get("JYP"); peta.has("SOQ")
```

## Teks

```js
s.trim()  s.toLowerCase()  s.toUpperCase()  s.includes("x")  s.startsWith("Papua")
s.split(",")  s.replace("a", "b")  s.replaceAll("-", "/")  s.padStart(4, "0")  s.slice(0, 7)
`Total ${n}`                         // template literal
s.replace(/[^0-9]/g, "")             // buang semua yang bukan angka
s.match(/^(\d{4})-(\d{2})-(\d{2})$/) // tangkap bagian-bagian
a.localeCompare(b, "id")             // pembanding teks untuk sort
```

## Angka dan tanggal

```js
Math.round(x)  Math.floor(x)  Math.ceil(x)  x.toFixed(2)  // toFixed menghasilkan teks
new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(x)
new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 }).format(0.123)
(1250000).toLocaleString("id-ID")

new Date("2024-04-10")       new Date(2024, 3, 10)   // bulan dari 0!
d.getFullYear()  d.getMonth() + 1  d.getDate()  d.getDay()   // 0 = Minggu
(b - a) / (24 * 60 * 60 * 1000)                               // selisih hari
new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(d)
d.toISOString().slice(0, 10)
```

## Galat dan async

```js
try { ... } catch (e) { e.message } finally { ... }
throw new Error("Pesan")
await sl.sleep(500)
const [a, b] = await Promise.all([ambilA(), ambilB()])
```

## JSON

```js
JSON.parse(teks)          // teks → objek
JSON.stringify(obj)       // objek → teks
JSON.stringify(obj, null, 1)
```

## Class

```js
class Cabang {
  constructor(nama) { this.nama = nama }
  get label() { return "Nusantara " + this.nama }
  sapa() { return `Halo dari ${this.nama}` }
}
const c = new Cabang("Ambon")
```
