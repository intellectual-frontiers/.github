/**
 * The fixture tree (commons lang-sql 0011-acceptance FR-007): a directory that a function makes the same way every time, with names a program gets wrong (spaces, a newline, quotes, glob characters, a dash, a percent sign, an underscore, a name
 * with no extension and a name that is only an extension), files of many sizes, times and modes, a hidden directory, an empty directory, a symbolic link and a link that loops, and the entries it is meant to have, which do not come from reading it.
 *
 * Spec: 0011-acceptance FR-007
 *
 * @module
 */
import { chmodSync, lutimesSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { type Entry, entryOf } from "./language.ts";
import { ownerName, statEntry } from "./walk.ts";

/** The time the fixture's days are counted from, in seconds. */
export const BASE = 1_700_000_000;
/** One day, in seconds. */
export const DAY = 86400;

interface FileSpec {
  readonly path: string;
  readonly size: number;
  readonly day: number;
  readonly mode?: number;
}

const FILES: readonly FileSpec[] = [
  { path: "README.md", size: 100, day: 10 },
  { path: "src/index.ts", size: 120, day: 1 },
  { path: "src/util.ts", size: 3000, day: 5, mode: 0o755 },
  { path: "src/Big.TS", size: 20000, day: 2 },
  { path: "src/deep/nested/mod.ts", size: 10, day: 9 },
  { path: "lib/data.json", size: 50000, day: 3, mode: 0o600 },
  { path: "lib/a b.ts", size: 7, day: 4 },
  { path: "lib/new\nline.ts", size: 8, day: 6 },
  { path: "lib/quo'te.ts", size: 9, day: 7 },
  { path: 'lib/dq"uote.ts', size: 11, day: 8 },
  { path: "lib/glob[1].ts", size: 12, day: 2 },
  { path: "lib/star*.ts", size: 13, day: 3 },
  { path: "lib/-dash.ts", size: 14, day: 4 },
  { path: "lib/percent%.ts", size: 15, day: 5 },
  { path: "lib/under_score.ts", size: 16, day: 5 },
  { path: "lib/noext", size: 17, day: 6 },
  { path: "lib/.dotfile", size: 18, day: 6 },
  { path: "lib/archive.tar.gz", size: 19, day: 7 },
  { path: ".hidden/secret.ts", size: 1, day: 0 },
  { path: "docs/readme.md", size: 200, day: 9 },
  { path: "docs/guide.md", size: 4000, day: 1 },
];

const DIRS: readonly string[] = ["src", "src/deep", "src/deep/nested", "lib", "docs", ".hidden", "empty"];
const LINKS: readonly { readonly path: string; readonly target: string; readonly day: number }[] = [
  { path: "lib/link.ts", target: "a b.ts", day: 4 },
  { path: "lib/loop", target: "..", day: 4 },
];

/** A fixture on disk. */
export interface Fixture {
  readonly root: string;
  /** The entries the tree is meant to have, parents before children, sorted by name at each level. */
  readonly entries: readonly Entry[];
  readonly cleanup: () => void;
}

const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Makes the fixture in a new temporary directory. */
export function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "sqlfs-fixture-"));
  const owner = ownerName(process.getuid?.() ?? 0);
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  for (const f of FILES) {
    writeFileSync(join(root, f.path), "x".repeat(f.size));
    chmodSync(join(root, f.path), f.mode ?? 0o644);
  }
  for (const l of LINKS) symlinkSync(l.target, join(root, l.path));
  for (const f of FILES) utimesSync(join(root, f.path), BASE + f.day * DAY, BASE + f.day * DAY);
  for (const l of LINKS) lutimesSync(join(root, l.path), BASE + l.day * DAY, BASE + l.day * DAY);
  for (const d of [...DIRS].sort((a, b) => b.length - a.length)) utimesSync(join(root, d), BASE + 100, BASE + 100);
  const all: { path: string; make: () => Entry }[] = [
    ...DIRS.map((p) => ({ path: p, make: (): Entry => statEntry(root, p) ?? entryOf(p, "d", 4096, BASE + 100, 0o755, owner) })),
    ...FILES.map((f) => ({ path: f.path, make: (): Entry => entryOf(f.path, "f", f.size, BASE + f.day * DAY, f.mode ?? 0o644, owner) })),
    ...LINKS.map((l) => ({ path: l.path, make: (): Entry => statEntry(root, l.path) ?? entryOf(l.path, "l", l.target.length, BASE + l.day * DAY, 0o777, owner) })),
  ];
  // preorder with the names of each level sorted, as the walk of the disk gives them
  const tree = new Map<string, string[]>();
  for (const a of all) {
    const parent = a.path.includes("/") ? a.path.slice(0, a.path.lastIndexOf("/")) : "";
    tree.set(parent, [...(tree.get(parent) ?? []), a.path]);
  }
  const byPath = new Map(all.map((a) => [a.path, a]));
  const entries: Entry[] = [];
  const visit = (parent: string): void => {
    for (const p of [...(tree.get(parent) ?? [])].sort((x, y) => byCode(x.slice(x.lastIndexOf("/") + 1), y.slice(y.lastIndexOf("/") + 1)))) {
      const a = byPath.get(p);
      if (a === undefined) continue;
      const e = a.make();
      entries.push(e);
      if (e.kind === "d") visit(p);
    }
  };
  visit("");
  return { root, entries, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
