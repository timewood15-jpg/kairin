const db = require('../database');

// ===== OCR SESSION =====

async function createOcrSession(userId, data) {
  global.ocrSessions = global.ocrSessions || {};
  global.ocrSessions[userId] = data;
}

async function getOcrSession(userId) {
  return global.ocrSessions?.[userId] || null;
}

async function deleteOcrSession(userId) {
  if (global.ocrSessions) {
    delete global.ocrSessions[userId];
  }
}

// ===== EDIT SESSION =====

async function createEditSession(userId, data) {
  global.editSessions = global.editSessions || {};
  global.editSessions[userId] = data;
}

async function getEditSession(userId) {
  return global.editSessions?.[userId] || null;
}

async function deleteEditSession(userId) {
  if (global.editSessions) {
    delete global.editSessions[userId];
  }
}

module.exports = {
  createOcrSession,
  getOcrSession,
  deleteOcrSession,
  createEditSession,
  getEditSession,
  deleteEditSession
};