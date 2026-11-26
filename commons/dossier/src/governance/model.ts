// Spec: 0002-dossier-core FR-001, FR-002, FR-004, FR-007, FR-008
/**
 * The model of a dossier (0046-dossiers): the source, the selection, the blocks and inlines of the AsciiDoc model, the plate, the lens, the declaration of a dossier, the manifest and the seal.
 * Every one is a value; nothing here reads a file, a clock or a network.
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { DisclosureClass } from "./disclosure.ts";

/** What JSON holds. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

/** A piece of evidence that already exists (0046-dossiers FR-001). */
export interface Source {
  /** The id: lower case words joined by hyphens, dots and slashes, stable for the thing observed. */
  readonly id: string;
  /** The kind: what sort of evidence it is (a `quality-run`, a `finding-set`, a `reading`). */
  readonly kind: string;
  /** The instant it was observed, as an ISO 8601 UTC instant (`2026-11-26T12:00:00Z`). */
  readonly observedAt: string;
  /** The SHA-256 of the canonical form of `body`, as 64 lower-case hexadecimal digits. */
  readonly hash: string;
  /** The key that signed it (a fingerprint), where it is signed. */
  readonly signer?: string;
  /** The boundaries it is about (ids). */
  readonly about: readonly string[];
  /** Tags. */
  readonly tags: readonly string[];
  /** The class of everything in `body`. */
  readonly class: DisclosureClass;
  /** The content. */
  readonly body: Json;
}

/** A filter over sources (0046-dossiers FR-010); every field narrows, and a missing field does not. */
export interface Selection {
  readonly kinds?: readonly string[];
  readonly about?: readonly string[];
  readonly tags?: readonly string[];
  readonly ids?: readonly string[];
}

/** A run of text in a plate. */
export type Inline =
  | { readonly t: "text"; readonly text: string }
  | { readonly t: "code"; readonly text: string }
  | { readonly t: "em"; readonly children: readonly Inline[] }
  | { readonly t: "strong"; readonly children: readonly Inline[] }
  | { readonly t: "cite"; readonly source: string; readonly children?: readonly Inline[] }
  | { readonly t: "xref"; readonly anchor: string; readonly children: readonly Inline[] };

/** A block of the print-shaped model of AsciiDoc (0046-dossiers FR-050). */
export type Block =
  | { readonly t: "section"; readonly level: 1 | 2 | 3 | 4; readonly id: string; readonly title: string; readonly blocks: readonly Block[] }
  | { readonly t: "para"; readonly inlines: readonly Inline[] }
  | { readonly t: "list"; readonly ordered: boolean; readonly items: readonly (readonly Inline[])[] }
  | { readonly t: "defs"; readonly items: readonly { readonly term: string; readonly inlines: readonly Inline[] }[] }
  | { readonly t: "table"; readonly head: readonly string[]; readonly rows: readonly (readonly (readonly Inline[])[])[] }
  | { readonly t: "note"; readonly tone: "note" | "important" | "warning"; readonly inlines: readonly Inline[] }
  | { readonly t: "code"; readonly lang: string; readonly text: string };

/** One rendered unit of a dossier (0046-dossiers FR-030). */
export interface Plate {
  readonly lens: string;
  readonly slug: string;
  readonly title: string;
  readonly blocks: readonly Block[];
  readonly cites: readonly string[];
  readonly ceiling: DisclosureClass;
}

/** What a lens is given. */
export interface LensInput<P> {
  readonly sources: readonly Source[];
  readonly params: P;
  readonly asOf: string;
  /** How many sources of each kind a class above the lens's ceiling held back. */
  readonly withheld: number;
}

/** Why a lens gave no plate. */
export interface Refusal {
  readonly code: string;
  readonly message: string;
}

/** A lens (0046-dossiers FR-020). */
export interface Lens<P = unknown> {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  /** The kinds of source it reads. */
  readonly inputs: readonly string[];
  /** The highest class its plate can carry. */
  readonly ceiling: DisclosureClass;
  /** The parameters, decoded. */
  readonly decode: (raw: unknown) => Result<P, string>;
  /** The plate: a pure function of its input. */
  readonly plate: (input: LensInput<P>) => Result<Plate, Refusal>;
}

/** A lens whose parameters are not known: what a registry holds. */
export type AnyLens = Lens<never>;

/** The lens a dossier names, with its parameters. */
export interface LensUse {
  readonly lens: string;
  readonly params?: Json;
}

/** The declaration of a dossier (0046-dossiers FR-100). */
export interface Declaration {
  readonly id: string;
  readonly title: string;
  /** The class of the reader. */
  readonly audience: DisclosureClass;
  /** `latest`, or the instant the dossier is as of. */
  readonly asOf: "latest" | string;
  readonly selection: Selection;
  readonly lenses: readonly LensUse[];
  readonly renditions: readonly ("adoc" | "html")[];
  /** What triggers a build: the product's own words, kept so that a dossier says what keeps it current. */
  readonly triggers: readonly string[];
}

/** One source as the manifest holds it: no body. */
export interface ManifestSource {
  readonly id: string;
  readonly kind: string;
  readonly observedAt: string;
  readonly hash: string;
  readonly signer?: string;
  readonly class: DisclosureClass;
}

/** The evidence bill of materials (0046-dossiers FR-060). */
export interface Manifest {
  readonly dossier: string;
  readonly asOf: string;
  readonly audience: DisclosureClass;
  readonly lenses: readonly { readonly id: string; readonly version: string; readonly params: Json }[];
  readonly selection: Selection;
  readonly sources: readonly ManifestSource[];
  readonly withheld: readonly { readonly lens: string; readonly class: DisclosureClass }[];
  /** The hash of the inputs as a whole (0046-dossiers FR-101). */
  readonly inputs: string;
  /** The SHA-256 of each rendition by name. */
  readonly renditions: { readonly [name: string]: string };
}

/** A seal (0046-dossiers FR-063): a person's signature of the digest of a manifest, in the envelope of DSSE. */
export interface Seal {
  /** The digest of the manifest it covers. */
  readonly manifest: string;
  /** The person, and the role the boundary or the engagement gives them. */
  readonly authority: string;
  readonly role: string;
  readonly signedAt: string;
  /** The signed envelope, as JSON. */
  readonly envelope: Json;
}

/** A dossier as built. */
export interface Built {
  readonly declaration: Declaration;
  readonly asOf: string;
  readonly plates: readonly Plate[];
  readonly sources: readonly Source[];
  readonly adoc: string;
  readonly manifest: Manifest;
}

/** A rendition tool as the library sees it (0002-dossier-core FR-013): a pure function of the AsciiDoc, the title and the instant the dossier is as of. */
export type Renderer = (adoc: string, meta: { readonly title: string; readonly asOf: string }) => Promise<Uint8Array>;

/** The name of each rendition other than the AsciiDoc, and the file it is written to. */
export const RENDITION_FILES = { html: "dossier.html" } as const;

/** Why a build failed; the code is stable. */
export interface BuildError {
  readonly code:
    | "E-DOSSIER-SOURCE-CONFLICT"
    | "E-DOSSIER-SOURCE-HASH"
    | "E-DOSSIER-LENS-UNKNOWN"
    | "E-DOSSIER-LENS-PARAMS"
    | "E-DOSSIER-LENS-INPUT"
    | "E-DOSSIER-LENS-REFUSED"
    | "E-DOSSIER-LENS-CITE"
    | "E-DOSSIER-LENS-CEILING"
    | "E-DOSSIER-ANCHOR"
    | "E-DOSSIER-AS-OF"
    | "E-DOSSIER-NO-RENDERER";
  readonly message: string;
}
