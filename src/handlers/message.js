// src/handlers/message.js
const { handleOCRSession } = require('../flows/ocrSessionFlow');
const { handleHelp } = require('../commands/help');
const { handlePlan } = require('../commands/plan');
const { handleHari } = require('../commands/hari');
const { handleDompet } = require('../commands/dompet');
const { handleSaldo } = require('../commands/saldo');
const { handleStart } = require('../commands/start');
const { handleDetail } = require('../commands/detail');
const { handleEdit, handleHapus, handleEditSession, hasEditSession} = require('./edit');
const db = require('../services/database');
const { handleTextTransaction } = require('../flows/transactionFlow');
const { handleAI } = require('../flows/aiFlow');
const { handleOCR } = require('../flows/ocrFlow'); // 
const sessionRepo = require('../services/db/sessionRepo');
const { isRateLimited } = require('../utils/rateLimiter');
const { routeMessage } = require('../router/messageRouter');

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
  const command = cmd.split(' ')[0]; // ambil perintah tanpa parameter

  switch (command) {
    case '/start':
      await handleStart(bot, chatId, user);
      break;
    case '/help':
      await handleHelp(bot, chatId);
      break;
    case '/saldo':
      await handleSaldo(bot, chatId, user);
      break;
    case '/hari':
      await handleHari(bot, chatId, user);
      break;
    case '/dompet':
      await handleDompet(bot, chatId, user);
      break;
    case '/plan':
      await handlePlan(bot, chatId, user);
      break;
    case '/edit':
      await handleEdit(bot, chatId, user);
      break;
    case '/hapus':
      await handleHapus(bot, chatId, user);
      break;
    case '/detail':
      await handleDetail(bot, chatId, user, cmd);
      break;
    case '/batal':
      await bot.sendMessage(chatId, '❌ Tidak ada yang dibatalkan.');
      break;  
    default:
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