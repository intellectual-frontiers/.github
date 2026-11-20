/**
 * The Overview section (commons 0011-documentation FR-009, FR-027): the home page, made from the configuration's home (in commons,
 * `commons/about.ts`) and the spec kit (a card for each capability, under the capability it is part of), and a page for each package,
 * made from its `about`: its summary, its areas, its folders and what each may import, its commands, and its rules with what enforces
 * each.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Build } from "../build.ts";
import { type About, type AboutEnforcer, under } from "../config.ts";
import { specPage } from "../links.ts";
import { type Block, type Card, type Inline, possessive } from "../model.ts";
import type { Area, Package } from "../sources.ts";
import { exampleBlocks } from "./areas.ts";
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
