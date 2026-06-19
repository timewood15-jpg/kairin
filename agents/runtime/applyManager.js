'use strict';

const fs = require('fs');
const { runGate } = require('./reviewManager');
const { buildPatchContext } = require('./patchManager');
const { buildExecutionPlan } = require('./planner');
const { createBackup } = require('./backupManager');
const { generateRewrite } = require('./rewriteEngine');
const { generateDiff } = require('./diffManager');

/**
 * applyProposal — orchestrates the full audit → plan → backup → rewrite → diff pipeline.
 *
 * Preview mode (options.write === false):
 *   - Runs the full pipeline up to diff generation
 *   - Never writes or modifies files
 *
 * Write mode (options.write === true):
 *   - Runs the full pipeline
 *   - Writes modifiedContent to targetFile only after successful backup
 *   - No git add / commit / push
 *
 * @param {object}  proposal          An approved proposal with .patch section
 * @param {object}  [options]         Optional settings
 * @param {boolean} [options.write]   When true, writes changes to disk
 * @returns {Promise<object>} Unified result
 */
async function applyProposal(proposal, options) {
  var opts = options || {};
  var result = {
    success: false,
    stage: null,
    backup: null,
    diff: null,
    originalContent: null,
    modifiedContent: null,
    targetFile: null,
    error: null
  };

  // ── 1. Audit gate ─────────────────────────────────────────────
  result.stage = 'audit';
  var gate = runGate(proposal);
  if (!gate.approved) {
    result.error = 'Audit failed at stage "' + gate.stage + '"';
    if (gate.issues.length)  result.error += ': ' + gate.issues.join('; ');
    if (gate.warnings.length) result.error += ' [warnings: ' + gate.warnings.join('; ') + ']';
    return result;
  }

  // ── 2. Patch context ──────────────────────────────────────────
  result.stage = 'patchContext';
  var patchContext = buildPatchContext(proposal);
  if (!patchContext.valid) {
    result.error = 'Patch context failed: ' + patchContext.errors.join('; ');
    return result;
  }

  // ── 3. Execution plan ─────────────────────────────────────────
  result.stage = 'plan';
  var plan = buildExecutionPlan(proposal, patchContext);
  if (!plan.valid) {
    result.error = 'Execution plan failed: ' + plan.errors.join('; ');
    return result;
  }

  result.targetFile = plan.targetFile;
  result.originalContent = plan.originalContent;

  // ── 4. Backup ─────────────────────────────────────────────────
  result.stage = 'backup';
  var backup = createBackup(plan.targetFile);
  if (!backup.success) {
    result.error = 'Backup failed: ' + backup.error;
    return result;
  }
  result.backup = backup;

  // ── 5. Rewrite ────────────────────────────────────────────────
  result.stage = 'rewrite';
  var rewrite = await generateRewrite(plan);
  if (!rewrite.success) {
    result.error = 'Rewrite failed: ' + rewrite.error;
    return result;
  }
  result.modifiedContent = rewrite.modifiedContent;

  // ── 6. Diff ───────────────────────────────────────────────────
  result.stage = 'diff';
  result.diff = generateDiff(result.originalContent, result.modifiedContent);

  // ── 7. Write (if requested) ───────────────────────────────────
  if (opts.write === true) {
    result.stage = 'write';
    try {
      fs.writeFileSync(plan.targetFile, result.modifiedContent, 'utf8');
    } catch (err) {
      result.error = 'Write failed: ' + err.message;
      return result;
    }
  }

  result.success = true;
  result.stage = null;
  result.error = null;
  return result;
}

module.exports = { applyProposal };