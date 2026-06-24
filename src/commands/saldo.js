const db = require('../services/database');
const { formatRupiah } = require('../utils/currency');

async function handleSaldo(bot, chatId, user) {
  const summary = await db.getMonthlySummary(user.id);
  const now = new Date();
  const monthName = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  let categoryText = '';
  if (summary.topCategories.length > 0) {
    categoryText = '\n\n*Top Pengeluaran:*\n' + summary.topCategories
      .map(([cat, amt]) => `• ${cat}: Rp ${formatRupiah(amt)}`)
      .join('\n');
  }

  await bot.sendMessage(chatId,
    `📊 *Rekap ${monthName}*\n\n` +
    `🟢 Pemasukan:   Rp ${formatRupiah(summary.income)}\n` +
    `🔴 Pengeluaran: Rp ${formatRupiah(summary.expense)}\n` +
    `💰 Saldo:       Rp ${formatRupiah(summary.balance + (user.initial_balance || 0))}\n` +
    `📝 Transaksi:   ${summary.totalTransactions}x` +
    categoryText
  , { parse_mode: 'Markdown' });
}

module.exports = { handleSaldo };