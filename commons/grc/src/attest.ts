// Spec: 0001-grc-engineering FR-018
/**
 * Attestations (commons 0001-grc-engineering FR-018): an assessment as CycloneDX 1.6 `declarations` (assessors, attestations, claims, evidence and
 * targets) in a minimal CycloneDX 1.6 BOM, and in-toto Statements v1 with a predicate type the caller names, ready for a DSSE envelope
 * (`crypto/dsse`, 0005-typescript-runtime FR-045).
 *
 * - `definitions.standards`: one standard per catalog the assessment's controls implement (a control that implements none stands as a
 *   requirement of a standard named after the pack), each catalog control a requirement.
 * - `declarations.evidence`: one entry per finding, its digests as RFC 6920 `ni:///sha-256;...` URIs.
 * - `declarations.claims`: for each requirement, a claim that its controls meet it, with the evidence of the passing findings and, as
 *   counter-evidence, of the others; and where some newest finding does not pass, a counter-claim that it is not met.
 * - `declarations.attestations`: the assessor maps each requirement to its claim, its counter-claim if any, and a conformance score, the
 *   share of applicable newest findings that pass (0 where none).
 *
 * Every list is in an order of its own and the serial number is a version 5 UUID of a namespace the caller gives and the pack and time,
 * so the same assessment gives the same BOM. The in-toto statement is built by `crypto/dsse`'s `statement` and keeps the predicate's
 * type in its own type, so `signStatement` and `verifyStatement` take it as it is.
 *
 * @example
 * ```ts
 * import { CYCLONEDX_PREDICATE_TYPE, digestSubject, intotoStatement } from "./attest.ts";
 * const s = intotoStatement([await digestSubject("report.json", new TextEncoder().encode("{}"))], CYCLONEDX_PREDICATE_TYPE, { bomFormat: "CycloneDX" });
 * s.predicateType; // "https://cyclonedx.org/bom", as a literal type
 * ```
 *
 * @module
 */
import { newestFindings } from "./assess.ts";
import { toBase64Url } from "@intellectual-frontiers/formats/base64";
import { type ResourceDescriptor, type Statement, statement } from "@intellectual-frontiers/crypto/dsse";
import { canonicalize } from "./evidence.ts";
import { type Assessment, type ControlSummary, type Finding, type Instant, findingKey } from "./grc.ts";
import { fromHex } from "@intellectual-frontiers/formats/hex";
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type Uuid, uuidUrn, uuidV5Of } from "@intellectual-frontiers/crypto/uuid";

// ---------------------------------------------------------------------------------------------------------------------------- CycloneDX types

/** A CycloneDX 1.6 component type. */
export type CdxComponentType =
  | "application"
  | "framework"
  | "library"
  | "container"
  | "platform"
  | "operating-system"
  | "device"
  | "device-driver"
  | "firmware"
  | "file"
  | "machine-learning-model"
  | "data"
  | "cryptographic-asset";

/** A requirement of a standard. */
export type CdxRequirement = { readonly "bom-ref": string; readonly identifier: string; readonly title?: string; readonly text?: string };

/** A standard (`definitions.standards`): its requirements, and what is known of it. */
export type CdxStandard = {
  readonly "bom-ref": string;
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly owner?: string;
  readonly requirements: readonly CdxRequirement[];
};

/** An assessor. */
export type CdxAssessor = { readonly "bom-ref": string; readonly thirdParty: boolean; readonly organization: { readonly name: string } };

/** How far a requirement is met: a score from 0 to 1 and why. */
export type CdxConformance = { readonly score: number; readonly rationale: string };

/** One requirement of an attestation, with the claims and counter-claims that bear on it. */
export type CdxAttestationMapItem = {
  readonly requirement: string;
  readonly claims: readonly string[];
  readonly counterClaims?: readonly string[];
  readonly conformance: CdxConformance;
};

/** An attestation: an assessor's map of requirements to claims. */
export type CdxAttestation = { readonly summary: string; readonly assessor: string; readonly map: readonly CdxAttestationMapItem[] };

/** A claim about a target, with the evidence for it and against it. */
export type CdxClaim = {
  readonly "bom-ref": string;
  readonly target: string;
  readonly predicate: string;
  readonly reasoning: string;
  readonly evidence?: readonly string[];
  readonly counterEvidence?: readonly string[];
};

/** A piece of evidence: what it is, when it was made, and where its data is. */
export type CdxEvidence = {
  readonly "bom-ref": string;
  readonly description: string;
  readonly data?: readonly { readonly name: string; readonly contents: { readonly url: string } }[];
  readonly created: Instant;
};

/** A component claims are about. */
export type CdxTargetComponent = {
  readonly "bom-ref": string;
  readonly type: CdxComponentType;
  readonly name: string;
  readonly version?: string;
};

/** CycloneDX 1.6 declarations. */
export type CdxDeclarations = {
  readonly assessors: readonly CdxAssessor[];
  readonly attestations: readonly CdxAttestation[];
  readonly claims: readonly CdxClaim[];
  readonly evidence: readonly CdxEvidence[];
  readonly targets: { readonly components: readonly CdxTargetComponent[] };
};

/** A tool that made a BOM. */
export type CdxTool = { readonly type: "application"; readonly name: string; readonly version: string };

/** A minimal CycloneDX 1.6 BOM that carries declarations. */
export type CdxBom = {
  readonly bomFormat: "CycloneDX";
  readonly specVersion: "1.6";
  readonly serialNumber: `urn:uuid:${string}`;
  readonly version: 1;
  readonly metadata: { readonly timestamp: Instant; readonly tools?: { readonly components: readonly CdxTool[] } };
  readonly definitions: { readonly standards: readonly CdxStandard[] };
  readonly declarations: CdxDeclarations;
};

/** What an attestation needs beyond the assessment. */
export type AttestOptions = {
  /** The namespace of the BOM's serial number and of its evidence's UUIDs. */
  readonly namespace: Uuid;
  readonly assessor: { readonly name: string; readonly thirdParty: boolean };
  /** What the claims are about. */
  readonly target: { readonly name: string; readonly type?: CdxComponentType; readonly version?: string };
  readonly tool?: { readonly name: string; readonly version: string };
  /** What is known of each catalog, by its id. */
  readonly standards?: Readonly<
    Record<string, { readonly name?: string; readonly version?: string; readonly owner?: string; readonly description?: string }>
  >;
  readonly summary?: string;
};

// ---------------------------------------------------------------------------------------------------------------------------- declarations

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const ref = (kind: string, ...parts: readonly string[]): string => `${kind}:${parts.map(encodeURIComponent).join("/")}`;

function stableText(value: unknown): string {
  const c = canonicalize(value);
  return c.kind === "ok" ? c.value : String(value);
}

/** An RFC 6920 Named Information URI of a SHA-256: `ni:///sha-256;` and the digest in base64url without padding. */
export function niUri(digest: Sha256): string {
  return `ni:///sha-256;${toBase64Url(fromHex(digest) ?? new Uint8Array(0))}`;
}

type Requirement = { readonly standard: string; readonly id: string; readonly title?: string; readonly controls: readonly string[] };

function requirementsOf(controls: readonly ControlSummary[], pack: string): readonly Requirement[] {
  const map = new Map<string, { standard: string; id: string; title?: string; controls: Set<string> }>();
  const add = (standard: string, id: string, control: string, title?: string): void => {
    const k = JSON.stringify([standard, id]);
    const r = map.get(k) ?? { standard, id, ...(title === undefined ? {} : { title }), controls: new Set<string>() };
    r.controls.add(control);
    map.set(k, r);
  };
  for (const c of controls) {
    if (c.implements.length === 0) add(pack, c.id, c.id, c.title);
    for (const r of c.implements) add(r.catalog, r.id, c.id);
  }
  return [...map.entries()]
    .sort(([a], [b]) => byText(a, b))
    .map(([, r]) => ({
      standard: r.standard,
      id: r.id,
      ...(r.title === undefined ? {} : { title: r.title }),
      controls: [...r.controls].sort(byText),
    }));
}

const PASSING = new Set(["pass"]);

/** An assessment's declarations, and the standards their requirements are of. */
export async function declarations(
  a: Assessment,
  o: AttestOptions,
): Promise<{ readonly standards: readonly CdxStandard[]; readonly declarations: CdxDeclarations }> {
  const controls = new Map<string, ControlSummary>();
  for (const c of [...a.controls, ...a.findings.map((f) => f.control)]) if (!controls.has(c.id)) controls.set(c.id, c);
  const requirements = requirementsOf([...controls.values()], a.pack.id);

  const keyed = a.findings.map((f) => ({ f, key: findingKey(f), text: stableText(f) }));
  keyed.sort((x, y) => byText(x.key, y.key) || byText(x.text, y.text));
  const count = new Map<string, number>();
  const evidenceRef = new Map<Finding, string>();
  const evidence: CdxEvidence[] = [];
  for (const { f, key } of keyed) {
    const n = count.get(key) ?? 0;
    count.set(key, n + 1);
    const uuid = await uuidV5Of(o.namespace, ["evidence", a.pack.id, a.at, key, String(n)]);
    const bomRef = `evidence:${uuid}`;
    evidenceRef.set(f, bomRef);
    const digests = [...new Set(f.evidence)].sort(byText);
    evidence.push({
      "bom-ref": bomRef,
      description: `${f.control.id} on ${f.subject.kind} ${f.subject.id}: ${f.outcome}${f.detail === "" ? "" : `: ${f.detail}`}`,
      ...(digests.length === 0 ? {} : { data: digests.map((d) => ({ name: `sha256:${d}`, contents: { url: niUri(d) } })) }),
      created: f.at,
    });
  }

  const newest = new Set(newestFindings(a.findings));
  const target = ref("target", o.target.name);
  const assessor = ref("assessor", o.assessor.name);
  const claims: CdxClaim[] = [];
  const map: CdxAttestationMapItem[] = [];
  for (const r of requirements) {
    const label = `${r.standard} ${r.id}`;
    const mine = keyed.map(({ f }) => f).filter((f) => r.controls.includes(f.control.id));
    const refsOf = (fs: readonly Finding[]): readonly string[] => fs.flatMap((f) => evidenceRef.get(f) ?? []);
    const passing = mine.filter((f) => PASSING.has(f.outcome));
    const failing = mine.filter((f) => f.outcome !== "pass" && f.outcome !== "not-applicable");
    const current = mine.filter((f) => newest.has(f) && f.outcome !== "not-applicable");
    const currentPass = current.filter((f) => f.outcome === "pass").length;
    const accepted = current.filter((f) => f.outcome === "accepted").length;
    const open = current.filter((f) => f.outcome !== "pass" && f.outcome !== "accepted");
    const claim = ref("claim", r.standard, r.id);
    claims.push({
      "bom-ref": claim,
      target,
      predicate: `${label} is met by ${r.controls.join(", ")}`,
      reasoning:
        current.length === 0
          ? "no applicable finding yet"
          : `${currentPass} of ${current.length} applicable findings pass${accepted === 0 ? "" : `, ${accepted} accepted under a waiver`}`,
      ...(passing.length === 0 ? {} : { evidence: refsOf(passing) }),
      ...(failing.length === 0 ? {} : { counterEvidence: refsOf(failing) }),
    });
    const counter = ref("counter-claim", r.standard, r.id);
    if (open.length > 0 || accepted > 0) {
      const against = current.filter((f) => f.outcome !== "pass");
      claims.push({
        "bom-ref": counter,
        target,
        predicate: `${label} is not met for ${[...new Set(against.map((f) => `${f.subject.kind} ${f.subject.id}`))].sort(byText).join(", ")}`,
        reasoning: [...new Set(against.map((f) => f.outcome))].sort(byText).join(", "),
        evidence: refsOf(against),
      });
    }
    const score = current.length === 0 ? 0 : Math.round((currentPass / current.length) * 1000) / 1000;
    map.push({
      requirement: ref("requirement", r.standard, r.id),
      claims: [claim],
      ...(open.length > 0 || accepted > 0 ? { counterClaims: [counter] } : {}),
      conformance: {
        score,
        rationale: current.length === 0 ? "no applicable finding" : `${currentPass} of ${current.length} applicable newest findings pass`,
      },
    });
  }

  const standardIds = [...new Set(requirements.map((r) => r.standard))].sort(byText);
  const standards = standardIds.map((s): CdxStandard => {
    const known = o.standards?.[s];
    return {
      "bom-ref": ref("standard", s),
      name: known?.name ?? s,
      ...(known?.version === undefined ? {} : { version: known.version }),
      ...(known?.description === undefined ? {} : { description: known.description }),
      ...(known?.owner === undefined ? {} : { owner: known.owner }),
      requirements: requirements
        .filter((r) => r.standard === s)
        .map((r) => ({
          "bom-ref": ref("requirement", r.standard, r.id),
          identifier: r.id,
          ...(r.title === undefined ? {} : { title: r.title }),
        })),
    };
  });

  return {
    standards,
    declarations: {
      assessors: [{ "bom-ref": assessor, thirdParty: o.assessor.thirdParty, organization: { name: o.assessor.name } }],
      attestations: [{ summary: o.summary ?? `${a.pack.title}: the findings of ${a.at}, by requirement`, assessor, map }],
      claims,
      evidence,
      targets: {
        components: [
          {
            "bom-ref": target,
            type: o.target.type ?? "platform",
            name: o.target.name,
            ...(o.target.version === undefined ? {} : { version: o.target.version }),
          },
        ],
      },
    },
  };
}

/** An assessment as a CycloneDX 1.6 BOM of its declarations: the serial number a version 5 UUID of the pack and time in the namespace. */
export async function cyclonedxBom(a: Assessment, o: AttestOptions): Promise<CdxBom> {
  const d = await declarations(a, o);
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: uuidUrn(await uuidV5Of(o.namespace, ["cyclonedx-bom", a.pack.id, a.at])),
    version: 1,
    metadata: {
      timestamp: a.at,
      ...(o.tool === undefined ? {} : { tools: { components: [{ type: "application", name: o.tool.name, version: o.tool.version }] } }),
    },
    definitions: { standards: d.standards },
    declarations: d.declarations,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- in-toto

/** The in-toto predicate type of a CycloneDX BOM. */
export const CYCLONEDX_PREDICATE_TYPE = "https://cyclonedx.org/bom";

/** A statement's subject named by its SHA-256. */
export type DigestSubject = ResourceDescriptor & { readonly digest: { readonly sha256: Sha256 } };

/** An in-toto Statement v1 whose predicate type is `T` and predicate `P`, its subjects named by their SHA-256: a `Statement<P>` for DSSE. */
export type TypedStatement<T extends string, P> = Statement<P> & { readonly predicateType: T; readonly subject: readonly DigestSubject[] };

/** A subject: the name and the SHA-256 of the bytes. */
export async function digestSubject(name: string, bytes: Uint8Array): Promise<DigestSubject> {
  return { name, digest: { sha256: await sha256(bytes) } };
}

/** An in-toto Statement v1 of a predicate of the type named about the subjects. */
export function intotoStatement<const T extends string, P>(
  subjects: readonly DigestSubject[],
  predicateType: T,
  predicate: P,
): TypedStatement<T, P> {
  return { ...statement(subjects, predicateType, predicate), subject: subjects, predicateType };
}

/** A CycloneDX BOM as the predicate of an in-toto statement about the subjects. */
export function bomStatement(bom: CdxBom, subjects: readonly DigestSubject[]): TypedStatement<typeof CYCLONEDX_PREDICATE_TYPE, CdxBom> {
  return intotoStatement(subjects, CYCLONEDX_PREDICATE_TYPE, bom);
}
