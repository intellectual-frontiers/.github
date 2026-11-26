// Spec: 0006-native-pinned-steps FR-001, FR-002, FR-003, FR-004
/**
 * The install of a pinned tool as steps a host carries out: a typed fetch (address, SHA-256, destination), a typed verify (the hash the file must have) and the extraction as `ArgvStep`s of core by the tools of the
 * operating system (`tar`, `unzip`, `msiexec`, `installer`, `install`): words only, never a shell string. TypeScript keeps the choice of the pin and the hash check; the unpacking is the platform's.
 *
 * @example
 * ```ts
 * import { installStepsOf } from "./steps.ts";
 * // installStepsOf(spec, "/opt/tools/x") is [fetch, verify, { argv: ["tar", "-xf", "/opt/tools/x/artifact", "-C", "/opt/tools/x"], as: "user", expect: [0] }]
 * ```
 *
 * @module
 */
import { argvFindings, err, ok, type ArgvStep, type Result } from "@intellectual-frontiers/core";
import { sameSha256, sha256, type Sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { InstallSpec } from "./install.ts";

/** What to download and where the bytes are written. */
export type FetchStep = { readonly kind: "fetch"; readonly url: string; readonly sha256: Sha256; readonly dest: string };
/** The hash the written file must have. */
export type VerifyStep = { readonly kind: "verify"; readonly file: string; readonly sha256: Sha256 };
/** A step of the install: typed data for the fetch and the verify, words for the rest. */
export type InstallStep = FetchStep | VerifyStep | ({ readonly kind: "argv" } & ArgvStep);

/** A kind of installer an artifact is, where it is not an archive: a Windows installer or a macOS package. */
export type Installer = "msi" | "pkg";

/** The name the artifact is written under in the folder. */
export const ARTIFACT_NAME = "artifact";

const unsafe = (text: string): boolean => text === "" || text.startsWith("-") || text.includes("\0");

const argv = (words: readonly string[], as: "user" | "root" = "user"): InstallStep => ({ kind: "argv", argv: words, as, expect: [0] });

/** The steps that install a pinned tool into a folder, or why they cannot be made; `installer` says that the artifact is a Windows installer or a macOS package and not an archive. */
export function installStepsOf(spec: InstallSpec, folder: string, installer?: Installer): Result<readonly InstallStep[], string> {
  if (unsafe(folder)) return err(`${JSON.stringify(folder)} is not a folder a command may be given`);
  const file = `${folder}/${ARTIFACT_NAME}`;
  const program = `${folder}/${spec.binPath === "" ? "" : `${spec.binPath}/`}${spec.program}${spec.os === "windows" && !/\.[A-Za-z0-9]+$/.test(spec.program) ? ".exe" : ""}`;
  const steps: InstallStep[] = [{ kind: "fetch", url: spec.downloadUrl, sha256: spec.sha256, dest: file }, { kind: "verify", file, sha256: spec.sha256 }];
  if (installer === "msi") steps.push(argv(["msiexec", "/i", file, "/qn", "/norestart"], "root"));
  else if (installer === "pkg") steps.push(argv(["installer", "-pkg", file, "-target", "/"], "root"));
  else
    switch (spec.archiveFormat) {
      case "tar":
        steps.push(argv(["tar", "-xf", file, "-C", folder]));
        break;
      case "zip":
        steps.push(argv(spec.os === "windows" ? ["tar", "-xf", file, "-C", folder] : ["unzip", "-q", "-o", file, "-d", folder]));
        break;
      case "file":
        if (spec.os !== "windows") steps.push(argv(["install", "-m", "0755", file, program]));
        break;
    }
  const problems = steps.flatMap((s) => (s.kind === "argv" ? argvFindings(s) : []));
  return problems.length > 0 ? err(problems.join("; ")) : ok(steps);
}

/** Whether the bytes are the SHA-256 the verify step names, or why not: both hashes are named. */
export async function verifyFileBytes(step: VerifyStep, bytes: Uint8Array): Promise<Result<true, string>> {
  const actual = await sha256(bytes);
  return sameSha256(actual, step.sha256) ? ok(true) : err(`the bytes of ${step.file} are SHA-256 ${actual}, and the pin is ${step.sha256}`);
}
