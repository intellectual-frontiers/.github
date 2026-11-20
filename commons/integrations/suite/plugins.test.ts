/**
 * Tests of the plugin contract and the conformance suites (commons integrations 0008-integrations-plugins FR-001 to FR-008): a plugin is registered by rule, a
 * definition is loaded only from a source its licence allows, and each suite finds each fault in a deliberately faulty extension.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { embeddingFindings, parseStandardUrn, ref, register, type StandardsRegistry } from "../src/governance/mod.ts";
import { conformConnector, conformPlugin, detect, findingsHoldNoValue, loadFrom, registerPlugin, validate, type Connector, type Loader, type PluginRegistry, type Schema } from "../src/logical/mod.ts";
import { NOW, SAMPLE_PORT, TOY, must, sampleConnector, toyParse, toyPlugin, toyStandard } from "./world.ts";

const GOOD = "TOY~PID|Zyxwvut|Qwertyuiop\nGEN|female\n";

proves(["0008-integrations-plugins FR-001"], "registerPlugin refuses the three cases", () => {
  const reg: PluginRegistry = must(registerPlugin(new Map(), toyPlugin()));
  assertEquals(reg.size, 1);
  assertEquals(registerPlugin(reg, toyPlugin({ id: "toy-two" })).kind, "err");
  const other = must(parseStandardUrn("urn:standard:tests:other:1"));
  assertEquals(registerPlugin(new Map(), toyPlugin({ standards: [] })).kind, "err");
  assertEquals(registerPlugin(new Map(), toyPlugin({ standards: [{ ...toyStandard("allowed"), level: "schema" }] })).kind, "err");
  const stray: Loader = { standard: other, load: () => err({ kind: "unknown-standard", standard: other }) };
  assertEquals(registerPlugin(new Map(), toyPlugin({ loaders: [stray] })).kind, "err");
});

proves(["0008-integrations-plugins FR-002"], "a syntax failure holds none of the text", () => {
  const r = toyParse("SECRETVALUE-not-toy");
  assert(r.kind === "err");
  assert(!JSON.stringify(r).includes("SECRETVALUE"));
  assertEquals(r.error.code, "bad-envelope");
  assertEquals(toyParse("").kind, "err");
});

proves(["0008-integrations-plugins FR-003"], "a user-supplied standard is not loaded from an embedded source", () => {
  const schema: Schema = { id: ref("schema", TOY), transaction: "MSG", paths: [], constraints: [] };
  const loader: Loader = { standard: TOY, load: () => ok({ schemas: [schema], profiles: [], terminologies: [] }) };
  const licensed = toyPlugin({ standards: [toyStandard("user-supplied")], loaders: [loader] });
  assertEquals(loadFrom(licensed, { origin: "embedded-in-package", standard: TOY, text: "{}" }).kind, "err");
  assertEquals(loadFrom(licensed, { origin: "user-supplied", standard: TOY, text: "{}" }).kind, "ok");
  const refused = toyPlugin({ standards: [toyStandard("refused")], loaders: [loader] });
  assertEquals(loadFrom(refused, { origin: "user-supplied", standard: TOY, text: "{}" }).kind, "err");
  assertEquals(loadFrom(toyPlugin(), { origin: "user-supplied", standard: must(parseStandardUrn("urn:standard:tests:none:1")), text: "{}" }).kind, "err");
});

proves(["0008-integrations-plugins FR-004"], "detect picks the plugin that parses", () => {
  const reg = must(registerPlugin(new Map(), toyPlugin()));
  const found = must(detect(reg, GOOD));
  assertEquals(found.plugin.id, "toy");
  assertEquals(found.tree.groups[0]?.transactions[0]?.id, "MSG");
  assertEquals(detect(reg, "nonsense").kind, "err");
  assertEquals(detect(new Map(), GOOD).kind, "err");
});

proves(["0008-integrations-plugins FR-005"], "conformConnector finds each fault in a deliberately faulty connector", async () => {
  const fixture = { name: "two repos", port: SAMPLE_PORT(), now: NOW, expect: { account: "acme", posture: { repositories: 2 }, labels: { code_repository: 2 }, policies: { "two-factor-required": "pass" as const } } };
  assertEquals(await conformConnector(sampleConnector(), [fixture]), []);
  assertEquals((await conformConnector(sampleConnector(), [])).map((f) => f.rule), ["fixtures/none"]);
  const wrong = { ...fixture, expect: { account: "other", posture: { repositories: 9 }, labels: { code_repository: 1 }, policies: { "two-factor-required": "fail" as const } } };
  assertEquals((await conformConnector(sampleConnector(), [wrong])).map((f) => f.rule).sort(), ["expect/account", "expect/labels", "expect/policy", "expect/posture"]);
  const failing = { ...fixture, port: { ...SAMPLE_PORT(), get: () => Promise.resolve(err({ kind: "denied" as const, subject: "/me" })) } };
  assert((await conformConnector(sampleConnector(), [failing])).some((f) => f.rule === "probe/fails"));
  const good = sampleConnector();
  const wrongProvider: Connector = { ...good, observe: async (ctx) => { const r = await good.observe(ctx); return r.kind === "ok" ? ok({ ...r.value, provider: "someone-else" }) : r; } };
  assert((await conformConnector(wrongProvider, [fixture])).some((f) => f.rule === "observe/provider"));
  const leaky: Connector = { ...good, observe: async (ctx) => { const r = await good.observe(ctx); return r.kind === "ok" ? ok({ ...r.value, records: [{ label: "x", ocsf_class_uid: 1, native_id: "1", display_name: "1", props: { salary: 1 } }] }) : r; } };
  assert((await conformConnector(leaky, [fixture])).some((f) => f.rule === "observe/denied-field"));
  let n = 0;
  const unstable: Connector = { ...good, observe: async (ctx) => { const r = await good.observe(ctx); n += 1; return r.kind === "ok" ? ok({ ...r.value, account: `a${n}` }) : r; } };
  assert((await conformConnector(unstable, [{ ...fixture, expect: {} }])).some((f) => f.rule === "observe/not-repeatable"));
  const lying: Connector = { ...good, describe: () => ({ ...good.describe(), id: "liar" }) };
  assert((await conformConnector(lying, [fixture])).some((f) => f.rule === "describe/disagrees"));
});

proves(["0008-integrations-plugins FR-006"], "conformPlugin finds each fault in a deliberately faulty codec", () => {
  const samples = { valid: [GOOD], garbage: ["SECRETVALUE", ""] };
  assertEquals(conformPlugin(toyPlugin(), samples), []);
  assertEquals(conformPlugin(toyPlugin(), { valid: [], garbage: [] }).map((f) => f.rule), ["samples/none"]);
  const lossy = toyPlugin({ codec: { ...toyPlugin().codec, serialize: () => ok("TOY~PID|changed\n") } });
  assert(conformPlugin(lossy, samples).some((f) => f.rule === "codec/round-trip"));
  const accepting = toyPlugin({ codec: { ...toyPlugin().codec, parse: (t: string) => (t === "SECRETVALUE" ? toyParse(GOOD) : toyParse(t)) } });
  assert(conformPlugin(accepting, samples).some((f) => f.rule === "codec/accepts-garbage"));
  const echo = toyPlugin({ codec: { ...toyPlugin().codec, parse: (t: string) => (t.startsWith("TOY~") ? toyParse(t) : err({ kind: "syntax", code: "bad-envelope", offset: 0, text: t } as never)) } });
  assert(conformPlugin(echo, samples).some((f) => f.rule === "codec/echoes-input"));
  const broken = toyPlugin({ codec: { ...toyPlugin().codec, parse: () => err({ kind: "syntax", code: "bad-structure", offset: 3 }) } });
  assert(conformPlugin(broken, { valid: [GOOD], garbage: [] }).some((f) => f.rule === "codec/parse"));
  const noTerms = toyPlugin({ standards: [{ ...toyStandard("allowed"), license: { spdx: "CC0-1.0", embedding: "allowed", terms: "" } }] });
  assert(conformPlugin(noTerms, samples).some((f) => f.rule === "standard/no-terms"));
});

proves(["0008-integrations-plugins FR-007"], "the gate refuses embedded content", () => {
  const reg: StandardsRegistry = must(register(new Map(), toyStandard("user-supplied")));
  assertEquals(embeddingFindings(reg, [{ path: "definitions/toy.json", standard: TOY }]).length, 1);
});

proves(["0008-integrations-plugins FR-008"], "findings of a validation hold no value of the payload", () => {
  const tree = must(toyParse(GOOD));
  const t = tree.groups[0]?.transactions[0];
  assert(t !== undefined);
  const schema: Schema = { id: ref("schema", TOY), transaction: "MSG", paths: ["MSG.L"], constraints: [{ kind: "pattern", path: "MSG.L.PID.01", regex: "^never$" }] };
  const fs = validate(t, schema);
  assert(fs.length > 0);
  assert(findingsHoldNoValue(fs, tree));
});
