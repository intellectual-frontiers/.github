// Spec: 0002-engine FR-005, FR-006, FR-007
/**
 * Composition (commons data 0002-engine FR-005 to FR-007): nothing registers by being imported, the order satisfies `requires` and keeps the project's own order where it
 * does not decide, every mistake of a list comes back together as a value, and what a layer needs reaches it as the contributions of a point, in order.
 *
 * @module
 */
import { assert, assertEquals as strictEquals, proves } from "@intellectual-frontiers/test";

/** Deep equality of values whose types differ only by a brand: the expected side is written as plain text. */
const assertEquals: (actual: unknown, expected: unknown, message?: string) => void = strictEquals;
import {
  compose,
  type ComposeError,
  contribute,
  defineExtension,
  type Entry,
  type ExtensionId,
  extensionId,
  handle,
  lazyExtension,
  point,
  provide,
} from "@intellectual-frontiers/data/engine";

const id = (text: string): ExtensionId => {
  const r = extensionId(text);
  if (r.kind === "err") throw new Error(text);
  return r.value;
};
const terms = point<{ readonly term: string }>("governance.vocabulary");
const ext = (name: string, requires: readonly string[] = [], term?: string): Entry =>
  defineExtension({
    id: id(name),
    version: "1.0.0",
    requires: requires.map(id),
    contributes: term === undefined ? [] : [contribute(terms, { term })],
  });
const errorsOf = (entries: readonly Entry[], provided: Parameters<typeof compose>[1] = {}): readonly ComposeError[] => {
  const r = compose(entries, provided);
  if (r.kind === "ok") throw new Error("composed");
  return r.error;
};
const orderOf = (entries: readonly Entry[]): readonly string[] => {
  const r = compose(entries);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value.order;
};

// an extension defined at the top of a module: importing this file must register nothing
const defined = ext("defined", [], "from-a-module");

proves(["0002-engine FR-005"], "an extension defined in an imported module is in no composition until the project lists it", () => {
  assertEquals(orderOf([]), []);
  const empty = compose([]);
  assert(empty.kind === "ok");
  if (empty.kind === "ok") assertEquals(empty.value.contributions(terms), []);
  const listed = compose([defined]);
  assert(listed.kind === "ok");
  if (listed.kind === "ok") assertEquals(listed.value.contributions(terms), [{ term: "from-a-module" }]);
  const again = compose([]);
  assert(again.kind === "ok");
  if (again.kind === "ok") assertEquals(again.value.contributions(terms), [], "a second composition shares nothing with the first");
});

proves(["0002-engine FR-006"], "the order satisfies requires, and keeps the project's order where requires does not decide", () => {
  assertEquals(orderOf([ext("x"), ext("y"), ext("z")]), ["x", "y", "z"]);
  assertEquals(orderOf([ext("z"), ext("y"), ext("x")]), ["z", "y", "x"]);
  assertEquals(orderOf([ext("a", ["b"]), ext("b", ["c"]), ext("c")]), ["c", "b", "a"]);
  assertEquals(orderOf([ext("a", ["c"]), ext("b"), ext("c")]), ["c", "a", "b"]);
  assertEquals(orderOf([ext("top", ["left", "right"]), ext("left", ["base"]), ext("right", ["base"]), ext("base")]), [
    "base",
    "left",
    "right",
    "top",
  ]);
});

proves(
  ["0002-engine FR-006"],
  "a duplicate, a missing extension, a cycle and a contract the engine lacks are returned as values, and all together",
  () => {
    assertEquals(errorsOf([ext("a"), ext("a")]), [{ kind: "duplicate", id: "a" }]);
    assertEquals(errorsOf([ext("a", ["nope"])]), [{ kind: "missing", id: "nope", requiredBy: "a" }]);
    assertEquals(errorsOf([ext("a", ["b"]), ext("b", ["a"])]), [{ kind: "cycle", nodes: ["a", "b", "a"] }]);
    assertEquals(errorsOf([ext("a", ["a"])]), [{ kind: "cycle", nodes: ["a", "a"] }]);
    assertEquals(errorsOf([defineExtension({ id: id("old"), version: "1.0.0", contract: 0 })]), [
      { kind: "contract", id: "old", wanted: 0, have: 1 },
    ]);
    const lazyOld = lazyExtension({
      id: id("lazy-old"),
      version: "1.0.0",
      contract: 9,
      events: ["onX:y"],
      load: () => Promise.reject(new Error("never")),
    });
    assertEquals(errorsOf([lazyOld]), [{ kind: "contract", id: "lazy-old", wanted: 9, have: 1 }]);
    const together = errorsOf([ext("a"), ext("a"), ext("b", ["nope"]), ext("c", ["d"]), ext("d", ["c"])]);
    assertEquals(
      together.map((e) => e.kind),
      ["duplicate", "missing", "cycle"],
    );
  },
);

proves(
  ["0002-engine FR-006", "0002-engine FR-009"],
  "a handle that an extension uses and the project did not provide is returned, and one that it provided is not",
  () => {
    const h = handle<number>("physical.statements");
    const user = defineExtension({ id: id("user"), version: "1.0.0", uses: [h] });
    assertEquals(errorsOf([user]), [{ kind: "unprovided", id: "user", handle: "physical.statements" }]);
    assertEquals(compose([user], { provided: [provide(h, 1)] }).kind, "ok");
  },
);

proves(["0002-engine FR-007"], "what a layer needs reaches it as the contributions of a point, in the order of the composition", () => {
  const r = compose([ext("a", ["b"], "from-a"), ext("b", [], "from-b"), ext("c", [], "from-c"), ext("quiet")]);
  assert(r.kind === "ok");
  if (r.kind !== "ok") return;
  assertEquals(r.value.order, ["b", "a", "c", "quiet"]);
  const got: readonly { readonly term: string }[] = r.value.contributions(terms);
  assertEquals(got, [{ term: "from-b" }, { term: "from-a" }, { term: "from-c" }]);
  assertEquals(r.value.contributions(point<number>("governance.other")), []);
});
