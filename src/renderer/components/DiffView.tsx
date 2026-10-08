import { Box, Chip, Stack, Typography } from '@mui/material';
import { diffLines, diffStats } from '../lib/diff';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

const LINE_STYLE: Record<string, { bg: string; fg: string; sign: string }> = {
  add: { bg: 'rgba(142,217,168,0.10)', fg: '#B7E6C6', sign: '+' },
  remove: { bg: 'rgba(242,166,166,0.10)', fg: '#F0BDBD', sign: '-' },
  same: { bg: 'transparent', fg: '#9AA3B2', sign: ' ' },
};

export default function DiffView({
  before,
  after,
  collapsed = true,
}: {
  before: string;
  after: string;
  /** true 时折叠掉前后连续的相同行，只看改动附近 */
  collapsed?: boolean;
}) {
  const lines = diffLines(before, after);
  const stats = diffStats(lines);

  const shown = collapsed ? collapseContext(lines) : lines;

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <Chip size="small" label={`+${stats.added}`} color="success" variant="outlined" sx={{ height: 22 }} />
        <Chip size="small" label={`-${stats.removed}`} color="error" variant="outlined" sx={{ height: 22 }} />
        {collapsed && stats.unchanged > 8 && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            已折叠未改动的行
          </Typography>
        )}
      </Stack>

      <Box
        component="pre"
        className="arm-selectable"
        sx={{
          m: 0,
          maxHeight: 420,
          overflow: 'auto',
          fontFamily: MONO,
          fontSize: 12.5,
          lineHeight: 1.6,
          border: 1,
          borderColor: 'divider',
          borderRadius: '12px',
          py: 0.5,
        }}
      >
        {shown.map((line, i) => {
          if (line.type === 'gap') {
            return (
              <Box key={`gap-${i}`} sx={{ px: 1.5, color: 'text.secondary', opacity: 0.6 }}>
                ⋯
              </Box>
            );
          }
          const style = LINE_STYLE[line.type];
          return (
            <Box
              key={`${i}-${line.type}`}
              sx={{
                px: 1.5,
                bgcolor: style.bg,
                color: style.fg,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                display: 'flex',
                gap: 1,
              }}
            >
              <Box component="span" sx={{ opacity: 0.7, userSelect: 'none' }}>
                {style.sign}
              </Box>
              <Box component="span">{line.text === '' ? ' ' : line.text}</Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

type DisplayLine = ReturnType<typeof diffLines>[number] | { type: 'gap'; text: string };

/** 保留改动行及其上下各 2 行，其余连续相同行压成一个省略号 */
function collapseContext(lines: ReturnType<typeof diffLines>, context = 2): DisplayLine[] {
  const keep = new Set<number>();
  lines.forEach((line, i) => {
    if (line.type === 'same') return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k += 1) {
      keep.add(k);
    }
  });

  const out: DisplayLine[] = [];
  let skipping = false;
  lines.forEach((line, i) => {
    if (keep.has(i)) {
      out.push(line);
      skipping = false;
    } else if (!skipping) {
      out.push({ type: 'gap', text: '' });
      skipping = true;
    }
  });
  return out;
}
