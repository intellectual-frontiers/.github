/**
 * Tests of the machine verbs: `machine query` and `machine check` over a backend that headless does not know, the query handed over byte for byte, the check ids
 * and the nearest named, the dispatch to targets, and that no unit of the library names data, grc or the ontology (commons headless 0006-machine-verbs FR-001 to FR-003).
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { problem } from "../src/governance/mod.ts";
import { type Context, machineVerbs, modelProblems, outcomeOf, placedCommands, programOf, target, validCheckId, type Outcome, type Target } from "../src/logical/mod.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { layerFindings } from "../tools/layers.ts";
import { world } from "./world.ts";
import { isOk } from "@intellectual-frontiers/core";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

/** A backend that records what it is given and answers with it. */
function backend(checks?: readonly string[]) {
  const calls: { kind: "query" | "check"; text: string; command: string }[] = [];
  return {
    calls,
    backend: {
      query: (q: string, ctx: Context): Promise<Outcome> => (calls.push({ kind: "query", text: q, command: ctx.command }), Promise.resolve(outcomeOf({ echoed: q }, { text: `answered ${q.length}` }))),
      check: (id: string, ctx: Context): Promise<Outcome> => (calls.push({ kind: "check", text: id, command: ctx.command }), Promise.resolve(outcomeOf({ checked: id }, { problems: id === "bad" ? [problem("fail", "the check failed", { code: "E1-CHECK" })] : [] }))),
      ...(checks === undefined ? {} : { checks: () => checks }),
    },
  };
}

const programWith = (b: ReturnType<typeof backend>, targets: readonly Target[] = []) => programOf({ name: "ops", summary: "Ops.", version: "1", targets, children: [machineVerbs(b.backend)] });

proves(["0006-machine-verbs FR-001"], "the branch machine has query and check, each a read-only report reached through every channel, and the model has no defect with the reach policy required", () => {
  const p = programWith(backend());
  const placed = placedCommands(p.children);
  assertEquals(placed.map((x) => x.id), ["machine query", "machine check"]);
  for (const x of placed) {
    assertEquals([x.facts.kind, x.facts.effect, x.facts.idempotent], ["report", "read", true]);
    assertEquals([x.reach?.channels, x.reach?.readOnly], [["local", "ssh", "mcp", "rest"], true]);
    assert("on" in { ...x.command.options, ...(x.reach?.channels.includes("ssh") === true ? { on: 1 } : {}) });
  }
  assertEquals(modelProblems(p, { requireReach: true }), []);
});

proves(["0006-machine-verbs FR-001"], "each verb is dispatched to the targets of a selector as run --json machine <verb>", async () => {
  const b = backend();
  const asked: (readonly string[])[] = [];
  const mk = (id: string, cls: "server" | "device"): Target => {
    const r = target({ id, class: cls, address: `${id}.example` });
    if (!isOk(r)) throw new Error(r.error);
    return r.value;
  };
  const p = programWith(b, [mk("alpha", "server"), mk("beta", "server"), mk("sw1", "device")]);
  const done = await run(p, ["machine", "query", "select 1; -- 'x'", "--on", "class:server"], {
    ...world(),
    executors: (id) => ({ exec: (argv) => (asked.push([id, ...argv]), Promise.resolve({ code: 255, success: false, signal: null, stdout: new Uint8Array(), stderr: new TextEncoder().encode("down") })) }),
  });
  assertEquals(done.code, 3);
  assertEquals(asked, [
    ["alpha", "ops", "run", "--json", "machine", "query", "select 1; -- 'x'"],
    ["beta", "ops", "run", "--json", "machine", "query", "select 1; -- 'x'"],
  ]);
  assertEquals(b.calls, [], "the backend is the target's: here nothing was asked");
});

proves(["0006-machine-verbs FR-002"], "a query is handed to the backend byte for byte and never read; a wrong number of words is a failure with its code and the backend is not called", async () => {
  const b = backend();
  const p = programWith(b);
  const weird = "  SELECT *\nFROM t WHERE a = 'x' -- é\t; {\"k\": [1]} $(id) ";
  const r = await run(p, ["machine", "query", weird], world());
  assertEquals(r.code, 0);
  assertEquals(b.calls, [{ kind: "query", text: weird, command: "machine query" }]);
  assertEquals(r.out, `answered ${weird.length}\n`);
  const two = await run(p, ["machine", "query", "a", "b"], world());
  assertEquals(two.code, 2, "the parser refuses the second word");
  const empty = await run(p, ["machine", "query", ""], world());
  assertEquals(empty.code, 1);
  assertStringIncludes(empty.err, "[E000-USAGE-QUERY]");
  assertEquals((await run(p, ["machine", "query"], world())).code, 2);
  assertEquals(b.calls.length, 1);
  fc.assert(
    fc.asyncProperty(fc.string({ minLength: 1 }).filter((s) => !s.startsWith("-")), async (q) => {
      const c = backend();
      await run(programWith(c), ["machine", "query", q], world());
      assertEquals(c.calls.map((x) => x.text), [q]);
    }),
  );
});

proves(["0006-machine-verbs FR-002"], "a check id is one line with no NUL, an id that is not one of the checks the backend names is refused with the nearest, and a failing check is the backend's outcome", async () => {
  assert(validCheckId("disk-free") && !validCheckId("") && !validCheckId("  ") && !validCheckId("a\nb") && !validCheckId("a\u0000b"));
  const b = backend(["disk-free", "mem-free", "bad"]);
  const p = programWith(b);
  const near = await run(p, ["machine", "check", "disk-fre"], world());
  assertEquals(near.code, 1);
  assertStringIncludes(near.err, "disk-fre is not a check; did you mean disk-free? [E000-USAGE-CHECK]");
  assertEquals(b.calls, []);
  const ok = await run(p, ["machine", "check", "disk-free", "--json"], world());
  assertEquals((JSON.parse(ok.out) as { data: unknown }).data, { checked: "disk-free" });
  assertEquals(b.calls, [{ kind: "check", text: "disk-free", command: "machine check" }]);
  const failing = await run(p, ["machine", "check", "bad"], world());
  assertEquals(failing.code, 1);
  assertStringIncludes(failing.err, "[x] the check failed [E1-CHECK]");
  const open = backend();
  assertEquals((await run(programWith(open), ["machine", "check", "anything"], world())).code, 0, "a backend that does not name its checks takes any id");
  assertEquals((await run(programWith(open), ["machine", "check", "a", "b"], world())).code, 2);
});

proves(["0006-machine-verbs FR-003"], "no unit of the library names data, grc or the ontology: the layers check finds such an import, and the real tree has none", async () => {
  const files = [...(await runtime.readSources(ROOT, ["about.ts", "src", "tools"])), ...(await runtime.readSources(ROOT, ["suite"]))];
  const named = files.filter((f) => /from\s+["']@intellectual-frontiers\/(data|grc|ontology)(\/|["'])/.test(f.text)).map((f) => f.path);
  assertEquals(named, []);
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { dependencies?: Record<string, string>; devDependencies: Record<string, string> };
  assert(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).every((n) => !/\/(data|grc|ontology)$/.test(n)));
  const exportsMap = { "./logical": "./src/logical/mod.ts" };
  for (const unit of ["src/governance/a.ts", "src/logical/a.ts", "src/surfaces/cli/a.ts", "src/targets/ssh/a.ts", "src/surfaces/ssh-inbound/a.ts", "src/otel/a.ts"]) {
    for (const lib of ["data", "grc", "ontology"]) {
      assertEquals(layerFindings([{ path: unit, text: `import { x } from "@intellectual-frontiers/${lib}";\n` }], exportsMap).map((f) => f.rule), ["layers/external"], `${unit} / ${lib}`);
    }
  }
  const verbs = await fs.readTextFile(path.join(ROOT, "src", "logical", "machine.ts"));
  assert(!/select\s+\*|osquery_info|FROM\s+\w+/i.test(verbs.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n")), "the verbs name no query language");
});
