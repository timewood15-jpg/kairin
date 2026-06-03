function parseOfflineTransaction(text) {
  if (!text) return null;

  const input = text.toLowerCase().trim();

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

  // 💰 DETEKSI TYPE
  const pemasukanKeywords = [
    'gaji', 'honor', 'bonus', 'masuk', 'terima', 'dapat', '+'
  ];

  const isIncome = pemasukanKeywords.some(k => input.includes(k));

  const type = isIncome ? 'pemasukan' : 'pengeluaran';

  // 🏷️ DETEKSI KATEGORI SEDERHANA
  const categoryMap = {
    makanan: ['makan', 'kopi', 'minum', 'resto'],
    transportasi: ['bensin', 'grab', 'gojek', 'tol'],
    belanja: ['beli', 'shop', 'market'],
    utilitas: ['listrik', 'air', 'wifi', 'internet'],
  };

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