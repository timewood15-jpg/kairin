const transactionRepo = require('../services/db/transactionRepo');

async function handleDetail(bot, chatId, user, text) {
  const id = parseInt(text.split(' ')[1]);

  if (!id) {
    await bot.sendMessage(
      chatId,
      '❌ Format:\n/detail ID\n\nContoh:\n/detail 154'
    );
    return;
  }

  const trx = await transactionRepo.getTransactionById(user.id, id);

  if (!trx) {
    await bot.sendMessage(
      chatId,
      '❌ Transaksi tidak ditemukan'
    );
    return;
  }

  let message =
    `🧾 ${trx.merchant || trx.description}\n` +
    `📅 ${trx.bill_date || '-'}\n` +
    `💰 Rp ${trx.amount.toLocaleString('id-ID')}\n\n`;

  if (trx.bill_items?.length > 0) {
    message += `🛒 ${trx.bill_items.length} item\n\n`;

    trx.bill_items.slice(0, 15).forEach(item => {
      message +=
        `• ${item.name}` +
        `${item.qty > 1 ? ` x${item.qty}` : ''}` +
        ` — Rp ${(item.total_price || 0).toLocaleString('id-ID')}\n`;
    });
  } else {
    message += 'Tidak ada detail item';
  }

  await bot.sendMessage(chatId, message);
}

module.exports = { handleDetail };