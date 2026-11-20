// Spec: 0005-integrations-observe FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * The logical layer of observation (commons integrations 0005-integrations-observe): the observation record, its entities, the `Connector` contract with
 * `describe`, `probe` and `observe` as methods, the enforcement of governance on what a connector returns, posture policies as data and the evaluation of a
 * policy against an observation.
 *
 * @remarks
 * A connector is made by `defineConnector`, which refuses governance with a problem and wraps the connector's `observe` so that the denylist and the declared
 * entity kinds are applied to what it returns, whatever the connector did. A connector sees a `ReadPort`, which cannot write.
 *
 * @module
 */
import {
  absurd,
  array,
  boolean,
  err,
  integer,
  literal,
  number,
  object,
  ok,
  oneOf,
  record,
  string,
  type Decoder,
  type DecodeError,
  type Result,
} from "@intellectual-frontiers/core";
import {
  governanceProblems,
  isDenied,
  isStale,
  parseInstant,
  type Cadence,
  type ConnectorClass,
  type ConnectorGovernance,
  type EntityKind,
  type GovernanceProblem,
  type Instant,
  type Labels,
  type Scope,
} from "@intellectual-frontiers/integrations/governance";
import type { Expectation, Severity } from "@intellectual-frontiers/grc/governance";
import { evaluate, type Status } from "@intellectual-frontiers/grc/logical";
import type { Json, ReadFailure, ReadPort } from "./ports.ts";

/** A value a posture or a record's property may hold. */
export type Scalar = string | number | boolean;

/** Something the system holds. */
export type Asset = { readonly kind: string; readonly id: string; readonly name: string; readonly where?: string };

/** What an observation could not see, and of what. */
export type Gap = { readonly kind: "denied" | "unavailable" | "partial" | "entity-kind-not-declared"; readonly subject: string };

/** A record in the terms of OCSF: the label of the world's vocabulary, its OCSF class, the system's id, a name and the properties kept. */
export type ObservedRecord = {
  readonly label: string;
  readonly ocsf_class_uid: number;
  readonly native_id: string;
  readonly display_name: string;
  readonly props: Readonly<Record<string, Scalar>>;
  readonly unmapped?: Readonly<Record<string, Json>>;
};

/** Whether a person is employed. */
export type PersonStatus = "active" | "terminated" | "leave" | "unknown";

export type Person = { readonly email: string; readonly name?: string; readonly status: PersonStatus; readonly start?: string; readonly end?: string; readonly manager?: string; readonly type?: string };
export type Account = { readonly system: string; readonly id: string; readonly name: string; readonly email?: string; readonly active: boolean; readonly admin?: boolean; readonly mfa?: boolean; readonly lastLogin?: string; readonly service?: boolean };
export type Device = { readonly source: string; readonly id: string; readonly name: string; readonly owner?: string; readonly os?: string; readonly serial?: string; readonly encrypted?: boolean; readonly managed: boolean; readonly seen?: string };
export type Repository = { readonly system: string; readonly name: string; readonly private: boolean; readonly protected?: boolean; readonly reviews?: boolean; readonly secretScanning?: boolean; readonly dependencyAlerts?: boolean };

/** The entities of an observation, by kind. */
export type Entities = {
  readonly people?: readonly Person[];
  readonly accounts?: readonly Account[];
  readonly devices?: readonly Device[];
  readonly repositories?: readonly Repository[];
};

/** The kind of entity a list of `Entities` holds. */
export const ENTITY_LISTS: Readonly<Record<EntityKind, keyof Entities>> = { person: "people", account: "accounts", device: "devices", repository: "repositories" };

/** An observation of one account of one provider at one moment. */
export type Observation = {
  readonly at: Instant;
  readonly provider: string;
  readonly account: string;
  readonly assets: readonly Asset[];
  readonly posture: Readonly<Record<string, Scalar>>;
  readonly gaps: readonly Gap[];
  readonly entities?: Entities;
  readonly records?: readonly ObservedRecord[];
};

/** The schema id of a persisted observation. */
export const OBSERVATION_SCHEMA = "integrations/observation/1";

/** A persisted observation: it has a kind and a schema, as every persisted document does. */
export type ObservationDocument = { readonly kind: "observation"; readonly schema: typeof OBSERVATION_SCHEMA; readonly observation: Observation };

/** An observation as the document that is persisted. */
export const documentOf = (observation: Observation): ObservationDocument => ({ kind: "observation", schema: OBSERVATION_SCHEMA, observation });

const scalar: Decoder<Scalar> = oneOf(string, number, boolean);
const optionalString = { name: string, email: string, start: string, end: string, manager: string, type: string };

const personD: Decoder<Person> = (input, path) => {
  const base = object({ email: string, status: literal("active", "terminated", "leave", "unknown") }, optionalString)(input, path);
  return base.kind === "err" ? base : ok(base.value as Person);
};
const decodeAsset = object({ kind: string, id: string, name: string }, { where: string });
const decodeGap = object({ kind: literal("denied", "unavailable", "partial", "entity-kind-not-declared"), subject: string });
const decodeRecord = object({ label: string, ocsf_class_uid: integer, native_id: string, display_name: string, props: record(scalar) }, {});
const decodeAccount = object({ system: string, id: string, name: string, active: boolean }, { email: string, admin: boolean, mfa: boolean, lastLogin: string, service: boolean });
const decodeDevice = object({ source: string, id: string, name: string, managed: boolean }, { owner: string, os: string, serial: string, encrypted: boolean, seen: string });
const decodeRepository = object({ system: string, name: string, private: boolean }, { protected: boolean, reviews: boolean, secretScanning: boolean, dependencyAlerts: boolean });
const decodeEntities = object({}, { people: array(personD), accounts: array(decodeAccount), devices: array(decodeDevice), repositories: array(decodeRepository) });

/** Reads a persisted observation back: a document of the right kind and schema, and every field of the right type, or the first error with its path. */
export function parseObservationDocument(input: unknown): Result<Observation, DecodeError> {
  const head = object({ kind: literal("observation"), schema: literal(OBSERVATION_SCHEMA), observation: (x) => ok(x) })(input);
  if (head.kind === "err") return head;
  const body = object(
    { at: string, provider: string, account: string, assets: array(decodeAsset), posture: record(scalar), gaps: array(decodeGap) },
    { entities: decodeEntities, records: array(decodeRecord) },
  )(head.value.observation, "$.observation");
  if (body.kind === "err") return body;
  const at = parseInstant(body.value.at);
  if (at.kind === "err") return err({ kind: "decode", path: "$.observation.at", expected: at.error.expected, found: "a text that is not that" });
  return ok({ ...body.value, at: at.value } as Observation);
}

/** Why an observation or a probe has failed; none of them carries a payload. */
export type ObserveError =
  | { readonly kind: "denied"; readonly subject: string }
  | { readonly kind: "unavailable"; readonly subject: string }
  | { readonly kind: "transport"; readonly subject: string; readonly failure: ReadFailure["kind"] }
  | { readonly kind: "decode"; readonly subject: string; readonly expected: string }
  | { readonly kind: "credential"; readonly why: "missing" | "denied" | "vault-unavailable" };

/** An observe error from a read failure: a denial and a missing resource are what the system said, the rest is the transport's. */
export function fromReadFailure(f: ReadFailure): ObserveError {
  switch (f.kind) {
    case "denied":
      return { kind: "denied", subject: f.subject };
    case "not-found":
      return { kind: "unavailable", subject: f.subject };
    case "rate-limited":
    case "server":
    case "network":
    case "decode":
      return { kind: "transport", subject: f.subject, failure: f.kind };
    default:
      return absurd(f);
  }
}

/** A gap from an error a connector may carry on: what was denied or unavailable is a gap and not a failure. */
export function gapOf(e: ObserveError): Gap | undefined {
  switch (e.kind) {
    case "denied":
      return { kind: "denied", subject: e.subject };
    case "unavailable":
      return { kind: "unavailable", subject: e.subject };
    case "transport":
    case "decode":
    case "credential":
      return undefined;
    default:
      return absurd(e);
  }
}

/** What a connector is told to observe with. */
export type ObserveContext = { readonly port: ReadPort; readonly now: Instant };

/** What a probe finds: the system answered the credential, and how the credential is seen by the system. */
export type ProbeReport = { readonly reachable: true; readonly account: string };

/**
 * A posture policy as data, in the vocabulary of GRC (`@intellectual-frontiers/grc`): the fact it reads, an `Expectation` of GRC (`equals` of the scalar; for a bound, `every` over the one
 * row `{value}` with the operator `ge` or `le`; `non-empty` for presence), how serious a miss is (GRC's `Severity`), what status a miss has (`fail` or `warn`), the controls it bears on
 * (GRC control urns, attached by the consumer) and what to do.
 */
export type PosturePolicy = {
  readonly id: string;
  readonly title: string;
  readonly fact: string;
  readonly want: Expectation;
  readonly severity: Severity;
  readonly onMiss: "fail" | "warn";
  readonly controls: readonly string[];
  readonly fix: string;
};

/** How a policy came out: a status of GRC (`unknown` of the earlier shape is GRC's `pending`: the fact is not yet observed). */
export type PostureStatus = Status;

/** The result of one policy: GRC's status and severity, and what is said of it. */
export type PostureResult = { readonly id: string; readonly title: string; readonly status: Status; readonly severity: Severity; readonly controls: readonly string[]; readonly detail: string; readonly fix: string };

/** One policy against an observation: `pending` where the fact was not observed, else GRC's evaluation of the fact against the expectation (a pass, the policy's `onMiss`, or an `error` where the fact is not the shape the expectation needs). */
export function evaluatePolicy(policy: PosturePolicy, o: Observation): PostureResult {
  const got = o.posture[policy.fact];
  const base = { id: policy.id, title: policy.title, severity: policy.severity, controls: policy.controls, fix: policy.fix };
  if (got === undefined) return { ...base, status: "pending", detail: `${policy.fact} was not observed` };
  const observed: Json = policy.want.kind === "equals" ? got : [{ value: got }];
  const j = evaluate(policy.want, observed);
  const status: Status = j.status === "fail" ? policy.onMiss : j.status;
  return { ...base, status, detail: `${policy.fact}: ${j.reason}` };
}

/** The freshness policy every connector has: the observation is not stale at `now`. */
export function freshnessResult(c: Cadence, o: Observation, now: Instant): PostureResult {
  const stale = isStale(c, o.at, now);
  return { id: "observation-fresh", title: "The observation is fresh", severity: "medium", controls: [], status: stale ? "fail" : "pass", detail: stale ? "the observation is older than its cadence allows" : "the observation is within its cadence", fix: "observe again" };
}

/** What a connector says of itself: derived from its governance, so that it cannot differ from it. It holds no credential field value, only their names and hints. */
export type Description = {
  readonly id: string;
  readonly title: string;
  readonly class: ConnectorClass;
  readonly labels: Labels;
  readonly scope: Scope;
  readonly cadence: Cadence;
  readonly entities: readonly EntityKind[];
  readonly credentialFields: readonly { readonly name: string; readonly secret: boolean; readonly hint: string }[];
  readonly policies: readonly string[];
  readonly readOnly: true;
};

/** A connector: its governance, and the three things it can do as methods. */
export type Connector = {
  readonly governance: ConnectorGovernance;
  readonly policies: readonly PosturePolicy[];
  readonly describe: () => Description;
  readonly probe: (ctx: ObserveContext) => Promise<Result<ProbeReport, ObserveError>>;
  readonly observe: (ctx: ObserveContext) => Promise<Result<Observation, ObserveError>>;
  readonly check: (o: Observation, now: Instant) => readonly PostureResult[];
};

/** What the author of a connector writes: the governance, a read that proves the credential, what it observes and its policies. */
export type ConnectorSpec = {
  readonly governance: ConnectorGovernance;
  readonly probe: (ctx: ObserveContext) => Promise<Result<ProbeReport, ObserveError>>;
  readonly observe: (ctx: ObserveContext) => Promise<Result<Observation, ObserveError>>;
  readonly policies: readonly PosturePolicy[];
};

/** Why a connector is not defined. */
export type DefinitionError = { readonly kind: "governance"; readonly problems: readonly GovernanceProblem[] } | { readonly kind: "duplicate-policy"; readonly id: string };

/** Applies the governance of a connector to an observation: denied properties of records are removed, entity kinds the connector did not declare are removed and named as gaps. */
export function enforce(g: ConnectorGovernance, o: Observation): Observation {
  const records = o.records?.map((r): ObservedRecord => {
    const props = Object.fromEntries(Object.entries(r.props).filter(([k]) => !isDenied(g.denylist, k)));
    const unmapped = r.unmapped === undefined ? undefined : Object.fromEntries(Object.entries(r.unmapped).filter(([k]) => !isDenied(g.denylist, k)));
    return unmapped === undefined ? { label: r.label, ocsf_class_uid: r.ocsf_class_uid, native_id: r.native_id, display_name: r.display_name, props } : { label: r.label, ocsf_class_uid: r.ocsf_class_uid, native_id: r.native_id, display_name: r.display_name, props, unmapped };
  });
  const gaps: Gap[] = [...o.gaps];
  let entities: Entities | undefined;
  if (o.entities !== undefined) {
    const kept: { -readonly [K in keyof Entities]: Entities[K] } = {};
    for (const kind of ["person", "account", "device", "repository"] as const) {
      const list = ENTITY_LISTS[kind];
      const items = o.entities[list];
      if (items === undefined || items.length === 0) continue;
      if (g.entities.includes(kind)) Object.assign(kept, { [list]: items });
      else gaps.push({ kind: "entity-kind-not-declared", subject: kind });
    }
    entities = kept;
  }
  const base = { at: o.at, provider: o.provider, account: o.account, assets: o.assets, posture: o.posture, gaps };
  return { ...base, ...(entities === undefined ? {} : { entities }), ...(records === undefined ? {} : { records }) };
}

/** A connector from what its author wrote, or why not. */
export function defineConnector(spec: ConnectorSpec): Result<Connector, DefinitionError> {
  const problems = governanceProblems(spec.governance);
  if (problems.length > 0) return err({ kind: "governance", problems });
  const seen = new Set<string>();
  for (const p of spec.policies) {
    if (seen.has(p.id) || p.id === "observation-fresh") return err({ kind: "duplicate-policy", id: p.id });
    seen.add(p.id);
  }
  const g = spec.governance;
  const connector: Connector = {
    governance: g,
    policies: spec.policies,
    describe: () => ({
      id: g.id,
      title: g.title,
      class: g.class,
      labels: g.labels,
      scope: g.scope,
      cadence: g.cadence,
      entities: g.entities,
      credentialFields: g.credential.fields.map((f) => ({ name: f.name, secret: f.secret, hint: f.hint })),
      policies: ["observation-fresh", ...spec.policies.map((p) => p.id)],
      readOnly: true,
    }),
    probe: spec.probe,
    observe: async (ctx) => {
      const r = await spec.observe(ctx);
      return r.kind === "ok" ? ok(enforce(g, r.value)) : r;
    },
    check: (o, now) => [freshnessResult(g.cadence, o, now), ...spec.policies.map((p) => evaluatePolicy(p, o))],
  };
  return ok(connector);
}
