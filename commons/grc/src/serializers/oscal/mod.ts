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

async function ssp(a: Assessment, ctx: SerializeContext): Promise<Obj> {
  const component = await uuidOf([a.id, "component"]);
  const implemented = new Map<string, Set<string>>();
  for (const r of a.results) {
    if (r.status !== "pass" && r.status !== "accepted") continue;
    for (const c of r.controls) implemented.set(controlOf(c, ctx).id, new Set([...(implemented.get(controlOf(c, ctx).id) ?? []), r.check]));
  }
  const requirements = await Promise.all(
    [...implemented.keys()].sort().map(async (id) => ({
      uuid: await uuidOf([a.id, "implemented", id]),
      "control-id": id,
      "by-components": [
        { "component-uuid": component, uuid: await uuidOf([a.id, "by", id]), description: `Shown by the checks ${[...(implemented.get(id) ?? [])].sort().join(", ")}.` },
      ],
    })),
  );
  return {
    "system-security-plan": {
      uuid: await uuidOf([a.id, "system-security-plan"]),
      metadata: await metadata(a, `${a.title}: system security plan`),
      "import-profile": { href: `#${await uuidOf([a.id, "profile"])}` },
      "system-characteristics": {
        "system-ids": [{ id: a.id }],
        "system-name": a.title,
        description: `The controls implemented, as shown by the checks of ${a.title}; the assessment says nothing else of the system.`,
        status: { state: "operational" },
        "authorization-boundary": { description: "Not stated by the assessment." },
      },
      "system-implementation": {
        users: [{ uuid: await uuidOf([a.id, "user"]), title: "Not stated by the assessment." }],
        components: [{ uuid: component, type: "this-system", title: a.title, description: `The subjects assessed: ${[...new Set(a.results.map((r) => r.subject))].sort().join(", ") || "none"}.`, status: { state: "operational" } }],
      },
      "control-implementation": { description: `What ${a.title} shows to be implemented.`, "implemented-requirements": requirements },
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
