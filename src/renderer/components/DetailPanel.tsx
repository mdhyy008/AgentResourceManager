import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ShareIcon from '@mui/icons-material/Share';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import type {
  McpResource,
  McpServerEntry,
  MemoryResource,
  PluginResource,
  Resource,
  SkillResource,
} from '../../core/types';
import { projectLabel, TYPE_LABELS } from '../lib/filter';

const MONO = '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace';

/** 详情面板里能触发的编辑动作，由 App 接上写入流程 */
export interface ResourceActions {
  onToggleSkill(resource: SkillResource, enabled: boolean): void;
  onEditFrontmatter(resource: SkillResource): void;
  onShareSkill(resource: SkillResource): void;
  onEditMemory(resource: MemoryResource): void;
  onAddServer(resource: McpResource): void;
  onRemoveServer(resource: McpResource, serverName: string): void;
  onReveal(path: string): void;
}

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
      className="arm-selectable"
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
    <Stack divider={<Divider flexItem />} sx={{ border: 1, borderColor: 'divider', borderRadius: '12px' }}>
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
      className="arm-selectable"
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
        borderRadius: '12px',
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

function McpServerCard({
  server,
  index,
  onRemove,
}: {
  server: McpServerEntry;
  index: number;
  onRemove(): void;
}) {
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
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
          {server.name}
        </Typography>
        <Tooltip title="删除该 server" arrow>
          <IconButton size="small" onClick={onRemove} aria-label={`删除 ${server.name}`}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <KeyValue entries={entries} />
    </Box>
  );
}

function SkillDetail({ r, actions }: { r: SkillResource; actions: ResourceActions }) {
  const disabled = r.frontmatter['disable-model-invocation'] === true;
  return (
    <>
      {r.readOnly && (
        <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
          该 skill 随插件安装，插件升级会覆盖，因此在只读状态下不提供编辑。
          {r.pluginId ? ` 来源插件：${r.pluginId}` : ''}
        </Alert>
      )}
      <Section title="启用状态">
        <FormControlLabel
          control={
            <Switch
              checked={!disabled}
              disabled={r.readOnly}
              onChange={(e) => actions.onToggleSkill(r, e.target.checked)}
            />
          }
          label={disabled ? '已禁用' : '已启用'}
        />
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {r.readOnly
            ? '只读，无法更改'
            : disabled
              ? 'frontmatter 里有 disable-model-invocation，模型不会自动调用它'
              : '开启后会从 frontmatter 里移除 disable-model-invocation'}
        </Typography>
      </Section>
      <Section title="Frontmatter">
        <KeyValue entries={renderFrontmatter(r.frontmatter)} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditIcon />}
          disabled={r.readOnly}
          onClick={() => actions.onEditFrontmatter(r)}
          sx={{ mt: 1.25 }}
        >
          编辑 frontmatter
        </Button>
      </Section>
      <Section title="正文">
        <CodeBlock text={r.body} />
      </Section>
      <Section title="共享">
        <Button
          size="small"
          variant="outlined"
          startIcon={<ShareIcon />}
          disabled={r.readOnly}
          onClick={() => actions.onShareSkill(r)}
        >
          共享给其它 agent
        </Button>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.75 }}>
          {r.readOnly
            ? '只读的插件 skill 不提供共享'
            : '把它放进另一个 agent 的 skills 目录，可选目录联接（同步）或复制（独立）'}
        </Typography>
      </Section>
    </>
  );
}

function McpDetail({ r, actions }: { r: McpResource; actions: ResourceActions }) {
  return (
    <>
      <Alert severity="warning" sx={{ mt: 2, borderRadius: '12px' }}>
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
          r.servers.map((s, i) => (
            <McpServerCard
              key={`${s.name}-${i}`}
              server={s}
              index={i}
              onRemove={() => actions.onRemoveServer(r, s.name)}
            />
          ))
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => actions.onAddServer(r)}
          sx={{ mt: 0.5 }}
        >
          新增 server
        </Button>
      </Section>
    </>
  );
}

function MemoryDetail({ r, actions }: { r: MemoryResource; actions: ResourceActions }) {
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
        <Button
          size="small"
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => actions.onEditMemory(r)}
          sx={{ mt: 1.25 }}
        >
          编辑正文
        </Button>
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
      <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
        插件自带的所有 skill 均为只读，会随插件更新被覆盖。
      </Alert>
      <Section title="插件信息">
        <KeyValue entries={entries} />
      </Section>
    </>
  );
}

function Body({ r, actions }: { r: Resource; actions: ResourceActions }) {
  switch (r.type) {
    case 'skill':
      return <SkillDetail r={r} actions={actions} />;
    case 'mcp':
      return <McpDetail r={r} actions={actions} />;
    case 'memory':
      return <MemoryDetail r={r} actions={actions} />;
    case 'plugin':
      return <PluginDetail r={r} />;
  }
}

export default function DetailPanel({
  resource,
  actions,
}: {
  resource: Resource | null;
  actions: ResourceActions;
}) {
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
            {projectLabel(resource) && (
              <Box
                component="span"
                sx={{ color: 'text.secondary', fontWeight: 400, fontSize: '0.82em' }}
              >
                {`（${projectLabel(resource)}）`}
              </Box>
            )}
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
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Mono>{resource.path}</Mono>
              </Box>
              <Tooltip title="在文件管理器中定位" arrow>
                <IconButton
                  size="small"
                  onClick={() => actions.onReveal(resource.path)}
                  aria-label="定位文件"
                >
                  <FolderOpenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
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

          <Body r={resource} actions={actions} />
        </Box>
      )}
    </Box>
  );
}
