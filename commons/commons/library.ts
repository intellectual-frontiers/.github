// Spec: 0036-distribution FR-021
/**
 * The manifest of the package `@intellectual-frontiers/commons`, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. In `single` distribution mode (0036-distribution FR-019) the folder packs every
 * library of commons as this one package (`bun tools/pack.ts`); in `per-library` mode `bundle` names the set of libraries the package depends on at exact versions (0036-distribution FR-005 to FR-008).
 */
export const library = {
  name: "commons",
  level: "L0",
  verify: "bun run verify",
  version: "0.26.1",
  distribution: ["github", "npm"],
  exports: ["."],
  bundle: "commons",
  summary: "Every library of commons as one package at one version: the compiled libraries, their declarations and sources, one exports map and the union of their dependencies. The whole of commons for a repository that uses it.",
};
