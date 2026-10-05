// What a launcher said about itself is asked once and kept, until the launcher changes on disk (the registry cache, invalidated by the file system
// watcher of each repository's launcher), and one cancellation source ends a launcher's process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './support/boot';
import type { Loose } from './support/fake-launcher';
import { CancelSource } from '../src/services/cancellation';

const asked = (b: Loose, line: string): number => b.first.invocations().filter((i: Loose) => i.argv.join(' ') === line).length;

test('FR-005: a command\'s description is asked of the launcher once, and again when the launcher\'s file changes', async () => {
  const b = await boot();
  const repo = b.context.subscriptions.find((s: Loose) => s.id === 'if-console.commands').o.treeDataProvider.host.repos[0];
  await repo.detail('widget show');
  await repo.detail('widget show');
  assert.equal(asked(b, 'command show widget show --json'), 1, 'the second read came from the cache');
  const generation = repo.registry.generation;

  const watcher = b.stub.calls.watchers.find((w: Loose) => w.pattern.pattern === 'other');
  assert.ok(watcher, 'the launcher is watched');
  assert.equal(watcher.pattern.base.name, 'first', 'relative to its own folder');
  watcher.fire('change');
  await new Promise((r) => setTimeout(r, 400));
  assert.ok(repo.registry.generation > generation, 'the cache was emptied');
  assert.equal(asked(b, 'command list --json'), 2, 'the launcher was asked for its command list again');
  await repo.detail('widget show');
  assert.equal(asked(b, 'command show widget show --json'), 2, 'and its descriptions are read again');
  b.cleanup();
});

test('FR-017: a launcher\'s watcher goes when the repository does, and the declaration is watched across the window', async () => {
  const b = await boot();
  const patterns = b.stub.calls.watchers.map((w: Loose) => (typeof w.pattern === 'string' ? w.pattern : w.pattern.pattern));
  assert.deepEqual(patterns.sort(), ['**/.if-console.env', 'other']);
  b.cleanup();
  assert.ok(b.stub.calls.watchers.every((w: Loose) => w.disposed), 'every watcher was disposed with the extension');
});

test('FR-020: a cancellation source ends what listens to its token, once', () => {
  const source = new CancelSource();
  let heard = 0;
  const sub = source.token.onCancellationRequested(() => { heard += 1; });
  assert.equal(source.token.isCancellationRequested, false);
  source.cancel();
  source.cancel();
  assert.equal(heard, 1);
  assert.equal(source.token.isCancellationRequested, true);
  sub.dispose();
});
