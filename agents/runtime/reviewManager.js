'use strict';

const { audit } = require('./auditor');
const { review } = require('./reviewer');

/**
 * ReviewManager — orchestrates audit → review gate.
 *
 * Workflow:
 *   1. Run auditor (structural validation)
 *   2. If auditor fails → stop, return { approved: false, stage: "auditor" }
 *   3. Run reviewer (sanity / consistency)
 *   4. Return unified result
 *
 * @param {object} proposal
 * @returns {{ approved: boolean, stage: 'auditor'|'reviewer', issues: string[], warnings: string[] }}
 */
function runGate(proposal) {
  // Stage 1: Auditor
  const auditResult = audit(proposal);
  if (!auditResult.passed) {
    return {
      approved: false,
      stage: 'auditor',
      issues: auditResult.issues,
      warnings: []
    };
  }

  // Stage 2: Reviewer
  const reviewResult = review(proposal);
  return {
    approved: reviewResult.approved,
    stage: 'reviewer',
    issues: [],
    warnings: reviewResult.warnings
  };
}

module.exports = { runGate };