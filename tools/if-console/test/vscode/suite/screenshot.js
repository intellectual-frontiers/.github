'use strict';
// A test-mode helper that captures VS Code's window to a PNG (0043-if-console FR-045). The display server the real-VS-Code run starts
// (Xvfb, which the command line's own setup installs) is started with -fbdir, so it keeps its whole screen in a file as an X window dump (XWD).
// The window is the whole screen: there is no window manager and VS Code fills it. This reads that dump and writes a PNG with Node's own
// zlib, so no program beyond the display server and Node is needed. IF_CONSOLE_SCREEN_DUMP names the dump, IF_CONSOLE_SCREENSHOTS the folder.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

// An RGB image (width x height x 3 bytes) as a PNG.
function png(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) { raw[y * (width * 3 + 1)] = 0; rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

// The XWD file: 25 big-endian 32-bit words, the window's name, a colour map, then the pixels (32 bits each, blue first on a little-endian server).
function readDump(file) {
  const buf = fs.readFileSync(file);
  const be = buf.readUInt32BE(4) === 7;   // the file version
  const word = (i) => (be ? buf.readUInt32BE(i * 4) : buf.readUInt32LE(i * 4));
  const headerSize = word(0), width = word(4), height = word(5), bpp = word(11), stride = word(12), ncolors = word(19), byteOrder = word(7);
  if (bpp !== 32) throw new Error(`the display's pixels are ${bpp} bits; only 32 are read`);
  const base = headerSize + ncolors * 12;
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = base + y * stride + x * 4;
      const o = (y * width + x) * 3;
      if (byteOrder === 0) { rgb[o] = buf[at + 2]; rgb[o + 1] = buf[at + 1]; rgb[o + 2] = buf[at]; } else { rgb[o] = buf[at + 1]; rgb[o + 1] = buf[at + 2]; rgb[o + 2] = buf[at + 3]; }
    }
  }
  return { width, height, rgb };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Capture the screen as <folder>/<name>.png after `settle` milliseconds for VS Code to paint. Returns the file.
async function capture(name, settle = 1200) {
  const dump = process.env.IF_CONSOLE_SCREEN_DUMP;
  const folder = process.env.IF_CONSOLE_SCREENSHOTS;
  if (!dump || !folder) throw new Error('IF_CONSOLE_SCREEN_DUMP and IF_CONSOLE_SCREENSHOTS are not set: the run was not started for screenshots');
  try { await require('vscode').commands.executeCommand('notifications.clearAll'); } catch (e) { /* none to clear */ }   // VS Code's own notices (as root, say) are not the extension's
  await sleep(settle);
  const { width, height, rgb } = readDump(dump);
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${name}.png`);
  fs.writeFileSync(file, png(width, height, rgb));
  return file;
}

module.exports = { capture, readDump, png };
