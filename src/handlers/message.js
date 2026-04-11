// src/handlers/message.js
const { handleEdit, handleHapus, handleEditSession, hasEditSession, clearEditSession } = require('./edit');
const db = require('../services/database');
const ai = require('../services/claude');
const sharp = require('sharp');
const axios = require('axios');
require('dotenv').config();

// ============================================================
// HELPER
// ============================================================
function parseIndoAmount(text) {
  if (!text) return null;

  let str = text.toLowerCase().trim();

  // ubah koma jadi titik (2,5jt → 2.5jt)
  str = str.replace(',', '.');

  let multiplier = 1;

  if (str.includes('jt')) multiplier = 1000000;
  else if (str.includes('rb') || str.includes('k')) multiplier = 1000;

  // ambil angka + desimal
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));

  if (isNaN(num)) return null;

  return Math.round(num * multiplier);
}

function formatRupiah(amount) {
  return Math.round(amount).toLocaleString('id-ID');
}

function getJakartaTime() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getPlanLabel(plan) {
  const labels = { free: '🆓 Free', starter: '⭐ Starter', pro: '💎 Pro', family: '👨‍👩‍👧 Family' };
  return labels[plan] || '🆓 Free';
}

// ============================================================
// HANDLE SEMUA UPDATE DARI TELEGRAM
// ============================================================
async function handleUpdate(bot, update) {
  const msg = update.message || update.edited_message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const text = msg.text || '';

  // Get or create user
  const user = await db.getOrCreateUser(telegramId, {
    username: msg.from.username,
    full_name: `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim(),
  });

  // 🔥 INTERCEPT /batal (EDIT + OCR)
  if (text === '/batal') {
  let cancelled = false;

    if (hasEditSession(user.id)) {
      await handleEditSession(bot, chatId, user, text);
      cancelled = true;
    }

    const ocr = await db.getOcrSession(user.id);
    if (ocr) {
      await db.deleteOcrSession(user.id);
      cancelled = true;
    }

    if (!cancelled) {
      await bot.sendMessage(chatId, '❌ Tidak ada yang dibatalkan.');
    }

    return;
  }

  // Foto → OCR
  if (msg.photo) {
    await handlePhoto(bot, chatId, user, msg.photo);
    return;
  }

  // Perintah slash
  if (text.startsWith('/')) {
    await handleCommand(bot, chatId, user, text.toLowerCase().trim());
    return;
  }

  // Teks biasa → coba parse transaksi atau chat AI
  if (text) {
    await handleText(bot, chatId, user, text, telegramId);
  }
}

// ============================================================
// HANDLE PERINTAH /
// ============================================================
async function handleCommand(bot, chatId, user, cmd) {
  const command = cmd.split(' ')[0]; // ambil perintah tanpa parameter

  switch (command) {
    case '/start':
      await handleStart(bot, chatId, user);
      break;
    case '/help':
      await handleHelp(bot, chatId);
      break;
    case '/saldo':
      await handleSaldo(bot, chatId, user);
      break;
    case '/hari':
      await handleHari(bot, chatId, user);
      break;
    case '/dompet':
      await handleDompet(bot, chatId, user);
      break;
    case '/plan':
      await handlePlan(bot, chatId, user);
      break;
    case '/edit':
      await handleEdit(bot, chatId, user);
      break;
    case '/hapus':
      await handleHapus(bot, chatId, user);
      break;
    case '/batal':
      await bot.sendMessage(chatId, '❌ Tidak ada yang dibatalkan.');
      break;  
    default:
      await bot.sendMessage(chatId, '❓ Perintah tidak dikenal. Ketik /help untuk bantuan.');
  }
}

// ============================================================
// /start — Onboarding user baru
// ============================================================
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

// ============================================================
// /help
// ============================================================
async function handleHelp(bot, chatId) {
  const msg = `📖 *Panduan Kairin*

*Input Transaksi Teks:*
\`makan siang 25000\` → pengeluaran
\`bensin 80rb\` → pengeluaran
\`+gaji 5jt\` → pemasukan
\`+transfer masuk 500000\` → pemasukan

*Foto Struk:*
Kirim foto struk/bill langsung → Kairin baca otomatis!

*Perintah:*
/edit — Ubah detai transaksi tersimpan
/hapus — Hapus transaksi terimpan
/saldo — Rekap bulan ini
/hari — Transaksi hari ini
/dompet — Saldo semua dompet
/plan — Info & upgrade plan
/help — Panduan ini

*Tanya AI (Plan Pro):*
Ketik pertanyaan bebas tentang keuangan kamu!
Contoh: _"Bulan ini saya boros di mana?"_`;

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

// ============================================================
// HANDLE TEKS — Parse transaksi atau chat AI
// ============================================================
async function handleText(bot, chatId, user, text, telegramId) {
  console.log('🔥 MASUK HANDLE TEXT');
  // 🔥 PRIORITAS 1: EDIT SESSION
  if (hasEditSession(user.id)) {
    const handled = await handleEditSession(bot, chatId, user, text);
    if (handled) return;
  }

  // 🔥 PRIORITAS 2: OCR SESSION

  const session = await db.getOcrSession(user.id);

  console.log('📨 HANDLE TEXT SESSION:', session);

  if (session && session.data) {
    return await handleOcrSession(bot, chatId, user, text, session);
  }

  // =========================
  // NORMAL FLOW
  // =========================

  const aiTriggers = ['?', 'kenapa', 'gimana', 'berapa', 'kapan', 'apa', 'analisa', 'saran'];
  const isAI = aiTriggers.some(t => text.toLowerCase().includes(t));

  if (isAI && text.length > 10) {
    return await handleAIChat(bot, chatId, user, text);
  }

  const limit = await db.checkLimit(user.id, 'text');
  if (!limit.allowed) {
    await bot.sendMessage(chatId,
      `⚠️ Batas transaksi teks habis.\nPlan ${getPlanLabel(limit.plan)}`
    );
    return;
  }

  await bot.sendMessage(chatId, '⏳ Memproses...');

  const parsed = await ai.parseTransactionText(text);

  if (!parsed) {
    await bot.sendMessage(chatId,
      `❓ Format tidak dikenali.\nContoh:\n• makan 25rb\n• +gaji 5jt`
    );
    return;
  }

  await db.saveTransaction(user.id, {
    type: parsed.type,
    amount: parsed.amount,
    description: parsed.description,
    category: parsed.category,
    source: 'text',
    transactedAt: new Date().toISOString()
  });

  const tokenData = await db.getGoogleToken(chatId.toString());

  console.log('TOKEN DATA:', tokenData);
  console.log('USER ID:', user.id);
  console.log('USER ID STRING:', user.id.toString());

if (tokenData && tokenData.spreadsheet_id) {
  try {
    const { google } = require('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    console.log('🚀 KIRIM KE SHEET:', {
      spreadsheetId: tokenData.spreadsheet_id,
      text: parsed.description,
      amount: parsed.amount
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: tokenData.spreadsheet_id,
      range: 'Transaksi!A:D',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          new Date().toISOString(),
          parsed.description,
          parsed.amount,
          parsed.category || 'lainnya'
        ]]
      }
    });

    console.log('✅ BERHASIL APPEND');

  } catch (err) {
    console.error('❌ Gagal kirim ke sheet:', err);
  }
}

  await db.incrementUsage(user.id, 'text');

  const emoji = parsed.type === 'pemasukan' ? '🟢' : '🔴';
  const sign = parsed.type === 'pemasukan' ? '+' : '-';

  await bot.sendMessage(chatId,
    `${emoji} *${parsed.type.toUpperCase()}*\n\n` +
    `📝 ${parsed.description}\n` +
    `💵 ${sign}Rp ${formatRupiah(parsed.amount)}\n` +
    `📂 ${parsed.category}\n` +
    `🕐 ${getJakartaTime()}`
  , { parse_mode: 'Markdown' });
}

// ============================================================
// HANDLE OCR SESSION (ANTI BOCOR TOTAL)
// ============================================================
async function handleOcrSession(bot, chatId, user, text, session) {
  const input = text.toLowerCase().trim();

  // ========================
  // SAVE
  // ========================
  if (input === 'ya') {
    await db.saveTransaction(user.id, {
      ...session.data,
      source: 'photo'
    });

    await db.incrementUsage(user.id, 'photo');
    await db.deleteOcrSession(user.id);

    await bot.sendMessage(chatId, '✅ Transaksi berhasil disimpan!');
    return;
  }

  // ========================
  // BATAL
  // ========================
  if (input === 'batal') {
    await db.deleteOcrSession(user.id);
    await bot.sendMessage(chatId, '❌ Dibatalkan');
    return;
  }

  // ========================
  // MASUK EDIT
  // ========================
  if (input === 'edit') {
    session.step = 'edit_field';
    await db.saveOcrSession(user.id, session);

    await bot.sendMessage(chatId,
`✏️ Mau ubah apa?

1. Jumlah
2. Deskripsi
3. Kategori
4. Tanggal`);
    return;
  }

  // ========================
  // PILIH FIELD
  // ========================
  if (session.step === 'edit_field') {
    const map = {
      '1': 'amount',
      '2': 'description',
      '3': 'category',
      '4': 'transacted_at'
    };

    if (!map[input]) {
      await bot.sendMessage(chatId, '❌ Pilih angka 1-4');
      return;
    }

    session.field = map[input];
    session.step = 'input_value';
    await db.saveOcrSession(user.id, session);

    // UX lebih jelas
    if (session.field === 'amount') {
      await bot.sendMessage(chatId, '💵 Contoh: 10rb, 2.5jt');
    } else if (session.field === 'transacted_at') {
      await bot.sendMessage(chatId, '📅 Format: DD-MM-YYYY');
    } else {
      await bot.sendMessage(chatId, 'Masukkan nilai baru:');
    }

    return;
  }

  // ========================
  // INPUT VALUE
  // ========================
  if (session.step === 'input_value') {

    if (session.field === 'amount') {
      const val = parseIndoAmount(text);

      if (val === null) {
        await bot.sendMessage(chatId, '❌ Format angka salah (10rb, 2.5jt)');
        return;
      }

      session.data.amount = val;
    }

    else if (session.field === 'transacted_at') {
      const [d, m, y] = text.split('-');

      if (!d || !m || !y) {
        await bot.sendMessage(chatId, 'Format salah (DD-MM-YYYY)');
        return;
      }

      session.data.transacted_at =
        new Date(`${y}-${m}-${d}T12:00:00`).toISOString();
    }

    else {
      session.data[session.field] = text;
    }

    session.step = null;
    await db.saveOcrSession(user.id, session);

    await bot.sendMessage(chatId,
`✅ Update sementara:

📂 ${session.data.category}
📅 ${session.data.transacted_at}
💵 Rp ${formatRupiah(session.data.amount)}

Ketik *ya* untuk simpan`
    , { parse_mode: 'Markdown' });

    return;
  }

  // ========================
  // FALLBACK (ANTI BOCOR)
  // ========================
  await bot.sendMessage(chatId, '❓ Ketik ya / edit / batal');
}

// ============================================================
// HANDLE FOTO STRUK
// ============================================================
async function handlePhoto(bot, chatId, user, photos) {
  // 🔥 RESET EDIT SESSION
  clearEditSession(user.id);
  // Cek limit foto
  const limit = await db.checkLimit(user.id, 'photo');
  if (!limit.allowed) {
    await bot.sendMessage(chatId,
      `⚠️ Batas foto struk bulan ini sudah habis!\n\n` +
      `Plan ${getPlanLabel(limit.plan)}: ${limit.max}x/bulan\n` +
      `Terpakai: ${limit.current}x\n\n` +
      `Upgrade untuk lebih banyak scan struk! Ketik /plan`
    );
    return;
  }

  await bot.sendMessage(chatId, '📷 Membaca struk... mohon tunggu sebentar! ⏳');

  try {
    // Download foto dari Telegram (resolusi terbesar)
    const fileId = photos[photos.length - 1].file_id;
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${fileInfo.file_path}`;

    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const originalBuffer = Buffer.from(response.data);

    // Compress foto dengan sharp
    const compressedBuffer = await sharp(originalBuffer)
      .resize(800, null, { withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    // OCR via Gemini
    const extracted = await ai.extractBillFromPhoto(compressedBuffer);

    if (!extracted) {
      await bot.sendMessage(chatId,
        '❌ Gagal membaca struk.\n\n' +
        'Tips foto yang baik:\n' +
        '• Pastikan pencahayaan cukup\n' +
        '• Struk tidak terlipat/kusut\n' +
        '• Foto tegak lurus\n\n' +
        'Coba foto ulang ya! 📷'
      );
      return;
    }

    // Upload foto ke Supabase Storage (Starter & Pro saja)
    let photoUrl = null;
    if (user.plan !== 'free') {
      try {
        photoUrl = await db.uploadStrukPhoto(user.id, compressedBuffer, `struk_${Date.now()}.jpg`);
      } catch (e) {
        console.error('Upload foto gagal:', e.message);
      }
    }

    // Simpan ke session transaksi
    await db.saveOcrSession(user.id, {
      data: {
        type: 'pengeluaran',
        amount: extracted.total,
        description: extracted.description,
        category: extracted.category,
        merchant: extracted.merchant,
        bill_items: extracted.items,
        photo_url: photoUrl,
        transacted_at: extracted.date
          ? new Date(extracted.date + 'T12:00:00').toISOString()
          : new Date().toISOString()
      },
      step: null,
      field: null
    });
    // 🔥 DEBUG DI SINI
    console.log('✅ OCR SESSION DISAVE:', user.id);

    const checkSession = await db.getOcrSession(user.id);
    console.log('📦 SESSION DARI DB:', checkSession);

    // Response konfirmasi
    let itemsText = '';
    if (extracted.items && extracted.items.length > 0) {
      itemsText = '\n\n*Item:*\n' + extracted.items
        .slice(0, 5)
        .map(item => `• ${item.name} (${item.qty}x) — Rp ${formatRupiah(item.price)}`)
        .join('\n');
    }

    await bot.sendMessage(chatId,
    `🧾 *Cek hasil scan struk:*

    🏪 ${extracted.merchant}
    📂 ${extracted.category}
    📅 ${extracted.date || '-'}
    ${itemsText}

    💵 *Total: -Rp ${formatRupiah(extracted.total)}*

    Apakah sudah benar?

    Ketik:
    ✅ ya → simpan
    ✏️ edit → ubah dulu
    ❌ batal`
    );

    // Cek nudge
    //await checkAndSendNudge(bot, chatId, user, {
    //  type: 'pengeluaran',
    //  amount: extracted.total,
    //  category: extracted.category,
    //  description: extracted.description,
    //});

  } catch (error) {
    console.error('Handle photo error:', error.message);
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan. Coba lagi ya! 🙏');
  }
}

// ============================================================
// /saldo — Rekap bulanan
// ============================================================
async function handleSaldo(bot, chatId, user) {
  const summary = await db.getMonthlySummary(user.id);
  const now = new Date();
  const monthName = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  let categoryText = '';
  if (summary.topCategories.length > 0) {
    categoryText = '\n\n*Top Pengeluaran:*\n' + summary.topCategories
      .map(([cat, amt]) => `• ${cat}: Rp ${formatRupiah(amt)}`)
      .join('\n');
  }

  await bot.sendMessage(chatId,
    `📊 *Rekap ${monthName}*\n\n` +
    `🟢 Pemasukan:   Rp ${formatRupiah(summary.income)}\n` +
    `🔴 Pengeluaran: Rp ${formatRupiah(summary.expense)}\n` +
    `💰 Saldo:       Rp ${formatRupiah(summary.balance)}\n` +
    `📝 Transaksi:   ${summary.totalTransactions}x` +
    categoryText
  , { parse_mode: 'Markdown' });
}

// ============================================================
// /hari — Transaksi hari ini
// ============================================================
async function handleHari(bot, chatId, user) {
  const transactions = await db.getTodayTransactions(user.id);

  if (transactions.length === 0) {
    await bot.sendMessage(chatId,
      '📋 Belum ada transaksi hari ini.\n\nYuk mulai catat! 💪'
    );
    return;
  }

  let total = 0;
  let msg = '📋 *Transaksi Hari Ini*\n\n';

  transactions.forEach(t => {
    const sign = t.type === 'pemasukan' ? '🟢 +' : '🔴 -';
    msg += `${sign}Rp ${formatRupiah(t.amount)} — ${t.description}\n`;
    total += t.type === 'pemasukan' ? t.amount : -t.amount;
  });

  msg += `\n*Saldo hari ini: ${total >= 0 ? '+' : ''}Rp ${formatRupiah(total)}*`;

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

// ============================================================
// /dompet — Saldo dompet
// ============================================================
async function handleDompet(bot, chatId, user) {
  const wallets = await db.getUserWallets(user.id);

  if (wallets.length === 0) {
    await bot.sendMessage(chatId, '💼 Belum ada dompet. Ketik /start untuk setup!');
    return;
  }

  let total = 0;
  let msg = '💼 *Saldo Dompet Kamu*\n\n';

  wallets.forEach(w => {
    msg += `${w.icon} ${w.name}: Rp ${formatRupiah(w.balance)}\n`;
    total += w.balance;
  });

  msg += `\n*Total: Rp ${formatRupiah(total)}*`;

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

// ============================================================
// /plan — Info plan user
// ============================================================
async function handlePlan(bot, chatId, user) {
  const limit = await db.checkLimit(user.id, 'text');

  const planInfo = {
    free:    { emoji: '🆓', name: 'Free',    next: 'Starter' },
    starter: { emoji: '⭐', name: 'Starter', next: 'Pro' },
    pro:     { emoji: '💎', name: 'Pro',     next: null },
    family:  { emoji: '👨‍👩‍👧', name: 'Family', next: null },
  };

  const info = planInfo[user.plan] || planInfo.free;

  let msg = `${info.emoji} *Plan Kamu: ${info.name}*\n\n`;
  msg += `📝 Teks: ${limit.current}/${limit.max === 999999 ? '∞' : limit.max} bulan ini\n`;

  const photoLimit = await db.checkLimit(user.id, 'photo');
  msg += `📷 Foto: ${photoLimit.current}/${photoLimit.max === 999999 ? '∞' : photoLimit.max} bulan ini\n`;

  if (info.next) {
    msg += `\n💡 Upgrade ke *${info.next}* untuk fitur lebih lengkap!\n`;
    msg += `Hubungi @KairinSupport untuk upgrade.`;
  }

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

// ============================================================
// AI CHAT
// ============================================================
async function handleAIChat(bot, chatId, user, question) {
  // Cek apakah plan support AI chat
  if (user.plan === 'free') {
    // Free: 3x/bulan — untuk simplifikasi, kita izinkan dulu
    // TODO: tambah counter AI usage
  }

  await bot.sendMessage(chatId, '🤖 Kairin sedang berpikir... ⏳');

  const summary = await db.getMonthlySummary(user.id);
  const firstName = user.full_name?.split(' ')[0] || 'Kamu';
  // Ambil transaksi 3 bulan terakhir
  const transactions = await db.getRecentTransactions(user.id, 3);

  const context = {
    userName: firstName,
    income: summary.income,
    expense: summary.expense,
    balance: summary.balance,
    topCategories: summary.topCategories,
    totalTransactions: summary.totalTransactions,
    transactions: transactions.map(t => ({
      date: t.transacted_at,
      type: t.type,
      amount: t.amount,
      description: t.description,
      category: t.category,
      merchant: t.merchant,
      items: t.bill_items,
    }))
  };

  const answer = await ai.chatWithAI(question, context);
  await bot.sendMessage(chatId, answer);
}

// ============================================================
// FRIENDLY NUDGE
// ============================================================
async function checkAndSendNudge(bot, chatId, user, transaction) {
  try {
    // Nudge hanya untuk Starter & Pro
    if (user.plan === 'free') return;

    const firstName = user.full_name?.split(' ')[0] || 'Kamu';

    // Nudge kalau pengeluaran > 200rb sekali
    if (transaction.type === 'pengeluaran' && transaction.amount >= 200000) {
      const nudge = await ai.generateNudge(
        { name: firstName },
        { amount: transaction.amount, category: transaction.category, description: transaction.description },
        'big_expense'
      );
      if (nudge) {
        await new Promise(r => setTimeout(r, 1000)); // delay 1 detik
        await bot.sendMessage(chatId, nudge);
      }
    }

  } catch (error) {
    console.error('Nudge error:', error.message);
  }
}

module.exports = { handleUpdate };