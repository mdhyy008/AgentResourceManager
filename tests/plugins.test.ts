import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scanPlugins } from '../src/core/scanners/plugins';

let tmp: string;
let manifest: string;
let marketplaces: string;
let cacheDir: string;

const INSTALL_DIR =
  'C:\\Users\\BAI\\.claude\\plugins\\cache\\superpowers-marketplace\\superpowers\\5.1.0';

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-plugins-'));
  manifest = path.join(tmp, 'installed_plugins.json');
  marketplaces = path.join(tmp, 'known_marketplaces.json');
  cacheDir = path.join(tmp, 'cache');

  await fs.writeFile(
    manifest,
    JSON.stringify({
      version: 2,
      plugins: {
        'superpowers@superpowers-marketplace': [
          {
            scope: 'user',
            installPath: INSTALL_DIR,
            version: '5.1.0',
            installedAt: '2026-05-19T12:02:42.719Z',
            lastUpdated: '2026-05-19T12:02:42.719Z',
            gitCommitSha: 'f2cbfbefebbfef77321e4c9abc9e949826bea9d7',
          },
        ],
      },
    }),
    'utf8',
  );

  await fs.writeFile(
    marketplaces,
    JSON.stringify({
      'superpowers-marketplace': {
        source: { source: 'github', repo: 'obra/superpowers-marketplace' },
        installLocation: path.join(tmp, 'marketplaces', 'superpowers-marketplace'),
        lastUpdated: '2026-05-19T12:02:32.361Z',
      },
    }),
    'utf8',
  );

  // 插件自带的 skill
  const skillDir = path.join(tmp, 'fake-install', 'skills', 'brainstorming');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, 'SKILL.md'),
    ['---', 'name: brainstorming', 'description: 头脑风暴', '---', '', '正文'].join('\n'),
    'utf8',
  );
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('scanPlugins', () => {
  it('扫出已安装插件及其版本、市场、commit', async () => {
    const { resources } = await scanPlugins({
      manifestPath: manifest,
      marketplacesPath: marketplaces,
      cacheDir,
      agentId: 'claude',
    });

    const plugin = resources.find((r) => r.type === 'plugin')!;
    expect(plugin.pluginId).toBe('superpowers@superpowers-marketplace');
    expect(plugin.name).toBe('superpowers');
    expect(plugin.version).toBe('5.1.0');
    expect(plugin.marketplace).toBe('superpowers-marketplace');
    expect(plugin.gitCommitSha).toBe('f2cbfbefebbfef77321e4c9abc9e949826bea9d7');
    expect(plugin.installPath).toBe(INSTALL_DIR);
    expect(plugin.scope).toBe('user');
  });

  it('插件自带的 skill 被扫出且标记 readOnly', async () => {
    const installDir = path.join(tmp, 'fake-install');
    const { resources } = await scanPlugins({
      manifestPath: manifest,
      marketplacesPath: marketplaces,
      cacheDir,
      agentId: 'claude',
      // 覆盖 installPath 解析，指向我们的假安装目录
      resolveInstallPath: () => installDir,
    });

    const skill = resources.find((r) => r.type === 'skill')!;
    expect(skill.name).toBe('brainstorming');
    expect(skill.readOnly).toBe(true);
    expect(skill.pluginId).toBe('superpowers@superpowers-marketplace');
  });

  it('manifest 不存在时返回空结果', async () => {
    const out = await scanPlugins({
      manifestPath: path.join(tmp, 'nope.json'),
      marketplacesPath: marketplaces,
      cacheDir,
      agentId: 'claude',
    });
    expect(out.resources).toEqual([]);
    expect(out.issues).toEqual([]);
  });

  it('manifest JSON 损坏时记 bad-json issue', async () => {
    const broken = path.join(tmp, 'broken_plugins.json');
    await fs.writeFile(broken, '{ oops', 'utf8');
    const { resources, issues } = await scanPlugins({
      manifestPath: broken,
      marketplacesPath: marketplaces,
      cacheDir,
      agentId: 'claude',
    });
    expect(resources).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.kind).toBe('bad-json');
  });

  it('插件安装目录不存在时只产出 plugin 资源、不产出 skill', async () => {
    const { resources } = await scanPlugins({
      manifestPath: manifest,
      marketplacesPath: marketplaces,
      cacheDir,
      agentId: 'claude',
      resolveInstallPath: () => path.join(tmp, 'does-not-exist'),
    });
    expect(resources.filter((r) => r.type === 'plugin')).toHaveLength(1);
    expect(resources.filter((r) => r.type === 'skill')).toHaveLength(0);
  });

  it('marketplaces 文件缺失时 marketplace 字段退化为从 pluginId 推断', async () => {
    const { resources } = await scanPlugins({
      manifestPath: manifest,
      marketplacesPath: path.join(tmp, 'no-marketplaces.json'),
      cacheDir,
      agentId: 'claude',
      resolveInstallPath: () => path.join(tmp, 'does-not-exist'),
    });
    const plugin = resources.find((r) => r.type === 'plugin')!;
    expect(plugin.marketplace).toBe('superpowers-marketplace');
  });
});
