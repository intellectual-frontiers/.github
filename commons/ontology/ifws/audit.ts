/**
 * The basis of every class and code-list class of the IFWS vocabulary (commons 0018-standards-first FR-003 to FR-005): which standard each rests on, or why none is adopted.
 * Standards were looked for first: PROV-O (the plan, the generated and recorded entities, the setup activity), schema.org (software, action), DCAT (the catalog), DOAP and Git's own
 * manual (the repository and the worktree), ODRL (the policy) and SARIF (the finding and its level). A class no standard names is `unaligned`, with what was examined and the day it
 * was added, from which its decision is due within 90 days.
 *
 * @remarks
 * Every IRI below is one the author is certain of. Where a candidate could not be checked in this environment it is named in the justification with `(to verify)` and is not an IRI
 * of a record. The SARIF terms are JSON Schema pointers into the OASIS schema of SARIF 2.1.0, which defines no RDF vocabulary. The classes are held to the audit by
 * `ifws-ontology.test.ts`: a class with no record fails it, as `commons/ts/mizan/check.ts` fails one of the Mizan ontology.
 *
 * @limits
 * Properties are not audited (the audit holds classes and code-list classes, like the audit of the packaging ontology). `closeMatch` is a judgement a person reviews.
 *
 * @module
 */
import { absurd } from "../../ts/kernel/absurd.ts";
import { en, type Named, prov, term } from "../../ts/kernel/rdf.ts";
import { CLASS_NAMES, dcat, ifws, provPlan } from "./ifws.ts";
import { bases, KEPT_UNALIGNED_SENTENCE, keptUnalignedDecision, keptUnalignedDecisionId, type MAPPING_RELATIONS, MZID, OntologyTerm } from "../mizan/mizan.ts";
import { schema } from "../supply-chain/packaging/schema.auto.ts";

/** The day the audit was made, from which the decision of each `unaligned` term is due (0018-standards-first FR-005). */
export const AUDITED_ON = "2026-11-17";

type ClassName = (typeof CLASS_NAMES)[number];
type Relation = (typeof MAPPING_RELATIONS)[number];

/** What a class rests on: a standard's term and how they relate, or what was examined and why nothing fits. */
type Basis =
  | { readonly kind: "specializes"; readonly standard: Named; readonly spec: string; readonly note?: string }
  | { readonly kind: "maps"; readonly standard: string; readonly relation: Relation; readonly spec: string; readonly note?: string }
  | { readonly kind: "unaligned"; readonly examined: string; readonly spec: string };

const SARIF = "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json";

/** The basis of each class, by its local name; the type makes a class with none a compile error. */
const BASIS: Readonly<Record<ClassName, Basis>> = {
  Workspace: {
    kind: "unaligned",
    spec: "0023-if-workspaces FR-001",
    examined:
      "PROV-O (prov:Entity is too general to carry a root, a layout and a policy), DOAP (describes a project and its repositories, not a local area they are cloned into), the Development Containers specification (workspaceFolder is a setting of a configuration file, not a vocabulary) and the VS Code workspace file (a product format). None defines a managed local workspace",
  },
  Repository: {
    kind: "maps",
    standard: "http://usefulinc.com/ns/doap#GitRepository",
    relation: "closeMatch",
    spec: "0023-if-workspaces FR-006",
    note: "DOAP's GitRepository is a published repository with a location; the workspace's Repository is its clone at a path that mirrors that location, so the match is close and not exact. schema:SoftwareSourceCode and dcat:Dataset were examined and describe the content, not the clone",
  },
  Worktree: {
    kind: "maps",
    standard: "https://git-scm.com/docs/git-worktree",
    relation: "closeMatch",
    spec: "0023-if-workspaces FR-007",
    note: "Git defines the term in its manual and publishes no RDF vocabulary, so the mapping names the manual page of git-worktree",
  },
  GitManager: {
    kind: "unaligned",
    spec: "0023-if-workspaces FR-015",
    examined:
      "ForgeFed (a federation vocabulary of forges, repositories and tickets; to verify) and schema:WebAPI (to verify): neither names a client-side interface to GitHub, GitLab and plain Git with a set of capabilities, one of which may be unsupported",
  },
  GitManagerKind: {
    kind: "unaligned",
    spec: "0023-if-workspaces FR-016",
    examined: "GitHub, GitLab and Git are products and projects: no standard vocabulary lists them as a code list. SPDX 3 and DOAP name a repository's kind of version control, not the host (to verify)",
  },
  GitCapability: {
    kind: "unaligned",
    spec: "0023-if-workspaces FR-016",
    examined: "None found: OpenAPI describes the operations of one API, not a list of capabilities that hosts support or lack. ForgeFed (to verify) models forge objects, not what a client may ask",
  },
  Tool: {
    kind: "specializes",
    standard: schema.SoftwareApplication,
    spec: "0023-if-workspaces FR-037",
    note: "The tool also maps to OSCAL inventory-item (the catalog's exchange form), SPDX 3's software Package and CycloneDX's component (the inventory's), each to be exported by 0023-if-workspaces FR-040; their IRIs are to verify",
  },
  ToolCatalog: { kind: "specializes", standard: dcat.Catalog, spec: "0023-if-workspaces FR-037" },
  WorkspacePolicy: {
    kind: "maps",
    standard: "http://www.w3.org/ns/odrl/2/Policy",
    relation: "closeMatch",
    spec: "0023-if-workspaces FR-032",
    note: "ODRL's Policy is a set of permissions, prohibitions and duties; the workspace policy also carries a severity and a grace period for each rule, so it is a close match and not a subclass",
  },
  WorkspaceState: { kind: "specializes", standard: prov.Entity, spec: "0023-if-workspaces FR-022" },
  RepoObservation: { kind: "specializes", standard: prov.Entity, spec: "0023-if-workspaces FR-022" },
  RepoState: {
    kind: "unaligned",
    spec: "0023-if-workspaces FR-022",
    examined:
      "Git's `git status --porcelain=v2 --branch` reports the branch head, its upstream and the ahead and behind counts, and Git documents locks and a detached HEAD, but Git publishes no vocabulary of states; missing, wrong remote and not a repository are the workspace's",
  },
  Plan: { kind: "specializes", standard: provPlan.Plan, spec: "0023-if-workspaces FR-021" },
  Action: { kind: "specializes", standard: schema.Action, spec: "0023-if-workspaces FR-023" },
  ActionKind: {
    kind: "unaligned",
    spec: "0023-if-workspaces FR-023",
    examined: "schema.org's subtypes of Action (to verify) have no clone or fast-forward, and Git's commands are the nearest names but no vocabulary",
  },
  Finding: {
    kind: "maps",
    standard: `${SARIF}#/definitions/result`,
    relation: "closeMatch",
    spec: "0023-if-workspaces FR-035",
    note: "SARIF 2.1.0 defines a result (ruleId, level, message, locations) and has no RDF vocabulary, so the mapping is a JSON Schema pointer; the finding adds the day it was first seen",
  },
  Severity: {
    kind: "maps",
    standard: `${SARIF}#/definitions/result/properties/level`,
    relation: "closeMatch",
    spec: "0023-if-workspaces FR-035",
    note: "informational is SARIF's note, warning is warning and error is error (the property ifws:sarifLevel)",
  },
  GeneratedFile: { kind: "specializes", standard: prov.Entity, spec: "0024-ifws-host FR-004" },
  StateRecord: { kind: "specializes", standard: prov.Entity, spec: "0024-ifws-host FR-009" },
  Module: {
    kind: "specializes",
    standard: schema.SoftwareApplication,
    spec: "0025-ifws FR-003",
    note: "The convention of the executable `ifws-<name>` on the path is Git's `git-foo`",
  },
  ModuleSource: {
    kind: "unaligned",
    spec: "0025-ifws FR-004",
    examined: "Git's external-command convention (`git-foo` on the PATH) names the third source and no standard lists the other two or their order",
  },
  ExitStatus: {
    kind: "unaligned",
    spec: "0025-ifws FR-010",
    examined:
      "POSIX gives 0 for success and non-zero for failure, and the BSD header sysexits.h gives named codes (EX_OK 0, EX_USAGE 64, EX_UNAVAILABLE 69, EX_SOFTWARE 70, EX_CONFIG 78 and others); none gives ok, findings, usage and environment as 0 to 3. IFWS's 0, 1, 2 and 3 follow the shell convention (1 is a general failure, here findings; 2 is a misuse of the command, as in the Bash builtins and GNU tools), not sysexits.h, whose usage code is 64; the four values are few, kept apart on purpose, and a caller reads them without a table",
  },
  Setup: { kind: "specializes", standard: prov.Activity, spec: "0025-ifws FR-017" },
};

/** One audit record for a class. */
function record(local: ClassName) {
  const b = BASIS[local];
  const base = {
    label: en(`ifws:${local}`),
    termIri: ifws[local].iri,
    definedBy: [b.spec],
  };
  const id = term<"mz:OntologyTerm">(MZID, `term-ifws-${local}`);
  switch (b.kind) {
    case "specializes":
      return OntologyTerm.make(id, {
        ...base,
        basis: bases.Specializes,
        standardTerm: b.standard.iri,
        mappingRelation: "subClassOf",
        ...(b.note === undefined ? {} : { justification: b.note }),
      });
    case "maps":
      return OntologyTerm.make(id, {
        ...base,
        basis: bases.Maps,
        standardTerm: b.standard,
        mappingRelation: b.relation,
        ...(b.note === undefined ? {} : { justification: b.note }),
      });
    case "unaligned":
      return OntologyTerm.make(id, {
        ...base,
        basis: bases.Unaligned,
        justification: `No standard adopted yet. Examined: ${b.examined}. ${KEPT_UNALIGNED_SENTENCE}`,
        decision: keptUnalignedDecisionId("ifws", local),
        addedOn: AUDITED_ON,
      });
    default:
      return absurd(b);
  }
}

/** One record for every class and code-list class of the IFWS vocabulary, in the order of `CLASS_NAMES`. */
export const terms = CLASS_NAMES.map(record);

/** The classes the owner decided on 2026-11-17 (issue #10) to keep unaligned: every class of the audit whose basis is `unaligned`. */
const KEPT_UNALIGNED = ["Workspace", "GitManager", "GitManagerKind", "GitCapability", "RepoState", "ActionKind", "ModuleSource", "ExitStatus"] as const satisfies readonly ClassName[];

/** The `mz:Decision` of each class kept unaligned, to state beside the audit records. */
export const decisions = KEPT_UNALIGNED.map((local) => keptUnalignedDecision("ifws", local));
