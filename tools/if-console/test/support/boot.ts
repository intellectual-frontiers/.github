// Start the extension against the stand-in API and a fake second command line, as VS Code would.
import { makeRepo, secondCommandLine, type FakeRepo, type Loose } from './fake-launcher';
import { createStub, folderOf, install, type Stub } from './vscode-stub';

export const k = secondCommandLine('other');

export const change = { path: 'widgets/w1.txt', change: 'modify', added: 1, removed: 1, diff: ['--- before', '+++ after', '@@ -1 +1 @@', '-old', '+new'] };
export const approvalLink = { rel: 'widget', command: 'widget show', fields: { widget: 'w1' }, cli: 'other widget show w1' };
export const action = (label: string, command: string, category: string, fields: Loose, extra?: Loose): Loose =>
  ({ label, command, fields, category, surfaces: ['editor'], cli: `other ${command}`, enabled: true, ...(extra ?? {}) });

export function defaultDocs(extra?: Record<string, Loose>): Record<string, Loose> {
  const checkDoc = k.check([
    { name: 'docs', status: 'failed', findings: [k.finding, { level: 'warning', where: 'general', message: 'no file for this one', next: '' }], notes: [], data: {} },
    { name: 'links', status: 'passed', findings: [], notes: [], data: {} },
    { name: 'slow', status: 'skipped', findings: [], notes: [], data: {}, reason: 'its toolchain entry is not fetched' }]);
  return {
    'command list': { doc: { ...k.list, links: [approvalLink] } },
    'command show check': { doc: k.detail('check', 'check', [k.arg('sections', 'SECTION', { many: true, required: false, choices: ['docs', 'links', 'slow'] })],
      [{ flag: '--suite', type: 'SUITE', help: 'a suite', multiple: false, required: false, choices: ['quick'] }]) },
    'command show doctor': { doc: k.detail('doctor', 'check', []) },
    'command show fresh': { doc: k.detail('fresh', 'check', []) },
    'command show widget list': { doc: k.detail('widget list', 'read', []) },
    'command show widget show': { doc: k.detail('widget show', 'read', [k.arg('widget', 'WIDGET')]) },
    'command show widget new': { doc: k.detail('widget new', 'record', [k.arg('name', 'TEXT')]) },
    'command show widget approve': { doc: k.detail('widget approve', 'decision', [k.arg('widget', 'WIDGET')]) },
    'widget list': { doc: k.doc('widget-list', 'all', { count: 2, widgets: [
      { id: 'w1', name: 'First widget', kind: 'blue', state: 'ready', parts: 3, note: 'The first one.' },
      { id: 'w2', name: 'Second widget', kind: 'red', state: 'broken', parts: 120, note: 'Needs a fix.' }] }, { links: [approvalLink, { ...approvalLink, fields: { widget: 'w2' } }] }) },
    'widget show w2': { doc: k.doc('widget', 'w2', { name: 'w2', kind: 'red', state: 'broken', note: 'Needs a fix.', path: 'docs/guide.md', line: 3 },
      { actions: [action('run its check', 'check', 'check', { sections: ['docs'] }), action('approve it', 'widget approve', 'decision', { widget: 'w2' })] }) },
    'widget show w1': { doc: k.doc('widget', 'w1', { name: 'w1', kind: 'blue', state: 'ready', note: 'The first one.', path: 'docs/guide.md', line: 3 }, { links: [{ rel: 'owner', command: 'widget show', fields: { widget: 'w2' }, cli: 'x' }],
      actions: [action('approve it', 'widget approve', 'decision', { widget: 'w1' }), action('rename', 'widget new', 'record', {}, { cli: null, needs: ['name'] }),
        action('blocked', 'widget new', 'record', {}, { enabled: false, reason: 'nothing left to do' }), action('run its check', 'check', 'check', { sections: ['docs'] })] }) },
    'widget approve w1 --dry-run': { doc: k.doc('widget', 'w1', { dry_run: true, changes: [change] }) },
    'widget approve w1': { doc: k.doc('widget', 'w1', { dry_run: false, changes: [change] }) },
    'check docs': { doc: checkDoc, exit: 1 }, 'check links': { doc: checkDoc, exit: 1 }, 'check slow': { doc: checkDoc, exit: 1 }, 'check': { doc: checkDoc, exit: 1 },
    'check --changed': { doc: checkDoc, exit: 1 },
    'doctor': { doc: k.doc('doctor', 'other', { status: 'missing', toolchain: [{ entry: 'big', cache: 'not fetched' }], conflicts: [] },
      { actions: [action('fetch big', 'widget new', 'record', { name: 'big' })] }) },
    ...(extra ?? {}),
  };
}

export interface Booted {
  stub: Stub;
  first: FakeRepo;
  repos: FakeRepo[];
  context: { subscriptions: Loose[] };
  exported: unknown;
  extension: Loose;
  restore: () => void;
  command: (id: string, ...a: unknown[]) => Loose;
  cleanup: () => void;
}

export interface BootOptions { docs?: Record<string, Loose>; trusted?: boolean; second?: Record<string, Loose> | null; config?: Record<string, Loose>; mcp?: boolean; workspaceConfig?: Record<string, Loose> }

export async function boot({ docs, trusted = true, second = null, config, mcp, workspaceConfig }: BootOptions = {}): Promise<Booted> {
  const first = makeRepo({ docs: docs ?? defaultDocs() });
  const repos = [first];
  const folders = [folderOf('first', first.root)];
  if (second) { const r = makeRepo({ docs: second }); repos.push(r); folders.push(folderOf('second', r.root)); }
  const stub = createStub({ folders, trusted, config, mcp, workspaceConfig });
  const restore = install(stub);
  // Loaded after the stand-in is installed, so that the extension's `vscode` is the stand-in.
  const extension = require('../../src/extension') as Loose;
  const context: { subscriptions: Loose[] } = { subscriptions: [] };
  const exported = await extension.activate(context);
  return { stub, first, repos, context, exported, extension, restore,
    command: (id, ...a) => stub.calls.registered.get(`if-console.${id}`)(...a),
    cleanup: () => { context.subscriptions.forEach((s) => { try { s.dispose(); } catch { /* ignore */ } }); extension.deactivate(); restore(); repos.forEach((r) => r.cleanup()); } };
}
