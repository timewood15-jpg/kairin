// src/flows/aiFlow.js

const ai = require('../services/claude');
const db = require('../services/database');

async function handleAI(bot, chatId, user, question) {
  await bot.sendMessage(chatId, '🤖 Kairin sedang berpikir...');

  const summary = await db.getMonthlySummary(user.id);

  const firstName = user.full_name?.split(' ')[0] || 'Kamu';

  const answer = await ai.chatWithAI(question, {
    userName: firstName,
    summary
  });

  await bot.sendMessage(chatId, answer);
}

module.exports = { handleAI };