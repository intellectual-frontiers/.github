/* Suites for Frontiers Slides (spec FR-014): the fixture deck, rendered at 1920x1080 in a real browser. Needs http. */
(() => {
  const { suite, color, frame, fetchText } = window.Assurance;
  window.Assurance.FIXTURES = ["assurance/fixtures/pass/deck.html"];
  const DECK = "assurance/fixtures/pass/deck.html?print";
  const LAYOUTS = ["title", "section", "statement", "content", "figure", "two-column", "quote", "end"];
  async function withDeck(fn) { const f = await frame(DECK, { width: 1920, height: 1080 }); try { return await fn(f); } finally { f.close(); } }
  const visibleText = (f, slide) => [...slide.querySelectorAll("*")].filter((el) =>
    !el.closest(".notes") && !el.closest("svg") && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    && f.style(el, "display") !== "none" && f.style(el, "visibility") !== "hidden");
  const solid = (f, el) => {
    let bg = { r: 0, g: 0, b: 0, a: 0 };
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const c = color.parse(f.style(e, "backgroundColor"));
      bg = color.over(bg, c);
      if (bg.a >= 0.999) break;
    }
    return bg;
  };

  suite("Stylesheet discipline", {
    group: "Unit", needs: "http",
    description: "slides.css colors everything with the brand's theme roles and holds no color of its own (0014-design-systems FR-044), and names every layout spec FR-005 lists.",
  }, (s) => {
    s.test("no color literal outside comments", async (t) => {
      const css = (await fetchText("css/slides.css")).replace(/\/\*[\s\S]*?\*\//g, "");
      const hits = css.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\(|\b(?:white|black|red|blue|green|gray|grey)\b/gi) || [];
      t.deepEqual(hits, [], "color literals");
    });
    s.test("every layout has rules", async (t) => {
      const css = await fetchText("css/slides.css");
      for (const l of LAYOUTS.filter((l) => l !== "content")) t.ok(css.includes(`[data-layout="${l}"]`), `no rules for the ${l} layout`);
    });
  });

  suite("Canvas and layouts", {
    group: "Integration", needs: "http",
    description: "Every slide of the fixture deck is 1920x1080, the deck uses every layout and both tones, and nothing on a slide runs outside it or under its footer (spec FR-003, FR-005).",
  }, (s) => {
    s.test("every slide is 1920x1080", (t) => withDeck((f) => {
      for (const [i, sl] of f.$$(".slide").entries()) {
        const r = sl.getBoundingClientRect();
        t.equal([Math.round(r.width), Math.round(r.height)].join("x"), "1920x1080", `slide ${i + 1}`);
      }
    }));
    s.test("the fixture uses every layout and both tones", (t) => withDeck((f) => {
      const used = new Set(f.$$(".slide").map((sl) => sl.dataset.layout || "content"));
      for (const l of LAYOUTS) t.ok(used.has(l), `the fixture has no ${l} slide`);
      t.ok(f.$('.slide[data-tone="dark"]'), "no dark slide");
    }));
    s.test("nothing runs outside its slide or under the footer", (t) => withDeck((f) => {
      for (const [i, sl] of f.$$(".slide").entries()) {
        const box = sl.getBoundingClientRect(), footer = sl.querySelector(".footer");
        const limit = footer && f.style(footer, "display") !== "none" ? footer.getBoundingClientRect().top : box.bottom;
        for (const el of sl.querySelectorAll("h1, p, li, blockquote, .figure, .columns, img.lockup")) {
          if (el.closest(".footer") || el.closest(".notes")) continue;
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          t.ok(r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= limit + 1,
            `slide ${i + 1}: ${el.tagName.toLowerCase()}${el.className ? "." + el.className : ""} runs outside the slide or under its footer`);
        }
      }
    }));
  });

  suite("Type and contrast", {
    group: "Integration", needs: "http",
    description: "No text on a slide is set below 24px, every text meets WCAG AA 4.5:1 against its slide in both tones, and a figure on a dark slide takes frontiers-figures' on-dark variant (spec FR-004, FR-007, FR-008).",
  }, (s) => {
    s.test("no text below 24px", (t) => withDeck((f) => {
      for (const [i, sl] of f.$$(".slide").entries()) {
        for (const el of visibleText(f, sl)) t.ok(parseFloat(f.style(el, "fontSize")) >= 24, `slide ${i + 1}: ${el.tagName.toLowerCase()} at ${f.style(el, "fontSize")}`);
      }
    }));
    s.test("every text meets 4.5:1 on its slide", (t) => withDeck((f) => {
      for (const [i, sl] of f.$$(".slide").entries()) {
        for (const el of visibleText(f, sl)) {
          const fg = color.over(color.parse(f.style(el, "color")), solid(f, el));
          const ratio = color.contrast(fg, solid(f, el));
          t.ok(ratio >= 4.5, `slide ${i + 1} (${sl.dataset.tone || "light"}): ${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}" is ${ratio.toFixed(2)}:1`);
        }
      }
    }));
    s.test("a figure on a dark slide is on-dark, on a light slide default", (t) => withDeck((f) => {
      for (const svg of f.$$(".slide .figure > svg")) {
        const dark = svg.closest(".slide").dataset.tone === "dark";
        const style = svg.querySelector("style[data-variant]");
        t.ok(style, "a figure without frontiers-figures' theme");
        if (style) t.equal(style.dataset.variant, dark ? "on-dark" : "default", "figure variant");
      }
    }));
  });

  suite("Viewer", {
    group: "Integration", needs: "http",
    description: "The viewer shows one slide at a time, scaled to the window, moves with the keyboard, keeps the slide in the URL's hash and shows the speaker notes on N (spec FR-010).",
  }, (s) => {
    s.test("one slide at a time; keys move; N shows notes", async (t) => {
      const f = await frame("assurance/fixtures/pass/deck.html#4", { width: 1280, height: 720 });
      try {
        const visible = () => f.$$(".slide").filter((sl) => f.style(sl, "visibility") === "visible");
        t.equal(visible().length, 1, "slides visible at once");
        t.equal(visible()[0].getAttribute("aria-label"), "Slide 4", "opens on the hash's slide");
        f.key(f.doc, "ArrowRight");
        t.equal(visible()[0].getAttribute("aria-label"), "Slide 5", "Right moves on");
        t.ok(f.win.location.hash === "#5", "the hash follows");
        f.key(f.doc, "n");
        t.ok(f.doc.documentElement.classList.contains("notes"), "N shows the notes");
        t.ok(f.$("#deck-notes").textContent.includes("Read the three"), "the notes are this slide's");
        const r = visible()[0].getBoundingClientRect();
        t.ok(r.width <= 1281 && r.height <= 721, `the slide is scaled to the window (${Math.round(r.width)}x${Math.round(r.height)})`);
      } finally { f.close(); }
    });
  });
})();
