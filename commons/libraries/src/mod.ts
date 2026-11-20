/**
 * What of Mizan is still in this package (commons 0032-libraries-by-concern): the commands that need the whole repository. `check.ts` holds a repository's spec kit and ontologies, `versions.ts` and
 * `changes.ts` are the commands of the release check and the change-control check, `libraries.ts` reads the manifests of the libraries, `newer.ts` reports a standard newer than its pin, `generate-ontology.ts` writes the Turtle of the ontologies and
 * `oscal-register.ts` the register of proofs as OSCAL. The harness, the rules, the levels, the integrations, the change-control and release rules as plugins, and the trace of requirements are the
 * library `mizan` (`@intellectual-frontiers/mizan`), and the ontologies are the library `ontology` (`@intellectual-frontiers/ontology`).
 *
 * Spec: 0001-libraries FR-010
 *
 * @module
 */
export { decodeLibrarySource, type Library, LIBRARY_FILE, manifestFindings, readLibraries, verifyAll } from "./libraries.ts";
export { termRecordsOf } from "./check.ts";
export { staleFindings, type Fetched, type LatestManifest } from "./newer.ts";
export { checkVersions, run as runVersions, type VersionsCheck } from "./versions.ts";
export { digestOf, findingsOf, RUN, TURTLE_PATH, turtleOf } from "./generate-ontology.ts";
export { COMPONENT_FILE, registerDocuments, registerRows, RESULTS_FILE, type RegisterInput, type RegisterRow } from "./oscal-register.ts";
