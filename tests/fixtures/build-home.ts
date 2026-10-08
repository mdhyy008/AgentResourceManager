import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export interface FixtureHome {
  root: string;
  projectPath: string;
}

async function write(root: string, rel: string, content: string): Promise<void> {
  const p = path.join(root, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf8');
}

async function link(targetAbs: string, root: string, rel: string): Promise<void> {
  const p = path.join(root, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  // Windows 上用 junction，不需要管理员权限；POSIX 上用目录符号链接
  await fs.symlink(targetAbs, p, process.platform === 'win32' ? 'junction' : 'dir');
}

/**
 * 在临时目录里造一个「麻雀虽小五脏俱全」的假 home：
 * 4 个 agent、跨 agent 共享的 skill（真实文件在 .agents 下、其余用链接）、
 * 1 个插件（含只读 skill）、1 个登记过的项目（含项目级 skill / .mcp.json / CLAUDE.md / AGENTS.md）、
 * 用户级 MCP、project 记忆目录，以及两个故意搞坏的文件用来验证异常收集。
 */
export async function buildFixtureHome(): Promise<FixtureHome> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-home-'));
  const projectPath = path.join(root, 'work', 'demo-project');

  // ---- .agents：共享 skill 仓库（真实文件） ----
  await write(
    root,
    '.agents/skills/odai/SKILL.md',
    ['---', 'name: odai', 'description: 治理推进', '---', '', 'odai 正文'].join('\n'),
  );
  await write(
    root,
    '.agents/skills/grill-me/SKILL.md',
    [
      '---',
      'name: grill-me',
      'description: 拷问计划',
      'disable-model-invocation: true',
      '---',
      '',
      'grill 正文',
    ].join('\n'),
  );
  await write(
    root,
    '.agents/.skill-lock.json',
    JSON.stringify({
      version: 3,
      skills: {
        odai: {
          source: 'orziz/odai',
          sourceType: 'github',
          skillPath: 'skills/odai/SKILL.md',
          installedAt: '2026-07-28T12:27:16.339Z',
        },
      },
      dismissed: {},
    }),
  );

  // ---- .claude/skills：一个实体 + 两个指向 .agents 的链接 + 两个坏目录 ----
  await write(
    root,
    '.claude/skills/android-cli/SKILL.md',
    ['---', 'name: android-cli', 'description: 安卓工具', '---', '', '安卓正文'].join(
      '\n',
    ),
  );
  await link(path.join(root, '.agents/skills/odai'), root, '.claude/skills/odai');
  await link(path.join(root, '.agents/skills/grill-me'), root, '.claude/skills/grill-me');
  await write(
    root,
    '.claude/skills/bad-yaml/SKILL.md',
    ['---', 'name: [unclosed', '---', '', 'x'].join('\n'),
  );
  await write(root, '.claude/skills/missing-manifest/README.md', '没有 SKILL.md');

  // ---- .lingma/skills：全部是链接 ----
  await link(path.join(root, '.agents/skills/odai'), root, '.lingma/skills/odai');
  await link(path.join(root, '.agents/skills/grill-me'), root, '.lingma/skills/grill-me');

  // ---- .cursor/skills：独立实体 ----
  await write(
    root,
    '.cursor/skills/android-cli/SKILL.md',
    ['---', 'name: android-cli', 'description: 安卓工具', '---', '', '安卓正文'].join(
      '\n',
    ),
  );

  // ---- 插件 ----
  await write(
    root,
    '.claude/plugins/installed_plugins.json',
    JSON.stringify({
      version: 2,
      plugins: {
        'superpowers@superpowers-marketplace': [
          {
            scope: 'user',
            installPath: path.join(
              root,
              '.claude/plugins/cache/superpowers-marketplace/superpowers/5.1.0',
            ),
            version: '5.1.0',
            installedAt: '2026-05-19T12:02:42.719Z',
            gitCommitSha: 'f2cbfbefebbfef77321e4c9abc9e949826bea9d7',
          },
        ],
      },
    }),
  );
  await write(
    root,
    '.claude/plugins/known_marketplaces.json',
    JSON.stringify({
      'superpowers-marketplace': {
        source: { source: 'github', repo: 'obra/superpowers-marketplace' },
        installLocation: path.join(
          root,
          '.claude/plugins/marketplaces/superpowers-marketplace',
        ),
        lastUpdated: '2026-05-19T12:02:32.361Z',
      },
    }),
  );
  await write(
    root,
    '.claude/plugins/cache/superpowers-marketplace/superpowers/5.1.0/skills/brainstorming/SKILL.md',
    ['---', 'name: brainstorming', 'description: 头脑风暴', '---', '', 'bs 正文'].join(
      '\n',
    ),
  );

  // ---- 用户级全局记忆 ----
  await write(root, '.claude/CLAUDE.md', '# 全局记忆\n\n对所有项目生效。\n');

  // ---- 用户级 MCP（写在 ~/.claude.json 顶层） ----
  await write(
    root,
    '.claude.json',
    JSON.stringify({
      numStartups: 3,
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
        },
      },
      projects: {
        [projectPath.replace(/\\/g, '/')]: { mcpServers: [] },
      },
    }),
  );

  // ---- 项目级资源 ----
  await write(
    root,
    path.relative(
      root,
      path.join(projectPath, '.claude/skills/local-skill/SKILL.md'),
    ),
    ['---', 'name: local-skill', 'description: 项目本地技能', '---', '', 'local 正文'].join(
      '\n',
    ),
  );
  await write(
    root,
    path.relative(root, path.join(projectPath, '.mcp.json')),
    JSON.stringify({ mcpServers: { git: { command: 'uvx', args: ['mcp-server-git'] } } }),
  );
  await write(root, path.relative(root, path.join(projectPath, 'CLAUDE.md')), '# 项目说明');
  await write(root, path.relative(root, path.join(projectPath, 'AGENTS.md')), '# agent 说明');

  // ---- project 记忆目录（slug 换算） ----
  const slug = projectPath.replace(/[:\\/]/g, '-');
  await write(
    root,
    path.relative(root, path.join(root, '.claude/projects', slug, 'memory/MEMORY.md')),
    '- [某条记忆](note-a.md) — 摘要内容\n',
  );
  await write(
    root,
    path.relative(root, path.join(root, '.claude/projects', slug, 'memory/note-a.md')),
    '记忆正文',
  );

  return { root, projectPath: projectPath.replace(/\\/g, '/') };
}
