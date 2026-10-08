export type DiffLineType = 'same' | 'add' | 'remove';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/**
 * LCS 规模上限。超过就直接退化成「全删 + 全增」，
 * 因为 DP 表是 O(n·m)，一份几万行的文件足以把渲染进程卡死。
 */
const MAX_CELLS = 4_000_000;

function fallback(before: string[], after: string[]): DiffLine[] {
  return [
    ...before.map((text): DiffLine => ({ type: 'remove', text })),
    ...after.map((text): DiffLine => ({ type: 'add', text })),
  ];
}

/** 行级 diff，基于最长公共子序列。返回按顺序排列的每一行的去留。 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');

  if (a.length * b.length > MAX_CELLS) return fallback(a, b);

  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'remove', text: a[i] });
      i += 1;
    } else {
      out.push({ type: 'add', text: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    out.push({ type: 'remove', text: a[i] });
    i += 1;
  }
  while (j < m) {
    out.push({ type: 'add', text: b[j] });
    j += 1;
  }

  return out;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const line of lines) {
    if (line.type === 'add') added += 1;
    else if (line.type === 'remove') removed += 1;
    else unchanged += 1;
  }
  return { added, removed, unchanged };
}
