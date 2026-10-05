'use strict';
// The fixture second command line for the real-VS-Code tests: a fake launcher that replays recorded resources (test/support), with
// the files its recorded findings and changes name, so that a check places a diagnostic and a write has a file to diff.
const fs = require('fs');
const path = require('path');
const { makeRepo, secondCommandLine } = require('../../out/test/support/fake-launcher');

function make() {
  const k = secondCommandLine('other');
  const cmd = (id, category, surfaces, help) => ({ id, category, group: 'g', surfaces, help });
  const ed = ['terminal', 'editor', 'mcp'];
  const list = k.doc('command-list', 'all', { count: 8, commands: [
    cmd('check', 'check', ed, 'Run checks'), cmd('doctor', 'check', ed, 'Report health'), cmd('fresh', 'check', ed, 'Prove generators'),
    { ...cmd('site generate', 'generate', ed, 'Rewrite the site page'), title: 'Generate Site\u2026', icon: 'sync' },
    cmd('period advance', 'decision', ['terminal', 'editor'], 'Close the period'),
    { ...cmd('widget list', 'read', ed, 'List widgets'), title: 'List Widgets', icon: 'list-unordered' },
    { ...cmd('widget show', 'read', ed, 'Show a widget'), title: 'Show Widget\u2026', icon: 'eye' }, cmd('secret tool', 'setup', ['terminal'], 'Not for the editor')],
    presentation: {
      views: [{ id: 'things', title: 'Things', icon: 'package', order: 25, description: 'Widgets and what is done to them' }],
      nouns: [{ noun: 'widget', title: 'Widget', icon: 'symbol-event', view: 'things',
        list: { command: 'widget list', rows: 'widgets', id: 'id', label: 'name', description: 'kind', status: 'state', badge: 'parts', tooltip: ['kind', 'note'],
          status_map: { ready: 'ok', broken: 'error', draft: 'pending' } } },
        { noun: 'site', title: 'Site', icon: 'globe', view: 'things' }],
      references: [{ id: 'widget', noun: 'widget', pattern: '\\bwidget[ /](w\\d+)\\b', value: '$1', files: ['docs/**/*.md'], text: 'note', facts: ['kind', 'state'],
        lens: ['kind', 'state'], definition: ['path', 'line'] }] } });
  const change = (p) => ({ path: p, change: 'modify', added: 1, removed: 1, diff: ['--- before', '+++ after', '@@ -1 +1 @@', '-old', '+new'] });
  const checkDoc = k.check([
    { name: 'docs', status: 'failed', findings: [k.finding], notes: [], data: {} },
    { name: 'links', status: 'passed', findings: [], notes: [], data: {} }]);
  const widgetLink = { rel: 'widget', command: 'widget show', fields: { widget: 'w1' }, cli: 'other widget show w1' };
  const checkAction = { label: 'run its check', command: 'check', fields: { sections: ['docs'] }, category: 'check', surfaces: ['editor'], cli: 'other check docs', enabled: true };
  const docs = {
    'command list': { doc: list },
    'command show check': { doc: k.detail('check', 'check', [k.arg('sections', 'SECTION', { many: true, required: false, choices: ['docs', 'links'] })], []) },
    'command show doctor': { doc: k.detail('doctor', 'check', []) },
    'command show fresh': { doc: k.detail('fresh', 'check', []) },
    'command show site generate': { doc: k.detail('site generate', 'generate', []) },
    'command show period advance': { doc: k.detail('period advance', 'decision', []) },
    'command show widget list': { doc: k.detail('widget list', 'read', []) },
    'command show widget show': { doc: k.detail('widget show', 'read', [k.arg('widget', 'WIDGET')]) },
    'widget list': { doc: k.doc('widget-list', 'all', { count: 3, widgets: [
      { id: 'w1', name: 'First widget', kind: 'blue', state: 'ready', parts: 3, note: 'The first one.' },
      { id: 'w2', name: 'Second widget', kind: 'red', state: 'broken', parts: 12, note: 'It needs a fix.' },
      { id: 'w3', name: 'Third widget', kind: 'green', state: 'draft', parts: 1, note: 'Still a draft.' }] }, { links: [widgetLink] }) },
    'widget show w1': { doc: k.doc('widget', 'w1', { name: 'w1', kind: 'blue', state: 'ready', note: 'The first one.', path: 'docs/guide.md', line: 5 }, { actions: [checkAction] }) },
    'widget show w2': { doc: k.doc('widget', 'w2', { name: 'w2', kind: 'red', state: 'broken', note: 'It needs a fix.', path: 'docs/guide.md', line: 5 }, { actions: [checkAction] }) },
    'site generate --dry-run': { doc: k.doc('site', 'generate', { dry_run: true, changes: [change('site/index.txt')] }) },
    'site generate': { doc: k.doc('site', 'generate', { dry_run: false, changes: [change('site/index.txt')] }) },
    'period advance --dry-run': { doc: k.doc('period', 'advance', { dry_run: true, changes: [change('site/index.txt')] }) },
    'period advance': { doc: k.doc('period', 'advance', { dry_run: false, changes: [change('site/index.txt')] }) },
    'check --changed': { doc: checkDoc, exit: 1 }, check: { doc: checkDoc, exit: 1 }, 'check docs': { doc: checkDoc, exit: 1 },
    doctor: { doc: k.doc('doctor', 'other', { status: 'missing', toolchain: [{ entry: 'big', cache: 'not fetched', 'needed by': ['check docs'], hint: '' }], conflicts: [] },
      { actions: [{ label: 'fetch big', command: 'site generate', fields: {}, category: 'generate', surfaces: ['editor'], cli: 'other site generate', enabled: true }] }) },
  };
  const repo = makeRepo({ docs });
  fs.mkdirSync(path.join(repo.root, 'docs'));
  fs.writeFileSync(path.join(repo.root, 'docs', 'guide.md'), '# Guide\n\nSee [this](nowhere.md).\n\nThe widget w1 is blue, and widget/w2 is red.\n');
  fs.mkdirSync(path.join(repo.root, 'site'));
  fs.writeFileSync(path.join(repo.root, 'site', 'index.txt'), 'old\n');
  return repo;
}

module.exports = { make };
