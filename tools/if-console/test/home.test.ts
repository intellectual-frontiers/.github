// Home (0043-if-console FR-037, FR-048): what needs a person, derived from the launcher's own resources, and the owner's rule that every item is
// actionable: plain words, the exact command line and a way to run it, or what the person must do themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { commandIn, countOf, deriveHome, type HomeSource } from '../src/model/home';

const exposed = new Set(['check', 'fresh', 'doctor', 'toolchain ensure', 'proposal show', 'help', 'context']);

function source(over: Partial<HomeSource> = {}): HomeSource {
  return {
    name: 'other', program: './other', state: 'ready', reason: '', checks: new Map(), fresh: null, doctor: null, proposals: null,
    has: (id) => exposed.has(id),
    command: (id) => (exposed.has(id) ? { id, words: id.split(' '), noun: null, verb: id, category: 'read', group: null, surfaces: ['terminal', 'editor'], help: '', title: null, icon: null } : null),
    line: (argv) => ['./other', ...argv].join(' '),
    ...over,
  };
}
const doc = (kind: string, data: Loose, actions: Loose[] = []): Loose => ({ schema: `other/${kind}@1`, audience: 'private', kind, id: 'x', data, links: [], actions });
const act = (label: string, command: string, category: string, fields: Loose = {}, cli: string | null = `other ${command}`): Loose =>
  ({ label, command, fields, category, surfaces: ['editor'], cli, enabled: true });
const finding = (where: string) => ({ level: 'error', where, message: `broken at ${where}`, next: `edit ${where}, then run \`check docs\`` });

test('a failed section is a suggestion with its problems counted, its exact command line and a Run that runs the section again', () => {
  const home = deriveHome(source({ checks: new Map([['docs', { status: 'failed', reason: '', findings: [finding('a.md:1'), finding('b.md:2')] }], ['links', { status: 'passed', reason: '', findings: [] }]]) }));
  const mine = home.needs.filter((x) => x.group === 'checks');
  assert.equal(mine.length, 1, 'a passed section needs nothing');
  const s = mine[0] as Loose;
  assert.equal(s.label, 'docs: 2 problems to fix');
  assert.equal(s.status, 'error');
  assert.equal(s.commandLine, './other check docs');
  assert.deepEqual(s.run, { kind: 'section', section: 'docs' });
  assert.equal(s.runLabel, 'Run check docs again');
  assert.equal(s.findings.length, 2);
  assert.equal(countOf(home.needs), 1);
});

test('a section that passed with warnings is a warning; a window where nothing was checked says so and offers the cheap check, and does not count', () => {
  const warned = deriveHome(source({ checks: new Map([['docs', { status: 'passed', reason: '', findings: [{ level: 'warning', where: 'a.md', message: 'm', next: '' }] }]]) }));
  assert.equal((warned.needs[0] as Loose).status, 'warning');
  assert.equal((warned.needs[0] as Loose).label, 'docs: 1 warning');
  const none = deriveHome(source());
  const first = none.needs[0] as Loose;
  assert.equal(first.label, 'Nothing checked yet');
  assert.equal(first.commandLine, './other check --changed');
  assert.deepEqual(first.run, { kind: 'words', words: ['check', '--changed'] });
  assert.equal(countOf(none.needs), 0, 'a suggestion to look is not something that needs a person');
});

test('open proposals wait for a decision: the link\'s own command line, opened as a resource, counted', () => {
  const link = { rel: 'proposal', command: 'proposal show', fields: { proposal: 'p1' }, cli: './other proposal show p1' };
  const home = deriveHome(source({ proposals: [link] }));
  const s = home.needs.find((x) => x.group === 'proposals') as Loose;
  assert.equal(s.label, 'p1 waits for your decision');
  assert.equal(s.status, 'pending');
  assert.equal(s.commandLine, './other proposal show p1');
  assert.deepEqual(s.run, { kind: 'resource', link });
  assert.ok(s.counts);
});

test('stale generated files come with the rewriting action, which runs through the dry-run diff; a fresh not yet run is an offer', () => {
  const rewrite = act('rewrite what theme writes', 'brand build', 'generate', { brand: 'x' }, 'other brand build x');
  const prove = act('prove theme again', 'fresh', 'check');
  const stale = deriveHome(source({ fresh: doc('fresh', { status: 'stale', generators: [{ name: 'theme', status: 'stale', stale: [{ path: 'a', why: 'differs' }] }] }, [rewrite, prove]) }));
  const s = stale.needs.find((x) => x.group === 'generated') as Loose;
  assert.equal(s.commandLine, 'other brand build x');
  assert.equal(s.run.kind, 'action');
  assert.match(s.why, /1 generated file no longer matches its source/);
  assert.equal(stale.needs.filter((x) => x.group === 'generated').length, 1, 'a check action is not a rewrite');
  const never = deriveHome(source()).needs.find((x) => x.group === 'generated') as Loose;
  assert.equal(never.label, 'Generated files not proved yet');
  assert.equal(never.counts, false);
});

test('doctor: a toolchain entry not fetched is fetched by its own action; one with a hint that names an offered command runs it; one with neither says what to do', () => {
  const d = doc('doctor', { status: 'missing', conflicts: [], missing: [], toolchain: [
    { entry: 'chromium', cache: 'not fetched', 'needed by': ['check x'], hint: '' },
    { entry: 'jre', cache: 'not fetched', hint: 'fetched on first use, or `other toolchain ensure jre`' },
    { entry: 'weird', cache: 'no build', hint: 'set AGORA_WEIRD to a program of your own' },
    { entry: 'fine', cache: 'ready' }] }, [act('fetch chromium', 'toolchain ensure', 'setup', { entries: ['chromium'] }, 'other toolchain ensure chromium')]);
  const needs = deriveHome(source({ doctor: d })).needs;
  const byId = (id: string) => needs.find((x) => x.id === id) as Loose;
  assert.equal(needs.filter((x) => x.group === 'toolchain').length, 3);
  assert.equal(byId('toolchain:chromium').run.kind, 'action');
  assert.equal(byId('toolchain:chromium').commandLine, 'other toolchain ensure chromium');
  assert.match(byId('toolchain:chromium').why, /Needed by: check x/);
  assert.deepEqual(byId('toolchain:jre').run, { kind: 'words', words: ['toolchain', 'ensure', 'jre'] });
  assert.equal(byId('toolchain:jre').commandLine, './other toolchain ensure jre');
  assert.equal(byId('toolchain:weird').run.kind, 'words', 'doctor again');
  assert.match(byId('toolchain:weird').yourself, /AGORA_WEIRD/);
});

test('doctor: system libraries that only a terminal installs are a command line to copy and what the person does themselves; conflicts and a missing prerequisite say how to fix them', () => {
  const d = doc('doctor', { status: 'failed', conflicts: ['two commands are named check'], missing: ['uv'], toolchain: [], prerequisites: [{ name: 'uv', present: false, hint: 'install uv from https://example.test' }],
    'system libraries': { missing: ['libx (pkg-x)', 'liby (pkg-y)'], hint: 'run `other system ensure` once (it asks before sudo)' } });
  const needs = deriveHome(source({ doctor: d })).needs;
  const libs = needs.find((x) => x.id === 'libraries') as Loose;
  assert.equal(libs.commandLine, './other system ensure');
  assert.match(libs.yourself, /terminal/);
  assert.match(libs.label, /2 system libraries missing: libx \(pkg-x\), liby \(pkg-y\)/);
  const conflict = needs.find((x) => x.group === 'health' && x.status === 'error' && x.label.includes('two commands')) as Loose;
  assert.match(conflict.yourself, /doctor again/);
  assert.equal(conflict.commandLine, './other doctor');
  const uv = needs.find((x) => x.id === 'prerequisite:uv') as Loose;
  assert.match(uv.yourself, /install uv/);
});

test('an untrusted workspace and a command line that answers in a newer form are each a suggestion with its one action', () => {
  const untrusted = deriveHome(source({ state: 'untrusted', reason: 'VS Code does not trust this workspace.' })).needs;
  assert.equal(untrusted.length, 1);
  assert.deepEqual((untrusted[0] as Loose).run, { kind: 'ext', command: 'if-console.trust' });
  assert.match((untrusted[0] as Loose).yourself, /only you can make/);
  const update = deriveHome(source({ state: 'update', reason: 'newer form' })).needs;
  assert.deepEqual((update[0] as Loose).run, { kind: 'ext', command: 'workbench.extensions.action.checkForUpdates' });
});

test('FR-048: every suggestion says what is wrong in plain words and is either runnable or says what the person does themselves; none points elsewhere', () => {
  const d = doc('doctor', { status: 'failed', conflicts: ['x conflicts'], missing: ['thing'], toolchain: [{ entry: 'a', cache: 'not fetched' }, { entry: 'b', cache: 'no build', hint: 'set B' }],
    prerequisites: [{ name: 'uv', present: false, hint: 'install uv' }], 'system libraries': { missing: ['libz'], hint: 'run `other system ensure`' },
    state: [{ label: 'repository', level: 'warning', note: '3 commits behind', advice: 'pull it' }] });
  const link = { rel: 'proposal', command: 'proposal show', fields: { proposal: 'p1' }, cli: './other proposal show p1' };
  const everything = [
    deriveHome(source({ doctor: d, proposals: [link], checks: new Map([['docs', { status: 'failed', reason: '', findings: [finding('a.md:1')] }]]), fresh: doc('fresh', { status: 'stale', generators: [] }) })),
    deriveHome(source({ state: 'untrusted', reason: 'r' })), deriveHome(source({ state: 'update', reason: 'r' })), deriveHome(source())];
  let n = 0;
  for (const home of everything) for (const s of [...home.needs, ...home.help]) {
    n += 1;
    assert.ok(s.label.length > 8, s.id);
    assert.ok(s.run !== null || (s.yourself ?? '') !== '', `${s.id} can be run, or says what the person does`);
    assert.ok(s.commandLine !== null || s.yourself !== null || s.run?.kind === 'ext' || s.run?.kind === 'action', `${s.id} has its command line, or says what the person does`);
    const words = [s.label, s.why, s.yourself ?? '', s.runLabel].join(' ');
    assert.doesNotMatch(words, /\bsee below\b|\bsuggestion below\b|\ba suggestion\b|\bbelow\b|\bsee above\b/i, s.id);
    if (s.run?.kind === 'ext') assert.ok(['if-console.trust', 'if-console.learn', 'if-console.getHelp', 'if-console.copyContext', 'workbench.extensions.action.checkForUpdates'].includes(s.run.command));
  }
  assert.ok(n > 12);
});

test('what needs a person is sorted worst first, and Get help is its own group, only for a repository that is ready', () => {
  const d = doc('doctor', { status: 'missing', toolchain: [{ entry: 'a', cache: 'not fetched' }], conflicts: ['bad'] });
  const home = deriveHome(source({ doctor: d, fresh: doc('fresh', { status: 'fresh', generators: [] }), checks: new Map([['docs', { status: 'passed', reason: '', findings: [{ level: 'warning', where: 'a', message: 'm', next: '' }] }]]) }));
  assert.deepEqual(home.needs.map((s) => s.status), ['error', 'warning', 'warning']);
  assert.deepEqual(home.help.map((s) => s.id), ['help:learn', 'help:report', 'help:context']);
  assert.deepEqual(deriveHome(source({ state: 'untrusted', reason: 'r' })).help, []);
});

test('a command in backticks in a hint is read with the orchestrator\'s own name replaced by the launcher\'s path', () => {
  assert.deepEqual(commandIn('run `other system ensure` once', { name: 'other', program: './other' }), { line: './other system ensure', words: ['system', 'ensure'] });
  assert.equal(commandIn('no command here', { name: 'other', program: './other' }), null);
});
