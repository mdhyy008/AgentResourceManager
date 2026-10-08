import { deflateRawSync } from 'node:zlib';
import { beijingParts } from '../shared/time';

/**
 * 极简 ZIP 写入器（只写，不读）。
 *
 * 之所以不引 jszip/archiver：这个项目对依赖版本很敏感（vite 被三方 peer 锁在 7），
 * 而 ZIP 的结构本身不复杂——本地头 + 中央目录 + EOCD，压缩直接用 Node 内置的
 * deflateRaw。少一个依赖就少一份以后会坏的可能。
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = -1;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * ZIP 用的是 1980 纪元的 DOS 时间格式，秒只有 2 秒精度。
 * DOS 字段是 7 位的「距 1980 年数」，所以能表达的范围只有 1980–2107；
 * 超出范围的日期必须夹住，否则位移出负数会被 writeUInt16LE 直接抛错。
 * 时间取北京时间，与软件其它地方一致。
 */
function dosDateTime(date: Date): { time: number; date: number } {
  const p = beijingParts(date.getTime());
  const time = (p.hours << 11) | (p.minutes << 5) | Math.floor(p.seconds / 2);
  const year = Math.min(2107, Math.max(1980, p.year));
  const day = ((year - 1980) << 9) | (p.month << 5) | p.day;
  return { time, date: day };
}

export interface ZipEntry {
  /** 归档内的路径，一律用正斜杠 */
  name: string;
  data: Uint8Array;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
/** 文件名按 UTF-8 解释；中文路径要靠这一位才不乱码 */
const FLAG_UTF8 = 0x0800;

export function createZip(entries: ZipEntry[], now = new Date()): Uint8Array {
  const { time, date } = dosDateTime(now);
  const parts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const raw = Buffer.from(entry.data);
    const crc = crc32(raw);

    const deflated = deflateRawSync(raw);
    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const flags = FLAG_UTF8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    parts.push(local, nameBuf, payload);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(SIG_CENTRAL, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(flags, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    centralParts.push(cd, nameBuf);
    centralSize += cd.length + nameBuf.length;

    offset += local.length + nameBuf.length + payload.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, ...centralParts, eocd]);
}
