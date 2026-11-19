// Spec: 0047-arcactl-init FR-004, FR-005
/**
 * The server model of `arcactl` (commons data 0047-arcactl-init FR-004, FR-005): how it runs where no person is there, in a pipeline, a deploy step, a container or a scheduled job. Everything is given
 * by the environment and the arguments; nothing is asked and no file of a home directory is written; a secret is given as a variable or as a file named by `<NAME>_FILE` (the convention of
 * Docker and Kubernetes secrets), never both. Which model applies is decided by what is said (an option, `ARCA_MODE`), then by what the environment shows (`CI`, no terminal), and only then does a
 * person at a terminal get the workstation.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";

/** The two ways `arcactl` runs. */
export type Mode = "workstation" | "server";

/** Which model applies, and why. */
export interface Chosen {
  readonly mode: Mode;
  readonly why: string;
}

const CI = ["CI", "GITHUB_ACTIONS", "GITLAB_CI", "BUILDKITE", "JENKINS_URL", "TF_BUILD", "CIRCLECI", "TEAMCITY_VERSION", "CODEBUILD_BUILD_ID"];
const truthy = (v: string | undefined): boolean => v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false";

/**
 * Chooses the model.
 *
 * @param argv - the arguments
 * @param env - the environment
 * @param tty - whether input and output are a terminal
 * @returns the mode and why
 */
export function modeOf(argv: readonly string[], env: Readonly<Record<string, string | undefined>>, tty: boolean): Chosen {
  if (argv.includes("--non-interactive")) return { mode: "server", why: "--non-interactive" };
  if (argv.includes("--interactive")) return { mode: "workstation", why: "--interactive" };
  const said = env["ARCA_MODE"]?.toLowerCase();
  if (said === "server" || said === "workstation") return { mode: said, why: `ARCA_MODE=${said}` };
  const ci = CI.find((n) => truthy(env[n]));
  if (ci !== undefined) return { mode: "server", why: `${ci} is set` };
  return tty ? { mode: "workstation", why: "a terminal" } : { mode: "server", why: "no terminal" };
}

/** Reads a file; a test gives its own. */
export type Read = (path: string) => string;

/**
 * A secret given by the environment: the variable `NAME`, or the file named by `NAME_FILE`.
 *
 * @param env - the environment
 * @param name - the variable's name
 * @param read - how a file is read
 * @returns the secret (a file's last line ending is not part of it), none where neither is given, or why it cannot be had
 */
export function secretOf(env: Readonly<Record<string, string | undefined>>, name: string, read: Read = (p) => readFileSync(p, "utf8")): Result<string | undefined, string> {
  const direct = env[name];
  const file = env[`${name}_FILE`];
  const has = direct !== undefined && direct !== "";
  if (has && file !== undefined && file !== "") return err(`${name} and ${name}_FILE are both set: give one`);
  if (has) return ok(direct);
  if (file === undefined || file === "") return ok(undefined);
  try {
    const text = read(file);
    return ok(text.replace(/\r?\n$/, ""));
  } catch (thrown) {
    return err(`${name}_FILE names ${file}, which cannot be read: ${thrown instanceof Error ? thrown.message.replace(/^.*?: /, "") : String(thrown)}`);
  }
}

/** What a server run is given by its environment. */
export interface ServerSettings {
  readonly url: string | undefined;
  readonly sealKey: string | undefined;
  readonly unlockSecret: string | undefined;
  /** The hash of a proposal that a person approved. */
  readonly approve: string | undefined;
  readonly log: "json" | "text";
}

/** The secrets and settings of a server run, or every reason they cannot be had. */
export function serverSettings(env: Readonly<Record<string, string | undefined>>, read?: Read): Result<ServerSettings, readonly string[]> {
  const errors: string[] = [];
  const get = (n: string): string | undefined => {
    const r = secretOf(env, n, read);
    if (r.kind === "err") {
      errors.push(r.error);
      return undefined;
    }
    return r.value;
  };
  const url = get("ARCA_DATABASE_URL");
  const sealKey = get("ARCA_SEAL_KEY");
  const unlockSecret = get("ARCA_UNLOCK_SECRET");
  const log = env["ARCA_LOG"] === "json" ? "json" : "text";
  if (errors.length > 0) return err(errors);
  return ok({ url, sealKey, unlockSecret, approve: env["ARCA_APPROVE"] === "" ? undefined : env["ARCA_APPROVE"], log });
}

/** What a mode may do: a server writes no file of a home directory and asks no question. */
export const mayWriteHome = (mode: Mode): boolean => mode === "workstation";
export const mayAsk = (mode: Mode): boolean => mode === "workstation";
