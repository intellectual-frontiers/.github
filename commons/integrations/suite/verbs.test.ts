/**
 * Tests of the headless verbs (commons integrations 0009-integrations-verbs FR-001 to FR-005): each runs over in-memory ports through the real command-line run of
 * Headless, each declares its reach, none says a value of the payload, `explain` covers every code of a finding, and a missing credential or an unreached partner is
 * a problem with a code.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { placedCommands, programOf } from "@intellectual-frontiers/headless/logical";
import { run, type Io } from "@intellectual-frontiers/headless/cli";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parseAgreementId, parseCredentialRef, parseDuration, parsePartnerId, parseStandardUrn, ref, type AgreementId, type ConnectorId, type ExchangeAgreement } from "../src/governance/mod.ts";
import { registerPlugin, type Schema } from "../src/logical/mod.ts";
import { EXPLANATIONS, integrationsBranch, integrationsCommands, type Deps } from "../src/surfaces/headless/mod.ts";
import type { ExchangeTransport, Outbound } from "../src/physical/transport/mod.ts";
import { NOW, SAMPLE_PORT, TOY, must, sampleConnector, toyPlugin } from "./world.ts";

const io: Io = { env: () => undefined, os: "linux", terminal: { stdin: false, stdout: false, stderr: false }, columns: undefined, now: () => Date.UTC(2026, 10, 20, 10), pid: 1, readLine: () => Promise.resolve(undefined) };

const DOC = "TOY~PID|Zyxwvut|Qwertyuiop\nGEN|female\n";
const SCHEMA: Schema = {
  id: ref("schema", must(parseStandardUrn("urn:standard:tests:toy-schema:1"))),
  transaction: "MSG",
  paths: ["MSG.L", "MSG.L.PID", "MSG.L.PID.01", "MSG.L.PID.02", "MSG.L.GEN", "MSG.L.GEN.01"],
  constraints: [{ kind: "pattern", path: "MSG.L.PID.01", regex: "^never$" }],
};

const agreement: ExchangeAgreement = {
  id: must(parseAgreementId("acme-toy")),
  partner: must(parsePartnerId("acme")),
  direction: "outbound",
  syntax: ref("syntax", TOY),
  schemas: [SCHEMA.id],
  profiles: [],
  bindings: [],
  acknowledgements: [{ kind: "fhir-operation-outcome", within: must(parseDuration("1h")) }],
  serviceLevels: { ackWithin: must(parseDuration("1h")), maxAttempts: 3 },
  protection: { classification: "protected-health-information", handling: { encryptedInTransit: true, encryptedAtRest: true, retention: must(parseDuration("6d")) }, minimumNecessary: { kind: "whole-record" } },
  obligations: [{ kind: "validate", levels: ["syntax", "schema"] }, { kind: "acknowledge" }],
  transport: { kind: "https", endpoint: "https://partner.example.test/in", auth: "oauth2-backend-services" },
  credential: must(parseCredentialRef("vault://tests/acme")),
};

type Rig = { readonly deps: Deps; readonly written: Map<string, string>; readonly sent: Outbound[] };

function rig(over: { readonly credential?: boolean; readonly partnerDown?: boolean; readonly files?: Record<string, string> } = {}): Rig {
  const files = new Map(Object.entries({ "in.toy": DOC, ...(over.files ?? {}) }));
  const written = new Map<string, string>();
  const sent: Outbound[] = [];
  const connector = sampleConnector({}, false);
  const transport: ExchangeTransport = {
    send: (m) => {
      sent.push(m);
      return Promise.resolve(over.partnerDown === true ? err({ kind: "network" as const }) : ok({ status: 202, body: "a body that is the partner's" }));
    },
  };
  const deps: Deps = {
    connectors: new Map<ConnectorId, typeof connector>([[connector.governance.id, connector]]),
    readPort: () => Promise.resolve(over.credential === false ? err({ kind: "missing" as const, ref: connector.governance.credential.ref }) : ok(SAMPLE_PORT())),
    plugins: must(registerPlugin(new Map(), toyPlugin())),
    schemas: new Map([["toy-schema", SCHEMA]]),
    terminologies: new Map(),
    agreements: new Map<AgreementId, ExchangeAgreement>([[agreement.id, agreement]]),
    readFile: (p) => {
      const t = files.get(p);
      return Promise.resolve(t === undefined ? err({ kind: "not-found" as const }) : ok(t));
    },
    writeFile: (p, t) => {
      if (p.includes("denied")) return Promise.resolve(err({ kind: "not-writable" as const }));
      written.set(p, t);
      return Promise.resolve(ok(undefined));
    },
    transportOf: () => Promise.resolve(ok(transport)),
    clock: { now: () => NOW },
  };
  return { deps, written, sent };
}

const program = (r: Rig) => programOf({ name: "tool", summary: "A tool.", version: "1", children: [integrationsBranch(r.deps)] });
const go = (r: Rig, ...argv: string[]) => run(program(r), ["integrations", ...argv, "--json"], io);

proves(["0009-integrations-verbs FR-001"], "each verb runs over in-memory ports", async () => {
  const r = rig();
  assertEquals(integrationsCommands(r.deps).map((c) => c.name), ["observe", "probe", "check", "validate", "translate", "send", "receive", "explain"]);
  const observed = await go(r, "observe", "sample-host");
  assertEquals(observed.code, 0);
  assert(observed.out.includes('"assets":2') || observed.out.includes('"assets": 2'), observed.out);
  assertEquals((await go(r, "probe", "sample-host")).code, 0);
  const checked = await go(r, "check", "sample-host");
  assertEquals(checked.code, 0);
  assert(checked.out.includes("observation-fresh"));
  const unknown = await go(r, "observe", "nobody");
  assert(unknown.code !== 0 && unknown.out.includes("E010-UNKNOWN"));
  const t = await go(r, "translate", "in.toy", "--out", "out.toy");
  assertEquals(t.code, 0);
  assertEquals(r.written.get("out.toy"), DOC);
});

proves(["0009-integrations-verbs FR-002"], "reach policies conform", () => {
  const placed = placedCommands(program(rig()).children);
  assertEquals(placed.length, 8);
  for (const x of placed) {
    const reading = ["integrations observe", "integrations probe", "integrations check", "integrations validate", "integrations explain"].includes(x.id);
    assertEquals(x.facts.kind, reading ? "report" : "action", x.id);
    assertEquals(x.reach?.readOnly, reading, x.id);
    assertEquals(x.reach?.channels.includes("ssh"), reading, x.id);
  }
});

proves(["0009-integrations-verbs FR-003"], "no payload value in the outcome of any verb over a document", async () => {
  const r = rig({ files: { "Zyxwvut.toy": DOC } });
  const runs = [
    await go(r, "validate", "in.toy", "--schema", "toy-schema"),
    await go(r, "send", "in.toy", "--agreement", "acme-toy", "--schema", "toy-schema"),
    await go(r, "send", "in.toy", "--agreement", "acme-toy"),
    await go(r, "receive", "in.toy", "--agreement", "acme-toy", "--schema", "toy-schema"),
    await go(r, "translate", "in.toy", "--out", "Zyxwvut-out.toy"),
    await go(r, "translate", "in.toy", "--out", "Zyxwvut-denied.toy"),
    await go(r, "validate", "Zyxwvut.toy", "--schema", "toy-schema"),
    await go(rig({ partnerDown: true }), "send", "in.toy", "--agreement", "acme-toy"),
  ];
  for (const x of runs) {
    for (const v of ["Zyxwvut", "Qwertyuiop"]) assert(!x.out.includes(v) && !x.err.includes(v), `${v} appeared in: ${x.out}`);
  }
  assert(runs[0]?.out.includes("value-pattern"), "the finding is said, without the value");
  assert(runs[0]?.code !== 0);
});

proves(["0009-integrations-verbs FR-004"], "explain covers every code", async () => {
  const r = rig();
  for (const code of Object.keys(EXPLANATIONS)) {
    const x = await go(r, "explain", code);
    assertEquals(x.code, 0, code);
    assert(x.out.includes(code), code);
  }
  const unknown = await go(r, "explain", "no-such-code");
  assert(unknown.code !== 0);
});

proves(["0009-integrations-verbs FR-005"], "credential, delivery and state", async () => {
  const noCredential = await go(rig({ credential: false }), "observe", "sample-host");
  assert(noCredential.out.includes("P010-CREDENTIAL") && noCredential.out.includes("vault://tests/sample-host"));
  const r = rig();
  const sent = await go(r, "send", "in.toy", "--agreement", "acme-toy");
  assertEquals(sent.code, 0);
  assert(sent.out.includes('"state":"sent"') || sent.out.includes('"state": "sent"'), sent.out);
  assertEquals(r.sent.length, 1);
  assertEquals(r.sent[0]?.body, DOC);
  const down = await go(rig({ partnerDown: true }), "send", "in.toy", "--agreement", "acme-toy");
  assert(down.code !== 0 && down.out.includes("E040-DELIVERY") && down.out.includes("retrying"), down.out);
  const received = await go(rig(), "receive", "in.toy", "--agreement", "acme-toy", "--schema", "toy-schema");
  assert(received.out.includes("rejected"), received.out);
  const missing = await go(rig(), "send", "missing.toy", "--agreement", "acme-toy");
  assert(missing.out.includes("E020-READ"));
  const notToy = await go(rig({ files: { "bad.toy": "garbage" } }), "validate", "bad.toy", "--schema", "toy-schema");
  assert(notToy.out.includes("E100-SYNTAX-ERROR") && !notToy.out.includes("garbage "));
});
