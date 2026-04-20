// src/flows/transactionFlow.js

const db = require('../services/database');
const ai = require('../services/claude');

async function handleTextTransaction(bot, chatId, user, text) {
  const parsed = await ai.parseTransactionText(text);

  if (!parsed || parsed.confidence < 0.7) {
    return false; // biar fallback ke AI chat
  }

  const trx = await db.saveTransaction(user.id, {
    type: parsed.type,
    amount: parsed.amount,
    description: parsed.description,
    category: parsed.category,
    source: 'text',
    transactedAt: new Date().toISOString()
  });

  await db.incrementUsage(user.id, 'text');

  await bot.sendMessage(chatId,
    `${parsed.type === 'pemasukan' ? '🟢' : '🔴'} *${parsed.type.toUpperCase()}*\n\n` +
    `📝 ${parsed.description}\n` +
    `💵 Rp ${parsed.amount.toLocaleString('id-ID')}\n` +
    `📂 ${parsed.category}`
  , { parse_mode: 'Markdown' });

  return true;
}

module.exports = { handleTextTransaction };