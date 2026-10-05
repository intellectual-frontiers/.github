// The views each command line declares, merged across repositories by id (0043-if-console FR-036).
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { commandList } from '../src/model/wire';
import { planViews } from '../src/model/viewplan';

const cmd = (id: string, category = 'read', surfaces = ['terminal', 'editor']): Loose => ({ id, category, group: 'g', surfaces, help: 'h' });
function repo(key: string, views: Loose[], nouns: Loose[], commands: Loose[], state = 'ready') {
  const doc = { schema: 'x/command-list@1', audience: 'public', kind: 'command-list', id: 'all', data: { commands, presentation: { views, nouns, references: [] } }, links: [], actions: [] };
  return { key, state, list: commandList(doc as Loose) };
}
const listed = (noun: string, view: string) => ({ noun, title: noun, icon: 'x', view, list: { command: `${noun} list`, rows: 'rows', id: 'id', label: 'id' } });

test('a view is planned for each declared view that holds a noun with something to show, in the order asked, and the editor\'s own Home is not among them', () => {
  const a = repo('a', [{ id: 'specs', title: 'Specs', icon: 'book', order: 20 }, { id: 'builds', title: 'Builds', icon: 'package', order: 40 }, { id: 'empty', title: 'Empty', icon: 'x', order: 30 }],
    [listed('spec', 'specs'), { noun: 'deck', title: 'Deck', icon: 'x', view: 'builds' }, { noun: 'ghost', title: 'Ghost', icon: 'x', view: 'builds' }],
    [cmd('spec list'), cmd('deck build', 'build'), cmd('ghost go', 'read', ['terminal'])]);
  const plan = planViews([a]);
  assert.deepEqual(plan.map((p) => p.id), ['specs', 'builds']);
  assert.deepEqual(plan[1]?.entries[0]?.nouns.map((n) => n.noun), ['deck'], 'a noun with a view but no list shows its commands; one the editor does not offer is left out');
});

test('a view that more than one command line declares is one view, grouped by repository, titled by the lowest order', () => {
  const a = repo('a', [{ id: 'toolchain', title: 'Toolchain', icon: 'tools', order: 50, description: 'a' }], [listed('tc', 'toolchain')], [cmd('tc list')]);
  const b = repo('b', [{ id: 'toolchain', title: 'The toolchain', icon: 'tools', order: 80, description: 'b' }, { id: 'books', title: 'Books', icon: 'book', order: 30 }],
    [listed('tool', 'toolchain'), listed('book', 'books')], [cmd('tool list'), cmd('book list')]);
  const plan = planViews([a, b]);
  assert.deepEqual(plan.map((p) => p.id), ['books', 'toolchain']);
  const merged = plan[1];
  assert.equal(merged?.title, 'Toolchain');
  assert.equal(merged?.description, 'a');
  assert.deepEqual(merged?.entries.map((e) => e.source.key), ['a', 'b']);
});

test('a list that is not a read command the editor offers shows no rows, and a repository that is not ready plans nothing; the pool is the manifest\'s size', () => {
  const a = repo('a', [{ id: 'v', title: 'V', icon: 'x', order: 20 }], [listed('w', 'v')], [cmd('w list', 'read', ['terminal'])]);
  assert.deepEqual(planViews([a]), [], 'a list the editor does not offer, and no other command of the noun, gives the view nothing');
  const c = repo('c', [{ id: 'v', title: 'V', icon: 'x', order: 20 }], [listed('w', 'v')], [cmd('w list')], 'untrusted');
  assert.deepEqual(planViews([c]), []);
  const many = repo('m', Array.from({ length: 20 }, (_, i) => ({ id: `v${i}`, title: `V${i}`, icon: 'x', order: 20 + i })), Array.from({ length: 20 }, (_, i) => listed(`n${i}`, `v${i}`)), Array.from({ length: 20 }, (_, i) => cmd(`n${i} list`)));
  assert.equal(planViews([many]).length, 16);
  assert.equal(planViews([many], 3).length, 3);
});
