'use strict';

const fs = require('fs');
const { createBackup } = require('../backupManager');

const BACKUPS_DIR = require('path').join(__dirname, '..', 'backups');

/**
 * Clean up backup files created during this test run.
 */
function cleanup(backupPaths) {
  backupPaths.forEach(p => {
    try { fs.unlinkSync(p); } catch (_) { /* ignore */ }
  });
}

function testCase(label, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST: ${label}`);
  console.log(`${'='.repeat(60)}`);
  fn();
}

// Track backups we create for cleanup
const createdBackups = [];

// ── TEST 1: Existing file ────────────────────────────────────────
testCase('1: Existing file — backup created', () => {
  const result = createBackup('agents/runtime/auditor.js');

  if (result.success) {
    createdBackups.push(result.backup);
    console.log(`  Result:     ✓ success`);
    console.log(`  Original:   ${result.original}`);
    console.log(`  Backup:     ${result.backup}`);
    console.log(`  Exists:     ${fs.existsSync(result.backup)}`);
  } else {
    console.log(`  Result:     ✗ failed (unexpected)`);
    console.log(`  Error:      ${result.error}`);
  }

  const pass = result.success && fs.existsSync(result.backup);
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 2: Missing file ─────────────────────────────────────────
testCase('2: Missing file — descriptive error', () => {
  const result = createBackup('agents/runtime/ghost.js');

  console.log(`  Result:     ${result.success ? '✓ success' : '✗ failed (expected)'}`);

  if (!result.success) {
    console.log(`  Error:      ${result.error}`);
    console.log(`  Contains    ${result.error.includes('not found') ? '✓' : '✗'} 'not found' message`);
    console.log(`  Original:   ${result.original}`);
    console.log(`  Backup:     ${result.backup}`);
  }

  const pass = !result.success && result.error.includes('not found');
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 3: Content verification ─────────────────────────────────
testCase('3: Content verification — backup matches original', () => {
  const result = createBackup('agents/runtime/auditor.js');

  if (result.success) {
    createdBackups.push(result.backup);

    const originalContent = fs.readFileSync(result.original, 'utf8');
    const backupContent = fs.readFileSync(result.backup, 'utf8');
    const match = originalContent === backupContent;

    console.log(`  Original:   ${result.original} (${originalContent.length} chars)`);
    console.log(`  Backup:     ${result.backup} (${backupContent.length} chars)`);
    console.log(`  Match:      ${match ? '✓ identical' : '✗ differs'}`);
    console.log(`  Verdict:    ${match ? '✓ PASS' : '✗ FAIL'}`);
  } else {
    console.log(`  Result:     ✗ failed (unexpected)`);
    console.log(`  Error:      ${result.error}`);
    console.log(`  Verdict:    ✗ FAIL`);
  }
});

// ── TEST 4: Multiple backups ─────────────────────────────────────
testCase('4: Multiple backups — unique filenames', () => {
  const target = 'agents/runtime/auditor.js';

  const r1 = createBackup(target);
  const r2 = createBackup(target);
  const r3 = createBackup(target);

  const results = [r1, r2, r3];
  const allSuccess = results.every(r => r.success);
  const backups = results.map(r => { createdBackups.push(r.backup); return r.backup; });
  const uniquePaths = new Set(backups);

  console.log(`  Backup 1:   ${r1.backup}`);
  console.log(`  Backup 2:   ${r2.backup}`);
  console.log(`  Backup 3:   ${r3.backup}`);
  console.log(`  All success: ${allSuccess ? '✓' : '✗'}`);
  console.log(`  Unique:      ${uniquePaths.size === 3 ? '✓ 3 unique filenames' : `✗ only ${uniquePaths.size} unique`}`);

  const pass = allSuccess && uniquePaths.size === 3;
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log('  SUMMARY');
console.log(`${'='.repeat(60)}`);
console.log(`  Backup files created: ${createdBackups.length}`);

// Cleanup created backups so repeated runs don't accumulate
console.log('  Cleaning up...');
cleanup(createdBackups);

// Verify cleanup
const leftover = createdBackups.filter(p => fs.existsSync(p));
console.log(`  Leftover files: ${leftover.length} (${leftover.length === 0 ? '✓ clean' : '✗ dirty'})`);
console.log('  All tests completed.');