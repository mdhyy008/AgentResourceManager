import type { Resource } from './types';

/**
 * 按 id 合并资源。
 *
 * 为什么以 id 为准而不是路径：id 已经是 `type:canonicalPath小写`，
 * 所以指向同一个真实文件的符号链接会天然产生相同 id，不需要额外比较路径。
 *
 * 冲突时以「先出现的实体」为主，但 project scope 会覆盖 user scope——
 * 因为同一个文件如果被项目级和用户级同时引用，项目归属是更有用的信息。
 */
export function mergeResources<T extends Resource>(resources: T[]): T[] {
  const byId = new Map<string, T>();

  for (const resource of resources) {
    const existing = byId.get(resource.id);
    if (!existing) {
      byId.set(resource.id, {
        ...resource,
        usedBy: unique(resource.usedBy),
        rawPaths: unique(resource.rawPaths),
      });
      continue;
    }

    const merged: T = {
      ...existing,
      usedBy: unique([...existing.usedBy, ...resource.usedBy]),
      rawPaths: unique([...existing.rawPaths, ...resource.rawPaths]),
    };

    if (existing.scope === 'user' && resource.scope === 'project') {
      merged.scope = 'project';
      merged.projectPath = resource.projectPath;
    }

    byId.set(resource.id, merged);
  }

  return [...byId.values()];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
