/**
 * Tests of the increment from the first real program: the exit a command names, the style of the marks, what the redactor replaces and leaves alone, and consent as a class of
 * confirmation (commons headless 0008-exit-style-consent FR-001 to FR-004).
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  decide,
  defineAction,
  defineReach,
  exitCodeOf,
  exitNameOf,
  exitOfNamed,
  moreSevere,
  problem,
  reachProblems,
  redact,
  redactor,
  RUN_EXITS,
  type Counts,
  type RunExit,
} from "../src/governance/mod.ts";
import { command, mergeOutcomes, modelProblems, outcomeOf, placedCommands, programOf, redactOutcome, standardOptions, withExit } from "../src/logical/mod.ts";
import { lookOfRun, run } from "../src/surfaces/cli/run.ts";
import { memoryStore, world } from "./world.ts";

const NONE: Counts = { fail: 0, warn: 0, pending: 0, action: 0 };

/** A program with one command that returns the outcome it is given. */
const returning = (o: ReturnType<typeof outcomeOf>, reach = defineReach({ channels: ["local"], readOnly: true, idempotent: true })) =>
  programOf({ name: "tool", summary: "T.", version: "1", children: [command({ name: "go", summary: "Go.", options: {}, action: { kind: "report", reach }, run: () => Promise.resolve(o) })] });

proves(["0008-exit-style-consent FR-001"], "a command names its exit and the run ends with it; the status and the envelope agree, and a failure is never hidden by a name of ok or pending", async () => {
  const cases: readonly [RunExit | undefined, Counts, number][] = [
    [undefined, NONE, 0],
    ["ok", NONE, 0],
    ["usage", NONE, 2],
    ["environment", NONE, 3],
    ["findings", NONE, 1],
    ["pending", NONE, 4],
    ["ok", { ...NONE, fail: 1 }, 1],
    ["pending", { ...NONE, fail: 1 }, 1],
    ["usage", { ...NONE, fail: 1 }, 2],
    ["environment", { ...NONE, warn: 2 }, 3],
    [undefined, { ...NONE, pending: 1 }, 0],
  ];
  for (const [named, counts, code] of cases) assertEquals(exitOfNamed(counts, named), code, `${named} ${JSON.stringify(counts)}`);
  assertEquals(exitOfNamed({ ...NONE, pending: 1 }, undefined, { pending: "pending" }), 4);
  for (const exit of ["usage", "environment", "findings", "pending", "ok"] as const) {
    const o = exit === "ok" ? outcomeOf(null, { exit, problems: [problem("fail", "boom", { code: "E1-X" })] }) : outcomeOf(null, { exit, problems: [problem("fail", "x", { code: "E1-X" })] });
    const r = await run(returning(o), ["go", "--json"], world());
    const doc = JSON.parse(r.out) as { exit: { code: number; name: string }; ok: boolean };
    assertEquals(doc.exit.code, r.code);
    assertEquals(doc.exit.name, exitNameOf(r.code));
    assertEquals(doc.ok, false);
  }
  const usage = await run(returning(outcomeOf(null, { exit: "usage", problems: [problem("fail", "the flag combination is wrong", { code: "E1-USE" })] })), ["go", "--json"], world());
  assertEquals([usage.code, (JSON.parse(usage.out) as { exit: { code: number; name: string } }).exit], [2, { code: 2, name: "usage" }]);
  const env = await run(returning(withExit(outcomeOf(null, { problems: [problem("fail", "no git", { code: "E1-ENV" })] }), "environment")), ["go"], world());
  assertEquals(env.code, 3);
  assertEquals((await run(returning(outcomeOf(null, { exit: "ok" })), ["go"], world())).code, 0);
  assertEquals(RUN_EXITS.map(exitCodeOf), [0, 4, 1, 3, 2]);
  // the merge keeps the more severe name
  assertEquals(mergeOutcomes(outcomeOf(null, { exit: "findings" }), outcomeOf(null, { exit: "usage" })).exit, "usage");
  assertEquals(mergeOutcomes(outcomeOf(null), outcomeOf(null, { exit: "pending" })).exit, "pending");
  assertEquals(mergeOutcomes(outcomeOf(null, { exit: "environment" }), outcomeOf(null)).exit, "environment");
  assertEquals(mergeOutcomes(outcomeOf(null), outcomeOf(null)).exit, undefined);
  assertEquals(redactOutcome(outcomeOf(null, { exit: "usage" }), redactor([])).exit, "usage");
  fc.assert(
    fc.property(fc.constantFrom(...RUN_EXITS, undefined), fc.constantFrom(...RUN_EXITS, undefined), fc.constantFrom(...RUN_EXITS, undefined), (a, b, c) => {
      assertEquals(moreSevere(moreSevere(a, b), c), moreSevere(a, moreSevere(b, c)));
      assertEquals(moreSevere(a, b), moreSevere(b, a));
    }),
  );
  fc.assert(
    fc.property(fc.constantFrom(...RUN_EXITS, undefined), fc.nat(3), fc.nat(3), (named, fail, pending) => {
      const code = exitOfNamed({ ...NONE, fail, pending }, named);
      if (fail > 0 && (named === undefined || named === "ok" || named === "pending")) assertEquals(code, 1);
      if (named === "usage") assertEquals(code, 2);
      if (named === "environment") assertEquals(code, 3);
    }),
  );
});

proves(["0008-exit-style-consent FR-002"], "the marks are plain unless the stream is a terminal that shows emoji and nothing asks for plain; Io.marks decides explicitly", async () => {
  const p = returning(outcomeOf(null));
  const emoji = (o: Parameters<typeof world>[0], colour = true) => lookOfRun(p, world(o), colour).emoji;
  const UTF8 = { LANG: "C.UTF-8" };
  assertEquals(emoji({ env: UTF8 }), false, "a pipe is plain whatever the locale");
  assertEquals(emoji({ env: UTF8, terminal: true }), true);
  assertEquals(emoji({ env: UTF8, terminal: true }, false), false, "--no-color is plain");
  assertEquals(emoji({ env: { ...UTF8, NO_COLOR: "1" }, terminal: true }), false, "NO_COLOR is plain");
  assertEquals(emoji({ env: { ...UTF8, TOOL_PLAIN: "1" }, terminal: true }), false);
  assertEquals(emoji({ env: { TOOL_EMOJI: "1" } }), true, "the program's own variable turns emoji on");
  assertEquals(emoji({ env: { TOOL_EMOJI: "1", NO_COLOR: "1" } }), false, "but not against a request for plain");
  assertEquals(emoji({ env: { WT_SESSION: "x" }, os: "windows", terminal: true }), true);
  assertEquals(emoji({ env: {}, terminal: true }), false, "a terminal with no UTF-8 locale shows none");
  assertEquals(emoji({ env: UTF8, terminal: true, marks: "plain" }), false);
  assertEquals(emoji({ env: {}, marks: "emoji" }), true);
  assertEquals(emoji({ env: UTF8, terminal: true, marks: "auto" }), true);
  // the text a run writes in CI (a pipe, a UTF-8 locale, colour off) is the same plain text everywhere
  const warn = returning(outcomeOf(null, { problems: [problem("warn", "slow", { code: "E1-SLOW" })] }));
  const ci = await run(warn, ["go", "--no-color"], world({ env: UTF8, terminal: true }));
  assertEquals(ci.err, "\n[!] slow [E1-SLOW]\n[ok] Up to date · 1 warning\n");
  assertEquals((await run(warn, ["go"], world({ env: UTF8 }))).err, ci.err);
  assertStringIncludes((await run(warn, ["go"], world({ env: UTF8, terminal: true }))).err, "⚠️");
  assertStringIncludes((await run(warn, ["go"], world({ env: UTF8, marks: "emoji" }))).err, "⚠️");
});

proves(["0008-exit-style-consent FR-003"], "the redactor replaces secrets and tokens of a known shape and declared keys, and leaves a sentence that names a variable alone", () => {
  const prose = [
    "ERGONEX_GITHUB_TOKEN: the token is not set",
    "set ERGONEX_GITHUB_TOKEN to a token that can read the repository",
    "GITHUB_TOKEN=unset is not accepted: export a token",
    "password prompt skipped; the passphrase is asked later",
    "token: expired",
    "the secret: see the vault",
  ];
  for (const line of prose) assertEquals(redact(line), line, line);
  assertEquals(redact("ERGONEX_GITHUB_TOKEN: the token is not set", [], { keys: ["ERGONEX_GITHUB_TOKEN"] }), "ERGONEX_GITHUB_TOKEN: the token is not set", "even a declared key is replaced only as an assignment");
  assertEquals(redact("ERGONEX_GITHUB_TOKEN=ghx-not-a-shape and more", [], { keys: ["ERGONEX_GITHUB_TOKEN"] }), "ERGONEX_GITHUB_TOKEN=*** and more");
  assertEquals(redact('{"APP_KEY": "v1", "x": "y"}', [], { keys: ["APP_KEY"] }), '{"APP_KEY": "***", "x": "y"}');
  assertEquals(redact("APP_KEY='a b' next", [], { keys: ["APP_KEY"] }), "APP_KEY=*** next".replace("=***", "=***"));
  const shapes: readonly string[] = [
    "ghp_" + "a".repeat(36),
    "github_pat_" + "B".repeat(40),
    "glpat-" + "c".repeat(20),
    "xoxb-1234567890-abcdefghij",
    "AKIA" + "ABCDEFGHIJKLMNOP",
    "npm_" + "d".repeat(36),
    "sk-" + "e".repeat(30),
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
  ];
  for (const s of shapes) {
    assertEquals(redact(`it failed with ${s} in the header`), "it failed with *** in the header", s.slice(0, 8));
    assertEquals(redact(`it failed with ${s}`, [], { shapes: false }), `it failed with ${s}`, "shapes can be turned off");
  }
  assertEquals(redact("Authorization: Bearer abcdefghijklmnop1234"), "Authorization: Bearer ***");
  assertEquals(redact("Bearer short"), "Bearer short");
  assertEquals(redact("-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\nBBBB\n-----END OPENSSH PRIVATE KEY----- after"), "*** after");
  assertEquals(redact("postgres://u:pw@h/db and password=hunter2 and pwd = x"), "postgres://u:***@h/db and password=*** and pwd = ***");
  assertEquals(redactor(["tok-123456"], { keys: ["APP_KEY"] })("APP_KEY=1 tok-123456 free text"), "APP_KEY=*** *** free text");
  fc.assert(
    fc.property(fc.stringMatching(/^[A-Z][A-Z_]{2,14}: [a-z ]{0,30}$/), (line) => {
      assertEquals(redact(line, [], { keys: ["OTHER_KEY"] }), line);
    }),
  );
  fc.assert(
    fc.property(fc.string(), fc.array(fc.stringMatching(/^[A-Z_]{3,8}$/), { maxLength: 2 }), (text, keys) => {
      const once = redact(text, ["secret-value"], { keys });
      assertEquals(redact(once, ["secret-value"], { keys }), once);
    }),
  );
});

/** A program with a changing action whose confirmation class is consent. */
const consenting = (confirmation: "consent" | "person" = "consent") =>
  programOf({
    name: "tool",
    summary: "T.",
    version: "1",
    secretKeys: [],
    children: [
      command({ name: "sync", summary: "Sync.", options: {}, action: { kind: "action", dryRun: true, reach: defineReach({ channels: ["local"], confirmation }) }, run: (_a, ctx) => Promise.resolve(outcomeOf({ mode: ctx.mode })) }),
      command({ name: "look", summary: "Look.", options: {}, action: { kind: "report", reach: defineReach({ channels: ["local"], readOnly: true, idempotent: true }) }, run: () => Promise.resolve(outcomeOf(null)) }),
    ],
  });

proves(["0008-exit-style-consent FR-004"], "an action of the class consent goes on with no terminal on a consent given before, asks a person where there is one, is refused otherwise, and records the consent in the log", async () => {
  const sync = defineAction({ id: "sync", summary: "S.", kind: "action", dryRun: true });
  const reach = defineReach({ channels: ["local"], confirmation: "consent" });
  const pipe = { audience: "human", interactive: false, flagConfirms: true } as const;
  const base = { mode: "apply", confirmed: false, given: [] } as const;
  assertEquals(decide(sync, pipe, { ...base, consent: "c-1" }, reach), { kind: "proceed" });
  const none = decide(sync, pipe, base, reach);
  assertEquals(none.kind === "refuse" && none.reason, "consent-needed");
  assertEquals(decide(sync, pipe, { ...base, consent: "" }, reach).kind, "refuse");
  assertEquals(decide(sync, { ...pipe, interactive: true }, base, reach), { kind: "ask" });
  assertEquals(decide(sync, pipe, { ...base, mode: "dry-run" }, reach), { kind: "preview" });
  const machine = decide(sync, { audience: "machine", interactive: false, flagConfirms: false }, { ...base, consent: "c-1" }, reach);
  assertEquals(machine.kind === "refuse" && machine.reason, "consent-needed");
  assertEquals(decide(sync, { audience: "machine", interactive: false, flagConfirms: false, acceptsConsent: true }, { ...base, consent: "c-1" }, reach), { kind: "proceed" });
  assertEquals(decide(sync, pipe, base, defineReach({ channels: ["local"], confirmation: "person" })), { kind: "proceed" }, "another class is not asked for a consent");
  assertEquals(decide(sync, pipe, base), { kind: "proceed" });

  const p = consenting();
  assertEquals(modelProblems(p, { requireReach: true }), []);
  const placed = placedCommands(p.children);
  assert("consent" in standardOptions(placed[0]!.facts, placed[0]!.reach));
  assert(!("consent" in standardOptions(placed[1]!.facts, placed[1]!.reach)), "a report has no consent option");
  assert(!("consent" in standardOptions(placed[0]!.facts, defineReach({ channels: ["local"], confirmation: "person" }))));
  assertEquals(reachProblems(defineAction({ id: "look", summary: "L.", kind: "report" }), defineReach({ channels: ["local"], readOnly: true, idempotent: true, confirmation: "consent" })).map((x) => x.rule), ["reach/consent-on-read"]);

  const refused = await run(p, ["sync"], world());
  assertEquals(refused.code, 2);
  assertStringIncludes(refused.err, "changes something and needs a consent: give the identifier of the one a person gave with --consent <id>");
  const store = memoryStore();
  const went = await run(p, ["sync", "--consent", "c-2026-11-20-a", "--json"], world({ store, env: { HOME: "/h" } }));
  assertEquals(went.code, 0);
  assertEquals((JSON.parse(went.out) as { data: unknown }).data, { mode: "apply" });
  const log = [...store.files.values()].map((f) => f.text).join("");
  assertStringIncludes(log, "consent  sync went on by the consent c-2026-11-20-a");
  // a run that is a preview, or went on by no consent, records none
  const dry = memoryStore();
  await run(p, ["sync", "--dry-run"], world({ store: dry, env: { HOME: "/h" } }));
  assertEquals([...dry.files.values()].map((f) => f.text).join("").includes("consent "), false);
  // a person asked, with a terminal, may answer for it
  const asked = await run(p, ["sync"], world({ terminal: true, lines: ["y"] }));
  assertEquals(asked.code, 0);
  assertStringIncludes(asked.err, "sync changes something. Go on? [y/N] ");
  // the consent is written through the redactor
  const secret = programOf({ name: "tool", summary: "T.", version: "1", secrets: () => ["c-secret-id"], children: consenting().children });
  const s2 = memoryStore();
  await run(secret, ["sync", "--consent", "c-secret-id"], world({ store: s2, env: { HOME: "/h" } }));
  const l2 = [...s2.files.values()].map((f) => f.text).join("");
  assertEquals(l2.includes("c-secret-id"), false);
  assertStringIncludes(l2, "went on by the consent ***");
});
