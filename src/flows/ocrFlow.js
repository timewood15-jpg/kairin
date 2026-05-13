const ai = require('../services/claude');
const sessionRepo = require('../services/db/sessionRepo');
const axios = require('axios');
const {
  isProcessing,
  setProcessing,
  getOCRCache,
  setOCRCache
} = require('../services/sessionManager');
const logger = require('../services/logger');
const { logEvent } = require('../services/eventLogger');
const config = require('../config/app');
const { handleError } = require('../services/errorHandler');

// Helper download foto dari Telegram
async function downloadPhoto(bot, fileId) {
  const fileInfo = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${fileInfo.file_path}`;

  const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

async function handleOCR(bot, chatId, user, photo) {
  
  if (isProcessing(user.id)) {
    await bot.sendMessage(chatId, '⏳ Lagi diproses, tunggu sebentar ya');
    return;
  }

  setProcessing(user.id, true);

  const timeout = setTimeout(() => {
    setProcessing(user.id, false);
  }, config.OCR_TIMEOUT_MS);
  
  try {
    const fileId = photo[photo.length - 1].file_id;

    // 🔥 CHECK CACHE
    const cached = getOCRCache(fileId);

    if (cached){ 
      logger.info('⚡ OCR CACHE HIT');

      const cleanParsed = cached;

      // langsung lanjut ke hasil (skip AI)
      await bot.sendMessage(chatId,
        `*Cek hasil scan struk:*\n\n` +
        `🧾 ${cleanParsed.description}\n` +
        `💰 Rp ${cleanParsed.amount.toLocaleString('id-ID')}\n` +
        `📂 ${cleanParsed.category}`,
        { parse_mode: 'Markdown' }
      );

      await bot.sendMessage(chatId,
        '❓ Apakah sudah benar?\n\n✅ ya\n✏️ edit\n❌ batal'
      );

      await sessionRepo.createOcrSession(user.id, {
        step: 'confirm',
        data: cleanParsed
      });

      return;
    }

    await bot.sendMessage(chatId, '📄 Membaca struk...\n⏳ Mohon tunggu sebentar');

    // ✅ download image
    const imageBuffer = await downloadPhoto(bot, fileId);

    if (!imageBuffer || imageBuffer.length < 1000) {
      await bot.sendMessage(chatId, '❌ Foto tidak valid. Coba ulang ya 🙏');
      return;
    }

    // ================================
    // 🧠 1. PRIMARY: AI VISION
    // ================================
    let parsed = await ai.extractBillFromPhoto(imageBuffer);

    logger.ocr('VISION RESULT:', JSON.stringify(parsed, null, 2));

    // ================================
    // 🧠 2. DECISION: SKIP / FALLBACK
    // ================================
    const isVisionGood =
      parsed &&
      parsed.amount > 0 &&
      (!parsed.confidence || parsed.confidence > config.OCR_MIN_CONFIDENCE);

    if (isVisionGood) {
      logger.success('✅ Vision cukup');

    } else {
      logger.error('⚠️ Vision gagal / blur');
    }
    // ================================
    // ❌ FINAL GUARD (kalau masih jelek)
    // ================================
    if (!parsed || !parsed.amount || parsed.amount < config.OCR_MIN_AMOUNT) {
      logEvent('ocr_failed', {
        userId: user.id
      });
      await bot.sendMessage(chatId,
        '❌ Struk belum terbaca dengan jelas.\n\n' +
        'Tips:\n• Foto lebih dekat\n• Jangan blur\n• Hindari bayangan 🙏'
      );
      return;
    }

    // ✅ NORMALIZE (TARUH DI SINI)
    const cleanParsed = {
      amount: parsed.amount,
      description: (parsed.description || 'Transaksi').slice(0, config.OCR_MAX_DESCRIPTION),
      category: parsed.category || 'Lain-lain',
      type: parsed.type || 'pengeluaran',

      merchant: parsed.merchant || null,
      bill_date: parsed.bill_date || null,
      bill_items: parsed.items || []
    };

    // 🔥 SIMPAN KE CACHE (DI SINI)
    if (cleanParsed.amount > 0) {
      console.log(JSON.stringify(cleanParsed, null, 2));
      setOCRCache(fileId, cleanParsed);
    }

    // 📊 EVENT LOG
    logEvent('ocr_success', {
      userId: user.id,
      amount: cleanParsed.amount,
      category: cleanParsed.category
    });

    // ================================
    // ✅ HASIL KE USER
    // ================================
    await bot.sendMessage(chatId,
      `*Cek hasil scan struk:*\n\n` +
      `🧾 ${cleanParsed.description}\n` +
      `💰 Rp ${cleanParsed.amount.toLocaleString('id-ID')}\n` +
      `📂 ${cleanParsed.category}`,
      { parse_mode: 'Markdown' }
    );

    await bot.sendMessage(chatId,
      '❓ Apakah sudah benar?\n\n✅ ya\n✏️ edit\n❌ batal'
    );

    // ================================
    // 💾 SAVE SESSION
    // ================================
    console.log('🔥 SESSION DATA:', cleanParsed);
    await sessionRepo.createOcrSession(user.id, {
      step: 'confirm',
      data: {
        amount: cleanParsed.amount,
        description: cleanParsed.description,
        category: cleanParsed.category,
        type: cleanParsed.type,

        merchant: cleanParsed.merchant || null,
        bill_date: cleanParsed.bill_date || null,
        bill_items: cleanParsed.bill_items || []
      }
    });

  } 
  
   catch (error) {

    handleError('OCR_FLOW', error);

    await bot.sendMessage(
      chatId,
      '❌ Terjadi kesalahan saat membaca struk'
    );

  }

  finally {
    clearTimeout(timeout);
    if (isProcessing(user.id)) {
      setProcessing(user.id, false);
    }
}
}
module.exports = { handleOCR };