// Spec: 0009-integrations-verbs FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The headless verbs of Integrations (commons integrations 0009-integrations-verbs): `integrations observe|probe|check` for connectors and `integrations
 * validate|translate|send|receive|explain` for exchange, as commands of Headless built from the typed cores, with their actions and reach policies declared, their
 * outcome typed, and every outcome passed through the redaction of Headless over the values of the payload so that a payload never appears in what a verb says.
 *
 * @remarks
 * Every effect is a port of `Deps`: the connectors and the way each reaches its system, the files, the transport of an agreement. A verb is a function of them,
 * so that a test runs it over in-memory ports, and a program (the command line, a tool server, a REST interface) draws the same verbs.
 *
 * @module
 */
import { absurd, type Result } from "@intellectual-frontiers/core";
import { defineReach, problem, redactor, type Problem } from "@intellectual-frontiers/headless/governance";
import { branch, command, outcomeOf, redactOutcome, type Command, type Outcome } from "@intellectual-frontiers/headless/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import { hasErrors, detect, transition, transactionsOf, validate, valuesOf, type Clock, type Connector, type CredentialError, type ExchangeState, type Finding, type FindingCode, type PluginRegistry, type ReadPort, type Schema, type Terminologies, type Interchange } from "@intellectual-frontiers/integrations/logical";
import { parseAgreementId, parseConnectorId, type AgreementId, type ConnectorId, type ExchangeAgreement } from "@intellectual-frontiers/integrations/governance";
import type { Delivered, ExchangeTransport, TransportFailure } from "@intellectual-frontiers/integrations/transport";

/** Every effect the verbs need, as ports. */
export type Deps = {
  readonly connectors: ReadonlyMap<ConnectorId, Connector>;
  /** The read port of a connector's system, made from its credential reference at the edge. */
  readonly readPort: (c: Connector) => Promise<Result<ReadPort, CredentialError>>;
  readonly plugins: PluginRegistry;
  readonly schemas: ReadonlyMap<string, Schema>;
  readonly terminologies: Terminologies;
  readonly agreements: ReadonlyMap<AgreementId, ExchangeAgreement>;
  readonly readFile: (path: string) => Promise<Result<string, { readonly kind: "not-found" }>>;
  readonly writeFile: (path: string, text: string) => Promise<Result<void, { readonly kind: "not-writable" }>>;
  readonly transportOf: (a: ExchangeAgreement) => Promise<Result<ExchangeTransport, { readonly kind: "no-credential" }>>;
  readonly clock: Clock;
};

const READ_ONLY = defineReach({ channels: ["local", "ssh", "mcp", "rest"], readOnly: true, idempotent: true });
const CHANGES = defineReach({ channels: ["local", "mcp", "rest"] });

const subject = (id: string): Problem => problem("fail", `there is no ${id}`, { code: "E010-UNKNOWN" });

/** One sentence for each code of a finding: what `explain` says. */
export const EXPLANATIONS: Readonly<Record<FindingCode, string>> = {
  "syntax-error": "The text is not of the syntax: its envelope or structure is broken at the offset named. The text itself is never repeated.",
  "unknown-path": "A path of the document is not one the schema defines.",
  "cardinality-min": "A path occurs fewer times than the schema requires.",
  "cardinality-max": "A path occurs more times than the schema allows.",
  "value-pattern": "A value does not match the pattern the schema or profile gives its path.",
  "value-fixed": "A value is not the one value the profile fixes for its path.",
  "code-not-in-terminology": "A code is not in the terminology its path is bound to.",
  "terminology-unavailable": "The terminology a path is bound to was not loaded, so the code could not be checked.",
  "business-rule": "A rule of the agreement, written as a function of the document, found a fault.",
  "unmapped-source-field": "A field of the source ends in no rule of the mapping: it is neither mapped, carried nor dropped by name.",
  "lossy-mapping": "The mapping drops a field by name: what is dropped, and why, is said, and the mapping loses it.",
  "mapping-target-conflict": "Two sources of a mapping are written to the same place of the target.",
};

const isFindingCode = (code: string): code is FindingCode => Object.hasOwn(EXPLANATIONS, code);

const byLevel = (fs: readonly Finding[]): Problem[] =>
  fs.map((f) => problem(f.severity === "error" ? "fail" : "warn", f.message, { code: `E${f.level === "syntax" ? "100" : f.level === "schema" ? "110" : f.level === "profile" ? "120" : f.level === "terminology" ? "130" : "140"}-${f.code.toUpperCase().replaceAll("_", "-")}` }));

async function load(deps: Deps, path: string): Promise<Result<{ readonly tree: Interchange; readonly pluginId: string }, Outcome>> {
  const text = await deps.readFile(path);
  if (text.kind === "err") return { kind: "err", error: outcomeOf(null, { problems: [problem("fail", `${path} cannot be read`, { code: "E020-READ" })] }) };
  const found = detect(deps.plugins, text.value);
  if (found.kind === "err") return { kind: "err", error: outcomeOf(null, { problems: [problem("fail", `${path} is not of a syntax a plugin reads (${found.error.code} at ${found.error.offset})`, { code: "E100-SYNTAX-ERROR" })] }) };
  return { kind: "ok", value: { tree: found.value.tree, pluginId: found.value.plugin.id } };
}

/** The scrubbed outcome of a verb over a tree: every value of the payload is masked in everything the outcome says. */
const scrubbed = <D>(o: Outcome<D>, tree: Interchange | undefined): Outcome<D> => (tree === undefined ? o : redactOutcome(o, redactor(valuesOf(tree).filter((v) => v.length >= 4))));

/** The verbs of Integrations. */
export function integrationsCommands(deps: Deps): readonly Command[] {
  const connectorOf = (name: string | undefined): Connector | undefined => {
    const id = parseConnectorId(name ?? "");
    return id.kind === "ok" ? deps.connectors.get(id.value) : undefined;
  };

  const observe = command({
    name: "observe",
    summary: "Observe a system read-only and report the posture, assets and gaps.",
    options: {},
    operands: [{ name: "CONNECTOR", help: "The id of a connector.", arity: "one" }],
    action: { kind: "report", reach: READ_ONLY },
    run: async (args) => {
      const c = connectorOf(args.positionals[0]);
      if (c === undefined) return outcomeOf(null, { problems: [subject("such connector")] });
      const port = await deps.readPort(c);
      if (port.kind === "err") return outcomeOf(null, { problems: [problem("pending", `the credential ${c.governance.credential.ref} is not available (${port.error.kind})`, { code: "P010-CREDENTIAL", fix: "integrations probe" })] });
      const o = await c.observe({ port: port.value, now: deps.clock.now() });
      if (o.kind === "err") return outcomeOf(null, { problems: [problem("fail", `observing ${c.governance.id} failed: ${o.error.kind}`, { code: "E030-OBSERVE" })] });
      const v = o.value;
      return outcomeOf({ provider: v.provider, account: v.account, at: v.at, assets: v.assets.length, records: v.records?.length ?? 0, gaps: v.gaps, posture: v.posture }, { text: `${v.provider}: ${v.assets.length} assets, ${v.gaps.length} gaps` });
    },
  });

  const probe = command({
    name: "probe",
    summary: "Check that a connector's credential reaches its system, reading one thing.",
    options: {},
    operands: [{ name: "CONNECTOR", help: "The id of a connector.", arity: "one" }],
    action: { kind: "report", reach: READ_ONLY },
    run: async (args) => {
      const c = connectorOf(args.positionals[0]);
      if (c === undefined) return outcomeOf(null, { problems: [subject("such connector")] });
      const port = await deps.readPort(c);
      if (port.kind === "err") return outcomeOf(null, { problems: [problem("pending", `the credential ${c.governance.credential.ref} is not available (${port.error.kind})`, { code: "P010-CREDENTIAL" })] });
      const r = await c.probe({ port: port.value, now: deps.clock.now() });
      return r.kind === "ok" ? outcomeOf({ reachable: true, account: r.value.account }, { text: `${c.governance.id} reaches ${r.value.account}` }) : outcomeOf(null, { problems: [problem("fail", `the probe of ${c.governance.id} failed: ${r.error.kind}`, { code: "E031-PROBE" })] });
    },
  });

  const check = command({
    name: "check",
    summary: "Observe and judge the posture policies of a connector.",
    options: {},
    operands: [{ name: "CONNECTOR", help: "The id of a connector.", arity: "one" }],
    action: { kind: "report", reach: READ_ONLY },
    run: async (args) => {
      const c = connectorOf(args.positionals[0]);
      if (c === undefined) return outcomeOf(null, { problems: [subject("such connector")] });
      const port = await deps.readPort(c);
      if (port.kind === "err") return outcomeOf(null, { problems: [problem("pending", `the credential ${c.governance.credential.ref} is not available (${port.error.kind})`, { code: "P010-CREDENTIAL" })] });
      const now = deps.clock.now();
      const o = await c.observe({ port: port.value, now });
      if (o.kind === "err") return outcomeOf(null, { problems: [problem("fail", `observing ${c.governance.id} failed: ${o.error.kind}`, { code: "E030-OBSERVE" })] });
      const results = c.check(o.value, now);
      const problems = results.flatMap((r) => (r.status === "fail" ? [problem("fail", `${r.id}: ${r.detail}`, { fix: r.fix, code: "E032-POSTURE" })] : r.status === "warn" ? [problem("warn", `${r.id}: ${r.detail}`, { fix: r.fix })] : []));
      return outcomeOf({ results }, { problems, text: `${results.filter((r) => r.status === "pass").length} of ${results.length} policies pass` });
    },
  });

  const validateVerb = command({
    name: "validate",
    summary: "Validate a document against a schema: syntax, schema and terminology findings, never the values.",
    options: { schema: value<never>({ help: "The id of the schema to validate against.", required: true }) },
    operands: [{ name: "FILE", help: "The document.", arity: "one" }],
    action: { kind: "report", reach: READ_ONLY },
    run: async (args) => {
      const loaded = await load(deps, args.positionals[0] ?? "");
      if (loaded.kind === "err") return loaded.error;
      const schema = deps.schemas.get(args.options.schema);
      if (schema === undefined) return outcomeOf(null, { problems: [subject(`schema ${args.options.schema}`)] });
      const findings = transactionsOf(loaded.value.tree).flatMap((t) => validate(t, schema, { terminologies: deps.terminologies }));
      return scrubbed(
        outcomeOf({ findings, valid: !hasErrors(findings), transactions: transactionsOf(loaded.value.tree).length }, { problems: byLevel(findings), text: hasErrors(findings) ? `${findings.length} findings` : "valid" }),
        loaded.value.tree,
      );
    },
  });

  const translate = command({
    name: "translate",
    summary: "Report what translating a document to another syntax would do; the document itself is written only to --out.",
    options: { out: value<never>({ help: "Where to write the translated document." }) },
    operands: [{ name: "FILE", help: "The document.", arity: "one" }],
    action: { kind: "action", effect: "mutate", idempotent: true, reach: CHANGES },
    run: async (args) => {
      const loaded = await load(deps, args.positionals[0] ?? "");
      if (loaded.kind === "err") return loaded.error;
      const plugin = [...deps.plugins.values()].find((p) => p.id === loaded.value.pluginId);
      const written = plugin === undefined ? undefined : plugin.codec.serialize(loaded.value.tree);
      if (written === undefined || written.kind === "err") return outcomeOf(null, { problems: [problem("fail", "the document cannot be written", { code: "E101-SERIALIZE" })] });
      if (args.options.out !== undefined) {
        const w = await deps.writeFile(args.options.out, written.value);
        if (w.kind === "err") return scrubbed(outcomeOf(null, { problems: [problem("fail", `${args.options.out} cannot be written`, { code: "E021-WRITE" })] }), loaded.value.tree);
      }
      return scrubbed(outcomeOf({ transactions: transactionsOf(loaded.value.tree).length, wrote: args.options.out !== undefined }, { text: "translated" }), loaded.value.tree);
    },
  });

  const agreementOf = (name: string): ExchangeAgreement | undefined => {
    const id = parseAgreementId(name);
    return id.kind === "ok" ? deps.agreements.get(id.value) : undefined;
  };

  const send = command({
    name: "send",
    summary: "Send a document to a partner under an agreement: validate, deliver, and say where the exchange stands.",
    options: { agreement: value<never>({ help: "The id of the agreement.", required: true }), schema: value<never>({ help: "The id of the schema to validate against." }) },
    operands: [{ name: "FILE", help: "The document.", arity: "one" }],
    action: { kind: "action", effect: "mutate", reach: CHANGES },
    run: async (args) => {
      const a = agreementOf(args.options.agreement);
      if (a === undefined) return outcomeOf(null, { problems: [subject(`agreement ${args.options.agreement}`)] });
      const loaded = await load(deps, args.positionals[0] ?? "");
      if (loaded.kind === "err") return loaded.error;
      const tree = loaded.value.tree;
      const schema = args.options.schema === undefined ? undefined : deps.schemas.get(args.options.schema);
      const findings = schema === undefined ? [] : transactionsOf(tree).flatMap((t) => validate(t, schema, { terminologies: deps.terminologies }));
      if (hasErrors(findings)) return scrubbed(outcomeOf({ findings, state: "pending" }, { problems: byLevel(findings) }), tree);
      const plugin = [...deps.plugins.values()].find((p) => p.id === loaded.value.pluginId);
      const text = plugin === undefined ? undefined : plugin.codec.serialize(tree);
      if (text === undefined || text.kind === "err") return scrubbed(outcomeOf(null, { problems: [problem("fail", "the document cannot be written", { code: "E101-SERIALIZE" })] }), tree);
      const transport = await deps.transportOf(a);
      if (transport.kind === "err") return scrubbed(outcomeOf(null, { problems: [problem("pending", `the credential ${a.credential} is not available`, { code: "P010-CREDENTIAL" })] }), tree);
      const sent: Result<Delivered, TransportFailure> = await transport.value.send({ contentType: "application/octet-stream", body: text.value });
      const at = deps.clock.now();
      let state: ExchangeState = { kind: "pending" };
      const s1 = transition(state, { kind: "send", at }, a.serviceLevels);
      if (s1.kind === "ok") state = s1.value;
      if (sent.kind === "err") {
        const s2 = transition(state, { kind: "timeout" }, a.serviceLevels);
        if (s2.kind === "ok") state = s2.value;
        return scrubbed(outcomeOf({ state: state.kind, failure: sent.error.kind }, { problems: [problem("fail", `the partner was not reached (${sent.error.kind})`, { code: "E040-DELIVERY" })] }), tree);
      }
      return scrubbed(outcomeOf({ state: state.kind, status: sent.value.status }, { text: `sent to ${a.partner}` }), tree);
    },
  });

  const receive = command({
    name: "receive",
    summary: "Receive a document under an agreement: read it, validate it and say what acknowledgement is due.",
    options: { agreement: value<never>({ help: "The id of the agreement.", required: true }), schema: value<never>({ help: "The id of the schema to validate against." }) },
    operands: [{ name: "FILE", help: "The document.", arity: "one" }],
    action: { kind: "action", effect: "mutate", idempotent: true, reach: CHANGES },
    run: async (args) => {
      const a = agreementOf(args.options.agreement);
      if (a === undefined) return outcomeOf(null, { problems: [subject(`agreement ${args.options.agreement}`)] });
      const loaded = await load(deps, args.positionals[0] ?? "");
      if (loaded.kind === "err") return loaded.error;
      const tree = loaded.value.tree;
      const schema = args.options.schema === undefined ? undefined : deps.schemas.get(args.options.schema);
      const findings = schema === undefined ? [] : transactionsOf(tree).flatMap((t) => validate(t, schema, { terminologies: deps.terminologies }));
      const ackStatus = hasErrors(findings) ? "rejected" : findings.length > 0 ? "accepted-with-errors" : "accepted";
      let state: ExchangeState = { kind: "pending" };
      const r = transition(state, { kind: "receive", at: deps.clock.now() }, a.serviceLevels);
      if (r.kind === "ok") state = r.value;
      const next = transition(state, { kind: "ack", status: ackStatus }, a.serviceLevels);
      if (next.kind === "ok") state = next.value;
      const due: readonly string[] = a.acknowledgements.map((x) => x.kind);
      return scrubbed(outcomeOf({ findings, state: state.kind, acknowledge: ackStatus, due }, { problems: byLevel(findings), text: `received from ${a.partner}: ${ackStatus}` }), tree);
    },
  });

  const explain = command({
    name: "explain",
    summary: "Explain a finding code, or what an acknowledgement means.",
    options: {},
    operands: [{ name: "CODE", help: "A finding code, such as cardinality-min.", arity: "one" }],
    action: { kind: "report", reach: READ_ONLY },
    run: (args) => {
      const code = args.positionals[0] ?? "";
      const text = isFindingCode(code) ? EXPLANATIONS[code] : undefined;
      return Promise.resolve(text === undefined ? outcomeOf(null, { problems: [subject(`code ${code}`)] }) : outcomeOf({ code, explanation: text }, { text }));
    },
  });

  return [observe, probe, check, validateVerb, translate, send, receive, explain];
}

/** The program node `integrations`, with its verbs. */
export function integrationsBranch(deps: Deps) {
  return branch({ name: "integrations", summary: "Observe systems read-only and exchange documents under standards.", children: integrationsCommands(deps) });
}

/** Exhaustive over the ways a delivery fails, for a surface that draws them. */
export function describeFailure(f: TransportFailure): string {
  switch (f.kind) {
    case "refused":
      return "the request was refused before it was sent";
    case "network":
      return "the network gave no answer";
    case "rejected":
      return `the partner rejected it with status ${f.status}`;
    default:
      return absurd(f);
  }
}
