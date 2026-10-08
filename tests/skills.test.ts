import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanSkillsDir } from '../src/core/scanners/skills';

let tmp: string;

const write = async (rel: string, content: string) => {
  const p = path.join(tmp, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf8');
};

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-skills-'));

  await write(
    '.claude/skills/android-cli/SKILL.md',
    ['---', 'name: android-cli', 'description: 安卓工具', '---', '', '正文 A'].join('\n'),
  );
  await write('.claude/skills/no-frontmatter/SKILL.md', '只有正文，没有 frontmatter');
  await write(
    '.claude/skills/bad-yaml/SKILL.md',
    ['---', 'name: [unclosed', '---', '', 'x'].join('\n'),
  );
  await write('.claude/skills/missing-manifest/README.md', '这个目录里没有 SKILL.md');
  await write('.claude/skills/not-a-dir.txt', '一个文件，不是目录');

  // 真实 skill 放在 .agents 下
  await write(
    '.agents/skills/odai/SKILL.md',
    ['---', 'name: odai', 'description: 治理推进', '---', '', '正文 B'].join('\n'),
  );
  // .claude 下用链接指向它
  await fs.symlink(
    path.join(tmp, '.agents/skills/odai'),
    path.join(tmp, '.claude/skills/odai'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('scanSkillsDir', () => {
  it('解析出 skill 的名称、描述、正文与 frontmatter', async () => {
    const { resources } = await scanSkillsDir(path.join(tmp, '.claude/skills'), {
      agentId: 'claude',
      scope: 'user',
    });
    const android = resources.find((r) => r.name === 'android-cli')!;
    expect(android.description).toBe('安卓工具');
    expect(android.body).toBe('正文 A');
    expect(android.frontmatter).toEqual({ name: 'android-cli', description: '安卓工具' });
    expect(android.readOnly).toBe(false);
    expect(android.usedBy).toEqual(['claude']);
    expect(android.scope).toBe('user');
    expect(android.contentHash).toHaveLength(64);
  });

  it('没有 frontmatter 的 skill 用目录名兜底', async () => {
    const { resources } = await scanSkillsDir(path.join(tmp, '.claude/skills'), {
      agentId: 'claude',
      scope: 'user',
    });
    const r = resources.find((res) => res.name === 'no-frontmatter')!;
    expect(r.description).toBeUndefined();
    expect(r.body).toBe('只有正文，没有 frontmatter');
  });

  it('把符号链接解析到真实路径，rawPaths 保留链接路径', async () => {
    const { resources } = await scanSkillsDir(path.join(tmp, '.claude/skills'), {
      agentId: 'claude',
      scope: 'user',
    });
    const odai = resources.find((r) => r.name === 'odai')!;
    expect(odai.path).toBe(path.join(tmp, '.agents', 'skills', 'odai'));
    expect(odai.rawPaths).toEqual([path.join(tmp, '.claude', 'skills', 'odai')]);
    expect(odai.id).toBe(odai.id.toLowerCase());
  });

  it('id 基于真实路径，两个 agent 指向同一 skill 时 id 相同', async () => {
    const a = await scanSkillsDir(path.join(tmp, '.claude/skills'), {
      agentId: 'claude',
      scope: 'user',
    });
    const b = await scanSkillsDir(path.join(tmp, '.agents/skills'), {
      agentId: 'agents',
      scope: 'user',
    });
    const idA = a.resources.find((r) => r.name === 'odai')!.id;
    const idB = b.resources.find((r) => r.name === 'odai')!.id;
    expect(idA).toBe(idB);
  });

  it('异常被收集为 issues 而不是抛错', async () => {
    const { issues } = await scanSkillsDir(path.join(tmp, '.claude/skills'), {
      agentId: 'claude',
      scope: 'user',
    });
    const kinds = issues.map((i) => `${i.kind}:${path.basename(path.dirname(i.path))}`);
    expect(kinds).toContain('bad-frontmatter:bad-yaml');
    expect(kinds).toContain('missing-manifest:missing-manifest');
  });

  it('目录不存在时返回空结果而不是抛错', async () => {
    const out = await scanSkillsDir(path.join(tmp, 'nope'), {
      agentId: 'claude',
      scope: 'user',
    });
    expect(out.resources).toEqual([]);
    expect(out.issues).toEqual([]);
  });

  it('non-skill 文件被忽略', async () => {
    const { resources } = await scanSkillsDir(path.join(tmp, '.claude/skills'), {
      agentId: 'claude',
      scope: 'user',
    });
    expect(resources.map((r) => r.name).sort()).toEqual(
      ['android-cli', 'no-frontmatter', 'odai'].sort(),
    );
  });
});
