const db = require('../services/database');

async function handleStart(bot, chatId, user) {
  const firstName = user.full_name?.split(' ')[0] || 'Kamu';

  const msg = `👋 Halo *${firstName}*!

Kairin siap catat keuangan kamu secara otomatis.

Coba kirim:
\`makan siang 25000\` atau \`+gaji 5jt\`

Atau ketik /help untuk panduan lengkap.`;

  await bot.sendMessage(chatId, msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📝 Catat Pengeluaran', callback_data: 'onboard_expense' },
          { text: '💰 Catat Pemasukan', callback_data: 'onboard_income' }
        ],
        [
          { text: '📷 Kirim Foto Struk', callback_data: 'onboard_ocr' },
          { text: '📋 Lihat Riwayat', callback_data: 'onboard_riwayat' }
        ],
        [
          { text: '🔗 Hubungkan Sheet', callback_data: 'onboard_sheet' }
        ],
        [
          { text: '⏭ Lewati', callback_data: 'onboard_skip' }
        ]
      ]
    }
  });

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