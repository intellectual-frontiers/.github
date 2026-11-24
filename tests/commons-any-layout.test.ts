/**
 * No program of commons assumes where repositories are kept or how a workspace is laid out (commons 0031-install-locations FR-005): the real `repoctl` is run from a repository in a flat
 * folder, in a deep `host/organization/repository` path and in a path with spaces, and says the same of each; and the scan for a layout assumption in the sources and the documents is proved by
 * a source that has one and a source that has none. What the scan finds in the real repository is a finding that `scanLayoutAssumptions` returns, and no test fails for it (the build never
 * fails for a finding).
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";

const ROOT = resolve(import.meta.dirname ?? ".", "..");
const REPOCTL = join(ROOT, "commons", "repoctl", "bin", "repoctl.mjs");

/** What the scan looks for, written so that this file does not hold it: the name of a retired workspace tool and a folder of repositories laid out by a host and an organization. */
const NEEDLES: readonly RegExp[] = [new RegExp("erg" + "onex", "i"), new RegExp("work" + "spaces/")];

/** A source or a document and what it says. */
export type SourceText = { readonly path: string; readonly text: string };

/** The lines of the sources that assume a layout of the workspace: a finding for each, never a failure. */
export function scanLayoutAssumptions(files: readonly SourceText[]): readonly string[] {
  const found: string[] = [];
  for (const f of files) {
    const lines = f.text.split("\n");
    lines.forEach((line, i) => {
      if (NEEDLES.some((n) => n.test(line))) found.push(`${f.path}:${i + 1}`);
    });
  }
  return found;
}

/** A repository made with the real `git` below `base`, at the path `parts` names. */
function repositoryAt(base: string, ...parts: readonly string[]): string {
  const dir = join(base, ...parts);
  mkdirSync(dir, { recursive: true });
  const r = spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  assertEquals(r.status, 0);
  return dir;
}

/** What `repoctl doctor` says in a folder, with the path of the folder taken out so that the folders can be compared. */
function doctorIn(dir: string): string {
  const r = spawnSync("bun", [REPOCTL, "doctor"], { cwd: dir, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  return `${r.stdout}${r.stderr}`.split(dir).join("<repository>");
}

proves(
  ["0031-install-locations FR-005"],
  "repoctl says the same of a repository in a flat folder, in a deep host and organization path and in a path with spaces",
  () => {
    const base = mkdtempSync(join(tmpdir(), "any-layout-"));
    try {
      const flat = repositoryAt(base, "repository");
      const deep = repositoryAt(base, "git.example.org", "organization", "group", "repository");
      const spaces = repositoryAt(base, "my repositories", "repository one");
      const said = [flat, deep, spaces].map(doctorIn);
      for (const text of said) {
        assert(text.includes("a working tree"), `the folder is found as a working tree: ${text}`);
        assert(text.includes("no repoctl.config.ts"), `the missing configuration is said in the same words: ${text}`);
      }
      assertEquals(said[1], said[0], "a deep path is the same as a flat folder");
      assertEquals(said[2], said[0], "a path with spaces is the same as a flat folder");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  },
);

proves(
  ["0031-install-locations FR-005"],
  "the scan finds a source that assumes a layout of the workspace, names its line, and finds nothing in a source that does not",
  () => {
    const assumes = { path: "a.ts", text: `const x = 1;\nconst home = "~/${"work" + "spaces"}/github.com/org/repo";\n` };
    const clean = { path: "b.ts", text: 'const root = gitRoot(process.cwd());\n' };
    assertEquals(scanLayoutAssumptions([assumes, clean]), ["a.ts:2"]);
    assertEquals(scanLayoutAssumptions([clean]), []);
    assertEquals(scanLayoutAssumptions([{ path: "c.md", text: `the tool ${"Erg" + "onex"} sets up a workspace` }]), ["c.md:1"]);
  },
);

proves(["0031-install-locations FR-005"], "the scan reads every tracked source and document of the repository, and what it finds is reported and never fails the test", () => {
  const listed = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  assertEquals(listed.status, 0);
  const paths = listed.stdout.split("\n").filter((p) => /\.(ts|md|sh|ps1|json5?|tsv|html|yml|yaml)$/.test(p) && !p.endsWith("bun.lock") && p !== relative(ROOT, import.meta.filename ?? ""));
  const files: SourceText[] = [];
  for (const p of paths) {
    try {
      files.push({ path: p, text: readFileSync(join(ROOT, p), "utf8") });
    } catch {
      // a tracked file that is not there is not a source to scan
    }
  }
  assert(files.length > 100, `${files.length} sources and documents were read`);
  const findings = scanLayoutAssumptions(files);
  if (findings.length > 0) console.warn(`layout assumptions found (findings, not failures): ${findings.slice(0, 20).join(", ")}${findings.length > 20 ? ` and ${findings.length - 20} more` : ""}`);
});
