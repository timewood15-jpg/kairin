module.exports = {
  // AI Configuration
  AI_RETRY_OCR_COUNT: 1,
  AI_RETRY_OCR_DELAY_MS: 1200,
  AI_RETRY_PARSE_TEXT_COUNT: 2,
  AI_RETRY_PARSE_TEXT_DELAY_MS: 1000,
  AI_DEFAULT_CATEGORY: 'Lain-lain',
  AI_EXPENSE_TYPE: 'pengeluaran',
  AI_INCOME_TYPE: 'pemasukan',
  AI_TRANSACTION_CATEGORIES: [
    'Makanan & Minuman',
    'Transportasi',
    'Belanja',
    'Kesehatan',
    'Utilitas',
    'Hiburan',
    'Pulsa & Data',
    'Gaji',
    'Bonus',
    'Penjualan',
    'Transfer Masuk',
    'Transfer',
    'Lain-lain'
  ],
  AI_MODEL_NAME: 'gemini-2.5-flash',

  // Google Sheet Configuration
  SHEET_NAME_TRANSACTIONS: 'Transaksi',
  SHEET_NAME_MONTHLY_SUMMARY: 'Rekap Bulanan',
  SHEET_RANGE_TRANSACTIONS_DATA: 'Transaksi!A2:D',
  SHEET_RANGE_MONTHLY_SUMMARY_DATA: 'Rekap Bulanan!A2:D',
  SHEET_RANGE_TRANSACTIONS_HEADERS: 'Transaksi!A1:D1',
  SHEET_RANGE_MONTHLY_SUMMARY_HEADERS: 'Rekap Bulanan!A1:D1',
  SHEET_HEADERS_TRANSACTIONS: ['Tanggal', 'Deskripsi', 'Jumlah', 'Kategori'],
  SHEET_HEADERS_MONTHLY_SUMMARY: ['Bulan', 'Pemasukan', 'Pengeluaran', 'Saldo'],
};