import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ScannedAgent } from '../../core/types';

function formatTime(ms: number | null): string {
  if (ms === null) return '尚未扫描';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
}: TopBarProps) {
  return (
    <AppBar
      position="static"
      elevation={0}
      color="transparent"
      sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Toolbar sx={{ gap: 2, px: 3, minHeight: 72 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
            Agent 资源管理器
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {agents.length} 个 agent · {totalResources} 项资源 · 扫描于 {formatTime(scannedAt)}
            {durationMs !== null ? `（${durationMs}ms）` : ''}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {agents.map((agent) => (
            <Tooltip key={agent.id} title={agent.name} arrow>
              <Chip
                size="small"
                label={`${agent.name} · ${agent.resourceCount}`}
                variant="outlined"
                sx={{ borderColor: 'divider' }}
              />
            </Tooltip>
          ))}
          {customAgentCount > 0 && (
            <Chip size="small" label={`自定义 · ${customAgentCount}`} color="secondary" variant="outlined" />
          )}
        </Box>

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
          onClick={onOpenCustomAgents}
          startIcon={<TuneIcon />}
          variant="outlined"
          color="inherit"
          sx={{ flexShrink: 0 }}
        >
          自定义路径
        </Button>

        <Tooltip title="重新扫描" arrow>
          <span>
            <IconButton onClick={onRefresh} disabled={refreshing} color="primary">
              {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
