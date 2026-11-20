/**
 * The license of the repository and of every library in it, written and checked from one place (commons 0035-licensing). One official text, the PolyForm Noncommercial License 1.0.0
 * (`license/PolyForm-Noncommercial-1.0.0.md`, held to the SHA-256 of its standard), and one `Required Notice:` line for the licensor make the `LICENSE` of the root and of each library folder; the third-party
 * notices are made from the record of what is vendored.
 *
 *     bun commons/libraries/src/license.ts            write every LICENSE and THIRD_PARTY_NOTICES.md again
 *     bun commons/libraries/src/license.ts --check    write nothing and exit 1 where any file is not what the manifests and the official text make
 *     other flags: --repo DIR (the repository, the working folder by default)
 *
 * @remarks
 * What is written: `LICENSE` at the root and in each `commons/<name>/` that holds a manifest (`library.ts`), and `THIRD_PARTY_NOTICES.md`. What is only checked, because a person writes it: `LICENSING.md`, `COMMERCIAL.md`,
 * `NOTICE`, `CONTRIBUTING.md`, `CITATION.cff`, the License section of `README.md` and the `license` of the root `package.json`. A library with a folder and no `LICENSE` is a finding that names the command above, so a new
 * library runs it once. The packer writes the same identifier into the `package.json` it publishes ({@link licenseOf}).
 *
 * @limits
 * It does not fetch anything: the official text is the copy in `license/`, checked against the SHA-256 its standard records. It does not judge what the hand-written files say beyond the few facts named in {@link Finding}.
 *
 * @example
 * ```ts
 * import { licenseFileText } from "./license.ts";
 * licenseFileText("TEXT\n").startsWith("Required Notice: Copyright Intellectual Frontiers LLC"); // true
 * ```
 *
 * Spec: 0001-libraries FR-019
 *
 * @module
 */
import process from "node:process";
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { stdio } from "@intellectual-frontiers/system";
import { existsSync, readTextFileSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { type Library, readLibraries } from "./libraries.ts";
import { COMMERCIAL_ISSUES_URL, DEFAULT_LICENSE, LICENSE_STANDARDS, LICENSOR, REPOSITORY_URL, type SpdxId } from "./license/standard.ts";
import { THIRD_PARTY, type ThirdPartyItem } from "./license/third-party.ts";

/** The command that writes what the check finds wrong. */
export const COMMAND = "bun commons/libraries/src/license.ts";

/** The license of a library: its manifest's `license`, else the default of the repository. */
export function licenseOf(library: Pick<Library, "license"> | undefined): SpdxId {
  return library?.license ?? DEFAULT_LICENSE;
}

/** The line every `LICENSE` begins with, as the license asks of its licensor (its section Notices). */
export const REQUIRED_NOTICE = `Required Notice: Copyright ${LICENSOR} (${REPOSITORY_URL})`;

/** The text of a `LICENSE`: the required notice, a blank line and the official text exactly as it is. */
export function licenseFileText(official: string): string {
  return `${REQUIRED_NOTICE}\n\n${official}`;
}

/** What is wrong, one case for each sentence. */
export type Finding =
  | { readonly kind: "text-missing"; readonly id: SpdxId; readonly file: string }
  | { readonly kind: "text-changed"; readonly id: SpdxId; readonly want: string; readonly have: string }
  | { readonly kind: "manifest"; readonly dir: string; readonly problem: string }
  | { readonly kind: "missing"; readonly path: string; readonly why: string }
  | { readonly kind: "stale"; readonly path: string }
  | { readonly kind: "lacks"; readonly path: string; readonly what: string }
  | { readonly kind: "vendored-gone"; readonly path: string };

/** The one sentence of a finding. */
export function sentence(f: Finding): string {
  switch (f.kind) {
    case "text-missing":
      return `the official text of ${f.id} is not at commons/libraries/src/license/${f.file}`;
    case "text-changed":
      return `commons/libraries/src/license/ is not the official text of the standard: its SHA-256 is ${f.have} and the standard records ${f.want}`;
    case "manifest":
      return `commons/${f.dir}/library.ts cannot be read: ${f.problem}`;
    case "missing":
      return `${f.path} is missing: ${f.why}`;
    case "stale":
      return `${f.path} is not what the official text and the manifest make; run: ${COMMAND}`;
    case "lacks":
      return `${f.path} does not ${f.what}`;
    case "vendored-gone":
      return `${f.path} is named as vendored in commons/libraries/src/license/third-party.ts and is not in the repository`;
    default:
      return absurd(f);
  }
}

/** A file this module writes: its path from the repository and its whole text. */
export type Made = { readonly path: string; readonly text: string };

const lf = (t: string): string => t.replaceAll("\r\n", "\n");
const here = resolve(fromFileUrl(new URL(".", import.meta.url)));

/** The official text of a license, held to the SHA-256 of its standard. */
export async function officialText(id: SpdxId, folder: string = join(here, "license")): Promise<Result<string, Finding>> {
  const std = LICENSE_STANDARDS[id];
  const file = join(folder, std.file);
  if (!existsSync(file)) return err({ kind: "text-missing", id, file: std.file });
  const text = lf(readTextFileSync(file));
  const have = await sha256(text);
  return have === std.sha256 ? ok(text) : err({ kind: "text-changed", id, want: std.sha256, have });
}

/** `THIRD_PARTY_NOTICES.md` made from the items. */
export function thirdPartyNotices(items: readonly ThirdPartyItem[]): string {
  const body = items.map((i) =>
    [
      `## ${i.path === undefined ? i.what.split(",")[0] ?? i.what : `\`${i.path}\``}`,
      "",
      `- **What**: ${i.what}.`,
      `- **Source**: ${i.source}.`,
      `- **Owner**: ${i.owner}.`,
      `- **License**: ${i.license}.`,
      `- **Checked**: ${i.checked}`,
      "",
    ].join("\n"),
  );
  return [
    "# Third-party notices",
    "",
    "<!-- Generated by `bun commons/libraries/src/license.ts` from `commons/libraries/src/license/third-party.ts`: change that file and run the command, never this one. -->",
    "",
    "Intellectual Frontiers LLC owns the code of this repository, which is under the PolyForm Noncommercial License 1.0.0 (see [`LICENSE`](LICENSE)). The items below are not its own: each is under the license named, which is not changed by this repository's.",
    "Where an item says `unverified:` the license was recorded from a secondary source and has not been checked against the original; that is for the owner to settle, and nothing here is a statement that it is settled.",
    "",
    "Packages installed from a registry (listed in `bun.lock`) are not vendored: nothing of them is in this repository, and each package carries its own license.",
    "",
    ...body,
  ].join("\n");
}

/** The result of looking at a repository: what it should hold and what is wrong. */
export type Judged = { readonly made: readonly Made[]; readonly findings: readonly Finding[] };

const read = (repo: string, path: string): string | undefined => (existsSync(join(repo, path)) ? lf(readTextFileSync(join(repo, path))) : undefined);

const HAND_WRITTEN: readonly { readonly path: string; readonly why: string }[] = [
  { path: "LICENSING.md", why: "it says in plain words what is free and what needs a commercial license" },
  { path: "COMMERCIAL.md", why: "it says what a commercial license covers and how it is obtained" },
  { path: "NOTICE", why: "it carries the copyright of the licensor" },
  { path: "CONTRIBUTING.md", why: "it carries the sign-off and the contributor's agreement" },
  { path: "CITATION.cff", why: "it says how to cite the software and under what license" },
];

/** Whether `text` contains `needle`, as a finding where it does not. */
const must = (path: string, text: string | undefined, needle: string, what: string): readonly Finding[] =>
  text === undefined || text.includes(needle) ? [] : [{ kind: "lacks", path, what }];

/** The files this module makes for a repository and what is wrong with the rest, read from the files and the manifests; nothing is written. */
export async function judge(repo: string, folder?: string): Promise<Judged> {
  const root = repo.replace(/[\\/]$/, "");
  const findings: Finding[] = [];
  const made: Made[] = [];
  const texts = new Map<SpdxId, string>();
  const reported = new Set<SpdxId>();
  const textOf = async (id: SpdxId): Promise<string | undefined> => {
    const have = texts.get(id);
    if (have !== undefined) return have;
    const r = await officialText(id, folder);
    if (r.kind === "err") {
      if (!reported.has(id)) findings.push(r.error);
      reported.add(id);
      return undefined;
    }
    texts.set(id, r.value);
    return r.value;
  };
  const rootText = await textOf(DEFAULT_LICENSE);
  if (rootText !== undefined) made.push({ path: "LICENSE", text: licenseFileText(rootText) });
  for (const f of readLibraries(root)) {
    if ("problem" in f) {
      findings.push({ kind: "manifest", dir: f.dir, problem: f.problem });
      continue;
    }
    const t = await textOf(licenseOf(f.library));
    if (t !== undefined) made.push({ path: `commons/${f.dir}/LICENSE`, text: licenseFileText(t) });
  }
  made.push({ path: "THIRD_PARTY_NOTICES.md", text: thirdPartyNotices(THIRD_PARTY) });
  for (const m of made) {
    const have = read(root, m.path);
    if (have === undefined) findings.push({ kind: "missing", path: m.path, why: m.path === "THIRD_PARTY_NOTICES.md" ? "it lists what is vendored and its licenses" : `it is the license of ${m.path === "LICENSE" ? "the repository" : "the library"}; run: ${COMMAND}` });
    else if (have !== m.text) findings.push({ kind: "stale", path: m.path });
  }
  for (const h of HAND_WRITTEN) {
    const t = read(root, h.path);
    if (t === undefined || t.trim() === "") findings.push({ kind: "missing", path: h.path, why: h.why });
  }
  findings.push(...must("NOTICE", read(root, "NOTICE"), `Copyright ${LICENSOR}`, `name the copyright of ${LICENSOR}`));
  findings.push(...must("CONTRIBUTING.md", read(root, "CONTRIBUTING.md"), "git commit -s", "ask for a sign-off with `git commit -s`"));
  findings.push(...must("LICENSING.md", read(root, "LICENSING.md"), DEFAULT_LICENSE, `name ${DEFAULT_LICENSE}`));
  findings.push(...must("LICENSING.md", read(root, "LICENSING.md"), COMMERCIAL_ISSUES_URL, `say where to ask for a commercial license (${COMMERCIAL_ISSUES_URL})`));
  findings.push(...must("CITATION.cff", read(root, "CITATION.cff"), `license: ${DEFAULT_LICENSE}`, `carry \`license: ${DEFAULT_LICENSE}\``));
  const readme = read(root, "README.md");
  if (readme !== undefined) {
    const at = readme.indexOf("\n## License\n");
    const rest = at < 0 ? "" : readme.slice(at + 1);
    const next = rest.indexOf("\n## ", 1);
    const section = next < 0 ? rest : rest.slice(0, next);
    if (at < 0 || !section.includes(DEFAULT_LICENSE)) findings.push({ kind: "lacks", path: "README.md", what: `have a License section that names ${DEFAULT_LICENSE}` });
  }
  const pkg = read(root, "package.json");
  if (pkg !== undefined && !pkg.includes(`"license": "${DEFAULT_LICENSE}"`)) findings.push({ kind: "lacks", path: "package.json", what: `declare "license": "${DEFAULT_LICENSE}"` });
  for (const i of THIRD_PARTY) if (i.path !== undefined && !existsSync(join(root, i.path))) findings.push({ kind: "vendored-gone", path: i.path });
  return { made, findings };
}

/** The command line: 0, or 1 where a finding exists (with `--check`) or a file could not be made. Without `--check` the files are written. */
export async function main(argv: readonly string[]): Promise<number> {
  const at = argv.indexOf("--repo");
  const repo = at >= 0 ? (argv[at + 1] ?? ".") : ".";
  const check = argv.includes("--check");
  let j = await judge(repo);
  if (!check) {
    for (const m of j.made) {
      const have = read(repo, m.path);
      if (have !== m.text) writeTextFileSync(join(repo.replace(/[\\/]$/, ""), m.path), m.text);
    }
    j = await judge(repo);
  }
  for (const f of j.findings) stdio.stderr.writeSync(`${sentence(f)}\n`);
  return j.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
