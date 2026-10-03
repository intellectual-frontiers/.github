/* Unit suites for Frontiers Brand: tokens.json and the logo files it lists. */
(() => {
  const { suite, color, fetchText, base } = window.Assurance;
  window.Assurance.FIXTURES = ["assurance/fixtures/specimen.html"];
  const tokens = async () => JSON.parse(await fetchText("tokens.json"));
  const HEX = /^#[0-9a-f]{6}$/;

  suite("Tokens", {
    group: "Unit", needs: "http",
    description: "tokens.json names every brand colour, unit colour, typeface and logo file the spec requires, each value once and well formed.",
  }, (s) => {
    s.test("the five brand colours and white are lower-case #rrggbb (spec FR-002)", async (t) => {
      const { color: c } = await tokens();
      t.deepEqual(Object.keys(c), ["deep-ink", "frontier-blue", "signal-teal", "editorial-oxblood", "warm-paper", "white"], "brand colour names");
      for (const [k, v] of Object.entries(c)) t.ok(HEX.test(v), `color.${k} = ${v}`);
    });
    s.test("every unit has a colour, and each is a brand colour or the network violet (spec FR-003)", async (t) => {
      const { color: c, unit } = await tokens();
      t.deepEqual(Object.keys(unit), ["capital", "ip", "press", "studios", "network"], "unit names");
      const brand = new Set(Object.values(c));
      for (const [k, v] of Object.entries(unit)) t.ok(HEX.test(v) && (brand.has(v) || k === "network"), `unit.${k} = ${v}`);
    });
    s.test("the sans and serif families and the wordmark are named (spec FR-004)", async (t) => {
      const { typeface } = await tokens();
      t.equal(typeface.sans, "Inter"); t.equal(typeface.serif, "Source Serif 4");
      t.deepEqual(typeface.wordmark, { family: "Inter", weight: 700 });
    });
  });

  suite("Contrast", {
    group: "Unit", needs: "http",
    description: "Every text pairing tokens.json lists, and every unit colour on white and on Warm Paper, meets WCAG 2.2 AA for body text (4.5:1).",
  }, (s) => {
    s.test("listed text pairings are at least 4.5:1 (spec FR-005)", async (t) => {
      const { color: c, "text-pairings": pairs } = await tokens();
      t.atLeast(pairs.length, 8, "pairings listed");
      for (const [fg, bg] of pairs) t.atLeast(color.contrast(color.parse(c[fg]), color.parse(c[bg])), 4.5, `${fg} on ${bg}`);
    });
    s.test("unit colours are at least 4.5:1 on white and on Warm Paper (spec FR-005)", async (t) => {
      const { color: c, unit } = await tokens();
      for (const [k, v] of Object.entries(unit)) for (const bg of ["white", "warm-paper"]) t.atLeast(color.contrast(color.parse(v), color.parse(c[bg])), 4.5, `${k} on ${bg}`);
    });
  });

  suite("Logo files", {
    group: "Unit", needs: "http",
    description: "Every lockup, icon and favicon tokens.json lists exists at exactly its stated pixel size, comes in a light and a dark variant where the spec requires both, and no logo file sits outside that list.",
  }, (s) => {
    const size = (path) => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
      img.onerror = () => reject(new window.Assurance.Failure(`${path} does not load`)); img.src = new URL(path, base).href;
    });
    s.test("every listed file loads at its stated size (spec FR-006, FR-007)", async (t) => {
      const { logo } = await tokens();
      const files = [...logo.lockup.files, ...logo.icon.files, logo.favicon];
      for (const f of files) {
        const [w, h] = await size(f.file);
        t.equal(`${w}x${h}`, `${f.width}x${f.height}`, f.file);
        if (f.file.startsWith("logos/")) t.ok(f.file.includes(`-${f.width}x${f.height}-`), `${f.file} names its size`);
      }
    });
    s.test("each lockup size has a light and a dark variant, in PNG and in WebP below the master size (spec FR-006)", async (t) => {
      const { logo } = await tokens();
      const have = new Set(logo.lockup.files.map((f) => `${f.background} ${f.width}x${f.height} ${f.file.split(".").pop()}`));
      const sizes = [...new Set(logo.lockup.files.map((f) => `${f.width}x${f.height}`))];
      for (const sz of sizes) for (const bg of ["light", "dark"]) {
        t.ok(have.has(`${bg} ${sz} png`), `${bg} ${sz} png`);
        if (sz !== "1229x362") t.ok(have.has(`${bg} ${sz} webp`), `${bg} ${sz} webp`);
      }
    });
    s.test("minimum sizes are stated (spec FR-008)", async (t) => {
      const { logo } = await tokens();
      t.equal(logo.lockup["min-width-px"], 100); t.equal(logo.lockup["min-width-in"], 1);
      t.equal(logo.icon["min-width-px"], 50); t.equal(logo.icon["min-width-in"], 0.5);
      for (const f of logo.lockup.files) t.atLeast(f.width, logo.lockup["min-width-px"], `${f.file} is above the minimum`);
    });
  });
})();
