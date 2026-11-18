// Spec: 0002-engine FR-003, FR-004
/**
 * The manifest of an extension (commons data 0002-engine FR-003, FR-004): an identifier is checked, a manifest is frozen data with the engine's contract by default, and a
 * contribution of another type than its point's does not compile, which the compiler checks where this file is compiled and the lines marked `@ts-expect-error` say.
 *
 * @module
 */
import { assert, assertEquals as strictEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

/** Deep equality of values whose types differ only by a brand: the expected side is written as plain text. */
const assertEquals: (actual: unknown, expected: unknown, message?: string) => void = strictEquals;
import {
  CONTRACT,
  contribute,
  defineExtension,
  type ExtensionId,
  extensionId,
  lazyExtension,
  point,
} from "@intellectual-frontiers/data/engine";

const idOf = (text: string): ExtensionId => {
  const r = extensionId(text);
  if (r.kind === "err") throw new Error(`not an identifier: ${text}`);
  return r.value;
};

proves(["0002-engine FR-003"], "an identifier is lower-case words joined by - or ., and anything else is an error value", () => {
  for (const ok of ["privacy", "sql.documentation", "gen-rust", "a1", "a.b-c.d"]) assertEquals(extensionId(ok).kind, "ok", ok);
  for (const bad of ["", "Privacy", "1a", "a..b", "a_b", "a b", "-a", "a-", ".a", "a."]) {
    assertEquals(extensionId(bad), { kind: "err", error: { kind: "id", text: bad } }, bad);
  }
});

proves(["0002-engine FR-003"], "a manifest is frozen data with the engine's contract and empty lists by default", () => {
  const e = defineExtension({ id: idOf("privacy"), version: "1.0.0" });
  assertEquals([e.id, e.version, e.contract, e.requires, e.contributes, e.uses], ["privacy", "1.0.0", CONTRACT, [], [], []]);
  assert(Object.isFrozen(e) && Object.isFrozen(e.requires) && Object.isFrozen(e.contributes));
  assertEquals("activate" in e, false);
  const f = defineExtension({ id: idOf("x"), version: "0.1.0", contract: 7, requires: [idOf("privacy")], activate: () => undefined });
  assertEquals([f.contract, f.requires, typeof f.activate], [7, ["privacy"], "function"]);
});

proves(["0002-engine FR-003", "0002-engine FR-008"], "a lazy entry holds what the engine must know before it loads, and its loader", () => {
  const e = lazyExtension({
    id: idOf("gen-rust"),
    version: "1.0.0",
    events: ["onGenerate:rust"],
    load: () => Promise.reject(new Error("not yet")),
  });
  assertEquals([e.lazy, e.id, e.contract, e.requires, e.events], [true, "gen-rust", CONTRACT, [], ["onGenerate:rust"]]);
  assert(Object.isFrozen(e) && Object.isFrozen(e.events));
});

proves(["0002-engine FR-004"], "a contribution is typed by its point, and a value of another type does not compile", () => {
  const terms = point<{ readonly term: string }>("governance.vocabulary");
  const count = point<number>("governance.count");
  const c = contribute(terms, { term: "email" });
  assertEquals([c.point, c.value], ["governance.vocabulary", { term: "email" }]);
  assert(Object.isFrozen(c));
  // @ts-expect-error a string is not a vocabulary term
  const wrong = contribute(terms, "email");
  // @ts-expect-error a term is not a number
  const wrong2 = contribute(count, { term: "email" });
  assertEquals([wrong.point, wrong2.point], ["governance.vocabulary", "governance.count"]);
  const e = defineExtension({ id: idOf("privacy"), version: "1.0.0", contributes: [c, contribute(count, 3)] });
  assertEquals(
    e.contributes.map((x) => x.point),
    ["governance.vocabulary", "governance.count"],
  );
});
