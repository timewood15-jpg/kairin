// src/services/database.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ============================================================
// USERS
// ============================================================

// Cari user by telegram_id, kalau tidak ada → buat baru
async function getOrCreateUser(telegramId, userData = {}) {
  // Cek apakah user sudah ada
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (existing) return existing;

  // Buat user baru
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      telegram_id: telegramId,
      telegram_username: userData.username || null,
      full_name: userData.full_name || null,
      plan: 'free',
      usage_reset_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return newUser;
}

// Update usage counter user
async function incrementUsage(userId, type) {
  const field = type === 'photo' ? 'usage_photo_count' : 'usage_text_count';

  const { data: user } = await supabase
    .from('users')
    .select('usage_text_count, usage_photo_count, usage_reset_at')
    .eq('id', userId)
    .single();

  // Reset counter kalau sudah bulan baru
  const lastReset = new Date(user.usage_reset_at);
  const now = new Date();
  if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    await supabase.from('users').update({
      usage_text_count: 0,
      usage_photo_count: 0,
      usage_reset_at: now.toISOString()
    }).eq('id', userId);
  }

  // Increment counter
  await supabase.from('users').update({
    [field]: (type === 'photo' ? user.usage_photo_count : user.usage_text_count) + 1,
    updated_at: now.toISOString()
  }).eq('id', userId);
}

// Cek apakah user masih dalam limit plan
async function checkLimit(userId, type) {
  const { data: user } = await supabase
    .from('users')
    .select('plan, usage_text_count, usage_photo_count, usage_reset_at')
    .eq('id', userId)
    .single();

  // Reset kalau bulan baru
  const lastReset = new Date(user.usage_reset_at);
  const now = new Date();
  let textCount = user.usage_text_count;
  let photoCount = user.usage_photo_count;

  if (lastReset.getMonth() !== now.getMonth()) {
    textCount = 0;
    photoCount = 0;
  }

  // Limit per plan
  const limits = {
    free:    { text: 50,         photo: 3 },
    starter: { text: 999999,     photo: 30 },
    pro:     { text: 999999,     photo: 999999 },
    family:  { text: 999999,     photo: 999999 },
  };

  const planLimit = limits[user.plan] || limits.free;
  const currentCount = type === 'photo' ? photoCount : textCount;
  const maxCount = type === 'photo' ? planLimit.photo : planLimit.text;

  return {
    allowed: currentCount < maxCount,
    current: currentCount,
    max: maxCount,
    plan: user.plan,
    remaining: Math.max(0, maxCount - currentCount)
  };
}

// ============================================================
// TRANSACTIONS
// ============================================================

// Simpan transaksi baru
async function saveTransaction(userId, data) {
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category,
      merchant: data.merchant || null,
      bill_date: data.billDate || null,
      bill_items: data.billItems || null,
      source: data.source || 'text',
      photo_url: data.photoUrl || null,
      transacted_at: data.transactedAt || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return transaction;
}

// Ambil transaksi hari ini
async function getTodayTransactions(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('transacted_at', today.toISOString())
    .order('transacted_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Ambil transaksi bulan ini
async function getMonthlyTransactions(userId, month = null, year = null) {
  const now = new Date();
  const targetMonth = month || now.getMonth() + 1;
  const targetYear = year || now.getFullYear();

  const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString();
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('transacted_at', startDate)
    .lte('transacted_at', endDate)
    .order('transacted_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Ambil transaksi 3 bulan terakhir untuk AI
async function getRecentTransactions(userId, months = 3) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('transacted_at', startDate.toISOString())
    .order('transacted_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Ambil ringkasan bulanan
async function getMonthlySummary(userId, month = null, year = null) {
  const transactions = await getMonthlyTransactions(userId, month, year);

  let income = 0;
  let expense = 0;
  const categoryMap = {};

  transactions.forEach(t => {
    if (t.type === 'pemasukan') {
      income += t.amount;
    } else {
      expense += t.amount;
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    }
  });

  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    income,
    expense,
    balance: income - expense,
    topCategories,
    totalTransactions: transactions.length
  };
}

// ============================================================
// STORAGE FOTO
// ============================================================

// Upload foto struk ke Supabase Storage
async function uploadStrukPhoto(userId, fileBuffer, filename) {
  const path = `${userId}/${Date.now()}_${filename}`;

  const { data, error } = await supabase.storage
    .from(process.env.STORAGE_BUCKET || 'struk-foto')
    .upload(path, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: false
    });

  if (error) throw error;

  // Ambil public URL
  const { data: urlData } = supabase.storage
    .from(process.env.STORAGE_BUCKET || 'struk-foto')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

// ============================================================
// WALLETS (DOMPET)
// ============================================================

// Ambil semua dompet user
async function getUserWallets(userId) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Buat dompet default saat user baru
async function createDefaultWallets(userId) {
  const defaultWallets = [
    { user_id: userId, name: 'Tunai', type: 'cash', icon: '👛', balance: 0 },
    { user_id: userId, name: 'Bank', type: 'bank', icon: '💳', balance: 0 },
    { user_id: userId, name: 'E-Wallet', type: 'ewallet', icon: '📱', balance: 0 },
  ];

  const { error } = await supabase.from('wallets').insert(defaultWallets);
  if (error) throw error;
}

// Tambahkan fungsi-fungsi ini ke src/services/database.js
// Letakkan sebelum module.exports

// ============================================================
// EDIT & HAPUS TRANSAKSI
// ============================================================

// Ambil 10 transaksi terakhir user
async function getLastTransactions(userId, limit = 10) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('transacted_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Update transaksi
async function updateTransaction(transactionId, userId, updates) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', transactionId)
    .eq('user_id', userId) // pastikan hanya bisa edit milik sendiri
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Hapus transaksi
async function deleteTransaction(transactionId, userId) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', userId); // pastikan hanya bisa hapus milik sendiri

  if (error) throw error;
  return true;
}

// Cari transaksi by ID
async function getTransactionById(transactionId, userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

// ==========================
// OCR SESSION
// ==========================

async function saveOcrSession(userId, session) {
  const { data, step, field } = session;

  await supabase
    .from('ocr_sessions')
    .upsert({
      user_id: userId,
      data,
      step,
      field
    }, { onConflict: 'user_id' });
}

async function getOcrSession(userId) {
  const { data } = await supabase
    .from('ocr_sessions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data;
}

async function deleteOcrSession(userId) {
  await supabase
    .from('ocr_sessions')
    .delete()
    .eq('user_id', userId);
}

async function saveGoogleToken({ user_id, access_token, refresh_token }) {
  const { data, error } = await supabase
    .from('google_tokens')
    .upsert([
      {
        user_id,
        access_token,
        refresh_token,
      },
    ]);

  if (error) {
    console.error('❌ Error save token:', error.message);
    throw error;
  }

  return data;
}

module.exports = {
  supabase,
  getOrCreateUser,
  incrementUsage,
  checkLimit,
  saveTransaction,
  getTodayTransactions,
  getMonthlyTransactions,
  getMonthlySummary,
  uploadStrukPhoto,
  getUserWallets,
  createDefaultWallets,
  getRecentTransactions,
  // Tambah ini ↓
  getLastTransactions,
  updateTransaction,
  deleteTransaction,
  getTransactionById,
  saveOcrSession,
  getOcrSession,
  deleteOcrSession,
  saveGoogleToken
};