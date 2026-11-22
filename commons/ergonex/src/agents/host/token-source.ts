// Spec: 0006-agents FR-007
/**
 * Where the token for the Git host and the package registry comes from (commons ergonex 0006-agents FR-007): `ERGONEX_GITHUB_TOKEN`, then the file named by `ERGONEX_GITHUB_TOKEN_FILE`, then the file
 * `ergonex/token` of the configuration folder. A file readable by anyone but its owner is refused (the mode of the target of a link is the mode); a token is never an argument; what is read is only ever
 * shown as `[secret]`.
 *
 * @example
 * ```ts
 * import { REDACTED, redact } from "./token-source.ts";
 * redact("a ghp_x b", ["ghp_x"]); // "a [secret] b"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { readTextFile, statSync } from "../../platform/r-fs.ts";
import { join } from "../../platform/r-path.ts";
import { modeIsPrivate, type TokenError } from "../redact.ts";

export { describeTokenError, modeIsPrivate, REDACTED, redact, type TokenError } from "../redact.ts";

/** Where a token was found. */
export type TokenOrigin = "environment" | "file-variable" | "config-file";

/** A token found and where it came from. The value never leaves a value of this type but through `redact` or an explicit use. */
export type FoundToken = { readonly origin: TokenOrigin; readonly value: string; readonly path?: string };

/** What is read to find a token. */
export type TokenSite = {
  readonly env: Readonly<Record<string, string | undefined>>;
  /** The configuration folder of the user (`$XDG_CONFIG_HOME`, else `$HOME/.config`). */
  readonly configHome: string | undefined;
};

/** The configuration folder from the environment: `$XDG_CONFIG_HOME`, else `$HOME/.config`. */
export function configHomeOf(env: Readonly<Record<string, string | undefined>>): string | undefined {
  const x = env["XDG_CONFIG_HOME"];
  if (x !== undefined && x !== "") return x;
  const h = env["HOME"] ?? env["USERPROFILE"];
  return h === undefined || h === "" ? undefined : join(h, ".config");
}

async function fromFile(path: string, origin: TokenOrigin): Promise<Result<FoundToken, TokenError>> {
  let mode: number;
  try {
    // `statSync` follows a link: the mode of the target is the mode
    const m = statSync(path).mode;
    if (m === null) return err({ kind: "unreadable", path, reason: "this system gives no mode of a file" });
    mode = m;
  } catch (e) {
    return err({ kind: "unreadable", path, reason: e instanceof Error ? e.message : String(e) });
  }
  if (!modeIsPrivate(mode)) return err({ kind: "mode", path, mode: (mode & 0o777).toString(8).padStart(3, "0") });
  let text: string;
  try {
    text = (await readTextFile(path)).trim();
  } catch (e) {
    return err({ kind: "unreadable", path, reason: e instanceof Error ? e.message : String(e) });
  }
  if (text === "") return err({ kind: "empty", path });
  return ok({ origin, value: text, path });
}

/** The token, or undefined where there is none anywhere, or the reason a file that is there cannot be used. */
export async function findToken(site: TokenSite): Promise<Result<FoundToken | undefined, TokenError>> {
  const fromEnv = site.env["ERGONEX_GITHUB_TOKEN"];
  if (fromEnv !== undefined && fromEnv !== "") return ok({ origin: "environment", value: fromEnv });
  const named = site.env["ERGONEX_GITHUB_TOKEN_FILE"];
  if (named !== undefined && named !== "") return fromFile(named, "file-variable");
  if (site.configHome !== undefined) {
    const path = join(site.configHome, "ergonex", "token");
    let there = true;
    try {
      statSync(path);
    } catch {
      there = false;
    }
    if (there) return fromFile(path, "config-file");
  }
  return ok(undefined);
}


