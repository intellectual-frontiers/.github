// The bundle the package ships (dist/extension.js, 0043-if-console FR-035) is the extension: loaded under the stand-in API, it activates, registers every
// command the manifest contributes and exports nothing. It is skipped where no bundle has been built beside the tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { defaultDocs } from './support/boot';
import { makeRepo, type Loose } from './support/fake-launcher';
import { createStub, folderOf, install } from './support/vscode-stub';
import { EXT_ROOT } from './support/paths';

const bundle = path.join(EXT_ROOT, 'dist', 'extension.js');
const skip = fs.existsSync(bundle) ? false : 'dist/extension.js has not been built';

test('FR-035: the bundle activates under the stand-in, registers every contributed command and exports no API', { skip }, async () => {
  const fake = makeRepo({ docs: defaultDocs() });
  const stub = createStub({ folders: [folderOf('first', fake.root)] });
  const restore = install(stub);
  delete require.cache[bundle];
  const ext = require(bundle) as Loose;
  const context: { subscriptions: Loose[] } = { subscriptions: [] };
  try {
    assert.equal(await ext.activate(context), undefined);
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, 'package.json'), 'utf8')) as Loose;
    assert.deepEqual([...stub.calls.registered.keys()].sort(), manifest.contributes.commands.map((c: Loose) => c.command).sort());
    assert.ok(fake.invocations().some((i) => i.argv.join(' ') === 'command list --json'), 'it asked the launcher for its command list');
    assert.deepEqual(Object.keys(ext).sort(), ['activate', 'deactivate']);
  } finally {
    context.subscriptions.forEach((s) => { try { s.dispose(); } catch { /* ignore */ } });
    ext.deactivate();
    restore();
    delete require.cache[bundle];
    fake.cleanup();
  }
});
