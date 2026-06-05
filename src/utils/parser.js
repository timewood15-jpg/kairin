const parserRules = require('../config/parserRules');

function parseOfflineTransaction(text) {
  if (!text) return null;

  const textLower = text.toLowerCase().trim().replace(/(\d)\s+([.,]\d)/g, '$1$2')
    .replace(/([.,])\s+(\d)/g, '$1$2');
  const input = textLower;

  // 🔢 ambil angka + unit
  const match = input.match(/([\d.,]+)\s*(rb|ribu|k|jt|juta)?/i);
  if (!match) return null;

  // Normalisasi angka Indonesia menggunakan HANYA match[1]
  let raw = match[1];
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    const afterComma = raw.slice(raw.lastIndexOf(',') + 1);
    const suffixAfterComma = afterComma.trim();
    const digitsOnly = suffixAfterComma.replace(/[^\d]/g, '');
    if (digitsOnly.length === 3 && digitsOnly.length === suffixAfterComma.length) {
      raw = raw.replace(/,/g, '');
    } else if (digitsOnly.length <= 2 && digitsOnly.length === suffixAfterComma.length) {
      raw = raw.replace(',', '.');
    } else {
      raw = raw.replace(',', '.');
    }
  } else if (raw.includes('.')) {
    const afterDot = raw.slice(raw.lastIndexOf('.') + 1);
    const suffixAfterDot = afterDot.trim();
    const digitsOnly = suffixAfterDot.replace(/[^\d]/g, '');
    if (digitsOnly.length === 3 && digitsOnly.length === suffixAfterDot.length) {
      raw = raw.replace(/\./g, '');
    } else if (digitsOnly.length <= 2) {
      // keep dot as decimal, parseFloat handles it
    } else {
      raw = raw.replace(/\./g, '');
    }
  }

  let amount = parseFloat(raw);

  const unit = match[2];

  if (unit) {
    if (['rb', 'ribu', 'k'].includes(unit)) amount *= 1000;
    if (['jt', 'juta'].includes(unit)) amount *= 1000000;
  }

  amount = Math.round(amount);

  if (!amount || isNaN(amount)) return null;

  const expenseExplicit = parserRules.expenseExplicit;

  const incomeExplicit = parserRules.incomeExplicit;

  const overridingIncome = parserRules.overridingIncome || [];

  const isExpense = expenseExplicit.some(k => input.includes(k));

  const incomeMatch =
    incomeExplicit.some(k => input.includes(k)) ||
    parserRules.incomeKeywords.some(k => input.includes(k));

  const isIncome = overridingIncome.some(k => input.includes(k))
    ? true
    : isExpense
      ? false
      : incomeMatch;

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