import { describe, expect, it } from 'vitest';
import { detectAll, registeredAdapters } from '../src/core/adapters';
import type { Adapter } from '../src/core/adapters/types';

const fakeHome = '/definitely/not/here';

describe('adapter 注册表', () => {
  it('导出了内置 adapter 列表', () => {
    const ids = registeredAdapters.map((a) => a.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('cursor');
    expect(ids).toContain('lingma');
    expect(ids).toContain('agents');
  });

  it('detectAll 跳过探测失败的 adapter', async () => {
    const never: Adapter = {
      id: 'never',
      name: '不存在',
      async detect() {
        return null;
      },
    };
    const found: Adapter = {
      id: 'found',
      name: '存在',
      async detect() {
        return { skills: '/x/skills' };
      },
    };

    const detected = await detectAll(fakeHome, [never, found]);
    expect(detected.map((d) => d.adapter.id)).toEqual(['found']);
  });

  it('detectAll 在 adapter 抛错时不中断，只跳过', async () => {
    const boom: Adapter = {
      id: 'boom',
      name: '炸了',
      async detect() {
        throw new Error('探测失败');
      },
    };
    const detected = await detectAll(fakeHome, [boom]);
    expect(detected).toEqual([]);
  });
});
