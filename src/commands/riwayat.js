const transactionRepo = require('../services/db/transactionRepo');
const sessionRepo = require('../services/db/sessionRepo');

async function handleRiwayat(bot, chatId, user) {
  const transactions =
    await transactionRepo.getLastTransactions(user.id, 5);
    console.log(
  '[RIWAYAT]',
  transactions[0]?.id,
  transactions[0]?.description
);
  
  if (!transactions.length) {
    await bot.sendMessage(
      chatId,
      '📭 Belum ada transaksi.'
    );
    return;
  }

  // simpan session sementara
  await sessionRepo.createEditSession(user.telegram_id, {
    step: 'history_select',
    transactions
  });

  let msg = '📒 *5 transaksi terakhir*\n\n';

  const buttons = [];

  transactions.forEach((trx, index) => {
    msg +=
      `${index + 1}. ` +
      `${trx.merchant || trx.description}\n` +
      `💰 Rp ${trx.amount.toLocaleString('id-ID')}\n\n`;

    buttons.push([
      {
        text: `${index + 1}️⃣ ${trx.merchant || 'Detail'}`,
        callback_data: `detail_${index}`
      }
    ]);
  });

  await bot.sendMessage(chatId, msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: transactions.map(
      (trx, index) => [
        {
          text:
            `${index + 1}. ${
              trx.merchant ||
              trx.description
                .slice(0, 20)
            }`,
          callback_data:
            `detail_${index}`
        }
      ]
    )
    }
  });
}

module.exports = { handleRiwayat };