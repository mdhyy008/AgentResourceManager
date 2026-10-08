import { describe, expect, it } from 'vitest';
import { diffLines, diffStats } from '../src/renderer/lib/diff';

const types = (before: string, after: string) => diffLines(before, after).map((l) => l.type);

describe('diffLines', () => {
  it('内容相同时全是 same', () => {
    expect(types('a\nb\nc', 'a\nb\nc')).toEqual(['same', 'same', 'same']);
  });

  it('单行替换记成 remove + add 一对', () => {
    const lines = diffLines('a\nb\nc', 'a\nB\nc');
    expect(lines.map((l) => l.type)).toEqual(['same', 'remove', 'add', 'same']);
    expect(lines[1].text).toBe('b');
    expect(lines[2].text).toBe('B');
  });

  it('纯追加', () => {
    expect(types('a\nb', 'a\nb\nc')).toEqual(['same', 'same', 'add']);
  });

  it('纯删除', () => {
    expect(types('a\nb\nc', 'a\nc')).toEqual(['same', 'remove', 'same']);
  });

  it('从空到非空', () => {
    expect(types('', 'x')).toEqual(['remove', 'add']);
  });

  it('保留共同的中间块，只标记两端改动', () => {
    const lines = diffLines('one\ntwo\nthree\nfour\nfive', 'one\nTWO\nthree\nfour\nFIVE');
    expect(lines.map((l) => l.type)).toEqual([
      'same',
      'remove',
      'add',
      'same',
      'same',
      'remove',
      'add',
    ]);
  });

  it('公共子序列尽量长，而不是从第一个不同处就整体替换', () => {
    const lines = diffLines('a\nb\nc\nd', 'a\nc\nd\ne');
    const stats = diffStats(lines);
    expect(stats.unchanged).toBe(3);
    expect(stats.removed).toBe(1);
    expect(stats.added).toBe(1);
  });
});

describe('diffStats', () => {
  it('分别统计三种行', () => {
    const stats = diffStats(diffLines('a\nb\nc', 'a\nB\nc\nd'));
    expect(stats).toEqual({ added: 2, removed: 1, unchanged: 2 });
  });
});
