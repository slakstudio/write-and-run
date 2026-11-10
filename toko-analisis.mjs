// toko-analisis.mjs — versi ES Module dari toko-analisis.js.
// Dipakai dengan:  const { ringkas } = await import(new URL("toko-analisis.mjs", location.href))
export function ringkas(df) {
  return {
    omzet: df.total.sum(),
    transaksi: df.shape[0],
    pelanggan: df.pelanggan_id.nunique()
  }
}

export const rupiah = (x) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(x)
