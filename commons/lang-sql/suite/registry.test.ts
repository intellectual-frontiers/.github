/**
 * The registry of dialects (commons lang-sql 0007-sql-emit FR-006 to FR-008): a dialect made outside the library registered by name, with a catalog of functions that a dialect inherits from the one it extends.
 *
 * Spec: 0007-sql-emit FR-006, FR-007, FR-008
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansi, createRegistry, declareDialect, describeRegistryError, type FunctionSpec } from "@intellectual-frontiers/lang-sql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as redshift } from "@intellectual-frontiers/lang-sql/dialects/redshift";

const mine = declareDialect({ name: "AnyFS", extends: ansi, lexical: (l) => ({ ...l, comments: [...l.comments, { kind: "line", marker: "#" }] }) });
const spec = (name: string, minArgs = 1, maxArgs: number | undefined = 1, aggregate = false): FunctionSpec => ({ name, minArgs, maxArgs, aggregate });

proves(["0007-sql-emit FR-006"], "a registry holds ansi, adds a dialect found by name without regard to case, refuses a name taken or a parent that is not registered, and takes the same dialect twice", () => {
  const r = createRegistry();
  assertEquals(r.names(), ["ansi"]);
  assert(r.get("ANSI") === ansi);
  assert(r.register(mine).kind === "ok");
  assert(r.get("anyfs") === mine && r.get("ANYFS") === mine);
  assertEquals(r.names(), ["ansi", "AnyFS"]);
  assert(r.register(mine).kind === "ok");
  assertEquals(r.names(), ["ansi", "AnyFS"], "the same dialect twice changes nothing");
  const other = declareDialect({ name: "anyfs", extends: ansi, lexical: (l) => l });
  const taken = r.register(other);
  assert(taken.kind === "err" && taken.error.kind === "name-taken");
  assertEquals(describeRegistryError(taken.error), "a dialect named anyfs is registered already");
  const orphan = r.register(redshift);
  assert(orphan.kind === "err" && orphan.error.kind === "unknown-parent" && orphan.error.parent === "postgres");
  assertEquals(describeRegistryError(orphan.error), "redshift extends postgres, which is not registered");
  assert(r.register(postgres).kind === "ok" && r.register(redshift).kind === "ok");
  assertEquals(r.names(), ["ansi", "AnyFS", "postgres", "redshift"]);
  assertEquals(r.get("nothing"), undefined);
  assert(createRegistry().get("anyfs") === undefined, "a registry is its own");
});

proves(["0007-sql-emit FR-007"], "functions are registered per dialect, found without regard to case in the dialect and then in those it extends, and a function that cannot be is an error value that changes nothing", () => {
  const r = createRegistry();
  r.register(mine);
  assertEquals(r.lookupFunction("anyfs", "COUNT")?.aggregate, true, "ansi's count is inherited");
  const added = r.registerFunctions("anyfs", [spec("path_of"), { name: "count", minArgs: 1, maxArgs: 3, aggregate: true, returns: "INT" }]);
  assert(added.kind === "ok" && added.value === 2);
  assertEquals(r.lookupFunction("AnyFS", "PATH_OF")?.name, "path_of");
  assertEquals(r.lookupFunction("anyfs", "count")?.maxArgs, 3, "a dialect's function replaces its parent's");
  assertEquals(createRegistry().lookupFunction("ansi", "path_of"), undefined);
  assertEquals(r.lookupFunction("ansi", "count")?.maxArgs, 1, "the parent is unchanged");
  assertEquals(r.lookupFunction("anyfs", "nope"), undefined);
  assertEquals(r.lookupFunction("unknown", "count"), undefined);
  const names = r.functionsOf("anyfs").map((f) => f.name.toLowerCase());
  assertEquals(new Set(names).size, names.length, "each name once");
  assert(names.includes("path_of") && names.includes("coalesce"));
  const bad = (f: FunctionSpec) => r.registerFunctions("anyfs", [spec("fine"), f]);
  for (const f of [spec(""), spec("x", 3, 1), spec("y", -1, 1)]) {
    const e = bad(f);
    assert(e.kind === "err" && e.error.kind === "bad-function");
  }
  assertEquals(r.lookupFunction("anyfs", "fine"), undefined, "nothing was added by a call that failed");
  const u = r.registerFunctions("nowhere", [spec("z")]);
  assert(u.kind === "err" && u.error.kind === "unknown-dialect");
  assertEquals(describeRegistryError(u.error), "nowhere is not registered");
  assertEquals(r.functionsOf("nowhere"), []);
});

proves(["0007-sql-emit FR-008"], "no function of the registry or of quoting throws for an unusual value", () => {
  const r = createRegistry();
  for (const v of ["", " ", "\0", "\ud800", "a".repeat(10000), "constructor", "__proto__", "toString"]) {
    r.get(v);
    r.lookupFunction("ansi", v);
    r.lookupFunction(v, v);
    r.functionsOf(v);
    r.registerFunctions(v, [spec(v)]);
  }
  assertEquals(r.lookupFunction("ansi", "__proto__"), undefined);
  assertEquals(r.lookupFunction("ansi", "constructor"), undefined);
});
