// Spec: 0005-reach-and-targets FR-005
/**
 * The ssh target of Headless (commons headless 0005-reach-and-targets): an executor that runs a program on a machine through the system's OpenSSH client, with
 * the one set of options, the quoting of the remote command, the known hosts of the repository then the user's, a host key that never matches by being
 * accepted, a verb-sized first contact, and the ban on hand-built `ssh` arguments in consumers. It holds no SSH protocol and no library of one.
 *
 * @example
 * ```ts
 * import { sshExecutor } from "@intellectual-frontiers/headless/targets/ssh";
 * ```
 *
 * @module
 */
export * from "./argv.ts";
export * from "./ban.ts";
export * from "./executor.ts";
export * from "./hostkey.ts";
