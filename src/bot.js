const db = require('./services/database');
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
      prompt: 'consent',
      state: chatId.toString() // 🔥 INI PENTING
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

    // 1. tukar code → token
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    console.log('TOKENS:', tokens);

    // 2. ambil chatId
    const chatId = req.query.state;
    console.log('USER TELEGRAM:', chatId);

    // 3. buat sheet DULU
    const spreadsheetId = await createSheet(oauth2Client);

    // 4. simpan SEKALIGUS
    await db.saveGoogleToken({
      user_id: chatId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      spreadsheet_id: spreadsheetId
    });

    res.send('✅ Google berhasil terhubung! Silakan kembali ke Telegram 🎉');
  } catch (err) {
    console.error(err);
    res.send('❌ Gagal connect Google');
  }
});

app.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`);
});

async function createSheet(auth) {
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.create({
    resource: {
      properties: {
        title: 'Kairin - Catatan Keuangan'
      },
      sheets: [
        {
          properties: {
            title: 'Transaksi'
          }
        }
      ]
    }
  });

  return response.data.spreadsheetId;
}

async function appendToSheet(auth, spreadsheetId, data) {
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Transaksi!A:D',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [
        [
          data.tanggal,
          data.keterangan,
          data.jumlah,
          data.kategori
        ]
      ]
    }
  });
}