/**
 * Tests of `governance/action.ts`: the facts of an action, the contradictions among them, the modes, and the decision a surface takes from them
 * (commons headless 0002-headless-governance FR-001 to FR-007).
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { isErr, isOk } from "@intellectual-frontiers/core";
import { PUBLIC } from "../src/governance/tier.ts";
import {
  actionProblems,
  decide,
  defineAction,
  humanOnlyGiven,
  mayChange,
  modeOf,
  type ActionFacts,
  type Decision,
  type Mode,
  type SurfaceFacts,
} from "../src/governance/action.ts";

const CLI: SurfaceFacts = { audience: "human", interactive: true, flagConfirms: true };
const PIPE: SurfaceFacts = { audience: "human", interactive: false, flagConfirms: true };
const TOOLS: SurfaceFacts = { audience: "machine", interactive: false, flagConfirms: false };
const wipe = defineAction({ id: "cache wipe", summary: "Delete the cache.", kind: "action", effect: "destructive", dryRun: true });
const sync = defineAction({ id: "sync", summary: "Sync.", kind: "action", dryRun: true });
const status = defineAction({ id: "status", summary: "Status.", kind: "report" });
const apply = { mode: "apply" as Mode, confirmed: false, given: [] as readonly string[] };

proves(["0002-headless-governance FR-001"], "an action has the facts of its kind by default, and defaults can be overridden", () => {
  assertEquals(status, {
    id: "status",
    summary: "Status.",
    kind: "report",
    effect: "read",
    idempotent: true,
    audience: "both",
    tier: PUBLIC,
    dryRun: false,
    check: false,
    humanOnly: [],
  });
  assertEquals([sync.effect, sync.idempotent], ["mutate", false]);
  assertEquals(defineAction({ id: "x", summary: "X.", kind: "action", idempotent: true, audience: "human", humanOnly: ["secret"] }).humanOnly, ["secret"]);
  assertEquals(actionProblems(status), []);
  assertEquals(actionProblems(sync), []);
  assertEquals(actionProblems(wipe), []);
  assertEquals(actionProblems({ ...status, id: "Bad Id" }).map((p) => p.rule), ["action/id"]);
  assertEquals(actionProblems({ ...status, summary: " " }).map((p) => p.rule), ["action/summary"]);
});

proves(["0002-headless-governance FR-002"], "a report only reads, and an action that only reads is a report", () => {
  assertEquals(actionProblems({ ...status, effect: "mutate" }).map((p) => p.rule), ["action/report-changes"]);
  assertEquals(actionProblems({ ...status, effect: "destructive" }).some((p) => p.rule === "action/report-changes"), true);
  assertEquals(actionProblems({ ...sync, effect: "read" }).map((p) => p.rule), ["action/action-reads"]);
});

proves(["0002-headless-governance FR-003"], "a destructive action must preview and is not idempotent; a check needs a change to look for", () => {
  assertEquals(actionProblems({ ...wipe, dryRun: false }).map((p) => p.rule), ["action/destructive-no-preview"]);
  assertEquals(actionProblems({ ...wipe, idempotent: true }).map((p) => p.rule), ["action/idempotent-destructive"]);
  assertEquals(actionProblems({ ...status, check: true }).map((p) => p.rule), ["action/check-on-read"]);
  assertEquals(actionProblems({ ...sync, check: true }), []);
  assertEquals(actionProblems({ ...sync, humanOnly: ["a", "a"] }).map((p) => p.rule), ["action/human-only-duplicate"]);
});

proves(["0002-headless-governance FR-004"], "a destructive action is asked, or confirmed by the flag where a flag may, or refused; a preview never asks and never changes", () => {
  assertEquals(decide(wipe, CLI, apply), { kind: "ask" });
  assertEquals(decide(wipe, CLI, { ...apply, confirmed: true }), { kind: "proceed" });
  const noTerminal = decide(wipe, PIPE, apply);
  assertEquals(noTerminal.kind === "refuse" && noTerminal.reason, "confirmation-needed");
  assertEquals(decide(wipe, PIPE, { ...apply, confirmed: true }), { kind: "proceed" });
  const toolFlag = decide(wipe, TOOLS, { ...apply, confirmed: true });
  assertEquals(toolFlag.kind === "refuse" && toolFlag.reason, "confirmation-not-accepted");
  for (const mode of ["dry-run", "check"] as const) assertEquals(decide(wipe, PIPE, { ...apply, mode }), { kind: "preview" });
  assertEquals(decide(sync, PIPE, apply), { kind: "proceed" });
  assertEquals(decide(status, PIPE, apply), { kind: "proceed" });
});

proves(["0002-headless-governance FR-004", "0002-headless-governance FR-005"], "for any action, surface and invocation: nothing that is not a preview changes unless it was decided to proceed", () => {
  const effects = fc.constantFrom("read", "mutate", "destructive");
  const surfaces = fc.record({ audience: fc.constantFrom("human", "machine"), interactive: fc.boolean(), flagConfirms: fc.boolean() });
  const invocations = fc.record({ mode: fc.constantFrom("apply", "dry-run", "check"), confirmed: fc.boolean(), given: fc.array(fc.constantFrom("a", "b")) });
  fc.assert(
    fc.property(effects, fc.constantFrom("human", "machine", "both"), surfaces, invocations, (effect, audience, surface, inv) => {
      const facts: ActionFacts = { ...sync, kind: effect === "read" ? "report" : "action", effect, audience, humanOnly: ["b"], dryRun: true };
      const d: Decision = decide(facts, surface, inv);
      if (inv.mode !== "apply" && d.kind !== "refuse") assertEquals(d.kind, "preview");
      if (d.kind === "proceed" && effect === "destructive") assertEquals(inv.confirmed && surface.flagConfirms, true);
      if (surface.audience === "machine" && (audience === "human" || inv.given.includes("b"))) assertEquals(d.kind, "refuse");
    }),
  );
});

proves(["0002-headless-governance FR-005"], "a machine surface refuses an action for a person and an option only a person may give", () => {
  const person = defineAction({ id: "secrets reveal", summary: "Show.", kind: "report", audience: "human" });
  const d = decide(person, TOOLS, apply);
  assertEquals(d.kind === "refuse" && d.reason, "human-only-action");
  const withOption = defineAction({ id: "sync", summary: "Sync.", kind: "action", humanOnly: ["passphrase"] });
  const e = decide(withOption, TOOLS, { ...apply, given: ["passphrase"] });
  assertEquals(e.kind === "refuse" && e.reason, "human-only-option");
  assertEquals(decide(withOption, CLI, { ...apply, given: ["passphrase"] }), { kind: "proceed" });
  assertEquals(humanOnlyGiven(withOption, ["a", "passphrase"]), ["passphrase"]);
});

proves(["0002-headless-governance FR-006"], "the help says whether an action is safe to repeat: the fact is declared and defaults to the safe side", async () => {
  assertEquals(status.idempotent, true);
  assertEquals(sync.idempotent, false);
  const { effectLines } = await import("../src/surfaces/cli/help.ts");
  assert(effectLines(status).some((l) => l.startsWith("Repeating it: safe")));
  assert(effectLines(sync).some((l) => l.startsWith("Repeating it: not promised")));
});

proves(["0002-headless-governance FR-007"], "the flags make one mode, both together are refused, and only apply may change", () => {
  const modes: readonly [boolean, boolean, string][] = [
    [false, false, "apply"],
    [true, false, "dry-run"],
    [false, true, "check"],
  ];
  for (const [dryRun, check, mode] of modes) {
    const m = modeOf({ dryRun, check });
    assert(isOk(m));
    if (isOk(m)) assertEquals([m.value, mayChange(m.value)], [mode, mode === "apply"]);
  }
  assert(isErr(modeOf({ dryRun: true, check: true })));
});
