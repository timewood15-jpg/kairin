const googleAuth = require('../services/google/auth');
const db = require('../services/database');

async function handleSheetApprove(bot, chatId, user, input) {
  // 🔐 Hanya admin yang boleh
  const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID);
  if (!ADMIN_ID || chatId !== ADMIN_ID) {
    await bot.sendMessage(chatId, '❌ Perintah admin.');
    return;
  }

  // Parse email dari: "/sheet-approve <email>"
  const parts = input.split(' ');
  const email = parts.slice(1).join(' ').toLowerCase().trim();

  if (!email) {
    await bot.sendMessage(chatId,
      '❌ Gunakan: /sheet-approve <email>'
    );
    return;
  }

  // Cari waitlist by email
  const waitlist = await db.getSheetWaitlistByEmail(email);
  if (!waitlist) {
    await bot.sendMessage(chatId,
      `❌ Email \`${email}\` tidak ditemukan.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (waitlist.status !== 'pending') {
    await bot.sendMessage(chatId,
      `❌ User tidak menunggu approval. Status: ${waitlist.status}`
    );
    return;
  }

  // Approve
  await db.approveSheetWaitlist(waitlist.user_id);

  // Ambil data user untuk dikirimi OAuth
  const targetUser = await db.getUserById(waitlist.user_id);
  if (!targetUser) {
    console.error('❌ User not found for userId:', waitlist.user_id);
    await bot.sendMessage(chatId,
      '❌ User tidak ditemukan di database.'
    );
    return;
  }

  // Generate OAuth URL untuk user
  const oauthUrl = googleAuth.generateAuthUrl(targetUser.telegram_id);

  // Kirim link ke user
  try {
    await bot.sendMessage(targetUser.telegram_id,
      `✅ Akses Google Sheet kamu sudah disetujui!\n\n` +
      `Silakan hubungkan akun Google kamu:\n\n${oauthUrl}\n\n` +
      `Terima kasih sudah mencoba fitur beta Kairin 🚀`
    );
  } catch (err) {
    console.error('❌ Gagal kirim notifikasi ke user:', err.message);
    // Tetap lanjut — admin tetap dapat konfirmasi
  }

  // Konfirmasi ke admin
  await bot.sendMessage(chatId,
    `✅ ${email} berhasil disetujui.`
  );
}

module.exports = { handleSheetApprove };