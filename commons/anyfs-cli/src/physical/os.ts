// Spec: 0004-anyfs-cli-surfaces FR-003
/**
 * The operating system as the three the program tells apart (commons anyfs-cli 0004-anyfs-cli-surfaces FR-003): the folders of a program and the roots of a path are the same on every Unix, so every system that is
 * neither Windows nor macOS is `linux`.
 *
 * @example
 * ```ts
 * import { osOf } from "./os.ts";
 * osOf(); // "linux"
 * ```
 *
 * @module
 */
import { build } from "@intellectual-frontiers/system/proc";

/** The system's kind. */
export type OsKind = "linux" | "darwin" | "windows";

/** The system this process runs on. */
export function osOf(): OsKind {
  return build.os === "windows" ? "windows" : build.os === "darwin" ? "darwin" : "linux";
}
