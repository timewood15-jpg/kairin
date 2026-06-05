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
    makanan: ['makan', 'kopi', 'minum', 'resto'],
    transportasi: ['bensin', 'grab', 'gojek', 'tol'],
    belanja: ['beli', 'shop', 'market'],
    utilitas: ['listrik', 'air', 'wifi', 'internet']
  }
};
