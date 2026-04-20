// src/flows/ocrFlow.js

const ai = require('../services/claude');

async function handleOCR(bot, chatId, user, photo) {
  await bot.sendMessage(chatId, '📷 Membaca struk...');

  // nanti isi dari logic lama handlePhoto
}

module.exports = { handleOCR };