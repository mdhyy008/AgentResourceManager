import type { AdapterPaths, AgentId } from '../types';

export interface Adapter {
  id: AgentId;
  /** 展示名，如 "Claude Code" */
  name: string;
  /** 探测该 agent 在本机的资源路径；不存在则返回 null */
  detect(home: string): Promise<AdapterPaths | null>;
}

export interface DetectedAgent {
  adapter: Adapter;
  paths: AdapterPaths;
}
