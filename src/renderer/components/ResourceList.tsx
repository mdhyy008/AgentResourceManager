import LockIcon from '@mui/icons-material/Lock';
import { Box, Chip, CircularProgress, List, ListItemButton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { Resource, ResourceScope } from '../../core/types';
import { TYPE_LABELS } from '../lib/filter';

interface ResourceListProps {
  resources: Resource[];
  selectedId: string | null;
  onSelect(id: string): void;
  loading: boolean;
  scope: ResourceScope | 'all';
  onScopeChange(scope: ResourceScope | 'all'): void;
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
}: ResourceListProps) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          {resources.length} 项
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={scope}
          onChange={(_e, value: ResourceScope | 'all' | null) => {
            if (value !== null) onScopeChange(value);
          }}
          sx={{ '& .MuiToggleButton-root': { borderRadius: 999, px: 1.5, py: 0.25, textTransform: 'none' } }}
        >
          <ToggleButton value="all">全部</ToggleButton>
          <ToggleButton value="user">用户级</ToggleButton>
          <ToggleButton value="project">项目级</ToggleButton>
        </ToggleButtonGroup>
      </Box>

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
            return (
              <ListItemButton
                key={r.id}
                selected={r.id === selectedId}
                onClick={() => onSelect(r.id)}
                sx={{
                  alignItems: 'flex-start',
                  opacity: readOnly ? 0.62 : 1,
                  '&.Mui-selected': { bgcolor: 'rgba(168,199,250,0.14)' },
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {r.name}
                    </Typography>
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
