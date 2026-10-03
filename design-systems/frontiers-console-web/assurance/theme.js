/*
 * The theme suite (0014-design-systems FR-036 to FR-039), identical in every web design system: tokens.json mirrors
 * tokens.css; every brand value comes from the theme by reference; the theme supplies every role this system uses,
 * in font families it ships; and no stylesheet holds a color literal. Needs http.
 */
(() => {
  const { suite, fetchText, themeTokens, THEME } = window.Assurance;
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  /** Every custom property declared on :root in css/tokens.css (the light theme), in order. */
  const declared = async () => {
    const root = strip(await fetchText("css/tokens.css")).match(/:root\s*\{([\s\S]*?)\n  \}/)[1];
    return [...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim().replace(/\s+/g, " ")]);
  };
  const stylesheets = async () => {
    const bundle = (await fetchText("css/bundle.txt")).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    return Promise.all(bundle.map(async (name) => [name, strip(await fetchText(`css/${name}`))]));
  };
  /** A DTCG value with {role.x} aliases written as the CSS that resolves them: var(--brand-x). */
  const asCss = (value) => String(value).replace(/\{role\.([\w-]+)\}/g, "var(--brand-$1)");
  const resolve = (tokens, value) => {
    for (let i = 0; i < 10 && typeof value === "string" && /^\{[^}]+\}$/.test(value); i++) {
      const [group, ...rest] = value.slice(1, -1).split(".");
      value = tokens[group]?.[rest.join(".")]?.$value;
    }
    return value;
  };

  suite("Theme", {
    group: "Unit", needs: "http",
    description: `Rendered with the theme ${THEME}. tokens.json mirrors tokens.css, with every theme value written as a {role.*} alias; the theme supplies every role this design system uses, in a font family it ships; and no stylesheet holds a color literal.`,
  }, (s) => {
    s.test("tokens.json mirrors tokens.css, theme values as {role.*} aliases (FR-036)", async (t) => {
      const css = await declared();
      const json = JSON.parse(await fetchText("tokens.json")).tokens;
      t.deepEqual(Object.keys(json), css.map(([name]) => name), "the same tokens, in the same order");
      for (const [name, value] of css) t.equal(asCss(json[name]?.$value), value, name);
    });
    s.test("the theme supplies every role this design system uses (FR-037, FR-038)", async (t) => {
      const brand = await themeTokens();
      const used = new Set();
      for (const [, text] of await stylesheets()) for (const [, role] of text.matchAll(/var\(--brand-([\w-]+)/g)) used.add(role);
      t.atLeast(used.size, 1, "this design system takes nothing from the theme");
      for (const role of used) {
        t.ok(brand.role?.[role], `${THEME} has no role ${role}`);
        t.ok(getComputedStyle(document.documentElement).getPropertyValue(`--brand-${role}`).trim(), `--brand-${role} is not set by ${THEME}'s brand.css`);
      }
    });
    s.test("the theme's font families are ones this design system ships (FR-038)", async (t) => {
      const brand = await themeTokens();
      const shipped = new Set([...(await fetchText("css/fonts.css")).matchAll(/font-family:\s*"([^"]+)"/g)].map(([, f]) => f));
      for (const role of ["font-sans", "font-serif"]) {
        const used = (await stylesheets()).some(([, text]) => text.includes(`var(--brand-${role})`));
        if (used) t.ok(shipped.has(resolve(brand, brand.role[role].$value)), `${role} is ${resolve(brand, brand.role[role].$value)}, which this design system does not ship (${[...shipped].join(", ")})`);
      }
    });
    s.test("no stylesheet holds a color literal; every color is a role or a mix of roles (FR-044)", async (t) => {
      const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|\bcolor\(\s*(?:srgb|display-p3)|(?<![\w-])(?:white|black)(?![\w-])/gi;
      for (const [name, text] of await stylesheets()) {
        const body = text.replace(/@font-face\s*\{[^}]*\}/g, "");
        for (const [hit] of body.matchAll(literal)) t.ok(false, `${name} holds the color literal ${hit}; take it from the theme or mix it from roles`);
      }
    });
  });
})();
