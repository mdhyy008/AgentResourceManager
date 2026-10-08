import type { Adapter, DetectedAgent } from './types';
import { claudeAdapter } from './claude';
import { agentsRepoAdapter } from './agents-repo';
import { cursorAdapter } from './cursor';
import { lingmaAdapter } from './lingma';

export type { Adapter, DetectedAgent } from './types';

/** 内置的 adapter 列表 */
export const registeredAdapters: Adapter[] = [
  claudeAdapter,
  cursorAdapter,
  lingmaAdapter,
  agentsRepoAdapter,
];

/**
 * 逐个探测，失败（返回 null 或抛错）的直接跳过。
 * 之所以吞掉异常：一个 adapter 的探测逻辑有 bug 不应该让整台机器的扫描失败。
 */
export async function detectAll(
  home: string,
  adapters: Adapter[] = registeredAdapters,
): Promise<DetectedAgent[]> {
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        const paths = await adapter.detect(home);
        return paths ? { adapter, paths } : null;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is DetectedAgent => r !== null);
}
