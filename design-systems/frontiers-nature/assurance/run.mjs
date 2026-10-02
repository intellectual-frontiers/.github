#!/usr/bin/env node
/*
 * Headless runner for the assurance page. No dependencies of its own: it serves this design system's
 * directory over http, opens assurance/index.html in Chromium through Playwright (found on NODE_PATH, in
 * the current project's node_modules, or at PLAYWRIGHT_MODULE), prints the report and exits non-zero on failure.
 *
 *   node assurance/run.mjs                 run every suite
 *   node assurance/run.mjs --suite layout  run suites whose name contains "layout"
 *   node assurance/run.mjs --shots DIR     also screenshot every fixture at 390, 900 and 1400 px into DIR
 *   CHROMIUM=/path/to/chrome               use a specific browser binary
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, process.cwd(), "/opt/node-tools/node_modules", ...(process.env.NODE_PATH || "").split(path.delimiter)].filter(Boolean);
  for (const base of candidates) {
    try { return createRequire(path.join(base, "noop.js"))("playwright"); } catch { /* try the next location */ }
  }
  console.error("Playwright not found. Install it (npm i -D playwright) or set PLAYWRIGHT_MODULE to a directory that contains it.");
  process.exit(2);
}
function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    for (const dir of fs.readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
      const exe = path.join(base, dir, "chrome-linux", "chrome");
      if (fs.existsSync(exe)) return exe;
    }
  } catch { /* fall through to Playwright's own lookup */ }
  return undefined;
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const file = path.join(root, path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(data);
  });
}).listen(0, "127.0.0.1");
await new Promise((resolve) => server.on("listening", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: findChromium() });
let exitCode = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`console error: ${m.text()}`); });
  const suite = opt("--suite");
  await page.goto(`${origin}/assurance/index.html${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`);
  await page.waitForFunction(() => window.__assurance?.done === true, null, { timeout: 180000 });
  const results = await page.evaluate(() => window.__assurance);
  for (const s of results.suites) {
    const failed = s.tests.filter((t) => t.status === "fail"), skipped = s.tests.filter((t) => t.status === "skip");
    console.log(`${failed.length ? "FAIL" : "ok  "} ${s.name}  (${s.tests.length - failed.length - skipped.length} passed${failed.length ? `, ${failed.length} failed` : ""}${skipped.length ? `, ${skipped.length} skipped` : ""})`);
    for (const t of failed) console.log(`     ✗ ${t.title}\n       ${t.detail}`);
  }
  console.log(`\n${results.passed} passing, ${results.failed} failing, ${results.skipped} skipped`);
  if (problems.length) { console.log("\nBrowser reported problems:\n  " + problems.join("\n  ")); }
  if (results.failed || problems.length) exitCode = 1;

  const shots = opt("--shots");
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    const fixtures = await page.evaluate(() => window.Assurance.FIXTURES);
    for (const fixture of fixtures) {
      const name = fixture.split("/").pop().replace(/\.html$/, "");
      for (const width of [390, 900, 1400]) {
        const p = await browser.newPage({ viewport: { width, height: 900 } });
        await p.goto(`${origin}/${fixture}`);
        await p.evaluate(() => document.fonts.ready);
        await p.screenshot({ path: path.join(shots, `${name}-${width}.png`), fullPage: width === 1400 });
        await p.close();
      }
    }
    console.log(`screenshots written to ${shots}`);
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
