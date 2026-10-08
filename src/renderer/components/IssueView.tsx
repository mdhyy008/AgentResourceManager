import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ScanIssue } from '../../core/types';
import { groupIssuesByKind, ISSUE_KIND_LABELS, matchesQuery } from '../lib/filter';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

interface IssueViewProps {
  issues: ScanIssue[];
  query: string;
}

export default function IssueView({ issues, query }: IssueViewProps) {
  const needle = query.trim().toLowerCase();
  const visible = issues.filter((i) => {
    if (!needle) return true;
    return `${i.kind} ${ISSUE_KIND_LABELS[i.kind]} ${i.path} ${i.message} ${i.agent ?? ''}`
      .toLowerCase()
      .includes(needle);
  });

  if (issues.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <Stack sx={{ alignItems: 'center', gap: 1, color: 'text.secondary' }}>
          <CheckCircleOutlinedIcon sx={{ fontSize: 36, color: 'success.main' }} />
          <Typography variant="body2">没有发现异常</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', px: 3, py: 2 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        共 {issues.length} 项异常，按类型分组。异常不会被隐藏，也不影响其余资源的展示。
      </Typography>
      {groupIssuesByKind(visible).map(([kind, list]) => (
        <Box key={kind} sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">{ISSUE_KIND_LABELS[kind]}</Typography>
            <Chip size="small" label={list.length} variant="outlined" sx={{ height: 20 }} />
          </Stack>
          <Stack spacing={1}>
            {list.map((issue) => (
              <Box
                key={`${issue.kind}:${issue.path}`}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '12px',
                  px: 2,
                  py: 1.25,
                  bgcolor: 'background.paper',
                }}
              >
                <Typography
                  className="arm-selectable"
                  sx={{ fontFamily: MONO, fontSize: 12.5, wordBreak: 'break-all' }}
                >
                  {issue.path}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  {issue.message}
                </Typography>
                {issue.agent && (
                  <Chip size="small" label={`来自 ${issue.agent}`} variant="outlined" sx={{ mt: 0.75, height: 20 }} />
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
      {visible.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          没有匹配当前搜索的异常。
        </Typography>
      )}
    </Box>
  );
}
