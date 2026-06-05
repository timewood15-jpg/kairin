const db = require('../services/database');

const financeContext = new Map();

function cleanFinanceContext() {
  const now = Date.now();
  for (const [k, v] of financeContext) {
    if (v.expiresAt <= now) financeContext.delete(k);
  }
}

function getFinanceContext(userId) {
  cleanFinanceContext();
  return financeContext.get(userId) || null;
}

function setFinanceContext(userId, category) {
  financeContext.set(userId, {
    category,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
}

function detectFinanceFollowUp(t) {
  if (/\b(apa\s+itu|apa\s+aja|rincian|detail)\b/.test(t)) return 'apa itu';
  if (/\b(yang\s+terbesar\s+apa|yang\s+paling\s+besar|yang\s+paling\s+mahal)\b/.test(t)) return 'yang terbesar apa';
  return null;
}

async function handleFinanceInsight(bot, chatId, user, input) {
  const t0 = input.toLowerCase().trim();
  cleanFinanceContext();

  const followUp = detectFinanceFollowUp(t0);
  const ctx = followUp ? getFinanceContext(user.id) : null;
  if (followUp && ctx) {
    input = `${ctx.category} ${followUp}`;
  }

  const t = input.toLowerCase().trim();

  const keywordToCategory = { makan: 'Makanan', transport: 'Transportasi' };
  const matchedKeyword = Object.keys(keywordToCategory).find(
    (kw) => new RegExp('\\b' + kw + '\\b').test(t)
  );
  const specificCategory = matchedKeyword ? keywordToCategory[matchedKeyword] : null;
  const aliasMatch2 = Object.keys(categoryAlias).find(
    (alias) => new RegExp('\\b' + alias + '\\b', 'i').test(t)
  );
  const resolvedCategory =
    (specificCategory) ||
    (aliasMatch2 && categoryAlias[aliasMatch2]) ||
    null;

  const breakdown =
    /\b(belanja|makanan|makan|transport|transportasi|hiburan|kesehatan|rumah|kendaraan|pulsa|hutang|transfer|bisnis|refund)\s+apa\s+(itu|aja|saja)\b/.test(t) ||
    /\bkategori\s+(belanja|makanan|makan|transport|transportasi|hiburan|kesehatan|rumah|kendaraan|pulsa|hutang|transfer|bisnis|refund)\s+apa\s+saja\b/.test(t) ||
    /\bkategori\s+(\w+)\s+bulan\s+ini\s+apa\s+saja\b/.test(t) ||
    /\btop\s+3\s+pengeluaran\s+bulan\s+ini\b/.test(t) ||
    /\btransaksi\s+terbesar\s+bulan\s+ini\b/.test(t) ||
    /\bpengeluaran\s+terbesar\s+apa\b/.test(t) ||
    /\bkategori\s+\w+\s+apa\s+saja\b/.test(t) ||
    /\byang\s+terbesar\s+apa\b/.test(t);

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
    /\bpemasukan\s+bulan\s+ini\b/.test(t) ||
    /\b(belanja|makanan|makan|transport|transportasi|hiburan|kesehatan|rumah|kendaraan|pulsa|hutang|transfer|bisnis|refund)\s+bulan\s+ini\b/.test(t) ||
    /\bbulan\s+ini\b.*\b(belanja|makanan|makan|transport|transportasi|hiburan|kesehatan|rumah|kendaraan|pulsa|hutang|transfer|bisnis|refund)\b/.test(t);

  if (!isMonthlyInsight && !breakdown) return false;


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

  const specificAmount = resolvedCategory ? categoryTotals[resolvedCategory] || 0 : undefined;

  let reply =
    '📊 Ringkasan ' + monthLabel + '\n\n' +
    '🟢 Pemasukan: Rp ' + income.toLocaleString('id-ID') + '\n' +
    '🔴 Pengeluaran: Rp ' + expense.toLocaleString('id-ID');

  if (topCategory && !resolvedCategory) {
    reply +=
      '\n💰 Paling boros: *' + topCategory + '* — Rp ' + topCategoryAmount.toLocaleString('id-ID');
    setFinanceContext(user.id, topCategory);
  }

  if (resolvedCategory) {
    reply += '\n🏷️ *' + resolvedCategory + '* bulan ini: Rp ' + specificAmount.toLocaleString('id-ID');
    setFinanceContext(user.id, resolvedCategory);
  }

  const isCategoryTotal =
    resolvedCategory &&
    (/\bbulan\s+ini\b/.test(t) || /\bhabis\b/.test(t)) &&
    /\bberapa\b/.test(t);

  if (isCategoryTotal && resolvedCategory) {
    const catTotal = categoryTotals[resolvedCategory] || 0;
    const catTransactions = transactions.filter(
      (trx) => trx.type === 'pengeluaran' && (trx.category || 'Lain-lain') === resolvedCategory
    );
    const count = catTransactions.length;
    const avg = count > 0 ? Math.round(catTotal / count) : 0;
    await bot.sendMessage(
      chatId,
      [
        '🏷️ ' + resolvedCategory + ' — ' + monthLabel,
        '',
        '💰 Total: Rp ' + catTotal.toLocaleString('id-ID'),
        '📦 ' + count + ' transaksi',
        '📈 Rata-rata: Rp ' + avg.toLocaleString('id-ID') + ' / transaksi'
      ].join('\n')
    );
    setFinanceContext(user.id, resolvedCategory);
    return true;
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

  const t = input.toLowerCase().trim();

  const catMatch = t.match(/\bkategori\s+(\w+)/);
  const targetAlias = catMatch ? catMatch[1].toLowerCase() : null;

  const aliasMatch = Object.keys(categoryAlias).find(
    (alias) => new RegExp(`\\b${alias}\\b`, 'i').test(t)
  );

  const canonicalCategory =
    (targetAlias && categoryAlias[targetAlias]) ||
    (aliasMatch && categoryAlias[aliasMatch]) ||
    null;

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
    if (canonicalCategory) setFinanceContext(user.id, canonicalCategory);
    return true;
  }

  if (/yang\s+terbesar\s+apa/.test(t)) {
    if (!canonicalCategory) {
      return false;
    }

    const expense = [...transactions]
      .filter(trx => (trx.category || '') === canonicalCategory && trx.type === 'pengeluaran')
      .sort((a, b) => b.amount - a.amount);

    if (!expense.length) {
      await bot.sendMessage(chatId, `📭 Belum ada transaksi terbesar di kategori ${canonicalCategory}.`);
      return true;
    }

    const top = expense[0];
    const date = new Date(top.date || top.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    await bot.sendMessage(
      chatId,
      [
        `🏷️ ${canonicalCategory} — transaksi terbesar`,
        `${top.description || top.note || '-'}`,
        `Rp ${top.amount.toLocaleString('id-ID')}`,
        `${canonicalCategory} • ${date}`
      ].join('\n')
    );
    setFinanceContext(user.id, canonicalCategory);
    return true;
  }

  if (!canonicalCategory) {
    await bot.sendMessage(chatId, '📭 Belum ada kategori yang dikenali dari pertanyaan ini.');
    return true;
  }

  const matched = [...transactions].filter(trx => (trx.category || '') === canonicalCategory);

  if (!matched.length) {
    await bot.sendMessage(chatId, '📭 Belum ada transaksi kategori ' + canonicalCategory + ' bulan ini.');
    return true;
  }

  const sorted = [...matched].sort((a, b) => b.amount - a.amount);
  const shown = sorted.slice(0, 10);
  const overflow = Math.max(0, sorted.length - 10);

  const monthLabel = new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  const lines = ['📋 Kategori ' + canonicalCategory + ' (' + monthLabel + ')'];
  shown.forEach((trx, idx) => {
    lines.push(
      (idx + 1) +
        '. ' +
        (trx.description || trx.note || '-') +
        ' — Rp ' +
        trx.amount.toLocaleString('id-ID')
    );
  });
  if (overflow > 0) {
    lines.push('+' + overflow + ' transaksi lain');
  }
  const total = matched.reduce((sum, trx) => sum + trx.amount, 0);
  lines.push('💰 Total: Rp ' + total.toLocaleString('id-ID'));
  await bot.sendMessage(chatId, lines.join('\n'));
  setFinanceContext(user.id, canonicalCategory);
  return true;
}

module.exports = {
  handleFinanceInsight
};
