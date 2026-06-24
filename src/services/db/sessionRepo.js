const db = require('../database');

// ===== OCR SESSION =====

async function createOcrSession(userId, data) {
  global.ocrSessions = global.ocrSessions || {};
  global.ocrSessions[String(userId)] = data;
}

async function getOcrSession(userId) {
  return global.ocrSessions?.[
    String(userId)
  ] || null;
}

async function deleteOcrSession(userId) {
  if (global.ocrSessions) {
    delete global.ocrSessions[
      String(userId)
    ];
  }
}

// ===== EDIT SESSION =====

async function createEditSession(userId, data) {
  global.editSessions = global.editSessions || {};
  global.editSessions[String(userId)] = data;

  console.log(
    '💾 SAVE SESSION:',
    String(userId),
    data
  );
}

async function getEditSession(userId) {

  const session =
    global.editSessions?.[
      String(userId)
    ] || null;

  console.log(
    '📦 GET SESSION:',
    String(userId),
    session
  );

  return session;
}

async function deleteEditSession(userId) {
  if (global.editSessions) {
    delete global.editSessions[
      String(userId)
    ];
  }
}

// ===== ONBOARDING STATE =====

async function setOnboardingState(userId, state) {
  global.onboardingStates = global.onboardingStates || {};
  global.onboardingStates[String(userId)] = state;
}

async function getOnboardingState(userId) {
  return global.onboardingStates?.[
    String(userId)
  ] || null;
}

async function deleteOnboardingState(userId) {
  if (global.onboardingStates) {
    delete global.onboardingStates[
      String(userId)
    ];
  }
}

module.exports = {
  createOcrSession,
  getOcrSession,
  deleteOcrSession,
  createEditSession,
  getEditSession,
  deleteEditSession,
  setOnboardingState,
  getOnboardingState,
  deleteOnboardingState
};