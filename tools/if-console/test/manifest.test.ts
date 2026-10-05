// The manifest's contributions (0043-if-console FR-036, FR-037, FR-038, FR-039, FR-024): the views, the welcome content, the commands'
// categories, titles and icons, the keys, the menus' groups and the settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import type { Loose } from './support/fake-launcher';
import { EXT_ROOT } from './support/paths';

const manifest = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, 'package.json'), 'utf8')) as Loose;
const c = manifest.contributes as Loose;
const COMMANDS = c.commands as Loose[];

test('FR-036: the activity bar has one container with a monochrome icon, and its views are Home, the slots, Checks and All commands, in that order', () => {
  assert.equal(c.viewsContainers.activitybar.length, 1);
  const svg = fs.readFileSync(path.join(EXT_ROOT, c.viewsContainers.activitybar[0].icon), 'utf8');
  assert.match(svg, /currentColor/);
  assert.doesNotMatch(svg, /#[0-9a-f]{3,8}\b|fill="(?!none|currentColor)|stroke="(?!none|currentColor)/i, 'it draws in no color of its own');
  const ids = c.views['if-console'].map((v: Loose) => v.id);
  assert.equal(ids[0], 'if-console.home');
  assert.deepEqual(ids.slice(1, -2), Array.from({ length: 16 }, (_, i) => `if-console.view.${i}`));
  assert.deepEqual(ids.slice(-2), ['if-console.checks', 'if-console.commands']);
  const slots = c.views['if-console'].filter((v: Loose) => /\.view\./.test(v.id));
  assert.ok(slots.every((v: Loose, i: number) => v.when === `if-console.slot.${i}`), 'a slot shows only when a view is planned into it');
  assert.match(c.views['if-console'].at(-1).when, /allCommands/);
});

test('FR-037: Home has welcome content, with buttons, for no command line, an untrusted workspace and a missing toolchain', () => {
  const home = c.viewsWelcome.filter((w: Loose) => w.view === 'if-console.home');
  const when = (re: RegExp) => home.find((w: Loose) => re.test(w.when));
  assert.ok(when(/hasRepository/) && when(/untrusted/) && when(/toolchainMissing/));
  for (const w of home) assert.match(w.contents, /\]\(command:[a-zA-Z.]+/, 'each has a button');
  assert.match(home.find((w: Loose) => w.when === 'if-console.untrusted').contents, /\(command:if-console\.trust\)/);
  assert.match(home.find((w: Loose) => w.when.endsWith(' && if-console.toolchainMissing')).contents, /doctor/);
});

test('FR-039: every command has the category IF Console, a title that is a verb and an object, an icon and a when or an enablement', () => {
  const palette = Object.fromEntries(c.menus.commandPalette.map((m: Loose) => [m.command, m]));
  for (const cmd of COMMANDS) {
    assert.equal(cmd.category, 'IF Console', cmd.command);
    assert.ok(cmd.icon && /^\$\([a-z-]+\)$/.test(cmd.icon), `${cmd.command} has an icon`);
    assert.ok(cmd.title.replace('…', '').trim().split(/\s+/).length >= 2, `${cmd.command}: ${cmd.title}`);
    assert.ok(cmd.enablement || palette[cmd.command]?.when, `${cmd.command} is offered only when it can run`);
  }
  const titles = COMMANDS.map((x) => x.title);
  for (const want of ['Show Home', 'Run Command…', 'Run Check…', 'Learn a Topic…', 'Copy Context…']) assert.ok(titles.includes(want), want);
});

test('FR-039, FR-015: the keys are for Home, Run Check, Learn and Copy Context only, and no key runs a decision or a write', () => {
  const keys = c.keybindings as Loose[];
  assert.deepEqual(keys.map((k) => k.command).sort(), ['if-console.check', 'if-console.copyContext', 'if-console.learn', 'if-console.showHome']);
  for (const k of keys) assert.match(k.when, /hasRepository/);
  const reads = new Set(['if-console.showHome', 'if-console.check', 'if-console.learn', 'if-console.copyContext', 'if-console.doctor', 'if-console.checkOnChanges']);
  for (const k of keys) assert.ok(reads.has(k.command));
  assert.ok(!keys.some((k) => /runCommand|runSuggestion|followLink|activateNode|runRowAction/.test(k.command)));
});

test('FR-038: a row\'s menus are in the groups inline, navigation, 1_run, 2_copy and 9_cutcopypaste, each command in them is one the code registers, and the palette hides them', () => {
  const groups = new Set<string>();
  const palette = Object.fromEntries(c.menus.commandPalette.map((m: Loose) => [m.command, m]));
  for (const m of c.menus['view/item/context'] as Loose[]) {
    groups.add(m.group.split('@')[0]);
    assert.ok(COMMANDS.some((x) => x.command === m.command), m.command);
  }
  assert.deepEqual([...groups].sort(), ['1_run', '2_copy', '9_cutcopypaste', 'inline', 'navigation']);
  for (const hidden of ['runSuggestion', 'openRow', 'copyCommandLine', 'followLink']) assert.equal(palette[`if-console.${hidden}`].when, 'false');
  const titleActions = (c.menus['view/title'] as Loose[]).filter((m) => m.group.startsWith('navigation'));
  assert.ok(titleActions.length >= 6, 'the views have title actions with icons');
  for (const m of titleActions) assert.ok(COMMANDS.find((x) => x.command === m.command)?.icon, m.command);
});

test('FR-024, FR-040: each setting has a markdownDescription and the scope application; the code reads no other', () => {
  const props = c.configuration.properties as Record<string, Loose>;
  assert.deepEqual(Object.keys(props).sort(), ['if-console.checkOnSave', 'if-console.launchers', 'if-console.rowLimit', 'if-console.showAllCommands']);
  for (const p of Object.values(props)) { assert.equal(p.scope, 'application'); assert.ok(p.markdownDescription.length > 20); }
  assert.equal(props['if-console.showAllCommands'].default, false, 'All commands is hidden by default');
});
