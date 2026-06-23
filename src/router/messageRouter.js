const sessionRepo = require('../services/db/sessionRepo');
const db = require('../services/database');

const { handleEditSession, hasEditSession } = require('../handlers/edit');
const { handleOCRSession } = require('../flows/ocrSessionFlow');
const { handleTextTransaction } = require('../flows/transactionFlow');
const { handleFinanceInsight } = require('../flows/financeInsightFlow');
const { handleTransactionLookup } = require('../flows/lookupFlow');
const { handleAI } = require('../flows/aiFlow');

async function routeMessage(bot, chatId, user, text) {
  const input = text.toLowerCase().trim();

  const gated = await handleActiveSessions(
    bot,
    chatId,
    user,
    input,
    text
  );

  if (gated) return true;

  const isLookup = await handleTransactionLookup(bot, chatId, user, input);

  if (isLookup) {
    return true;
  }

  const handledInsight = await handleFinanceInsight(bot, chatId, user, input);

  if (handledInsight) {
    return true;
  }

  // ================================
  const isTransaction = await handleTextTransaction(
    bot,
    chatId,
    user,
    text
  );

  if (isTransaction) {
    return true;
  }

  // ================================
  // 🔥 AI FALLBACK
  // ================================
  await handleAI(bot, chatId, user, text);

  return true;
}

async function handleActiveSessions(bot, chatId, user, input, text) {
  const ocrSession = await sessionRepo.getOcrSession(user.id);

  if (ocrSession) {
    await handleOCRSession(
      bot,
      chatId,
      user,
      input,
      ocrSession
    );

    return true;
  }

  // ================================
  // 🔥 EDIT SESSION
  // ================================
  if (hasEditSession(user.id)) {
    const handled = await handleEditSession(
      bot,
      chatId,
      user,
      text
    );

    if (handled) return true;
  }

  // ================================
  // 🔥 SHEET WAITLIST — tunggu input email
  // ================================
  const waitlist = await db.getSheetWaitlistByUserId(user.id);

  if (waitlist && waitlist.status === 'waiting_email') {
    const email = text.trim();

    // Validasi format email sederhana
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await bot.sendMessage(chatId,
        '❌ Format email tidak valid. Masukkan email Gmail yang valid:'
      );
      return true;
    }

    try {
      await db.updateSheetWaitlistEmail(user.id, email);
      await bot.sendMessage(chatId,
        `✅ Email \`${email}\` berhasil didaftarkan!\n\n` +
        `⏳ Menunggu persetujuan admin. ` +
        `Kamu akan bisa menghubungkan Google Sheet setelah disetujui.`,
        { parse_mode: 'Markdown' }
      );

      // 🔔 Notifikasi ke admin
      const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID);
      if (ADMIN_ID) {
        await bot.sendMessage(ADMIN_ID,
          `🔔 Permintaan Google Sheet baru\n\n` +
          `Nama: ${user.full_name || '-'}\n` +
          `Telegram ID: ${user.telegram_id}\n` +
          `Email: ${email}\n\n` +
          `Tambahkan email ini ke Google OAuth Test Users.\n\n` +
          `Lalu jalankan:\n/sheet-approve ${email}`
        );
      }
    } catch (err) {
      if (err.message?.toLowerCase().includes('duplicate') ||
          err.message?.toLowerCase().includes('unique')) {
        await bot.sendMessage(chatId,
          '❌ Email ini sudah terdaftar oleh user lain. Gunakan email lain.'
        );
      } else {
        console.error('❌ Sheet waitlist save error:', err.message);
        await bot.sendMessage(chatId, '❌ Gagal menyimpan. Coba lagi nanti.');
      }
    }

    return true;
  }

  return false;
}

module.exports = {
  routeMessage
};
