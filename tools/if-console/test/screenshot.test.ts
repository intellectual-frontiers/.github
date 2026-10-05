// The screenshot helper of the real-VS-Code run (0043-if-console FR-045): an X window dump of the display becomes a PNG.
import test from 'node:test';
import assert from 'node:assert';
import type { Loose } from './support/fake-launcher';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
const { readDump, png } = require('../../test/vscode/suite/screenshot') as Loose;

function dump(width: Loose, height: Loose, bgrx: Loose) {
  const header = Buffer.alloc(100 + 4);   // 25 words and a four-byte window name
  const words = { 0: header.length, 1: 7, 2: 2, 3: 24, 4: width, 5: height, 7: 0, 11: 32, 12: width * 4, 19: 0 };
  for (const [i, v] of Object.entries(words)) header.writeUInt32BE(v, Number(i) * 4);
  header.write('x', 100);
  return Buffer.concat([header, bgrx]);
}

test('a 32-bit little-endian dump is read as RGB', () => {
  const file = path.join(os.tmpdir(), `if-console-dump-${process.pid}`);
  fs.writeFileSync(file, dump(2, 1, Buffer.from([1, 2, 3, 0, 4, 5, 6, 0])));
  const { width, height, rgb } = readDump(file);
  fs.unlinkSync(file);
  assert.deepStrictEqual([width, height], [2, 1]);
  assert.deepStrictEqual([...rgb], [3, 2, 1, 6, 5, 4]);
});

test('a PNG has its signature, its size and pixels that inflate to the rows', () => {
  const out = png(2, 1, Buffer.from([3, 2, 1, 6, 5, 4]));
  assert.deepStrictEqual([...out.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.strictEqual(out.readUInt32BE(16), 2);
  assert.strictEqual(out.readUInt32BE(20), 1);
  const idat = out.indexOf('IDAT');
  const len = out.readUInt32BE(idat - 4);
  assert.deepStrictEqual([...zlib.inflateSync(out.subarray(idat + 4, idat + 4 + len))], [0, 3, 2, 1, 6, 5, 4]);
});
