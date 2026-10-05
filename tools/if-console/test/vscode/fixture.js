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
  const list = k.doc('command-list', 'all', { count: 10, commands: [
    cmd('check', 'check', ed, 'Run checks'), cmd('doctor', 'check', ed, 'Report health'), cmd('fresh', 'check', ed, 'Prove generators'),
    { ...cmd('site generate', 'generate', ed, 'Rewrite the site page'), title: 'Generate Site\u2026', icon: 'sync' },
    cmd('period advance', 'decision', ['terminal', 'editor'], 'Close the period'),
    { ...cmd('widget list', 'read', ed, 'List widgets'), title: 'List Widgets', icon: 'list-unordered' },
    { ...cmd('release list', 'read', ed, 'List releases'), title: 'List Releases', icon: 'list-unordered' },
    { ...cmd('release show', 'read', ed, 'Show a release and where it is on its way'), title: 'Show Release\u2026', icon: 'eye' },
    { ...cmd('widget show', 'read', ed, 'Show a widget'), title: 'Show Widget\u2026', icon: 'eye' }, cmd('secret tool', 'setup', ['terminal'], 'Not for the editor')],
    presentation: {
      views: [{ id: 'widgets', title: 'Widgets', icon: 'package', order: 25, description: 'Widgets, their releases and what is done to them' }],
      nouns: [{ noun: 'widget', title: 'Widget', icon: 'symbol-event', view: 'widgets',
        list: { command: 'widget list', rows: 'widgets', id: 'id', label: 'name', description: 'kind', status: 'state', badge: 'parts', tooltip: ['kind', 'note'],
          status_map: { ready: 'ok', broken: 'error', draft: 'pending' } } },
        { noun: 'release', title: 'Release', icon: 'rocket', view: 'widgets',
          list: { command: 'release list', rows: 'releases', id: 'id', label: 'name', description: 'stage', status: 'state', badge: 'files', status_map: { ready: 'ok', blocked: 'error', waiting: 'pending' } } },
        { noun: 'site', title: 'Site', icon: 'globe', view: 'widgets' }],
      references: [{ id: 'widget', noun: 'widget', pattern: '\\bwidget[ /](w\\d+)\\b', value: '$1', files: ['docs/**/*.md'], text: 'note', facts: ['kind', 'state'],
        lens: ['kind', 'state'], definition: ['path', 'line'] }] } });
  const change = (p) => ({ path: p, change: 'modify', added: 1, removed: 1, diff: ['--- before', '+++ after', '@@ -1 +1 @@', '-old', '+new'] });
  const checkDoc = k.check([
    { name: 'docs', status: 'failed', findings: [k.finding], notes: [], data: {} },
    { name: 'links', status: 'passed', findings: [], notes: [], data: {} }]);
  const advance = { label: 'close the period', command: 'period advance', fields: {}, category: 'decision', surfaces: ['editor'], cli: 'other period advance', enabled: true };
  const fetchAction = { label: 'rebuild the site', command: 'site generate', fields: {}, category: 'generate', surfaces: ['editor'], cli: 'other site generate', enabled: true };
  const waiting = { label: 'publish it', command: 'site generate', fields: {}, category: 'record', surfaces: ['editor'], cli: null, enabled: false, reason: 'its check has not passed yet' };
  const release = (id, name, stage) => ({ release: id, title: name, kind: 'release', kind_label: 'Release', stage, state: stage === 'Review' ? 'waiting' : 'ready', owner: 'Press', path: 'docs/guide.md', line: 5,
    summary: 'Everything the next version ships, and where it is on its way to readers.',
    stages: ['Draft', 'Review', 'Prepare', 'Ship'].map((s, i) => ({ stage: s, label: s, order: i + 1, state: i < 1 ? 'reached' : i === 1 ? 'current' : 'ahead', decided: i < 2 ? { date: `2026-09-${20 + i}`, by: 'Ann Lee' } : null })),
    files: [{ name: 'guide.md', path: 'docs/guide.md', words: 120, state: 'ready' }, { name: 'notes.md', path: 'docs/notes.md', words: 45, state: 'draft' }, { name: 'cover.png', path: 'docs/cover.png', words: 0, state: 'blocked' }],
    decisions: [{ date: '2026-09-20', change: 'Entered at Draft', by: 'Ann Lee', why: 'The guide is written and has been read once.' }, { date: '2026-09-21', change: 'Moved to Review', by: 'Ann Lee', why: 'Two readers have the draft.' }],
    needs_a_person: [{ level: 'attention', category: 'review', text: 'The cover is missing: add docs/cover.png', where: 'docs/guide.md:5' }, { level: 'info', category: 'review', text: 'Notes are still a draft', where: 'docs/guide.md:1' }] });
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
    'command show release list': { doc: k.detail('release list', 'read', []) },
    'command show release show': { doc: k.detail('release show', 'read', [k.arg('release', 'RELEASE')]) },
    'command show widget show': { doc: k.detail('widget show', 'read', [k.arg('widget', 'WIDGET')]) },
    'widget list': { doc: k.doc('widget-list', 'all', { count: 3, widgets: [
      { id: 'w1', name: 'First widget', kind: 'blue', state: 'ready', parts: 3, note: 'The first one.' },
      { id: 'w2', name: 'Second widget', kind: 'red', state: 'broken', parts: 12, note: 'It needs a fix.' },
      { id: 'w3', name: 'Third widget', kind: 'green', state: 'draft', parts: 1, note: 'Still a draft.' }] }, { links: [widgetLink] }) },
    'widget show w1': { doc: k.doc('widget', 'w1', { name: 'w1', kind: 'blue', state: 'ready', note: 'The first one.', path: 'docs/guide.md', line: 5 }, { actions: [checkAction, fetchAction, advance, waiting] }) },
    'release list': { doc: k.doc('release-list', 'all', { count: 2, releases: [{ id: 'r1', name: 'Spring guide', stage: 'Review', state: 'waiting', files: 3 }, { id: 'r2', name: 'Autumn notes', stage: 'Ship', state: 'ready', files: 8 }] },
      { links: [{ rel: 'release', command: 'release show', fields: { release: 'r1' }, cli: 'other release show r1' }, { rel: 'release', command: 'release show', fields: { release: 'r2' }, cli: 'other release show r2' }] }) },
    'release show r1': { doc: k.doc('release', 'r1', release('r1', 'Spring guide', 'Review'), { actions: [checkAction, fetchAction, advance, waiting] }) },
    'release show r2': { doc: k.doc('release', 'r2', release('r2', 'Autumn notes', 'Ship'), { actions: [checkAction] }) },
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
