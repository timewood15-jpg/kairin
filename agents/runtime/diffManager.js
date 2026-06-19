'use strict';

/**
 * Generate a readable line-based diff between two strings.
 * Pure in-memory. No file I/O, no git, no external packages.
 *
 * Algorithm: LCS (Longest Common Subsequence) backtracking.
 * Time: O(n*m) where n,m = line counts. Space: O(n*m).
 * Well within budget for patch-sized files (hundreds of lines).
 *
 * @param {string} originalContent
 * @param {string} modifiedContent
 * @returns {{ changed: boolean, added: number, removed: number, diff: string }}
 */
function generateDiff(originalContent, modifiedContent) {
  // Normalise line endings for consistent comparison
  const orig = (originalContent || '').replace(/\r\n/g, '\n');
  const mod  = (modifiedContent  || '').replace(/\r\n/g, '\n');

  const a = orig === '' ? [] : orig.split('\n');
  const b = mod  === '' ? [] : mod.split('\n');

  // Short-circuit: identical content
  if (orig === mod) {
    return { changed: false, added: 0, removed: 0, diff: '' };
  }

  // ── LCS table ──────────────────────────────────────────────────
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // ── Backtrack to build diff lines ──────────────────────────────
  const lines = [];
  let added = 0;
  let removed = 0;
  let i = n;
  let j = m;

  // Collect the edit sequence in reverse
  const edits = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      edits.push({ type: 'same', line: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({ type: 'add', line: b[j - 1] });
      added++;
      j--;
    } else if (i > 0) {
      edits.push({ type: 'remove', line: a[i - 1] });
      removed++;
      i--;
    }
  }

  edits.reverse();

  // ── Build output with hunk grouping ────────────────────────────
  const CONTEXT = 3; // lines of context around each hunk

  // Find hunk boundaries
  const hunkBreaks = [];
  for (let idx = 0; idx < edits.length; idx++) {
    if (edits[idx].type !== 'same') {
      const hunkStart = Math.max(0, idx - CONTEXT);
      const hunkEnd   = Math.min(edits.length - 1, idx + CONTEXT);
      hunkBreaks.push({ start: hunkStart, end: hunkEnd });
    }
  }

  // Merge overlapping hunk ranges
  if (hunkBreaks.length === 0) {
    return { changed: true, added, removed, diff: '(no structural diff — possible whitespace-only change)' };
  }

  hunkBreaks.sort((x, y) => x.start - y.start);
  const merged = [hunkBreaks[0]];
  for (let k = 1; k < hunkBreaks.length; k++) {
    const last = merged[merged.length - 1];
    if (hunkBreaks[k].start <= last.end + 1) {
      last.end = Math.max(last.end, hunkBreaks[k].end);
    } else {
      merged.push(hunkBreaks[k]);
    }
  }

  // Emit each hunk
  for (let h = 0; h < merged.length; h++) {
    const { start, end } = merged[h];

    // Compute hunk header line numbers (1-based)
    let origLine = 1;
    let modLine  = 1;
    for (let idx = 0; idx < start; idx++) {
      if (edits[idx].type === 'same' || edits[idx].type === 'remove') origLine++;
      if (edits[idx].type === 'same' || edits[idx].type === 'add') modLine++;
    }

    // Count lines in this hunk
    let origCount = 0;
    let modCount  = 0;
    for (let idx = start; idx <= end; idx++) {
      if (edits[idx].type === 'same' || edits[idx].type === 'remove') origCount++;
      if (edits[idx].type === 'same' || edits[idx].type === 'add') modCount++;
    }

    lines.push(`@@ -${origLine},${origCount} +${modLine},${modCount} @@`);

    for (let idx = start; idx <= end; idx++) {
      const e = edits[idx];
      if (e.type === 'same') {
        lines.push(' ' + e.line);
      } else if (e.type === 'remove') {
        lines.push('-' + e.line);
      } else {
        lines.push('+' + e.line);
      }
    }
  }

  return {
    changed: true,
    added,
    removed,
    diff: lines.join('\n')
  };
}

module.exports = { generateDiff };