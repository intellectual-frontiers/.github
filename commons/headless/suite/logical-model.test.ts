/**
 * Tests of `logical/model.ts`, `outcome.ts`, `verbosity.ts` and `program.ts`: the command model and its defects, the standard options of an effect, the typed
 * outcome and its merging, and the verbosities (commons headless 0003-headless-output FR-001, FR-002, FR-003, FR-012).
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { isErr, isOk } from "@intellectual-frontiers/core";
import { flag, value } from "@intellectual-frontiers/terminal/args";
import { defineAction, problem } from "../src/governance/mod.ts";
import {
  announce,
  command,
  modelProblems,
  NO_PROGRESS,
  placedCommands,
  standardOptions,
  startPhase,
  STANDARD_KEYS,
  treeOf,
  type ProgressEvent,
} from "../src/logical/model.ts";
import { findingsOfProblems, mergeOutcomes, NOTHING, outcomeOf, withProblem } from "../src/logical/outcome.ts";
import { programOf } from "../src/logical/program.ts";
import { LINE_KINDS, shows, VERBOSITIES, verbosityOf } from "../src/logical/verbosity.ts";
import { sample } from "./world.ts";

proves(["0003-headless-output FR-001"], "a program is a tree of branches and commands; each command has its path, its id and the facts of its action", () => {
  const p = sample();
  const placed = placedCommands(p.children);
  assertEquals(
    placed.map((x) => x.id),
    ["status", "sync", "wipe", "work build", "work plan"],
  );
  assertEquals(placed.find((x) => x.id === "wipe")?.facts.effect, "destructive");
  assertEquals(placed.find((x) => x.id === "status")?.facts.kind, "report");
  const tree = treeOf(p);
  assertEquals(tree.name, "tool");
  assertEquals(
    tree.children.map((c) => c.name),
    ["status", "sync", "wipe", "work"],
  );
  assertEquals(modelProblems(p), []);
});

proves(["0003-headless-output FR-001"], "the defects of a tree are found: duplicate words, an action that contradicts itself, reserved options and shorts, an unknown human-only option, a built-in word", () => {
  const run = (): Promise<never> => Promise.reject(new Error("not run"));
  const bad = programOf({
    name: "tool",
    summary: "A tool.",
    version: "1.0.0",
    children: [
      command({ name: "a", summary: "A.", options: { json: flag({ help: "mine" }) }, action: { kind: "report" }, run }),
      command({ name: "a", summary: "Again.", options: {}, action: { kind: "report" }, run }),
      command({ name: "b", summary: "B.", options: { quietly: flag({ short: "q", help: "x" }) }, action: { kind: "report" }, run }),
      command({ name: "c", summary: "C.", options: {}, action: { kind: "report", effect: "mutate" }, run }),
      command({ name: "d", summary: "D.", options: {}, action: { kind: "action", humanOnly: ["ghost"] }, run }),
      command({ name: "help", summary: "H.", options: {}, action: { kind: "report" }, run }),
    ],
  });
  const rules = modelProblems(bad).map((m) => m.rule);
  for (const r of ["model/tree", "model/reserved-option", "model/reserved-short", "model/action", "model/human-only-unknown", "model/built-in-word"] as const) {
    assert(rules.includes(r), `${r} in ${rules.join(", ")}`);
  }
});

proves(["0003-headless-output FR-012"], "every command takes the standard options by its effect, and the key of each is a long option", () => {
  const read = standardOptions(defineAction({ id: "r", summary: "R.", kind: "report" }));
  assertEquals(Object.keys(read).sort(), ["color", "json", "nonInteractive", "quiet", "sarif", "verbose"]);
  const change = standardOptions(defineAction({ id: "c", summary: "C.", kind: "action", dryRun: true, check: true }));
  assertEquals(Object.keys(change).sort(), ["check", "color", "dryRun", "json", "nonInteractive", "quiet", "verbose"]);
  const destroy = standardOptions(defineAction({ id: "d", summary: "D.", kind: "action", effect: "destructive", dryRun: true }));
  assert("yes" in destroy && "dryRun" in destroy && !("check" in destroy) && !("sarif" in destroy));
  for (const k of [...Object.keys(read), ...Object.keys(change), ...Object.keys(destroy)]) assert((STANDARD_KEYS as readonly string[]).includes(k), k);
  const color = read["color"];
  assert(color?.kind === "flag" && color.negatable);
  assertEquals([read["quiet"]?.short, read["verbose"]?.short, destroy["yes"]?.short], ["q", "v", "y"]);
  // a command's own option of another name and another letter is free
  assertEquals(modelProblems(programOf({ name: "t", summary: "T.", version: "1", children: [command({ name: "x", summary: "X.", options: { out: value({ short: "o", help: "Out." }) }, action: { kind: "report" }, run: () => Promise.reject(new Error("no")) })] })), []);
});

proves(["0003-headless-output FR-002"], "an outcome is a value with empty defaults; merging keeps the first's data and text, orders the rest, and shows a hint once", () => {
  assertEquals(NOTHING.problems, []);
  assertEquals(NOTHING.cancelled, false);
  const a = outcomeOf({ n: 1 }, { text: "A", problems: [problem("warn", "w1")], outcomes: ["o1"], hints: [{ id: "h", message: "m" }], next: ["next: x"], title: "Done A" });
  const b = outcomeOf({ n: 2 }, { text: "B", problems: [problem("fail", "f1")], outcomes: ["o2"], hints: [{ id: "h", message: "other" }, { id: "g", message: "g" }], next: ["then: y"], cancelled: true });
  const m = mergeOutcomes(a, b);
  assertEquals([m.data, m.text, m.title, m.cancelled], [{ n: 1 }, "A", "Done A", true]);
  assertEquals(m.problems.map((p) => p.message), ["w1", "f1"]);
  assertEquals(m.outcomes, ["o1", "o2"]);
  assertEquals(m.hints.map((h) => `${h.id}:${h.message}`), ["h:m", "g:g"]);
  assertEquals(m.next, ["next: x", "then: y"]);
  assertEquals(withProblem(NOTHING, problem("fail", "x")).problems.length, 1);
  assertEquals(NOTHING.problems.length, 0, "the value is not changed");
  assertEquals(findingsOfProblems([problem("fail", "f", { code: "E1-X" }), problem("warn", "w"), problem("pending", "p"), problem("action", "a")]), [
    { ruleId: "E1-X", level: "error", message: "f" },
    { ruleId: "warning", level: "warning", message: "w" },
  ]);
  // associative
  fc.assert(
    fc.property(fc.array(fc.string(), { maxLength: 3 }), fc.array(fc.string(), { maxLength: 3 }), fc.array(fc.string(), { maxLength: 3 }), (x, y, z) => {
      const o = (xs: readonly string[]) => outcomeOf(null, { outcomes: xs, problems: xs.map((s) => problem("warn", s)) });
      assertEquals(mergeOutcomes(mergeOutcomes(o(x), o(y)), o(z)), mergeOutcomes(o(x), mergeOutcomes(o(y), o(z))));
    }),
  );
});

proves(["0003-headless-output FR-001", "0003-headless-output FR-002"], "what a command tells while it runs is a progress event, and the writer of a phase says each kind", () => {
  const seen: ProgressEvent[] = [];
  announce((e) => seen.push(e), "Title", "sub");
  const ph = startPhase((e) => seen.push(e), "Files");
  ph.step(1, 2, "a");
  ph.live("x");
  ph.ok("fine");
  ph.skip("s");
  ph.change("c");
  ph.note("n");
  ph.warn("w", { code: "E1-W" });
  ph.fail("f", { fix: "tool sync" });
  ph.pending("p", "tool wait");
  ph.action("a", "tool do");
  ph.outcome("Sent");
  ph.hint("h", "H", "tool on");
  ph.done("2 files");
  assertEquals(seen.map((e) => e.kind), ["header", "phase", "step", "live", "item", "item", "item", "item", "problem", "problem", "problem", "problem", "outcome", "hint", "done"]);
  const problems = seen.flatMap((e) => (e.kind === "problem" ? [e.problem] : []));
  assertEquals(problems.map((p) => [p.level, p.phase, p.fix ?? null, p.code ?? null]), [
    ["warn", "Files", null, "E1-W"],
    ["fail", "Files", "tool sync", null],
    ["pending", "Files", "tool wait", null],
    ["action", "Files", "tool do", null],
  ]);
  NO_PROGRESS({ kind: "phase", name: "x" });
});

proves(["0003-headless-output FR-003"], "the flags choose a verbosity: json over all, quiet with verbose refused; a table says what each shows", () => {
  const f = (json: boolean, quiet: boolean, verbose: boolean) => verbosityOf({ json, quiet, verbose });
  const v = (json: boolean, quiet: boolean, verbose: boolean): string | undefined => {
    const r = f(json, quiet, verbose);
    return isOk(r) ? r.value : undefined;
  };
  assertEquals([v(false, false, false), v(false, false, true), v(false, true, false), v(true, false, false)], ["calm", "verbose", "quiet", "json"]);
  assertEquals([v(true, true, false), v(true, false, true)], ["json", "json"]);
  assert(isErr(f(false, true, true)) && isErr(f(true, true, true)));
  assertEquals(VERBOSITIES.length, 4);
  for (const k of LINE_KINDS) {
    assertEquals(shows("json", k), false);
    assertEquals(shows("verbose", k), true);
    assertEquals(shows("quiet", k), k === "verdict");
  }
  assertEquals(
    LINE_KINDS.filter((k) => !shows("calm", k)),
    ["step", "item", "log"],
  );
  assert(shows("calm", "verdict") && shows("calm", "problem") && shows("calm", "outcome") && shows("calm", "live") && shows("calm", "phase"));
});
