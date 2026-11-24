// Spec: 0003-git-ref FR-001, FR-008
/**
 * Reading what a repository holds, through Git's own commands: the entries of a tree (with their sizes), the bytes of many objects in one call, and the digest a revision is made of. An object of Git is named by
 * what it holds, so a digest kept for an object name is always right and never needs to be forgotten.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { parseRevision, type Revision } from "@intellectual-frontiers/anyfs/governance";
import { failure, type Git, textOf } from "./git.ts";

/** One entry of a tree of Git. */
export type Entry = {
  readonly mode: string;
  readonly type: string;
  readonly oid: string;
  /** The size of a blob; nothing for a tree or a link to another repository. */
  readonly size: number | undefined;
  /** The path from the top of the tree, as the bytes of Git read as text. */
  readonly name: string;
};

/** A file of the kind a store holds: not a link, not a folder, not another repository. */
export const isRegular = (e: Entry): boolean => e.type === "blob" && (e.mode === "100644" || e.mode === "100755" || e.mode === "100664");

const RECORD = /^(\d{6}) (\w+) ([0-9a-f]+) +(-|\d+)\t([\s\S]*)$/u;

/** The entries in the text `git ls-tree -z -l` writes. */
export function parseLsTree(text: string): readonly Entry[] {
  const out: Entry[] = [];
  for (const record of text.split("\0")) {
    if (record === "") continue;
    const m = RECORD.exec(record);
    if (m === null) continue;
    out.push({ mode: m[1] ?? "", type: m[2] ?? "", oid: m[3] ?? "", size: m[4] === "-" ? undefined : Number(m[4]), name: m[5] ?? "" });
  }
  return out;
}

/** A path as Git reads it literally: with no pattern, no magic, whatever characters it holds. */
export const literal = (path: string): string => `:(literal)${path}`;

/** The entries of a tree at a commit: the whole tree below the paths where `recursive`, else the entries the paths name. No path is the whole tree. */
export async function lsTree(git: Git, commit: string, paths: readonly string[], recursive: boolean): Promise<Result<readonly Entry[], string>> {
  const out = await git.run(["ls-tree", "-z", "-l", "--full-tree", ...(recursive ? ["-r"] : []), commit, ...(paths.length === 0 ? [] : ["--", ...paths.map(literal)])]);
  return out.success ? ok(parseLsTree(textOf(out.stdout))) : err(failure(out));
}

/** The bytes of objects, in one call of Git: each by its name. An object that is not there is left out. */
export async function readBlobs(git: Git, oids: readonly string[]): Promise<Result<ReadonlyMap<string, Uint8Array>, string>> {
  const found = new Map<string, Uint8Array>();
  if (oids.length === 0) return ok(found);
  const unique = [...new Set(oids)];
  const out = await git.run(["cat-file", "--batch"], { input: `${unique.join("\n")}\n` });
  if (!out.success) return err(failure(out));
  const bytes = out.stdout;
  let at = 0;
  for (const oid of unique) {
    const eol = bytes.indexOf(10, at);
    if (eol < 0) break;
    const header = textOf(bytes.subarray(at, eol));
    at = eol + 1;
    const parts = header.split(" ");
    if (parts[1] === "missing") continue;
    const size = Number(parts[2]);
    if (!Number.isSafeInteger(size) || at + size > bytes.length) return err(`git cat-file answered with a header ${JSON.stringify(header)} that its bytes do not match`);
    found.set(oid, bytes.slice(at, at + size));
    at += size + 1;
  }
  return ok(found);
}

/** The revision of some bytes: `sha256:` and their digest. */
export async function revisionOf(bytes: Uint8Array): Promise<Revision> {
  const r = parseRevision(`sha256:${await sha256(bytes)}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The revisions of the blobs of a repository, kept by the name of the blob: what a name stands for never changes. */
export class Digests {
  readonly #by = new Map<string, Revision>();

  /** The revision kept for an object, if there is one. */
  get(oid: string): Revision | undefined {
    return this.#by.get(oid);
  }

  /** Keeps the revision of an object. */
  set(oid: string, rev: Revision): void {
    this.#by.set(oid, rev);
  }

  /** The revisions of objects: those kept, and those read in one call of Git and kept. */
  async of(git: Git, oids: readonly string[]): Promise<Result<ReadonlyMap<string, Revision>, string>> {
    const need = oids.filter((o) => !this.#by.has(o));
    const read = await readBlobs(git, need);
    if (read.kind === "err") return read;
    for (const [oid, bytes] of read.value) this.#by.set(oid, await revisionOf(bytes));
    const done = new Map<string, Revision>();
    for (const oid of oids) {
      const rev = this.#by.get(oid);
      if (rev === undefined) return err(`the object ${oid} is not in the repository`);
      done.set(oid, rev);
    }
    return ok(done);
  }
}
