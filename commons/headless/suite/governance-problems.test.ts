/**
 * Tests of `governance/problems.ts`, `exits.ts` and `redact.ts`: the levels and stable codes of problems, the one table of exit statuses, the status of a
 * run, and the redaction of secrets (commons headless 0002-headless-governance FR-008 to FR-011).
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertNotEquals, proves } from "@intellectual-frontiers/test";
import {
  EXIT_NAMES,
  exitCodeOf,
  exitMeaning,
  exitNameOf,
  exitOfRun,
  exitOfSignal,
  type ExitName,
} from "../src/governance/exits.ts";
import {
  countsOf,
  DEFAULT_GENERIC_CODES,
  isPendingCode,
  isProblemCode,
  ofLevel,
  PROBLEM_LEVELS,
  problem,
  withCode,
  type Problem,
  type ProblemLevel,
} from "../src/governance/problems.ts";
import { MASK, passwordOf, redact, redactor } from "../src/governance/redact.ts";

const LEVELS = fc.constantFrom<ProblemLevel>("fail", "warn", "pending", "action");

proves(["0002-headless-governance FR-008"], "a problem has one of four levels, holds only the fields given, and the counts are of its levels", () => {
  assertEquals(problem("warn", "slow"), { level: "warn", message: "slow" });
  assertEquals(problem("fail", "x", { code: "E1-X", fix: "do it", phase: "p", raw: "r", logLine: 3 }), {
    level: "fail",
    message: "x",
    phase: "p",
    fix: "do it",
    code: "E1-X",
    raw: "r",
    logLine: 3,
  });
  assertEquals(PROBLEM_LEVELS, ["fail", "warn", "action", "pending"]);
  fc.assert(
    fc.property(fc.array(LEVELS), (levels) => {
      const ps: Problem[] = levels.map((l) => problem(l, "m"));
      const c = countsOf(ps);
      assertEquals(c.fail + c.warn + c.pending + c.action, ps.length);
      for (const l of PROBLEM_LEVELS) assertEquals(ofLevel(ps, l).length, c[l]);
    }),
  );
});

proves(["0002-headless-governance FR-008"], "a stable code is E or P then upper-case words, and each level has a generic code that a program may replace", () => {
  for (const ok of ["E105-DISK", "P000-WAITING", "E-X", "E047-HOST-KEY", "P-WAITING-2"]) assert(isProblemCode(ok), ok);
  for (const bad of ["e105-disk", "X105-DISK", "E105", "E105-", "E105-disk", "", "E 105-DISK", 7, undefined]) assert(!isProblemCode(bad), String(bad));
  assert(isPendingCode("P000-WAITING") && !isPendingCode("E000-FAILED"));
  for (const l of PROBLEM_LEVELS) {
    assert(isProblemCode(DEFAULT_GENERIC_CODES[l]));
    assertEquals(isPendingCode(DEFAULT_GENERIC_CODES[l]), l === "pending");
  }
  assertEquals(withCode(problem("fail", "x")).code, "E000-FAILED");
  assertEquals(withCode(problem("fail", "x", { code: "E9-Y" })).code, "E9-Y");
  assertEquals(withCode(problem("action", "x"), { ...DEFAULT_GENERIC_CODES, action: "E105-YOURS" }).code, "E105-YOURS");
});

proves(["0002-headless-governance FR-009"], "the exit table: every status has one name, every name one status and a meaning; the ranges are the ones decided", () => {
  const table: [ExitName, number][] = [
    ["ok", 0],
    ["findings", 1],
    ["usage", 2],
    ["environment", 3],
    ["pending", 4],
    ["startup-usage", 64],
    ["startup-unavailable", 69],
    ["startup-software", 70],
    ["startup-osfile", 72],
    ["startup-config", 78],
    ["interrupted", 130],
    ["terminated", 143],
  ];
  assertEquals(
    EXIT_NAMES.map((n) => [n, exitCodeOf(n)]),
    table,
  );
  assertEquals(new Set(EXIT_NAMES.map(exitCodeOf)).size, EXIT_NAMES.length);
  for (const [n, c] of table) {
    assertEquals(exitNameOf(c), n);
    assert(exitMeaning(n).length > 10, n);
  }
  for (const c of [5, 6, 11, 63, 65, 127, 129, 255, -1]) assertEquals(exitNameOf(c), undefined, String(c));
  assertEquals([exitOfSignal("SIGINT"), exitOfSignal("SIGTERM")], [130, 143]);
  // the launcher's old statuses 4 to 11 are free of meaning but pending, and the startup range is above every verdict
  assert(EXIT_NAMES.filter((n) => n.startsWith("startup-")).every((n) => exitCodeOf(n) >= 64 && exitCodeOf(n) <= 78));
});

proves(["0002-headless-governance FR-010"], "a run ends with findings where anything failed, pending only where asked, else ok; a warning never changes it", () => {
  const none = { fail: 0, warn: 0, pending: 0, action: 0 };
  assertEquals(exitOfRun(none), 0);
  assertEquals(exitOfRun({ ...none, warn: 3, action: 2 }), 0);
  assertEquals(exitOfRun({ ...none, warn: 3, action: 2 }, { pending: "pending" }), 0);
  assertEquals(exitOfRun({ ...none, pending: 1 }), 0);
  assertEquals(exitOfRun({ ...none, pending: 1 }, { pending: "pending" }), 4);
  assertEquals(exitOfRun({ ...none, fail: 1, pending: 1 }, { pending: "pending" }), 1);
  fc.assert(
    fc.property(fc.nat(5), fc.nat(5), fc.nat(5), fc.nat(5), fc.constantFrom<"ok" | "pending">("ok", "pending"), (fail, warn, pending, action, pol) => {
      const code = exitOfRun({ fail, warn, pending, action }, { pending: pol });
      assertEquals(code === 1, fail > 0);
      assertEquals(code === 4, fail === 0 && pending > 0 && pol === "pending");
      assertEquals(code === 0, fail === 0 && !(pending > 0 && pol === "pending"));
    }),
  );
});

proves(["0002-headless-governance FR-011"], "redaction masks URL passwords, secret settings and given secrets, longest first, and leaves other text alone", () => {
  assertEquals(redact("connect postgres://app:hunter22@db:5432/x failed"), "connect postgres://app:***@db:5432/x failed");
  assertEquals(redact("password=hunter22 host=db"), "password=*** host=db");
  // a key is secret only where the program declares it; a line that merely looks like KEY: text is prose
  assertEquals(redact('token: "abc def" next'), 'token: "abc def" next');
  assertEquals(redact("API_KEY=sk-123456 and PASSPHRASE='a b'"), "API_KEY=sk-123456 and PASSPHRASE='a b'");
  assertEquals(redact("API_KEY=sk-123456 and PASSPHRASE='a b'", [], { keys: ["API_KEY", "PASSPHRASE"] }), "API_KEY=*** and PASSPHRASE=***");
  assertEquals(redact('{"APP_TOKEN": "abc", "other": "x"}', [], { keys: ["APP_TOKEN"] }), '{"APP_TOKEN": "***", "other": "x"}');
  assertEquals(redact("my.APP_TOKEN=abc"), "my.APP_TOKEN=abc", "undeclared");
  assertEquals(redact("the key is s3cr3t-value-1 and s3cr3t-value", ["s3cr3t-value", "s3cr3t-value-1"]), `the key is ${MASK} and ${MASK}`);
  assertEquals(redact("abc and ab", ["abc", "ab"]), "abc and ab");
  assertEquals(redact("nothing secret here, at all"), "nothing secret here, at all");
  assertEquals(redactor(["hunter22"])("x hunter22 y"), "x *** y");
  assertEquals(passwordOf("postgres://app:p%40ss@db/x"), "p@ss");
  assertEquals([passwordOf(undefined), passwordOf("not a url"), passwordOf("postgres://app@db/x")], [undefined, undefined, undefined]);
  // idempotent, and never leaves a given secret, whatever surrounds it
  fc.assert(
    fc.property(fc.string({ minLength: 4, maxLength: 12 }).filter((s) => !s.includes("*")), fc.string(), fc.string(), (secret, before, after) => {
      const once = redact(`${before}${secret}${after}`, [secret]);
      assertEquals(redact(once, [secret]), once);
      assertNotEquals(once.includes(secret), true);
    }),
  );
});
