'use strict';
// Learn (0043-if-console FR-031): the repository's help topics in a quick pick, a topic shown as a resource with its steps as buttons.
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, defaultDocs, k, action } = require('./support/boot');
const learn = require('../src/learn');

const helpCommand = { id: 'help', category: 'read', group: 'g', surfaces: ['terminal', 'editor', 'mcp'], help: 'Explain the daily work' };
const withHelp = { ...k.list, data: { ...k.list.data, count: k.list.data.count + 1, commands: [...k.list.data.commands, helpCommand] } };
const terminalOnly = { label: 'Set up', command: 'secret tool', fields: {}, category: 'setup', surfaces: ['terminal'], cli: 'other secret tool', enabled: true };
const topicDoc = k.doc('help', 'start', {
  topic: 'start', summary: 'Your first day.', plain: 'Plain & <simple> words.',
  sections: { '1. First': 'Do this.\n\n    other check\n\nThen that.' },
  steps: [{ label: 'Check it', command: 'check', line: 'other check', note: '' }, { label: 'Set up', command: 'secret tool', line: 'other secret tool', note: 'asks first' }],
}, { actions: [action('Check it', 'check', 'check', {}), terminalOnly] });

function docs() {
  return defaultDocs({
    'command list': { doc: withHelp },
    'command show help': { doc: k.detail('help', 'read', [k.arg('topic', 'TOPIC', { required: false })]) },
    help: { doc: k.doc('help-list', 'all', { count: 2, topics: [{ topic: 'start', summary: 'Your first day.' }, { topic: 'other', summary: 'Another.' }] }) },
    'help start': { doc: topicDoc },
  });
}

test('FR-031: the topics are read from the resource, and a step is a button only where the editor can run it', () => {
  assert.deepEqual(learn.topicsOf(topicDoc), []);
  const steps = learn.stepsOf(topicDoc);
  assert.deepEqual(steps.map((s) => [s.label, s.runnable]), [['Check it', true], ['Set up', false]]);
  assert.match(steps[1].reason, /terminal/);
  const page = learn.topicPage(topicDoc);
  assert.match(page, /<h1>start<\/h1>/);
  assert.match(page, /Plain &amp; &lt;simple&gt; words\./, 'text is escaped');
  assert.match(page, /<pre><code>other check<\/code><\/pre>/, 'an indented line is code');
  assert.match(page, /<button type="button" data-step="0">Check it<\/button>/);
  assert.match(page, /<button type="button" data-step="1" disabled title="[^"]+">Set up<\/button>/);
  assert.match(page, /<code>other check<\/code>/, 'each step shows the line to paste');
});

test('FR-031: Learn lists the repository\'s topics, shows the one chosen, and a button runs its step through the one path', async () => {
  const b = await boot({ docs: docs() });
  b.stub.script.quickPicks.push('start');
  await b.command('learn');
  const pick = b.stub.calls.messages.find((m) => m.kind === 'quickpick' && m.title === 'Learn');
  assert.deepEqual(pick.items.map((i) => i.label), ['start', 'other']);
  const [panel] = b.stub.calls.webviews;
  assert.equal(panel.title, 'other: start');
  assert.match(panel.webview.html, /data-step="0"/);
  assert.match(panel.webview.html, /script-src 'nonce-/, 'the page has the webview policy');
  const before = b.first.invocations().length;
  await panel.onMessage({ step: 1 });   // the terminal-only step: no button runs it
  assert.equal(b.first.invocations().slice(before).filter((i) => i.argv[0] === 'secret').length, 0);
  await panel.onMessage({ step: 0 });
  assert.ok(b.first.invocations().slice(before).some((i) => i.argv[0] === 'check'), 'the button ran `check` through the launcher');
  b.cleanup();
});

test('FR-031: a repository whose command list has no help is not offered, and Learn says so', async () => {
  const b = await boot();   // the default second command line has no `help`
  await b.command('learn');
  assert.match(b.stub.calls.messages.at(-1).text, /No folder in this window declares|help/);
  assert.equal(b.stub.calls.webviews.length, 0);
  b.cleanup();
});

test('FR-031: Learn is in the palette and a chore', async () => {
  const manifest = require('../package.json');
  assert.ok(manifest.contributes.commands.some((c) => c.command === 'if-console.learn' && c.title === 'Learn'));
  assert.ok(manifest.contributes.menus.commandPalette.some((m) => m.command === 'if-console.learn' && /hasRepository/.test(m.when)));
  const { deriveChores } = require('../src/chores');
  const repo = (has) => ({ list: { commands: [] }, editorCommands: () => [], has: (id) => has.includes(id), checks: new Map(), proposals: [], doctor: null, fresh: null });
  const help = (r) => deriveChores(r).find((g) => g.id === 'help').items.map((i) => i.label);
  assert.deepEqual(help(repo(['help'])), ['Learn', 'Get Help', 'Copy Context']);
  assert.deepEqual(help(repo([])), ['Get Help', 'Copy Context']);
});
