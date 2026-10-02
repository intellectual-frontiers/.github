/* Integration suites for Frontiers Nature: the page frame, loaded into real sized iframes. Needs http(s). */
(() => {
  const { suite, color, sleep, frame } = window.Assurance;
  const PAGE = "assurance/fixtures/page.html";
  async function withFrame(size, fn) { const f = await frame(PAGE, size); try { return await fn(f); } finally { f.close(); } }

  suite("Markup contract", {
    group: "Integration", needs: "http",
    description: "The fixture honours chrome.md: a sticky header with a labelled primary nav, a breadcrumb trail whose last item is the current page, a main landmark, one h1, labelled navs, unique ids and no external resources.",
  }, (s) => {
    s.test("landmarks, headings and labels", (t) => withFrame({}, (f) => {
      t.ok(f.doc.documentElement.lang, "html[lang]"); t.ok(f.doc.title.trim(), "title"); t.ok(f.$('meta[name="viewport"]'), "viewport meta");
      t.equal(f.$$("h1").length, 1, "one h1"); t.equal(f.$$("main").length, 1, "one main");
      t.ok(f.$("header.site-header"), "site-header"); t.ok(f.$("footer.site-footer"), "site-footer");
      for (const nav of f.$$("nav")) t.ok(nav.getAttribute("aria-label"), "nav needs a label");
      t.ok(f.$(".nav-primary a[aria-current=page][data-active]"), "primary nav marks the current section");
    }));
    s.test("breadcrumbs: ordered list, first is home, last is the current page", (t) => withFrame({}, (f) => {
      const items = f.$$(".crumbs ol > li");
      t.atLeast(items.length, 2, "crumbs"); t.ok(items[0].querySelector("a"), "first crumb links home");
      const last = items[items.length - 1]; t.ok(last.querySelector('[aria-current="page"]'), "last crumb is aria-current");
      t.equal(f.$$('.crumbs [aria-current="page"]').length, 1, "exactly one current crumb");
    }));
    s.test("ids unique, anchors resolve, images have alt, nothing external", (t) => withFrame({}, (f) => {
      const ids = f.$$("[id]").map((e) => e.id); t.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], "duplicate ids");
      for (const a of f.$$('a[href^="#"]')) { const id = a.getAttribute("href").slice(1); if (id) t.ok(f.doc.getElementById(id), `anchor #${id}`); }
      for (const img of f.$$("img")) t.ok(img.hasAttribute("alt"), `img without alt: ${img.src}`);
      for (const el of f.$$("script[src], link[href], img[src]")) t.ok(!/^(https?:)?\/\//.test(el.getAttribute("src") || el.getAttribute("href")), "external resource");
    }));
  });

  suite("Page frame", {
    group: "Integration", needs: "http",
    description: "Header, breadcrumb band and footer behave as chrome.md describes: the header is sticky, the footer is one column on phones and four from 48rem, the content is capped at the page measure, and the section menu is a native popover.",
  }, (s) => {
    s.test("the header is sticky and stays above content while scrolling", (t) => withFrame({ width: 1280, height: 500 }, async (f) => {
      t.equal(f.style(f.$(".site-header"), "position"), "sticky");
      f.doc.documentElement.style.scrollBehavior = "auto"; f.win.scrollTo(0, 400); await sleep(40);
      t.near(f.$(".site-header").getBoundingClientRect().top, 0, 1, "header stuck to the top");
    }));
    for (const [w, cols] of [[390, 1], [767, 1], [768, 4], [1280, 4]]) {
      s.test(`footer @${w}: ${cols} column${cols > 1 ? "s" : ""}`, (t) => withFrame({ width: w }, (f) => {
        t.equal(f.style(f.$(".site-footer__grid"), "gridTemplateColumns").split(" ").length, cols);
      }));
    }
    s.test("page content is capped at --measure-page (72rem) on wide screens", (t) => withFrame({ width: 1600 }, (f) => {
      t.near(f.$(".page").getBoundingClientRect().width, 1152, 1);
    }));
    s.test("section menu: native popover opens and closes", (t) => withFrame({ width: 1280 }, async (f) => {
      const panel = f.$("#menu-section");
      if (!panel.showPopover) t.skip("this browser has no Popover API");
      f.$(".menu__button").click(); await sleep(40);
      t.equal(panel.matches(":popover-open"), true, "opened"); t.ok(panel.getBoundingClientRect().height > 0, "panel has size");
      panel.hidePopover(); await sleep(20); t.equal(panel.matches(":popover-open"), false, "closed");
    }));
    for (const w of [320, 390, 768, 1024, 1280]) {
      s.test(`no horizontal overflow @${w}`, (t) => withFrame({ width: w }, (f) => t.atMost(f.doc.documentElement.scrollWidth, w, "page is wider than the viewport")));
    }
    s.test("fonts load from the vendored files (Inter, Source Serif 4, IBM Plex Mono)", (t) => withFrame({}, async (f) => {
      await f.doc.fonts.load('16px "Inter"'); await f.doc.fonts.load('500 24px "Source Serif 4"');
      t.ok(f.doc.fonts.check('16px "Inter"'), "Inter"); t.ok(f.doc.fonts.check('500 24px "Source Serif 4"'), "Source Serif 4");
      t.ok(f.style(f.$(".t-title"), "fontFamily").startsWith('"Source Serif 4"'), "page title is serif");
    }));
  });

  suite("Rendered contrast", {
    group: "Integration", needs: "http",
    description: "Contrast measured on the rendered chrome (computed colours over their effective backgrounds): primary nav, breadcrumbs, menu, lede, body copy, buttons, and the footer's text, links and legal line.",
  }, (s) => {
    function backgroundOf(f, el) {
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      const chain = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
      for (const n of chain.reverse()) { const c = color.parse(f.style(n, "backgroundColor")); if (c.a > 0) bg = color.over(c, bg); }
      return bg;
    }
    s.test("chrome text meets AA on its real background", (t) => withFrame({ width: 1280 }, (f) => {
      let measured = 0;
      for (const selector of [".nav-primary a", ".crumbs a", ".crumbs [aria-current]", ".menu__button", ".t-title", ".t-lede", ".t-body", ".t-section", ".btn--outline", ".site-footer__tagline", ".site-footer__col .label", ".site-footer__col a", ".site-footer__legal span", ".site-footer__legal a", ".page-eyebrow"]) {
        for (const el of f.$$(selector)) {
          if (!el.textContent.trim()) continue;
          const size = parseFloat(f.style(el, "fontSize")), weight = Number(f.style(el, "fontWeight")), large = size >= 24 || (size >= 18.66 && weight >= 700);
          t.atLeast(color.contrast(color.parse(f.style(el, "color")), backgroundOf(f, el)), large ? 3 : 4.5, `${selector} "${el.textContent.trim().slice(0, 24)}"`); measured++;
        }
      }
      t.atLeast(measured, 15, "selectors matched too few elements");
    }));
  });
})();
