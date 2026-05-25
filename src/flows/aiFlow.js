const ai = require('../services/claude');
const db = require('../services/database');

async function handleAI(bot, chatId, user, question) {
  await bot.sendMessage(chatId, '🤖 Kairin sedang berpikir...');

  const summary =
    await db.getMonthlySummary(user.id);

  const transactions =
    await db.getRecentTransactions(user.id);

  const firstName =
    user.full_name?.split(' ')[0] || 'Kamu';

  console.log(
    'AI transactions:',
    transactions.slice(0, 5)
  );

  const answer = await ai.chatWithAI(
    question,
    {
      userName: firstName,

      // 🔥 spread summary
      ...summary,

      // 🔥 kirim transaksi
      transactions
    }
  );

  await bot.sendMessage(chatId, answer);
}

module.exports = { handleAI };