'use strict';

/**
 * Apply a single change operation to a content string.
 *
 * Supported op types:
 *   replace      { find: string, replace: string }
 *   insertAfter  { match: string, insert: string }
 *   insertBefore { match: string, insert: string }
 *   append       { content: string }
 *   prepend      { content: string }
 *   delete       { match: string }
 *
 * @param {string} content  Current working content
 * @param {object} change   A single change operation
 * @returns {{ ok: boolean, content: string, error: ?string }}
 */
function applyChange(content, change) {
  if (!change || typeof change !== 'object') {
    return { ok: false, content, error: 'Change operation must be a non-null object' };
  }

  const op = change.op;

  switch (op) {

    // ── replace ──────────────────────────────────────────────────
    case 'replace': {
      if (typeof change.find !== 'string' || change.find === '') {
        return { ok: false, content, error: 'replace operation requires non-empty "find" string' };
      }
      if (!('replace' in change)) {
        return { ok: false, content, error: 'replace operation requires "replace" field' };
      }
      const idx = content.indexOf(change.find);
      if (idx === -1) {
        return { ok: false, content, error: `replace: pattern not found — "${change.find.substring(0, 50)}"` };
      }
      const before = content.slice(0, idx);
      const after  = content.slice(idx + change.find.length);
      return { ok: true, content: before + change.replace + after, error: null };
    }

    // ── insertAfter ──────────────────────────────────────────────
    case 'insertAfter': {
      if (typeof change.match !== 'string' || change.match === '') {
        return { ok: false, content, error: 'insertAfter requires non-empty "match" string' };
      }
      if (typeof change.insert !== 'string') {
        return { ok: false, content, error: 'insertAfter requires "insert" string' };
      }
      const lines = content.split('\n');
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(change.match)) {
          lines.splice(i + 1, 0, change.insert);
          found = true;
          break;
        }
      }
      if (!found) {
        return { ok: false, content, error: `insertAfter: match not found — "${change.match}"` };
      }
      return { ok: true, content: lines.join('\n'), error: null };
    }

    // ── insertBefore ─────────────────────────────────────────────
    case 'insertBefore': {
      if (typeof change.match !== 'string' || change.match === '') {
        return { ok: false, content, error: 'insertBefore requires non-empty "match" string' };
      }
      if (typeof change.insert !== 'string') {
        return { ok: false, content, error: 'insertBefore requires "insert" string' };
      }
      const lines2 = content.split('\n');
      let found2 = false;
      for (let i = 0; i < lines2.length; i++) {
        if (lines2[i].includes(change.match)) {
          lines2.splice(i, 0, change.insert);
          found2 = true;
          break;
        }
      }
      if (!found2) {
        return { ok: false, content, error: `insertBefore: match not found — "${change.match}"` };
      }
      return { ok: true, content: lines2.join('\n'), error: null };
    }

    // ── append ───────────────────────────────────────────────────
    case 'append': {
      if (typeof change.content !== 'string') {
        return { ok: false, content, error: 'append operation requires "content" string' };
      }
      // Preserve trailing newline convention of the original
      const hasTrailingNewline = content.endsWith('\n');
      const separator = hasTrailingNewline || content === '' ? '' : '\n';
      let result = content + separator + change.content;
      if (hasTrailingNewline && !result.endsWith('\n')) {
        result += '\n';
      }
      return { ok: true, content: result, error: null };
    }

    // ── prepend ──────────────────────────────────────────────────
    case 'prepend': {
      if (typeof change.content !== 'string') {
        return { ok: false, content, error: 'prepend operation requires "content" string' };
      }
      const separator2 = content.startsWith('\n') ? '' : '\n';
      return { ok: true, content: change.content + separator2 + content, error: null };
    }

    // ── delete ───────────────────────────────────────────────────
    case 'delete': {
      if (typeof change.match !== 'string' || change.match === '') {
        return { ok: false, content, error: 'delete operation requires non-empty "match" string' };
      }
      const lines3 = content.split('\n');
      const filtered = lines3.filter(line => !line.includes(change.match));
      if (filtered.length === lines3.length) {
        return { ok: false, content, error: `delete: no lines matched — "${change.match}"` };
      }
      // Preserve trailing newline
      let result = filtered.join('\n');
      if (content.endsWith('\n') && !result.endsWith('\n')) {
        result += '\n';
      }
      return { ok: true, content: result, error: null };
    }

    default:
      return { ok: false, content, error: `Unknown operation type: "${op}"` };
  }
}

/**
 * generateRewrite — applies a plan's changes to produce candidate modified content.
 * Pure in-memory. Never writes files, never calls AI, never touches git.
 *
 * @param {object} plan  Execution plan from planner.buildExecutionPlan()
 * @returns {Promise<{
 *   success: boolean,
 *   originalContent: ?string,
 *   modifiedContent: ?string,
 *   error: ?string
 * }>}
 */
async function generateRewrite(plan) {
  // ── Validate plan structure ────────────────────────────────────
  if (!plan || typeof plan !== 'object') {
    return {
      success: false,
      originalContent: null,
      modifiedContent: null,
      error: 'Plan must be a non-null object'
    };
  }

  if (typeof plan.targetFile !== 'string' || plan.targetFile === '') {
    return {
      success: false,
      originalContent: null,
      modifiedContent: null,
      error: 'Plan is missing required "targetFile"'
    };
  }

  if (typeof plan.originalContent !== 'string') {
    return {
      success: false,
      originalContent: null,
      modifiedContent: null,
      error: 'Plan is missing required "originalContent"'
    };
  }

  if (!Array.isArray(plan.changes)) {
    return {
      success: false,
      originalContent: plan.originalContent || null,
      modifiedContent: null,
      error: 'Plan is missing required "changes" array'
    };
  }

  // ── Apply changes sequentially ─────────────────────────────────
  let buffer = plan.originalContent;

  for (let i = 0; i < plan.changes.length; i++) {
    const change = plan.changes[i];
    const result = applyChange(buffer, change);

    if (!result.ok) {
      return {
        success: false,
        originalContent: plan.originalContent,
        modifiedContent: buffer,  // partial progress
        error: `Change ${i} failed: ${result.error}`
      };
    }

    buffer = result.content;
  }

  return {
    success: true,
    originalContent: plan.originalContent,
    modifiedContent: buffer,
    error: null
  };
}

module.exports = { generateRewrite };