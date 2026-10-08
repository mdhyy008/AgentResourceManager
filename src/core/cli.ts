import * as path from 'node:path';
import { readCache, writeCache } from './cache';
import { homeDir } from './fs-utils';
import { runScan } from './scan';
import type { ScanResult } from './types';

const DATA_DIR_NAME = '.agent-resource-manager';

function dataDir(): string {
  return path.join(homeDir(), DATA_DIR_NAME);
}

function printSummary(result: ScanResult): void {
  console.log(
    `扫描完成：${result.agents.length} 个 agent，` +
      `${result.resources.length} 项资源，` +
      `${result.issues.length} 项异常，耗时 ${result.durationMs}ms`,
  );
  console.log('');

  console.log('Agent：');
  for (const agent of result.agents) {
    console.log(`  ${agent.name.padEnd(14)} ${agent.resourceCount} 项资源`);
  }
  console.log('');

  const byType = new Map<string, number>();
  for (const r of result.resources) {
    byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
  }
  console.log('资源类型：');
  for (const [type, count] of byType) {
    console.log(`  ${type.padEnd(14)} ${count}`);
  }

  if (result.issues.length > 0) {
    console.log('');
    console.log('异常：');
    for (const issue of result.issues) {
      console.log(`  [${issue.kind}] ${issue.path}`);
      console.log(`      ${issue.message}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const useCache = args.includes('--cached');

  let result: ScanResult | null = null;

  if (useCache) {
    result = await readCache(dataDir());
    if (!result) {
      console.error('没有可用缓存，改为全量扫描');
    }
  }

  if (!result) {
    result = await runScan();
    if (!args.includes('--no-cache')) {
      await writeCache(dataDir(), result);
    }
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSummary(result);
  }
}

main().catch((err) => {
  console.error('扫描失败：', err);
  process.exit(1);
});
