const db = require('../services/database');

async function handleFinanceInsight(bot, chatId, user, input) {
  const t = input;

  // Phase 2: deterministic breakdowns
  const breakdown =
    /\bkategori\s+(\w+)\s+bulan\s+ini\s+apa\s+saja\b/.test(t) ||
    /\bkategori\s+(\w+)\s+apa\s+saja\b/.test(t) ||
    /\b(makanan|makan|transport|transportasi|belanja|kendaraan|kesehatan|rumah|hiburan|pulsa|hutang)\s+bulan\s+ini\s+apa\s+aja\b/.test(t) ||
    /\btop\s+3\s+pengeluaran\s+bulan\s+ini\b/.test(t) ||
    /\btransaksi\s+terbesar\s+bulan\s+ini\b/.test(t) ||
    /\bpengeluaran\s+terbesar\s+apa\b/.test(t);

  if (breakdown) {
    return await handleBreakdown(bot, chatId, user, input);
  }

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

const categoryAlias = {
  makanan: 'Makanan',
  makan: 'Makanan',
  transport: 'Transportasi',
  transportasi: 'Transportasi',
  belanja: 'Belanja',
  kendaraan: 'Kendaraan',
  kesehatan: 'Kesehatan',
  rumah: 'Rumah',
  hiburan: 'Hiburan',
  pulsa: 'Pulsa',
  hutang: 'Hutang'
};

async function handleBreakdown(bot, chatId, user, input) {
  const transactions = await db.getMonthlyTransactions(user.id);

  if (!transactions.length) {
    await bot.sendMessage(chatId, '📭 Belum ada transaksi bulan ini.');
    return true;
  }

  const t = input;

  if (/top\s+3/.test(t) || /transaksi\s+terbesar/.test(t) || /pengeluaran\s+terbesar\s+apa/.test(t)) {
    const expenseTrxs = transactions
      .filter(trx => trx.type === 'pengeluaran')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const now = new Date();
    const monthLabel = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    const lines = ['🔝 Top pengeluaran ' + monthLabel];
    expenseTrxs.forEach((trx, idx) => {
      const date = new Date(trx.date || trx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      lines.push(
        idx +
          1 +
          '. ' +
          (trx.description || trx.note || '-') +
          '\n   Rp ' +
          trx.amount.toLocaleString('id-ID') +
          '\n   ' +
          (trx.category || 'Lain-lain') +
          ' • ' +
          date
      );
    });
    await bot.sendMessage(chatId, lines.join('\n'));
    return true;
  }

  const catMatch = t.match(/\bkategori\s+(\w+)/);
  const targetAlias = catMatch ? catMatch[1].toLowerCase() : null;

  const aliasMatch = Object.keys(categoryAlias).find(
    alias => new RegExp('\\b' + alias + '\\b').test(t)
  );

  const canonicalCategory =
    (targetAlias && categoryAlias[targetAlias]) ||
    (aliasMatch && categoryAlias[aliasMatch]) ||
    null;

  if (canonicalCategory) {
    const matched = transactions.filter(trx => (trx.category || '') === canonicalCategory);

    if (!matched.length) {
      await bot.sendMessage(chatId, '📭 Belum ada transaksi kategori ' + canonicalCategory + ' bulan ini.');
      return true;
    }

    let total = 0;
    const lines = ['📋 Kategori ' + canonicalCategory + ':'];
    matched.forEach(trx => {
      total += trx.amount;
      const date = new Date(trx.date || trx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      lines.push('- ' + (trx.description || trx.note || '-') + ' | Rp ' + trx.amount.toLocaleString('id-ID') + ' | ' + date);
    });
    lines.push('Jumlah: Rp ' + total.toLocaleString('id-ID'));
    await bot.sendMessage(chatId, lines.join('\n'));
    return true;
  }

  return false;
}

module.exports = {
  handleFinanceInsight
};
