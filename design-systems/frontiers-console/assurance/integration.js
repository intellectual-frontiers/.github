/* Integration suites: every fixture page loaded in a real, sized iframe. Needs http(s): browsers do not let
   a file:// page inspect another file:// page. */
(() => {
  const { suite, color, sleep, waitFor, frame } = window.Assurance;
  const FIXTURES = window.Assurance.FIXTURES;
  const SIDEBAR_PAGES = ["docs", "components", "notebook", "admin"].map((n) => `assurance/fixtures/${n}.html`);
  const page = (name) => `assurance/fixtures/${name}.html`;

  async function withFrame(path, size, fn) {
    const f = await frame(path, size);
    try { return await fn(f); } finally { f.close(); }
  }
  const shown = (f, el) => !!el && f.style(el, "display") !== "none" && f.style(el, "visibility") !== "hidden";

  /* ───────────────────────── markup contract ───────────────────────── */
  suite("Markup contract", {
    group: "Integration", needs: "http",
    description: "Every fixture page honours the contract in chrome.md: landmarks, one h1, a working skip link, labelled navigation, valid ARIA wiring, resolvable anchors, unique ids, accessible names on icon-only controls, and no external resources.",
  }, (s) => {
    for (const path of FIXTURES) {
      s.test(`${path.split("/").pop()}: landmarks, headings, skip link, language`, (t) => withFrame(path, {}, (f) => {
        t.ok(f.doc.documentElement.lang, "html[lang]");
        t.ok(f.doc.title.trim(), "document title");
        t.ok(f.$('meta[name="viewport"]'), "viewport meta");
        t.equal(f.$$("h1").length, 1, "exactly one h1");
        t.equal(f.$$("main").length, 1, "exactly one main");
        const skip = f.$(".fc-skip");
        t.ok(skip, "skip link");
        t.ok(f.$(skip.getAttribute("href")), "skip link target exists");
        t.ok(f.$("fc-shell[data-layout]"), "fc-shell with data-layout");
        t.ok(["docs", "notebook", "home"].includes(f.$("fc-shell").dataset.layout), "layout is one of docs, notebook, home");
        for (const nav of f.$$("nav")) t.ok(nav.getAttribute("aria-label") || nav.getAttribute("aria-labelledby"), `nav needs a label: ${nav.className}`);
      }));
      s.test(`${path.split("/").pop()}: ids unique, anchors resolve, ARIA references exist`, (t) => withFrame(path, {}, (f) => {
        const ids = f.$$("[id]").map((e) => e.id);
        t.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], "duplicate ids");
        for (const a of f.$$('a[href^="#"]')) { const id = decodeURIComponent(a.getAttribute("href").slice(1)); if (id) t.ok(f.doc.getElementById(id), `anchor #${id} has no target`); }
        for (const el of f.$$("[aria-controls],[aria-labelledby],[aria-describedby]")) {
          for (const attr of ["aria-controls", "aria-labelledby", "aria-describedby"]) {
            for (const id of (el.getAttribute(attr) || "").split(/\s+/).filter(Boolean)) t.ok(f.doc.getElementById(id), `${attr}="${id}" has no target`);
          }
        }
      }));
      s.test(`${path.split("/").pop()}: images have alt, icon-only buttons have names, no external resources`, (t) => withFrame(path, {}, (f) => {
        for (const img of f.$$("img")) t.ok(img.hasAttribute("alt"), `img without alt: ${img.src}`);
        for (const b of f.$$("button")) t.ok((b.textContent.trim().length > 2) || b.getAttribute("aria-label"), `icon-only button without aria-label: ${b.outerHTML.slice(0, 80)}`);
        for (const el of f.$$("script[src], link[href], img[src], source[src]")) {
          const url = el.getAttribute("src") || el.getAttribute("href");
          t.ok(!/^(https?:)?\/\//.test(url), `external resource: ${url}`);
        }
      }));
    }
    for (const path of SIDEBAR_PAGES) {
      s.test(`${path.split("/").pop()}: exactly one current page in the sidebar tree`, (t) => withFrame(path, {}, (f) => {
        t.equal(f.$$('.fc-tree [aria-current="page"]').length, 1);
      }));
    }
    s.test("components.html: every tab controls an existing panel and exactly one tab is selected", (t) => withFrame(page("components"), {}, (f) => {
      for (const tabs of f.$$("fc-tabs")) {
        const all = [...tabs.querySelectorAll("[role=tab]")];
        t.equal(all.filter((x) => x.getAttribute("aria-selected") === "true").length, 1);
        for (const tab of all) t.ok(f.doc.getElementById(tab.getAttribute("aria-controls")), "panel for tab");
        t.equal(tabs.querySelectorAll('[role=tabpanel]:not([hidden])').length, 1, "one visible panel");
      }
    }));
  });

  /* ───────────────────────── layouts ───────────────────────── */
  suite("Layouts", {
    group: "Integration", needs: "http",
    description: "docs, notebook and home lay out as documented at the breakpoints that matter (320, 390, 1023, 1024, 1279, 1280, 1600 CSS px), and changing data-layout at runtime reflows the page.",
  }, (s) => {
    s.test("docs @1280: persistent 17rem sidebar, no navbar, table of contents beside the article", (t) => withFrame(page("docs"), { width: 1280 }, (f) => {
      const sidebar = f.$(".fc-sidebar"), toc = f.$(".fc-toc"), article = f.$(".fc-article");
      t.equal(f.style(f.$(".fc-nav"), "display"), "none", "navbar hidden in docs layout on desktop");
      t.ok(shown(f, sidebar)); t.near(sidebar.getBoundingClientRect().width, 272, 1, "sidebar width");
      t.equal(f.style(sidebar, "position"), "sticky");
      t.ok(shown(f, toc), "table of contents"); t.equal(f.style(f.$(".fc-toc-mobile"), "display"), "none", "mobile toc hidden");
      t.atLeast(toc.getBoundingClientRect().left, article.getBoundingClientRect().right, "toc sits right of article");
      t.near(f.$(".fc-sidebar").getBoundingClientRect().top, 0, 1, "sidebar starts at the top");
    }));
    s.test("docs @1024: sidebar persists but the table of contents folds into the article", (t) => withFrame(page("docs"), { width: 1024 }, (f) => {
      t.ok(shown(f, f.$(".fc-sidebar")), "sidebar at exactly 64rem"); t.equal(f.style(f.$(".fc-toc"), "display"), "none");
      t.ok(shown(f, f.$(".fc-toc-mobile")), "mobile toc visible");
    }));
    s.test("docs @1023: sidebar becomes an off-canvas drawer and the navbar appears", (t) => withFrame(page("docs"), { width: 1023 }, (f) => {
      t.ok(shown(f, f.$(".fc-nav")), "navbar"); t.equal(f.style(f.$(".fc-sidebar"), "visibility"), "hidden", "drawer is not focusable when closed");
      t.atMost(f.$(".fc-sidebar").getBoundingClientRect().right, 0, "drawer is off-canvas");
      t.ok(shown(f, f.$(".fc-nav__toggle")), "menu button");
    }));
    for (const w of [320, 390]) {
      s.test(`docs @${w}: single column, article fills the viewport minus gutters`, (t) => withFrame(page("docs"), { width: w }, (f) => {
        const r = f.$(".fc-article").getBoundingClientRect();
        t.near(r.width, w - 40, 2, "article width"); t.near(r.left, 20, 1, "left gutter");
      }));
    }
    s.test("notebook @1280: navbar spans the top, sidebar starts beneath it", (t) => withFrame(page("notebook"), { width: 1280 }, (f) => {
      const nav = f.$(".fc-nav"), sidebar = f.$(".fc-sidebar");
      t.ok(shown(f, nav)); t.near(nav.getBoundingClientRect().width, 1280, 1, "navbar full width");
      t.near(sidebar.getBoundingClientRect().top, nav.getBoundingClientRect().height, 1, "sidebar below navbar");
      t.near(sidebar.getBoundingClientRect().height, 900 - 56, 1, "sidebar fills the remaining height");
      t.equal(f.style(f.$(".fc-nav__toggle"), "display"), "none", "menu button hidden on desktop");
    }));
    s.test("notebook @390: navbar with menu button, drawer sidebar", (t) => withFrame(page("notebook"), { width: 390 }, (f) => {
      t.ok(shown(f, f.$(".fc-nav__toggle"))); t.equal(f.style(f.$(".fc-sidebar"), "visibility"), "hidden");
    }));
    for (const w of [390, 1280, 1600]) {
      s.test(`home @${w}: no sidebar, navbar, centred content within the layout width`, (t) => withFrame(page("home"), { width: w }, (f) => {
        t.equal(f.style(f.$("fc-shell"), "display"), "grid");
        t.ok(!f.$(".fc-sidebar") || f.style(f.$(".fc-sidebar"), "display") === "none", "no sidebar");
        t.ok(shown(f, f.$(".fc-nav")), "navbar");
        t.atMost(f.$(".fc-page").getBoundingClientRect().width, 1440 + 1, "content capped at --fc-layout-width");
        t.equal(f.$(".fc-nav__toggle"), null, "no menu button without a sidebar");
      }));
    }
    s.test("switching data-layout at runtime reflows: docs → notebook → home", (t) => withFrame(page("docs"), { width: 1280 }, async (f) => {
      const shell = f.$("fc-shell");
      t.equal(f.style(f.$(".fc-nav"), "display"), "none");
      shell.layout = "notebook"; await sleep(40);
      t.ok(shown(f, f.$(".fc-nav")), "navbar appears in notebook"); t.near(f.$(".fc-sidebar").getBoundingClientRect().top, 56, 1);
      shell.layout = "home"; await sleep(40);
      t.equal(f.style(f.$(".fc-sidebar"), "display"), "none", "sidebar gone in home");
      shell.layout = "docs"; await sleep(40);
      t.ok(shown(f, f.$(".fc-sidebar")), "sidebar back in docs");
    }));
    s.test("layout tokens drive the grid: changing --fc-sidebar-width moves the page", (t) => withFrame(page("docs"), { width: 1280 }, async (f) => {
      f.doc.documentElement.style.setProperty("--fc-sidebar-width", "20rem"); await sleep(40);
      t.near(f.$(".fc-sidebar").getBoundingClientRect().width, 320, 1);
      t.near(f.$(".fc-page").getBoundingClientRect().left, 320, 1);
    }));
  });

  /* ───────────────────────── responsive ───────────────────────── */
  suite("No horizontal overflow", {
    group: "Integration", needs: "http",
    description: "No fixture scrolls sideways at 320, 390, 768, 1024 or 1280 CSS px (a common regression with wide tables and code blocks); intentionally scrollable regions are contained.",
  }, (s) => {
    for (const path of FIXTURES) for (const w of [320, 390, 768, 1024, 1280]) {
      s.test(`${path.split("/").pop()} @${w}`, (t) => withFrame(path, { width: w }, (f) => {
        const root = f.doc.documentElement;
        t.atMost(root.scrollWidth, w, `page is ${root.scrollWidth}px wide in a ${w}px viewport`);
      }));
    }
  });

  /* ───────────────────────── interactions ───────────────────────── */
  suite("Interactions", {
    group: "Integration", needs: "http",
    description: "Behaviour on real pages: the mobile drawer, desktop collapse, tabs, accordion, menus, scroll-spy, search, table sorting and filtering, copy buttons.",
  }, (s) => {
    s.test("mobile drawer: opens from the menu button, traps nothing when closed, closes on Escape and on the backdrop", (t) => withFrame(page("docs"), { width: 390 }, async (f) => {
      const shell = f.$("fc-shell"), sidebar = f.$(".fc-sidebar"), toggle = f.$(".fc-nav__toggle");
      toggle.click(); await sleep(260);
      t.equal(shell.hasAttribute("data-sidebar-open"), true); t.equal(toggle.getAttribute("aria-expanded"), "true");
      t.equal(f.style(sidebar, "visibility"), "visible"); t.atLeast(sidebar.getBoundingClientRect().left, 0, "drawer is on-canvas");
      t.ok(sidebar.contains(f.doc.activeElement), "focus moved into the drawer");
      f.key(shell, "Escape"); await sleep(260);
      t.equal(shell.hasAttribute("data-sidebar-open"), false); t.equal(f.style(sidebar, "visibility"), "hidden");
      t.equal(f.doc.activeElement, toggle, "focus returned to the menu button");
      toggle.click(); await sleep(260);
      f.$(".fc-backdrop").click(); await sleep(260);
      t.equal(shell.hasAttribute("data-sidebar-open"), false, "backdrop click closes");
    }));
    s.test("desktop collapse: hides the sidebar, widens the page, shows an expand button, and restores", (t) => withFrame(page("docs"), { width: 1280 }, async (f) => {
      try { f.win.localStorage.removeItem("fc-sidebar-collapsed"); } catch { /* storage unavailable */ }
      const shell = f.$("fc-shell"), expand = f.$(".fc-sidebar-expand");
      t.equal(f.style(expand, "display"), "none", "expand button hidden while expanded");
      const before = f.$(".fc-page").getBoundingClientRect().width;
      f.$("[data-fc-sidebar-collapse]").click(); await sleep(60);
      t.equal(shell.hasAttribute("data-sidebar-collapsed"), true);
      t.equal(f.style(f.$(".fc-sidebar"), "visibility"), "hidden");
      t.atLeast(f.$(".fc-page").getBoundingClientRect().width, before + 250, "page reclaimed the sidebar's width");
      t.ok(shown(f, expand), "expand button visible");
      expand.click(); await sleep(60);
      t.equal(shell.hasAttribute("data-sidebar-collapsed"), false); t.near(f.$(".fc-page").getBoundingClientRect().width, before, 1);
      try { f.win.localStorage.removeItem("fc-sidebar-collapsed"); } catch { /* storage unavailable */ }
    }));
    s.test("tabs and accordion on a real page", (t) => withFrame(page("components"), {}, async (f) => {
      const tabs = f.$("#tabs-demo"), all = [...tabs.querySelectorAll("[role=tab]")];
      all[0].focus(); f.key(all[0], "ArrowRight");
      t.equal(all[1].getAttribute("aria-selected"), "true"); t.equal(f.$$("#tabs-demo [role=tabpanel]:not([hidden])").length, 1);
      const details = f.$("#accordion-demo details");
      t.equal(details.open, false); details.querySelector("summary").click(); await sleep(20); t.equal(details.open, true);
    }));
    s.test("scroll-spy: the table of contents follows the heading in view", (t) => withFrame(page("docs"), { width: 1280, height: 700 }, async (f) => {
      f.doc.documentElement.style.scrollBehavior = "auto";
      f.$("#health").scrollIntoView(); 
      const link = await waitFor(() => { const a = f.$('.fc-toc a[aria-current="true"]'); return a?.getAttribute("href") === "#health" && a; }, { message: "TOC did not mark #health as current" });
      t.equal(f.$$('.fc-toc a[aria-current="true"]').length, 1, "exactly one current entry"); t.ok(link);
    }));
    s.test("menu: opens, then closes on outside click", (t) => withFrame(page("docs"), { width: 1280 }, async (f) => {
      const menu = f.$("details.fc-menu"); menu.querySelector("summary").click(); await sleep(20);
      t.equal(menu.open, true); t.ok(shown(f, menu.querySelector(".fc-menu__panel")));
      f.$("main").click(); await sleep(20); t.equal(menu.open, false);
    }));
    s.test("search: Ctrl+K opens the palette, typing filters, arrows select, selection is reported", (t) => withFrame(page("docs"), { width: 1280 }, async (f) => {
      const search = f.$("fc-search"), dialog = search.querySelector("dialog");
      f.doc.dispatchEvent(new f.win.KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
      await waitFor(() => dialog.open, { message: "Ctrl+K did not open the palette" });
      const input = dialog.querySelector("input"); f.type(input, "notebook"); await sleep(20);
      const rows = [...dialog.querySelectorAll("[role=option]")];
      t.equal(rows[0].querySelector("strong").textContent, "Notebook layout");
      const chosen = new Promise((resolve) => search.addEventListener("fc-search-select", (e) => { e.preventDefault(); resolve(e.detail.item.href); }, { once: true }));
      f.key(input, "Enter"); t.equal(await chosen, "notebook.html");
    }));
    s.test("search: the trigger in the sidebar opens it too", (t) => withFrame(page("docs"), { width: 1280 }, async (f) => {
      f.$(".fc-search-trigger").click();
      await waitFor(() => f.$("fc-search dialog").open, { message: "trigger did not open the palette" });
    }));
    s.test("table: sort by text and by number, then filter", (t) => withFrame(page("admin"), { width: 1280 }, async (f) => {
      const rows = () => f.$$("#doc-table tbody:first-of-type tr:not([hidden])").map((r) => r.cells[0].textContent);
      const headers = f.$$("#doc-table th");
      headers[0].querySelector("button").click();
      t.equal(rows()[0], "Home page", "alphabetical"); t.equal(headers[0].getAttribute("aria-sort"), "ascending");
      headers[3].querySelector("button").click(); headers[3].querySelector("button").click();
      t.equal(rows()[0], "Ontology", "numeric descending puts 230 first");
      f.type(f.$("#doc-filter"), "console"); await sleep(20);
      t.deepEqual(rows().sort(), ["Ontology", "Specs index"]); t.equal(f.$("#doc-count").textContent, "2 of 5");
    }));
    s.test("run log: appends and keeps the newest line in view", (t) => withFrame(page("admin"), { width: 1280 }, async (f) => {
      const log = f.$("#run-log"); for (let i = 0; i < 80; i++) log.write(`line ${i}\n`);
      const pre = log.querySelector("pre");
      t.atMost(Math.abs(pre.scrollHeight - pre.scrollTop - pre.clientHeight), 4, "pinned to the bottom");
    }));
    s.test("copy button on a rendered code block reports the copied text", (t) => withFrame(page("components"), {}, async (f) => {
      const block = f.$("fc-codeblock"); const done = new Promise((resolve) => block.addEventListener("fc-copy", (e) => resolve(e.detail.text), { once: true }));
      block.querySelector(".fc-code__copy").click(); t.equal(await done, "cargo task vendor\ncargo task check");
    }));
    s.test("toast button shows a notification", (t) => withFrame(page("components"), {}, async (f) => {
      f.$("#toast-demo").click(); await sleep(20);
      t.equal(f.$(".fc-toast-region .fc-toast").textContent, "Saved");
    }));
  });

  /* ───────────────────────── rendered contrast ───────────────────────── */
  suite("Rendered contrast", {
    group: "Integration", needs: "http",
    description: "Contrast measured on the real, rendered components (computed colours over their effective backgrounds), not only on token pairs: badges, callouts, buttons, tabs, the current sidebar entry, stat values, the banner and the run log.",
  }, (s) => {
    function effectiveBackground(f, el) {
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      const chain = [];
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) chain.push(node);
      for (const node of chain.reverse()) { const c = color.parse(f.style(node, "backgroundColor")); if (c.a > 0) bg = color.over(c, bg); }
      return bg;
    }
    const CHECKS = [
      [".fc-badge[data-tone]", 4.5], [".fc-callout .fc-callout__title", 4.5], [".fc-callout .fc-callout__body p:not(.fc-callout__title)", 4.5],
      [".fc-btn[data-variant=primary]", 4.5], [".fc-btn:not([data-variant])", 4.5], ['.fc-tree__link[aria-current="page"]', 4.5], [".fc-tree__link:not([aria-current])", 4.5],
      ['fc-tabs [role=tab][aria-selected="true"]', 4.5], ["fc-tabs [role=tab]:not([aria-selected=true])", 4.5], [".fc-banner", 4.5], [".fc-card__text", 4.5],
      [".fc-crumbs a", 4.5], [".fc-description", 4.5], [".fc-toc a", 4.5], [".fc-footer span", 4.5], [".fc-typetable th", 4.5], [".fc-pager small", 4.5],
    ];
    s.test("components.html: text meets AA on its real background", (t) => withFrame(page("components"), { width: 1280 }, (f) => {
      let measured = 0;
      for (const [selector, min] of CHECKS) {
        for (const el of f.$$(selector)) {
          if (!el.textContent.trim()) continue;
          const ratio = color.contrast(color.parse(f.style(el, "color")), effectiveBackground(f, el));
          t.atLeast(ratio, min, `${selector} "${el.textContent.trim().slice(0, 24)}"`); measured++;
        }
      }
      t.atLeast(measured, 30, "the selectors matched too few elements to mean anything");
    }));
    s.test("admin.html: badges, stats, table headers and the run log meet AA", (t) => withFrame(page("admin"), { width: 1280 }, (f) => {
      for (const selector of [".fc-badge[data-tone]", ".fc-stat__value", ".fc-stat__label", "fc-table th", ".fc-hint", ".fc-error", ".fc-empty__text", ".fc-terminal__log", ".fc-terminal__bar"]) {
        const els = f.$$(selector); t.atLeast(els.length, 1, `no ${selector}`);
        for (const el of els) {
          const size = parseFloat(f.style(el, "fontSize")), weight = Number(f.style(el, "fontWeight"));
          const large = size >= 24 || (size >= 18.66 && weight >= 700);
          t.atLeast(color.contrast(color.parse(f.style(el, "color")), effectiveBackground(f, el)), large ? 3 : 4.5, `${selector} "${el.textContent.trim().slice(0, 20)}"`);
        }
      }
    }));
  });

  /* ───────────────────────── touch and type ───────────────────────── */
  suite("Targets and type", {
    group: "Integration", needs: "http",
    description: "Interactive controls are at least 28 px tall (24 px is the WCAG 2.2 floor), icon buttons at least 36 px square, and body text never drops below 12 px.",
  }, (s) => {
    s.test("docs @390: buttons and sidebar links are large enough to tap", (t) => withFrame(page("docs"), { width: 390 }, async (f) => {
      f.$(".fc-nav__toggle").click(); await sleep(260);
      for (const b of f.$$(".fc-btn[data-size=icon]")) { const r = b.getBoundingClientRect(); if (r.width) t.atLeast(Math.min(r.width, r.height), 36, `icon button ${b.getAttribute("aria-label")}`); }
      for (const a of f.$$(".fc-tree__link")) t.atLeast(a.getBoundingClientRect().height, 28, `tree link ${a.textContent.trim()}`);
    }));
    s.test("no visible text smaller than 12px", (t) => withFrame(page("components"), { width: 1280 }, (f) => {
      for (const el of f.$$("main *")) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        t.atLeast(parseFloat(f.style(el, "fontSize")), 12, `${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 20)}"`);
      }
    }));
    s.test("body text uses Inter and code uses IBM Plex Mono (fonts load from the vendored files)", (t) => withFrame(page("docs"), { width: 1280 }, async (f) => {
      await f.doc.fonts.load('16px "Inter"'); await f.doc.fonts.load('14px "IBM Plex Mono"');
      t.ok(f.doc.fonts.check('16px "Inter"'), "Inter loaded"); t.ok(f.doc.fonts.check('14px "IBM Plex Mono"'), "IBM Plex Mono loaded");
      t.ok(f.style(f.doc.body, "fontFamily").startsWith("Inter"), "body font family");
      t.ok(f.style(f.$("pre code"), "fontFamily").includes("IBM Plex Mono"), "code font family");
    }));
  });
})();
