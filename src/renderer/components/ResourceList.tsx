import AddIcon from '@mui/icons-material/Add';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Resource, ResourceScope } from '../../core/types';
import type { BatchAction } from '../lib/batch';
import { projectLabel, TYPE_LABELS } from '../lib/filter';

const SCOPE_OPTIONS: Array<{ value: ResourceScope | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'user', label: '用户级' },
  { value: 'project', label: '项目级' },
];

interface ResourceListProps {
  resources: Resource[];
  selectedId: string | null;
  onSelect(id: string): void;
  loading: boolean;
  scope: ResourceScope | 'all';
  onScopeChange(scope: ResourceScope | 'all'): void;
  /** MCP 分类下提供「新增 server」入口；没有可写入的配置文件时传 undefined */
  onAddMcp?: () => void;

  // ---- 多选 / 批量 ----
  selectMode: boolean;
  onToggleSelectMode(): void;
  /** 选中项 id（只统计当前列表里可见的） */
  selectedIds: string[];
  onToggleSelect(id: string): void;
  onClearSelection(): void;
  onBatch(action: BatchAction): void;
}

function scopeLabel(r: Resource): string {
  return r.scope === 'project' ? '项目级' : '用户级';
}

export default function ResourceList({
  resources,
  selectedId,
  onSelect,
  loading,
  scope,
  onScopeChange,
  onAddMcp,
  selectMode,
  onToggleSelectMode,
  selectedIds,
  onToggleSelect,
  onClearSelection,
  onBatch,
}: ResourceListProps) {
  const selectedCount = selectedIds.length;

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', flexShrink: 0 }}>
          {resources.length} 项
        </Typography>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          {onAddMcp && (
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAddMcp}>
              新增 server
            </Button>
          )}
          <Tooltip title={selectMode ? '退出多选' : '多选'} arrow>
            <IconButton
              size="small"
              onClick={onToggleSelectMode}
              color={selectMode ? 'primary' : 'default'}
              aria-label={selectMode ? '退出多选' : '进入多选'}
              aria-pressed={selectMode}
              sx={{
                border: 1,
                borderColor: selectMode ? 'primary.main' : 'divider',
                borderRadius: '8px',
              }}
            >
              <ChecklistOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {SCOPE_OPTIONS.map((opt) => {
            const active = scope === opt.value;
            return (
              <Chip
                key={opt.value}
                size="small"
                clickable
                label={opt.label}
                variant={active ? 'filled' : 'outlined'}
                color={active ? 'primary' : 'default'}
                onClick={() => onScopeChange(opt.value)}
                sx={{ height: 26, px: 0.5, borderColor: active ? undefined : 'divider' }}
              />
            );
          })}
        </Stack>
      </Box>

      {selectMode && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            px: 3,
            py: 1,
            alignItems: 'center',
            bgcolor: 'rgba(168,199,250,0.10)',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, flexShrink: 0 }}>
            已选 {selectedCount} 项
          </Typography>
          <Button size="small" variant="outlined" disabled={selectedCount === 0} onClick={onClearSelection}>
            清除
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<ToggleOnOutlinedIcon />}
            disabled={selectedCount === 0}
            onClick={() => onBatch('enable')}
          >
            启用
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<ToggleOffOutlinedIcon />}
            disabled={selectedCount === 0}
            onClick={() => onBatch('disable')}
          >
            禁用
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ShareOutlinedIcon />}
            disabled={selectedCount === 0}
            onClick={() => onBatch('share')}
          >
            共享给其它 agent
          </Button>
          <Tooltip title="退出多选" arrow>
            <IconButton size="small" onClick={onToggleSelectMode} aria-label="退出多选">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {loading && resources.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={28} />
        </Box>
      ) : resources.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">这一类下没有匹配的资源</Typography>
        </Box>
      ) : (
        <List disablePadding sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
          {resources.map((r) => {
            const readOnly = r.type === 'skill' && r.readOnly;
            const checked = selectedIds.includes(r.id);
            return (
              <ListItemButton
                key={r.id}
                selected={selectMode ? checked : r.id === selectedId}
                onClick={() => (selectMode ? onToggleSelect(r.id) : onSelect(r.id))}
                sx={{
                  alignItems: 'flex-start',
                  opacity: readOnly ? 0.62 : 1,
                  '&.Mui-selected': { bgcolor: 'rgba(168,199,250,0.14)' },
                }}
              >
                {selectMode && (
                  <Checkbox
                    size="small"
                    checked={checked}
                    readOnly
                    tabIndex={-1}
                    disableRipple
                    sx={{ p: 0.5, mr: 1, pointerEvents: 'none' }}
                  />
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {r.name}
                    </Typography>
                    {projectLabel(r) && (
                      <Typography variant="caption" noWrap sx={{ color: 'text.secondary' }}>
                        {`（${projectLabel(r)}）`}
                      </Typography>
                    )}
                    {readOnly && <LockIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip size="small" label={TYPE_LABELS[r.type]} variant="outlined" sx={{ height: 20 }} />
                    <Chip size="small" label={scopeLabel(r)} variant="outlined" sx={{ height: 20 }} />
                    {readOnly && <Chip size="small" label="插件只读" color="secondary" variant="outlined" sx={{ height: 20 }} />}
                    {r.usedBy.slice(0, 3).map((a) => (
                      <Chip key={a} size="small" label={a} variant="outlined" sx={{ height: 20, opacity: 0.8 }} />
                    ))}
                    {r.usedBy.length > 3 && (
                      <Chip size="small" label={`+${r.usedBy.length - 3}`} variant="outlined" sx={{ height: 20 }} />
                    )}
                  </Stack>
                  {r.description && (
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
                      noWrap
                    >
                      {r.description}
                    </Typography>
                  )}
                </Box>
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
}
