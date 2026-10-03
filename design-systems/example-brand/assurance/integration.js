/* Integration suite, identical in every brand design system: the specimen, loaded into a real sized iframe. Needs http(s). */
(() => {
  const { suite, color, frame, fetchText } = window.Assurance;
  const SPECIMEN = "assurance/fixtures/specimen.html";
  async function withFrame(size, fn) { const f = await frame(SPECIMEN, size); try { return await fn(f); } finally { f.close(); } }

  suite("Specimen", {
    group: "Integration", needs: "http",
    description: "The specimen renders every brand colour from tokens.json, and shows every logo file at its native size: light lockups on white or Warm Paper, dark lockups on Deep Ink, never scaled up.",
  }, (s) => {
    s.test("every brand colour has a swatch rendering exactly its tokens.json value", (t) => withFrame({}, async (f) => {
      const tokens = JSON.parse(await fetchText("tokens.json"));
      for (const [name, tok] of Object.entries(tokens.color).filter(([k]) => !k.startsWith("$"))) {
        const hex = tok.$value;
        const sw = f.$(`[data-swatch="${name}"]`); t.ok(sw, `swatch ${name}`);
        if (sw) t.deepEqual(color.parse(f.style(sw, "backgroundColor")), color.parse(hex), name);
      }
    }));
    s.test("every logo file is shown, never wider than its native width", (t) => withFrame({ width: 1400 }, async (f) => {
      const tokens = JSON.parse(await fetchText("tokens.json"));
      const l = tokens.$extensions["com.intellectualfrontiers.logo"];
      const files = [...l.lockup.files, ...l.icon.files];
      for (const file of files) {
        const img = f.$(`img[src$="${file.file}"]`); t.ok(img, `${file.file} shown`);
        if (img) { await img.decode().catch(() => {}); t.atMost(img.getBoundingClientRect().width, file.width + 0.5, `${file.file} scaled up`); t.ok(img.alt, `${file.file} alt`); }
      }
    }));
    s.test("light lockups sit on a light background and dark lockups on Deep Ink (spec FR-009)", (t) => withFrame({ width: 1400 }, (f) => {
      for (const img of f.$$("img[data-background]")) {
        const bg = color.parse(f.style(img.closest("[data-surface]"), "backgroundColor"));
        const light = color.luminance(bg) > 0.8;
        t.equal(img.dataset.background === "light", light, `${img.getAttribute("src")} on ${f.style(img.closest("[data-surface]"), "backgroundColor")}`);
      }
    }));
  });
})();
