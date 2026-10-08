import type {
  AgentId,
  Resource,
  ResourceScope,
  ResourceType,
  ScanIssue,
  ScanIssueKind,
} from '../../core/types';

/** 侧边栏的分类键：四类资源 + 一个异常分类 */
export type NavKey = ResourceType | 'issues';

export const TYPE_LABELS: Record<ResourceType, string> = {
  skill: 'Skills',
  mcp: 'MCP',
  memory: '记忆',
  plugin: 'Plugins',
};

export const ISSUE_KIND_LABELS: Record<ScanIssueKind, string> = {
  'broken-symlink': '符号链接失效',
  unreadable: '无法读取',
  permission: '权限不足',
  'bad-frontmatter': 'frontmatter 解析失败',
  'bad-json': 'JSON 解析失败',
  'missing-manifest': '缺少 SKILL.md',
  unknown: '未知问题',
};

export interface FilterOptions {
  type?: ResourceType;
  query?: string;
  /** 不填等同于 all */
  scope?: ResourceScope | 'all';
  /** 只看该 agent 能看到的资源 */
  agent?: AgentId | null;
}

/** 把一条资源的可搜索字段拼成一个小写 haystack */
export function resourceHaystack(r: Resource): string {
  const parts: string[] = [
    r.name,
    r.type,
    TYPE_LABELS[r.type],
    r.description ?? '',
    r.path,
    r.projectPath ?? '',
    r.scope,
    ...r.usedBy,
    ...r.rawPaths,
  ];
  return parts.join('\n').toLowerCase();
}

export function matchesQuery(r: Resource, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return resourceHaystack(r).includes(needle);
}

export function filterResources(resources: Resource[], options: FilterOptions = {}): Resource[] {
  const { type, query = '', scope = 'all', agent = null } = options;
  return resources.filter((r) => {
    if (type && r.type !== type) return false;
    if (scope !== 'all' && r.scope !== scope) return false;
    if (agent && !r.usedBy.includes(agent)) return false;
    return matchesQuery(r, query);
  });
}

/**
 * 项目级资源所属项目的目录名，用于在标题旁边标注它来自哪个项目。
 * 用户级资源没有 projectPath，返回 null。
 */
export function projectLabel(r: Resource): string | null {
  if (r.scope !== 'project' || !r.projectPath) return null;
  return r.projectPath.split(/[\\/]/).filter(Boolean).pop() ?? null;
}

export function countByType(resources: Resource[]): Record<ResourceType, number> {
  const counts: Record<ResourceType, number> = { skill: 0, mcp: 0, memory: 0, plugin: 0 };
  for (const r of resources) counts[r.type] += 1;
  return counts;
}

export function countIssuesByKind(issues: ScanIssue[]): Record<ScanIssueKind, number> {
  const counts = {} as Record<ScanIssueKind, number>;
  for (const issue of issues) {
    counts[issue.kind] = (counts[issue.kind] ?? 0) + 1;
  }
  return counts;
}

export function groupIssuesByKind(issues: ScanIssue[]): Array<[ScanIssueKind, ScanIssue[]]> {
  const buckets = new Map<ScanIssueKind, ScanIssue[]>();
  for (const issue of issues) {
    const list = buckets.get(issue.kind);
    if (list) list.push(issue);
    else buckets.set(issue.kind, [issue]);
  }
  return [...buckets.entries()];
}

/** 资源在列表里的默认排序：先按名称，再按类型，最后按 id 保证稳定 */
export function sortResources(resources: Resource[]): Resource[] {
  return [...resources].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, 'zh-Hans-CN');
    if (byName !== 0) return byName;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.id.localeCompare(b.id);
  });
}
