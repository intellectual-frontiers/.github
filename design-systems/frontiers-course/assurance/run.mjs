#!/usr/bin/env node
/*
 * frontiers-course's browser harness (spec FR-014): builds the fixture course's web edition with build.py under a
 * brand, serves it, and in Chromium checks every page at phone and desktop width: no horizontal scroll, one h1,
 * every image loaded and described, the brand's sans loaded, every text's contrast against what it sits on at least
 * 4.5:1 (feedback included), the skip link first, and every item graded right when answered as its key says.
 *
 *   node assurance/run.mjs [--brand SLUG] [--shots DIR]
 *
 * Needs Python 3 (for build.py), Playwright and Chromium, found as frontiers-slides' harness finds them.
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const system = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const brand = opt("--brand") || "frontiers-brand";

function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, process.cwd(), ...(process.env.NODE_PATH || "").split(path.delimiter)].filter(Boolean);
  for (const base of candidates) {
    try { return createRequire(path.join(base, "noop.js"))("playwright"); } catch { /* try the next location */ }
  }
  console.error("Playwright not found. Install it (npm i -D playwright) or set PLAYWRIGHT_MODULE to a directory that contains it.");
  process.exit(2);
}
function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base) return undefined; // Playwright's own lookup
  try {
    for (const dir of fs.readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
      const exe = path.join(base, dir, "chrome-linux", "chrome");
      if (fs.existsSync(exe)) return exe;
    }
  } catch { /* fall through to Playwright's own lookup */ }
  return undefined;
}

const site = fs.mkdtempSync(path.join(os.tmpdir(), "course-web-"));
execFileSync("python3", [path.join(system, "build.py"), "web", path.join(system, "assurance/fixtures/pass/fermi-estimation"), "-o", site, "--brand", brand], { stdio: "inherit" });
const pages = ["index.html", ...fs.readdirSync(site).filter((d) => /^\d\d-/.test(d)).sort().flatMap((d) => fs.readdirSync(path.join(site, d)).sort().map((f) => `${d}/${f}`))];

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".vtt": "text/vtt" };
const server = http.createServer((req, res) => {
  const file = path.join(site, path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!file.startsWith(site)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(data);
  });
}).listen(0, "127.0.0.1");
await new Promise((resolve) => server.on("listening", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
const failed = [];
const check = (ok, what) => { if (ok) passed++; else failed.push(what); };

// Runs in the page: every visible text node's contrast against the background it sits on.
const AUDIT = () => {
  const rgb = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const toRgb = (c) => { const x = document.createElement("canvas").getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = toRgb(getComputedStyle(e).backgroundColor); if (c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const low = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el.checkVisibility() || el.closest(".skip")) continue;
    const r = ratio(toRgb(getComputedStyle(el).color), bg(el));
    if (r < 4.5) low.push(`${r.toFixed(2)}:1 "${n.textContent.trim().slice(0, 30)}"`);
  }
  const imgs = [...document.images].filter((i) => !i.complete || i.naturalWidth === 0 || !i.alt).map((i) => i.src);
  const first = document.querySelector("a, button, input");
  return {
    low, imgs, h1: document.querySelectorAll("h1").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    skip: first && first.classList.contains("skip"),
    font: document.fonts.check(`16px ${getComputedStyle(document.body).fontFamily.split(",")[0]}`)
  };
};

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: findChromium() });
let exitCode = 0;
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
    await page.route("https://**/*", (route) => route.fulfill({ status: 204, body: "" }));
    for (const p of pages) {
      await page.goto(`${origin}/${p}`);
      await page.evaluate(() => document.fonts.ready);
      const a = await page.evaluate(AUDIT);
      const where = `${p} at ${width}px under ${brand}`;
      check(a.overflow <= 0, `${where}: scrolls sideways by ${a.overflow}px`);
      check(a.h1 === 1, `${where}: ${a.h1} h1 elements`);
      check(!a.imgs.length, `${where}: images not loaded or not described: ${a.imgs.join(", ")}`);
      check(a.skip, `${where}: the skip link is not the first thing to focus`);
      check(a.font, `${where}: the brand's sans did not load`);
      check(!a.low.length, `${where}: text below 4.5:1: ${a.low.slice(0, 3).join("; ")}`);
      const items = await page.$$("fieldset.item");
      if (items.length && width === 1280) {
        for (const item of items) {
          const key = JSON.parse(await item.getAttribute("data-key"));
          if (key.choices) {
            for (const [i, c] of key.choices.entries()) if (c.correct) await item.$(`input[value="${i}"]`).then((x) => x.check());
          } else {
            await item.$("input").then((x) => x.fill(key.type === "numeric" ? String(key.answer) : key.answers[0]));
          }
          await item.$("button").then((b) => b.click());
          const fb = await item.$eval(".feedback", (e) => [e.getAttribute("data-result"), e.textContent]);
          check(fb[0] === "correct" && fb[1].length > 10, `${where}: ${await item.getAttribute("id")} answered by its key is graded ${fb[0]}`);
        }
        const after = await page.evaluate(AUDIT);
        check(!after.low.length, `${where}: feedback below 4.5:1: ${after.low.slice(0, 3).join("; ")}`);
        const score = await page.$eval(".score", (e) => e.textContent);
        check(score.startsWith(`${items.length} of ${items.length} correct`), `${where}: the score reads "${score}"`);
      }
      if (opt("--shots")) {
        fs.mkdirSync(opt("--shots"), { recursive: true });
        await page.screenshot({ path: path.join(opt("--shots"), `${brand}-${width}-${p.replace(/\//g, "-")}.png`), fullPage: true });
      }
    }
    check(!errors.length, `browser errors at ${width}px under ${brand}: ${errors.join("; ")}`);
    await page.close();
  }
  console.log(`${failed.length ? "FAIL" : "ok  "} frontiers-course web edition, themed by ${brand}  (${passed} passed${failed.length ? `, ${failed.length} failed` : ""})`);
  for (const f of failed) console.log(`     ✗ ${f}`);
  if (failed.length) exitCode = 1;
} finally {
  await browser.close();
  server.close();
  fs.rmSync(site, { recursive: true, force: true });
}
process.exit(exitCode);
