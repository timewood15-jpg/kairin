'use strict';

/**
 * Auditor — validates proposal structural requirements.
 * No file I/O, no git, no AI calls. Pure deterministic validation.
 *
 * @param {object} proposal
 * @returns {{ passed: boolean, issues: string[] }}
 */
function audit(proposal) {
  const issues = [];

  // Guard: must be an object
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    issues.push('Proposal must be a non-null object');
    return { passed: false, issues };
  }

  // Validate proposal.id
  if (!proposal.id || typeof proposal.id !== 'string') {
    issues.push('Missing or invalid proposal.id — must be a non-empty string');
  }

  // Validate proposal.files
  if (!Array.isArray(proposal.files)) {
    issues.push('Missing or invalid proposal.files — must be an array');
  } else if (proposal.files.length === 0) {
    issues.push('proposal.files is empty — must contain at least one file');
  }

  // Validate proposal.winner
  if (!proposal.winner || typeof proposal.winner !== 'string') {
    issues.push('Missing or invalid proposal.winner — must be a non-empty string');
  }

  return {
    passed: issues.length === 0,
    issues
  };
}

module.exports = { audit };