'use strict';

/**
 * Reviewer — sanity and consistency checks on an already-audited proposal.
 * No file I/O, no git, no AI calls. Pure deterministic review.
 *
 * @param {object} proposal  (assumed to have passed audit already)
 * @returns {{ approved: boolean, warnings: string[] }}
 */
function review(proposal) {
  const warnings = [];

  // Sanity: id format should be simple alphanumeric+dash
  // (only runs if id exists, which auditor guarantees)
  if (proposal.id && typeof proposal.id === 'string') {
    if (!/^[\w-]+$/.test(proposal.id)) {
      warnings.push(`Suspicious proposal.id format: "${proposal.id}" — expected simple identifier`);
    }
  }

  // Sanity: files should be plain filenames (no absolute paths)
  if (Array.isArray(proposal.files)) {
    const suspicious = proposal.files.filter(
      f => typeof f === 'string' && (f.startsWith('/') || f.startsWith('C:') || f.startsWith('\\\\'))
    );
    if (suspicious.length) {
      warnings.push(`Files look like absolute paths: ${suspicious.join(', ')} — expected relative paths`);
    }

    // Warning threshold: more than 5 files
    if (proposal.files.length > 5) {
      warnings.push(`Proposal touches ${proposal.files.length} files (max recommended: 5)`);
    }

    // Sanity: duplicates in files
    const seen = new Set();
    const dups = proposal.files.filter(f => {
      if (seen.has(f)) return true;
      seen.add(f);
      return false;
    });
    if (dups.length) {
      warnings.push(`Duplicate files in proposal: ${[...new Set(dups)].join(', ')}`);
    }
  }

  // Sanity: winner format
  if (proposal.winner && typeof proposal.winner === 'string') {
    if (!/^[\w-]+$/.test(proposal.winner)) {
      warnings.push(`Suspicious winner format: "${proposal.winner}"`);
    }
  }

  return {
    approved: warnings.length === 0,
    warnings
  };
}

module.exports = { review };