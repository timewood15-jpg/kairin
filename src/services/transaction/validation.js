function validateAmount(text, amount) {
  if (!text || !amount || amount <= 0) return true;
  const lower = text
    .toLowerCase()
    .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');

  if (/\d+\s*(rb|ribu|k)\b/.test(lower) && amount < 1000) {
    console.log('INVALID AMOUNT DETECTED');
    return false;
  }

  if (/\d+\s*(jt|juta)\b/.test(lower) && amount < 1000000) {
    console.log('INVALID AMOUNT DETECTED');
    return false;
  }

  const dotGroups = lower.match(/\d{1,3}(?:\.\d{3})+/g);
  if (dotGroups) {
    for (const group of dotGroups) {
      const normalized = Number(group.replace(/\./g, ''));
      if (amount === normalized) return true;
    }
    console.log('INVALID AMOUNT DETECTED');
    return false;
  }
  return true;
}

module.exports = {
  validateAmount
};
