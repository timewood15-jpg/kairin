'use strict';

const { generateDiff } = require('../diffManager');

function testCase(label, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST: ${label}`);
  console.log(`${'='.repeat(60)}`);
  fn();
}

function printDiff(result) {
  console.log(`  changed: ${result.changed}`);
  console.log(`  added:   ${result.added}`);
  console.log(`  removed: ${result.removed}`);
  if (result.diff) {
    console.log('  diff:');
    result.diff.split('\n').forEach(l => console.log(`    ${l}`));
  } else {
    console.log('  diff:    (empty)');
  }
}

// ── TEST 1: Identical content ────────────────────────────────────
testCase('1: Identical content', () => {
  const content = 'line 1\nline 2\nline 3\n';
  const result = generateDiff(content, content);

  printDiff(result);

  const pass = result.changed === false
            && result.added === 0
            && result.removed === 0
            && result.diff === '';
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 2: Single line modification ─────────────────────────────
testCase('2: Single line modification', () => {
  const original = 'line 1\nline 2\nline 3\nline 4\nline 5\n';
  const modified = 'line 1\nline 2\nmodified line\nline 4\nline 5\n';

  const result = generateDiff(original, modified);
  printDiff(result);

  const pass = result.changed === true
            && result.added === 1
            && result.removed === 1
            && result.diff.includes('-line 3')
            && result.diff.includes('+modified line');
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 3: Multiple additions and removals ──────────────────────
testCase('3: Multiple additions and removals', () => {
  const original = '#include <stdio.h>\n\nint main() {\n    printf("hello");\n    return 0;\n}\n';
  const modified = '#include <stdio.h>\n\nint main(int argc, char **argv) {\n    printf("hello world");\n    printf("bye");\n    return 0;\n}\n';

  const result = generateDiff(original, modified);
  printDiff(result);

  // Original: 6 lines (1 empty), Modified: 7 lines (1 empty)
  // Changed:
  //   - "int main() {" -> "int main(int argc, char **argv) {"
  //   - '    printf("hello");' -> '    printf("hello world");'
  //   + '    printf("bye");'
  // So: 2 removed, 3 added
  const pass = result.changed === true
            && result.removed === 2
            && result.added === 3;
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
  if (!pass) {
    console.log(`  (Expected: removed=2, added=3)`);
  }
});

// ── TEST 4: Empty original ───────────────────────────────────────
testCase('4: Empty original content', () => {
  const original = '';
  const modified = 'line 1\nline 2\nline 3\n';

  const result = generateDiff(original, modified);
  printDiff(result);

  // Trailing \n splits to 4 items: ['line 1','line 2','line 3','']
  const pass = result.changed === true
            && result.added === 4
            && result.removed === 0;
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 5: Empty modified ───────────────────────────────────────
testCase('5: Empty modified content', () => {
  const original = 'line 1\nline 2\nline 3\n';
  const modified = '';

  const result = generateDiff(original, modified);
  printDiff(result);

  // Trailing \n splits to 4 items: ['line 1','line 2','line 3','']
  const pass = result.changed === true
            && result.added === 0
            && result.removed === 4;
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 6: Append only (no removals) ────────────────────────────
testCase('6: Append only — no removals', () => {
  const original = 'line 1\nline 2\n';
  const modified = 'line 1\nline 2\nline 3\nline 4\n';

  const result = generateDiff(original, modified);
  printDiff(result);

  const pass = result.changed === true
            && result.removed === 0
            && result.added === 2;
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 7: Both empty ───────────────────────────────────────────
testCase('7: Both empty', () => {
  const result = generateDiff('', '');
  printDiff(result);

  const pass = result.changed === false
            && result.added === 0
            && result.removed === 0
            && result.diff === '';
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── TEST 8: Windows CRLF handling ────────────────────────────────
testCase('8: Windows CRLF line endings', () => {
  const original = 'line 1\r\nline 2\r\nline 3\r\n';
  const modified = 'line 1\r\nline 2 modified\r\nline 3\r\n';

  const result = generateDiff(original, modified);
  printDiff(result);

  const pass = result.changed === true
            && result.added === 1
            && result.removed === 1
            && result.diff.includes('-line 2')
            && result.diff.includes('+line 2 modified');
  console.log(`  Verdict:    ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log('  SUMMARY');
console.log(`${'='.repeat(60)}`);
console.log('  All tests completed. No files were read or written.');
console.log('');