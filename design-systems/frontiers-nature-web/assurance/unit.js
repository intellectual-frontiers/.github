/* Unit suites for Frontiers Nature: tokens, contrast, and stylesheet discipline. */
(() => {
  const { suite, color, fetchText } = window.Assurance;
  const FIXTURES = ["assurance/fixtures/page.html"];
  window.Assurance.FIXTURES = FIXTURES;

  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  document.documentElement.append(probe);
  const token = (name) => { probe.style.color = `var(${name})`; return color.parse(getComputedStyle(probe).color); };
  const raw = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  suite("Design tokens", {
    group: "Unit",
    description: "Every token the design system promises exists and resolves; tokens.json agrees with tokens.css on every colour and layout value it mirrors; and every text/background pairing the chrome relies on meets WCAG AA.",
  }, (s) => {
    const REQUIRED = ["--ink", "--paper", "--stone", "--shell", "--rule", "--background", "--foreground", "--muted-foreground",
      "--capital", "--ip", "--press", "--studios", "--network", "--diagram-ink", "--diagram-path", "--diagram-warning", "--diagram-positive", "--diagram-caution", "--diagram-secondary",
      "--font-sans", "--font-serif", "--font-mono", "--measure-page", "--gutter", "--radius", "--chrome-clearance", "--ease", "--fast"];
    s.test("every required token is defined on :root", (t) => {
      const missing = REQUIRED.filter((name) => !raw(name));
      t.ok(missing.length === 0, `missing tokens: ${missing.join(", ")}`);
    });

    s.test("tokens.json mirrors tokens.css (colours, layout, radius)", async (t) => {
      const css = (await fetchText("css/tokens.css")).replace(/\/\*[\s\S]*?\*\//g, "");
      const root = css.match(/:root\s*\{([\s\S]*?)\n  \}/)[1];
      const value = (name) => root.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim();
      const json = JSON.parse(await fetchText("tokens.json"));
      const hex = (v) => v?.toLowerCase();
      for (const k of ["ink", "paper", "stone", "shell", "rule"]) t.equal(hex(json.color[k]), hex(value(`--${k}`)), `color.${k}`);
      for (const [k, v] of Object.entries(json.color.unit)) t.equal(hex(v), hex(value(`--${k}`)), `color.unit.${k}`);
      for (const [k, v] of Object.entries(json.color.diagram)) t.equal(hex(v), hex(value(`--diagram-${k}`)), `color.diagram.${k}`);
      t.equal(json.layout.maxWidth, value("--measure-page"), "layout.maxWidth"); t.equal(json.layout.gutter, value("--gutter"), "layout.gutter");
      t.equal(json.layout.chromeClearance, value("--chrome-clearance"), "layout.chromeClearance"); t.equal(json.radius, "0px", "radius");
      t.equal(value("--radius"), "0", "radius is square");
    }, { needs: "http" });

    const TEXT = [
      ["ink on background", "--ink", "--background"], ["ink on paper", "--ink", "--paper"], ["ink on stone", "--ink", "--stone"], ["ink on shell", "--ink", "--shell"],
      ["muted-foreground on background", "--muted-foreground", "--background"], ["muted-foreground on stone (breadcrumb band)", "--muted-foreground", "--stone"],
      ["muted-foreground on shell (header)", "--muted-foreground", "--shell"], ["muted-foreground on paper", "--muted-foreground", "--paper"],
      ["capital on background", "--capital", "--background"], ["press on background", "--press", "--background"], ["studios on background", "--studios", "--background"],
      ["network on background", "--network", "--background"], ["diagram-caution on background", "--diagram-caution", "--background"],
    ];
    for (const [label, fg, bg] of TEXT) s.test(`text contrast ≥ 4.5:1 — ${label}`, (t) => t.atLeast(color.contrast(token(fg), token(bg)), 4.5, label));
  });

  suite("Stylesheet discipline", {
    group: "Unit", needs: "http",
    description: "bundle.txt lists real files; every rule outside @font-face lives in a cascade layer; and no file uses @import, a remote URL, a CSS framework, or !important outside the print and reduced-motion carve-outs.",
  }, (s) => {
    let bundle, files;
    const load = async () => {
      if (files) return;
      bundle = (await fetchText("css/bundle.txt")).split("\n").map((l) => l.trim()).filter(Boolean);
      files = Object.fromEntries(await Promise.all(bundle.map(async (name) => [name, (await fetchText(`css/${name}`)).replace(/\/\*[\s\S]*?\*\//g, "")])));
    };
    /** Remove brace-balanced blocks introduced by `keyword` (and, for statements like `@layer a, b;`, the statement). */
    const removeBlocks = (text, keyword) => {
      let out = "", i = 0;
      while (i < text.length) {
        const at = text.indexOf(keyword, i);
        if (at < 0) { out += text.slice(i); break; }
        out += text.slice(i, at);
        const semi = text.indexOf(";", at), brace = text.indexOf("{", at);
        if (brace < 0 || (semi >= 0 && semi < brace)) { i = semi + 1; continue; }
        let depth = 0, j = brace;
        for (; j < text.length; j++) { if (text[j] === "{") depth++; else if (text[j] === "}" && --depth === 0) break; }
        i = j + 1;
      }
      return out;
    };
    // Unlayered @media print is deliberate: unlayered rules beat layered ones, so print overrides win.
    const stripLayers = (text) => removeBlocks(removeBlocks(text, "@layer"), "@media print");
    s.test("bundle.txt lists fonts, tokens, base, chrome and components in that order, all present", async (t) => {
      await load(); t.deepEqual(bundle, ["fonts.css", "tokens.css", "base.css", "chrome.css", "components.css"]);
    });
    s.test("every rule outside @font-face (and the deliberately unlayered @media print block) is inside a cascade layer", async (t) => {
      await load();
      for (const [name, text] of Object.entries(files)) {
        const leftover = stripLayers(text).replace(/@font-face\s*\{[^}]*\}/g, "").trim();
        t.equal(leftover, "", `${name} has unlayered rules`);
      }
    });
    s.test("no @import, remote URL or CSS framework", async (t) => {
      await load();
      for (const [name, text] of Object.entries(files)) {
        t.ok(!/@import/.test(text), `${name} uses @import`);
        t.ok(!/url\(\s*["']?(https?:)?\/\//.test(text), `${name} references a remote URL`);
        t.ok(!/@tailwind|@apply/.test(text), `${name} looks like a CSS framework`);
      }
    });
    s.test("!important appears only inside print and reduced-motion blocks", async (t) => {
      await load();
      for (const [name, text] of Object.entries(files)) {
        const code = removeBlocks(removeBlocks(text, "@media print"), "@media (prefers-reduced-motion");
        t.ok(!/!important/.test(code), `${name} uses !important outside the allowed blocks`);
      }
    });
    s.test("every font file referenced by fonts.css exists", async (t) => {
      await load();
      for (const [, path] of files["fonts.css"].matchAll(/url\("\.\.\/([^"]+)"\)/g)) t.ok((await fetch(new URL(path, window.Assurance.base))).ok, `missing ${path}`);
    });
    s.test("the only first-party script defines if-shelf and uses no imports or network", async (t) => {
      const code = (await fetchText("js/chrome.js")).replace(/\/\*[\s\S]*?\*\//g, "");
      t.ok(/customElements\.define\("if-shelf"/.test(code), "defines if-shelf");
      t.ok(!/^\s*(import|export)\s/m.test(code) && !/\bimport\(/.test(code), "uses modules");
      t.ok(!/https?:\/\//.test(code), "mentions a remote URL");
    });
  });
})();
