// Spec: 0011-credential-prompt FR-007, FR-008
/**
 * The surfaces of the credential port (commons headless 0011-credential-prompt): the terminal adapter and the pure reader of its bytes, the terminal of this process (a row of devices for each
 * system, so that Windows is the same port with another row), and the contract of an `SSH_ASKPASS` helper with the launcher file a system needs.
 *
 * @example
 * ```ts
 * import { launcherOf } from "@intellectual-frontiers/headless/askpass";
 * launcherOf("windows", "C:\\bun\\bun.exe", "C:\\tool\\askpass.ts").kind; // "ok"
 * ```
 *
 * @module
 */
export * from "./helper.ts";
export * from "./system-tty.ts";
export * from "./terminal.ts";
