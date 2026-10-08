import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listProjects, scanProjectResources } from '../src/core/projects';

let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-projects-'));
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('listProjects', () => {
  it('从 ~/.claude.json 读出项目绝对路径列表', async () => {
    const p = path.join(tmp, 'claude.json');
    await fs.writeFile(
      p,
      JSON.stringify({
        projects: {
          'C:/Users/BAI': { hasTrustDialogAccepted: true },
          'D:/other/code/win/AgentResourceManager': {},
        },
      }),
      'utf8',
    );

    expect(await listProjects(p)).toEqual([
      'C:/Users/BAI',
      'D:/other/code/win/AgentResourceManager',
    ]);
  });

  it('文件不存在返回空数组', async () => {
    expect(await listProjects(path.join(tmp, 'nope.json'))).toEqual([]);
  });

  it('JSON 损坏返回空数组', async () => {
    const p = path.join(tmp, 'broken.json');
    await fs.writeFile(p, '{ oops', 'utf8');
    expect(await listProjects(p)).toEqual([]);
  });

  it('没有 projects 键返回空数组', async () => {
    const p = path.join(tmp, 'no-projects.json');
    await fs.writeFile(p, JSON.stringify({ numStartups: 3 }), 'utf8');
    expect(await listProjects(p)).toEqual([]);
  });
});

describe('scanProjectResources', () => {
  it('扫出项目的 .mcp.json、CLAUDE.md、AGENTS.md 与项目级 skills', async () => {
    const proj = path.join(tmp, 'proj-alpha');
    await fs.mkdir(path.join(proj, '.claude', 'skills', 'local-skill'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(proj, '.claude', 'skills', 'local-skill', 'SKILL.md'),
      ['---', 'name: local-skill', 'description: 项目本地技能', '---', '', 'x'].join(
        '\n',
      ),
      'utf8',
    );
    await fs.writeFile(
      path.join(proj, '.mcp.json'),
      JSON.stringify({ mcpServers: { git: { command: 'uvx' } } }),
      'utf8',
    );
    await fs.writeFile(path.join(proj, 'CLAUDE.md'), '# 项目说明', 'utf8');
    await fs.writeFile(path.join(proj, 'AGENTS.md'), '# agent 说明', 'utf8');

    const { resources, issues } = await scanProjectResources(proj, {
      home: tmp,
      agentId: 'claude',
    });

    expect(issues).toEqual([]);
    expect(resources.map((r) => r.type).sort()).toEqual(
      ['mcp', 'memory', 'memory', 'skill'].sort(),
    );

    const skill = resources.find((r) => r.type === 'skill')!;
    expect(skill.name).toBe('local-skill');
    expect(skill.scope).toBe('project');
    expect(skill.projectPath).toBe(proj);

    const names = resources
      .filter((r) => r.type === 'memory')
      .map((r) => r.name)
      .sort();
    expect(names).toEqual(['AGENTS.md', 'CLAUDE.md']);
  });

  it('项目目录不存在时返回空结果而不是抛错', async () => {
    const out = await scanProjectResources(path.join(tmp, 'no-such-project'), {
      home: tmp,
      agentId: 'claude',
    });
    expect(out.resources).toEqual([]);
  });

  it('项目级资源全部标记 scope: project', async () => {
    const proj = path.join(tmp, 'proj-beta');
    await fs.mkdir(proj, { recursive: true });
    await fs.writeFile(path.join(proj, 'CLAUDE.md'), '# x', 'utf8');
    const { resources } = await scanProjectResources(proj, {
      home: tmp,
      agentId: 'claude',
    });
    expect(resources.every((r) => r.scope === 'project')).toBe(true);
  });
});
