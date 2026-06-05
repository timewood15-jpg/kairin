const db = require('../services/database');

async function handleFinanceInsight(bot, chatId, user, input) {
  const t = input;

  const isMonthlyInsight =
    /\bpengeluaran\s+terbesar\b/.test(t) ||
    /\bpaling\s+boros\b/.test(t) ||
    /\bmakan\s+bulan\s+ini\b/.test(t) ||
    /\btransport(asi)?\s+bulan\s+ini\b/.test(t) ||
    /\btotal\s+pengeluaran\s+bulan\s+ini\b/.test(t) ||
    /\bpengeluaran\s+bulan\s+ini\b/.test(t) ||
    /\bpemasukan\s+bulan\s+ini\b/.test(t);

  if (!isMonthlyInsight) return false;

  const transactions = await db.getMonthlyTransactions(user.id);

  if (!transactions.length) {
    await bot.sendMessage(chatId, '📭 Belum ada transaksi bulan ini.');
    return true;
  }

  const now = new Date();
  const monthLabel = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  let income = 0;
  let expense = 0;
  const categoryTotals = {};

  for (const trx of transactions) {
    if (trx.type === 'pemasukan') {
      income += trx.amount;
      continue;
    }

    expense += trx.amount;
    const cat = trx.category || 'Lain-lain';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + trx.amount;
  }

  const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategory = top ? top[0] : null;
  const topCategoryAmount = top ? top[1] : 0;

  const keywordToCategory = { makan: 'Makanan', transport: 'Transportasi' };
  const matchedKeyword = Object.keys(keywordToCategory).find(
    (kw) => new RegExp('\\b' + kw + '\\b').test(t)
  );
  const specificCategory = matchedKeyword ? keywordToCategory[matchedKeyword] : null;
  const specificAmount = specificCategory ? categoryTotals[specificCategory] || 0 : undefined;

  let reply =
    '📊 Ringkasan ' + monthLabel + '\n\n' +
    '🟢 Pemasukan: Rp ' + income.toLocaleString('id-ID') + '\n' +
    '🔴 Pengeluaran: Rp ' + expense.toLocaleString('id-ID');

  if (topCategory && !specificCategory) {
    reply +=
      '\n💰 Paling boros: *' + topCategory + '* — Rp ' + topCategoryAmount.toLocaleString('id-ID');
  }

  if (specificCategory) {
    reply += '\n🏷️ *' + specificCategory + '* bulan ini: Rp ' + specificAmount.toLocaleString('id-ID');
  }

  await bot.sendMessage(chatId, reply);
  return true;
}

module.exports = {
  handleFinanceInsight
};
