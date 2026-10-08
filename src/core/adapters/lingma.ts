import * as path from 'node:path';
import { exists } from '../fs-utils';
import type { Adapter } from './types';

export const lingmaAdapter: Adapter = {
  id: 'lingma',
  name: '通义灵码',
  async detect(home) {
    const root = path.join(home, '.lingma');
    if (!(await exists(root))) return null;
    return {
      skills: path.join(root, 'skills'),
    };
  },
};
