const rules = require('../config/invocationRules.json');

function selectAgents(task) {
  const t = task.toLowerCase();

  const selected = new Set();

  for (const rule of Object.values(rules)) {
    const matched = rule.keywords.some((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(t);
    });

    if (matched) {
      rule.agents.forEach((a) =>
        selected.add(a)
      );
    }
  }

  // fallback
  if (!selected.size) {
    selected.add('maze');
  }

  return [...selected];
}

module.exports = {
  selectAgents
};