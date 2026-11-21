// Spec: 0004-grc-documents FR-005, FR-006, FR-007
/**
 * The `oscal` serializer (0004-grc-documents FR-006, FR-007): an assessment written as OSCAL JSON, as `assessment-results`, a `system-security-plan` of what is implemented, or a
 * `plan-of-action-and-milestones` of what is open, by the option `model`. Every `uuid` is a version 5 UUID of the assessment's id and a stable name, so that the same assessment gives the same
 * document. A control is written by its own id (the last part of its URN) with its framework in a property; where the caller names a `framework` option, a crosswalk of `equal` gives the
 * control of that framework.
 *
 * @limits
 * The structure follows OSCAL 1.2.3's models for the fields written; the output was not run through OSCAL's own validator here. A system's characteristics beyond its name are not invented:
 * where the assessment says nothing of them the document says so in its description.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Json, mappedControls, parseControlUrn } from "@intellectual-frontiers/grc/governance";
import { type Assessment, type Result as Outcome, type SerializeContext, type SerializeProblem, type Serializer, uuidOf } from "@intellectual-frontiers/grc/logical";

/** The version of OSCAL the documents are written as. */
export const OSCAL_VERSION = "1.2.3";
const NS = "https://intellectual-frontiers.github.io/grc/oscal";

type Obj = { [key: string]: unknown };

function controlOf(urn: string, ctx: SerializeContext): { readonly id: string; readonly framework: string } {
  const target = ctx.options?.["framework"];
  const p = parseControlUrn(urn);
  if (p.kind === "err") return { id: urn, framework: "unknown" };
  if (typeof target === "string" && target !== p.value.framework) {
    const m = mappedControls(ctx.crosswalks ?? [], urn).find((x) => x.relationship === "equal" && parseControlUrn(x.urn).kind === "ok" && x.urn.startsWith(`urn:grc:${target}:`));
    const q = m === undefined ? undefined : parseControlUrn(m.urn);
    if (q?.kind === "ok") return { id: q.value.control.toLowerCase(), framework: q.value.framework };
  }
  return { id: p.value.control.toLowerCase(), framework: p.value.framework };
}

const OPEN = new Set(["fail", "error", "gap", "warn"]);

async function metadata(a: Assessment, title: string): Promise<Obj> {
  return { title, "last-modified": a.createdAt, version: a.schema, "oscal-version": OSCAL_VERSION };
}

async function observations(a: Assessment, ctx: SerializeContext): Promise<readonly Obj[]> {
  return Promise.all(
    [...a.results]
      .sort((x, y) => (x.id < y.id ? -1 : 1))
      .map(async (r: Outcome) => ({
        uuid: await uuidOf([a.id, "observation", r.id]),
        title: `${r.check} on ${r.subject}`,
        description: r.reason,
        methods: ["TEST"],
        types: ["finding"],
        collected: r.observedAt,
        props: [
          { name: "status", ns: NS, value: r.status },
          { name: "severity", ns: NS, value: r.severity },
          ...r.controls.map((c) => ({ name: "control", ns: NS, value: controlOf(c, ctx).id })),
        ],
      })),
  );
}

async function assessmentResults(a: Assessment, ctx: SerializeContext): Promise<Obj> {
  const obs = await observations(a, ctx);
  const byControl = new Map<string, Outcome[]>();
  for (const r of a.results) for (const c of r.controls) byControl.set(controlOf(c, ctx).id, [...(byControl.get(controlOf(c, ctx).id) ?? []), r]);
  const ids = [...byControl.keys()].sort();
  const findings = await Promise.all(
    ids.map(async (id) => {
      const rs = byControl.get(id) ?? [];
      const satisfied = rs.every((r) => r.status === "pass" || r.status === "accepted" || r.status === "not-applicable");
      return {
        uuid: await uuidOf([a.id, "finding", id]),
        title: id,
        description: `${id}: ${satisfied ? "satisfied" : "not satisfied"} by ${rs.length} results.`,
        target: { type: "objective-id", "target-id": id, status: { state: satisfied ? "satisfied" : "not-satisfied" } },
        "related-observations": await Promise.all(rs.map(async (r) => ({ "observation-uuid": await uuidOf([a.id, "observation", r.id]) }))),
      };
    }),
  );
  const plan = await uuidOf([a.id, "assessment-plan"]);
  return {
    "assessment-results": {
      uuid: await uuidOf([a.id, "assessment-results"]),
      metadata: await metadata(a, `${a.title}: assessment results`),
      "import-ap": { href: `#${plan}` },
      results: [
        {
          uuid: await uuidOf([a.id, "result"]),
          title: a.title,
          description: `The results of ${a.title}, assessed at ${a.createdAt}.`,
          start: a.createdAt,
          "reviewed-controls": { "control-selections": [ids.length === 0 ? { "include-all": {} } : { "include-controls": ids.map((id) => ({ "control-id": id })) }] },
          ...(obs.length === 0 ? {} : { observations: obs }),
          ...(findings.length === 0 ? {} : { findings }),
        },
      ],
      "back-matter": { resources: [{ uuid: plan, title: `The assessment plan of ${a.title}` }] },
    },
  };
}

/** What the caller says of the system, beyond what the assessment shows: nothing is invented where it is not said. */
type SystemOptions = {
  readonly description?: string;
  readonly sensitivity?: "low" | "moderate" | "high";
  readonly boundary?: string;
  readonly profile?: string;
  readonly informationTypes?: readonly { readonly title: string; readonly description: string }[];
  readonly components?: readonly { readonly name: string; readonly type?: string; readonly description?: string }[];
  readonly users?: readonly { readonly title: string }[];
  /** Whose each control is: `provider` satisfies it for others, `inherited` comes from a provider, `customer` is left to the customer. */
  readonly responsibilities?: Readonly<Record<string, "provider" | "inherited" | "customer">>;
};

function systemOf(ctx: SerializeContext): SystemOptions {
  const v = ctx.options?.["system"];
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as SystemOptions) : {};
}

async function ssp(a: Assessment, ctx: SerializeContext): Promise<Obj> {
  const sys = systemOf(ctx);
  const subjects = [...new Set(a.results.map((r) => r.subject))].sort();
  const thisSystem = await uuidOf([a.id, "component"]);
  const extra = await Promise.all((sys.components ?? []).map(async (c) => ({ uuid: await uuidOf([a.id, "component", c.name]), type: c.type ?? "software", title: c.name, description: c.description ?? `${c.name}, as the system's description names it.`, status: { state: "operational" } })));
  // what each control is shown by: the checks, and whether every result passes
  const shown = new Map<string, { checks: Set<string>; allPass: boolean }>();
  for (const r of a.results) {
    for (const c of r.controls) {
      const id = controlOf(c, ctx).id;
      const e = shown.get(id) ?? { checks: new Set<string>(), allPass: true };
      e.checks.add(r.check);
      if (r.status !== "pass" && r.status !== "accepted" && r.status !== "not-applicable") e.allPass = false;
      shown.set(id, e);
    }
  }
  const requirements = await Promise.all(
    [...shown.keys()].sort().map(async (id) => {
      const e = shown.get(id) ?? { checks: new Set<string>(), allPass: false };
      const who = sys.responsibilities?.[id] ?? sys.responsibilities?.[id.toUpperCase()];
      const by: Obj = {
        "component-uuid": thisSystem,
        uuid: await uuidOf([a.id, "by", id]),
        description: `${e.allPass ? "Shown" : "Not yet shown"} by the checks ${[...e.checks].sort().join(", ")}.`,
        "implementation-status": { state: e.allPass ? "implemented" : "partial" },
        ...(who === "inherited" ? { inherited: [{ uuid: await uuidOf([a.id, "inherited", id]), description: `${id} is inherited from a provider.` }] } : {}),
        ...(who === "provider" ? { satisfied: [{ uuid: await uuidOf([a.id, "satisfied", id]), description: `${id} is satisfied by this system for its customers.` }] } : {}),
        ...(who === "customer" ? { export: { responsibilities: [{ uuid: await uuidOf([a.id, "responsibility", id]), description: `${id} is the customer's to satisfy.` }] } } : {}),
      };
      return { uuid: await uuidOf([a.id, "implemented", id]), "control-id": id, "by-components": [by] };
    }),
  );
  return {
    "system-security-plan": {
      uuid: await uuidOf([a.id, "system-security-plan"]),
      metadata: await metadata(a, `${a.title}: system security plan`),
      "import-profile": { href: sys.profile ?? `#${await uuidOf([a.id, "profile"])}` },
      "system-characteristics": {
        "system-ids": [{ id: a.id }],
        "system-name": a.title,
        description: sys.description ?? `The controls implemented, as shown by the checks of ${a.title}; the assessment says nothing else of the system.`,
        ...(sys.sensitivity === undefined ? {} : { "security-sensitivity-level": sys.sensitivity }),
        "system-information": {
          "information-types": await Promise.all((sys.informationTypes ?? [{ title: "Not stated by the assessment.", description: "The assessment does not say what information the system holds." }]).map(async (t) => ({ uuid: await uuidOf([a.id, "information-type", t.title]), title: t.title, description: t.description }))),
        },
        status: { state: "operational" },
        "authorization-boundary": { description: sys.boundary ?? "Not stated by the assessment." },
      },
      "system-implementation": {
        users: await Promise.all((sys.users ?? [{ title: "Not stated by the assessment." }]).map(async (u) => ({ uuid: await uuidOf([a.id, "user", u.title]), title: u.title }))),
        components: [{ uuid: thisSystem, type: "this-system", title: a.title, description: `The subjects assessed: ${subjects.join(", ") || "none"}.`, status: { state: "operational" } }, ...extra],
      },
      "control-implementation": { description: `What ${a.title} shows of each control.`, "implemented-requirements": requirements },
    },
  };
}

async function poam(a: Assessment, ctx: SerializeContext): Promise<Obj> {
  const open = a.findings.filter((f) => OPEN.has(f.status) && f.exception === undefined).sort((x, y) => (x.id < y.id ? -1 : 1));
  const risks = [
    ...(await Promise.all(
      open.map(async (f) => ({
        uuid: await uuidOf([a.id, "risk", f.id]),
        title: f.title,
        description: f.detail,
        statement: `${f.title} on ${f.subject} (${f.controls.map((c) => controlOf(c, ctx).id).join(", ")}).`,
        status: "open",
        ...(f.remediation === undefined ? {} : { remediations: [{ uuid: await uuidOf([a.id, "remediation", f.id]), lifecycle: "planned", title: "Remediation", description: f.remediation }] }),
      })),
    )),
    ...(await Promise.all(
      [...a.risks]
        .sort((x, y) => (x.id < y.id ? -1 : 1))
        .map(async (r) => ({
          uuid: await uuidOf([a.id, "risk", r.id]),
          title: r.title,
          description: r.description,
          statement: `Level ${r.level}, owned by ${r.owner}, to be reviewed by ${r.reviewBy}.`,
          status: r.treatment === "accept" ? "deviation-approved" : "open",
        })),
      )),
  ];
  const fixed = risks;
  const items = await Promise.all(
    fixed.map(async (r) => ({ uuid: await uuidOf([a.id, "poam-item", r.uuid]), title: r.title, description: r.description, "related-risks": [{ "risk-uuid": r.uuid }] })),
  );
  return {
    "plan-of-action-and-milestones": {
      uuid: await uuidOf([a.id, "plan-of-action-and-milestones"]),
      metadata: await metadata(a, `${a.title}: plan of action and milestones`),
      "import-ssp": { href: `#${await uuidOf([a.id, "system-security-plan"])}` },
      ...(fixed.length === 0 ? {} : { risks: fixed }),
      "poam-items": items.length === 0 ? [{ uuid: await uuidOf([a.id, "poam-item", "none"]), title: "Nothing is open", description: "No finding is open and no risk is held." }] : items,
    },
  };
}

/** The `oscal` serializer: option `model` is `assessment-results` (the default), `system-security-plan` or `plan-of-action-and-milestones`. */
export const oscal: Serializer = {
  id: "oscal",
  format: "OSCAL",
  version: OSCAL_VERSION,
  media: "application/json",
  async serialize(a: Assessment, ctx: SerializeContext): Promise<Result<string, SerializeProblem>> {
    const model: Json | undefined = ctx.options?.["model"];
    const make = model === undefined || model === "assessment-results" ? assessmentResults : model === "system-security-plan" ? ssp : model === "plan-of-action-and-milestones" ? poam : undefined;
    if (make === undefined) return err({ kind: "unsupported", message: `the OSCAL model ${String(model)} is not written: assessment-results, system-security-plan or plan-of-action-and-milestones` });
    return ok(`${JSON.stringify(await make(a, ctx), null, 2)}\n`);
  },
};
