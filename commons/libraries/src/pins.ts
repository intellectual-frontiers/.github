/**
 * Commons' pins as the tools read them (commons 0005-typescript-practice FR-026, 0002-packaging FR-019): the `KEY=value` lines of `pins.auto.env`, the suffix of a platform's
 * variables, and the download of a pin on a platform (its version, address, SHA-256, format and folder), all taken from the file and written nowhere else.
 *
 * Spec: 0001-libraries FR-006
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The suffix of commons' pin variables for a platform (by the names `proc.build` gives); undefined where commons pins no download for it. */
export function pinSuffix(os: string, arch: string): string | undefined {
  const table: Readonly<Record<string, string>> = {
    "linux/x86_64": "X86_64",
    "linux/aarch64": "AARCH64",
    "darwin/x86_64": "MACOS_X64",
    "darwin/aarch64": "MACOS_ARM64",
    "windows/x86_64": "WINDOWS_X64",
  };
  return Object.hasOwn(table, `${os}/${arch}`) ? table[`${os}/${arch}`] : undefined;
}

/** The `KEY=value` lines of an env file; comments and blank lines left out. */
export function readEnvFile(text: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m?.[1] !== undefined && m[2] !== undefined) out.set(m[1], m[2]);
  }
  return out;
}

/** The formats of what a pinned address gives. */
export type PinFormat = "zip" | "tar" | "file";

/** What a download of a pin on a platform needs. */
export type PinDownload = {
  readonly version: string;
  readonly url: string;
  readonly sha256: string;
  readonly format: PinFormat;
  /** The folder of the programs inside the unpacked artifact; empty for the root. */
  readonly binPath: string;
};

/** Why a pin has no download on a platform. */
export type PinProblem =
  | { readonly kind: "no-version"; readonly key: string }
  | { readonly kind: "not-pinned"; readonly key: string; readonly suffix: string }
  | { readonly kind: "bad-format"; readonly key: string; readonly suffix: string; readonly format: string };

/** The sentence a problem is told in. */
export function describePinProblem(p: PinProblem): string {
  switch (p.kind) {
    case "no-version":
      return `commons pins no ${p.key}`;
    case "not-pinned":
      return `commons pins no download of ${p.key} for ${p.suffix}`;
    case "bad-format":
      return `commons pins ${p.key} for ${p.suffix} as ${JSON.stringify(p.format)}, which is no format (zip, tar, file)`;
  }
}

/** The download of the pin `key` (`BUN`) for the platform `suffix` (`X86_64`) as `pins.auto.env` states it, or why it has none. */
export function pinDownload(env: ReadonlyMap<string, string>, key: string, suffix: string): Result<PinDownload, PinProblem> {
  const version = env.get(`${key}_VERSION`);
  if (version === undefined) return err({ kind: "no-version", key });
  const url = env.get(`${key}_URL_${suffix}`);
  const sha256 = env.get(`${key}_SHA256_${suffix}`);
  const format = env.get(`${key}_FORMAT_${suffix}`);
  const binPath = env.get(`${key}_BINPATH_${suffix}`);
  if (url === undefined || sha256 === undefined || format === undefined || binPath === undefined) return err({ kind: "not-pinned", key, suffix });
  if (format !== "zip" && format !== "tar" && format !== "file") return err({ kind: "bad-format", key, suffix, format });
  return ok({ version, url, sha256, format, binPath });
}
