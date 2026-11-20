// Spec: 0008-integrations-plugins FR-005, FR-006, FR-007, FR-008
/**
 * The conformance suites of the extension points (commons integrations 0008-integrations-plugins): what every connector and every standards plugin must satisfy,
 * as pure functions from the extension and its fixtures to findings. A plugin package runs them in its own tests and asserts that the findings are empty.
 *
 * @remarks
 * The suites use no test framework: a finding is data (`ConformanceFinding`) with the extension's id, so that a registry can refuse an extension that does not conform.
 *
 * @module
 */
import { isDenied, type Instant } from "@intellectual-frontiers/integrations/governance";
import { governanceProblems } from "@intellectual-frontiers/integrations/governance";
import type { Finding } from "./constraints.ts";
import type { Connector, Observation, PostureResult, PostureStatus } from "./observe.ts";
import type { StandardsPlugin } from "./plugin.ts";
import type { ReadPort } from "./ports.ts";
import { valuesOf, type Interchange } from "./tree.ts";

/** What a suite found wrong. */
export type ConformanceFinding = { readonly extension: string; readonly rule: string; readonly message: string };

/** A recorded run of a connector: the port it reads, the moment, and what is expected of the result. */
export type ConnectorFixture = {
  readonly name: string;
  readonly port: ReadPort;
  readonly now: Instant;
  readonly expect: {
    readonly account?: string;
    readonly posture?: Readonly<Record<string, string | number | boolean>>;
    readonly labels?: Readonly<Record<string, number>>;
    readonly policies?: Readonly<Record<string, PostureStatus>>;
  };
};

const bad = (extension: string, rule: string, message: string): ConformanceFinding => ({ extension, rule, message });

function deniedProps(c: Connector, o: Observation): readonly string[] {
  const out: string[] = [];
  for (const r of o.records ?? []) for (const k of Object.keys(r.props)) if (isDenied(c.governance.denylist, k)) out.push(`${r.label}.${k}`);
  return out;
}

/** The conformance of a connector over its fixtures: sound governance, a description that agrees with it, at least one fixture, a probe that answers, an observation that names the connector, keeps no denied field, is the same when observed twice, and meets each fixture's expectations. */
export async function conformConnector(c: Connector, fixtures: readonly ConnectorFixture[]): Promise<readonly ConformanceFinding[]> {
  const id = c.governance.id;
  const out: ConformanceFinding[] = [];
  for (const p of governanceProblems(c.governance)) out.push(bad(id, `governance/${p.kind}`, "the governance of the connector has a problem"));
  const d = c.describe();
  if (d.id !== id || d.class !== c.governance.class || !d.readOnly) out.push(bad(id, "describe/disagrees", "describe does not say what the governance says"));
  if (c.governance.contract.writes !== "never") out.push(bad(id, "contract/writes", "the contract does not say never"));
  if (fixtures.length === 0) out.push(bad(id, "fixtures/none", "a connector has at least one fixture"));
  for (const f of fixtures) {
    const where = `${id}:${f.name}`;
    const probe = await c.probe({ port: f.port, now: f.now });
    if (probe.kind === "err") out.push(bad(where, "probe/fails", `the probe failed: ${probe.error.kind}`));
    const first = await c.observe({ port: f.port, now: f.now });
    if (first.kind === "err") {
      out.push(bad(where, "observe/fails", `observe failed: ${first.error.kind}`));
      continue;
    }
    const o = first.value;
    if (o.provider !== id) out.push(bad(where, "observe/provider", "the observation does not name the connector as its provider"));
    for (const k of deniedProps(c, o)) out.push(bad(where, "observe/denied-field", `a denied field was kept: ${k}`));
    const second = await c.observe({ port: f.port, now: f.now });
    if (second.kind === "err" || JSON.stringify(second.value) !== JSON.stringify(o)) out.push(bad(where, "observe/not-repeatable", "observing twice over the same answers gives two observations"));
    if (f.expect.account !== undefined && o.account !== f.expect.account) out.push(bad(where, "expect/account", "the account is not the expected one"));
    for (const [k, v] of Object.entries(f.expect.posture ?? {})) if (o.posture[k] !== v) out.push(bad(where, "expect/posture", `the fact ${k} is not as expected`));
    for (const [label, n] of Object.entries(f.expect.labels ?? {})) if ((o.records ?? []).filter((r) => r.label === label).length !== n) out.push(bad(where, "expect/labels", `the number of records labelled ${label} is not ${n}`));
    const results: readonly PostureResult[] = c.check(o, f.now);
    for (const [pid, status] of Object.entries(f.expect.policies ?? {})) if (results.find((r) => r.id === pid)?.status !== status) out.push(bad(where, "expect/policy", `the policy ${pid} is not ${status}`));
  }
  return out;
}

/** The values of a tree that a text must not hold. */
const leaks = (text: string, tree: Interchange): boolean => valuesOf(tree).some((v) => v.length >= 4 && text.includes(v));

/** What a plugin is checked with: texts of its syntax that parse, from the issuer's published examples or generated, never real data. */
export type PluginSamples = { readonly valid: readonly string[]; readonly garbage: readonly string[] };

/** The conformance of a standards plugin: its codec parses each valid sample, serializes it and reads the result back to the same tree (round trip); it fails each garbage text as a syntax error that holds no part of the text; and its standards are registered with a licence that has terms. */
export function conformPlugin(p: StandardsPlugin, samples: PluginSamples): readonly ConformanceFinding[] {
  const out: ConformanceFinding[] = [];
  if (samples.valid.length === 0) out.push(bad(p.id, "samples/none", "a plugin has at least one valid sample"));
  for (const [i, text] of samples.valid.entries()) {
    const where = `${p.id}:valid[${i}]`;
    const parsed = p.codec.parse(text);
    if (parsed.kind === "err") {
      out.push(bad(where, "codec/parse", `a valid sample does not parse: ${parsed.error.code}`));
      continue;
    }
    const written = p.codec.serialize(parsed.value);
    if (written.kind === "err") {
      out.push(bad(where, "codec/serialize", `the tree does not serialize: ${written.error.code}`));
      continue;
    }
    const again = p.codec.parse(written.value);
    if (again.kind === "err" || JSON.stringify(again.value) !== JSON.stringify(parsed.value)) out.push(bad(where, "codec/round-trip", "parse, serialize and parse again gives another tree"));
  }
  for (const [i, text] of samples.garbage.entries()) {
    const where = `${p.id}:garbage[${i}]`;
    const parsed = p.codec.parse(text);
    if (parsed.kind === "ok") out.push(bad(where, "codec/accepts-garbage", "a text that is not of the syntax parses"));
    else if (text.length >= 4 && JSON.stringify(parsed.error).includes(text)) out.push(bad(where, "codec/echoes-input", "the error repeats the text it refused"));
  }
  for (const s of p.standards) if (s.license.terms.trim() === "") out.push(bad(`${p.id}:${s.urn}`, "standard/no-terms", "a standard has the terms of its licence"));
  return out;
}

/** The findings of a validation, with none of their messages holding a value of the payload: the check a plugin's validation must pass. */
export function findingsHoldNoValue(fs: readonly Finding[], tree: Interchange): boolean {
  return fs.every((f) => !leaks(`${f.message} ${f.path}`, tree));
}
