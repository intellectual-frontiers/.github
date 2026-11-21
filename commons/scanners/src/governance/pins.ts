// Spec: 0002-scanners-catalog FR-004
/**
 * The pin of a scanner's binary: its version, where it is and the SHA-256 of the file. A tool is run only when the file at the pin's path has the pinned digest: a tool that was replaced, updated in place or never pinned is refused, and so is one whose pin is missing a field. The pins are the tenant's and an owner's
 * approval is a commit that holds them; nothing here installs a tool or fetches one.
 *
 * @example
 * ```ts
 * import { parsePins } from "./pins.ts";
 * parsePins({ nuclei: { version: "3.3.0", path: "/opt/tools/nuclei", sha256: "a".repeat(64) } }).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The pin of one tool. */
export type Pin = { readonly version: string; readonly path: string; readonly sha256: string };

/** The pins of a tenant, by tool. */
export type Pins = Readonly<Record<string, Pin>>;

/** The pins from data, or every reason it is refused. */
export function parsePins(data: unknown): Result<Pins, readonly string[]> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return err(["the pins are an object of tools"]);
  const problems: string[] = [];
  const out: Record<string, Pin> = {};
  for (const [tool, p] of Object.entries(data)) {
    const x = p as Record<string, unknown> | null;
    if (typeof x !== "object" || x === null) {
      problems.push(`${tool}: a pin is { version, path, sha256 }`);
      continue;
    }
    if (typeof x["version"] !== "string" || x["version"].trim() === "") problems.push(`${tool}: the pin has no version`);
    if (typeof x["path"] !== "string" || !x["path"].startsWith("/")) problems.push(`${tool}: the path of the binary is absolute`);
    if (typeof x["sha256"] !== "string" || !/^[0-9a-f]{64}$/.test(x["sha256"])) problems.push(`${tool}: the sha256 is 64 hexadecimal digits`);
    if (problems.every((m) => !m.startsWith(`${tool}:`))) out[tool] = { version: x["version"] as string, path: x["path"] as string, sha256: x["sha256"] as string };
  }
  return problems.length > 0 ? err(problems) : ok(out);
}
