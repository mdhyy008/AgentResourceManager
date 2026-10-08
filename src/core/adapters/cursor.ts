import * as path from 'node:path';
import { exists } from '../fs-utils';
import type { Adapter } from './types';

export const cursorAdapter: Adapter = {
  id: 'cursor',
  name: 'Cursor',
  async detect(home) {
    const root = path.join(home, '.cursor');
    if (!(await exists(root))) return null;
    return {
      skills: path.join(root, 'skills'),
      mcpFiles: [path.join(root, 'mcp.json')],
    };
  },
};
