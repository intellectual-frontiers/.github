// Spec: 0010-estate-boundaries FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The types of a boundary: who answers for an asset and under which rule. The kinds, the roles of a kind, the impacts, the data classes, the actions the interlock guards and the findings are
 * closed tables, each a `readonly` tuple with its union type; a boundary is indexed by its kind, so that a role of another kind does not type-check; every identifier is a branded text made only
 * by its parser; and every value is immutable.
 *
 * @example
 * ```ts
 * import { parseBoundaryId, ROLES_OF } from "./boundaries.ts";
 * parseBoundaryId("synthetic-boundary-01").kind; // "ok"
 * ROLES_OF["cui-environment"]; // ["cui-asset", "security-protection-asset", ...]
 * ```
 *
 * @module
 */
import { err, ok, type Brand, type Result } from "@intellectual-frontiers/core";
import type { AssetId } from "./ids.ts";

/** The kinds of boundary, one closed table that only grows. */
export const BOUNDARY_KINDS = [
  "authorization",
  "cui-environment",
  "ephi-environment",
  "cardholder-data-environment",
  "soc2-system",
  "privacy",
  "organizational",
  "network-zone",
  "trust",
  "engagement-scope",
] as const;
/** A kind of boundary. */
export type BoundaryKind = (typeof BOUNDARY_KINDS)[number];

/** The roles an asset can have inside a boundary of each kind (0045-boundaries FR-024). */
export const ROLES_OF = {
  authorization: ["component", "subsystem-member", "security-function"],
  "cui-environment": ["cui-asset", "security-protection-asset", "contractor-risk-managed-asset", "specialized-asset"],
  "ephi-environment": ["ephi-system", "business-associate-system", "supporting-system"],
  "cardholder-data-environment": ["cde-system", "connected-to-system", "security-impacting-system"],
  "soc2-system": ["infrastructure", "software", "people", "procedures", "data", "subservice-system"],
  privacy: ["processing-system", "processor-system", "recipient-system"],
  organizational: ["owned", "managed-for-client", "leased"],
  "network-zone": ["member", "managed-interface"],
  trust: ["process", "store", "external-entity", "data-flow-end"],
  "engagement-scope": ["target", "excluded-target", "support-system"],
} as const satisfies Record<BoundaryKind, readonly string[]>;
/** The roles of an asset in a boundary of the kind `K`. */
export type AssetRoleOf<K extends BoundaryKind> = (typeof ROLES_OF)[K][number];

/** The roles of the people of a boundary of each kind (0045-boundaries FR-005). The first is the owner, who approves its changes. */
export const PERSON_ROLES_OF = {
  authorization: ["authorizing-official", "system-owner", "information-system-security-officer", "common-control-provider"],
  "cui-environment": ["senior-official", "ssp-owner"],
  "ephi-environment": ["responsible-officer", "business-associate-contact"],
  "cardholder-data-environment": ["responsible-officer", "qualified-assessor"],
  "soc2-system": ["management", "service-auditor"],
  privacy: ["controller-contact", "data-protection-officer"],
  organizational: ["owner", "delegate"],
  "network-zone": ["zone-owner"],
  trust: ["model-owner"],
  "engagement-scope": ["client-approver", "test-lead"],
} as const satisfies Record<BoundaryKind, readonly string[]>;
/** A role of a person in a boundary of the kind `K`. */
export type PersonRoleOf<K extends BoundaryKind> = (typeof PERSON_ROLES_OF)[K][number];

/** The agreements that cross a boundary of each kind (0045-boundaries FR-043). */
export const AGREEMENT_KINDS = [
  "interconnection-security-agreement",
  "information-exchange-agreement",
  "memorandum-of-understanding",
  "service-level-agreement",
  "esp-agreement",
  "business-associate-agreement",
  "data-processing-agreement",
  "contract",
] as const;
/** An agreement kind. */
export type AgreementKind = (typeof AGREEMENT_KINDS)[number];

/** The regimes of the kind `privacy`; a regime whose text has not been read is `unread` in the table of its source and cannot be approved. */
export const PRIVACY_REGIMES = ["gdpr", "uk-gdpr", "ccpa-cpra", "lgpd", "pipeda", "pdpa-sg", "dpdp"] as const;
/** A privacy regime. */
export type PrivacyRegime = (typeof PRIVACY_REGIMES)[number];

/** The data classes, one closed table that only grows (0045-boundaries FR-007). */
export const DATA_CLASSES = ["fci", "cui", "phi", "ephi", "personal-data", "special-category-data", "cardholder-data", "sensitive-authentication-data", "security-protection-data", "confidential", "internal", "public"] as const;
/** A data class. */
export type DataClass = (typeof DATA_CLASSES)[number];

/** The impacts of FIPS 199, ordered. */
export const IMPACTS = ["low", "moderate", "high"] as const;
/** An impact. */
export type Impact = (typeof IMPACTS)[number];

/** The kinds of inheritance of what another party provides (0045-boundaries FR-050). */
export const INHERITANCE_KINDS = ["leveraged-authorization", "common-control", "shared-responsibility", "subservice-organization", "external-service-provider"] as const;
/** An inheritance kind. */
export type InheritanceKind = (typeof INHERITANCE_KINDS)[number];

/** The active actions the interlock guards (0045-boundaries FR-090). Reading is not in it. */
export const ASSET_ACTIONS = ["scan", "pentest", "apply", "install", "enroll-active"] as const;
/** An active action. */
export type AssetAction = (typeof ASSET_ACTIONS)[number];

/** The directions of an interconnection. */
export const DIRECTIONS = ["one-way-out", "one-way-in", "two-way"] as const;
/** A direction. */
export type Direction = (typeof DIRECTIONS)[number];

/** The findings a boundary raises, one closed table that only grows (0045-boundaries FR-014 of the estate specification). */
export const FINDING_KINDS = [
  "no-disposition",
  "out-of-scope-contradicted",
  "part-outside-whole",
  "constraint-broken",
  "unapproved-crossing",
  "interconnection-unused",
  "interconnection-review-overdue",
  "roles-not-separate",
  "override-orphaned",
] as const;
/** A finding kind. */
export type FindingKind = (typeof FINDING_KINDS)[number];

/** The refusals of the interlock (0045-boundaries FR-092). */
export const REFUSALS = ["E-BOUNDARY-NOT-APPROVED", "E-BOUNDARY-NOT-IN-SCOPE", "E-BOUNDARY-EXCLUDED", "E-BOUNDARY-EXPIRED"] as const;
/** A refusal code. */
export type RefusalCode = (typeof REFUSALS)[number];

const word = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function made<B extends string>(name: string): (text: string) => Result<Brand<string, B>, string> {
  return (text) => (text.length <= 100 && word.test(text) ? ok(text as Brand<string, B>) : err(`${JSON.stringify(text)} is not ${name}: lower case words and digits joined by hyphens, starting with a letter, at most 100 characters`));
}

/** The identity of a boundary. */
export type BoundaryId = Brand<string, "estate boundary id">;
/** The identity of an external system. */
export type ExternalSystemId = Brand<string, "estate external system id">;
/** The identity of an interconnection. */
export type InterconnectionId = Brand<string, "estate interconnection id">;
/** The identity of an inheritance. */
export type InheritanceId = Brand<string, "estate inheritance id">;
/** The identity of a person (a principal of the fleet's private names). */
export type PrincipalId = Brand<string, "estate principal id">;

/** A boundary id from text. */
export const parseBoundaryId: (text: string) => Result<BoundaryId, string> = made<"estate boundary id">("a boundary id");
/** An external system id from text. */
export const parseExternalSystemId: (text: string) => Result<ExternalSystemId, string> = made<"estate external system id">("an external system id");
/** An interconnection id from text. */
export const parseInterconnectionId: (text: string) => Result<InterconnectionId, string> = made<"estate interconnection id">("an interconnection id");
/** An inheritance id from text. */
export const parseInheritanceId: (text: string) => Result<InheritanceId, string> = made<"estate inheritance id">("an inheritance id");
/** A principal id from text. */
export const parsePrincipalId: (text: string) => Result<PrincipalId, string> = made<"estate principal id">("a principal id");

/** What the selectors look at: one asset of the estate with the facts a selector can ask for. The values are what the estate holds, decoded; a selector never reads anything else. */
export type AssetFacts = {
  readonly id: AssetId;
  readonly kind: string;
  readonly tags: readonly string[];
  readonly realm?: string;
  readonly segment?: string;
  readonly owner?: string;
  readonly dataClasses: readonly DataClass[];
  readonly location?: string;
  readonly sources: readonly string[];
};

/** A selector: a typed expression of a closed grammar, never a free text query (0045-boundaries FR-020). `roleOf` asks for the role an asset has in another boundary. */
export type Selector =
  | { readonly t: "class"; readonly value: string }
  | { readonly t: "tag"; readonly value: string }
  | { readonly t: "id"; readonly value: string }
  | { readonly t: "realm"; readonly value: string }
  | { readonly t: "segment"; readonly value: string }
  | { readonly t: "owner"; readonly value: string }
  | { readonly t: "dataClass"; readonly value: DataClass }
  | { readonly t: "location"; readonly value: string }
  | { readonly t: "roleOf"; readonly boundary: BoundaryId; readonly role: string }
  | { readonly t: "source"; readonly value: string }
  | { readonly t: "and"; readonly of: readonly Selector[] }
  | { readonly t: "or"; readonly of: readonly Selector[] }
  | { readonly t: "not"; readonly of: Selector };

/** The selectors, made by their names. */
export const sel = {
  class: (value: string): Selector => ({ t: "class", value }),
  tag: (value: string): Selector => ({ t: "tag", value }),
  id: (value: string): Selector => ({ t: "id", value }),
  realm: (value: string): Selector => ({ t: "realm", value }),
  segment: (value: string): Selector => ({ t: "segment", value }),
  owner: (value: string): Selector => ({ t: "owner", value }),
  dataClass: (value: DataClass): Selector => ({ t: "dataClass", value }),
  location: (value: string): Selector => ({ t: "location", value }),
  roleOf: (boundary: BoundaryId, role: string): Selector => ({ t: "roleOf", boundary, role }),
  source: (value: string): Selector => ({ t: "source", value }),
  and: (...of: readonly Selector[]): Selector => ({ t: "and", of }),
  or: (...of: readonly Selector[]): Selector => ({ t: "or", of }),
  not: (of: Selector): Selector => ({ t: "not", of }),
} as const;

/** The justification of an out-of-scope decision: the rule it rests on, the evidence, the person, the instant and the expiry (0045-boundaries FR-025). */
export type Justification = {
  readonly rule: string;
  readonly evidence: readonly string[];
  readonly by: PrincipalId;
  readonly at: string;
  readonly expires: string;
};

/** The disposition of an asset in a boundary: a total, single-valued sum (0045-boundaries FR-023). */
export type Disposition<K extends BoundaryKind> =
  | { readonly t: "in-scope"; readonly role: AssetRoleOf<K> }
  | { readonly t: "inherited"; readonly inheritance: InheritanceId }
  | { readonly t: "external"; readonly system: ExternalSystemId }
  | { readonly t: "out-of-scope"; readonly justification: Justification }
  | { readonly t: "undecided" };

/** An out-of-scope disposition, made only here: it needs its justification complete (a rule, evidence, a person, an instant and an expiry). */
export function outOfScope<K extends BoundaryKind>(justification: Justification): Result<Disposition<K>, string> {
  const problems: string[] = [];
  if (justification.rule.trim() === "") problems.push("the rule it rests on is empty");
  if (justification.evidence.length === 0) problems.push("it names no evidence");
  if (Number.isNaN(Date.parse(justification.at))) problems.push("its instant is not a date");
  if (Number.isNaN(Date.parse(justification.expires))) problems.push("its expiry is not a date");
  else if (Date.parse(justification.expires) <= Date.parse(justification.at)) problems.push("it expires before it is made");
  return problems.length === 0 ? ok({ t: "out-of-scope", justification }) : err(`an out-of-scope decision is refused: ${problems.join("; ")}`);
}

/** The decision of one asset: the disposition a person made, with who and when. */
export type Decision<K extends BoundaryKind> = {
  readonly asset: AssetId;
  readonly disposition: Disposition<K>;
  readonly by: PrincipalId;
  readonly at: string;
};

/** An override: one named asset put in or out of a boundary by a person (0045-boundaries FR-022). It beats a selector. */
export type Override = {
  readonly asset: AssetId;
  readonly effect: "add" | "remove";
  readonly by: PrincipalId;
  readonly at: string;
  readonly reason: string;
};

/** A constraint between two boundaries or a boundary and an attribute (0045-boundaries FR-029). */
export type Constraint =
  | { readonly t: "within"; readonly a: BoundaryId; readonly b: BoundaryId }
  | { readonly t: "disjoint"; readonly a: BoundaryId; readonly b: BoundaryId }
  | { readonly t: "equals"; readonly a: BoundaryId; readonly b: BoundaryId }
  | { readonly t: "residency"; readonly a: BoundaryId; readonly jurisdictions: readonly string[] };

/** An end of an interconnection: a boundary of the fleet or an external system. */
export type Party = { readonly t: "boundary"; readonly id: BoundaryId } | { readonly t: "external"; readonly id: ExternalSystemId };

/** A system that is not in the fleet but that a boundary relies on or exchanges information with (0045-boundaries FR-031). */
export type ExternalSystem = {
  readonly id: ExternalSystemId;
  readonly name: string;
  readonly party: string;
  readonly kind: InheritanceKind | "service";
  /** What the party holds (an authorization, a report and its period, a certification, an agreement) with its dates. */
  readonly authorization?: { readonly reference: string; readonly from: string; readonly until: string };
};

/** An interconnection that crosses a boundary (0045-boundaries FR-040). */
export type Interconnection = {
  readonly id: InterconnectionId;
  readonly from: Party;
  readonly to: Party;
  readonly direction: Direction;
  readonly dataClasses: readonly DataClass[];
  readonly protocols: readonly string[];
  readonly agreement: AgreementKind;
  readonly interface?: AssetId;
  readonly approvedBy?: PrincipalId;
  readonly approvedAt?: string;
  readonly reviewedAt?: string;
  readonly reviewEveryDays: number;
  readonly expires?: string;
};

/** What a boundary relies on another party to provide (0045-boundaries FR-050). */
export type Inheritance = {
  readonly id: InheritanceId;
  readonly kind: InheritanceKind;
  readonly from: Party;
  readonly controls: readonly string[];
  readonly evidence: readonly string[];
  readonly evidenceUntil: string;
};

/** The categorization: an impact for each security objective (FIPS 199). */
export type Categorization = {
  readonly confidentiality: Impact;
  readonly integrity: Impact;
  readonly availability: Impact;
};

/** The approval of a plan of a boundary: the hash it covers, a person and the instant. */
export type BoundaryApproval = { readonly planHash: string; readonly by: PrincipalId; readonly at: string };

/** The window an engagement-scope boundary is valid for. */
export type Window = { readonly from: string; readonly until: string };

/** A boundary of the kind `K`: the declaration of who answers for which assets and under which rule (0045-boundaries FR-001). */
export type Boundary<K extends BoundaryKind> = {
  readonly id: BoundaryId;
  readonly kind: K;
  readonly name: string;
  /** The holder of the first person role of the kind: who approves its changes. */
  readonly owner: PrincipalId;
  /** Every person role of the kind and its holders. */
  readonly roles: Readonly<Partial<Record<PersonRoleOf<K>, readonly PrincipalId[]>>>;
  /** The regime of a privacy boundary. */
  readonly regime?: PrivacyRegime;
  readonly categorization: Categorization;
  readonly include: Selector;
  readonly exclude: Selector;
  readonly overrides: readonly Override[];
  readonly decisions: readonly Decision<K>[];
  readonly parents: readonly BoundaryId[];
  readonly constraints: readonly Constraint[];
  readonly interconnections: readonly Interconnection[];
  readonly inheritances: readonly Inheritance[];
  readonly window?: Window;
  /** The actions an engagement-scope boundary allows on its targets. */
  readonly actions?: readonly AssetAction[];
  readonly approval?: BoundaryApproval;
  /** Findings a person accepted, each with a reason and an expiry (for example `roles-not-separate`). */
  readonly accepted: readonly { readonly finding: FindingKind; readonly reason: string; readonly by: PrincipalId; readonly expires: string }[];
  readonly version: number;
};

/** A boundary of any kind, with the kind kept (a discriminated union over the kinds, so that a function that does not care takes this and a function that does takes `Boundary<K>`). */
export type AnyBoundary = { readonly [K in BoundaryKind]: Boundary<K> }[BoundaryKind];

/** The categorization with the bottom, `low` for every objective. */
export const BOTTOM: Categorization = { confidentiality: "low", integrity: "low", availability: "low" };

/** One finding: its kind, the boundary, what it is about and the evidence. */
export type Finding = {
  readonly kind: FindingKind;
  readonly boundary: BoundaryId;
  readonly subject: string;
  readonly detail: string;
  readonly evidence: readonly string[];
};

/** A permit for an active action on a target: made only by `permits`, so that a call that has none does not type-check. */
export type Permit<A extends AssetAction> = Brand<
  {
    readonly action: A;
    readonly target: AssetId;
    readonly boundaries: readonly { readonly id: BoundaryId; readonly version: number }[];
    readonly at: string;
    readonly expires: string;
  },
  "estate permit"
>;

/** A refusal of the interlock. */
export type Refusal = {
  readonly code: RefusalCode;
  readonly action: AssetAction;
  readonly target: AssetId;
  readonly consulted: readonly BoundaryId[];
  readonly reason: string;
};
