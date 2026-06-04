const transactionFingerprints = new Map();

function isDuplicateTransaction(fingerprint, ttlMs = 10000) {
  const now = Date.now();

  for (const [key, timestamp] of transactionFingerprints.entries()) {
    if (now - timestamp > ttlMs) {
      transactionFingerprints.delete(key);
    }
  }

  if (
    transactionFingerprints.has(fingerprint) &&
    now - transactionFingerprints.get(fingerprint) < ttlMs
  ) {
    return true;
  }

  transactionFingerprints.set(fingerprint, now);
  return false;
}

module.exports = {
  transactionFingerprints,
  isDuplicateTransaction
};
