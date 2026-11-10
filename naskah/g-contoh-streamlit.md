# Lampiran G · Memakai Contoh Streamlit dari Internet

Gaya Slak terinspirasi **Streamlit**, kerangka aplikasi data populer di Python. Ribuan contoh Streamlit tersedia di internet, dan sebagian besar bisa kamu terjemahkan ke Slak dengan mudah, karena nama perintahnya dibuat sama.

## Nama perintah yang sama

Hampir semua perintah `st.*` di Streamlit punya padanan `sl.*` dengan nama yang sama persis: `st.title` menjadi `sl.title`, `st.slider` menjadi `sl.slider`, `st.dataframe` menjadi `sl.dataframe`, `st.session_state` menjadi `sl.session_state`, dan seterusnya. Paket Slak 1.9.1 berisi `PARITAS.md`, daftar 104 perintah Streamlit beserta padanannya, yang diperiksa otomatis dengan `sl.testing`: 80 sama, 23 mirip (jalan dengan perbedaan kecil yang dicatat), dan semua 42 perintah yang paling sering dipakai pemula jalan.

## Menerjemahkan Python ke JavaScript

Yang berbeda adalah **bahasanya**. Berikut padanan yang paling sering diperlukan:

| Streamlit (Python) | Slak (JavaScript) |
|---|---|
| `import streamlit as st` | (tidak perlu) |
| `nama = st.text_input("Nama")` | `const nama = sl.text_input("Nama")` |
| `n = st.slider("Angka", 0, 100, 50)` | `const n = sl.slider("Angka", 0, 100, 50)` |
| `st.write(f"Halo {nama}")` | ``sl.write(`Halo ${nama}`)`` |
| `if st.button("Kirim"):` lalu baris menjorok | `if (sl.button("Kirim")) { ... }` |
| `for x in daftar:` | `for (const x of daftar) { ... }` |
| `col1, col2 = st.columns(2)` | `const [col1, col2] = sl.columns(2)` |
| `with col1:` lalu `st.write(...)` | `col1.write(...)` |
| `with st.sidebar:` lalu `st.slider(...)` | `sl.sidebar.slider(...)` |
| `st.slider("A", min_value=0, max_value=10)` | `sl.slider("A", { min: 0, max: 10 })` |
| `df = pd.read_csv("data.csv")` | `const df = await sl.read_csv("data.csv")` |
| `df[df.total > 100]` | `df.filter(df.total.gt(100))` atau `df.query("total > 100")` |
| `df.groupby("k").agg(n=("a", "sum"))` | `df.groupby("k").agg({ n: ["a", "sum"] })` |
| `df.sort_values("a", ascending=False)` | `df.sort_values("a", { ascending: false })` |
| `True`, `False`, `None` | `true`, `false`, `null` |
| `and`, `or`, `not` | `&&`, `\|\|`, `!` |
| `len(daftar)` | `daftar.length` |
| `# komentar` | `// komentar` |

Aturan umumnya:

- **Argumen bernama** Python (`min_value=0`) ditulis sebagai **objek** di Slak (`{ min: 0 }`). Bentuk berurutan seperti `sl.slider("A", 0, 100, 50)` juga diterima.
- **Blok `with`** Python ditulis dengan memanggil fungsi pada wadahnya: `col1.write(...)`, `sl.sidebar.slider(...)`.
- **Membaca data** butuh `await`, karena di browser membaca berkas adalah pekerjaan asinkron (Bab 12).
- **"Magic"** Streamlit, yaitu variabel yang ditulis sendirian di satu baris lalu otomatis tampil, tidak ada di Slak. Tulis `sl.write(x)`.

## Contoh terjemahan

Streamlit:

```python
import streamlit as st
import pandas as pd

st.title("Penjualan")
df = pd.read_csv("penjualan.csv")
kota = st.sidebar.multiselect("Kota", df["kota"].unique())
if kota:
    df = df[df["kota"].isin(kota)]
st.metric("Omzet", f"{df['total'].sum():,}")
st.bar_chart(df.groupby("kategori")["total"].sum())
```

Slak:

```slak tanpa-jalan
sl.title("Penjualan")
let df = await sl.read_csv("toko-nusantara.csv")
const kota = sl.sidebar.multiselect("Kota", df.kota.unique())
if (kota.length) df = df.filter(r => kota.includes(r.kota))
sl.metric("Omzet", df.total.sum())
sl.bar_chart(df.groupby("kategori").agg({ total: ["total", "sum"] }), { x: "kategori", y: "total" })
```

## Nama lama Streamlit

Contoh Streamlit yang lebih tua kadang memakai nama yang sudah diganti di Streamlit sendiri. Slak 1.9 tetap mengenali 12 nama lama ini, dengan peringatan sekali di konsol yang menyebut nama barunya. Nama lama tetap bekerja sampai Slak 2.0, tetapi untuk kode baru pakai nama barunya.

| Nama lama | Nama baru |
|---|---|
| `sl.beta_columns` | `sl.columns` |
| `sl.beta_expander` | `sl.expander` |
| `sl.beta_container` | `sl.container` |
| `sl.beta_tabs` | `sl.tabs` |
| `sl.experimental_rerun` | `sl.rerun` |
| `sl.experimental_dialog` | `sl.dialog` |
| `sl.experimental_fragment` | `sl.fragment` |
| `sl.experimental_get_query_params` | `sl.query_params` |
| `sl.experimental_set_query_params` | `sl.query_params` |
| `sl.cache` | `sl.cache_data` |
| `sl.experimental_memo` | `sl.cache_data` |
| `sl.experimental_singleton` | `sl.cache_resource` |

Daftar ini juga tersedia dari kode: `Slak.old_names`.

## Yang tidak bisa diterjemahkan langsung

Karena Slak berjalan di browser tanpa server, beberapa hal Streamlit berbeda:

| Streamlit | Di Slak |
|---|---|
| `st.secrets` | Sengaja tidak menyimpan apa pun: rahasia harus disimpan di server (slak-bridge), karena isi halaman bisa dibaca pengunjung |
| Koneksi langsung ke MySQL/PostgreSQL | Lewat `slak-bridge.php` atau `slak-bridge.js` (Bab 26) |
| Pustaka Python apa pun | Slak Data untuk analisis umum; Python asli lewat `sl.python` (butuh internet) |
| `st.progress` berskala 0–1 | `sl.progress` berskala 0–100 |
| `st.date_input` mengembalikan objek tanggal | `sl.date_input` mengembalikan teks `YYYY-MM-DD` |
