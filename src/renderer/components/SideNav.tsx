import DescriptionIcon from '@mui/icons-material/Description';
import ExtensionIcon from '@mui/icons-material/Extension';
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Chip, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { TYPE_LABELS, type NavKey } from '../lib/filter';

const NAV_ORDER: NavKey[] = ['skill', 'mcp', 'memory', 'plugin', 'issues'];

function navIcon(key: NavKey) {
  switch (key) {
    case 'skill':
      return <DescriptionIcon fontSize="small" />;
    case 'mcp':
      return <StorageIcon fontSize="small" />;
    case 'memory':
      return <MemoryIcon fontSize="small" />;
    case 'plugin':
      return <ExtensionIcon fontSize="small" />;
    case 'issues':
      return <WarningAmberIcon fontSize="small" />;
  }
}

function navLabel(key: NavKey): string {
  return key === 'issues' ? '异常' : TYPE_LABELS[key];
}

interface SideNavProps {
  nav: NavKey;
  onNav(key: NavKey): void;
  counts: Record<Exclude<NavKey, 'issues'>, number>;
  issueCount: number;
}

export default function SideNav({ nav, onNav, counts, issueCount }: SideNavProps) {
  return (
    <Box
      component="nav"
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        py: 2,
        gap: 0.5,
      }}
    >
      <Typography variant="overline" sx={{ px: 3, color: 'text.secondary', letterSpacing: 1.2 }}>
        资源分类
      </Typography>
      <List disablePadding>
        {NAV_ORDER.map((key) => {
          const count = key === 'issues' ? issueCount : counts[key];
          const isIssue = key === 'issues';
          return (
            <ListItemButton
              key={key}
              selected={nav === key}
              onClick={() => onNav(key)}
              sx={{
                color: isIssue && count > 0 ? 'warning.main' : undefined,
                '&.Mui-selected': {
                  bgcolor: isIssue ? 'rgba(245,199,126,0.14)' : 'rgba(168,199,250,0.16)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>{navIcon(key)}</ListItemIcon>
              <ListItemText
                primary={navLabel(key)}
                slotProps={{ primary: { sx: { fontSize: 14, fontWeight: nav === key ? 600 : 400 } } }}
              />
              <Chip
                size="small"
                label={count}
                variant={nav === key ? 'filled' : 'outlined'}
                color={isIssue && count > 0 ? 'warning' : 'default'}
                sx={{ height: 22, minWidth: 30 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
