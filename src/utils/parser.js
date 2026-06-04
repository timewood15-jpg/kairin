const parserRules = require('../config/parserRules');

function parseOfflineTransaction(text) {
  if (!text) return null;

  const input = text.toLowerCase().trim().replace(/(\d)\s+([.,]\d)/g, '$1$2')
  .replace(/([.,])\s+(\d)/g, '$1$2');

  // 🔢 ambil angka + unit
  const match = input.match(/([\d.,]+)\s*(rb|ribu|k|jt|juta)?/i);
  if (!match) return null;

  let amount = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));

  const unit = match[2];

  if (unit) {
    if (['rb', 'ribu', 'k'].includes(unit)) amount *= 1000;
    if (['jt', 'juta'].includes(unit)) amount *= 1000000;
  }

  amount = Math.round(amount);

  if (!amount || isNaN(amount)) return null;

  const expenseExplicit = parserRules.expenseExplicit;

  const incomeExplicit = parserRules.incomeExplicit;

  const isExpense = expenseExplicit.some(k => input.includes(k));
  const isIncome = isExpense
    ? false
    : incomeExplicit.some(k => input.includes(k)) ||
      parserRules.incomeKeywords.some(k => input.includes(k));

  const type = isIncome ? 'pemasukan' : 'pengeluaran';

  // 🏷️ DETEKSI KATEGORI SEDERHANA
  const categoryMap = parserRules.categoryMap;

  let category = 'Lain-lain';

  for (const key in categoryMap) {
    if (categoryMap[key].some(k => input.includes(k))) {
      category = key.charAt(0).toUpperCase() + key.slice(1);
      break;
    }
  }

  let description = input
    .replace(/([\d.,]+)\s*(rb|ribu|k|jt|juta)?/gi, '') // hapus angka + unit
    .trim();

  if (!description) {
    description = type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran';
  }

  description =
    description.charAt(0).toUpperCase() + description.slice(1);

  return {
    type,
    amount,
    description,
    category,
    confidence: 0.9 // tinggi karena deterministic
  };
}

module.exports = { parseOfflineTransaction };