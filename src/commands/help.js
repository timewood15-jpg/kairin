async function handleHelp(bot, chatId) {
  const msg = `📖 *Panduan Kairin*

*Input Transaksi:*
\`makan siang 25000\` → pengeluaran
\`gaji 5jt\` → pemasukan
\`transfer masuk 500000\` → pemasukan

*Foto Struk:*
Kirim foto struk langsung — baca otomatis!

*Perintah:*
/riwayat — Riwayat transaksi
/saldo — Rekap bulan ini
/hari — Transaksi hari ini
/edit — Ubah detail transaksi
/hapus — Hapus transaksi
/help — Panduan ini

*Tanya AI:*
Ketik pertanyaan bebas tentang keuangan kamu.
Contoh: _"Bulan ini saya boros di mana?"_`;

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

module.exports = { handleHelp };