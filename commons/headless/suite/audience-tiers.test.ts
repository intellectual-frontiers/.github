/**
 * Tests of the audience tiers (commons headless 0010-audience-tiers FR-001 to FR-006): the ladder as data, the one pure gate, the tree a caller may see, the help,
 * the completions and the man page drawn from it, and the typed refusal of a verb that is hidden.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  ADMINISTRATOR,
  decide,
  defineAction,
  defineLadder,
  DEFAULT_LADDER,
  isVisible,
  OPERATOR,
  parseTierName,
  PUBLIC,
  tierGate,
  tierMessage,
  type TierDecision,
  type TierLadder,
  type TierName,
} from "../src/governance/mod.ts";
import { branch, command, hiddenVerb, outcomeOf, placedCommands, programOf, visibleProgram } from "../src/logical/mod.ts";
import { completions, helpFor, manPage, SHELLS } from "../src/surfaces/cli/help.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { world } from "./world.ts";

const tier = (t: string): TierName => {
  const r = parseTierName(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const done = () => Promise.resolve(outcomeOf(null, { text: "ran" }));
const ran: string[] = [];
const verb = (name: string, t: TierName | undefined) =>
  command({ name, summary: `The ${name} verb.`, options: {}, action: { kind: "report", ...(t === undefined ? {} : { tier: t }) }, run: () => (ran.push(name), done()) });

/** A program with a verb of each tier, a branch of two tiers and a branch that is only for administrators. */
const program = () =>
  programOf({
    name: "tool",
    summary: "A tool.",
    version: "1.0.0",
    children: [
      verb("status", undefined),
      verb("restart", OPERATOR),
      branch({ name: "server", summary: "Servers.", children: [verb("list", PUBLIC), verb("wipe", ADMINISTRATOR)] }),
      branch({ name: "keys", summary: "Keys.", children: [verb("rotate", ADMINISTRATOR)] }),
    ],
  });

proves(["0010-audience-tiers FR-001"], "an action has the lowest tier by default, a tier name is parsed, and a ladder is data with every problem returned as a value", () => {
  assertEquals(defineAction({ id: "x", summary: "X.", kind: "report" }).tier, PUBLIC);
  assertEquals(defineAction({ id: "x", summary: "X.", kind: "report", tier: OPERATOR }).tier, OPERATOR);
  for (const bad of ["", "Public", "a b", "-x", "x-", "x--y", "1x"]) assertEquals(parseTierName(bad).kind, "err", bad);
  for (const good of ["public", "operator", "second-approver", "t2"]) assertEquals(parseTierName(good).kind, "ok", good);
  assertEquals(DEFAULT_LADDER.ladder, [PUBLIC, OPERATOR, ADMINISTRATOR]);
  assertEquals(DEFAULT_LADDER.default, PUBLIC);
  const own = defineLadder(["guest", "member"], "member");
  assertEquals(own.kind === "ok" ? [own.value.ladder.map(String), String(own.value.default)] : undefined, [["guest", "member"], "member"]);
  const two = defineLadder(["a", "b"]);
  assertEquals(two.kind === "ok" ? [two.value.ladder.map(String), String(two.value.default)] : undefined, [["a", "b"], "a"]);
  const rules = (names: readonly string[], d?: string) => {
    const r = defineLadder(names, d);
    return r.kind === "err" ? r.error.map((p) => p.rule) : [];
  };
  assertEquals(rules([]), ["tier/empty"]);
  assertEquals(rules(["a", "a"]), ["tier/duplicate"]);
  assertEquals(rules(["A"]), ["tier/name"]);
  assertEquals(rules(["a"], "b"), ["tier/default-unknown"]);
});

const hidden = (d: TierDecision): string => (d.kind === "hidden" ? d.reason : "visible");

proves(["0010-audience-tiers FR-002"], "the gate is pure and total: a caller sees what is at or below its tier, and a tier not on the ladder hides the action and never exposes it", () => {
  assertEquals(hidden(tierGate(DEFAULT_LADDER, OPERATOR, PUBLIC)), "tier-too-low");
  assertEquals(hidden(tierGate(DEFAULT_LADDER, OPERATOR, OPERATOR)), "visible");
  assertEquals(hidden(tierGate(DEFAULT_LADDER, PUBLIC, ADMINISTRATOR)), "visible");
  assertEquals(hidden(tierGate(DEFAULT_LADDER, tier("ghost"), ADMINISTRATOR)), "tier-unknown");
  assertEquals(hidden(tierGate(DEFAULT_LADDER, PUBLIC, tier("ghost"))), "tier-unknown");
  const ladder: TierLadder = DEFAULT_LADDER;
  const any = fc.constantFrom(...ladder.ladder, tier("ghost"));
  fc.assert(
    fc.property(any, any, (required, held) => {
      const d = tierGate(ladder, required, held);
      assertEquals(d, tierGate(ladder, required, held), "pure");
      const need = ladder.ladder.indexOf(required);
      const have = ladder.ladder.indexOf(held);
      assertEquals(isVisible(d), need >= 0 && have >= 0 && have >= need);
      if (d.kind === "hidden") assertStringIncludes(tierMessage("x y", d), "x y");
    }),
  );
});

proves(["0010-audience-tiers FR-003"], "the tree a caller sees has no hidden verb and no branch left empty, and the help, the completions and the man page are drawn from it", () => {
  const p = program();
  const ids = (t: TierName) => placedCommands(visibleProgram(p, t).children).map((c) => c.id);
  assertEquals(ids(PUBLIC), ["status", "server list"]);
  assertEquals(ids(OPERATOR), ["status", "restart", "server list"]);
  assertEquals(ids(ADMINISTRATOR), ["status", "restart", "server list", "server wipe", "keys rotate"]);
  const seen = visibleProgram(p, PUBLIC);
  const top = helpFor(seen, []) ?? "";
  assertStringIncludes(top, "status");
  for (const word of ["restart", "keys", "wipe", "rotate"]) assert(!top.includes(word), `${word} is not in the help`);
  const branchHelp = helpFor(seen, ["server"]) ?? "";
  assert(branchHelp.includes("list") && !branchHelp.includes("wipe"));
  assertEquals(helpFor(seen, ["keys"]), undefined, "a branch with nothing visible is not there");
  for (const shell of SHELLS) {
    const text = completions(seen, shell);
    for (const word of ["restart", "wipe", "rotate", "keys"]) assert(!text.includes(word), `${shell}: ${word}`);
    assert(text.includes("status"));
  }
  const man = manPage(seen);
  for (const word of ["restart", "wipe", "rotate"]) assert(!man.includes(word), `man: ${word}`);
  assertStringIncludes(manPage(visibleProgram(p, ADMINISTRATOR)), "rotate");
});

proves(["0010-audience-tiers FR-004", "0010-audience-tiers FR-006"], "invoking a hidden verb is refused with the typed reason and runs nothing, the help of the command line shows only what the tier may see, and an unknown word stays unknown", async () => {
  const p = program();
  ran.length = 0;
  const refused = await run(p, ["restart"], world());
  assertEquals(refused.code, 2);
  assertStringIncludes(refused.err, "restart is for the tier operator; this caller holds public [tier-too-low]");
  const deep = await run(p, ["server", "wipe"], world());
  assertStringIncludes(deep.err, "[tier-too-low]");
  assertEquals(ran, [], "nothing ran");
  const unknown = await run(p, ["server", "wip"], world());
  assertEquals(unknown.code, 2);
  assert(!unknown.err.includes("tier-"), unknown.err);
  const asOperator = await run(p, ["restart"], world({ tier: OPERATOR }));
  assertEquals([asOperator.code, ran], [0, ["restart"]]);
  const help = await run(p, ["help"], world());
  assert(!help.out.includes("restart") && help.out.includes("status"), help.out);
  const adminHelp = await run(p, ["help"], world({ tier: ADMINISTRATOR }));
  assert(adminHelp.out.includes("restart") && adminHelp.out.includes("keys"));
  const gone = await run(p, ["help", "keys"], world());
  assertEquals(gone.code, 2);
  assertStringIncludes((await run(p, ["completions", "bash"], world())).out, "status");
  assert(!(await run(p, ["man"], world())).out.includes("rotate"));
  const found = hiddenVerb(p, ["keys", "rotate"], PUBLIC);
  assertEquals(found?.decision.reason, "tier-too-low");
  assertEquals(hiddenVerb(p, ["keys", "ghost"], PUBLIC), undefined);
  assertEquals(hiddenVerb(p, ["status"], PUBLIC), undefined);
  const strange = programOf({ name: "tool", summary: "T.", version: "1", tiers: { ladder: [OPERATOR], default: OPERATOR }, children: [verb("status", undefined)] });
  assertEquals((await run(strange, ["status"], world())).code, 2, "an action whose tier is not on the ladder is hidden, not exposed");
});

proves(["0010-audience-tiers FR-005"], "the tier does not change what the effect needs: a destructive action of a high tier is still confirmed, and a program for a person is still refused by a machine surface", () => {
  const wipe = defineAction({ id: "server wipe", summary: "Wipe.", kind: "action", effect: "destructive", dryRun: true, tier: ADMINISTRATOR });
  assertEquals(decide(wipe, { audience: "human", interactive: false, flagConfirms: true }, { mode: "apply", confirmed: false, given: [] }).kind, "refuse");
  assertEquals(decide(wipe, { audience: "human", interactive: true, flagConfirms: true }, { mode: "apply", confirmed: false, given: [] }).kind, "ask");
  const person = defineAction({ id: "login", summary: "Log in.", kind: "action", audience: "human", tier: PUBLIC });
  const d = decide(person, { audience: "machine", interactive: false, flagConfirms: false }, { mode: "apply", confirmed: false, given: [] });
  assertEquals(d.kind === "refuse" ? d.reason : d.kind, "human-only-action");
});
