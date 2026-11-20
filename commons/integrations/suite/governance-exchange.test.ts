/**
 * Tests of the governance of exchange (commons integrations 0002-integrations-governance FR-010 to FR-015): standards in a registry, licences with the rule that
 * follows, references with their level, agreements and their problems, the classification of what is exchanged and the publication gate.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  CLASSIFICATIONS,
  agreementProblems,
  embeddingFindings,
  mayAppearInLogs,
  parseAgreementId,
  parseCredentialRef,
  parseDuration,
  parsePartnerId,
  parseStandardUrn,
  ref,
  register,
  sourceAllowed,
  type ExchangeAgreement,
  type License,
  type StandardsRegistry,
} from "../src/governance/mod.ts";
import { TOY, must, toyStandard } from "./world.ts";

const empty: StandardsRegistry = new Map();

proves(["0002-integrations-governance FR-010"], "register refuses a duplicate, a mismatched urn and a licence without terms", () => {
  const one = must(register(empty, toyStandard("allowed")));
  assertEquals(one.size, 1);
  assertEquals(register(one, toyStandard("allowed")).kind, "err");
  assertEquals(register(empty, { ...toyStandard("allowed"), version: "2" }).kind, "err");
  assertEquals(register(empty, { ...toyStandard("allowed"), license: { spdx: "CC0-1.0", embedding: "allowed", terms: " " } }).kind, "err");
});

proves(["0002-integrations-governance FR-011"], "sourceAllowed over each embedding and source", () => {
  const lic = (embedding: License["embedding"]): License => ({ spdx: "LicenseRef-x", embedding, terms: "t" });
  assert(sourceAllowed(lic("allowed"), "embedded-in-package"));
  assert(!sourceAllowed(lic("user-supplied"), "embedded-in-package"));
  assert(sourceAllowed(lic("user-supplied"), "user-supplied"));
  assert(sourceAllowed(lic("user-supplied"), "published-by-issuer"));
  for (const s of ["embedded-in-package", "user-supplied", "published-by-issuer"] as const) assert(!sourceAllowed(lic("refused"), s));
});

proves(["0002-integrations-governance FR-012"], "references carry their level", () => {
  const r = ref("schema", TOY);
  assertEquals(r.level, "schema");
  assertEquals(ref("terminology", TOY).level, "terminology");
});

const agreement = (over: Partial<ExchangeAgreement> = {}): ExchangeAgreement => ({
  id: must(parseAgreementId("acme-test")),
  partner: must(parsePartnerId("acme")),
  direction: "outbound",
  syntax: ref("syntax", TOY),
  schemas: [ref("schema", must(parseStandardUrn("urn:standard:tests:schema:1")))],
  profiles: [],
  bindings: [],
  acknowledgements: [{ kind: "fhir-operation-outcome", within: must(parseDuration("1h")) }],
  serviceLevels: { ackWithin: must(parseDuration("1h")), maxAttempts: 3 },
  protection: { classification: "protected-health-information", handling: { encryptedInTransit: true, encryptedAtRest: true, retention: must(parseDuration("6d")) }, minimumNecessary: { kind: "whole-record" } },
  obligations: [{ kind: "validate", levels: ["syntax", "schema"] }, { kind: "acknowledge" }, { kind: "log", what: "metadata-only" }],
  transport: { kind: "https", endpoint: "https://partner.example.test/fhir", auth: "oauth2-backend-services" },
  credential: must(parseCredentialRef("vault://tests/acme")),
  ...over,
});

proves(["0002-integrations-governance FR-013"], "agreementProblems finds each", () => {
  assertEquals(agreementProblems(agreement()), []);
  assertEquals(agreementProblems(agreement({ schemas: [] })).map((p) => p.kind), ["no-schema"]);
  assertEquals(agreementProblems(agreement({ acknowledgements: [] })).map((p) => p.kind), ["unacknowledged"]);
  assertEquals(agreementProblems(agreement({ obligations: [{ kind: "validate", levels: [] }] })).map((p) => p.kind), ["validates-no-level"]);
  assertEquals(agreementProblems(agreement({ serviceLevels: { ackWithin: must(parseDuration("1h")), maxAttempts: 0 } })).map((p) => p.kind), ["attempts-not-positive"]);
  assertEquals(agreementProblems(agreement({ obligations: [{ kind: "keep", for: must(parseDuration("7d")) }] })).map((p) => p.kind), ["retention-shorter-than-keep"]);
});

proves(["0002-integrations-governance FR-014"], "only a public payload may appear in logs", () => {
  for (const c of CLASSIFICATIONS) assertEquals(mayAppearInLogs(c), c === "public");
});

proves(["0002-integrations-governance FR-015"], "embeddingFindings refuses embedded content a licence does not allow", () => {
  const reg = must(register(empty, toyStandard("user-supplied")));
  assertEquals(embeddingFindings(reg, [{ path: "defs/x.json", standard: TOY }]).map((f) => f.kind), ["embedded-not-allowed"]);
  assertEquals(embeddingFindings(empty, [{ path: "defs/x.json", standard: TOY }]).map((f) => f.kind), ["embedded-unknown-standard"]);
  assertEquals(embeddingFindings(must(register(empty, toyStandard("allowed"))), [{ path: "defs/x.json", standard: TOY }]), []);
});
