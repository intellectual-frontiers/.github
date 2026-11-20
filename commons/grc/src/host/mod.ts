// Spec: 0001-grc-engineering FR-019
/**
 * The host of GRC engineering (commons 0007-grc): `grc` loads the settings of packs, waivers, risk registers and impact declarations from TOML, YAML, JSON and JSON5 files and runs a pack as signals, and `sign`
 * signs and verifies with `ssh-keygen -Y` and with Web Crypto keys through DSSE, behind one signer interface. It touches the host (files, processes) and the pipeline of the telemetry that a process installs.
 *
 * @example
 * ```ts
 * import { sign } from "@intellectual-frontiers/grc/host";
 * typeof sign; // "object"
 * ```
 *
 * @module
 */
export * as grc from "./grc.ts";
export * as sign from "./sign.ts";
