// Spec: 0001-docs FR-034
/**
 * The blocks of the page `repo-ops/packaging.html` that the evidence makes (docs 0001-docs FR-034): the release now with the versions the registry holds, the package against its budget, the bytes by kind of file, the largest libraries and what the package installs and asks of a consumer. It works out nothing but shares; where no report is kept it says how to make one and shows nothing as measured.
 *
 * @limits
 * It shows no trend over releases: no record of the sizes of earlier releases is kept.
 *
 * @module
 */
import type { Build } from "../build.ts";
import type { Block, Inline } from "../model.ts";
import { compareVersions } from "../published.ts";
import { budgetTable, kindTable, libraryTable, mb, peerTable } from "./package.ts";

const t = (text: string): Inline => ({ kind: "text", text });
const c = (text: string): Inline => ({ kind: "code", text });
const heading = (text: string, id: string): Block => ({ kind: "heading", level: 2, id, text: [t(text)] });
const para = (...inlines: Inline[]): Block => ({ kind: "paragraph", inlines });

/** What the evidence says of the package, after the words of the page of the packaging (docs 0001-docs FR-034): the release now, the versions the registry holds, the budget, the kinds, the largest libraries and the peers. Nothing is worked out but shares, and what no evidence holds is said to be missing. */
export function packagingBlocks(b: Build): Block[] {
  const out: Block[] = [heading("The release now", "the-release-now")];
  const reg = b.evidence.registry;
  if (reg === undefined || reg.kind === "unreadable") {
    out.push(para(t(reg === undefined ? "No registry evidence is kept in this build, so the site shows the version of the package's own package.json and says it is not confirmed. The workflow that builds the site reads the registry and keeps it." : `The registry could not be read (${reg.why}), so the site shows the version of the package's own package.json and says it is not confirmed.`)));
  } else {
    const versions = [...reg.versions].sort((x, y) => compareVersions(y.version, x.version));
    out.push(para(t(`The registry holds ${versions.length} version${versions.length === 1 ? "" : "s"} of the package; the newest stable one is the version in the heading of every page. A superseded version is deleted from the registry by the workflow maintenance once a newer one is out, and its git tag is kept.`)));
    out.push({ kind: "table", head: [[t("Version")], [t("Published")]], rows: versions.map((v) => [[c(v.version)], [t(v.date ?? "")]]) });
  }
  const r = b.evidence.packageReport;
  out.push(heading("Size, against the budget", "size-against-the-budget"));
  if (r === undefined) {
    out.push(para(t("No report of the package is kept in this build, so nothing is shown as measured. The packer writes one: "), c("bun commons/commons/tools/pack.ts --size"), t(" in this repository prints the figures and writes commons/commons/dist/package-report.json.")));
    return out;
  }
  out.push(para(c(`${r.name}@${r.version}`), t(`: ${r.total.files} files, ${mb(r.total.bytes)} unpacked${r.tarballBytes === undefined ? "" : `, ${mb(r.tarballBytes)} as a tarball`}. A growth beyond the budget is a finding of the packer, so that it is a decision and never an accident. This is the package at the commit the site was built from; no record of earlier releases' sizes is kept, so no trend is shown.`)));
  out.push(budgetTable(r));
  out.push(heading("What is in it", "what-is-in-it"));
  out.push(para(t("The bytes by kind of file: a compiled file is the one beside a source of the same name, the declarations are in dist/ and nothing else is, and the rest is what a library reads at run time, shipped once.")));
  out.push(kindTable(r));
  out.push(heading("The largest libraries", "the-largest-libraries"));
  const biggest = { ...r, libraries: [...r.libraries].sort((x, y) => y.bytes - x.bytes || x.name.localeCompare(y.name)).slice(0, 12) };
  out.push(libraryTable(biggest));
  out.push(para(t("The whole table, every library and the consumers' view of it, is on "), { kind: "link", href: { kind: "page", path: "quality/package.html" }, children: [t("the package page of Quality")] }, t(".")));
  out.push(heading("What it installs and what it asks of you", "what-it-installs"));
  out.push(peerTable(r));
  return out;
}
