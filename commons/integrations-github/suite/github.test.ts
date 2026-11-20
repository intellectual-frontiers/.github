/**
 * Tests of the reference connector (commons integrations-github 0001-integrations-github-connector FR-001 to FR-004): the conformance suite of Integrations over recorded,
 * made-up answers, the posture of an organization with and without the requirement, and a gap where the administrators are not readable.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parseInstant } from "@intellectual-frontiers/integrations/governance";
import { conformConnector, type Json, type ReadPort } from "@intellectual-frontiers/integrations/logical";
import { POLICIES, githubConnector, governanceFor } from "../src/mod.ts";

const NOW = (() => {
  const r = parseInstant("2026-11-20T10:00:00Z");
  if (r.kind === "err") throw new Error("instant");
  return r.value;
})();

/** A port that answers from made-up documents and lists; a path in `denied` is a 403. */
function port(docs: Record<string, Json>, lists: Record<string, readonly Json[]>, denied: readonly string[] = []): ReadPort {
  return {
    get: (p) => Promise.resolve(docs[p] === undefined ? err({ kind: "not-found" as const, subject: p }) : ok(docs[p])),
    pages: async function* (p) {
      const l = lists[p];
      if (denied.includes(p)) return err({ kind: "denied" as const, subject: p });
      if (l === undefined) return err({ kind: "not-found" as const, subject: p });
      yield* l;
      return ok(1);
    },
  };
}

const org = { login: "acme-labs", two_factor_requirement_enabled: true };
const repos = [
  { name: "alpha", private: true, archived: false, default_branch: "main", owner_email: "x@example.test", token_note: "nope" },
  { name: "beta", private: false, archived: false, default_branch: "main" },
];
const docs = { "/orgs/acme-labs": org };
const lists = { "/orgs/acme-labs/repos?per_page=100": repos, "/orgs/acme-labs/members?role=admin&per_page=100": [{ login: "ada" }] };

function connector() {
  const c = githubConnector("acme-labs");
  if (c.kind === "err") throw new Error(JSON.stringify(c.error));
  return c.value;
}

proves(["0001-integrations-github-connector FR-001"], "the governance is read-only, scoped, and valid", () => {
  const g = governanceFor("acme-labs");
  assert(g.kind === "ok");
  assertEquals(g.value.contract.writes, "never");
  assert(g.value.scope.grants.every((x) => x.access === "read"));
  assertEquals(g.value.credential.ref, "vault://github/acme-labs-read");
  assertEquals(connector().describe().readOnly, true);
});

proves(["0001-integrations-github-connector FR-002"], "the conformance suite of Integrations finds nothing", async () => {
  const c = connector();
  const found = await conformConnector(c, [
    { name: "an organization with two repositories", port: port(docs, lists), now: NOW, expect: { account: "acme-labs", posture: { repositories: 2, "public-repositories": 1, "two-factor-required": true }, labels: { code_repository: 2 }, policies: { "org-two-factor-required": "pass", "org-no-public-repositories": "warn" } } },
  ]);
  assertEquals(found, []);
});

proves(["0001-integrations-github-connector FR-003"], "the posture without the requirement fails its policy, and denied administrators are a gap", async () => {
  const c = connector();
  const lax = port({ "/orgs/acme-labs": { login: "acme-labs", two_factor_requirement_enabled: false } }, lists, ["/orgs/acme-labs/members?role=admin&per_page=100"]);
  const o = await c.observe({ port: lax, now: NOW });
  assert(o.kind === "ok");
  assertEquals(o.value.gaps, [{ kind: "denied", subject: "/orgs/acme-labs/members?role=admin&per_page=100" }]);
  const res = c.check(o.value, NOW);
  assertEquals(res.find((r) => r.id === "org-two-factor-required")?.status, "fail");
  assertEquals(POLICIES.map((p) => p.id).length, 3);
  const denied = await c.observe({ port: port({}, {}), now: NOW });
  assertEquals(denied.kind, "err");
});

proves(["0001-integrations-github-connector FR-004"], "no personal or secret field of a repository is kept", async () => {
  const o = await connector().observe({ port: port(docs, lists), now: NOW });
  assert(o.kind === "ok");
  const text = JSON.stringify(o.value);
  assert(!text.includes("owner_email") && !text.includes("token_note") && !text.includes("x@example.test"));
  assertEquals(o.value.entities?.accounts?.map((a) => a.id), ["ada"]);
});
