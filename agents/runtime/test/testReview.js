'use strict';

const { audit } = require('../auditor');
const { review } = require('../reviewer');
const { runGate } = require('../reviewManager');

/**
 * Test scenarios demonstrating the audit gate.
 * No file I/O — self-contained demonstration.
 */

function testCase(label, proposal) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST: ${label}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Proposal: ${JSON.stringify(proposal)}`);

  const { approved, stage, issues, warnings } = runGate(proposal);

  const status = approved ? '✓ PASS' : '✗ FAIL';
  console.log(`\n  Result:   ${status}`);
  console.log(`  Stage:    ${stage}`);

  if (issues.length) {
    console.log(`  Issues:`);
    issues.forEach(i => console.log(`    • ${i}`));
  }

  if (warnings.length) {
    console.log(`  Warnings:`);
    warnings.forEach(w => console.log(`    • ${w}`));
  }

  console.log(`  Approved: ${approved}`);
  return { approved, stage, issues, warnings };
}

// ── Scenario 1: Valid proposal ──────────────────────────────────
const validProposal = {
  id: 'prop-001',
  title: 'Add login feature',
  files: ['src/auth.js', 'src/login.js'],
  winner: 'fix-a',
  status: 'pending'
};

// ── Scenario 2: Missing winner ──────────────────────────────────
const noWinnerProposal = {
  id: 'prop-002',
  title: 'Add logout feature',
  files: ['src/logout.js'],
  winner: ''
};

// ── Scenario 3: Empty files array ───────────────────────────────
const emptyFilesProposal = {
  id: 'prop-003',
  title: 'Refactor utilities',
  files: [],
  winner: 'fix-b'
};

// ── Scenario 4: Too many files (reviewer warning) ──────────────
const tooManyFilesProposal = {
  id: 'prop-004',
  title: 'Big refactor',
  files: [
    'src/a.js', 'src/b.js', 'src/c.js',
    'src/d.js', 'src/e.js', 'src/f.js',
    'src/g.js'
  ],
  winner: 'fix-c'
};

// ── Scenario 5: Null proposal ──────────────────────────────────
const nullProposal = null;

// ── Run all tests ────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║        AUDIT GATE — TEST SUITE                   ║');
console.log('╚══════════════════════════════════════════════════╝');

const results = [
  testCase('1: Valid proposal', validProposal),
  testCase('2: Missing winner (empty string)', noWinnerProposal),
  testCase('3: Empty files array', emptyFilesProposal),
  testCase('4: Too many files (reviewer warning)', tooManyFilesProposal),
  testCase('5: Null proposal', nullProposal),
];

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log('  SUMMARY');
console.log(`${'='.repeat(60)}`);

const passCount = results.filter(r => r.approved).length;
const failCount = results.filter(r => !r.approved).length;

results.forEach((r, i) => {
  const num = i + 1;
  const icon = r.approved ? '✓' : '✗';
  console.log(`  ${icon}  Test ${num}: ${r.approved ? 'PASS' : 'FAIL'}  (stage: ${r.stage})`);
});

console.log(`\n  ${passCount} passed, ${failCount} failed`);
console.log('');