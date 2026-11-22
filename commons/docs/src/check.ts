// Spec: 0001-docs FR-001
/**
 * What `check` finds (commons 0011-documentation FR-018), as a tagged union with one sentence for each case, and the place each is found:
 * a file of the repository, a page of the site or an export. The generator gathers findings while it builds; `check` prints them and
 * fails where there is one.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";

/** What is wrong. */
export type Problem =
  | { readonly kind: "undocumented"; readonly name: string }
  | { readonly kind: "no-about" }
  | { readonly kind: "folder-missing"; readonly folder: string }
  | { readonly kind: "command-missing"; readonly command: string }
  | { readonly kind: "enforcer-missing"; readonly enforcer: string }
  | { readonly kind: "entry-point-missing"; readonly file: string }
  | { readonly kind: "example-missing"; readonly file: string }
  | { readonly kind: "unknown-spec"; readonly cite: string }
  | { readonly kind: "unknown-requirement"; readonly cite: string }
  | { readonly kind: "unknown-link"; readonly name: string }
  | { readonly kind: "undescribed"; readonly entity: string }
  | { readonly kind: "import-failed"; readonly error: string }
  | { readonly kind: "broken-link"; readonly href: string }
  | { readonly kind: "duplicate-spec"; readonly id: string }
  | { readonly kind: "diagram-undrawable"; readonly first: string }
  | { readonly kind: "book-part-empty"; readonly volume: string; readonly part: string }
  | { readonly kind: "evidence-unreadable"; readonly why: string }
  | { readonly kind: "registry-unreadable"; readonly why: string }
  | { readonly kind: "test-requirement-unknown"; readonly requirement: string; readonly test: string }
  | { readonly kind: "retired-name"; readonly name: string }
  | { readonly kind: "forbidden-word"; readonly word: string };

/** A problem and where it is. */
export interface Finding {
  /** The file, page or export it is found in. */
  readonly where: string;
  /** What is wrong there. */
  readonly problem: Problem;
}

/** The sentence a finding is printed with. */
export function message(p: Problem): string {
  switch (p.kind) {
    case "undocumented":
      return `${p.name} is exported with no TSDoc`;
    case "no-about":
      return "the package has no about.ts that exports about";
    case "folder-missing":
      return `about names the folder ${p.folder}, which does not exist`;
    case "command-missing":
      return `about names the command '${p.command}', which is not a script of package.json`;
    case "enforcer-missing":
      return `about says a rule is enforced by ${p.enforcer}, which does not exist`;
    case "entry-point-missing":
      return `about names the entry point ${p.file}, which does not exist`;
    case "example-missing":
      return `about names the example ${p.file}, which does not exist`;
    case "unknown-spec":
      return `cites ${p.cite}, which is not a specification of the spec kit`;
    case "unknown-requirement":
      return `cites ${p.cite}, which its specification does not have`;
    case "unknown-link":
      return `{@link ${p.name}} names nothing exported`;
    case "undescribed":
      return `${p.entity} has no description`;
    case "import-failed":
      return `the module could not be imported: ${p.error}`;
    case "broken-link":
      return `links to ${p.href}, which is not a page or an anchor of the site`;
    case "duplicate-spec":
      return `holds ${p.id}, which a spec kit before it holds too`;
    case "diagram-undrawable":
      return `has a diagram that cannot be drawn (it is not a flowchart, state, sequence, class or entity-relationship diagram, or it is not valid): ${p.first}`;
    case "evidence-unreadable":
      return `cannot be read as evidence: it ${p.why}`;
    case "registry-unreadable":
      return `says the package registry could not be read (${p.why}), so the site shows the version of package.json as unconfirmed`;
    case "test-requirement-unknown":
      return `holds a test, "${p.test}", that proves ${p.requirement}, which is not a requirement of the spec kits`;
    case "book-part-empty":
      return `has a part, ${p.part}, of the volume ${p.volume} that selects no page`;
    case "retired-name":
      return `names ${p.name}, which is retired`;
    case "forbidden-word":
      return `has the word "${p.word}", which a page people write does not use`;
    default:
      return absurd(p);
  }
}

/** The findings as the lines `check` prints, sorted and each once. */
export function report(found: readonly Finding[]): string[] {
  return [...new Set(found.map((f) => `${f.where}: ${message(f.problem)}`))].sort();
}
