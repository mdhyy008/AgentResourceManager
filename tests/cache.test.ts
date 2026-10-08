import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readCache, writeCache } from '../src/core/cache';
import type { ScanResult } from '../src/core/types';

let dir: string;

const sample: ScanResult = {
  scannedAt: 1234,
  durationMs: 5,
  agents: [],
  resources: [],
  issues: [],
};

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-cache-'));
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('缓存读写', () => {
  it('写入后能读回', async () => {
    await writeCache(dir, sample);
    expect(await readCache(dir)).toEqual(sample);
  });

  it('没有缓存时返回 null', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-cache-empty-'));
    expect(await readCache(empty)).toBeNull();
    await fs.rm(empty, { recursive: true, force: true });
  });

  it('缓存文件损坏时返回 null 而不是抛错', async () => {
    const broken = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-cache-broken-'));
    await fs.mkdir(path.join(broken, 'cache'), { recursive: true });
    await fs.writeFile(path.join(broken, 'cache', 'scan.json'), '{ oops', 'utf8');
    expect(await readCache(broken)).toBeNull();
    await fs.rm(broken, { recursive: true, force: true });
  });

  it('写入会自动创建目录', async () => {
    const fresh = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-cache-fresh-'));
    const nested = path.join(fresh, 'a', 'b');
    await writeCache(nested, sample);
    expect(await readCache(nested)).toEqual(sample);
    await fs.rm(fresh, { recursive: true, force: true });
  });
});
