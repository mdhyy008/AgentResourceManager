/**
 * 全线时间统一按北京时间（UTC+8）处理。
 *
 * 刻意不依赖系统时区：换台机器、或系统时区不是东八区时，显示与写入的时间
 * 都不该跟着变。也刻意不用 `toISOString()`——那个永远返回 UTC，差 8 小时。
 * 北京时间没有夏令时，固定 +8 即可，不用碰时区数据库。
 */
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface BeijingParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** 把一个时间戳拆成北京时间的各个字段 */
export function beijingParts(ms: number): BeijingParts {
  const d = new Date(ms + BEIJING_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
  };
}

/** 界面展示用：`MM-DD HH:mm`，`withSeconds` 为真时补上秒 */
export function formatBeijing(ms: number, withSeconds = false): string {
  const p = beijingParts(ms);
  const base = `${pad(p.month)}-${pad(p.day)} ${pad(p.hours)}:${pad(p.minutes)}`;
  return withSeconds ? `${base}:${pad(p.seconds)}` : base;
}

/** 文件名用：`YYYY-MM-DD-HH-mm-ss`，不含冒号与空格，跨平台安全 */
export function beijingFileStamp(ms: number): string {
  const p = beijingParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}-${pad(p.hours)}-${pad(p.minutes)}-${pad(p.seconds)}`;
}
