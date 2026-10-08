import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResourceScope } from '../core/types';
import type { AppConfig, ScanState } from '../shared/ipc';
import CustomAgentDialog from './components/CustomAgentDialog';
import DetailPanel from './components/DetailPanel';
import IssueView from './components/IssueView';
import ResourceList from './components/ResourceList';
import SideNav from './components/SideNav';
import TopBar from './components/TopBar';
import { countByType, filterResources, sortResources, type NavKey } from './lib/filter';

const EMPTY_SCAN: ScanState = { status: 'idle', result: null, fromCache: false };
const EMPTY_CONFIG: AppConfig = { customAgents: [] };

export default function App() {
  const [scan, setScan] = useState<ScanState>(EMPTY_SCAN);
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [nav, setNav] = useState<NavKey>('skill');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ResourceScope | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
  const visible = useMemo(
    () =>
      sortResources(
        filterResources(resources, {
          type: nav === 'issues' ? undefined : nav,
          query,
          scope,
        }),
      ),
    [resources, nav, query, scope],
  );
  const selected = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId],
  );

  const handleNav = (key: NavKey) => {
    setNav(key);
    setSelectedId(null);
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
            />
            <DetailPanel resource={selected} />
          </>
        )}
      </Box>

      <CustomAgentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />
    </Box>
  );
}
