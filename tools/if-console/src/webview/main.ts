// The entry of the webview bundle (dist/webview.js): the resource panel's own page (0043-if-console FR-042, FR-043). It draws the model the extension
// posts with VS Code Elements (web components styled with VS Code's theme variables) and the codicon font, both from the extension's own lock, and
// loads nothing from anywhere else. It holds no user-facing string (the extension sends the labels) and runs nothing: every choice is a message
// naming an index the extension itself issued, and the extension decides what it does.
import '@vscode-elements/elements/dist/vscode-button/index.js';
import '@vscode-elements/elements/dist/vscode-collapsible/index.js';
import '@vscode-elements/elements/dist/vscode-context-menu/index.js';
import '@vscode-elements/elements/dist/vscode-icon/index.js';
import '@vscode-elements/elements/dist/vscode-table/index.js';
import '@vscode-elements/elements/dist/vscode-table-body/index.js';
import '@vscode-elements/elements/dist/vscode-table-cell/index.js';
import '@vscode-elements/elements/dist/vscode-table-header/index.js';
import '@vscode-elements/elements/dist/vscode-table-header-cell/index.js';
import '@vscode-elements/elements/dist/vscode-table-row/index.js';
import '@vscode-elements/elements/dist/vscode-textfield/index.js';
import '@vscode-elements/elements/dist/vscode-toolbar-button/index.js';
import type { ActionView, Block, Cell, Column, FileRef, FindingGroup, KeyValue, LessonStep, PanelView, Pill, Section, Stage, TableRow } from '../model/panel';
import { STATUS_LOOK } from '../model/status';
import type { Status } from '../model/presentation';

interface VsCodeApi { postMessage(message: unknown): void; getState(): unknown; setState(state: unknown): void }
declare function acquireVsCodeApi(): VsCodeApi;

interface Ui { sort: Record<string, { col: number; dir: 1 | -1 }>; filter: Record<string, string>; closed: Record<string, boolean> }
interface Saved { view: PanelView; ui: Ui }

const api: VsCodeApi | null = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
const send = (message: Record<string, unknown>): void => { api?.postMessage(message); };

let view: PanelView | null = null;
let ui: Ui = { sort: {}, filter: {}, closed: {} };
let labels: Record<string, string> = {};
const L = (key: string): string => labels[key] ?? key;

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | undefined | null | ((e: Event) => void)>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...kids: Child[]): HTMLElementTagNameMap[K];
function h(tag: string, attrs: Attrs = {}, ...kids: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

const icon = (name: string, size = 16, cls = ''): HTMLElement => h('vscode-icon', { name, size, class: cls, 'aria-hidden': 'true' });
const statusClass = (s: Status | undefined): string => (s ? `st-${s}` : '');
const look = (s: Status): { icon: string; word: string } => STATUS_LOOK[s];

function pill(p: Pill): HTMLElement {
  const cls = ['pill', p.kind ?? 'plain', statusClass(p.status)].filter(Boolean).join(' ');
  return h('span', { class: cls, title: p.title ?? p.text }, p.status ? icon(p.icon ?? look(p.status).icon, 12, 'pill-icon') : p.icon ? icon(p.icon, 12, 'pill-icon') : null, p.text);
}

/** Text with `code` spans read as code: nothing else is interpreted, and nothing is ever set as HTML. */
function inline(text: string): Node[] {
  return text.split(/(`[^`]+`)/).filter((x) => x !== '').map((part) => (part.startsWith('`') && part.endsWith('`') && part.length > 2 ? h('code', {}, part.slice(1, -1)) : document.createTextNode(part)));
}

// ---- the toolbar ------------------------------------------------------------------------------------------------------------

function iconButton(name: string, label: string, onClick: (() => void) | null, extra = ''): HTMLElement {
  const b = h('vscode-toolbar-button', { icon: name, label, title: label, class: `tb ${extra}`.trim(), 'aria-disabled': onClick ? undefined : 'true' });
  if (onClick) b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

function runAction(a: ActionView): void { if (a.enabled) send({ type: 'run', action: a.id }); }

function actionButton(a: ActionView, v: PanelView): HTMLElement {
  const tip = a.enabled ? [a.label, a.cli].filter(Boolean).join('\n') : `${a.label}\n${a.reason}`;
  if (a.primary) {
    return h('vscode-button', { class: 'primary-action', icon: a.icon, title: tip, onclick: () => runAction(a) }, a.label);
  }
  void v;
  return iconButton(a.icon, a.enabled ? tip : tip, a.enabled ? () => runAction(a) : null, a.enabled ? '' : 'off');
}

function overflow(v: PanelView, extras: ActionView[]): HTMLElement {
  const items: Array<{ label?: string; value?: string; separator?: boolean }> = [];
  for (const a of extras) items.push({ label: a.enabled ? a.label : `${a.label} (${a.reason})`, value: `action:${a.id}` });
  if (extras.length) items.push({ separator: true });
  items.push({ label: L('copyJson'), value: 'copyJson' });
  if (v.context) items.push({ label: L('copyContext'), value: 'copyContext' });
  if (v.line) items.push({ label: L('copyLine'), value: 'copyLine' });
  items.push({ separator: true }, { label: L('side'), value: 'side' }, { label: L('refresh'), value: 'refresh' });
  const menu = h('vscode-context-menu', { class: 'menu' }) as HTMLElement & { data: typeof items; show: boolean };
  menu.data = items;
  const button = iconButton('ellipsis', L('more'), null, 'more');
  button.removeAttribute('aria-disabled');
  button.setAttribute('aria-haspopup', 'menu');
  button.addEventListener('click', (e) => { e.stopPropagation(); menu.show = !menu.show; });
  menu.addEventListener('vsc-context-menu-select', (e) => {
    const value = String((e as CustomEvent<{ value: string }>).detail.value);
    menu.show = false;
    if (value.startsWith('action:')) send({ type: 'run', action: Number(value.slice(7)) });
    else send({ type: value });
  });
  return h('div', { class: 'overflow' }, button, menu);
}

function toolbar(v: PanelView): HTMLElement {
  const actions = v.built.actions;
  const normal = actions.filter((a) => !a.decision);
  const decisions = actions.filter((a) => a.decision);
  const primary = normal.find((a) => a.primary);
  const secondary = normal.filter((a) => !a.primary);
  const shown = secondary.slice(0, 4);
  const rest = secondary.slice(4);
  const group = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': L('actions') },
    primary ? actionButton(primary, v) : null,
    ...shown.map((a) => actionButton(a, v)),
    decisions.length ? h('div', { class: 'decisions', role: 'group', 'aria-label': L('decision') },
      h('span', { class: 'decision-tag' }, icon('law', 14), L('decision')),
      ...decisions.map((a) => h('vscode-button', { class: 'decision-action', secondary: true, disabled: !a.enabled, title: a.enabled ? [a.label, a.cli].filter(Boolean).join('\n') : `${a.label}\n${a.reason}`, onclick: () => runAction(a) }, a.label))) : null,
    overflow(v, rest));
  return group;
}

// ---- the page's frame -------------------------------------------------------------------------------------------------------

function navigation(v: PanelView): HTMLElement {
  const crumbs = h('ol', { class: 'crumbs' });
  v.nav.crumbs.forEach((c, i) => {
    const item = h('li', { class: c.current ? 'current' : '' });
    if (c.current) item.append(h('span', { 'aria-current': 'page' }, c.label));
    else item.append(h('button', { class: 'crumb', type: 'button', onclick: () => send({ type: 'crumb', index: i }) }, c.label));
    crumbs.append(item);
  });
  return h('nav', { class: 'nav', 'aria-label': L('history') },
    iconButton('arrow-left', L('back'), v.nav.canBack ? () => send({ type: 'back' }) : null),
    iconButton('arrow-right', L('forward'), v.nav.canForward ? () => send({ type: 'forward' }) : null),
    h('div', { class: 'crumbs-wrap', 'aria-label': L('breadcrumb') }, crumbs),
    v.built.mode === 'topic' ? h('vscode-button', { class: 'topics', secondary: true, icon: 'list-unordered', onclick: () => send({ type: 'topics' }) }, L('allTopics')) : null,
    v.built.mode === 'preview' ? null : iconButton('refresh', L('refresh'), () => send({ type: 'refresh' })),
    iconButton('split-horizontal', L('side'), () => send({ type: 'side' })));
}

function header(v: PanelView): HTMLElement {
  const b = v.built;
  const same = b.header.kind.toLowerCase() === b.header.title.toLowerCase();
  const showId = b.header.id !== '' && b.header.id !== b.header.title;
  const meta = h('div', { class: 'meta' }, same ? null : h('span', { class: 'kind' }, b.header.kind), !same && showId ? h('span', { class: 'sep', 'aria-hidden': 'true' }, '\u00b7') : null,
    showId ? h('code', { class: 'id' }, b.header.id) : null);
  const pills = h('div', { class: 'pills', role: 'list', 'aria-label': L('status') },
    b.header.audience ? pill({ text: b.header.audience, icon: 'eye', kind: 'audience', title: L('audience') }) : null, ...b.header.pills.map(pill));
  const settled = v.settled;
  return h('header', { class: 'head' },
    h('div', { class: 'kind-icon' }, icon(b.header.icon, 28)),
    h('div', { class: 'head-main' },
      h('h1', { id: 'title', tabindex: -1 }, b.header.title), meta, b.header.subtitle ? h('p', { class: 'subtitle' }, ...inline(b.header.subtitle)) : null, pills),
    b.mode === 'preview' ? previewButtons(v, settled) : toolbar(v));
}

function previewButtons(v: PanelView, settled: PanelView['settled']): HTMLElement {
  const p = v.built.preview;
  if (settled) return h('div', { class: 'toolbar settled', role: 'status' }, icon(settled === 'applied' ? 'pass' : 'discard', 16), L(settled));
  return h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': L('actions') },
    h('vscode-button', { class: 'primary-action', icon: p?.decision ? 'law' : 'check', onclick: () => send({ type: 'apply' }) }, p?.apply ?? L('apply')),
    h('vscode-button', { secondary: true, icon: 'discard', onclick: () => send({ type: 'discard' }) }, p?.discard ?? L('discard')));
}

// ---- sections ---------------------------------------------------------------------------------------------------------------

function fileLink(file: FileRef, text: string): HTMLElement {
  return h('a', { class: 'file', href: '#', title: L('openFile'), onclick: (e) => { e.preventDefault(); send({ type: 'file', path: file.path, line: file.line }); } }, icon('go-to-file', 12), text);
}

function refLink(ref: number, text: string): HTMLElement {
  return h('a', { class: 'ref', href: '#', title: L('open'), onclick: (e) => { e.preventDefault(); send({ type: 'open', ref }); } }, text);
}

function copyButton(text: string): HTMLElement {
  const b = iconButton('copy', L('copy'), () => { send({ type: 'copy', text }); b.setAttribute('icon', 'check'); setTimeout(() => b.setAttribute('icon', 'copy'), 1200); }, 'copy-btn');
  return b;
}

function valueNode(item: KeyValue): Node {
  switch (item.kind) {
    case 'file': return item.file ? fileLink(item.file, item.value) : document.createTextNode(item.value);
    case 'color': { const sw = h('span', { class: 'swatch', 'aria-hidden': 'true' }); sw.style.background = item.value; return h('span', { class: 'color' }, sw, h('code', {}, item.value)); }
    case 'bool': return h('span', { class: `bool ${item.on ? 'yes' : 'no'}` }, icon(item.on ? 'check' : 'close', 12), item.value);
    case 'empty': return h('span', { class: 'muted' }, item.value);
    case 'status': return item.status ? pill({ text: item.value, status: item.status, kind: 'status' }) : document.createTextNode(item.value);
    case 'chips': return h('span', { class: 'tags' }, ...(item.items ?? []).map((t) => h('span', { class: 'tag' }, t)));
    case 'code': return h('code', {}, item.value);
    default: return h('span', { class: 'text' }, ...inline(item.value));
  }
}

function kvSection(s: Extract<Section, { type: 'kv' }>): HTMLElement {
  const dl = h('dl', { class: 'kv' });
  for (const item of s.items) dl.append(h('dt', {}, item.label), h('dd', {}, valueNode(item)));
  return dl;
}

function cellNode(c: Cell): Node {
  switch (c.kind) {
    case 'status': return c.status ? pill({ text: c.text, status: c.status, kind: 'status' }) : document.createTextNode(c.text);
    case 'file': return c.file ? fileLink(c.file, c.text) : document.createTextNode(c.text);
    case 'color': { const sw = h('span', { class: 'swatch', 'aria-hidden': 'true' }); sw.style.background = c.text; return h('span', { class: 'color' }, sw, h('code', {}, c.text)); }
    case 'empty': return h('span', { class: 'muted' }, c.text);
    case 'bool': return h('span', { class: `bool ${c.on ? 'yes' : 'no'}` }, c.text);
    default: return c.open !== undefined ? refLink(c.open, c.text) : document.createTextNode(c.text);
  }
}

function tableSection(s: Extract<Section, { type: 'table' }>): HTMLElement {
  const host = h('div', { class: 'table-host' });
  const count = h('span', { class: 'count', 'aria-live': 'polite' });
  const draw = (): void => {
    const state = ui.sort[s.id];
    const filter = (ui.filter[s.id] ?? '').toLowerCase();
    let rows: TableRow[] = s.rows.filter((r) => filter === '' || r.cells.some((c) => c.text.toLowerCase().includes(filter)));
    if (state) rows = [...rows].sort((a, b) => { const x = a.cells[state.col]?.sort ?? ''; const y = b.cells[state.col]?.sort ?? ''; return (x < y ? -1 : x > y ? 1 : 0) * state.dir; });
    count.textContent = `${rows.length} / ${s.rows.length}`;
    const head = h('vscode-table-header', { slot: 'header' }, ...s.columns.map((col: Column, i) => {
      const sorted = state?.col === i ? (state.dir === 1 ? 'ascending' : 'descending') : 'none';
      const arrow = sorted === 'none' ? null : icon(state?.dir === 1 ? 'arrow-up' : 'arrow-down', 12, 'sort-arrow');
      const cell = h('vscode-table-header-cell', { class: `th${col.numeric ? ' num' : ''}`, 'aria-sort': sorted, tabindex: 0, role: 'columnheader', title: `${L('sortBy')} ${col.label}` }, h('span', { class: 'th-label' }, col.label), arrow);
      const sort = (): void => { ui.sort[s.id] = { col: i, dir: state?.col === i && state.dir === 1 ? -1 : 1 }; save(); draw(); };
      cell.addEventListener('click', sort);
      cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); } });
      return cell;
    }));
    const body = h('vscode-table-body', { slot: 'body' }, ...rows.map((r) => {
      const open = r.open;
      const row = h('vscode-table-row', { class: open !== undefined ? 'openable' : '', tabindex: open !== undefined ? 0 : undefined, 'aria-label': open !== undefined ? `${L('open')} ${r.label}` : undefined },
        ...r.cells.map((c, i) => h('vscode-table-cell', { class: s.columns[i]?.numeric ? 'num' : '' }, cellNode(c))));
      if (open !== undefined) {
        row.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('a')) send({ type: 'open', ref: open }); });
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); send({ type: 'open', ref: open }); } });
      }
      return row;
    }));
    const table = h('vscode-table', { class: 'table', zebra: true, 'bordered-rows': true, resizable: true, role: 'table', 'aria-label': s.title, 'aria-rowcount': rows.length + 1 }, head, body);
    table.style.height = `${Math.min(rows.length, 12) * 27 + 34}px`;
    host.replaceChildren(rows.length ? table : h('p', { class: 'muted pad' }, L('noMatches')));
  };
  draw();
  const box = h('div', { class: 'table-box' });
  if (s.rows.length > 6) {
    const field = h('vscode-textfield', { class: 'filter', placeholder: L('filter'), 'aria-label': `${L('filter')}: ${s.title}`, value: ui.filter[s.id] ?? '' });
    field.append(h('vscode-icon', { slot: 'content-before', name: 'filter', size: 14, 'aria-hidden': 'true' }));
    field.addEventListener('input', () => { ui.filter[s.id] = (field as unknown as { value: string }).value; save(); draw(); });
    box.append(h('div', { class: 'table-tools' }, field, count));
  }
  box.append(host);
  if (s.more) box.append(h('p', { class: 'muted pad' }, L('moreRows').replace('{0}', String(s.more))));
  return box;
}

const STAGE_ICON: Record<Stage['state'], string> = { done: 'pass-filled', current: 'circle-filled', todo: 'circle-outline', blocked: 'error', skipped: 'circle-slash' };

function stageSection(s: Extract<Section, { type: 'stages' }>): HTMLElement {
  const ol = h('ol', { class: 'stepper', 'aria-label': s.title });
  s.stages.forEach((st, i) => {
    ol.append(h('li', { class: `stage ${st.state}`, 'aria-current': st.state === 'current' ? 'step' : undefined },
      h('span', { class: 'stage-mark' }, icon(STAGE_ICON[st.state], 20)),
      h('span', { class: 'stage-label' }, st.label),
      h('span', { class: 'stage-word' }, st.word),
      st.note ? h('span', { class: 'stage-note' }, st.note) : null,
      i < s.stages.length - 1 ? h('span', { class: 'stage-line', 'aria-hidden': 'true' }) : null));
  });
  return ol;
}

function findingGroups(groups: FindingGroup[]): HTMLElement {
  const out = h('div', { class: 'findings' });
  for (const g of groups) {
    const list = h('ul', { class: 'finding-list' });
    for (const f of g.findings) {
      const where = f.file ? fileLink(f.file, f.file.line === undefined ? f.file.path : `${f.file.path}:${f.file.line}`) : f.where ? h('code', { class: 'where' }, f.where) : null;
      const li = h('li', { class: `finding ${statusClass(f.status)}` },
        h('span', { class: 'finding-icon', title: f.word }, icon(look(f.status).icon, 16)),
        h('div', { class: 'finding-body' },
          h('div', { class: 'finding-msg' }, ...inline(f.message)),
          where || f.next ? h('div', { class: 'finding-meta' }, where, f.next ? h('span', { class: 'hint' }, f.next) : null) : null),
        f.open !== undefined ? iconButton('arrow-right', L('open'), () => send({ type: 'open', ref: f.open }), 'open-finding') : null);
      list.append(li);
    }
    const empty = g.findings.length === 0;
    out.append(h('section', { class: `group ${statusClass(g.status)}`, 'aria-label': g.name },
      h('div', { class: 'group-head' }, icon(look(g.status).icon, 16, 'group-icon'), h('span', { class: 'group-name' }, g.name),
        h('span', { class: 'group-count' }, g.word || (empty ? look(g.status).word : String(g.findings.length))), g.note ? h('span', { class: 'group-note' }, g.note) : null),
      empty ? null : list));
  }
  return out;
}

function blocks(bs: Block[]): HTMLElement {
  const wrap = h('div', { class: 'prose' });
  for (const b of bs) {
    if (b.kind === 'p') { wrap.append(h('p', {}, ...inline(b.text))); continue; }
    const pre = h('div', { class: 'codeblock', role: 'group', 'aria-label': L('command') });
    for (const line of b.lines) {
      pre.append(h('div', { class: 'codeline' }, h('code', {}, line.text),
        h('span', { class: 'codeline-tools' }, copyButton(line.copy),
          line.run !== undefined ? h('vscode-button', { class: 'run', icon: 'play', title: L('run'), 'aria-label': `${L('run')}: ${line.text}`, onclick: () => send({ type: 'run', action: line.run }) }, L('run')) : null)));
    }
    wrap.append(pre);
  }
  return wrap;
}

function readingSection(s: Extract<Section, { type: 'reading' }>): HTMLElement {
  const out = h('div', { class: 'reading' });
  for (const part of s.parts) out.append(h('article', { class: 'part' }, h('h3', {}, part.n !== null ? h('span', { class: 'num' }, String(part.n)) : null, part.heading), blocks(part.blocks)));
  return out;
}

function lessonSection(s: Extract<Section, { type: 'lesson' }>): HTMLElement {
  const ol = h('ol', { class: 'lesson' });
  for (const st of s.steps) ol.append(lessonStep(st));
  return ol;
}

function lessonStep(st: LessonStep): HTMLElement {
  const state = st.yourself ? h('span', { class: 'yourself' }, icon('person', 12), L('yourself')) : st.run === undefined ? h('span', { class: 'terminal' }, icon('terminal', 12), L('terminal')) : null;
  return h('li', { class: `step${st.yourself ? ' self' : ''}` },
    h('span', { class: 'step-n', 'aria-hidden': 'true' }, String(st.n)),
    h('div', { class: 'step-body' },
      h('div', { class: 'step-title' }, h('strong', {}, st.label), state),
      st.note ? h('p', { class: 'step-note' }, ...inline(st.note)) : null,
      st.line ? h('div', { class: 'codeblock' }, h('div', { class: 'codeline' }, h('code', {}, st.line),
        h('span', { class: 'codeline-tools' }, copyButton(st.line),
          st.run !== undefined ? h('vscode-button', { class: 'run', icon: 'play', 'aria-label': `${L('run')}: ${st.label}`, onclick: () => send({ type: 'run', action: st.run }) }, L('run'))
            : h('vscode-button', { class: 'run', icon: 'play', disabled: true, title: st.reason, 'aria-label': `${L('run')}: ${st.reason}` }, L('run'))))) : null,
      !st.line && st.reason ? h('p', { class: 'muted' }, st.reason) : null,
      st.line && st.run === undefined && st.reason ? h('p', { class: 'step-why' }, st.reason) : null));
}

function chipsSection(s: Extract<Section, { type: 'chips' }>): HTMLElement {
  return h('div', { class: 'chips', role: 'list' }, ...s.chips.map((c) => h('button', { class: 'chip', type: 'button', role: 'listitem', title: c.title, onclick: () => send({ type: 'open', ref: c.open }) }, icon('link', 12), c.label)));
}

function changesSection(s: Extract<Section, { type: 'changes' }>, v: PanelView): HTMLElement {
  const list = h('ul', { class: 'changes' });
  for (const c of s.changes) {
    list.append(h('li', { class: 'change' },
      icon(c.change === 'create' ? 'diff-added' : c.change === 'delete' ? 'diff-removed' : 'diff-modified', 16, `change-${c.change}`),
      h('code', { class: 'path' }, c.path), h('span', { class: 'word' }, c.word),
      h('span', { class: 'plus' }, `+${c.added}`), h('span', { class: 'minus' }, `−${c.removed}`),
      h('vscode-button', { secondary: true, icon: 'diff', disabled: v.settled !== undefined, onclick: () => send({ type: 'diff', index: c.index }) }, L('openDiff'))));
  }
  return h('div', {}, h('p', { class: 'summary' }, s.summary), list);
}

function emptySection(s: Extract<Section, { type: 'empty' }>): HTMLElement {
  return h('div', { class: 'empty' }, icon(s.icon, 32, 'empty-icon'), h('p', { class: 'empty-text' }, s.text), s.guidance ? h('p', { class: 'muted' }, s.guidance) : null);
}

function sectionBody(s: Section, v: PanelView): HTMLElement {
  switch (s.type) {
    case 'kv': return kvSection(s);
    case 'table': return tableSection(s);
    case 'stages': return stageSection(s);
    case 'findings': return findingGroups(s.groups);
    case 'text': return blocks(s.blocks);
    case 'chips': return chipsSection(s);
    case 'changes': return changesSection(s, v);
    case 'reading': return readingSection(s);
    case 'lesson': return lessonSection(s);
    case 'empty': return emptySection(s);
  }
}

function sectionBox(s: Section, v: PanelView): HTMLElement {
  const count = s.type === 'table' ? String(s.rows.length) : s.type === 'findings' ? String(s.groups.reduce((n, g) => n + g.findings.length, 0)) : s.type === 'lesson' ? String(s.steps.length) : '';
  const box = h('vscode-collapsible', { class: `section sec-${s.type}`, heading: s.title, open: ui.closed[s.id] ? undefined : true, 'data-section': s.id });
  box.append(h('span', { slot: 'decorations', class: 'sec-count' }, count));
  box.append(sectionBody(s, v));
  box.addEventListener('vsc-collapsible-toggle', (e) => { ui.closed[s.id] = !(e as CustomEvent<{ open: boolean }>).detail.open; save(); });
  return box;
}

// ---- the page -------------------------------------------------------------------------------------------------------------------

function save(): void { if (view) api?.setState({ view, ui } satisfies Saved); }

function render(next: PanelView, focusTitle = false): void {
  view = next;
  labels = next.labels;
  const root = document.getElementById('app');
  if (!root) return;
  const top = window.scrollY;
  root.replaceChildren(navigation(next), h('main', { class: 'page', 'aria-labelledby': 'title' }, header(next), ...next.built.sections.map((s) => sectionBox(s, next)),
    next.built.next ? h('footer', { class: 'up-next' }, h('span', { class: 'muted' }, L('next')), h('button', { class: 'next-link', type: 'button', onclick: () => send({ type: 'next' }) }, icon('arrow-right', 14), next.built.next.topic), h('span', { class: 'muted' }, next.built.next.summary)) : null));
  document.title = next.built.header.title;
  save();
  if (focusTitle) document.getElementById('title')?.focus();
  else window.scrollTo(0, top);
  send({ type: 'rendered', summary: summary(next) });
}

/** What was drawn, in words a test reads: the page is built here, and nothing else can see it. */
function summary(v: PanelView): Record<string, unknown> {
  const q = (sel: string): number => document.querySelectorAll(sel).length;
  return { title: document.getElementById('title')?.textContent ?? '', sections: [...document.querySelectorAll('[data-section]')].map((e) => e.getAttribute('data-section')),
    tables: q('vscode-table'), rows: q('vscode-table-row'), stages: q('.stage'), findings: q('.finding'), steps: q('.step'), runs: q('.run'), codeLines: q('.codeline'), kv: q('.kv dt'),
    chips: q('.chip'), pills: q('.pill'), actions: q('.toolbar > *'), decisions: q('.decision-action'), changes: q('.change'), icons: q('vscode-icon'), mode: v.built.mode };
}

window.addEventListener('message', (e: MessageEvent) => {
  const m = e.data as { type?: string; view?: PanelView; focus?: boolean; section?: string } | null;
  if (m?.type === 'model' && m.view) render(m.view, m.focus === true);
  else if (m?.type === 'scroll' && m.section) document.querySelector(`[data-section="${CSS.escape(m.section)}"]`)?.scrollIntoView({ block: 'start' });
});
document.addEventListener('click', () => { document.querySelectorAll<HTMLElement & { show: boolean }>('vscode-context-menu').forEach((x) => { if (x.show) x.show = false; }); });
document.addEventListener('keydown', (e) => {
  if ((e.altKey && e.key === 'ArrowLeft') || (e.key === 'Backspace' && e.altKey)) { send({ type: 'back' }); e.preventDefault(); }
  else if (e.altKey && e.key === 'ArrowRight') { send({ type: 'forward' }); e.preventDefault(); }
});

const saved = api?.getState() as Saved | null | undefined;
if (saved?.view) { ui = saved.ui; render(saved.view); }
send({ type: 'ready' });
