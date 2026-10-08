import { describe, expect, it } from 'vitest';
import { beijingFileStamp, beijingParts, formatBeijing } from '../src/shared/time';

describe('beijingParts', () => {
  it('把 UTC 时刻换算成东八区的墙上时间', () => {
    // 1970-01-01T00:00:00Z → 北京时间 08:00
    expect(beijingParts(0)).toEqual({
      year: 1970,
      month: 1,
      day: 1,
      hours: 8,
      minutes: 0,
      seconds: 0,
    });
  });

  it('跨日会把日期推到北京时间的次日', () => {
    // 2025-12-31T20:00:00Z → 北京 2026-01-01 04:00
    const ms = Date.UTC(2025, 11, 31, 20, 0, 0);
    expect(beijingParts(ms)).toEqual({
      year: 2026,
      month: 1,
      day: 1,
      hours: 4,
      minutes: 0,
      seconds: 0,
    });
  });

  it('UTC 当天凌晨会落到北京时间的当天上午', () => {
    const ms = Date.UTC(2026, 0, 1, 0, 30, 45);
    expect(beijingParts(ms)).toEqual({
      year: 2026,
      month: 1,
      day: 1,
      hours: 8,
      minutes: 30,
      seconds: 45,
    });
  });
});

describe('formatBeijing', () => {
  it('默认输出 MM-DD HH:mm', () => {
    expect(formatBeijing(Date.UTC(2026, 0, 1, 0, 30, 45))).toBe('01-01 08:30');
  });

  it('withSeconds 时补上秒', () => {
    expect(formatBeijing(Date.UTC(2026, 0, 1, 0, 30, 45), true)).toBe('01-01 08:30:45');
  });

  it('个位数月日补零', () => {
    expect(formatBeijing(Date.UTC(2026, 8, 9, 1, 5, 0))).toBe('09-09 09:05');
  });
});

describe('beijingFileStamp', () => {
  it('格式为 YYYY-MM-DD-HH-mm-ss，不含冒号或空格', () => {
    const stamp = beijingFileStamp(Date.UTC(2026, 0, 1, 0, 30, 45));
    expect(stamp).toBe('2026-01-01-08-30-45');
    expect(stamp).not.toMatch(/[: ]/);
  });
});
