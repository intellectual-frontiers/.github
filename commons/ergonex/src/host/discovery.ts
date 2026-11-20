// Spec: 0001-ergonex FR-004
/**
 * Finding the modules of `ergonex` on this computer (commons 0001-ergonex FR-004, FR-008, FR-009, FR-011): the typed built-in modules the command holds, the modules the workspace registers in
 * `<home>/.ergonex/modules.auto.json`, and the executables named `ergonex-*` on the `PATH` (found by `runtime/discover.ts`, with the extensions of `PATHEXT` on Windows), and the running of an
 * external one. A module found on the `PATH` is never run to be listed unless `--probe` is given, and then only to ask for its `--ergonex-manifest` within five seconds.
 *
 * @remarks
 * A registered module whose program has a pinned SHA-256 is read and hashed before it runs; one whose bytes differ is refused with the status of a host that cannot do it. A program that does not
 * answer `--ergonex-manifest`, or whose answer does not decode, is opaque: it runs, and its own exit status is passed on and recorded.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { existsSync, readTextFile, sha256File } from "../platform/r-fs.ts";
import { discoverPrograms } from "../platform/r-discover.ts";
import { run, which } from "../platform/r-proc.ts";
import type { Finding } from "../findings.ts";
import { decodeExternalManifest, type ExternalManifest, MANIFEST_FLAG, MANIFEST_TIMEOUT_MS } from "../modules/external.ts";
import { moduleName } from "../modules/name.ts";
import { type Candidates, decodeRegistered, type Found, programMatches, type RegisteredModule } from "../modules/registry.ts";
import type { Context } from "../modules/types.ts";
import { isAbsolute, join } from "../platform/r-path.ts";
import { AREA } from "./workspace.ts";

/** Where the registered modules are written. */
export const MODULES_FILE = "modules.auto.json";

/** What was found of the modules of a computer. */
export type Discovered = {
  readonly candidates: Candidates;
  /** The registered modules, with their programs and pins. */
  readonly registered: readonly RegisteredModule[];
  readonly findings: readonly Finding[];
};

/** Reads the three sources. The program of a module on the `PATH` is not run. */
export async function discoverModules(ctx: Context): Promise<Discovered> {
  const findings: Finding[] = [];
  const builtIn: Found[] = ctx.builtins.map((m) => ({
    name: m.name,
    source: "BuiltIn",
    summary: m.summary,
    where: "built-in",
  }));

  let registered: readonly RegisteredModule[] = [];
  const file = ctx.home === undefined ? undefined : join(ctx.home, AREA, MODULES_FILE);
  if (file !== undefined && existsSync(file)) {
    const read = decodeRegistered(await readTextFile(file));
    if (read.kind === "ok") registered = read.value;
    else
      findings.push({
        ruleId: "ergonex/modules-file",
        severity: "Warning",
        message: `${AREA}/${MODULES_FILE} cannot be read (${read.error}); run \`ergonex render\``,
        subject: MODULES_FILE,
        firstSeen: ctx.today,
      });
  }

  const found = await discoverPrograms("ergonex-", {
    path: ctx.env["PATH"] ?? "",
  });
  const onPath: Found[] = [];
  for (const p of found.found) {
    const name = moduleName(p.name);
    if (name.kind === "err") {
      findings.push({
        ruleId: "ergonex/module-name",
        severity: "Informational",
        message: `${p.file} is named ergonex-${p.name}, which is not a module name, and is not listed`,
        subject: p.name,
        firstSeen: ctx.today,
      });
      continue;
    }
    onPath.push({
      name: name.value,
      source: "Path",
      summary: "(on the PATH; run `ergonex list --probe` to ask it)",
      where: p.file,
    });
  }
  return {
    candidates: {
      builtIn,
      registered: registered.map((m) => ({
        name: m.name,
        source: "Registered",
        summary: m.summary ?? "(registered)",
        // a program the manifest names without a folder is below the root, so that the same manifest is the same on every computer
        where: isAbsolute(m.program) || ctx.home === undefined ? m.program : join(ctx.home, m.program),
        ...(m.sha256 === undefined ? {} : { sha256: m.sha256 }),
      })),
      path: onPath,
    },
    registered,
    findings,
  };
}

/** What a module answered to `--ergonex-manifest`: its manifest, or that it is opaque with the reason. */
export type Probed =
  | { readonly kind: "typed"; readonly manifest: ExternalManifest }
  | { readonly kind: "opaque"; readonly why: string }
  /** It did not answer within the wait (0001-ergonex FR-029): it is opaque, and the run says so as a finding. */
  | { readonly kind: "timed-out"; readonly ms: number };

/**
 * Asks a program for its manifest, within `timeoutMs` (five seconds where not given: 0001-ergonex FR-008, FR-029). This runs the program: only `--probe` calls it, and for a module on the `PATH` only
 * after the person said yes (FR-028); it is not sandboxed.
 */
export async function probeModule(program: string, timeoutMs: number = MANIFEST_TIMEOUT_MS): Promise<Probed> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const r = await run([program, MANIFEST_FLAG], { signal, killAfterMs: 500 });
    if (signal.aborted) return { kind: "timed-out", ms: timeoutMs };
    if (!r.success) return { kind: "opaque", why: `it ended with status ${r.code}` };
    const m = decodeExternalManifest(r.stdout);
    return m.kind === "ok" ? { kind: "typed", manifest: m.value } : { kind: "opaque", why: m.error };
  } catch (e) {
    if (signal.aborted) return { kind: "timed-out", ms: timeoutMs };
    return { kind: "opaque", why: e instanceof Error ? e.message : String(e) };
  }
}

/** Why an external module was not run. */
export type RunRefusal = { readonly kind: "changed"; readonly program: string } | { readonly kind: "missing"; readonly program: string };

/**
 * Runs an external module with the words, its streams shared with this process, and returns its exit status. A registered module with a pinned SHA-256 is hashed first and refused where the bytes differ.
 */
export async function runExternal(
  found: Found,
  registered: readonly RegisteredModule[],
  words: readonly string[],
): Promise<Result<number, RunRefusal>> {
  const program = found.where;
  if (found.source === "Registered") {
    if (!existsSync(program)) return err({ kind: "missing", program });
    const pin = registered.find((m) => m.name === found.name);
    if (pin?.sha256 !== undefined && !programMatches(pin, await sha256File(program))) return err({ kind: "changed", program });
  } else if (!existsSync(program) && which(program) === undefined) return err({ kind: "missing", program });
  const r = await run([program, ...words], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return ok(r.code);
}
