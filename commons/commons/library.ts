// Spec: 0036-distribution FR-005
/**
 * The manifest of the metapackage `@intellectual-frontiers/commons`, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. It has no code of its own: `bundle` names the set of libraries
 * its package depends on at exact versions, which `bun commons/libraries/src/pack-metapackage.ts` writes to `dependencies.auto.json` from the manifests of the libraries (commons 0036-distribution FR-005 to FR-008).
 *
 * @module
 */
export const library = {
  name: "commons",
  level: "L0",
  verify: "bun run verify",
  version: "0.1.9",
  distribution: ["github", "npm"],
  exports: ["."],
  bundle: "commons",
  summary: "Every consumer-facing library of commons as one install, each at an exact version. The whole of commons for a repository that uses it.",
};
