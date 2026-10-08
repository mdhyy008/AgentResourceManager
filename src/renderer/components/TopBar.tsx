import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import type { AgentId, ScannedAgent } from '../../core/types';
import { formatBeijing } from '../../shared/time';

function formatTime(ms: number | null): string {
  return ms === null ? '尚未扫描' : formatBeijing(ms);
}

interface TopBarProps {
  agents: ScannedAgent[];
  totalResources: number;
  scannedAt: number | null;
  durationMs: number | null;
  query: string;
  onQueryChange(value: string): void;
  onRefresh(): void;
  refreshing: boolean;
  onOpenCustomAgents(): void;
  customAgentCount: number;
  selectedAgent: AgentId | null;
  onSelectAgent(id: AgentId | null): void;
  onOpenOperations(): void;
  onOpenExport(): void;
}

export default function TopBar({
  agents,
  totalResources,
  scannedAt,
  durationMs,
  query,
  onQueryChange,
  onRefresh,
  refreshing,
  onOpenCustomAgents,
  customAgentCount,
  selectedAgent,
  onSelectAgent,
  onOpenOperations,
  onOpenExport,
}: TopBarProps) {
  return (
    <AppBar
      position="static"
      elevation={0}
      color="transparent"
      sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Toolbar sx={{ gap: 2, px: 3, minHeight: 68 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
            Agent 资源管理器
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {agents.length} 个 agent · {totalResources} 项资源 · 扫描于 {formatTime(scannedAt)}
            {durationMs !== null ? `（${durationMs}ms）` : ''}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <TextField
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索名称、路径、描述…"
          sx={{ width: 260, flexShrink: 0 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Button
          onClick={onOpenOperations}
          startIcon={<HistoryIcon />}
          variant="outlined"
          color="inherit"
          sx={{ flexShrink: 0 }}
        >
          操作记录
        </Button>

        <Button
          onClick={onOpenExport}
          startIcon={<DownloadIcon />}
          variant="outlined"
          color="inherit"
          sx={{ flexShrink: 0 }}
        >
          导出
        </Button>

        <Tooltip title="重新扫描" arrow>
          <span>
            <IconButton onClick={onRefresh} disabled={refreshing} color="primary">
              {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Toolbar>

      {/* 筛选栏：agent 芯片单独占一行，横着排，放不下就换行 */}
      <Stack
        direction="row"
        sx={{
          px: 3,
          py: 1.25,
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {agents.map((agent) => {
          const active = selectedAgent === agent.id;
          return (
            <Tooltip key={agent.id} title={active ? '点击取消筛选' : `${agent.name} · 点击筛选`} arrow>
              <Chip
                size="small"
                clickable
                label={`${agent.name} · ${agent.resourceCount}`}
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'primary' : 'default'}
                onClick={() => onSelectAgent(active ? null : agent.id)}
                sx={{ borderColor: active ? undefined : 'divider' }}
              />
            </Tooltip>
          );
        })}
        {customAgentCount > 0 && (
          <Chip size="small" label={`自定义 · ${customAgentCount}`} color="secondary" variant="outlined" />
        )}
        <Tooltip title="登记自定义 agent 路径" arrow>
          <IconButton size="small" onClick={onOpenCustomAgents} color="primary" sx={{ ml: 0.5 }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </AppBar>
  );
}
