import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  exists,
  homeDir,
  isLink,
  listDir,
  normalizeKey,
  readTextOrNull,
  realpathOrNull,
  sha256,
  statOrNull,
} from '../src/core/fs-utils';

let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-fs-'));
  await fs.mkdir(path.join(tmp, 'realdir'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'realdir', 'a.txt'), 'hello', 'utf8');
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('normalizeKey', () => {
  it('Windows 上大小写不敏感', () => {
    const a = normalizeKey('C:/Temp/X');
    const b = normalizeKey('c:/temp/x');
    expect(a).toBe(b);
  });
});

describe('exists', () => {
  it('存在的路径返回 true', async () => {
    expect(await exists(path.join(tmp, 'realdir'))).toBe(true);
  });
  it('不存在的路径返回 false', async () => {
    expect(await exists(path.join(tmp, 'nope'))).toBe(false);
  });
});

describe('statOrNull / realpathOrNull', () => {
  it('不存在的路径返回 null 而不是抛错', async () => {
    expect(await statOrNull(path.join(tmp, 'nope'))).toBeNull();
    expect(await realpathOrNull(path.join(tmp, 'nope'))).toBeNull();
  });
});

describe('readTextOrNull', () => {
  it('能读出文件内容', async () => {
    expect(await readTextOrNull(path.join(tmp, 'realdir', 'a.txt'))).toBe('hello');
  });
  it('读目录返回 null 而不是抛错', async () => {
    expect(await readTextOrNull(path.join(tmp, 'realdir'))).toBeNull();
  });
});

describe('listDir', () => {
  it('返回子项绝对路径', async () => {
    const items = await listDir(path.join(tmp, 'realdir'));
    expect(items).toEqual([path.join(tmp, 'realdir', 'a.txt')]);
  });
  it('目录不存在返回空数组', async () => {
    expect(await listDir(path.join(tmp, 'nope'))).toEqual([]);
  });
});

describe('isLink', () => {
  it('普通目录返回 false', async () => {
    expect(await isLink(path.join(tmp, 'realdir'))).toBe(false);
  });
  it('junction/符号链接返回 true', async () => {
    const linkPath = path.join(tmp, 'linkdir');
    await fs.symlink(
      path.join(tmp, 'realdir'),
      linkPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(await isLink(linkPath)).toBe(true);
    // 真实路径应解析到目标
    expect(normalizeKey((await realpathOrNull(linkPath))!)).toBe(
      normalizeKey(path.join(tmp, 'realdir')),
    );
  });
});

describe('sha256', () => {
  it('同样的输入产生同样的 hash，不同的输入不同', () => {
    expect(sha256('a')).toBe(sha256('a'));
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('homeDir', () => {
  it('返回一个存在的绝对路径', async () => {
    expect(path.isAbsolute(homeDir())).toBe(true);
    expect(await exists(homeDir())).toBe(true);
  });
});
