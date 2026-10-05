// A fake launcher: an executable file at a temporary repository's root that replays recorded resources, so the tests drive a command line
// that is not any real one. It writes what it was asked to a log file beside it, so a test can see the exact invocations (arguments,
// working directory, IF_CONSOLE) the extension made. The documents are recorded JSON, so they are typed loosely: the tests assert their shape.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type Loose = any;

export interface Invocation { argv: string[]; cwd: string; IF_CONSOLE?: string; dry: boolean }

export interface FakeRepo {
  root: string;
  file: string;
  log: string;
  invocations(): Invocation[];
  cleanup(): void;
}

/** `docs` maps a command line (the words before --json) to {doc, exit, stderr, delayMs, lines, hang}. */
export function makeRepo({ docs, declare = true, launcherName = 'other' }: { name?: string; docs: Record<string, Loose>; declare?: boolean; launcherName?: string; audience?: string }): FakeRepo {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'if-console-'));
  const table = path.join(root, '.fake-docs.json');
  fs.writeFileSync(table, JSON.stringify(docs));
  const log = path.join(root, '.fake-log.ndjson');
  const script = `#!${process.execPath}
const fs = require('fs');
const argv = process.argv.slice(2);
const dry = argv.includes('--dry-run');
const key = argv.filter((a) => a !== '--json').join(' ');
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ argv, cwd: process.cwd(), IF_CONSOLE: process.env.IF_CONSOLE, dry }) + '\\n');
const docs = JSON.parse(fs.readFileSync(${JSON.stringify(table)}, 'utf8'));
const hit = docs[key] || docs[key.replace(' --dry-run', '')] || docs['*'];
if (!hit) { process.stderr.write('no recorded answer for ' + key + '\\n'); process.exit(2); }
if (hit.stderr) process.stderr.write(hit.stderr);
if (hit.lines) { let i = 0; const next = () => { if (i < hit.lines.length) { process.stdout.write(JSON.stringify(hit.lines[i++]) + '\\n'); setTimeout(next, hit.delayMs || 0); } else process.exit(hit.exit || 0); }; next(); }
else if (hit.hang) { setInterval(() => {}, 1000); }
else { process.stdout.write(typeof hit.doc === 'string' ? hit.doc : JSON.stringify(hit.doc, null, 2) + '\\n'); process.exit(hit.exit || 0); }
`;
  const file = path.join(root, launcherName);
  fs.writeFileSync(file, script, { mode: 0o755 });
  if (declare) fs.writeFileSync(path.join(root, '.if-console.env'), `# the declaration\nIF_CONSOLE_LAUNCHER=./${launcherName}\n`);
  return { root, file, log,
    invocations: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Invocation) : []),
    cleanup: () => { fs.rmSync(root, { recursive: true, force: true }); } };
}

export const doc = (orch: string, kind: string, id: string, data: Loose, extra?: Loose): Loose =>
  ({ schema: `${orch}/${kind}@1`, audience: 'private', kind, id, data, links: [], actions: [], ...(extra ?? {}) });

/** A small second command line with its own nouns, a list, a decision, a write with a diff, and a check with a finding. */
export function secondCommandLine(orch = 'other') {
  const titles: Record<string, [string, string]> = { 'widget list': ['List Widgets', 'list-unordered'], 'widget show': ['Show Widget\u2026', 'eye'], 'widget new': ['New Widget\u2026', 'add'], 'check': ['Run Check', 'checklist'] };
  const cmd = (id: string, category: string, surfaces: string[], help: string, extra?: Loose): Loose => ({ id, category, group: 'g', surfaces, help, ...(titles[id] ? { title: titles[id][0], icon: titles[id][1] } : {}), ...(extra ?? {}) });
  const ed = ['terminal', 'editor', 'mcp'];
  const list = doc(orch, 'command-list', 'all', { count: 9, commands: [
    cmd('check', 'check', ed, 'Run checks'), cmd('doctor', 'check', ed, 'Report health'), cmd('fresh', 'check', ed, 'Prove generators'),
    cmd('widget list', 'read', ed, 'List widgets'), cmd('widget show', 'read', ed, 'Show a widget'), cmd('widget new', 'record', ed, 'Add a widget'),
    cmd('widget approve', 'decision', ['terminal', 'editor'], 'Approve a widget'), cmd('mcp serve', 'setup', ['terminal'], 'Serve MCP'),
    cmd('secret tool', 'setup', ['terminal'], 'Not for the editor')],
    presentation: {
      views: [{ id: 'widgets', title: 'Widgets', icon: 'package', order: 20, description: 'Widgets and what is done to them' }, { id: 'unused', title: 'Unused', icon: 'folder', order: 30, description: '' }],
      nouns: [{ noun: 'widget', title: 'Widget', icon: 'symbol-event', view: 'widgets',
        list: { command: 'widget list', rows: 'widgets', id: 'id', label: 'name', description: 'kind', status: 'state', badge: 'parts', tooltip: ['kind', 'note'],
          status_map: { ready: 'ok', broken: 'error', draft: 'pending' } } }],
      references: [{ id: 'widget', noun: 'widget', pattern: '\\bwidget[ /](w\\d+)\\b', value: '$1', files: ['docs/**/*.md'], text: 'note', facts: ['kind', 'state'], lens: ['kind', 'state'],
        definition: ['path', 'line'] }] } });
  const arg = (name: string, type: string, extra?: Loose): Loose => ({ name, type, help: `the ${name}`, required: true, words: false, many: false, ...(extra ?? {}) });
  const detail = (id: string, category: string, args: Loose[], opts?: Loose[]): Loose => doc(orch, 'command', id, { id, noun: id.split(' ')[1] ? id.split(' ')[0] : null, verb: id.split(' ')[1] ?? id, category, help: `${id} help`,
    group: 'g', arguments: args, options: [...(opts ?? []), ...(category === 'read' || category === 'check' ? [] : [{ flag: '--dry-run', type: 'flag', help: 'x', multiple: false, required: false }])],
    usage: id, surfaces: ['terminal', 'editor'], programs: [] });
  const finding = { level: 'error', where: 'docs/guide.md:3', message: 'the guide has a broken link', next: 'edit docs/guide.md, then run `check docs`' };
  const check = (sections: Loose[]): Loose => doc(orch, 'check', 'docs', { suite: null, scope: null, changed: false,
    status: sections.some((s) => s.status === 'failed') ? 'failed' : 'passed',
    summary: { run: sections.length, passed: sections.filter((s) => s.status === 'passed').length, failed: sections.filter((s) => s.status === 'failed').length, skipped: sections.filter((s) => s.status === 'skipped').length },
    sections });
  return { list, detail, arg, check, finding, doc: (kind: string, id: string, data: Loose, extra?: Loose): Loose => doc(orch, kind, id, data, extra) };
}
