/**
 * The repository stays small (erga's 009-machine-bootstrap FR-088): the public README carries no setup instructions, which live in erga's, and no new top-level entry
 * appears without a decision. It runs the real `git ls-files` on this checkout; where the folder is not a Git checkout (a source archive) the second test has nothing to
 * list and passes.
 *
 * @module
 */
import { fs, path, proc } from "../commons/ts/runtime/mod.ts";
import { assert, proves } from "../commons/ts/runtime/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const R = ["erga 009-machine-bootstrap FR-088"] as const;

proves(R, "the public README carries no setup instructions", async () => {
  const readme = await fs.readTextFile(path.join(ROOT, "README.md"));
  assert(!readme.includes("## Set up a new computer"));
  for (const old of ["bootstrap-archon", "archon-bootstrap.sh", "archon-setup.sh"]) assert(!readme.includes(old), old);
});

proves(R, "the repository has only the top-level entries it is meant to have", async () => {
  const tracked = await proc.run(["git", "ls-files"], { cwd: ROOT });
  if (tracked.code !== 0) return;
  const top = new Set(
    tracked.stdout
      .split("\n")
      .filter((l) => l !== "")
      .map((l) => l.split("/")[0]),
  );
  const allowed = new Set([
    ".github",
    ".gitignore",
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "bin",
    "bun.lock",
    "commons",
    "package.json",
    "profile",
    "tests",
  ]);
  for (const t of top) assert(allowed.has(t ?? ""), `a new top-level entry: ${t}`);
});
