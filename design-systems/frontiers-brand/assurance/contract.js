/*
 * The brand contract (0014-design-systems FR-028, FR-036, FR-037), identical in every brand design system:
 * tokens.json is DTCG with every alias resolving, it supplies every theme role, brand.css declares exactly
 * those roles with the same values inside the theme layer, brand.tex declares them for print, every foreground role is legible on the surface,
 * and every logo file it lists loads at its stated size.
 */
(() => {
  const { suite, color, fetchText, base, Failure } = window.Assurance;
  const ROLES = { text: "color", surface: "color", primary: "color", secondary: "color", tertiary: "color", success: "color", warning: "color", danger: "color", info: "color", accent: "color", link: "color", "font-sans": "fontFamily", "font-serif": "fontFamily" };
  const FOREGROUND = ["text", "primary", "secondary", "tertiary", "success", "warning", "danger", "info", "accent", "link"];
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
    s.test("brand.tex declares every color role, the font roles and the widest lockups and icon, with tokens.json's values (FR-037)", async (t) => {
      const all = await tokens();
      const tex = (await fetchText("brand.tex")).split("\n").filter((l) => !l.startsWith("%")).join("\n");
      const colors = Object.fromEntries([...tex.matchAll(/\\definecolor\{brand-([\w-]+)\}\{HTML\}\{([0-9A-F]{6})\}/g)].map(([, r, v]) => [r, `#${v.toLowerCase()}`]));
      const commands = Object.fromEntries([...tex.matchAll(/\\newcommand\{\\(\w+)\}\{([^}]*)\}/g)].map(([, n, v]) => [n, v]));
      const colorRoles = Object.keys(all.role).filter((r) => all.role[r].$type === "color");
      t.deepEqual(Object.keys(colors).sort(), colorRoles.sort(), "the same color roles");
      for (const r of colorRoles) t.equal(colors[r], String(roleValue(all, r)).toLowerCase(), `brand-${r}`);
      t.equal(commands.brandfontsans, roleValue(all, "font-sans")); t.equal(commands.brandfontserif, roleValue(all, "font-serif"));
      const l = logo(all), listed = new Set([...l.lockup.files, ...l.icon.files].map((f) => f.file));
      for (const name of ["brandlockuplight", "brandlockupdark", "brandicon"]) t.ok(listed.has(commands[name]), `\\${name} is ${commands[name]}, not a file tokens.json lists`);
      const widest = (files, bg) => files.filter((f) => f.file.endsWith(".png") && (!bg || f.background === bg)).sort((a, b) => b.width - a.width)[0]?.file;
      t.equal(commands.brandlockuplight, widest(l.lockup.files, "light")); t.equal(commands.brandlockupdark, widest(l.lockup.files, "dark")); t.equal(commands.brandicon, widest(l.icon.files));
    });
    s.test("every foreground role reaches 4.5:1 on the surface (FR-037)", async (t) => {
      const all = await tokens();
      const surface = color.parse(roleValue(all, "surface"));
      for (const role of FOREGROUND) t.atLeast(color.contrast(color.parse(roleValue(all, role)), surface), 4.5, `${role} on surface`);
    });
  });

  suite("Logo files", {
    group: "Unit", needs: "http",
    description: "tokens.json lists lockups for light and for dark backgrounds, an icon-only mark, a favicon and a share card, and any app icons, and every file it lists loads at exactly its stated size.",
  }, (s) => {
    const size = (path) => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
      img.onerror = () => reject(new Failure(`${path} does not load`)); img.src = new URL(path, base).href;
    });
    s.test("lockups for light and dark backgrounds, an icon, a favicon and a share card are listed (FR-037)", async (t) => {
      const l = logo(await tokens());
      t.ok(l, "no $extensions.com.intellectualfrontiers.logo");
      for (const bg of ["light", "dark"]) t.ok(l.lockup.files.some((f) => f.background === bg && f.file.endsWith(".webp")), `a WebP lockup for ${bg} backgrounds`);
      t.atLeast(l.icon.files.length, 1, "icon files"); t.ok(l.favicon?.file, "favicon");
      t.equal(`${l["share-card"]?.width}x${l["share-card"]?.height}`, "1200x630", "a 1200x630 share card");
    });
    s.test("every listed file loads at its stated size", async (t) => {
      const l = logo(await tokens());
      for (const f of [...l.lockup.files, ...l.icon.files, l.favicon, l["share-card"], ...(l["app-icons"]?.files || [])]) {
        const [w, h] = await size(f.file);
        t.equal(`${w}x${h}`, `${f.width}x${f.height}`, f.file);
      }
    });
  });

  suite("Unit marks", {
    group: "Unit", needs: "http",
    description: "A brand that lists unit marks has one for every unit it colors, each one-color SVG in currentColor, so it is placed in its unit's color or the text color. A brand without them passes.",
  }, (s) => {
    s.test("one one-color mark per unit", async (t) => {
      const all = await tokens();
      const units = logo(all).units;
      if (!units) return t.skip("no unit marks");
      const colored = Object.keys(all.unit || {}).filter((k) => !k.startsWith("$"));
      t.deepEqual(Object.keys(units).filter((k) => !k.startsWith("$")).sort(), colored.sort(), "a mark for every unit color");
      for (const [unit, mark] of Object.entries(units)) {
        if (unit.startsWith("$")) continue;
        const res = await fetch(new URL(mark.file, base));
        t.ok(res.ok, `${mark.file} loads`);
        const svg = new DOMParser().parseFromString(await res.text(), "image/svg+xml").documentElement;
        t.equal(svg.nodeName, "svg", `${mark.file} is SVG`);
        for (const el of svg.querySelectorAll("[fill], [stroke]")) for (const attr of ["fill", "stroke"]) {
          const v = el.getAttribute(attr);
          if (v !== null) t.ok(v === "currentColor" || v === "none", `${mark.file}: ${attr}="${v}"`);
        }
      }
    });
  });

  suite("Decoration kit", {
    group: "Unit", needs: "http",
    description: "A brand that supplies a decoration kit (0014-design-systems FR-047) has a one-color vector lockup and icon, and may add a wordmark, drawn only in currentColor so a decorator chooses the ink, each with its finest detail, and a spot-color and a thread match for each color role it lists. A brand without one passes and themes no merchandise design system.",
  }, (s) => {
    const kit = async () => (await tokens()).$extensions["com.intellectualfrontiers.decoration"];
    s.test("the lockup, icon and any wordmark are one-color SVG in currentColor", async (t) => {
      const k = await kit();
      if (!k) return t.skip("no decoration kit");
      for (const part of ["lockup", "icon", "wordmark"].filter((p) => p !== "wordmark" || k.wordmark)) {
        const res = await fetch(new URL(k[part].file, base));
        t.ok(res.ok, `${k[part].file} loads`);
        const svg = new DOMParser().parseFromString(await res.text(), "image/svg+xml").documentElement;
        t.equal(svg.nodeName, "svg", `${k[part].file} is SVG`);
        t.ok(k[part]["finest-detail"] > 0 && k[part]["finest-detail"] < 0.2, `${part}: its finest line or gap, as a fraction of its width`);
        t.equal(svg.querySelectorAll("image, text, linearGradient, radialGradient, pattern, filter").length, 0, `${k[part].file} is outlined vector art, with no raster, live text, gradient or filter`);
        for (const el of svg.querySelectorAll("*")) for (const attr of ["fill", "stroke"]) {
          const v = el.getAttribute(attr);
          if (v !== null) t.ok(v === "currentColor" || v === "none", `${k[part].file}: ${el.nodeName} ${attr}="${v}"`);
        }
      }
    });
    s.test("every listed ink is a color role with a spot-color and a thread match", async (t) => {
      const k = await kit();
      if (!k) return t.skip("no decoration kit");
      const all = await tokens();
      t.ok(Object.keys(k.inks).length >= 2, "at least a dark and a light ink");
      for (const [role, ink] of Object.entries(k.inks)) {
        t.equal(all.role[role]?.$type, "color", `${role} is a color role`);
        t.ok(ink.spot?.system && ink.spot?.name, `${role}: a spot-color match`);
        t.ok(ink.thread?.system && ink.thread?.number, `${role}: a thread match`);
      }
    });
  });

  suite("Imagery", {
    group: "Unit", needs: "http",
    description: "A brand that supplies an imagery pool lists every piece in imagery/catalog.json with what it shows and its files, and every file loads at its stated size. A brand without one passes and themes no design system that requires imagery.",
  }, (s) => {
    const size = (path) => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
      img.onerror = () => reject(new Failure(`${path} does not load`)); img.src = new URL(path, base).href;
    });
    const catalog = async () => {
      const res = await fetch(new URL("imagery/catalog.json", base));
      return res.ok ? res.json() : null;
    };
    s.test("every piece is described, with a master and WebP files for the web (FR-043)", async (t) => {
      const cat = await catalog();
      if (!cat) return t.skip("no imagery pool");
      t.atLeast(cat.pieces.length, 1, "pieces");
      for (const p of cat.pieces) {
        for (const k of ["id", "name", "file", "environment", "description", "visual_anchor", "metaphors", "pixel_size", "content_box"]) t.ok(p[k] && String(p[k]).length, `${p.id}: ${k}`);
        t.ok(cat.environments.includes(p.environment), `${p.id}: environment ${p.environment}`);
        t.atLeast(p.web.length, 1, `${p.id}: WebP files`);
        for (const w of p.web) t.ok(w.file.endsWith(".webp"), `${w.file} is WebP`);
      }
    });
    s.test("every web file loads at its stated size", async (t) => {
      const cat = await catalog();
      if (!cat) return t.skip("no imagery pool");
      for (const p of cat.pieces) for (const w of p.web) {
        const [width, height] = await size(`imagery/${w.file}`);
        t.equal(`${width}x${height}`, `${w.width}x${w.height}`, w.file);
      }
    });
  });
})();
