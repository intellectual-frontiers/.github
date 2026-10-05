import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { boot, defaultDocs, k } from './support/boot';
import * as path from 'path';

test('FR-011: a read command\'s rendering opens in a webview with a policy that allows no remote and no outside script', async () => {
  const docs = defaultDocs({ 'widget show w1': { doc: k.doc('widget', 'w1', {}), html: '<!doctype html><html><head><title>w</title></head><body><script src="https://evil.example/x.js"></script><p>w1</p><a href="README.md">file</a></body></html>' } });
  const b = await boot({ docs });
  const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
  const roots = await tree.getChildren();
  const noun = (await tree.getChildren(roots[0])).find((n: Loose) => n.kind === 'noun');
  const w1 = (await tree.getChildren(noun)).find((n: Loose) => n.kind === 'resource' && n.data.label === 'w1');
  await b.command('activateNode', w1);
  const panel = b.stub.calls.webviews[0];
  assert.ok(panel, 'a panel opened');
  const html = panel.webview.html;
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /evil\.example/, 'a script from outside is removed');
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|http:|https:/);
  const nonce = /script-src 'nonce-([0-9a-f]+)'/.exec(html)?.[1];
  assert.equal([...html.matchAll(/<script/g)].length, 1, 'one script: this extension\'s own');
  assert.ok(html.includes(`<script nonce="${nonce}">`));
  assert.match(html, /var\(--vscode-foreground\)/);
  assert.equal(panel.opts.enableCommandUris, false);
  assert.equal(panel.opts.localResourceRoots.length, 1);
  assert.deepEqual(b.first.invocations().filter((i) => i.argv.includes('--html')).map((i) => i.argv.join(' ')), ['widget show w1 --html']);
  b.cleanup();
});

test('FR-011: a link is followed only if it names a file in the clone or a command', () => {
  const { classifyLink } = require('../src/views/webview') as Loose;
  const root = '/clone';
  assert.deepEqual(classifyLink('docs/a.md', root), { kind: 'file', file: path.resolve(root, 'docs/a.md') });
  assert.equal(classifyLink('../etc/passwd', root).kind, 'ignored');
  assert.equal(classifyLink('/etc/passwd', root).kind, 'ignored');
  assert.equal(classifyLink('https://example.org/', root).kind, 'ignored');
  assert.equal(classifyLink('javascript:alert(1)', root).kind, 'ignored');
  assert.equal(classifyLink('#top', root).kind, 'ignored');
  assert.deepEqual(classifyLink('if-console:widget%20show%20w1', root), { kind: 'command', words: ['widget', 'show', 'w1'] });
  assert.equal(classifyLink('file:///clone/x.md', root).kind, 'file');
  assert.equal(classifyLink('file:///elsewhere/x.md', root).kind, 'ignored');
});
