// Spec: 0003-anyfs-logical FR-004, FR-005
/**
 * The paths of an operation and of what it ended with, changed by a function. `sub` and a mount are the same thing seen from two sides: one adds a prefix to the paths a program names and takes it off what comes
 * back, the other takes it off and puts it back. Both are written once, here, over every operation, so that none of them forgets a path (a rename has two, a batch has many, a list answers with many).
 *
 * @module
 */
import { ok, type Result } from "@intellectual-frontiers/core";
import type { Path, Prefix, Problem } from "@intellectual-frontiers/anyfs/governance";
import type { Change, ChangeResult, Done, Op } from "./ops.ts";

/** How the paths of one side become the paths of the other: of a path, and of a prefix. */
export type PathMap = { readonly path: (path: Path) => Result<Path, Problem>; readonly prefix: (prefix: Prefix) => Result<Prefix, Problem> };

/** A closed union has no other case. */
const never = (x: never): never => {
  throw new Error(`a case that cannot be: ${JSON.stringify(x)}`);
};

function changeOf(map: PathMap, change: Change): Result<Change, Problem> {
  const path = map.path(change.path);
  if (path.kind === "err") return path;
  return ok(change.kind === "put" ? { kind: "put", path: path.value, bytes: change.bytes, expect: change.expect } : { kind: "delete", path: path.value, expect: change.expect });
}

/** An operation with its paths changed, or the problem of the first path that cannot be. */
export function mapOp(map: PathMap, op: Op): Result<Op, Problem> {
  switch (op.op) {
    case "read":
    case "stat":
    case "history":
    case "rangeRead":
    case "write":
    case "delete":
    case "append": {
      const p = map.path(op.path);
      return p.kind === "err" ? p : ok({ ...op, path: p.value });
    }
    case "rename": {
      const from = map.path(op.from);
      if (from.kind === "err") return from;
      const to = map.path(op.to);
      return to.kind === "err" ? to : ok({ ...op, from: from.value, to: to.value });
    }
    case "batch": {
      const changes: Change[] = [];
      for (const c of op.changes) {
        const m = changeOf(map, c);
        if (m.kind === "err") return m;
        changes.push(m.value);
      }
      return ok({ op: "batch", changes });
    }
    case "merge":
      return ok(op);
    case "list":
    case "search": {
      const p = map.prefix(op.prefix);
      return p.kind === "err" ? p : ok({ ...op, prefix: p.value });
    }
    default:
      return never(op);
  }
}

function changeResultOf(map: PathMap, c: ChangeResult): Result<ChangeResult, Problem> {
  const p = map.path(c.path);
  if (p.kind === "err") return p;
  return ok(c.kind === "put" ? { kind: "put", path: p.value, rev: c.rev, created: c.created } : { kind: "delete", path: p.value, existed: c.existed });
}

/** What an operation ended with, with its paths changed. */
export function mapDone(map: PathMap, done: Done): Result<Done, Problem> {
  switch (done.op) {
    case "stat": {
      const p = map.path(done.value.path);
      return p.kind === "err" ? p : ok({ op: "stat", value: { ...done.value, path: p.value } });
    }
    case "list": {
      const entries = [];
      for (const e of done.value.entries) {
        const p = map.path(e.path);
        if (p.kind === "err") return p;
        entries.push({ ...e, path: p.value });
      }
      return ok({ op: "list", value: { ...done.value, entries } });
    }
    case "search": {
      const hits = [];
      for (const h of done.value.hits) {
        const p = map.path(h.path);
        if (p.kind === "err") return p;
        hits.push({ ...h, path: p.value });
      }
      return ok({ op: "search", value: { hits } });
    }
    case "batch": {
      const results: ChangeResult[] = [];
      for (const r of done.value.results) {
        const m = changeResultOf(map, r);
        if (m.kind === "err") return m;
        results.push(m.value);
      }
      return ok({ op: "batch", value: { results } });
    }
    case "read":
    case "write":
    case "delete":
    case "rename":
    case "history":
    case "rangeRead":
    case "append":
    case "merge":
      return ok(done);
    default:
      return never(done);
  }
}

/** A problem with the path it names changed, by a function that cannot fail (a path that cannot be changed stays as it is). */
export function mapProblem(change: (path: Path) => Path, problem: Problem): Problem {
  switch (problem.kind) {
    case "missing":
    case "conflict":
    case "tampered":
      return { ...problem, path: change(problem.path) };
    case "refused":
    case "unavailable":
      return problem.path === undefined ? problem : { ...problem, path: change(problem.path) };
    default:
      return never(problem);
  }
}
