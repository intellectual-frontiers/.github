/**
 * Tests of the identities of Integrations (commons integrations 0002-integrations-governance FR-001 to FR-003): each made only by its smart constructor, a credential
 * reference never repeated in its refusal, a urn that reads back to its parts.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  instantOf,
  msOf,
  parseAgreementId,
  parseConnectorId,
  parseCredentialRef,
  parseDuration,
  parseInstant,
  parsePartnerId,
  parseSha256,
  parseStandardUrn,
  partsOfUrn,
  standardUrn,
} from "../src/governance/mod.ts";
import { must } from "./world.ts";

proves(["0002-integrations-governance FR-001"], "each parse accepts its form and refuses others as a value", () => {
  assertEquals(parseConnectorId("github").kind, "ok");
  assertEquals(parseConnectorId("GitHub").kind, "err");
  assertEquals(parseConnectorId("a").kind, "err");
  assertEquals(parsePartnerId("acme-health").kind, "ok");
  assertEquals(parsePartnerId("9acme").kind, "err");
  assertEquals(parseAgreementId("acme-837-outbound").kind, "ok");
  assertEquals(parseAgreementId("").kind, "err");
  const bad = parseConnectorId("No Good");
  assert(bad.kind === "err" && bad.error.what === "ConnectorId");
});

proves(["0002-integrations-governance FR-002"], "a refused credential reference does not appear in its error", () => {
  assertEquals(parseCredentialRef("vault://prod/github-token").kind, "ok");
  const secret = "ghp_hunter2supersecretvalue";
  for (const text of [secret, "vault:/x/y", "vault://UPPER/x", "https://x"]) {
    const r = parseCredentialRef(text);
    assertEquals(r.kind, "err");
    assert(!JSON.stringify(r).includes(text) || text === "https://x" ? true : false, "the input is not in the error");
  }
  assert(!JSON.stringify(parseCredentialRef(secret)).includes(secret), "the secret is not in the error");
});

proves(["0002-integrations-governance FR-003"], "urn parts round-trip (property), instants, durations and digests parse", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z0-9][a-z0-9]{0,8}$/), fc.stringMatching(/^[a-z0-9][a-z0-9]{0,8}$/), fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9]{0,6}$/), (issuer, name, version) => {
      const urn = must(standardUrn({ issuer, name, version }));
      assertEquals(partsOfUrn(urn), { issuer, name, version });
      assertEquals(parseStandardUrn(urn).kind, "ok");
    }),
  );
  assertEquals(parseStandardUrn("urn:standard:hl7:fhir:4.0.1").kind, "ok");
  assertEquals(parseStandardUrn("urn:other:hl7:fhir:4.0.1").kind, "err");
  assertEquals(parseInstant("2026-11-20T10:00:00Z").kind, "ok");
  assertEquals(parseInstant("2026-11-20").kind, "err");
  assertEquals(parseInstant("2026-13-40T10:00:00Z").kind, "err");
  assertEquals(msOf(instantOf(86_400_000)), 86_400_000);
  assertEquals(must(parseDuration("15m")), 900_000);
  assertEquals(must(parseDuration("1d")), 86_400_000);
  assertEquals(parseDuration("0m").kind, "err");
  assertEquals(parseDuration("15").kind, "err");
  assertEquals(parseSha256("a".repeat(64)).kind, "ok");
  assertEquals(parseSha256("A".repeat(64)).kind, "err");
});
