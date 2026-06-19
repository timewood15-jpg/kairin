const sessionRepo = require('../services/db/sessionRepo');

const { handleEditSession, hasEditSession } = require('../handlers/edit');
const { handleOCRSession } = require('../flows/ocrSessionFlow');
const { handleTextTransaction } = require('../flows/transactionFlow');
const { handleFinanceInsight } = require('../flows/financeInsightFlow');
const { handleTransactionLookup } = require('../flows/lookupFlow');
const { handleAI } = require('../flows/aiFlow');

const { rateLimit } = require('../middleware/rateLimit');

async function routeMessage(bot, chatId, user, text) {
  const limited = await rateLimit(
    user.id,
    bot,
    chatId
  );

  if (limited) {
    return true;
  }
  const input = text.toLowerCase().trim();

  const gated = await handleActiveSessions(
    bot,
    chatId,
    user,
    input,
    text
  );

  if (gated) return true;

  const isLookup = await handleTransactionLookup(bot, chatId, user, input);

  if (isLookup) {
    return true;
  }

  const handledInsight = await handleFinanceInsight(bot, chatId, user, input);

  if (handledInsight) {
    return true;
  }

  // ================================
  const isTransaction = await handleTextTransaction(
    bot,
    chatId,
    user,
    text
  );

  if (isTransaction) {
    return true;
  }

  // ================================
  // 🔥 AI FALLBACK
  // ================================
  await handleAI(bot, chatId, user, text);

  return true;
}

async function handleActiveSessions(bot, chatId, user, input, text) {
  const ocrSession = await sessionRepo.getOcrSession(user.id);

  if (ocrSession) {
    await handleOCRSession(
      bot,
      chatId,
      user,
      input,
      ocrSession
    );

    return true;
  }

  // ================================
  // 🔥 EDIT SESSION
  // ================================
  if (hasEditSession(user.id)) {
    const handled = await handleEditSession(
      bot,
      chatId,
      user,
      text
    );

    if (handled) return true;
  }

  return false;
}

module.exports = {
  routeMessage
};
