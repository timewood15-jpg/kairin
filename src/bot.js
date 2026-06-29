const db = require('./services/database');
const { formatDetailMessage } =
  require('./commands/detail');
const sessionRepo = require('./services/db/sessionRepo');
const express = require('express');
const app = express();

app.use(express.json());

// BOT
const TelegramBot = require('node-telegram-bot-api');
const { handleUpdate } = require('./handlers/message');
require('dotenv').config();

// ✅ TAMBAHAN: Google OAuth
const { google } = require('googleapis');
const { syncSheet, syncMonthlySummary } = require('./services/googleSheet');

const googleAuth =
  require('./services/google/auth');

//oauth2Client.on('tokens', async (tokens) => {
//  console.log('🔄 REFRESH TOKEN:', tokens);

//  if (tokens.access_token) {
//    await db.saveGoogleToken({
//      user_id: chatId,
//      access_token: tokens.access_token,
//      refresh_token: tokens.refresh_token
//    });
//  }
//});

const TOKEN = process.env.TELEGRAM_TOKEN;

if (!TOKEN) {
  console.error('❌ TELEGRAM_TOKEN tidak ditemukan di .env!');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🚀 Kairin Bot sedang berjalan...');
console.log('📱 Bot: @KairinAppBot');

// handler existing kamu (TIDAK DIUBAH)
bot.on('message', async (msg) => {
  try {
    await handleUpdate(bot, { message: msg });
  } catch (error) {
    console.error('Error handle message:', error.message);
    await bot.sendMessage(msg.chat.id, '❌ Terjadi kesalahan. Coba lagi ya! 🙏');
  }
});

bot.on('callback_query', async (query) => {
  try {

    const chatId = query.message.chat.id;
    const userId = query.from.id;

    if (query.data?.startsWith('detail_')) {

      const index =
        parseInt(query.data.split('_')[1]);

      const sessionRepo =
        require('./services/db/sessionRepo');

      const session =
        await sessionRepo.getEditSession(userId);

      if (!session?.transactions) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Jalankan /riwayat dulu'
        });
        return;
      }

      const trx =
        session.transactions[index];

      if (!trx) {
        await bot.answerCallbackQuery(query.id, {
          text: 'Transaksi tidak ditemukan'
        });
        return;
      }


      const message = formatDetailMessage(trx);

      await bot.sendMessage(chatId, message);
      await bot.answerCallbackQuery(query.id);
    }

  } catch (err) {
    console.error(
      '❌ CALLBACK ERROR:',
      err.message
    );
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

app.get('/privacy', (req, res) => {
  res.send(`
    <h1>Kairin Privacy Policy</h1>

    <p>Kairin hanya mengakses Google Sheets yang dipilih pengguna.</p>

    <p>Data digunakan untuk menyimpan transaksi dan membuat laporan keuangan.</p>

    <p>Kairin tidak membagikan data kepada pihak ketiga.</p>

    <p>Pengguna dapat mencabut akses Google kapan saja melalui akun Google mereka.</p>
  `);
});

app.get('/terms', (req, res) => {
  res.send(`
    <h1>Kairin Terms of Service</h1>

    <p>Kairin disediakan sebagaimana adanya.</p>

    <p>Pengguna bertanggung jawab atas data keuangan yang dicatat.</p>

    <p>Kairin tidak menjamin akurasi mutlak hasil OCR atau analisis AI.</p>

    <p>Pengguna dapat menghentikan penggunaan dan mencabut akses Google kapan saja.</p>

    <p>Kairin dapat memperbarui layanan sewaktu-waktu.</p>
  `);
});

// ✅ UPGRADE: callback OAuth (ganti yang lama)
app.get('/auth/google/callback', async (req, res) => {
  try {
    const code = req.query.code;

    // 1. tukar code → token
    const tokens =
      await googleAuth
        .exchangeCodeForTokens(code);

    const authClient =
      googleAuth.getGoogleAuth();

    authClient.setCredentials(tokens);
    console.log('✅ Token exchange completed');

    // 2. ambil chatId
    const chatId = Number(req.query.state);
    console.log('USER TELEGRAM:', chatId);
    const user = await db.getOrCreateUser(chatId);

    // 3. buat sheet DULU
    const spreadsheetId = await createSheet(authClient);

    // 4. simpan SEKALIGUS
        await db.saveGoogleToken({
          user_id: chatId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || undefined,
          spreadsheet_id: spreadsheetId
        });

        // 🔥 Clear onboarding sheet_offer
        const onboardingState =
          await sessionRepo.getOnboardingState(user.id);
        if (onboardingState === 'sheet_offer') {
          await sessionRepo.deleteOnboardingState(user.id);
          await bot.sendMessage(chatId,
            `🔒 Data transaksi kamu hanya dapat diakses oleh akun yang kamu hubungkan.\n\n` +
            `Selamat menggunakan Kairin ✨`
          );
        }

        // 5. backfill histori transaksi ke sheet
        let backfillCount = 0;

    try {
      const user =
        await db.getOrCreateUser(chatId);

      const transactions =
        await db.getTransactionsForSheet(
          user.id,
        );

      if (
        transactions &&
        transactions.length > 0
      ) {
        await syncSheet(
          authClient,
          spreadsheetId,
          transactions
        );

        await syncMonthlySummary(
          authClient,
          spreadsheetId,
          transactions
        );

        backfillCount =
          transactions.length;
      }
    } catch (backfillErr) {
      console.error(
        '❌ BACKFILL ERROR:',
        backfillErr.message
      );
      // Sheet tetap terhubung meskipun backfill gagal
    }

    res.send(
      `✅ Google berhasil terhubung! ${backfillCount} transaksi terakhir berhasil diimpor 🎉`
    );
  } catch (err) {
    console.error('❌ OAuth callback error:', err.message);
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
        },
        { properties: { 
            title: 'Rekap Bulanan' 
          } 
        }
      ]
    }
  });

   const spreadsheetId = response.data.spreadsheetId;
   const sheetId = response.data.sheets[0].properties.sheetId;

  // 🔥 TAMBAHKAN DI SINI (HEADER)
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId,
    range: 'Transaksi!A1:D1',
    valueInputOption: 'RAW',
    resource: {
      values: [[
        'Tanggal',
        'Deskripsi',
        'Jumlah',
        'Kategori'
      ]]
    }
  });

  // 🔵 HEADER REKAP BULANAN
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId,
    range: 'Rekap Bulanan!A1:D1',
    valueInputOption: 'RAW',
    resource: {
      values: [[
        'Bulan',
        'Pemasukan',
        'Pengeluaran',
        'Saldo'
     ]]
    }
  });

  // freeze header
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              gridProperties: {
                frozenRowCount: 1
              }
            },
            fields: 'gridProperties.frozenRowCount'
          }
        },
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 0.2,
                  green: 0.6,
                  blue: 0.86
                },
                textFormat: {
                 bold: true,
                  foregroundColor: {
                   red: 1,
                    green: 1,
                    blue: 1
                  }
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 1,
              startColumnIndex: 2,
              endColumnIndex: 3
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'CURRENCY',
                  pattern: 'Rp #,##0'
                }
              }
            },
            fields: 'userEnteredFormat.numberFormat'
          }
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 4
            }
          }
        }
      ]
    }
  });

  return spreadsheetId;
}

async function appendToSheet(auth, spreadsheetId, data) {
  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Transaksi!A2:D',
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