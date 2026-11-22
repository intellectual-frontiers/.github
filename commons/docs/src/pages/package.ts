// Spec: 0001-docs FR-032
/**
 * The page of the package (docs 0001-docs FR-032): what `@intellectual-frontiers/commons` weighs and what a consumer reaches of it, made from the evidence (`package.report.json` of the packer and `usage.<consumer>.json` of `repoctl usage`). It shows the package against its budget,
 * the bytes and files by kind of file and by library, what it depends on and what it asks of the consumer (the optional peers), and, for each consumer kept, the libraries imported, those reached through them and those never touched. Where no report is kept it says how to make one and shows nothing as measured.
 *
 * @module
 */
import type { Build } from "../build.ts";
import type { ConsumerUsage, PackageReport } from "../package.ts";
import type { Block, Inline } from "../model.ts";

const text = (t: string): Inline => ({ kind: "text", text: t });
const code = (t: string): Inline => ({ kind: "code", text: t });
const th = (...hs: string[]): Inline[][] => hs.map((h) => [text(h)]);
const mb = (bytes: number): string => `${(bytes / 1_048_576).toFixed(2)} MB`;
const share = (value: number, of: number): string => (of <= 0 ? "" : `${((value / of) * 100).toFixed(1)}% of the budget`);

function budgetTable(r: PackageReport): Block {
  const rows: [string, string, string, string][] = [
    ["Files", String(r.total.files), String(r.budget.files), share(r.total.files, r.budget.files)],
    ["Apparent size", mb(r.total.bytes), mb(r.budget.apparentBytes), share(r.total.bytes, r.budget.apparentBytes)],
    ...(r.tarballBytes === undefined ? [] : ([["Tarball", mb(r.tarballBytes), mb(r.budget.tarballBytes), share(r.tarballBytes, r.budget.tarballBytes)]] as [string, string, string, string][])),
  ];
  return { kind: "table", head: th("", "Now", "Budget", "Share"), rows: rows.map(([a, c, d, e]) => [[text(a)], [text(c)], [text(d)], [text(e)]]) };
}

function kindTable(r: PackageReport): Block {
  return { kind: "table", head: th("Kind of file", "Files", "Size"), rows: Object.entries(r.total.byKind).map(([k, v]) => [[text(k)], [text(String(v.files))], [text(mb(v.bytes))]]) };
}

function libraryTable(r: PackageReport): Block {
  const kinds = [...new Set(r.libraries.flatMap((l) => Object.keys(l.byKind)))].sort();
  return {
    kind: "table",
    filter: "Filter the libraries",
    head: th("Library", "Files", "Size", ...kinds),
    rows: [...r.libraries].sort((x, y) => y.bytes - x.bytes || x.name.localeCompare(y.name)).map((l) => [[code(l.name)], [text(String(l.files))], [text(mb(l.bytes))], ...kinds.map((k) => [text(l.byKind[k] === undefined ? "" : mb(l.byKind[k]?.bytes ?? 0))])]),
  };
}

function peerTable(r: PackageReport): Block {
  const deps = Object.entries(r.dependencies).map(([n, v]) => [[code(n)], [text("installed with the package")], [text(v)]]);
  const peers = Object.entries(r.peerDependencies).map(([n, v]) => [[code(n)], [text(r.optionalPeers.includes(n) ? "optional peer: the consumer installs it" : "peer: the consumer has it")], [text(v)]]);
  return { kind: "table", head: th("Package", "How", "Version or range"), rows: [...deps, ...peers] };
}

function usageBlocks(u: ConsumerUsage): Block[] {
  const sum = (rows: readonly { readonly bytes: number }[]): number => rows.reduce((a, r) => a + r.bytes, 0);
  const rows: Inline[][][] = [
    [[text("imported directly")], [text(String(u.direct.length))], [text(mb(sum(u.direct)))], [text(u.direct.map((d) => d.library).join(", "))]],
    [[text("reached through those")], [text(String(u.reached.length))], [text(mb(sum(u.reached)))], [text(u.reached.map((d) => `${d.library} (via ${d.via})`).join(", "))]],
    [[text("never touched")], [text(String(u.untouched.length))], [text(mb(sum(u.untouched)))], [text(u.untouched.map((d) => d.library).join(", "))]],
  ];
  return [
    { kind: "heading", level: 3, id: `usage-${u.consumer}`, text: [text(`${u.consumer}: ${u.libraries} libraries in the package, ${mb(u.bytes)} of sources`)] },
    { kind: "table", head: th("Group", "Libraries", "Size", "Which"), rows },
  ];
}

/** The page `quality/package.html`. */
export function packagePage(b: Build): void {
  const r = b.evidence.packageReport;
  const blocks: Block[] = [];
  if (r === undefined) {
    blocks.push({ kind: "callout", tone: "note", title: "No report of the package", blocks: [{ kind: "paragraph", inlines: [text("The evidence of this run holds no "), code("package.report.json"), text(". The packer writes it: "), code("bun commons/commons/tools/pack.ts --size"), text(" in this repository prints the same figures, and writes the file to "), code("commons/commons/dist/package-report.json"), text(".")] }] });
  } else {
    blocks.push({ kind: "paragraph", inlines: [code(`${r.name}@${r.version}`), text(`: ${r.total.files} files, ${mb(r.total.bytes)} unpacked${r.tarballBytes === undefined ? "" : `, ${mb(r.tarballBytes)} as a tarball`}. A growth beyond the budget is a finding of the packer, so that it is a decision and never an accident.`)] });
    blocks.push(budgetTable(r));
    blocks.push({ kind: "heading", level: 2, id: "kinds", text: [text("By kind of file")] });
    blocks.push({ kind: "paragraph", inlines: [text("A compiled file is the one beside a source of the same name; the declarations are in "), code("dist/"), text(" and nothing else is; the rest is what a library reads at run time, shipped once.")] });
    blocks.push(kindTable(r));
    blocks.push({ kind: "heading", level: 2, id: "dependencies", text: [text("What it installs and what it asks of the consumer")] });
    blocks.push({ kind: "paragraph", inlines: [text("The database drivers, the packages only the documentation generator loads and the TypeScript compiler are optional peers: the consumer installs what it uses, and a library that needs one that is absent says which.")] });
    blocks.push(peerTable(r));
    blocks.push({ kind: "heading", level: 2, id: "libraries", text: [text("By library")] });
    blocks.push(libraryTable(r));
  }
  if (b.evidence.usages.length > 0) {
    blocks.push({ kind: "heading", level: 2, id: "consumers", text: [text("What a consumer reaches")] });
    blocks.push({ kind: "paragraph", inlines: [text("From "), code("repoctl usage"), text(": the libraries a repository imports, those it reaches through them and those it never touches, with their sources' sizes.")] });
    for (const u of [...b.evidence.usages].sort((x, y) => x.consumer.localeCompare(y.consumer))) blocks.push(...usageBlocks(u));
  }
  b.add({ path: "quality/package.html", title: "The package", navTitle: "The package", description: "What the commons package weighs, what it installs and what a consumer reaches of it.", section: "quality", group: "Quality", order: 6, blocks });
}
