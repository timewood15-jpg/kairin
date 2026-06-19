'use strict';

/**
 * Default safety instructions injected into every execution plan.
 * These guide the rewrite phase without restricting what changes
 * the proposal's patch.changes actually describe.
 */
const DEFAULT_INSTRUCTIONS = [
  'Preserve existing exports',
  'Preserve existing imports/requires',
  'Keep current coding style',
  'Do not modify unrelated logic',
  'Keep CommonJS compatibility'
];

/**
 * buildExecutionPlan — converts an approved proposal + its patch context
 * into a clean, safe rewrite plan.
 *
 * Pure planning layer. No file writes, no git, no AI calls.
 *
 * @param {object} proposal      An approved proposal with a .patch section
 * @param {object} patchContext  Result from patchManager.buildPatchContext()
 * @returns {{
 *   valid: boolean,
 *   errors: string[],
 *   targetFile: ?string,
 *   goal: ?string,
 *   originalContent: ?string,
 *   instructions: ?string[],
 *   changes: ?array
 * }}
 */
function buildExecutionPlan(proposal, patchContext) {
  // ── Validate proposal ──────────────────────────────────────────
  if (!proposal || typeof proposal !== 'object') {
    return {
      valid: false,
      errors: ['Proposal must be a non-null object'],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  // proposal must have a patch section
  if (!proposal.patch || typeof proposal.patch !== 'object') {
    return {
      valid: false,
      errors: ['Proposal is missing required "patch" section'],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  // proposal.patch must have a goal
  if (!proposal.patch.goal || typeof proposal.patch.goal !== 'string') {
    return {
      valid: false,
      errors: ['proposal.patch.goal is required and must be a non-empty string'],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  // ── Validate patchContext ──────────────────────────────────────
  if (!patchContext || typeof patchContext !== 'object') {
    return {
      valid: false,
      errors: ['patchContext must be a non-null object'],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  if (!patchContext.valid) {
    return {
      valid: false,
      errors: [
        'patchContext is not valid',
        ...(Array.isArray(patchContext.errors) ? patchContext.errors : [])
      ],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  if (!patchContext.file || typeof patchContext.file !== 'string') {
    return {
      valid: false,
      errors: ['patchContext.file is required and must be a non-empty string'],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  if (!patchContext.target || typeof patchContext.target !== 'object') {
    return {
      valid: false,
      errors: ['patchContext.target is required (loadTargetFile result)'],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  if (typeof patchContext.target.content !== 'string') {
    return {
      valid: false,
      errors: ['patchContext.target.content is missing — file may not have been loaded'],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  if (!Array.isArray(patchContext.changes)) {
    return {
      valid: false,
      errors: ['patchContext.changes must be an array'],
      targetFile: null,
      goal: null,
      originalContent: null,
      instructions: null,
      changes: null
    };
  }

  // ── Build plan ─────────────────────────────────────────────────
  const goal = proposal.patch.goal;

  return {
    valid: true,
    errors: [],
    targetFile: patchContext.file,
    goal,
    originalContent: patchContext.target.content,
    instructions: [...DEFAULT_INSTRUCTIONS],
    changes: [...patchContext.changes]
  };
}

module.exports = { buildExecutionPlan };