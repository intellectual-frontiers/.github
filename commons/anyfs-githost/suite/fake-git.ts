/**
 * A repository of Git in memory, the ground the two fakes of the hosts' APIs stand on: blobs named as Git names them (SHA-1 of `blob <size>`, a NUL and the bytes, so a store that checks a blob's name checks something), trees, commits and
 * branches, and the operations a host's API is made of. It enforces nothing a host does not enforce: a branch moves only to a commit that descends from it (so a push to a branch that moved is refused as a host refuses it).
 *
 * @module
 */
import { createHash } from "node:crypto";

export type Node = { readonly name: string; readonly mode: string; readonly type: "blob" | "tree" | "commit"; readonly sha: string };
export type Person = { readonly name: string; readonly email: string; readonly date: string };
export type CommitObject = { readonly tree: string; readonly parents: readonly string[]; readonly message: string; readonly author: Person; readonly committer: Person };
export type Flat = ReadonlyMap<string, { readonly mode: string; readonly blob: string }>;

const sha1 = (data: Uint8Array | string): string => createHash("sha1").update(data).digest("hex");

/** The name Git gives a blob of these bytes. */
export function blobName(bytes: Uint8Array): string {
  return sha1(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]));
}

export class FakeRepo {
  readonly blobs = new Map<string, Uint8Array>();
  readonly trees = new Map<string, readonly Node[]>();
  readonly commits = new Map<string, CommitObject>();
  readonly branches = new Map<string, string>();
  readonly protectedBranches = new Set<string>();
  /** Every commit made, in order, by whichever door: a batch is one. */
  readonly made: string[] = [];
  #clock = 1_700_000_000_000;

  addBlob(bytes: Uint8Array): string {
    const id = blobName(bytes);
    this.blobs.set(id, bytes);
    return id;
  }

  addTree(nodes: readonly Node[]): string {
    const sorted = [...nodes].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const id = sha1(`tree\n${sorted.map((n) => `${n.mode} ${n.type} ${n.sha}\t${n.name}`).join("\n")}`);
    this.trees.set(id, sorted);
    return id;
  }

  /** The files below a tree, by path. */
  flatten(tree: string | undefined, prefix = ""): Map<string, { mode: string; blob: string }> {
    const out = new Map<string, { mode: string; blob: string }>();
    if (tree === undefined) return out;
    for (const n of this.trees.get(tree) ?? []) {
      const path = prefix === "" ? n.name : `${prefix}/${n.name}`;
      if (n.type === "tree") for (const [p, v] of this.flatten(n.sha, path)) out.set(p, v);
      else out.set(path, { mode: n.mode, blob: n.sha });
    }
    return out;
  }

  /** The tree of files by path. */
  treeOf(flat: Flat): string {
    type Dir = { files: Map<string, { mode: string; blob: string }>; dirs: Map<string, Dir> };
    const root: Dir = { files: new Map(), dirs: new Map() };
    for (const [path, v] of flat) {
      const parts = path.split("/");
      let at = root;
      for (const seg of parts.slice(0, -1)) {
        let next = at.dirs.get(seg);
        if (next === undefined) {
          next = { files: new Map(), dirs: new Map() };
          at.dirs.set(seg, next);
        }
        at = next;
      }
      at.files.set(parts[parts.length - 1] ?? "", v);
    }
    const build = (d: Dir): string =>
      this.addTree([
        ...[...d.files].map(([name, v]): Node => ({ name, mode: v.mode, type: "blob", sha: v.blob })),
        ...[...d.dirs].map(([name, sub]): Node => ({ name, mode: "040000", type: "tree", sha: build(sub) })),
      ]);
    return build(root);
  }

  addCommit(c: CommitObject): string {
    const id = sha1(`commit\n${JSON.stringify(c)}\n${this.commits.size}`);
    this.commits.set(id, c);
    this.made.push(id);
    return id;
  }

  now(): string {
    this.#clock += 1000;
    return new Date(this.#clock).toISOString();
  }

  /** A commit on a branch (made if there is none) with the files given, by an author. */
  seed(files: Readonly<Record<string, string | Uint8Array>>, branch = "main", message = "seed"): string {
    const flat = new Map<string, { mode: string; blob: string }>();
    const tip = this.branches.get(branch);
    if (tip !== undefined) for (const [p, v] of this.flatten(this.commits.get(tip)?.tree)) flat.set(p, v);
    for (const [path, content] of Object.entries(files)) {
      const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
      flat.set(path, { mode: "100644", blob: this.addBlob(bytes) });
    }
    const who: Person = { name: "Seeder", email: "seed@example.test", date: this.now() };
    const id = this.addCommit({ tree: this.treeOf(flat), parents: tip === undefined ? [] : [tip], message, author: who, committer: who });
    this.branches.set(branch, id);
    return id;
  }

  /** Whether `ancestor` is the commit or one of its ancestors. */
  descends(commit: string, ancestor: string): boolean {
    for (let at: string | undefined = commit; at !== undefined; ) {
      if (at === ancestor) return true;
      at = this.commits.get(at)?.parents[0];
    }
    return false;
  }

  /** The commits of a branch, newest first, that changed a path. */
  history(tip: string, path: string): readonly string[] {
    const out: string[] = [];
    for (let at: string | undefined = tip; at !== undefined; ) {
      const c = this.commits.get(at);
      if (c === undefined) break;
      const mine = this.flatten(c.tree).get(path)?.blob;
      const before = c.parents[0] === undefined ? undefined : this.flatten(this.commits.get(c.parents[0])?.tree).get(path)?.blob;
      if (mine !== before) out.push(at);
      at = c.parents[0];
    }
    return out;
  }

  /** How many commits a branch has. */
  length(branch: string): number {
    let n = 0;
    for (let at = this.branches.get(branch); at !== undefined; at = this.commits.get(at)?.parents[0]) n++;
    return n;
  }
}
