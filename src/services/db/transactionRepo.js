const db = require('../database');

// SIMPAN TRANSAKSI
async function saveTransaction(userId, data) {
  return db.saveTransaction(userId, data);
}

// AMBIL SEMUA
async function getAllTransactions(userId) {
  return db.getAllTransactions(userId);
}

// SUMMARY
async function getMonthlySummary(userId) {
  return db.getMonthlySummary(userId);
}

async function getTransactionById(userId, id) {
  return db.getTransactionById(id, userId);
}

async function getLastTransactions(userId, limit = 5) {
  return db.getLastTransactions(userId, limit);
}

module.exports = {
  saveTransaction,
  getAllTransactions,
  getMonthlySummary,
  getTransactionById,
  getLastTransactions
};

// trigger railway rebuild