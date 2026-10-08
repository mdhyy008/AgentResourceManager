import { Alert, Box, Button, CircularProgress, Snackbar, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AgentId,
  McpResource,
  MemoryResource,
  ResourceScope,
  SkillResource,
} from '../core/types';
import type { AppConfig, ScanState, WriteRequest } from '../shared/ipc';
import BatchConfirmDialog from './components/BatchConfirmDialog';
import BatchResultDialog from './components/BatchResultDialog';
import CustomAgentDialog from './components/CustomAgentDialog';
import DetailPanel, { type ResourceActions } from './components/DetailPanel';
import EditDialog, { type EditTarget } from './components/EditDialog';
import ExportDialog from './components/ExportDialog';
import IssueView from './components/IssueView';
import McpTargetPickerDialog, { type McpCandidate } from './components/McpTargetPickerDialog';
import OperationLogDialog from './components/OperationLogDialog';
import ResourceList from './components/ResourceList';
import SideNav from './components/SideNav';
import SkillShareDialog, { type ShareTarget } from './components/SkillShareDialog';
import TopBar from './components/TopBar';
import WriteConfirmDialog from './components/WriteConfirmDialog';
import { countByType, filterResources, sortResources, type NavKey } from './lib/filter';
import {
  planShareBatch,
  planToggleBatch,
  runBatch,
  type BatchAction,
  type BatchPlan,
  type BatchSummary,
} from './lib/batch';
import { expectOf, removeMcpServer, toggleSkill } from './lib/write';

const EMPTY_SCAN: ScanState = { status: 'idle', result: null, fromCache: false };
const EMPTY_CONFIG: AppConfig = { customAgents: [] };

export default function App() {
  const [scan, setScan] = useState<ScanState>(EMPTY_SCAN);
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [nav, setNav] = useState<NavKey>('skill');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ResourceScope | 'all'>('all');
  const [agent, setAgent] = useState<AgentId | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [pending, setPending] = useState<WriteRequest | null>(null);
  const [opsOpen, setOpsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  /** 要共享的 skill；空数组表示对话框关闭。批量共享时会有多个 */
  const [shareSkills, setShareSkills] = useState<SkillResource[]>([]);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  // ---- 多选 / 批量 ----
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchConfirm, setBatchConfirm] = useState<{ title: string; plan: BatchPlan } | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const next = await window.arm.runScan();
    setScan(next);
    setRefreshing(false);
  }, []);

  // 启动流程：先取磁盘缓存秒显，再异步跑一次全量扫描覆盖它
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [cached, cfg] = await Promise.all([
        window.arm.getCachedScan(),
        window.arm.getConfig(),
      ]);
      if (!alive) return;
      setConfig(cfg);
      if (cached.result) setScan(cached);
      setRefreshing(true);
      const fresh = await window.arm.runScan();
      if (!alive) return;
      setScan(fresh);
      setRefreshing(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const result = scan.result;
  const resources = useMemo(() => result?.resources ?? [], [result]);
  const issues = useMemo(() => result?.issues ?? [], [result]);
  const counts = useMemo(() => countByType(resources), [resources]);

  // 重扫后选中的 agent 可能已经不存在了，此时自动退回「不筛选」
  const activeAgent = useMemo(
    () => (agent && result?.agents.some((a) => a.id === agent) ? agent : null),
    [agent, result],
  );

  const visible = useMemo(
    () =>
      sortResources(
        filterResources(resources, {
          type: nav === 'issues' ? undefined : nav,
          query,
          scope,
          agent: activeAgent,
        }),
      ),
    [resources, nav, query, scope, activeAgent],
  );
  const selected = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId],
  );

  const handleNav = (key: NavKey) => {
    setNav(key);
    setSelectedId(null);
    // 换分类后原来勾中的项多半不在眼前了，直接清掉避免误解
    setSelectedIds([]);
  };

  // 本机可能装了多个会读 MCP 配置的 agent，先把候选文件收集起来
  const mcpCandidates = useMemo<McpCandidate[]>(() => {
    const out: McpCandidate[] = [];
    for (const a of result?.agents ?? []) {
      for (const file of a.paths.mcpFiles ?? []) {
        if (!out.some((c) => c.path === file)) out.push({ path: file, label: a.name });
      }
    }
    return out;
  }, [result]);

  // 可共享的目标：有 skills 目录、还没在用这些 skill、且目标位置没被同名的别家 skill 占着。
  // 「已经在用」用 usedBy 判断就够了——skill 落在谁的目录里，谁就会出现在 usedBy 里。
  // 批量时要求目标对所有选中的 skill 都成立，否则一提交就会有一半失败。
  const shareTargets = useMemo<ShareTarget[]>(() => {
    if (shareSkills.length === 0 || !result) return [];
    const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    // 已有的 skill 落盘路径；目标目录下若已有一个同名（但没被去重合并）的 skill，
    // 共享过去必然撞名，直接不列出来。
    const taken = new Set(
      result.resources.filter((r) => r.type === 'skill').map((r) => norm(r.path)),
    );
    const names = shareSkills.map(
      (s) => s.path.split(/[\\/]/).filter(Boolean).pop()?.toLowerCase() ?? '',
    );

    const out: ShareTarget[] = [];
    for (const a of result.agents) {
      const dir = a.paths.skills;
      if (!dir) continue;
      if (shareSkills.some((s) => s.usedBy.includes(a.id))) continue;
      if (names.some((n) => taken.has(`${norm(dir)}/${n}`))) continue;
      out.push({ id: a.id, name: a.name, skillsDir: dir });
    }
    return out;
  }, [shareSkills, result]);

  // 多选只统计当前筛选后仍可见的项：被筛掉的选中项不该跟着一起被批量改动
  const selectedVisible = useMemo(() => {
    const set = new Set(selectedIds);
    return visible.filter((r) => set.has(r.id));
  }, [selectedIds, visible]);

  const afterWrite = useCallback(
    (message: string) => {
      setToast({ ok: true, message });
      // 写入会改变内容哈希，必须重扫，否则下一次写入会被判成冲突
      void refresh();
    },
    [refresh],
  );

  // ---- 多选 / 批量 ----

  const toggleSelectMode = () => {
    setSelectMode((on) => !on);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const runBatchPlan = async (plan: BatchPlan) => {
    setBatchRunning(true);
    const summary = await runBatch(plan, (request) => window.arm.applyWrite(request));
    setBatchRunning(false);
    setBatchConfirm(null);
    setBatchSummary(summary);
    // 批量写完全部落盘了，退出多选并重扫（内容哈希已变）
    setSelectMode(false);
    setSelectedIds([]);
    void refresh();
  };

  const handleBatch = (action: BatchAction) => {
    const picked = selectedVisible;
    if (picked.length === 0) return;

    if (action === 'share') {
      const skills = picked.filter((r): r is SkillResource => r.type === 'skill');
      if (skills.length === 0) {
        setToast({ ok: false, message: '选中的项里没有 skill，无法共享' });
        return;
      }
      setShareSkills(skills);
      return;
    }

    setBatchConfirm({
      title: action === 'enable' ? '批量启用' : '批量禁用',
      plan: planToggleBatch(picked, action === 'enable'),
    });
  };

  const handleShareSubmit = (target: ShareTarget, mode: 'link' | 'copy') => {
    const skills = shareSkills;
    setShareSkills([]);

    // 单个共享沿用「先看 diff 再写入」的流程，改动看得最清楚
    if (skills.length === 1) {
      setPending({
        kind: 'skill-share',
        sourceDir: skills[0].path,
        targetSkillsDir: target.skillsDir,
        mode,
      });
      return;
    }

    setBatchConfirm({
      title: `共享给 ${target.name}（${mode === 'link' ? '目录联接' : '复制'}）`,
      plan: planShareBatch(skills, target.skillsDir, mode),
    });
  };

  const actions: ResourceActions = {
    onToggleSkill: (r: SkillResource, enabled: boolean) => setPending(toggleSkill(r, enabled)),
    onEditFrontmatter: (r: SkillResource) => setEditTarget({ mode: 'skill-frontmatter', resource: r }),
    onShareSkill: (r: SkillResource) => setShareSkills([r]),
    onEditMemory: (r: MemoryResource) => setEditTarget({ mode: 'memory-body', resource: r }),
    onAddServer: (r: McpResource) =>
      setEditTarget({
        mode: 'mcp-add',
        target: {
          configPath: r.configPath,
          configPointer: r.configPointer,
          expect: expectOf(r),
          label: r.name,
        },
      }),
    onRemoveServer: (r: McpResource, serverName: string) =>
      setPending(removeMcpServer(r, serverName)),
    onReveal: (target: string) => {
      void window.arm.revealPath(target).then((res) => {
        if (!res.ok) setToast({ ok: false, message: res.message ?? '定位失败' });
      });
    },
  };

  const startAddMcp = () => {
    if (mcpCandidates.length === 0) {
      setToast({ ok: false, message: '没有探测到可写入的 MCP 配置文件，请先登记自定义 agent' });
      return;
    }
    if (mcpCandidates.length === 1) openMcpAddForm(mcpCandidates[0]);
    else setPickerOpen(true);
  };

  const openMcpAddForm = (candidate: McpCandidate) => {
    setPickerOpen(false);
    setEditTarget({
      mode: 'mcp-add',
      target: {
        configPath: candidate.path,
        // mcpServers 尚未存在，写入时会顺带建出来
        configPointer: ['mcpServers'],
        expect: null,
        label: candidate.label,
      },
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <TopBar
        agents={result?.agents ?? []}
        totalResources={resources.length}
        scannedAt={result?.scannedAt ?? null}
        durationMs={result?.durationMs ?? null}
        query={query}
        onQueryChange={setQuery}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        onOpenCustomAgents={() => setDialogOpen(true)}
        customAgentCount={config.customAgents.length}
        selectedAgent={activeAgent}
        onSelectAgent={setAgent}
        onOpenOperations={() => setOpsOpen(true)}
        onOpenExport={() => setExportOpen(true)}
      />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav nav={nav} onNav={handleNav} counts={counts} issueCount={issues.length} />

        {scan.status === 'error' ? (
          <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 4 }}>
            <Stack sx={{ alignItems: 'center', gap: 1.5, maxWidth: 520, textAlign: 'center' }}>
              <Typography variant="h6" color="error">
                扫描失败
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {scan.error ?? '未知错误'}
              </Typography>
              <Button variant="outlined" onClick={() => void refresh()}>
                重试
              </Button>
            </Stack>
          </Box>
        ) : result === null ? (
          <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <Stack sx={{ alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={30} />
              <Typography variant="body2" color="text.secondary">
                正在扫描本机 agent 资源…
              </Typography>
            </Stack>
          </Box>
        ) : nav === 'issues' ? (
          <IssueView issues={issues} query={query} />
        ) : (
          <>
            <ResourceList
              resources={visible}
              selectedId={selectedId}
              onSelect={setSelectedId}
              loading={refreshing}
              scope={scope}
              onScopeChange={setScope}
              onAddMcp={nav === 'mcp' ? startAddMcp : undefined}
              selectMode={selectMode}
              onToggleSelectMode={toggleSelectMode}
              selectedIds={selectedVisible.map((r) => r.id)}
              onToggleSelect={toggleSelect}
              onClearSelection={() => setSelectedIds([])}
              onBatch={handleBatch}
            />
            <DetailPanel resource={selected} actions={actions} />
          </>
        )}
      </Box>

      <CustomAgentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />

      <EditDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={(request) => {
          setEditTarget(null);
          setPending(request);
        }}
      />

      <SkillShareDialog
        skills={shareSkills}
        targets={shareTargets}
        onClose={() => setShareSkills([])}
        onSubmit={handleShareSubmit}
      />

      <WriteConfirmDialog
        request={pending}
        onClose={() => setPending(null)}
        onApplied={afterWrite}
      />

      <BatchConfirmDialog
        title={batchConfirm?.title ?? ''}
        open={batchConfirm !== null}
        plan={batchConfirm?.plan ?? null}
        running={batchRunning}
        onCancel={() => setBatchConfirm(null)}
        onConfirm={() => {
          if (batchConfirm) void runBatchPlan(batchConfirm.plan);
        }}
      />

      <BatchResultDialog summary={batchSummary} onClose={() => setBatchSummary(null)} />

      <McpTargetPickerDialog
        open={pickerOpen}
        candidates={mcpCandidates}
        onPick={openMcpAddForm}
        onClose={() => setPickerOpen(false)}
      />

      <OperationLogDialog
        open={opsOpen}
        onClose={() => setOpsOpen(false)}
        onUndone={(message) => {
          setToast({ ok: true, message });
          void refresh();
        }}
      />

      <ExportDialog
        open={exportOpen}
        result={result}
        counts={counts}
        onClose={() => setExportOpen(false)}
        onExported={(ok, message) => setToast({ ok, message })}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast?.ok ? 'success' : 'warning'}
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ borderRadius: '12px' }}
        >
          {toast?.message ?? ''}
        </Alert>
      </Snackbar>
    </Box>
  );
}
