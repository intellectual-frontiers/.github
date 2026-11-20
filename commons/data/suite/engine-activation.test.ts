// Spec: 0002-engine FR-008, FR-009
/**
 * Activation (commons data 0002-engine FR-008, FR-009): the extensions that are not lazy start in order, a lazy one loads and activates once when an event starts it and
 * after what it requires, a failure comes back as a value and stays, and an extension reaches only the handles it declared and the project provided.
 *
 * @module
 */
import { assert, assertEquals as strictEquals, proves } from "@intellectual-frontiers/test";

/** Deep equality of values whose types differ only by a brand: the expected side is written as plain text. */
const assertEquals: (actual: unknown, expected: unknown, message?: string) => void = strictEquals;
import {
  compose,
  type Composition,
  contribute,
  defineExtension,
  type Entry,
  type ExtensionId,
  extensionId,
  type EventName,
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
const composed = (entries: readonly Entry[], provided: Parameters<typeof compose>[1] = {}): Composition => {
  const r = compose(entries, provided);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const DIALECT: EventName = "onDialect:postgres";

proves(["0002-engine FR-008"], "start activates the extensions that are not lazy, in order, once each", async () => {
  const log: string[] = [];
  const mk = (name: string, requires: readonly string[] = []): Entry =>
    defineExtension({ id: id(name), version: "1.0.0", requires: requires.map(id), activate: () => void log.push(name) });
  const c = composed([mk("a", ["b"]), mk("b")]);
  assertEquals(c.activated(), []);
  assertEquals(await c.start(), { kind: "ok", value: ["b", "a"] });
  assertEquals(log, ["b", "a"]);
  assertEquals(await c.start(), { kind: "ok", value: [] }, "a second start activates nothing");
  assertEquals(log, ["b", "a"]);
  assertEquals(c.activated(), ["b", "a"]);
});

proves(
  ["0002-engine FR-008"],
  "a lazy extension is loaded and activated only when its event is fired, and its contributions appear then",
  async () => {
    let loads = 0;
    const lazy = lazyExtension({
      id: id("lazy"),
      version: "1.0.0",
      events: [DIALECT],
      load: () => {
        loads++;
        return Promise.resolve(defineExtension({ id: id("lazy"), version: "1.0.0", contributes: [contribute(terms, { term: "late" })] }));
      },
    });
    const eager = defineExtension({ id: id("eager"), version: "1.0.0", contributes: [contribute(terms, { term: "early" })] });
    const c = composed([lazy, eager]);
    assertEquals(c.contributions(terms), [{ term: "early" }]);
    assertEquals(await c.start(), { kind: "ok", value: ["eager"] });
    assertEquals([loads, c.contributions(terms)], [0, [{ term: "early" }]]);
    assertEquals(await c.fire("onDialect:sqlite"), { kind: "ok", value: [] });
    assertEquals(loads, 0, "another event loads nothing");
    assertEquals(await c.fire(DIALECT), { kind: "ok", value: ["lazy"] });
    assertEquals([loads, c.contributions(terms)], [1, [{ term: "late" }, { term: "early" }]]);
    assertEquals(await c.fire(DIALECT), { kind: "ok", value: [] });
    assertEquals(loads, 1, "fired again, it is not loaded again");
  },
);

proves(["0002-engine FR-008"], "two events at once load and activate a lazy extension once", async () => {
  let loads = 0;
  let activations = 0;
  const lazy = lazyExtension({
    id: id("lazy"),
    version: "1.0.0",
    events: [DIALECT, "onGenerate:rust"],
    load: async () => {
      loads++;
      await Promise.resolve();
      return defineExtension({ id: id("lazy"), version: "1.0.0", activate: () => void activations++ });
    },
  });
  const c = composed([lazy]);
  const [a, b] = await Promise.all([c.fire(DIALECT), c.fire("onGenerate:rust")]);
  assertEquals([a.kind, b.kind, loads, activations], ["ok", "ok", 1, 1]);
  assertEquals(c.activated(), ["lazy"]);
});

proves(["0002-engine FR-008"], "a lazy extension is activated after what it requires, even what is lazy or not yet started", async () => {
  const log: string[] = [];
  const base = defineExtension({ id: id("base"), version: "1.0.0", activate: () => void log.push("base") });
  const middle = lazyExtension({
    id: id("middle"),
    version: "1.0.0",
    requires: [id("base")],
    events: ["onMiddle:x"],
    load: () => Promise.resolve(defineExtension({ id: id("middle"), version: "1.0.0", activate: () => void log.push("middle") })),
  });
  const top = lazyExtension({
    id: id("top"),
    version: "1.0.0",
    requires: [id("middle")],
    events: [DIALECT],
    load: () => Promise.resolve(defineExtension({ id: id("top"), version: "1.0.0", activate: () => void log.push("top") })),
  });
  const c = composed([top, middle, base]);
  assertEquals(await c.fire(DIALECT), { kind: "ok", value: ["base", "middle", "top"] });
  assertEquals(log, ["base", "middle", "top"]);
});

proves(
  ["0002-engine FR-008"],
  "a load with another identifier, a load that fails and an activate that throws come back as values, and stay failed",
  async () => {
    let loads = 0;
    const wrong = lazyExtension({
      id: id("wrong"),
      version: "1.0.0",
      events: [DIALECT],
      load: () => Promise.resolve(defineExtension({ id: id("other"), version: "1.0.0", contributes: [contribute(terms, { term: "no" })] })),
    });
    const broken = lazyExtension({
      id: id("broken"),
      version: "1.0.0",
      events: ["onBroken:x"],
      load: () => Promise.reject(new Error("no such module")),
    });
    const throws = lazyExtension({
      id: id("throws"),
      version: "1.0.0",
      events: ["onThrows:x"],
      load: () => {
        loads++;
        return Promise.resolve(
          defineExtension({
            id: id("throws"),
            version: "1.0.0",
            contributes: [contribute(terms, { term: "never" })],
            activate: () => {
              throw new Error("boom");
            },
          }),
        );
      },
    });
    const c = composed([wrong, broken, throws]);
    assertEquals(await c.fire(DIALECT), { kind: "err", error: [{ kind: "mismatch", id: "wrong", loaded: "other" }] });
    assertEquals(await c.fire("onBroken:x"), { kind: "err", error: [{ kind: "failed", id: "broken", message: "no such module" }] });
    assertEquals(await c.fire("onThrows:x"), { kind: "err", error: [{ kind: "failed", id: "throws", message: "boom" }] });
    assertEquals(await c.fire("onThrows:x"), { kind: "err", error: [{ kind: "failed", id: "throws", message: "boom" }] });
    assertEquals([loads, c.activated(), c.contributions(terms)], [1, [], []]);
  },
);

proves(
  ["0002-engine FR-009"],
  "activate can use only the handles the manifest declared and the project provided, typed by the handle",
  async () => {
    const config = handle<{ readonly dialect: string }>("physical.config");
    const secret = handle<string>("physical.secret");
    const seen: string[] = [];
    const e = defineExtension({
      id: id("user"),
      version: "1.0.0",
      uses: [config],
      activate: (context) => {
        const got = context.use(config);
        if (got.kind === "ok") {
          const dialect: string = got.value.dialect;
          seen.push(dialect);
        }
        seen.push(JSON.stringify(context.use(secret)));
      },
    });
    const c = composed([e], { provided: [provide(config, { dialect: "postgres" }), provide(secret, "s3cret")] });
    await c.start();
    assertEquals(seen, ["postgres", '{"kind":"err","error":{"kind":"undeclared","handle":"physical.secret"}}']);
    // @ts-expect-error a handle's value is typed by it
    provide(config, "postgres");
  },
);

proves(
  ["0002-engine FR-009"],
  "a lazy extension that declares a handle the project did not provide is not activated, and says which",
  async () => {
    const config = handle<number>("physical.config");
    const lazy = lazyExtension({
      id: id("lazy"),
      version: "1.0.0",
      events: [DIALECT],
      load: () =>
        Promise.resolve(
          defineExtension({ id: id("lazy"), version: "1.0.0", uses: [config], contributes: [contribute(terms, { term: "x" })] }),
        ),
    });
    const c = composed([lazy]);
    assertEquals(await c.fire(DIALECT), {
      kind: "err",
      error: [{ kind: "handle", id: "lazy", error: { kind: "unprovided", handle: "physical.config" } }],
    });
    assert(c.activated().length === 0 && c.contributions(terms).length === 0);
  },
);
