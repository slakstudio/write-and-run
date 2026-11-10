/* toko-analisis.js — fungsi analisis Toko Nusantara (berkas JavaScript biasa).
 * Muat sesudah slak.js dan slak-data.js:  <script src="toko-analisis.js"></script>
 * Semua fungsi ada di objek TokoAnalisis, supaya tidak bertabrakan dengan nama lain. */
window.TokoAnalisis = {
  /** Menyaring DataFrame transaksi menurut tahun, daftar cabang (kosong = semua), dan kanal ("Semua" = semua). */
  saring(df, { tahun, cabang = [], kanal = "Semua" } = {}) {
    return df
      .filter(r => tahun == null || r.tanggal.getFullYear() === tahun)
      .filter(r => cabang.length === 0 || cabang.includes(r.cabang))
      .filter(r => kanal === "Semua" || r.kanal === kanal)
  },
  /** Angka utama: omzet, transaksi, pelanggan, rata-rata per transaksi. */
  ringkas(df) {
    return {
      omzet: df.total.sum(),
      transaksi: df.shape[0],
      pelanggan: df.pelanggan_id.nunique(),
      rata: df.shape[0] ? df.total.sum() / df.shape[0] : 0
    }
  },
  /** Persen perubahan b terhadap a, bergaya Indonesia (+12,3%); null bila a kosong. */
  banding(a, b) {
    if (!a) return null
    return new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1, signDisplay: "always" }).format(b / a - 1)
  }
}
