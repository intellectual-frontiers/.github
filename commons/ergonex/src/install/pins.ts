// Spec: 0004-onboarding FR-008
/**
 * What the installers pin (commons ergonex 0004-onboarding FR-008): the version of Bun, and the SHA-256 of its release for each system, the same that commons pins (`commons/generated/pins.auto.env`, which
 * `suite/ergonex-install.test.ts` compares where it is there), so that an installer checks the bytes it runs.
 *
 * @module
 */

/** One system's release of Bun. */
export type BunRelease = {
  /** The name Bun's release asset has for the system (`bun-<target>.zip`). */
  readonly target: string;
  readonly sha256: string;
};

/** The version of Bun the installers install where there is no Bun. */
export const BUN_VERSION = "1.4.4";

/** The releases, by the system as the installers name it: `linux-x64`, `linux-aarch64`, `darwin-x64`, `darwin-aarch64`, `windows-x64`. */
export const BUN_RELEASES: Readonly<Record<string, BunRelease>> = {
  "linux-x64": {
    target: "linux-x64",
    sha256: "bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c",
  },
  "linux-aarch64": {
    target: "linux-aarch64",
    sha256: "baa6bb36f51d6e58561e02bbea825038a9df454f673d6d776e8bbf86f8c7850e",
  },
  "darwin-x64": {
    target: "darwin-x64",
    sha256: "50a3491f73abc2fe81673171a85762d3bc2cc1680ccecadd983de99adf77977e",
  },
  "darwin-aarch64": {
    target: "darwin-aarch64",
    sha256: "c240d7f0ccb90c263a849fcdb09b7ee62630d921348ed6aafda86b9d577bc510",
  },
  "windows-x64": {
    target: "windows-x64",
    sha256: "cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5",
  },
};

/** Where Bun's releases are, which a test points at a folder of its own with `ERGONEX_BUN_BASE_URL` (never the hash, which is not overridable). */
export const BUN_BASE_URL = "https://github.com/oven-sh/bun/releases/download";
