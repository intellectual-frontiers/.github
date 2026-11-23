// Spec: 0001-content-collector FR-001, FR-003
/** Assemble observed renditions into a traceable Kanon model and a verified data bundle. @module */
import type { Result } from "@intellectual-frontiers/core";
import {
  buildMatrix, droppedFindings, makeBundle, modelFindings, parseElementId, parseInstanceName, verifyBundle,
  type BundleFault, type Disposition, type ElementId, type Finding, type LayeredModel, type Matrix, type ModelElement, type TraceEdge, type VerifiedBundle,
} from "@intellectual-frontiers/kanon";
import type { Claim } from "@intellectual-frontiers/content/governance";

/** Evidence read from a rendition's output, keyed to the claim it actually presents. */
export type Observation = {
  readonly claim: string;
  readonly evidence?: readonly string[];
  readonly asOf?: string;
  readonly audit?: Claim["audit"];
};

/** Output observations for a named rendition, such as web or markdown. */
export type Rendition = { readonly name: string; readonly observations: readonly Observation[] };

const annotations = ["evidence", "asOf", "audit"] as const;
const layers: LayeredModel["layers"] = [
  { id: "governance", title: "Governance", summary: "Public claims and their provenance.", kinds: ["claim"] },
  { id: "logical", title: "Logical", summary: "Collected claims.", kinds: ["collected-claim"] },
  { id: "physical", title: "Physical", summary: "Claims observed in a rendition.", kinds: ["rendered-claim"] },
];

function appendProjection(
  elements: ModelElement[], trace: TraceEdge[], from: ElementId, to: ModelElement, how: string,
): void {
  elements.push(to);
  trace.push({ from, to: to.id, how });
}

function expresses(observation: Observation, claim: Claim, annotation: typeof annotations[number]): boolean {
  switch (annotation) {
    case "evidence":
      return claim.evidence.every((source) => observation.evidence?.includes(source.url) === true);
    case "asOf":
      return observation.asOf === claim.asOf;
    case "audit":
      return observation.audit === claim.audit;
  }
}

/** The collected model and the evidence observed across its renditions. */
export type ContentAssembly = { readonly model: LayeredModel; readonly matrix: Matrix; readonly findings: readonly Finding[] };

/** Project claims into a model and account for what was observed in each output. */
export function assembleContent(name: string, claims: readonly Claim[], renditions: readonly Rendition[]): Result<ContentAssembly, string> {
  const elements: ModelElement[] = [];
  const dispositions: Disposition[] = [];
  const trace: TraceEdge[] = [];
  const instances: LayeredModel["instances"][number][] = [];
  const outputs = new Map<LayeredModel["instances"][number], ReadonlyMap<string, Observation>>();
  const publicIds = new Set(claims.map((claim) => claim.id));
  for (const rendition of renditions) {
    const instance = parseInstanceName(rendition.name);
    if (instance.kind === "err") return instance;
    const observations = new Map(rendition.observations.map((item) => [item.claim, item]));
    if (outputs.has(instance.value) || observations.size !== rendition.observations.length)
      return { kind: "err" as const, error: "Rendition names and observed claim IDs must be unique." };
    if (rendition.observations.some((item) => !publicIds.has(item.claim)))
      return { kind: "err" as const, error: "A rendition contains a claim outside the public collection." };
    instances.push(instance.value);
    outputs.set(instance.value, observations);
  }
  for (const claim of claims) {
    const id = parseElementId(claim.id);
    if (id.kind === "err") return id;
    const logical = parseElementId(`collected:${claim.id}`);
    if (logical.kind === "err") return logical;
    const source = { file: claim.file, line: claim.line };
    const base = { name: claim.id, definition: claim.text, source };
    const properties = {
      evidence: claim.evidence.map((item) => item.url), audit: claim.audit,
      ...(claim.asOf === undefined ? {} : { asOf: claim.asOf }),
    };
    elements.push({ ...base, id: id.value, layer: "governance", kind: "claim", properties });
    appendProjection(elements, trace, id.value, { ...base, id: logical.value, layer: "logical", kind: "collected-claim", properties: {} }, "collects");
    for (const [instance, observations] of outputs) {
      const observation = observations.get(claim.id);
      if (observation === undefined) continue;
      const target = parseElementId(`${instance}:${claim.id}`);
      if (target.kind === "err") return target;
      appendProjection(elements, trace, logical.value, { ...base, id: target.value, layer: "physical", kind: "rendered-claim", instance, properties: {} }, "renders");
      for (const annotation of annotations) {
        if (annotation in properties && expresses(observation, claim, annotation))
          dispositions.push({ element: id.value, annotation, instance, outcome: "expressed", target: target.value });
      }
    }
  }
  const model: LayeredModel = {
    name, library: "content", title: name, summary: "Public claim trace and rendition evidence.",
    layers, elements, dispositions, trace, instances, findings: [],
    vocabulary: { kinds: layers.map(({ id, kinds }) => ({ layer: id, kinds })), relationKinds: [], annotations },
  };
  return { kind: "ok" as const, value: { model, matrix: buildMatrix(model), findings: [...modelFindings(model), ...droppedFindings(model)] } };
}

/** Serialize the assembled model as deterministic data with a manifest. */
export const contentBundle = makeBundle;

/** Verify the bytes and check the decoded content model before using it. */
export async function verifyContentBundle(input: Parameters<typeof verifyBundle>[0]): Promise<Result<VerifiedBundle & { readonly findings: readonly Finding[] }, readonly BundleFault[]>> {
  const bundle = await verifyBundle(input);
  if (bundle.kind === "err") return bundle;
  const model = bundle.value.model;
  return { kind: "ok" as const, value: { ...bundle.value, findings: [...modelFindings(model), ...droppedFindings(model)] } };
}
