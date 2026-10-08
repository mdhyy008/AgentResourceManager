import * as path from 'node:path';
import { exists } from '../fs-utils';
import type { Adapter } from './types';

/**
 * ~/.agents 是跨 agent 共享的 skill 仓库（有自己的 .skill-lock.json 记录来源）。
 * 按用户决定，它在顶部条里当成一个普通 agent 计数。
 */
export const agentsRepoAdapter: Adapter = {
  id: 'agents',
  name: '.agents',
  async detect(home) {
    const root = path.join(home, '.agents');
    if (!(await exists(root))) return null;
    return {
      skills: path.join(root, 'skills'),
      // 仓库根的 AGENTS.md 作为跨 agent 共享的全局记忆
      memoryFiles: [path.join(root, 'AGENTS.md')],
    };
  },
};
