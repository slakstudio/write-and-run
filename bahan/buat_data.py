"""Membuat dataset fiktif Toko Nusantara untuk buku Write and Run.
Deterministik (benih tetap), jadi angka di buku selalu sama.
Pakai: python3 -I buat_data.py <folder-keluaran>
"""
import csv, os, random, sys, datetime as dt, math

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
R = random.Random(2026)

CABANG = [
    # kode, nama cabang, kota, provinsi, lat, lon, tanggal buka, bobot
    ("JYP", "Nusantara Jayapura", "Jayapura", "Papua", -2.5337, 140.7181, "2019-03-01", 1.30),
    ("SOQ", "Nusantara Sorong", "Sorong", "Papua Barat Daya", -0.8762, 131.2558, "2020-07-15", 0.95),
    ("MKW", "Nusantara Manokwari", "Manokwari", "Papua Barat", -0.8615, 134.0620, "2021-02-01", 0.70),
    ("MKS", "Nusantara Makassar", "Makassar", "Sulawesi Selatan", -5.1477, 119.4327, "2019-09-10", 1.20),
    ("MDC", "Nusantara Manado", "Manado", "Sulawesi Utara", 1.4748, 124.8421, "2020-11-02", 0.85),
    ("AMQ", "Nusantara Ambon", "Ambon", "Maluku", -3.6954, 128.1814, "2021-05-20", 0.75),
    ("KOE", "Nusantara Kupang", "Kupang", "Nusa Tenggara Timur", -10.1772, 123.6070, "2022-01-10", 0.65),
    ("DPS", "Nusantara Denpasar", "Denpasar", "Bali", -8.6500, 115.2167, "2020-04-01", 1.05),
    ("SUB", "Nusantara Surabaya", "Surabaya", "Jawa Timur", -7.2575, 112.7521, "2019-06-01", 1.35),
    ("JKT", "Nusantara Jakarta", "Jakarta", "DKI Jakarta", -6.2088, 106.8456, "2019-01-15", 1.60),
]

PRODUK = [
    # produk, kategori, harga jual, harga pokok, pemasok, bobot
    ("Kopi Arabika Wamena 250g", "Minuman", 85000, 52000, "Koperasi Baliem", 1.4),
    ("Kopi Robusta Toraja 250g", "Minuman", 72000, 45000, "CV Tana Toraja", 1.2),
    ("Teh Kayu Manis 100g", "Minuman", 35000, 19000, "UD Rempah Maluku", 0.9),
    ("Sirup Pala 500ml", "Minuman", 48000, 27000, "UD Rempah Maluku", 0.7),
    ("Keripik Keladi 200g", "Makanan", 22000, 11000, "UKM Sagu Sentani", 1.6),
    ("Sagu Lempeng 1kg", "Makanan", 30000, 16000, "UKM Sagu Sentani", 1.1),
    ("Abon Ikan Cakalang 250g", "Makanan", 55000, 33000, "CV Bitung Bahari", 1.0),
    ("Sambal Roa 200g", "Makanan", 45000, 25000, "CV Bitung Bahari", 1.3),
    ("Kacang Kenari 250g", "Makanan", 65000, 41000, "UD Rempah Maluku", 0.6),
    ("Madu Hutan Timor 500ml", "Makanan", 120000, 78000, "Koperasi Timor Lestari", 0.5),
    ("Noken Anyaman Kecil", "Kerajinan", 150000, 90000, "Sanggar Noken Abepura", 0.45),
    ("Tenun Ikat Sumba Selendang", "Kerajinan", 350000, 230000, "Koperasi Timor Lestari", 0.25),
    ("Ukiran Asmat Mini", "Kerajinan", 275000, 170000, "Sanggar Noken Abepura", 0.2),
    ("Gelang Manik Papua", "Kerajinan", 40000, 18000, "Sanggar Noken Abepura", 0.8),
    ("Minyak Kayu Putih 60ml", "Kebutuhan Rumah", 38000, 22000, "UD Rempah Maluku", 1.2),
    ("Sabun Sereh Wangi", "Kebutuhan Rumah", 18000, 8000, "UKM Wangi Bali", 1.5),
    ("Lilin Aromaterapi", "Kebutuhan Rumah", 60000, 32000, "UKM Wangi Bali", 0.6),
    ("Kaos Motif Cenderawasih", "Pakaian", 125000, 70000, "Konveksi Jayapura", 0.7),
    ("Topi Rotan", "Pakaian", 85000, 46000, "Sanggar Noken Abepura", 0.4),
    ("Kain Pantai Bali", "Pakaian", 95000, 52000, "UKM Wangi Bali", 0.55),
]

LEBARAN = {2023: dt.date(2023, 4, 22), 2024: dt.date(2024, 4, 10)}

def faktor_musim(d):
    f = 1.0
    leb = LEBARAN[d.year]
    selisih = (leb - d).days
    if 0 <= selisih <= 21:
        f *= 1.9 - selisih * 0.03          # menjelang Lebaran
    if d.month == 12:
        f *= 1.35 + (d.day / 31) * 0.4     # akhir tahun
    if d.weekday() >= 5:
        f *= 1.25                          # akhir pekan
    if d.month in (2, 9):
        f *= 0.85                          # bulan sepi
    return f

def tren(d):
    hari = (d - dt.date(2023, 1, 1)).days
    return 1.0 + hari / 731 * 0.35        # tumbuh sekitar 35% dalam dua tahun

def pilih(seq, bobot):
    return R.choices(seq, weights=bobot, k=1)[0]

def buat_transaksi(n_hari_target=2950, skala=1.0, mulai=dt.date(2023, 1, 1), akhir=dt.date(2024, 12, 31), pelanggan=650):
    hari = []
    d = mulai
    while d <= akhir:
        hari.append(d); d += dt.timedelta(days=1)
    bobot_hari = [faktor_musim(x) * tren(x) for x in hari]
    total_b = sum(bobot_hari)
    pel_cabang = {}
    for i in range(1, pelanggan + 1):
        pel_cabang[f"P{i:04d}"] = pilih(CABANG, [c[7] for c in CABANG])[0]
    pel_list = list(pel_cabang)
    # pelanggan setia lebih sering belanja
    pel_bobot = [1 / (1 + (i % 97) * 0.06) for i in range(len(pel_list))]
    baris = []
    nomor = 1
    for x, b in zip(hari, bobot_hari):
        n = max(1, round(n_hari_target * skala * b / total_b + R.uniform(-0.6, 0.6)))
        for _ in range(n):
            p = pilih(pel_list, pel_bobot)
            kode = pel_cabang[p] if R.random() < 0.85 else pilih(CABANG, [c[7] for c in CABANG])[0]
            cab = next(c for c in CABANG if c[0] == kode)
            if x < dt.date.fromisoformat(cab[6]):
                continue
            kanal = "Online" if R.random() < (0.30 + (x.year - 2023) * 0.08) else "Toko"
            pr = pilih(PRODUK, [q[5] for q in PRODUK])
            jumlah = pilih([1, 1, 1, 2, 2, 3, 4, 5], [5, 5, 5, 4, 4, 2, 1, 1])
            harga = pr[2]
            if x.year == 2024:
                harga = int(round(harga * 1.05 / 500) * 500)   # harga naik 5% di 2024
            diskon = 0
            if (LEBARAN[x.year] - x).days in range(0, 15) and R.random() < 0.4:
                diskon = 10
            total = int(round(jumlah * harga * (100 - diskon) / 100))
            baris.append({
                "id_transaksi": f"TN{nomor:06d}", "tanggal": x.isoformat(), "pelanggan_id": p,
                "cabang": cab[1], "kota": cab[2], "provinsi": cab[3], "kanal": kanal,
                "kategori": pr[1], "produk": pr[0], "jumlah": jumlah, "harga": harga,
                "diskon_persen": diskon, "total": total,
            })
            nomor += 1
    return baris

KOLOM = ["id_transaksi", "tanggal", "pelanggan_id", "cabang", "kota", "provinsi", "kanal",
         "kategori", "produk", "jumlah", "harga", "diskon_persen", "total"]

def tulis(nama, baris, kolom, sep=","):
    with open(os.path.join(OUT, nama), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=kolom, delimiter=sep)
        w.writeheader()
        for r in baris:
            w.writerow(r)

# 1. Transaksi bersih
trx = buat_transaksi()
tulis("toko-nusantara.csv", trx, KOLOM)

# 2. Produk, cabang, target
tulis("produk.csv", [{"produk": p[0], "kategori": p[1], "harga_jual": p[2], "harga_pokok": p[3], "pemasok": p[4]} for p in PRODUK],
      ["produk", "kategori", "harga_jual", "harga_pokok", "pemasok"])
tulis("cabang.csv", [{"kode": c[0], "cabang": c[1], "kota": c[2], "provinsi": c[3], "lat": c[4], "lon": c[5], "tanggal_buka": c[6]} for c in CABANG],
      ["kode", "cabang", "kota", "provinsi", "lat", "lon", "tanggal_buka"])
omzet = {}
for r in trx:
    k = (r["cabang"], r["tanggal"][:7])
    omzet[k] = omzet.get(k, 0) + r["total"]
target = []
for c in CABANG:
    for th in (2023, 2024):
        for bl in range(1, 13):
            bulan = f"{th}-{bl:02d}"
            nyata = omzet.get((c[1], bulan), 0)
            if nyata == 0:
                continue
            t = int(round(nyata * R.uniform(0.85, 1.15) / 100000) * 100000)
            target.append({"cabang": c[1], "bulan": bulan, "target": t})
tulis("target.csv", target, ["cabang", "bulan", "target"])

# 3. Versi kotor (untuk Bab 13): 400 baris dari Jakarta & Jayapura & Makassar Januari 2024
R2 = random.Random(7)
sumber = [r for r in trx if r["tanggal"].startswith("2024-0") and r["kota"] in ("Jayapura", "Makassar", "Surabaya")][:380]
SALAH_KOTA = {"Jayapura": ["jayapura", " Jayapura", "JAYAPURA", "Jayapra"], "Makassar": ["makassar ", "Makasar", "MAKASSAR"],
              "Surabaya": ["surabaya", "Surabya", " SURABAYA "]}
kotor = []
for r in sumber:
    x = dict(r)
    d = dt.date.fromisoformat(x["tanggal"])
    gaya = R2.random()
    if gaya < 0.25:
        x["tanggal"] = d.strftime("%d/%m/%Y")
    elif gaya < 0.35:
        bln = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][d.month - 1]
        x["tanggal"] = f"{d.day} {bln} {d.year}"
    if R2.random() < 0.25:
        x["kota"] = R2.choice(SALAH_KOTA[x["kota"]])
    if R2.random() < 0.30:
        x["harga"] = "Rp " + f"{x['harga']:,}".replace(",", ".")
    if R2.random() < 0.15:
        x["produk"] = "  " + x["produk"].upper() if R2.random() < 0.5 else x["produk"].lower() + " "
    if R2.random() < 0.05:
        x["jumlah"] = ""
    if R2.random() < 0.04:
        x["kanal"] = ""
    kotor.append(x)
# duplikat
for i in R2.sample(range(len(kotor)), 14):
    kotor.append(dict(kotor[i]))
# pencilan: salah ketik jumlah
for i in R2.sample(range(len(kotor)), 3):
    kotor[i]["jumlah"] = 250
R2.shuffle(kotor)
KOLOM_KOTOR = ["id_transaksi", "tanggal", "kota", "kanal", "kategori", "produk", "jumlah", "harga"]
tulis("toko-nusantara-kotor.csv", [{k: r[k] for k in KOLOM_KOTOR} for r in kotor], KOLOM_KOTOR)

# 4. Versi besar (untuk Bab 12 dan 21): sekitar 250 ribu baris
if "--besar" in sys.argv:
    R.seed(99)
    besar = buat_transaksi(n_hari_target=250000, pelanggan=20000)
    tulis("toko-nusantara-besar.csv", besar, KOLOM)
    print("besar:", len(besar))

print("transaksi:", len(trx), "kotor:", len(kotor), "target:", len(target))
