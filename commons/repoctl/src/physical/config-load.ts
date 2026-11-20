// Spec: 0009-repoctl-config FR-002
/**
 * How the host finds and loads a repository's configuration (commons repoctl 0009-repoctl-config FR-002): `--config FILE`, else the first `repoctl.config.ts` from the working folder up to the root of the Git checkout; the file is imported (it
 * runs on Bun and on Node 26 as it is), its default export, or its export `config`, is read by `parseConfig`, and every way it can fail is a typed problem with its code. The repository's root is the folder of the file.
 *
 * @example
 * ```ts
 * import { findConfigFile } from "@intellectual-frontiers/repoctl/physical";
 * findConfigFile("/nowhere/at/all", undefined); // undefined
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { CONFIG_FILE, type Config, type ConfigInput, parseConfig } from "@intellectual-frontiers/repoctl/governance";
import { existsSync } from "@intellectual-frontiers/system/fs";
import { dirname, join, resolve, toFileUrl } from "@intellectual-frontiers/system/path";

/** Why a configuration could not be had. */
export type ConfigProblem = { readonly code: "E-CONFIG-MISSING" | "E-CONFIG-LOAD" | "E-CONFIG-INVALID"; readonly message: string };

/** The configuration's file: the one `--config` names, else the first `repoctl.config.ts` from a folder up to the root of the checkout (the first folder that holds `.git`, which is searched too). */
export function findConfigFile(from: string, explicit: string | undefined): string | undefined {
  if (explicit !== undefined) {
    const file = resolve(from, explicit);
    return existsSync(file) ? file : undefined;
  }
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const file = join(dir, CONFIG_FILE);
    if (existsSync(file)) return file;
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return undefined;
  }
}

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** The configuration a module exports: its default export, else its export `config`. */
function exportedInput(mod: unknown): ConfigInput | undefined {
  if (!isRecord(mod)) return undefined;
  const found = mod["default"] ?? mod["config"];
  return isRecord(found) && typeof found["repo"] === "string" && isRecord(found["commit"]) ? (found as ConfigInput) : undefined;
}

/** Loads a configuration file: its root (the folder it is in) and the configuration, or the problem. */
export async function loadConfigFile(file: string): Promise<Result<{ readonly root: string; readonly config: Config }, ConfigProblem>> {
  let mod: unknown;
  try {
    mod = await import(toFileUrl(file).href);
  } catch (e) {
    return err({ code: "E-CONFIG-LOAD", message: `${file} could not be imported: ${e instanceof Error ? e.message : String(e)}` });
  }
  const input = exportedInput(mod);
  if (input === undefined) return err({ code: "E-CONFIG-LOAD", message: `${file} exports no configuration: export defineConfig({ ... }) as its default` });
  try {
    const parsed = parseConfig(input);
    if (parsed.kind === "err") return err({ code: "E-CONFIG-INVALID", message: `${file} is not valid: ${parsed.error.join("; ")}` });
    return ok({ root: dirname(file), config: parsed.value });
  } catch (e) {
    return err({ code: "E-CONFIG-INVALID", message: `${file} is not valid: its shape is not that of ConfigInput (${e instanceof Error ? e.message : String(e)})` });
  }
}

/** The configuration of no repository: no generator, no check, no optional verb. What a host holds where the file is missing, so that `help` and `doctor` still run. */
export function bareConfig(): Config {
  const parsed = parseConfig({ repo: "(no repoctl.config.ts)", commit: { identity: { name: "repoctl", email: "repoctl@localhost" } } });
  if (parsed.kind === "err") throw new Error(`the bare configuration is not valid: ${parsed.error.join("; ")}`);
  return parsed.value;
}

/** The configuration of an imagined repository that has every optional verb, which is what a documentation lens describes: the program is described with all of its verbs. */
export function describedConfig(): Config {
  const parsed = parseConfig({
    repo: "(described)",
    commit: { identity: { name: "repoctl", email: "repoctl@localhost" } },
    capabilities: { release: true, newLibrary: true, status: true, prove: true },
    libraries: { folder: "libraries" },
    hygiene: { scope: "@scope/" },
    docs: {},
  });
  if (parsed.kind === "err") throw new Error(`the described configuration is not valid: ${parsed.error.join("; ")}`);
  return parsed.value;
}
