/**
 * Tests of the logical layer of AnyFS POSIX (commons anyfs-posix 0003-anyfs-posix-logical FR-001 to FR-007): the plan of each operation for the capabilities of a store (the table, as a snapshot), the table from a
 * problem to a code, the mode of a name, the directories derived from a list, the table of handles and the contract of the view.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { conflict, type Capability, type Problem, missing, parsePath, refused, REFUSALS, tampered, unavailable, expectAbsent, expectAny, parseRevision, type Path, parsePrefix, type Revision } from "@intellectual-frontiers/anyfs/governance";
import type { Stat } from "@intellectual-frontiers/anyfs/logical";
import { childrenOf, concat, errnoOf, type Facts, isMarker, modeOf, newHandleTable, plan, plans, resize, writeAt } from "../src/logical/mod.ts";
import { defaultPolicy, DEFAULT_OWNERSHIP, ERRNOS, keepMarkers, openFlags, type PlanOp, PLAN_OPS, type Policy, ROOT_PATH } from "../src/governance/mod.ts";

const CORE: readonly Capability[] = ["read", "write", "list", "stat", "delete"];
const facts = (caps: readonly Capability[], policy: Policy = defaultPolicy()): Facts => ({ capabilities: new Set(caps), policy });
const label = (f: ReturnType<typeof plan>["fidelity"]): string => (f.kind === "native" ? "native" : f.kind === "emulated" ? `emulated:${f.reason}` : `refused:${f.reason}`);
const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0003-anyfs-posix-logical FR-001"], "a plan is total over the operations and the same facts give the same plan", () => {
  for (const caps of [CORE, [...CORE, "cas", "rename", "batch"] as const, ["read", "list", "stat"] as const]) {
    const all = plans(facts(caps));
    assertEquals(all.map((x) => x.op), [...PLAN_OPS]);
    assertEquals(plans(facts(caps)), all);
    for (const x of all) assert(x.summary.length > 5 && Array.isArray(x.steps));
  }
});

proves(["0003-anyfs-posix-logical FR-002"], "the table of fidelity for each operation, for a store of the core capabilities, a store with cas, rename and batch, and a store that cannot be written", () => {
  const core = Object.fromEntries(plans(facts(CORE)).map((x) => [x.op, label(x.fidelity)]));
  assertEquals(core, {
    "stat-file": "native",
    "stat-dir": "emulated:derived-directory",
    readdir: "emulated:derived-directory",
    mkdir: "emulated:no-marker",
    rmdir: "emulated:derived-directory",
    unlink: "native",
    "rename-file": "emulated:copy-then-delete",
    "rename-over": "emulated:copy-then-delete",
    "rename-dir": "emulated:listing-walk",
    "read-all": "native",
    "read-range": "emulated:whole-object-range",
    "write-all": "native",
    "open-write": "emulated:write-back-buffer",
    write: "emulated:write-back-buffer",
    fsync: "emulated:unguarded-write",
    close: "emulated:unguarded-write",
    truncate: "refused:capability-absent",
    append: "refused:capability-absent",
    touch: "emulated:touch-without-mtime",
    "rm-r": "emulated:listing-walk",
    chmod: "refused:not-in-model",
    chown: "refused:not-in-model",
    utimes: "refused:not-in-model",
    symlink: "refused:not-in-model",
    link: "refused:not-in-model",
    readlink: "refused:not-in-model",
    mmap: "refused:not-in-model",
  });
  const rich = Object.fromEntries(plans(facts([...CORE, "cas", "rename", "batch"])).map((x) => [x.op, label(x.fidelity)]));
  assertEquals(rich["rename-file"], "native");
  assertEquals(rich["rename-over"], "emulated:copy-then-delete");
  assertEquals([rich["fsync"], rich["close"], rich["truncate"], rich["append"]], ["emulated:write-back-buffer", "emulated:write-back-buffer", "emulated:read-modify-write", "emulated:read-modify-write"]);
  assertEquals(plan(facts([...CORE, "rename"]), "rename-file").steps, ["stat", "list", "rename"]);
  assertEquals(plan(facts([...CORE, "batch"]), "rm-r").steps, ["stat", "list", "batch"]);
  assertEquals(plan(facts(CORE), "rm-r").steps, ["stat", "list", "delete"]);
  const keep = keepMarkers(".m");
  assert(keep.kind === "ok");
  const kept = facts(CORE, { ...defaultPolicy(), markers: keep.value });
  assertEquals([label(plan(kept, "mkdir").fidelity), label(plan(kept, "rmdir").fidelity)], ["emulated:marker-object", "emulated:marker-object"]);
  const readOnly = Object.fromEntries(plans(facts(["read", "list", "stat"])).map((x) => [x.op, label(x.fidelity)]));
  for (const op of ["mkdir", "rmdir", "unlink", "rename-file", "rename-over", "rename-dir", "write-all", "open-write", "write", "fsync", "close", "truncate", "append", "touch", "rm-r"] as const) assertEquals(readOnly[op], "refused:read-only", op);
  for (const op of ["stat-file", "stat-dir", "readdir", "read-all", "read-range"] as const) assert(!readOnly[op]?.startsWith("refused"), op);
});

proves(["0003-anyfs-posix-logical FR-003"], "every problem has a code, the two meanings of a conflict are told apart, and every refusal has one", () => {
  const path1 = p("a");
  assertEquals(errnoOf(missing(path1), { op: "read-all" }), "ENOENT");
  assertEquals(errnoOf(conflict(path1, expectAbsent, { kind: "rev", rev: "sha256:1" as Revision }), { op: "write-all", creating: true }), "EEXIST");
  assertEquals(errnoOf(conflict(path1, expectAbsent, { kind: "rev", rev: "sha256:1" as Revision }), { op: "close" }), "ESTALE");
  assertEquals(errnoOf(conflict(path1, expectAny, { kind: "absent" }), { op: "close", creating: true }), "ESTALE");
  const by = (reason: (typeof REFUSALS)[number], op: PlanOp): string => errnoOf(refused(reason, "x"), { op });
  assertEquals(
    REFUSALS.map((r) => by(r, "write-all")),
    ["EROFS", "EACCES", "ENOTSUP", "ENOTSUP", "EFBIG", "EINVAL", "EACCES"],
  );
  assertEquals(by("outside-scope", "rename-dir"), "EXDEV");
  assertEquals(by("too-large", "read-all"), "ENAMETOOLONG");
  assertEquals(errnoOf(unavailable("down", true), { op: "read-all" }), "EIO");
  assertEquals(errnoOf(tampered(path1, "bad"), { op: "read-all" }), "EIO");
  const problems: Problem[] = [missing(path1), unavailable("x", false), tampered(path1, "x"), ...REFUSALS.map((r) => refused(r, "x"))];
  for (const problem of problems) for (const op of PLAN_OPS) assert((ERRNOS as readonly string[]).includes(errnoOf(problem, { op })));
});

proves(["0003-anyfs-posix-logical FR-004"], "a mode is the ownership's, without the bits of write where the store cannot be written", () => {
  assertEquals(modeOf("file", new Set(CORE), DEFAULT_OWNERSHIP), 0o644);
  assertEquals(modeOf("dir", new Set(CORE), DEFAULT_OWNERSHIP), 0o755);
  assertEquals(modeOf("file", new Set<Capability>(["read", "list", "stat"]), DEFAULT_OWNERSHIP), 0o444);
  assertEquals(modeOf("dir", new Set<Capability>(["read", "list", "stat"]), DEFAULT_OWNERSHIP), 0o555);
  assertEquals(modeOf("file", new Set(CORE), { ...DEFAULT_OWNERSHIP, fileMode: 0o600 }), 0o600);
});

const stat = (path: string, size = 1): Stat => ({ path: p(path), size, rev: parseRevision("sha256:ab").kind === "ok" ? ("sha256:ab" as Revision) : ("sha256:ab" as Revision) });
const prefix = (text: string) => {
  const r = parsePrefix(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0003-anyfs-posix-logical FR-005"], "a directory is derived from the objects below it: its names in order, a file and a directory told apart, a marker kept out and a clash noticed", () => {
  const policy = defaultPolicy();
  const r = childrenOf(prefix("d"), [stat("d/x/1"), stat("d/2", 22), stat("d/x/9"), stat("e")], policy);
  assertEquals(r.exists, true);
  assertEquals(r.entries.map((e) => `${e.name}:${e.type}`), ["2:file", "x:dir"]);
  assertEquals(r.entries[0]?.size, 22);
  assertEquals(childrenOf(prefix("d"), [], policy).exists, false);
  const root = childrenOf(prefix(""), [stat("b"), stat("a/c"), stat("é")], policy);
  assertEquals(root.entries.map((e) => e.name), ["a", "b", "é"]);
  const keep = keepMarkers(".m");
  assert(keep.kind === "ok");
  const kept: Policy = { ...policy, markers: keep.value };
  const withMarker = childrenOf(prefix("d"), [stat("d/.m", 0), stat("d/s/.m", 0)], kept);
  assertEquals([withMarker.exists, withMarker.entries.map((e) => `${e.name}:${e.type}`)], [true, ["s:dir"]]);
  assertEquals(childrenOf(prefix("d"), [stat("d/.m", 0)], kept).entries, []);
  assert(isMarker(kept, p("a/b/.m")) && isMarker(kept, p(".m")) && !isMarker(kept, p("a/b/m")) && !isMarker(policy, p(".m")));
  const clash = childrenOf(prefix("d"), [stat("d/x"), stat("d/x/y")], policy);
  assertEquals(clash.entries.map((e) => `${e.name}:${e.type}`), ["x:file"]);
  assertEquals(clash.notes.length, 1);
  assertStringIncludes(clash.notes[0] ?? "", "shown as a file");
  fc.assert(
    fc.property(fc.array(fc.constantFrom("a", "b", "c"), { minLength: 1, maxLength: 3 }), (parts) => {
      const objects = [stat(parts.join("/"))];
      const res = childrenOf(prefix(""), objects, policy);
      return res.exists && res.entries.length === 1 && res.entries[0]?.name === parts[0];
    }),
  );
});

proves(["0003-anyfs-posix-logical FR-006"], "the table of handles numbers from 3 and does not reuse a number, and the buffer functions pad with zeros", () => {
  const table = newHandleTable();
  const file = (path: string) => ({ path: path as never, storePath: p("a"), flags: openFlags("r"), base: { kind: "absent" as const }, bytes: new Uint8Array(), position: 0, dirty: false });
  const a = table.open(file("/a"));
  const b = table.open(file("/b"));
  assertEquals([a as number, b as number, table.size], [3, 4, 2]);
  table.release(a);
  const c = table.open(file("/c"));
  assertEquals([c as number, table.get(a), table.get(b)?.path, table.size], [5, undefined, "/b", 2]);
  assertEquals(Array.from(writeAt(new Uint8Array([1, 2]), 4, new Uint8Array([9]))), [1, 2, 0, 0, 9]);
  assertEquals(Array.from(writeAt(new Uint8Array([1, 2, 3]), 1, new Uint8Array([9]))), [1, 9, 3]);
  assertEquals(Array.from(resize(new Uint8Array([1, 2, 3]), 2)), [1, 2]);
  assertEquals(Array.from(resize(new Uint8Array([1]), 3)), [1, 0, 0]);
  assertEquals(Array.from(concat(new Uint8Array([1]), new Uint8Array([2, 3]))), [1, 2, 3]);
  assert(ROOT_PATH === "/");
});

proves(["0003-anyfs-posix-logical FR-007"], "the contract is one type whose operations all end in a result that carries a fidelity, and explain is the plan", async () => {
  const { posix } = await import("../src/physical/mod.ts");
  const { memoryStore } = await import("@intellectual-frontiers/anyfs/memory");
  const view = posix(memoryStore({ name: "contract" }));
  for (const op of PLAN_OPS) assertEquals(view.explain(op), plan({ capabilities: view.capabilities, policy: view.policy }, op));
  const results = [await view.stat("/x"), await view.readdir("/"), await view.readFile("/x"), await view.chmod("/x", 0), await view.mmap(3 as never)];
  for (const r of results) assert(r.kind === "ok" ? r.value.fidelity.kind !== undefined : r.error.fidelity.kind !== undefined);
});
