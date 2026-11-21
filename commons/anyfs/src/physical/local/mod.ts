// Spec: 0005-anyfs-conformance FR-004, FR-005
/**
 * The store in a folder of the local file system. A path of the store is a file below the folder; a folder of the file system is never an object. Its revision is `sha256:` and the digest of the bytes, so a
 * revision means the same as in memory; a write goes whole through a temporary file in the folder of the file and a rename, under a lock taken for the path, so a reader sees the old bytes or the new and
 * two writers that expect the same revision cannot both win. It refuses a path another file system could not hold and every operation that would reach a file outside its folder, by a path or by a link;
 * it never lists the files it makes itself (`.anyfs-` names). It has no `batch`: the file system has no atomic change of several files, and a store does not claim what it cannot keep.
 *
 * @remarks
 * Limits, said once: the check that a path stays inside the folder and the use of the path are two steps, so a link made between them by another process is not caught; the revision of a file is the digest of its
 * bytes, so `stat` and `list` read what they describe (a digest is kept for a file whose size and time have not changed in two seconds); nothing is flushed to the disk before a rename.
 *
 * @example
 * ```ts
 * import { localStore } from "./mod.ts";
 * const store = await localStore("/var/lib/fleet", { create: true });
 * store.kind === "ok" && store.value.consistency; // "strong"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { acquireLock } from "@intellectual-frontiers/system/lock";
import * as fs from "@intellectual-frontiers/system/fs";
import * as osPath from "@intellectual-frontiers/system/path";
import { AlreadyExists, IsADirectory, NotADirectory, NotFound, PermissionDenied } from "@intellectual-frontiers/system/errors";
import { makeStore, type Handler, type Op, type Stat, type Store } from "@intellectual-frontiers/anyfs/logical";
import {
  comparePaths,
  conflict,
  type Cursor,
  type Expect,
  isUnder,
  missing,
  parseCursor,
  parsePath,
  parseRevision,
  type Path,
  portabilityFindings,
  type Problem,
  refused,
  type Revision,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";

/** The capabilities of the store in a folder. */
export const LOCAL_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas", "rename"] as const;
/** The type of the store in a folder. */
export type LocalStore = Store<(typeof LOCAL_CAPABILITIES)[number]>;

/**
 * What the store in a folder is made with: whether to make the folder, whether to refuse paths another file system could not hold (the default), how long to wait for a lock, and whether the file system tells names apart by case: where the caller says, no probe file is written
 * (a store that must not write where it is opened, such as one at the root of a computer's file system, says); where it does not, a probe file is made and removed. The locks of writers are kept in `lockDir`,
 * an absolute folder, where it is given, and in a folder of the store's own where it is not: a store at the root of a file system names a folder of the account's own, since the root is not the account's to write.
 */
export type LocalOptions = { readonly create?: boolean; readonly portable?: boolean; readonly lockTimeoutMs?: number; readonly caseSensitive?: boolean; readonly lockDir?: string };

const HIDDEN = ".anyfs-";
const PAGE = 1000;
const MAX_PAGE = 10000;
const SETTLED_MS = 2000;

const hex = async (text: string): Promise<string> => sha256(text);

/** The revision of some bytes: `sha256:` and their digest. */
async function revisionOf(bytes: Uint8Array): Promise<Revision> {
  const r = parseRevision(`sha256:${await sha256(bytes)}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

function check(p: Path, expect: Expect, rev: Revision | undefined): Problem | undefined {
  switch (expect.kind) {
    case "any":
      return undefined;
    case "absent":
      return rev === undefined ? undefined : conflict(p, expect, { kind: "rev", rev });
    case "rev":
      if (rev === undefined) return conflict(p, expect, { kind: "absent" });
      return rev === expect.rev ? undefined : conflict(p, expect, { kind: "rev", rev });
    default:
      return unavailable("an expectation of no known kind", false);
  }
}

const describeError = (thrown: unknown): string => (thrown instanceof Error ? thrown.message : String(thrown));

/** A store in a folder, or why there is none. The folder must be an absolute path. */
export async function localStore(root: string, options: LocalOptions = {}): Promise<Result<LocalStore, string>> {
  if (!osPath.isAbsolute(root)) return err(`${JSON.stringify(root)} is not an absolute path`);
  try {
    if (options.create === true) await fs.mkdir(root, { recursive: true });
    const s = await fs.stat(root);
    if (!s.isDirectory) return err(`${root} is not a folder`);
  } catch (thrown) {
    return err(`${root} cannot be used: ${describeError(thrown)}`);
  }
  let realRoot: string;
  try {
    realRoot = await fs.realPath(root);
  } catch (thrown) {
    return err(`${root} cannot be resolved: ${describeError(thrown)}`);
  }
  const portable = options.portable !== false;
  const lockTimeout = options.lockTimeoutMs ?? 30000;

  // whether the file system tells names apart by case: made once, with a probe the store removes
  const probe = osPath.join(realRoot, `${HIDDEN}case-${crypto.randomUUID()}`);
  let caseSensitive = true;
  if (options.caseSensitive !== undefined) caseSensitive = options.caseSensitive;
  else {
    try {
      await fs.writeTextFile(probe, "", { createNew: true });
      caseSensitive = !(await fs.exists(probe.replace(HIDDEN, HIDDEN.toUpperCase())));
      await fs.remove(probe);
    } catch {
      caseSensitive = true;
    }
  }

  const rootWithSeparator = realRoot.endsWith(osPath.sep) ? realRoot : realRoot + osPath.sep;
  const inside = (real: string): boolean => real === realRoot || real.startsWith(rootWithSeparator);
  const absOf = (p: Path): string => osPath.join(realRoot, ...p.split("/"));
  const seen = new Map<string, { readonly fingerprint: string; readonly rev: Revision; readonly at: number }>();

  /** Whether a path, and every link on the way to it, stays inside the folder. */
  async function confined(abs: string): Promise<boolean> {
    try {
      const l = await fs.lstat(abs);
      if (l.isSymlink) {
        try {
          return inside(await fs.realPath(abs));
        } catch {
          return false;
        }
      }
    } catch (thrown) {
      if (!(thrown instanceof NotFound) && !(thrown instanceof NotADirectory)) return false;
    }
    let up = abs;
    for (;;) {
      try {
        return inside(await fs.realPath(up));
      } catch (thrown) {
        if (!(thrown instanceof NotFound) && !(thrown instanceof NotADirectory)) return false;
        const parent = osPath.dirname(up);
        if (parent === up) return false;
        up = parent;
      }
    }
  }

  /** A path that may be used here, or the refusal. */
  async function usable(p: Path): Promise<Problem | undefined> {
    if (p.split("/").some((s) => s.startsWith(HIDDEN))) return refused("unportable-path", `names that begin with ${HIDDEN} are the store's own`, p);
    if (portable) {
      const findings = portabilityFindings(p);
      if (findings.length > 0) return refused("unportable-path", findings.join("; "), p);
    }
    return (await confined(absOf(p))) ? undefined : refused("outside-scope", "the path reaches a file outside the folder of the store", p);
  }

  /** The object at a path: its bytes and revision, or nothing where there is none. */
  async function current(p: Path): Promise<{ readonly bytes: Uint8Array; readonly rev: Revision; readonly modified: string | undefined } | undefined> {
    const abs = absOf(p);
    try {
      const s = await fs.stat(abs);
      if (!s.isFile) return undefined;
      const bytes = await fs.readFile(abs);
      return { bytes, rev: await revisionOf(bytes), modified: s.mtime?.toISOString() };
    } catch (thrown) {
      if (thrown instanceof NotFound || thrown instanceof NotADirectory) return undefined;
      throw thrown;
    }
  }

  /** The revision and size of an object without reading it again where it has not changed in two seconds. */
  async function statOf(p: Path): Promise<Stat | undefined> {
    const abs = absOf(p);
    try {
      const s = await fs.stat(abs);
      if (!s.isFile) return undefined;
      const mtime = s.mtime?.getTime() ?? 0;
      const fingerprint = `${s.size}:${mtime}:${s.ino ?? 0}`;
      const known = seen.get(abs);
      let rev: Revision;
      if (known !== undefined && known.fingerprint === fingerprint && known.at - mtime > SETTLED_MS) rev = known.rev;
      else {
        const bytes = await fs.readFile(abs);
        rev = await revisionOf(bytes);
        seen.set(abs, { fingerprint, rev, at: Date.now() });
      }
      return { path: p, size: s.size, rev, ...(s.mtime === null ? {} : { modified: s.mtime.toISOString() }) };
    } catch (thrown) {
      if (thrown instanceof NotFound || thrown instanceof NotADirectory) return undefined;
      throw thrown;
    }
  }

  async function withLock<T>(p: Path, run: () => Promise<Result<T, Problem>>): Promise<Result<T, Problem>> {
    const dir = options.lockDir ?? osPath.join(realRoot, `${HIDDEN}locks`);
    await fs.mkdir(dir, { recursive: true });
    const held = await acquireLock(osPath.join(dir, `${(await hex(p)).slice(0, 32)}.lock`), { wait: true, pollMs: 2, timeoutMs: lockTimeout, command: "anyfs" });
    if (held === undefined) return err(unavailable(`${p} is locked by another writer`, true, p));
    try {
      return await run();
    } finally {
      held.release();
    }
  }

  async function prune(abs: string): Promise<void> {
    let dir = osPath.dirname(abs);
    while (dir !== realRoot && inside(dir) && !osPath.basename(dir).startsWith(HIDDEN)) {
      try {
        await fs.remove(dir);
      } catch {
        return;
      }
      dir = osPath.dirname(dir);
    }
  }

  function mapThrown(thrown: unknown, p: Path): Problem {
    if (thrown instanceof AlreadyExists || thrown instanceof NotADirectory || thrown instanceof IsADirectory) return refused("unportable-path", `${p} cannot be held here: a file and a folder would have the same name`, p);
    if (thrown instanceof PermissionDenied) return unavailable(`${p}: ${describeError(thrown)}`, false, p);
    return unavailable(`${p}: ${describeError(thrown)}`, false, p);
  }

  async function write(p: Path, bytes: Uint8Array, expect: Expect): Promise<Result<{ rev: Revision; created: boolean }, Problem>> {
    const bad = await usable(p);
    if (bad !== undefined) return err(bad);
    const rev = await revisionOf(bytes);
    const abs = absOf(p);
    try {
      await fs.mkdir(osPath.dirname(abs), { recursive: true });
      return await withLock(p, async () => {
        const had = await current(p);
        const problem = check(p, expect, had?.rev);
        if (problem !== undefined) return err(problem);
        if (had !== undefined && had.rev === rev) return ok({ rev, created: false });
        const tmp = osPath.join(osPath.dirname(abs), `${HIDDEN}tmp-${crypto.randomUUID()}`);
        try {
          await fs.writeFile(tmp, bytes, { createNew: true, mode: 0o644 });
          await fs.rename(tmp, abs);
        } catch (thrown) {
          await fs.remove(tmp).catch(() => undefined);
          throw thrown;
        }
        seen.delete(abs);
        return ok({ rev, created: had === undefined });
      });
    } catch (thrown) {
      return err(mapThrown(thrown, p));
    }
  }

  const handle: Handler = async (op: Op) => {
    try {
      switch (op.op) {
        case "read": {
          const bad = await usable(op.path);
          if (bad !== undefined) return err(bad);
          const had = await current(op.path);
          return had === undefined ? err(missing(op.path)) : ok({ op: "read", value: { bytes: had.bytes, rev: had.rev, ...(had.modified === undefined ? {} : { modified: had.modified }) } });
        }
        case "stat": {
          const bad = await usable(op.path);
          if (bad !== undefined) return err(bad);
          const s = await statOf(op.path);
          return s === undefined ? err(missing(op.path)) : ok({ op: "stat", value: s });
        }
        case "write": {
          const done = await write(op.path, op.bytes, op.expect);
          return done.kind === "err" ? done : ok({ op: "write", value: done.value });
        }
        case "delete": {
          const bad = await usable(op.path);
          if (bad !== undefined) return err(bad);
          const abs = absOf(op.path);
          const done = await withLock(op.path, async () => {
            const had = await current(op.path);
            const problem = check(op.path, op.expect, had?.rev);
            if (problem !== undefined) return err(problem);
            if (had === undefined) return ok({ existed: false });
            await fs.remove(abs);
            seen.delete(abs);
            await prune(abs);
            return ok({ existed: true });
          });
          return done.kind === "err" ? done : ok({ op: "delete", value: done.value });
        }
        case "rename": {
          if (op.from === op.to) return err(refused("outside-scope", "a rename to the same path moves nothing", op.from));
          for (const p of [op.from, op.to]) {
            const bad = await usable(p);
            if (bad !== undefined) return err(bad);
          }
          const [first, second] = comparePaths(op.from, op.to) < 0 ? [op.from, op.to] : [op.to, op.from];
          const absFrom = absOf(op.from);
          const absTo = absOf(op.to);
          await fs.mkdir(osPath.dirname(absTo), { recursive: true });
          const done = await withLock(first, () =>
            withLock(second, async () => {
              const had = await current(op.from);
              if (had === undefined) return err(missing(op.from));
              const problem = check(op.from, op.expect, had.rev);
              if (problem !== undefined) return err(problem);
              try {
                await fs.link(absFrom, absTo);
              } catch (thrown) {
                if (thrown instanceof AlreadyExists) {
                  const there = await current(op.to);
                  return err(conflict(op.to, { kind: "absent" }, there === undefined ? { kind: "absent" } : { kind: "rev", rev: there.rev }));
                }
                throw thrown;
              }
              await fs.remove(absFrom);
              seen.delete(absFrom);
              await prune(absFrom);
              return ok({ rev: had.rev, created: true });
            }),
          );
          return done.kind === "err" ? done : ok({ op: "rename", value: done.value });
        }
        case "list": {
          const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
          const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
          const start = op.prefix === "" ? realRoot : osPath.join(realRoot, ...op.prefix.split("/"));
          if (!(await confined(start))) return err(refused("outside-scope", "the prefix reaches a file outside the folder of the store"));
          const found: Path[] = [];
          const walk = async (dir: string, rel: string): Promise<void> => {
            let entries: Awaited<ReturnType<typeof readAll>>;
            try {
              entries = await readAll(dir);
            } catch (thrown) {
              if (thrown instanceof NotFound || thrown instanceof NotADirectory) return;
              throw thrown;
            }
            for (const e of entries) {
              if (e.name.startsWith(HIDDEN)) continue;
              const childRel = rel === "" ? e.name : `${rel}/${e.name}`;
              if (e.isDirectory) await walk(osPath.join(dir, e.name), childRel);
              else if (e.isFile) {
                const p = parsePath(childRel);
                if (p.kind === "ok" && p.value === childRel && (!portable || portabilityFindings(p.value).length === 0) && (op.prefix === "" || isUnder(op.prefix, p.value))) found.push(p.value);
              }
            }
          };
          await walk(start, op.prefix);
          found.sort(comparePaths);
          const rest = after === undefined ? found : found.filter((p) => comparePaths(p, after) > 0);
          const page = rest.slice(0, limit);
          const entries: Stat[] = [];
          for (const p of page) {
            const s = await statOf(p);
            if (s !== undefined) entries.push(s);
          }
          const last = page[page.length - 1];
          let next: Cursor | undefined;
          if (rest.length > limit && last !== undefined) {
            const c = parseCursor(encodeURIComponent(last));
            if (c.kind === "err") return err(unavailable(c.error, false));
            next = c.value;
          }
          return ok({ op: "list", value: next === undefined ? { entries } : { entries, next } });
        }
        case "batch":
        case "history":
        case "rangeRead":
        case "append":
        case "search":
          return err(refused("capability-absent", `the store in a folder does not have ${op.op}`));
        default:
          return err(unavailable("an operation of no known kind", false));
      }
    } catch (thrown) {
      const p = "path" in op ? op.path : undefined;
      return err(p === undefined ? unavailable(describeError(thrown), false) : mapThrown(thrown, p));
    }
  };

  return ok(
    makeStore({
      id: `file:${osPath.toPosix(realRoot)}`,
      place: { kind: "file", path: osPath.toPosix(realRoot) },
      consistency: "strong",
      traits: { caseSensitive },
      capabilities: LOCAL_CAPABILITIES,
      handle,
    }),
  );
}

async function readAll(dir: string): Promise<Awaited<ReturnType<typeof fs.readDirSync>>> {
  const out = [];
  for await (const e of fs.readDir(dir)) out.push(e);
  return out;
}
