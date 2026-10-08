import * as path from 'node:path';
import { exists } from '../fs-utils';
import type { Adapter } from './types';

export const claudeAdapter: Adapter = {
  id: 'claude',
  name: 'Claude Code',
  async detect(home) {
    const root = path.join(home, '.claude');
    if (!(await exists(root))) return null;
    const plugins = path.join(root, 'plugins');
    return {
      skills: path.join(root, 'skills'),
      // 用户级 MCP 存在 ~/.claude.json 的顶层 mcpServers 里
      mcpFiles: [path.join(home, '.claude.json')],
      // ~/.claude/projects/<slug>/memory/*.md
      memoryDirs: [path.join(root, 'projects')],
      pluginsManifest: path.join(plugins, 'installed_plugins.json'),
      pluginsMarketplaces: path.join(plugins, 'known_marketplaces.json'),
      pluginsCacheDir: path.join(plugins, 'cache'),
    };
  },
};
