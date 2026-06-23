const googleAuth = require('../services/google/auth');

async function handleConnectSheet(bot, chatId, user, input) {
  const url = googleAuth.generateAuthUrl(chatId);

  await bot.sendMessage(chatId, `Hubungkan Google Sheet kamu:\n\n${url}`);
}

module.exports = { handleConnectSheet };
