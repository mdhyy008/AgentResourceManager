import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectAll, registeredAdapters } from '../src/core/adapters';
import { agentsRepoAdapter } from '../src/core/adapters/agents-repo';
import { claudeAdapter } from '../src/core/adapters/claude';
import { cursorAdapter } from '../src/core/adapters/cursor';
import { lingmaAdapter } from '../src/core/adapters/lingma';
import { presetAdapters } from '../src/core/adapters/presets';
import type { Adapter } from '../src/core/adapters/types';

const fakeHome = '/definitely/not/here';

describe('adapter 注册表', () => {
  it('导出了内置 adapter 列表', () => {
    const ids = registeredAdapters.map((a) => a.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('cursor');
    expect(ids).toContain('lingma');
    expect(ids).toContain('agents');
  });

  it('detectAll 跳过探测失败的 adapter', async () => {
    const never: Adapter = {
      id: 'never',
      name: '不存在',
      async detect() {
        return null;
      },
    };
    const found: Adapter = {
      id: 'found',
      name: '存在',
      async detect() {
        return { skills: '/x/skills' };
      },
    };

    const detected = await detectAll(fakeHome, [never, found]);
    expect(detected.map((d) => d.adapter.id)).toEqual(['found']);
  });

  it('detectAll 在 adapter 抛错时不中断，只跳过', async () => {
    const boom: Adapter = {
      id: 'boom',
      name: '炸了',
      async detect() {
        throw new Error('探测失败');
      },
    };
    const detected = await detectAll(fakeHome, [boom]);
    expect(detected).toEqual([]);
  });
});

let home: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-adapters-'));
  await fs.mkdir(path.join(home, '.claude', 'plugins', 'cache'), { recursive: true });
  await fs.mkdir(path.join(home, '.claude', 'skills'), { recursive: true });
  await fs.mkdir(path.join(home, '.claude', 'projects'), { recursive: true });
  await fs.mkdir(path.join(home, '.agents', 'skills'), { recursive: true });
  await fs.mkdir(path.join(home, '.cursor', 'skills'), { recursive: true });
  await fs.mkdir(path.join(home, '.lingma', 'skills'), { recursive: true });
  await fs.writeFile(path.join(home, '.claude.json'), '{}', 'utf8');
});

afterAll(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

describe('claudeAdapter', () => {
  it('探测出各类资源路径', async () => {
    const paths = await claudeAdapter.detect(home);
    expect(paths).not.toBeNull();
    expect(paths!.skills).toBe(path.join(home, '.claude', 'skills'));
    expect(paths!.mcpFiles).toEqual([path.join(home, '.claude.json')]);
    expect(paths!.memoryDirs).toEqual([path.join(home, '.claude', 'projects')]);
    expect(paths!.pluginsManifest).toBe(
      path.join(home, '.claude', 'plugins', 'installed_plugins.json'),
    );
    expect(paths!.pluginsCacheDir).toBe(path.join(home, '.claude', 'plugins', 'cache'));
  });

  it('目录不存在时返回 null', async () => {
    expect(await claudeAdapter.detect('/no/such/home')).toBeNull();
  });
});

describe('agentsRepoAdapter', () => {
  it('探测 .agents/skills', async () => {
    const paths = await agentsRepoAdapter.detect(home);
    expect(paths!.skills).toBe(path.join(home, '.agents', 'skills'));
  });
});

describe('cursorAdapter', () => {
  it('探测 .cursor/skills 与 mcp.json', async () => {
    const paths = await cursorAdapter.detect(home);
    expect(paths!.skills).toBe(path.join(home, '.cursor', 'skills'));
    expect(paths!.mcpFiles).toEqual([path.join(home, '.cursor', 'mcp.json')]);
  });
});

describe('lingmaAdapter', () => {
  it('探测 .lingma/skills', async () => {
    const paths = await lingmaAdapter.detect(home);
    expect(paths!.skills).toBe(path.join(home, '.lingma', 'skills'));
  });
});

describe('presetAdapters', () => {
  it('包含五个预置 agent', () => {
    expect(presetAdapters.map((a) => a.id).sort()).toEqual(
      ['codex', 'continue', 'gemini', 'trae', 'windsurf'].sort(),
    );
  });

  it('本机没有这些目录时全部返回 null，不抛错', async () => {
    for (const adapter of presetAdapters) {
      expect(await adapter.detect(home)).toBeNull();
    }
  });

  it('目录存在时能被探测到', async () => {
    await fs.mkdir(path.join(home, '.codex'), { recursive: true });
    const codex = presetAdapters.find((a) => a.id === 'codex')!;
    const paths = await codex.detect(home);
    expect(paths!.skills).toBe(path.join(home, '.codex', 'skills'));
  });
});
