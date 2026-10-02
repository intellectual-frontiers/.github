/* Unit suites: tokens, stylesheet discipline, and each web component in isolation. */
(() => {
  const { suite, color, sleep, waitFor, fetchText } = window.Assurance;

  const LAYERS = ["reset", "tokens", "base", "layout", "prose", "components", "admin"];
  const FIXTURES = ["docs", "components", "notebook", "home", "admin"].map((n) => `assurance/fixtures/${n}.html`);
  Assurance.FIXTURES = FIXTURES;

  /** Resolve a token to an RGBA colour through a throwaway element, so var() chains are honoured. */
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  document.documentElement.append(probe);
  const token = (name) => {
    probe.style.color = `var(${name})`;
    return color.parse(getComputedStyle(probe).color);
  };
  const raw = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /* ───────────────────────── tokens ───────────────────────── */
  suite("Design tokens", {
    group: "Unit",
    description: "Every token the design system promises exists and resolves; tokens.json mirrors tokens.css exactly; and every text/background pairing the system relies on meets WCAG AA.",
  }, (s) => {
    const REQUIRED = [
      "--fc-background", "--fc-foreground", "--fc-muted", "--fc-muted-foreground", "--fc-card", "--fc-popover", "--fc-border", "--fc-border-strong",
      "--fc-input-border", "--fc-accent", "--fc-accent-foreground", "--fc-primary", "--fc-primary-foreground", "--fc-primary-tint", "--fc-ring",
      "--fc-success", "--fc-success-tint", "--fc-warning", "--fc-warning-tint", "--fc-danger", "--fc-danger-tint", "--fc-info", "--fc-info-tint",
      "--fc-terminal-bg", "--fc-terminal-fg", "--fc-terminal-muted", "--fc-font-sans", "--fc-font-mono", "--fc-radius", "--fc-radius-sm", "--fc-radius-lg",
      "--fc-nav-height", "--fc-sidebar-width", "--fc-toc-width", "--fc-layout-width", "--fc-article-width", "--fc-gutter", "--fc-ease", "--fc-fast",
    ];
    s.test("every required token is defined on :root", (t) => {
      const missing = REQUIRED.filter((name) => !raw(name));
      t.ok(missing.length === 0, `missing tokens: ${missing.join(", ")}`);
    });

    s.test("tokens.json is an exact mirror of tokens.css", async (t) => {
      const css = await fetchText("css/tokens.css");
      const fromCss = {};
      for (const [, name, value] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--fc-[\w-]+)\s*:\s*([^;]+);/g)) fromCss[name] = value.trim().replace(/\s+/g, " ");
      const json = JSON.parse(await fetchText("tokens.json")).tokens;
      const onlyCss = Object.keys(fromCss).filter((k) => !(k in json));
      const onlyJson = Object.keys(json).filter((k) => !(k in fromCss));
      const differing = Object.keys(fromCss).filter((k) => k in json && json[k] !== fromCss[k]);
      t.ok(!onlyCss.length && !onlyJson.length && !differing.length,
        `css-only: [${onlyCss}] json-only: [${onlyJson}] differing: [${differing.map((k) => `${k} css=${fromCss[k]} json=${json[k]}`)}]`);
    }, { needs: "http" });

    const TEXT = [
      ["foreground on background", "--fc-foreground", "--fc-background"],
      ["foreground on muted", "--fc-foreground", "--fc-muted"],
      ["foreground on card", "--fc-foreground", "--fc-card"],
      ["foreground on accent", "--fc-foreground", "--fc-accent"],
      ["foreground on primary tint", "--fc-foreground", "--fc-primary-tint"],
      ["muted-foreground on background", "--fc-muted-foreground", "--fc-background"],
      ["muted-foreground on muted", "--fc-muted-foreground", "--fc-muted"],
      ["muted-foreground on card", "--fc-muted-foreground", "--fc-card"],
      ["muted-foreground on accent", "--fc-muted-foreground", "--fc-accent"],
      ["primary on background", "--fc-primary", "--fc-background"],
      ["primary on primary tint", "--fc-primary", "--fc-primary-tint"],
      ["primary-foreground on primary", "--fc-primary-foreground", "--fc-primary"],
      ["success on background", "--fc-success", "--fc-background"],
      ["success on success tint", "--fc-success", "--fc-success-tint"],
      ["warning on background", "--fc-warning", "--fc-background"],
      ["warning on warning tint", "--fc-warning", "--fc-warning-tint"],
      ["danger on background", "--fc-danger", "--fc-background"],
      ["danger on danger tint", "--fc-danger", "--fc-danger-tint"],
      ["info on background", "--fc-info", "--fc-background"],
      ["info on info tint", "--fc-info", "--fc-info-tint"],
      ["terminal foreground on terminal background", "--fc-terminal-fg", "--fc-terminal-bg"],
      ["terminal muted on terminal background", "--fc-terminal-muted", "--fc-terminal-bg"],
    ];
    for (const [label, fg, bg] of TEXT) {
      s.test(`text contrast ≥ 4.5:1 — ${label}`, (t) => t.atLeast(color.contrast(token(fg), token(bg)), 4.5, label));
    }
    const UI = [
      ["focus ring on background", "--fc-ring", "--fc-background"],
      ["form-control border on background", "--fc-input-border", "--fc-background"],
    ];
    for (const [label, a, b] of UI) {
      s.test(`non-text contrast ≥ 3:1 — ${label}`, (t) => t.atLeast(color.contrast(token(a), token(b)), 3, label));
    }
  });

  /* ───────────────────────── stylesheets ───────────────────────── */
  suite("Stylesheet discipline", {
    group: "Unit", needs: "http",
    description: "bundle.txt lists real files in cascade order; each file sits in its own cascade layer; the layer order is declared once, first; and no file uses @import, !important (outside the accessibility carve-outs), a CSS framework, or a remote URL.",
  }, (s) => {
    let bundle, files;
    const load = async () => {
      if (files) return;
      bundle = (await fetchText("css/bundle.txt")).split("\n").map((l) => l.trim()).filter(Boolean);
      files = Object.fromEntries(await Promise.all(bundle.map(async (name) => [name, await fetchText(`css/${name}`)])));
    };
    s.test("bundle.txt lists fonts.css first and every other file in layer order", async (t) => {
      await load();
      t.deepEqual(bundle, ["fonts.css", "reset.css", ...LAYERS.slice(1).map((l) => `${l}.css`)]);
    });
    s.test("reset.css declares the layer order, and it matches the documented order", async (t) => {
      await load();
      const m = files["reset.css"].replace(/\/\*[\s\S]*?\*\//g, "").match(/@layer\s+([\w\s,-]+);/);
      t.ok(m, "no @layer statement in reset.css");
      t.deepEqual(m[1].split(",").map((x) => x.trim()), LAYERS);
    });
    s.test("no other file declares layer order", async (t) => {
      await load();
      for (const [name, text] of Object.entries(files)) {
        if (name === "reset.css") continue;
        t.ok(!/@layer\s+[\w\s,-]+;/.test(text.replace(/\/\*[\s\S]*?\*\//g, "")), `${name} declares layer order`);
      }
    });
    s.test("every rule outside @font-face sits in the layer named for its file", async (t) => {
      await load();
      for (const layer of LAYERS) {
        const text = files[`${layer}.css`].replace(/\/\*[\s\S]*?\*\//g, "");
        const body = text.replace(/@layer\s+[\w\s,-]+;/, "").trim();
        t.ok(body.startsWith(`@layer ${layer} {`) && body.endsWith("}"), `${layer}.css must be a single @layer ${layer} { … } block`);
      }
    });
    s.test("no @import, no remote URL, no framework", async (t) => {
      await load();
      for (const [name, text] of Object.entries(files)) {
        const code = text.replace(/\/\*[\s\S]*?\*\//g, "");
        t.ok(!/@import/.test(code), `${name} uses @import`);
        t.ok(!/url\(\s*["']?(https?:)?\/\//.test(code), `${name} references a remote URL`);
        t.ok(!/@tailwind|@apply|\btw-/.test(code), `${name} looks like a CSS framework`);
      }
    });
    s.test("!important appears only inside print and reduced-motion blocks", async (t) => {
      await load();
      for (const [name, text] of Object.entries(files)) {
        const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media\s*print\s*\{[\s\S]*?\n  \}/g, "").replace(/@media\s*\(prefers-reduced-motion[\s\S]*?\n  \}/g, "");
        t.ok(!/!important/.test(code), `${name} uses !important outside the allowed blocks`);
      }
    });
    s.test("every font file referenced by fonts.css exists", async (t) => {
      await load();
      for (const [, path] of files["fonts.css"].matchAll(/url\("\.\.\/([^"]+)"\)/g)) {
        const response = await fetch(new URL(path, window.Assurance.base));
        t.ok(response.ok, `missing ${path}`);
      }
    });
    s.test("console.js is a single classic script with no imports or network access", async (t) => {
      const code = (await fetchText("js/console.js")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
      t.ok(!/^\s*(import|export)\s/m.test(code), "uses import/export");
      t.ok(!/\bimport\(/.test(code), "uses dynamic import()");
      t.ok(!/https?:\/\//.test(code), "mentions a remote URL");
      t.ok(!/\beval\(|new Function\(/.test(code), "uses eval");
    });
  });

  /* ───────────────────────── components ───────────────────────── */
  const sandbox = document.createElement("div");
  sandbox.id = "as-sandbox";
  sandbox.style.cssText = "position:fixed;left:-20000px;top:0;width:800px";
  document.body.append(sandbox);
  const mount = (html) => { sandbox.innerHTML = html; return sandbox.firstElementChild; };
  const press = (el, key, opts = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));

  suite("Components (unit)", {
    group: "Unit",
    description: "Each web component, mounted on its own and driven through its public contract: keyboard, ARIA state, events and attributes. Runs from file:// as well as http.",
  }, (s) => {
    const TABS = (key = "") => `<fc-tabs ${key ? `sync="${key}"` : ""}><div role="tablist"><button type="button" role="tab" aria-selected="true">One</button><button type="button" role="tab">Two</button><button type="button" role="tab">Three</button></div><div role="tabpanel">1</div><div role="tabpanel">2</div><div role="tabpanel">3</div></fc-tabs>`;

    s.test("fc-tabs: wires ARIA, shows only the selected panel, uses roving tabindex", (t) => {
      const el = mount(TABS());
      const tabs = [...el.querySelectorAll("[role=tab]")], panels = [...el.querySelectorAll("[role=tabpanel]")];
      t.deepEqual(panels.map((p) => p.hidden), [false, true, true]);
      t.deepEqual(tabs.map((x) => x.tabIndex), [0, -1, -1]);
      tabs.forEach((tab, i) => { t.equal(tab.getAttribute("aria-controls"), panels[i].id); t.equal(panels[i].getAttribute("aria-labelledby"), tab.id); });
    });
    s.test("fc-tabs: arrow keys, Home and End move focus and selection (wrapping)", (t) => {
      const el = mount(TABS());
      document.body.append(el); // focus needs the element in the document
      const tabs = [...el.querySelectorAll("[role=tab]")];
      tabs[0].focus();
      press(tabs[0], "ArrowRight"); t.equal(tabs[1].getAttribute("aria-selected"), "true"); t.equal(document.activeElement, tabs[1]);
      press(tabs[1], "End"); t.equal(tabs[2].getAttribute("aria-selected"), "true");
      press(tabs[2], "ArrowRight"); t.equal(tabs[0].getAttribute("aria-selected"), "true", "wraps to first");
      press(tabs[0], "ArrowLeft"); t.equal(tabs[2].getAttribute("aria-selected"), "true", "wraps to last");
      press(tabs[2], "Home"); t.equal(tabs[0].getAttribute("aria-selected"), "true");
      el.remove();
    });
    s.test("fc-tabs: tabs sharing a sync key stay in step", (t) => {
      sandbox.innerHTML = TABS("unit-sync") + TABS("unit-sync");
      const [a, b] = sandbox.querySelectorAll("fc-tabs");
      a.querySelectorAll("[role=tab]")[2].click();
      t.equal(b.querySelectorAll("[role=tab]")[2].getAttribute("aria-selected"), "true");
      try { localStorage.removeItem("fc-tabs:unit-sync"); } catch { /* storage unavailable */ }
    });

    s.test("fc-codeblock: adds a labelled copy button and reports what it copied", async (t) => {
      const el = mount('<fc-codeblock><figure class="fc-code"><pre><code>npm run build</code></pre></figure></fc-codeblock>');
      const button = el.querySelector(".fc-code__copy");
      t.ok(button, "no copy button");
      t.ok(button.getAttribute("aria-label"), "copy button needs an accessible name");
      const copied = new Promise((resolve) => el.addEventListener("fc-copy", (e) => resolve(e.detail), { once: true }));
      button.click();
      const detail = await copied;
      t.equal(detail.text, "npm run build");
    });

    const TABLE = `<input id="u-filter"><span id="u-count"></span><fc-table filter="#u-filter" count="#u-count"><table><thead><tr><th data-sort>Name</th><th data-sort="number">N</th></tr></thead><tbody>
      <tr><td>bravo</td><td>10</td></tr><tr><td>alpha</td><td>9</td></tr><tr><td>charlie</td><td>100</td></tr></tbody></table></fc-table>`;
    s.test("fc-table: sorts text and numbers both ways and sets aria-sort", (t) => {
      mount(TABLE);
      const table = sandbox.querySelector("fc-table");
      const ths = table.querySelectorAll("th");
      const names = () => [...table.querySelectorAll("tbody:first-of-type tr")].map((r) => r.cells[0].textContent);
      ths[0].querySelector("button").click();
      t.deepEqual(names(), ["alpha", "bravo", "charlie"]); t.equal(ths[0].getAttribute("aria-sort"), "ascending");
      ths[0].querySelector("button").click();
      t.deepEqual(names(), ["charlie", "bravo", "alpha"]); t.equal(ths[0].getAttribute("aria-sort"), "descending");
      ths[1].querySelector("button").click();
      t.deepEqual(names(), ["alpha", "bravo", "charlie"], "numeric: 9 < 10 < 100"); t.equal(ths[0].hasAttribute("aria-sort"), false, "other columns reset");
    });
    s.test("fc-table: filters rows, reports the count, shows an empty state", (t) => {
      mount(TABLE);
      const input = sandbox.querySelector("#u-filter"), count = sandbox.querySelector("#u-count"), table = sandbox.querySelector("fc-table");
      t.equal(count.textContent, "3 of 3");
      input.value = "al"; input.dispatchEvent(new Event("input"));
      t.equal(count.textContent, "1 of 3");
      input.value = "zzz"; input.dispatchEvent(new Event("input"));
      t.equal(table.querySelector("tbody[hidden]"), null, "empty state is shown when nothing matches");
    });

    s.test("fc-toc: builds links from headings when empty, with ids and depth", (t) => {
      const el = mount('<div><main id="u-main"><h2>Alpha beta</h2><h3>Gamma</h3><h2 id="given">Given id</h2></main><fc-toc scope="#u-main"></fc-toc></div>');
      const links = [...el.querySelectorAll("fc-toc a")];
      t.deepEqual(links.map((a) => a.getAttribute("href")), ["#alpha-beta", "#gamma", "#given"]);
      t.deepEqual(links.map((a) => a.dataset.depth), ["2", "3", "2"]);
      t.ok(el.querySelector("#alpha-beta"), "generated id was written back to the heading");
    });
    s.test("fc-toc: generated ids are unique when headings repeat", (t) => {
      const el = mount('<div><main id="u-main"><h2>Same</h2><h2>Same</h2><h3>Same</h3></main><fc-toc scope="#u-main"></fc-toc></div>');
      t.deepEqual([...el.querySelectorAll("fc-toc a")].map((a) => a.getAttribute("href")), ["#same", "#same-2", "#same-3"]);
      t.deepEqual([...el.querySelectorAll("main > *")].map((h) => h.id), ["same", "same-2", "same-3"]);
    });
    s.test("fc-toc: mark() sets aria-current on exactly one link", (t) => {
      const el = mount('<div><main id="u-main"><h2 id="a">A</h2><h2 id="b">B</h2></main><fc-toc scope="#u-main"></fc-toc></div>');
      const toc = el.querySelector("fc-toc");
      toc.mark("b");
      t.deepEqual([...toc.querySelectorAll("a")].map((a) => a.getAttribute("aria-current")), [null, "true"]);
      toc.mark("a");
      t.deepEqual([...toc.querySelectorAll("a")].map((a) => a.getAttribute("aria-current")), ["true", null]);
    });

    s.test("fc-search: opens, ranks by title, supports arrows and Enter, and is cancelable", async (t) => {
      const index = [{ title: "Tabs", href: "t.html", section: "Ref" }, { title: "Admin", description: "contains the word tabs", href: "a.html" }, { title: "Other", href: "o.html" }];
      const el = mount(`<fc-search placeholder="Search…"><script type="application/json">${JSON.stringify(index)}</script></fc-search>`);
      const input = () => el.querySelector("input"), rows = () => [...el.querySelectorAll("[role=option]")];
      t.ok(el.querySelector("button.fc-search-trigger"), "trigger button");
      await el.open();
      t.equal(rows().length, 3, "an empty query lists the index");
      t.equal(input().getAttribute("role"), "combobox");
      input().value = "tabs"; input().dispatchEvent(new Event("input"));
      t.deepEqual(rows().map((r) => r.querySelector("strong").textContent), ["Tabs", "Admin"], "title matches rank above description matches; non-matches drop out");
      t.equal(rows()[0].getAttribute("aria-selected"), "true");
      t.equal(input().getAttribute("aria-activedescendant"), rows()[0].id);
      press(input(), "ArrowDown"); t.equal(rows()[1].getAttribute("aria-selected"), "true");
      press(input(), "ArrowDown"); t.equal(rows()[0].getAttribute("aria-selected"), "true", "wraps");
      const picked = new Promise((resolve) => el.addEventListener("fc-search-select", (e) => { e.preventDefault(); resolve(e.detail.item); }, { once: true }));
      press(input(), "ArrowDown"); press(input(), "Enter");
      t.equal((await picked).title, "Admin");
      t.equal(el.querySelector("dialog").open, false, "dialog closes after a cancelled selection");
    });
    s.test("fc-search: Ctrl+K and / open it, but / is ignored while typing in a field", async (t) => {
      const el = mount('<fc-search><script type="application/json">[]</script></fc-search>');
      const dialog = el.querySelector("dialog");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
      await waitFor(() => dialog.open, { message: "Ctrl+K did not open search" });
      dialog.close();
      const field = document.createElement("input"); sandbox.append(field);
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
      await sleep(30);
      t.equal(dialog.open, false, "/ in an input must not open search");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
      await waitFor(() => dialog.open, { message: "/ did not open search" });
      dialog.close();
    });

    s.test("fc-terminal: writes, classifies and clears output; exposes a log role", (t) => {
      const el = mount('<fc-terminal title="job" status="running"></fc-terminal>');
      t.equal(el.querySelector("[role=log]") !== null, true);
      el.write("one\n"); el.write("bad\n", "err");
      t.equal(el.text, "one\nbad\n");
      t.equal(el.querySelectorAll(".fc-t-err").length, 1);
      el.setAttribute("status", "failed");
      t.equal(el.querySelector(".fc-terminal__bar").textContent.includes("failed"), true);
      el.clear(); t.equal(el.text, "");
    });

    s.test("FcToast: announces politely, errors assertively, and removes itself", async (t) => {
      const ok = window.FcToast.show("Saved", { type: "success", timeout: 40 });
      const bad = window.FcToast.show("Broke", { type: "error", timeout: 40 });
      t.equal(ok.getAttribute("role"), "status"); t.equal(bad.getAttribute("role"), "alert");
      t.equal(document.querySelector(".fc-toast-region").getAttribute("aria-live"), "polite");
      await waitFor(() => !ok.isConnected && !bad.isConnected, { message: "toasts were not removed" });
    });

    s.test("fc-shell: drawer toggles with aria-expanded and closes on Escape; collapse toggles and persists", (t) => {
      try { localStorage.removeItem("fc-sidebar-collapsed"); } catch { /* storage unavailable */ }
      const el = mount('<fc-shell data-layout="docs"><button data-fc-sidebar-toggle aria-expanded="false">m</button><button data-fc-sidebar-collapse>c</button><aside class="fc-sidebar"><a href="#x">x</a></aside></fc-shell>');
      const [toggle, collapse] = el.querySelectorAll("button");
      toggle.click();
      t.equal(el.hasAttribute("data-sidebar-open"), true); t.equal(toggle.getAttribute("aria-expanded"), "true");
      press(el, "Escape");
      t.equal(el.hasAttribute("data-sidebar-open"), false); t.equal(toggle.getAttribute("aria-expanded"), "false");
      collapse.click(); t.equal(el.hasAttribute("data-sidebar-collapsed"), true);
      collapse.click(); t.equal(el.hasAttribute("data-sidebar-collapsed"), false);
      t.ok(el.querySelector(".fc-backdrop"), "backdrop was created");
      t.equal(el.layout, "docs");
      el.layout = "notebook"; t.equal(el.getAttribute("data-layout"), "notebook");
    });

    s.test("details.fc-menu: closes on outside click and on Escape", (t) => {
      const el = mount('<div><details class="fc-menu" open><summary>Menu</summary><div class="fc-menu__panel">x</div></details></div>');
      const menu = el.querySelector("details");
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      t.equal(menu.open, false, "outside click");
      menu.open = true; press(document, "Escape");
      t.equal(menu.open, false, "Escape");
    });
  });
})();
