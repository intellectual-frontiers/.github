// Spec: 0004-anyfs-cli-surfaces FR-004
/**
 * How the program finds and loads its configuration (commons anyfs-cli 0004-anyfs-cli-surfaces FR-004): `--config FILE`, else the first `anyfs.config.ts` from the working folder up to the root of the checkout (the first
 * folder that holds `.git`, which is searched too), else the one in the user's configuration folder. The file is imported as TypeScript (which Bun and Node 26 both run), its default export, or its export `config`, is
 * read by `parseConfig`, and every way it can fail is a typed problem with its code. No file is not a problem: the program works on plain paths and addresses without one.
 *
 * @example
 * ```ts
 * import { findConfigFile } from "./config-load.ts";
 * findConfigFile("/nowhere/at/all", undefined, () => undefined); // undefined
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { dirsOf } from "@intellectual-frontiers/system/dirs";
import { existsSync } from "@intellectual-frontiers/system/fs";
import { dirname, join, resolve, toFileUrl } from "@intellectual-frontiers/system/path";
import { osOf } from "./os.ts";
import { CONFIG_FILE, type Config, type ConfigInput, parseConfig } from "@intellectual-frontiers/anyfs-cli/logical";

/** Why a configuration could not be had. */
export type ConfigProblem = { readonly code: "E-CONFIG-LOAD" | "E-CONFIG-INVALID"; readonly message: string };

/** The configuration's file: the one `--config` names, else the first from a folder up to the root of the checkout, else the user's. */
export function findConfigFile(from: string, explicit: string | undefined, env: (name: string) => string | undefined): string | undefined {
  if (explicit !== undefined) {
    const file = resolve(from, explicit);
    return existsSync(file) ? file : undefined;
  }
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const file = join(dir, CONFIG_FILE);
    if (existsSync(file)) return file;
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) break;
  }
  const user = dirsOf("anyfs", env, osOf()).config;
  const file = user === undefined ? undefined : join(user, CONFIG_FILE);
  return file !== undefined && existsSync(file) ? file : undefined;
}

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** The configuration a module exports: its default export, else its export `config`. */
function exportedInput(mod: unknown): ConfigInput | undefined {
  if (!isRecord(mod)) return undefined;
  const found = mod["default"] ?? mod["config"];
  return isRecord(found) ? (found as ConfigInput) : undefined;
}

let loads = 0;

/** Loads a configuration file, or says why it could not be. Each load is a fresh import of the file, so that a file that changed is read again in the same process. */
export async function loadConfigFile(file: string): Promise<Result<Config, ConfigProblem>> {
  let mod: unknown;
  try {
    mod = await import(`${toFileUrl(file).href}?load=${++loads}`);
  } catch (e) {
    return err({ code: "E-CONFIG-LOAD", message: `${file} could not be imported: ${e instanceof Error ? e.message : String(e)}` });
  }
  const input = exportedInput(mod);
  if (input === undefined) return err({ code: "E-CONFIG-LOAD", message: `${file} exports no configuration: export default defineConfig({ ... })` });
  try {
    const parsed = parseConfig(input);
    return parsed.kind === "ok" ? ok(parsed.value) : err({ code: "E-CONFIG-INVALID", message: `${file} is not valid: ${parsed.error.join("; ")}` });
  } catch (e) {
    return err({ code: "E-CONFIG-INVALID", message: `${file} is not valid: ${e instanceof Error ? e.message : String(e)}` });
  }
}
