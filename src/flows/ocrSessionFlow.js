const sessionRepo = require('../services/db/sessionRepo');
const transactionRepo = require('../services/db/transactionRepo');

async function handleOCRSession(bot, chatId, user, input, ocrSession) {
  console.log('🔥 OCR session aktif');

  if (ocrSession.step === 'edit_menu') {
  let field = null;

  if (input === '1') field = 'description';
  if (input === '2') field = 'amount';
  if (input === '3') field = 'category';

  if (!field) {
    await bot.sendMessage(chatId, '❌ Pilih 1-3 ya');
    return;
  }

  await sessionRepo.createOcrSession(user.id, {
    ...ocrSession,
    step: 'editing',
    editingField: field
  });

  await bot.sendMessage(chatId, '✏️ Kirim nilai baru:');

  return;
  }

  if (ocrSession.step === 'editing') {
  const trx = ocrSession.data;
  const field = ocrSession.editingField;

  if (field === 'amount') {
    const amount = parseInt(
      input.replace(/[^\d]/g, '')
    );

    if (!amount || amount <= 0) {
      await bot.sendMessage(chatId, '❌ Nominal tidak valid');
      return;
    }

    trx.amount = amount;

  } else {
    trx[field] = input;
  }

  await sessionRepo.createOcrSession(user.id, {
    step: 'confirm',
    data: trx,
    editingField: null
  });

  await bot.sendMessage(
    chatId,
    `✅ Data diperbarui\n\n` +
    `🧾 ${trx.description}\n` +
    `💰 Rp ${trx.amount.toLocaleString('id-ID')}\n` +
    `📂 ${trx.category}\n\n` +
    `Ketik:\n` +
    `✅ ya\n✏️ edit\n❌ batal`
  );

  return;
}

  if (input === 'ya') {
    if (!ocrSession.data) {
      await bot.sendMessage(chatId, '❌ Data tidak valid. Kirim ulang struk ya 🙏');
      await sessionRepo.deleteOcrSession(user.id);
      return;
    }

    const trx = ocrSession.data;

    await transactionRepo.saveTransaction(user.id, {
      type: trx.type,
      amount: trx.amount,
      description: trx.description,
      category: trx.category,

      merchant: trx.merchant || null,
      bill_date: trx.bill_date || null,
      bill_items: trx.bill_items || [],

      source: 'ocr',
      transactedAt: new Date().toISOString()
    });

    await bot.sendMessage(chatId, '✅ Transaksi berhasil disimpan!');
    await sessionRepo.deleteOcrSession(user.id);
    return;
  }

  if (input === 'batal') {
    await bot.sendMessage(chatId, '❌ Dibatalkan');
    await sessionRepo.deleteOcrSession(user.id);
    return;
  }

  if (input === 'edit') {
    await sessionRepo.createOcrSession(user.id, {
    ...ocrSession,
    step: 'edit_menu'
  });

  await bot.sendMessage(
    chatId,
    '✏️ Mau edit apa?\n\n' +
    '1. Deskripsi\n' +
    '2. Nominal\n' +
    '3. Kategori'
  );

  return;
  }

  await bot.sendMessage(chatId, 'Ketik ya / edit / batal ya 🙏');
}

module.exports = { handleOCRSession };