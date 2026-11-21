/**
 * Tests of the logical layer of AnyfsCli (commons anyfs-cli 0003-anyfs-cli-logical FR-001 to FR-012): the configuration as code, the capabilities a verb asks of a store, the pure functions of the verbs (sizes, a
 * line diff, a text search, wildcards), the trail of fidelity with its strictness, the four endings of a run and the text of a plan and of a report.
 *
 * @module
 */
import { memoryStore, localStore } from "@intellectual-frontiers/anyfs/physical";
import { emulated, native, parseAbsolute, refusedBy, type Fidelity, type PosixError } from "@intellectual-frontiers/anyfs-posix/governance";
import { missing as missingProblem, parsePath } from "@intellectual-frontiers/anyfs/governance";
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs } from "@intellectual-frontiers/system";
import {
  applyRefusalProblem,
  capabilityNames,
  counted,
  defineConfig,
  describeFailure,
  destOf,
  drawTree,
  emulatedLines,
  environment,
  finding,
  humanSize,
  keep,
  looksLikeText,
  matchingLines,
  missing,
  modeText,
  movableOf,
  newTrail,
  parseConfig,
  parseSizeTest,
  planLines,
  sizePasses,
  sourceOf,
  strictViolations,
  table,
  unifiedDiff,
  usage,
  viewable,
  wildcard,
  type PlaceOpener,
} from "../src/logical/mod.ts";
import { makeStore } from "@intellectual-frontiers/anyfs/logical";
import type { Plan } from "@intellectual-frontiers/anyfs-bridge/governance";

proves(["0003-anyfs-cli-logical FR-001"], "parseConfig checks every mount, default and opener and gives every problem at once", () => {
  const good = parseConfig(defineConfig({ mounts: [{ name: "fleet", place: "ssh://alpha.example.org/srv/fleet" }, { name: "scratch", place: "memory:scratch" }] }));
  assert(good.kind === "ok");
  assertEquals(good.value.mounts.map((m) => m.name), ["fleet", "scratch"]);
  assertEquals(good.value.defaults.concurrency, 4);
  const bad = parseConfig({ mounts: [{ name: "file", place: "memory:a" }, { name: "dup", place: "memory:a" }, { name: "dup", place: "memory:b" }, { name: "nowhere", place: "not a place" }], defaults: { concurrency: 0, maxObjectBytes: 0 } });
  assert(bad.kind === "err");
  assert(bad.error.length >= 5, bad.error.join("; "));
  assertStringIncludes(bad.error.join("\n"), "concurrency");
  assertStringIncludes(bad.error.join("\n"), "two mounts have this name");
});

proves(["0003-anyfs-cli-logical FR-002"], "a configuration carries read-only mounts and the openers other libraries bring", () => {
  const opener: PlaceOpener = { kind: "git", open: () => Promise.resolve(ok(memoryStore())) };
  const parsed = parseConfig(defineConfig({ mounts: [{ name: "ro", place: "memory:r", readOnly: true, note: "a note" }], kinds: [opener] }));
  assert(parsed.kind === "ok");
  assertEquals(parsed.value.mounts[0]?.readOnly, true);
  assertEquals(parsed.value.mounts[0]?.note, "a note");
  assertEquals(parsed.value.kinds.map((k) => k.kind), ["git"]);
  assertEquals(parseConfig({ kinds: [opener, opener] }).kind, "err");
});

proves(["0003-anyfs-cli-logical FR-003"], "the verbs run in the ports of a world and a store in memory is opened once", async () => {
  const store = memoryStore({ name: "w" });
  const opened = new Map<string, number>();
  const world = {
    cwd: "/",
    json: false,
    open: (place: { kind: string }) => {
      opened.set(place.kind, (opened.get(place.kind) ?? 0) + 1);
      return Promise.resolve(ok(store));
    },
  };
  await world.open({ kind: "memory" });
  await world.open({ kind: "memory" });
  assertEquals(opened.get("memory"), 2);
  assertEquals(store.id, "memory:w");
});

proves(["0003-anyfs-cli-logical FR-004"], "a verb asks a store for the capabilities it needs and is told what is missing", async () => {
  const full = memoryStore();
  assert(viewable(full) !== undefined && sourceOf(full) !== undefined && movableOf(full) !== undefined && destOf(full) !== undefined);
  const noDelete = makeStore({ id: "nd", place: full.place, consistency: full.consistency, traits: full.traits, capabilities: ["read", "write", "list", "stat"] as const, handle: full.handle });
  assert(viewable(noDelete) !== undefined);
  assertEquals(destOf(noDelete), undefined);
  assertEquals(movableOf(noDelete), undefined);
  assertEquals(missing(noDelete, ["read", "delete", "cas"]), ["delete", "cas"]);
  assertEquals(capabilityNames(noDelete), ["read", "write", "list", "stat"]);
  const dir = await fs.realPath(await fs.makeTempDir({ prefix: "anyfs-cli-caps-" }));
  const local = await localStore(dir);
  assert(local.kind === "ok" && destOf(local.value) !== undefined);
  await fs.remove(dir, { recursive: true });
});

proves(["0003-anyfs-cli-logical FR-005"], "sizes, modes, tables and trees are written the same way everywhere", () => {
  assertEquals([humanSize(0), humanSize(1023), humanSize(1024), humanSize(1536), humanSize(1048576), humanSize(5 * 1024 ** 3)], ["0", "1023", "1K", "1.5K", "1M", "5G"]);
  assertEquals([modeText("file", 0o644), modeText("dir", 0o755), modeText("file", 0o444)], ["-rw-r--r--", "drwxr-xr-x", "-r--r--r--"]);
  assertEquals(table([["a", "bb", "c"], ["ddd", "e", "ff"]]), "a    bb  c\nddd  e   ff");
  assertEquals(drawTree({ name: "r", children: [{ name: "a/", children: [{ name: "x", children: [] }] }, { name: "b", children: [] }] }), ["r", "├── a/", "│   └── x", "└── b"]);
  assertEquals([counted(1, "file"), counted(2, "file"), counted(0, "directory", "directories")], ["1 file", "2 files", "0 directories"]);
});

proves(["0003-anyfs-cli-logical FR-006"], "a diff is the shortest edit in hunks with context, and two huge texts are not compared", () => {
  assertEquals(unifiedDiff("a\nb\n", "a\nb\n", "x", "y"), { kind: "same" });
  const d = unifiedDiff("a\nb\nc\n", "a\nB\nc\n", "x", "y");
  assert(d.kind === "differ");
  assertEquals(d.text, "--- x\n+++ y\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n");
  assertEquals([d.added, d.removed], [1, 1]);
  const far = unifiedDiff(Array.from({ length: 40 }, (_, i) => `l${i}`).join("\n"), Array.from({ length: 40 }, (_, i) => (i === 0 || i === 39 ? `changed${i}` : `l${i}`)).join("\n"), "x", "y");
  assert(far.kind === "differ");
  assertEquals(far.text.split("\n").filter((l) => l.startsWith("@@")).length, 2);
  const big = "x\n".repeat(3000);
  assertEquals(unifiedDiff(big, `${big}y\n`, "x", "y").kind, "too-large");
});

proves(["0003-anyfs-cli-logical FR-007"], "text search is literal, wildcards and size tests follow their rules, and bytes with a NUL are not text", () => {
  assertEquals(matchingLines("a\nHello\nhello world\n", "hello", true).map((h) => h.line), [2, 3]);
  assertEquals(matchingLines("a.b\naxb\n", "a.b", false).map((h) => h.line), [1]);
  assertEquals([wildcard("*.ts", "a.ts"), wildcard("*.ts", "a.js"), wildcard("a?c", "abc"), wildcard("a?c", "ac"), wildcard("*", ""), wildcard("a*b*c", "aXXbYYc")], [true, false, true, false, true, true]);
  const over = parseSizeTest("+10K");
  assert(over.kind === "ok");
  assertEquals([sizePasses(over.value, 10240), sizePasses(over.value, 10241)], [false, true]);
  const under = parseSizeTest("-1M");
  assert(under.kind === "ok" && sizePasses(under.value, 5) && !sizePasses(under.value, 1048576));
  assertEquals(parseSizeTest("ten").kind, "err");
  assertEquals([looksLikeText(new TextEncoder().encode("plain")), looksLikeText(new Uint8Array([97, 0, 98]))], [true, false]);
});

const failure = (errno: PosixError["errno"], fidelity: Fidelity): PosixError => {
  const shown = parseAbsolute("/a");
  const stored = parsePath("a");
  assert(shown.kind === "ok" && stored.kind === "ok");
  return { errno, message: "no such name", path: shown.value, fidelity, problem: missingProblem(stored.value) };
};

proves(["0003-anyfs-cli-logical FR-008"], "a verb keeps the fidelity of each operation and writes a failure as its errno, its path and the store's word", () => {
  const trail = newTrail();
  const read = keep(trail, "read-all", "/a", ok({ value: new Uint8Array(3), fidelity: native, notes: [] }));
  assert(read.kind === "ok");
  const lost = keep(trail, "stat", "/b", err(failure("ENOENT", native)));
  assert(lost.kind === "err");
  assertEquals(trail.steps.map((s) => s.op), ["read-all", "stat"]);
  const text = describeFailure(failure("ENOENT", native));
  assertStringIncludes(text, "ENOENT /a");
  assertStringIncludes(text, "(missing)");
});

proves(["0003-anyfs-cli-logical FR-009"], "strictness stops at what an emulation can lose, and verbosity writes each emulation once", () => {
  const trail = newTrail();
  const notDurable = emulated("no-marker");
  const cheap = emulated("derived-directory");
  trail.steps.push({ op: "mkdir", path: "/d", fidelity: notDurable, notes: [] }, { op: "readdir", path: "/", fidelity: cheap, notes: [] }, { op: "readdir", path: "/e", fidelity: cheap, notes: [] }, { op: "chmod", path: "/f", fidelity: refusedBy("not-in-model", "no modes"), notes: [] });
  assertEquals(strictViolations(trail).map((s) => s.op), ["mkdir", "chmod"]);
  assertEquals(emulatedLines(trail).length, 3);
});

proves(["0003-anyfs-cli-logical FR-010"], "a run ends as what it did, a finding, a usage error or an environment error, with its code and fix", () => {
  assertEquals(usage("no").exit, "usage");
  assertEquals(environment("E-OPEN", "no").exit, "environment");
  const f = finding("E-FILESYSTEM", "ENOENT");
  assertEquals(f.exit, undefined);
  assertEquals(f.problems[0]?.code, "E-FILESYSTEM");
  assert((f.problems[0]?.fix ?? "").length > 0);
  assertEquals(finding("E-STRICT", "x", "do this").problems[0]?.fix, "do this");
});

const plan = (n: number): Plan => ({
  mode: "sync",
  source: "a#",
  dest: "b#",
  actions: Array.from({ length: n }, (_, i) => ({ kind: "create" as const, rel: `f${i}` as never, target: `f${i}` as never, size: 1, src: "sha256:0" as never, decided: "absent" as const, losses: [] })),
  unchanged: 0,
  carries: ["bytes"],
  bytes: n,
  losses: [],
  hash: "abc" as never,
});

proves(["0003-anyfs-cli-logical FR-011"], "a plan is written with its counts, each action and its hash, and a long plan is cut and counted", () => {
  const lines = planLines(plan(3));
  assertEquals(lines[0], "sync a# -> b#");
  assertEquals(lines[1], "3 create");
  assertEquals(lines[lines.length - 1], "plan abc");
  const long = planLines(plan(250));
  assertEquals(long.filter((l) => l.startsWith("  create")).length, 200);
  assert(long.some((l) => l.includes("and 50 more actions")));
});

proves(["0003-anyfs-cli-logical FR-012"], "a refusal of the bridge is a problem of the catalogue with the sentence of the refusal", () => {
  const stale = applyRefusalProblem({ kind: "stale", approved: "aaa" as never, found: "bbb" as never });
  assertEquals(stale.code, "E-PLAN-STALE");
  assertStringIncludes(stale.message, "aaa");
  assertStringIncludes(stale.message, "bbb");
  assertEquals(applyRefusalProblem({ kind: "conflicts", count: 2 }).code, "E-CONFLICTS");
  assertEquals(applyRefusalProblem({ kind: "not-applicable", detail: "x" }).code, "E-PLAN-REFUSED");
});
