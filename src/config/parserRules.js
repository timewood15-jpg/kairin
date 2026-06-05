module.exports = {
  expenseExplicit: [
    'bayar hutang',
    'masuk deposito',
    'modal usaha',
    'setor tabungan',
    'transfer ke'
  ],
  incomeExplicit: [
    'refund',
    'bunga deposito',
    'dibayar customer',
    'dibayar hutang',
    'dibayarin',
    'nagih hutang',
    'pinjam uang',
    'retur barang',
    'tarik tabungan',
    'uang kembali',
    'utang dibayar',
    'transfer dari'
  ],
  overridingIncome: [
    'dibayar hutang',
    'utang dibayar'
  ],
  incomeKeywords: [
    'gaji',
    'honor',
    'bonus',
    'omzet',
    'masuk',
    'terima',
    'dapat',
    '+'
  ],
  categoryMap: {
    hutang: ['bayar hutang', 'dibayar hutang', 'cicilan', 'angsuran', 'pinjam'],
    tabungan: ['tabungan', 'deposito'],
    transfer: ['transfer ke', 'transfer dari', 'topup', 'isi saldo'],
    bisnis: ['modal usaha', 'jualan', 'omzet'],
    refund: ['refund', 'retur barang', 'uang kembali'],
    tunai: ['tunai', 'atm'],
    makanan: [
      'makan',
      'kopi',
      'minum',
      'resto',
      'jajan',
      'snack',
      'bakso',
      'ayam',
      'warung',
      'mie'
    ],
    transportasi: ['bensin', 'grab', 'gojek', 'tol'],
    belanja: ['beli', 'shop', 'market'],
    utilitas: ['listrik', 'air', 'wifi', 'internet'],
    kesehatan: ['dokter', 'klinik', 'rumah sakit', 'berobat', 'apotek'],
    kendaraan: ['bengkel', 'oli', 'servis motor', 'servis mobil', 'parkir', 'pajak kendaraan'],
    rumah: ['kontrakan', 'kos', 'sewa rumah', 'perbaikan rumah'],
    pulsa: ['pulsa', 'kuota', 'paket data'],
    hiburan: ['bioskop', 'nonton', 'hiburan']
  }
};
