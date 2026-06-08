const db = require('../services/database');
const { formatDetailMessage } = require('../commands/detail');

const lookupContext = new Map();

function cleanLookupContext() {
  const now = Date.now();
  for (const [k, v] of lookupContext) {
    if (v.expiresAt <= now) lookupContext.delete(k);
  }
}

function getLookupContext(userId) {
  cleanLookupContext();
  return lookupContext.get(userId) || null;
}

function setLookupContext(userId, trx) {
  lookupContext.set(userId, {
    trx,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
}

const STOP_WORDS = new Set([
  'saya', 'aku', 'gua', 'gw', 'lu', 'kamu', 'anda',
  'tau', 'tahu', 'deh', 'dong', 'ya', 'lah', 'kah', 'sih',
  'juga', 'udah', 'sudah', 'ada', 'si', 'teh', 'mbak',
  'pak', 'bu', 'mas', 'mba', 'gan', 'bro', 'sis', 'bang', 'kak',
  'tidak', 'ga', 'gak', 'enggak', 'jangan',
  'mau', 'pengen', 'bisa', 'perlu', 'harus',
  'di', 'ke', 'dari', 'dengan', 'untuk', 'dan', 'atau', 'tapi',
  'yang', 'ini', 'itu', 'cuma', 'hanya',
  'baru', 'lama', 'hari', 'bulan', 'minggu', 'tahun',
  'kemarin', 'lusa', 'besok', 'pagi', 'siang', 'sore', 'malam',
  'biaya', 'total', 'nominal', 'cek', 'lihat', 'ingat', 'kasih',
  'tanya', 'jawab', 'minta', 'tolong', 'help', 'find', 'cari', 'search',
  'where', 'when', 'what', 'how', 'why', 'apakah',
  'pernah', 'beli'
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

function scoreTransaction(trx, tokens) {
  let score = 0;

  const desc = (
    trx.description ||
    trx.note ||
    ''
  ).toLowerCase();

  const merchant = (
    trx.merchant ||
    ''
  ).toLowerCase();

  const billItemNames = Array.isArray(trx.bill_items)
    ? trx.bill_items
        .map((it) =>
          it && typeof it.name === 'string'
            ? it.name.toLowerCase()
            : ''
        )
        .filter(Boolean)
    : [];

  for (const token of tokens) {
    if (desc.includes(token)) score += 2;
    if (merchant.includes(token)) score += 2;
    if (billItemNames.some((name) => name.includes(token))) {
      score += 3;
    }
  }

  return score;
}

function findBestTransaction(transactions, tokens) {
  let best = null;
  let bestScore = 0;
  for (const trx of transactions) {
    const s = scoreTransaction(trx, tokens);
    if (s > bestScore) {
      bestScore = s;
      best = trx;
    }
  }
  if (bestScore >= 2) return best;
  if (bestScore === 1 && tokens.some((tk) => tk.length >= 4)) return best;
  return null;
}

function detectLookupFollowUp(t) {
  if (/\b(minta\s+)?detailnya\b/.test(t)) return 'detailnya';
  if (/\byang\s+terakhir\b/.test(t)) return 'yang terakhir';
  if (/\bkapan\b/.test(t)) return 'kapan';
  if (/\bberapa\b/.test(t)) return 'berapa';
  if (/\bitu\s+apa\b/.test(t)) return 'itu apa';
  return null;
}

async function handleTransactionLookup(bot, chatId, user, input) {
  const t = input.toLowerCase().trim();
  const ctx = getLookupContext(user.id);

  const followUp = ctx ? detectLookupFollowUp(t) : null;

  if (followUp && ctx) {
    const trx = ctx.trx;
    const date = new Date(trx.date || trx.created_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    let reply = '';
    switch (followUp) {
      case 'detailnya':
        reply = formatDetailMessage(trx);
        break;
      case 'kapan':
        reply = '🗓️ Transaksi terakhir: ' + date;
        break;
      case 'berapa':
        reply = '💵 Jumlah: Rp ' + trx.amount.toLocaleString('id-ID');
        break;
      case 'itu apa':
        reply =
          (trx.description || trx.note || '-') +
          ' — Rp ' +
          trx.amount.toLocaleString('id-ID') +
          ' • ' +
          (trx.category || 'Lain-lain');
        break;
      case 'yang terakhir':
        reply =
          '📅 Terakhir: ' + date + '\n' +
          (trx.description || trx.note || '-') + ' — Rp ' + trx.amount.toLocaleString('id-ID');
        break;
    }

    await bot.sendMessage(chatId, reply);
    return true;
  }

  if (!/\b(pernah|terakhir|kapan)\b/.test(t)) return false;

  const transactions = await db.getRecentTransactions(user.id, 3);
  if (!transactions.length) return false;

  const tokens = tokenize(t);
  if (!tokens.length) return false;

  const best = findBestTransaction(transactions, tokens);
  if (!best) return false;

  setLookupContext(user.id, best);

  const date = new Date(best.date || best.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  await bot.sendMessage(
    chatId,
    '🔍 Ditemukan:\n' +
      (best.description || best.note || '-') + '\n' +
      'Rp ' + best.amount.toLocaleString('id-ID') + '\n' +
      (best.category || 'Lain-lain') + ' • ' + date
  );
  return true;
}

module.exports = {
  handleTransactionLookup,
};
