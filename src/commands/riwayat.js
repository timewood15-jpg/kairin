const transactionRepo = require('../services/db/transactionRepo');
const sessionRepo = require('../services/db/sessionRepo');

async function handleRiwayat(bot, chatId, user) {
  const transactions =
    await transactionRepo.getLastTransactions(user.id, 5);

  if (!transactions.length) {
    await bot.sendMessage(
      chatId,
      '📭 Belum ada transaksi.'
    );
    return;
  }

  //trigger push
  // simpan session sementara
  await sessionRepo.createEditSession(user.id, {
    step: 'history_select',
    transactions
  });

  let msg = '📒 *5 transaksi terakhir*\n\n';

  transactions.forEach((trx, index) => {
    msg +=
      `${index + 1}. ` +
      `${trx.description}\n` +
      `💰 Rp ${trx.amount.toLocaleString('id-ID')}\n\n`;
  });

  msg += 'Balas angka *1–5* untuk lihat detail.';

  await bot.sendMessage(chatId, msg, {
    parse_mode: 'Markdown'
  });
}

module.exports = { handleRiwayat };