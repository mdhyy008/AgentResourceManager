import { randomBytes } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createZip, crc32, type ZipEntry } from '../src/main/zip';

/** 把生成的 zip 再解析回来，用来验证结构确实能被读 */
interface ParsedEntry {
  name: string;
  method: number;
  flags: number;
  crc: number;
  size: number;
  data: Buffer;
}

function parseZip(zip: Uint8Array): { entries: ParsedEntry[]; localCount: number } {
  const buf = Buffer.from(zip);
  const eocdAt = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdAt === -1) throw new Error('找不到 EOCD');

  const total = buf.readUInt16LE(eocdAt + 10);
  const cdOffset = buf.readUInt32LE(eocdAt + 16);

  const entries: ParsedEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < total; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录签名不对');
    const method = buf.readUInt16LE(p + 10);
    const flags = buf.readUInt16LE(p + 8);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localAt = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');

    // 顺着本地头找到数据段
    const localNameLen = buf.readUInt16LE(localAt + 26);
    const localExtraLen = buf.readUInt16LE(localAt + 28);
    const dataAt = localAt + 30 + localNameLen + localExtraLen;
    const compressed = buf.readUInt32LE(localAt + 18);
    const payload = buf.subarray(dataAt, dataAt + compressed);
    const data = method === 8 ? inflateRawSync(payload) : Buffer.from(payload);

    entries.push({ name, method, flags, crc, size, data });
    p += 46 + nameLen + extraLen + commentLen;
  }

  return { entries, localCount: total };
}

describe('crc32', () => {
  it('与已知值一致', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.from(''))).toBe(0);
  });
});

describe('createZip', () => {
  it('空归档也是合法的（只有 EOCD）', () => {
    const zip = createZip([]);
    expect(zip.length).toBe(22);
    expect(Buffer.from(zip).readUInt32LE(0)).toBe(0x06054b50);
  });

  it('单条目能原样读回，且 CRC 与内容一致', () => {
    const text = '# 你好\nhello world\n'.repeat(20);
    const zip = createZip([{ name: 'a/b.md', data: Buffer.from(text, 'utf8') }]);
    const { entries, localCount } = parseZip(zip);

    expect(localCount).toBe(1);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('a/b.md');
    expect(entries[0].data.toString('utf8')).toBe(text);
    expect(entries[0].crc).toBe(crc32(Buffer.from(text, 'utf8')));
    expect(entries[0].size).toBe(Buffer.byteLength(text, 'utf8'));
  });

  it('中文文件名带 UTF-8 标志位，且能解出原名', () => {
    const zip = createZip([{ name: '记忆/笔记.md', data: Buffer.from('x') }]);
    const { entries } = parseZip(zip);
    expect(entries[0].name).toBe('记忆/笔记.md');
    expect(entries[0].flags & 0x0800).toBe(0x0800);
  });

  it('反斜杠路径会被规范化成正斜杠', () => {
    const zip = createZip([{ name: 'a\\b\\c.txt', data: Buffer.from('x') }]);
    expect(parseZip(zip).entries[0].name).toBe('a/b/c.txt');
  });

  it('重复内容只存一份数据但两条目录项都在', () => {
    const data = Buffer.from('same'.repeat(100));
    const zip = createZip([
      { name: 'one.txt', data },
      { name: 'two.txt', data },
    ]);
    const { entries } = parseZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['one.txt', 'two.txt']);
    expect(entries[0].data.equals(data)).toBe(true);
    expect(entries[1].data.equals(data)).toBe(true);
  });

  it('可压缩内容用 deflate，不可压缩内容退回 store', () => {
    const compressible = Buffer.from('a'.repeat(5000));
    // 真随机数据 deflate 压不动，会退回 store
    const incompressible = randomBytes(1024);
    const zip = createZip([
      { name: 'big.txt', data: compressible },
      { name: 'rand.bin', data: incompressible },
    ]);
    const { entries } = parseZip(zip);
    const big = entries.find((e) => e.name === 'big.txt')!;
    const rand = entries.find((e) => e.name === 'rand.bin')!;
    expect(big.method).toBe(8);
    expect(rand.method).toBe(0);
    expect(big.data.equals(compressible)).toBe(true);
    expect(rand.data.equals(incompressible)).toBe(true);
  });

  it('本地头偏移正确：多个条目依次首尾相接', () => {
    const zip = createZip([
      { name: 'x.txt', data: Buffer.from('1') },
      { name: 'y.txt', data: Buffer.from('2') },
    ]);
    const buf = Buffer.from(zip);
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    const firstLocalLen = 30 + 5 + buf.readUInt32LE(18);
    expect(buf.readUInt32LE(firstLocalLen)).toBe(0x04034b50);
  });
});

describe('createZip 边界', () => {
  it('空文件条目也能正常解出', () => {
    const entries: ZipEntry[] = [{ name: 'empty.txt', data: Buffer.from('') }];
    const { entries: parsed } = parseZip(createZip(entries));
    expect(parsed[0].data.length).toBe(0);
    expect(parsed[0].crc).toBe(0);
  });

  it('1970 这类早于 1980 的日期不会抛错（DOS 时间夹到 1980）', () => {
    const zip = createZip([{ name: 'old.txt', data: Buffer.from('x') }], new Date(0));
    expect(parseZip(zip).entries[0].name).toBe('old.txt');
    // DOS 日期字段应当是 1980-01-01：(0<<9)|(1<<5)|1
    const buf = Buffer.from(zip);
    expect(buf.readUInt16LE(12)).toBe((1 << 5) | 1);
  });

  it('DOS 时间按北京时间写：UTC 00:30 记成 08:30', () => {
    const zip = createZip(
      [{ name: 'a.txt', data: Buffer.from('x') }],
      new Date(Date.UTC(2026, 0, 1, 0, 30, 0)),
    );
    const buf = Buffer.from(zip);
    expect(buf.readUInt16LE(10)).toBe((8 << 11) | (30 << 5));
    expect(buf.readUInt16LE(12)).toBe(((2026 - 1980) << 9) | (1 << 5) | 1);
  });
});
