/**
 * What the tests share: a Git branch in a bare repository and a SQLite file, each in a temporary folder and each real, the other backends a mirror may be given (memory and a folder), a store that fails where it is
 * told to, and the paths and bytes as values.
 *
 * @module
 */
import { CORE_CAPABILITIES, type CoreCapability, type Cursor, expectAny, type Path, parsePath, ROOT, unavailable } from "@intellectual-frontiers/anyfs/governance";
import { makeStore, type Store, view } from "@intellectual-frontiers/anyfs/logical";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { gitRefStore, type GitRef, parseIdentity } from "@intellectual-frontiers/anyfs-git";
import { openSqlStore } from "@intellectual-frontiers/anyfs-sql";
import { openSqliteFile } from "@intellectual-frontiers/anyfs-sql/sqlite";
import { fs, path as osPath, proc } from "@intellectual-frontiers/system";

export { expectAny, osPath };

export const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
export const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
export const text = (b: Uint8Array): string => new TextDecoder().decode(b);

/** The value of a result that must be ok, or the failure of the test. */
export function good<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }, what: string): T {
  if (r.kind === "err") throw new Error(`${what}: ${JSON.stringify(r.error)}`);
  return r.value;
}

/** Folders made for a test and removed when it ends. */
export class Folders {
  readonly #dirs: string[] = [];
  async make(prefix: string): Promise<string> {
    const dir = await fs.makeTempDir({ prefix: `anyfs-mirror-${prefix}-` });
    this.#dirs.push(dir);
    return dir;
  }
  async done(): Promise<void> {
    for (const d of this.#dirs) await fs.remove(d, { recursive: true }).catch(() => undefined);
  }
}

/** Runs Git in a folder with no configuration of a computer in the way. */
export async function git(dir: string, ...args: readonly string[]): Promise<string> {
  const out = await proc.run(["git", "-C", dir, ...args], {
    env: { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.test", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.test" },
  });
  if (!out.success) throw new Error(`git ${args.join(" ")}: ${out.stderr.trim() || out.stdout.trim()}`);
  return out.stdout;
}

const who = (() => {
  const r = parseIdentity("Mirror Test", "mirror@example.test");
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
})();

/** A branch of a new bare repository as a store: the primary of the acceptance, with no signing. */
export async function gitBranch(folders: Folders): Promise<{ readonly ref: GitRef; readonly dir: string }> {
  const dir = await folders.make("git");
  await git(dir, "init", "-q", "--bare", "-b", "main");
  const r = await gitRefStore({ repo: dir, branch: "mirror", commit: { author: who, clock: () => Date.UTC(2026, 0, 1) } });
  return { ref: good(r, "git branch"), dir };
}

/** The core view of a store: what a mirror takes as a secondary. */
export function core(store: Parameters<typeof view>[0], what: string): Store<CoreCapability> {
  return good(view(store, CORE_CAPABILITIES), what);
}

/** A SQLite file in a folder as a store, opened by a new connection each time it is called. */
export async function sqliteFile(file: string, label = "mirror.db"): Promise<Store<CoreCapability>> {
  const port = good(await openSqliteFile(file), "sqlite port");
  const opened = good(await openSqlStore(port, { target: label }), "sql store");
  return core(opened.store, "sql store core");
}

/** A store in memory. */
export const memory = (name: string): Store<CoreCapability> => core(memoryStore({ name }), "memory");

/** A folder as a store. */
export async function folder(folders: Folders): Promise<Store<CoreCapability>> {
  return core(good(await localStore(await folders.make("folder"), { create: true }), "folder"), "folder core");
}

/** A store that fails every change while `down.value` is true, and otherwise is the store it wraps. */
export function flaky(inner: Store<CoreCapability>, down: { value: boolean }): Store<CoreCapability> {
  return makeStore({
    id: `${inner.id}-flaky`,
    place: inner.place,
    consistency: inner.consistency,
    traits: inner.traits,
    capabilities: CORE_CAPABILITIES,
    handle: async (op) => (down.value && (op.op === "write" || op.op === "delete") ? { kind: "err", error: unavailable("the replica is down", true) } : inner.handle(op)),
  });
}

/** Every path with its revision and bytes, read from a store, in the order of the paths. */
export async function snapshot(store: Store<CoreCapability>): Promise<readonly (readonly [string, string, string])[]> {
  const out: (readonly [string, string, string])[] = [];
  let after: Cursor | undefined;
  do {
    const page = good(await store.list(ROOT, after === undefined ? {} : { after }), "list");
    for (const e of page.entries) {
      const r = good(await store.read(e.path), `read ${e.path}`);
      out.push([e.path, e.rev, text(r.bytes)]);
    }
    after = page.next;
  } while (after !== undefined);
  return out;
}
