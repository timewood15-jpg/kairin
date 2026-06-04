const transactionRepo = require('../services/db/transactionRepo');
const ai = require('../services/claude');
const { parseOfflineTransaction } = require('../utils/parser');

function validateAmount(text, amount) {
  if (!text || !amount || amount <= 0) return true;
  const lower = text
    .toLowerCase()
    .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');

  if (/\d+\s*(rb|ribu|k)\b/.test(lower) && amount < 1000) {
    console.log('INVALID AMOUNT DETECTED');
    return false;
  }

  if (/\d+\s*(jt|juta)\b/.test(lower) && amount < 1000000) {
    console.log('INVALID AMOUNT DETECTED');
    return false;
  }

  const dotGroups = lower.match(/\d{1,3}(?:\.\d{3})+/g);
  if (dotGroups) {
    for (const group of dotGroups) {
      const normalized = Number(group.replace(/\./g, ''));
      if (amount === normalized) return true;
    }
    console.log('INVALID AMOUNT DETECTED');
    return false;
  }
  return true;
}

const db = require('../services/database');
const googleAuth =
  require('../services/google/auth');

const {
  appendToSheet
} = require('../services/google/sheets');

async function handleTextTransaction(bot, chatId, user, text) {

  // 🔥 1. COBA OFFLINE DULU (NO API)
  let parsed = parseOfflineTransaction(text);

  // 🔥 2. KALAU GAGAL BARU AI
  if (!parsed) {
    parsed = await ai.parseTransactionText(text);
  }

  console.log('🧠 PARSED TEXT:', parsed);

 // 🔥 3. VALIDATION (SATU TEMPAT)
  if (!parsed) {
    return false; // fallback ke AI chat
  }

  if (!parsed.amount || parsed.amount <= 0) {
    await bot.sendMessage(chatId, '❌ Nominal tidak valid');
    return false;
  }

  if (!parsed.description) {
    await bot.sendMessage(chatId, '❌ Deskripsi tidak terbaca');
    return false;
  }

  // 🔥 optional confidence (kalau pakai AI)
  if (parsed.confidence && parsed.confidence < 0.5) {
    return false;
  }

  console.log('💾 SAVE TEXT:', {
    user: user.id,
    amount: parsed.amount,
    desc: parsed.description,
    category: parsed.category,
    type: parsed.type
  });

  const trx = await transactionRepo.saveTransaction(user.id, {
    type: parsed.type,
    amount: parsed.amount,
    description: parsed.description,
    category: parsed.category,
    source: 'text',
    transactedAt: new Date().toISOString()
  });

  // 🔥 Sync ke Google Sheet (optional)
try {
  const googleToken =
    await db.getGoogleToken(chatId);

  console.log(
    ' GOOGLE CONNECTED:',
    !!googleToken?.spreadsheet_id
  );

  if (googleToken?.spreadsheet_id) {

    console.log('📄 APPEND SHEET START');

    const authClient =
      googleAuth.getGoogleAuth();

    authClient.setCredentials({
      access_token:
        googleToken.access_token,

      refresh_token:
        googleToken.refresh_token
    });

    await appendToSheet(
      authClient,
      googleToken.spreadsheet_id,
      {
        tanggal:
          new Date()
            .toLocaleDateString('id-ID'),

        keterangan:
          parsed.description,

        jumlah:
          parsed.amount,

        kategori:
          parsed.category
      }
    );

    console.log(
      '✅ APPEND SUCCESS'
    );
  }

} catch (err) {

  console.error(
    '❌ APPEND SHEET ERROR:',
    err.message
  );
}

  await bot.sendMessage(chatId,
    `${parsed.type === 'pemasukan' ? '🟢' : '🔴'} *${parsed.type.toUpperCase()}*\n\n` +
    `📝 ${parsed.description}\n` +
    `💵 Rp ${parsed.amount.toLocaleString('id-ID')}\n` +
    `📂 ${parsed.category}`
  , { parse_mode: 'Markdown' });

  return true;
}

module.exports = { handleTextTransaction };