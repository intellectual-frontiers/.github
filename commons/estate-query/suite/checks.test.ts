/**
 * Tests of policy as SQL (commons estate-query 0004-estate-query-checks): a check over the estate is a check of `grc` run by its `sql` runner, passes where its rows are as expected and fails with their number where they are not, a statement that changes anything or a name that is not there is an `error` with the reasons and never a pass, one that fails does not stop the others,
 * and what is written that is not a check is refused with the path. Every name is made up.
 *
 * @module
 */
import { CAPABILITIES, defineAsset, type Asset } from "@intellectual-frontiers/estate/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { openEstateQuery, type EstateData } from "../src/logical/mod.ts";
import { checkOf, estateConnection, runEstateChecks } from "../src/physical/mod.ts";

function asset(id: string, state: "adopted" | "managed", without: readonly string[] = []): Asset {
  const owners = state === "managed" ? Object.fromEntries(CAPABILITIES.filter((c) => !without.includes(c)).map((c) => [c, "synth"])) : { observe: "synth", verify: "synth" };
  const r = defineAsset({ id, kind: "server", state, ...(without.includes("provision") ? { origin: "paired" as const } : {}), owners });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

const NOW = "2026-12-01T00:00:00Z";
const DATA: EstateData = {
  assets: [asset("synthetic-server-02", "managed"), asset("synthetic-server-03", "managed", ["provision"]), asset("synthetic-server-04", "adopted")],
  observations: [{ asset: "synthetic-server-02", observation: { at: "2026-11-30T00:00:00Z", source: "probe", state: {} } }],
  results: [{ asset: "synthetic-server-02", id: "firewall", status: "fail", controls: ["SC-7"] }],
  truths: [{ asset: "synthetic-server-02", state: "managed", observedAt: "2026-11-30T00:00:00Z", currency: "fresh", difference: null, agrees: true, alignment: "aligned", source: "probe" }, { asset: "synthetic-server-03", state: "managed", observedAt: null, currency: "never-observed", difference: null, agrees: false, alignment: "not-observed", source: null }],
  now: NOW,
};

const check = (id: string, sql: string, more: Record<string, unknown> = {}) => {
  const c = checkOf({ id, ask: `Is ${id} true?`, sql, controls: ["urn:grc:nist-sp800-53:5.2.0:CM-8"], ...more }, NOW);
  if (c.kind === "err") throw new Error(c.error);
  return c.value;
};

proves(["0004-estate-query-checks FR-001"], "the estate is a connection that reads, answers as rows that are objects of the columns, and fails with the reasons for a statement it refuses", async () => {
  const conn = estateConnection(openEstateQuery(DATA));
  assertEquals(conn.readOnly, true);
  assertEquals(await conn.query("select id, state from asset where state = ? order by id", ["adopted"]), [{ id: "synthetic-server-04", state: "adopted" }]);
  let message = "";
  try {
    await conn.query("delete from asset", []);
  } catch (e) {
    message = (e as Error).message;
  }
  assert(message !== "", "a statement that changes something is refused");
});

proves(["0004-estate-query-checks FR-002"], "a check is made of a statement, a question and controls with the expectation none by default, and what is not a check is refused with the path", () => {
  const c = check("every-managed-asset-is-observed", "select id from asset where state = 'managed' and id not in (select asset from observation)");
  assertEquals([c.runner.kind, c.expect, c.controls.length], ["sql", { kind: "empty" }, 1]);
  const bad = checkOf({ id: "Not An Id!", ask: "x", sql: "select 1", freshness: "tomorrow" }, NOW);
  assert(bad.kind === "err" && bad.error.includes("is not valid"), JSON.stringify(bad));
});

proves(["0004-estate-query-checks FR-003"], "a check passes where its rows are as expected and fails with their number where they are not, a refused statement is an error and never a pass, and one that fails does not stop the others", async () => {
  const q = openEstateQuery(DATA);
  const checks = [
    check("no-managed-asset-lacks-converge-owner", "select asset from capability where capability = 'converge' and not offered and asset in (select id from asset where state = 'managed')"),
    check("every-managed-asset-is-observed", "select id from asset where state = 'managed' and id not in (select asset from observation)"),
    check("some-asset-is-adopted", "select id from asset where state = 'adopted'", { expect: { kind: "non-empty" } }),
    check("no-asset-is-stale", "select asset from truth where currency in ('stale', 'never-observed') and asset = ?", { params: ["synthetic-server-02"] }),
    check("a-statement-that-deletes", "delete from asset"),
    check("a-name-that-is-not-there", "select * from assets"),
    check("an-inherited-asset-has-no-provision", "select asset from capability where capability = 'provision' and offered and asset in (select id from asset where install = 'inherited')"),
  ];
  const before = JSON.stringify(DATA);
  const results = await runEstateChecks(checks, q, () => NOW);
  const byCheck = Object.fromEntries(results.map((r) => [String(r.check), [r.status, r.reason]]));
  assertEquals(results.length, checks.length);
  assertEquals(byCheck["no-managed-asset-lacks-converge-owner"]?.[0], "pass");
  assertEquals(byCheck["every-managed-asset-is-observed"]?.[0], "fail");
  assert(String(byCheck["every-managed-asset-is-observed"]?.[1]).includes("1 rows"), String(byCheck["every-managed-asset-is-observed"]?.[1]));
  assertEquals(byCheck["some-asset-is-adopted"]?.[0], "pass");
  assertEquals(byCheck["no-asset-is-stale"]?.[0], "pass", "a value given apart is a value");
  assertEquals(byCheck["a-statement-that-deletes"]?.[0], "error");
  assertEquals(byCheck["a-name-that-is-not-there"]?.[0], "error");
  assertEquals(byCheck["an-inherited-asset-has-no-provision"]?.[0], "pass");
  assertEquals(JSON.stringify(DATA), before, "no check changed the estate");
});
