'use strict';

const { buildExecutionPlan } = require('../planner');

function testCase(label, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST: ${label}`);
  console.log(`${'='.repeat(60)}`);
  fn();
}

function printPlan(result) {
  console.log(`  Valid:      ${result.valid}`);
  if (result.errors.length) {
    result.errors.forEach(e => console.log(`  Error:      ${e}`));
  }
  if (result.targetFile)      console.log(`  Target:     ${result.targetFile}`);
  if (result.goal)            console.log(`  Goal:       ${result.goal}`);
  if (result.originalContent != null) {
    const preview = result.originalContent.split('\n')[0];
    console.log(`  Content:    ${result.originalContent.length} chars, starts with "${preview}"`);
  }
  if (result.instructions) {
    console.log(`  Instructions (${result.instructions.length}):`);
    result.instructions.forEach(i => console.log(`    • ${i}`));
  }
  if (result.changes) {
    console.log(`  Changes:    ${result.changes.length} item(s)`);
    result.changes.forEach((c, i) => console.log(`    [${i}] ${JSON.stringify(c)}`));
  }
}

// ── Shared test data ─────────────────────────────────────────────
const validProposal = {
  id: 'plan-001',
  title: 'Add validation for empty inputs',
  status: 'approved',
  winner: 'fix-a',
  files: ['src/validator.js'],
  patch: {
    file: 'src/validator.js',
    goal: 'Add empty-string guard to validateInput()',
    changes: [
      { op: 'insert', at: 'function start', code: 'if (!input) return false;' }
    ]
  }
};

const validPatchContext = {
  valid: true,
  errors: [],
  file: 'src/validator.js',
  goal: 'Add empty-string guard to validateInput()',
  changes: [
    { op: 'insert', at: 'function start', code: 'if (!input) return false;' }
  ],
  target: {
    path: '/project/src/validator.js',
    content: 'function validateInput(input) {\n  return input.length > 0;\n}\n\nmodule.exports = { validateInput };\n',
    lines: ['function validateInput(input) {', '  return input.length > 0;', '', 'module.exports = { validateInput };', ''],
    lineCount: 5,
    exists: true,
    error: null
  }
};

// ── TEST 1: Valid proposal + patchContext ────────────────────────
testCase('1: Valid proposal + patchContext', () => {
  const plan = buildExecutionPlan(validProposal, validPatchContext);
  printPlan(plan);

  const pass = plan.valid
            && plan.targetFile === 'src/validator.js'
            && plan.goal === 'Add empty-string guard to validateInput()'
            && plan.instructions.length === 5
            && plan.instructions[0] === 'Preserve existing exports'
            && plan.changes.length === 1
            && plan.changes[0].op === 'insert'
            && plan.errors.length === 0;
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 2: Missing proposal ─────────────────────────────────────
testCase('2: Missing proposal (null)', () => {
  const plan = buildExecutionPlan(null, validPatchContext);
  printPlan(plan);

  const pass = !plan.valid
            && plan.errors.length === 1
            && plan.errors[0].includes('non-null object');
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 3: Missing patchContext ─────────────────────────────────
testCase('3: Missing patchContext (null)', () => {
  const plan = buildExecutionPlan(validProposal, null);
  printPlan(plan);

  const pass = !plan.valid
            && plan.errors.length === 1
            && plan.errors[0].includes('non-null object');
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 4: Missing target file in patchContext ──────────────────
testCase('4: Missing target file (patchContext with no file)', () => {
  const brokenContext = {
    valid: true,
    errors: [],
    file: '',
    changes: [],
    target: {
      path: '/project/src/validator.js',
      content: 'function validate() {}',
      exists: true,
      error: null
    }
  };
  const plan = buildExecutionPlan(validProposal, brokenContext);
  printPlan(plan);

  const pass = !plan.valid
            && plan.errors.some(e => e.includes('file'));
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 5: Invalid patchContext (valid=false) ───────────────────
testCase('5: Invalid patchContext (valid is false)', () => {
  const invalidContext = {
    valid: false,
    errors: ['Target file not found: src/missing.js'],
    file: 'src/missing.js',
    goal: 'Add checks',
    changes: [],
    target: null
  };
  const plan = buildExecutionPlan(validProposal, invalidContext);
  printPlan(plan);

  const pass = !plan.valid
            && plan.errors.some(e => e.includes('not valid'))
            && plan.errors.some(e => e.includes('not found'));
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 6: Proposal without patch section ──────────────────────
testCase('6: Proposal missing patch section', () => {
  const noPatchProposal = { id: 'bad', status: 'approved', winner: 'x' };
  const plan = buildExecutionPlan(noPatchProposal, validPatchContext);
  printPlan(plan);

  const pass = !plan.valid
            && plan.errors.some(e => e.includes('patch'));
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log('  SUMMARY');
console.log(`${'='.repeat(60)}`);
console.log('  All tests completed. No files were read or written.');
console.log('');