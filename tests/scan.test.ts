import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runScan } from '../src/core/scan';
import type { SkillResource } from '../src/core/types';
import { buildFixtureHome } from './fixtures/build-home';

let home: string;

beforeAll(async () => {
  const fixture = await buildFixtureHome();
  home = fixture.root;
});

afterAll(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

describe('runScan', () => {
  it('发现所有探测成功的 agent', async () => {
    const result = await runScan({ home });
    const ids = result.agents.map((a) => a.id).sort();
    expect(ids).toEqual(['agents', 'claude', 'cursor', 'lingma'].sort());
  });

  it('把跨 agent 共享的 skill 合并成一条，usedBy 包含所有使用方', async () => {
    const result = await runScan({ home });
    const odai = result.resources.find(
      (r) => r.type === 'skill' && r.name === 'odai',
    )!;
    expect(odai.usedBy.sort()).toEqual(['agents', 'claude', 'lingma']);
    expect(odai.rawPaths).toHaveLength(3);
  });

  it('插件自带的 skill 出现在结果里且 readOnly', async () => {
    const result = await runScan({ home });
    const skill = result.resources.find(
      (r): r is SkillResource => r.type === 'skill' && r.name === 'brainstorming',
    )!;
    expect(skill.readOnly).toBe(true);
  });

  it('四类资源都出现在结果里', async () => {
    const result = await runScan({ home });
    const types = new Set(result.resources.map((r) => r.type));
    expect(types).toEqual(new Set(['skill', 'mcp', 'memory', 'plugin']));
  });

  it('项目级资源带上 projectPath', async () => {
    const result = await runScan({ home });
    const projectResources = result.resources.filter((r) => r.scope === 'project');
    expect(projectResources.length).toBeGreaterThan(0);
    expect(projectResources.every((r) => typeof r.projectPath === 'string')).toBe(true);
  });

  it('用户级全局记忆文件被扫到，scope 为 user', async () => {
    const result = await runScan({ home });
    const global = result.resources.find(
      (r) => r.type === 'memory' && r.scope === 'user' && r.name === 'CLAUDE.md',
    );
    expect(global).toBeDefined();
    expect(global!.usedBy).toEqual(['claude']);
    expect(global!.path).toBe(path.join(home, '.claude', 'CLAUDE.md'));
  });

  it('异常被收集起来而不是中断扫描', async () => {
    const result = await runScan({ home });
    const kinds = result.issues.map((i) => i.kind);
    expect(kinds).toContain('bad-frontmatter');
    expect(kinds).toContain('missing-manifest');
  });

  it('资源 id 全局唯一（去重已生效）', async () => {
    const result = await runScan({ home });
    const ids = result.resources.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('统计各 agent 的资源数', async () => {
    const result = await runScan({ home });
    expect(result.agents.every((a) => typeof a.resourceCount === 'number')).toBe(true);
    const claude = result.agents.find((a) => a.id === 'claude')!;
    expect(claude.resourceCount).toBeGreaterThan(0);
  });

  it('返回耗时与扫描时间戳', async () => {
    const result = await runScan({ home });
    expect(result.scannedAt).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('home 完全不存在时返回空结果而不是抛错', async () => {
    const result = await runScan({ home: path.join(os.tmpdir(), 'arm-nope-home') });
    expect(result.agents).toEqual([]);
    expect(result.resources).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
