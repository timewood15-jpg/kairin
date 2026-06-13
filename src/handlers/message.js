// src/handlers/message.js
const { handleEditSession, hasEditSession } = require('./edit');
const db = require('../services/database');
const { handleOCR } = require('../flows/ocrFlow');
const sessionRepo = require('../services/db/sessionRepo');
const { isRateLimited } = require('../utils/rateLimiter');
const { routeMessage } = require('../router/messageRouter');
const { routeCommand } = require('../router/commandRouter');

require('dotenv').config();

// ============================================================
// HANDLE SEMUA UPDATE DARI TELEGRAM
// ============================================================
async function handleUpdate(bot, update) {
  try {
    const msg = update.message || update.edited_message;
    if (!msg) return;

    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const text = msg.text || '';

    const user = await db.getOrCreateUser(telegramId, {
      username: msg.from.username,
      full_name: `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim(),
    });

    console.log('📩 USER:', user.id, '| TEXT:', text || '[PHOTO]');

    if (isRateLimited(user.id, 2000)) {
      await bot.sendMessage(chatId, '⏳ Terlalu cepat. Tunggu sebentar ya');
      return;
    }

    if (text === '/batal') {
      // edit session tetap di sini
      if (hasEditSession(user.id)) {
        await handleEditSession(bot, chatId, user, text);
        return;
      }

      // 🔥 OCR session (simple & clean)
      const ocr = await sessionRepo.getOcrSession(user.id);
      if (ocr) {
        await sessionRepo.deleteOcrSession(user.id);
        await bot.sendMessage(chatId, '❌ Dibatalkan');
        return;
      }

      // fallback
      await bot.sendMessage(chatId, '❌ Tidak ada yang dibatalkan.');
      return;
    }

    // FOTO
    if (msg.photo) {
      await handleOCR(bot, chatId, user, msg.photo);
      return;
    }

    // COMMAND
    if (text.startsWith('/')) {
      await handleCommand(bot, chatId, user, text.toLowerCase().trim());
      return;
    }

    // TEXT
    if (text) {
      await handleText(bot, chatId, user, text);
    }

  } catch (err) {
    console.error('❌ HANDLE UPDATE ERROR:', err);

    const chatId = update.message?.chat?.id;
    if (chatId) {
      await bot.sendMessage(chatId,
        '❌ Terjadi kesalahan. Coba lagi ya 🙏'
      );
    }
  }
}

// ============================================================
// HANDLE PERINTAH /
// ============================================================
async function handleCommand(bot, chatId, user, cmd) {
  const handled = await routeCommand(bot, chatId, user, cmd);
  if (!handled) {
    await bot.sendMessage(chatId, '❓ Perintah tidak dikenal. Ketik /help untuk bantuan.');
  }
}

// ============================================================
// HANDLE TEKS — Parse transaksi atau chat AI
// ============================================================
async function handleText(bot, chatId, user, text) {
  return routeMessage(bot, chatId, user, text);
}

module.exports = { handleUpdate };