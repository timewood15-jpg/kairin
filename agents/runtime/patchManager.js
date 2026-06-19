'use strict';

const fs = require('fs');
const path = require('path');

/**
 * loadTargetFile — reads a file from disk and returns structured info.
 * Read-only operation. Does not modify or write anything.
 *
 * @param {string} filePath  Absolute or relative path to the target file
 * @returns {{ path: string, content: string, lines: string[], lineCount: number, exists: boolean, error: ?string }}
 */
function loadTargetFile(filePath) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    return {
      path: resolved,
      content: null,
      lines: [],
      lineCount: 0,
      exists: false,
      error: `File not found: ${resolved}`
    };
  }

  try {
    const content = fs.readFileSync(resolved, 'utf8');
    const lines = content.split('\n');
    return {
      path: resolved,
      content,
      lines,
      lineCount: lines.length,
      exists: true,
      error: null
    };
  } catch (err) {
    return {
      path: resolved,
      content: null,
      lines: [],
      lineCount: 0,
      exists: false,
      error: `Failed to read file: ${err.message}`
    };
  }
}

/**
 * buildPatchContext — extracts patch metadata from an approved proposal
 * and loads the target file for context.
 *
 * Proposal patch schema:
 *   {
 *     file: string,    // path to file to modify
 *     goal: string,    // what the patch aims to achieve
 *     changes: []      // list of specific changes (operations)
 *   }
 *
 * @param {object} proposal  An approved proposal with a .patch property
 * @returns {{ valid: boolean, errors: string[], file: ?string, goal: ?string, changes: ?array, target: ?object }}
 */
function buildPatchContext(proposal) {
  const errors = [];

  // Guard: proposal must exist
  if (!proposal || typeof proposal !== 'object') {
    return {
      valid: false,
      errors: ['Proposal must be a non-null object'],
      file: null,
      goal: null,
      changes: null,
      target: null
    };
  }

  // Guard: proposal must have a patch section
  if (!proposal.patch || typeof proposal.patch !== 'object') {
    return {
      valid: false,
      errors: ['Proposal is missing required "patch" section'],
      file: null,
      goal: null,
      changes: null,
      target: null
    };
  }

  const { file, goal, changes } = proposal.patch;

  // Validate patch.file
  if (!file || typeof file !== 'string') {
    errors.push('patch.file is required and must be a non-empty string');
  }

  // Validate patch.goal
  if (!goal || typeof goal !== 'string') {
    errors.push('patch.goal is required and must be a non-empty string');
  }

  // Validate patch.changes
  if (!Array.isArray(changes)) {
    errors.push('patch.changes is required and must be an array');
  }

  // If structural errors exist, return early without loading the file
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      file: file || null,
      goal: goal || null,
      changes: Array.isArray(changes) ? changes : null,
      target: null
    };
  }

  // Load the target file (read-only)
  const target = loadTargetFile(file);

  return {
    valid: target.exists,
    errors: target.exists ? [] : [target.error],
    file,
    goal,
    changes,
    target
  };
}

module.exports = { loadTargetFile, buildPatchContext };