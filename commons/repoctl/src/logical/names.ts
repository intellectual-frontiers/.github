// Spec: 0015-repoctl-names FR-002, FR-003, FR-004, FR-005
/**
 * The names engine of `repoctl names` (commons repoctl 0015-repoctl-names): the files of a tree and a list of names it holds none of, as pure functions of text. It holds no name itself: the names are given by the
 * data of whoever asks (the tenants, the MSPs and the retired names of an organization are in its own private repository), so that a platform repository can be checked for what it must not say without saying it.
 *
 * @example
 * ```ts
 * import { findNames } from "./names.ts";
 * findNames([{ path: "specs/a/spec.md", text: "see Example Corp here" }], ["Example Corp"], [], ["specs/**"]).length; // 1
 * ```
 *
 * @module
 */
import { matches } from "./glob.ts";

/** A file of a tree: its path from the root of the tree and its text. */
export type NamedFile = { readonly path: string; readonly text: string };

/** Where a name is allowed: a name and a glob of paths, either or both; a finding is allowed where every field the allowance has agrees with it. */
export type Allowance = { readonly name?: string; readonly path?: string };

/** A name found in a file where it must not be. */
export type NameFinding = { readonly path: string; readonly line: number; readonly name: string };

/** The places where a platform repository states what it is: specifications, ontology, tests, fixtures and what is generated from them. A file elsewhere (the documents of a work, a public site) is not read unless the caller says. */
export const DEFAULT_SCOPE: readonly string[] = ["**/spec-kit/**", "**/specs/**", "**/ontology/**", "**/suite/**", "**/*.test.ts", "**/fixtures/**", "**/generated/**", "**/*.auto.*", "**/about.ts", "**/library.ts"];

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** The expression that finds a name as a whole phrase, in any case, with no letter or digit against either end. */
export function nameExpression(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(name.trim()).replace(/\s+/gu, "\\s+")}(?![\\p{L}\\p{N}])`, "iu");
}

const allowed = (allowances: readonly Allowance[], path: string, name: string): boolean =>
  allowances.some((a) => (a.name === undefined || a.name.toLowerCase() === name.toLowerCase()) && (a.path === undefined || matches(a.path, path)) && (a.name !== undefined || a.path !== undefined));

/** Whether a file is read: it is in the scope. */
export const inScope = (scope: readonly string[], path: string): boolean => scope.some((g) => matches(g, path));

/** The names found, one for each name on each line, in the order of the files and the lines: a name that an allowance covers is not found. Empty names are ignored. */
export function findNames(files: readonly NamedFile[], names: readonly string[], allowances: readonly Allowance[], scope: readonly string[] = DEFAULT_SCOPE): readonly NameFinding[] {
  const wanted = [...new Set(names.map((n) => n.trim()).filter((n) => n !== ""))].map((name) => ({ name, expression: nameExpression(name) }));
  const out: NameFinding[] = [];
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    if (!inScope(scope, file.path)) continue;
    const lines = file.text.split("\n");
    for (const [index, line] of lines.entries()) {
      for (const { name, expression } of wanted) {
        if (expression.test(line) && !allowed(allowances, file.path, name)) out.push({ path: file.path, line: index + 1, name });
      }
    }
  }
  return out;
}

/** A finding as one sentence. The name is not repeated in full where `hide` is asked: a report that is itself kept in a public place says the file and the line only. */
export function describeName(f: NameFinding, hide = false): string {
  return hide ? `${f.path}:${f.line} holds a name that must not be in it` : `${f.path}:${f.line} holds "${f.name}", which must not be in it`;
}
