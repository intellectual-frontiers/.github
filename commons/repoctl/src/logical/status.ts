// Spec: 0004-repoctl-status-release FR-001
/**
 * `repoctl status` (commons repoctl 0004-repoctl-status-release FR-001 to FR-003): for each library of the repository, its version in the repository, the version npm shows and the version of its greatest tag, as rows (a table
 * for a person, JSON for a program). What npm shows is reported as it shows it: a version that was published a short while ago may not be listed yet, and nothing here guesses that it is on its way. `--offline` asks no network:
 * npm is not asked and the tags are those of the local clone.
 *
 * @example
 * ```ts
 * import { tagsOf } from "./status.ts";
 * tagsOf("abc\trefs/tags/core-v0.1.0\nabc\trefs/tags/core-v0.1.0^{}\n").get("core"); // ["0.1.0"]
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import { err, ok } from "@intellectual-frontiers/core";
import { finding, type Finding } from "./findings.ts";
import { pool } from "./pool.ts";
import type { LibraryInfo, NpmView, World } from "./ports.ts";
import { greatest } from "./semver.ts";

/** What npm shows of a library's package. */
export type NpmCell =
  | { readonly kind: "skipped" }
  | { readonly kind: "not-published" }
  | { readonly kind: "absent" }
  | { readonly kind: "unreachable"; readonly why: string }
  | { readonly kind: "found"; readonly latest: string | undefined; readonly hasRepoVersion: boolean };

/** What the tags show of a library. */
export type TagCell =
  | { readonly kind: "unreachable"; readonly why: string }
  | { readonly kind: "none"; readonly source: "remote" | "local" }
  | { readonly kind: "found"; readonly latest: string; readonly hasRepoVersion: boolean; readonly source: "remote" | "local" };

/** Where a library stands, from the three versions. */
export type State = "released" | "unpublished" | "untagged" | "unknown" | "held";

/** One row of the status. */
export type Row = { readonly library: string; readonly repo: string; readonly npm: NpmCell; readonly tag: TagCell; readonly state: State };

/** The status: its rows, in the order of the libraries' names. */
export type StatusReport = { readonly offline: boolean; readonly rows: readonly Row[] };

const TAG = /^(.+)-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

/** The versions each library is tagged at, from the lines of `git ls-remote --tags` (a sha, a tab, the reference) or of `git tag --list` (the name alone). */
export function tagsOf(text: string): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const ref = line.includes("\t") ? (line.split("\t")[1] ?? "") : line;
    const name = ref.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, "");
    const m = TAG.exec(name);
    if (m?.[1] === undefined || m[2] === undefined) continue;
    const have = out.get(m[1]) ?? [];
    if (!have.includes(m[2])) have.push(m[2]);
    out.set(m[1], have);
  }
  return out;
}

/** Where a library stands: it is released when npm holds its repository version (or it is not on npm) and its tag is made; what is not known is unknown. */
export function stateOf(lib: Pick<LibraryInfo, "npm" | "held">, npm: NpmCell, tag: TagCell): State {
  if (lib.held !== undefined) return "held";
  if (npm.kind === "skipped" || npm.kind === "unreachable" || tag.kind === "unreachable") return "unknown";
  if (lib.npm && (npm.kind === "absent" || (npm.kind === "found" && !npm.hasRepoVersion))) return "unpublished";
  if (tag.kind === "none" || !tag.hasRepoVersion) return "untagged";
  return "released";
}

const npmCell = (lib: LibraryInfo, got: Result<NpmView | "absent", string>): NpmCell => {
  if (got.kind === "err") return { kind: "unreachable", why: got.error };
  if (got.value === "absent") return { kind: "absent" };
  return { kind: "found", latest: got.value.latest, hasRepoVersion: got.value.versions.includes(lib.version) };
};

/** Reads the status of every library. The error is why the libraries or the tags could not be read at all. */
export async function runStatus(w: World, options: { readonly offline: boolean }): Promise<Result<StatusReport, string>> {
  const libs = await w.libraries.list();
  if (libs.kind === "err") return err(libs.error);
  const here = { cwd: w.repo };
  const source = options.offline ? "local" : "remote";
  const listed = await w.process.run(options.offline ? ["git", "tag", "--list"] : ["git", "ls-remote", "--tags", "origin"], here);
  const tags = listed.code === 0 ? tagsOf(listed.stdout) : undefined;
  const why = `git could not list the tags (${listed.stderr.trim().split("\n").slice(-1)[0] ?? "no message"})`;
  const rows = await pool([...libs.value].sort((a, b) => (a.name < b.name ? -1 : 1)), 8, async (lib): Promise<Row> => {
    const npm: NpmCell = lib.held !== undefined || !lib.npm ? { kind: "not-published" } : options.offline ? { kind: "skipped" } : npmCell(lib, await w.registry.view(lib.package));
    const versions = lib.held !== undefined ? [] : (tags?.get(lib.name) ?? []);
    const latest = greatest(versions);
    const tag: TagCell = tags === undefined ? { kind: "unreachable", why } : latest === undefined ? { kind: "none", source } : { kind: "found", latest, hasRepoVersion: versions.includes(lib.version), source };
    return { library: lib.name, repo: lib.version, npm, tag, state: stateOf(lib, npm, tag) };
  });
  return ok({ offline: options.offline, rows });
}

/** The findings of a status: a registry or a tag list that could not be read, as warnings. */
export function findingsOfStatus(r: StatusReport): readonly Finding[] {
  const out: Finding[] = [];
  for (const row of r.rows) {
    if (row.npm.kind === "unreachable") out.push(finding("warn", "E-NPM-UNREACHABLE", `${row.library}: npm could not be asked (${row.npm.why})`, "repoctl status --offline"));
  }
  const tagFailure = r.rows.find((row) => row.tag.kind === "unreachable");
  if (tagFailure?.tag.kind === "unreachable") out.push(finding("warn", "E-ENVIRONMENT", tagFailure.tag.why, "repoctl doctor"));
  return out;
}

const npmText = (c: NpmCell): string => {
  switch (c.kind) {
    case "skipped":
      return "-";
    case "not-published":
      return "not on npm";
    case "absent":
      return "none";
    case "unreachable":
      return "unreachable";
    case "found":
      return `${c.latest ?? "?"}${c.hasRepoVersion ? "" : " (this version not listed)"}`;
    default:
      return "?";
  }
};

const tagText = (c: TagCell): string => {
  switch (c.kind) {
    case "unreachable":
      return "unreachable";
    case "none":
      return "none";
    case "found":
      return `${c.latest}${c.hasRepoVersion ? "" : " (this version not tagged)"}`;
    default:
      return "?";
  }
};

/** The table of a status for a person: one line for each library, columns aligned. */
export function tableOf(r: StatusReport): string {
  const head = ["library", "repo", "npm", "tag", "state"];
  const body = r.rows.map((row) => [row.library, row.repo, npmText(row.npm), tagText(row.tag), row.state]);
  const width = head.map((h, i) => Math.max(h.length, ...body.map((b) => (b[i] ?? "").length)));
  const line = (cells: readonly string[]): string => cells.map((c, i) => c.padEnd(width[i] ?? 0)).join("  ").trimEnd();
  return [line(head), ...body.map(line)].join("\n");
}
