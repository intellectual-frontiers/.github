'use strict';
// Start the extension against the stand-in API and a fake second command line, as VS Code would.
const { createStub, install, folderOf } = require('./vscode-stub');
const { makeRepo, secondCommandLine } = require('./fake-launcher');

const k = secondCommandLine('other');

const change = { path: 'widgets/w1.txt', change: 'modify', added: 1, removed: 1, diff: ['--- before', '+++ after', '@@ -1 +1 @@', '-old', '+new'] };
const approvalLink = { rel: 'widget', command: 'widget show', fields: { widget: 'w1' }, cli: 'other widget show w1' };
const action = (label, command, category, fields, extra) => ({ label, command, fields, category, surfaces: ['editor'], cli: `other ${command}`, enabled: true, ...(extra || {}) });

function defaultDocs(extra) {
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
    'widget list': { doc: k.doc('widget-list', 'all', { count: 1 }, { links: [approvalLink, { ...approvalLink, fields: { widget: 'w2' } }] }) },
    'widget show w1': { doc: k.doc('widget', 'w1', { name: 'w1' }, { links: [{ rel: 'owner', command: 'widget show', fields: { widget: 'w2' }, cli: 'x' }],
      actions: [action('approve it', 'widget approve', 'decision', { widget: 'w1' }), action('rename', 'widget new', 'record', {}, { cli: null, needs: ['name'] }),
        action('blocked', 'widget new', 'record', {}, { enabled: false, reason: 'nothing left to do' })] }) },
    'widget approve w1 --dry-run': { doc: k.doc('widget', 'w1', { dry_run: true, changes: [change] }) },
    'widget approve w1': { doc: k.doc('widget', 'w1', { dry_run: false, changes: [change] }) },
    'check docs': { doc: checkDoc, exit: 1 }, 'check links': { doc: checkDoc, exit: 1 }, 'check slow': { doc: checkDoc, exit: 1 }, 'check': { doc: checkDoc, exit: 1 },
    'check --changed': { doc: checkDoc, exit: 1 },
    'doctor': { doc: k.doc('doctor', 'other', { status: 'missing', toolchain: [{ entry: 'big', cache: 'not fetched' }], conflicts: [] },
      { actions: [action('fetch big', 'widget new', 'record', { name: 'big' })] }) },
    ...(extra || {}),
  };
}

async function boot({ docs, trusted = true, second = null, config, mcp, workspaceConfig } = {}) {
  const first = makeRepo({ docs: docs || defaultDocs() });
  const repos = [first];
  const folders = [folderOf('first', first.root)];
  if (second) { const r = makeRepo({ docs: second }); repos.push(r); folders.push(folderOf('second', r.root)); }
  const stub = createStub({ folders, trusted, config, mcp, workspaceConfig });
  const restore = install(stub);
  const extension = require('../../src/extension');
  const context = { subscriptions: [] };
  const exported = await extension.activate(context);
  return { stub, first, repos, context, exported, extension, restore,
    command: (id, ...a) => stub.calls.registered.get(`if-console.${id}`)(...a),
    cleanup: () => { context.subscriptions.forEach((s) => { try { s.dispose(); } catch (e) { /* ignore */ } }); extension.deactivate(); restore(); repos.forEach((r) => r.cleanup()); } };
}

module.exports = { boot, defaultDocs, k, change, action };
