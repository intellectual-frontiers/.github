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
  | { readonly kind: "duplicate-spec"; readonly id: string };

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
    default:
      return absurd(p);
  }
}

/** The findings as the lines `check` prints, sorted and each once. */
export function report(found: readonly Finding[]): string[] {
  return [...new Set(found.map((f) => `${f.where}: ${message(f.problem)}`))].sort();
}
