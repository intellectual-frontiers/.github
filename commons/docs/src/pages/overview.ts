// Spec: 0001-docs FR-001
/**
 * The Overview section (commons 0011-documentation FR-009, FR-027): the home page, made from the configuration's home (in commons,
 * `commons/about.ts`) and the spec kit (a card for each capability, under the capability it is part of), and a page for each package,
 * made from its `about`: its summary, its areas, its folders and what each may import, its commands, and its rules with what enforces
 * each.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Build, itemsOf } from "../build.ts";
import { type About, type AboutEnforcer, under } from "../config.ts";
import { specPage } from "../links.ts";
import { type Block, type Card, type Inline, possessive, type Stat } from "../model.ts";
import { type Area, areaFiles, type Package } from "../sources.ts";
import { exampleBlocks } from "./areas.ts";
import { type FamilyEntry, familiesOf } from "./families.ts";
import { numberOf } from "./specs.ts";

/** The first sentence of a text, for a card. */
export function firstSentence(t: string, max = 240): string {
  const flat = t.replace(/\s+/g, " ").trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(flat);
  const s = m?.[1] ?? flat;
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
}

/**
 * What each package imports and what imports it, among the packages of the site: the packages its own sources (not its tests, tools or manifest) import by name, by slug.
 */
export function dependenciesOf(b: Build, packages: readonly Package[]): { readonly uses: ReadonlyMap<string, readonly string[]>; readonly usedBy: ReadonlyMap<string, readonly string[]> } {
  const nameOf = (p: Package): string => {
    const file = under(p.dir, "package.json");
    if (!b.exists(file)) return "";
    return (JSON.parse(b.read(file)) as { name?: string }).name ?? "";
  };
  const slugOf = new Map(packages.map((p) => [nameOf(p), p.slug] as const).filter(([n]) => n !== ""));
  const uses = new Map<string, string[]>();
  const usedBy = new Map<string, string[]>();
  for (const p of packages) {
    const found = new Set<string>();
    for (const f of areaFiles(b.root, p.dir)) {
      const rel = f.slice(p.dir.length + 1);
      if (/^(suite|tools|tests|node_modules|dist)\//.test(rel) || /^(library|about|release)\.ts$/.test(rel)) continue;
      for (const m of b.read(f).matchAll(/from\s+"(@intellectual-frontiers\/[a-z0-9-]+)[/"]/g)) {
        const other = slugOf.get(m[1] ?? "");
        if (other !== undefined && other !== p.slug) found.add(other);
      }
    }
    const mine = [...found].sort();
    uses.set(p.slug, mine);
    for (const o of mine) usedBy.set(o, [...(usedBy.get(o) ?? []), p.slug].sort());
  }
  return { uses, usedBy };
}

/** The imports of the libraries without the ones another import implies: A importing C is left out where A imports B and B imports C, at any distance. */
function reduced(libraries: readonly Package[], uses: ReadonlyMap<string, readonly string[]>): [string, string][] {
  const reaches = (from: string, to: string, skip: string): boolean => {
    const seen = new Set<string>([from]);
    const stack = (uses.get(from) ?? []).filter((x) => x !== skip);
    while (stack.length > 0) {
      const at = stack.pop() ?? "";
      if (at === to) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      stack.push(...(uses.get(at) ?? []));
    }
    return false;
  };
  const out: [string, string][] = [];
  for (const p of libraries) for (const c of uses.get(p.slug) ?? []) if (!(uses.get(p.slug) ?? []).some((mid) => mid !== c && reaches(mid, c, ""))) out.push([p.slug, c]);
  return out;
}

/** The page of a package. */
export const packagePage = (pkg: Package): string => `overview/${pkg.slug}.html`;

/** The overview page of an area. */
export const areaPage = (area: Area): string => `api/${area.slug}/index.html`;

const heading = (id: string, t: string): Block => ({ kind: "heading", level: 2, id, text: [{ kind: "text", text: t }] });
const code = (t: string): Inline[] => [{ kind: "code", text: t }];

function enforcer(e: AboutEnforcer): string {
  switch (e.kind) {
    case "test":
      return e.file;
    case "lint":
      return `lint rule ${e.rule}`;
    case "compiler":
      return `compiler option ${e.option}`;
    case "review":
      return "review";
    default:
      return absurd(e);
  }
}

/** The tables an `about` holds: folders, commands and rules. */
function aboutTables(b: Build, about: About, file: string, page: string): Block[] {
  const scope = { page, file };
  const out: Block[] = [];
  if (about.folders !== undefined && about.folders.length > 0) {
    out.push(heading("folders", "Folders"), {
      kind: "table",
      head: [[{ kind: "text", text: "Folder" }], [{ kind: "text", text: "What it is" }], [{ kind: "text", text: "May import" }]],
      rows: about.folders.map((f) => [code(f.path), b.line(f.what, scope), b.line(f.mayImport.join("; "), scope)]),
    });
  }
  if (about.commands !== undefined && about.commands.length > 0) {
    out.push(heading("commands", "Commands"), {
      kind: "table",
      head: [[{ kind: "text", text: "Command" }], [{ kind: "text", text: "What it does" }]],
      rows: about.commands.map((c) => [code(c.run), b.line(c.does, scope)]),
    });
  }
  if (about.rules !== undefined && about.rules.length > 0) {
    out.push(heading("rules", "Rules"), {
      kind: "table",
      head: [[{ kind: "text", text: "Rule" }], [{ kind: "text", text: "Enforced by" }]],
      rows: about.rules.map((r) => [
        b.line(r.rule, scope),
        r.enforcedBy.flatMap((e, i): Inline[] => [...(i === 0 ? [] : [{ kind: "text", text: ", " } as const]), ...code(enforcer(e))]),
      ]),
    });
  }
  return out;
}

/** The capabilities as cards: each specification in force, under the one it is part of. */
function capabilityCards(b: Build): Card[] {
  const page = "index.html";
  const cardOf = (id: string): Card => {
    const s = b.kit.specs.find((x) => x.id === id);
    const children = b.kit.specs.filter((x) => x.partOf === id).map((x) => cardOf(x.id));
    return {
      title: s?.title ?? id,
      href: { kind: "page", path: specPage(id) },
      text: b.line(firstSentence(s?.input ?? ""), { page, file: s?.file ?? "", spec: id }),
      badges: [{ text: numberOf(id), tone: "neutral" }],
      ...(children.length === 0 ? {} : { children }),
    };
  };
  return b.kit.specs.filter((s) => s.partOf === undefined).map((s) => cardOf(s.id));
}

/** The tiles of the first page (docs 0001-docs FR-038): what the site is about, counted from what it holds and linked to where it is read. */
function statsOf(b: Build, libraries: number): Block {
  const requirements = b.kit.specs.reduce((n, sp) => n + itemsOf(sp.body).filter((i) => i.startsWith("FR-")).length, 0);
  let exports = 0;
  for (const m of b.exports.values()) exports += m.size;
  const items: Stat[] = [
    { value: String(libraries), label: "libraries", href: { kind: "page", path: "index.html", anchor: "libraries" } },
    { value: String(b.kit.specs.length), label: "specifications", href: { kind: "page", path: "specs/index.html" } },
    { value: String(requirements), label: "requirements", href: { kind: "page", path: "specs/index.html" } },
    ...(exports === 0 ? [] : [{ value: String(exports), label: "exports in the API", href: { kind: "page", path: "api/index.html" } } satisfies Stat]),
  ];
  return { kind: "stats", items };
}

/**
 * The home page and a page for each package.
 *
 * @param b - the build
 * @param top - the home's package: the repository as a whole
 * @param packages - the packages
 * @param areas - their areas
 */
export function overviewPages(b: Build, top: Package, packages: readonly Package[], areas: readonly Area[]): void {
  const home = "index.html";
  const homeScope = { page: home, file: top.file };
  const subject = b.config.subject;
  const ownFile = (p: Package): boolean => p.file !== b.config.fileFromRoot;
  if (ownFile(top)) b.files.set(top.file, home);
  if (top.dir !== "") b.files.set(top.dir, home);
  for (const p of packages) {
    if (ownFile(p)) b.files.set(p.file, packagePage(p));
    if (p.dir !== "") b.files.set(p.dir, packagePage(p));
  }
  const capabilities = capabilityCards(b);
  b.add({
    path: home,
    title: top.about.title,
    description: firstSentence(top.about.summary),
    section: "overview",
    group: b.config.subject.charAt(0).toUpperCase() + b.config.subject.slice(1),
    order: 0,
    blocks: [
      ...b.md(top.about.summary, homeScope),
      statsOf(b, packages.length),
      heading("libraries", "Libraries"),
      {
        kind: "cards",
        cards: packages.map((p) => ({
          title: p.about.title,
          href: { kind: "page", path: packagePage(p) },
          text: b.line(firstSentence(p.about.summary), { page: home, file: p.file }),
        })),
      },
      ...(capabilities.length === 0 ? [] : [
        heading("capabilities", "Capabilities"),
        { kind: "paragraph", inlines: [{ kind: "text", text: `Each capability is a specification of ${possessive(subject)} spec kit, under the one it is part of.` }] } satisfies Block,
        { kind: "cards", cards: capabilities } satisfies Block,
      ]),
      ...aboutTables(b, top.about, top.file, home),
    ],
  });
  const libraries = packages.filter((p) => b.exists(under(p.dir, "library.ts")));
  const { uses, usedBy } = dependenciesOf(b, libraries);
  const bySlug = new Map(libraries.map((p) => [p.slug, p] as const));
  const linkList = (slugs: readonly string[]): Block => ({
    kind: "paragraph",
    inlines: slugs.flatMap((sl, i): Inline[] => {
      const q = bySlug.get(sl);
      return [...(i === 0 ? [] : [{ kind: "text", text: ", " } as Inline]), q === undefined ? { kind: "code", text: sl } : { kind: "link", href: { kind: "page", path: packagePage(q) }, children: [{ kind: "text", text: q.about.title }] }];
    }),
  });
  if (libraries.length > 0) {
    b.add({
      path: "overview/map.html",
      title: "Library map",
      description: "What each library imports, and what imports it.",
      section: "overview",
      group: "Libraries",
      order: 9,
      blocks: [
        { kind: "paragraph", inlines: [{ kind: "text", text: "A library imports another by its package name, and only the ones it lists here. Core imports nothing, and every other library imports it." }] },
        { kind: "diagram", source: `flowchart LR\n${reduced(libraries, uses).map(([a, c]) => `  ${a.replaceAll("-", "_")}[${bySlug.get(a)?.about.title ?? a}] --> ${c.replaceAll("-", "_")}[${bySlug.get(c)?.about.title ?? c}]`).join("\n")}`, caption: "Which library imports which: an import that another import already implies is left out" },
        {
          kind: "table",
          head: ["Library", "Imports", "Imported by"].map((h) => [{ kind: "text", text: h } as Inline]),
          rows: libraries.map((p) => [
            [{ kind: "link", href: { kind: "page", path: packagePage(p) }, children: [{ kind: "text", text: p.about.title }] }],
            (uses.get(p.slug) ?? []).flatMap((u, i): Inline[] => [...(i === 0 ? [] : [{ kind: "text", text: ", " } as Inline]), { kind: "code", text: u }]),
            (usedBy.get(p.slug) ?? []).flatMap((u, i): Inline[] => [...(i === 0 ? [] : [{ kind: "text", text: ", " } as Inline]), { kind: "code", text: u }]),
          ]),
        },
      ],
    });
  }
  if (libraries.length > 0) {
    const factOf = (p: Package, label: string): string | undefined => p.about.facts?.find((f) => f.label === label)?.value.replace(/`/g, "");
    const families = familiesOf(libraries.map((p): FamilyEntry => ({ slug: p.slug, title: p.about.title, ...(factOf(p, "Family") === undefined ? {} : { family: factOf(p, "Family") as string }), role: factOf(p, "Role") ?? "member" })));
    b.add({
      path: "overview/families.html",
      title: "Libraries by family",
      description: "The libraries of a host with its extensions, and the libraries that belong together.",
      section: "overview",
      group: "Libraries",
      order: 8,
      blocks: [
        { kind: "paragraph", inlines: [{ kind: "text", text: "An extension of a host is a library of its own in the folder of its host. A group lists libraries that belong together but are not extensions of a host: no folder moves for a group and no name changes." }] },
        ...families.flatMap((fam): Block[] => [
          { kind: "heading", level: 2, id: fam.key, text: [{ kind: "text", text: fam.title }] },
          {
            kind: "table",
            head: ["Library", "Role"].map((h) => [{ kind: "text", text: h } as Inline]),
            rows: fam.members.map((m) => {
              const q = bySlug.get(m.slug);
              return [
                q === undefined ? [{ kind: "code", text: m.slug } as Inline] : [{ kind: "link", href: { kind: "page", path: packagePage(q) }, children: [{ kind: "text", text: m.title }] } as Inline],
                [{ kind: "text", text: m.role ?? "member" } as Inline],
              ];
            }),
          },
        ]),
      ],
    });
  }
  packages.forEach((p, i) => {
    const page = packagePage(p);
    const file = p.file;
    const scope = { page, file, ...(p.about.spec === undefined ? {} : { spec: p.about.spec.id }) };
    const own = areas.filter((a) => a.pkg.slug === p.slug);
    const blocks: Block[] = [...b.md(p.about.summary, scope)];
    if (p.about.spec !== undefined) {
      blocks.push({ kind: "paragraph", inlines: [{ kind: "text", text: "Specification: " }, ...b.line(`${p.about.spec.repo} ${p.about.spec.id}`, scope)] });
    }
    if (p.about.facts !== undefined && p.about.facts.length > 0) {
      blocks.push({ kind: "table", head: [[{ kind: "text", text: "Fact" }], [{ kind: "text", text: "Value" }]], rows: p.about.facts.map((f) => [[{ kind: "text", text: f.label }], b.line(f.value, scope)]) });
    }
    const kit = b.kit.sources.find((k) => k.dir === under(p.dir, "spec-kit"));
    const specs = kit === undefined ? [] : b.kit.specs.filter((sp) => sp.file.startsWith(`${kit.dir}/`));
    if (own.length > 0) {
      blocks.push(heading("areas", "Areas"), {
        kind: "cards",
        cards: own.map((a) => ({
          title: a.title,
          href: { kind: "page", path: areaPage(a) },
          text: [{ kind: "code", text: a.entryPoints.join(", ") }],
          ...(a.spec === undefined ? {} : { badges: [{ text: numberOf(a.spec.id), tone: "neutral" as const }] }),
        })),
      });
    }
    if (p.about.layers !== undefined && p.about.layers.length > 0) {
      const order = ["governance", "logical", "physical"];
      const layers = [...p.about.layers].sort((x, y) => order.indexOf(x.layer) - order.indexOf(y.layer));
      blocks.push(heading("layers", "Layers"), {
        kind: "table",
        head: [[{ kind: "text", text: "Layer" }], [{ kind: "text", text: "Folder" }], [{ kind: "text", text: "May import of this library" }]],
        rows: layers.map((l) => [[{ kind: "strong", children: [{ kind: "text", text: l.layer }] }], [{ kind: "code", text: l.folder }], (l.mayImport ?? []).length === 0 ? [{ kind: "text", text: l.layer === "governance" ? "nothing" : l.layer === "logical" ? "governance" : "governance, logical" }] : (l.mayImport ?? []).flatMap((m, i): Inline[] => [...(i === 0 ? [] : [{ kind: "text", text: ", " } as Inline]), { kind: "code", text: m }])]),
      });
    }
    if ((uses.get(p.slug) ?? []).length > 0) blocks.push(heading("imports", "Imports"), linkList(uses.get(p.slug) ?? []));
    if ((usedBy.get(p.slug) ?? []).length > 0) blocks.push(heading("imported-by", "Imported by"), linkList(usedBy.get(p.slug) ?? []));
    if (specs.length > 0) {
      blocks.push(heading("specifications", "Specifications"), {
        kind: "table",
        head: [[{ kind: "text", text: "Number" }], [{ kind: "text", text: "Specification" }], [{ kind: "text", text: "Requirements" }]],
        rows: specs.map((sp) => [[{ kind: "code", text: numberOf(sp.id) }], [{ kind: "link", href: { kind: "page", path: specPage(sp.id) }, children: [{ kind: "text", text: sp.title }] }], [{ kind: "text", text: String(sp.requirements.length) }]]),
      });
    }
    blocks.push(...aboutTables(b, p.about, file, page));
    if ((p.about.examples ?? []).length > 0) blocks.push(heading("examples", "Examples"));
    for (const x of p.about.examples ?? []) blocks.push(...exampleBlocks(b, under(p.dir, x.file), x.file, x.what, scope));
    b.add({ path: page, title: p.about.title, description: firstSentence(p.about.summary), section: "overview", group: "Libraries", order: 10 + i, blocks });
  });
}
