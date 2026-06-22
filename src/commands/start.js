const db = require('../services/database');

async function handleStart(bot, chatId, user) {
  const firstName = user.full_name?.split(' ')[0] || 'Kamu';

  const msg = `👋 Halo *${firstName}*! Selamat datang di *Kairin*!

🤖 _Kami Bantu Input, Rekap Instan_

Kairin adalah asisten keuangan AI yang akan membantu kamu:
• 📝 Catat pemasukan & pengeluaran
• 📷 Baca struk/bill otomatis via foto
• 📊 Rekap & analisis keuangan
• 💡 Saran hemat yang personal

*Cara pakai:*
• Ketik transaksi: \`makan siang 25000\`
• Pemasukan: \`+gaji 5jt\`
• Foto struk → langsung kirim!

*Perintah tersedia:*
/edit — Ubah detai transaksi tersimpan
/hapus — Hapus transaksi terimpan
/saldo — Rekap bulan ini
/hari — Transaksi hari ini
/dompet — Cek saldo dompet
/plan — Info plan kamu
/help — Bantuan lengkap

Yuk mulai catat transaksi pertamamu! 🚀`;

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });

  // Buat dompet default kalau belum ada
  const wallets = await db.getUserWallets(user.id);
  if (wallets.length === 0) {
    await db.createDefaultWallets(user.id);
    await bot.sendMessage(chatId,
      '💼 Saya sudah siapkan 3 dompet default untuk kamu:\n' +
      '👛 Tunai\n💳 Bank\n📱 E-Wallet\n\n' +
      'Ketik /dompet untuk lihat dan atur saldo awal!'
    );
  }
}

module.exports = { handleStart };