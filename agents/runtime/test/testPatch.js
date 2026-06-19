'use strict';

const { loadTargetFile, buildPatchContext } = require('../patchManager');

/**
 * Test scenarios demonstrating the patch manager.
 * Read-only — does not modify any files.
 */

function testCase(label, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST: ${label}`);
  console.log(`${'='.repeat(60)}`);
  fn();
}

function printTarget(target) {
  if (!target) {
    console.log('  (no target loaded)');
    return;
  }
  console.log(`  Path:       ${target.path}`);
  console.log(`  Exists:     ${target.exists}`);
  console.log(`  Lines:      ${target.lineCount}`);
  if (target.error) console.log(`  Error:      ${target.error}`);
}

function printContext(ctx) {
  console.log(`  Valid:      ${ctx.valid}`);
  if (ctx.errors.length) {
    ctx.errors.forEach(e => console.log(`  Error:      ${e}`));
  }
  console.log(`  File:       ${ctx.file || '(none)'}`);
  console.log(`  Goal:       ${ctx.goal ? ctx.goal.substring(0, 60) : '(none)'}`);
  console.log(`  Changes:    ${Array.isArray(ctx.changes) ? ctx.changes.length + ' item(s)' : '(invalid)'}`);
  printTarget(ctx.target);
}

// ── 1: loadTargetFile on existing file ──────────────────────────
testCase('1: loadTargetFile — existing file', () => {
  const target = loadTargetFile(__filename); // testPatch.js itself
  console.log(`  Status:     ${target.exists ? '✓ FOUND' : '✗ NOT FOUND'}`);
  printTarget(target);
  console.log(`  Preview:    ${target.lines.slice(0, 3).join(' | ')}`);
});

// ── 2: loadTargetFile on missing file ───────────────────────────
testCase('2: loadTargetFile — missing file', () => {
  const target = loadTargetFile('/tmp/nonexistent/file.js');
  console.log(`  Status:     ${target.exists ? '✓ FOUND' : '✗ NOT FOUND'}`);
  printTarget(target);
});

// ── 3: buildPatchContext — valid proposal ────────────────────────
testCase('3: buildPatchContext — valid proposal', () => {
  const proposal = {
    id: 'patch-001',
    winner: 'fix-a',
    files: ['agents/runtime/auditor.js'],
    patch: {
      file: 'agents/runtime/auditor.js',
      goal: 'Add validation for patch.file field',
      changes: [
        { op: 'append', target: 'issues array', value: 'patch.file check' }
      ]
    }
  };
  const ctx = buildPatchContext(proposal);
  const icon = ctx.valid ? '✓' : '✗';
  console.log(`  Status:     ${icon} ${ctx.valid ? 'VALID' : 'INVALID'}`);
  printContext(ctx);
});

// ── 4: buildPatchContext — missing patch section ────────────────
testCase('4: buildPatchContext — missing patch section', () => {
  const proposal = {
    id: 'patch-002',
    winner: 'fix-b',
    files: ['src/foo.js']
  };
  const ctx = buildPatchContext(proposal);
  const icon = ctx.valid ? '✓' : '✗';
  console.log(`  Status:     ${icon} ${ctx.valid ? 'VALID' : 'INVALID'}`);
  printContext(ctx);
});

// ── 5: buildPatchContext — empty patch.file ─────────────────────
testCase('5: buildPatchContext — empty patch.file', () => {
  const proposal = {
    id: 'patch-003',
    winner: 'fix-c',
    files: [],
    patch: {
      file: '',
      goal: 'Do something',
      changes: []
    }
  };
  const ctx = buildPatchContext(proposal);
  const icon = ctx.valid ? '✓' : '✗';
  console.log(`  Status:     ${icon} ${ctx.valid ? 'VALID' : 'INVALID'}`);
  printContext(ctx);
});

// ── 6: buildPatchContext — null proposal ─────────────────────────
testCase('6: buildPatchContext — null proposal', () => {
  const ctx = buildPatchContext(null);
  const icon = ctx.valid ? '✓' : '✗';
  console.log(`  Status:     ${icon} ${ctx.valid ? 'VALID' : 'INVALID'}`);
  printContext(ctx);
});

// ── 7: buildPatchContext — non-existent target file ─────────────
testCase('7: buildPatchContext — file not found', () => {
  const proposal = {
    id: 'patch-004',
    winner: 'fix-d',
    files: ['src/missing.js'],
    patch: {
      file: 'src/missing.js',
      goal: 'Add new feature',
      changes: [{ op: 'add', value: 'stuff' }]
    }
  };
  const ctx = buildPatchContext(proposal);
  const icon = ctx.valid ? '✓' : '✗';
  console.log(`  Status:     ${icon} ${ctx.valid ? 'VALID' : 'INVALID'}`);
  printContext(ctx);
});

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log('  SUMMARY');
console.log(`${'='.repeat(60)}`);
console.log(`  All tests completed. No files were modified.`);