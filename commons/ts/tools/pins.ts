/**
 * Commons' pins as the tools read them (commons 0005-typescript-runtime FR-026): the `KEY=value` lines of `pins.auto.env`, and which of
 * Bun's release assets and pin keys belong to a platform.
 *
 * @module
 */

/** The target name of Bun's release asset and the suffix of commons' pin key for a platform (by `Deno.build`'s names); undefined where Bun has no build. */
export function bunTarget(os: string, arch: string): { readonly target: string; readonly key: string } | undefined {
  const table: Readonly<Record<string, { readonly target: string; readonly key: string }>> = {
    "linux/x86_64": { target: "linux-x64", key: "X86_64" },
    "linux/aarch64": { target: "linux-aarch64", key: "AARCH64" },
    "darwin/x86_64": { target: "darwin-x64", key: "MACOS_X64" },
    "darwin/aarch64": { target: "darwin-aarch64", key: "MACOS_ARM64" },
    "windows/x86_64": { target: "windows-x64", key: "WINDOWS_X64" },
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
