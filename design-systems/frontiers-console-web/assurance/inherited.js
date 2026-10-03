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
  // Every frontiers-brand file this design system ships a copy of.
  const FILES = [
    "logos/if-icon-150x127-2026-Sept.png",
    "logos/web/if-logo-150x36-2026-Sept.webp",
    "logos/web/if-logo-299x72-2026-Sept.webp",
    "logos/web/if-logo-dark-150x36-2026-Sept.webp",
    "logos/web/if-logo-dark-299x72-2026-Sept.webp",
    "images/favicon.png",
  ];
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
    s.test("every frontiers-brand file this system ships is byte-identical to frontiers-brand's", async (t) => {
      const b = await brand();
      const listed = new Set([...b.logo.lockup.files, ...b.logo.icon.files, b.logo.favicon].map((f) => f.file));
      for (const file of FILES) {
        t.ok(listed.has(file), `${file} is not a frontiers-brand file`);
        const own = await fetch(new URL(file, base));
        t.ok(own.ok, `${file} is missing from this design system`);
        if (!own.ok) continue;
        const [mine, theirs] = [new Uint8Array(await own.arrayBuffer()), await fetchSource("frontiers-brand", file, "bytes")];
        t.ok(mine.length === theirs.length && mine.every((x, i) => x === theirs[i]), `${file} differs from frontiers-brand's`);
      }
    });
  });
})();
