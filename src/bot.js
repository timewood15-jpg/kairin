const express = require('express');
const app = express();

app.use(express.json());

// BOT
const TelegramBot = require('node-telegram-bot-api');
const { handleUpdate } = require('./handlers/message');
require('dotenv').config();

// ✅ TAMBAHAN: Google OAuth
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const TOKEN = process.env.TELEGRAM_TOKEN;

if (!TOKEN) {
  console.error('❌ TELEGRAM_TOKEN tidak ditemukan di .env!');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🚀 Kairin Bot sedang berjalan...');
console.log('📱 Bot: @KairinAppBot');

// ✅ TAMBAHAN: command connect Google
bot.onText(/\/connect-sheet/, async (msg) => {
  const chatId = msg.chat.id;

  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  await bot.sendMessage(chatId, `🔗 Hubungkan Google Sheet kamu:\n\n${url}`);
});

// handler existing kamu (TIDAK DIUBAH)
bot.on('message', async (msg) => {
  try {
    await handleUpdate(bot, { message: msg });
  } catch (error) {
    console.error('Error handle message:', error.message);
    await bot.sendMessage(msg.chat.id, '❌ Terjadi kesalahan. Coba lagi ya! 🙏');
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

console.log('✅ Bot siap menerima pesan!');

// EXPRESS SERVER
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Kairin API jalan 🚀');
});

app.get('/health', (req, res) => {
  res.send('OK');
});

// ✅ UPGRADE: callback OAuth (ganti yang lama)
app.get('/auth/google/callback', async (req, res) => {
  try {
    const code = req.query.code;

    const { tokens } = await oauth2Client.getToken(code);

    console.log('TOKENS:', tokens);

    // nanti disini kita simpan ke database

    res.send('✅ Google berhasil terhubung! Silakan kembali ke Telegram 🎉');
  } catch (err) {
    console.error(err);
    res.send('❌ Gagal connect Google');
  }
});

app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});