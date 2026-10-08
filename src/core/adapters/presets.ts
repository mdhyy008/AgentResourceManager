import * as path from 'node:path';
import { exists } from '../fs-utils';
import type { AgentId, AdapterPaths } from '../types';
import type { Adapter } from './types';

/**
 * 工厂函数：绝大多数 agent 都是「有个 ~/.<name> 目录，里面有 skills/」这个形状，
 * 差异只在额外的 MCP 配置文件叫什么。抽成工厂避免五份重复代码。
 */
export function presetAdapter(
  id: AgentId,
  name: string,
  dirName: string,
  extraPaths: (root: string) => Partial<AdapterPaths> = () => ({}),
): Adapter {
  return {
    id,
    name,
    async detect(home) {
      const root = path.join(home, dirName);
      if (!(await exists(root))) return null;
      return { skills: path.join(root, 'skills'), ...extraPaths(root) };
    },
  };
}

export const presetAdapters: Adapter[] = [
  presetAdapter('codex', 'Codex CLI', '.codex', (root) => ({
    memoryFiles: [path.join(root, 'AGENTS.md')],
  })),
  presetAdapter('gemini', 'Gemini CLI', '.gemini', (root) => ({
    mcpFiles: [path.join(root, 'settings.json')],
    memoryFiles: [path.join(root, 'GEMINI.md')],
  })),
  presetAdapter('windsurf', 'Windsurf', '.windsurf', (root) => ({
    mcpFiles: [path.join(root, 'mcp.json')],
  })),
  presetAdapter('trae', 'Trae', '.trae'),
  presetAdapter('continue', 'Continue', '.continue', (root) => ({
    mcpFiles: [path.join(root, 'config.json')],
  })),
];
