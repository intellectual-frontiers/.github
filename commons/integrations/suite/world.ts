/**
 * What the tests of Integrations share: an in-memory read port, a small connector, a toy syntax with its codec, and a plugin made of them. All data is synthetic.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  cadence,
  credentialSpec,
  denylistWith,
  parseConnectorId,
  parseCredentialRef,
  parseInstant,
  parseStandardUrn,
  ref,
  type ConnectorGovernance,
  type Instant,
  type Standard,
  type StandardUrn,
} from "../src/governance/mod.ts";
import {
  defineConnector,
  element,
  loop,
  segment,
  type Connector,
  type Interchange,
  type Json,
  type ReadFailure,
  type ReadPort,
  type StandardsPlugin,
  type SyntaxProblem,
  textOf,
} from "../src/logical/mod.ts";

/** Unwraps a result that a test knows is ok. */
export function must<T, E>(r: Result<T, E>): T {
  if (r.kind === "err") throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

/** A moment of the tests. */
export const NOW: Instant = must(parseInstant("2026-11-20T10:00:00Z"));

/** A read port that answers from a map of paths to documents, and from a map of paths to lists for `pages`; anything else is not found. */
export function memoryPort(docs: Readonly<Record<string, Json>>, lists: Readonly<Record<string, readonly Json[]>> = {}, denied: readonly string[] = []): ReadPort & { readonly seen: string[] } {
  const seen: string[] = [];
  const failure = (path: string): ReadFailure => (denied.includes(path) ? { kind: "denied", subject: path } : { kind: "not-found", subject: path });
  return {
    seen,
    get: (path) => {
      seen.push(path);
      const d = docs[path];
      return Promise.resolve(d === undefined ? err(failure(path)) : ok(d));
    },
    pages: async function* (path) {
      seen.push(path);
      const items = lists[path];
      if (items === undefined) return err(failure(path));
      yield* items;
      return ok(1);
    },
  };
}

/** The governance of the connector of the tests, a synthetic code host. */
export function sampleGovernance(extra: Partial<ConnectorGovernance> = {}): ConnectorGovernance {
  return {
    id: must(parseConnectorId("sample-host")),
    title: "Sample host",
    class: "code-host",
    labels: { serviceModels: ["SaaS"], categories: ["source-control"] },
    contract: { writes: "never", tokenEndpoints: [] },
    credential: must(credentialSpec(must(parseCredentialRef("vault://tests/sample-host")), [{ name: "token", secret: true, hint: "A read-only token of the sample host." }])),
    scope: { grants: [{ resource: "repos", access: "read" }] },
    cadence: must(cadence("1d")),
    entities: ["repository", "account"],
    denylist: denylistWith([]),
    transport: { kind: "https", hosts: ["api.sample.test"], tls: { kind: "system-roots" } },
    ...extra,
  };
}

/** A connector that observes a list of repositories, returning one record with a field the denylist denies and an entity kind it did not declare. */
export function sampleConnector(extra: Partial<ConnectorGovernance> = {}, leaky = true): Connector {
  const r = defineConnector({
    governance: sampleGovernance(extra),
    probe: async ({ port }) => {
      const me = await port.get("/me");
      return me.kind === "ok" ? ok({ reachable: true as const, account: "acme" }) : err({ kind: "denied" as const, subject: "/me" });
    },
    observe: async ({ port, now }) => {
      const repos: Json[] = [];
      const g = port.pages("/repos");
      for (;;) {
        const n = await g.next();
        if (n.done === true) break;
        repos.push(n.value);
      }
      const names = repos.map((x) => textOf(x, "name") ?? "?");
      return ok({
        at: now,
        provider: "sample-host",
        account: "acme",
        assets: names.map((n) => ({ kind: "repository", id: n, name: n })),
        posture: { repositories: names.length, "two-factor": true },
        gaps: [],
        records: names.map((n) => ({ label: "code_repository", ocsf_class_uid: 5001, native_id: n, display_name: n, props: leaky ? { private: true, owner_salary: 1 } : { private: true } })),
        ...(leaky ? { entities: { people: [{ email: "a@example.test", status: "active" as const }], repositories: names.map((n) => ({ system: "sample-host", name: n, private: true })) } } : {}),
      });
    },
    policies: [{ id: "two-factor-required", title: "Two-factor is required", fact: "two-factor", want: { kind: "equals", value: true }, severity: "high", onMiss: "fail", controls: ["urn:grc:tests:1:mfa"], fix: "turn it on" }],
  });
  return must(r);
}

/** The fixtures of the sample connector: two repositories. */
export const SAMPLE_PORT = (): ReturnType<typeof memoryPort> => memoryPort({ "/me": { login: "acme" } }, { "/repos": [{ name: "alpha" }, { name: "beta" }] });

/** The urn of the toy syntax. */
export const TOY: StandardUrn = must(parseStandardUrn("urn:standard:tests:toy-syntax:1"));

const standard = (urn: StandardUrn, level: Standard["level"], embedding: Standard["license"]["embedding"]): Standard => ({
  urn,
  level,
  family: "file-format",
  title: "Toy",
  issuer: "tests",
  version: "1",
  basis: { kind: "unaligned", reason: "a toy for the tests" },
  location: "https://example.test/toy",
  license: { spdx: "CC0-1.0", embedding, terms: "Made for the tests; no terms." },
  sha256: undefined,
});

/** The toy syntax: a line is a segment, its fields separated by `|`, and a line that begins with a space is inside the loop above it. */
export function toyParse(text: string): Result<Interchange, SyntaxProblem> {
  if (text === "") return err({ kind: "syntax", code: "empty", offset: 0 });
  if (!text.startsWith("TOY~")) return err({ kind: "syntax", code: "bad-envelope", offset: 0 });
  const lines = text.slice(4).split("\n").filter((l) => l !== "");
  const children = lines.map((l) => {
    const [id = "", ...fields] = l.split("|");
    return segment(id, ...fields.map((f, i) => element(String(i + 1).padStart(2, "0"), f)));
  });
  return ok({ kind: "interchange", syntax: ref("syntax", TOY), control: "1", groups: [{ kind: "group", id: "G", control: "1", transactions: [{ kind: "transaction", id: "MSG", control: "1", children: [loop("L", ...children)] }] }] });
}

/** The toy codec's serialization. */
export function toySerialize(i: Interchange): Result<string, SyntaxProblem> {
  const t = i.groups[0]?.transactions[0];
  const l = t?.children[0];
  if (t === undefined || l === undefined || l.kind !== "loop") return err({ kind: "syntax", code: "bad-structure", offset: 0 });
  const lines = l.children.map((s) => (s.kind === "segment" ? [s.id, ...s.elements.map((e) => e.value)].join("|") : ""));
  return ok(`TOY~${lines.join("\n")}\n`);
}

/** A plugin of the toy syntax. */
export function toyPlugin(overrides: Partial<StandardsPlugin> = {}): StandardsPlugin {
  return {
    id: "toy",
    standards: [standard(TOY, "syntax", "allowed")],
    codec: { syntax: ref("syntax", TOY), parse: toyParse, serialize: toySerialize },
    loaders: [],
    acks: undefined,
    ...overrides,
  };
}

/** The standard of the toy syntax at another embedding. */
export const toyStandard = (embedding: Standard["license"]["embedding"]): Standard => standard(TOY, "syntax", embedding);
