/**
 * Finding a module (commons 0025-ifws FR-003, FR-004, FR-011): the typed built-in modules first, then the modules the workspace registers in `<home>/.if-workspaces/modules.auto.json`, then the
 * executables named `ifws-*` on the `PATH`, as Git finds `git-foo` for `git foo`. The first found runs; a module of a later source that it hides is an informational finding.
 *
 * @remarks
 * Pure: the three lists are read by the host layer and handed over; this module orders them, picks the first of each name and names what is hidden. A registered module may carry the SHA-256 of its
 * program, which `ifws` checks before running it (the check is `programMatches`, the read of the program is the host's).
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { array, formatDecodeError, json, object, string } from "../../kernel/decode.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { type Sha256, sha256Of } from "../../kernel/sha256.ts";
import type { Finding } from "../findings.ts";
import { moduleName } from "./name.ts";
import { type ModuleSource, MODULE_SOURCES, precedenceOf } from "./types.ts";

/** A module the workspace registers. */
export type RegisteredModule = { readonly name: string; readonly program: string; readonly sha256?: Sha256; readonly summary?: string };

const registeredShape = object({
  modules: array(object({ name: string, program: string }, { sha256: string, summary: string })),
});

/** The modules a `modules.auto.json` registers, or why it cannot be read (a name that is not a module name, a hash that is not a SHA-256, the same name twice). */
export function decodeRegistered(text: string): Result<readonly RegisteredModule[], string> {
  const r = json(text, registeredShape);
  if (r.kind === "err") return err(formatDecodeError(r.error));
  const out: RegisteredModule[] = [];
  const seen = new Set<string>();
  for (const [i, m] of r.value.modules.entries()) {
    const name = moduleName(m.name);
    if (name.kind === "err") return err(`$.modules[${i}].name: ${JSON.stringify(m.name)} is not a module name`);
    if (seen.has(m.name)) return err(`$.modules[${i}].name: ${m.name} is registered twice`);
    seen.add(m.name);
    const hash = m.sha256 === undefined ? undefined : sha256Of(m.sha256);
    if (m.sha256 !== undefined && hash === undefined) return err(`$.modules[${i}].sha256: not a SHA-256 (64 hexadecimal digits)`);
    out.push({
      name: m.name,
      program: m.program,
      ...(hash === undefined ? {} : { sha256: hash }),
      ...(m.summary === undefined ? {} : { summary: m.summary }),
    });
  }
  return ok(out);
}

/** A module found: its name, where it was found, what it says it does and where its program is (`built-in` for a typed module). */
export type Found = {
  readonly name: string;
  readonly source: ModuleSource;
  readonly summary: string;
  readonly where: string;
  readonly sha256?: Sha256;
};

/** The modules each source holds. */
export type Candidates = { readonly [S in ModuleSource as Uncapitalize<S>]: readonly Found[] };

/** The modules by name, each the first of its name in the order of the sources, and the ones that first hides. */
export type Resolved = {
  readonly modules: readonly Found[];
  readonly hidden: readonly { readonly module: Found; readonly by: Found }[];
};

/** The first module of each name in the order of the sources, in the order of the names, and every later one it hides. */
export function resolveAll(c: Candidates): Resolved {
  const chosen = new Map<string, Found>();
  const hidden: { module: Found; by: Found }[] = [];
  const bySource = (s: ModuleSource): readonly Found[] => {
    switch (s) {
      case "BuiltIn":
        return c.builtIn;
      case "Registered":
        return c.registered;
      case "Path":
        return c.path;
      default:
        return absurd(s);
    }
  };
  for (const source of [...MODULE_SOURCES].sort((a, b) => precedenceOf(a) - precedenceOf(b))) {
    for (const m of bySource(source)) {
      const first = chosen.get(m.name);
      if (first === undefined) chosen.set(m.name, m);
      else hidden.push({ module: m, by: first });
    }
  }
  return { modules: [...chosen.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)), hidden };
}

/** The module a name finds, or undefined. */
export function findModule(c: Candidates, name: string): Found | undefined {
  return resolveAll(c).modules.find((m) => m.name === name);
}

/** What a hidden module is told as: an informational finding naming both (0025-ifws FR-004). */
export function hiddenFindings(r: Resolved, today: string): readonly Finding[] {
  return r.hidden.map(({ module, by }) => ({
    ruleId: "ifws/module-hidden",
    severity: "Informational",
    message: `the module ${module.name} (${module.source}: ${module.where}) is hidden by the one of the same name that is ${by.source} (${by.where}), which runs`,
    subject: module.name,
    firstSeen: today,
  }));
}

/** Whether the bytes of a registered module's program are the ones the workspace pinned: true where it pinned none. */
export function programMatches(registered: RegisteredModule, actual: Sha256): boolean {
  return registered.sha256 === undefined || registered.sha256 === actual;
}
