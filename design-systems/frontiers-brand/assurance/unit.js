/* Suites specific to Frontiers Brand: its palette, units, typefaces and logo set (spec.md). */
(() => {
  const { suite, color, fetchText } = window.Assurance;
  window.Assurance.FIXTURES = ["assurance/fixtures/specimen.html"];
  const tokens = async () => JSON.parse(await fetchText("tokens.json"));
  const value = (all, v) => { while (/^\{/.test(v)) { const [g, k] = v.slice(1, -1).split("."); v = all[g][k].$value; } return v; };

  suite("Frontiers palette", {
    group: "Unit", needs: "http",
    description: "The palette, unit colors and typefaces are the ones spec.md states, the theme roles map onto them as it says, and each brand color and unit color is legible on white and on Warm Paper.",
  }, (s) => {
    s.test("the palette is the named colors, lower-case #rrggbb (spec FR-002)", async (t) => {
      const { color: c } = await tokens();
      t.deepEqual(Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, v.$value])), {
        "deep-ink": "#121820", "frontier-blue": "#214ea2", "signal-teal": "#1f7775", "editorial-oxblood": "#8a3147",
        "warm-paper": "#f3f0e8", white: "#ffffff", amber: "#8a5a24", violet: "#4a4a8c",
      });
    });
    s.test("each unit has its color (spec FR-003)", async (t) => {
      const all = await tokens();
      const u = Object.fromEntries(["capital", "ip", "press", "studios", "network"].map((k) => [k, value(all, all.unit[k].$value)]));
      t.deepEqual(u, { capital: "#214ea2", ip: "#121820", press: "#8a3147", studios: "#1f7775", network: "#4a4a8c" });
    });
    s.test("the theme roles map onto the palette as spec.md states (spec FR-014)", async (t) => {
      const all = await tokens();
      const r = (k) => value(all, all.role[k].$value);
      t.deepEqual(["text", "surface", "primary", "secondary", "tertiary", "success", "warning", "danger", "info", "accent", "link", "paper"].map(r),
        ["#121820", "#ffffff", "#214ea2", "#1f7775", "#8a3147", "#1f7775", "#8a5a24", "#8a3147", "#4a4a8c", "#8a3147", "#214ea2", "#f3f0e8"]);
    });
    s.test("Inter and Source Serif 4, and Inter Bold for the wordmark (spec FR-004)", async (t) => {
      const { typeface } = await tokens();
      t.equal(typeface.sans.$value, "Inter"); t.equal(typeface.serif.$value, "Source Serif 4"); t.equal(typeface["name-weight"].$value, 700);
    });
    s.test("every palette ink and unit color is at least 4.5:1 on white and on Warm Paper (spec FR-005)", async (t) => {
      const all = await tokens();
      const inks = ["deep-ink", "frontier-blue", "signal-teal", "editorial-oxblood", "amber", "violet"].map((k) => [k, all.color[k].$value]);
      for (const [k, v] of inks) for (const bg of ["white", "warm-paper"]) t.atLeast(color.contrast(color.parse(v), color.parse(all.color[bg].$value)), 4.5, `${k} on ${bg}`);
    });
    s.test("each lockup size has light and dark variants, PNG and WebP below the master; names state their size (spec FR-006, FR-008)", async (t) => {
      const l = (await tokens()).$extensions["com.intellectualfrontiers.logo"];
      const have = new Set(l.lockup.files.map((f) => `${f.background} ${f.width}x${f.height} ${f.file.split(".").pop()}`));
      for (const sz of new Set(l.lockup.files.map((f) => `${f.width}x${f.height}`))) for (const bg of ["light", "dark"]) {
        t.ok(have.has(`${bg} ${sz} png`), `${bg} ${sz} png`);
        if (sz !== "1229x362") t.ok(have.has(`${bg} ${sz} webp`), `${bg} ${sz} webp`);
      }
      for (const f of [...l.lockup.files, ...l.icon.files]) t.ok(f.file.includes(`-${f.width}x${f.height}-`), `${f.file} names its size`);
      t.equal(l.lockup["min-width-px"], 100); t.equal(l.icon["min-width-px"], 50);
    });
  });
})();
