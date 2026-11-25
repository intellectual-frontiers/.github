// Spec: 0004-workbench-catalog FR-004, FR-005
/**
 * Evaluation: requirements against the facts of a machine, as findings. It is pure: the facts are given (a probe reads them), so the same facts give the same findings on any computer and a test needs no program. A credential is
 * met by the presence of its name or an alias in the environment and its value is never part of the facts; a program is met by being present at the least version; a gate is not a failure and is never evaluated here.
 *
 * @example
 * ```ts
 * import { compareVersions } from "./evaluate.ts";
 * compareVersions("26.13.1", "26.2.0"); // 1
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { CATALOG, type CatalogCode, type Finding, type Requirement, severityOf } from "@intellectual-frontiers/workbench/governance";

/** What a probe found on a machine. A program is present with its version text (empty where it gave none) or absent. */
export type Facts = {
  readonly programs: Readonly<Record<string, string | undefined>>;
  /** The names, never the values, of the environment variables that are set. */
  readonly env: ReadonlySet<string>;
  readonly refs: ReadonlySet<string>;
  readonly identity: boolean;
  /** The folders whose dependencies are installed. */
  readonly installed: ReadonlySet<string>;
  readonly network: Readonly<Record<string, "ok" | "refused" | "unknown">>;
};

const numbers = (v: string): readonly number[] => (/\d+(?:\.\d+)*/u.exec(v)?.[0] ?? "0").split(".").map((n) => Number.parseInt(n, 10));

/** Compares two dotted versions by their numbers: negative, zero or positive. A suffix after the numbers is ignored. */
export function compareVersions(a: string, b: string): number {
  const x = numbers(a);
  const y = numbers(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const fill = (template: string, vars: Readonly<Record<string, string>>): string => template.replace(/\{(\w+)\}/gu, (_m, k: string) => vars[k] ?? `{${k}}`);

function finding(code: CatalogCode, r: Requirement, vars: Readonly<Record<string, string>>, today: string, enforceFrom: string): Finding {
  const entry = CATALOG[code];
  return { code, requirement: r.id, concept: entry.concept, severity: severityOf(entry, r.safety, today, enforceFrom), message: r.summary, fix: fill(entry.fix, vars), fixer: entry.fixer };
}

/** The findings for the requirements that are not met, in the order of the requirements; a requirement that is met gives none. */
export function evaluate(requirements: readonly Requirement[], facts: Facts, today: string, enforceFrom: string): readonly Finding[] {
  const out: Finding[] = [];
  for (const r of requirements) {
    switch (r.kind) {
      case "program": {
        const v = facts.programs[r.name];
        const install = (r.install ?? ["see the documentation of the program"]).join(" ");
        if (v === undefined) out.push(finding("E-WB-WORKSHOP-MISSING-PROGRAM", r, { name: r.name, install }, today, enforceFrom));
        else if (r.minimum !== undefined && v !== "" && compareVersions(v, r.minimum) < 0) out.push(finding("E-WB-WORKSHOP-WRONG-VERSION", r, { name: r.name, minimum: r.minimum, install }, today, enforceFrom));
        break;
      }
      case "credential":
        if (![r.name, ...(r.aliases ?? [])].some((n) => facts.env.has(n))) out.push(finding("E-WB-WORKBENCH-MISSING-CREDENTIAL", r, { name: r.name }, today, enforceFrom));
        break;
      case "network":
        if (facts.network[r.host] === "refused") out.push(finding("E-WB-WORKSHOP-NETWORK-REFUSED", r, { host: r.host }, today, enforceFrom));
        break;
      case "git":
        if (r.check === "ref-present" ? !facts.refs.has(r.ref ?? "") : !facts.identity) out.push(finding("E-WB-WORKSPACE-GIT-STATE", r, { ref: r.ref ?? "main" }, today, enforceFrom));
        break;
      case "install":
        if (!facts.installed.has(r.folder)) out.push(finding("E-WB-WORKSPACE-INSTALL-MISSING", r, { folder: r.folder, install: (r.install ?? ["bun", "install"]).join(" ") }, today, enforceFrom));
        break;
      case "authority":
        break;
      default:
        return absurd(r);
    }
  }
  return out;
}
