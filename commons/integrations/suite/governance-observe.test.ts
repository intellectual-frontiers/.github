/**
 * Tests of the governance of observation (commons integrations 0002-integrations-governance FR-004 to FR-009): classes, the read-only contract, scope, cadence,
 * credential spec, the denylist and the trust policy with its total pin decision.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  CONNECTOR_CLASSES,
  MAX_STALE_MS,
  cadence,
  credentialSpec,
  decidePin,
  denylistWith,
  durationMs,
  governanceProblems,
  instantOf,
  isDenied,
  isStale,
  parseCredentialRef,
  parseSha256,
  type TlsPolicy,
} from "../src/governance/mod.ts";
import { must, sampleGovernance } from "./world.ts";

proves(["0002-integrations-governance FR-004"], "the classes are a closed union, the contract says never", () => {
  assertEquals(CONNECTOR_CLASSES.length, 8);
  const g = sampleGovernance();
  assertEquals(g.contract.writes, "never");
  assertEquals(g.labels.serviceModels, ["SaaS"]);
  assertEquals(governanceProblems(g), []);
  assertEquals(governanceProblems(sampleGovernance({ class: "cloud", labels: { serviceModels: [], categories: [] } })).map((p) => p.kind), ["no-service-model"]);
});

proves(["0002-integrations-governance FR-005"], "a grant can only read, and no scope is a problem", () => {
  const g = sampleGovernance();
  assert(g.scope.grants.every((x) => x.access === "read"));
  assertEquals(governanceProblems(sampleGovernance({ scope: { grants: [] } })).map((p) => p.kind), ["no-scope"]);
});

proves(["0002-integrations-governance FR-006"], "cadence defaults, caps and staleness (property)", () => {
  const c = must(cadence("1d"));
  assertEquals(durationMs(c.staleAfter), 2 * 86_400_000);
  assertEquals(durationMs(must(cadence("6d")).staleAfter), MAX_STALE_MS);
  assertEquals(cadence("1d", "8d").kind, "err");
  assertEquals(cadence("1d", "1h").kind, "err");
  assertEquals(cadence("soon").kind, "err");
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 600 }), fc.integer({ min: 0, max: 3_000_000_000 }), (minutes, age) => {
      const cad = must(cadence(`${minutes}m`));
      assert(durationMs(cad.staleAfter) <= MAX_STALE_MS);
      assert(durationMs(cad.staleAfter) >= durationMs(cad.every));
      const at = instantOf(1_000_000_000_000);
      assertEquals(isStale(cad, at, instantOf(1_000_000_000_000 + age)), age > durationMs(cad.staleAfter));
    }),
  );
});

proves(["0002-integrations-governance FR-007"], "a spec without a secret field is refused", () => {
  const ref = must(parseCredentialRef("vault://tests/x"));
  assertEquals(credentialSpec(ref, [{ name: "user", secret: false, hint: "A name." }]).kind, "err");
  assertEquals(credentialSpec(ref, [{ name: "t", secret: true, hint: "" }]).kind, "err");
  assertEquals(credentialSpec(ref, [{ name: "t", secret: true, hint: "h" }, { name: "t", secret: true, hint: "h" }]).kind, "err");
  assertEquals(credentialSpec(ref, [{ name: "t", secret: true, hint: "h" }]).kind, "ok");
});

proves(["0002-integrations-governance FR-008"], "the generic denylist and a weaker one", () => {
  const list = denylistWith([{ kind: "exact", text: "nickname", why: "personal" }]);
  for (const f of ["salary", "Annual_Salary", "ssn", "date_of_birth", "home_address", "api_key", "password_hash", "nickname"]) assert(isDenied(list, f), f);
  for (const f of ["name", "email", "private", "status"]) assert(!isDenied(list, f), f);
  assertEquals(governanceProblems(sampleGovernance({ denylist: { patterns: [] } })).some((p) => p.kind === "denylist-weaker"), true);
});

proves(["0002-integrations-governance FR-009"], "decidePin over every policy and digest (property)", () => {
  const a = must(parseSha256("a".repeat(64)));
  const b = must(parseSha256("b".repeat(64)));
  const tofu: TlsPolicy = { kind: "pinned", origin: "trust-on-first-use", sha256: undefined };
  assertEquals(decidePin(tofu, a, undefined), { kind: "remember", sha256: a });
  assertEquals(decidePin(tofu, a, a), { kind: "accept" });
  assertEquals(decidePin(tofu, b, a), { kind: "refuse", why: "mismatch" });
  const pre: TlsPolicy = { kind: "pinned", origin: "preconfigured", sha256: a };
  assertEquals(decidePin(pre, a, undefined), { kind: "accept" });
  assertEquals(decidePin(pre, b, undefined), { kind: "refuse", why: "mismatch" });
  assertEquals(decidePin({ kind: "pinned", origin: "preconfigured", sha256: undefined }, a, undefined), { kind: "refuse", why: "no-pin-and-not-first-use" });
  assertEquals(decidePin({ kind: "system-roots" }, a, undefined), { kind: "refuse", why: "not-pinned-policy" });
  fc.assert(
    fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (first, hasPin, same) => {
      const shown = same ? a : b;
      const policy: TlsPolicy = { kind: "pinned", origin: first ? "trust-on-first-use" : "preconfigured", sha256: hasPin ? a : undefined };
      const d = decidePin(policy, shown, undefined);
      if (hasPin) assertEquals(d.kind, same ? "accept" : "refuse");
      else assertEquals(d.kind, first ? "remember" : "refuse");
    }),
  );
  assertEquals(governanceProblems(sampleGovernance({ transport: { kind: "https", hosts: ["h"], tls: { kind: "pinned", origin: "preconfigured", sha256: undefined } } })).map((p) => p.kind), ["pin-without-digest"]);
});
