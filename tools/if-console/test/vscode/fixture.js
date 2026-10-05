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
    cmd('site generate', 'generate', ed, 'Rewrite the site page'), cmd('period advance', 'decision', ['terminal', 'editor'], 'Close the period'),
    cmd('widget list', 'read', ed, 'List widgets'), cmd('widget show', 'read', ed, 'Show a widget'), cmd('secret tool', 'setup', ['terminal'], 'Not for the editor')] });
  const change = (p) => ({ path: p, change: 'modify', added: 1, removed: 1, diff: ['--- before', '+++ after', '@@ -1 +1 @@', '-old', '+new'] });
  const checkDoc = k.check([
    { name: 'docs', status: 'failed', findings: [k.finding], notes: [], data: {} },
    { name: 'links', status: 'passed', findings: [], notes: [], data: {} }]);
  const widgetLink = { rel: 'widget', command: 'widget show', fields: { widget: 'w1' }, cli: 'other widget show w1' };
  const docs = {
    'command list': { doc: list },
    'command show check': { doc: k.detail('check', 'check', [k.arg('sections', 'SECTION', { many: true, required: false, choices: ['docs', 'links'] })], []) },
    'command show doctor': { doc: k.detail('doctor', 'check', []) },
    'command show fresh': { doc: k.detail('fresh', 'check', []) },
    'command show site generate': { doc: k.detail('site generate', 'generate', []) },
    'command show period advance': { doc: k.detail('period advance', 'decision', []) },
    'command show widget list': { doc: k.detail('widget list', 'read', []) },
    'command show widget show': { doc: k.detail('widget show', 'read', [k.arg('widget', 'WIDGET')]) },
    'widget list': { doc: k.doc('widget-list', 'all', { count: 1 }, { links: [widgetLink] }) },
    'site generate --dry-run': { doc: k.doc('site', 'generate', { dry_run: true, changes: [change('site/index.txt')] }) },
    'site generate': { doc: k.doc('site', 'generate', { dry_run: false, changes: [change('site/index.txt')] }) },
    'period advance --dry-run': { doc: k.doc('period', 'advance', { dry_run: true, changes: [change('site/index.txt')] }) },
    'period advance': { doc: k.doc('period', 'advance', { dry_run: false, changes: [change('site/index.txt')] }) },
    'check --changed': { doc: checkDoc, exit: 1 }, check: { doc: checkDoc, exit: 1 }, 'check docs': { doc: checkDoc, exit: 1 },
    doctor: { doc: k.doc('doctor', 'other', { status: 'ok', toolchain: [], conflicts: [] }) },
  };
  const repo = makeRepo({ docs });
  fs.mkdirSync(path.join(repo.root, 'docs'));
  fs.writeFileSync(path.join(repo.root, 'docs', 'guide.md'), '# Guide\n\nSee [this](nowhere.md).\n\nMore text.\n');
  fs.mkdirSync(path.join(repo.root, 'site'));
  fs.writeFileSync(path.join(repo.root, 'site', 'index.txt'), 'old\n');
  return repo;
}

module.exports = { make };
