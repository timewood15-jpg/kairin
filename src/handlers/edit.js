// src/handlers/edit.js
// Handler untuk edit dan hapus transaksi

const db = require('../services/database');
require('dotenv').config();

// Simpan state edit per user (sementara di memory)
// Format: { telegramId: { step, transactions, selectedId, field } }
const editSessions = {};

function parseTanggal(input) {
  const [day, month, year] = input.split('-');
  if (!day || !month || !year) return null;

  return new Date(`${year}-${month}-${day}T12:00:00`).toISOString();
}

function formatRupiah(amount) {
  return Math.round(amount).toLocaleString('id-ID');
}

// ============================================================
// HANDLE /edit — Tampilkan daftar transaksi
// ============================================================
async function handleEdit(bot, chatId, user) {
  const transactions = await db.getLastTransactions(user.id, 10);

  if (transactions.length === 0) {
    await bot.sendMessage(chatId, '📋 Belum ada transaksi yang bisa diedit.');
    return;
  }

  // Simpan session
  editSessions[user.id] = {
    step: 'select_transaction',
    transactions: transactions,
    selectedId: null,
    field: null,
  };

  let msg = '✏️ *Edit Transaksi*\n\nPilih nomor transaksi yang mau diedit:\n\n';

  transactions.forEach((t, i) => {
    const sign = t.type === 'pemasukan' ? '🟢 +' : '🔴 -';
    const date = new Date(t.transacted_at).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short'
    });
    msg += `${i + 1}. ${sign}Rp ${formatRupiah(t.amount)} — ${t.description} (${date})\n`;
  });

  msg += '\nKetik nomor (1-10) atau /batal untuk membatalkan';

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

// ============================================================
// HANDLE /hapus — Tampilkan daftar transaksi untuk dihapus
// ============================================================
async function handleHapus(bot, chatId, user) {
  const transactions = await db.getLastTransactions(user.id, 10);

  if (transactions.length === 0) {
    await bot.sendMessage(chatId, '📋 Belum ada transaksi yang bisa dihapus.');
    return;
  }

  // Simpan session
  editSessions[user.id] = {
    step: 'select_delete',
    transactions: transactions,
    selectedId: null,
    field: null,
  };

  let msg = '🗑️ *Hapus Transaksi*\n\nPilih nomor transaksi yang mau dihapus:\n\n';

  transactions.forEach((t, i) => {
    const sign = t.type === 'pemasukan' ? '🟢 +' : '🔴 -';
    const date = new Date(t.transacted_at).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short'
    });
    msg += `${i + 1}. ${sign}Rp ${formatRupiah(t.amount)} — ${t.description} (${date})\n`;
  });

  msg += '\nKetik nomor (1-10) atau /batal untuk membatalkan';

  await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

// ============================================================
// HANDLE INPUT SELAMA SESSION EDIT/HAPUS
// ============================================================
async function handleEditSession(bot, chatId, user, text) {
  const session = editSessions[user.id];
  if (!session) return false; // tidak ada session aktif

  // Batal
  if (text === '/batal') {
    delete editSessions[user.id];
    await bot.sendMessage(chatId, '❌ Dibatalkan.');
    return true;
  }

  // Step 1 — Pilih transaksi untuk diedit
  if (session.step === 'select_transaction') {
    const num = parseInt(text);
    if (isNaN(num) || num < 1 || num > session.transactions.length) {
      await bot.sendMessage(chatId, `❓ Masukkan angka 1-${session.transactions.length}`);
      return true;
    }

    const selected = session.transactions[num - 1];
    session.selectedId = selected.id;
    session.step = 'select_field';

    const sign = selected.type === 'pemasukan' ? '🟢 +' : '🔴 -';
    await bot.sendMessage(chatId,
      `✏️ *Transaksi dipilih:*\n` +
      `${sign}Rp ${formatRupiah(selected.amount)} — ${selected.description}\n` +
      `Kategori: ${selected.category}\n\n` +
      `Mau edit apa?\n` +
      `1. Nominal\n` +
      `2. Deskripsi\n` +
      `3. Kategori\n` +
      `4. Tipe (pemasukan/pengeluaran)\n` +
      `5. Tanggal\n\n` +
      `Ketik angka 1-4 atau /batal`
    , { parse_mode: 'Markdown' });
    return true;
  }

  // Step 1 — Pilih transaksi untuk dihapus
  if (session.step === 'select_delete') {
    const num = parseInt(text);
    if (isNaN(num) || num < 1 || num > session.transactions.length) {
      await bot.sendMessage(chatId, `❓ Masukkan angka 1-${session.transactions.length}`);
      return true;
    }

    const selected = session.transactions[num - 1];
    session.selectedId = selected.id;
    session.step = 'confirm_delete';

    const sign = selected.type === 'pemasukan' ? '🟢 +' : '🔴 -';
    await bot.sendMessage(chatId,
      `🗑️ *Yakin mau hapus transaksi ini?*\n\n` +
      `${sign}Rp ${formatRupiah(selected.amount)} — ${selected.description}\n\n` +
      `Ketik *ya* untuk hapus atau /batal`
    , { parse_mode: 'Markdown' });
    return true;
  }

  // Step 2 — Konfirmasi hapus
  if (session.step === 'confirm_delete') {
    if (text.toLowerCase() !== 'ya') {
      await bot.sendMessage(chatId, '❌ Dibatalkan. Ketik *ya* untuk konfirmasi hapus.', { parse_mode: 'Markdown' });
      return true;
    }

    await db.deleteTransaction(session.selectedId, user.id);
    delete editSessions[user.id];

    await bot.sendMessage(chatId, '✅ Transaksi berhasil dihapus!');
    return true;
  }

  // Step 2 — Pilih field yang mau diedit
  if (session.step === 'select_field') {
    const fieldMap = {
      '1': 'amount',
      '2': 'description',
      '3': 'category',
      '4': 'type',
      '5': 'transacted_at',
    };

    const field = fieldMap[text];
    if (!field) {
      await bot.sendMessage(chatId, '❓ Pilih angka 1-4');
      return true;
    }

    session.field = field;
    session.step = 'input_value';

    const prompts = {
      amount: 'Masukkan nominal baru (contoh: 50000 atau 50rb):',
      description: 'Masukkan deskripsi baru:',
      category: 'Masukkan kategori baru:\n(Makanan & Minuman / Transportasi / Belanja / Kesehatan / Utilitas / Hiburan / Pulsa & Data / Gaji / Lain-lain)',
      type: 'Masukkan tipe baru:\n1. pemasukan\n2. pengeluaran',
      transacted_at: 'Masukkan tanggal baru (format: DD-MM-YYYY)\nContoh: 26-02-2026',
    };

    await bot.sendMessage(chatId, prompts[field]);
    return true;
  }

  // Step 3 — Input nilai baru
  if (session.step === 'input_value') {
    let newValue = text.trim();
    const field = session.field;

    // Parse nominal
    if (field === 'amount') {
      newValue = newValue
        .replace(/(\d+)\s*rb/gi, (_, n) => parseInt(n) * 1000)
        .replace(/(\d+)\s*jt/gi, (_, n) => parseInt(n) * 1000000)
        .replace(/[.,]/g, '');
      newValue = parseInt(newValue);

      if (isNaN(newValue) || newValue <= 0) {
        await bot.sendMessage(chatId, '❓ Nominal tidak valid. Coba lagi:');
        return true;
      }
    }

    // Parse tipe
    if (field === 'type') {
      if (text === '1') newValue = 'pemasukan';
      else if (text === '2') newValue = 'pengeluaran';
      else if (!['pemasukan', 'pengeluaran'].includes(text.toLowerCase())) {
        await bot.sendMessage(chatId, '❓ Ketik 1 untuk pemasukan atau 2 untuk pengeluaran');
        return true;
      } else {
        newValue = text.toLowerCase();
      }
    }

    // Parse tanggal
    if (field === 'transacted_at') {
      const parsed = parseTanggal(newValue);

      if (!parsed) {
        await bot.sendMessage(chatId, '❌ Format salah. Gunakan DD-MM-YYYY');
        return true;
      }

      newValue = parsed;
    }

    // Update ke database
    const updated = await db.updateTransaction(session.selectedId, user.id, {
      [field]: newValue,
    });

    delete editSessions[user.id];

    const fieldLabels = {
      amount: 'Nominal',
      description: 'Deskripsi',
      category: 'Kategori',
      type: 'Tipe',
      transacted_at: 'Tanggal',
    };

    const displayValue = field === 'amount'
      ? `Rp ${formatRupiah(newValue)}`
      : field === 'transacted_at'
        ? new Date(newValue).toLocaleDateString('id-ID')
        : newValue;

    await bot.sendMessage(chatId,
      `✅ *Berhasil diupdate!*\n\n` +
      `${fieldLabels[field]}: *${displayValue}*`
    , { parse_mode: 'Markdown' });

    return true;
  }

  return false;
}

// Cek apakah user punya session edit aktif
function hasEditSession(telegramId) {
  return !!editSessions[telegramId];
}

function clearEditSession(userId) {
  delete editSessions[userId];
}

module.exports = {
  handleEdit,
  handleHapus,
  handleEditSession,
  hasEditSession,
  clearEditSession,
};