/*
 * Assurance runner: a tiny, dependency-free test harness that runs in any modern browser.
 *
 *   Assurance.suite(name, { description, needs }, (s) => {
 *     s.test("what it proves", async (t) => { t.ok(cond, "message"); t.equal(a, b); });
 *   });
 *
 * `needs: "http"` marks a suite or test that must be served over http(s) (it fetches files or inspects
 * iframes, which browsers block on file://). Over file:// those are reported as skipped, never as passed.
 * A test can also call t.skip("reason"). Results are rendered into #assurance-results and exposed as
 * window.__assurance for headless runs (run.mjs).
 */
(() => {
  "use strict";

  const suites = [];
  const IS_FILE = location.protocol === "file:";
  const base = new URL("../", document.baseURI).href; // design system root

  class Skip extends Error {}
  class Failure extends Error {}

  const fmt = (v) => { try { return typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v); } catch { return String(v); } };
  const api = {
    ok(value, message = "expected a truthy value") { if (!value) throw new Failure(message); },
    equal(actual, expected, message = "") {
      if (actual !== expected) throw new Failure(`${message ? message + ": " : ""}expected ${fmt(expected)}, got ${fmt(actual)}`);
    },
    deepEqual(actual, expected, message = "") {
      if (fmt(actual) !== fmt(expected)) throw new Failure(`${message ? message + ": " : ""}expected ${fmt(expected)}, got ${fmt(actual)}`);
    },
    atLeast(actual, minimum, message = "") {
      if (!(actual >= minimum)) throw new Failure(`${message ? message + ": " : ""}expected ≥ ${minimum}, got ${typeof actual === "number" ? +actual.toFixed(3) : fmt(actual)}`);
    },
    atMost(actual, maximum, message = "") {
      if (!(actual <= maximum)) throw new Failure(`${message ? message + ": " : ""}expected ≤ ${maximum}, got ${typeof actual === "number" ? +actual.toFixed(3) : fmt(actual)}`);
    },
    near(actual, expected, tolerance, message = "") {
      if (!(Math.abs(actual - expected) <= tolerance)) throw new Failure(`${message ? message + ": " : ""}expected ${expected} ± ${tolerance}, got ${+actual.toFixed(2)}`);
    },
    skip(reason) { throw new Skip(reason); },
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitFor(check, { timeout = 2000, interval = 25, message = "condition not met in time" } = {}) {
    const start = performance.now();
    for (;;) {
      const value = await check();
      if (value) return value;
      if (performance.now() - start > timeout) throw new Failure(message);
      await sleep(interval);
    }
  }

  const Assurance = {
    base, IS_FILE, sleep, waitFor, Skip, Failure,
    suite(name, options, define) {
      const suite = { name, description: options.description || "", needs: options.needs || null, tests: [], group: options.group || "Unit" };
      define({ test(title, fn, testOptions = {}) { suite.tests.push({ title, fn, needs: testOptions.needs || suite.needs }); } });
      suites.push(suite);
    },
    async fetchText(path) {
      const response = await fetch(new URL(path, base));
      if (!response.ok) throw new Failure(`${path}: HTTP ${response.status}`);
      return response.text();
    },
    /** Load a page into an off-screen iframe of a given width and resolve once its scripts have run. */
    async frame(path, { width = 1280, height = 900 } = {}) {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      // Invisible but "on screen": browsers skip intersection and rendering updates for frames positioned far off-screen.
      iframe.style.cssText = `position:fixed;left:0;top:0;border:0;width:${width}px;height:${height}px;opacity:0;pointer-events:none;z-index:-1;`;
      const loaded = new Promise((resolve, reject) => { iframe.onload = resolve; iframe.onerror = reject; });
      iframe.src = new URL(path, base).href;
      document.body.append(iframe);
      await loaded;
      const win = iframe.contentWindow;
      await waitFor(() => win.customElements?.get("fc-shell") || !win.document.querySelector("fc-shell"), { message: `${path}: console.js did not define its elements` });
      await win.document.fonts?.ready;
      await sleep(30);
      return {
        win, doc: win.document, iframe,
        close() { iframe.remove(); },
        resize(w, h = height) { iframe.style.width = `${w}px`; iframe.style.height = `${h}px`; return sleep(60); },
        $: (selector) => win.document.querySelector(selector),
        $$: (selector) => Array.from(win.document.querySelectorAll(selector)),
        style: (el, prop) => win.getComputedStyle(el)[prop],
        key(target, key, options = {}) { target.dispatchEvent(new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options })); },
        type(input, text) { input.value = text; input.dispatchEvent(new win.Event("input", { bubbles: true })); },
      };
    },
  };

  /* ───── colour helpers (used by several suites) ───── */
  Assurance.color = {
    parse(value) {
      const rgb = value.match(/rgba?\(([^)]+)\)/);
      if (rgb) {
        const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
        return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
      }
      const srgb = value.match(/color\(srgb ([^)]+)\)/);
      if (srgb) {
        const parts = srgb[1].split(/[\s/]+/).filter(Boolean).map(Number);
        return { r: parts[0] * 255, g: parts[1] * 255, b: parts[2] * 255, a: parts[3] ?? 1 };
      }
      throw new Failure(`cannot parse colour ${value}`);
    },
    over(top, bottom) {
      const a = top.a + bottom.a * (1 - top.a);
      const mix = (t, b) => (t * top.a + b * bottom.a * (1 - top.a)) / (a || 1);
      return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
    },
    luminance({ r, g, b }) {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    },
    contrast(a, b) {
      const [x, y] = [this.luminance(a), this.luminance(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    },
  };

  /* ───── execution and rendering ───── */
  const STATUS = { pass: "passing", fail: "failing", skip: "skipped" };
  const results = { done: false, suites: [], passed: 0, failed: 0, skipped: 0 };
  window.__assurance = results;

  async function runTest(test) {
    if (test.needs === "http" && IS_FILE) return { status: "skip", detail: "needs http(s): serve this directory (for example `python3 -m http.server`) to run it" };
    try {
      await Promise.race([
        Promise.resolve(test.fn(api)),
        sleep(15000).then(() => { throw new Failure("timed out after 15s"); }),
      ]);
      return { status: "pass" };
    } catch (error) {
      if (error instanceof Skip) return { status: "skip", detail: error.message };
      return { status: "fail", detail: error instanceof Failure ? error.message : `${error?.name || "Error"}: ${error?.message || error}` };
    }
  }

  function render(root, suite, outcome) {
    const failed = outcome.tests.some((t) => t.status === "fail");
    const allSkipped = outcome.tests.every((t) => t.status === "skip");
    const details = document.createElement("details");
    details.className = "as-suite";
    details.dataset.status = failed ? "fail" : allSkipped ? "skip" : "pass";
    details.open = failed;
    const counts = ["pass", "fail", "skip"].map((s) => [s, outcome.tests.filter((t) => t.status === s).length]).filter(([, n]) => n);
    details.innerHTML = `<summary><span class="as-name"></span><span class="as-group"></span><span class="as-counts"></span></summary><p class="as-desc"></p><ul class="as-tests"></ul>`;
    details.querySelector(".as-name").textContent = suite.name;
    details.querySelector(".as-group").textContent = suite.group;
    details.querySelector(".as-desc").textContent = suite.description;
    details.querySelector(".as-counts").innerHTML = counts.map(([s, n]) => `<span class="as-badge" data-tone="${s === "pass" ? "success" : s === "fail" ? "danger" : "warning"}" data-dot>${n} ${STATUS[s]}</span>`).join(" ");
    const list = details.querySelector(".as-tests");
    for (const t of outcome.tests) {
      const li = document.createElement("li");
      li.dataset.status = t.status;
      li.innerHTML = `<span class="as-mark" aria-hidden="true">${t.status === "pass" ? "✓" : t.status === "fail" ? "✗" : "–"}</span><span class="as-title"></span><span class="as-sr-only"> ${STATUS[t.status]}</span>`;
      li.querySelector(".as-title").textContent = t.title;
      if (t.detail) { const d = document.createElement("div"); d.className = "as-detail"; d.textContent = t.detail; li.append(d); }
      list.append(li);
    }
    root.append(details);
  }

  Assurance.runAll = async function runAll({ only } = {}) {
    const root = document.getElementById("assurance-results");
    root.replaceChildren();
    results.suites = []; results.passed = results.failed = results.skipped = 0; results.done = false;
    const summary = document.getElementById("assurance-summary");
    if (summary) summary.textContent = "Running…";
    for (const suite of suites) {
      if (only && !suite.name.toLowerCase().includes(only.toLowerCase())) continue;
      const outcome = { name: suite.name, tests: [] };
      for (const test of suite.tests) {
        const result = await runTest(test);
        outcome.tests.push({ title: test.title, ...result });
        results[result.status === "pass" ? "passed" : result.status === "fail" ? "failed" : "skipped"]++;
      }
      results.suites.push(outcome);
      render(root, suite, outcome);
    }
    results.done = true;
    if (summary) {
      summary.dataset.status = results.failed ? "fail" : "pass";
      summary.textContent = `${results.passed} passing, ${results.failed} failing, ${results.skipped} skipped` + (results.failed ? "" : results.skipped ? " — serve over http to run the skipped tests" : " — all green");
    }
    return results;
  };

  /** Suites, for rendering the live documentation of what is guarded. */
  Assurance.suites = suites;
  window.Assurance = Assurance;
})();
