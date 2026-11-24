// Spec: 0004-anyfs-posix-physical FR-001, FR-002, FR-003, FR-004, FR-005, FR-007, FR-008
/**
 * The view of a store as a file system. `posix(store)` makes a `Posix` that carries out each operation by the plan the logical layer gives it for the capabilities of the store, and every result carries
 * the fidelity of that plan. Directories are read from lists, an object is written through a buffer that is put at close, a rename is the store's where it has one and a copy and a delete where it
 * has not, and what a store cannot do is refused with a code and a reason. Nothing is kept in the process but the three values the program passed: the policy, the working directory and the handles.
 *
 * @example
 * ```ts
 * import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
 * import { posix } from "./posix.ts";
 * const view = posix(memoryStore({ name: "scratch" }));
 * await view.writeFile("/fleet/olympia.json", new TextEncoder().encode("{}"));
 * const listing = await view.readdir("/fleet"); // [{ name: "olympia.json", type: "file", size: 2, ... }]
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Capability,
  describeProblem,
  expectAbsent,
  type Expect,
  expectAny,
  expectRev,
  parsePath,
  type Path,
  type Prefix,
  type Problem,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import type { Change, Deleted, Listing, Read, Stat, Store, Written } from "@intellectual-frontiers/anyfs/logical";
import {
  ancestorsOf,
  type Counted,
  defaultPolicy,
  type DirEntry,
  type Done,
  type Errno,
  type Fd,
  type Fidelity,
  isBelow,
  type OpenMode,
  openFlags,
  type Outcome,
  type PartialReport,
  type PlanOp,
  type PosixError,
  type PosixPath,
  posixOf,
  type PosixStat,
  prefixOf,
  resolvePosix,
  ROOT_PATH,
  storePathOf,
  native,
} from "@intellectual-frontiers/anyfs-posix/governance";
import {
  childrenOf,
  concat,
  errnoOf,
  type Facts,
  type HandleTable,
  isMarker,
  modeOf,
  newHandleTable,
  type OpenFile,
  plan,
  type Plan,
  type Posix,
  type PosixOptions,
  resize,
  writeAt,
} from "@intellectual-frontiers/anyfs-posix/logical";
import { ReadCache } from "./cache.ts";

type Kind = "file" | "dir" | "none";
type Res<T> = Result<Outcome<T>, PosixError>;

const BATCH = 100;
const mismatch = (wanted: string, got: string): Problem => unavailable(`the store answered ${got} to ${wanted}`, false);

/** The capabilities a store must have to be viewed as a file system: the three that read. What it can write is read from its capabilities, and a view of a store that cannot be written refuses what would change it. */
export type Viewable = "read" | "list" | "stat";

/** The view of a store as a file system, with the policy, the working directory and the table of handles the program gives. */
export function posix(store: Store<Viewable>, options: PosixOptions = {}): Posix {
  const policy = options.policy ?? defaultPolicy();
  const facts: Facts = { capabilities: store.capabilities, policy };
  const handles = options.handles ?? newHandleTable();
  const cache = new ReadCache(policy.readCacheBytes);
  return build(store, facts, handles, cache, options.cwd ?? ROOT_PATH);
}

function build(store: Store<Viewable>, facts: Facts, handles: HandleTable, cache: ReadCache, cwd: PosixPath): Posix {
  const policy = facts.policy;
  const has = (c: Capability): boolean => facts.capabilities.has(c);
  const plans = new Map<PlanOp, Plan>();
  const planOf = (op: PlanOp): Plan => {
    const hit = plans.get(op);
    if (hit !== undefined) return hit;
    const made = plan(facts, op);
    plans.set(op, made);
    return made;
  };

  // ---- results: every one carries the fidelity of its plan
  const good = <T>(op: PlanOp, value: T, notes: readonly string[] = []): Res<T> => ok({ value, fidelity: planOf(op).fidelity, notes });
  const fail = (op: PlanOp, errno: Errno, message: string, path?: PosixPath, extra: { readonly problem?: Problem; readonly report?: PartialReport } = {}): Result<never, PosixError> =>
    err({
      errno,
      message,
      ...(path === undefined ? {} : { path }),
      fidelity: planOf(op).fidelity,
      ...(extra.problem === undefined ? {} : { problem: extra.problem }),
      ...(extra.report === undefined ? {} : { report: extra.report }),
    });
  const failProblem = (op: PlanOp, problem: Problem, path?: PosixPath, creating = false): Result<never, PosixError> =>
    fail(op, errnoOf(problem, { op, creating }), describeProblem(problem), path, { problem });
  const bare = (errno: Errno, message: string): Result<never, PosixError> => err({ errno, message, fidelity: native });
  /** An operation the plan refuses: the store cannot be written, has no compare-and-write, or has no such thing. */
  const refusal = (op: PlanOp): Result<never, PosixError> | undefined => {
    const f: Fidelity = planOf(op).fidelity;
    if (f.kind !== "refused") return undefined;
    return fail(op, f.reason === "read-only" ? "EROFS" : "ENOTSUP", f.detail);
  };

  // ---- the store, by its handler: one place that says what each answer must be
  const stat = async (path: Path): Promise<Result<Stat | undefined, Problem>> => {
    const r = await store.handle({ op: "stat", path });
    if (r.kind === "err") return r.error.kind === "missing" ? ok(undefined) : r;
    return r.value.op === "stat" ? ok(r.value.value) : err(mismatch("stat", r.value.op));
  };
  const readObject = async (path: Path): Promise<Result<Read, Problem>> => {
    const r = await store.handle({ op: "read", path });
    if (r.kind === "err") return r;
    return r.value.op === "read" ? ok(r.value.value) : err(mismatch("read", r.value.op));
  };
  const writeObject = async (path: Path, bytes: Uint8Array, expect: Expect): Promise<Result<Written, Problem>> => {
    const r = await store.handle({ op: "write", path, bytes, expect });
    if (r.kind === "err") return r;
    return r.value.op === "write" ? ok(r.value.value) : err(mismatch("write", r.value.op));
  };
  const deleteObject = async (path: Path, expect: Expect): Promise<Result<Deleted, Problem>> => {
    const r = await store.handle({ op: "delete", path, expect });
    if (r.kind === "err") return r;
    return r.value.op === "delete" ? ok(r.value.value) : err(mismatch("delete", r.value.op));
  };
  const listPage = async (prefix: Prefix, limit: number, after?: Listing["next"]): Promise<Result<Listing, Problem>> => {
    const r = await store.handle({ op: "list", prefix, limit, ...(after === undefined ? {} : { after }) });
    if (r.kind === "err") return r;
    return r.value.op === "list" ? ok(r.value.value) : err(mismatch("list", r.value.op));
  };
  const listAll = async (prefix: Prefix): Promise<Result<readonly Stat[], Problem>> => {
    const out: Stat[] = [];
    let after: Listing["next"];
    for (;;) {
      const page = await listPage(prefix, policy.listPage, after);
      if (page.kind === "err") return page;
      out.push(...page.value.entries);
      if (page.value.next === undefined) return ok(out);
      after = page.value.next;
    }
  };
  const anyBelow = async (prefix: Prefix): Promise<Result<boolean, Problem>> => {
    const page = await listPage(prefix, 1);
    return page.kind === "err" ? page : ok(page.value.entries.length > 0);
  };

  // ---- paths
  type At = { readonly p: PosixPath; readonly sp: Path | undefined };
  const at = (text: string): Result<At, PosixError> => {
    const p = resolvePosix(cwd, text);
    if (p.kind === "err") return bare("EINVAL", p.error);
    const sp = storePathOf(p.value);
    if (sp.kind === "err") return bare(sp.error.includes("bytes") ? "ENAMETOOLONG" : "EINVAL", sp.error);
    return ok({ p: p.value, sp: sp.value });
  };
  const keyOf = (p: PosixPath): Path => {
    const r = parsePath(p.slice(1));
    if (r.kind === "err") throw new Error(`${p} was resolved to a key and is not one: ${r.error}`);
    return r.value;
  };
  const prefixOfPath = (p: PosixPath): Prefix => {
    const r = prefixOf(p);
    if (r.kind === "err") throw new Error(`${p} was resolved to a prefix and is not one: ${r.error}`);
    return r.value;
  };

  /** What a name is: an object, a directory (something lies below it), or nothing. A marker object is not a file. */
  const kindOf = async (p: PosixPath, sp: Path | undefined): Promise<Result<Kind, Problem>> => {
    if (sp === undefined) return ok("dir");
    if (!isMarker(policy, sp)) {
      const s = await stat(sp);
      if (s.kind === "err") return s;
      if (s.value !== undefined) return ok("file");
    }
    const below = await anyBelow(prefixOfPath(p));
    if (below.kind === "err") return below;
    return ok(below.value ? "dir" : "none");
  };

  /** What must hold before an object is made at a path: no directory there, no object among the directories above, and not the name of a marker. */
  const creatable = async (op: PlanOp, p: PosixPath, sp: Path): Promise<Result<undefined, PosixError>> => {
    if (isMarker(policy, sp)) return fail(op, "EINVAL", `${p} is the name of a marker, which keeps a directory and is not a file`, p);
    const below = await anyBelow(prefixOfPath(p));
    if (below.kind === "err") return failProblem(op, below.error, p);
    if (below.value) return fail(op, "EISDIR", `${p} is a directory`, p);
    if (policy.ancestors === "check") {
      for (const a of ancestorsOf(p)) {
        const s = await stat(keyOf(a));
        if (s.kind === "err") return failProblem(op, s.error, a);
        if (s.value !== undefined) return fail(op, "ENOTDIR", `${a} is a file, so ${p} cannot be below it`, p);
      }
    }
    return ok(undefined);
  };

  const statOf = (type: "file" | "dir", s?: Stat): PosixStat => ({
    type,
    size: s === undefined ? 0 : s.size,
    mode: modeOf(type, facts.capabilities, policy.ownership),
    uid: policy.ownership.uid,
    gid: policy.ownership.gid,
    ...(s?.modified === undefined ? {} : { mtime: s.modified }),
    ...(s === undefined ? {} : { rev: s.rev }),
  });

  // ---- reads
  const statOp = async (text: string): Done<PosixStat> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const { p, sp } = a.value;
    if (sp === undefined) return good("stat-dir", statOf("dir"));
    if (isMarker(policy, sp)) return fail("stat-file", "ENOENT", `${p} is not there`, p);
    const s = await stat(sp);
    if (s.kind === "err") return failProblem("stat-file", s.error, p);
    if (s.value !== undefined) return good("stat-file", statOf("file", s.value));
    const below = await anyBelow(prefixOfPath(p));
    if (below.kind === "err") return failProblem("stat-dir", below.error, p);
    return below.value ? good("stat-dir", statOf("dir")) : fail("stat-dir", "ENOENT", `${p} is not there`, p);
  };

  const readdir = async (text: string): Done<readonly DirEntry[]> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const { p, sp } = a.value;
    if (sp !== undefined) {
      const s = await stat(sp);
      if (s.kind === "err") return failProblem("readdir", s.error, p);
      if (s.value !== undefined && !isMarker(policy, sp)) return fail("readdir", "ENOTDIR", `${p} is a file`, p);
    }
    const below = await listAll(prefixOfPath(p));
    if (below.kind === "err") return failProblem("readdir", below.error, p);
    const children = childrenOf(prefixOfPath(p), below.value, policy);
    if (!children.exists && sp !== undefined) return fail("readdir", "ENOENT", `${p} is not there`, p);
    return good("readdir", children.entries, children.notes);
  };

  const readFile = async (text: string): Done<Uint8Array> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const { p, sp } = a.value;
    if (sp === undefined) return fail("read-all", "EISDIR", `${p} is a directory`, p);
    if (isMarker(policy, sp)) return fail("read-all", "ENOENT", `${p} is not there`, p);
    const gone = async (): Promise<Res<Uint8Array>> => {
      const below = await anyBelow(prefixOfPath(p));
      if (below.kind === "err") return failProblem("read-all", below.error, p);
      return below.value ? fail("read-all", "EISDIR", `${p} is a directory`, p) : fail("read-all", "ENOENT", `${p} is not there`, p);
    };
    if (policy.readCacheBytes > 0) {
      const s = await stat(sp);
      if (s.kind === "err") return failProblem("read-all", s.error, p);
      if (s.value === undefined) return gone();
      const hit = cache.get(sp, s.value.rev);
      if (hit !== undefined) return good("read-all", hit, ["from the read cache: the revision is the one the store has"]);
    }
    const r = await readObject(sp);
    if (r.kind === "err") return r.error.kind === "missing" ? gone() : failProblem("read-all", r.error, p);
    if (policy.readCacheBytes > 0) cache.put(sp, r.value.rev, r.value.bytes);
    return good("read-all", r.value.bytes.slice());
  };

  // ---- writes of whole objects
  const writeFile = async (text: string, bytes: Uint8Array, opts: { readonly exclusive?: boolean } = {}): Done<void> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const refused = refusal("write-all");
    if (refused !== undefined) return refused;
    const { p, sp } = a.value;
    if (sp === undefined) return fail("write-all", "EISDIR", `${p} is a directory`, p);
    const s = await stat(sp);
    if (s.kind === "err") return failProblem("write-all", s.error, p);
    if (s.value !== undefined && !isMarker(policy, sp)) {
      if (opts.exclusive === true) return fail("write-all", "EEXIST", `${p} is already there`, p);
    } else {
      const c = await creatable("write-all", p, sp);
      if (c.kind === "err") return c;
    }
    const w = await writeObject(sp, bytes, opts.exclusive === true ? expectAbsent : expectAny);
    return w.kind === "err" ? failProblem("write-all", w.error, p, opts.exclusive === true) : good("write-all", undefined);
  };

  const touch = async (text: string): Done<void> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const refused = refusal("touch");
    if (refused !== undefined) return refused;
    const { p, sp } = a.value;
    if (sp === undefined) return fail("touch", "EISDIR", `${p} is a directory`, p);
    const s = await stat(sp);
    if (s.kind === "err") return failProblem("touch", s.error, p);
    if (s.value !== undefined && !isMarker(policy, sp)) return good("touch", undefined, [`${p} exists and is left as it is: the store keeps no time a touch could change`]);
    const c = await creatable("touch", p, sp);
    if (c.kind === "err") return c;
    const w = await writeObject(sp, new Uint8Array(), expectAbsent);
    if (w.kind === "err" && w.error.kind !== "conflict") return failProblem("touch", w.error, p);
    return good("touch", undefined);
  };

  // ---- read, modify, write: only where the store compares revisions
  const modify = async (op: "truncate" | "append", text: string, change: (bytes: Uint8Array) => Uint8Array, create: boolean): Done<void> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const refused = refusal(op);
    if (refused !== undefined) return refused;
    const { p, sp } = a.value;
    if (sp === undefined) return fail(op, "EISDIR", `${p} is a directory`, p);
    for (let attempt = 0; attempt < policy.appendAttempts; attempt++) {
      const r = isMarker(policy, sp) ? ok(undefined) : await stat(sp);
      if (r.kind === "err") return failProblem(op, r.error, p);
      if (r.value === undefined) {
        const below = await anyBelow(prefixOfPath(p));
        if (below.kind === "err") return failProblem(op, below.error, p);
        if (below.value) return fail(op, "EISDIR", `${p} is a directory`, p);
        if (!create) return fail(op, "ENOENT", `${p} is not there`, p);
        const c = await creatable(op, p, sp);
        if (c.kind === "err") return c;
        const w = await writeObject(sp, change(new Uint8Array()), expectAbsent);
        if (w.kind === "ok") return good(op, undefined);
        if (w.error.kind !== "conflict") return failProblem(op, w.error, p);
        continue;
      }
      const read = await readObject(sp);
      if (read.kind === "err") {
        if (read.error.kind === "missing") continue;
        return failProblem(op, read.error, p);
      }
      const w = await writeObject(sp, change(read.value.bytes), expectRev(read.value.rev));
      if (w.kind === "ok") return good(op, undefined);
      if (w.error.kind !== "conflict") return failProblem(op, w.error, p);
    }
    return fail(op, "ESTALE", `${p} kept changing: ${policy.appendAttempts} attempts were not enough`, p);
  };

  // ---- handles
  const open = async (text: string, mode: OpenMode): Done<Fd> => {
    const flags = openFlags(mode);
    const op: PlanOp = flags.write ? "open-write" : "read-all";
    const a = at(text);
    if (a.kind === "err") return a;
    const refused = refusal(op);
    if (refused !== undefined) return refused;
    const { p, sp } = a.value;
    if (sp === undefined) return fail(op, "EISDIR", `${p} is a directory`, p);
    if (isMarker(policy, sp)) return fail(op, flags.create ? "EINVAL" : "ENOENT", `${p} is the name of a marker, which keeps a directory`, p);
    const s = await stat(sp);
    if (s.kind === "err") return failProblem(op, s.error, p);
    if (s.value !== undefined) {
      if (flags.exclusive) return fail(op, "EEXIST", `${p} is already there`, p);
      if (flags.truncate) {
        const fd = handles.open({ path: p, storePath: sp, flags, base: { kind: "rev", rev: s.value.rev }, bytes: new Uint8Array(), position: 0, dirty: true });
        return good(op, fd);
      }
      const cached = policy.readCacheBytes > 0 ? cache.get(sp, s.value.rev) : undefined;
      let bytes = cached;
      let rev = s.value.rev;
      if (bytes === undefined) {
        const r = await readObject(sp);
        if (r.kind === "err") return failProblem(op, r.error, p);
        bytes = r.value.bytes;
        rev = r.value.rev;
        if (policy.readCacheBytes > 0) cache.put(sp, rev, bytes);
      }
      const fd = handles.open({ path: p, storePath: sp, flags, base: { kind: "rev", rev }, bytes: bytes.slice(), position: 0, dirty: false });
      return good(op, fd);
    }
    const below = await anyBelow(prefixOfPath(p));
    if (below.kind === "err") return failProblem(op, below.error, p);
    if (below.value) return fail(op, "EISDIR", `${p} is a directory`, p);
    if (!flags.create) return fail(op, "ENOENT", `${p} is not there`, p);
    const c = await creatable(op, p, sp);
    if (c.kind === "err") return c;
    const fd = handles.open({ path: p, storePath: sp, flags, base: { kind: "absent" }, bytes: new Uint8Array(), position: 0, dirty: true });
    return good(op, fd);
  };

  const handleOf = (op: PlanOp, fd: Fd, need: "read" | "write" | "any"): Result<OpenFile, PosixError> => {
    const h = handles.get(fd);
    if (h === undefined) return fail(op, "EBADF", `${fd} is not open`);
    if (need === "read" && !h.flags.read) return fail(op, "EBADF", `${h.path} is not open for reading`, h.path);
    if (need === "write" && !h.flags.write) return fail(op, "EBADF", `${h.path} is not open for writing`, h.path);
    return ok(h);
  };

  const read = async (fd: Fd, length: number, position?: number): Done<Uint8Array> => {
    const h = handleOf("read-range", fd, "read");
    if (h.kind === "err") return h;
    if (!Number.isInteger(length) || length < 0 || (position !== undefined && (!Number.isInteger(position) || position < 0))) return fail("read-range", "EINVAL", "a length and a position are whole numbers from 0", h.value.path);
    const from = position ?? h.value.position;
    const out = h.value.bytes.slice(from, from + length);
    if (position === undefined) h.value.position = from + out.length;
    return good("read-range", out);
  };

  const write = async (fd: Fd, bytes: Uint8Array, position?: number): Done<number> => {
    const h = handleOf("write", fd, "write");
    if (h.kind === "err") return h;
    if (position !== undefined && (!Number.isInteger(position) || position < 0)) return fail("write", "EINVAL", "a position is a whole number from 0", h.value.path);
    const f = h.value;
    const offset = f.flags.append ? f.bytes.length : (position ?? f.position);
    f.bytes = writeAt(f.bytes, offset, bytes);
    f.dirty = true;
    if (position === undefined || f.flags.append) f.position = offset + bytes.length;
    return good("write", bytes.length);
  };

  const flush = async (op: "fsync" | "close", f: OpenFile): Promise<Res<void>> => {
    if (!f.dirty) return good(op, undefined);
    const expect: Expect = f.base.kind === "absent" ? expectAbsent : has("cas") ? expectRev(f.base.rev) : expectAny;
    const w = await writeObject(f.storePath, f.bytes, expect);
    if (w.kind === "err") return failProblem(op, w.error, f.path, f.flags.exclusive);
    f.base = { kind: "rev", rev: w.value.rev };
    f.dirty = false;
    return good(op, undefined, has("cas") ? [] : ["the store cannot compare revisions: a change another writer made since the open is overwritten"]);
  };

  const fsync = async (fd: Fd): Done<void> => {
    const h = handleOf("fsync", fd, "any");
    return h.kind === "err" ? h : flush("fsync", h.value);
  };

  const close = async (fd: Fd): Done<void> => {
    const h = handleOf("close", fd, "any");
    if (h.kind === "err") return h;
    const r = await flush("close", h.value);
    handles.release(fd);
    return r.kind === "err" ? err({ ...r.error, message: `${r.error.message}; the handle is closed and what it held is discarded` }) : r;
  };

  const ftruncate = async (fd: Fd, length: number): Done<void> => {
    const h = handleOf("write", fd, "write");
    if (h.kind === "err") return h;
    if (!Number.isInteger(length) || length < 0) return fail("write", "EINVAL", "a length is a whole number from 0", h.value.path);
    h.value.bytes = resize(h.value.bytes, length);
    h.value.dirty = true;
    return good("write", undefined);
  };

  // ---- directories
  const mkdir = async (text: string, opts: { readonly parents?: boolean } = {}): Done<void> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const refused = refusal("mkdir");
    if (refused !== undefined) return refused;
    const { p, sp } = a.value;
    if (sp === undefined) return fail("mkdir", "EEXIST", "the root is there", p);
    if (isMarker(policy, sp)) return fail("mkdir", "EINVAL", `${p} is the name of a marker`, p);
    const k = await kindOf(p, sp);
    if (k.kind === "err") return failProblem("mkdir", k.error, p);
    if (k.value === "file") return fail("mkdir", "EEXIST", `${p} is a file`, p);
    if (k.value === "dir") return opts.parents === true ? good("mkdir", undefined) : fail("mkdir", "EEXIST", `${p} is already there`, p);
    if (policy.ancestors === "check") {
      for (const anc of ancestorsOf(p)) {
        const s = await stat(keyOf(anc));
        if (s.kind === "err") return failProblem("mkdir", s.error, anc);
        if (s.value !== undefined) return fail("mkdir", "ENOTDIR", `${anc} is a file, so ${p} cannot be below it`, p);
      }
    }
    if (policy.markers.kind === "none") return good("mkdir", undefined, [`nothing was written: ${p} is kept only while an object lies below it`]);
    const parent = ancestorsOf(p).at(-1);
    if (opts.parents !== true && parent !== undefined) {
      const pk = await kindOf(parent, keyOf(parent));
      if (pk.kind === "err") return failProblem("mkdir", pk.error, parent);
      if (pk.value !== "dir") return fail("mkdir", "ENOENT", `${parent} is not there`, p);
    }
    const marker = parsePath(`${sp}/${policy.markers.name}`);
    if (marker.kind === "err") return fail("mkdir", "ENAMETOOLONG", marker.error, p);
    const w = await writeObject(marker.value, new Uint8Array(), expectAbsent);
    if (w.kind === "err") return w.error.kind === "conflict" ? fail("mkdir", "EEXIST", `${p} is already there`, p) : failProblem("mkdir", w.error, p);
    return good("mkdir", undefined);
  };

  const rmdir = async (text: string): Done<void> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const refused = refusal("rmdir");
    if (refused !== undefined) return refused;
    const { p, sp } = a.value;
    if (sp === undefined) return fail("rmdir", "EINVAL", "the root cannot be removed", p);
    if (!isMarker(policy, sp)) {
      const s = await stat(sp);
      if (s.kind === "err") return failProblem("rmdir", s.error, p);
      if (s.value !== undefined) return fail("rmdir", "ENOTDIR", `${p} is a file`, p);
    }
    const below = await listAll(prefixOfPath(p));
    if (below.kind === "err") return failProblem("rmdir", below.error, p);
    if (below.value.length === 0) return fail("rmdir", "ENOENT", `${p} is not there`, p);
    const own = policy.markers.kind === "keep" ? `${sp}/${policy.markers.name}` : undefined;
    const rest = below.value.filter((e) => e.path !== own);
    if (rest.length > 0) return fail("rmdir", "ENOTEMPTY", `${p} is not empty`, p);
    if (own === undefined) return fail("rmdir", "ENOENT", `${p} is not there`, p);
    const d = await deleteObject(keyOfString(own), expectAny);
    return d.kind === "err" ? failProblem("rmdir", d.error, p) : good("rmdir", undefined);
  };
  const keyOfString = (text: string): Path => {
    const r = parsePath(text);
    if (r.kind === "err") throw new Error(`${text} is a key of the store and is not a path: ${r.error}`);
    return r.value;
  };

  const unlink = async (text: string): Done<void> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const refused = refusal("unlink");
    if (refused !== undefined) return refused;
    const { p, sp } = a.value;
    if (sp === undefined) return fail("unlink", "EISDIR", `${p} is a directory`, p);
    if (isMarker(policy, sp)) return fail("unlink", "ENOENT", `${p} is not there`, p);
    const s = await stat(sp);
    if (s.kind === "err") return failProblem("unlink", s.error, p);
    if (s.value === undefined) {
      const below = await anyBelow(prefixOfPath(p));
      if (below.kind === "err") return failProblem("unlink", below.error, p);
      return below.value ? fail("unlink", "EISDIR", `${p} is a directory`, p) : fail("unlink", "ENOENT", `${p} is not there`, p);
    }
    const d = await deleteObject(sp, expectAny);
    if (d.kind === "err") return failProblem("unlink", d.error, p);
    return d.value.existed ? good("unlink", undefined) : fail("unlink", "ENOENT", `${p} is not there`, p);
  };

  // ---- moving
  /** Copies an object to a path and removes the source: the revision of the source guards the removal where the store compares revisions. */
  const copyThenDelete = async (op: PlanOp, from: At & { readonly sp: Path }, to: Path, expectTo: Expect): Promise<Result<undefined, PosixError>> => {
    const r = await readObject(from.sp);
    if (r.kind === "err") return failProblem(op, r.error, from.p);
    const w = await writeObject(to, r.value.bytes, expectTo);
    if (w.kind === "err") return failProblem(op, w.error, posixOf(to), false);
    const d = await deleteObject(from.sp, has("cas") ? expectRev(r.value.rev) : expectAny);
    if (d.kind === "err") return fail(op, errnoOf(d.error, { op }), `${describeProblem(d.error)}: ${posixOf(to)} was written and ${from.p} is still there`, from.p, { problem: d.error });
    return ok(undefined);
  };

  const rename = async (fromText: string, toText: string): Done<void> => {
    const fa = at(fromText);
    if (fa.kind === "err") return fa;
    const ta = at(toText);
    if (ta.kind === "err") return ta;
    const refused = refusal("rename-file");
    if (refused !== undefined) return refused;
    const from = fa.value;
    const to = ta.value;
    if (from.sp === undefined) return fail("rename-dir", "EINVAL", "the root cannot be moved", from.p);
    if (isMarker(policy, from.sp)) return fail("rename-file", "ENOENT", `${from.p} is not there`, from.p);
    if (to.sp !== undefined && isMarker(policy, to.sp)) return fail("rename-file", "EINVAL", `${to.p} is the name of a marker`, to.p);
    const sk = await kindOf(from.p, from.sp);
    if (sk.kind === "err") return failProblem("rename-file", sk.error, from.p);
    if (sk.value === "none") return fail("rename-file", "ENOENT", `${from.p} is not there`, from.p);
    if (from.p === to.p) return good(sk.value === "file" ? "rename-file" : "rename-dir", undefined);
    if (sk.value === "dir" && isBelow(from.p, to.p)) return fail("rename-dir", "EINVAL", `${to.p} is below ${from.p}: a directory cannot be moved into itself`, to.p);
    if (to.sp === undefined) return fail("rename-file", sk.value === "file" ? "EISDIR" : "EEXIST", "the root is a directory that is there", to.p);
    const toSp = to.sp;
    const fromSp = from.sp;
    const dk = await kindOf(to.p, toSp);
    if (dk.kind === "err") return failProblem("rename-file", dk.error, to.p);
    const underDest = async (op: PlanOp): Promise<Result<undefined, PosixError>> => {
      if (policy.ancestors === "check") {
        for (const anc of ancestorsOf(to.p)) {
          const s = await stat(keyOf(anc));
          if (s.kind === "err") return failProblem(op, s.error, anc);
          if (s.value !== undefined) return fail(op, "ENOTDIR", `${anc} is a file, so ${to.p} cannot be below it`, to.p);
        }
      }
      return ok(undefined);
    };

    if (sk.value === "file") {
      if (dk.value === "dir") return fail("rename-file", "EISDIR", `${to.p} is a directory`, to.p);
      if (dk.value === "file") {
        const ds = await stat(toSp);
        if (ds.kind === "err") return failProblem("rename-over", ds.error, to.p);
        const guard: Expect = ds.value !== undefined && has("cas") ? expectRev(ds.value.rev) : expectAny;
        const c = await copyThenDelete("rename-over", { p: from.p, sp: fromSp }, toSp, guard);
        return c.kind === "err" ? c : good("rename-over", undefined);
      }
      const u = await underDest("rename-file");
      if (u.kind === "err") return u;
      if (has("rename")) {
        const r = await store.handle({ op: "rename", from: fromSp, to: toSp, expect: expectAny });
        return r.kind === "err" ? failProblem("rename-file", r.error, from.p) : good("rename-file", undefined);
      }
      const c = await copyThenDelete("rename-file", { p: from.p, sp: fromSp }, toSp, expectAbsent);
      return c.kind === "err" ? c : good("rename-file", undefined);
    }

    // a directory
    if (dk.value === "file") return fail("rename-dir", "ENOTDIR", `${to.p} is a file`, to.p);
    if (dk.value === "dir") return fail("rename-dir", "EEXIST", `${to.p} is already there`, to.p);
    const u = await underDest("rename-dir");
    if (u.kind === "err") return u;
    const all = await listAll(prefixOfPath(from.p));
    if (all.kind === "err") return failProblem("rename-dir", all.error, from.p);
    const pairs: { readonly from: Path; readonly to: Path }[] = [];
    for (const entry of all.value) {
      const rel = entry.path.slice(fromSp.length + 1);
      const target = parsePath(`${toSp}/${rel}`);
      if (target.kind === "err") return fail("rename-dir", "ENAMETOOLONG", target.error, to.p);
      pairs.push({ from: entry.path, to: target.value });
    }
    const done: PosixPath[] = [];
    const failed: { path: PosixPath; errno: Errno }[] = [];
    if (has("rename")) {
      for (const pair of pairs) {
        const r = await store.handle({ op: "rename", from: pair.from, to: pair.to, expect: expectAny });
        if (r.kind === "ok") done.push(posixOf(pair.from));
        else failed.push({ path: posixOf(pair.from), errno: errnoOf(r.error, { op: "rename-dir" }) });
      }
    } else {
      const copied: { from: Path; to: Path; rev: Read["rev"] }[] = [];
      for (const pair of pairs) {
        const r = await readObject(pair.from);
        if (r.kind === "err") {
          failed.push({ path: posixOf(pair.from), errno: errnoOf(r.error, { op: "rename-dir" }) });
          continue;
        }
        const w = await writeObject(pair.to, r.value.bytes, expectAbsent);
        if (w.kind === "err") failed.push({ path: posixOf(pair.from), errno: errnoOf(w.error, { op: "rename-dir", creating: true }) });
        else copied.push({ from: pair.from, to: pair.to, rev: r.value.rev });
      }
      if (failed.length === 0) {
        for (const c of copied) {
          const d = await deleteObject(c.from, has("cas") ? expectRev(c.rev) : expectAny);
          if (d.kind === "ok") done.push(posixOf(c.from));
          else failed.push({ path: posixOf(c.from), errno: errnoOf(d.error, { op: "rename-dir" }) });
        }
      }
    }
    if (failed.length > 0) return fail("rename-dir", "EIO", `${failed.length} of ${pairs.length} objects below ${from.p} were not moved`, from.p, { report: { done, failed } });
    return good("rename-dir", undefined);
  };

  const removeAll = async (text: string): Done<Counted> => {
    const a = at(text);
    if (a.kind === "err") return a;
    const refused = refusal("rm-r");
    if (refused !== undefined) return refused;
    const { p, sp } = a.value;
    if (sp === undefined) return fail("rm-r", "EINVAL", "the root is not removed: remove what is below it", p);
    const all = await listAll(prefixOfPath(p));
    if (all.kind === "err") return failProblem("rm-r", all.error, p);
    const s = isMarker(policy, sp) ? ok(undefined) : await stat(sp);
    if (s.kind === "err") return failProblem("rm-r", s.error, p);
    const keys: Path[] = [...all.value.map((e) => e.path), ...(s.value === undefined ? [] : [sp])];
    if (keys.length === 0) return fail("rm-r", "ENOENT", `${p} is not there`, p);
    const done: PosixPath[] = [];
    const failed: { path: PosixPath; errno: Errno }[] = [];
    if (has("batch")) {
      for (let i = 0; i < keys.length; i += BATCH) {
        const chunk = keys.slice(i, i + BATCH);
        const changes: Change[] = chunk.map((path) => ({ kind: "delete", path, expect: expectAny }));
        const r = await store.handle({ op: "batch", changes });
        if (r.kind === "ok") done.push(...chunk.map(posixOf));
        else failed.push(...chunk.map((path) => ({ path: posixOf(path), errno: errnoOf(r.error, { op: "rm-r" }) })));
      }
    } else {
      for (const key of keys) {
        const d = await deleteObject(key, expectAny);
        if (d.kind === "ok") done.push(posixOf(key));
        else failed.push({ path: posixOf(key), errno: errnoOf(d.error, { op: "rm-r" }) });
      }
    }
    if (failed.length > 0) return fail("rm-r", "EIO", `${failed.length} of ${keys.length} objects below ${p} were not removed`, p, { report: { done, failed } });
    return good("rm-r", { count: done.length });
  };

  const refusedOp = async (op: PlanOp, text?: string): Done<never> => {
    const p = text === undefined ? undefined : at(text);
    if (p !== undefined && p.kind === "err") return p;
    const f = planOf(op).fidelity;
    return fail(op, "ENOTSUP", f.kind === "refused" ? f.detail : "the store has no way to do it", p === undefined ? undefined : p.value.p);
  };

  const self: Posix = {
    store: store.id,
    cwd,
    policy,
    capabilities: facts.capabilities,
    withCwd(text) {
      const r = resolvePosix(cwd, text);
      return r.kind === "err" ? bare("EINVAL", r.error) : ok(build(store, facts, handles, cache, r.value));
    },
    explain: planOf,
    stat: statOp,
    lstat: statOp,
    readdir,
    mkdir,
    rmdir,
    unlink,
    rename,
    readFile,
    writeFile,
    open,
    read,
    write,
    fsync,
    close,
    ftruncate,
    truncate: (text, length) => {
      if (!Number.isInteger(length) || length < 0) return Promise.resolve(bare("EINVAL", "a length is a whole number from 0"));
      return modify("truncate", text, (bytes) => resize(bytes, length), false);
    },
    appendFile: (text, bytes) => modify("append", text, (existing) => concat(existing, bytes), true),
    touch,
    removeAll,
    chmod: (text) => refusedOp("chmod", text),
    chown: (text) => refusedOp("chown", text),
    utimes: (text) => refusedOp("utimes", text),
    symlink: (_target, text) => refusedOp("symlink", text),
    link: (_existing, text) => refusedOp("link", text),
    readlink: (text) => refusedOp("readlink", text),
    mmap: () => refusedOp("mmap"),
  };
  return self;
}
