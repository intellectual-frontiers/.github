/**
 * The types of IFC Mizan Integrations (commons 0019-mizan-integrations FR-002, FR-006, FR-007): an integration as a typed record, the formats it reads and writes, a pinned
 * standard, and the findings an import can end with, one sentence each. No `any`, no non-null `!`, and every `switch` over a union is exhaustive.
 *
 * @module
 */
import { absurd } from "../../../kernel/absurd.ts";
import type { Result } from "../../../kernel/result.ts";

/** The formats an integration reads or writes: those built are the first two and the last; the rest are specified (0019-mizan-integrations FR-010). */
export type Format =
  "turtle" | "n-triples" | "json-ld" | "json-schema" | "shacl" | "skos" | "sql-code-lists" | "sssom" | "owl" | "rdf-xml" | "ts-vocabulary";

/** Whether an integration brings a standard in or puts our ontology out. */
export type Direction = "import" | "export";

/** A standard as an import is pinned to it (0018-standards-first FR-006): who publishes it, its version, where, its license, whether its text may be copied, and the SHA-256 of the source. */
export type StandardRecord = {
  readonly id: string;
  readonly issuer: string;
  readonly name: string;
  readonly version: string;
  readonly location: string;
  /** An SPDX license identifier, or a `LicenseRef-` for what is not in the SPDX list. */
  readonly license: string;
  readonly redistributable: boolean;
  /** The SHA-256 of the source, in lower-case hexadecimal. */
  readonly sha256: string;
};

/** What an import or an export can end with instead of its output: one sentence each (`describeFinding`). */
export type IntegrationFinding =
  | { readonly kind: "no-license"; readonly standard: string }
  | { readonly kind: "not-redistributable"; readonly standard: string }
  | { readonly kind: "pin-mismatch"; readonly standard: string; readonly expected: string; readonly actual: string }
  | { readonly kind: "syntax"; readonly line: number; readonly message: string }
  | {
      readonly kind: "loss";
      readonly what: "blank-node" | "collection" | "blank-node-object";
      readonly line: number;
      readonly about: string;
    }
  | { readonly kind: "slice-empty" }
  | { readonly kind: "term-missing"; readonly iri: string }
  | { readonly kind: "term-untyped"; readonly iri: string }
  | { readonly kind: "bad-name"; readonly name: string }
  | { readonly kind: "no-curie"; readonly iri: string }
  | { readonly kind: "unsupported"; readonly what: string; readonly about: string };

/** A finding as one plain sentence. */
export function describeFinding(f: IntegrationFinding): string {
  switch (f.kind) {
    case "no-license":
      return `${f.standard} has no license recorded, so nothing of it is imported`;
    case "not-redistributable":
      return `${f.standard} cannot be redistributed, so it is cited and never imported`;
    case "pin-mismatch":
      return `${f.standard}: the source's SHA-256 is ${f.actual}, not the pinned ${f.expected}`;
    case "syntax":
      return `line ${f.line}: ${f.message}`;
    case "loss":
      return `line ${f.line}: ${f.about === "" ? "a value" : f.about} is a ${f.what} that the typed form cannot hold, so it is not imported`;
    case "slice-empty":
      return "the slice names no term";
    case "term-missing":
      return `${f.iri} is in the slice and not in the source`;
    case "term-untyped":
      return `${f.iri} has no class or property type that a typed vocabulary can state`;
    case "bad-name":
      return `${f.name} is not a name an SQL table may have (lower-case letters, digits and underscores, starting with a letter)`;
    case "no-curie":
      return `${f.iri} has no prefix in the curie map, so a mapping cannot be written with it`;
    case "unsupported":
      return `${f.about === "" ? "the source" : f.about} has ${f.what}, which the typed form cannot hold, so it is not imported`;
    default:
      return absurd(f);
  }
}

/** An integration as a typed record: what it is, what it reads and writes, the standard it handles, and what it does. */
export type Integration<In, Out> = {
  readonly id: string;
  readonly direction: Direction;
  readonly from: Format;
  readonly to: Format;
  readonly standard: string;
  readonly run: (input: In) => Promise<Result<Out, readonly IntegrationFinding[]>>;
};

/** An integration whatever its input and output, as a registry holds it. */
export type AnyIntegration = Integration<never, unknown>;
