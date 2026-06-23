const googleAuth = require('../services/google/auth');
const db = require('../services/database');

async function handleConnectSheet(bot, chatId, user, input) {
  const waitlist = await db.getSheetWaitlistByUserId(user.id);

  // Belum pernah daftar — insert row, minta email
  if (!waitlist) {
    try {
      await db.addSheetWaitlistEntry(user.id);
    } catch (err) {
      console.error('❌ Gagal buat waitlist entry:', err.message);
      await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Coba lagi nanti.');
      return;
    }

    await bot.sendMessage(chatId,
      '📋 Google Sheet masih dalam tahap beta.\n\n' +
      'Masukkan email Gmail kamu untuk didaftarkan ke waitlist:'
    );
    return;
  }

  // Menunggu input email
  if (waitlist.status === 'waiting_email') {
    await bot.sendMessage(chatId,
      '📋 Masukkan email Gmail kamu:'
    );
    return;
  }

  // Menunggu approval admin
  if (waitlist.status === 'pending') {
    await bot.sendMessage(chatId,
      '⏳ Email kamu sedang menunggu persetujuan admin.\n' +
      'Kamu akan bisa menghubungkan Google Sheet setelah disetujui.'
    );
    return;
  }

  // ✅ Approved — flow OAuth existing (tidak diubah)
  const url = googleAuth.generateAuthUrl(chatId);
  await bot.sendMessage(chatId, `Hubungkan Google Sheet kamu:\n\n${url}`);
}

module.exports = { handleConnectSheet };