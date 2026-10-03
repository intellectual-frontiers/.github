/* What Frontiers Console inherits from frontiers-brand (0014-design-systems FR-020, FR-021). Needs http, and frontiers-brand
   vendored beside this design system; without it these tests are skipped, never passed. */
(() => {
  const { suite, base, fetchText, fetchSource } = window.Assurance;
  const brand = async () => JSON.parse(await fetchSource("frontiers-brand", "tokens.json"));
  const declared = async () => {
    const css = (await fetchText("css/tokens.css")).replace(/\/\*[\s\S]*?\*\//g, "");
    const root = css.match(/:root\s*\{([\s\S]*?)\n  \}/)[1];
    return (name) => root.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim();
  };
  // [this system's token, frontiers-brand tokens.json group, key]
  const COLOURS = [["--fc-foreground", "color", "deep-ink"], ["--fc-primary", "color", "frontier-blue"], ["--fc-success", "color", "signal-teal"], ["--fc-danger", "color", "editorial-oxblood"], ["--fc-info", "unit", "network"]];
  const FONTS = [["--fc-font-sans", "sans"]];

  suite("Inherited from frontiers-brand", {
    group: "Unit", needs: "http",
    description: "Every brand colour, unit colour, typeface and logo file this design system uses is an exact copy of frontiers-brand's.",
  }, (s) => {
    s.test("colour tokens equal frontiers-brand's values", async (t) => {
      const [b, value] = [await brand(), await declared()];
      for (const [token, group, key] of COLOURS) t.equal(value(token)?.toLowerCase(), b[group][key], `${token} is ${group}.${key}`);
    });
    s.test("font stacks lead with frontiers-brand's families", async (t) => {
      const [b, value] = [await brand(), await declared()];
      for (const [token, key] of FONTS) t.ok(value(token)?.startsWith(`"${b.typeface[key]}"`), `${token} leads with ${b.typeface[key]}`);
    });
    s.test("every logo file this system ships that frontiers-brand also ships is byte-identical", async (t) => {
      const b = await brand();
      let shared = 0;
      for (const { file } of [...b.logo.lockup.files, ...b.logo.icon.files, b.logo.favicon]) {
        const own = await fetch(new URL(file, base));
        if (!own.ok) continue;
        const [mine, theirs] = [new Uint8Array(await own.arrayBuffer()), await fetchSource("frontiers-brand", file, "bytes")];
        t.ok(mine.length === theirs.length && mine.every((x, i) => x === theirs[i]), `${file} differs from frontiers-brand's`);
        shared++;
      }
      t.atLeast(shared, 1, "no logo file shared with frontiers-brand");
    });
  });
})();
