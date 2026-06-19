const transactionRepo = require('../services/db/transactionRepo');
const sessionRepo = require('../services/db/sessionRepo');

function formatDetailMessage(trx) {
  let message =
    `🧾 ${trx.description}\n` +
  `🏪 ${trx.merchant || '-'}\n` +
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

  return message;
}

async function handleDetail(bot, chatId, user, text) {

  // ambil nomor dari "/detail 2"
  const args = text.split(' ').slice(1);
  const index = parseInt(args[0]);

  if (!index || index < 1 || index > 5) {
    await bot.sendMessage(
      chatId,
      '❌ Pilih nomor 1-5 dari /riwayat'
    );
    return;
  }

  const session =
    await sessionRepo.getEditSession(user.telegram_id);

  if (!session?.transactions) {
    await bot.sendMessage(
      chatId,
      '❌ Jalankan /riwayat dulu'
    );
    return;
  }

  const trx =
    session.transactions[index - 1];

  if (!trx) {
    await bot.sendMessage(
      chatId,
      '❌ Data tidak ditemukan'
    );
    return;
  }

  const message = formatDetailMessage(trx);

  await bot.sendMessage(chatId, message);
}

module.exports = { handleDetail, formatDetailMessage };
