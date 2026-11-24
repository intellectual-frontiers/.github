// Spec: 0003-anyfs-ssh-store FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The store in a folder on a host reached by SSH. It speaks to the host only through an `Executor` of Headless (the one place where the options, the quoting and the host-key policy of ssh are held),
 * and the executor runs the helper, a small script of POSIX whose SHA-256 is pinned: the helper is kept on the host at a path that carries its hash, checked when it is put there, or carried in each
 * call where it cannot be kept. The bytes of an object go over standard input and output and never through an argument. A path of the store is a file below the folder; the revision of an object is
 * `sha256:` and the digest of its bytes, computed by the host for `stat` and `list` and by this library for what it reads and writes, so a write that the host did not make as sent is `tampered`.
 * A write goes whole through a temporary file and a rename, an expectation of no object is an exclusive link, an expectation of a revision is held under a lock the host makes with `mkdir`.
 * It has no `batch`, no `history`, no range and no append, and it does not flush to the disk: a store does not claim what it cannot keep.
 *
 * @remarks
 * Limits, said once: the check that a path stays inside the folder and the use of the path are two steps, so a link made between them by another process of the same account is not caught; a lock that
 * belongs to a process that is gone is taken over only where the host answers `kill -0`; a call keeps the whole object in memory on both sides (the store refuses an object of more than `maxBytes`);
 * a host with none of `sha256sum`, `shasum`, `openssl` or `sha256` cannot hold a store; the clock of the host is the `modified` of an object.
 *
 * @example
 * ```ts
 * import { openSshStore } from "./store.ts";
 * // const opened = await openSshStore(sshExecutor(target, [target], config), { root: "/srv/fleet", place: { host: "alpha" }, create: true });
 * // opened.kind === "ok" && opened.value.store.consistency; // "strong"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type Executor, type RunOptions } from "@intellectual-frontiers/headless/logical";
import { makeStore, type Handler, type Op, type Stat, type Store } from "@intellectual-frontiers/anyfs/logical";
import {
  comparePaths,
  conflict,
  type Cursor,
  type Expect,
  formatPlace,
  isUnder,
  missing,
  parseCursor,
  parsePath,
  type Path,
  type Place,
  portabilityFindings,
  type Prefix,
  type Problem,
  refused,
  type Revision,
  tampered,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import { helperOf, type HostDialect, POSIX } from "./dialect.ts";
import { callOf, type Command, factsOf, type HostFacts, hostFactsOf, linesOf, replyOf, type Reply, textOf, type Transport, writtenOf } from "./protocol.ts";

/** The capabilities of the store on a host. */
export const SSH_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas", "rename"] as const;
/** The type of the store on a host. */
export type SshStore = Store<(typeof SSH_CAPABILITIES)[number]>;

/** The host a store is on, as the place says it: the label of the target, and the account and port where they are not the executor's own. */
export type SshHost = { readonly host: string; readonly user?: string; readonly port?: number };

/** What the store on a host is made with. */
export type SshOptions = {
  /** The host the executor reaches, for the place and the id of the store. */
  readonly place: SshHost;
  /** The folder of the store on the host: an absolute path. */
  readonly root: string;
  /** Whether to make the folder where it is not there. */
  readonly create?: boolean;
  /** Whether to keep the helper on the host (the default) or to carry it in each call. */
  readonly install?: boolean;
  /** The folder the helper is kept in: the state folder of the account where it is `default` or left out. */
  readonly stateDir?: string;
  /** The most bytes an object may have, here and on the host. 32 MiB where it is left out. */
  readonly maxBytes?: number;
  /** Whether to refuse paths another file system could not hold (the default). */
  readonly portable?: boolean;
  /** How long a call may take before it is stopped. 60 s where it is left out. */
  readonly timeoutMs?: number;
  /** The language of the shell on the host. */
  readonly dialect?: HostDialect;
};

/** A store on a host, with how it reaches the host and what the host is. */
export type Opened = { readonly store: SshStore; readonly transport: Transport; readonly facts: HostFacts };

const PAGE = 1000;
const MAX_PAGE = 10000;
const DEFAULT_MAX = 32 * 1024 * 1024;
const SHA = /^sha256:[0-9a-f]{64}$/;

const encoder = new TextEncoder();

async function revisionOf(bytes: Uint8Array): Promise<Revision> {
  return `sha256:${await sha256(bytes)}` as Revision;
}

function expectWord(expect: Expect, path: Path): Result<string, Problem> {
  switch (expect.kind) {
    case "any":
      return ok("any");
    case "absent":
      return ok("absent");
    case "rev":
      return SHA.test(expect.rev) ? ok(`rev:${expect.rev.slice("sha256:".length)}`) : err(refused("unsupported-expectation", `${expect.rev} is not a revision of this store: a revision is sha256: and the digest in hex`, path));
    default:
      return err(unavailable("an expectation of no known kind", false, path));
  }
}

function refusal(reason: string, path: Path | undefined): Problem {
  switch (reason) {
    case "outside":
      return refused("outside-scope", "the path reaches a file outside the folder of the store", path);
    case "hidden":
      return refused("unportable-path", "names that begin with .anyfs- are the store's own", path);
    case "shape":
      return refused("unportable-path", "the host does not take the path as a path of the store", path);
    case "notdir":
    case "notfile":
      return refused("unportable-path", "a file and a folder would have the same path", path);
    case "same":
      return refused("outside-scope", "a rename to the same path moves nothing", path);
    default:
      return refused("outside-scope", `the host refused it: ${reason}`, path);
  }
}

/** The problem a reply that is not `done` stands for. `expect` and the paths say what a conflict and a missing object are about. */
function problemOf(reply: Exclude<Reply, { readonly kind: "done" }>, subject: { readonly path?: Path; readonly to?: Path; readonly expect?: Expect }): Problem {
  const p = subject.path;
  switch (reply.kind) {
    case "missing":
      return p === undefined ? unavailable("the host reported a missing object where there is no path", false) : missing(p);
    case "conflict": {
      const at = reply.at === "to" ? subject.to : p;
      return at === undefined ? unavailable("the host reported a conflict where there is no path", false) : conflict(at, reply.at === "to" ? { kind: "absent" } : (subject.expect ?? { kind: "any" }), reply.found);
    }
    case "refused":
      return refusal(reply.reason, p);
    case "locked":
      return unavailable(`${p ?? "the object"} is locked by another writer`, true, p);
    case "too-large":
      return refused("too-large", "the object is larger than the store takes", p);
    case "no-root":
      return unavailable("the folder of the store is not on the host", false, p);
    case "no-hash":
      return unavailable("the host has none of sha256sum, shasum, openssl or sha256", false, p);
    case "bad-hash":
      return tampered(p ?? ("helper" as Path), `the helper on the host is not the one this library pins (it hashes to ${reply.got})`);
    case "failed":
      return unavailable(reply.detail, false, p);
    case "lost":
      return unavailable(reply.detail, true, p);
    default:
      return unavailable("an answer of no known kind", false, p);
  }
}

/** A store on a host, or why there is none. The executor is the one of Headless for the target; the folder is made if `create` says so. */
export async function openSshStore(executor: Executor, options: SshOptions): Promise<Result<Opened, string>> {
  if (!options.root.startsWith("/") || options.root.includes("\u0000")) return err(`${JSON.stringify(options.root)} is not an absolute path`);
  const helper = helperOf(options.dialect ?? POSIX);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX;
  const portable = options.portable !== false;
  const timeoutMs = options.timeoutMs ?? 60000;

  const call = async (transport: Transport, command: Command, args: readonly string[], input?: Uint8Array): Promise<Reply> => {
    const stop = { signal: AbortSignal.timeout(timeoutMs), killAfterMs: 2000 };
    const opts: RunOptions = input === undefined ? { stdin: "null", ...stop } : { input, ...stop };
    return replyOf(await executor.exec(callOf(helper, transport, command, options.root, args), opts));
  };

  const carried: Transport = { kind: "carried" };
  const probed = await call(carried, "probe", [options.create === true ? "create" : "keep"]);
  switch (probed.kind) {
    case "done":
      break;
    case "no-root":
      return err(`${options.root} is not a folder on the host (pass create to make it)`);
    case "failed":
    case "lost":
      return err(probed.detail);
    default:
      return err(`the host did not answer the probe: ${probed.kind}`);
  }
  const facts = hostFactsOf(probed.stdout);
  if (facts.kind === "err") return err(facts.error);
  if (facts.value.hash === "none") return err("the host has none of sha256sum, shasum, openssl or sha256: a revision cannot be made there");

  let transport: Transport = carried;
  if (options.install !== false) {
    const kept = await call(carried, "install", [helper.sha256, options.stateDir ?? "default"], encoder.encode(helper.text));
    if (kept.kind === "bad-hash") return err(`the helper on the host is not the one this library pins (it hashes to ${kept.got})`);
    if (kept.kind === "done") {
      const path = textOf(kept.stdout).trim();
      if (path.startsWith("/")) {
        const there: Transport = { kind: "installed", path };
        const again = await call(there, "probe", ["keep"]);
        if (again.kind === "done") transport = there;
      }
    }
  }

  const place: Place = { kind: "ssh", host: options.place.host, ...(options.place.port === undefined ? {} : { port: options.place.port }), ...(options.place.user === undefined ? {} : { user: options.place.user }), path: options.root };
  const run = (command: Command, args: readonly string[], input?: Uint8Array): Promise<Reply> => call(transport, command, args, input);

  /** A path that may be used here, or the refusal. */
  const usable = (p: Path): Problem | undefined => {
    if (!portable) return undefined;
    const findings = portabilityFindings(p);
    return findings.length === 0 ? undefined : refused("unportable-path", findings.join("; "), p);
  };

  async function written(path: Path, reply: Reply, sent: Revision, expect: Expect): Promise<Result<{ rev: Revision; created: boolean }, Problem>> {
    if (reply.kind !== "done") return err(problemOf(reply, { path, expect }));
    const w = writtenOf(reply.stdout);
    if (w.kind === "err") return err(unavailable(w.error, false, path));
    if (w.value.rev !== sent) return err(tampered(path, "the host holds bytes that are not the ones sent"));
    return ok(w.value);
  }

  const handle: Handler = async (op: Op) => {
    switch (op.op) {
      case "read": {
        const bad = usable(op.path);
        if (bad !== undefined) return err(bad);
        const r = await run("read", [op.path, String(maxBytes)]);
        if (r.kind !== "done") return err(problemOf(r, { path: op.path }));
        return ok({ op: "read", value: { bytes: r.stdout, rev: await revisionOf(r.stdout) } });
      }
      case "stat": {
        const bad = usable(op.path);
        if (bad !== undefined) return err(bad);
        const r = await run("stat", [op.path]);
        if (r.kind !== "done") return err(problemOf(r, { path: op.path }));
        const f = factsOf(textOf(r.stdout).replace(/\n$/, "").split("\t"));
        if (f.kind === "err") return err(unavailable(f.error, false, op.path));
        const value: Stat = { path: op.path, size: f.value.size, rev: f.value.rev, ...(f.value.modified === undefined ? {} : { modified: f.value.modified }) };
        return ok({ op: "stat", value });
      }
      case "write": {
        const bad = usable(op.path);
        if (bad !== undefined) return err(bad);
        if (op.bytes.length > maxBytes) return err(refused("too-large", `${op.bytes.length} bytes are more than the ${maxBytes} this store takes`, op.path));
        const word = expectWord(op.expect, op.path);
        if (word.kind === "err") return word;
        const sent = await revisionOf(op.bytes);
        const done = await written(op.path, await run("write", [op.path, word.value, String(maxBytes)], op.bytes), sent, op.expect);
        return done.kind === "err" ? done : ok({ op: "write", value: done.value });
      }
      case "delete": {
        const bad = usable(op.path);
        if (bad !== undefined) return err(bad);
        const word = expectWord(op.expect, op.path);
        if (word.kind === "err") return word;
        const r = await run("delete", [op.path, word.value]);
        if (r.kind !== "done") return err(problemOf(r, { path: op.path, expect: op.expect }));
        return ok({ op: "delete", value: { existed: textOf(r.stdout).trim() === "existed" } });
      }
      case "rename": {
        for (const p of [op.from, op.to]) {
          const bad = usable(p);
          if (bad !== undefined) return err(bad);
        }
        const word = expectWord(op.expect, op.from);
        if (word.kind === "err") return word;
        const r = await run("rename", [op.from, op.to, word.value]);
        if (r.kind !== "done") return err(problemOf(r, { path: op.from, to: op.to, expect: op.expect }));
        const m = /^moved (sha256:[0-9a-f]{64})\s*$/.exec(textOf(r.stdout));
        if (m === null) return err(unavailable(`the helper said ${JSON.stringify(textOf(r.stdout).slice(0, 80))} to a rename`, false, op.from));
        return ok({ op: "rename", value: { rev: (m[1] ?? "") as Revision, created: true } });
      }
      case "list": {
        const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
        const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
        const r = await run("list", [op.prefix]);
        if (r.kind !== "done") return err(problemOf(r, {}));
        const found: Path[] = [];
        for (const line of linesOf(r.stdout)) {
          const p = parsePath(line);
          if (p.kind !== "ok" || p.value !== line) continue;
          if (portable && portabilityFindings(p.value).length > 0) continue;
          if (op.prefix !== "" && !isUnder(op.prefix as Prefix, p.value)) continue;
          found.push(p.value);
        }
        found.sort(comparePaths);
        const rest = after === undefined ? found : found.filter((p) => comparePaths(p, after) > 0);
        const page = rest.slice(0, limit);
        const entries: Stat[] = [];
        if (page.length > 0) {
          const s = await run("statmany", [], encoder.encode(`${page.join("\n")}\n`));
          if (s.kind !== "done") return err(problemOf(s, {}));
          const facts = new Map<string, Stat>();
          for (const line of linesOf(s.stdout)) {
            const [path, ...fields] = line.split("\t");
            const f = factsOf(fields);
            if (path === undefined || f.kind === "err") continue;
            const p = parsePath(path);
            if (p.kind === "ok") facts.set(p.value, { path: p.value, size: f.value.size, rev: f.value.rev, ...(f.value.modified === undefined ? {} : { modified: f.value.modified }) });
          }
          for (const p of page) {
            const e = facts.get(p);
            if (e !== undefined) entries.push(e);
          }
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
        return err(refused("capability-absent", `the store on a host does not have ${op.op}`));
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };

  return ok({
    store: makeStore({
      id: formatPlace(place),
      place,
      consistency: "strong",
      traits: { caseSensitive: facts.value.caseSensitive ?? true, maxObject: maxBytes },
      capabilities: SSH_CAPABILITIES,
      handle,
    }),
    transport,
    facts: facts.value,
  });
}
