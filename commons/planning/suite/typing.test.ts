/**
 * Planning is typed as an algebra and its governance and logical code is pure (commons planning 0002-planning-core FR-008, FR-009): no `any`, no non-null assertion, no `enum`, no cast but `brand`, every field
 * `readonly`, every optional field exact, every `switch` ending in `default`; no import of a system module and no clock or random source. The files that must not compile are `@ts-expect-error` lines, which the
 * compiler of `verify` holds: one that stopped being an error is an error of its own.
 *
 * @module
 */
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import * as records from "@intellectual-frontiers/planning/records";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type Actor, type EventHead, type Item, type OpenedData, type Policy } from "@intellectual-frontiers/planning/governance";
import { fold, mintEventId, newClock, uuid7OfExternal } from "@intellectual-frontiers/planning/logical";
import { ADA, eventIds, history, itemId, must, REPLICA, SAMPLES, WALL } from "./support.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");

/** The files of a folder and the folders below it. */
function files(dir: string): readonly string[] {
  return readDirSync(dir).flatMap((e) => (e.isDirectory ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
}

/** A source with its comments and the text of its strings taken out, so that only code is left. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/\/(?:\\.|[^/\\\n])+\/[a-z]*(?=[,;).\s])/g, "/re/");
}

const PURE = [...files(join(ROOT, "src", "governance")), ...files(join(ROOT, "src", "logical"))];

proves(["0002-planning-core FR-009", "0003-planning-reconcile FR-014"], "the governance and logical sources hold no any, no non-null assertion, no enum and no cast but the one brand", () => {
  assert(PURE.length >= 19, "the sources were found");
  for (const file of PURE) {
    const text = code(readTextFileSync(file));
    const where = file.slice(ROOT.length);
    assertEquals(text.match(/(?::|<|\bas|\||,)\s*any\b/g) ?? [], [], `${where} has no any`);
    assertEquals(text.match(/[\w)\]]!(?!=)/g) ?? [], [], `${where} has no non-null assertion`);
    assertEquals(text.match(/\benum\s+\w/g) ?? [], [], `${where} has no enum`);
    const lines = text.split("\n").filter((l) => !/^\s*(import|export)\b.*\bfrom\b/.test(l) && !/^\s*export \* as\b/.test(l));
    const casts = lines.flatMap((l) => l.match(/\bas\s+(?!const\b)\S+/g) ?? []);
    assertEquals(casts, file.endsWith("brand.ts") ? ["as Brand<T,"] : [], `${where} has no cast but brand`);
  }
});

proves(["0002-planning-core FR-009"], "every switch of the sources ends in a default, and each over a union of cases ends in absurd", () => {
  let switches = 0;
  for (const file of PURE) {
    const text = code(readTextFileSync(file));
    const count = (text.match(/\bswitch\s*\(/g) ?? []).length;
    switches += count;
    assert((text.match(/\bdefault:/g) ?? []).length >= count, `${file.slice(ROOT.length)}: every switch has a default`);
  }
  assert(switches >= 10, "the sources have switches");
  const withAbsurd = PURE.filter((f) => /default:\s*(?:\{[^}]*)?return absurd\(/.test(code(readTextFileSync(f))));
  assert(withAbsurd.length >= 3, "the unions are closed by absurd");
});

proves(["0002-planning-core FR-009"], "the compiler is held to erasable syntax and exact optional properties, every field is readonly and an optional field takes no undefined", () => {
  const base = JSON.parse(readTextFileSync(join(ROOT, "..", "tsconfig.base.json"))) as { compilerOptions: Record<string, unknown> };
  assertEquals([base.compilerOptions["strict"], base.compilerOptions["exactOptionalPropertyTypes"], base.compilerOptions["erasableSyntaxOnly"], base.compilerOptions["noUncheckedIndexedAccess"]], [true, true, true, true]);
  const e = history(itemId(), "declared", 0, [])[0];
  if (e === undefined) throw new Error("an opening");
  const opened: OpenedData = { type: "opened", kind: "issue", title: "T", body: "", labels: [], assignees: [], origin: "declared", severity: "note" };
  // Each line below is checked by the compiler and never run.
  const never = (): void => {
    // @ts-expect-error a field of an event is readonly
    e.id = e.id;
    // @ts-expect-error a field of an actor is readonly
    ADA.name = "Ada";
    // @ts-expect-error a list of an event is readonly and cannot be pushed to
    opened.labels.push("x");
  };
  assert(typeof never === "function");
  // @ts-expect-error an optional field is exact: it is absent or a severity, never undefined
  const exact: OpenedData = { ...opened, severity: undefined };
  const head: Pick<EventHead, "external"> = {};
  // @ts-expect-error an optional list of external ids is absent or a list, never undefined
  const exactHead: Pick<EventHead, "external"> = { external: undefined };
  // @ts-expect-error a policy's authority is one of the four, not any text
  const policy: Policy = { authority: { title: "anyone" }, confirmers: "any-person" };
  assertEquals([exact.type, exactHead.external, head.external, policy.confirmers], ["opened", undefined, undefined, "any-person"]);
});

proves(["0002-planning-core FR-009"], "an item, an actor and an id that were not made by their constructors do not compile", () => {
  // @ts-expect-error an item of no kind does not compile
  const noKind: Item = { id: itemId(), title: "T" };
  // @ts-expect-error an actor of a kind outside the three does not compile
  const robot: Actor = { kind: "robot", id: "r", name: "R" };
  assertEquals([typeof noKind, robot.kind], ["object", "robot"]);
  assertEquals(Object.keys(SAMPLES).length, 14);
});

const FORBIDDEN_IMPORTS = [/from\s+"node:/, /from\s+"@intellectual-frontiers\/system/, /from\s+"@intellectual-frontiers\/telemetry/, /require\(/, /\bimport\(/];
const FORBIDDEN_GLOBALS = [/\bDate\.now\s*\(/, /\bnew\s+Date\s*\(\s*\)/, /\bMath\.random\b/, /\bperformance\b/, /\bgetRandomValues\b/, /\brandomUUID\b/, /\bfetch\s*\(/, /\bprocess\./, /\bBun\./, /\bsetTimeout\b/, /\bsetInterval\b/, /\bconsole\./, /\bglobalThis\b/];

proves(["0002-planning-core FR-008", "0003-planning-reconcile FR-014"], "the governance and logical sources import no module of the system, read no clock, use no random source and make no call out", () => {
  for (const file of PURE) {
    const text = code(readTextFileSync(file));
    const where = file.slice(ROOT.length);
    for (const re of FORBIDDEN_IMPORTS) assert(!re.test(text), `${where} does not match ${re}`);
    for (const re of FORBIDDEN_GLOBALS) assert(!re.test(text), `${where} does not match ${re}`);
  }
  const imports = new Set(
    PURE.flatMap((f) => [...readTextFileSync(f).matchAll(/^\s*(?:import|export)\b[^"']*?from\s+"([^"]+)"/gm)].map((m) => m[1] ?? "")).filter((m) => m.startsWith("@")),
  );
  assertEquals(
    [...imports].sort(),
    [
      "@intellectual-frontiers/anyfs/governance",
      "@intellectual-frontiers/anyfs/merge",
      "@intellectual-frontiers/core",
      "@intellectual-frontiers/crypto/sha256",
      "@intellectual-frontiers/formats/json5",
      "@intellectual-frontiers/planning/governance",
      "@intellectual-frontiers/planning/logical",
    ],
  );
});

proves(["0002-planning-core FR-008"], "the work of the library runs with the clock, the random source and the network taken away: the time is an argument", async () => {
  const realNow = Date.now;
  const RealDate = Date;
  const realRandom = Math.random;
  const realFetch = globalThis.fetch;
  const boom = (what: string) => (): never => {
    throw new Error(`${what} was called`);
  };
  class NoClockDate extends RealDate {
    constructor(...args: [] | [string | number | Date]) {
      if (args.length === 0) boom("new Date()")();
      super(...(args as [string | number | Date]));
    }
    static override now(): number {
      return boom("Date.now")();
    }
  }
  let pending: Promise<string> | undefined;
  try {
    Date.now = boom("Date.now");
    Math.random = boom("Math.random");
    globalThis.fetch = boom("fetch") as unknown as typeof fetch;
    globalThis.Date = NoClockDate as unknown as DateConstructor;
    const ids = eventIds(5);
    const events = history(itemId(), "declared", 0, [{ type: 1, actor: 0, a: "alpha", b: "beta", other: 1 }, { type: 9, actor: 1, a: "alpha", b: "beta", other: 0 }]);
    const item = must(fold(events));
    assertEquals(item.state.kind, "closed");
    const minted = must(mintEventId(newClock(REPLICA), WALL));
    assert(ids.length === 5 && minted.id.length === 36);
    assertEquals(must(records.decodeEvent(records.encodeEvent(events[0] as (typeof events)[number]))).id, events[0]?.id);
    // started with the clock taken away; awaited after it is given back, so that no other test runs without a clock
    pending = uuid7OfExternal("s", "v", 1);
  } finally {
    // the global is given back first: `Date.now` is the property of whichever class `Date` names at that moment
    globalThis.Date = RealDate;
    Date.now = realNow;
    Math.random = realRandom;
    globalThis.fetch = realFetch;
  }
  assertEquals((await pending)?.length, 36);
});
