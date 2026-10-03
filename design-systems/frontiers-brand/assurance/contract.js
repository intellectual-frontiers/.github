/*
 * The brand contract (0014-design-systems FR-028, FR-036, FR-037), identical in every brand design system:
 * tokens.json is DTCG with every alias resolving, it supplies every theme role, brand.css declares exactly
 * those roles with the same values inside the theme layer, every foreground role is legible on the surface,
 * and every logo file it lists loads at its stated size.
 */
(() => {
  const { suite, color, fetchText, base, Failure } = window.Assurance;
  const ROLES = { text: "color", surface: "color", primary: "color", secondary: "color", tertiary: "color", success: "color", warning: "color", danger: "color", info: "color", "font-sans": "fontFamily", "font-serif": "fontFamily" };
  const FOREGROUND = ["text", "primary", "secondary", "tertiary", "success", "warning", "danger", "info"];
  const tokens = async () => JSON.parse(await fetchText("tokens.json"));
  const resolve = (all, value) => {
    for (let i = 0; i < 10 && typeof value === "string" && /^\{[^}]+\}$/.test(value); i++) {
      const [group, ...rest] = value.slice(1, -1).split(".");
      value = all[group]?.[rest.join(".")]?.$value;
    }
    return value;
  };
  const roleValue = (all, role) => resolve(all, all.role[role].$value);
  const logo = (all) => all.$extensions?.["com.intellectualfrontiers.logo"];

  suite("Brand contract", {
    group: "Unit", needs: "http",
    description: "tokens.json is in the Design Tokens Community Group format and every alias resolves; it supplies every theme role every brand must; brand.css declares exactly the roles tokens.json has, with the same values, inside @layer theme; and every foreground role reaches 4.5:1 on the surface.",
  }, (s) => {
    s.test("every token has a $value, and every alias resolves (FR-036)", async (t) => {
      const all = await tokens();
      for (const [group, members] of Object.entries(all)) {
        if (group.startsWith("$")) continue;
        for (const [name, tok] of Object.entries(members)) {
          if (name.startsWith("$")) continue;
          t.ok(tok && "$value" in tok, `${group}.${name} has no $value`);
          const v = resolve(all, tok.$value);
          t.ok(v !== undefined && !/^\{/.test(String(v)), `${group}.${name} does not resolve (${tok.$value})`);
        }
      }
    });
    s.test("every theme role is supplied, with its type (FR-037)", async (t) => {
      const all = await tokens();
      for (const [role, type] of Object.entries(ROLES)) {
        t.ok(all.role?.[role], `role.${role} is missing`);
        if (all.role?.[role]) t.equal(all.role[role].$type, type, `role.${role} type`);
      }
    });
    s.test("brand.css declares exactly the roles, with their values, in @layer theme (FR-028)", async (t) => {
      const all = await tokens();
      const css = (await fetchText("brand.css")).replace(/\/\*[\s\S]*?\*\//g, "");
      t.ok(/^\s*@layer theme\s*\{\s*:root\s*\{[^}]*\}\s*\}\s*$/.test(css), "brand.css holds one @layer theme { :root { ... } } and nothing else");
      const declared = Object.fromEntries([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, n, v]) => [n, v.trim()]));
      t.deepEqual(Object.keys(declared).sort(), Object.keys(all.role).map((r) => `--brand-${r}`).sort(), "the same roles");
      for (const role of Object.keys(all.role)) {
        const want = String(roleValue(all, role));
        const got = declared[`--brand-${role}`] ?? "";
        t.equal(got.replace(/^"|"$/g, "").toLowerCase(), want.toLowerCase(), `--brand-${role}`);
      }
    });
    s.test("every foreground role reaches 4.5:1 on the surface (FR-037)", async (t) => {
      const all = await tokens();
      const surface = color.parse(roleValue(all, "surface"));
      for (const role of FOREGROUND) t.atLeast(color.contrast(color.parse(roleValue(all, role)), surface), 4.5, `${role} on surface`);
    });
  });

  suite("Logo files", {
    group: "Unit", needs: "http",
    description: "tokens.json lists lockups for light and for dark backgrounds, an icon-only mark and a favicon, and every file it lists loads at exactly its stated size.",
  }, (s) => {
    const size = (path) => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
      img.onerror = () => reject(new Failure(`${path} does not load`)); img.src = new URL(path, base).href;
    });
    s.test("lockups for light and dark backgrounds, an icon and a favicon are listed (FR-037)", async (t) => {
      const l = logo(await tokens());
      t.ok(l, "no $extensions.com.intellectualfrontiers.logo");
      for (const bg of ["light", "dark"]) t.ok(l.lockup.files.some((f) => f.background === bg && f.file.endsWith(".webp")), `a WebP lockup for ${bg} backgrounds`);
      t.atLeast(l.icon.files.length, 1, "icon files"); t.ok(l.favicon?.file, "favicon");
    });
    s.test("every listed file loads at its stated size", async (t) => {
      const l = logo(await tokens());
      for (const f of [...l.lockup.files, ...l.icon.files, l.favicon]) {
        const [w, h] = await size(f.file);
        t.equal(`${w}x${h}`, `${f.width}x${f.height}`, f.file);
      }
    });
  });
})();
