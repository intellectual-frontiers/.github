// Learn (0043-if-console FR-031): the repository's help topics in a quick pick, a topic shown as a resource with its steps as buttons.
import test from 'node:test';
import { readManifest } from './support/paths';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { boot, defaultDocs, k, action } from './support/boot';
import * as learn from '../src/model/learn';

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
    'help start': { doc: sectioned },
    'help other': { doc: k.doc('help', 'other', { topic: 'other', summary: 'Another.', plain: 'Words.', sections: {}, steps: [] }) },
  });
}

const sectioned = k.doc('help', 'start', {
  topic: 'start', summary: 'Your first day.', plain: 'Plain words with `code` in them.',
  sections: { '1. Install it yourself': 'Do this on your own.', '2. See that it runs': 'Ask it.\n\n    other check\n    other secret tool\n\nThen that.' },
  steps: [{ label: 'Check it', command: 'check', line: 'other check', note: 'quick' }, { label: 'Set up', command: 'secret tool', line: 'other secret tool', note: 'asks first' },
    { label: 'Install uv', command: '', line: '', note: 'from its own page' }],
}, { actions: [action('Check it', 'check', 'check', {}), terminalOnly, { label: 'Install uv', command: '', fields: {}, category: '', surfaces: [], cli: null, enabled: true }] });

test('FR-031, FR-043: a topic is built from its resource: words, numbered sections, and steps that run, copy or are the person\'s own', () => {
  assert.deepEqual(learn.topicsOf(topicDoc), []);
  const steps = learn.stepsOf(sectioned);
  assert.deepEqual(steps.map((s) => [s.label, s.runnable, s.yourself]), [['Check it', true, false], ['Set up', false, false], ['Install uv', false, true]]);
  assert.match(steps[1].reason, /terminal/);
  assert.match(steps[2].reason, /yourself/);
  const built = learn.buildTopic(sectioned, { topics: [{ topic: 'start', summary: 'x' }, { topic: 'other', summary: 'Another.' }] });
  assert.equal(built.mode, 'topic');
  assert.equal(built.header.title, 'start');
  assert.equal(built.header.kind, 'Learn');
  assert.deepEqual(built.next, { topic: 'other', summary: 'Another.' }, 'the next topic is the one the list gives after this');
  const ids = built.sections.map((x: Loose) => x.type);
  assert.deepEqual(ids, ['text', 'reading', 'lesson']);
  const reading = built.sections[1] as Loose;
  assert.deepEqual(reading.parts.map((p: Loose) => [p.n, p.heading]), [[1, 'Install it yourself'], [2, 'See that it runs']]);
  const code = reading.parts[1].blocks.find((b: Loose) => b.kind === 'code');
  assert.deepEqual(code.lines.map((l: Loose) => [l.text, l.run, Boolean(l.reason)]), [['other check', 0, false], ['other secret tool', undefined, true]], 'a line that is a step gets its Run');
  const lesson = built.sections[2] as Loose;
  assert.deepEqual(lesson.steps.map((x: Loose) => [x.n, x.line, x.run, x.yourself]), [[1, 'other check', 0, false], [2, 'other secret tool', undefined, false], [3, '', undefined, true]]);
  assert.equal(built.held.actions[1].enabled, false, 'a step that runs in a terminal is held disabled, so that no page can run it');
});

test('FR-031, FR-043: Learn lists the repository\'s topics with codicons, shows the one chosen in the panel, and a step\'s Run goes through the one path', async () => {
  const b = await boot({ docs: docs() });
  b.stub.script.quickPicks.push('start');
  await b.command('learn');
  const pick = b.stub.calls.messages.find((m: Loose) => m.kind === 'quickpick' && m.title === 'Learn');
  assert.deepEqual(pick.items.map((i: Loose) => [i.label, i.description]), [['$(book) start', 'Your first day.'], ['$(book) other', 'Another.']]);
  assert.match(pick.items[0].detail, /other help start/, 'each shows the command line behind it');
  const [panel] = b.stub.calls.webviews;
  assert.equal(panel.title, 'start');
  await new Promise((r) => setImmediate(r));
  const view = panel.posted.at(-1).view;
  assert.equal(view.built.mode, 'topic');
  assert.deepEqual(view.built.next, { topic: 'other', summary: 'Another.' });
  assert.match(panel.webview.html, /script-src 'nonce-/, 'the page has the webview policy');
  const before = b.first.invocations().length;
  await panel.onMessage({ type: 'run', action: 1 });   // the terminal-only step: no button runs it
  assert.equal(b.first.invocations().slice(before).filter((i) => i.argv[0] === 'secret').length, 0);
  await panel.onMessage({ type: 'run', action: 99 });  // an index the model does not hold
  await panel.onMessage({ type: 'run', action: 0 });
  assert.ok(b.first.invocations().slice(before).some((i) => i.argv[0] === 'check'), 'the button ran `check` through the launcher');
  await panel.onMessage({ type: 'next' });
  assert.equal(b.stub.calls.webviews.length, 1, 'the next topic opens in the same panel');
  assert.equal(panel.posted.at(-1).view.built.header.title, 'other');
  assert.equal(panel.posted.at(-1).view.nav.canBack, true, 'and back leads to the first');
  b.cleanup();
});

test('FR-031: a repository whose command list has no help is not offered, and Learn says so', async () => {
  const b = await boot();   // the default second command line has no `help`
  await b.command('learn');
  assert.match(b.stub.calls.messages.at(-1).text, /No folder in this window declares|help/);
  assert.equal(b.stub.calls.webviews.length, 0);
  b.cleanup();
});

test('FR-031: Learn is in the palette and in Home\'s Get help, where the command line has help', async () => {
  const manifest = readManifest();
  assert.ok(manifest.contributes.commands.some((c: Loose) => c.command === 'if-console.learn' && c.title === 'Learn a Topic\u2026'));
  assert.ok(manifest.contributes.menus.commandPalette.some((m: Loose) => m.command === 'if-console.learn' && /hasRepository/.test(m.when)));
  const { deriveHome } = require('../src/model/home') as Loose;
  const repo = (has: Loose) => ({ name: 'o', program: './o', state: 'ready', reason: '', checks: new Map(), proposals: [], doctor: null, fresh: null, has: (id: Loose) => has.includes(id), command: () => null, line: (a: string[]) => a.join(' ') });
  const help = (r: Loose) => deriveHome(r).help.map((i: Loose) => i.run.command);
  assert.deepEqual(help(repo(['help', 'context'])), ['if-console.learn', 'if-console.getHelp', 'if-console.copyContext']);
  assert.deepEqual(help(repo([])), ['if-console.getHelp']);
});
