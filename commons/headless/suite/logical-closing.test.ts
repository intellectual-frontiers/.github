/**
 * Tests of `logical/closing.ts` and `fix.ts`: the order of the closing block, its verdict and its one next command, and the splitting of a fix into its command and
 * its words (commons headless 0003-headless-output FR-004, FR-005). The closing block is held to the invariants of its calm output.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { problem, type Problem, type ProblemLevel } from "../src/governance/mod.ts";
import { closingOf, type ClosingLine } from "../src/logical/closing.ts";
import { fixSplitter } from "../src/logical/fix.ts";
import { outcomeOf } from "../src/logical/outcome.ts";

/** The commands a fleet program's fixes call. */
const FLEET = { commands: ["bun run fleetctl", "fleetctl", "desired-os-state", "git", "gh", "sudo", "ssh", "bun"], own: ["bun run fleetctl", "desired-os-state", "fleetctl"] };
const split = fixSplitter(FLEET);
const FIX = { commands: ["tool", "git"], own: ["tool"] };

proves(["0003-headless-output FR-005"], "a fix is split into its one command and the words around it", () => {
  assertEquals(split("bun run fleetctl vault backup, then move the ZIP somewhere safe"), { cmd: "bun run fleetctl vault backup", say: "Move the ZIP somewhere safe" });
  assertEquals(split("bun run fleetctl apply"), { cmd: "bun run fleetctl apply" });
  assertEquals(split("bun run fleetctl apply (it lists those commits)"), { cmd: "bun run fleetctl apply", say: "It lists those commits" });
  assertEquals(split("check the network, then run this again"), { say: "check the network, then run this again" });
  assertEquals(split(undefined), {});
  assertEquals(split(""), {});
  assertEquals(split("sudo systemctl restart x"), { cmd: "sudo systemctl restart x" });
  assertEquals(split("fix it with: fleetctl fleet trust"), { cmd: "fleetctl fleet trust", say: "Fix it with" });
  // a program that names no command splits nothing
  assertEquals(fixSplitter({ commands: [], own: [] })("tool sync"), { say: "tool sync" });
  // a program's name with a character a pattern would read is read as it is
  assertEquals(fixSplitter({ commands: ["my.tool"], own: [] })("my.tool go"), { cmd: "my.tool go" });
  assertEquals(fixSplitter({ commands: ["my.tool"], own: [] })("myXtool go"), { say: "myXtool go" });
});

const lineKinds = (lines: readonly ClosingLine[]): string[] => lines.map((l) => (l.kind === "problem" ? `${l.level}:${l.message}` : l.kind === "hint" ? `hint:${l.message}` : `step:${l.text}`));

proves(["0003-headless-output FR-004"], "the closing block is in the order problems, your move, pending, hints, steps; the first failure is the verdict and is not listed twice", () => {
  const o = outcomeOf(null, {
    problems: [
      problem("pending", "no token", { fix: "tool token", code: "P1-TOKEN" }),
      problem("warn", "slow", { code: "E1-SLOW" }),
      problem("fail", "root cause", { fix: "tool fix", code: "E1-ROOT" }),
      problem("action", "send it", { fix: "tool send (it lists them)" }),
      problem("fail", "second", { code: "E1-TWO" }),
    ],
    next: ["then: power on alpha", "next: tool suggested"],
  });
  const c = closingOf(o, { fix: FIX, shownHints: [{ id: "h", message: "remote is off", command: "tool remote" }] });
  assertEquals(lineKinds(c.lines), ["fail:second", "warn:slow", "action:send it", "pending:no token", "hint:remote is off", "step:power on alpha"]);
  assertEquals(c.verdict, { level: "fail", text: "root cause", code: "E1-ROOT" });
  assertEquals(c.next, "tool fix");
  assertEquals(c.counts, { fail: 2, warn: 1, pending: 1, action: 1 });
  const send = c.lines.find((l) => l.kind === "problem" && l.level === "action");
  assert(send?.kind === "problem" && send.command?.label === "run" && send.command.command === "tool send" && send.say === "It lists them");
  const slow = c.lines.find((l) => l.kind === "problem" && l.level === "warn");
  assert(slow?.kind === "problem" && slow.code === "E1-SLOW" && slow.command === undefined);
});

proves(["0003-headless-output FR-004"], "where nothing failed the verdict states counts and never 'all well'; the next command is the first step for the person, else the suggested one", () => {
  const clean = closingOf(outcomeOf(null), { fix: FIX, shownHints: [] });
  assertEquals(clean.verdict, { level: "ok", text: "Up to date" });
  assertEquals([clean.next, clean.lines.length], [undefined, 0]);
  const titled = closingOf(outcomeOf(null, { title: "Applied" }), { fix: FIX, shownHints: [], title: "Synced" });
  assertEquals(titled.verdict.text, "Synced");
  assertEquals(closingOf(outcomeOf(null, { title: "Applied" }), { fix: FIX, shownHints: [] }).verdict.text, "Applied");
  const busy = closingOf(
    outcomeOf(null, {
      problems: [problem("warn", "a"), problem("warn", "b"), problem("action", "c", { fix: "tool one" }), problem("action", "d", { fix: "tool two" }), problem("pending", "e")],
      next: ["next: tool suggested"],
    }),
    { fix: FIX, shownHints: [{ id: "h", message: "m" }] },
  );
  assertEquals(busy.verdict, { level: "ok", text: "Up to date · 2 warnings · 2 for you · 1 waiting · 1 optional" });
  assertEquals(busy.next, "tool one");
  assert(!/all well|\bdone\b|finished/i.test(busy.verdict.text));
  assertEquals(closingOf(outcomeOf(null, { next: ["next: tool suggested (it says why)"] }), { fix: FIX, shownHints: [] }).next, "tool suggested");
  assertEquals(closingOf(outcomeOf(null, { next: ["next: do the thing"] }), { fix: FIX, shownHints: [] }).next, "do the thing");
  assertEquals(closingOf(outcomeOf(null, { cancelled: true }), { fix: FIX, shownHints: [] }).verdict, { level: "cancelled", text: "Stopped" });
  // a failure whose fix holds no command has no next command, whatever else is suggested
  const sentence = closingOf(outcomeOf(null, { problems: [problem("fail", "no network", { fix: "check the network, then run this again" })], next: ["next: tool suggested"] }), { fix: FIX, shownHints: [] });
  assertEquals([sentence.next, sentence.rootSay], [undefined, "check the network, then run this again"]);
});

proves(["0003-headless-output FR-004"], "pending is never a failure and shows its next step", () => {
  const c = closingOf(outcomeOf(null, { problems: [problem("pending", "no relay token yet", { fix: "bun run fleetctl boot mail-push alpha", code: "P027-MAIL-TOKEN" })] }), { fix: FLEET, shownHints: [] });
  assertEquals(c.lines, [{ kind: "problem", level: "pending", message: "no relay token yet", code: "P027-MAIL-TOKEN", command: { label: "run", command: "bun run fleetctl boot mail-push alpha" } }]);
  assertEquals(c.verdict, { level: "ok", text: "Up to date · 1 waiting" });
});

proves(["0003-headless-output FR-004"], "for any problems: the verdict and the counts agree, a failure is listed once, and there is at most one next command", () => {
  const levels = fc.constantFrom<ProblemLevel>("fail", "warn", "pending", "action");
  fc.assert(
    fc.property(fc.array(fc.record({ level: levels, fix: fc.option(fc.constantFrom("tool a", "tool b (why)", "think first"), { nil: undefined }) }), { maxLength: 8 }), (rows) => {
      const ps: Problem[] = rows.map((r, i) => problem(r.level, `m${i}`, r.fix === undefined ? {} : { fix: r.fix }));
      const c = closingOf(outcomeOf(null, { problems: ps }), { fix: FIX, shownHints: [] });
      const fails = ps.filter((p) => p.level === "fail");
      assertEquals(c.verdict.level, fails.length > 0 ? "fail" : "ok");
      assertEquals(c.verdict.level === "fail" ? c.verdict.text : undefined, fails[0]?.message);
      assertEquals(c.lines.filter((l) => l.kind === "problem" && l.level === "fail").length, Math.max(0, fails.length - 1));
      assertEquals(c.counts.fail, fails.length);
      assertEquals(c.lines.length, ps.length - (fails.length > 0 ? 1 : 0));
      assert(c.next === undefined || /^tool [ab]$/.test(c.next));
    }),
  );
});
