import { Alert, Box, Chip, Divider, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type {
  McpResource,
  McpServerEntry,
  MemoryResource,
  PluginResource,
  Resource,
  SkillResource,
} from '../../core/types';
import { TYPE_LABELS } from '../lib/filter';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
        {title}
      </Typography>
      <Box sx={{ mt: 0.75 }}>{children}</Box>
    </Box>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{ fontFamily: MONO, fontSize: 12.5, wordBreak: 'break-all', lineHeight: 1.65 }}
    >
      {children}
    </Typography>
  );
}

function KeyValue({ entries }: { entries: Array<[string, ReactNode]> }) {
  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        无
      </Typography>
    );
  }
  return (
    <Stack divider={<Divider flexItem />} sx={{ border: 1, borderColor: 'divider', borderRadius: 3 }}>
      {entries.map(([k, v]) => (
        <Box key={k} sx={{ px: 1.5, py: 1, display: 'flex', gap: 2 }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 12.5, color: 'text.secondary', minWidth: 96 }}>
            {k}
          </Typography>
          <Box sx={{ minWidth: 0, flex: 1 }}>{v}</Box>
        </Box>
      ))}
    </Stack>
  );
}

function CodeBlock({ text }: { text: string }) {
  if (!text.trim()) {
    return (
      <Typography variant="body2" color="text.secondary">
        （正文为空）
      </Typography>
    );
  }
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        maxHeight: 420,
        overflow: 'auto',
        fontFamily: MONO,
        fontSize: 12.5,
        lineHeight: 1.7,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
      }}
    >
      {text}
    </Box>
  );
}

function renderFrontmatter(fm: Record<string, unknown>): Array<[string, ReactNode]> {
  return Object.entries(fm).map(([k, v]) => {
    let rendered: ReactNode;
    if (v === null || v === undefined) rendered = <Mono>—</Mono>;
    else if (typeof v === 'object') rendered = <Mono>{JSON.stringify(v)}</Mono>;
    else rendered = <Mono>{String(v)}</Mono>;
    return [k, rendered] as [string, ReactNode];
  });
}

function McpServerCard({ server, index }: { server: McpServerEntry; index: number }) {
  const entries: Array<[string, ReactNode]> = [['传输方式', <Mono key="t">{server.transport}</Mono>]];
  if (server.command) entries.push(['命令', <Mono key="c">{server.command}</Mono>]);
  if (server.args?.length) entries.push(['参数', <Mono key="a">{server.args.join(' ')}</Mono>]);
  if (server.url) entries.push(['URL', <Mono key="u">{server.url}</Mono>]);
  for (const [k, v] of Object.entries(server.env ?? {})) entries.push([`env.${k}`, <Mono key={`e${k}`}>{v}</Mono>]);
  for (const [k, v] of Object.entries(server.headers ?? {})) entries.push([`header.${k}`, <Mono key={`h${k}`}>{v}</Mono>]);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
        <Chip size="small" label={`#${index + 1}`} variant="outlined" />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {server.name}
        </Typography>
      </Stack>
      <KeyValue entries={entries} />
    </Box>
  );
}

function SkillDetail({ r }: { r: SkillResource }) {
  return (
    <>
      {r.readOnly && (
        <Alert severity="info" sx={{ mt: 2, borderRadius: 3 }}>
          该 skill 随插件安装，插件升级会覆盖，因此在只读状态下不提供编辑。
          {r.pluginId ? ` 来源插件：${r.pluginId}` : ''}
        </Alert>
      )}
      <Section title="Frontmatter">
        <KeyValue entries={renderFrontmatter(r.frontmatter)} />
      </Section>
      <Section title="正文">
        <CodeBlock text={r.body} />
      </Section>
    </>
  );
}

function McpDetail({ r }: { r: McpResource }) {
  return (
    <>
      <Alert severity="warning" sx={{ mt: 2, borderRadius: 3 }}>
        下方按原值展示命令、环境变量与请求头，未做脱敏。
      </Alert>
      <Section title="配置文件">
        <Mono>{r.configPath}</Mono>
        <Box sx={{ mt: 0.5 }}>
          <Mono>指针：{r.configPointer.join('.') || '(根)'}</Mono>
        </Box>
      </Section>
      <Section title={`服务（${r.servers.length}）`}>
        {r.servers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            无
          </Typography>
        ) : (
          r.servers.map((s, i) => <McpServerCard key={`${s.name}-${i}`} server={s} index={i} />)
        )}
      </Section>
    </>
  );
}

function MemoryDetail({ r }: { r: MemoryResource }) {
  return (
    <>
      <Section title="类型">
        <Chip size="small" label={r.kind === 'index' ? '索引（MEMORY.md）' : '笔记'} variant="outlined" />
      </Section>
      {r.indexEntries && r.indexEntries.length > 0 && (
        <Section title={`索引条目（${r.indexEntries.length}）`}>
          <KeyValue
            entries={r.indexEntries.map((e) => [
              e.title,
              <Box key={e.file}>
                <Mono>{e.file}</Mono>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {e.summary}
                </Typography>
              </Box>,
            ])}
          />
        </Section>
      )}
      <Section title="正文">
        <CodeBlock text={r.body} />
      </Section>
    </>
  );
}

function PluginDetail({ r }: { r: PluginResource }) {
  const entries: Array<[string, ReactNode]> = [
    ['插件 id', <Mono key="id">{r.pluginId}</Mono>],
    ['版本', <Mono key="v">{r.version}</Mono>],
    ['市场', <Mono key="m">{r.marketplace}</Mono>],
  ];
  if (r.gitCommitSha) entries.push(['git commit', <Mono key="g">{r.gitCommitSha}</Mono>]);
  entries.push(['安装位置', <Mono key="p">{r.installPath}</Mono>]);

  return (
    <>
      <Alert severity="info" sx={{ mt: 2, borderRadius: 3 }}>
        插件自带的所有 skill 均为只读，会随插件更新被覆盖。
      </Alert>
      <Section title="插件信息">
        <KeyValue entries={entries} />
      </Section>
    </>
  );
}

function Body({ r }: { r: Resource }) {
  switch (r.type) {
    case 'skill':
      return <SkillDetail r={r} />;
    case 'mcp':
      return <McpDetail r={r} />;
    case 'memory':
      return <MemoryDetail r={r} />;
    case 'plugin':
      return <PluginDetail r={r} />;
  }
}

export default function DetailPanel({ resource }: { resource: Resource | null }) {
  return (
    <Box
      sx={{
        width: 460,
        flexShrink: 0,
        borderLeft: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {!resource ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 4 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            从左侧列表中选中一项资源，这里会展示它的完整配置与内容。
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" label={TYPE_LABELS[resource.type]} color="primary" variant="outlined" />
            <Chip size="small" label={resource.scope === 'project' ? '项目级' : '用户级'} variant="outlined" />
          </Stack>
          <Typography variant="h6" sx={{ mt: 1.25 }}>
            {resource.name}
          </Typography>
          {resource.description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {resource.description}
            </Typography>
          )}

          <Section title="被哪些 agent 使用">
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {resource.usedBy.map((a) => (
                <Chip key={a} size="small" label={a} variant="outlined" />
              ))}
            </Stack>
          </Section>

          <Section title="落盘路径">
            <Mono>{resource.path}</Mono>
            {resource.rawPaths.filter((p) => p !== resource.path).length > 0 && (
              <Box sx={{ mt: 0.75 }}>
                {resource.rawPaths
                  .filter((p) => p !== resource.path)
                  .map((p) => (
                    <Mono key={p}>{`→ ${p}`}</Mono>
                  ))}
              </Box>
            )}
            {resource.projectPath && (
              <Box sx={{ mt: 0.75 }}>
                <Mono>{`项目：${resource.projectPath}`}</Mono>
              </Box>
            )}
          </Section>

          <Body r={resource} />
        </Box>
      )}
    </Box>
  );
}
