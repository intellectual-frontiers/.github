// Spec: 0028-modules FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Modules (commons data 0028-modules): a subject area as a value, composed with others into one domain. A module names the modules it requires and holds concepts and code lists that may refer to
 * those of the modules it requires; a project lists the modules it wants and `composeModules` makes one domain of them, validated whole. A module that is not listed has no concept in the domain,
 * so it has no table.
 *
 * @example
 * ```ts
 * const billing = defineModule({ name: "billing", requires: ["party"], concepts: [invoice], codeLists: [] });
 * const app = composeModules("shop", { definition: "A shop" }, [moduleOf(partyDomain.value), billing]);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Annotation } from "./annotation.ts";
import type { AnyCodeList } from "./codelist.ts";
import { type AnyConcept, type Domain, type DomainError, domain } from "./model.ts";

/** A subject area. */
export interface Module {
  readonly kind: "module";
  readonly name: string;
  readonly definition: string;
  readonly requires: readonly string[];
  readonly concepts: readonly AnyConcept[];
  readonly codeLists: readonly AnyCodeList[];
}

/** What a module is made from. */
export interface ModuleSpec {
  readonly name: string;
  readonly definition?: string;
  readonly requires?: readonly string[];
  readonly concepts: readonly AnyConcept[];
  readonly codeLists?: readonly AnyCodeList[];
}

/**
 * A module.
 *
 * @param spec - its name, what it requires, its concepts and code lists
 * @returns the module
 */
export const defineModule = (spec: ModuleSpec): Module =>
  Object.freeze({
    kind: "module",
    name: spec.name,
    definition: spec.definition ?? "",
    requires: Object.freeze([...(spec.requires ?? [])]),
    concepts: Object.freeze([...spec.concepts]),
    codeLists: Object.freeze([...(spec.codeLists ?? [])]),
  });

/**
 * A module made from a domain that is already valid.
 *
 * @param d - the domain
 * @param requires - the modules it requires, none where it stands alone
 * @returns the module, named as the domain is
 */
export const moduleOf = (d: Domain, requires: readonly string[] = []): Module =>
  defineModule({ name: d.name, definition: d.definition, requires, concepts: d.concepts, codeLists: d.codeLists });

export type ComposeError =
  | { readonly kind: "duplicate-module"; readonly module: string }
  | { readonly kind: "missing"; readonly module: string; readonly requires: string }
  | { readonly kind: "cycle"; readonly modules: readonly string[] }
  | { readonly kind: "duplicate-element"; readonly name: string; readonly what: "concept" | "codelist"; readonly modules: readonly [string, string] }
  | { readonly kind: "undeclared-dependency"; readonly module: string; readonly concept: string; readonly refersTo: string; readonly in: string }
  | { readonly kind: "unknown-module"; readonly module: string }
  | { readonly kind: "domain"; readonly errors: readonly DomainError[] };

/** The modules in the order of their requirements, a module after those it requires, otherwise as listed; or why not. */
function ordered(modules: readonly Module[]): Result<readonly Module[], readonly ComposeError[]> {
  const errors: ComposeError[] = [];
  const by = new Map<string, Module>();
  for (const m of modules) {
    if (by.has(m.name)) errors.push({ kind: "duplicate-module", module: m.name });
    by.set(m.name, m);
  }
  for (const m of modules) for (const r of m.requires) if (!by.has(r)) errors.push({ kind: "missing", module: m.name, requires: r });
  if (errors.length > 0) return err(errors);
  const out: Module[] = [];
  const done = new Set<string>();
  const path: string[] = [];
  const visit = (m: Module): void => {
    if (done.has(m.name)) return;
    if (path.includes(m.name)) {
      errors.push({ kind: "cycle", modules: [...path.slice(path.indexOf(m.name)), m.name] });
      done.add(m.name);
      return;
    }
    path.push(m.name);
    for (const r of m.requires) visit(by.get(r) as Module);
    path.pop();
    done.add(m.name);
    out.push(m);
  };
  for (const m of modules) visit(m);
  return errors.length > 0 ? err(errors) : ok(out);
}

/**
 * The domain of the modules a project lists.
 *
 * @param name - the project's name for the domain, which the identities of its elements carry
 * @param spec - its definition and its own annotations
 * @param modules - the modules, every one required by a listed module included
 * @returns the domain, or every error
 */
export function composeModules(
  name: string,
  spec: { readonly definition?: string; readonly annotations?: readonly Annotation[] },
  modules: readonly Module[],
): Result<Domain, readonly ComposeError[]> {
  const order = ordered(modules);
  if (order.kind === "err") return order;
  const errors: ComposeError[] = [];
  const concepts: AnyConcept[] = [];
  const codeLists: AnyCodeList[] = [];
  const conceptOwner = new Map<string, string>();
  const listOwner = new Map<string, string>();
  const ownerOfConcept = new Map<AnyConcept, string>();
  const ownerOfList = new Map<AnyCodeList, string>();
  for (const m of order.value) {
    for (const c of m.concepts) {
      const first = conceptOwner.get(c.name);
      if (first !== undefined && !(ownerOfConcept.get(c) === first)) errors.push({ kind: "duplicate-element", name: c.name, what: "concept", modules: [first, m.name] });
      else if (first === undefined) {
        conceptOwner.set(c.name, m.name);
        ownerOfConcept.set(c, m.name);
        concepts.push(c);
      }
    }
    for (const l of m.codeLists) {
      const first = listOwner.get(l.name);
      if (first !== undefined && !(ownerOfList.get(l) === first)) errors.push({ kind: "duplicate-element", name: l.name, what: "codelist", modules: [first, m.name] });
      else if (first === undefined) {
        listOwner.set(l.name, m.name);
        ownerOfList.set(l, m.name);
        codeLists.push(l);
      }
    }
  }
  // a module may refer only to itself and what it requires, directly or through what those require
  const reach = new Map<string, Set<string>>();
  const by = new Map(order.value.map((m) => [m.name, m]));
  const closure = (m: Module): Set<string> => {
    const have = reach.get(m.name);
    if (have !== undefined) return have;
    const s = new Set<string>([m.name]);
    reach.set(m.name, s);
    for (const r of m.requires) for (const x of closure(by.get(r) as Module)) s.add(x);
    return s;
  };
  for (const m of order.value) {
    const may = closure(m);
    for (const c of m.concepts) {
      const refs: { to: AnyConcept | undefined; list: AnyCodeList | undefined; label: string }[] = [
        ...Object.values(c.relationships).map((r) => ({ to: typeof r.to === "function" ? (r.to as () => AnyConcept)() : (r.to as AnyConcept), list: undefined, label: "" })),
        ...Object.values(c.attributes).flatMap((a) => (a.type.kind === "code" ? [{ to: undefined, list: a.type.list as AnyCodeList, label: "" }] : [])),
      ];
      for (const r of refs) {
        const owner = r.to !== undefined ? ownerOfConcept.get(r.to) : r.list !== undefined ? ownerOfList.get(r.list) : undefined;
        const what = r.to?.name ?? r.list?.name ?? "";
        if (owner !== undefined && !may.has(owner)) errors.push({ kind: "undeclared-dependency", module: m.name, concept: c.name, refersTo: what, in: owner });
      }
    }
  }
  if (errors.length > 0) return err(errors);
  const d = domain(name, { ...(spec.definition === undefined ? {} : { definition: spec.definition }), concepts, codeLists, ...(spec.annotations === undefined ? {} : { annotations: spec.annotations }) });
  return d.kind === "err" ? err([{ kind: "domain", errors: d.error }]) : d;
}

/**
 * The modules a project gets from the names it wants: those and everything they require, in the order of the requirements.
 *
 * @param all - the modules that exist
 * @param wanted - the names a project wants
 * @returns the modules to compose, or why not
 */
export function withRequired(all: readonly Module[], wanted: readonly string[]): Result<readonly Module[], readonly ComposeError[]> {
  const by = new Map(all.map((m) => [m.name, m]));
  const errors: ComposeError[] = [];
  const picked = new Map<string, Module>();
  const take = (n: string, from?: string): void => {
    if (picked.has(n)) return;
    const m = by.get(n);
    if (m === undefined) {
      errors.push(from === undefined ? { kind: "unknown-module", module: n } : { kind: "missing", module: from, requires: n });
      return;
    }
    picked.set(n, m);
    for (const r of m.requires) take(r, m.name);
  };
  for (const n of wanted) take(n);
  if (errors.length > 0) return err(errors);
  return ordered([...picked.values()]);
}
