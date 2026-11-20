// Spec: 0011-credential-prompt FR-008, FR-009
/**
 * The helper contract of an `SSH_ASKPASS` program (commons headless 0011-credential-prompt FR-008): the program that `ssh` runs to ask for a passphrase or a password, given as data and pure
 * functions. `ssh` runs the helper with the prompt as its one argument and the environment `SSH_ASKPASS_PROMPT` (`confirm` for a yes or no, `none` for a message that needs no answer, absent for a secret),
 * reads the answer from its standard output, and takes a non-zero status as a refusal. `runAskpass` is the whole helper over a credential port: it reads the request from the arguments, asks once through
 * a session of the library (so the time limit and the typed refusals are the library's), and gives what to write and the status; `launcherOf` gives the file a system needs so that `ssh` can run the helper,
 * which on Windows is a `.cmd` shim and not a script.
 *
 * @remarks
 * The helper writes the answer to its standard output and nothing else there, writes nothing of the answer to its standard error, and keeps nothing: each run of the helper is one command, so a second
 * attempt of `ssh` is a second prompt (nothing is cached between processes). The prompt text of `ssh` is not secret and is the credential's id.
 *
 * @example
 * ```ts
 * import { requestOf } from "./helper.ts";
 * const r = requestOf(["Enter passphrase for key '/home/u/.ssh/id_ed25519': "], () => undefined);
 * r.kind === "ask" && r.request.kind; // "passphrase"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import {
  credentialSession,
  parseCredentialId,
  type Clock,
  type CredentialKind,
  type CredentialPort,
  type CredentialRequest,
} from "@intellectual-frontiers/headless/logical";

/** What the helper is asked to do. */
export type AskpassRequest =
  | { readonly kind: "ask"; readonly request: CredentialRequest }
  /** A message that needs no answer (`SSH_ASKPASS_PROMPT=none`): shown, and answered with nothing. */
  | { readonly kind: "inform"; readonly text: string };

/** Why the arguments are not a request. */
export type AskpassUsage = { readonly kind: "usage"; readonly why: string };

/** The kind of credential a prompt of `ssh` asks for, from its words. */
export function kindOfPrompt(text: string, promptKind: string | undefined): CredentialKind {
  if (promptKind === "confirm") return "confirm";
  if (/\bPIN\b/i.test(text)) return "pin";
  if (/passphrase/i.test(text)) return "passphrase";
  return "password";
}

/** The id of a prompt: the key a passphrase is for, the user and host a password is for, or the words themselves. */
export function idTextOf(text: string): string {
  const key = /^Enter passphrase for(?: key)? ['"]?(.+?)['"]?:?\s*$/i.exec(text);
  if (key?.[1] !== undefined) return `ssh-key:${key[1]}`;
  const pass = /^(.+)'s password:?\s*$/i.exec(text);
  if (pass?.[1] !== undefined) return `ssh-password:${pass[1]}`;
  return `ssh-prompt:${text.trim().slice(0, 150)}`;
}

/** The request from the helper's arguments (the program's own name first, then `ssh`'s prompt) and its environment. */
export function requestOf(args: readonly string[], env: (name: string) => string | undefined): Result<AskpassRequest, AskpassUsage> {
  const text = args[0];
  if (text === undefined || args.length > 1) return err({ kind: "usage", why: "the helper takes the prompt of ssh as its one argument" });
  const mode = env("SSH_ASKPASS_PROMPT");
  if (mode === "none") return ok({ kind: "inform", text });
  const id = parseCredentialId(idTextOf(text));
  if (id.kind === "err") return err({ kind: "usage", why: id.error });
  return ok({ kind: "ask", request: { kind: kindOfPrompt(text, mode), id: id.value, prompt: text } });
}

/** What the helper does: the text for its standard output, the text for its standard error, and its status. */
export type AskpassEnd = { readonly stdout: string; readonly stderr: string; readonly code: 0 | 1 | 2 };

/** What the helper runs with. */
export type AskpassOptions = {
  readonly port: CredentialPort;
  readonly clock: Clock;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

/**
 * The helper: reads its request, asks once, and gives the answer for `ssh` to read (a line on the standard output) with status 0, or nothing and status 1 where there was no answer (the reason, with no
 * value in it, on the standard error), or status 2 where its arguments are not a request. A message that needs no answer is shown on the standard error and answered with nothing.
 */
export async function runAskpass(args: readonly string[], env: (name: string) => string | undefined, o: AskpassOptions): Promise<AskpassEnd> {
  const request = requestOf(args, env);
  if (request.kind === "err") return { stdout: "", stderr: `${request.error.why}\n`, code: 2 };
  switch (request.value.kind) {
    case "inform":
      return { stdout: "", stderr: `${request.value.text}\n`, code: 0 };
    case "ask": {
      const asked = request.value.request;
      const session = credentialSession({ port: o.port, interactive: true, clock: o.clock, ...(o.timeoutMs === undefined ? {} : { timeoutMs: o.timeoutMs }), ...(o.signal === undefined ? {} : { signal: o.signal }) });
      try {
        const got = await session.get(asked);
        if (got.kind === "err") return { stdout: "", stderr: `${asked.id}: not given (${got.error.kind})\n`, code: 1 };
        return { stdout: `${got.value.reveal()}\n`, stderr: "", code: 0 };
      } finally {
        session.close();
      }
    }
    default:
      return absurd(request.value);
  }
}

/** The system a launcher is for. */
export type LauncherOs = "linux" | "darwin" | "windows";

/** The file `ssh` runs as its askpass program: its name, its text and the mode it is written with. */
export type Launcher = { readonly fileName: string; readonly text: string; readonly mode: number };

/**
 * The file that lets `ssh` run the helper: on Linux and macOS a script that runs the runtime on the helper's entry and passes the arguments on, on Windows a `.cmd` file that does (`ssh` there
 * starts the program it is given and does not run a `.ts` file). The paths are written between quotes, so one that holds a quote, a line break or (on Windows) a percent sign is refused.
 */
export function launcherOf(os: LauncherOs, runtime: string, entry: string): Result<Launcher, string> {
  const bad = (p: string): boolean => /["\r\n\u0000]/.test(p) || (os === "windows" ? /[%^&|<>!]/.test(p) : p.includes("'"));
  if (runtime === "" || entry === "") return err("the runtime and the entry of the helper are both needed");
  if (bad(runtime) || bad(entry)) return err("a path of the helper holds a character that cannot be quoted in a launcher");
  switch (os) {
    case "linux":
    case "darwin":
      return ok({ fileName: "askpass.sh", text: `#!/bin/sh\nexec '${runtime}' '${entry}' "$@"\n`, mode: 0o700 });
    case "windows":
      return ok({ fileName: "askpass.cmd", text: `@echo off\r\n"${runtime}" "${entry}" %*\r\n`, mode: 0o700 });
    default:
      return absurd(os);
  }
}

/** The variables `ssh` needs to run the helper where it has no display and no terminal of its own: `force` makes it use the helper even with a terminal, so the one prompt is the library's. */
export function askpassEnv(launcherPath: string): Readonly<Record<string, string>> {
  return { SSH_ASKPASS: launcherPath, SSH_ASKPASS_REQUIRE: "force" };
}
