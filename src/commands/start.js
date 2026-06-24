async function handleStart(bot, chatId, user) {
  const firstName = user.full_name?.split(' ')[0] || 'Kamu';

  const msg = `👋 Halo *${firstName}*! 
  Salam kenal aku *Kairin*, asisten keuangan pribadi kamu

Catat pemasukan & pengeluaran cukup lewat chat.

*Coba kirim:*
\`makan siang 25000\`
\`gaji 5jt\`

📷 Kirim foto struk juga langsung terbaca otomatis.

/riwayat — Riwayat transaksi
/help — Panduan lengkap

Yuk mulai! ✨`;

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

module.exports = { handleStart };