/**
 * Tests of the governance layer of AnyFS POSIX (commons anyfs-posix 0002-anyfs-posix-governance FR-001 to FR-007): the codes, the fidelity of an operation and when it is a violation, the paths of POSIX and
 * their resolution, the policy and its smart constructors, the operations by their cases and the modes of opening.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  ancestorsOf,
  baseName,
  defaultPolicy,
  describeErrno,
  describeFidelity,
  DEFAULT_OWNERSHIP,
  EMULATION_FACTS,
  EMULATIONS,
  emulated,
  ERRNO_NUMBER,
  ERRNO_SUMMARY,
  ERRNOS,
  isBelow,
  isErrno,
  isPlanOp,
  isStrictViolation,
  joinPosix,
  keepMarkers,
  native,
  OP_SUMMARY,
  OPEN_MODES,
  openFlags,
  parseAbsolute,
  parseMarkerName,
  parseOwnership,
  parentPosix,
  PLAN_OPS,
  posixOf,
  prefixOf,
  REFUSALS_OF_POSIX,
  refusedBy,
  resolvePosix,
  RISKS,
  ROOT_PATH,
  storePathOf,
  STRICT_RISKS,
  withPolicy,
  worse,
  type PosixPath,
} from "../src/governance/mod.ts";
import { parsePath } from "@intellectual-frontiers/anyfs/governance";

const path = (text: string): PosixPath => {
  const r = resolvePosix(ROOT_PATH, text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0002-anyfs-posix-governance FR-001"], "the codes are the closed union of fifteen, each with the number Linux gives it and a sentence", () => {
  assertEquals(ERRNOS.length, 15);
  assertEquals(Object.keys(ERRNO_NUMBER).sort(), [...ERRNOS].sort());
  assertEquals(Object.keys(ERRNO_SUMMARY).sort(), [...ERRNOS].sort());
  assertEquals([ERRNO_NUMBER.ENOENT, ERRNO_NUMBER.EEXIST, ERRNO_NUMBER.ENOTEMPTY, ERRNO_NUMBER.ESTALE], [2, 17, 39, 116]);
  assertEquals(new Set(Object.values(ERRNO_NUMBER)).size, 15, "no two codes share a number");
  assert(isErrno("ESTALE") && !isErrno("EAGAIN"));
  assertEquals(describeErrno("ESTALE"), "the object changed since it was read");
});

proves(["0002-anyfs-posix-governance FR-002"], "a fidelity is native, emulated with the risk of its reason, or refused with a reason, and says so in a line", () => {
  assertEquals(EMULATIONS.length, 10);
  assertEquals(Object.keys(EMULATION_FACTS).sort(), [...EMULATIONS].sort());
  for (const reason of EMULATIONS) {
    const f = emulated(reason);
    assert(f.kind === "emulated");
    assertEquals(f.risk, EMULATION_FACTS[reason].risk);
    assert((RISKS as readonly string[]).includes(f.risk));
    assertStringIncludes(describeFidelity(f), reason);
  }
  assertEquals(REFUSALS_OF_POSIX, ["not-in-model", "capability-absent", "read-only"]);
  const refused = refusedBy("read-only", "the store cannot be written");
  assertStringIncludes(describeFidelity(refused), "refused (read-only)");
  assertEquals(describeFidelity(native), "native");
  const own = emulated("no-marker", "a sentence of this case");
  assert(own.kind === "emulated" && own.detail === "a sentence of this case");
});

proves(["0002-anyfs-posix-governance FR-003"], "a violation of strictness is a refusal or an emulation that loses or changes something, and fidelities are ranked", () => {
  assertEquals([...STRICT_RISKS], ["lossy", "non-atomic", "unguarded", "not-durable"]);
  for (const reason of EMULATIONS) assertEquals(isStrictViolation(emulated(reason)), STRICT_RISKS.includes(EMULATION_FACTS[reason].risk), reason);
  assert(!isStrictViolation(native) && isStrictViolation(refusedBy("not-in-model", "x")));
  assert(isStrictViolation(emulated("copy-then-delete")) && !isStrictViolation(emulated("derived-directory")) && !isStrictViolation(emulated("write-back-buffer")));
  const all = [native, ...EMULATIONS.map((r) => emulated(r)), refusedBy("read-only", "x")];
  for (const a of all) for (const b of all) assert(worse(a, b) === a || worse(a, b) === b);
  assertEquals(worse(native, emulated("derived-directory")), emulated("derived-directory"));
  assertEquals(worse(emulated("copy-then-delete"), emulated("write-back-buffer")), emulated("copy-then-delete"));
  assertEquals(worse(emulated("no-marker"), refusedBy("read-only", "x")), refusedBy("read-only", "x"));
});

proves(["0002-anyfs-posix-governance FR-004"], "a path is resolved by its text: dots, repeated slashes, the root as the top, and what is refused", () => {
  assertEquals(path("a//b/./c/../d"), "/a/b/d");
  assertEquals(path("/../../x"), "/x");
  assertEquals(path("/"), ROOT_PATH);
  const cwd = path("/a/b");
  const rel = resolvePosix(cwd, "../c");
  assert(rel.kind === "ok" && rel.value === "/a/c");
  const above = resolvePosix(cwd, "../../../../z");
  assert(above.kind === "ok" && above.value === "/z", "`..` stops at the root");
  for (const bad of ["", "a\\b", "a\u0000b", "a\u0001", "\ud800"]) assertEquals(resolvePosix(ROOT_PATH, bad).kind, "err", JSON.stringify(bad));
  assertEquals(parseAbsolute("a/b").kind, "err");
  assertEquals(parseAbsolute("/a/b").kind, "ok");
  const composed = resolvePosix(ROOT_PATH, "/é");
  const decomposed = resolvePosix(ROOT_PATH, "/é");
  assert(composed.kind === "ok" && decomposed.kind === "ok" && composed.value === decomposed.value, "two spellings are one path");
  const root = storePathOf(ROOT_PATH);
  assert(root.kind === "ok" && root.value === undefined, "the root has no key");
  const key = storePathOf(path("/a/b"));
  assert(key.kind === "ok" && key.value === "a/b");
  const long = resolvePosix(ROOT_PATH, `/${"x".repeat(300)}`);
  assert(long.kind === "ok" && storePathOf(long.value).kind === "err", "a segment of more than 255 bytes is the store's refusal");
  const prefix = prefixOf(ROOT_PATH);
  assert(prefix.kind === "ok" && prefix.value === "");
  const key2 = parsePath("a/b");
  assert(key2.kind === "ok");
  assertEquals(posixOf(key2.value), "/a/b");
  assertEquals([parentPosix(path("/a/b/c")), parentPosix(path("/a")), parentPosix(ROOT_PATH)], [path("/a/b"), ROOT_PATH, ROOT_PATH]);
  assertEquals([baseName(path("/a/b")), baseName(ROOT_PATH)], ["b", undefined]);
  assertEquals(joinPosix(path("/a"), "b"), "/a/b");
  assertEquals(ancestorsOf(path("/a/b/c")), [path("/a"), path("/a/b")]);
  assertEquals(ancestorsOf(path("/a")), []);
  assert(isBelow(ROOT_PATH, path("/a")) && isBelow(path("/a"), path("/a/b")) && !isBelow(path("/a"), path("/a")) && !isBelow(path("/a"), path("/ab")));
});

proves(["0002-anyfs-posix-governance FR-004"], "resolution never gives a path with a dot, an empty segment or a trailing slash, and resolving a result gives it back", () => {
  const segment = fc.constantFrom("a", "b", "..", ".", "", "c.txt", "é");
  fc.assert(
    fc.property(fc.array(segment, { maxLength: 8 }), fc.array(segment, { maxLength: 8 }), (base, rest) => {
      const cwd = resolvePosix(ROOT_PATH, `/${base.join("/")}`);
      if (cwd.kind !== "ok") return true;
      const text = rest.join("/");
      if (text === "") return true;
      const r = resolvePosix(cwd.value, text);
      if (r.kind !== "ok") return true;
      const again = resolvePosix(ROOT_PATH, r.value);
      const segs = r.value === "/" ? [] : r.value.slice(1).split("/");
      return again.kind === "ok" && again.value === r.value && r.value.startsWith("/") && !segs.includes("") && !segs.includes(".") && !segs.includes("..") && (r.value === "/" || !r.value.endsWith("/"));
    }),
    { numRuns: 400 },
  );
});

proves(["0002-anyfs-posix-governance FR-005"], "the policy has its defaults and its smart constructors refuse what is out of range", () => {
  const p = defaultPolicy();
  assertEquals([p.markers.kind, p.ancestors, p.readCacheBytes, p.listPage, p.appendAttempts], ["none", "check", 8 * 1024 * 1024, 1000, 5]);
  assertEquals(p.ownership, DEFAULT_OWNERSHIP);
  const keep = keepMarkers(".keep");
  assert(keep.kind === "ok" && keep.value.kind === "keep");
  for (const bad of ["a/b", "", ".", "..", "x\u0000"]) assertEquals(keepMarkers(bad).kind, "err", JSON.stringify(bad));
  assertEquals(parseMarkerName("m").kind, "ok");
  assertEquals(parseOwnership(1000, 1000, 0o640, 0o750).kind, "ok");
  for (const [uid, gid, fileMode, dirMode] of [[-1, 0, 0o644, 0o755], [0, 1.5, 0o644, 0o755], [0, 0, 0o10000, 0o755], [0, 0, 0o644, -1]] as const) assertEquals(parseOwnership(uid, gid, fileMode, dirMode).kind, "err", JSON.stringify([uid, gid, fileMode, dirMode]));
  assertEquals(withPolicy(p, { listPage: 10 }).kind, "ok");
  for (const changes of [{ listPage: 0 }, { appendAttempts: 0 }, { readCacheBytes: -1 }, { readCacheBytes: 1.5 }]) assertEquals(withPolicy(p, changes).kind, "err", JSON.stringify(changes));
  const next = withPolicy(p, { appendAttempts: 2 });
  assert(next.kind === "ok" && next.value.appendAttempts === 2 && next.value.listPage === 1000);
});

proves(["0002-anyfs-posix-governance FR-006"], "the operations are the closed list of twenty-seven, each with a sentence", () => {
  assertEquals(PLAN_OPS.length, 27);
  assertEquals(Object.keys(OP_SUMMARY).sort(), [...PLAN_OPS].sort());
  assert(isPlanOp("rename-over") && !isPlanOp("rename"));
  for (const op of PLAN_OPS) assert(OP_SUMMARY[op].length > 10, op);
});

proves(["0002-anyfs-posix-governance FR-007"], "the modes of opening are seven, with the flags a file system gives them", () => {
  assertEquals([...OPEN_MODES], ["r", "r+", "w", "w+", "wx", "a", "a+"]);
  assertEquals(openFlags("r"), { read: true, write: false, create: false, exclusive: false, truncate: false, append: false });
  assertEquals(openFlags("w+"), { read: true, write: true, create: true, exclusive: false, truncate: true, append: false });
  assertEquals(openFlags("wx").exclusive, true);
  assertEquals(openFlags("a+"), { read: true, write: true, create: true, exclusive: false, truncate: false, append: true });
  for (const m of OPEN_MODES) assert(openFlags(m).read || openFlags(m).write, m);
});
